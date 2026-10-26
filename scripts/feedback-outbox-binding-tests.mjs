import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createFeedbackOutbox} from '../mobile/src/custodial/feedback-outbox.js';
// Restore the existing owning facility from release-integration-20261002.
// Only --affected-cleanup-only is used for this continuation.
let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
const META={contract_version:'feedback.v3.enrolled-authority'};
const ACTIVE_PREFIX='mz_employee_feedback_outbox:',BACKUP_PREFIX='mz_employee_feedback_retirement_backup:';
const activeCount=f=>[...f.memory.keys()].filter(key=>key.startsWith(ACTIVE_PREFIX)).length;
function fixture(){
 const memory=new Map(),notices=[],requests=[];let online=false,response={ok:true},wait=null,mutationHook=null,requestHook=null,identityHook=null,generation=1,contextDevice=null,removeHook=null;
 const identity={deviceId:'KIOSK_SYNTHETIC',employeeId:randomUUID(),credentialId:randomUUID(),assignmentEpoch:7};
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:key=>memory.get(key)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>{removeHook?.(k);memory.delete(k);}};
 const options={storage,mutate:async fn=>{if(mutationHook)await mutationHook();return fn({deviceId:contextDevice||identity.deviceId,generation});},identity:async args=>{if(identityHook)await identityHook(args);return identity;},online:()=>online,onStatus:n=>notices.push(n),request:async(path,request)=>{requests.push({path,request});if(requestHook)await requestHook(request);if(wait)await wait;return response;}};
 return {memory,notices,requests,identity,box:createFeedbackOutbox(options),restart:()=>createFeedbackOutbox(options),setOnline:v=>online=v,setResponse:v=>response=v,setWait:v=>wait=v,setMutationHook:v=>mutationHook=v,setRequestHook:v=>requestHook=v,setIdentityHook:v=>identityHook=v,setGeneration:v=>generation=v,setContextDevice:v=>contextDevice=v,setRemoveHook:v=>removeHook=v};
}
const body=()=>({operation_id:randomUUID(),message:'Full ñ message\nzero0',category:'app_problem',priority:'normal'});
const contentDigest=b=>createHash('sha256').update(JSON.stringify([String(b.category??'other').trim().toLowerCase(),String(b.priority??'normal').trim().toLowerCase(),String(b.message??b.body??'').trim(),String(b.page_url??b.url??'').trim()||null,b.image_attachment?createHash('sha256').update(Buffer.from(b.image_attachment.data_url.split(',')[1].replace(/\s/g,''),'base64')).digest('hex'):null])).digest('hex');
const ack=(f,b)=>({id:randomUUID(),operation_id:b.operation_id,binding:{schema:'employee-feedback-receipt.v1',device_id:f.identity.deviceId,employee_id:f.identity.employeeId,content_sha256:contentDigest(b)}});
if(process.argv.includes('--factory-epoch-join-only')||process.argv.includes('--factory-epoch-before')){
 const sourceArg=process.argv.find(arg=>arg.startsWith('--feedback-factory-source='));
 const factorySource=readFileSync(sourceArg?sourceArg.slice('--feedback-factory-source='.length):new URL('../../PINNED_MAIN_FACTORY.mjs',import.meta.url),'utf8');
 const factorySHA=createHash('sha256').update(factorySource).digest('hex');same(factorySHA,'bf17128f92a9104d4febe8e2431c60f93dcdcc57b5e788dc7fdbd3905e0a6d37');
 const {createProtectedFeedbackIdentity}=await import('data:text/javascript;base64,'+Buffer.from(factorySource).toString('base64'));
 const principal=Object.freeze({schema_version:'custodial-protected-principal.v2',device_id:'KIOSK_08',employee_id:randomUUID(),credential_id:randomUUID(),assignment_epoch:7,
  activation_operation_id:randomUUID(),activation_receipt_sha256:'1'.repeat(64),legacy_binding_id:randomUUID(),legacy_binding_kind:'confirmed_enrollment_operation',installation_binding_sha256:'2'.repeat(64),installation_seal:'synthetic-installation-binding-only',enrolled_at:'2026-10-12T00:00:00.000Z'});
 const status=Object.freeze({ready:true,available:true,quarantined:false,generation:5,deviceId:principal.device_id,principal});
 const identity=createProtectedFeedbackIdentity({ready:async()=>{},security:{getStatus:()=>status,ensureSecurityState:async()=>{throw Error('Existing principal must not refresh/re-enter FIFO');}},currentDeviceId:()=>principal.device_id,refreshStatus:async()=>{throw Error('Existing original must not refresh');},online:()=>true});
 const fromFactory=await identity({purpose:'save'});same(fromFactory.assignmentEpoch,'7');same(fromFactory.employeeId,principal.employee_id);
 const memory=new Map(),storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const options={storage,identity,mutate:async fn=>fn({deviceId:principal.device_id,generation:5}),online:()=>false,request:async()=>{throw Error('This joining case must not dispatch');}};
 if(process.argv.includes('--factory-epoch-before')){
  const before=readFileSync(new URL('../../BEFORE_feedback-outbox.mjs',import.meta.url),'utf8');const module=await import('data:text/javascript;base64,'+Buffer.from(before).toString('base64'));
  await assert.rejects(()=>module.createFeedbackOutbox(options).save(body()),/verified saved employee identity/);checks++;same(memory.size,0);
  console.log(JSON.stringify({status:'BEFORE_ACTUAL_FACTORY_EPOCH_MISMATCH_REPRODUCED',checks,utc:new Date().toISOString(),factorySHA,beforeSHA:createHash('sha256').update(before).digest('hex'),pureFactorySource:true,SQL:false,native:false}));process.exit(0);
 }
 const box=createFeedbackOutbox(options),original=body();await box.save(original);const [key,encoded]=[...memory][0];same(JSON.parse(encoded).body.expected_assignment_epoch,'7');same((await box.readPending()).body.operation_id,original.operation_id);
 await createFeedbackOutbox({...options,identity:async()=>({...fromFactory,assignmentEpoch:7})}).save(original);same(memory.get(key),encoded);
 for(const valid of ['1',1,String(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER]){
  const b=body();await createFeedbackOutbox({...options,identity:async()=>({...fromFactory,assignmentEpoch:valid})}).save(b);const row=JSON.parse(memory.get(ACTIVE_PREFIX+principal.device_id+':'+b.operation_id));same(row.body.expected_assignment_epoch,String(valid));
 }
 let coercions=0;
 for(const invalid of ['07','0','-1','+7','7.0','7e0','7\n','7 ',' 7','9007199254740992','9007199254740993','',0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,true,false,null,undefined,7n,{},new Number(7),{valueOf(){coercions++;return 7;}}]){
  const beforeSize=memory.size;await assert.rejects(()=>createFeedbackOutbox({...options,identity:async()=>({...fromFactory,assignmentEpoch:invalid})}).save(body()),/verified saved employee identity/);checks++;same(memory.size,beforeSize);
 }
 same(coercions,0);same(memory.get(key),encoded);
 console.log(JSON.stringify({status:'FEEDBACK_ACTUAL_FACTORY_EPOCH_JOIN_SOURCE_PASS',cases:1,checks,utc:new Date().toISOString(),factorySHA,pureFactorySource:true,principalAndMutation:'synthetic current-owner recording callbacks; not real credentialStore FIFO/native',storedOriginalUnchanged:true,SQL:false,HTTP:false,ACK:false}));process.exit(0);
}
async function retirementBackupCases(){
 function scenario(kind='normal'){
  const memory=new Map(),requests=[],notices=[],writes=[],removals=[],ids=new Map(),identity={deviceId:'KIOSK_SYNTHETIC',employeeId:randomUUID(),credentialId:randomUUID(),assignmentEpoch:7};
  let postReject=kind==='post-reject';
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,setItem:(k,v)=>{
   writes.push(k);if(k.startsWith(BACKUP_PREFIX)&&kind==='quota')throw Object.assign(Error('Synthetic browser capacity'),{name:'QuotaExceededError'});
   if(k.startsWith(BACKUP_PREFIX)&&kind==='write-throw')throw Error('Synthetic backup write failure');
   memory.set(k,k.startsWith(BACKUP_PREFIX)&&kind==='readback'?'incomplete-backup':v);
  },removeItem:k=>{removals.push(k);memory.delete(k);}};
  const options={storage,identity:async()=>identity,online:()=>true,onStatus:n=>notices.push(n),mutate:async fn=>{
   const value=await fn({deviceId:identity.deviceId,generation:1});if(postReject&&removals.length){postReject=false;throw Error('Synthetic post-callback withdrawal');}return value;
  },request:async(path,options)=>{
   requests.push(structuredClone(options));if(kind==='unverified')return {ok:true};
   const b=options.body;if(!ids.has(b.operation_id))ids.set(b.operation_id,randomUUID());
   return {ok:true,meta:META,data:{item:{...ack({identity},b),id:ids.get(b.operation_id)}}};
  }};
  return {memory,requests,notices,writes,removals,identity,box:createFeedbackOutbox(options),restart:()=>createFeedbackOutbox(options)};
 }
 let cases=0;
 for(const kind of ['post-reject','normal','quota','write-throw','readback','conflict','unverified']){
  const f=scenario(kind),b=body();await f.box.save(b);const [key,encoded]=[...f.memory][0],backupKey=BACKUP_PREFIX+f.identity.deviceId+':'+b.operation_id;
  let conflict=null;
  if(kind==='conflict'){const altered=JSON.parse(encoded);altered.body.message='Contradictory retained original';conflict=JSON.stringify({schema_version:'employee-feedback-retirement-backup.v1',original_key:key,original_encoded:JSON.stringify(altered)});f.memory.set(backupKey,conflict);}
  const accepted=await f.box.flush();
  if(['normal','post-reject'].includes(kind)){
   same(accepted,kind==='normal'?[b.operation_id]:[]);same(f.memory.get(key),undefined);same(f.memory.size,1);
   const backupBytes=f.memory.get(backupKey),backup=JSON.parse(backupBytes);same(Object.keys(backup).sort(),['original_encoded','original_key','schema_version']);same(backup.schema_version,'employee-feedback-retirement-backup.v1');same(backup.original_key,key);same(backup.original_encoded,encoded);
   const restarted=f.restart(),pending=await restarted.readPending();same(pending.state,'pending');same(pending.body,JSON.parse(encoded).body);same(pending.originals.length,1);same(f.requests.length,1);
   const before=f.writes.length;f.identity.credentialId='';same(await restarted.readPending(),{state:'unavailable'});same(f.writes.length,before);
   f.identity.credentialId=pending.body.expected_credential_id;await restarted.save(pending.body);same(f.memory.get(key),encoded);same(f.memory.get(backupKey),backupBytes);
   same(await restarted.flush(),[b.operation_id]);same(f.memory.get(key),undefined);same(f.memory.get(backupKey),backupBytes);same(f.requests[1],f.requests[0]);
  }else{
   same(accepted,[]);same(f.memory.get(key),encoded);same(f.removals.length,0);
   if(kind==='conflict'){same(f.memory.get(backupKey),conflict);same(await f.box.readPending(),{state:'held'});}
   if(kind==='quota'){same(f.memory.get(backupKey),undefined);same(f.notices.at(-1).reason,'retirement_backup_capacity');}
   if(kind==='readback')same(await f.box.readPending(),{state:'held'});
   if(kind==='unverified')same(f.memory.get(backupKey),undefined);
  }
  cases++;
 }
 const f=scenario(),b=body();await f.box.save(b);await f.box.flush();const backupKey=[...f.memory.keys()][0],backupBytes=f.memory.get(backupKey),original=JSON.parse(JSON.parse(backupBytes).original_encoded).body;
 for(const field of ['employeeId','credentialId','assignmentEpoch']){
  const before=f.identity[field];f.identity[field]=field==='assignmentEpoch'?8:randomUUID();const writes=f.writes.length;
  same(await f.box.readPending(),{state:'held'});await assert.rejects(()=>f.box.save(original),/authority changed/);checks++;same(f.writes.length,writes);same(f.memory.get(backupKey),backupBytes);f.identity[field]=before;
 }cases++;
 const extra=JSON.parse(backupBytes);extra.accepted=true;f.memory.set(backupKey,JSON.stringify(extra));same(await f.box.readPending(),{state:'held'});await assert.rejects(()=>f.box.save(original),/protected recovery/);checks++;same(f.memory.size,1);f.memory.set(backupKey,backupBytes);cases++;
 function page(){
  const script=readFileSync(new URL('../employee-feedback.html',import.meta.url),'utf8').split('  <script>')[1].split('</script>')[0],listeners={},elements={},saves=[];
  for(const id of ['form','message','photo','add-photo','preview','preview-image','remove-photo','send','status'])elements[id]={value:'A different new draft',addEventListener:(n,fn)=>listeners[id+':'+n]=fn,removeAttribute(){},reset(){},querySelector:()=>({value:'need_help'})};
  elements.form.elements=[elements.message,elements.photo,elements['add-photo'],elements['remove-photo'],elements.send];
  const mobile={deviceId:()=>f.identity.deviceId,ready:Promise.resolve(),pendingEmployeeFeedback:()=>f.box.readPending(),saveEmployeeFeedback:async body=>{saves.push(structuredClone(body));return f.box.save(body);},flushEmployeeFeedback:()=>f.box.flush()};
  runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener(){}},document:{getElementById:id=>elements[id],addEventListener(){}},crypto:{randomUUID},URL:{revokeObjectURL(){}},Promise,Date,Math});return {listeners,elements,saves};
 }
 const drain=async()=>{for(let n=0;n<25;n++)await new Promise(setImmediate);};
 const p=page();await drain();same(p.elements.send.textContent,'Retry Sync');same(p.elements.status.textContent,'Saved on this phone. It will retry automatically.');const requests=f.requests.length;
 await p.listeners['form:submit']({preventDefault(){}});await drain();same(p.saves[0],original);same(p.elements.status.textContent,'Saved in the program.');same(f.requests.length,requests+1);same(f.memory.get(backupKey),backupBytes);
 const reload=page();await drain();same(reload.elements.status.textContent,'Saved on this phone. It will retry automatically.');same(reload.elements.send.textContent,'Retry Sync');same(f.requests.length,requests+1);same(reload.saves.length,0);
 await p.listeners['form:submit']({preventDefault(){}});await drain();assert.notEqual(p.saves[1].operation_id,b.operation_id);checks++;same([...f.memory.keys()].filter(k=>k.startsWith(BACKUP_PREFIX)).length,2);same(f.memory.get(backupKey),backupBytes);cases++;
 console.log(JSON.stringify({status:'FEEDBACK_RETIREMENT_BACKUP_SOURCE_PASS',cases,checks,utc:new Date().toISOString(),callbacks:'synthetic',actualPageScript:true,SQL:false,HTTP:false,provider:false,native:false,backupAcceptance:false,retentionCleanupQualified:false}));
}
if(process.argv.includes('--retirement-backup-only')){await retirementBackupCases();process.exit(0);}
async function changedBytesDuringUploadCase(){
 const f=fixture(),b=body();await f.box.save(b);f.setOnline(true);let release;f.setWait(new Promise(r=>release=r));f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
 const flight=f.box.flush();for(let n=0;!f.requests.length&&n<1000;n++)await new Promise(setImmediate);same(f.requests.length,1);const key=[...f.memory.keys()][0];f.memory.set(key,'changed-during-flight');release();same(await flight,[]);same(f.memory.get(key),'changed-during-flight');
}
// Current G24 owning member. Inject Main's normal signed transport and fixed
// parameterized reader; this member never mounts a server or creates a DB.
export async function runEmployeeFeedbackSubmissionJoin({request,sql,mutate,identity,operationId=randomUUID()}={}){
 assert.ok([request,sql,mutate,identity].every(fn=>typeof fn==='function'),'Main current request/sql/protected mutation/identity callbacks are required');
 const memory=new Map(),calls=[],notices=[];
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 let loseOnce=true;
 const box=createFeedbackOutbox({storage,mutate,identity,online:()=>true,onStatus:n=>notices.push(n),
  request:async(path,options)=>{calls.push(structuredClone(options));const result=await request(path,options);if(loseOnce){loseOnce=false;throw Error('Owning fixture discards the first real HTTP response after settlement');}return result;}});
 const original={operation_id:operationId,message:'G24 bounded employee original ñ / zero0',category:'need_help',priority:'normal',page_url:'employee-feedback.html'};
 await box.save(original);const [key,encoded]=[...memory][0],saved=JSON.parse(encoded).body;
 assert.deepEqual(await box.flush(),[]);assert.equal(memory.get(key),encoded);
 const read=async()=>{const result=await sql(`select id,operation_id,request_fingerprint,hub_context,device_id,category,priority,message,page_url,metadata_json from public.system_feedback_items where operation_id=$1::uuid`,[operationId],{role:'custodial_application_reader',write:false});assert.ok(Array.isArray(result?.rows),'Normal parameterized SQL result.rows required');assert.equal(result.rows.length,1);return result.rows[0];};
 const first=await read();assert.equal(first.operation_id,operationId);assert.equal(first.hub_context,'employee');assert.equal(first.device_id,saved.device_id);assert.equal(first.message,original.message);
 const actor=first.metadata_json?.identity_verification;assert.equal(actor?.status,'verified');assert.equal(actor?.kind,'enrolled_employee_device');assert.equal(actor?.employee_id,saved.expected_employee_id);assert.equal(actor?.device_id,saved.device_id);assert.equal(actor?.credential_id,saved.expected_credential_id);assert.equal(String(actor?.assignment_epoch),saved.expected_assignment_epoch);assert.match(first.request_fingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(await box.flush(),[operationId]);assert.equal(memory.get(key),undefined);assert.equal(memory.size,1);
 const backup=JSON.parse(memory.get(BACKUP_PREFIX+saved.device_id+':'+operationId));assert.deepEqual(Object.keys(backup).sort(),['original_encoded','original_key','schema_version']);assert.equal(backup.schema_version,'employee-feedback-retirement-backup.v1');assert.equal(backup.original_key,key);assert.equal(backup.original_encoded,encoded);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.ok(Number.isSafeInteger(calls[0].expectedGeneration)&&calls[0].expectedGeneration>0);
 const replay=await read();assert.deepEqual(replay,first);assert.equal(notices.at(-1).state,'uploaded');assert.ok(!notices.some(n=>n.state==='delivered'));
 return {operation_id:operationId,feedback_id:first.id,requests:2,uniqueRows:1,lostResponseRetained:true,exactReplayRetired:true,unknownOriginalBackupRetained:true,providerSend:false,protectedMutation:'Supplied Main callback; no independent native/physical qualification'};
}
async function currentSubmissionCases(){
 for(const kind of ['credential-before-post','epoch-before-post','credential-after-post','legacy-unpinned','missing-current-principal']){
  const f=fixture(),b=body();await f.box.save(b);const [key,encoded]=[...f.memory][0];f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
  if(kind==='credential-before-post')f.identity.credentialId=randomUUID();
  if(kind==='epoch-before-post')f.identity.assignmentEpoch=8;
  if(kind==='missing-current-principal')delete f.identity.credentialId;
  if(kind==='legacy-unpinned'){const row=JSON.parse(encoded);delete row.body.expected_credential_id;delete row.body.expected_assignment_epoch;f.memory.set(key,JSON.stringify(row));}
  if(kind==='credential-after-post')f.setRequestHook(()=>{f.identity.credentialId=randomUUID();});
  const original=f.memory.get(key);same(await f.box.flush(),[]);same(f.memory.get(key),original);same(f.requests.length,kind==='credential-after-post'?1:0);
 }
 {
  const f=fixture(),b=body();await f.box.save(b);const saved=JSON.parse([...f.memory.values()][0]).body;
  same(saved.expected_credential_id,f.identity.credentialId);same(saved.expected_assignment_epoch,'7');
  f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});same(await f.box.flush(),[b.operation_id]);same(f.requests[0].request.expectedGeneration,1);same(activeCount(f),0);
 }
 if(process.argv.includes('--current-principal-only')){
  console.log(JSON.stringify({status:'FEEDBACK_CURRENT_PRINCIPAL_SOURCE_PASS',checks,utc:new Date().toISOString(),newCases:6,transport:'synthetic',SQL:false,provider:false,native:false}));return;
 }
 for(const kind of ['generation-dispatch','missing-generation','assert-after-identity','foreign-device-save']){
  const f=fixture(),b=body();if(kind==='foreign-device-save'){await assert.rejects(()=>f.box.save({...b,device_id:'FOREIGN'}),/authority changed/);same(f.memory.size,0);continue;}
  await f.box.save(b);const [key,encoded]=[...f.memory][0];f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
  if(kind==='missing-generation')f.setGeneration(null);
  if(kind==='generation-dispatch')f.setRequestHook(options=>{same(options.expectedGeneration,1);f.setGeneration(2);throw Error('Normal transport refuses queued original generation');});
  if(kind==='assert-after-identity'){
   let admissionChecks=0;
   const options={storage:{get length(){return f.memory.size;},key:i=>[...f.memory.keys()][i],getItem:k=>f.memory.get(k)??null,setItem:(k,v)=>f.memory.set(k,v),removeItem:k=>f.memory.delete(k)},identity:async()=>f.identity,online:()=>true,
    mutate:async fn=>fn({deviceId:f.identity.deviceId,generation:1,assertCurrent(){if(++admissionChecks===2)throw Error('Changed during identity await');}}),request:async()=>{throw Error('Must not dispatch');}};
   same(await createFeedbackOutbox(options).flush(),[]);same(admissionChecks,2);same(f.memory.get(key),encoded);continue;
  }
  same(await f.box.flush(),[]);same(f.memory.get(key),encoded);same(f.requests.length,kind==='missing-generation'?0:1);
 }
 const html=readFileSync(new URL('../employee-feedback.html',import.meta.url),'utf8'),script=html.split('  <script>')[1].split('</script>')[0],listeners={},elements={};let ready,fail=true;const saves=[];
 for(const id of ['form','message','photo','add-photo','preview','preview-image','remove-photo','send','status'])elements[id]={value:'Original before ready',addEventListener:(name,fn)=>{listeners[id+':'+name]=fn;},removeAttribute(){},reset(){},querySelector:()=>({value:'need_help'})};
 let savedBody=null;
 const mobile={deviceId:()=> 'KIOSK_SYNTHETIC',ready:new Promise(r=>ready=r),pendingEmployeeFeedback:async()=>savedBody?{state:'pending',body:savedBody}:{state:'clear'},saveEmployeeFeedback:async b=>{saves.push(structuredClone(b));savedBody=b;if(fail)throw Error('Local Save uncertain after original persisted');},flushEmployeeFeedback:async()=>[]};
 runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener(){}},document:{getElementById:id=>elements[id],addEventListener(){}},crypto:{randomUUID},URL:{revokeObjectURL(){}},Promise,Date,Math});
 const first= listeners['form:submit']({preventDefault(){}});elements.message.value='Changed during ready';ready();await first;
 same(saves[0].message,'Original before ready');same(elements.status.textContent,'Save not confirmed. Retry keeps the same feedback.');same(elements.send.textContent,'Retry Sync');
 elements.message.value='Changed on Retry';fail=false;await listeners['form:submit']({preventDefault(){}});same(saves.length,2);same(saves[1],saves[0]);same(elements.status.textContent,'Saved on this phone. It will retry automatically.');
 console.log(JSON.stringify({status:'FEEDBACK_CURRENT_SUBMISSION_SOURCE_PASS',checks,utc:new Date().toISOString(),newCases:11,transport:'synthetic',pageScriptExecuted:true,SQL:false,provider:false,native:false}));
}
if(process.argv.includes('--current-submission-only')||process.argv.includes('--current-principal-only')){await currentSubmissionCases();process.exit(0);}
async function pendingRecoveryCases(){
 const f=fixture(),b=body();await f.box.save(b);const [key,encoded]=[...f.memory][0];
 const pending=await f.box.readPending();same(pending.state,'pending');same(pending.body,JSON.parse(encoded).body);same(Object.isFrozen(pending.body),true);same(f.memory.get(key),encoded);
 f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});f.setRemoveHook(()=>{throw Error('Synthetic local cleanup failure after settled response');});
 same(await f.box.flush(),[]);same(f.requests.length,1);same(f.memory.get(key),encoded);same((await f.box.readPending()).body,pending.body);
 function page(){
  const script=readFileSync(new URL('../employee-feedback.html',import.meta.url),'utf8').split('  <script>')[1].split('</script>')[0],listeners={},elements={},saves=[];
  for(const id of ['form','message','photo','add-photo','preview','preview-image','remove-photo','send','status'])elements[id]={value:'Changed attempted content',addEventListener:(name,fn)=>{listeners[id+':'+name]=fn;},removeAttribute(){},reset(){},querySelector:()=>({value:'need_help'})};
  elements.form.elements=[elements.message,elements.photo,elements['add-photo'],elements['remove-photo'],elements.send];
  const mobile={deviceId:()=>f.identity.deviceId,ready:Promise.resolve(),pendingEmployeeFeedback:()=>f.box.readPending(),saveEmployeeFeedback:async value=>{saves.push(structuredClone(value));return f.box.save(value);},flushEmployeeFeedback:()=>f.box.flush()};
  runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener:(name,fn)=>listeners['window:'+name]=fn},document:{getElementById:id=>elements[id],addEventListener(){}},crypto:{randomUUID},URL:{revokeObjectURL(){}},Promise,Date,Math});
  return {elements,listeners,saves};
 }
 const drain=async()=>{for(let n=0;n<25;n++)await new Promise(setImmediate);};
 const first=page();await drain();same(first.elements.send.textContent,'Retry Sync');same(first.elements.message.disabled,true);same(first.elements.status.textContent,'Saved on this phone. It will retry automatically.');
 await first.listeners['form:submit']({preventDefault(){}});await drain();same(first.saves[0].operation_id,b.operation_id);same(first.saves[0],pending.body);same(f.memory.get(key),encoded);same(first.elements.status.textContent,'Saved on this phone. It will retry automatically.');
 const reloaded=page();await drain();await reloaded.listeners['form:submit']({preventDefault(){}});await drain();same(reloaded.saves[0],pending.body);same(f.memory.get(key),encoded);
 f.setRemoveHook(null);await reloaded.listeners['form:submit']({preventDefault(){}});await drain();same(reloaded.elements.status.textContent,'Saved in the program.');same(reloaded.elements.send.textContent,'Send');same(activeCount(f),0);
 const foreign=fixture();await foreign.box.save(body());foreign.identity.credentialId=randomUUID();same(await foreign.box.readPending(),{state:'held'});same(foreign.memory.size,1);
 const legacy=fixture();await legacy.box.save(body());const legacyKey=[...legacy.memory.keys()][0],legacyRow=JSON.parse(legacy.memory.get(legacyKey));delete legacyRow.body.expected_credential_id;legacy.memory.set(legacyKey,JSON.stringify(legacyRow));same(await legacy.box.readPending(),{state:'held'});
 f.identity.credentialId='';const withdrawn=page();await drain();same(withdrawn.elements.send.disabled,true);await withdrawn.listeners['form:submit']({preventDefault(){}});same(withdrawn.saves.length,0);same(withdrawn.elements.status.textContent,'Saved feedback recovery is unavailable. Keep the original pending.');
 console.log(JSON.stringify({status:'FEEDBACK_PENDING_UI_RECOVERY_SOURCE_PASS',checks,newCases:6,utc:new Date().toISOString(),actualPageScript:true,callbacks:'synthetic',SQL:false,HTTP:false,provider:false,physical:false}));
}
if(process.argv.includes('--pending-recovery-only')){await pendingRecoveryCases();process.exit(0);}
if(process.argv.includes('--post-cleanup-boundary-only')){
 const memory=new Map(),current={deviceId:'KIOSK_SYNTHETIC',employeeId:randomUUID(),credentialId:randomUUID(),assignmentEpoch:7},b=body();let sent=false,unstable=true;
 const box=createFeedbackOutbox({storage:{get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},identity:async()=>current,online:()=>true,
  mutate:async fn=>{const value=await fn({deviceId:current.deviceId,generation:1});if(sent&&unstable)throw Error('Recording existing store post-callback admission rejection');return value;},
  request:async()=>{sent=true;return {ok:true,meta:META,data:{item:{id:randomUUID(),operation_id:b.operation_id,binding:{schema:'employee-feedback-receipt.v1',device_id:current.deviceId,employee_id:current.employeeId,content_sha256:contentDigest(b)}}}};}});
 await box.save(b);const encoded=[...memory.values()][0];same(memory.size,1);same(await box.flush(),[]);same(memory.size,1);unstable=false;const pending=await box.readPending();same(pending.state,'pending');same(pending.body,JSON.parse(encoded).body);
 console.log(JSON.stringify({status:'POST_DELETE_UNKNOWN_ORIGINAL_BACKUP_PRESERVED',checks,utc:new Date().toISOString(),newCases:1,sourceOnly:true,SQL:false,HTTP:false,retentionCleanupQualified:false}));process.exit(0);
}
if(process.argv.includes('--pending-recovery-before')){
 const html=readFileSync(new URL('../../BEFORE_employee-feedback.html',import.meta.url),'utf8'),script=html.split('  <script>')[1].split('</script>')[0],listeners={},elements={},saves=[];
 for(const id of ['form','message','photo','add-photo','preview','preview-image','remove-photo','send','status'])elements[id]={value:'Same original repeated',addEventListener:(name,fn)=>listeners[id+':'+name]=fn,removeAttribute(){},reset(){},querySelector:()=>({value:'need_help'})};
 const mobile={deviceId:()=> 'KIOSK_SYNTHETIC',ready:Promise.resolve(),saveEmployeeFeedback:async body=>saves.push(structuredClone(body)),flushEmployeeFeedback:async()=>[]};
 runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener(){}},document:{getElementById:id=>elements[id],addEventListener(){}},crypto:{randomUUID},URL:{revokeObjectURL(){}},Promise,Date,Math});
 await listeners['form:submit']({preventDefault(){}});await listeners['form:submit']({preventDefault(){}});
 assert.notEqual(saves[0].operation_id,saves[1].operation_id);assert.equal(saves[0].message,saves[1].message);
 console.log(JSON.stringify({status:'PENDING_ORIGINAL_UI_DUPLICATE_REPRODUCED',assertions:2,utc:new Date().toISOString(),beforePageSHA:createHash('sha256').update(html).digest('hex'),synthetic:true,SQL:false,HTTP:false}));process.exit(0);
}
// Main imports only the callable above, without replaying historical groups.
if(!new URL(import.meta.url).searchParams.has('currentSubmissionMember')){
if(process.argv.includes('--affected-crypto-await-only')){await changedBytesDuringUploadCase();console.log(JSON.stringify({status:'FEEDBACK_CRYPTO_AWAIT_CAS_PASS',checks,at_utc:new Date().toISOString(),actualModule:true,transport:'synthetic'}));process.exit(0);}
async function affectedReceiptCases(){
 let cases=0;
 for(const kind of process.argv.includes('--affected-page-only')?[]:['missing','employee','device','content','schema','extra','exact','attachment']){
  const f=fixture(),b=body();if(kind==='attachment')b.image_attachment={type:'image/png',data_url:'data:image/png;base64,c3ludGhldGlj'};
  await f.box.save(b);const [key,bytes]=[...f.memory][0];f.setOnline(true);const item=ack(f,b);
  if(kind==='missing')delete item.binding;if(kind==='employee')item.binding.employee_id=randomUUID();if(kind==='device')item.binding.device_id='OTHER';if(kind==='content')item.binding.content_sha256='0'.repeat(64);if(kind==='schema')item.binding.schema='invented';if(kind==='extra')item.binding.delivered=true;
  f.setResponse({ok:true,meta:META,data:{item}});const accepted=await f.box.flush();
  if(['exact','attachment'].includes(kind)){same(accepted,[b.operation_id]);same(activeCount(f),0);}else{same(accepted,[]);same(f.memory.get(key),bytes);}cases++;
 }
 const html=readFileSync(new URL('../employee-feedback.html',import.meta.url),'utf8'),script=html.split('  <script>')[1].split('</script>')[0],listeners={},elements={};let saved=null,flushes=[];
 for(const id of ['form','message','photo','add-photo','preview','preview-image','remove-photo','send','status'])elements[id]={value:'Original help',addEventListener:(name,fn)=>{listeners[id+':'+name]=fn;},removeAttribute(){},reset(){},querySelector:()=>({value:'need_help'})};
 const mobile={deviceId:()=> 'KIOSK_SYNTHETIC',ready:Promise.resolve(),pendingEmployeeFeedback:async()=>saved?{state:'pending',body:saved}:{state:'clear'},saveEmployeeFeedback:async b=>{saved=b;},flushEmployeeFeedback:()=>{const operation=saved?.operation_id;return new Promise(resolve=>flushes.push(()=>{if(saved?.operation_id===operation)saved=null;resolve(operation?[operation]:[]);}));}};
 runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener(){}},document:{getElementById:id=>elements[id],addEventListener(){}},crypto:{randomUUID},URL:{revokeObjectURL(){}},Promise,Date,Math});
 const drain=async()=>{await Promise.resolve();await Promise.resolve();};await drain();flushes.splice(0).forEach(fn=>fn());await drain();
 await listeners['form:submit']({preventDefault(){}});same(elements.status.textContent,'Saved on this phone. It will retry automatically.');flushes.splice(0).forEach(fn=>fn());await drain();same(elements.status.textContent,'Saved in the program.');cases++;
 await listeners['form:submit']({preventDefault(){}});const original=saved.operation_id,old=flushes.splice(0);await listeners['form:submit']({preventDefault(){}});same(saved.operation_id,original);old.forEach(fn=>fn());await drain();same(elements.status.textContent,'Saved in the program.');cases++;
 console.log(JSON.stringify({status:'FEEDBACK_RECEIPT_AND_EMPLOYEE_PAGE_PASS',cases,checks,at_utc:new Date().toISOString(),callbacks:'synthetic',pageScriptExecuted:true,realAuth:false,mailDelivered:false}));
}
if(process.argv.includes('--affected-receipt-only')||process.argv.includes('--affected-page-only')){await affectedReceiptCases();process.exit(0);}
async function acceptedDefaultUploadCase(f,b){
 f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b),notification:{email_delivery:{state:'queued'}}}});
 same(await f.restart().flush(),[b.operation_id]);same(activeCount(f),0);same(f.notices.at(-1).state,'uploaded');
 same(f.requests[0].request.body.expected_employee_id,f.identity.employeeId);same(f.requests[0].request.headers['Idempotency-Key'],b.operation_id);
}
if(process.argv.includes('--affected-default-upload-only')){
 const f=fixture(),b=body();await f.box.save(b);await acceptedDefaultUploadCase(f,b);
 console.log(JSON.stringify({status:'FEEDBACK_DEFAULT_UPLOAD_V3_COMPATIBILITY_PASS',checks,at_utc:new Date().toISOString(),actualModule:true,transport:'synthetic',actualAuth:false,mailDelivered:false}));process.exit(0);
}
async function affectedCleanupCases(){
 let cases=0;
 for(const boundary of ['employee-http','device-http','employee-mutation','generation-mutation','missing-employee','mutation-device']){
  const f=fixture(),b=body();await f.box.save(b);const [key,bytes]=[...f.memory][0];f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
  const change=()=>{if(boundary.startsWith('employee'))f.identity.employeeId=randomUUID();if(boundary==='device-http')f.identity.deviceId='KIOSK_OTHER';if(boundary==='generation-mutation')f.setGeneration(2);if(boundary==='missing-employee')f.identity.employeeId='';if(boundary==='mutation-device')f.setContextDevice('KIOSK_OTHER');};
  if(boundary.endsWith('mutation')||boundary==='mutation-device')f.setMutationHook(()=>{if(f.requests.length)change();});else f.setRequestHook(change);
  same(await f.box.flush(),[]);same(f.memory.get(key),bytes);same(f.memory.size,1);same(f.requests.length,1);cases++;
 }
 for(const field of ['missing-contract','device_id','employee_id','message']){
  const f=fixture(),b=body();await f.box.save(b);const [key,bytes]=[...f.memory][0];f.setOnline(true);
  const receipt=ack(f,b);if(field!=='missing-contract')receipt[field]='foreign-provenance';
  f.setResponse({ok:true,...(field==='missing-contract'?{}:{meta:META}),data:{item:receipt}});
  same(await f.box.flush(),[]);same(f.memory.get(key),bytes);same(f.requests.length,1);cases++;
 }
 {
  const f=fixture(),b=body();await f.box.save(b);const [key,bytes]=[...f.memory][0];f.identity.employeeId=randomUUID();f.setOnline(true);
  same(await f.box.flush(),[]);same(f.requests.length,0);same(f.memory.get(key),bytes);cases++;
 }
 {
  const f=fixture(),b=body();b.image_attachment={name:'historical.png',type:'image/png',data_url:'data:image/png;base64,c3ludGhldGlj'};await f.box.save(b);const [key,bytes]=[...f.memory][0];f.setOnline(true);
  f.setRequestHook(request=>{request.body.message='rewritten';});f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
  same(await f.box.flush(),[]);same(f.memory.get(key),bytes);same(f.requests[0].request.body.message,b.message);same(f.requests[0].request.body.image_attachment.data_url,b.image_attachment.data_url);cases++;
 }
 {
  const f=fixture(),b=body(),originalMessage=b.message,operation=b.operation_id;f.setIdentityHook(()=>{b.message='changed while Save awaited identity';b.operation_id=randomUUID();});
  await f.box.save(b);const row=JSON.parse([...f.memory.values()][0]);same(row.body.message,originalMessage);same(row.body.operation_id,operation);cases++;
 }
 for(const state of ['queued','connector_accepted','outcome_unknown']){
  const f=fixture(),b=body();await f.box.save(b);f.setOnline(true);f.setResponse({ok:true,meta:META,data:{item:{...ack(f,b),email_delivery:{state}}}});
  same(await f.box.flush(),[b.operation_id]);same(activeCount(f),0);same(f.requests.length,1);same(f.notices.at(-1).state,'uploaded');assert.ok(!f.notices.some(n=>n.state==='delivered'));cases++;
 }
 {
  const f=fixture(),b=body();await f.box.save(b);const [key,bytes]=[...f.memory][0];f.setOnline(true);f.setRequestHook(()=>{throw Error('synthetic lost acknowledgment');});
  same(await f.box.flush(),[]);same(f.memory.get(key),bytes);f.setRequestHook(null);f.setResponse({ok:true,meta:META,data:{item:ack(f,b)}});
  same(await f.restart().flush(),[b.operation_id]);same(f.requests.length,2);same(f.requests[0].request.headers['Idempotency-Key'],f.requests[1].request.headers['Idempotency-Key']);same(f.requests[0].request.body,f.requests[1].request.body);cases++;
 }
 {
  const f=fixture(),b=body();f.setMutationHook(()=>{f.identity.employeeId=randomUUID();});await assert.rejects(()=>f.box.save(b),/authority changed/);same(f.memory.size,0);same(f.requests.length,0);cases++;
 }
 {
  const f=fixture(),b=body();await f.box.save(b);const [key,bytes]=[...f.memory][0];same(await f.box.flush(),[]);same(f.memory.get(key),bytes);same(f.requests.length,0);same(f.notices.length,0);cases++;
 }
 console.log(JSON.stringify({status:'FEEDBACK_OUTBOX_AFFECTED_CLEANUP_PASS',cases,checks,at_utc:new Date().toISOString(),actualModule:true,transport:'synthetic',actualAuth:false,mailDelivered:false,physical:false}));
}
if(process.argv.includes('--affected-cleanup-only')){await affectedCleanupCases();process.exit(0);}
for(const makeResponse of [()=>({ok:true}),(_fixture,b)=>({ok:true,data:{item:{id:randomUUID(),operation_id:randomUUID()}}}),(_fixture,b)=>({ok:true,data:{item:{id:'invalid',operation_id:b.operation_id}}}),(f,b)=>({ok:false,data:{item:ack(f,b)}})]){
 const f=fixture(),b=body();await f.box.save(b);const bytes=[...f.memory.values()][0];f.setOnline(true);f.setResponse(makeResponse(f,b));
 same(await f.box.flush(),[]);same(f.memory.size,1);same([...f.memory.values()][0],bytes);
}
{
 const f=fixture(),b=body();await f.box.save(b);const bytes=[...f.memory.values()][0];
 await f.box.save({priority:b.priority,category:b.category,message:b.message,operation_id:b.operation_id});
 same(f.memory.size,1);same([...f.memory.values()][0],bytes);
 await assert.rejects(()=>f.box.save({...b,message:'changed'}),/identity/);checks++;
 await acceptedDefaultUploadCase(f,b);
}
{
 await changedBytesDuringUploadCase();
}
{
 const f=fixture(),b=body();await f.box.save(b);f.identity.employeeId=randomUUID();f.setOnline(true);f.setResponse({ok:false});await f.box.flush();
 same(f.requests.length,0);same(f.memory.size,1);
}
console.log(JSON.stringify({status:'FEEDBACK_OUTBOX_BINDING_PASS',checks,actualModule:true,transport:'synthetic',physical:false}));
}
