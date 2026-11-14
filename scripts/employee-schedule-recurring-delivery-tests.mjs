import assert from 'node:assert/strict';
import {scheduleLocks} from './synthetic-schedule-locks.mjs';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createSyntheticScheduleSecurity} from './synthetic-schedule-security.mjs';
const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=process.argv.includes('--native-runtime')
 ?readFileSync(new URL('../mobile/src/custodial/employee-schedule-runtime.js',import.meta.url),'utf8').replace(/^export /m,'')+'\ninstallEmployeeSchedule();'
 :[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const helper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const day='2026-09-28',principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const nativePrincipal={employee_id:principal.employeeId,credential_id:principal.credentialId,assignment_epoch:7};
const identity='synthetic-protected-principal',key='mz_employee_schedule_snapshot:'+encodeURIComponent(identity);
function payload(revision,blocked=false){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:principal.employeeId,
  employee_name:'Synthetic Employee',publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,
  shift:{start:'07:00',end:'16:00'},raw_items:[{name:'Synthetic Restroom',coverage_start:'07:00',coverage_end:'16:00'}]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:day,
  authorityRevision:revision,...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:
   {projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 const delivery={intentId:id(revision),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',
  ...(blocked?{replacementCoverageReady:false}:{view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})};
 return{...(blocked?{service_date:day,employee_id:principal.employeeId,employee_name:'Synthetic Employee',projection_status:'blocked_recurring_authority',full_day:true,raw_items:[],shift:null}:view),
  canonical_device_id:'KIOSK_08',canonical_device_pk:principal.deviceId,credential_id:principal.credentialId,assignment_epoch:7,
  schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',recurring_delivery:delivery,schedule_application:null};
}
const now=Date.parse(day+'T17:00:00Z'),FixedDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const elements=new Map(),events=new Map(),stored=new Map([['protected-cleaning-draft','do not touch'],['native-journal-reference','do not touch']]),calls=[];
const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,addEventListener(){}});return elements.get(id);};
let next=payload(19),mutationHook=()=>{},fetchCount=0;
next.raw_items=[{name:'Unbound duplicate payload',coverage_start:'07:00',coverage_end:'16:00'}];
const context={Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,AbortController,
 document:{getElementById:element,addEventListener(){},hidden:false},
 localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)},
 fetch:async()=>{fetchCount++;return{ok:true,json:async()=>({ok:true,data:structuredClone(next)})};},
 setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
context.window={navigator:{locks:scheduleLocks},crypto:webcrypto,addEventListener:(name,fn)=>events.set(name,fn),
 MemphisCustodialSecurity:createSyntheticScheduleSecurity(nativePrincipal,{before:()=>mutationHook()}),
 MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=>identity,
  profileMatchesPrincipal:d=>d.employee_id===principal.employeeId&&d.credential_id===principal.credentialId&&d.assignment_epoch===7,
  requestJson:async(path,options)=>{calls.push({path,options});return{};}}};
const waitFor=async(predicate,label)=>{const end=Date.now()+2000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.ok(predicate(),label);};
vm.createContext(context);vm.runInContext(helper,context);vm.runInContext(inline,context);
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const cache=()=>JSON.parse(stored.get(key)||'null');
await waitFor(()=>cache()?.recurring_target?.target.authorityRevision===19,'schedule cache persisted');
check(cache().recurring_target.viewJsonText,next.recurring_delivery.viewJsonText,'exact SQL text persisted');
check(element('areas').innerHTML.includes('Synthetic Restroom'),true,'actual page rendered verified schedule');
check(calls.some(x=>x.path.endsWith('delivery-receipt')),false,'notification cleanup still pending: no fabricated complete-phone ACK');
next=payload(20,true);events.get('online')();
await waitFor(()=>cache()?.recurring_target?.blocked===true,'terminal cache persisted');
check(element('content').hidden,true);check(element('areas').innerHTML,'');check(element('lunch-areas').innerHTML,'');
check(element('notice').textContent.includes('saved cleaning work is preserved'),true);
next=payload(19);events.get('online')();
// A successfully received but rejected authority response does not restore the
// pre-request cache's availability. The durable read-ahead fence remains closed
// until a current valid response wins; the terminal high-water is still retained.
await waitFor(()=>fetchCount===3&&(process.argv.includes('--native-runtime')?element('state-text').textContent.startsWith('Schedule could not update. Check D'):element('state-text').textContent==='Schedule could not update.'),'delayed response handled fail-closed');
check(element('content').hidden,true,'rejected stale authority leaves schedule unavailable');
check(context.window.MemphisRecurringScheduleTarget.availability(context.localStorage,identity,day).state,'READING','rejected response cannot clear durable uncertainty');
check(cache().recurring_target.target.authorityRevision,20,'delayed schedule cannot overwrite blocked revision');
check(element('areas').innerHTML,'','delayed schedule cannot rerender old duties');
// A different page wins AFTER async prepare but BEFORE protected save.
const newer=payload(22,true),prepared=await context.window.MemphisRecurringScheduleTarget.prepare({delivery:newer.recurring_delivery,
 expectedPrincipal:principal,serviceDate:day});
