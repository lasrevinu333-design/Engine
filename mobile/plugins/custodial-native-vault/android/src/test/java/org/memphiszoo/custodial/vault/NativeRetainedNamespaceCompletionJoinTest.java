package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW actual owning Android-store/native-HMAC/engine composition only.
 * Preferences, enrollment, crypto key and provider generation are synthetic.
 * No network, SQL, runtime mount, browser admission, keystore/device or finalizer. */
public final class NativeRetainedNamespaceCompletionJoinTest {
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--browser-candidates-renderer-join-only".equals(args[0])){
            new NativeRetainedNamespaceCompletionJoinTest().BROWSER_ALL8_RENDERER_actualProducerProjectionIsTruthfulAndPrivate();
            System.out.println("PASS_SOURCE_MOCK BROWSER_ALL8_RENDERER_actualProducerProjectionIsTruthfulAndPrivate scenarios=3 Android=false auth=false effects=false");
            return;
        }
        if(args.length==1&&"--browser-candidates-all8-only".equals(args[0])){
            var test=new NativeRetainedNamespaceCompletionJoinTest();
            for(String name:new String[]{"BROWSER_ALL8_nativeOriginalAndMatchingCandidateRemainUnaccepted",
                "BROWSER_ALL8_legacyBindingRemainsUnauthenticated", "BROWSER_ALL8_duplicateForeignMalformedAndUnmatchedRetained",
                "BROWSER_ALL8_unreadableAndFixedReadKeepOriginals", "BROWSER_ALL8_originalWithdrawalRefuses",
                "BROWSER_ALL8_candidateClosureAndCountsRefuseCorruption"}){
                try{NativeRetainedNamespaceCompletionJoinTest.class.getMethod(name).invoke(test);}
                catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
                System.out.println("PASS_SOURCE_MOCK "+name);
            }
            return;
        }
        if(args.length==2&&"--fixed-read-all8-only".equals(args[0])){
            if(!java.util.Set.of("FIXED_READ_ALL8_sameCapturedProjectionRendersWithoutAuthority",
                "FIXED_READ_ALL8_withdrawnSourceRefusesHeldJoin").contains(args[1]))throw new IllegalArgumentException("new fixed-read all8 member required");
            try{NativeRetainedNamespaceCompletionJoinTest.class.getMethod(args[1]).invoke(new NativeRetainedNamespaceCompletionJoinTest());}
            catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(args[1],error.getCause());}
            System.out.println("PASS_SOURCE_MOCK "+args[1]);return;
        }
        if(args.length!=1||!"--local-journal-dispositions-only".equals(args[0]))throw new IllegalArgumentException("focused selector required");
        var test=new NativeRetainedNamespaceCompletionJoinTest();
        for(String name:new String[]{"LOCAL_DISPOSITION_originalWriteQueryAndBatchFactsRemainUnaccepted",
            "LOCAL_DISPOSITION_cachedUnknownQueryRemainsHistoricalAndUnresolved",
            "LOCAL_DISPOSITION_orphanMalformedAndUnboundOriginalRowsRemainUnreconciled"}){
            try{NativeRetainedNamespaceCompletionJoinTest.class.getMethod(name).invoke(test);}
            catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
            System.out.println("PASS_SOURCE_MOCK "+name);
        }
    }
    @Test public void BROWSER_ALL8_RENDERER_actualProducerProjectionIsTruthfulAndPrivate()throws Exception {
        // New joined workflow only: actual Engine -> actual shipping renderer,
        // never synthesized semantic JSON or a copied presentation fixture.
        for(int mode:new int[]{0,1,3}){
            var f=new Fixture(mode);var owner=f.completion.owner;
            byte[] original=f.completion.candidate(),originalCopy=original.clone(),malformed={0};
            var rawBefore=new TreeMap<String,Map<String,?>>();f.raw.forEach((k,v)->rawBefore.put(k,new HashMap<>(v)));
            var durableBefore=new HashMap<>(owner.workDisk.durable);
            int commits=owner.workDisk.commits,encrypts=owner.workCipher.delegate.existingKeyEncryptCalls;
            int providerCommits=f.providerStore.memory.commits,keys=f.providerStore.keys.creations;
            try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
                var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);
                var joined=candidateJoin(f,s,java.util.List.of(original,malformed))){
                JSONObject projection=joined.projection();String exact=projection.toString();noAuthority(projection);
                assertEquals(8,projection.getJSONArray("namespaces").length());
                assertEquals(mode==3?0:1,projection.getInt("matched_completion_count"));
                assertEquals(mode==3?0:3,projection.getInt("completion_semantic_joined_record_count"));
                assertEquals(2,projection.getInt("argument_candidate_count"));
                assertEquals(mode==3?2:1,projection.getInt("unresolved_argument_candidate_count"));
                assertEquals("UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED",
                    projection.getJSONArray("argument_candidates").getJSONObject(1).get("state"));
                if(mode==0)assertEquals("CAPTURED_NATIVE_ORIGINAL_V3_VALUES",completionRow(projection).get("argument_provenance"));
                if(mode==1)assertEquals("BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE",completionRow(projection).get("argument_provenance"));
                if(mode==3)assertEquals("INVALID_OR_UNREADABLE_COMPLETION_RETAINED",completionRow(projection).get("state"));

                String text=NativeManagerInventoryPresentation.completionSummary(projection);
                assertEquals(exact,projection.toString());assertEquals(exact,joined.projection().toString());
                assertTrue(text.contains("Browser argument candidates: retained 2, unresolved retained "+(mode==3?2:1)));
                assertTrue(text.contains("Source-unverified; NOT accepted work or browser authentication."));
                assertTrue(text.contains("matched original completion/session triples "+(mode==3?0:1)));
                assertTrue(text.contains("NOT eligibility, current server acceptance, browser authentication/inventory"));
                assertTrue(text.contains("No ACK, work acceptance, resend, finalizer, key-removal, phone-release, or other effect rights."));
                if(mode==1){
                    assertTrue(text.contains("Legacy-v2 browser-argument binding matches: 1"));
                    assertTrue(text.contains("Source-unverified; NOT native-v3 acceptance."));
                }else assertFalse(text.contains("Legacy-v2 browser-argument binding matches:"));
                for(int i=0;i<projection.getJSONArray("argument_candidates").length();i++){
                    JSONObject candidate=projection.getJSONArray("argument_candidates").getJSONObject(i);
                    assertEquals(false,candidate.get("source_authenticated"));
                    assertFalse(text.contains(candidate.getString("argument_values_sha256")));
                }
                for(int i=0;i<projection.getJSONArray("records").length();i++){
                    JSONObject row=projection.getJSONArray("records").getJSONObject(i);
                    for(String flag:new String[]{"cutoff_eligible","browser_source_authenticated","current_server_readback",
                        "inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal"})assertEquals(false,row.get(flag));
                    assertFalse(text.contains(row.getString("raw_identity_sha256")));
                }
                for(String field:new String[]{"original_generation_id","principal_digest","source_capture_sha256","values_sha256",
                    "original_source_join_sha256","completion_reconciliation_sha256","original_signed_manifest_sha256"})
                    assertFalse(text.contains(projection.getString(field)));
                for(String field:new String[]{"p_client_session_id","p_client_completion_id","p_native_completion_attestation"})
                    assertFalse(text.contains(f.completion.args.getString(field)));
                for(String raw:new String[]{"argument_values_sha256","original_request_body_base64","installation_seal","services_performed",
                    new String(original,java.nio.charset.StandardCharsets.UTF_8)})assertFalse(text.contains(raw));
                assertEquals(rawBefore,f.raw);assertEquals(durableBefore,owner.workDisk.durable);
                assertEquals(commits,owner.workDisk.commits);assertEquals(encrypts,owner.workCipher.delegate.existingKeyEncryptCalls);
                assertEquals(providerCommits,f.providerStore.memory.commits);assertEquals(keys,f.providerStore.keys.creations);
                assertArrayEquals(originalCopy,original);assertArrayEquals(new byte[]{0},malformed);
                assertEquals(0,owner.opened);assertEquals(0,owner.ids);owner.wiped();
            }finally{Arrays.fill(original,(byte)0);Arrays.fill(originalCopy,(byte)0);Arrays.fill(malformed,(byte)0);}
        }
    }
    /** Calls only the exact shipping private overload on this test's existing
     * owning Engine/semantic fixture. No native handle is constructed here. */
    private static VaultEngine.NativeRetainedNamespaceCompletionObservation candidateJoin(Fixture f,
        VaultEngine.NativeRetainedNamespaceSemanticObservation source,java.util.List<byte[]> candidates)throws Exception {
        var method=VaultEngine.class.getDeclaredMethod("inspectOriginalAll8CompletionSemantics",
            VaultEngine.NativeRetainedNamespaceSemanticObservation.class,java.util.List.class);
        method.setAccessible(true);
        try{return (VaultEngine.NativeRetainedNamespaceCompletionObservation)method.invoke(f.engine,source,candidates);}
        catch(java.lang.reflect.InvocationTargetException error){
            if(error.getCause() instanceof Exception)throw (Exception)error.getCause();throw error;
        }
    }
    private static JSONObject inspectCandidates(Fixture f,java.util.List<byte[]> candidates)throws Exception {
        var before=new TreeMap<String,Map<String,?>>();f.raw.forEach((k,v)->before.put(k,new HashMap<>(v)));
        var exactCandidates=new java.util.ArrayList<byte[]>();for(byte[] candidate:candidates)exactCandidates.add(candidate.clone());
        var owner=f.completion.owner;int commits=owner.workDisk.commits,encrypts=owner.workCipher.delegate.existingKeyEncryptCalls;
        int providerCommits=f.providerStore.memory.commits,keys=f.providerStore.keys.creations;
        try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
            var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);var joined=candidateJoin(f,s,candidates)){
            JSONObject p=joined.projection();noAuthority(p);assertEquals(8,p.getJSONArray("namespaces").length());
            assertEquals(before,f.raw);assertEquals(commits,owner.workDisk.commits);assertEquals(encrypts,owner.workCipher.delegate.existingKeyEncryptCalls);
            assertEquals(providerCommits,f.providerStore.memory.commits);assertEquals(keys,f.providerStore.keys.creations);
            assertEquals(0,owner.opened);assertEquals(0,owner.ids);owner.wiped();
            for(int i=0;i<candidates.size();i++)assertArrayEquals(exactCandidates.get(i),candidates.get(i));
            if(!candidates.isEmpty()){
                assertEquals(candidates.size(),p.getInt("argument_candidate_count"));
                assertEquals(candidates.size(),p.getJSONArray("argument_candidates").length());
                int unresolved=0;for(int i=0;i<candidates.size();i++){
                    JSONObject row=p.getJSONArray("argument_candidates").getJSONObject(i);assertEquals(3,row.length());
                    assertEquals(NativeRetainedAttempt.hash(candidates.get(i)),row.get("argument_values_sha256"));
                    assertEquals(false,row.get("source_authenticated"));
                    if(!"ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE".equals(row.get("state")))unresolved++;
                }
                assertEquals(unresolved,p.getInt("unresolved_argument_candidate_count"));
                p.getJSONArray("argument_candidates").getJSONObject(0).put("source_authenticated",true);
                assertEquals(false,joined.projection().getJSONArray("argument_candidates").getJSONObject(0).get("source_authenticated"));
                p=joined.projection();
            }
            assertEquals(candidateDigest(p),p.get("completion_reconciliation_sha256"));
            return p;
        }finally{for(byte[] bytes:exactCandidates)Arrays.fill(bytes,(byte)0);}
    }
    private static JSONObject completionRow(JSONObject p)throws Exception {
        for(int i=0;i<p.getJSONArray("records").length();i++){
            JSONObject row=p.getJSONArray("records").getJSONObject(i);
            if(row.has("native_completion_semantics")&&"COMPLETION_RECEIPT".equals(row.getJSONObject("native_completion_semantics").get("kind")))
                return row.getJSONObject("native_completion_semantics");
        }throw new AssertionError("original receipt row absent");
    }
    private static void candidateHashText(java.security.MessageDigest digest,String value){
        for(int shift=24;shift>=0;shift-=8)digest.update((byte)(value.length()>>>shift));
        for(int i=0;i<value.length();i++){char c=value.charAt(i);digest.update((byte)(c>>>8));digest.update((byte)c);}
    }
    private static String candidateDigest(JSONObject p)throws Exception {
        var digest=java.security.MessageDigest.getInstance("SHA-256");
        for(String field:new String[]{"schema","source_capture_sha256","values_sha256","original_source_join_sha256",
            "original_signed_manifest_sha256","principal_digest","original_generation_id"})candidateHashText(digest,p.getString(field));
        candidateHashText(digest,Long.toString(p.getLong("engine_revision")));
        for(int i=0;i<p.getJSONArray("records").length();i++){
            JSONObject row=p.getJSONArray("records").getJSONObject(i);
            for(String field:new String[]{"namespace","raw_identity_sha256","application_semantic_disposition"})candidateHashText(digest,row.getString(field));
            if(row.has("native_completion_semantics")){
                JSONObject completion=row.getJSONObject("native_completion_semantics");var fields=new java.util.TreeSet<String>();
                completion.keys().forEachRemaining(fields::add);for(String field:fields){candidateHashText(digest,field);candidateHashText(digest,completion.get(field).toString());}
            }
        }
        if(p.has("argument_candidates")){
            candidateHashText(digest,"browser_argument_candidates.v1");candidateHashText(digest,Integer.toString(p.getInt("argument_candidate_count")));
            candidateHashText(digest,Integer.toString(p.getInt("unresolved_argument_candidate_count")));
            for(int i=0;i<p.getJSONArray("argument_candidates").length();i++){
                JSONObject row=p.getJSONArray("argument_candidates").getJSONObject(i);
                candidateHashText(digest,row.getString("argument_values_sha256"));candidateHashText(digest,row.getString("state"));candidateHashText(digest,"false");
            }
        }
        return java.util.HexFormat.of().formatHex(digest.digest());
    }
    @Test public void BROWSER_ALL8_nativeOriginalAndMatchingCandidateRemainUnaccepted()throws Exception {
        var f=new Fixture(0);byte[] candidate=f.completion.candidate();
        try{
            JSONObject zero=inspectCandidates(f,java.util.List.of());
            assertFalse(zero.has("argument_candidates"));assertFalse(zero.has("argument_candidate_count"));
            assertFalse(zero.has("unresolved_argument_candidate_count"));
            JSONObject p=inspectCandidates(f,java.util.List.of(candidate));
            assertEquals(1,p.getInt("matched_completion_count"));assertEquals(3,p.getInt("completion_semantic_joined_record_count"));
            assertEquals(0,p.getInt("unresolved_argument_candidate_count"));
            assertEquals("CAPTURED_NATIVE_ORIGINAL_V3_VALUES",completionRow(p).get("argument_provenance"));
            assertNotEquals(zero.get("completion_reconciliation_sha256"),p.get("completion_reconciliation_sha256"));
            assertEquals(zero.get("source_capture_sha256"),p.get("source_capture_sha256"));
            assertEquals(zero.get("values_sha256"),p.get("values_sha256"));
            assertEquals(zero.get("original_source_join_sha256"),p.get("original_source_join_sha256"));
            assertEquals(p.get("completion_reconciliation_sha256"),inspectCandidates(f,java.util.List.of(candidate)).get("completion_reconciliation_sha256"));
        }finally{Arrays.fill(candidate,(byte)0);}
    }
    @Test public void BROWSER_ALL8_legacyBindingRemainsUnauthenticated()throws Exception {
        var f=new Fixture(1);String saved=f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey);
        byte[] candidate=f.completion.candidate();
        try{
            JSONObject p=inspectCandidates(f,java.util.List.of(candidate));
            assertEquals("BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE",completionRow(p).get("argument_provenance"));
            assertEquals(1,p.getInt("matched_completion_count"));assertEquals(3,p.getInt("completion_semantic_joined_record_count"));
            assertEquals(false,p.getJSONArray("argument_candidates").getJSONObject(0).get("source_authenticated"));
            assertEquals("UNKNOWN",p.get("browser_inventory_state"));
            assertFalse(new JSONObject(saved).has("original_request_body_base64"));
            assertEquals(saved,f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey));
        }finally{Arrays.fill(candidate,(byte)0);}
    }
    @Test public void BROWSER_ALL8_duplicateForeignMalformedAndUnmatchedRetained()throws Exception {
        var f=new Fixture(0);byte[] original=f.completion.candidate();
        byte[] foreign=new JSONObject(f.completion.args.toString()).put("p_device_id","KIOSK_09").toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] unmatched=new JSONObject(f.completion.args.toString()).put("p_client_completion_id",NativeSeparationContextTest.id(92)).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] malformed={0};
        try{
            JSONObject duplicate=inspectCandidates(f,java.util.List.of(original,original));
            assertEquals(0,duplicate.getInt("matched_completion_count"));assertEquals(2,duplicate.getInt("unresolved_argument_candidate_count"));
            assertEquals("AMBIGUOUS_ARGUMENT_CANDIDATE_RETAINED",duplicate.getJSONArray("argument_candidates").getJSONObject(0).get("state"));
            JSONObject other=inspectCandidates(f,java.util.List.of(foreign,malformed,unmatched));
            assertEquals(3,other.getInt("unresolved_argument_candidate_count"));
            assertEquals("UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED",other.getJSONArray("argument_candidates").getJSONObject(0).get("state"));
            assertEquals("UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED",other.getJSONArray("argument_candidates").getJSONObject(1).get("state"));
            assertEquals("UNMATCHED_ARGUMENT_CANDIDATE_RETAINED",other.getJSONArray("argument_candidates").getJSONObject(2).get("state"));
            JSONObject reverse=inspectCandidates(f,java.util.List.of(unmatched,malformed,foreign));
            assertNotEquals(other.get("completion_reconciliation_sha256"),reverse.get("completion_reconciliation_sha256"));
        }finally{for(byte[] bytes:new byte[][]{original,foreign,unmatched,malformed})Arrays.fill(bytes,(byte)0);}
    }
    @Test public void BROWSER_ALL8_unreadableAndFixedReadKeepOriginals()throws Exception {
        for(int mode:new int[]{3,6}){
            var f=new Fixture(mode);byte[] candidate=f.completion.candidate();
            String saved=mode==6?f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey):null;
            try{
                JSONObject p=inspectCandidates(f,java.util.List.of(candidate));
                if(mode==3){assertEquals(0,p.getInt("matched_completion_count"));assertEquals(1,p.getInt("unresolved_argument_candidate_count"));}
                else{
                    assertEquals("CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN",completionRow(p).get("argument_provenance"));
                    assertEquals(saved,f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey));
                    assertEquals("UNKNOWN",new JSONObject(saved).getJSONObject("provenance").get("original_write_wire_state"));
                    assertFalse(new JSONObject(saved).has("original_request_body_base64"));
                }
            }finally{Arrays.fill(candidate,(byte)0);}
        }
    }
    @Test public void BROWSER_ALL8_originalWithdrawalRefuses()throws Exception {
        for(int fault=0;fault<3;fault++){
            var f=new Fixture(0);byte[] candidate=f.completion.candidate();
            var exact=new HashMap<>(f.completion.owner.workDisk.memory);int commits=f.completion.owner.workDisk.commits;
            try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
                var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);var joined=candidateJoin(f,s,java.util.List.of(candidate))){
                noAuthority(joined.projection());
                if(fault==0)f.completion.owner.bumpVault();
                else if(fault==1)((Map<String,Object>)f.raw.get("MemphisZooCustodialNativeVaultV1")).put("changed-original","retained");
                else s.close();
                denied(joined::projection);denied(()->candidateJoin(f,s,java.util.List.of(candidate)));
                assertEquals(exact,f.completion.owner.workDisk.memory);assertEquals(commits,f.completion.owner.workDisk.commits);assertEquals(0,f.completion.owner.opened);
            }finally{Arrays.fill(candidate,(byte)0);}
        }
    }
    @Test public void BROWSER_ALL8_candidateClosureAndCountsRefuseCorruption()throws Exception {
        for(int fault=0;fault<12;fault++){
            var f=new Fixture(0);var owner=f.completion.owner;byte[] candidate=f.completion.candidate();
            try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
                var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch)){
                var work=NativeRetainedWorkCapture.capture(owner.work);var principal=NativeProviderPrincipal.fromNativeJournal(owner.principal.readFor(f.engine.getState()));
                char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
                try{
                    var proof=NativeSeparationEvidence.restore(work.wire(),principal,work.values.snapshot(),credential);
                    var census=owner.work.inspectRetainedCompletionCensus(work.original,proof,java.util.List.of(candidate),credential);final int mode=fault;
                    // Existing test-only encoded-result fault seam; never constructs an Engine capability.
                    NativeRetainedNamespaceSemanticJoinTest.mutate(census,j->{
                        var row=j.getJSONArray("argument_candidates").getJSONObject(0);
                        if(mode==0)j.put("argument_candidate_count",4097);if(mode==1)j.put("argument_candidate_count",-1);
                        if(mode==2)j.put("argument_candidate_count","1");if(mode==3)j.put("argument_candidate_count",2);
                        if(mode==4)j.put("unresolved_argument_candidate_count",1);if(mode==5)row.put("source_authenticated",true);
                        if(mode==6)row.put("source_authenticated","false");if(mode==7)row.put("extra",false);
                        if(mode==8)row.remove("state");if(mode==9)row.put("state","AUTHENTICATED");
                        if(mode==10)row.put("argument_values_sha256","not-a-hash");if(mode==11)j.put("unresolved_argument_candidate_count",-1);
                    });
                    var field=s.getClass().getDeclaredField("joined");field.setAccessible(true);
                    var source=(NativeRetainedNamespaceSemanticJoin.Observation)field.get(s);
                    try(var values=NativeRetainedNamespaceValues.capture(f.raw,n.digest)){
                        denied(()->NativeRetainedNamespaceCompletionJoin.inspect(f.raw,n.digest,work,values,source,census,proof,principal,
                            owner.persistence.current().revision,f.admitted.generationId));
                    }
                }finally{VaultValidation.wipe(credential);}
            }finally{Arrays.fill(candidate,(byte)0);}
        }
    }
    static final class Fixture {
        final NativeRetainedCompletionSemanticsTest.Fixture completion=new NativeRetainedCompletionSemanticsTest.Fixture();
        final ProviderRecordStoreTest.Fixture providerStore=new ProviderRecordStoreTest.Fixture();
        final NativeProviderJournal provider=new NativeProviderJournal(providerStore.store(),providerStore.lock);
        final Map<String,Map<String,?>> raw=new TreeMap<>();final Map<String,Object> vault=new HashMap<>();
        NativeProviderJournal.Prepared admitted;NativeRetainedBatchJournal batch;VaultEngine engine;
        NativeSeparationFreeze.Store work;
        Fixture(int mode)throws Exception {
            if(mode==6)NativeRetainedCompletionCensusTest.captureFixedOriginal(completion,null,false);
            else completion.record(mode==1);
            if(mode==2)completion.owner.workDisk.memory.remove(completion.key(true));
            if(mode==3)completion.owner.workDisk.memory.put(NativeRetainedCompletionSemanticsTest.PREFIX+completion.receiptKey,"corrupt retained receipt");
            if(mode==4)NativeRetainedCompletionCensusTest.anotherReceipt(completion,true);
            if(mode==5)NativeRetainedCompletionCensusTest.anotherReceipt(completion,false);
            completion.owner.workDisk.memory.put("unknown-typed-original",Float.intBitsToFloat(0x7fc00001));completion.freeze();
            var owner=completion.owner;work=owner.work;
            var principal=NativeProviderPrincipal.fromNativeJournal(owner.principal.readFor(owner.engine.getState()));
            provider.observeActivePrincipal(principal);provider.captureToken("synthetic-local-completion-token");
            admitted=provider.prepareRegistration(principal,NativeOriginalGenerationObservationTest.app());
            admitted=provider.confirmRegistration(principal,admitted,NativeProviderRegistrationReceipt.validateResponse(admitted,
                NativeOriginalGenerationObservationTest.response(NativeOriginalGenerationObservationTest.admission(admitted,null,NativeOriginalGenerationObservationTest.BEFORE))));
            byte[] bytes=new VaultSnapshotCodec().encode(owner.persistence.current());
            try{vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,Base64.getEncoder().encodeToString(bytes));}finally{Arrays.fill(bytes,(byte)0);}
            SharedPreferences prefs=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(p,m,a)->{
                if(!m.getName().equals("getAll"))throw new AssertionError("no vault writer");return new HashMap<>(vault);
            });
            var persistence=new SharedPreferencesVaultPersistence(prefs,new VaultSnapshotCodec());
            engine=new VaultEngine(new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure{return owner.persistence.load();}
                public void commit(long e,VaultSnapshot next){throw new AssertionError("no vault commit");}
                public boolean matchesCapturedOriginalSnapshot(Map<String,?> capture,VaultSnapshot original)throws VaultFailure{return persistence.matchesCapturedOriginalSnapshot(capture,original);}
            },owner.vaultCipher,owner.enrollment,new FakeLegacySource(),new TestSealGenerator(),owner.clock);
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())raw.put(name,new HashMap<>());
            raw.put(NativeVaultProviderReferenceCensus.VAULT,vault);raw.put(NativeVaultProviderReferenceCensus.PROVIDER,providerStore.memory.raw);
            raw.put(NativeRetainedNamespaceCensus.WORK,owner.workDisk.memory);raw.put(NativeRetainedNamespaceCensus.WRITE,owner.journalDisk.memory);
            ((Map<String,Object>)raw.get("MemphisZooCustodialNativeVaultV1")).put("original-legacy","opaque unverified legacy");
            var disk=new NativeRetainedOwnerTest.WorkDisk();var query=new AndroidRetainedQueryStore(disk.preferences(),owner.journalCipher).journal();
            batch=new AndroidRetainedBatchStore(new NativeRetainedOwnerTest.WorkDisk().preferences(),owner.journalCipher,
                (q,i)->{throw new AssertionError("empty batch needs no slot cipher");},owner.journal,query).journal();
        }
        VaultEngine.NativeRetainedGenerationObservation generation()throws Exception{return engine.observeOriginalNativeRetainedGeneration(
            work,completion.owner.principal,null,provider,admitted.generationId);}
        NativeProtectedNamespaceObservation namespaces()throws Exception {
            var readers=new TreeMap<String,NativeProtectedNamespaceObservation.Store>();for(String name:raw.keySet())readers.put(name,()->raw.get(name));
            return NativeProtectedNamespaceObservation.observe(readers);
        }
        JSONObject inspect()throws Exception {return inspect(0);}
        JSONObject inspect(int previouslyOpenedSyntheticConnections)throws Exception {
            var before=new TreeMap<String,Map<String,?>>();raw.forEach((k,v)->before.put(k,new HashMap<>(v)));
            int commits=completion.owner.workDisk.commits,encrypts=completion.owner.workCipher.delegate.existingKeyEncryptCalls,
                providerCommits=providerStore.memory.commits,keys=providerStore.keys.creations;
            try(var g=generation();var n=namespaces();var values=engine.observeOriginalRetainedNamespaceValues(g,n);
                var source=engine.inspectOriginalRetainedNamespaceSemantics(values,batch)){
                var sourceBefore=source.projection().toString();try(var joined=engine.inspectOriginalAll8CompletionSemantics(source)){
                    var p=joined.projection();assertEquals(sourceBefore,source.projection().toString());noAuthority(p);
                    assertEquals(before,raw);assertEquals(commits,completion.owner.workDisk.commits);
                    assertEquals(encrypts,completion.owner.workCipher.delegate.existingKeyEncryptCalls);assertEquals(providerCommits,providerStore.memory.commits);
                    assertEquals(keys,providerStore.keys.creations);assertEquals(previouslyOpenedSyntheticConnections,completion.owner.opened);assertEquals(0,completion.owner.ids);
                    completion.owner.wiped();return p;
                }
            }
        }
    }
    /** New records are produced through the existing Engine/journal factories;
     * no predecessor test method, raw accepted record or fake Observation is used. */
    static final class LocalJournalFixture {
        final Fixture f=new Fixture(0);
        final NativeRetainedOwnerTest.WorkDisk root=new NativeRetainedOwnerTest.WorkDisk();
        final NativeRetainedAttemptTest.Disk queryDisk=new NativeRetainedAttemptTest.Disk();
        final NativeRetainedBatchOwnerTest.DomainCipher indexCipher=new NativeRetainedBatchOwnerTest.DomainCipher(AndroidRetainedBatchStore.AAD);
        final NativeRetainedQueryTest.QueryCipher queryDelegate=new NativeRetainedQueryTest.QueryCipher();
        final NativeRetainedNamespaceCensusTest.CountingCipher queryCipher=new NativeRetainedNamespaceCensusTest.CountingCipher(queryDelegate);
        final Map<String,NativeRetainedBatchOwnerTest.DomainCipher> domains=new HashMap<>();
        final NativeRetainedQueryJournal queries=new AndroidRetainedQueryStore(queryDisk.preferences(),queryCipher).journal();
        int ids,opened;
        String nextId(){return NativeRetainedOwnerTest.id(15000+(++ids));}
        LocalJournalFixture(int mode)throws Exception {
            var owner=f.completion.owner;
            f.batch=new AndroidRetainedBatchStore(root.preferences(),indexCipher,(query,index)->{
                String aad=AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index;
                return domains.computeIfAbsent(aad,NativeRetainedBatchOwnerTest.DomainCipher::new);
            },owner.journal,queries).journal();
            try(var g=f.generation();var batch=f.engine.prepareNativeRetainedBatch(g,f.batch,this::nextId)){
                try(var write=f.engine.prepareNextNativeRetainedBatchChunk(batch,this::nextId)){}
                char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
                try{
                    var capture=NativeRetainedWorkCapture.capture(owner.work);
                    var principal=NativeProviderPrincipal.fromNativeJournal(owner.principal.readFor(f.engine.getState()));
                    try(var target=NativeRetainedAttempt.restore(owner.journal.observe().record(),capture.values,principal,
                        owner.persistence.current().revision,credential);var dispatch=owner.journal.fenceDispatch(target)){}
                }finally{VaultValidation.wipe(credential);}
                try(var query=f.engine.prepareNativeRetainedBatchQuery(batch,0,this::nextId)){
                    if(mode==1){
                        byte[] body=NativeRetainedAttempt.base64(queries.observe().record().getString("body_base64"),393216);
                        JSONObject q;try{q=ProviderWireJson.object(body,393216);}finally{Arrays.fill(body,(byte)0);}
                        var data=new JSONObject().put("schema","custodial.original-native-evidence-readback-result.v1")
                            .put("operation_id",q.get("operation_id")).put("query_native_request_id",query.requestId())
                            .put("native_request_id",q.get("native_request_id")).put("request_body_sha256",q.get("request_body_sha256"))
                            .put("query_completed",true).put("status","OUTCOME_UNKNOWN").put("requested_attempt_retained",JSONObject.NULL)
                            .put("request_readback_confirmed",false).put("record_values_retained",JSONObject.NULL)
                            .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN");
                        for(String flag:new String[]{"write_performed","resend_allowed","absence_proves_no_late_commit","inventory_acknowledged",
                            "automatic_acceptance","work_accepted","new_work_allowed","phone_released","key_removal"})data.put(flag,false);
                        owner.onReply=()->owner.connection.response=new JSONObject().put("ok",true).put("data",data).toString()
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8);
                        try{f.engine.readNativeRetainedQuery(query,owner.http(),new NativeRetainedHttp.Attempt());}
                        finally{owner.onReply=()->{};}
                        opened=1;
                    }
                }
            }
            if(mode==2)owner.journalDisk.memory.clear(); // Orphan original query, not a fabricated response.
            if(mode==3)queryDisk.memory.put("unknown-original-row","malformed retained original");
            if(mode==4)root.memory.put("unknown-original-row","malformed retained original");
            f.raw.put(NativeRetainedNamespaceCensus.BATCH,root.memory);
            f.raw.put(NativeRetainedNamespaceCensus.QUERY,queryDisk.memory);
            f.raw.put(NativeRetainedNamespaceCensus.WRITE,owner.journalDisk.memory);
        }
        JSONObject inspect()throws Exception {
            int indexEncrypts=indexCipher.encrypts,queryEncrypts=queryCipher.encrypts,rootCommits=root.commits,queryCommits=queryDisk.commits;
            JSONObject p=f.inspect(opened);
            assertEquals(indexEncrypts,indexCipher.encrypts);assertEquals(queryEncrypts,queryCipher.encrypts);
            assertEquals(rootCommits,root.commits);assertEquals(queryCommits,queryDisk.commits);
            indexCipher.wiped();queryCipher.wiped();for(var cipher:domains.values())cipher.wiped();
            assertEquals(0,queryDelegate.creates);assertEquals(0,queryDelegate.destroys);
            assertEquals(1,p.getInt("matched_completion_count"));assertEquals(3,p.getInt("completion_semantic_joined_record_count"));
            assertEquals(p.getInt("record_count")-3,p.getInt("application_unresolved_record_count"));return p;
        }
    }
    static int localRows(JSONObject p,String namespace,String expected)throws Exception {
        int count=0;for(int i=0;i<p.getJSONArray("records").length();i++){
            JSONObject row=p.getJSONArray("records").getJSONObject(i);if(!namespace.equals(row.get("namespace")))continue;
            assertEquals(expected,row.get("application_semantic_disposition"));
            if(!"UNRECONCILED_RECORD_RETAINED".equals(expected)){
                assertEquals(true,row.get("local_source_classified"));assertEquals(expected,row.get("local_source_classification"));
                assertEquals(expected,row.get("journal_source_state"));
            }
            for(String flag:new String[]{"cutoff_eligible","browser_source_authenticated","current_server_readback","inventory_acknowledged",
                "work_accepted","resend_allowed","finalizer_allowed","key_removal"})assertEquals(false,row.get(flag));count++;
        }return count;
    }
    @Test public void LOCAL_DISPOSITION_originalWriteQueryAndBatchFactsRemainUnaccepted()throws Exception {
        var p=new LocalJournalFixture(0).inspect();
        assertTrue(localRows(p,NativeRetainedNamespaceCensus.WRITE,"ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED")>0);
        assertTrue(localRows(p,NativeRetainedNamespaceCensus.QUERY,"ORIGINAL_QUERY_HMAC_VALID_CACHED_OUTCOME_UNKNOWN")>0);
        assertEquals(1,localRows(p,NativeRetainedNamespaceCensus.BATCH,"ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT"));
        assertTrue(localRows(p,NativeVaultProviderReferenceCensus.VAULT,"UNRECONCILED_RECORD_RETAINED")>0);
    }
    @Test public void LOCAL_DISPOSITION_cachedUnknownQueryRemainsHistoricalAndUnresolved()throws Exception {
        var p=new LocalJournalFixture(1).inspect();
        assertTrue(localRows(p,NativeRetainedNamespaceCensus.QUERY,"CACHED_ORIGINAL_TARGET_WITNESS_LOCAL_ONLY")>0);
        assertEquals("OUTCOME_UNKNOWN",p.getJSONArray("original_work_journal_chunks").getJSONObject(0).get("cached_status"));
        assertEquals("DISPATCH_UNKNOWN",p.getJSONArray("original_work_journal_chunks").getJSONObject(0).get("write_journal_state"));
    }
    @Test public void LOCAL_DISPOSITION_orphanMalformedAndUnboundOriginalRowsRemainUnreconciled()throws Exception {
        for(int mode:new int[]{2,3,4}){
            var p=new LocalJournalFixture(mode).inspect();
            assertTrue(localRows(p,NativeRetainedNamespaceCensus.QUERY,"UNRECONCILED_RECORD_RETAINED")>0);
            if(mode==4){assertTrue(localRows(p,NativeRetainedNamespaceCensus.WRITE,"UNRECONCILED_RECORD_RETAINED")>0);
                assertTrue(localRows(p,NativeRetainedNamespaceCensus.BATCH,"UNRECONCILED_RECORD_RETAINED")>0);}
        }
    }
    static void noAuthority(JSONObject p)throws Exception {
        for(String flag:new String[]{"complete_namespace_inventory","current_server_readback","cutoff_eligible","work_accepted","inventory_acknowledged",
            "key_removal","phone_released","browser_source_authenticated","historical_snapshot_principal_verified","clock_profile_qualified",
            "durable_retention","all_writer_durable_freeze_or_ABA_guard","resend_allowed","new_work_allowed","finalizer_allowed","saved_source_join_layout_capsule_identity_rewritten"})assertEquals(flag,false,p.get(flag));
        assertEquals("UNKNOWN",p.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",p.get("browser_inventory_state"));
        assertEquals(p.getInt("record_count"),p.getJSONArray("records").length());
        assertEquals(p.getInt("record_count"),p.getInt("completion_semantic_joined_record_count")+p.getInt("application_unresolved_record_count"));
        for(String secret:new String[]{"manifest_body","ciphertext","installation_seal","services_performed","opaque unverified legacy","original_request_body_base64"})assertFalse(secret,p.toString().contains(secret));
    }
    @Test public void FIXED_READ_ALL8_sameCapturedProjectionRendersWithoutAuthority()throws Exception {
        var f=new Fixture(6);String receipt=f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey);
        JSONObject p=f.inspect();assertEquals(8,p.getJSONArray("namespaces").length());assertEquals(1,p.getInt("matched_completion_count"));
        assertEquals(3,p.getInt("completion_semantic_joined_record_count"));int receipts=0;
        for(int i=0;i<p.getJSONArray("records").length();i++){
            JSONObject row=p.getJSONArray("records").getJSONObject(i);if(!row.has("native_completion_semantics"))continue;
            JSONObject semantic=row.getJSONObject("native_completion_semantics");if(!semantic.has("argument_provenance"))continue;
            assertEquals(NativeRetainedCompletionCensusTest.FIXED_PROVENANCE,semantic.get("argument_provenance"));receipts++;
        }
        assertEquals(1,receipts);String exact=p.toString();String text=NativeManagerInventoryPresentation.completionSummary(p);
        assertEquals(exact,p.toString());assertTrue(text.contains("matched original completion/session triples 1"));
        assertTrue(text.contains("NOT eligibility, current server acceptance"));assertTrue(text.contains("No ACK, work acceptance, resend"));
        assertFalse(text.contains("installation_seal"));assertFalse(text.contains("completion_payload"));
        assertEquals(receipt,f.completion.owner.work.loadCompletionReceipt(f.completion.receiptKey));noAuthority(p);
    }
    @Test public void FIXED_READ_ALL8_withdrawnSourceRefusesHeldJoin()throws Exception {
        var f=new Fixture(6);var owner=f.completion.owner;String receipt=owner.work.loadCompletionReceipt(f.completion.receiptKey);
        int commits=owner.workDisk.commits;
        try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
            var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);var joined=f.engine.inspectOriginalAll8CompletionSemantics(s)){
            noAuthority(joined.projection());owner.bumpVault();
            denied(joined::projection);denied(()->f.engine.inspectOriginalAll8CompletionSemantics(s));
        }
        assertEquals(receipt,owner.work.loadCompletionReceipt(f.completion.receiptKey));assertEquals(commits,owner.workDisk.commits);
        assertEquals(0,owner.opened);owner.wiped();
    }
    static void denied(NativeRetainedCompletionSemanticsTest.Action a)throws Exception{NativeRetainedCompletionSemanticsTest.refused(a);}
    @Test public void oneNativeOriginalCompletionJoinsReceiptStartFinishWithoutChangingOriginalCapsuleBindings()throws Exception {
        var f=new Fixture(0);var p=f.inspect();assertEquals(1,p.getInt("matched_completion_count"));assertEquals(3,p.getInt("completion_semantic_joined_record_count"));
        assertTrue(p.getInt("application_unresolved_record_count")>0);assertEquals(8,p.getJSONArray("namespaces").length());
        int receipt=0,pair=0;for(int i=0;i<p.getJSONArray("records").length();i++){
            var row=p.getJSONArray("records").getJSONObject(i);if(!row.has("native_completion_semantics"))continue;
            String state=row.getString("application_semantic_disposition");if(state.equals("ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE"))receipt++;
            if(state.equals("ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY"))pair++;
        }assertEquals(1,receipt);assertEquals(2,pair);
    }
    @Test public void allDistinctOriginalSessionsAreJoinedRatherThanSelectingOneReceipt()throws Exception {var p=new Fixture(5).inspect();assertEquals(2,p.getInt("matched_completion_count"));assertEquals(6,p.getInt("completion_semantic_joined_record_count"));}
    @Test public void legacyMissingFinishCorruptAndAmbiguousSessionsStayRepresentedUnresolved()throws Exception {
        for(int mode:new int[]{1,2,3,4}){var p=new Fixture(mode).inspect();assertEquals(0,p.getInt("matched_completion_count"));assertEquals(0,p.getInt("completion_semantic_joined_record_count"));}
    }
    @Test public void missingOwningInspectionAdapterIsARefusalNotAnEmptyOrClearInventory()throws Exception {
        var f=new Fixture(0);var owner=f.completion.owner;f.work=new NativeSeparationFreeze.Store(){
            public Map<String,?> separationRawSnapshot()throws VaultFailure{return owner.work.separationRawSnapshot();}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> raw)throws VaultFailure{return owner.work.readSeparationSnapshotEvidence(raw);}
            public void prepareSeparationProbe(Map<String,?> raw){throw new AssertionError("no probe");}
            public void freezeSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence p){throw new AssertionError("no freeze");}
        };
        try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch)){
            denied(()->f.engine.inspectOriginalAll8CompletionSemantics(s));assertNotNull(s.projection());
        }
    }
    @Test public void everyNamespaceChangeAndClosedOwnerInvalidatesReturnedReconciliation()throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            var f=new Fixture(0);try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
                var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);var joined=f.engine.inspectOriginalAll8CompletionSemantics(s)){
                ((Map<String,Object>)f.raw.get(name)).put("late-original-change","preserved");denied(joined::projection);denied(()->f.engine.inspectOriginalAll8CompletionSemantics(s));
            }
        }
        var f=new Fixture(0);try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
            var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch);var joined=f.engine.inspectOriginalAll8CompletionSemantics(s)){
            s.close();denied(joined::projection);assertNotNull(v.projection());assertNotNull(g.projection());
        }
    }
    @Test public void borrowedOwnersAndImmutableProjectionCannotBeClosedOrMutatedThroughJoin()throws Exception {
        var f=new Fixture(0);try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);
            var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch)){
            var joined=f.engine.inspectOriginalAll8CompletionSemantics(s);var p=joined.projection();String digest=p.getString("completion_reconciliation_sha256");
            p.put("inventory_acknowledged",true);p.getJSONArray("records").remove(0);var again=joined.projection();noAuthority(again);assertEquals(digest,again.get("completion_reconciliation_sha256"));
            joined.close();denied(joined::projection);assertNotNull(s.projection());assertNotNull(v.projection());assertTrue(n.stillCurrent());
        }
    }
    @Test public void missingDuplicateForeignIdentityAndFalseInheritedAuthorityRefuseWholeJoin()throws Exception {
        for(int fault=0;fault<5;fault++){
            var f=new Fixture(0);try(var g=f.generation();var n=f.namespaces();var v=f.engine.observeOriginalRetainedNamespaceValues(g,n);var s=f.engine.inspectOriginalRetainedNamespaceSemantics(v,f.batch)){
                var owner=f.completion.owner;var work=NativeRetainedWorkCapture.capture(owner.work);var principal=NativeProviderPrincipal.fromNativeJournal(owner.principal.readFor(f.engine.getState()));
                char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
                try{var proof=NativeSeparationEvidence.restore(work.wire(),principal,work.values.snapshot(),credential);
                    var c=owner.work.inspectRetainedCompletionCensus(work.original,proof,java.util.List.of(),credential);final int mode=fault;
                    NativeRetainedNamespaceSemanticJoinTest.mutate(c,j->{if(mode==0)j.getJSONArray("records").remove(0);if(mode==1)j.getJSONArray("records").put(j.getJSONArray("records").getJSONObject(0));
                        if(mode==2)j.getJSONArray("records").getJSONObject(0).put("raw_identity_sha256","f".repeat(64));if(mode==3)j.put("inventory_acknowledged",true);if(mode==4)j.put("signed_manifest_sha256","f".repeat(64));});
                    var all=f.raw;try(var values=NativeRetainedNamespaceValues.capture(all,n.digest)){
                        // The only direct invocation is a synthetic corruption negative. Production uses the private original observer.
                        var sourceField=s.getClass().getDeclaredField("joined");sourceField.setAccessible(true);var source=(NativeRetainedNamespaceSemanticJoin.Observation)sourceField.get(s);
                        denied(()->NativeRetainedNamespaceCompletionJoin.inspect(all,n.digest,work,values,source,c,proof,principal,owner.persistence.current().revision,f.admitted.generationId));
                    }
                }finally{VaultValidation.wipe(credential);}
            }
        }
    }
}
