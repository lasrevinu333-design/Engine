package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW owning read-only seam cases. All credentials, AES, enrollment,
 * admission/HTTPS and persisted work are synthetic. No SQL/phone/backend PASS. */
public final class NativeOriginalGenerationObservationTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !"--initial-unique-generation-only".equals(args[0]))
            throw new IllegalArgumentException("new focused selector required");
        var test = new NativeOriginalGenerationObservationTest();
        test.initialUniqueGenerationIsDetachedAndReadOnly();
        test.initialZeroPreparedAndCutoffRefuse();
        test.initialTwoQualifiedOriginalsNeverChooseLatest();
        test.initialMalformedUnavailableAndForeignOwnerRefuse();
        test.initialValidNonmatchingDrainingRecordIsPreserved();
        test.initialChangedMetadataAdditionalForeignAndAbaSourceRefuse();
        test.initialWitnessStillRejectsLaterRevisionAndForeignContext();
        System.out.println("NEW7 initial unique generation cases PASS; synthetic provider/AES/work fixtures only; no authenticated initial-baseline commit or effect rights");
    }
    static NativeSeparationContext initialContext(Fixture f) throws Exception {
        return NativeSeparationContext.validateRetainedData(NativeSeparationContextTest.data()
            .put("credential_id", f.principal.json().get("credential_id")), f.principal);
    }
    @Test public void initialUniqueGenerationIsDetachedAndReadOnly() throws Exception {
        var f = new Fixture(); var stable = new Unchanged(f); var context = initialContext(f);
        var witness = f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, context);
        JSONObject projection = witness.projection();
        assertEquals(8, projection.length()); assertEquals(f.generation.generationId, projection.get("generation_id"));
        assertEquals(BEFORE, projection.get("activated_at")); assertEquals(f.principal.digest, projection.get("principal_digest"));
        projection.put("generation_id", id(99)); assertEquals(f.generation.generationId, witness.projection().get("generation_id"));
        witness.requireCurrent(f.principal);
        // This opaque eight-field DTO exposes no effect flags/capability at all.
        for (String field : new String[]{"transaction_authority", "work_accepted", "inventory_acknowledged",
            "finalizer_allowed", "key_removal_allowed", "phone_release_allowed"}) assertFalse(witness.projection().has(field));
        stable.check();
    }
    @Test public void initialZeroPreparedAndCutoffRefuse() throws Exception {
        for (int variant = 0; variant < 4; variant++) {
            var f = variant == 1 ? new Fixture(BEFORE, false) : variant == 2 ? new Fixture(CUTOFF, true) : new Fixture();
            if (variant == 0) {
                var store = f.providerStore.store(); var before = store.loadRetained();
                store.commit(before.revision, Collections.emptyMap(), java.util.Set.of(f.key(f.generation.generationId)));
            } else if (variant == 3) {
                JSONObject record = f.record(f.generation.generationId);
                record.put("activated_at", "2026-09-24T08:00:00.123Z");
                record.getJSONObject("admission").put("activated_at", "2026-09-24T08:00:00.123Z");
                f.replace(f.generation.generationId, record);
            }
            var stable = new Unchanged(f); var context = initialContext(f);
            denied(() -> f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, context)); stable.check();
        }
    }
    @Test public void initialTwoQualifiedOriginalsNeverChooseLatest() throws Exception {
        var f = new Fixture(); String historic = f.generation.generationId;
        f.rotate("2026-09-26T08:00:00.123456Z"); assertNotEquals(historic, f.generation.generationId);
        var stable = new Unchanged(f); var context = initialContext(f);
        denied(() -> f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, context)); stable.check();
    }
    @Test public void initialMalformedUnavailableAndForeignOwnerRefuse() throws Exception {
        for (int variant = 0; variant < 5; variant++) {
            var f = new Fixture(); var context = initialContext(f);
            if (variant == 0) f.replace(f.generation.generationId, f.record(f.generation.generationId).put("future", true));
            else if (variant == 1) f.provider.observeUnavailable();
            else if (variant == 2) f.providerStore.keys.value = null;
            else if (variant == 3) f.providerStore.memory.throwRead = true;
            var stable = new Unchanged(f);
            if (variant == 4) {
                var other = new Fixture(); var foreign = new Unchanged(other);
                var reader = other.nativeOwner.independentReader();
                reader.value = new JSONObject(reader.value).put("assignment_epoch", 8).toString();
                var changed = NativeProviderPrincipal.fromNativeJournal(other.nativeOwner.principal.readFor(other.nativeOwner.engine.getState()));
                var changedContext = NativeSeparationContext.validateRetainedData(NativeSeparationContextTest.data()
                    .put("credential_id", changed.json().get("credential_id")).put("assignment_epoch", 8), changed);
                denied(() -> f.provider.observeUniqueGenerationForInitialMutationBaseline(changed, changedContext));
                foreign.check();
            } else denied(() -> f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, context));
            stable.check();
        }
    }
    @Test public void initialValidNonmatchingDrainingRecordIsPreserved() throws Exception {
        var f = new Fixture(); var other = new Fixture();
        var reader = other.nativeOwner.independentReader();
        reader.value = new JSONObject(reader.value).put("assignment_epoch", 8).toString();
        var changed = NativeProviderPrincipal.fromNativeJournal(other.nativeOwner.principal.readFor(other.nativeOwner.engine.getState()));
        assertFalse(f.principal.same(changed));
        // Genuine existing provider constructors, with explicitly synthetic changed-owner admission.
        other.provider.observeActivePrincipal(changed); other.provider.captureToken("synthetic-foreign-token");
        var first = other.provider.prepareRegistration(changed, app());
        first = other.provider.confirmRegistration(changed, first,
            NativeProviderRegistrationReceipt.validateResponse(first, response(admission(first, null, BEFORE))));
        other.provider.captureToken("synthetic-foreign-next-token"); var next = other.provider.prepareRegistration(changed, app());
        other.provider.confirmRegistration(changed, next, NativeProviderRegistrationReceipt.validateResponse(next,
            response(admission(next, first.generationId, "2026-09-26T08:00:00.123456Z"))));
        String historical = first.generationId; JSONObject record = other.record(historical);
        // Capture/epoch bounds are those of the receiving namespace, never fabricated lower values.
        assertEquals(2, record.getLong("capture_sequence"));
        f.provider.captureToken("synthetic-retained-nonregistration-token");
        f.provider.observeUnavailable(); f.provider.observeActivePrincipal(f.principal);
        f.replace(historical, record); var stable = new Unchanged(f); var foreign = new Unchanged(other);
        var witness = f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, initialContext(f));
        assertEquals(f.generation.generationId, witness.generationId); stable.check(); foreign.check();
        // Mixed metadata/current owner cannot lend authority to a sole matching
        // historical row. Preserve every actual admission; only TEST metadata is changed.
        f.rotate("2026-09-26T08:00:00.123456Z");
        var store = f.providerStore.store(); var before = store.loadRetained();
        var metaKey = ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA, "journal");
        char[] metadata = before.read(metaKey), changedMetadata = null, foreignCurrent = null;
        try {
            changedMetadata = new JSONObject(new String(metadata)).put("current_generation", next.generationId).toString().toCharArray();
            foreignCurrent = other.record(next.generationId).toString().toCharArray();
            store.commit(before.revision, Map.of(metaKey, changedMetadata, f.key(next.generationId), foreignCurrent),
                java.util.Set.of(f.key(f.generation.generationId)));
        } finally {
            Arrays.fill(metadata, '\0');
            if (changedMetadata != null) Arrays.fill(changedMetadata, '\0');
            if (foreignCurrent != null) Arrays.fill(foreignCurrent, '\0');
        }
        var mixed = new Unchanged(f);
        denied(() -> f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, initialContext(f)));
        mixed.check(); foreign.check();
    }
    @Test public void initialChangedMetadataAdditionalForeignAndAbaSourceRefuse() throws Exception {
        for (int variant = 0; variant < 4; variant++) {
            var f = new Fixture(); var context = initialContext(f); var original = new HashMap<>(f.providerStore.memory.raw);
            int mutation = variant; int[] reads = {0}; Unchanged[] afterFault = {null};
            ProviderRecordStore.Backend backend = new ProviderRecordStore.Backend() {
                @Override public Object retainedSourceIdentity() { return f.providerStore.memory; }
                @Override public Map<String, ?> readAll() throws Exception {
                    if (++reads[0] == 4) {
                        if (mutation == 0) f.provider.observeUnavailable();
                        else if (mutation == 1) f.rotate("2026-09-26T08:00:00.123456Z");
                        else if (mutation == 2) f.providerStore.memory.raw.put("foreign-cell", "unresolved");
                        else {
                            f.provider.captureToken("synthetic-aba-token");
                            f.providerStore.memory.raw = new HashMap<>(original);
                        }
                        afterFault[0] = new Unchanged(f);
                    }
                    return f.providerStore.memory.readAll();
                }
                @Override public boolean replace(Map<String, String> next) { throw new AssertionError("observer must never write"); }
            };
            var crypto = new ProviderEnvelopeCrypto(f.providerStore.keys, () -> f.providerStore.memory.readAll().isEmpty(), f.providerStore.lock);
            var observer = new NativeProviderJournal(new ProviderRecordStore(backend, crypto, f.providerStore.lock), f.providerStore.lock);
            denied(() -> observer.observeUniqueGenerationForInitialMutationBaseline(f.principal, context));
            assertNotNull(afterFault[0]); afterFault[0].check();
        }
    }
    @Test public void initialWitnessStillRejectsLaterRevisionAndForeignContext() throws Exception {
        var f = new Fixture(); var context = initialContext(f);
        var witness = f.provider.observeUniqueGenerationForInitialMutationBaseline(f.principal, context);
        var changed = NativeSeparationContext.validateRetainedData(context.json().put("authority_revision", 43), f.principal);
        denied(() -> f.provider.requireOriginalGenerationCurrent(f.principal, changed, witness));
        f.provider.captureToken("synthetic-later-token"); var stable = new Unchanged(f);
        denied(() -> witness.requireCurrent(f.principal)); stable.check();
    }
    interface Action { void run() throws Exception; }
    static void denied(Action action) throws Exception { try { action.run();fail("must refuse without mutation"); } catch(VaultFailure expected) {} }
    static String id(int n) { return NativeSeparationContextTest.id(n); }
    static final String BEFORE="2026-09-24T08:00:00.123456Z",CUTOFF="2026-09-27T08:00:00.123456Z";
    static JSONObject admission(NativeProviderJournal.Prepared p,String prior,String time) throws Exception {
        JSONObject principal=p.json().getJSONObject("principal");
        return new JSONObject().put("schema",NativeProviderRegistrationReceipt.SCHEMA).put("operation_id",p.operationId)
            .put("generation_id",p.generationId).put("registration_id",id(88)).put("principal_digest",p.principalDigest)
            .put("token_digest",p.tokenDigest).put("device_id",principal.get("device_id")).put("credential_id",principal.get("credential_id"))
            .put("employee_id",principal.get("employee_id")).put("assignment_epoch",principal.get("assignment_epoch"))
            .put("native_app",p.json().getJSONObject("native_app")).put("activated_at",time)
            .put("prior_generation_id",prior==null?JSONObject.NULL:prior).put("prior_dispatch_retired_at",prior==null?JSONObject.NULL:time)
            .put("server_now",time).put("admitted_state","ACTIVE").put("replayed",false);
    }
    static AuthorizedResponse response(JSONObject data) throws Exception {
        return new AuthorizedResponse(200,Map.of("Content-Type","application/json"),new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8));
    }
    static NativeProviderAppIdentity app() throws Exception {
        String commit="a".repeat(40);JSONObject build=new JSONObject().put("edition","custodial").put("source_commit_exact",true)
            .put("native_build_number",56).put("source_commit",commit).put("source_tree","b".repeat(40))
            .put("custodial_native_vault_source_sha256","c".repeat(64)).put("build_id","test.custodial."+commit.substring(0,12));
        return NativeProviderAppIdentity.fromPackaged("org.memphiszoo.custodial","0.0.synthetic",56,build);
    }
    static final class Fixture {
        final NativeRetainedOwnerTest.Fixture nativeOwner=new NativeRetainedOwnerTest.Fixture();
        final ProviderRecordStoreTest.Fixture providerStore=new ProviderRecordStoreTest.Fixture();
        final NativeProviderJournal provider=new NativeProviderJournal(providerStore.store(),providerStore.lock);
        final NativeProviderPrincipal principal;
        NativeProviderJournal.Prepared generation;
        Fixture() throws Exception { this(BEFORE,true); }
        Fixture(String time,boolean confirm) throws Exception {
            principal=NativeProviderPrincipal.fromNativeJournal(nativeOwner.principal.readFor(nativeOwner.engine.getState()));
            provider.observeActivePrincipal(principal);provider.captureToken("synthetic-provider-token-one");
            generation=provider.prepareRegistration(principal,app());
            if(confirm) generation=provider.confirmRegistration(principal,generation,NativeProviderRegistrationReceipt.validateResponse(generation,response(admission(generation,null,time))));
        }
        VaultEngine.NativeRetainedGenerationObservation observe() throws Exception { return observe(generation.generationId); }
        VaultEngine.NativeRetainedGenerationObservation observe(String gen) throws Exception {
            return nativeOwner.engine.observeOriginalNativeRetainedGeneration(nativeOwner.work,nativeOwner.principal,null,provider,gen);
        }
        JSONObject record(String gen) throws Exception {
            char[] raw=providerStore.store().loadRetained().read(key(gen));try{return new JSONObject(new String(raw));}finally{Arrays.fill(raw,'\0');}
        }
        ProviderRecordStore.Key key(String gen) { return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.GENERATION,gen); }
        void replace(String gen,JSONObject record) throws Exception { replaceRaw(gen,record.toString()); }
        void replaceRaw(String gen,String raw) throws Exception {
            var store=providerStore.store();var old=store.loadRetained();char[] value=raw.toCharArray();
            try { store.commit(old.revision,Map.of(key(gen),value),Collections.emptySet()); }finally{Arrays.fill(value,'\0');}
        }
        void rotate(String at) throws Exception {
            String prior=generation.generationId;provider.captureToken("synthetic-provider-token-two");
            var next=provider.prepareRegistration(principal,app());generation=provider.confirmRegistration(principal,next,
                NativeProviderRegistrationReceipt.validateResponse(next,response(admission(next,prior,at))));
        }
        void wiped() { nativeOwner.wiped();assertEquals(0,nativeOwner.ids);assertEquals(0,nativeOwner.opened);assertTrue(nativeOwner.journalDisk.memory.isEmpty()); }
    }
    static final class Unchanged {
        final Fixture f;final Map<String,Object> provider,work;final VaultSnapshot vault;final int commits,keys,workCommits;
        Unchanged(Fixture f) { this.f=f;provider=new HashMap<>(f.providerStore.memory.raw);work=new HashMap<>(f.nativeOwner.workDisk.memory);
            vault=f.nativeOwner.persistence.current();commits=f.providerStore.memory.commits;keys=f.providerStore.keys.creations;workCommits=f.nativeOwner.workDisk.commits; }
        void check() { assertEquals(provider,f.providerStore.memory.raw);assertEquals(work,f.nativeOwner.workDisk.memory);
            assertEquals(vault,f.nativeOwner.persistence.current());assertEquals(commits,f.providerStore.memory.commits);
            assertEquals(keys,f.providerStore.keys.creations);assertEquals(workCommits,f.nativeOwner.workDisk.commits);f.wiped(); }
    }
    @Test public void exactOriginalAdmissionProjectionIsCopiedAndGrantsNoAuthority() throws Exception {
        var f=new Fixture();var stable=new Unchanged(f);
        try(var observation=f.observe()) {
            JSONObject p=observation.projection();assertEquals(8,p.length());assertEquals(f.generation.generationId,p.get("generation_id"));
            assertEquals(id(1),p.get("device_id"));assertEquals("KIOSK_08",p.get("device_identifier"));
            assertEquals(f.principal.digest,p.get("principal_digest"));assertEquals(BEFORE,p.get("activated_at"));
            assertEquals(f.principal.json().get("credential_id"),p.get("credential_id"));assertEquals(id(2),p.get("employee_id"));assertEquals(7,p.getLong("assignment_epoch"));
            p.put("generation_id",id(99));assertEquals(f.generation.generationId,observation.projection().get("generation_id"));
            assertFalse(observation.serverGenerationVerified);assertFalse(observation.workAccepted);assertFalse(observation.inventoryAcknowledged);assertFalse(observation.keyRemovalAllowed);
        } stable.check();
    }
    @Test public void explicitHistoricalDrainingGenerationDoesNotChooseNewCurrent() throws Exception {
        var f=new Fixture();String original=f.generation.generationId;f.rotate("2026-09-26T08:00:00.123456Z");var stable=new Unchanged(f);
        try(var old=f.observe(original)) { assertEquals(original,old.projection().get("generation_id"));assertEquals(BEFORE,old.projection().get("activated_at")); }
        assertNotEquals(original,f.generation.generationId);stable.check();
    }
    @Test public void preparedMissingNullOrInventedGenerationNeverBecomesOriginal() throws Exception {
        var f=new Fixture(BEFORE,false);var stable=new Unchanged(f);denied(()->f.observe());denied(()->f.observe(id(99)));denied(()->f.observe(null));stable.check();
    }
    @Test public void activationEqualAfterOrMalformedCutoffIsRejectedNotRounded() throws Exception {
        for(String activation:new String[]{CUTOFF,"2026-09-27T08:00:00.123457Z"}) {var f=new Fixture(activation,true);var stable=new Unchanged(f);denied(()->f.observe());stable.check();}
        var f=new Fixture();JSONObject r=f.record(f.generation.generationId);r.put("activated_at","2026-09-24T08:00:00.123Z");r.getJSONObject("admission").put("activated_at","2026-09-24T08:00:00.123Z");f.replace(f.generation.generationId,r);
        var stable=new Unchanged(f);denied(()->f.observe());stable.check();
    }
    @Test public void fullPrincipalSealOrEpochSubstitutionIsNotDigestOnlyProof() throws Exception {
        for(String field:new String[]{"assignment_epoch","credential_id","installation_seal"}) {
            var f=new Fixture();JSONObject r=f.record(f.generation.generationId);JSONObject p=r.getJSONObject("principal");
            p.put(field,field.equals("assignment_epoch")?8:field.equals("credential_id")?id(99):"changed-seal");f.replace(f.generation.generationId,r);
            var stable=new Unchanged(f);denied(()->f.observe());stable.check();
        }
    }
    @Test public void changedAdmissionOperationAppDigestOrRegistrationIsRejected() throws Exception {
        for(String field:new String[]{"operation_id","token_digest","registration_id","native_app","replayed"}) {
            var f=new Fixture();JSONObject r=f.record(f.generation.generationId),a=r.getJSONObject("admission");
            if(field.equals("native_app"))a.getJSONObject(field).put("version_code",57);
            else a.put(field,field.equals("token_digest")?"d".repeat(64):field.equals("replayed")?"false":id(99));
            f.replace(f.generation.generationId,r);var stable=new Unchanged(f);denied(()->f.observe());stable.check();
        }
    }
    @Test public void malformedUnknownAndDuplicateStoredRecordsAreNotNormalized() throws Exception {
        for(int variant=0;variant<5;variant++) {
            var f=new Fixture();JSONObject r=f.record(f.generation.generationId);String raw;
            if(variant==0)raw=r.put("future","unknown").toString();
            else if(variant==1)raw=r.toString().replaceFirst("\\{","{\"generation_id\":\""+f.generation.generationId+"\",");
            else if(variant==2)raw=r.toString()+" trailing";
            else if(variant==3)raw=r.put("capture_sequence",1.0).toString().replace("\"capture_sequence\":1","\"capture_sequence\":1.0");
            else raw="{\"schema\":\"custodial.native-provider-journal.v1\",\"invalid\":\"\\uD800\"}";
            f.replaceRaw(f.generation.generationId,raw);var stable=new Unchanged(f);denied(()->f.observe());stable.check();
        }
    }
    @Test public void revokedCurrentPointerOrImpossibleCaptureCannotSupplyWitness() throws Exception {
        for(int variant=0;variant<4;variant++) {
            var f=new Fixture();JSONObject r=f.record(f.generation.generationId);
            if(variant==0)r.put("state","REVOKED_OR_FOREIGN");else if(variant==1)r.put("generation_id",id(99));
            else if(variant==2)r.put("capture_sequence",0);else r.put("prepared_epoch",Long.MAX_VALUE);
            f.replace(f.generation.generationId,r);var stable=new Unchanged(f);denied(()->f.observe());stable.check();
        }
    }
    @Test public void drainingRetirementCannotPrecedeAdmissionOrStandInForCurrent() throws Exception {
        var f=new Fixture();String original=f.generation.generationId;f.rotate("2026-09-26T08:00:00.123456Z");
        JSONObject r=f.record(original);r.put("dispatch_retired_at","2026-09-23T08:00:00.123456Z");f.replace(original,r);
        var stable=new Unchanged(f);denied(()->f.observe(original));stable.check();
        var other=new Fixture();JSONObject current=other.record(other.generation.generationId);
        current.put("state","DISPATCH_RETIRED_ARRIVAL_DRAINING").put("dispatch_retired_at","2026-09-26T08:00:00.123456Z");other.replace(other.generation.generationId,current);
        var unchanged=new Unchanged(other);denied(()->other.observe());unchanged.check();
    }
    @Test public void anyProviderRevisionChangeInvalidatesOpaqueOriginalWitness() throws Exception {
        var f=new Fixture();try(var old=f.observe()) {f.provider.captureToken("new-synthetic-token");var stable=new Unchanged(f);denied(()->old.projection());stable.check();}
    }
    @Test public void frozenWorkOrVaultRevisionChangeInvalidatesOwningObservation() throws Exception {
        for(boolean work:new boolean[]{true,false}) {
            var f=new Fixture();try(var old=f.observe()) {if(work)f.nativeOwner.workDisk.memory.put("unknown-original-work","changed");else f.nativeOwner.bumpVault();
                var stable=new Unchanged(f);denied(()->old.projection());stable.check();}
        }
    }
    @Test public void corruptOriginalHmacIsNotStructuralContextAuthority() throws Exception {
        var f=new Fixture();String marker=(String)f.nativeOwner.workDisk.memory.get(NativeRetainedWorkCapture.FENCE);
        f.nativeOwner.workDisk.memory.put(NativeRetainedWorkCapture.FENCE,marker.substring(0,marker.length()-1)+"x");
        var stable=new Unchanged(f);denied(()->f.observe());stable.check();
    }
    @Test public void foreignOwnerOrClosedObservationIsRefusedAndClosePreservesRecords() throws Exception {
        var f=new Fixture();var other=new Fixture();var stable=new Unchanged(f);var foreign=new Unchanged(other);
        var observation=f.observe();denied(()->other.nativeOwner.engine.requireNativeRetainedGenerationCurrent(observation));
        observation.close();observation.close();denied(()->observation.projection());stable.check();foreign.check();
    }
    @Test public void retainedLoadCreatesNoKeyAndNeverRepairsMissingKeyOrCorruptStore() throws Exception {
        var empty=new ProviderRecordStoreTest.Fixture();denied(()->empty.store().loadRetained());assertEquals(0,empty.keys.creations);assertEquals(0,empty.memory.commits);assertTrue(empty.memory.raw.isEmpty());
        for(boolean missingKey:new boolean[]{true,false}) {
            var f=new Fixture();if(missingKey)f.providerStore.keys.value=null;else f.providerStore.memory.raw.put("foreign-corrupt-entry","opaque");
            var stable=new Unchanged(f);denied(()->f.observe());stable.check();
        }
    }
    @Test public void storedAdmissionValidationReturnsNoActivationReceiptAndCannotConfirmDraining() throws Exception {
        assertEquals(void.class,NativeProviderRegistrationReceipt.class.getDeclaredMethod("requireStoredAdmission",JSONObject.class).getReturnType());
        var pending=new Fixture(BEFORE,false);denied(()->NativeProviderRegistrationReceipt.requireStoredAdmission(pending.generation.json()));
        var f=new Fixture();String original=f.generation.generationId;f.rotate("2026-09-26T08:00:00.123456Z");JSONObject record=f.record(original);
        NativeProviderRegistrationReceipt.requireStoredAdmission(record);
        denied(()->NativeProviderRegistrationReceipt.validateResponse(new NativeProviderJournal.Prepared(record),response(record.getJSONObject("admission"))));
        f.wiped();pending.wiped();
    }
    @Test public void nativePrincipalChangeAtSameVaultRevisionCannotRebindObservation() throws Exception {
        var f=new Fixture();var reader=f.nativeOwner.independentReader();long revision=f.nativeOwner.persistence.current().revision;
        try(var observation=f.observe()) {
            reader.value=new JSONObject(reader.value).put("assignment_epoch",8).toString();var stable=new Unchanged(f);
            assertEquals(revision,f.nativeOwner.persistence.current().revision);denied(()->observation.projection());denied(()->f.observe());stable.check();
        }
    }
    @Test public void unavailableOrUnknownMetadataDoesNotAuthorizeOriginalWitness() throws Exception {
        var f=new Fixture();try(var observation=f.observe()) {
            f.provider.observeUnavailable();var stable=new Unchanged(f);denied(()->observation.projection());denied(()->f.observe());stable.check();
        }
        for(boolean duplicate:new boolean[]{false,true}) {
            var other=new Fixture();var key=ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA,"journal");
            var store=other.providerStore.store();var snapshot=store.loadRetained();char[] old=snapshot.read(key);String text;
            try { text=duplicate?new String(old).replaceFirst("\\{","{\"availability\":\"AVAILABLE\","):new JSONObject(new String(old)).put("future",true).toString(); }
            finally { Arrays.fill(old,'\0'); }
            char[] raw=text.toCharArray();try{store.commit(snapshot.revision,Map.of(key,raw),Collections.emptySet());}finally{Arrays.fill(raw,'\0');}
            var stable=new Unchanged(other);denied(()->other.observe());stable.check();
        }
    }
    @Test public void journalWitnessIsBoundToExactJournalAndOriginalContextNotCallerCopy() throws Exception {
        var f=new Fixture();var other=new Fixture();
        var data=NativeSeparationContextTest.data().put("credential_id",f.principal.json().get("credential_id"));
        var context=NativeSeparationContext.validateRetainedData(data,f.principal);
        var witness=f.provider.observeOriginalGeneration(f.principal,context,f.generation.generationId);
        var changed=NativeSeparationContext.validateRetainedData(new JSONObject(data.toString()).put("authority_revision",43),f.principal);
        var stable=new Unchanged(f);var foreign=new Unchanged(other);
        denied(()->other.provider.requireOriginalGenerationCurrent(f.principal,context,witness));
        denied(()->f.provider.requireOriginalGenerationCurrent(f.principal,changed,witness));
        for(var constructor:NativeProviderJournal.OriginalGeneration.class.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        stable.check();foreign.check();
    }
}