mutationHook=()=>{stored.set(key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:identity,
 data:newer,recurring_target:prepared}));mutationHook=()=>{};};
next=payload(21);events.get('online')();
await waitFor(()=>fetchCount===4&&cache()?.recurring_target.target.authorityRevision===22,'concurrent cache winner observed');
check(cache().recurring_target.blocked,true,'barrier rechecks actual latest cache');
check(element('areas').innerHTML,'','losing response cannot render after barrier rejection');
check(stored.get('protected-cleaning-draft'),'do not touch');check(stored.get('native-journal-reference'),'do not touch');
check(calls.some(x=>x.path.endsWith('delivery-receipt')||x.path.endsWith('application-receipt')),false,'typed rendering never impersonates full notification application');
console.log(JSON.stringify({status:'PASS',checks,scope:'actual employee-page synthetic DOM protected cache/render, terminal precedence, delayed response and barrier race; typed ACK intentionally pending native/browser notification integration'}));

// Additive private honor-work cases execute this same current renderer and
// existing protected snapshot/target helper. No real device, note or network.
let sharedBasecampDisk=null;
async function basecampFixture({browser=false,patch,initialState='current'}={}){
 const nodes=new Map(),events=new Map(),disk=sharedBasecampDisk||new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]),requests=[];
 const el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',hidden:false,addEventListener(){}});return nodes.get(k);};
 const bound={...nativePrincipal},timers=new Map();let data=payload(30),fetches=0,cacheWritesFail=false,timerId=100;
 const work=()=>({schema:'custodial.basecamp-birthday-work.v1',state:initialState,service_date:day,
  employee_id:principal.employeeId,publication_id:data.publication_id,projection_id:data.projection_id,
  canonical_device_pk:principal.deviceId,credential_id:principal.credentialId,assignment_epoch:7,
  items:[{event_id:id(80),event_revision:1,display_name:'Safari Basecamp',party_start:day+'T18:00:00Z',party_end:day+'T20:00:00Z',
   voice_notice_at:day+'T12:15:00Z',voice_notice_state:'planned',cleaning_instruction:'Clean before and after the party; empty trash.',honor_based:true,nfc_required:false,
   access_note:'TEST ONLY <b>private access note</b>'}]});
 data.basecamp_birthday_work=work();patch?.(data.basecamp_birthday_work,data);
 const ctx={Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,AbortController,
  document:{getElementById:el,addEventListener(){},hidden:false},
  localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>{if(k===key&&cacheWritesFail)throw Error('Synthetic schedule cache full');disk.set(k,v);}},
  fetch:async()=>{fetches++;return {ok:true,json:async()=>({ok:true,data:structuredClone(data)})};},
  setTimeout:(fn,delay)=>{const token=++timerId;timers.set(token,{fn,delay});return token;},clearTimeout:token=>timers.delete(token),setInterval:()=>2,clearInterval(){}};
 ctx.window={navigator:{locks:scheduleLocks},crypto:webcrypto,addEventListener:(name,fn)=>events.set(name,fn),
  ...(browser?{}:{MemphisCustodialSecurity:createSyntheticScheduleSecurity(bound)}),
  MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=>identity,
   profileMatchesPrincipal:d=>d.employee_id===bound.employee_id&&d.credential_id===bound.credential_id&&d.assignment_epoch===bound.assignment_epoch,
   requestJson:async(path,options)=>{requests.push({path,options});return{};}}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);vm.runInContext(inline,ctx);
 const cache=()=>JSON.parse(disk.get(key)||'null');
 await waitFor(()=>el('employee').textContent==='Synthetic Employee','basecamp ordinary schedule rendered');
 return {el,disk,events,requests,bound,timers,cache,data:()=>data,setData:value=>{data=value;},fetches:()=>fetches,ctx,work,failCacheWrites:value=>{cacheWritesFail=value;}};
}
let basecampChecks=0;
function basecampCheck(value,message){assert.ok(value,message);basecampChecks++;}
{
 const f=await basecampFixture();
 basecampCheck(/Safari Basecamp<\/div><div class="areaDetail">\(TEST ONLY &lt;b&gt;private access note&lt;\/b&gt;\)/.test(f.el('areas').innerHTML),'private parenthetical note follows Basecamp name and is escaped');
 basecampCheck(f.el('areas').innerHTML.includes('Synthetic Restroom'),'ordinary area remains');
 basecampCheck(f.cache().recurring_target.viewJsonText===f.data().recurring_delivery.viewJsonText,'supplemental row never rewrites exact recurring view');
 basecampCheck(f.disk.get('protected-cleaning-draft')==='unchanged'&&f.disk.get('native-journal-reference')==='unchanged','cleaning work retained');
 const unavailable=structuredClone(f.data());unavailable.basecamp_birthday_work.state='unavailable';unavailable.basecamp_birthday_work.items=[];f.setData(unavailable);f.events.get('online')();
 await waitFor(()=>f.cache()?.data?.basecamp_birthday_work?.state==='saved_unconfirmed','same-owner optional failure retains prior private work');
 basecampCheck(f.el('areas').innerHTML.includes('TEST ONLY')&&f.el('areas').innerHTML.includes('Saved birthday assignment; changes could not be checked.'),'saved fallback disclosed');
 const cleared=structuredClone(unavailable);cleared.basecamp_birthday_work.state='current';f.setData(cleared);f.events.get('online')();
 await waitFor(()=>f.fetches()===3&&!f.el('areas').innerHTML.includes('Safari Basecamp'),'current authoritative empty result withdraws supplemental row');
 basecampCheck(!f.el('areas').innerHTML.includes('TEST ONLY'),'current cancellation/empty result removes note');
 basecampCheck(!f.requests.some(x=>x.options?.method==='POST'),'no fabricated ACK/completion request');f.events.get('pagehide')?.();
}
for(const [label,patch]of [
 ['employee',w=>{w.employee_id=id(90);}],['credential',w=>{w.credential_id=id(90);}],['device',w=>{w.canonical_device_pk=id(90);}],
 ['epoch',w=>{w.assignment_epoch++;}],['date',w=>{w.service_date='2026-09-27';}],['projection',w=>{w.projection_id=id(90);}],
 ['publication',w=>{w.publication_id=id(90);}],['scan requirement',w=>{w.items[0].nfc_required=true;}],
 ['duplicate party',w=>{w.items.push({...w.items[0]});}],['wrong party date',w=>{w.items[0].party_start='2026-09-27T18:00:00Z';}],
]){
 const f=await basecampFixture({patch});basecampCheck(!f.el('areas').innerHTML.includes('TEST ONLY')&&!f.el('areas').innerHTML.includes('Safari Basecamp'),'private work refused for '+label);
 basecampCheck(f.el('areas').innerHTML.includes('Synthetic Restroom'),'ordinary schedule preserved for '+label);f.events.get('pagehide')?.();
}
{
 const f=await basecampFixture({browser:true});basecampCheck(!f.el('areas').innerHTML.includes('TEST ONLY')&&!f.el('areas').innerHTML.includes('Safari Basecamp'),'browser cannot display injected native private note');f.events.get('pagehide')?.();
}
{
 const f=await basecampFixture();const next=payload(31),view={...next.recurring_delivery.view,projection_id:id(91)};
 const target={...next.recurring_delivery.target,projectionId:id(91),viewDigest:sha(JSON.stringify(view))};
 next.projection_id=id(91);next.recurring_delivery={...next.recurring_delivery,target,targetDigest:sha(flat(target)),view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest};
 next.basecamp_birthday_work={...f.data().basecamp_birthday_work,projection_id:id(91),state:'unavailable',items:[]};f.setData(next);f.events.get('online')();
 await waitFor(()=>f.cache()?.recurring_target?.target.authorityRevision===31,'new admitted projection persists');
 basecampCheck(!f.el('areas').innerHTML.includes('TEST ONLY'),'new projection cannot retain old private work');
 basecampCheck(f.el('areas').innerHTML.includes('Birthday assignments could not be checked.'),'new projection optional unavailability disclosed');f.events.get('pagehide')?.();
}
console.log(JSON.stringify({status:'PASS',basecamp_checks:basecampChecks,scope:'Actual employee renderer, supplemental native privacy, exact target preservation, protected cache fallback and current withdrawal; synthetic ports only'}));

