import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
const mobile=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const template=readFileSync(join(mobile,'scripts/configure-native-links.mjs'),'utf8');
const activity=runInNewContext(template.match(/const custodialMainActivity = (`[\s\S]*?`);/)[1],{});
function method(signature){
 const start=activity.indexOf(signature);assert.ok(start>=0,signature);
 let end=activity.indexOf('{',start),depth=1;
 while(depth){end++;if(activity[end]==='{')depth++;if(activity[end]==='}')depth--;}
 return activity.slice(start,end+1);
}
const normalize=method('private Intent normalizeExternalIntent');
assert.doesNotMatch(normalize,/readPhysicalNfcUrl|readPhysicalNfcIdentity|recordPhysicalNfcHandoff/,
 'Activity intent normalization must not perform blocking NFC I/O or mint proof');
const enqueue=method('private void enqueuePhysicalNfcTag');
const reader=method('public void onTagDiscovered');
assert.match(normalize,/enqueuePhysicalNfcTag\(tag\)/);
assert.match(normalize,/return new Intent\(Intent.ACTION_MAIN\)/);
assert.match(reader,/enqueuePhysicalNfcTag\(tag\)/);
assert.doesNotMatch(reader,/readPhysicalNfcUrl|readPhysicalNfcIdentity/);
assert.match(enqueue,/physicalNfcExecutor.execute/);
assert.ok(enqueue.indexOf('readPhysicalNfcUrl(tag)')<enqueue.indexOf('readPhysicalNfcIdentity(tag)'));
assert.match(enqueue,/if \(url == null\) return/);
assert.match(activity,/Executors.newSingleThreadExecutor\(\)/);
assert.match(method('public void onDestroy'),/physicalNfcExecutor.shutdownNow\(\)/);
const dispatch=method('private void dispatchPhysicalNfcUrlFromReader');
assert.ok(dispatch.indexOf('runOnUiThread')<dispatch.indexOf('recordPhysicalNfcHandoff'));
assert.match(dispatch,/isFinishing\(\) \|\| isDestroyed\(\)/);
const source=`import java.util.*;
import java.util.concurrent.*;
public class NfcThreadProbe {
 private final ExecutorService physicalNfcExecutor = Executors.newSingleThreadExecutor();
 static class Tag { final String id; final boolean fail; Tag(String id,boolean fail){this.id=id;this.fail=fail;} }
 static class Intent { static final String ACTION_VIEW="view",ACTION_MAIN="main"; final String action; final Tag tag;
  Intent(String action){this(action,null);} Intent(String action,Tag tag){this.action=action;this.tag=tag;}
  String getAction(){return action;} Tag getParcelableExtra(String ignored){return tag;} }
 static class NfcAdapter { static final String ACTION_NDEF_DISCOVERED="ndef",EXTRA_TAG="tag"; }
 final CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
 final List<String> events=Collections.synchronizedList(new ArrayList<>());
 Thread caller; boolean destroyed;
 boolean isDestroyed(){return destroyed;}
 boolean isFinishing(){return false;}
 String readPhysicalNfcUrl(Tag tag){
  check(Thread.currentThread()!=caller,"RF read must leave caller/UI thread");
  events.add("read:"+tag.id);entered.countDown();
  try{check(release.await(2,TimeUnit.SECONDS),"bounded RF fixture release");}catch(InterruptedException e){Thread.currentThread().interrupt();return null;}
  return tag.fail?null:"url:"+tag.id;
 }
 String readPhysicalNfcIdentity(Tag tag){events.add("identity:"+tag.id);return tag.id;}
 Object dispatchPhysicalNfcUrlFromReader(String url,String identity){events.add("handoff:"+url+":"+identity);return null;}
 ${enqueue}
 ${normalize}
 ${reader}
 static int assertions;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 void drain()throws Exception{physicalNfcExecutor.submit(new Runnable(){public void run(){}}).get(2,TimeUnit.SECONDS);}
 public static void main(String[] args)throws Exception{
  NfcThreadProbe p=new NfcThreadProbe();p.caller=Thread.currentThread();
  try{
   Intent original=new Intent("ndef",new Tag("A",false));
   Intent neutral=p.normalizeExternalIntent(original);
   check(neutral.action.equals("main")&&neutral.tag==null,"neutral startup prevents second cold NFC attempt");
   check(p.entered.await(2,TimeUnit.SECONDS),"worker starts RF read");
   check(p.events.equals(List.of("read:A")),"normalizer returned during blocked read; identity/proof await live NDEF");
   p.normalizeExternalIntent(neutral);
   p.onTagDiscovered(new Tag("B",false));
   check(p.events.equals(List.of("read:A")),"reader and intent scans serialize");
   p.release.countDown();p.drain();
   check(p.events.equals(List.of("read:A","identity:A","handoff:url:A:A","read:B","identity:B","handoff:url:B:B")),"same Tag binds URL and identity, no cold duplicate");
   p.onTagDiscovered(new Tag("failed",true));p.drain();
   check(p.events.get(p.events.size()-1).equals("read:failed"),"failed live read cannot observe identity or create handoff");
   int before=p.events.size();
   Intent noTag=new Intent("view");check(p.normalizeExternalIntent(noTag)==noTag,"no Tag leaves existing protected URL gate intact");
   p.onTagDiscovered(null);p.drain();check(p.events.size()==before,"null Tag cannot mint proof");
   p.physicalNfcExecutor.shutdownNow();p.onTagDiscovered(new Tag("closed",false));
   check(p.events.size()==before,"late callback after shutdown preserves no new scan");
   System.out.println("PASS: "+assertions+" assertions using actual generated worker/normalizer/reader methods, real Java executor and synthetic Tag/Intent/RF adapters. No physical or Android lifecycle PASS.");
  }finally{p.release.countDown();p.physicalNfcExecutor.shutdownNow();}
 }
}
`;
const owned=mkdtempSync(join(tmpdir(),'custodial-nfc-thread-'));
try{
 writeFileSync(join(owned,'NfcThreadProbe.java'),source);
 for(const [command,args]of[['javac',['-d',owned,join(owned,'NfcThreadProbe.java')]],['java',['-cp',owned,'NfcThreadProbe']]]){
  const result=spawnSync(command,args,{stdio:'inherit',timeout:15000});
  if(result.error)throw result.error;assert.equal(result.status,0,command);
 }
 console.log('PASS: 12 generated NFC threading/wiring contracts. Actual Android API compilation is a separate check.');
}finally{rmSync(owned,{recursive:true,force:true});}
