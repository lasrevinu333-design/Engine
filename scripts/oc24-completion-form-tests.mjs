import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
const baseline=process.argv.includes('--baseline');
const source=baseline?execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'}):readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('    async function renderCompletionForm(context){');
const end=source.indexOf('    function parseRetryAfter',start);
assert.ok(start>=0&&end>start);
const taxonomy=source.slice(source.indexOf('    const RESTROOM_SERVICES='),source.indexOf('    const RESTROOM_SERVICES=')+source.slice(source.indexOf('    const RESTROOM_SERVICES=')).indexOf('\n'));
let checks=0,failures=[];
for(const kind of ['restroom','exhibit'])for(const outcome of ['full','details','checked_no_cleaning_needed']){
 const handlers={},nodes={};let submitted=null,saved=0,html='';
 const form={values:{work_result:[outcome],services:['Sweep the floor'],services_other:[''],issues:['Sink issue'],note:['Drain leaks'],out_of_order_signed:['Yes'],out_of_order_details:['Sink one']},
  querySelector:()=>({value:outcome}),addEventListener:(name,fn)=>{handlers[name]=fn;}};
 const context={currentSessionUuid:'',currentDeviceId:'test-phone',appEl:{set innerHTML(v){html=v;}},
  CONFIG:{FORM_HEADER_IMAGE_URL:'test.png'},RESTROOM_SERVICES:[{title:'Full cleaning services'},{title:'Sweep the floor'}],EXHIBIT_SERVICES:[{title:'Full cleaning services'},{title:'Sweep the floor'}],RESTROOM_ISSUES:['Sink issue'],EXHIBIT_ISSUES:['Sink issue'],
  clearWorkPosition(){},getLocalSessionById:()=>({}),resolveLocationKind:()=>({isRestroom:kind==='restroom',formType:kind,locationType:kind}),updateDebugPanel(){},escapeHtml:String,escapeAttr:String,serviceLabel:x=>x.title,
  document:{getElementById:id=>id==='completion-form'?form:(nodes[id]??={})},
  restoreCompletionDraft:async()=>{},saveCompletionDraft:async()=>{saved++;},updateSyncBadge(){},renderLoadingCard(){},
  completeSessionMaybeQueued:async(_id,response)=>{submitted=JSON.parse(JSON.stringify(response));return {status:'pending'};},renderMessageCard(){},syncQueue:async()=>{},employeeActionError:e=>e.message,
  window:{},FormData:class{constructor(f){this.f=f;}get(k){return this.f.values[k]?.[0]??null;}getAll(k){return this.f.values[k]||[];}}};
 await runInNewContext(source.slice(start,end)+'\nrenderCompletionForm({sessionUuid:"test-session"});',context);
 await handlers.submit({preventDefault(){},currentTarget:form});
 const test=(name,fn)=>{try{fn();checks++;}catch(e){failures.push(`${kind}/${outcome}/${name}: ${e.message}`);}};
 test('save precedes submission',()=>assert.equal(saved,1));
 test('truthful selection',()=>assert.deepEqual(submitted.services_performed,outcome==='full'?['Full cleaning services']:outcome==='details'?['Sweep the floor']:[]));
 test('independent issue',()=>assert.deepEqual(submitted.maintenance_issues_found,['Sink issue']));
 test('optional note retained for all outcomes',()=>assert.equal(submitted.note,'Drain leaks'));
 test('no photo acquisition in this release',()=>assert.doesNotMatch(html, /type=["']file["']|add.photo|screenshot|getUserMedia/i));
 test('no new photo payload',()=>assert.equal(Object.hasOwn(submitted,'image_attachment'),false));
 test('problem section outside selective section',()=>assert.ok(html.includes('</section><section id="completion-issues">')));
 test('selective result labeled as work not issue',()=>assert.ok(html.includes('Selected services completed')));
 if(kind==='restroom')test('out-of-order retained',()=>assert.equal(submitted.out_of_order_signed,'Yes'));
 // Switching back from full/check to selective retains the draft selections;
 // hidden selections must not leak into a full/check payload or be erased.
 test('draft service preserved',()=>assert.deepEqual(form.values.services,['Sweep the floor']));
}
console.log(JSON.stringify({scope:'actual completion render/submit functions; synthetic DOM, no physical/browser-layout claim',baseline,checks,failures},null,2));
if(failures.length)process.exitCode=1;
