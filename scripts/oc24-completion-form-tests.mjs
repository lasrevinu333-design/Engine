import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import '../memphis-completion-taxonomy.js';
const baseline=process.argv.includes('--baseline');
const source=baseline?execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'}):readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('    async function renderCompletionForm(context){'),end=source.indexOf('    function parseRetryAfter',start);
assert.ok(start>=0&&end>start);
let checks=0;const failures=[];
const test=(name,fn)=>{try{fn();checks++;}catch(e){failures.push(`${name}: ${e.message}`);}};
async function fixture(kind,outcome,overrides={}){
 const handlers={},nodes={},effects=[];let submitted=null,html='';
 const values={work_result:[outcome],attention_needed:['yes'],services:outcome==='details'?['Sweep the floor']:[],services_other:[''],issues:['Sink issue'],note:['Drain leaks'],out_of_order_signed:['Yes'],out_of_order_details:['Sink one'],...overrides};
 const full={get checked(){return values.services.includes('Full cleaning services')},set checked(v){values.services=values.services.filter(x=>x!=='Full cleaning services');if(v)values.services.unshift('Full cleaning services');}};
 const retained={get checked(){return values.retained_check_only?.[0]==='yes'},set checked(v){values.retained_check_only=v?['yes']:[];}};
 const control=key=>({get value(){return values[key]?.[0]||''},set value(v){values[key]=[v]}});
 nodes['completion-work-result']=control('work_result');nodes['completion-attention']=control('attention_needed');nodes['completion-retained-check']=retained;nodes['completion-retained-check-row']={hidden:true};
 const form={values,querySelector:selector=>selector.includes('name="services"')?full:null,addEventListener:(name,fn)=>{handlers[name]=fn;}};
 const context={currentSessionUuid:'',currentDeviceId:'test-phone',appEl:{set innerHTML(v){html=v;}},
  CONFIG:{FORM_HEADER_IMAGE_URL:'test.png'},RESTROOM_SERVICES:[{title:'Full cleaning services'},{title:'Sweep the floor'}],EXHIBIT_SERVICES:[{title:'Full cleaning services'},{title:'Sweep the floor'}],RESTROOM_ISSUES:['Sink issue'],EXHIBIT_ISSUES:['Sink issue'],
  clearWorkPosition(){},getLocalSessionById:()=>({}),resolveLocationKind:()=>({isRestroom:kind==='restroom',formType:kind,locationType:kind}),updateDebugPanel(){},escapeHtml:String,escapeAttr:String,serviceLabel:x=>x.title,serviceDescription:()=>'',
  document:{getElementById:id=>id==='completion-form'?form:(nodes[id]??={})},
  restoreCompletionDraft:async()=>{},saveCompletionDraft:async()=>{effects.push('save');},updateSyncBadge(){},renderLoadingCard(){},
  completeSessionMaybeQueued:async(_id,response)=>{effects.push('submit');submitted=JSON.parse(JSON.stringify(response));return {status:'pending'};},renderMessageCard(){},syncQueue:async()=>{},employeeActionError:e=>e.message,
  window:{MemphisCompletionTaxonomy:globalThis.MemphisCompletionTaxonomy},FormData:class{constructor(f){this.f=f;}get(k){return this.f.values[k]?.[0]??null;}getAll(k){return this.f.values[k]||[];}}};
 await runInNewContext(source.slice(start,end)+'\nrenderCompletionForm({sessionUuid:"test-session"});',context);
 return {values,nodes,html,effects,submit:()=>handlers.submit({preventDefault(){},currentTarget:form}),get submitted(){return submitted;}};
}
for(const kind of ['restroom','exhibit'])for(const outcome of ['full','details']){
 const f=await fixture(kind,outcome);await f.submit();const name=kind+'/'+outcome;
 test(name+' save precedes submission',()=>assert.deepEqual(f.effects,['save','submit']));
 test(name+' explicit truthful outcome',()=>assert.equal(f.submitted.work_result,outcome));
 test(name+' truthful selection',()=>assert.deepEqual(f.submitted.services_performed,outcome==='full'?['Full cleaning services']:outcome==='details'?['Sweep the floor']:[]));
 test(name+' independent issue and note',()=>{assert.deepEqual(f.submitted.maintenance_issues_found,['Sink issue']);assert.equal(f.submitted.attention_needed,true);assert.equal(f.submitted.note,'Drain leaks');});
 test(name+' original visible checkbox layout',()=>{assert.match(f.html,/Services Performed/);assert.match(f.html,/name="services"[^>]*value="Full cleaning services"/);assert.match(f.html,/Maintenance Issues Found/);assert.doesNotMatch(f.html,/<section id="completion-(?:details|issues)" hidden|name="work_result"[^>]*type="radio"|Finished cleaning\?|Something needs attention\?/);assert.match(f.html,/Submit Completion/);});
 test(name+' no photo acquisition or new payload',()=>{assert.doesNotMatch(f.html,/type=["']file["']|getUserMedia/i);assert.equal(Object.hasOwn(f.submitted,'image_attachment'),false);});
 if(kind==='restroom')test(name+' out-of-order retained',()=>assert.equal(f.submitted.out_of_order_signed,'Yes'));
 test(name+' removed no-cleaning selection for both forms',()=>assert.doesNotMatch(f.html,/name="retained_check_only"|Saved selection: checked—no cleaning needed/));
}
for(const kind of ['restroom','exhibit']){
 const empty=await fixture(kind,'',{services:[],issues:[],out_of_order_signed:['No'],out_of_order_details:['']});await empty.submit();
 test(kind+' no services never submits or invents check-only',()=>{assert.equal(empty.submitted,null);assert.equal(empty.effects.length,0);assert.match(empty.nodes['completion-status'].textContent,/Select at least one/);});
 const mixed=await fixture(kind,'full',{services:['Sweep the floor']});const before=JSON.stringify(mixed.values);await mixed.submit();
 test(kind+' mixed full/individual retained without submission or silent clearing',()=>{assert.equal(mixed.submitted,null);assert.equal(JSON.stringify(mixed.values),before);assert.equal(mixed.effects.length,0);assert.match(mixed.nodes['completion-status'].textContent,/not been cleared/);});
 const savedCheck=await fixture(kind,'checked_no_cleaning_needed',{services:[]});const checkBefore=JSON.stringify(savedCheck.values);await savedCheck.submit();
 test(kind+' legacy draft retained without inventing a service or resubmitting check-only',()=>{assert.equal(savedCheck.submitted,null);assert.equal(JSON.stringify(savedCheck.values),checkBefore);assert.deepEqual(savedCheck.effects,[]);assert.equal(savedCheck.values.work_result[0],'checked_no_cleaning_needed');});
 savedCheck.values.services=['Sweep the floor'];await savedCheck.submit();
 test(kind+' explicit performed service replaces legacy draft outcome',()=>{assert.equal(savedCheck.submitted.work_result,'details');assert.deepEqual(savedCheck.submitted.services_performed,['Sweep the floor']);assert.equal(savedCheck.submitted.note,'Drain leaks');});
 const simple=await fixture(kind,'details',{issues:[],out_of_order_signed:['No'],out_of_order_details:[''],note:[''],services_other:['Original other service']});await simple.submit();
 test(kind+' service-only finish derives no issue and preserves other text',()=>{assert.equal(simple.submitted.attention_needed,false);assert.deepEqual(simple.submitted.services_performed,['Sweep the floor','Original other service']);assert.deepEqual(simple.submitted.maintenance_issues_found,[]);});
}
console.log(JSON.stringify({scope:'actual completion render/submit functions; original checkbox presentation with synthetic DOM, no physical/browser-layout claim',baseline,checks,failures},null,2));
if(failures.length)process.exitCode=1;
