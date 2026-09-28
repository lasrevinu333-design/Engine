import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const context={crypto:webcrypto,TextEncoder,Date};context.window=context;
vm.createContext(context);vm.runInContext(readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8'),context);
const api=context.MemphisRecurringScheduleTarget;
const id=n=>`a1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const jsonbFlat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const principal={deviceId:id(1),credentialId:id(2),employeeId:id(3),assignmentEpoch:7};
const day='2026-09-28';
const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:id(3),employee_name:'Synthetic Employee',
 publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,shift:{start:'07:00',end:'16:00',active:true},
 raw_items:[{location_name:'Restroom A',coverage_start:'07:00',coverage_end:'09:45'}]};
const target={schema:'static-weekly.recurring-application-target.v1',targetType:'SCHEDULE',operationId:id(6),publicationId:id(4),
 serviceDate:day,authorityRevision:19,...principal,projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))};
const base={intentId:id(7),target,targetDigest:sha(jsonbFlat(target)),applicationStatus:'PENDING',viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest};
const options={delivery:base,expectedPrincipal:principal,serviceDate:day};let checks=0;
const check=(a,b,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),b,label);checks++;};
const reject=async(label,work,pattern)=>{await assert.rejects(work,pattern,label);checks++;};
const prepared=await api.prepare(options);check(prepared.view,view,'exact server view retained');check(prepared.blocked,false);
check(Object.hasOwn(prepared,'applied'),false,'preparation is not an application receipt');
check(await api.prepare({...options,previous:prepared}),JSON.parse(JSON.stringify(prepared)),'exact repeat');
for(const [field,value] of [['deviceId',id(10)],['employeeId',id(11)],['credentialId',id(12)],['assignmentEpoch',8]])
 await reject('wrong '+field,()=>api.prepare({...options,expectedPrincipal:{...principal,[field]:value}}),/schedule_target_principal/);
for(const [label,patch,pattern] of [
 ['missing target',{target:null},/shape/],['bad target hash',{targetDigest:'f'.repeat(64)},/target_digest/],
 ['edited view',{viewJsonText:JSON.stringify({...view,raw_items:[]})},/render_digest/],
 ['wrong digest',{viewDigest:'f'.repeat(64)},/render_digest/],
 ['pending reconciliation',{applicationStatus:'PENDING_TARGET_RECONCILIATION'},/unavailable/],
])await reject(label,()=>api.prepare({...options,delivery:{...base,...patch}}),pattern);
for(const [field,value] of [['authorityRevision',0],['authorityRevision',Number.MAX_SAFE_INTEGER+1],['serviceDate','2026-02-30'],['unexpected',true]])
 await reject('invalid target '+field,()=>api.prepare({...options,delivery:{...base,target:{...target,[field]:value}}}),/schedule_target/);
for(const field of ['operationId','publicationId','projectionId','lunchDocumentIdentity','viewDigest']){
 const changed={...target,[field]:[target[field]]};
 await reject('array cannot masquerade as scalar '+field,()=>api.prepare({...options,
  delivery:{...base,target:changed,targetDigest:sha(jsonbFlat(changed))}}),/schedule_target/);
}
for(const [field,value] of [['employee_id',id(9)],['projection_id',id(9)],['publication_id',id(9)],['full_day',false],['projection_status','stale']]){
 const text=JSON.stringify({...view,[field]:value}),t={...target,viewDigest:sha(text)};
 await reject('digest-valid wrong view '+field,()=>api.prepare({...options,delivery:{...base,target:t,targetDigest:sha(jsonbFlat(t)),viewJsonText:text,viewDigest:t.viewDigest}}),/render_identity/);
}
const terminalTarget={schema:'static-weekly.recurring-terminal-target.v1',targetType:'BLOCKED_RECURRING_AUTHORITY',operationId:id(8),publicationId:id(4),
 serviceDate:day,authorityRevision:20,...principal,invalidationId:id(9),reasonCode:'ROSTER_DEPENDENCY_CHANGED'};
const terminal={intentId:id(10),target:terminalTarget,targetDigest:sha(jsonbFlat(terminalTarget)),applicationStatus:'PENDING',replacementCoverageReady:false};
const blocked=await api.prepare({...options,delivery:terminal,previous:prepared});
check([blocked.blocked,blocked.view,blocked.viewJsonText],[true,null,null],'terminal never resurrects old schedule');
await reject('delayed usable schedule cannot replace terminal',()=>api.prepare({...options,previous:blocked}),/older_than_cache/);
await reject('terminal cannot smuggle schedule',()=>api.prepare({...options,delivery:{...terminal,view}}),/terminal_contains/);
const equalRevision={...target,authorityRevision:20};
await reject('equal revision cannot change terminal to schedule',()=>api.prepare({...options,previous:blocked,delivery:{...base,target:equalRevision,targetDigest:sha(jsonbFlat(equalRevision))}}),/same_revision_conflict/);
const rotated={...principal,credentialId:id(22)},rotatedTarget={...terminalTarget,credentialId:rotated.credentialId};
const rotatedResult=await api.prepare({...options,expectedPrincipal:rotated,previous:blocked,
 delivery:{...terminal,intentId:id(23),target:rotatedTarget,targetDigest:sha(jsonbFlat(rotatedTarget))}});
check([rotatedResult.intentId,rotatedResult.principal.credentialId],[id(23),id(22)],'rotation binds new exact intent');
check(Object.hasOwn(rotatedResult,'applicationStatus'),false,'old acknowledged status never inherited');
const replacement={...target,publicationId:id(25),projectionId:id(26),authorityRevision:21};
const replacementView={...view,publication_id:id(25),projection_id:id(26)},replacementText=JSON.stringify(replacementView);
replacement.viewDigest=sha(replacementText);
const repaired=await api.prepare({...options,previous:blocked,delivery:{...base,target:replacement,targetDigest:sha(jsonbFlat(replacement)),viewJsonText:replacementText,viewDigest:replacement.viewDigest}});
check([repaired.blocked,repaired.target.authorityRevision],[false,21],'higher explicit replacement may restore usable state');
const original=JSON.stringify(base);prepared.view.raw_items.length=0;check(JSON.stringify(base),original,'no caller-owned source mutation');
const changing=structuredClone(base),inFlight=api.prepare({...options,delivery:changing});
changing.viewJsonText=JSON.stringify({...view,raw_items:[]});changing.target.publicationId=id(99);
check((await inFlight).view,view,'caller cannot replace parsed bytes during asynchronous hashing');
let actualPostgres=false;
if(process.env.RECURRING_TARGET_TEST_CONTAINER){
 const container=process.env.RECURRING_TARGET_TEST_CONTAINER;assert.match(container,/^mz_schema_shift_end_[0-9]+$/);
 const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8',timeout:10000}))[0];
 assert.equal(info.HostConfig.NetworkMode,'none');assert.equal(Object.keys(info.HostConfig.PortBindings||{}).length,0);
 for(const t of [target,terminalTarget]){
  const json=JSON.stringify(t);assert.ok(!json.includes('$payload$'));
  const sql=`begin read only;set local statement_timeout='5s';select public.static_weekly_digest_jsonb($payload$${json}$payload$::jsonb);rollback;`;
  const databaseDigest=execFileSync('docker',['exec','-i',container,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],{input:sql,encoding:'utf8',timeout:10000}).trim();
  check(sha(jsonbFlat(t)),databaseDigest,'flat target encoding matches actual PostgreSQL');
 }
 actualPostgres=true;
}
console.log(JSON.stringify({status:'PASS',checks,actualPostgres,scope:'pure desired-state validation and monotonic cache preparation; no mounted transport, storage, render, ACK or phone proof'}));
