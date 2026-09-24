package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.util.*;
import org.json.*;
import org.junit.Test;

/** Actual engine/journal/codec; synthetic transport and durable-store fault seams. */
public final class NativeLegacyLineageJournalTest {
 static String id(int n){return String.format("33000000-0000-4000-8000-%012d",n);}
 static final String DEVICE="KIOSK_08",OLD=id(1)+".synthetic-legacy-credential-secret",OP=id(2);
 static final String SEAL="original-installation-seal-0001",TIME="2026-07-31T21:52:04.000Z";
 static final class Store implements NativeLegacyLineageJournal.Store {
  final Map<String,String> records=new HashMap<>();String failKey;boolean after;
  public String loadLegacyRecord(String key){return records.get(key);}
  public void saveLegacyRecord(String key,String value)throws VaultFailure{
   if(key.equals(failKey)){failKey=null;if(after)records.put(key,value);throw new VaultFailure("synthetic_durable_write_lost");}
   records.put(key,value);
  }
 }
 static final class Fixture implements EnrollmentTransport {
  final MutableClock clock=new MutableClock(1800000000000L);final FakeTransport delegate=new FakeTransport(clock);
  final MemoryPersistence persistence=new MemoryPersistence();final TestCipher cipher=new TestCipher();
  final Store store=new Store();final Map<String,JSONObject> bindings=new HashMap<>(),terminals=new HashMap<>();
  final FakeLegacySource legacy;final TestSealGenerator seal=new TestSealGenerator();
  boolean recover,loseBind,loseReceipt;int observation;
  Fixture(boolean complete)throws Exception{
   legacy=new FakeLegacySource(OLD.toCharArray(),complete?new InstallationBinding(DEVICE,SEAL,TIME,true,""):null,SEAL);
  }
  VaultEngine engine(){return new VaultEngine(persistence,cipher,this,legacy,seal,clock);}
  NativeLegacyLineageJournal journal(){return new NativeLegacyLineageJournal(store);}
  public EnrollmentResult enroll(EnrollmentRequest r,char[] code)throws VaultFailure{return delegate.enroll(r,code);}
  public TerminalResult confirm(String op,String d,char[] cred)throws VaultFailure{return delegate.confirm(op,d,cred);}
  public TerminalResult cancel(String op,String d,char[] cred)throws VaultFailure{return delegate.cancel(op,d,cred);}
  public TerminalResult remove(String op,String d,char[] cred)throws VaultFailure{return delegate.remove(op,d,cred);}
  public String verifyLegacyIdentity(String d,char[] token)throws VaultFailure{
   if(!DEVICE.equals(d)||!OLD.equals(new String(token)))throw NativeLegacyLineageJournal.invalid();return d;
  }
  public ActiveCredentialStatus verifyActiveCredential(String d,String c,char[] token)throws VaultFailure{
   NativeAttestation.requireStoredCredentialId(token,c);
   return recover?ActiveCredentialStatus.ENROLLMENT_REQUIRED:ActiveCredentialStatus.ACCEPTED;
  }
  public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] token)throws VaultFailure{return delegate.authorized(r,d,token);}
  public NativeLegacyLineageJournal.Binding resolveLegacyLineage(NativeLegacyLineageJournal.Context c,char[] token)throws VaultFailure{
   NativeAttestation.requireStoredCredentialId(token,c.credential);
   try{
    JSONObject b=bindings.get(c.operation);
    if(b==null){b=new JSONObject().put("schema_version",NativeLegacyLineageJournal.BINDING).put("binding_id",id(100+observation++))
     .put("binding_kind",NativeLegacyLineageJournal.OBSERVED).put("activation_operation_id",c.operation).put("device_id",c.device)
     .put("credential_id",c.credential).put("installation_binding_sha256",c.digest)
     .put("source_enrollment_operation_id",JSONObject.NULL).put("current_recovery_operation_id",c.recovered?c.operation:JSONObject.NULL)
     .put("employee_id",id(3)).put("assignment_epoch",7).put("server_observed_at",String.format("2026-09-24T08:00:%02d.123456Z",observation));
     bindings.put(c.operation,b);}
    if(loseBind){loseBind=false;throw new VaultFailure("synthetic_bind_response_lost");}
    return new NativeLegacyLineageJournal.Binding(b,c);
   }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeLegacyLineageJournal.invalid(e);}
  }
  public NativeLegacyLineageJournal.Terminal reportLegacyActivation(NativeLegacyLineageJournal.Context c,
   NativeLegacyLineageJournal.Binding b,JSONObject receipt,char[] token)throws VaultFailure{
   try{
    JSONObject data=terminals.get(c.operation);
    if(data==null){data=new JSONObject().put("status",new JSONObject().put("state",c.recovered?"native_active":"not_required")
      .put("operation_id",c.operation).put("device_id",c.device).put("employee_id",id(3)).put("assignment_epoch",7).put("native_receipt",receipt))
      .put("binding",b.json()).put("activation_receipt_sha256","a".repeat(64));terminals.put(c.operation,data);}
    if(loseReceipt){loseReceipt=false;throw new VaultFailure("synthetic_terminal_response_lost");}
    return new NativeLegacyLineageJournal.Terminal(data,c,b,receipt);
   }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeLegacyLineageJournal.invalid(e);}
  }
  void activate(String op)throws Exception{engine().activateAssignedDevice(op,DEVICE,"T".repeat(43).toCharArray());}
  String finish(String op)throws Exception{return engine().completeLegacyAssignedActivation(op,DEVICE,journal());}
  NativeLegacyLineageJournal.Context context(String op)throws Exception{return new NativeLegacyLineageJournal.Context(op,persistence.current(),cipher.decrypt(persistence.current().secret));}
 }
 interface Attempt {void run()throws Exception;}
 static void denied(Attempt f)throws Exception{try{f.run();fail("expected rejection");}catch(VaultFailure expected){}}
 @Test public void migratedHealthyNoRotationSnapshotAndWorkUnchanged()throws Exception{
  Fixture f=new Fixture(true);f.engine().getState();VaultSnapshot before=f.persistence.current();
  byte[] bytes=new VaultSnapshotCodec().encode(before);EncryptedSecret work=f.cipher.encryptWithExistingKey("saved work untouched".toCharArray());
  f.activate(OP);assertEquals("not_required",f.finish(OP));
  assertArrayEquals(bytes,new VaultSnapshotCodec().encode(f.persistence.current()));assertEquals(before.installation,f.persistence.current().installation);
  assertEquals(0,f.delegate.enrollCalls.get());assertEquals(0,f.cipher.destroyCalls);
  assertArrayEquals("saved work untouched".toCharArray(),f.cipher.decrypt(work));
  assertEquals(NativeLegacyLineageJournal.PRINCIPAL,f.engine().readLegacyPrincipal(f.journal()).getString("schema_version"));
  assertEquals("not_required",f.engine().legacyActivationResult(OP,DEVICE,f.journal()));
  assertFalse(f.persistence.current().installation.safeRecord().containsKey("enrollment_operation_id"));
 }
 @Test public void credentialOnlyCleanupCompleteBindingThenSameFlow()throws Exception{
  Fixture f=new Fixture(false);assertEquals("LEGACY_PENDING",f.engine().getState().get("state"));f.activate(OP);
  byte[] before=new VaultSnapshotCodec().encode(f.persistence.current());assertEquals("not_required",f.finish(OP));
  assertArrayEquals(before,new VaultSnapshotCodec().encode(f.persistence.current()));assertEquals(0,f.delegate.enrollCalls.get());
  assertEquals(SEAL,f.persistence.current().installation.installationSeal);assertTrue(f.legacy.isClean());
 }
 @Test public void everyDurableCrashBoundaryResumesExactBindingAndReceipt()throws Exception{
  for(String stage:List.of("bind_response","binding","activation","terminal_response","terminal","principal")){
   for(boolean after:List.of(false,true)){
    Fixture f=new Fixture(true);f.activate(OP);byte[] before=new VaultSnapshotCodec().encode(f.persistence.current());
    if(stage.equals("bind_response"))f.loseBind=true;
    else if(stage.equals("terminal_response"))f.loseReceipt=true;
    else{f.store.failKey=stage.equals("principal")?"principal":stage+":"+OP;f.store.after=after;}
    denied(()->f.finish(OP));assertArrayEquals(before,new VaultSnapshotCodec().encode(f.persistence.current()));
    String binding=f.bindings.get(OP).toString();assertEquals("not_required",f.finish(OP));
    assertEquals(binding,f.bindings.get(OP).toString());assertEquals(1,f.bindings.size());assertEquals(1,f.terminals.size());
    assertNotNull(f.engine().readLegacyPrincipal(f.journal()));assertEquals(0,f.delegate.enrollCalls.get());
   }
  }
 }
 @Test public void recoveryReadableOrUnreadableCredentialPreservesInstallationAndWork()throws Exception{
  for(boolean unreadable:List.of(false,true)){
   Fixture f=new Fixture(true);f.engine().getState();InstallationBinding original=f.persistence.current().installation;
   EncryptedSecret work=f.cipher.encryptWithExistingKey("original queue ciphertext".toCharArray());String bytes=work.ciphertext;
   if(unreadable)f.cipher.makeUnreadable(f.persistence.current().secret);f.recover=true;
   f.delegate.loseEnrollAfterSuccess=1;denied(()->f.activate(OP));f.activate(OP);
   assertEquals("native_active",f.finish(OP));assertSame(original,f.persistence.current().installation);
   assertEquals(1,f.delegate.issuanceCount.get());assertTrue(f.cipher.existingKeyEncryptCalls>0);assertEquals(0,f.cipher.destroyCalls);
   assertEquals(bytes,work.ciphertext);assertArrayEquals("original queue ciphertext".toCharArray(),f.cipher.decrypt(work));
   JSONObject p=f.engine().readLegacyPrincipal(f.journal());assertEquals(OP,p.getString("credential_id"));
   assertEquals(OP,f.bindings.get(OP).getString("current_recovery_operation_id"));
   assertEquals(JSONObject.NULL,f.bindings.get(OP).get("source_enrollment_operation_id"));
  }
 }
 @Test public void corruptBindingAndEveryWrongIdentityFailClosedRetainBytes()throws Exception{
  Fixture f=new Fixture(true);f.activate(OP);f.finish(OP);String key="binding:"+OP,original=f.store.records.get(key);
  for(String field:NativeLegacyLineageJournal.BINDING_KEYS){
   JSONObject changed=new JSONObject(original);changed.put(field,"wrong");f.store.records.put(key,changed.toString());
   String altered=f.store.records.get(key);denied(()->f.engine().readLegacyPrincipal(f.journal()));
   assertEquals(altered,f.store.records.get(key));f.store.records.put(key,original);
  }
  f.store.records.put(key,"corrupted bytes");denied(()->f.finish(OP));assertEquals("corrupted bytes",f.store.records.get(key));
  assertEquals(0,f.cipher.destroyCalls);
 }
 @Test public void noPrincipalFromStatusOrNonterminalRecord()throws Exception{
  Fixture f=new Fixture(true);f.activate(OP);NativeLegacyLineageJournal.Context c=f.context(OP);
  NativeLegacyLineageJournal.Binding b=f.resolveLegacyLineage(c,OLD.toCharArray());f.journal().captureBinding(c,b);f.journal().captureActivation(c,b);
  assertNull(f.engine().readLegacyPrincipal(f.journal()));assertEquals("delivery_unknown",f.engine().legacyActivationResult(OP,DEVICE,f.journal()));
 }
 @Test public void laterDistinctOperationInvalidatesOldPrincipalWithoutDeletingHistory()throws Exception{
  Fixture f=new Fixture(true);f.activate(OP);f.finish(OP);String previous=f.store.records.get("principal");
  String next=id(5);f.activate(next);f.finish(next);assertNotEquals(previous,f.store.records.get("principal"));
  assertEquals(next,f.engine().readLegacyPrincipal(f.journal()).getString("activation_operation_id"));
  assertEquals("delivery_unknown",f.engine().legacyActivationResult(OP,DEVICE,f.journal()));denied(()->f.finish(OP));
  assertTrue(f.store.records.containsKey("binding:"+OP));assertTrue(f.store.records.containsKey("terminal:"+OP));
 }
 @Test public void installationDigestOrderAndExactNullAreStable()throws Exception{
  Fixture f=new Fixture(true);f.engine().getState();Map<String,Object> i=f.persistence.current().installation.safeRecord();
  assertEquals("2026-07-31T21:52:04Z",i.get("enrolled_at")); // Existing model normalizes input before durable storage.
  String literal=new JSONArray().put("custodial-installation-binding-digest.v1").put(1).put(DEVICE).put(SEAL).put("2026-07-31T21:52:04Z").put(true).put(JSONObject.NULL).toString();
  assertEquals("71bae1e98dc99552d7b4016e81bbb4cd72cc0259af31aafb5db62bb5e15cab42",NativeLegacyLineageJournal.installationDigest(i));
  assertEquals(NativeLegacyLineageJournal.hash(literal),NativeLegacyLineageJournal.installationDigest(i));
  Map<String,Object> reordered=new TreeMap<>(i);assertEquals(NativeLegacyLineageJournal.installationDigest(i),NativeLegacyLineageJournal.installationDigest(reordered));
  for(String field:List.of("device_id","installation_seal","enrolled_at","migrated_from_credential_only_state","enrollment_operation_id")){
   Map<String,Object> altered=new HashMap<>(i);altered.put(field,switch(field){case "device_id"->"KIOSK_09";case "migrated_from_credential_only_state"->false;case "enrollment_operation_id"->id(4);default->i.get(field)+"x";});
   assertNotEquals(NativeLegacyLineageJournal.installationDigest(i),NativeLegacyLineageJournal.installationDigest(altered));
  }
 }
 @Test public void missingKeyStopsRecoveryWithoutJournalOrWorkDestruction()throws Exception{
  Fixture f=new Fixture(true);f.engine().getState();byte[] before=new VaultSnapshotCodec().encode(f.persistence.current());
  f.cipher.makeUnreadable(f.persistence.current().secret);f.cipher.existingKeyUnavailable=true;
  denied(()->f.activate(OP));assertArrayEquals(before,new VaultSnapshotCodec().encode(f.persistence.current()));
  assertTrue(f.store.records.isEmpty());assertEquals(0,f.cipher.destroyCalls);assertEquals(0,f.delegate.issuanceCount.get());
 }
 @Test public void exactTerminalResponseRejectsReceiptAndBindingMutations()throws Exception{
  Fixture f=new Fixture(true);f.activate(OP);f.finish(OP);JSONObject original=f.terminals.get(OP);
  for(String field:NativeLegacyLineageJournal.RECEIPT_KEYS){
   JSONObject changed=new JSONObject(original.toString());changed.getJSONObject("status").getJSONObject("native_receipt").put(field,"wrong");
   f.terminals.put(OP,changed);denied(()->f.finish(OP));f.terminals.put(OP,original);
  }
  JSONObject changed=new JSONObject(original.toString()).put("extra","not allowed");f.terminals.put(OP,changed);denied(()->f.finish(OP));
 }
 @Test public void authenticatedReassignmentInvalidatesButNeverRemintsLegacyPrincipal()throws Exception{
  Fixture f=new Fixture(true);f.activate(OP);f.finish(OP);var journal=f.journal();
  var request=new AuthorizedRequest("/device-auth/status","GET",Map.of(),new byte[0]);
  JSONObject data=new JSONObject().put("authenticated",true).put("canonical_device_id",DEVICE)
   .put("credential_id",id(1)).put("employee_id",id(3)).put("assignment_epoch",7);
  var before=new HashMap<>(f.store.records);
  f.engine().observeLegacyStatus(journal,request,new NativePrincipalJournalTest().response(data));
  assertEquals(before,f.store.records);
  for(JSONObject bad:List.of(new JSONObject(data.toString()).put("assignment_epoch",6),
      new JSONObject(data.toString()).put("authenticated",false),new JSONObject(data.toString()).put("credential_id",id(99)))){
   denied(()->f.engine().observeLegacyStatus(journal,request,new NativePrincipalJournalTest().response(bad)));
   assertEquals(before,f.store.records);
  }
  f.engine().observeLegacyStatus(journal,request,new AuthorizedResponse(503,Map.of(),new byte[0]));
  assertEquals(before,f.store.records);
  f.engine().observeLegacyStatus(journal,request,new NativePrincipalJournalTest().response(data.put("employee_id",id(90)).put("assignment_epoch",8)));
  assertNull(f.engine().readLegacyPrincipal(journal));assertNull(f.engine().readLegacyActivation(journal));
  assertEquals("delivery_unknown",f.engine().legacyActivationResult(OP,DEVICE,journal));
  for(var entry:before.entrySet())assertEquals(entry.getValue(),f.store.records.get(entry.getKey()));
  assertEquals(before.size()+1,f.store.records.size());
  denied(()->f.finish(OP));assertNull(f.engine().readLegacyPrincipal(journal));
  f.engine().observeLegacyStatus(journal,request,new NativePrincipalJournalTest().response(data.put("employee_id",id(3)).put("assignment_epoch",7)));
  assertNull(f.engine().readLegacyPrincipal(journal));assertEquals(0,f.delegate.enrollCalls.get());assertEquals(0,f.cipher.destroyCalls);
  // Even a later malformed/stale terminal cannot roll back the observed epoch.
  f.activate(id(70));denied(()->f.finish(id(70)));assertNull(f.engine().readLegacyPrincipal(journal));
 }
}
