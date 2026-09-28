import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
function fixture(){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,open:false,
  dataset:{},addEventListener(){},replaceChildren(){},classList:{toggle(){}}});return nodes.get(id);};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,
  document:{hidden:false,getElementById:node,querySelectorAll:()=>[]},navigator:{onLine:true},location:{hash:'',search:''},
  window:{MemphisAuth:{getCSTDateString:()=> '2026-09-26'},lucide:{createIcons(){}}}});
 const run=code=>vm.runInContext(code,context);run(source);
 run(`state.snapshot={week_start:'2026-09-28',week_end:'2026-10-04',authority_revision:42,drafts:[],
  current_publication:{publication_id:'published-id'},roster:[]};
  els.week_start.value='2026-09-28';els.service_date.value='2026-09-28';
  globalThis.calls=[];globalThis.response={status:'CANDIDATE_ONLY',admitted:false,published:false,affectedPhonesUpdated:false,
   authorityRevision:42,publicationId:'published-id',effectiveDate:'2026-09-28',staffedPositions:6,previewDigest:'a'.repeat(64),
   changes:[{day:1,phase:'equalized',employees:[{owner:'KATHY',weightedLoad:8,restroomSites:3,gained:['AREA_B'],released:['AREA_A']}]}],
   decision:{schema:'memphis-zoo.recurring-manager-decision.v1',effectiveDate:'2026-09-28',
    assignments:[{serviceDate:'2026-09-28',personId:'kathy',displayName:'Kathy',status:'ASSIGNED',window:{start:'09:45',end:'17:00'},
     workSnapshot:{locationNameSnapshot:'Area B'}},{serviceDate:'2026-09-28',status:'OPEN',workId:'open-area',
     window:{start:'07:00',end:'09:45'},workSnapshot:{locationNameSnapshot:'Uncovered area'},explanation:{reasons:[{code:'not_feasible'}]}}],
    gaps:{open:[{workId:'open-area'}],review:[]},fixedLunch:{loans:[{loan_id:'loan',service_date:'2026-09-28',normal_owner_person_id:'kathy',
     coverage_start:'12:00',coverage_end:'13:00',status:'PLANNED',fallback:'only_one_eligible_custodian'}],responsibilities:[{loan_id:'loan',coverer_person_id:'kathy',segments:[{
      workId:'relief-work',includedLocations:[{locationId:'AREA_B',locationNameSnapshot:'Lunch relief area'}],window:{start:'12:10',end:'12:40'}}]}]}}};
  api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return response;};`);
 return {run,node,json:code=>JSON.parse(run('JSON.stringify('+code+')'))};
}
let checks=0;const same=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
{
 const f=fixture();await f.run('previewRecurringStaffing()');
 same(f.json('calls'),[{path:'/static-weekly/recurring-adaptation/preview',body:{effective_start:'2026-09-28',expected_revision:42}}],
  'preview sends only authority selectors, never compiler bytes or people');
 same(f.node('recurring-preview').hidden,false,'complete candidate is visible');
 const html=f.node('recurring-preview-days').innerHTML;
 for(const text of ['Kathy','Area B','09:45','17:00','Uncovered area','not_feasible','12:00','13:00','gains AREA_B','releases AREA_A','2026-10-04',
  'Lunch relief area','12:10','12:40','only_one_eligible_custodian']){
  assert.ok(html.includes(text),`complete duties/gaps/lunch/change display includes ${text}`);checks++;
 }
 assert.match(f.node('recurring-preview-summary').textContent,/1 open items, 0 review items/);checks++;
 assert.match(f.node('status').textContent,/Not published; phone schedules are unchanged/);checks++;
 same(f.run('state.snapshot.authority_revision'),42,'preview does not advance accepted authority');
 same(f.run('calls.some(row=>/confirm|publish|drafts/.test(row.path))'),false,'preview never invokes a write command');
 f.run('clearRecurringPreview()');same(f.run('state.recurringPreview'),null,'close discards only unaccepted preview');
 same(f.node('recurring-preview').hidden,true,'closed preview is no longer displayed');
}
{
 const f=fixture();f.run(`state.snapshot.roster=Array.from({length:9},(_,i)=>({slot_id:'position-'+i,
  incumbencies:[{person_id:'person-'+i,effective_start:'2020-01-01',effective_end:null}],
  week_staffing:[{service_date:'2026-09-28',availability_state:'departed_named_absent'}]}));`);
 await f.run('previewRecurringStaffing()');
 same(f.json('calls[0].body.full_nine_source_id'),'a00cdf2a-0623-5e2d-bc65-338c1dd67202',
  'dated absence does not turn nine filled recurring positions into eight');
}
for(const change of ["response.previewDigest='z'.repeat(64)","response.decision.fixedLunch=null",
 "response.authorityRevision=43","response.affectedPhonesUpdated=true","response.decision.assignments=[]"]){
 const f=fixture();f.run(change);await f.run('previewRecurringStaffing()');
 same(f.run('state.recurringPreview'),null,'mismatched response is not displayed');
 same(f.node('recurring-preview').hidden,true,'incomplete result stays hidden');
 assert.match(f.node('status').textContent,/incomplete or mismatched/);checks++;
}
{
 const f=fixture();f.run(`api=async()=>{state.snapshot={...state.snapshot,authority_revision:43};return response;}`);
 await f.run('previewRecurringStaffing()');same(f.run('state.recurringPreview'),null,'concurrent authority change invalidates preview');
 assert.match(f.node('status').textContent,/authority changed/);checks++;
}
{
 const f=fixture();f.run(`response.decision.assignments[0].displayName='<img src=x onerror=alert(1)>';`);
 await f.run('previewRecurringStaffing()');
 assert.ok(f.node('recurring-preview-days').innerHTML.includes('&lt;img'));checks++;
 assert.ok(!f.node('recurring-preview-days').innerHTML.includes('<img'));checks++;
}
{
 const f=fixture();f.run("state.remotePendingStaffing={operation_id:'other',state:'PREPARED'}");
 await f.run('previewRecurringStaffing()');same(f.run('calls.length'),0,'pending staffing operation fences a conflicting preview');
}
assert.match(page,/clearCoverAllPdfs\(\);clearRecurringPreview\(\);state.snapshot=snapshot/);checks++;
function repairFixture(){
 const f=fixture();f.run(`response.sourceId='pattern-source';response.patternPublicationId='prior-pattern';
  response.repairContextDigest='b'.repeat(64);response.repairContext={schema:'static-weekly.recurring-repair-basis.v1',
   state:'REPLACING_INVALID_FUTURE',effectivePublicationId:'published-id',patternPublicationId:'prior-pattern',
   patternSourceId:'pattern-source',effectiveStart:'2026-09-28',authorityRevision:42,
   managerConfirmationRequired:true,published:false,invalidations:[{invalidationId:'terminal'}]};`);return f;
}
{
 const f=repairFixture();await f.run('previewRecurringStaffing()');
 same(f.node('recurring-preview').hidden,false,'explicit repair candidate visible');
 assert.match(f.node('recurring-preview-summary').textContent,/REPAIR PREVIEW.*current recurring schedule remains blocked.*position pattern only.*current staff/);checks++;
 assert.match(f.node('status').textContent,/Not published; phone schedules are unchanged/);checks++;
 same(f.json('calls').length,1,'repair is only preview, not publication or employee restoration');
}
for(const change of ["response.repairContext=null","response.repairContext.effectivePublicationId='old'",
 "response.repairContext.published=true","response.repairContext.managerConfirmationRequired=false",
 "response.repairContext.effectiveStart='2026-10-05'","response.repairContext.authorityRevision=43",
 "response.repairContext.patternSourceId='different'","response.patternPublicationId='published-id'",
 "response.repairContext.invalidations=[]","response.repairContextDigest='bad'","delete response.repairContext"]){
 const f=repairFixture();f.run(change);await f.run('previewRecurringStaffing()');
 same(f.run('state.recurringPreview'),null,'mismatched repair not displayed');
 same(f.node('recurring-preview').hidden,true,'mismatched repair hidden');
 assert.match(f.node('status').textContent,/incomplete or mismatched repair/);checks++;
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual inline manager preview/render handlers with synthetic DOM and authenticated-route substitute; no live manager, SQL, visual browser or phone proof'}));