{
 const f=await basecampFixture({patch:w=>{w.items[0].voice_notice_state='withheld';w.items[0].voice_notice_at=null;}});
 assert.ok(f.el('areas').innerHTML.includes('Safari Basecamp')&&f.el('areas').innerHTML.includes('TEST ONLY'),'valid honor assignment stays visible when voice timing is withheld');
 f.events.get('pagehide')?.();console.log('BASECAMP_WITHHELD_NOTICE_ASSIGNMENT_PASS');
}

// Independent report-only cross-page scenario. Product/runtime/helper bytes
// are untouched; the fixture now shares exactly one synthetic protected store.
const crossPageResults=[];
for(const mode of ['newer-current-empty','newer-import']){
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const oldEmpty=mode==='newer-import';
 const a=await basecampFixture({patch:w=>{if(oldEmpty)w.items=[];}});
 const b=await basecampFixture({patch:w=>{if(!oldEmpty)w.items=[];}});
 const currentCount=b.cache().data.basecamp_birthday_work.items.length;
 assert.equal(currentCount,oldEmpty?1:0,'page B establishes newer authoritative supplemental result');
 const targetText=b.cache().recurring_target.viewJsonText;
 const unavailable=structuredClone(a.data());unavailable.basecamp_birthday_work.state='unavailable';unavailable.basecamp_birthday_work.items=[];
 a.setData(unavailable);a.events.get('online')();
 await waitFor(()=>a.cache().data.basecamp_birthday_work.state==='saved_unconfirmed','later same-target optional response applied');
 const actualCount=a.cache().data.basecamp_birthday_work.items.length;
 crossPageResults.push({case:mode,expected_items:currentCount,actual_items:actualCount,
  unchanged_recurring_view:a.cache().recurring_target.viewJsonText===targetText,
  schedule_revision:a.cache().recurring_target.target.authorityRevision,
  display_has_private_test_note:a.el('areas').innerHTML.includes('TEST ONLY'),
  pass:actualCount===currentCount});
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
sharedBasecampDisk=null;
console.log(JSON.stringify({independent_cross_page_results:crossPageResults}));
if(crossPageResults.some(r=>!r.pass))process.exitCode=1;

// Storage failure retains the existing closed availability fence. Verify the
// newer volatile party after storage recovers, without granting presentation
// or an ACK while the authoritative read remains unsaved.
let cacheParentChecks=0;
{
 const f=await basecampFixture({patch:w=>{w.items=[];}});f.failCacheWrites(true);
 const party=structuredClone(f.data());party.basecamp_birthday_work=f.work();f.setData(party);f.events.get('online')();
 await waitFor(()=>f.fetches()===2&&f.el('state-text').textContent.includes('Schedule unavailable'),'unsaved authority retains the existing availability refusal');
 assert.equal(f.cache().data.basecamp_birthday_work.items.length,0);cacheParentChecks++;
 assert.ok(!f.el('areas').innerHTML.includes('TEST ONLY'));cacheParentChecks++;
 const unavailable=structuredClone(party);unavailable.basecamp_birthday_work.state='unavailable';unavailable.basecamp_birthday_work.items=[];
 f.failCacheWrites(false);f.setData(unavailable);f.events.get('online')();
 await waitFor(()=>f.cache().data.basecamp_birthday_work.items.length===1&&f.cache().data.basecamp_birthday_work.state==='saved_unconfirmed','recovered storage retains the newer unsaved party from its unchanged disk parent');
 assert.ok(f.el('areas').innerHTML.includes('TEST ONLY')&&f.el('areas').innerHTML.includes('Saved birthday assignment; changes could not be checked.'));cacheParentChecks++;
 assert.equal(f.cache().recurring_target.viewJsonText,party.recurring_delivery.viewJsonText);cacheParentChecks++;
 assert.ok(!f.requests.some(x=>x.options?.method==='POST'));cacheParentChecks++;f.events.get('pagehide')?.();
}
{
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const a=await basecampFixture({patch:w=>{w.items=[];}}),original=a.cache();a.failCacheWrites(true);
 const party=structuredClone(a.data());party.basecamp_birthday_work=a.work();a.setData(party);a.events.get('online')();
 await waitFor(()=>a.fetches()===2&&a.el('state-text').textContent.includes('Schedule unavailable'),'A retains unsaved authority without presenting it');
 const b=await basecampFixture({patch:w=>{w.items=[];}}),committed=b.cache();
 assert.equal(committed.saved_at,original.saved_at,'test clock is fixed');cacheParentChecks++;
 assert.notEqual(committed.supplemental_read_observation,original.supplemental_read_observation,'existing read fence distinguishes identical payload commits without a clock bound');cacheParentChecks++;
 const unavailable=structuredClone(party);unavailable.basecamp_birthday_work.state='unavailable';unavailable.basecamp_birthday_work.items=[];
 a.failCacheWrites(false);a.setData(unavailable);a.events.get('online')();
 await waitFor(()=>a.cache().data.basecamp_birthday_work.state==='saved_unconfirmed','current protected external commit participates in recovered save');
 assert.ok(!a.el('areas').innerHTML.includes('TEST ONLY'));cacheParentChecks++;
 assert.equal(a.cache().data.basecamp_birthday_work.items.length,0);cacheParentChecks++;
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();sharedBasecampDisk=null;
}
console.log(JSON.stringify({status:'PASS',cache_parent_checks:cacheParentChecks,scope:'Existing protected read-fence observations, actual disk versus unsaved local parent, fixed-clock repeated-empty commit; closed availability, schedule CAS and ACK preserved'}));

// Additional report-only observation: another page's current commit arrives
// via storage event while this page's subsequent HTTP request is offline.
const storageDisplayResults=[];
for(const mode of ['newer-current-empty','newer-import']){
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const oldEmpty=mode==='newer-import';
 const a=await basecampFixture({patch:w=>{if(oldEmpty)w.items=[];}});
 let failedReads=0;a.ctx.fetch=async()=>{failedReads++;throw Error('Synthetic offline after another page commit');};
 const b=await basecampFixture({patch:w=>{if(!oldEmpty)w.items=[];}});
 const diskItems=b.cache().data.basecamp_birthday_work.items.length;
 a.events.get('storage')({key});
 await waitFor(()=>failedReads===1,'post-storage refresh reached the offline HTTP port');
 await new Promise(r=>setTimeout(r,40));
 const displayed=a.el('areas').innerHTML.includes('TEST ONLY');
 storageDisplayResults.push({case:mode,failed_http_reads:failedReads,confirmed_disk_items:diskItems,
  expected_private_note_visible:oldEmpty,actual_private_note_visible:displayed,
  private_note_shared_cache_items:a.cache().data.basecamp_birthday_work.items.length,
  state:a.el('state-text').textContent,pass:displayed===oldEmpty});
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
sharedBasecampDisk=null;
console.log(JSON.stringify({storage_display_results:storageDisplayResults}));
if(storageDisplayResults.some(r=>!r.pass))process.exitCode=1;

// The real boundary callback and storage consumer must use the same protected
// snapshot decision, including offline recovery and different main frames.
let snapshotPresentationChecks=0;
for(const trigger of ['storage','boundary'])for(const empty of [true,false]){
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const a=await basecampFixture({patch:w=>{if(!empty)w.items=[];}});
 let failures=0;a.ctx.fetch=async()=>{failures++;throw Error('Synthetic offline snapshot observation');};
 const b=await basecampFixture({patch:(w,d)=>{
  if(empty)w.items=[];
  d.home_facts={contract_version:'employee-home-time-facts.v1',reason:null,projection_status:'current',service_date:day,
   employee_id:principal.employeeId,publication_id:d.publication_id,projection_id:d.projection_id,
   shift:{active:true,start:'07:00',end:'16:00'},lunch:{start:'10:00',end:'11:00'}};
 }});
 const protectedText=a.disk.get(key),targetText=b.cache().recurring_target.viewJsonText;
 if(trigger==='storage')a.events.get('storage')({key});
 else{const due=[...a.timers.values()].find(t=>t.delay>30000);assert.ok(due,'real schedule boundary callback captured');due.fn();}
 await waitFor(()=>failures===1,'snapshot variant reached the failing HTTP port');
 await new Promise(r=>setTimeout(r,40));
 assert.equal(a.el('areas').innerHTML.includes('TEST ONLY'),!empty,'latest same-target party list presented after '+trigger);snapshotPresentationChecks++;
 assert.ok(a.el('employee-times').innerHTML.includes('10:00 AM–11:00 AM')||a.el('employee-times').textContent.includes('10:00 AM–11:00 AM'),'latest complete same-frame informational lunch facts presented');snapshotPresentationChecks++;
 assert.equal(a.disk.get(key),protectedText,'offline presentation never rewrites the confirmed record');snapshotPresentationChecks++;
 assert.equal(a.cache().recurring_target.viewJsonText,targetText,'main typed render text preserved');snapshotPresentationChecks++;
 assert.equal(a.el('state-text').textContent,'Showing a saved schedule. Could not check for changes.');snapshotPresentationChecks++;
 assert.ok(!a.requests.some(x=>x.options?.method==='POST'),'no invented application or notification ACK');snapshotPresentationChecks++;
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
for(const empty of [true,false]){
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const a=await basecampFixture({patch:w=>{if(!empty)w.items=[];}});a.failCacheWrites(true);
 const high=payload(31);high.basecamp_birthday_work={...a.work(),items:empty?a.work().items:[]};a.setData(high);a.events.get('online')();
 await waitFor(()=>a.fetches()===2&&a.el('state-text').textContent.includes('Schedule unavailable'),'unsaved higher main authority is refused while the read fence is closed');
 assert.equal(a.cache().recurring_target.target.authorityRevision,30);snapshotPresentationChecks++;
 const b=await basecampFixture({patch:w=>{if(empty)w.items=[];}});
 const diskText=a.disk.get(key);let failures=0;a.ctx.fetch=async()=>{failures++;throw Error('Synthetic offline different main frame');};
 a.events.get('storage')({key});await waitFor(()=>failures===1,'different-frame storage event reaches offline port');await new Promise(r=>setTimeout(r,40));
 assert.equal(a.el('areas').innerHTML.includes('TEST ONLY'),!empty,'disk supplemental result reconciles without replacing higher unsaved main frame');snapshotPresentationChecks++;
 assert.equal(a.el('state-text').textContent,'Showing a saved schedule. Could not check for changes.','derived view is disclosed as unconfirmed, not a storage diagnosis');snapshotPresentationChecks++;
 assert.equal(a.disk.get(key),diskText,'derived view does not become persisted evidence');snapshotPresentationChecks++;
 assert.ok(!a.requests.some(x=>x.options?.method==='POST'),'derived view cannot fabricate ACK');snapshotPresentationChecks++;
 a.failCacheWrites(false);const retry=structuredClone(high);retry.basecamp_birthday_work={...retry.basecamp_birthday_work,state:'unavailable',items:[]};a.setData(retry);
 a.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,data:structuredClone(a.data())})});a.events.get('online')();
 await waitFor(()=>a.cache().recurring_target.target.authorityRevision===31,'original higher authority persists after storage recovery');
 assert.equal(a.cache().data.basecamp_birthday_work.items.length,empty?0:1,'optional failure retains the reconciled latest supplemental list');snapshotPresentationChecks++;
 assert.equal(a.cache().recurring_target.viewJsonText,high.recurring_delivery.viewJsonText,'exact higher main render frame retained');snapshotPresentationChecks++;
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
sharedBasecampDisk=null;
console.log(JSON.stringify({status:'PASS',snapshot_presentation_checks:snapshotPresentationChecks,scope:'Actual protected snapshot consumers: storage, schedule boundary, offline recovery, latest informational extras and separate main high-water; no ACK or persisted derived view'}));

