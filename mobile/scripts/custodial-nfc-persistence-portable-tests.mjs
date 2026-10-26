import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const mobile=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const owner=readFileSync(join(mobile,'plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/AndroidOfflineAuthorityTimeStore.java'),'utf8');
function part(signature){
 const start=owner.indexOf(signature);assert.ok(start>=0,signature);
 let end=owner.indexOf('{',start),depth=1;
 while(depth){end++;if(owner[end]==='{')depth++;if(owner[end]==='}')depth--;}
 return owner.slice(start,end+1);
}
const helpers=['private static final class NfcWrite','enum NfcWriteResult','static final class NfcHandoffCapture','NfcWriteResult persistPhysicalNfcHandoffs','private boolean exactNfcValue','private boolean commitNfcValue','private boolean rollbackNfcWrite','private void reconcileUncertainNfcWrite'].map(part).join('\n');
const source=`import java.util.*;
public class NfcPersistencePortable {
 static class VaultFailure extends Exception {final String code;VaultFailure(String code){this.code=code;}}
 static class SharedPreferences {
  final Map<String,String> memory=new HashMap<>(),disk=new HashMap<>();
  final List<String> writes=new ArrayList<>();final Deque<String> plan=new ArrayDeque<>();
  String mode="ok";int commits;
  String getString(String key,String fallback){return memory.getOrDefault(key,fallback);}boolean contains(String key){return memory.containsKey(key);}
  Editor edit(){return new Editor(this);}
  static class Editor {
   final SharedPreferences p;String key,value;Editor(SharedPreferences p){this.p=p;}
   Editor putString(String key,String value){this.key=key;this.value=value;return this;}
   Editor remove(String key){this.key=key;value=null;return this;}
   boolean commit(){
    p.commits++;p.writes.add(value);String action=p.plan.isEmpty()?p.mode:p.plan.remove();
    if(action.equals("no_write"))return false;
    if(value==null)p.memory.remove(key);else p.memory.put(key,value);
    if(action.equals("third_value")){p.memory.put(key,"unexplained-bytes");return true;}
    if(action.equals("memory_false"))return false;
    p.disk.clear();p.disk.putAll(p.memory);return true;
   }
  }
 }
 static class AndroidOfflineAuthorityTimeStore {
  static final String NFC_HANDOFFS_KEY="native_nfc_handoffs";
  static final Object NFC_WRITE_LOCK=new Object();
  static final Map<SharedPreferences,NfcWrite> UNCERTAIN_NFC_WRITES=new IdentityHashMap<>();
  final SharedPreferences preferences,rawPreferences;int encodes;
  AndroidOfflineAuthorityTimeStore(SharedPreferences p){preferences=p;rawPreferences=p;}
  // Controlled encoding adapter: helper's exact-byte retry/rollback is actual
  // production code. Real encrypted/JSON store is covered by separate JUnit.
  String encodeNfcHandoffs(Map<String,Map<String,Object>> handoffs){return handoffs.toString();}
  String protect(String value,String code,boolean existing){return "synthetic-cipher:"+(++encodes)+":"+value;}
  ${helpers}
  NfcHandoffCapture capture()throws Exception{
   reconcileUncertainNfcWrite();
   Map<String,Map<String,Object>> rows=new LinkedHashMap<>();rows.put("candidate",Map.of("handoff_id","candidate"));
   return new NfcHandoffCapture(this,rows,false,preferences.getString(NFC_HANDOFFS_KEY,null));
  }
 }
 static int assertions;static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
 static void denied(AndroidOfflineAuthorityTimeStore s)throws Exception{
  try{s.capture();throw new AssertionError("uncertain write admitted another candidate");}
  catch(VaultFailure e){check(e.code.equals("custodial_native_nfc_handoff_persistence_uncertain"),"uncertain result must be explicit");}
 }
 public static void main(String[] args)throws Exception{
  var p=new SharedPreferences();var s=new AndroidOfflineAuthorityTimeStore(p);p.plan.addAll(List.of("memory_false","ok"));
  check(s.persistPhysicalNfcHandoffs(s.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,"exact retry durable");
  check(p.commits==2&&s.encodes==1,"retry neither reencrypts nor loops");check(p.writes.get(0).equals(p.writes.get(1)),"retry same ciphertext");check(p.memory.equals(p.disk),"durable readback");
  var q=new SharedPreferences();q.memory.put("protected_work","original");q.disk.putAll(q.memory);q.mode="memory_false";
  var t=new AndroidOfflineAuthorityTimeStore(q);
  check(t.persistPhysicalNfcHandoffs(t.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,"failed retry and rollback stay uncertain");
  for(int i=0;i<3;i++)denied(new AndroidOfflineAuthorityTimeStore(q));
  check(t.encodes==1,"four ambiguous attempts cannot accumulate four candidates");
  q.mode="ok";var recovered=new AndroidOfflineAuthorityTimeStore(q);
  check(recovered.persistPhysicalNfcHandoffs(recovered.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,"healthy fifth observation succeeds");
  check(q.memory.equals(q.disk)&&q.memory.get("protected_work").equals("original"),"healthy reconciliation preserves original protected work");
  var r=new SharedPreferences();r.memory.put("native_nfc_handoffs","exact-original-ciphertext");r.memory.put("draft","untouched");r.disk.putAll(r.memory);
  Map<String,String> original=new HashMap<>(r.memory);r.plan.addAll(List.of("memory_false","memory_false","ok"));
  var u=new AndroidOfflineAuthorityTimeStore(r);
  check(u.persistPhysicalNfcHandoffs(u.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.REFUSED,"only verified rollback gives definite refusal");
  check(r.memory.equals(original)&&r.disk.equals(original),"exact original ciphertext and drafts restored");
  var n=new SharedPreferences();n.plan.addAll(List.of("no_write","ok"));var v=new AndroidOfflineAuthorityTimeStore(n);
  check(v.persistPhysicalNfcHandoffs(v.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.REFUSED,"definitive no-write rollback");
  check(n.memory.isEmpty()&&n.disk.isEmpty()&&n.commits==2,"original absence retained, no unlocated candidate");
  var z=new SharedPreferences();z.plan.add("third_value");var w=new AndroidOfflineAuthorityTimeStore(z);
  check(w.persistPhysicalNfcHandoffs(w.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,"unexpected readback is not durable success");
  int before=z.commits;denied(w);check(z.commits==before&&z.memory.get("native_nfc_handoffs").equals("unexplained-bytes"),"third bytes are not overwritten");
  System.out.println("PASS: "+assertions+" assertions using exact production physical-handoff persistence/result/rollback/guard methods; controlled preferences and encoding adapters. No Android encryption, KeyStore, physical or process-death PASS.");
 }
}`;
const owned=mkdtempSync(join(tmpdir(),'custodial-nfc-persistence-portable-'));
try{
 writeFileSync(join(owned,'NfcPersistencePortable.java'),source);
 for(const [command,args]of[['javac',['-d',owned,join(owned,'NfcPersistencePortable.java')]],['java',['-cp',owned,'NfcPersistencePortable']]]){
  const r=spawnSync(command,args,{stdio:'inherit',timeout:15000});if(r.error)throw r.error;assert.equal(r.status,0,command);
 }
}finally{rmSync(owned,{recursive:true,force:true});}
