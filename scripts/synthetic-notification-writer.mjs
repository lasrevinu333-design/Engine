import assert from 'node:assert/strict';
// Synchronous mutation-callback DATA port for notification authority tests.
// It grants no native/storage authority and cannot outlive its callback.
export function syntheticNotificationWriter(status){
 return async(operation,options={})=>{
  const original=status();
  assert.equal(original.ready,true);assert.equal(original.available,true);assert.equal(original.quarantined,false);
  assert.ok(Number.isSafeInteger(original.generation)&&original.generation>0);
  assert.equal(original.deviceId,original.principal.device_id);
  if(options.expectedGeneration!=null)assert.equal(options.expectedGeneration,original.generation);
  const pin=JSON.stringify(original.principal),generation=original.generation,deviceId=original.deviceId;let open=true;
  const assertCurrent=()=>{assert.equal(open,true,'mutation callback already closed');const next=status();
   assert.equal(next.ready,true);assert.equal(next.available,true);assert.equal(next.quarantined,false);
   assert.equal(next.generation,generation);assert.equal(next.deviceId,deviceId);assert.equal(JSON.stringify(next.principal),pin);};
  try{assertCurrent();const result=await operation(Object.freeze({generation,deviceId,assertCurrent}));assertCurrent();return result;}
  finally{open=false;}
 };
}