// Same publication/projection with a newer, valid main target whose shift
// and published work differ. This uses normal digest preparation and cache
// failure/offline paths; no SQL or product bytes are altered.
sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
const frameA=await basecampFixture({patch:w=>{w.items=[];}});frameA.failCacheWrites(true);
let changedFrame=payload(31);const changedView={...changedFrame.recurring_delivery.view,shift:{start:'06:00',end:'15:00'},
 raw_items:[{name:'TEST DIFFERENT MAIN WORK',coverage_start:'06:00',coverage_end:'15:00'}]};
const changedText=JSON.stringify(changedView),changedTarget={...changedFrame.recurring_delivery.target,viewDigest:sha(changedText)};
changedFrame={...changedFrame,...changedView,recurring_delivery:{...changedFrame.recurring_delivery,target:changedTarget,targetDigest:sha(flat(changedTarget)),view:changedView,viewJsonText:changedText,viewDigest:changedTarget.viewDigest}};
changedFrame.basecamp_birthday_work={...frameA.work(),state:'unavailable',items:[]};frameA.setData(changedFrame);frameA.events.get('online')();
await waitFor(()=>frameA.fetches()===2&&frameA.el('state-text').textContent.includes('Schedule unavailable'),'valid changed main frame admitted but cache write refused');
const frameB=await basecampFixture();let changedFailures=0;frameA.ctx.fetch=async()=>{changedFailures++;throw Error('Synthetic offline changed main work');};
const storedBefore=frameA.disk.get(key);frameA.events.get('storage')({key});await waitFor(()=>changedFailures===1,'changed main frame storage refresh reaches offline port');await new Promise(r=>setTimeout(r,40));
const mixed={same_publication:changedFrame.publication_id===frameB.data().publication_id,same_projection:changedFrame.projection_id===frameB.data().projection_id,
 newer_main_work_visible:frameA.el('areas').innerHTML.includes('TEST DIFFERENT MAIN WORK'),
 older_private_note_visible:frameA.el('areas').innerHTML.includes('TEST ONLY'),
 unchanged_disk:frameA.disk.get(key)===storedBefore,POSTs:frameA.requests.filter(x=>x.options?.method==='POST').length,
 expected_older_private_note_visible:false};
