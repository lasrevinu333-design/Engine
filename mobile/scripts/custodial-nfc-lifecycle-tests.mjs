import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Optional explicit historical template permits a source-bound before/after
// replay without changing the checkout or generating an Android app.
const template = readFileSync(process.argv[2] || join(mobile, 'scripts/configure-native-links.mjs'), 'utf8');
const activity = runInNewContext(template.match(/const custodialMainActivity = (`[\s\S]*?`);/)[1], {});
function method(name) {
  const at = activity.indexOf(name);
  assert.ok(at >= 0, name);
  const start = activity.lastIndexOf('\n', at) + 1;
  let end = activity.indexOf('{', at), depth = 1;
  while (depth) { end++; if (activity[end] === '{') depth++; if (activity[end] === '}') depth--; }
  return activity.slice(start, end + 1);
}
const source = `import java.util.*;
import java.util.concurrent.*;
public class NfcLifecycleProbe {
 private final ExecutorService physicalNfcExecutor = Executors.newSingleThreadExecutor();
 final Thread uiThread = Thread.currentThread();
 final BlockingQueue<Runnable> ui = new LinkedBlockingQueue<>();
 final Map<String,String> pending = new LinkedHashMap<>();
 final List<String> events = Collections.synchronizedList(new ArrayList<>());
 volatile boolean destroyed, finishing;
 boolean finishDuringPersistence, failPersistence, failNavigation;
 Intent currentIntent = new Intent(Intent.ACTION_MAIN, null);
 int navigations, nextId;
 static class Tag { final String id; final Runnable afterRead; Tag(String id,Runnable afterRead){this.id=id;this.afterRead=afterRead;} }
 static class Uri {
  final String value;
  Uri(String value){this.value=value;}
  static Uri parse(String value){return new Uri(value);}
  Uri buildUpon(){return this;}
  Uri appendQueryParameter(String key,String value){return new Uri(this.value+"?"+key+"="+value);}
  Uri build(){return this;}
 }
 static class Intent {
  static final String ACTION_VIEW="view", ACTION_MAIN="main";
  final String action; final Uri data;
  Intent(String action,Uri data){this.action=action;this.data=data;}
 }
 static class NativeNfcScanHandoff { static final String QUERY_PARAMETER="handoff"; }
 static class LegacyCustodialNfcUrl { static String normalize(String url){return url==null?"":url;} }
 boolean isDestroyed(){return destroyed;}
 boolean isFinishing(){return finishing;}
 void runOnUiThread(Runnable work){if(Thread.currentThread()==uiThread)work.run();else ui.add(work);}
 String readPhysicalNfcUrl(Tag tag){
  check(Thread.currentThread()!=uiThread,"live RF must stay off UI");
  events.add("read:"+tag.id);
  if(tag.afterRead!=null)tag.afterRead.run();
  return "location:"+tag.id;
 }
 String readPhysicalNfcIdentity(Tag tag){return tag.id;}
 String recordPhysicalNfcHandoff(String url,String identity){
  check(Thread.currentThread()==uiThread,"handoff persistence shares lifecycle UI thread");
  if(failPersistence||identity.isEmpty()||pending.size()>=4)return "";
  String id="entry"+(++nextId);pending.put(id,identity);events.add("persist:"+id);
  if(finishDuringPersistence)ui.add(new Runnable(){public void run(){finishing=true;events.add("finish");}});
  return id;
 }
 void setIntent(Intent intent){currentIntent=intent;events.add("locator");}
 void onNewIntent(Intent intent){
  // Production onNewIntent also sets the Intent. The explicit locator must be
  // installed before downstream bridge navigation is called.
  check(currentIntent==intent,"locator installed before downstream navigation");
  if(failNavigation)throw new IllegalStateException("controlled downstream navigation failure");
  navigations++;events.add("navigate");
 }
 ${method('dispatchPhysicalNfcUrlFromReader(String url, String identity)')}
 ${method('enqueuePhysicalNfcTag(Tag tag)')}
 static int assertions; static final List<String> failures=new ArrayList<>();
 static synchronized void check(boolean value,String message){assertions++;if(!value)failures.add(message);}
 void drainWorker()throws Exception{physicalNfcExecutor.submit(new Runnable(){public void run(){}}).get(2,TimeUnit.SECONDS);}
 void drainUi(){Runnable work;while((work=ui.poll())!=null)work.run();}
 void close(){physicalNfcExecutor.shutdownNow();}
 static void invalidAfterRead(boolean destroy)throws Exception{
  NfcLifecycleProbe p=new NfcLifecycleProbe();
  try{
   p.enqueuePhysicalNfcTag(new Tag("A",new Runnable(){public void run(){if(destroy)p.destroyed=true;else p.finishing=true;}}));
   p.drainWorker();p.drainUi();
   check(p.pending.isEmpty(),(destroy?"destroy":"finish")+" after RF must not orphan a persisted handoff");
   check(p.navigations==0,"invalid Activity must not navigate");
  }finally{p.close();}
 }
 static void invalidBeforeUi(boolean destroy)throws Exception{
  NfcLifecycleProbe p=new NfcLifecycleProbe();
  try{
   p.enqueuePhysicalNfcTag(new Tag("A",null));p.drainWorker();
   check(!p.ui.isEmpty(),"successful live read queues UI delivery");
   if(destroy)p.destroyed=true;else p.finishing=true;
   p.drainUi();
   check(p.pending.isEmpty(),(destroy?"destroy":"finish")+" before queued UI delivery must not consume unreachable capacity");
   check(p.navigations==0,"declined UI delivery must not navigate");
  }finally{p.close();}
 }
 public static void main(String[] args)throws Exception{
  invalidAfterRead(false);invalidAfterRead(true);invalidBeforeUi(false);invalidBeforeUi(true);
  NfcLifecycleProbe p=new NfcLifecycleProbe();
  try{
   for(int i=0;i<4;i++){
    p.finishing=false;p.enqueuePhysicalNfcTag(new Tag("stale"+i,null));p.drainWorker();
    p.finishing=true;p.drainUi();
   }
   check(p.pending.isEmpty(),"four declined deliveries must leave capacity available");
   p.finishing=false;p.enqueuePhysicalNfcTag(new Tag("fresh",null));p.drainWorker();p.drainUi();
   check(p.pending.size()==1&&p.pending.containsValue("fresh"),"next real observation retains its original identity");
   check(p.navigations==1,"next healthy delivery succeeds after repeated interruptions");
   check(p.currentIntent.data!=null&&p.currentIntent.data.value.contains("handoff=entry"),"durable handoff has retained Activity locator");
  }finally{p.close();}
  NfcLifecycleProbe q=new NfcLifecycleProbe();
  try{
   q.finishDuringPersistence=true;q.enqueuePhysicalNfcTag(new Tag("A",null));q.drainWorker();q.drainUi();
   check(q.navigations==1&&q.pending.size()==1,"lifecycle callback queued during persistence cannot strand successful read");
   check(q.events.indexOf("locator")<q.events.indexOf("navigate")&&q.events.indexOf("navigate")<q.events.indexOf("finish"),"locator and navigation complete before queued lifecycle transition");
  }finally{q.close();}
  NfcLifecycleProbe r=new NfcLifecycleProbe();
  try{
   Intent original=r.currentIntent;r.failPersistence=true;
   r.enqueuePhysicalNfcTag(new Tag("A",null));r.drainWorker();r.drainUi();
   check(r.pending.isEmpty()&&r.navigations==0&&r.currentIntent==original,"failed persistence leaves original locator and no navigation");
   r.failPersistence=false;r.failNavigation=true;
   r.enqueuePhysicalNfcTag(new Tag("A",null));r.drainWorker();
   try{r.drainUi();check(false,"controlled navigation failure expected");}catch(IllegalStateException expected){}
   check(r.pending.size()==1&&r.currentIntent.data!=null&&r.currentIntent.data.value.contains("handoff=entry"),"downstream failure retains persisted handoff locator");
  }finally{r.close();}
  if(!failures.isEmpty()){for(String failure:failures)System.err.println("FAIL: "+failure);throw new AssertionError(failures.size()+" lifecycle failures");}
  System.out.println("PASS: "+assertions+" assertions using actual generated enqueue/dispatch methods and real Java worker; controlled UI queue/lifecycle/storage adapters. No physical, Android lifecycle, KeyStore or process-death PASS.");
 }
}
`;
const owned = mkdtempSync(join(tmpdir(), 'custodial-nfc-lifecycle-'));
try {
  writeFileSync(join(owned, 'NfcLifecycleProbe.java'), source);
  for (const [command,args] of [['javac',['-d',owned,join(owned,'NfcLifecycleProbe.java')]],['java',['-cp',owned,'NfcLifecycleProbe']]]) {
    const result=spawnSync(command,args,{stdio:'inherit',timeout:15000});
    if(result.error)throw result.error;
    assert.equal(result.status,0,command);
  }
} finally { rmSync(owned,{recursive:true,force:true}); }
