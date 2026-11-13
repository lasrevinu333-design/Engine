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
 while(depth){end++;assert.ok(end<owner.length,signature+' must close');if(owner[end]==='{')depth++;if(owner[end]==='}')depth--;}
 return owner.slice(start,end+1);
}
// Execute the maintained owner's journal orchestration. The durable preference
// protocol now lives behind AndroidProtectedWorkPreferences: this portable lane
// records that boundary explicitly instead of resurrecting removed direct-write
// helpers or claiming Android disk/epoch/serialization/cryptography coverage.
const helpers=['private static final class NfcWrite','enum NfcWriteResult','static final class NfcHandoffCapture',
 'NfcWriteResult persistPhysicalNfcHandoffs','private NfcWriteResult persistOriginalNfcValue',
 'private boolean commitNfcOriginal','private boolean rollbackNfcWrite','private void reconcileUncertainNfcWrite'].map(part).join('\n');
const source=`import java.util.*;
public class NfcPersistencePortable {
 static class VaultFailure extends Exception {final String code;VaultFailure(String code){this.code=code;}}
 // Recording ports only. A successful fixture commit is not disk durability.
 static class SharedPreferences {
  final Map<String,String> values=new HashMap<>();
  final Deque<String> commitPlan=new ArrayDeque<>();
  final List<String> calls=new ArrayList<>(),candidateWrites=new ArrayList<>();
  String defaultCommit="success",prepareMode="success",record;
  int prepares,commits;
 }
 static class NativeNfcOriginalWriteAttempt {
  final String id=UUID.randomUUID().toString(),original,candidate;
  final Map<String,?> originalValues;
  NativeNfcOriginalWriteAttempt(Map<String,?> raw,String original,String candidate){
   originalValues=new HashMap<>(raw);this.original=original;this.candidate=candidate;
  }
  static NativeNfcOriginalWriteAttempt prepare(Map<String,?> raw,String original,String candidate)throws VaultFailure{
   if(!Objects.equals(raw.get("native_nfc_handoffs"),original))throw invalid();
   return new NativeNfcOriginalWriteAttempt(raw,original,candidate);
  }
  static VaultFailure invalid(){return new VaultFailure("custodial_native_nfc_handoff_persistence_uncertain");}
 }
 static class AndroidProtectedWorkPreferences {
  final SharedPreferences raw;
  AndroidProtectedWorkPreferences(SharedPreferences raw){this.raw=raw;}
  static class ReadOnlyObservation {final Map<String,?> values;ReadOnlyObservation(Map<String,?> values){this.values=new HashMap<>(values);}}
  static class PreparedNfcOriginal {
   final NativeNfcOriginalWriteAttempt attempt;final String record;
   PreparedNfcOriginal(NativeNfcOriginalWriteAttempt attempt,String record){this.attempt=attempt;this.record=record;}
  }
  ReadOnlyObservation observeReadOnly(){return new ReadOnlyObservation(raw.values);}
  boolean matchesReadOnly(ReadOnlyObservation observation){return observation!=null&&observation.values.equals(raw.values);}
  String getString(String key,String fallback){return raw.values.getOrDefault(key,fallback);}
  Object recoverableNfcOriginal(){return raw.record;}
  PreparedNfcOriginal prepareNfcOriginal(ReadOnlyObservation observation,NativeNfcOriginalWriteAttempt attempt,String record)throws VaultFailure{
   raw.prepares++;raw.calls.add("prepare:"+attempt.id);
   if(!matchesReadOnly(observation)||raw.record!=null)throw NativeNfcOriginalWriteAttempt.invalid();
   if(raw.prepareMode.equals("refuse-before-marker"))throw NativeNfcOriginalWriteAttempt.invalid();
   raw.record=record;
   if(raw.prepareMode.equals("refuse-after-marker"))throw NativeNfcOriginalWriteAttempt.invalid();
   return new PreparedNfcOriginal(attempt,record);
  }
  void requireOriginal(NativeNfcOriginalWriteAttempt attempt,String record)throws VaultFailure{
   if(!Objects.equals(raw.record,record))throw NativeNfcOriginalWriteAttempt.invalid();
   Map<String,String> current=new HashMap<>(raw.values);String observed=current.get("native_nfc_handoffs");
   if(!Objects.equals(observed,attempt.original)&&!Objects.equals(observed,attempt.candidate))throw NativeNfcOriginalWriteAttempt.invalid();
   if(attempt.original==null)current.remove("native_nfc_handoffs");else current.put("native_nfc_handoffs",attempt.original);
   if(!current.equals(attempt.originalValues))throw NativeNfcOriginalWriteAttempt.invalid();
  }
  PreparedNfcOriginal recoverNfcOriginal(NativeNfcOriginalWriteAttempt attempt,String record)throws VaultFailure{
   raw.calls.add("recover:"+attempt.id);requireOriginal(attempt,record);return new PreparedNfcOriginal(attempt,record);
  }
  boolean commitNfcOriginal(PreparedNfcOriginal prepared,boolean rollback)throws VaultFailure{
   requireOriginal(prepared.attempt,prepared.record);raw.commits++;
   raw.calls.add((rollback?"rollback:":"commit:")+prepared.attempt.id);
   String action=raw.commitPlan.isEmpty()?raw.defaultCommit:raw.commitPlan.remove();
   String value=rollback?prepared.attempt.original:prepared.attempt.candidate;
   if(!rollback)raw.candidateWrites.add(value);
   if(action.equals("throw"))throw NativeNfcOriginalWriteAttempt.invalid();
   if(action.equals("no-write"))return false;
   if(value==null)raw.values.remove("native_nfc_handoffs");else raw.values.put("native_nfc_handoffs",value);
   if(action.equals("third-value")){raw.values.put("native_nfc_handoffs","unexplained-bytes");return false;}
   if(action.equals("memory-false"))return false;
   if(!action.equals("success"))throw new AssertionError("unknown fixture action");
   raw.record=null;return true;
  }
 }
 static class AndroidOfflineAuthorityTimeStore {
  static final String NFC_HANDOFFS_KEY="native_nfc_handoffs";
  static final Object NFC_WRITE_LOCK=new Object();
  static final Map<SharedPreferences,NfcWrite> UNCERTAIN_NFC_WRITES=new IdentityHashMap<>();
  static final Map<String,NativeNfcOriginalWriteAttempt> encodedAttempts=new HashMap<>();
  final AndroidProtectedWorkPreferences preferences;final SharedPreferences rawPreferences;
  int encodes,attemptEncodes,attemptDecodes;
  AndroidOfflineAuthorityTimeStore(SharedPreferences p){preferences=new AndroidProtectedWorkPreferences(p);rawPreferences=p;}
  String encodeNfcHandoffs(Map<String,Map<String,Object>> handoffs){return handoffs.toString();}
  String protect(String value,String code,boolean existing){return "synthetic-cipher:"+(++encodes)+":"+value;}
  String protectOriginalNfcAttempt(NativeNfcOriginalWriteAttempt attempt){
   attemptEncodes++;String encoded="synthetic-attempt:"+attempt.id;encodedAttempts.put(encoded,attempt);return encoded;
  }
  NativeNfcOriginalWriteAttempt decodeOriginalNfcAttempt(String encoded)throws VaultFailure{
   attemptDecodes++;var attempt=encodedAttempts.get(encoded);if(attempt==null)throw NativeNfcOriginalWriteAttempt.invalid();return attempt;
  }
  ${helpers}
  NfcHandoffCapture capture()throws Exception{
   reconcileUncertainNfcWrite();
   var observation=preferences.observeReadOnly();
   Map<String,Map<String,Object>> rows=new LinkedHashMap<>();rows.put("candidate",Map.of("handoff_id","candidate"));
   return new NfcHandoffCapture(this,rows,false,preferences.getString(NFC_HANDOFFS_KEY,null),observation);
  }
 }
 static int assertions;static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
 static void denied(AndroidOfflineAuthorityTimeStore store)throws Exception{
  try{store.capture();throw new AssertionError("uncertain write admitted another candidate");}
  catch(VaultFailure e){check(e.code.equals("custodial_native_nfc_handoff_persistence_uncertain"),"uncertainty explicit");}
 }
 public static void main(String[] args)throws Exception{
  var p=new SharedPreferences();p.values.put("draft","untouched");p.commitPlan.addAll(List.of("memory-false","success"));
  var s=new AndroidOfflineAuthorityTimeStore(p);
  check(s.persistPhysicalNfcHandoffs(s.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,"exact retry accepted by preference port");
  check(p.prepares==1&&p.commits==2&&s.encodes==1&&s.attemptEncodes==1,"one prepared attempt; two bounded commits; no reencryption");
  check(p.candidateWrites.size()==2&&p.candidateWrites.get(0).equals(p.candidateWrites.get(1)),"retry same candidate ciphertext");
  String originalId=p.calls.get(0).substring("prepare:".length());
  check(p.calls.equals(List.of("prepare:"+originalId,"commit:"+originalId,"commit:"+originalId)),"same attempt identity and journal-before-body order");
  check(p.record==null&&p.values.get("draft").equals("untouched"),"confirmed result retains unrelated fixture row");
  var q=new SharedPreferences();q.values.put("protected_work","original");q.defaultCommit="memory-false";
  var t=new AndroidOfflineAuthorityTimeStore(q);
  check(t.persistPhysicalNfcHandoffs(t.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,"failed retry and rollback remain unknown");
  String record=q.record;check(record!=null,"original attempt locator retained");
  for(int i=0;i<3;i++)denied(new AndroidOfflineAuthorityTimeStore(q));
  check(q.prepares==1&&t.encodes==1&&record.equals(q.record),"uncertain retries cannot allocate new original attempt");
  AndroidOfflineAuthorityTimeStore.UNCERTAIN_NFC_WRITES.clear();q.defaultCommit="success";
  var recovered=new AndroidOfflineAuthorityTimeStore(q);var capture=recovered.capture();
  check(recovered.attemptDecodes==1&&q.record==null&&q.values.get("protected_work").equals("original"),"recreated owner reconciles same recorded attempt before new capture");
  check(recovered.persistPhysicalNfcHandoffs(capture)==AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,"new observation follows confirmed rollback");
  var r=new SharedPreferences();r.values.put("native_nfc_handoffs","exact-original-ciphertext");r.values.put("draft","untouched");
  Map<String,String> original=new HashMap<>(r.values);r.commitPlan.addAll(List.of("memory-false","memory-false","success"));
  var u=new AndroidOfflineAuthorityTimeStore(r);
  check(u.persistPhysicalNfcHandoffs(u.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.REFUSED,"confirmed rollback is definite refusal");
  check(r.values.equals(original)&&r.record==null,"original ciphertext and unrelated draft retained");
  var n=new SharedPreferences();n.prepareMode="refuse-before-marker";var v=new AndroidOfflineAuthorityTimeStore(n);
  check(v.persistPhysicalNfcHandoffs(v.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.REFUSED,"unentered body refusal");
  check(n.commits==0&&n.values.isEmpty()&&n.record==null,"no body effect after absent marker refusal");
  var m=new SharedPreferences();m.prepareMode="refuse-after-marker";m.defaultCommit="memory-false";var partial=new AndroidOfflineAuthorityTimeStore(m);
  check(partial.persistPhysicalNfcHandoffs(partial.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,"ambiguous marker creation retained");
  check(m.candidateWrites.isEmpty()&&m.record!=null,"failed marker admission never enters candidate body write");
  var z=new SharedPreferences();z.commitPlan.add("third-value");var w=new AndroidOfflineAuthorityTimeStore(z);
  check(w.persistPhysicalNfcHandoffs(w.capture())==AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,"unexpected readback not accepted");
  int before=z.commits;denied(w);
  check(z.commits==before&&z.values.get("native_nfc_handoffs").equals("unexplained-bytes"),"foreign bytes cannot be overwritten during reconciliation");
  var changed=new SharedPreferences();var owner=new AndroidOfflineAuthorityTimeStore(changed);var old=owner.capture();changed.values.put("other","successor");
  try{owner.persistPhysicalNfcHandoffs(old);throw new AssertionError("changed capture admitted");}
  catch(VaultFailure e){check(e.code.equals("custodial_native_nfc_handoff_refused"),"original capture withdrawal refused");}
  check(changed.prepares==0&&owner.encodes==0,"changed snapshot refuses before encoding or staging");
  System.out.println("PASS: "+assertions+" assertions using exact current NFC journal orchestration methods; recording preference, attempt and encoding ports. No Android preferences protocol, serialization, encryption, KeyStore, real process-death, disk durability or physical acceptance.");
 }
}`;
const owned=mkdtempSync(join(tmpdir(),'custodial-nfc-persistence-portable-'));
try{
 console.log('Owned portable compiler directory: '+owned);
 writeFileSync(join(owned,'NfcPersistencePortable.java'),source);
 for(const [command,args]of[['javac',['-d',owned,join(owned,'NfcPersistencePortable.java')]],['java',['-cp',owned,'NfcPersistencePortable']]]){
  const r=spawnSync(command,args,{stdio:'inherit',timeout:15000});if(r.error)throw r.error;assert.equal(r.status,0,command);
 }
}finally{rmSync(owned,{recursive:true,force:true});console.log('Removed portable compiler directory: '+owned);}
