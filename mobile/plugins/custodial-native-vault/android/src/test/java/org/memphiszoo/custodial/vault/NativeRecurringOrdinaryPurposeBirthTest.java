package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual Engine/journal/ordinary encrypted WORK CAS with the existing explicit
 * synthetic enrollment fixture. Reflection READ only. No Runtime/Source/OS,
 * private-custody Current, applied receipt, dispatch or Android qualification. */
public final class NativeRecurringOrdinaryPurposeBirthTest {
    private enum Fault { NONE, OVERLAP, NEWER_ERROR, NEWER_403, TERMINAL_BODY, TARGET_AFTER_PREPARED, PURPOSE_AFTER_PREPARED, TARGET_DURING_LAST_OBSERVATION, PURPOSE_DURING_LAST_OBSERVATION, UNRELATED_AFTER_PREPARED, WRONG_DATABASE_PK }
    private static final class Fixture {
        final NativeRetainedOwnerTest.Fixture original;
        final NativeProviderPrincipal principal;final VaultEngine engine;
        final boolean blocked;final Fault fault;final Map<String,Object> originals;
        int exchanges;AuthorizedResponse actual,nested;VaultFailure nestedFailure;Object nestedBirth;
        boolean mutated;String changedKey;int firstNarrowOwnerSite=-1;
        Fixture(boolean blocked,Fault fault)throws Exception {
            this.blocked=blocked;this.fault=fault;
            original=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            principal=NativeProviderPrincipal.fromNativeJournal(original.principal.readFor(original.engine.getState()));
            originals=new HashMap<>(original.workDisk.memory);
            // Ordinary existing mutation stamp/generation may advance on a real CAS.
            originals.remove(AndroidProtectedWorkPreferences.MUTATION_KEY);
            originals.remove(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
            VaultPersistence persistence=new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure {
                    if(fault==Fault.TERMINAL_BODY&&!mutated&&actual!=null&&purposeCount()>0){mutated=true;actual.body[0]=' ';}
                    if(!mutated&&fault!=Fault.NONE&&purposeCount()>0){
                        try{
                            Object issue=issue();
                            if(issue!=null&&field(issue,"pendingOrdinaryPurpose")!=null){
                                boolean lastObservation=false;
                                for(var frame:Thread.currentThread().getStackTrace())if(frame.getClassName().equals(AndroidOfflineAuthorityTimeStore.class.getName())
                                    &&frame.getMethodName().equals("requireOrdinaryRecurringPreparedCurrent")){
                                        // Distinguish its actual entry-owner callback site
                                        // from its later terminal-owner callback site,
                                        // without pinning absolute source line numbers.
                                        if(firstNarrowOwnerSite<0)firstNarrowOwnerSite=frame.getLineNumber();
                                        lastObservation=frame.getLineNumber()>0&&frame.getLineNumber()!=firstNarrowOwnerSite;
                                    }
                                boolean late=fault==Fault.TARGET_DURING_LAST_OBSERVATION||fault==Fault.PURPOSE_DURING_LAST_OBSERVATION;
                                boolean relevant=fault==Fault.TARGET_AFTER_PREPARED||fault==Fault.PURPOSE_AFTER_PREPARED||late;
                                if((relevant&&(!late||lastObservation))||fault==Fault.UNRELATED_AFTER_PREPARED){
                                    String prefix=fault==Fault.TARGET_AFTER_PREPARED||fault==Fault.TARGET_DURING_LAST_OBSERVATION
                                        ?NativeRecurringTargetJournal.TARGET_PREFIX:NativeRecurringOrdinaryPurposeJournal.PREFIX;
                                    changedKey=fault==Fault.UNRELATED_AFTER_PREPARED?"new-independent-work"
                                        :original.workDisk.memory.keySet().stream().filter(k->k.startsWith(prefix)).findFirst().orElseThrow();
                                    original.workDisk.memory.put(changedKey,"callback changed raw original");
                                    original.workDisk.durable.put(changedKey,"callback changed raw original");mutated=true;
                                }
                            }
                        }catch(Exception malformed){throw new VaultFailure("synthetic_callback_mutation",malformed);}
                    }
                    return original.persistence.load();
                }
                public void commit(long revision,VaultSnapshot next)throws VaultFailure{original.persistence.commit(revision,next);}
            };
            EnrollmentTransport transport=new EnrollmentTransport(){
                public EnrollmentResult enroll(EnrollmentRequest r,char[] c)throws VaultFailure{return original.enrollment.enroll(r,c);}
                public TerminalResult confirm(String o,String d,char[] c)throws VaultFailure{return original.enrollment.confirm(o,d,c);}
                public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure{return original.enrollment.cancel(o,d,c);}
                public TerminalResult remove(String o,String d,char[] c)throws VaultFailure{return original.enrollment.remove(o,d,c);}
                public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure{return original.enrollment.verifyLegacyIdentity(d,c);}
                public ActiveCredentialStatus verifyActiveCredential(String d,String id,char[] c)throws VaultFailure{return original.enrollment.verifyActiveCredential(d,id,c);}
                public AuthorizedResponse authorized(AuthorizedRequest request,String device,char[] credential)throws VaultFailure {
                    original.enrollment.authorized(request,device,credential);int ordinal=++exchanges;
                    if(ordinal==2&&fault==Fault.NEWER_ERROR)throw new VaultFailure("synthetic_original_reply_lost");
                    try{
                        if(ordinal==1&&(fault==Fault.OVERLAP||fault==Fault.NEWER_ERROR||fault==Fault.NEWER_403)){
                            try{nested=read();}catch(VaultFailure failure){nestedFailure=failure;}
                            nestedBirth=birth();
                        }
                        actual=ordinal==2&&fault==Fault.NEWER_403
                            ?new AuthorizedResponse(403,Map.of(),"{\"ok\":false}".getBytes(StandardCharsets.UTF_8))
                            :response(principal,blocked,ordinal>1);
                        if(fault==Fault.WRONG_DATABASE_PK){
                            JSONObject wrong=new JSONObject(new String(actual.body,StandardCharsets.UTF_8));
                            wrong.getJSONObject("data").put("canonical_device_pk","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
                            actual=new AuthorizedResponse(actual.status,actual.headers,wrong.toString().getBytes(StandardCharsets.UTF_8));
                        }
                        return actual;
                    }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw new VaultFailure("synthetic_response",failure);}
                }
            };
            engine=new VaultEngine(persistence,original.vaultCipher,transport,new FakeLegacySource(),new TestSealGenerator(),original.clock,original.work);
        }
        AuthorizedResponse read()throws VaultFailure{return engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]));}
        Object birth()throws Exception{return field(engine,"ordinaryRecurringPurposeBirth");}
        Object issue()throws Exception{return field(engine,"recurringIssuedTargetRead");}
        JSONObject prepared()throws Exception{return new JSONObject((String)field(field(birth(),"prepared"),"record"));}
        long purposeCount(){return original.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX)).count();}
        void preserved(){for(var e:originals.entrySet())assertEquals(e.getValue(),original.workDisk.memory.get(e.getKey()));original.wiped();}
    }
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    private static AuthorizedResponse response(NativeProviderPrincipal principal,boolean blocked,boolean later)throws Exception {
        JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE),p=principal.json();
        JSONObject data=envelope.getJSONObject("data"),meta=envelope.getJSONObject("meta"),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        for(String name:new String[]{"employee_id","credential_id","assignment_epoch"}){data.put(name,p.get(name));meta.put(name,p.get(name));}
        data.put("canonical_device_id",p.get("device_id"));meta.put("canonical_device_id",p.get("device_id"));
        target.put("employeeId",p.get("employee_id")).put("credentialId",p.get("credential_id")).put("assignmentEpoch",p.get("assignment_epoch"));
        JSONObject view=new JSONObject().put("schema","static-weekly.recurring-render-view.v1")
            .put("service_date",target.get("serviceDate")).put("employee_id",target.get("employeeId"))
            .put("employee_name","Synthetic ordinary employee").put("publication_id",target.get("publicationId"))
            .put("projection_id",target.get("projectionId")).put("projection_status","current")
            .put("full_day",true).put("shift",JSONObject.NULL).put("raw_items",new JSONArray().put(new JSONObject()
                .put("id","synthetic-original-task").put("title","Synthetic nonempty source task").put("location","Synthetic location")));
        if(blocked){
            data.put("schedule_delivery_mode","RECURRING_TERMINAL");
            target.put("schema","static-weekly.recurring-terminal-target.v1").put("targetType","BLOCKED_RECURRING_AUTHORITY")
                .put("invalidationId","cccccccc-cccc-4ccc-8ccc-cccccccccccc").put("reasonCode","SOURCE_RETIRED");
            for(String key:new String[]{"projectionId","lunchDocumentIdentity","viewDigest"})target.remove(key);
            delivery.put("replacementCoverageReady",false).put("viewJsonText",JSONObject.NULL).put("view",JSONObject.NULL).put("viewDigest",JSONObject.NULL);
        }else{
            String text=view.toString(),digest=NativeProviderPrincipal.hash(text);
            target.put("viewDigest",digest);delivery.put("view",view).put("viewJsonText",text).put("viewDigest",digest);
        }
        var names=new java.util.ArrayList<String>();target.keys().forEachRemaining(names::add);
        names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder text=new StringBuilder("{");for(String key:names){if(text.length()>1)text.append(", ");Object value=target.get(key);
            text.append(JSONObject.quote(key)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
        delivery.put("targetDigest",NativeProviderPrincipal.hash(text.append('}').toString()));
        return new AuthorizedResponse(200,Map.of("content-type","application/json"),((later?" ":"")+envelope).getBytes(StandardCharsets.UTF_8));
    }
    @Test public void ordinaryEnrollmentBirthPublishesOnlyActualCompletedPreparedDataWithNonemptyView()throws Exception {
        var f=new Fixture(false,Fault.NONE);var response=f.read();Object birth=f.birth();assertNotNull(birth);
        assertSame(f.engine,field(birth,"owner"));assertSame(f.issue(),field(birth,"issue"));assertEquals(Boolean.TRUE,field(f.issue(),"completed"));
        assertNull(field(f.issue(),"pendingOrdinaryPurpose"));assertNull(field(f.issue(),"pendingOrdinaryTarget"));
        JSONObject row=f.prepared();assertEquals(row.getJSONObject("target").get("deviceId"),row.get("canonical_device_pk"));
        assertNotEquals(row.getJSONObject("principal").get("device_id"),row.get("canonical_device_pk"));
        assertEquals("PREPARED",row.get("state"));assertEquals(Boolean.FALSE,row.get("receipt_eligible"));
        assertEquals(NativeRetainedAttempt.hash(response.body),row.get("prepared_native_response_sha256"));assertEquals(1,f.purposeCount());
        assertEquals(1,new JSONObject(response.body==null?"":new String(response.body,StandardCharsets.UTF_8)).getJSONObject("data")
            .getJSONObject("recurring_delivery").getJSONObject("view").getJSONArray("raw_items").length());
        assertFalse(row.has("applied_at"));assertFalse(row.has("receipt_body"));assertFalse(row.has("native_current"));f.preserved();
    }
    @Test public void preparedWriteCannotPublishBirthBeforeActualOriginalCompletion()throws Exception {
        var f=new Fixture(false,Fault.NONE);int[] observed={0};
        f.original.workDisk.afterCommit=()->{if(f.purposeCount()>0){
            observed[0]++;assertNull(f.birth());assertEquals(Boolean.FALSE,field(f.issue(),"completed"));
        }};
        f.read();assertTrue(observed[0]>0);assertNotNull(f.birth());assertEquals(Boolean.TRUE,field(f.issue(),"completed"));f.preserved();
    }
    @Test public void actualWrongCanonicalDatabaseUuidRefusesAtGenuineTargetFactory()throws Exception {
        var f=new Fixture(false,Fault.WRONG_DATABASE_PK);assertThrows(VaultFailure.class,f::read);
        assertNull(f.birth());assertEquals(0,f.purposeCount());assertEquals(1,f.exchanges);f.preserved();
    }
    @Test public void blockedTargetBirthUsesExactBlockedDigestWithoutViewOrEffectClaim()throws Exception {
        var f=new Fixture(true,Fault.NONE);f.read();JSONObject row=f.prepared();assertEquals("BLOCKED_RECURRING_AUTHORITY",row.getJSONObject("target").get("targetType"));
        assertEquals(row.get("target_digest"),row.get("rendered_digest"));assertEquals(1,f.purposeCount());f.preserved();
    }
    @Test public void laterGenuineWireKeepsFirstTargetAndPurposeWhileLatestOwnerIsNew()throws Exception {
        var f=new Fixture(false,Fault.NONE);var first=f.read();Object birth=f.birth();String original=f.prepared().toString();var before=new HashMap<>(f.original.workDisk.memory);
        var later=f.read();assertNotSame(birth,f.birth());assertNotEquals(NativeRetainedAttempt.hash(first.body),NativeRetainedAttempt.hash(later.body));
        assertEquals(original,f.prepared().toString());assertEquals(before,f.original.workDisk.memory);
        Object target=field(f.birth(),"target");assertEquals(NativeRetainedAttempt.hash(later.body),field(target,"actualNativeResponseSha256"));
        assertEquals(NativeRetainedAttempt.hash(first.body),f.prepared().get("first_target_native_response_sha256"));f.preserved();
    }
    @Test public void overlappingNewerCompletionCannotBeReplacedByOlderResponse()throws Exception {
        var f=new Fixture(false,Fault.OVERLAP);var outer=f.read();assertSame(f.nestedBirth,f.birth());assertNotNull(f.birth());
        assertSame(f.nested,field(field(f.birth(),"target"),"actualResponse"));assertNotEquals(NativeRetainedAttempt.hash(outer.body),f.prepared().get("prepared_native_response_sha256"));f.preserved();
    }
    @Test public void newerOriginalErrorKeepsNoBirthDespiteOlderSuccess()throws Exception {
        var f=new Fixture(false,Fault.NEWER_ERROR);assertEquals(200,f.read().status);assertNotNull(f.nestedFailure);assertNull(f.birth());assertEquals(Boolean.TRUE,field(f.issue(),"failed"));f.preserved();
    }
    @Test public void newer403IsOrdinaryResponseNotPreparedAuthority()throws Exception {
        var f=new Fixture(false,Fault.NEWER_403);assertEquals(200,f.read().status);assertEquals(403,f.nested.status);assertEquals("{\"ok\":false}",new String(f.nested.body,StandardCharsets.UTF_8));assertNull(f.birth());f.preserved();
    }
    @Test public void terminalActualResponseMutationPreservesPreparedOriginalButRefusesOwner()throws Exception {
        var f=new Fixture(false,Fault.TERMINAL_BODY);assertThrows(VaultFailure.class,f::read);assertTrue(f.mutated);assertNull(f.birth());assertEquals(1,f.purposeCount());f.preserved();
    }
    @Test public void changedKnownPurposeCiphertextIsNeverOverwrittenOrAcknowledged()throws Exception {
        var f=new Fixture(false,Fault.NONE);f.read();String key=(String)field(field(f.birth(),"prepared"),"key");
        f.original.workDisk.memory.put(key,"changed original ciphertext");f.original.workDisk.durable.put(key,"changed original ciphertext");
        var before=new HashMap<>(f.original.workDisk.memory);assertEquals(200,f.read().status);assertNull(f.birth());assertEquals(before,f.original.workDisk.memory);f.preserved();
    }
    @Test public void purposeCapacityPreservesAllOldOriginalsAndLeavesNormalResponsePending()throws Exception {
        var f=new Fixture(false,Fault.NONE);for(int i=0;i<256;i++){
            String key=NativeRecurringOrdinaryPurposeJournal.PREFIX+String.format("%064x",i);
            f.original.workDisk.memory.put(key,"unknown original purpose "+i);f.original.workDisk.durable.put(key,"unknown original purpose "+i);
        }
        var before=new HashMap<>(f.original.workDisk.memory);assertEquals(200,f.read().status);assertNull(f.birth());assertEquals(256,f.purposeCount());
        String beforeEpoch=AndroidProtectedWorkPreferences.durableEpoch(before);
        String afterEpoch=AndroidProtectedWorkPreferences.durableEpoch(f.original.workDisk.memory);
        assertTrue(Long.parseLong(afterEpoch)>Long.parseLong(beforeEpoch));
        String afterGeneration=(String)f.original.workDisk.memory.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        VaultValidation.operationId(afterGeneration);
        assertNotEquals(before.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY),afterGeneration);
        before.remove(AndroidProtectedWorkPreferences.MUTATION_KEY);before.remove(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        for(var e:before.entrySet())assertEquals(e.getValue(),f.original.workDisk.memory.get(e.getKey()));
        var targetRows=f.original.work.recurringRecords();assertEquals(2,targetRows.size());
        assertEquals(1,targetRows.keySet().stream().filter(k->k.startsWith(NativeRecurringTargetJournal.TARGET_PREFIX)).count());
        assertEquals(1,targetRows.keySet().stream().filter(k->k.startsWith(NativeRecurringTargetJournal.VIEW_PREFIX)).count());f.preserved();
    }
    @Test public void terminalOwnerCallbackChangedTargetCannotPublishPreparedBirth()throws Exception {changedRelevant(Fault.TARGET_AFTER_PREPARED);}
    @Test public void terminalOwnerCallbackChangedPurposeCannotPublishPreparedBirth()throws Exception {changedRelevant(Fault.PURPOSE_AFTER_PREPARED);}
    @Test public void lastNarrowOwnerCallbackChangedTargetCannotBorrowEarlierObservation()throws Exception {changedRelevant(Fault.TARGET_DURING_LAST_OBSERVATION);}
    @Test public void lastNarrowOwnerCallbackChangedPurposeCannotBorrowEarlierObservation()throws Exception {changedRelevant(Fault.PURPOSE_DURING_LAST_OBSERVATION);}
    private static void changedRelevant(Fault fault)throws Exception {
        var f=new Fixture(false,fault);AuthorizedResponse actual=f.read();assertEquals(200,actual.status);assertTrue(f.mutated);
        assertNull(f.birth());assertEquals(Boolean.TRUE,field(f.issue(),"completed"));assertEquals(Boolean.FALSE,field(f.issue(),"failed"));
        assertNull(field(f.issue(),"pendingOrdinaryPurpose"));assertEquals("callback changed raw original",f.original.workDisk.memory.get(f.changedKey));
        assertEquals("callback changed raw original",f.original.workDisk.durable.get(f.changedKey));assertEquals(1,f.purposeCount());f.preserved();
    }
    @Test public void unrelatedLiveWorkBeforeNarrowObservationIsPreservedWithoutGlobalFreeze()throws Exception {
        var f=new Fixture(false,Fault.UNRELATED_AFTER_PREPARED);assertEquals(200,f.read().status);assertTrue(f.mutated);assertNotNull(f.birth());
        assertEquals("callback changed raw original",f.original.workDisk.memory.get("new-independent-work"));f.preserved();
    }
    @Test public void epochHasExactIntegerMeaningAcrossParserBoxesButNeverDecimalOrStringCoercion()throws Exception {
        var f=new Fixture(false,Fault.NONE);f.read();JSONObject row=f.prepared();String key=(String)field(field(f.birth(),"prepared"),"key");
        NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,row.toString());
        for(Object invalid:new Object[]{7.0,"7"}){
            JSONObject changed=new JSONObject(row.toString()),target=changed.getJSONObject("target").put("assignmentEpoch",invalid);
            var names=new java.util.ArrayList<String>();target.keys().forEachRemaining(names::add);
            names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
            StringBuilder text=new StringBuilder("{");for(String name:names){if(text.length()>1)text.append(", ");Object value=target.get(name);
                text.append(JSONObject.quote(name)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
            String canonical=text.append('}').toString();changed.put("target_text",canonical).put("target_digest",NativeProviderPrincipal.hash(canonical));
            String raw=changed.toString();
            if(invalid instanceof Double){
                // Official JSONObject normalizes 7.0 to 7 on output. Preserve
                // the hostile DECIMAL wire token in the target object itself.
                String integer="\"assignmentEpoch\":7";
                assertEquals(1,(raw.length()-raw.replace(integer,"").length())/integer.length());
                raw=raw.replace(integer,"\"assignmentEpoch\":7.0");
            }
            final String supplied=raw;
            assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,supplied));
        }
        f.preserved();
    }
    @Test public void copiedPreparedRecordCannotChangeOriginalPrincipalTargetOrWireAndGenericReceiptStaysDenied()throws Exception {
        var f=new Fixture(false,Fault.NONE);f.read();Object birth=f.birth();JSONObject row=f.prepared();String key=(String)field(field(birth,"prepared"),"key");
        JSONObject changed=new JSONObject(row.toString()).put("target_digest","f".repeat(64));assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,changed.toString()));
        JSONObject wrongPk=new JSONObject(row.toString()).put("canonical_device_pk","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,wrongPk.toString()));
        JSONObject successor=new JSONObject(row.toString()).put("first_target_native_response_sha256","f".repeat(64));assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryPurposeJournal.requireSamePrepared(key,row.toString(),successor.toString()));
        assertThrows(VaultFailure.class,()->f.engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary/delivery-receipt","POST",Map.of(),"{}".getBytes(StandardCharsets.UTF_8))));
        assertEquals(1,f.exchanges);assertSame(birth,f.birth());f.preserved();
    }
}
