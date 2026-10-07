import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const method=source.match(/  async function getReadinessObservation\([^]*?\n  \}/)?.[0];
assert.ok(method);
let generation=1, identity='original-principal', device='KIOSK_08', native=true, release, requests=[];
const state={observation:'CONFIRMED'};
const context={bridgeReady:Promise.resolve(),security:{getStatus:()=>({generation})},
 deviceId:()=>device,currentPrincipalIdentity:()=>identity,
 getNativeCustodialReadinessObservation:async(...args)=>{requests.push(args);return new Promise(resolve=>{release=()=>resolve(state);});}};
Object.defineProperty(context,'nativeVault',{get:()=>native});
vm.createContext(context);vm.runInContext(method,context);
let checks=0;
async function started(){release=null;const work=context.getReadinessObservation('KIOSK_08');await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof release,'function');return {work};}
{
 const {work}=await started();release();assert.equal(await work,state);checks++;
 assert.deepEqual(requests[0],['KIOSK_08','original-principal']);checks++;
}
for(const change of [()=>generation++,()=>identity='replacement-principal',()=>device='KIOSK_09']){
 generation=1;identity='original-principal';device='KIOSK_08';const {work}=await started();change();release();
 await assert.rejects(work,/authority changed/);checks++;
}
generation=1;identity='original-principal';device='KIOSK_08';
for(const change of [()=>generation=undefined,()=>identity='',()=>native=false]){
 generation=1;identity='original-principal';native=true;change();const before=requests.length;
 await assert.rejects(context.getReadinessObservation('KIOSK_08'),/unavailable/);assert.equal(requests.length,before);checks++;
}
assert.doesNotMatch(method,/authorize|recover|mutateProtected|setItem|getOfflineAuthorityState|waitForStableState/);checks++;
assert.match(source,/getNativeCustodialReadinessObservation,[^]*from '\.\/native-security.js'/);checks++;
assert.match(source,/window.MemphisMobile = Object.freeze\([^]*getReadinessObservation,/);checks++;
console.log(JSON.stringify({scope:'actual bridge observation method with synthetic native transport and generation/principal races',checks}));
