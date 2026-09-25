import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../events-admin.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const nodes=new Map();
function node(id){
 if(!nodes.has(id)){
  const n={value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,dataset:{},style:{},options:[],files:[],
   events:{},classList:{add(){},remove(){},toggle(){}},addEventListener(event,fn){this.events[event]=fn;},querySelectorAll(){return[];}};
  Object.defineProperty(n,'selectedOptions',{get(){return this.options.filter(o=>o.selected);}});nodes.set(id,n);
 }return nodes.get(id);
}
const sandbox={console,URL,crypto:{randomUUID:()=> '90000000-0000-4000-8000-000000000001'},
 document:{getElementById:node,referrer:''},window:{location:{href:'https://synthetic.invalid/events-admin.html'}}};
vm.createContext(sandbox);
for(const script of scripts)vm.runInContext(script.replace(/^\s*init\(\)\.catch\([^\n]+$/m,''),sandbox);
const run=code=>vm.runInContext(code,sandbox),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
let checks=0;const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
for(const format of ['paste','csv','spreadsheet']){
 run(`loadPayloadIntoForm({event_name:'Synthetic event',source_text:'EXACT ${format} source',source_format:'${format}'})`);
 node('paste-intake').value='Unrelated later paste';
 let p=json('buildPayloadFromForm()');eq(p.source_text,`EXACT ${format} source`,'persist loaded row source rather than live paste box');eq(p.source_format,format,'preserve actual source format');
 node('paste-intake').value='';p=json('buildPayloadFromForm()');eq(p.source_text,`EXACT ${format} source`,'clearing intake cannot erase selected event evidence');
}
run("loadPayloadIntoForm({id:'existing-A',event_name:'Existing',source_text:'saved original source',source_format:'csv'})");
eq(json('buildPayloadFromForm()').source_text,'saved original source','editing retains authoritative loaded source');
run("loadPayloadIntoForm({id:'legacy-B',event_name:'Legacy',source_text:null,source_format:null})");
node('paste-intake').value='unrelated previous intake';
eq(json('buildPayloadFromForm()').source_text,null,'legacy row with no source cannot inherit unrelated paste');
run('resetForm(true)');eq(json('buildPayloadFromForm()').source_text,null,'reset forgets previous source');
eq(json('buildPayloadFromForm()').source_format,'manual_form','new manual event is not falsely spreadsheet');
run("loadPayloadIntoForm({raw_text:'original raw fallback',source_format:'paste'})");
eq(json('buildPayloadFromForm()').source_text,'original raw fallback','normalizer fallback remains source-bound');
run(`readImportRows=async()=>[{text:'Original source A'},{text:'Original source B'}];
 globalThis.providerRows=[];apiBase=async()=>providerRows;`);
node('import-file').files=[{name:'synthetic.csv'}];
run("providerRows=[{source_index:1,event_name:'B'},{source_index:0,event_name:'A'}]");
await run('parseUploadedFile()');
eq(json('state.parsedImportRows.map(r=>r.source_text)'),['Original source B','Original source A'],'reordered parser results bind by exact source_index');
eq(json('state.parsedImportRows.map(r=>r.source_format)'),['csv','csv'],'CSV provenance retained');
const original=json('state.parsedImportRows');
for(const invalid of [null,false,'0',-1,2,0.5,{},[]]){
 sandbox.invalid=invalid;run('providerRows=[{source_index:invalid,event_name:"invalid"}]');
 await assert.rejects(()=>run('parseUploadedFile()'),/source identity/);checks++;
 eq(json('state.parsedImportRows'),original,'malformed/out-of-range identity cannot replace prior preview');
 assert.match(node('status-pill').textContent,/source identity/i);checks++;
}
run('providerRows=[{source_index:0},{source_index:0}]');await assert.rejects(()=>run('parseUploadedFile()'),/source identity/);checks++;
eq(json('state.parsedImportRows'),original,'duplicate input identity rejects whole import result');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
run('bindEvents()');
for(const action of ['reset','edit-other','manual-edit','clear-intake','paste-input','file-change']){
 const gate=deferred();sandbox.pendingParse=gate.promise;run('apiBase=async()=>pendingParse');
 const request=run("parseIntoForm('Original pending intake',els.parseBtn)");await tick();
 if(action==='reset')run('resetForm(false)');
 if(action==='edit-other')run("loadPayloadIntoForm({id:'other-event',event_name:'Other event',source_text:'Other exact source'})");
 if(action==='manual-edit'){node('event-name').value='Manual edit';node('event-name').events.input();}
 if(action==='clear-intake')node('clear-btn').events.click();
 if(action==='paste-input'){node('paste-intake').value='New intake';node('paste-intake').events.input();}
 if(action==='file-change')node('import-file').events.change();
 const before=json('buildPayloadFromForm()');
 gate.resolve([{event_name:'Obsolete parsed response',source_index:0}]);await request;
 eq(json('buildPayloadFromForm()'),before,action+' prevents late parser from replacing form/source/operation');
 eq(node('parse-btn').disabled,false,action+' releases only completed button');
}
{
 const gate=deferred();sandbox.pendingParse=gate.promise;run('apiBase=async()=>pendingParse');
 const request=run("parseIntoForm('Old failed parse',els.parseBtn)");await tick();
 run("resetForm(false);setStatus('Newer intended status')");gate.reject(Error('obsolete failure'));await request;
 eq(node('status-pill').textContent,'Newer intended status','stale failure cannot overwrite newer status');
}
{
 const gate=deferred();sandbox.pendingFile=gate.promise;run('readImportRows=()=>pendingFile;globalThis.parseCalls=0;apiBase=async()=>{parseCalls++;return[];}');
 const before=json('state.parsedImportRows');const request=run('parseUploadedFile()');await tick();
 node('import-file').events.change();gate.resolve([{text:'Old file'}]);await request;
 eq(run('parseCalls'),0,'changed file prevents stale read from invoking parser');
 eq(json('state.parsedImportRows'),before,'changed file retains prior import preview');
}
{
 const gate=deferred();sandbox.pendingParse=gate.promise;run("readImportRows=async()=>[{text:'Old import'}];apiBase=async()=>pendingParse");
 const before=json('state.parsedImportRows');const request=run('parseUploadedFile()');await tick();
 run("loadPayloadIntoForm({id:'other-event',event_name:'Selected event'})");gate.resolve([{source_index:0,event_name:'Old import'}]);await request;
 eq(json('state.parsedImportRows'),before,'late imported result cannot replace current selection context');
 eq(node('event-name').value,'Selected event','late imported result preserves selected event');
}
{
 run('state.saving=true;globalThis.parseCalls=0;apiBase=async()=>{parseCalls++;return[];}');
 await run("parseIntoForm('during save',els.parseBtn)");await run('parseUploadedFile()');
 eq(run('parseCalls'),0,'save ownership fences new intake requests');run('state.saving=false');
}
console.log(JSON.stringify({status:'PASS_EVENT_SOURCE_EVIDENCE_UI',checks,boundary:'Actual inline handlers with synthetic DOM/parser transport; no AI, DB, browser or physical proof'}));
