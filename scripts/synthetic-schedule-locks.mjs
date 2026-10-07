// Test-only FIFO Web Locks model shared by synthetic Home/VM Schedule realms.
// This is not evidence of browser-engine or Android WebView support.
import assert from 'node:assert/strict';
export function createSyntheticScheduleLocks(){
 const queues=new Map();
 return {request(name,options,work){
  assert.equal(options.mode,'exclusive');assert.equal(typeof name,'string');
  const previous=queues.get(name)||Promise.resolve();
  const result=previous.catch(()=>{}).then(()=>work({name,mode:'exclusive'}));
  const settled=result.catch(()=>{});queues.set(name,settled);
  settled.then(()=>{if(queues.get(name)===settled)queues.delete(name);});
  return result;
 },get pending(){return queues.size;}};
}
export const scheduleLocks=createSyntheticScheduleLocks();
if(!globalThis.navigator)Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:scheduleLocks});
