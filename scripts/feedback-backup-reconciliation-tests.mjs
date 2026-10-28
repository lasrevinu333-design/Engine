import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createFeedbackOutbox} from '../mobile/src/custodial/feedback-outbox.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
function fixture(){
 const memory=new Map(),calls=[],identity={deviceId:'KIOSK_08',employeeId:randomUUID(),credentialId:randomUUID(),assignmentEpoch:7};
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 let available=true,generation=1,change=false;const rows=new Map();
 const options={storage,identity:async()=>identity,online:()=>true,mutate:async fn=>fn({generation,deviceId:identity.deviceId}),request:async(path,{body})=>{
  calls.push({path,body:structuredClone(body)});
  if(path==='/feedback-api/submit')rows.set(body.operation_id,body);
  if(!available||!rows.has(body.operation_id))throw Error('Original unavailable');
  const image=body.image_attachment;
  const content=hash(JSON.stringify([body.category||'other',body.priority||'normal',body.message.trim(),body.page_url||null,image?hash(Buffer.from(image.data_url.split(',')[1],'base64')):null]));
  if(change)generation++;
  return{ok:true,meta:{contract_version:'feedback.v3.enrolled-authority'},data:{item:{id:randomUUID(),operation_id:body.operation_id,binding:{schema:'employee-feedback-receipt.v1',device_id:identity.deviceId,employee_id:identity.employeeId,content_sha256:content}}}};
 }};
 return{memory,calls,rows,identity,box:createFeedbackOutbox(options),restart:()=>createFeedbackOutbox(options),unavailable:()=>{available=false;},change:()=>{change=true;}};
}
const body=()=>({operation_id:randomUUID(),category:'app_problem',priority:'normal',message:'Original ñ message'});
test('restart resolves protected backup through read-only original receipt, without recreating or resending',async()=>{
 const f=fixture(),b=body();await f.box.save(b);assert.deepEqual(await f.box.flush(),[b.operation_id]);const retained=[...f.memory];
 const restarted=f.restart();assert.equal((await restarted.readPending()).state,'pending');
 assert.deepEqual(await restarted.flush(),[b.operation_id]);assert.equal((await restarted.readPending()).state,'clear');
 assert.deepEqual(f.calls.map(c=>c.path),['/feedback-api/submit','/feedback-api/original-receipt']);assert.deepEqual([...f.memory],retained);
 assert.deepEqual(await restarted.flush(),[]);assert.equal(f.calls.length,2);
});
test('missing/purged or unavailable original stays pending; Retry Save cannot resurrect it',async()=>{
 const f=fixture(),b=body();await f.box.save(b);await f.box.flush();const retained=[...f.memory],restarted=f.restart();f.rows.clear();
 const pending=await restarted.readPending();await restarted.save(pending.body);assert.deepEqual(await restarted.flush(),[]);
 assert.equal((await restarted.readPending()).state,'pending');assert.deepEqual([...f.memory],retained);assert.equal(f.rows.size,0);assert.equal(f.calls.at(-1).path,'/feedback-api/original-receipt');
});
test('historical image stays byte-identical and current generation change cannot accept backup',async()=>{
 const f=fixture(),b={...body(),image_attachment:{name:'old.jpg',type:'image/jpeg',data_url:'data:image/jpeg;base64,/9j/AA=='}};
 await f.box.save(b);await f.box.flush();const retained=[...f.memory],restarted=f.restart();f.change();assert.deepEqual(await restarted.flush(),[]);assert.equal((await restarted.readPending()).state,'pending');assert.deepEqual([...f.memory],retained);
});
test('actual text-only page unlocks after read-only reconciliation on reload',async()=>{
 const f=fixture(),b=body();await f.box.save(b);await f.box.flush();f.box=f.restart();
 const html=readFileSync(new URL('../employee-feedback.html',import.meta.url),'utf8');assert.doesNotMatch(html,/<input[^>]+type="file"|capture="|createImageBitmap|canvas\.toDataURL|draft\.image/);
 const script=html.split('  <script>')[1].split('</script>')[0],els={},listeners={};
 for(const id of ['form','message','send','status'])els[id]={value:'new draft',addEventListener:(name,fn)=>{listeners[id+':'+name]=fn;},reset(){},querySelector:()=>({value:'need_help'})};els.form.elements=[els.message,els.send];
 const mobile={deviceId:()=>f.identity.deviceId,ready:Promise.resolve(),pendingEmployeeFeedback:()=>f.box.readPending(),saveEmployeeFeedback:b=>f.box.save(b),flushEmployeeFeedback:()=>f.box.flush()};
 vm.runInNewContext(script,{window:{MemphisMobile:mobile,addEventListener(){}},document:{getElementById:id=>els[id],addEventListener(){}},crypto:{randomUUID},Promise,Date,Math});
 for(let n=0;n<30;n++)await new Promise(setImmediate);
 assert.equal(els.send.textContent,'Send');assert.equal(els.message.disabled,false);assert.equal(els.status.textContent,'Saved in the program.');assert.equal(f.calls.at(-1).path,'/feedback-api/original-receipt');
});
