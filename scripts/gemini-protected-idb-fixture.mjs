// Synthetic test ports copied from owningOutboxCases; terminal driver never replays completed transactions.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import * as admissionModule from '../mobile/src/custodial/protected-browser-admission.js';
const copy=value=>structuredClone(value);
 function idbFixture(saved=[],serialized=false,options={}){
  const rows=new Map(saved.map(value=>[value.client_message_id,copy(value)])),transactions=[],counts={opens:0,closes:0,put:0,add:0,delete:0,upgrades:0};
  const opening=[];let exists=options.absent!==true;
  const indexedDB={databases:async()=>exists?[{name:'memphis-gemini-console',version:1}]:[],open(){counts.opens++;const request={};opening.push(request);let connectionClosed=false;
   request.result={version:1,objectStoreNames:Object.assign(['outbox'],{contains:name=>name==='outbox'}),createObjectStore(name){assert.equal(name,'outbox');counts.upgrades++;},close(){if(!connectionClosed){connectionClosed=true;counts.closes++;}},transaction(store,mode){
   assert.ok(store==='outbox'||Array.isArray(store)&&store.length===1&&store[0]==='outbox');let staged=new Map([...rows].map(([key,value])=>[key,copy(value)]));const requests=[];
   const tx={mode,requests,error:null,aborted:false,abort(){tx.aborted=true;queueMicrotask(()=>tx.onabort?.({target:tx}));},objectStore(){return {
    get:key=>queue('get',key),getAll:()=>queue('getAll'),openCursor:()=>queue('cursor',0),put:value=>queue('put',value),add:value=>queue('add',value),delete:key=>queue('delete',key)
   };}};
   function queue(op,arg){const r={op,arg,result:undefined,error:null};requests.push(r);return r;}
   tx.requestSuccess=(limit=Infinity)=>{
    // New competing-tab case schedules write transactions serially, as IDB
    // does for the same object store; acquire the committed snapshot at start.
    if(serialized&&!tx.started){staged=new Map([...rows].map(([key,value])=>[key,copy(value)]));tx.started=true;}
    let fired=0;
    for(let i=0;i<requests.length&&!tx.aborted&&fired<limit;i++){
     const r=requests[i];if(r.fired)continue;r.fired=true;
     fired++;
     if(r.op==='get')r.result=copy(staged.get(r.arg));
     else if(r.op==='getAll')r.result=[...staged.values()].map(copy);
     else if(r.op==='cursor'){const entry=[...staged.entries()][r.arg];r.result=entry?{primaryKey:entry[0],value:copy(entry[1]),continue(){r.arg++;r.fired=false;queueMicrotask(()=>tx.requestSuccess());}}:null;}
     else if(r.op==='delete'){counts.delete++;staged.delete(r.arg);}
     else {counts[r.op]++;staged.set(r.arg.client_message_id,copy(r.arg));r.result=r.arg.client_message_id;}
     r.onsuccess?.({target:r});
    }
   };
   tx.requestFailure=error=>{const r=requests[0];r.error=error;r.onerror?.({target:r});tx.onerror?.({target:r});};
   tx.commit=()=>{assert.equal(tx.aborted,false);if(mode==='readwrite'){rows.clear();for(const [key,value]of staged)rows.set(key,value);}tx.oncomplete?.({target:tx});};
   tx.fail=error=>{tx.error=error;tx.aborted=true;tx.onabort?.({target:tx});};
   transactions.push(tx);return tx;
  }};
   request.release=()=>{if(request.released)return;request.released=true;
    if(!exists){request.transaction={abort(){request.aborted=true;queueMicrotask(()=>{request.error=Object.assign(Error('upgrade aborted'),{name:'AbortError'});request.onerror?.();});}};
     request.onupgradeneeded?.();if(request.aborted)return;exists=true;}
    request.onsuccess?.();
   };
   queueMicrotask(()=>options.blockOpen?request.onblocked?.():request.release());return request;}};
  return {indexedDB,rows,transactions,counts,opening,setExists:value=>{exists=value;},get exists(){return exists;}};

 }
 function browserFixture(){
  class Area{
   constructor(){this.rows=new Map();}
   getItem(key){return this.rows.get(key)??null;}
   setItem(key,value){this.rows.set(key,String(value));}
   removeItem(key){this.rows.delete(key);}
   clear(){this.rows.clear();}
   key(index){return [...this.rows.keys()][index]??null;}
   get length(){return this.rows.size;}
  }
  const local=new Area(),session=new Area(),queue=[];let active=false;
  const pump=()=>{if(active||!queue.length)return;const item=queue.shift();if(item.aborted){pump();return;}
   active=true;item.entered=true;item.signal.removeEventListener('abort',item.abort);
   Promise.resolve().then(()=>item.work({name:item.name,mode:'exclusive'})).then(item.resolve,item.reject).finally(()=>{active=false;pump();});
  };
  const locks={request(name,{mode,signal},work){
   assert.equal(name,admissionModule.PROTECTED_BROWSER_LOCK);assert.equal(mode,'exclusive');
   return new Promise((resolve,reject)=>{const item={name,signal,work,resolve,reject};
    item.abort=()=>{if(item.entered)return;item.aborted=true;reject(Object.assign(Error('lock wait aborted'),{name:'AbortError'}));};
    if(signal.aborted){item.abort();return;}signal.addEventListener('abort',item.abort,{once:true});queue.push(item);pump();});
   },get active(){return active;},get pending(){return queue.filter(item=>!item.aborted).length;}};
  return {local,session,locks};
 }
export {idbFixture,browserFixture};
export async function drive(promise,f){let done=false,value,error;promise.then(v=>{done=true;value=v},e=>{done=true;error=e});let cursor=0;for(let n=0;n<800&&!done;n++){await new Promise(setImmediate);while(cursor<f.transactions.length){const tx=f.transactions[cursor++];if(tx.fixtureDone||tx.fixtureDriving)continue;tx.fixtureDriving=true;tx.requestSuccess();await new Promise(setImmediate);if(!tx.aborted)tx.commit();tx.fixtureDone=true;}}if(!done)throw Error('fixture promise never settled');if(error)throw error;return value;}
