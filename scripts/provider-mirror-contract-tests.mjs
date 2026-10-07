import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {providerMirrorBytePins,withoutProviderMirror} from './provider-mirror-source-boundary.mjs';
import {withoutProviderMaintenance} from './provider-maintenance-source-boundary.mjs';
import {withoutProviderEventDecisions} from './provider-event-decisions-source-boundary.mjs';
import {createProviderMirror} from '../mobile/src/custodial/provider-mirror.js';
import {createNativeProviderMirrorBridge} from '../mobile/src/custodial/provider-mirror-bridge.js';
import {CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS} from '../mobile/scripts/verify-custodial-dex-semantics.mjs';
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const sha=value=>createHash('sha256').update(value).digest('hex');
for(const row of providerMirrorBytePins){
 const source=withoutProviderMaintenance(row.name,readFileSync(row.path,'utf8'));check(sha(source),row.current_sha256,'exact owned mirror source '+row.name);
 if(row.origin){check(sha(withoutProviderMirror(row.name,source)),row.base_sha256,'exact full preserved baseline '+row.name);
  assert.throws(()=>withoutProviderMirror(row.name,source+'\n// mutation'));checks++;}
}
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read=name=>readFileSync(dir+name,'utf8');
for(const [name,hash] of Object.entries({
 'VaultEngine.java':'4b9c70608bcbd98fd5c26668f1202cf7fd8014c96c5319bba00f7c1cca8c72d5',
 'OfflineAuthorityTime.java':'0ae5be7fa6c106a900a81bcf75c30c8ae87332da248fb6dd9bc9dc36b534f407',
 'NativeNfcScanHandoff.java':'674d7abe36779a7341e16f63588b6452596db23348397287a991f1138991aa77',
}))check(sha(withoutProviderEventDecisions(name,read(name))),hash,'unchanged whole protected source outside exact F6 delta '+name);
check(sha(readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml')),'5714fc43190e46dfe043749b8a5b9bf2903bed60cd2bc86ef2077875248c854a','manifest remains unactivated');
const plugin=read('CustodialNativeVaultPlugin.java'),runtime=read('CustodialNativeRuntime.java');
check([...plugin.matchAll(/@PluginMethod\s+public void (\w+)\s*\(/g)].map(m=>m[1]).sort(),CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,'exact additive native method allowlist');
check(CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS.length,36,'29 original plus seven finite methods');
for(const type of ['NativeProviderIngressRuntime','NativeProviderComponentRuntime']){assert.match(runtime,new RegExp('return '+type+'\\.SUSPENDED;'));checks++;}
assert.match(runtime,/new NativeProviderRuntimeOwner.Delivery\(NativeProviderTime.Profiles.NONE,/);checks++;
check(readdirSync(dir).filter(n=>n.endsWith('.java')).filter(n=>/new NativeProviderTime.Profile\(/.test(read(n))),[],'no arbitrary qualification added');
const hint=plugin.slice(plugin.indexOf('    private void providerHint('),plugin.indexOf('    @PluginMethod public void providerMirrorAttach'));
assert.match(hint,/\.post\(\(\)->/);assert.match(hint,/if\(providerHintPosted\)return/);checks+=2;
assert.doesNotMatch(hint,/payload|principal|content_sha|token_digest/);checks++;
const javaRevision=read('NativeProviderJournal.java').match(/long presentationRevision\(\)[^\n]+/)?.[0];
check(javaRevision,'long presentationRevision() throws VaultFailure { return transition(() -> store.load().revision); }','hint revision reads only the same journal');
const mirror=readFileSync('mobile/src/custodial/provider-mirror.js','utf8');
assert.match(mirror,/count<8/);assert.match(mirror,/,60000\)/);assert.doesNotMatch(mirror,/localStorage|fetch\(|Date\.now|speechSynthesis|\.play\(/);checks+=3;

// Execute actual shared bridge construction, not a reimplementation. Native
// callbacks/time are synthetic; the actual facade and coordinator are used.
const bridgeSource=readFileSync('mobile/src/custodial/bridge.js','utf8');
const from=bridgeSource.indexOf('  // Provider mirror is shared'),to=bridgeSource.indexOf('  const rawFetch',from);
assert.ok(from>=0&&to>from);checks++;
const events=new Map(),listeners=new Map(),timers=new Map(),calls=[];let serial=0,ready=false,options;
const add=(name,fn)=>{const rows=events.get(name)||[];rows.push(fn);events.set(name,rows);};
const emit=async(name,arg)=>{for(const fn of events.get(name)||[])fn(arg);await new Promise(resolve=>setImmediate(resolve));};
const id=n=>`77000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const api={
 async addListener(name,fn){calls.push('subscribe');const key=++serial;listeners.set(key,fn);return{remove:async()=>{calls.push('remove');listeners.delete(key);}};},
 async providerMirrorAttach(){calls.push('attach');return{schema:'custodial.provider-mirror-attachment.v1',attachment_id:id(++serial),runtime_incarnation:id(999),revision:'9',state:'ATTACHED',audio_ready:false};},
 async providerMirrorStopped(){calls.push('stopped');return{stopped:true};},
 async providerClaimNext(){calls.push('next');return{claim:null};},
 async providerMirrorDetach(){calls.push('detach');return{detached:true};},
};
const context={nativeVault:true,URL,document:{hidden:false,addEventListener:add},window:{location:{href:'https://localhost/employee-schedule.html?hub=employee'},addEventListener:add},
 security:{getStatus:()=>({ready})},App:{addListener:add},getNativeProviderMirrorBridge:()=>createNativeProviderMirrorBridge(api),
 createProviderMirror:value=>{options=value;return createProviderMirror({...value,repeat:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearRepeat:id=>timers.delete(id)});}};
vm.createContext(context);vm.runInContext(bridgeSource.slice(from,to),context);
const controller=vm.runInContext('providerMirror',context);controller.setRenderer({show:()=>true,stopAndReadback:async()=>true});
await new Promise(resolve=>setImmediate(resolve));check(calls,[],'not-current shared startup creates no native/effect access');
ready=true;await emit('online');await controller.reconcile();check(calls.slice(0,4),['subscribe','attach','stopped','next'],'real shared wiring subscribes before snapshot and pull');
check([...timers.values()].map(x=>x.ms),[60000],'actual shared binding installs bounded visible repair');
check(options.locationMatches('employee-schedule.html?hub=employee'),true,'same exact native route readback');
check(options.locationMatches('employee-schedule.html?hub=employee&device=KIOSK_08'),false,'extra query does not fabricate native destination');
context.document.hidden=true;await emit('visibilitychange');check(listeners.size,0,'actual visibility event removes observer');check(timers.size,0,'hidden timer removed');
context.document.hidden=false;await emit('visibilitychange');check(listeners.size,1,'resume installs only one observer');
await emit('appStateChange',{isActive:false});check(listeners.size,0,'native app pause retires binding');
await emit('appStateChange',{isActive:true});check(listeners.size,1,'native app resume reattaches');
ready=false;await emit('memphis:custodial-security-state');check(listeners.size,0,'principal loss retires listener before reuse');
await controller.destroy();
for(const name of ['provider-composition-contract-tests.mjs','native-readiness-observation-tests.mjs']){
 const output=execFileSync(process.execPath,['scripts/'+name],{encoding:'utf8',env:{...process.env,PATH:''},maxBuffer:1024*1024});assert.match(output,/PASS/);checks++;
}
console.log(JSON.stringify({status:'PROVIDER_MIRROR_SOURCE_CONTRACT_PASS',checks,base:'4ad46ff75444ab30e1efea06fdb3d9a514851de1',qualified:false,factories:'SUSPENDED',finiteExports:7}));
