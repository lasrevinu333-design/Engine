import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

// Root regression: execute the actual foreground queue and pending-job methods
// with controlled lifecycle/native state and the unchanged real job coalescer.
// No application/Gradle/APK build, Android process, token or provider request.
const base=new URL('../plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/',import.meta.url);
const source=name=>readFileSync(new URL(name+'.java',base),'utf8');
function method(text,needle){
 const start=text.indexOf(needle);if(start<0)return null;
 let end=text.indexOf('{',start),depth=1;
 while(depth&&++end<text.length){if(text[end]==='{')depth++;if(text[end]==='}')depth--;}
 assert.equal(depth,0,needle);return text.slice(start,end+1);
}
const plugin=source('CustodialNativeVaultPlugin'),runtime=source('CustodialNativeRuntime'),owner=source('NativeProviderRuntimeOwner');
const queue=method(plugin,'private void queueProviderRecovery()');assert.ok(queue);
const current=method(plugin,'private boolean providerLifecycleCurrent(');assert.ok(current);
const epoch=method(plugin,'Object currentProviderAttachmentEpoch(');assert.ok(epoch);
const wake=method(runtime,'void requestPendingProviderWork(')
 || 'void requestPendingProviderWork(CustodialNativeVaultPlugin p,Object epoch)throws VaultFailure { throw new AssertionError("pending foreground wake owner absent"); }';
const pending=method(owner,'void requestPendingWork(')
 || 'void requestPendingWork()throws VaultFailure { throw new AssertionError("pending job wake absent"); }';