console.log(JSON.stringify({changed_work_frame_result:mixed}));
frameA.events.get('pagehide')?.();frameB.events.get('pagehide')?.();sharedBasecampDisk=null;
if(mixed.older_private_note_visible)process.exitCode=1;

// Direct optional-failure fallback must obey the same published-work binding.
// Revisions alone permit a changed shift/view at the same pub/projection.
function changedPublishedFrame(revision,mode){
 let data=payload(revision),view={...data.recurring_delivery.view};
 if(mode!=='work')view.shift={start:'06:00',end:'15:00'};
 if(mode!=='shift')view.raw_items=[{name:'TEST CHANGED ASSIGNMENT',coverage_start:'07:00',coverage_end:'16:00'}];
 const text=JSON.stringify(view),target={...data.recurring_delivery.target,viewDigest:sha(text)};
 return {...data,...view,recurring_delivery:{...data.recurring_delivery,target,targetDigest:sha(flat(target)),view,viewJsonText:text,viewDigest:target.viewDigest}};
}
let assignmentFrameChecks=0;
for(const mode of ['shift','work','both']){
 const f=await basecampFixture();const data=changedPublishedFrame(31,mode);data.basecamp_birthday_work={...f.work(),state:'unavailable',items:[]};f.setData(data);f.events.get('online')();
 await waitFor(()=>f.cache()?.recurring_target.target.authorityRevision===31,'changed assignment is an admitted newer main schedule');
 assert.equal(f.cache().data.basecamp_birthday_work.state,'unavailable','older optional work is not promoted to this changed '+mode+' frame');assignmentFrameChecks++;
 assert.ok(!f.el('areas').innerHTML.includes('TEST ONLY')&&f.el('areas').innerHTML.includes('Birthday assignments could not be checked.'));assignmentFrameChecks++;
 assert.equal(f.cache().recurring_target.viewJsonText,data.recurring_delivery.viewJsonText);assignmentFrameChecks++;
 assert.ok(!f.requests.some(x=>x.options?.method==='POST'));assignmentFrameChecks++;
 f.events.get('pagehide')?.();
}
for(const mode of ['shift','work']){
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const a=await basecampFixture({patch:w=>{w.items=[];}});a.failCacheWrites(true);
 const data=changedPublishedFrame(31,mode);data.basecamp_birthday_work={...a.work(),state:'unavailable',items:[]};a.setData(data);a.events.get('online')();
 await waitFor(()=>a.fetches()===2&&a.el('state-text').textContent.includes('Schedule unavailable'),'unsaved changed frame preserves closed read fence');
 const b=await basecampFixture(),disk=a.disk.get(key);let failed=0;a.ctx.fetch=async()=>{failed++;throw Error('Synthetic offline changed assignment');};a.events.get('storage')({key});
 await waitFor(()=>failed===1,'changed assignment storage/offline refresh');await new Promise(r=>setTimeout(r,40));
 assert.ok(!a.el('areas').innerHTML.includes('TEST ONLY')&&a.el('areas').innerHTML.includes('Birthday assignments could not be checked.'));assignmentFrameChecks++;
 assert.equal(a.disk.get(key),disk);assignmentFrameChecks++;
 assert.ok(!a.requests.some(x=>x.options?.method==='POST'));assignmentFrameChecks++;
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
{
 sharedBasecampDisk=new Map([['protected-cleaning-draft','unchanged'],['native-journal-reference','unchanged']]);
 const a=await basecampFixture({patch:w=>{w.items=[];}});a.failCacheWrites(true);const data=changedPublishedFrame(31,'both');
 data.basecamp_birthday_work=a.work();data.basecamp_birthday_work.items[0].access_note='TEST NEW FRAME VERIFIED NOTE';a.setData(data);a.events.get('online')();
 await waitFor(()=>a.fetches()===2&&a.el('state-text').textContent.includes('Schedule unavailable'),'new work and its own private input remain unsaved behind original fence');
 const b=await basecampFixture(),disk=a.disk.get(key);let failed=0;a.ctx.fetch=async()=>{failed++;throw Error('Synthetic offline independently bound new frame');};a.events.get('storage')({key});
 await waitFor(()=>failed===1,'own changed-frame work reaches offline observation');await new Promise(r=>setTimeout(r,40));
 assert.ok(a.el('areas').innerHTML.includes('TEST NEW FRAME VERIFIED NOTE')&&!a.el('areas').innerHTML.includes('TEST ONLY'),'verified private work tied to the actual new frame survives; the old frame cannot replace it');assignmentFrameChecks++;
 assert.equal(a.disk.get(key),disk);assignmentFrameChecks++;
 assert.ok(!a.requests.some(x=>x.options?.method==='POST'));assignmentFrameChecks++;
 a.events.get('pagehide')?.();b.events.get('pagehide')?.();
}
sharedBasecampDisk=null;
console.log(JSON.stringify({status:'PASS',assignment_frame_checks:assignmentFrameChecks,scope:'Changed shift/work at same pub/projection: direct optional fallback and storage/offline; own newly verified frame retained; no ACK/main-frame downgrade'}));
