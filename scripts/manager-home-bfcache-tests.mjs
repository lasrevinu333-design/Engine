import assert from 'node:assert/strict';
import {test} from 'node:test';
import {managerHomeFixture} from './operations-dashboard-tests.mjs';
test('Manager Home keeps an unavailable session on this page instead of requesting another name and PIN',async()=>{
 const f=await managerHomeFixture({configure:f=>{f.setSession(null);f.auth.requireOpsManagerSession=async()=>{throw Object.assign(new Error('Manager access is temporarily unavailable. Reload to check your saved sign-in.'),{status:503,code:'MANAGER_SESSION_UNAVAILABLE'});};}});
 assert.equal(f.navigations.length,0);assert.match(f.node('hub-status').textContent,/temporarily unavailable/);
 assert.equal(f.node('manager-name').textContent,'');assert.equal(f.node('dashboard-link').href,undefined);assert.equal(f.liveTimers.size,0);
});
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

for(const mode of ['same','revoked','successor','old-response'])test('Manager Home overlapping BFCache '+mode,async()=>{
 const f=await managerHomeFixture({attendance:{attendance:0}}),original=f.session(),timers=f.liveTimers.size;
 let release,releaseOld;const response=new Promise(r=>release=r),old=new Promise(r=>releaseOld=r);let calls=0;
 f.auth.requireOpsManagerSession=async()=>{calls++;return mode==='old-response'&&calls===1?old:response;};
 f.emit('pagehide',{persisted:true});f.emit('pageshow',{persisted:true});await f.turn();
 f.emit('pagehide',{persisted:true});f.emit('pageshow',{persisted:true});await f.turn();
 const next=mode==='revoked'?null:{...original,...(mode==='successor'?{manager_id:'98000000-0000-4000-8000-000000000099'}:{})};
 f.setSession(next);release(next);await f.turn();await f.turn();
 if(mode==='old-response'){releaseOld({...original,manager_id:'98000000-0000-4000-8000-000000000099'});await f.turn();}
 if(mode==='same'||mode==='old-response'){assert.equal(f.node('manager-name').textContent,original.manager_display_name);assert.ok(f.node('dashboard-link').href);assert.equal(f.liveTimers.size,timers);}
 else{assert.equal(f.node('manager-name').textContent,'');assert.equal(f.node('dashboard-link').href,undefined);assert.equal(f.liveTimers.size,0);}
 f.emit('pagehide',{persisted:false});assert.equal(f.liveTimers.size,0);
});