const schedule=source('NativeProviderJobSchedule').replace(/^package [^;]+;/m,'');
assert.match(plugin,/providerForegroundEpoch\.set\(new Object\(\)\);queueProviderRecovery\(\)/);
const java=`import java.util.*;
import java.util.concurrent.atomic.*;
class VaultFailure extends Exception { final String code;VaultFailure(String code){super(code);this.code=code;} }
class NativeProviderMirrorAttachment {static VaultFailure invalid(){return new VaultFailure("stale attachment");}}
class NativeProviderJobLifecycle {enum Result {DRAINED,RETRY,SUSPEND}}
${schedule}
class Jobs implements NativeProviderJobSchedule.SystemJobs {
 NativeProviderJobSchedule.Existing state=NativeProviderJobSchedule.Existing.ABSENT;
 int inspected,scheduled;boolean accept=true;
 public NativeProviderJobSchedule.Existing existing(){inspected++;return state;}
 public boolean schedule(){scheduled++;if(accept)state=NativeProviderJobSchedule.Existing.EXACT;return accept;}
}
class NativeProviderRuntimeOwner {
 static class Delivery {final Jobs jobs;Delivery(Jobs jobs){this.jobs=jobs;}}
 Delivery delivery;NativeProviderJobLifecycle.Result result=NativeProviderJobLifecycle.Result.RETRY;
 final CustodialNativeRuntime runtime;int pendingReads;
 NativeProviderRuntimeOwner(CustodialNativeRuntime r,Jobs jobs){runtime=r;delivery=new Delivery(jobs);}
 NativeProviderJobLifecycle.Result pendingWork(){
  ForegroundWakeProbe.check(!Thread.holdsLock(runtime.engine)&&!Thread.holdsLock(runtime.providerCoordinator),"job classification leaves runtime monitors");
  pendingReads++;return result;
 }
 ${pending}
}
class CustodialNativeRuntime {
 final Object engine=new Object(),providerCoordinator=new Object();
 NativeProviderRuntimeOwner localProviderOwner;int recoveries,attachments;boolean failRecovery;Runnable afterAttach;
 void recoverPendingPrivateCustodyOwnerIfPresent()throws VaultFailure {recoveries++;if(failRecovery)throw new VaultFailure("existing preservation hold");}
 void attachProviderLocal(CustodialNativeVaultPlugin p,Object e)throws VaultFailure {if(currentProviderAttachmentEpoch(p)!=e)throw NativeProviderMirrorAttachment.invalid();attachments++;if(afterAttach!=null)afterAttach.run();}
 Object currentProviderAttachmentEpoch(CustodialNativeVaultPlugin p)throws VaultFailure {return p.currentProviderAttachmentEpoch(this);}
 ${wake}
}
class BasePlugin {final ArrayDeque<Runnable> tasks=new ArrayDeque<>();protected void execute(Runnable work){tasks.add(work);}}
class Log {static int warnings;static void w(String tag,String message){warnings++;}}
class CustodialNativeVaultPlugin extends BasePlugin {
 CustodialNativeRuntime applicationRuntime;boolean originalBrowserOwnerRetired;Object startupRefusal;
 final AtomicReference<Object> providerForegroundEpoch=new AtomicReference<>();final AtomicBoolean providerRecoveryQueued=new AtomicBoolean();
 static final String LOG_TAG="fixture";
 ${epoch}
 ${current}
 ${queue}
 void resume(){providerForegroundEpoch.set(new Object());queueProviderRecovery();}
 void drain(){int n=0;while(!tasks.isEmpty()){ForegroundWakeProbe.check(++n<5,"finite owned queue");tasks.remove().run();}}
}
public class ForegroundWakeProbe {
 static int assertions,cases;
 static void check(boolean yes,String why){assertions++;if(!yes)throw new AssertionError(why);}
 static class F {
  final Jobs jobs=new Jobs();final CustodialNativeRuntime runtime=new CustodialNativeRuntime();
  final CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();
  F(){runtime.localProviderOwner=new NativeProviderRuntimeOwner(runtime,jobs);plugin.applicationRuntime=runtime;}
  void resume(){plugin.resume();plugin.drain();check(!plugin.providerRecoveryQueued.get(),"queue ownership released");check(plugin.tasks.isEmpty(),"no orphan callback");}
 }
 public static void main(String[] ignored)throws Exception {
  F first=new F();first.resume();check(first.jobs.scheduled==1,"cached-token startup must arm the original pending registration job");
  check(first.runtime.attachments==1&&first.runtime.recoveries==1,"real queue retains prior attach/recovery order");cases++;
  first.resume();check(first.jobs.scheduled==1&&first.jobs.inspected==2,"later foreground never replaces exact pending job/backoff");cases++;
  for(var state:new NativeProviderJobLifecycle.Result[]{NativeProviderJobLifecycle.Result.DRAINED,NativeProviderJobLifecycle.Result.SUSPEND}){
   F f=new F();f.runtime.localProviderOwner.result=state;f.resume();check(f.jobs.scheduled==0&&f.jobs.inspected==0,"drained/suspended never wake");cases++;
  }
  F unknown=new F();unknown.runtime.localProviderOwner.result=null;int warns=Log.warnings;unknown.resume();check(unknown.jobs.scheduled==0&&Log.warnings==warns+1,"unknown remains refused, no guessed pending state");cases++;
  F conflict=new F();conflict.jobs.state=NativeProviderJobSchedule.Existing.CONFLICT;warns=Log.warnings;conflict.resume();check(conflict.jobs.scheduled==0&&Log.warnings==warns+1,"foreign job never replaced");cases++;
  F absent=new F();absent.runtime.localProviderOwner=null;absent.resume();check(absent.jobs.scheduled==0,"no cached admitted owner is not a construction grant");cases++;
  F noDelivery=new F();noDelivery.runtime.localProviderOwner.delivery=null;noDelivery.resume();check(noDelivery.jobs.scheduled==0&&noDelivery.runtime.localProviderOwner.pendingReads==0,"missing release delivery stays suspended");cases++;
  F paused=new F();paused.plugin.resume();paused.plugin.providerForegroundEpoch.set(null);paused.plugin.drain();check(paused.runtime.recoveries==0&&paused.jobs.scheduled==0,"withdrawn callback cannot recover/attach/wake");cases++;
  F held=new F();held.plugin.startupRefusal=new Object();held.resume();check(held.runtime.attachments==0&&held.jobs.scheduled==0,"startup hold cannot activate provider");cases++;
  F stopped=new F();stopped.plugin.originalBrowserOwnerRetired=true;stopped.resume();check(stopped.runtime.recoveries==0&&stopped.jobs.scheduled==0,"retired browser cannot wake");cases++;
  F switched=new F();switched.plugin.resume();switched.plugin.applicationRuntime=new CustodialNativeRuntime();switched.plugin.drain();check(switched.runtime.recoveries==0&&switched.jobs.scheduled==0,"old runtime cannot wake new owner");cases++;
  F failed=new F();failed.runtime.failRecovery=true;failed.resume();check(failed.runtime.attachments==0&&failed.jobs.scheduled==0,"failed prior custody recovery stays held");cases++;
  F withdrawn=new F();withdrawn.runtime.afterAttach=()->withdrawn.plugin.providerForegroundEpoch.set(null);withdrawn.resume();check(withdrawn.jobs.scheduled==0,"pause after attach precedes wake");cases++;
  F rejected=new F();rejected.jobs.accept=false;rejected.resume();check(rejected.jobs.scheduled==1&&rejected.plugin.tasks.isEmpty(),"system scheduling refusal has no busy retry");cases++;
  System.out.println("PASS: "+cases+" cases / "+assertions+" assertions using actual queue, pending-work wake and job coalescer; synthetic lifecycle/native classification. No Android/provider/runtime acceptance.");
 }
}
`;
const owned=mkdtempSync(join(tmpdir(),'custodial-provider-wake-'));
try{
 writeFileSync(join(owned,'ForegroundWakeProbe.java'),java);
 for(const [command,args]of [['javac',['-d',owned,join(owned,'ForegroundWakeProbe.java')]],['java',['-cp',owned,'ForegroundWakeProbe']]]){
  const result=spawnSync(command,args,{stdio:'inherit',timeout:20000});if(result.error)throw result.error;assert.equal(result.status,0,command);
 }
}finally{rmSync(owned,{recursive:true,force:true});}
