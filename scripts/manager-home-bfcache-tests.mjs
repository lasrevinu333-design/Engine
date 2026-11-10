import assert from 'node:assert/strict';
import {test} from 'node:test';
import {managerHomeFixture} from './operations-dashboard-tests.mjs';
for(const mode of ['same','renewed','revoked','successor','failure'])test('Manager Home BFCache '+mode,async()=>{
 const f=await managerHomeFixture({attendance:{attendance:0}}),initialTimers=f.liveTimers.size;
 const original=f.session();let renewals=0;
 f.auth.requireOpsManagerSession=async options=>{
  assert.equal(options.forceRefresh,true);assert.equal(options.interactive,false);renewals++;
  if(mode==='failure')throw Error('Synthetic revalidation unavailable');
  if(mode==='revoked'){f.setSession(null);return null;}
  const next={...original,token:mode==='renewed'?'SYNTHETIC_RENEWED':original.token,
    ...(mode==='successor'?{manager_id:'98000000-0000-4000-8000-000000000099'}:{})};
  f.setSession(next);return next;
 };
 for(let i=0;i<(mode==='same'||mode==='renewed'?3:1);i++){
  f.emit('pagehide',{persisted:true});assert.equal(f.liveTimers.size,0);assert.equal(f.node('dashboard-link').hidden,true);
  assert.equal(f.node('dashboard-link').href,undefined);
  f.emit('pageshow',{persisted:true});await f.turn();await f.turn();
  if(mode==='same'||mode==='renewed'){
   assert.equal(f.node('manager-name').textContent,original.manager_display_name);assert.ok(f.node('dashboard-link').href);
   assert.equal(f.liveTimers.size,initialTimers);assert.equal(renewals,i+1);
   f.emit('pageshow',{persisted:true});await f.turn();assert.equal(renewals,i+1);assert.equal(f.liveTimers.size,initialTimers);
  }else{assert.equal(f.node('dashboard-link').href,undefined);assert.equal(f.node('manager-name').textContent,'');assert.equal(f.liveTimers.size,0);}
 }
 f.emit('pagehide',{persisted:false});assert.equal(f.liveTimers.size,0);
 f.emit('pageshow',{persisted:true});await f.turn();assert.equal(f.liveTimers.size,0);
});
