import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createManagerFeedbackSubmitter} from '../manager-feedback-submit.mjs';
function fixture(){
 const data=new Map(),calls=[],who={role:'ops_manager',access_level:'full_access',read_only:false,manager_id:randomUUID(),credential_id:randomUUID(),device_id:'manager-fixture'};
 let lose=true,blocked=false,hook=()=>{};const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('Storage unavailable');data.set(k,v);},removeItem:k=>data.delete(k)};
 let lane=Promise.resolve();const locks={request(_name,_opts,fn){const next=lane.then(fn);lane=next.catch(()=>{});return next;}};
 const options={storage,locks,current:async()=>who,uuid:randomUUID,send:async(raw,id)=>{calls.push({raw,id});hook();if(lose)throw Error('Response lost');return{ok:true,data:{item:{id:randomUUID(),operation_id:id}}};}};
 return{data,calls,who,create:()=>createManagerFeedbackSubmitter(options),allow:()=>{lose=false;},block:()=>{blocked=true;},hook:fn=>{hook=fn;}};
}
test('lost response then reload/edit retries identical saved body and operation',async()=>{
 const f=fixture();await assert.rejects(()=>f.create().submit({message:'Original ñ\nmessage',category:'other',priority:'normal'}));
 const raw=[...f.data.values()][0];f.allow();await f.create().submit({message:'different edited content'});
 assert.equal(f.calls[0].raw,f.calls[1].raw);assert.equal(f.calls[0].id,f.calls[1].id);assert.equal(JSON.parse(raw).body.message,'Original ñ\nmessage');assert.equal(f.data.size,0);
});
test('changed current manager or credential cannot send a retained original',async()=>{
 const f=fixture();await assert.rejects(()=>f.create().submit({message:'Original'}));const raw=[...f.data.values()][0];f.who.credential_id=randomUUID();f.allow();
 await assert.rejects(()=>f.create().submit({message:'changed'}));assert.equal(f.calls.length,1);assert.equal([...f.data.values()][0],raw);
});
test('storage failure sends nothing and retry keeps the original in memory',async()=>{
 const f=fixture();f.block();const sender=f.create();await assert.rejects(()=>sender.submit({message:'Original'}));await assert.rejects(()=>sender.submit({message:'edited'}));assert.equal(f.calls.length,0);assert.equal(sender.hasPending(),true);
});
test('authority changes during response or corrupt stored original preserve DATA',async()=>{
 const f=fixture();f.allow();f.hook(()=>{f.who.credential_id=randomUUID();});await assert.rejects(()=>f.create().submit({message:'Original'}));assert.equal(f.data.size,1);
 const [key]=f.data.keys();f.data.set(key,'bad');await assert.rejects(()=>f.create().submit({message:'new'}));assert.equal(f.data.get(key),'bad');assert.equal(f.calls.length,1);
});
test('concurrent submit calls share one in-flight original',async()=>{
 const f=fixture();f.allow();const sender=f.create(),a=sender.submit({message:'first'}),b=sender.submit({message:'second'});assert.equal(a,b);await a;assert.equal(f.calls.length,1);assert.equal(JSON.parse(f.calls[0].raw).message,'first');
});

test('separate producer instances serialize durable storage and retain failed original',async()=>{
 const f=fixture(),a=f.create(),b=f.create();await Promise.allSettled([a.submit({message:'first'}),b.submit({message:'second'})]);assert.equal(f.calls.length,2);assert.equal(f.calls[0].raw,f.calls[1].raw);assert.equal(f.data.size,1);
});
test('missing exclusive owner refuses before storage or network mutation',async()=>{
 let touched=false;const s=createManagerFeedbackSubmitter({locks:null,storage:{setItem(){touched=true;}},current:async()=>{touched=true;},send:async()=>{touched=true;}});await assert.rejects(()=>s.submit({message:'original'}));assert.equal(touched,false);
});

test('a stale tab cannot recreate an original retired by another producer',async()=>{
 const f=fixture(),a=f.create();await assert.rejects(()=>a.submit({message:'original'}));f.allow();await f.create().submit({message:'ignored edit'});assert.equal(f.data.size,0);await assert.rejects(()=>a.submit({message:'new edit'}));assert.equal(f.calls.length,2);assert.equal(f.data.size,0);
});


test('read-only recovery returns a clone for the same actor without sending or changing original bytes',async()=>{
 const f=fixture();await assert.rejects(()=>f.create().submit({message:'Original',category:'need_help',priority:'urgent'}));
 const raw=[...f.data.values()][0],sender=f.create(),draft=await sender.readPending();
 assert.equal(draft.message,'Original');draft.message='Attempted mutation';
 assert.equal((await sender.readPending()).message,'Original');assert.equal([...f.data.values()][0],raw);assert.equal(f.calls.length,1);
 f.allow();const accepted=await sender.submit({message:'Later edit',category:'other',priority:'normal'});
 assert.deepEqual(accepted.submittedDraft,{message:'Original',category:'need_help',priority:'urgent'});assert.equal(f.calls[0].raw,f.calls[1].raw);
});
test('read-only recovery refuses earlier actor, corrupt original and disappeared retained data',async()=>{
 const f=fixture();await assert.rejects(()=>f.create().submit({message:'Original'}));const sender=f.create();await sender.readPending();
 const raw=[...f.data.values()][0],credential=f.who.credential_id;f.who.credential_id=randomUUID();
 await assert.rejects(()=>sender.readPending(),/earlier sign-in/);assert.equal([...f.data.values()][0],raw);f.who.credential_id=credential;
 f.data.clear();await assert.rejects(()=>sender.readPending(),/changed in another tab/);assert.equal(f.calls.length,1);
 f.data.set('custodial.manager-feedback-original.v1','{broken');await assert.rejects(()=>f.create().readPending(),/needs review/);
});
test('recovery rechecks storage after awaited authority without exposing replaced original',async()=>{
 const f=fixture();await assert.rejects(()=>f.create().submit({message:'Original'}));
 let release;const gate=new Promise(r=>{release=r;});
 const sender=createManagerFeedbackSubmitter({storage:{getItem:k=>f.data.get(k)??null},current:async()=>{await gate;return f.who;},send:async()=>assert.fail('read-only recovery must not submit'),locks:{request:async(_k,_o,fn)=>fn()}});
 const pending=sender.readPending();await Promise.resolve();f.data.set('custodial.manager-feedback-original.v1','{changed');release();
 await assert.rejects(()=>pending,/changed in another tab/);assert.equal(f.calls.length,1);
});
test('no original read is inert and absence cannot recreate retired feedback',async()=>{
 const f=fixture(),sender=f.create();assert.equal(await sender.readPending(),null);assert.equal(f.data.size,0);assert.equal(f.calls.length,0);
 await assert.rejects(()=>sender.submit({message:'Original'}));f.allow();await f.create().submit({message:'Ignored'});
 await assert.rejects(()=>sender.readPending(),/changed in another tab/);assert.equal(f.calls.length,2);assert.equal(f.data.size,0);
});
