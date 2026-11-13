import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [candidate,output]=process.argv.slice(2),front=path.join(candidate,'frontend');
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const results=[];
async function check(mode,name,fn){try{const details=await fn();results.push({mode,name,status:'PASS',details});}catch(e){results.push({mode,name,status:'FAIL',error:e.message,stack:e.stack});}}
for(const mode of ['web','native']){
 let source=fs.readFileSync(path.join(front,'scripts/employee-schedule-convergence-race-tests.mjs'),'utf8').split('if(browserWriterOnly){await browserWriterCases();}')[0];
 source=source.replaceAll("'./synthetic-schedule-locks.mjs'",JSON.stringify(pathToFileURL(path.join(front,'scripts/synthetic-schedule-locks.mjs')).href));
 source=source.replaceAll("new URL('../",`new URL('${pathToFileURL(front+'/').href}`);
 source=source.replaceAll("import('../mobile/",`import('${pathToFileURL(front+'/mobile/').href}`);
 const start=source.indexOf('const inline='),end=source.indexOf('const helper=',start);
 const runtime=mode==='web'?[...fs.readFileSync(path.join(front,'employee-schedule.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]:fs.readFileSync(path.join(front,'mobile/src/custodial/employee-schedule-runtime.js'),'utf8').replace('export function','function')+'\ninstallEmployeeSchedule();';
 source=source.slice(0,start)+`const inline=${JSON.stringify(runtime)}.replace("void load('launch');","globalThis.testPage={load,snapshot,render,zooNow,currentItems,isIdle:()=>!loading&&!queued};");\n`+source.slice(end);
 source=source.replace("const now=Date.parse(day+'T17:00:00Z'),FixedDate=", "let now=Date.parse(day+'T17:00:00Z');const FixedDate=");
 source=source.replace('return{context,stored,node,events,calls,put,settle,load:', 'return{setClock:v=>{now=Date.parse(v);},context,stored,node,events,calls,put,settle,load:');
 source+='\nexport {fixture,payload,day,key,id,principal};';
 const {fixture,payload,day,id}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const items=[{name:'Current regular area',coverage_start:'07:00',coverage_end:'16:00'},
  {name:'Temporary lunch area',coverage_start:'12:00',coverage_end:'13:00',coverage_purpose:'lunch_coverage',loan_id:'b'.repeat(64),coverer_person_id:id(2),normal_owner_person_id:id(9),normal_owner_name:'Synthetic Custodian Nine',service_date:day,projection_id:id(5)},
  {name:'Inherited future area',coverage_start:'14:00',coverage_end:'16:00'}];
 const data=(revision=19)=>{const p=payload(revision),v=p.recurring_delivery.view;v.employee_name='Synthetic Custodian Long Named Example';v.raw_items=structuredClone(items);p.raw_items=structuredClone(items);p.employee_name=v.employee_name;
  p.recurring_delivery.viewJsonText=JSON.stringify(v);p.recurring_delivery.viewDigest=sha(JSON.stringify(v));p.recurring_delivery.target.viewDigest=p.recurring_delivery.viewDigest;p.recurring_delivery.targetDigest=sha(flat(p.recurring_delivery.target));return p;};

 for(const [label,options,expected] of [
  ['offline cached-copy failure stays actionable',{offline:true,cacheWarning:true},/could not.*save|could not be saved/i],
  ['online cached-copy failure stays actionable',{offline:false,cacheWarning:true},/could not.*save|could not be saved/i],
  ['ordinary offline snapshot stays explicit',{offline:true,cacheWarning:false},/saved schedule.*could not check/i],
  ['current online schedule stays quiet',{offline:false,cacheWarning:false},/^$/],
 ]) await check(mode,label,async()=>{const f=fixture();f.next=data();await f.load();const selected=f.context.testPage.snapshot();assert.ok(selected?.data,'verified saved schedule exists');f.context.testPage.render(selected.data,options);const observed=f.node('state-text').textContent;assert.equal(f.node('content').hidden,false);assert.match(f.node('areas').innerHTML,/Current regular area/);assert.match(observed,expected);return {observed,options};});
}
const report={scope:'Actual web and native schedule runtime render path after a verified fixture load; synthetic native/storage/HTTP ports; no device proof',results,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length};
fs.writeFileSync(path.join(output,'SCHEDULE_WARNING.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
