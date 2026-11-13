import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file='app.js';
const candidate=readFileSync(new URL('../../mobile/src/custodial/'+file,import.meta.url),'utf8');
const baseline=readFileSync(new URL('./baseline-app.js',import.meta.url),'utf8');
function harness(source){
 const names=['phoneUnlockedSinceWake','setPhoneUnlocked','showPhoneLock','hidePhoneLock','unlockPhone','relockPhone','showCachedPhoneIdentity','showHome'];
 const funcs=names.map(name=>{const start=source.indexOf('function '+name+'(');assert.ok(start>=0);const rest=source.slice(start);const end=rest.indexOf('\nfunction ',1);return end<0?rest:rest.slice(0,end);});
 const state=new Map([['mz_custodial_phone_unlocked_since_wake_v1','1']]);
 const context={els:{phoneLock:{hidden:true},home:{}},profile:{employee_name:'Synthetic'},phoneLockClockTimer:0,savedWorkConnectionOwner:null,
  sessionStorage:{getItem:k=>state.get(k),setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)},window:{setInterval:()=>1},
  setEmployeeIdentity:()=>true,updatePhoneLockClock(){},invalidateReadiness(){},cachedProfile:()=>({employee_name:'Synthetic'}),employeeName:()=> 'Synthetic',currentProfile:()=>true,clearRestoreRetry(){},showOnly(){}};
 vm.createContext(context);vm.runInContext("const PHONE_UNLOCKED_KEY='mz_custodial_phone_unlocked_since_wake_v1';let phoneUnlockedByTap=false;\n"+funcs.join('\n'),context);return context;
}
const old=harness(baseline);old.showCachedPhoneIdentity();assert.equal(old.els.phoneLock.hidden,false);old.showHome();assert.equal(old.els.phoneLock.hidden,true,'reproduces stale session auto-hide');
const fresh=harness(candidate);fresh.showCachedPhoneIdentity();fresh.showHome();assert.equal(fresh.els.phoneLock.hidden,false,'old persisted flag cannot unlock');
fresh.unlockPhone();assert.equal(fresh.els.phoneLock.hidden,true);fresh.showHome();assert.equal(fresh.els.phoneLock.hidden,true,'same tap survives home paint');
fresh.showCachedPhoneIdentity();fresh.showHome();assert.equal(fresh.els.phoneLock.hidden,false,'background restore displayed lock stays locked');
fresh.unlockPhone();fresh.relockPhone();fresh.showHome();assert.equal(fresh.els.phoneLock.hidden,false,'pause/resume relock persists');
for(let i=0;i<10;i++){fresh.showHome();assert.equal(fresh.els.phoneLock.hidden,false);}
assert.ok(candidate.includes("els.phoneUnlock.addEventListener('click', unlockPhone)"));
assert.equal((candidate.match(/setPhoneUnlocked\(true\)/g)||[]).length,1,'only explicit unlock owner grants');
console.log('PASS baseline stale-session reproduction and candidate explicit-tap/reload/restore/relock regressions; synthetic presentation only');
