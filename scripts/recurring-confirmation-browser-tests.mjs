import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../memphis-recurring-confirmation.js',import.meta.url),'utf8');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const request={effectiveStart:'2026-09-28',expectedRevision:42,previewDigest:'a'.repeat(64),sourceDigest:'b'.repeat(64)};
let checks=0;
const same=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const data=new Map(),calls=[],queues=new Map();let accepted=null,loseReply=false,failure=null,count=0;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>data.delete(k)};
 const locks={request(name,options,work){assert.equal(options.mode,'exclusive');const previous=queues.get(name)||Promise.resolve();
  const result=previous.catch(()=>{}).then(work);queues.set(name,result);return result;}};
 const context=vm.createContext({console,navigator:{locks},localStorage:storage});vm.runInContext(source,context);
 const makeReceipt=body=>({state:'ACCEPTED',operationId:id(3),receipt:{schema:'static-weekly.recurring-confirmation-receipt.v1',
  operationId:id(3),managerId:id(1),confirmationKey:body.confirmation_key,previewDigest:body.preview_digest,
  effectiveStart:body.effective_start,sourceDigest:request.sourceDigest,sourceId:id(4),publicationId:id(5),projectionId:id(6),
  requestDigest:'c'.repeat(64),lunchDocumentIdentity:'d'.repeat(64),authorityRevision:45,accepted:true,phoneDeliveryState:'PENDING',affectedPhonesUpdated:false}});
 const api=async(path,options)=>{
  calls.push({path,...options});if(failure)throw failure;
  same(options.expectedManagerId,id(1),'every write and locking status read binds original manager session');
  if(options?.method==='POST'){
   const body=JSON.parse(options.body);same(data.size,1,'record durable before mutation');
   accepted=makeReceipt(body);count++;
   if(loseReply)throw new Error('response lost after commit');return plain(accepted);
  }
  return accepted?plain(accepted):{state:'NOT_FOUND',confirmationKey:path.split('/').at(-1)};
 };
 const make=overrides=>context.MemphisRecurringConfirmation.create({api,managerId:id(1),storage,locks,newUuid:()=>id(2),...overrides});
 return {make,storage,data,calls,api,locks,get count(){return count;},get accepted(){return accepted;},set loseReply(v){loseReply=v;},set failure(v){failure=v;}};
}
{
 const f=fixture(),c=f.make();const result=await c.confirm(request);
 same(result.receipt.affectedPhonesUpdated,false,'acceptance does not claim phones');
 same(c.hasPending(),true,'receipt kept until current readback');
 same(f.calls[0].body,JSON.stringify({confirmation_key:id(2),effective_start:request.effectiveStart,expected_revision:42,preview_digest:request.previewDigest,full_nine_source_id:null}),'only exact selectors sent');
 const restored=await f.make().recover();same(plain(restored),plain(result),'restart resolves exact original acceptance');
 same(f.calls[1].path,'/static-weekly/recurring-adaptation/confirmations/'+id(2),'exact-key status route');
 await c.acknowledgeReadback(id(3));same(c.hasPending(),false,'local recovery ends only after explicit readback');
 same(f.count,1,'readback never republishes');
}
{
 const f=fixture();f.loseReply=true;await assert.rejects(()=>f.make().confirm(request),/lost after commit/);checks++;
 const result=await f.make().retry();same(result.state,'ACCEPTED','lost commit response recovered');same(f.count,1,'exact accepted retry never sends twice');
}
{
 const f=fixture();f.failure=new Error('offline');await assert.rejects(()=>f.make().confirm(request),/offline/);checks++;
 same(f.make().hasPending(),true,'offline journal retained');f.failure=null;
 same((await f.make().recover()).state,'NOT_FOUND','locking status distinct from offline');same(f.count,0,'recover does not implicitly confirm');
 const first=f.calls[0].body;await f.make().retry();same(f.calls.at(-1).body,first,'retry exact original bytes/key');
}
{
 const f=fixture();f.failure=new Error('offline');await assert.rejects(()=>f.make().confirm(request),/offline/);f.failure=null;
 same((await f.make().discardUnaccepted()).state,'DISCARDED_NOT_FOUND','discard requires real exact not found');same(f.data.size,0,'only own recovery discarded');
}
{
 const f=fixture();await f.make().confirm(request);same((await f.make().discardUnaccepted()).state,'ACCEPTED','discard cannot erase accepted recovery');same(f.data.size,1,'accepted record remains');
 await assert.rejects(()=>f.make().acknowledgeReadback(id(999)),/Exact accepted/);checks++;
}
{
 const f=fixture(),a=f.make(),b=f.make();const results=await Promise.allSettled([a.confirm(request),b.confirm(request)]);
 same(results.map(x=>x.status),['fulfilled','rejected'],'cross-tab exclusive same-manager confirmation');same(f.count,1,'concurrent double click publishes once');
}
{
 const f=fixture();f.storage.setItem=()=>{throw new Error('storage denied');};
 await assert.rejects(()=>f.make().confirm(request),/storage denied/);same(f.calls.length,0,'no write when durable save fails');
}
{
 const f=fixture();f.storage.setItem=()=>{};
 await assert.rejects(()=>f.make().confirm(request),/readback failed/);same(f.calls.length,0,'no write when persistence silently fails');
}
{
 const f=fixture();assert.throws(()=>f.make({locks:{}}).confirm(request),/coordinate/);same(f.calls.length,0,'no silent unsafe lock fallback');
}
for(const mutation of [r=>r.receipt.managerId=id(900),r=>r.receipt.previewDigest='e'.repeat(64),r=>r.receipt.sourceDigest='f'.repeat(64),
 r=>r.receipt.effectiveStart='2026-10-05',r=>r.receipt.affectedPhonesUpdated=true,r=>r.receipt.phoneDeliveryState='DELIVERED',
 r=>r.receipt.authorityRevision=42,r=>r.receipt.publicationId=[id(5)]]){
 const f=fixture();const c=f.make({api:async(...args)=>{const r=await f.api(...args);mutation(r);return r;}});
 await assert.rejects(()=>c.confirm(request),/receipt could not be verified/);checks++;same(c.hasPending(),true,'invalid receipt never clears recovery');
}
{
 const f=fixture();await f.make().confirm(request);const key=[...f.data.keys()][0],r=JSON.parse(f.data.get(key));r.body.preview_digest='e'.repeat(64);f.data.set(key,JSON.stringify(r));
 assert.throws(()=>f.make().hasPending(),/bytes changed/);checks++;
}
console.log(JSON.stringify({status:'PASS',checks,scope:'durable browser coordinator synthetic storage/lock/API; no live manager, SQL or phone proof'}));
