import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
const mobile=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const activity=runInNewContext(readFileSync(join(mobile,'scripts/configure-native-links.mjs'),'utf8').match(/const custodialMainActivity = (`[\s\S]*?`);/)[1],{});
function method(signature){
 const start=activity.indexOf(signature);assert.ok(start>=0,signature);
 let end=activity.indexOf('{',start),depth=1;
 while(depth){end++;if(activity[end]==='{')depth++;if(activity[end]==='}')depth--;}
 return activity.slice(start,end+1);
}
const source=`public class MainActivity {
 static class Uri {
  final String value; Uri(String value){this.value=value;}
  static Uri parse(String value){return new Uri(value);} Uri buildUpon(){return this;}
  Uri appendQueryParameter(String key,String value){return new Uri(this.value+"&"+key+"="+value);} Uri build(){return this;}
 }
 static class Intent {static final String ACTION_VIEW="view";final String action;final Uri data;Intent(String action,Uri data){this.action=action;this.data=data;}}
 static class LegacyCustodialNfcUrl {static String normalize(String url){return url;}}
 static class NativeNfcScanHandoff {
  static final String QUERY_PARAMETER="mz_nfc_handoff";
  static class ReadResult {final String handoffId;final boolean durable;ReadResult(String id,boolean durable){this.handoffId=id;this.durable=durable;}}
  static ReadResult recordPhysicalRead(MainActivity activity,String url,String identity){
   activity.calls++;activity.lastIdentity=identity;
   if(activity.mode.equals("uncertain"))return new ReadResult(activity.calls==1?"retained-entry":"",false);
   return new ReadResult(activity.mode.equals("durable")?"durable-entry":"",activity.mode.equals("durable"));
  }
 }
 static class android {static class widget {static class Toast {
  static final int LENGTH_LONG=1;static Toast makeText(MainActivity a,String message,int duration){a.notices++;return new Toast();}void show(){}
 }}}
 Intent current=new Intent("main",null);String mode="uncertain",lastIdentity="";int calls,navigation,notices;
 boolean finishing,destroyed;
 boolean isFinishing(){return finishing;}boolean isDestroyed(){return destroyed;}
 void runOnUiThread(Runnable r){r.run();}void setIntent(Intent i){current=i;}
 void onNewIntent(Intent i){check(current==i,"locator retained before navigation");navigation++;}
 ${method('private String recordPhysicalNfcHandoff')}
 ${method('private void dispatchPhysicalNfcUrlFromReader')}
 static int assertions;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 public static void main(String[] args){
  MainActivity a=new MainActivity();
  for(int i=0;i<4;i++){
   a.dispatchPhysicalNfcUrlFromReader("memphiszoo://scan?code=NOCX","nfc-a.v1:04010203040506");
   check(a.navigation==0,"uncertainty cannot navigate or mint browser work");
   check(a.current.data!=null&&a.current.data.value.contains("mz_nfc_handoff=retained-entry"),"first uncertain locator survives subsequent refusals");
  }
  a.mode="durable";a.dispatchPhysicalNfcUrlFromReader("memphiszoo://scan?code=NOCX","nfc-a.v1:04010203040506");
  check(a.navigation==1,"healthy fifth observation navigates exactly once");
  check(a.current.data.value.contains("mz_nfc_handoff=durable-entry"),"new durable read retains its own exact locator");
  check(a.lastIdentity.equals("nfc-a.v1:04010203040506"),"native call preserves observed identity");
  MainActivity b=new MainActivity();b.mode="refused";Intent original=b.current;
  b.dispatchPhysicalNfcUrlFromReader("memphiszoo://scan?code=NOCX","nfc-a.v1:04010203040506");
  check(b.current==original&&b.navigation==0,"verified rollback leaves original Intent and no navigation");
  b.finishing=true;b.mode="durable";int calls=b.calls;
  b.dispatchPhysicalNfcUrlFromReader("memphiszoo://scan?code=NOCX","nfc-a.v1:04010203040506");
  check(b.calls==calls,"finishing guard precedes any persistence attempt");
  MainActivity c=new MainActivity();c.mode="durable";
  c.dispatchPhysicalNfcUrlFromReader("memphiszoo://scan?code=NOCX","");
  check(c.calls==0&&c.navigation==0&&c.current.data==null,"missing identity cannot reach native persistence or navigation");
  System.out.println("PASS: "+assertions+" assertions using actual generated record/dispatch methods; controlled native-result/UI/URI/Toast adapters. No physical, Android lifecycle, KeyStore or process-death PASS.");
 }
}`;
const owned=mkdtempSync(join(tmpdir(),'custodial-nfc-persistence-ui-'));
try{
 writeFileSync(join(owned,'MainActivity.java'),source);
 for(const [command,args]of[['javac',['-d',owned,join(owned,'MainActivity.java')]],['java',['-cp',owned,'MainActivity']]]){
  const r=spawnSync(command,args,{stdio:'inherit',timeout:15000});if(r.error)throw r.error;assert.equal(r.status,0,command);
 }
}finally{rmSync(owned,{recursive:true,force:true});}
