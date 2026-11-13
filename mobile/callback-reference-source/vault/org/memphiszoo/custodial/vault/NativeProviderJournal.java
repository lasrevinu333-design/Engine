package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.time.Instant;
import org.json.JSONObject;

/** Registration and ingress slice of the accepted provider journal.
 * Not wired to runtime yet. Confirmation is a typed receipt transition only;
 * no HTTPS origin, ingress, display or action authority is established here.
 * Inbox/event/removal-effect extensions must be complete before runtime wiring. */
final class NativeProviderJournal {
    private static final String SCHEMA = "custodial.native-provider-journal.v1";
    private static final ProviderRecordStore.Key META = ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA, "journal");
    private static final ProviderRecordStore.Key MAINTENANCE = ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA, "last-local-failure");
    private final ProviderRecordStore store;
    private final Object lock;

    NativeProviderJournal(ProviderRecordStore store, Object lock) {
        if (store == null || lock == null) throw new IllegalArgumentException("provider_journal_dependencies_required");
        this.store = store; this.lock = lock;
    }
    // Native observation fence only. Any journal entry (including refused,
    // nested or read-only callbacks) invalidates an earlier original-job READ.
    // No authority/business row/history is changed, and ordinary work continues
    // even after this optimization's counter can no longer be represented.
    private long ordinaryReadRevision;private int ordinaryReadDepth;private boolean ordinaryReadUnknown;
    static final class OrdinaryReadFence {
        private final NativeProviderJournal owner;private final long revision;private final ProviderRecordStore.RetainedNativeRead retained;
        private OrdinaryReadFence(NativeProviderJournal owner,long revision,ProviderRecordStore.RetainedNativeRead retained){this.owner=owner;this.revision=revision;this.retained=retained;}
        void requireCurrent()throws VaultFailure {synchronized(owner.lock){
            if(owner.ordinaryReadUnknown||owner.ordinaryReadDepth!=0||owner.ordinaryReadRevision!=revision)
                throw new VaultFailure("custodial_provider_original_job_stale");
            retained.requireCurrent();
        }}
    }
    OrdinaryReadFence captureOrdinaryReadFence()throws VaultFailure {synchronized(lock){
        if(ordinaryReadUnknown||ordinaryReadDepth!=0)throw new VaultFailure("custodial_provider_original_job_stale");
        ProviderRecordStore.Snapshot source=store.loadDurableRetained();
        ProviderRecordStore.RetainedNativeRead retained=store.captureRetainedNativeRead(source);
        if(ordinaryReadUnknown||ordinaryReadDepth!=0)throw new VaultFailure("custodial_provider_original_job_stale");
        return new OrdinaryReadFence(this,ordinaryReadRevision,retained);
    }}
    ProviderRecordStore.RetainedNativeRead captureOriginalStoreRead()throws VaultFailure {synchronized(lock){
        if(ordinaryReadUnknown||ordinaryReadDepth!=0)throw new VaultFailure("custodial_provider_original_job_stale");
        ProviderRecordStore.Snapshot source=store.loadDurableRetained();
        return store.captureRetainedNativeRead(source);
    }}
    static final class OriginalAudioState {
        final String registrationId,recordSha256;final long admissionOrdinal;
        private OriginalAudioState(JSONObject record,JSONObject generation)throws Exception {
            registrationId=generation.getString("registration_id");NativeLegacyLineageJournal.uuid(registrationId);
            recordSha256=NativeProviderPrincipal.hash(record.toString());admissionOrdinal=number(record,"admission_ordinal");
            if(admissionOrdinal==0)throw corrupt();
        }
    }
    OriginalAudioState observeOriginalAudioAttempt(NativeProviderPrincipal original,Presentation actual,Observation now)throws VaultFailure {
        return observeOriginalAudioState(original,actual,now,"IN_PROGRESS");
    }
    OriginalAudioState observeOriginalAudioCompletion(NativeProviderPrincipal original,Presentation actual,Observation now)throws VaultFailure {
        return observeOriginalAudioState(original,actual,now,"COMPLETED");
    }
    private OriginalAudioState observeOriginalAudioState(NativeProviderPrincipal original,Presentation actual,Observation now,String expected)throws VaultFailure {
        return transition(()->{
            ProviderRecordStore.Snapshot source=store.loadDurableRetained();
            JSONObject record=requirePresentation(source,original,actual);requireLive(actual.payload,now);
            if(!expected.equals(record.get("audio_state"))||record.getBoolean("card_dismissed")
                ||record.getBoolean("os_cancel_pending")||!record.isNull("acknowledged_event_id"))
                throw new VaultFailure("custodial_provider_original_job_unavailable");
            JSONObject generation=strictRetained(source,generationKey(actual.payload.generationId));
            NativeProviderRegistrationReceipt.requireStoredAdmission(generation);
            OriginalAudioState result=new OriginalAudioState(record,generation);
            store.requireDurableRetainedCurrent(source);return result;
        });
    }
    OsDisplayIntent observeOriginalDisplayed(NativeProviderPrincipal original,Presentation actual,Observation now)throws VaultFailure {
        return transition(()->{
            ProviderRecordStore.Snapshot source=store.loadDurableRetained();
            JSONObject record=requirePresentation(source,original,actual);requireLive(actual.payload,now);
            if(!"DISPLAYED".equals(record.get("display_state"))||record.isNull("displayed_event_id")
                ||record.isNull("os_attempt_id")||record.getBoolean("card_dismissed")||record.getBoolean("os_cancel_pending")
                ||!record.isNull("acknowledged_event_id"))throw new VaultFailure("custodial_provider_original_job_unavailable");
            NativeLegacyLineageJournal.uuid(record.getString("os_attempt_id"));
            OsDisplayIntent result=new OsDisplayIntent(actual,record.getString("os_attempt_id"));
            store.requireDurableRetainedCurrent(source);return result;
        });
    }
    /** A captured native invocation scope, NOT proof of a server operation outcome.
     * Full principal is retained privately; no diagnostic exposes its secret seal. */
    static final class MaintenanceScope {
        private final NativeProviderPrincipal principal;
        private final String binding;
        private final long engineRevision,epoch,journalRevision;
        private MaintenanceScope(NativeProviderPrincipal principal,String binding,long revision,long epoch,long journalRevision) {
            this.principal=principal;this.binding=binding;engineRevision=revision;this.epoch=epoch;this.journalRevision=journalRevision;
        }
    }
    MaintenanceScope maintenanceScope(NativeProviderPrincipal current,long engineRevision) throws VaultFailure {
        return transition(()->{
            if(engineRevision<0)throw new VaultFailure("custodial_provider_operation_stale");
            ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            return new MaintenanceScope(current,meta.getString("binding_id"),engineRevision,number(meta,"invalidation_epoch"),snapshot.revision);
        });
    }
    /** Best-effort diagnostic only, with CAS/readback and no event/authority changes.
     * At capacity the existing reserved CAPACITY_PRESERVED diagnostic remains owner.
     * A corrupt/unreadable store is never repaired to persist this diagnostic. */
    boolean recordMaintenanceFailure(NativeProviderPrincipal current,long engineRevision,MaintenanceScope expected,
        NativeProviderFailureDisposition failure) throws VaultFailure {
        return transition(()->{
            if(failure==null||expected==null||current==null||!current.same(expected.principal)||engineRevision!=expected.engineRevision)return false;
            ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            if(number(meta,"invalidation_epoch")!=expected.epoch||!expected.binding.equals(meta.getString("binding_id")))return false;
            JSONObject prior=snapshot.keys().contains(MAINTENANCE)?maintenanceDiagnostic(snapshot):null;
            if(prior!=null&&maintenanceMatches(prior,current,engineRevision,meta)
                &&failure.name().equals(prior.getString("reason")))return true; // No write churn for an identical failure.
            JSONObject diagnostic=new JSONObject().put("schema",SCHEMA).put("maintenance_version",1)
                .put("scope_kind","NATIVE_INVOCATION_ONLY").put("principal_digest",current.digest)
                .put("binding_id",expected.binding).put("engine_revision",engineRevision).put("invalidation_epoch",expected.epoch)
                .put("observed_journal_revision",expected.journalRevision).put("reason",failure.name()).put("handling",failure.handling);
            Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,MAINTENANCE,diagnostic);commit(snapshot,writes);return true;
        });
    }
    /** Last observed LOCAL failure, not an active block, revocation or settlement.
     * Old binding diagnostics remain encrypted but are not exposed as current. */
    Map<String,Object> lastLocalFailure(NativeProviderPrincipal current,long engineRevision) throws VaultFailure {
        return transition(()->{
            if(current==null)return null;ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            if(!snapshot.keys().contains(MAINTENANCE))return null;
            JSONObject diagnostic=maintenanceDiagnostic(snapshot);if(!maintenanceMatches(diagnostic,current,engineRevision,meta))return null;
            Map<String,Object> status=new java.util.LinkedHashMap<>();status.put("reason",diagnostic.getString("reason"));
            status.put("handling",diagnostic.getString("handling"));status.put("durable",true);return Collections.unmodifiableMap(status);
        });
    }
    private static JSONObject maintenanceDiagnostic(ProviderRecordStore.Snapshot snapshot) throws Exception {
        JSONObject value=required(snapshot,MAINTENANCE);
        if(value.length()!=10||number(value,"maintenance_version")!=1||!"NATIVE_INVOCATION_ONLY".equals(value.get("scope_kind")))throw corrupt();
        NativeLegacyLineageJournal.hex(value.getString("principal_digest"));NativeLegacyLineageJournal.uuid(value.getString("binding_id"));
        number(value,"engine_revision");number(value,"invalidation_epoch");
        if(number(value,"observed_journal_revision")>snapshot.revision)throw corrupt();
        NativeProviderFailureDisposition failure=NativeProviderFailureDisposition.valueOf(value.getString("reason"));
        if(!failure.handling.equals(value.get("handling")))throw corrupt();return value;
    }
    private static boolean maintenanceMatches(JSONObject value,NativeProviderPrincipal current,long revision,JSONObject meta) throws Exception {
        return current.digest.equals(value.get("principal_digest"))&&revision==number(value,"engine_revision")
            &&number(meta,"invalidation_epoch")==number(value,"invalidation_epoch")&&meta.get("binding_id").equals(value.get("binding_id"));
    }
    static final class Prepared {
        private final String encoded;
        final String operationId, generationId, principalDigest, tokenDigest;
        final boolean confirmed;
        final long captureSequence;
        Prepared(JSONObject record) throws org.json.JSONException {
            encoded = record.toString(); operationId = record.getString("operation_id"); generationId = record.getString("generation_id");
            principalDigest = record.getString("principal_digest"); tokenDigest = record.getString("token_digest"); captureSequence = record.getLong("capture_sequence");
            confirmed = "CONFIRMED".equals(record.getString("state"));
        }
        JSONObject json() throws org.json.JSONException { return new JSONObject(encoded); }
    }

    /** Opaque observation of ONE explicitly named original stored admission.
     * Not a server-row witness, registration/clock capability, acceptance or ACK.
     * No fallback to latest/current generation and no generation allocation. */
    static final class OriginalGeneration {
        private final NativeProviderJournal owner;
        private final NativeProviderPrincipal principal;
        private final NativeSeparationContext context;
        private final long revision;
        private final JSONObject metadata, record;
        private final String projection;
        final String generationId;
        private OriginalGeneration(NativeProviderJournal owner, ProviderRecordStore.Snapshot snapshot,
            JSONObject meta, JSONObject value, NativeProviderPrincipal principal, NativeSeparationContext context) throws Exception {
            this.owner = owner; this.principal = principal; this.context = context; revision = snapshot.revision;
            // Own the same serialization-normalized comparison DATA once per
            // observation. These trees neither alias the inputs nor escape or
            // mutate; currentness still requires a fresh owning observation.
            metadata = new JSONObject(meta.toString()); record = new JSONObject(value.toString());
            generationId = value.getString("generation_id");
            JSONObject p = principal.json(), c = context.json();
            // Exact existing backend projection. Device UUID is from the signed
            // original context; canonical device identifier is from full principal.
            projection = new JSONObject().put("generation_id", generationId).put("device_id", c.get("device_id"))
                .put("device_identifier", p.get("device_id")).put("credential_id", p.get("credential_id"))
                .put("employee_id", p.get("employee_id")).put("assignment_epoch", p.get("assignment_epoch"))
                .put("principal_digest", principal.digest).put("activated_at", value.get("activated_at")).toString();
        }
        JSONObject projection() throws VaultFailure {
            try { return new JSONObject(projection); } catch (Exception error) { throw originalGenerationFailure(); }
        }
        /** Internal batch admission only; no public JSON or current-generation
         * substitute can produce this opaque original journal capability. */
        /** Fixed native owner monitor only. Callers acquire this BEFORE the
         * shared store commit monitor, then perform the existing requireCurrent
         * check while both are held. It supplies no generation selection,
         * authentication, mutation or acknowledgement authority. */
        Object originalCommitCoordinator() { return owner.lock; }
        void requireCurrent(NativeProviderPrincipal original) throws VaultFailure {
            owner.requireOriginalGenerationCurrent(original, context, this);
        }
    }
    OriginalGeneration observeOriginalGeneration(NativeProviderPrincipal original, NativeSeparationContext context,
        String explicitGenerationId) throws VaultFailure {
        return transition(() -> {
            if (original == null || context == null || !context.matchesPrincipal(original)) throw originalGenerationFailure();
            NativeLegacyLineageJournal.uuid(explicitGenerationId);
            ProviderRecordStore.Snapshot snapshot = store.loadRetained();
            JSONObject meta = strictRetained(snapshot, META); requireAvailable(meta, original);
            // Reuse owning metadata invariants, then require exact field identity.
            if (!ProviderWireJson.same(meta, metadata(snapshot))) throw originalGenerationFailure();
            exactRetained(meta, "schema", "invalidation_epoch", "capture_sequence", "retired_capture_sequence", "binding_id",
                "recovery_epoch", "availability", "principal", "ever_bound", "pending_generation", "current_generation");
            if (!Boolean.TRUE.equals(meta.get("ever_bound")) || meta.isNull("current_generation")) throw originalGenerationFailure();
            JSONObject value = strictRetained(snapshot, generationKey(explicitGenerationId));
            requireOriginalGenerationRecord(value, explicitGenerationId, original, context, meta);
            return new OriginalGeneration(this, snapshot, meta, value, original, context);
        });
    }
    /** INITIAL mutation-baseline selection only. The caller must separately
     * authenticate frozen WORK/current owner and hold the original-operation
     * absence lease through commit. Structural context is not authentication.
     * No latest/current pointer selects a generation; all declared generations
     * must pass the existing original grammar before uniqueness is considered.
     * Unsupported (including prepared/revoked) records conservatively refuse.
     */
    OriginalGeneration observeUniqueGenerationForInitialMutationBaseline(NativeProviderPrincipal original,
        NativeSeparationContext context) throws VaultFailure {
        return transition(() -> {
            if (original == null || context == null || !context.matchesPrincipal(original)) throw originalGenerationFailure();
            // Pin BEFORE the ordinary retained read, so a cooperative commit/ABA
            // during decoding cannot be adopted as a new selection source.
            ProviderRecordStore.Snapshot source = store.loadDurableRetained();
            ProviderRecordStore.Snapshot snapshot = store.loadRetained();
            requireSameInitialRetainedSnapshot(source, snapshot);
            store.requireDurableRetainedCurrent(source);
            JSONObject meta = strictRetained(snapshot, META); requireAvailable(meta, original);
            if (!ProviderWireJson.same(meta, metadata(snapshot))) throw originalGenerationFailure();
            exactRetained(meta, "schema", "invalidation_epoch", "capture_sequence", "retired_capture_sequence", "binding_id",
                "recovery_epoch", "availability", "principal", "ever_bound", "pending_generation", "current_generation");
            if (!Boolean.TRUE.equals(meta.get("ever_bound")) || meta.isNull("current_generation")
                || !meta.isNull("pending_generation")) throw originalGenerationFailure();
            // Pointer consistency is a grammar obligation, never a selector.
            NativeLegacyLineageJournal.uuid(meta.getString("current_generation"));
            if (!snapshot.keys().contains(generationKey(meta.getString("current_generation")))) throw originalGenerationFailure();
            JSONObject selected = null;
            for (ProviderRecordStore.Key key : snapshot.keys()) {
                if (key.domain != ProviderEnvelopeCrypto.Domain.GENERATION) continue;
                NativeLegacyLineageJournal.uuid(key.id);
                JSONObject value = strictRetained(snapshot, key);
                NativeProviderPrincipal recorded = NativeProviderPrincipal.fromNativeJournal(value.getJSONObject("principal"));
                // Validate even nonmatching rows; no catch-and-skip path may
                // conceal malformed, pending or possibly applicable originals.
                requireOriginalGenerationRecord(value, key.id, recorded, context, meta);
                if (key.id.equals(meta.get("current_generation")) && !original.same(recorded))
                    throw originalGenerationFailure(); // AVAILABLE metadata cannot point at a foreign current owner.
                if (original.same(recorded)) {
                    if (selected != null) throw originalGenerationFailure();
                    selected = value;
                }
            }
            if (selected == null) throw originalGenerationFailure();
            ProviderRecordStore.Snapshot after = store.loadRetained();
            requireSameInitialRetainedSnapshot(source, after);
            JSONObject afterMeta = strictRetained(after, META); requireAvailable(afterMeta, original);
            if (!ProviderWireJson.same(meta, afterMeta) || !ProviderWireJson.same(afterMeta, metadata(after)))
                throw originalGenerationFailure();
            JSONObject afterRecord = strictRetained(after, generationKey(selected.getString("generation_id")));
            requireOriginalGenerationRecord(afterRecord, selected.getString("generation_id"), original, context, afterMeta);
            if (!ProviderWireJson.same(selected, afterRecord)) throw originalGenerationFailure();
            OriginalGeneration result = new OriginalGeneration(this, snapshot, meta, selected, original, context);
            store.requireDurableRetainedCurrent(source);
            return result;
        });
    }
    private static void requireSameInitialRetainedSnapshot(ProviderRecordStore.Snapshot source,
        ProviderRecordStore.Snapshot observed) throws VaultFailure {
        if (source.revision != observed.revision || !source.keys().equals(observed.keys())) throw originalGenerationFailure();
        for (ProviderRecordStore.Key key : source.keys()) {
            char[] before = null, after = null;
            try {
                before = source.read(key); after = observed.read(key);
                if (before == null || after == null || !Arrays.equals(before, after)) throw originalGenerationFailure();
            } finally {
                if (before != null) Arrays.fill(before, '\0');
                if (after != null) Arrays.fill(after, '\0');
            }
        }
    }
    void requireOriginalGenerationCurrent(NativeProviderPrincipal original, NativeSeparationContext context,
        OriginalGeneration expected) throws VaultFailure {
        transition(() -> {
            if (expected == null || expected.owner != this || original == null || !original.same(expected.principal)
                || context == null || !context.same(expected.context)) throw originalGenerationFailure();
            OriginalGeneration now = observeOriginalGeneration(original, context, expected.generationId);
            if (now.revision != expected.revision || !ProviderWireJson.same(now.metadata, expected.metadata)
                || !ProviderWireJson.same(now.record, expected.record)) throw originalGenerationFailure();
            return null;
        });
    }
    private static void requireOriginalGenerationRecord(JSONObject value, String id, NativeProviderPrincipal original,
        NativeSeparationContext context, JSONObject meta) throws Exception {
        boolean draining = "DISPATCH_RETIRED_ARRIVAL_DRAINING".equals(value.get("state"));
        String[] fields = {"schema", "state", "generation_id", "operation_id", "principal", "principal_digest", "token_digest",
            "capture_sequence", "prepared_epoch", "native_app", "registration_id", "activated_at", "admission"};
        java.util.Set<String> names = new java.util.HashSet<>(java.util.Arrays.asList(fields));
        if (draining) names.add("dispatch_retired_at"); exactRetained(value, names.toArray(new String[0]));
        if (!(draining || "CONFIRMED".equals(value.get("state"))) || !id.equals(value.get("generation_id"))
            || !original.same(NativeProviderPrincipal.fromNativeJournal(value.getJSONObject("principal")))
            || !original.digest.equals(value.get("principal_digest"))) throw originalGenerationFailure();
        NativeLegacyLineageJournal.uuid(value.getString("operation_id")); NativeLegacyLineageJournal.hex(value.getString("token_digest"));
        if (number(value, "capture_sequence") < 1 || number(value, "capture_sequence") > number(meta, "capture_sequence")
            || number(value, "prepared_epoch") > number(meta, "invalidation_epoch")) throw originalGenerationFailure();
        if (draining == id.equals(meta.get("current_generation"))) throw originalGenerationFailure();
        NativeProviderRegistrationReceipt.requireStoredAdmission(value);
        Instant activated = Instant.parse(value.getString("activated_at"));
        if (!activated.isBefore(context.cutoff)) throw originalGenerationFailure(); // Equality is NOT pre-cutoff.
        if (draining) {
            String retired = value.getString("dispatch_retired_at");
            if (!retired.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z")
                || !retired.equals(new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(Instant.parse(retired)))
                || Instant.parse(retired).isBefore(activated)) throw originalGenerationFailure();
        }
    }
    private static JSONObject strictRetained(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key) throws VaultFailure {
        char[] text = snapshot.read(key); byte[] bytes = null;
        try {
            if (text == null) throw originalGenerationFailure();
            java.nio.ByteBuffer encoded = java.nio.charset.StandardCharsets.UTF_8.newEncoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                .encode(java.nio.CharBuffer.wrap(text));
            try { bytes = new byte[encoded.remaining()]; encoded.get(bytes); }
            finally { if (encoded.hasArray()) Arrays.fill(encoded.array(), (byte) 0); }
            JSONObject result = ProviderWireJson.object(bytes, ProviderEnvelopeCrypto.MAX_RECORD_BYTES);
            if (!SCHEMA.equals(result.get("schema"))) throw originalGenerationFailure(); return result;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_original_generation_invalid", error); }
        finally { if (text != null) Arrays.fill(text, '\0'); if (bytes != null) Arrays.fill(bytes, (byte) 0); }
    }
    private static void exactRetained(JSONObject value, String... fields) throws VaultFailure {
        java.util.Set<String> names = new java.util.HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) names.add(it.next());
        if (!names.equals(new java.util.HashSet<>(java.util.Arrays.asList(fields)))) throw originalGenerationFailure();
    }

    /** UNMOUNTED bounded reference census under the original native actor.
     * Every encrypted row is represented; only exact metadata, token capture
     * and pre-cutoff generation grammars are classified here. Ingress/event/
     * tombstone/recovery/clock and unknown metadata semantics stay unresolved.
     * Results contain fixed classification codes, never token/signature/body.
     * No initialize, registration, writer, cleanup, ACK or effect is invoked. */
    Map<String,String> inspectCapturedOriginalReferenceRows(NativeProviderPrincipal original,NativeSeparationContext context,
        OriginalGeneration generation,Map<String,?> expected,long originalEngineRevision) throws VaultFailure {
        return transition(()->{
            requireOriginalGenerationCurrent(original,context,generation);
            ProviderRecordStore.Snapshot snapshot=store.loadRetainedCaptured(expected);
            JSONObject meta=strictRetained(snapshot,META);requireAvailable(meta,original);
            exactRetained(meta,"schema","invalidation_epoch","capture_sequence","retired_capture_sequence","binding_id",
                "recovery_epoch","availability","principal","ever_bound","pending_generation","current_generation");
            if(!ProviderWireJson.same(meta,metadata(snapshot)))throw originalGenerationFailure();
            Map<String,String> states=new java.util.TreeMap<>();states.put(ProviderRecordStore.INDEX,"PROVIDER_INDEX_AUTHENTICATED_SOURCE_LAYOUT_ONLY");
            Map<Long,JSONObject> tokens=new java.util.TreeMap<>();
            for(ProviderRecordStore.Key key:snapshot.keys()){
                states.put(key.storageName(),"PROVIDER_RECORD_SEMANTICS_UNRESOLVED_RETAINED");
                if(key.equals(META)){states.put(key.storageName(),"ORIGINAL_PROVIDER_METADATA_FULL_PRINCIPAL_BOUND");continue;}
                if(key.domain!=ProviderEnvelopeCrypto.Domain.TOKEN)continue;
                try{
                    JSONObject token=strictRetained(snapshot,key);
                    exactRetained(token,"schema","state","capture_sequence","capture_epoch","token","token_digest");
                    long sequence=number(token,"capture_sequence"),epoch=number(token,"capture_epoch");
                    if(sequence<1||sequence>number(meta,"capture_sequence")||epoch>number(meta,"invalidation_epoch")
                        ||!key.id.equals("capture-"+sequence)||!java.util.Arrays.asList("UNBOUND_TOKEN","REVOKED_OR_FOREIGN").contains(token.get("state"))
                        ||!(token.get("token") instanceof String)||!(token.get("token_digest") instanceof String))throw originalGenerationFailure();
                    String secret=token.getString("token");byte[] bytes=secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    try{
                        if(secret.isEmpty()||secret.length()>4096||bytes.length>4096||secret.codePoints().anyMatch(Character::isISOControl)
                            ||!secret.equals(new String(bytes,java.nio.charset.StandardCharsets.UTF_8))
                            ||!NativeProviderPrincipal.hash(secret).equals(token.getString("token_digest")))throw originalGenerationFailure();
                    }finally{Arrays.fill(bytes,(byte)0);}
                    if(tokens.put(sequence,token)!=null)throw originalGenerationFailure();
                    states.put(key.storageName(),"ORIGINAL_TOKEN_CAPTURE_ENCRYPTED_REFERENCE_ONLY_NO_AUTHORITY");
                }catch(Exception unresolved){states.put(key.storageName(),"TOKEN_CAPTURE_SEMANTICS_UNRESOLVED_RETAINED");}
            }
            for(ProviderRecordStore.Key key:snapshot.keys())if(key.domain==ProviderEnvelopeCrypto.Domain.GENERATION){
                try{
                    JSONObject value=strictRetained(snapshot,key);
                    requireOriginalGenerationRecord(value,key.id,original,context,meta);
                    JSONObject token=tokens.get(number(value,"capture_sequence"));
                    if(token==null||!value.getString("token_digest").equals(token.getString("token_digest")))throw originalGenerationFailure();
                    states.put(key.storageName(),"ORIGINAL_GENERATION_ADMISSION_AND_EXACT_TOKEN_CAPTURE_REFERENCE_LOCAL_ONLY");
                }catch(Exception unresolved){states.put(key.storageName(),"GENERATION_REFERENCE_SEMANTICS_UNRESOLVED_RETAINED");}
            }
            states.putAll(NativeProviderDeliveryCensus.inspect(snapshot,original,states));
            states.putAll(NativeProviderMetadataCensus.inspect(snapshot,original,meta,originalEngineRevision,states));
            if(states.size()!=expected.size()||!states.keySet().equals(expected.keySet()))throw originalGenerationFailure();
            store.loadRetainedCaptured(expected);requireOriginalGenerationCurrent(original,context,generation);
            return Collections.unmodifiableMap(states);
        });
    }
    /** Read-only closed original-record helpers for the native delivery census.
     * Neither helper calls arrival, effects, settlement, recovery or compaction. */
    static JSONObject capturedDeliveryRecord(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key) throws VaultFailure {
        return strictRetained(snapshot,key);
    }
    static boolean capturedDeliveryAdmissionMatches(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key,JSONObject strictEvent) {
        try{
            // Reuse the owning parser on the SAME original encrypted record;
            // strict parser integer wrappers differ, but no stored field/body
            // is rewritten, synthesized, resigned or normalized.
            JSONObject event=required(snapshot,key);
            if(!ProviderWireJson.same(strictEvent,event))return false;
            return NativeProviderEventReceipts.matches(new PendingEvent(event),event.getJSONObject("admission"));
        }
        catch(Exception unresolved){return false;}
    }
    static void requireCapturedDeliveryTombstone(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key) throws Exception {
        requiredTombstone(snapshot,key);
    }
    /** Same captured original encrypted record, owning PRIVATE validators only.
     * No clock observation, recovery preparation/restart, diagnostic mutation,
     * profile selection, effect or transport is called by this source census. */
    static void requireCapturedMetadataGrammar(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key,
        NativeProviderPrincipal original,JSONObject strictRecord) throws Exception {
        JSONObject owned;
        if(key.equals(MAINTENANCE))owned=maintenanceDiagnostic(snapshot);
        else if(key.id.startsWith("clock-"))owned=clockRecord(snapshot,key);
        else if(key.id.startsWith("recovery-")&&!key.equals(ProviderRecordStore.DIAGNOSTIC))owned=requiredRecovery(snapshot,key,original);
        else throw originalGenerationFailure();
        if(!ProviderWireJson.same(strictRecord,owned))throw originalGenerationFailure();
    }
    private static VaultFailure originalGenerationFailure() { return new VaultFailure("custodial_provider_original_generation_invalid"); }

    /** Native-only immutable typed request. No caller path/header/body or WebView constructor. */
    static final class Registration implements AutoCloseable {
        final Prepared prepared;
        final long invalidationEpoch;
        private final byte[] body;
        private final String path;
        final boolean status;
        private boolean closed;
        private Registration(Prepared prepared, long invalidationEpoch, boolean status, char[] token) throws Exception {
            this.prepared = prepared; this.invalidationEpoch = invalidationEpoch; this.status = status;
            path = "/employee-notifications-api/native-provider/" + (status ? "status" : "register");
            JSONObject p = prepared.json(), principal = p.getJSONObject("principal");
            JSONObject value = new JSONObject().put("schema", status ? "custodial.native-provider-status.v1" : "custodial.native-provider-register.v1")
                .put("operation_id", prepared.operationId).put("generation_id", prepared.generationId)
                .put("principal_digest", prepared.principalDigest).put("token_digest", prepared.tokenDigest).put("native_app", p.getJSONObject("native_app"));
            for (String field : new String[]{"device_id", "employee_id", "credential_id", "assignment_epoch"}) value.put(field, principal.get(field));
            if (!status) value.put("token", new String(token));
            body = value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (body.length > 65536) { Arrays.fill(body, (byte) 0); throw new VaultFailure("custodial_provider_request_too_large"); }
        }
        synchronized AuthorizedRequest request() throws VaultFailure {
            if (closed) throw new VaultFailure("custodial_provider_operation_closed");
            return new AuthorizedRequest(path, "POST", Collections.singletonMap("Content-Type", "application/json; charset=utf-8"), body);
        }
        @Override public synchronized void close() { closed = true; Arrays.fill(body, (byte) 0); }
    }

    Registration registrationRequest(NativeProviderPrincipal current, Prepared expected, boolean status) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            char[] token;
            if (status && expected != null && expected.confirmed) { requireConfirmedStatus(snapshot, meta, current, expected); token = new char[0]; }
            else token = tokenForPrepared(current, expected);
            try { return new Registration(expected, number(meta, "invalidation_epoch"), status, token); }
            finally { Arrays.fill(token, '\0'); }
        });
    }
    void requireRegistrationCurrent(NativeProviderPrincipal current, Registration operation) throws VaultFailure {
        transition(() -> {
            if (operation == null) throw new VaultFailure("custodial_provider_operation_stale");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (number(meta, "invalidation_epoch") != operation.invalidationEpoch) throw new VaultFailure("custodial_provider_operation_stale");
            if (operation.status && operation.prepared.confirmed) requireConfirmedStatus(snapshot, meta, current, operation.prepared);
            else { char[] token = tokenForPrepared(current, operation.prepared); Arrays.fill(token, '\0'); }
            return null;
        });
    }
    private void requireConfirmedStatus(ProviderRecordStore.Snapshot snapshot, JSONObject meta, NativeProviderPrincipal current, Prepared expected) throws Exception {
        if (!expected.generationId.equals(meta.get("current_generation")) || meta.get("pending_generation") != JSONObject.NULL)
            throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject record = required(snapshot, generationKey(expected.generationId));
        if (!"CONFIRMED".equals(record.get("state")) || !NativeLegacyLineageJournal.same(record, expected.json())
            || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"))))
            throw new VaultFailure("custodial_provider_operation_stale");
    }

    /** Original native observation. Unknown time stays unknown on later admission.
     * Bounds can originate only from the provider-only qualified interval owner. */
    static final class Observation {
        final NativeProviderTime.Bounds bounds;
        final long elapsedRealtimeMillis;
        final int bootCount;
        Observation(NativeProviderTime.Bounds bounds, long elapsedRealtimeMillis, int bootCount) throws VaultFailure {
            if (elapsedRealtimeMillis < -1 || bootCount < -1 || (bounds != null
                && (bounds.point.elapsedMillis != elapsedRealtimeMillis || bounds.point.bootCount != bootCount)))
                throw new VaultFailure("custodial_provider_observation_invalid");
            this.bounds = bounds; this.elapsedRealtimeMillis = elapsedRealtimeMillis; this.bootCount = bootCount;
        }
        JSONObject json() throws Exception {
            return new JSONObject().put("earliest_at", bounds == null ? JSONObject.NULL : bounds.earliest())
                .put("latest_at", bounds == null ? JSONObject.NULL : bounds.latest())
                .put("clock_profile_id", bounds == null ? JSONObject.NULL : bounds.profileId)
                .put("elapsed_realtime_ms", elapsedRealtimeMillis < 0 ? JSONObject.NULL : elapsedRealtimeMillis)
                .put("boot_count", bootCount < 0 ? JSONObject.NULL : bootCount);
        }
    }
    static final class Arrival {
        final String recordId, state;
        final boolean newlyAdmitted;
        Arrival(String recordId, String state, boolean newlyAdmitted) { this.recordId = recordId; this.state = state; this.newlyAdmitted = newlyAdmitted; }
    }

    static final class PendingEvent {
        final String id;
        private final String original, wire;
        private PendingEvent(JSONObject event) throws Exception {
            id = event.getString("event_id"); original = event.toString();
            if (!intervalRecord(event)) throw new VaultFailure("custodial_provider_historical_time_unqualified");
            JSONObject value = new JSONObject().put("schema", "custodial.native-provider-event.v2");
            for (String field : new String[]{"event_id", "record_id", "action", "generation_id", "content_sha256", "receipt_job_id", "notification_key",
                "receipt_credential_id", "receipt_employee_id", "receipt_device_id", "principal_digest", "token_digest", "original_observation", "admission_bounds"})
                value.put(field, event.get(field));
            // Strict payload already verified this exact decimal. HTTP contract uses an actual integer.
            value.put("receipt_assignment_epoch", Long.parseLong(event.getString("receipt_assignment_epoch")));
            wire = value.toString();
        }
        JSONObject original() throws Exception { return new JSONObject(original); }
        JSONObject wire() throws Exception { return new JSONObject(wire); }
    }
    static final class EventBatch {
        final long invalidationEpoch;
        final NativeProviderPrincipal principal;
        final Map<String, PendingEvent> events;
        private EventBatch(long invalidationEpoch, NativeProviderPrincipal principal, Map<String, PendingEvent> events) {
            this.invalidationEpoch = invalidationEpoch; this.principal = principal;
            this.events = Collections.unmodifiableMap(new java.util.LinkedHashMap<>(events));
        }
        byte[] body() throws VaultFailure {
            try {
                org.json.JSONArray list = new org.json.JSONArray(); for (PendingEvent event : events.values()) list.put(event.wire());
                byte[] bytes = new JSONObject().put("schema", "custodial.native-provider-events.v2").put("events", list).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                if (bytes.length > 65536) { Arrays.fill(bytes, (byte) 0); throw new VaultFailure("custodial_provider_request_too_large"); } return bytes;
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_event_invalid", error); }
        }
    }
    EventBatch pendingEvents(NativeProviderPrincipal current, int limit) throws VaultFailure {
        return transition(() -> {
            if (limit < 1 || limit > 16) throw new VaultFailure("custodial_provider_event_batch_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            Map<String, PendingEvent> received = new java.util.TreeMap<>(), actions = new java.util.TreeMap<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.EVENT) {
                JSONObject event = required(snapshot, key);
                if (!intervalRecord(event)) continue; // Preserve historical point receipt, never promote it.
                if (!"CURRENT".equals(event.getString("authority_state")) || !"PENDING".equals(event.getString("state"))) continue;
                if (!current.same(NativeProviderPrincipal.fromNativeJournal(event.getJSONObject("principal")))) continue;
                requireEventGeneration(snapshot, current, event);
                PendingEvent pending = new PendingEvent(event);
                if (!key.id.equals(pending.id)) throw corrupt();
                Map<String, PendingEvent> target = "received".equals(event.getString("action")) ? received : actions;
                if (target.put(pending.id, pending) != null) throw corrupt();
                // Snapshot has the existing1536-event storage ceiling; no
                // unbounded inventory or event mutation is introduced here.
                if (received.size() + actions.size() > 1536) throw new VaultFailure("custodial_provider_capacity_preserved");
            }
            Map<String, PendingEvent> result = new java.util.LinkedHashMap<>();
            // Server transitions require original received evidence. UUID-only
            // first16 selection can otherwise starve those prerequisites forever.
            for (Map<String, PendingEvent> group : java.util.Arrays.asList(received, actions))
                for (PendingEvent event : group.values()) if (result.size() < limit) result.put(event.id, event);
            EventBatch batch = new EventBatch(number(meta, "invalidation_epoch"), current, result);
            byte[] bounded = batch.body(); Arrays.fill(bounded, (byte) 0); return batch;
        });
    }
    void requireEventBatchCurrent(NativeProviderPrincipal current, EventBatch batch) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (batch == null || !current.same(batch.principal) || batch.invalidationEpoch != number(meta, "invalidation_epoch"))
                throw new VaultFailure("custodial_provider_operation_stale");
            for (PendingEvent expected : batch.events.values()) {
                JSONObject event = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, expected.id));
                requireEventGeneration(snapshot, current, event);
                if (!"CURRENT".equals(event.getString("authority_state")) || !"PENDING".equals(event.getString("state"))
                    || !NativeLegacyLineageJournal.same(event, expected.original())) throw new VaultFailure("custodial_provider_operation_stale");
            }
            return null;
        });
    }
    int settleEvents(NativeProviderPrincipal current, EventBatch batch, NativeProviderEventReceipts receipts) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (batch == null || receipts == null || !current.same(batch.principal) || batch.invalidationEpoch != number(meta, "invalidation_epoch"))
                throw new VaultFailure("custodial_provider_operation_stale");
            receipts.requireBatch(batch); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            for (String eventId : receipts.admittedIds()) {
                PendingEvent expected = batch.events.get(eventId); ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.EVENT, eventId);
                JSONObject event = required(snapshot, key); requireEventGeneration(snapshot, current, event);
                if (!"CURRENT".equals(event.getString("authority_state"))) throw new VaultFailure("custodial_provider_operation_stale");
                JSONObject admission = receipts.receipt(eventId);
                if ("SETTLED".equals(event.getString("state"))) {
                    JSONObject original = new JSONObject(event.toString()); original.put("state", "PENDING"); original.remove("admission");
                    if (!NativeLegacyLineageJournal.same(original, expected.original()) || !sameEventReceipt(event.getJSONObject("admission"), admission))
                        throw new VaultFailure("custodial_provider_event_receipt_invalid");
                    continue;
                }
                if (!"PENDING".equals(event.getString("state")) || !NativeLegacyLineageJournal.same(event, expected.original()))
                    throw new VaultFailure("custodial_provider_operation_stale");
                event.put("state", "SETTLED").put("admission", admission); put(writes, key, event);
            }
            if (!writes.isEmpty()) commit(snapshot, writes);
            return receipts.admittedIds().size(); // No record deletion, display change, cleaning reset or false partial-batch settlement.
        });
    }
    void requireDecisionNetworkUnlocked() throws VaultFailure {
        if (Thread.holdsLock(lock)) throw new VaultFailure("custodial_provider_network_lock_held");
    }
    NativeProviderEventDecisions.Query prepareEventDecisions(NativeProviderPrincipal current, EventBatch batch) throws VaultFailure {
        return transition(() -> {
            requireEventBatchCurrent(current, batch);
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (meta.isNull("current_generation") || !meta.isNull("pending_generation")) throw new VaultFailure("custodial_provider_operation_stale");
            Prepared prepared = new Prepared(required(snapshot, generationKey(meta.getString("current_generation"))));
            requireConfirmedStatus(snapshot, meta, current, prepared);
            return NativeProviderEventDecisions.Query.fromJournal(batch, prepared);
        });
    }
    EventBatch settleEventDecisions(NativeProviderPrincipal current, NativeProviderEventDecisions.Query query, NativeProviderEventReceipts receipts) throws VaultFailure {
        return transition(() -> {
            if (query == null) throw new VaultFailure("custodial_provider_operation_stale");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (!current.same(query.batch.principal) || query.batch.invalidationEpoch != number(meta, "invalidation_epoch")) throw new VaultFailure("custodial_provider_operation_stale");
            requireConfirmedStatus(snapshot, meta, current, query.current);
            decisionRemaining(snapshot, current, query.batch); // Validate every original BEFORE any write.
            // Existing settlement permits only exact original positives, including
            // lost durable-return reconciliation. This whole block holds coordinator.
            settleEvents(current, query.batch, receipts);
            Map<String, PendingEvent> remaining = decisionRemaining(store.load(), current, query.batch);
            // Do not admit new arrivals into the retry batch: only this query's
            // still-pending immutable originals may proceed to existing /events.
            return new EventBatch(query.batch.invalidationEpoch, current, remaining);
        });
    }
    private Map<String, PendingEvent> decisionRemaining(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, EventBatch batch) throws Exception {
            Map<String, PendingEvent> remaining = new java.util.LinkedHashMap<>();
            for (PendingEvent expected : batch.events.values()) {
                JSONObject event = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, expected.id)); requireEventGeneration(snapshot, current, event);
                if (!"CURRENT".equals(event.getString("authority_state"))) throw new VaultFailure("custodial_provider_operation_stale");
                if ("SETTLED".equals(event.getString("state"))) { event.put("state", "PENDING"); event.remove("admission"); }
                else if ("PENDING".equals(event.getString("state"))) remaining.put(expected.id, expected);
                else throw new VaultFailure("custodial_provider_operation_stale");
                if (!NativeLegacyLineageJournal.same(event, expected.original())) throw new VaultFailure("custodial_provider_operation_stale");
            }
            return remaining;
    }
    private static void requireEventGeneration(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, JSONObject event) throws Exception {
        if (!current.same(NativeProviderPrincipal.fromNativeJournal(event.getJSONObject("principal")))) throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject generation = required(snapshot, generationKey(event.getString("generation_id")));
        if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
            || !event.getString("token_digest").equals(generation.getString("token_digest"))
            || !event.getString("principal_digest").equals(current.digest)) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static boolean sameEventReceipt(JSONObject left, JSONObject right) throws Exception {
        JSONObject a = new JSONObject(left.toString()), b = new JSONObject(right.toString()); a.remove("replayed"); b.remove("replayed");
        return NativeLegacyLineageJournal.same(a, b);
    }

    /** SDK deletion/lifecycle wakeup: persist need without inventing message IDs or authority. */
    long requestRecovery() throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            long epoch = increment(number(meta, "recovery_epoch")); meta.put("recovery_epoch", epoch);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, META, meta); commit(snapshot, writes); return epoch;
        });
    }

    /** One frozen scan per full-principal binding. New wakeups coalesce behind its ceiling.
     * Null means this captured need was completely checkpointed, not that OS effects ran. */
    NativeProviderInventory.Request prepareInventory(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            String id = "recovery-" + meta.getString("binding_id"); ProviderRecordStore.Key key = recoveryKey(id);
            JSONObject recovery = snapshot.keys().contains(key) ? requiredRecovery(snapshot, key, current)
                : new JSONObject().put("schema", SCHEMA).put("authority_state", "CURRENT").put("principal", current.json())
                    .put("completed_epoch", 0).put("scan", JSONObject.NULL).put("completed_scan", JSONObject.NULL).put("last_restarted_scan", JSONObject.NULL);
            if (recovery.get("scan") != JSONObject.NULL)
                return new NativeProviderInventory.Request(current, number(meta, "invalidation_epoch"), id, recovery.getJSONObject("scan"));
            if (number(recovery, "completed_epoch") == number(meta, "recovery_epoch")) return null;
            if (number(recovery, "completed_epoch") > number(meta, "recovery_epoch")) throw corrupt();
            org.json.JSONArray generations = new org.json.JSONArray();
            for (ProviderRecordStore.Key candidate : snapshot.keys()) if (candidate.domain == ProviderEnvelopeCrypto.Domain.GENERATION) {
                JSONObject generation = required(snapshot, candidate);
                if (Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
                    && current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))) generations.put(candidate.id);
            }
            if (generations.length() == 0) throw new VaultFailure("custodial_provider_recovery_waiting_confirmation");
            if (generations.length() > 32) throw corrupt();
            JSONObject scan = new JSONObject().put("scan_id", UUID.randomUUID().toString()).put("captured_epoch", number(meta, "recovery_epoch"))
                .put("generation_ids", generations).put("cursor", JSONObject.NULL).put("ceiling", JSONObject.NULL)
                .put("server_now", JSONObject.NULL).put("pages", 0);
            recovery.put("scan", scan); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, key, recovery); commit(snapshot, writes);
            return new NativeProviderInventory.Request(current, number(meta, "invalidation_epoch"), id, scan);
        });
    }

    void requireInventoryCurrent(NativeProviderPrincipal current, NativeProviderInventory.Request request) throws VaultFailure {
        transition(() -> { requireInventory(store.load(), current, request); return null; });
    }
    void restartInventory(NativeProviderPrincipal current, NativeProviderInventory.Request request,
        NativeProviderInventory.CursorRejection rejection) throws VaultFailure {
        transition(() -> {
            if (rejection == null) throw new VaultFailure("custodial_provider_inventory_invalid"); rejection.requireRequest(request);
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject recovery = requireInventory(snapshot, current, request);
            recovery.put("last_restarted_scan", request.scan()).put("scan", JSONObject.NULL);
            // completed_epoch is untouched: no clearing of recovery need or accepted record.
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recoveryKey(request.recoveryId), recovery); commit(snapshot, writes); return null;
        });
    }

    /** Every row is durable BEFORE advancing its cursor. A crash after any row just dedupes
     * those original records on retry. Errors never clear need or fabricate device receipts. */
    int consumeInventory(NativeProviderPrincipal current, NativeProviderInventory.Request request,
        NativeProviderInventory.Page page, Observation observation) throws VaultFailure {
        return transition(() -> {
            if (page == null || observation == null) throw new VaultFailure("custodial_provider_inventory_invalid");
            page.requireRequest(request); requireInventory(store.load(), current, request);
            for (NativeProviderPayload payload : page.rows) recordArrival(current, payload, observation);
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject recovery = requireInventory(snapshot, current, request);
            JSONObject scan = request.scan(), data = page.data();
            scan.put("cursor", data.get("cursor")).put("ceiling", data.get("ceiling")).put("server_now", data.get("server_now"))
                .put("pages", increment(number(scan, "pages")));
            if (page.hasMore) recovery.put("scan", scan);
            else recovery.put("completed_epoch", number(scan, "captured_epoch")).put("completed_scan", scan).put("scan", JSONObject.NULL);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recoveryKey(request.recoveryId), recovery); commit(snapshot, writes);
            return page.rows.size();
        });
    }
    private static JSONObject requireInventory(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current,
        NativeProviderInventory.Request request) throws Exception {
        JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
        if (request == null || !current.same(request.principal) || request.invalidationEpoch != number(meta, "invalidation_epoch")
            || !request.recoveryId.equals("recovery-" + meta.getString("binding_id"))) throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject recovery = requiredRecovery(snapshot, recoveryKey(request.recoveryId), current);
        if (recovery.get("scan") == JSONObject.NULL || !ProviderWireJson.same(recovery.getJSONObject("scan"), request.scan()))
            throw new VaultFailure("custodial_provider_operation_stale");
        org.json.JSONArray generations = request.scan().getJSONArray("generation_ids");
        for (int i = 0; i < generations.length(); i++) {
            JSONObject generation = required(snapshot, generationKey(generations.getString(i)));
            if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
                || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal"))))
                throw new VaultFailure("custodial_provider_operation_stale");
        }
        return recovery;
    }
    private static JSONObject requiredRecovery(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key,
        NativeProviderPrincipal current) throws Exception {
        JSONObject value = required(snapshot, key);
        if (value.length() != 7 || !"CURRENT".equals(value.get("authority_state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(value.getJSONObject("principal")))) throw corrupt();
        number(value, "completed_epoch");
        for (String field : new String[]{"scan", "completed_scan", "last_restarted_scan"}) if (value.get(field) != JSONObject.NULL) {
            JSONObject scan = value.getJSONObject(field);
            if (scan.length() != 7) throw corrupt();
            NativeLegacyLineageJournal.uuid(scan.getString("scan_id")); number(scan, "captured_epoch"); number(scan, "pages");
            org.json.JSONArray generations = scan.getJSONArray("generation_ids");
            if (generations.length() < 1 || generations.length() > 32) throw corrupt();
            java.util.HashSet<String> unique = new java.util.HashSet<>();
            for (int i = 0; i < generations.length(); i++) {
                String id = NativeLegacyLineageJournal.uuid(generations.getString(i)); if (!unique.add(id)) throw corrupt();
            }
            NativeProviderInventory.validateScanBounds(scan);
        }
        return value;
    }
    private static ProviderRecordStore.Key recoveryKey(String id) { return recordKey(ProviderEnvelopeCrypto.Domain.METADATA, id); }

    /** Native-owned immutable identity for one already-admitted record. Never accepts JS payload. */
    static final class Presentation {
        final NativeProviderPrincipal principal;
        final NativeProviderPayload payload;
        final long invalidationEpoch;
        private final String record;
        private Presentation(NativeProviderPrincipal principal, long epoch, JSONObject record) throws Exception {
            this.principal = principal; invalidationEpoch = epoch; this.record = record.toString();
            payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload"));
        }
        JSONObject record() throws Exception { return new JSONObject(record); }
    }
    static final class OsDisplayIntent {
        final Presentation presentation;
        final String attemptId, tag;
        private OsDisplayIntent(Presentation presentation, String attemptId) {
            this.presentation = presentation; this.attemptId = attemptId; tag = "mz-provider:" + presentation.payload.recordId;
        }
    }
    static final class OsCancellation {
        final String recordId, contentHash, tag;
        final long sequence;
        private OsCancellation(JSONObject record) throws Exception {
            recordId = record.getString("record_id"); contentHash = record.getString("content_sha256");
            tag = "mz-provider:" + recordId; sequence = number(record, "cancel_sequence");
        }
    }
    Presentation presentation(NativeProviderPrincipal current, String recordId) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            JSONObject record = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, recordId));
            NativeProviderPayload payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload"));
            requireRecordBinding(record, current, payload); requirePresentationGeneration(snapshot, current, payload);
            if (!intervalRecord(record)) throw new VaultFailure("custodial_provider_historical_time_unqualified");
            if (!"ADMITTED".equals(record.getString("state")) || !payload.recordId.equals(recordId)) throw corrupt();
            return new Presentation(current, number(meta, "invalidation_epoch"), record);
        });
    }
    /** Readback identity for a wake-up hint only; never grants payload/action authority. */
    long presentationRevision() throws VaultFailure { return transition(() -> store.load().revision); }
    java.util.List<String> admittedRecordIds(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); requireAvailable(metadata(snapshot), current);
            java.util.SortedMap<Long,String> ids = new java.util.TreeMap<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                JSONObject record = required(snapshot, key);
                if (intervalRecord(record) && "CURRENT".equals(record.getString("authority_state")) && current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) {
                    // The original encrypted commit revision is the admission order,
                    // not a timestamp, random ID, or reconstructed historical arrival.
                    if (!record.has("admission_ordinal")) throw new VaultFailure("custodial_provider_admission_order_unavailable");
                    long ordinal = number(record, "admission_ordinal");
                    if (ordinal == 0 || ordinal > snapshot.revision || ids.put(ordinal,key.id) != null) throw corrupt();
                }
            }
            return Collections.unmodifiableList(new java.util.ArrayList<>(ids.values()));
        });
    }

    /** Bounded native scheduling input only. Does not prepare operations or invent
     * authority; every actual mutation/transport revalidates its original request. */
    static final class Work {
        final long revision;
        final boolean registration, recovery, initialRecovery, events;
        final java.util.List<String> quarantined;
        Work(long revision,boolean registration,boolean recovery,boolean initialRecovery,boolean events,java.util.List<String> quarantined) {
            this.revision=revision;this.registration=registration;this.recovery=recovery;this.initialRecovery=initialRecovery;this.events=events;
            this.quarantined=Collections.unmodifiableList(quarantined);
        }
        boolean networkPending(){return registration||recovery||events;}
    }
    Work pendingWork(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            boolean registration=!meta.isNull("pending_generation")||meta.isNull("current_generation");
            if(!registration){
                JSONObject generation=required(snapshot,generationKey(meta.getString("current_generation")));
                long capture=number(meta,"capture_sequence");
                registration=capture<=number(meta,"retired_capture_sequence")
                    ||!required(snapshot,tokenKey(capture)).getString("token_digest").equals(generation.getString("token_digest"));
            }
            ProviderRecordStore.Key key=recoveryKey("recovery-"+meta.getString("binding_id"));
            boolean initial=!meta.isNull("current_generation")&&!snapshot.keys().contains(key);
            boolean recovery=initial;
            if(snapshot.keys().contains(key)){
                JSONObject row=requiredRecovery(snapshot,key,current);
                if(number(row,"completed_epoch")>number(meta,"recovery_epoch"))throw corrupt();
                recovery=!row.isNull("scan")||number(row,"completed_epoch")<number(meta,"recovery_epoch");
            }
            java.util.List<String> quarantine=new java.util.ArrayList<>();
            for(ProviderRecordStore.Key candidate:snapshot.keys())if(candidate.domain==ProviderEnvelopeCrypto.Domain.QUARANTINE){
                JSONObject row=required(snapshot,candidate);
                if(intervalRecord(row)&&"CURRENT".equals(row.getString("authority_state"))&&current.same(NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"))))
                    quarantine.add(candidate.id);
            }
            if(quarantine.size()>256)throw corrupt();
            return new Work(snapshot.revision,registration,recovery,initial,!pendingEvents(current,1).events.isEmpty(),quarantine);
        });
    }
    void requirePresentationCurrent(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> { requirePresentation(store.load(), current, expected); return null; });
    }
    OsDisplayIntent prepareOsDisplay(NativeProviderPrincipal current, Presentation expected, Observation observation) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            requireLive(expected.payload, observation);
            if (!record.isNull("displayed_event_id") || record.getBoolean("card_dismissed") || !record.isNull("opened_event_id")
                || !record.isNull("acknowledged_event_id") || record.getBoolean("os_cancel_pending")) return null;
            if ("DISPLAY_UNCERTAIN".equals(record.getString("display_state")))
                return new OsDisplayIntent(expected, record.getString("os_attempt_id")); // Inspect exact active item before re-notify.
            if (!"PENDING_DISPLAY".equals(record.getString("display_state")) || !record.isNull("os_attempt_id")) throw corrupt();
            String id = UUID.randomUUID().toString(); record.put("display_state", "DISPLAY_UNCERTAIN").put("os_attempt_id", id);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record);
            commit(snapshot, writes); return new OsDisplayIntent(expected, id); // Persist/readback BEFORE notify.
        });
    }
    /** OS adapter calls only after matching the exact tagged active item and enabled channel.
     * A successful notify() call alone MUST NOT call this transition. */
    void confirmOsDisplayed(NativeProviderPrincipal current, OsDisplayIntent intent, Observation observation) throws VaultFailure {
        transition(() -> {
            if (intent == null) throw new VaultFailure("custodial_provider_display_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, intent.presentation);
            requireLive(intent.presentation.payload, observation);
            if (!intent.attemptId.equals(record.get("os_attempt_id")) || record.getBoolean("os_cancel_pending")
                || record.getBoolean("card_dismissed") || !record.isNull("opened_event_id") || !record.isNull("acknowledged_event_id"))
                throw new VaultFailure("custodial_provider_operation_stale");
            if (!record.isNull("displayed_event_id")) return null;
            if (!"DISPLAY_UNCERTAIN".equals(record.getString("display_state"))) throw corrupt();
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); appendPresentationEvent(record, intent.presentation.payload, "displayed", observation, writes);
            record.put("display_state", "DISPLAYED"); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, intent.presentation.payload.recordId), record);
            commit(snapshot, writes); return null;
        });
    }
    /** First-effect acquisition, not an idempotent action replay. Exactly one
     * caller gets true after the original PENDING -> IN_PROGRESS commit/readback.
     * Rejected or uncertain writes never grant sound; persisted uncertainty is
     * never reset. Per-record fence only: runtime still owns the one audio lane. */
    boolean tryStartAudio(NativeProviderPrincipal current, Presentation expected, Observation observation) throws VaultFailure {
        return transition(() -> {
            if (observation == null) throw new VaultFailure("custodial_provider_action_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            String state = record.getString("audio_state");
            if ("IN_PROGRESS".equals(state) || "COMPLETED".equals(state)) return false;
            if (!"PENDING".equals(state)) throw corrupt();
            if (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id"))
                throw new VaultFailure("custodial_provider_operation_stale");
            requireLive(expected.payload, observation); // No historical navigation exception for a NEW sound.
            record.put("audio_state", "IN_PROGRESS");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record);
            commit(snapshot, writes); return true;
        });
    }
    /** Finite internal mirror/action transitions. Bridge must additionally require an opaque
     * current native claim; Android action components obtain identity ONLY from native inbox. */
    void applyPresentationAction(NativeProviderPrincipal current, Presentation expected, String action, Observation observation) throws VaultFailure {
        transition(() -> {
            if (!Arrays.asList("displayed", "opened", "acknowledged", "dismissed", "audio_started", "audio_completed", "navigation_completed").contains(action)
                || observation == null) throw new VaultFailure("custodial_provider_action_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if ("displayed".equals(action)) {
                requireLive(expected.payload, observation);
                if (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id")) throw new VaultFailure("custodial_provider_operation_stale");
                if (record.getBoolean("mirror_rendered")) return null;
                if (record.isNull("displayed_event_id")) appendPresentationEvent(record, expected.payload, action, observation, writes);
                record.put("display_state", "DISPLAYED").put("mirror_rendered", true);
            } else if ("opened".equals(action) || "acknowledged".equals(action)) {
                if (!record.isNull(action + "_event_id")) return null;
                // PC02 gates a NEW action, not replay of an already durable original event.
                requireLive(expected.payload, observation);
                appendPresentationEvent(record, expected.payload, action, observation, writes); queueOsCancel(record); record.put("mirror_retire_pending", true);
                if ("opened".equals(action)) record.put("navigation_pending", true); // Durable BEFORE Activity launch or JS navigation.
            } else if ("dismissed".equals(action)) {
                if (record.getBoolean("card_dismissed")) return null;
                record.put("card_dismissed", true).put("mirror_retire_pending", true); queueOsCancel(record);
                // Local only: no backend acknowledgment, no interruption of the existing audio sequence.
            } else if ("audio_started".equals(action)) {
                if ("COMPLETED".equals(record.getString("audio_state")) || "IN_PROGRESS".equals(record.getString("audio_state"))) return null;
                if (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id")) throw new VaultFailure("custodial_provider_operation_stale");
                if (!record.getBoolean("navigation_pending")) requireLive(expected.payload, observation);
                record.put("audio_state", "IN_PROGRESS");
            } else if ("audio_completed".equals(action)) {
                if ("COMPLETED".equals(record.getString("audio_state"))) return null;
                if (!"IN_PROGRESS".equals(record.getString("audio_state"))) throw new VaultFailure("custodial_provider_action_invalid");
                record.put("audio_state", "COMPLETED");
            } else {
                if (record.isNull("opened_event_id")) throw new VaultFailure("custodial_provider_action_invalid");
                if (!record.getBoolean("navigation_pending")) return null;
                record.put("navigation_pending", false);
            }
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void requestOsCancellation(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            if (record.getBoolean("os_cancel_pending")) return null;
            queueOsCancel(record); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void confirmMirrorRetired(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            if (!record.getBoolean("mirror_retire_pending")) return null;
            record.put("mirror_retire_pending", false); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void applyOsAction(NativeProviderPrincipal current, String recordId, String attemptId, String action, Observation observation) throws VaultFailure {
        transition(() -> {
            if (!Arrays.asList("opened", "acknowledged", "dismissed").contains(action)) throw new VaultFailure("custodial_provider_action_invalid");
            Presentation presentation = presentation(current, recordId);
            JSONObject record = requirePresentation(store.load(), current, presentation);
            if (attemptId == null || !attemptId.equals(record.get("os_attempt_id"))) throw new VaultFailure("custodial_provider_operation_stale");
            applyPresentationAction(current, presentation, action, observation); return null;
        });
    }
    java.util.List<OsCancellation> pendingOsCancellations() throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); metadata(snapshot); java.util.List<OsCancellation> result = new java.util.ArrayList<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                JSONObject record = required(snapshot, key); if (record.getBoolean("os_cancel_pending")) result.add(new OsCancellation(record));
            }
            return Collections.unmodifiableList(result);
        });
    }
    /** Private retained-only denial witness, never a presentation or completion
     * capability. The store owns durable-source ambiguity/full-ciphertext ABA.
     * No initialization, new identity, principal adoption or write is permitted. */
    static final class RetainedCancellationBatch {
        private final NativeProviderJournal owner;
        private final ProviderRecordStore.Snapshot source;
        private final java.util.List<OsCancellation> originals;
        private RetainedCancellationBatch(NativeProviderJournal owner,ProviderRecordStore.Snapshot source,
            java.util.List<OsCancellation> originals){
            this.owner=owner;this.source=source;this.originals=Collections.unmodifiableList(originals);
        }
        int size(){return originals.size();}
    }
    RetainedCancellationBatch retainedPendingOsCancellations() throws VaultFailure {
        return transition(()->{
            ProviderRecordStore.Snapshot snapshot=store.loadDurableRetained();metadata(snapshot);
            store.requireDurableRetainedCurrent(snapshot);
            java.util.List<OsCancellation> originals=new java.util.ArrayList<>();
            for(ProviderRecordStore.Key key:snapshot.keys())if(key.domain==ProviderEnvelopeCrypto.Domain.INBOX){
                JSONObject record=strictRetained(snapshot,key);
                exactRetained(record,"schema","interval_version","record_id","principal","generation_id","content_sha256",
                    "payload","authority_state","received_observation","state","quarantine_reason","admission_bounds",
                    "admission_ordinal","received_event_id","display_state","os_tag","os_cancel_pending","mirror_retire_pending",
                    "os_attempt_id","cancel_sequence","displayed_event_id","opened_event_id","acknowledged_event_id",
                    "card_dismissed","mirror_rendered","audio_state","navigation_pending");
                NativeProviderPayload payload=NativeProviderPayload.fromInventory(record.getJSONObject("payload"));
                NativeProviderPrincipal original=NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"));
                payload.requirePrincipal(original);
                if(number(record,"interval_version")!=2||!"ADMITTED".equals(record.get("state"))||!record.isNull("quarantine_reason")
                    ||!Arrays.asList("CURRENT","REVOKED_OR_FOREIGN").contains(record.get("authority_state"))
                    ||!key.id.equals(payload.recordId)||!key.id.equals(record.get("record_id"))
                    ||!payload.generationId.equals(record.get("generation_id"))||!payload.contentHash.equals(record.get("content_sha256"))
                    ||!("mz-provider:"+key.id).equals(record.get("os_tag"))
                    ||!Arrays.asList("PENDING_DISPLAY","DISPLAY_UNCERTAIN","DISPLAYED").contains(record.get("display_state"))
                    ||!Arrays.asList("PENDING","IN_PROGRESS","COMPLETED").contains(record.get("audio_state")))throw corrupt();
                for(String field:new String[]{"os_cancel_pending","mirror_retire_pending","card_dismissed","mirror_rendered","navigation_pending"})
                    if(!(record.get(field) instanceof Boolean))throw corrupt();
                long ordinal=number(record,"admission_ordinal"),sequence=number(record,"cancel_sequence");
                if(ordinal==0||ordinal>snapshot.revision||record.getBoolean("os_cancel_pending")&&sequence==0)throw corrupt();
                NativeLegacyLineageJournal.uuid(record.getString("received_event_id"));
                for(String field:new String[]{"os_attempt_id","displayed_event_id","opened_event_id","acknowledged_event_id"})
                    if(!record.isNull(field))NativeLegacyLineageJournal.uuid(record.getString(field));
                JSONObject generation=strictRetained(snapshot,generationKey(payload.generationId));
                java.util.List<String> generationFields=new java.util.ArrayList<>(Arrays.asList("schema","state","generation_id","operation_id",
                    "principal","principal_digest","token_digest","capture_sequence","prepared_epoch","native_app","registration_id","activated_at","admission"));
                if(generation.has("dispatch_retired_at"))generationFields.add("dispatch_retired_at");
                exactRetained(generation,generationFields.toArray(new String[0]));
                if(!payload.generationId.equals(generation.get("generation_id"))
                    ||!Arrays.asList("CONFIRMED","DISPATCH_RETIRED_ARRIVAL_DRAINING","REVOKED_OR_FOREIGN").contains(generation.get("state"))
                    ||!original.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
                    ||!original.digest.equals(generation.get("principal_digest"))||!payload.tokenDigest.equals(generation.get("token_digest")))throw corrupt();
                NativeProviderRegistrationReceipt.requireStoredAdmission(generation);
                if(record.getBoolean("os_cancel_pending"))originals.add(new OsCancellation(record));
            }
            store.requireDurableRetainedCurrent(snapshot);
            return new RetainedCancellationBatch(this,snapshot,originals);
        });
    }
    OsCancellation requireRetainedCancellationCurrent(RetainedCancellationBatch batch,int index) throws VaultFailure {
        return transition(()->{
            if(batch==null||batch.owner!=this||index<0||index>=batch.originals.size())
                throw new VaultFailure("custodial_provider_operation_stale");
            store.requireDurableRetainedCurrent(batch.source);
            return batch.originals.get(index);
        });
    }
    /** Exact cancellation may finish AFTER removal; never needs the successor's credential.
     * Caller proves exact tagged item absent, not merely that cancel() returned. */
    void confirmOsCanceled(OsCancellation expected) throws VaultFailure {
        transition(() -> {
            if (expected == null) throw new VaultFailure("custodial_provider_action_invalid"); ProviderRecordStore.Snapshot snapshot = store.load();
            ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.recordId); JSONObject record = required(snapshot, key);
            if (!expected.contentHash.equals(record.get("content_sha256")) || expected.sequence != number(record, "cancel_sequence"))
                throw new VaultFailure("custodial_provider_operation_stale");
            if (!record.getBoolean("os_cancel_pending")) return null;
            record.put("os_cancel_pending", false).put("os_attempt_id", JSONObject.NULL);
            if (record.isNull("displayed_event_id")) record.put("display_state", "PENDING_DISPLAY");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, key, record); commit(snapshot, writes); return null;
        });
    }
    private static void queueOsCancel(JSONObject record) throws Exception {
        if (!record.getBoolean("os_cancel_pending")) record.put("cancel_sequence", increment(number(record, "cancel_sequence"))).put("os_cancel_pending", true);
    }
    private static JSONObject requirePresentation(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, Presentation expected) throws Exception {
        JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
        if (expected == null || expected.invalidationEpoch != number(meta, "invalidation_epoch") || !current.same(expected.principal))
            throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject record = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId));
        if (!intervalRecord(record)) throw new VaultFailure("custodial_provider_historical_time_unqualified");
        requireRecordBinding(record, current, expected.payload); requirePresentationGeneration(snapshot, current, expected.payload);
        if (!"ADMITTED".equals(record.get("state"))) throw corrupt(); return record;
    }
    private static void requirePresentationGeneration(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, NativeProviderPayload payload) throws Exception {
        JSONObject generation = required(snapshot, generationKey(payload.generationId));
        if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.get("state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
            || !payload.tokenDigest.equals(generation.get("token_digest"))) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static void requireLive(NativeProviderPayload payload, Observation observation) throws VaultFailure {
        if (observation == null || !NativeProviderTime.live(observation.bounds, payload.reservedAt, payload.validUntil))
            throw new VaultFailure("custodial_provider_display_time_unavailable");
    }
    private static void appendPresentationEvent(JSONObject record, NativeProviderPayload payload, String action, Observation observation,
        Map<ProviderRecordStore.Key, char[]> writes) throws Exception {
        String id = UUID.randomUUID().toString(); record.put(action + "_event_id", id);
        JSONObject event = new JSONObject().put("schema", SCHEMA).put("interval_version", 2).put("event_id", id).put("record_id", payload.recordId)
            .put("state", "PENDING").put("authority_state", "CURRENT").put("action", action).put("principal", record.getJSONObject("principal"))
            .put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
            .put("original_observation", observation.json()).put("admission_bounds", record.getJSONObject("admission_bounds"));
        for (String field : new String[]{"receipt_job_id", "notification_key", "receipt_credential_id", "receipt_employee_id", "receipt_device_id",
            "receipt_assignment_epoch", "principal_digest", "token_digest"}) event.put(field, payload.get(field));
        put(writes, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, id), event);
    }

    /** Bounded safe compaction only; unresolved, foreign, corrupt or uncertain records are
     * never evicted. Original NFC/cleaning/enrollment namespaces are not accessed. */
    int compactSettledRecords(NativeProviderPrincipal current, Observation observation, int limit) throws VaultFailure {
        return transition(() -> {
            if (limit < 1 || limit > 16 || observation == null || observation.bounds == null)
                throw new VaultFailure("custodial_provider_compaction_unavailable");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); Set<ProviderRecordStore.Key> removals = new java.util.HashSet<>(); int compacted = 0;
            for (ProviderRecordStore.Key key : snapshot.keys()) {
                if (compacted == limit) break;
                if (key.domain == ProviderEnvelopeCrypto.Domain.TOMBSTONE) {
                    JSONObject tombstone = requiredTombstone(snapshot, key);
                    if (!intervalRecord(tombstone)) continue;
                    if (!"CURRENT".equals(tombstone.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(tombstone.getJSONObject("principal")))) continue;
                    if (NativeProviderTime.reached(observation.bounds, NativeProviderPayload.timestamp(tombstone.getString("dedupe_until")))) { removals.add(key); compacted++; }
                    continue;
                }
                if (key.domain != ProviderEnvelopeCrypto.Domain.INBOX) continue;
                JSONObject record = required(snapshot, key);
                if (!intervalRecord(record)) continue;
                if (!"CURRENT".equals(record.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) continue;
                NativeProviderPayload payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload")); requireRecordBinding(record, current, payload);
                if (!NativeProviderTime.reached(observation.bounds, payload.validUntil) || !"DISPLAYED".equals(record.get("display_state"))
                    || record.getBoolean("os_cancel_pending") || !record.isNull("os_attempt_id") || record.getBoolean("mirror_retire_pending")
                    || record.getBoolean("navigation_pending") || (record.getBoolean("mirror_rendered") && !"COMPLETED".equals(record.get("audio_state")))) continue;
                if (!record.getBoolean("card_dismissed") && record.isNull("opened_event_id") && record.isNull("acknowledged_event_id")) continue;
                Map<String, String> eventActions = new HashMap<>();
                for (String action : new String[]{"received", "displayed", "opened", "acknowledged"}) if (!record.isNull(action + "_event_id"))
                    eventActions.put(record.getString(action + "_event_id"), action);
                if (!eventActions.containsValue("received") || !eventActions.containsValue("displayed")) throw corrupt();
                Set<ProviderRecordStore.Key> ownedEvents = new java.util.HashSet<>(); org.json.JSONArray admissions = new org.json.JSONArray(); boolean pending = false;
                for (ProviderRecordStore.Key eventKey : snapshot.keys()) if (eventKey.domain == ProviderEnvelopeCrypto.Domain.EVENT) {
                    JSONObject event = required(snapshot, eventKey); if (!payload.recordId.equals(event.get("record_id"))) continue;
                    if (!eventKey.id.equals(event.get("event_id")) || !eventActions.containsKey(eventKey.id) || !eventActions.get(eventKey.id).equals(event.get("action"))) throw corrupt();
                    requireEventGeneration(snapshot, current, event);
                    if (!"CURRENT".equals(event.get("authority_state")) || !payload.contentHash.equals(event.get("content_sha256"))) throw corrupt();
                    ownedEvents.add(eventKey);
                    if ("PENDING".equals(event.get("state"))) { pending = true; continue; }
                    if (!"SETTLED".equals(event.get("state")) || !NativeProviderEventReceipts.matches(new PendingEvent(event), event.getJSONObject("admission"))) throw corrupt();
                    admissions.put(new JSONObject().put("event_id", eventKey.id).put("action", event.get("action"))
                        .put("server_received_at", event.getJSONObject("admission").get("server_received_at")));
                }
                if (ownedEvents.size() != eventActions.size()) throw corrupt(); if (pending) continue;
                ProviderRecordStore.Key tombstoneKey = recordKey(ProviderEnvelopeCrypto.Domain.TOMBSTONE, key.id);
                if (snapshot.keys().contains(tombstoneKey)) throw corrupt();
                JSONObject tombstone = new JSONObject().put("schema", SCHEMA).put("interval_version", 2).put("authority_state", "CURRENT").put("state", "EXPIRED_SETTLED")
                    .put("record_id", payload.recordId).put("generation_id", payload.generationId).put("principal", current.json())
                    .put("content_sha256", payload.contentHash).put("token_digest", payload.tokenDigest).put("receipt_job_id", payload.jobId)
                    .put("notification_key", payload.notificationKey).put("valid_until", payload.get("valid_until"))
                    .put("dedupe_until", canonicalTime(payload.validUntil.plusSeconds(48 * 3600))).put("admissions", admissions);
                put(writes, tombstoneKey, tombstone); removals.add(key); removals.addAll(ownedEvents); compacted++;
            }
            if (compacted > 0) {
                meta.put("recovery_epoch", increment(number(meta, "recovery_epoch"))); put(writes, META, meta); commit(snapshot, writes, removals);
            }
            return compacted;
        });
    }
    private static JSONObject requiredTombstone(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key) throws Exception {
        JSONObject record = required(snapshot, key);
        if (record.length() != (intervalRecord(record) ? 14 : 13) || !"EXPIRED_SETTLED".equals(record.get("state")) || !key.id.equals(record.get("record_id"))) throw corrupt();
        String generation = NativeLegacyLineageJournal.uuid(record.getString("generation_id")), job = NativeLegacyLineageJournal.uuid(record.getString("receipt_job_id"));
        NativeLegacyLineageJournal.hex(record.getString("content_sha256")); NativeLegacyLineageJournal.hex(record.getString("token_digest"));
        NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"));
        if (!NativeProviderPrincipal.hash(generation + "\n" + job + "\n" + record.getString("notification_key")).equals(key.id)
            || !canonicalTime(NativeProviderPayload.timestamp(record.getString("valid_until")).plusSeconds(48 * 3600)).equals(record.get("dedupe_until"))) throw corrupt();
        org.json.JSONArray rows = record.getJSONArray("admissions"); Set<String> actions = new java.util.HashSet<>(), ids = new java.util.HashSet<>();
        if (rows.length() < 2 || rows.length() > 4) throw corrupt();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i); String action = row.getString("action");
            if (row.length() != 3 || !Arrays.asList("received", "displayed", "opened", "acknowledged").contains(action)
                || !actions.add(action) || !ids.add(NativeLegacyLineageJournal.uuid(row.getString("event_id")))) throw corrupt();
            NativeProviderPayload.timestamp(row.getString("server_received_at"));
        }
        if (!actions.contains("received") || !actions.contains("displayed")) throw corrupt(); return record;
    }

    /** Call only with an SDK-origin or authenticated inventory payload, under runtime principal fencing.
     * Result describes journal state, NOT permission to notify/navigate. Effects revalidate separately. */
    Arrival recordArrival(NativeProviderPrincipal current, NativeProviderPayload payload, Observation observation) throws VaultFailure {
        return transition(() -> {
            if (payload == null || observation == null) throw new VaultFailure("custodial_provider_observation_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            payload.requirePrincipal(current);
            ProviderRecordStore.Key tombstoneKey = recordKey(ProviderEnvelopeCrypto.Domain.TOMBSTONE, payload.recordId);
            if (snapshot.keys().contains(tombstoneKey)) {
                JSONObject tombstone = requiredTombstone(snapshot, tombstoneKey);
                if (!current.same(NativeProviderPrincipal.fromNativeJournal(tombstone.getJSONObject("principal")))
                    || !"CURRENT".equals(tombstone.get("authority_state"))) throw new VaultFailure("custodial_provider_generation_refused");
                if (!payload.contentHash.equals(tombstone.get("content_sha256")) || !payload.get("valid_until").equals(tombstone.get("valid_until")))
                    throw new VaultFailure("custodial_provider_payload_conflict");
                throw new VaultFailure("custodial_provider_payload_expired"); // Never reconstruct an inbox/event from a compacted identity.
            }
            ProviderRecordStore.Key generationKey = generationKey(payload.generationId);
            if (!snapshot.keys().contains(generationKey)) throw new VaultFailure("custodial_provider_generation_unknown");
            JSONObject generation = required(snapshot, generationKey);
            if (!current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
                || !payload.principalDigest.equals(generation.get("principal_digest")) || !payload.tokenDigest.equals(generation.get("token_digest"))
                || "REVOKED_OR_FOREIGN".equals(generation.getString("state"))) throw new VaultFailure("custodial_provider_generation_refused");
            ProviderRecordStore.Key inboxKey = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, payload.recordId);
            ProviderRecordStore.Key quarantineKey = recordKey(ProviderEnvelopeCrypto.Domain.QUARANTINE, payload.recordId);
            if (snapshot.keys().contains(inboxKey) && snapshot.keys().contains(quarantineKey)) throw corrupt();
            JSONObject existing = snapshot.keys().contains(inboxKey) ? required(snapshot, inboxKey)
                : snapshot.keys().contains(quarantineKey) ? required(snapshot, quarantineKey) : null;
            if (existing != null) {
                requireRecordBinding(existing, current, payload);
                if (!intervalRecord(existing)) return new Arrival(payload.recordId, "HISTORICAL_TIME_UNQUALIFIED", false);
                if ("ADMITTED".equals(existing.getString("state"))) return new Arrival(payload.recordId, "ADMITTED", false);
                if (!"QUARANTINED".equals(existing.getString("state"))) throw corrupt();
            }
            String reason = admissionWaitReason(meta, generation, payload, observation.bounds);
            if (NativeProviderTime.reached(observation.bounds, payload.validUntil))
                throw new VaultFailure("custodial_provider_payload_expired");
            if (existing != null && reason != null) return new Arrival(payload.recordId, "QUARANTINED", false);
            JSONObject record = existing == null ? new JSONObject().put("schema", SCHEMA).put("interval_version", 2).put("record_id", payload.recordId)
                .put("principal", current.json()).put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
                .put("payload", payload.json()).put("authority_state", "CURRENT").put("received_observation", observation.json()) : existing;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); Set<ProviderRecordStore.Key> removals = Collections.emptySet();
            if (reason != null) {
                record.put("state", "QUARANTINED").put("quarantine_reason", reason);
                put(writes, quarantineKey, record); commit(snapshot, writes);
                return new Arrival(payload.recordId, "QUARANTINED", false);
            }
            String eventId = UUID.randomUUID().toString();
            record.put("state", "ADMITTED").put("quarantine_reason", JSONObject.NULL).put("admission_bounds", observation.json())
                .put("admission_ordinal", increment(snapshot.revision))
                .put("received_event_id", eventId).put("display_state", "PENDING_DISPLAY")
                .put("os_tag", "mz-provider:" + payload.recordId).put("os_cancel_pending", false).put("mirror_retire_pending", false)
                .put("os_attempt_id", JSONObject.NULL).put("cancel_sequence", 0).put("displayed_event_id", JSONObject.NULL)
                .put("opened_event_id", JSONObject.NULL).put("acknowledged_event_id", JSONObject.NULL)
                .put("card_dismissed", false).put("mirror_rendered", false).put("audio_state", "PENDING").put("navigation_pending", false);
            JSONObject event = new JSONObject().put("schema", SCHEMA).put("interval_version", 2).put("event_id", eventId).put("record_id", payload.recordId)
                .put("state", "PENDING").put("authority_state", "CURRENT").put("action", "received")
                .put("principal", current.json()).put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
                .put("original_observation", record.getJSONObject("received_observation")).put("admission_bounds", observation.json());
            for (String field : new String[]{"receipt_job_id", "notification_key", "receipt_credential_id", "receipt_employee_id", "receipt_device_id",
                "receipt_assignment_epoch", "principal_digest", "token_digest"}) event.put(field, payload.get(field));
            put(writes, inboxKey, record); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, eventId), event);
            if (existing != null) removals = Collections.singleton(quarantineKey);
            commit(snapshot, writes, removals);
            return new Arrival(payload.recordId, "ADMITTED", true);
        });
    }

    /** Re-read original quarantine, never substitute caller content/observation on confirmation or restart. */
    Arrival drainQuarantine(NativeProviderPrincipal current, String recordId, Observation currentObservation) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); requireAvailable(metadata(snapshot), current);
            ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.QUARANTINE, recordId);
            if (!snapshot.keys().contains(key)) {
                key = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, recordId);
                if (!snapshot.keys().contains(key)) throw new VaultFailure("custodial_provider_quarantine_missing");
            }
            JSONObject record = required(snapshot, key);
            return recordArrival(current, NativeProviderPayload.fromInventory(record.getJSONObject("payload")), currentObservation);
        });
    }
    private static String admissionWaitReason(JSONObject meta, JSONObject generation, NativeProviderPayload payload, NativeProviderTime.Bounds now) throws Exception {
        String state = generation.getString("state");
        if ("PREPARED_QUARANTINE".equals(state)) {
            if (!payload.generationId.equals(meta.get("pending_generation"))) throw corrupt();
            return "GENERATION_UNCONFIRMED";
        }
        if (!"CONFIRMED".equals(state) && !"DISPATCH_RETIRED_ARRIVAL_DRAINING".equals(state)) throw new VaultFailure("custodial_provider_generation_refused");
        if (payload.reservedAt.isBefore(NativeProviderPayload.timestamp(generation.getString("activated_at"))))
            throw new VaultFailure("custodial_provider_reservation_refused");
        if ("DISPATCH_RETIRED_ARRIVAL_DRAINING".equals(state)
            && payload.reservedAt.isAfter(NativeProviderPayload.timestamp(generation.getString("dispatch_retired_at"))))
            throw new VaultFailure("custodial_provider_reservation_refused");
        if ("CONFIRMED".equals(state) && meta.get("pending_generation") != JSONObject.NULL) return "RETIREMENT_UNCONFIRMED";
        if (!NativeProviderTime.live(now, payload.reservedAt, payload.validUntil)) return "AUTHENTICATED_TIME_UNCERTAIN";
        return null;
    }
    private static boolean intervalRecord(JSONObject value) { return Integer.valueOf(2).equals(value.opt("interval_version")); }
    private static void requireRecordBinding(JSONObject record, NativeProviderPrincipal current, NativeProviderPayload payload) throws Exception {
        if (!"CURRENT".equals(record.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"))))
            throw new VaultFailure("custodial_provider_generation_refused");
        if (!payload.recordId.equals(record.get("record_id")) || !payload.contentHash.equals(record.get("content_sha256"))
            || !NativeLegacyLineageJournal.same(payload.json(), record.getJSONObject("payload"))) throw new VaultFailure("custodial_provider_payload_conflict");
    }
    private static String canonicalTime(Instant value) { return new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(value); }
    private static ProviderRecordStore.Key recordKey(ProviderEnvelopeCrypto.Domain domain, String id) { return ProviderRecordStore.key(domain, id); }

    /** Read-only cursor for an in-process SDK getToken callback. Never an authority token. */
    static final class TokenCursor {
        final long epoch, captureSequence;
        TokenCursor(long epoch, long captureSequence) { this.epoch = epoch; this.captureSequence = captureSequence; }
        boolean same(TokenCursor other) { return other != null && epoch == other.epoch && captureSequence == other.captureSequence; }
    }
    TokenCursor tokenCursor() throws VaultFailure {
        return transition(() -> {
            JSONObject meta = metadata(store.load());
            return new TokenCursor(number(meta, "invalidation_epoch"), number(meta, "capture_sequence"));
        });
    }

    /** Exact native Firebase observation, durable before scheduling/legacy forwarding. */
    long captureToken(String token) throws VaultFailure {
        if (token == null || token.length() < 1 || token.length() > 4096 || token.codePoints().anyMatch(Character::isISOControl))
            throw new VaultFailure("custodial_provider_token_invalid");
        // SDK token is opaque; do not invent an alphabet or normalize its bytes.
        byte[] utf8 = token.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
            if (utf8.length > 4096 || !token.equals(new String(utf8, java.nio.charset.StandardCharsets.UTF_8)))
                throw new VaultFailure("custodial_provider_token_invalid");
        } finally { Arrays.fill(utf8, (byte) 0); }
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            long previous = number(meta, "capture_sequence");
            String digest = NativeProviderPrincipal.hash(token);
            if (previous > number(meta, "retired_capture_sequence")) {
                JSONObject old = required(snapshot, tokenKey(previous));
                if ("UNBOUND_TOKEN".equals(old.getString("state")) && digest.equals(old.getString("token_digest")) && token.equals(old.getString("token"))) return previous;
            }
            long sequence = increment(previous);
            JSONObject record = new JSONObject().put("schema", SCHEMA).put("state", "UNBOUND_TOKEN")
                .put("capture_sequence", sequence).put("capture_epoch", number(meta, "invalidation_epoch"))
                .put("token", token).put("token_digest", digest);
            meta.put("capture_sequence", sequence);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, tokenKey(sequence), record); put(writes, META, meta);
            commit(snapshot, writes); return sequence;
        });
    }

    /** Runtime must observe engine/native journal under engine-before-provider ordering. */
    void observeActivePrincipal(NativeProviderPrincipal principal) throws VaultFailure {
        if (principal == null) throw new VaultFailure("custodial_provider_principal_required");
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            NativeProviderPrincipal previous = principal(meta);
            boolean changed = previous != null ? !previous.same(principal) : meta.getBoolean("ever_bound");
            if (!changed && previous != null && "AVAILABLE".equals(meta.getString("availability"))) return null;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if (changed) retireRegistrationRecords(snapshot, meta, writes);
            if (previous == null || changed) meta.put("binding_id", UUID.randomUUID().toString());
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch")))
                .put("recovery_epoch", increment(number(meta, "recovery_epoch")))
                .put("availability", "AVAILABLE").put("principal", principal.json()).put("ever_bound", true);
            put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    /** Transient absence denies authority and retires claims, not stored identity or original work. */
    void observeUnavailable() throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            if (!"AVAILABLE".equals(meta.getString("availability"))) return null;
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch"))).put("availability", "UNAVAILABLE");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    /** Called only after actual inactive/removal engine state, never a user-canceled ACTIVE gate.
     * Pure fence/intent only: production finalizeRemoval still requires OS/mirror runtime integration. */
    void observeRemoved() throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            if (!meta.getBoolean("ever_bound")) return null; // Initial unbound Firebase token is retained.
            if ("REMOVED".equals(meta.getString("availability"))
                && number(meta, "retired_capture_sequence") == number(meta, "capture_sequence")) return null;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); retireRegistrationRecords(snapshot, meta, writes);
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch")))
                .put("availability", "REMOVED").put("principal", JSONObject.NULL);
            put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    Prepared prepareRegistration(NativeProviderPrincipal current, NativeProviderAppIdentity nativeApp) throws VaultFailure {
        if (nativeApp == null) throw new VaultFailure("custodial_provider_native_build_identity_invalid");
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            requireAvailable(meta, current);
            Object pending = meta.get("pending_generation");
            if (pending != JSONObject.NULL) {
                JSONObject existing = required(snapshot, generationKey((String) pending));
                requirePrepared(existing, current);
                return new Prepared(existing); // Resolve original operation BEFORE a newer token.
            }
            long sequence = number(meta, "capture_sequence");
            if (sequence <= number(meta, "retired_capture_sequence")) throw new VaultFailure("custodial_provider_fresh_native_token_required");
            JSONObject token = required(snapshot, tokenKey(sequence));
            if (!"UNBOUND_TOKEN".equals(token.getString("state")) || sequence != number(token, "capture_sequence")) throw corrupt();
            String digest = token.getString("token_digest");
            if (!digest.equals(NativeProviderPrincipal.hash(token.getString("token")))) throw corrupt();
            if (meta.get("current_generation") != JSONObject.NULL) {
                JSONObject active = required(snapshot, generationKey(meta.getString("current_generation")));
                if (!"CONFIRMED".equals(active.getString("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(active.getJSONObject("principal")))) throw corrupt();
                if (digest.equals(active.getString("token_digest"))) return new Prepared(active); // Already confirmed, no new register HTTP.
            }
            String operation = UUID.randomUUID().toString(), generation = UUID.randomUUID().toString();
            JSONObject record = new JSONObject().put("schema", SCHEMA).put("state", "PREPARED_QUARANTINE")
                .put("generation_id", generation).put("operation_id", operation).put("principal", current.json())
                .put("principal_digest", current.digest).put("token_digest", digest).put("capture_sequence", sequence)
                .put("prepared_epoch", number(meta, "invalidation_epoch")).put("native_app", nativeApp.json());
            meta.put("pending_generation", generation);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, generationKey(generation), record); put(writes, META, meta);
            commit(snapshot, writes); return new Prepared(record);
        });
    }

    /** Called only after the typed HTTPS owner validates its exact response and rechecks
     * the current native principal. Pure tests inject that external boundary explicitly. */
    Prepared confirmRegistration(NativeProviderPrincipal current, Prepared expected, NativeProviderRegistrationReceipt receipt) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (expected == null || receipt == null) throw new VaultFailure("custodial_provider_registration_receipt_invalid");
            receipt.requireExpected(expected);
            JSONObject record = required(snapshot, generationKey(expected.generationId));
            if (!current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) throw new VaultFailure("custodial_provider_operation_stale");
            if ("CONFIRMED".equals(record.getString("state")) && expected.generationId.equals(meta.get("current_generation"))) {
                if (expected.confirmed) {
                    requireConfirmedStatus(snapshot, meta, current, expected);
                    if (!sameCommittedReceipt(record.getJSONObject("admission"), receipt.json())) throw new VaultFailure("custodial_provider_registration_receipt_invalid");
                    return new Prepared(record); // Fresh status clock is separate; never rewrite admission.
                }
                JSONObject original = new JSONObject(record.toString()); original.put("state", "PREPARED_QUARANTINE");
                for (String added : new String[]{"registration_id", "activated_at", "admission"}) original.remove(added);
                if (!NativeLegacyLineageJournal.same(original, expected.json())
                    || !sameCommittedReceipt(record.getJSONObject("admission"), receipt.json())) throw new VaultFailure("custodial_provider_registration_receipt_invalid");
                return new Prepared(record); // Lost local readback, no second transition/effect.
            }
            if (!expected.generationId.equals(meta.get("pending_generation")) || !NativeLegacyLineageJournal.same(record, expected.json()))
                throw new VaultFailure("custodial_provider_operation_stale");
            requirePrepared(record, current);
            Object previous = meta.get("current_generation");
            if (previous == JSONObject.NULL ? receipt.priorGenerationId != null : !previous.equals(receipt.priorGenerationId))
                throw new VaultFailure("custodial_provider_generation_chain_mismatch");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if (previous != JSONObject.NULL) {
                JSONObject old = required(snapshot, generationKey((String) previous));
                if (!"CONFIRMED".equals(old.get("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(old.getJSONObject("principal")))
                    || java.time.Instant.parse(old.getString("activated_at")).isAfter(java.time.Instant.parse(receipt.priorRetiredAt)))
                    throw new VaultFailure("custodial_provider_generation_chain_mismatch");
                old.put("state", "DISPATCH_RETIRED_ARRIVAL_DRAINING").put("dispatch_retired_at", receipt.priorRetiredAt);
                put(writes, generationKey((String) previous), old);
            }
            record.put("state", "CONFIRMED").put("registration_id", receipt.registrationId)
                .put("activated_at", receipt.activatedAt).put("admission", receipt.json());
            meta.put("pending_generation", JSONObject.NULL).put("current_generation", expected.generationId)
                .put("recovery_epoch", increment(number(meta, "recovery_epoch")));
            put(writes, generationKey(expected.generationId), record); put(writes, META, meta);
            commit(snapshot, writes); return new Prepared(record);
        });
    }

    private static boolean sameCommittedReceipt(JSONObject left, JSONObject right) throws VaultFailure {
        try {
            JSONObject a = new JSONObject(left.toString()), b = new JSONObject(right.toString());
            for (String field : new String[]{"replayed", "server_now"}) { a.remove(field); b.remove(field); }
            return NativeLegacyLineageJournal.same(a, b);
        } catch (Exception error) { throw new VaultFailure("custodial_provider_registration_receipt_invalid", error); }
    }

    /** Token is released only to the internal typed transport for an exact still-pending record. */
    char[] tokenForPrepared(NativeProviderPrincipal current, Prepared expected) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (expected == null || !expected.generationId.equals(meta.get("pending_generation"))) throw new VaultFailure("custodial_provider_operation_stale");
            JSONObject record = required(snapshot, generationKey(expected.generationId)); requirePrepared(record, current);
            if (!NativeLegacyLineageJournal.same(record, expected.json())) throw new VaultFailure("custodial_provider_operation_stale");
            JSONObject token = required(snapshot, tokenKey(number(record, "capture_sequence")));
            if (!"UNBOUND_TOKEN".equals(token.getString("state")) || !record.getString("token_digest").equals(token.getString("token_digest"))
                || !record.getString("token_digest").equals(NativeProviderPrincipal.hash(token.getString("token")))) throw corrupt();
            return token.getString("token").toCharArray();
        });
    }

    /** Provider-only conditional sample, one bounded encrypted record per existing
     * retained generation. Historical receipts and cleaning stores are untouched. */
    Prepared currentClockGeneration(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot=store.load(); JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            if(meta.isNull("current_generation")||!meta.isNull("pending_generation"))throw new VaultFailure("custodial_provider_operation_stale");
            Prepared result=new Prepared(required(snapshot,generationKey(meta.getString("current_generation"))));
            requireConfirmedStatus(snapshot,meta,current,result);return result;
        });
    }
    boolean acceptClock(NativeProviderPrincipal current,long engineRevision,Prepared expected,long epoch,
        NativeProviderClockExchange.Unqualified sample,NativeProviderTime.Profile profile,NativeProviderTime.Platform platform,
        NativeProviderClockExchange.Point point) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            if(expected==null||engineRevision<0||number(meta,"invalidation_epoch")!=epoch)throw new VaultFailure("custodial_provider_operation_stale");
            requireConfirmedStatus(snapshot,meta,current,expected);
            NativeProviderTime.Bounds fresh=NativeProviderTime.observe(sample,profile,platform,point);
            if(fresh==null)return false; // UNKNOWN never replaces or deletes original sample.
            ProviderRecordStore.Key key=clockKey(expected.generationId);JSONObject old=snapshot.keys().contains(key)?clockRecord(snapshot,key):null;
            if(old!=null){
                if(!"CURRENT".equals(old.getString("authority_state"))||!current.same(NativeProviderPrincipal.fromNativeJournal(old.getJSONObject("principal"))))
                    throw new VaultFailure("custodial_provider_operation_stale");
                if("FENCED".equals(old.getString("state")))return false; // Explicit new generation/requalification needed, not automatic clock forgiveness.
                NativeProviderClockExchange.Unqualified previous=NativeProviderClockExchange.Unqualified.restore(old.getJSONObject("sample"));
                if(previous.requestId.equals(sample.requestId)){
                    if(!NativeLegacyLineageJournal.same(previous.json(),sample.json()))throw corrupt();
                    return clockBoundTo(old,current,engineRevision,meta,profile)&&NativeProviderTime.observe(previous,profile,platform,point)!=null;
                }
                boolean conflict=sample.serverMicros<previous.serverMicros||sample.before.bootCount<number(old,"last_observed_boot_count");
                if(number(old,"last_observed_boot_count")==sample.before.bootCount){
                    conflict|=sample.before.elapsedMillis<number(old,"last_observed_elapsed_ms");
                }
                if(previous.after.bootCount==sample.before.bootCount){
                    if(profile.fingerprint().equals(old.getString("profile_fingerprint"))){
                        NativeProviderTime.Bounds priorNow=NativeProviderTime.observe(previous,profile,platform,point);
                        if(priorNow!=null&&!NativeProviderTime.overlaps(priorNow,fresh))conflict=true;
                    }
                }
                if(conflict){
                    old.put("state","FENCED").put("conflicting_sample",sample.json());
                    Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,key,old);commit(snapshot,writes);return false;
                }
            }
            JSONObject record=new JSONObject().put("schema",SCHEMA).put("clock_version",1).put("state","CURRENT").put("authority_state","CURRENT")
                .put("principal",current.json()).put("principal_digest",current.digest).put("engine_revision",engineRevision)
                .put("provider_epoch",epoch).put("binding_id",meta.get("binding_id")).put("generation_id",expected.generationId)
                .put("profile_id",profile.id).put("profile_fingerprint",profile.fingerprint()).put("sample",sample.json())
                .put("last_observed_elapsed_ms",point.elapsedMillis).put("last_observed_boot_count",point.bootCount).put("conflicting_sample",JSONObject.NULL);
            Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,key,record);commit(snapshot,writes);return true;
        });
    }
    Observation clockObservation(NativeProviderPrincipal current,long engineRevision,NativeProviderTime.Profile profile,
        NativeProviderTime.Platform platform,NativeProviderClockExchange.Point point) throws VaultFailure {
        return transition(() -> {
            Observation unknown=new Observation(null,point.elapsedMillis,point.bootCount);
            ProviderRecordStore.Snapshot snapshot=store.load();JSONObject meta=metadata(snapshot);requireAvailable(meta,current);
            if(profile==null||!profile.matches(platform)||meta.isNull("current_generation")||!meta.isNull("pending_generation"))return unknown;
            ProviderRecordStore.Key key=clockKey(meta.getString("current_generation"));if(!snapshot.keys().contains(key))return unknown;
            JSONObject record=clockRecord(snapshot,key);if(!clockBoundTo(record,current,engineRevision,meta,profile))return unknown;
            NativeProviderClockExchange.Unqualified sample=NativeProviderClockExchange.Unqualified.restore(record.getJSONObject("sample"));
            if(point.bootCount<number(record,"last_observed_boot_count")
                ||(point.bootCount==number(record,"last_observed_boot_count")&&point.elapsedMillis<number(record,"last_observed_elapsed_ms"))){
                record.put("state","FENCED");Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,key,record);commit(snapshot,writes);return unknown;
            }
            NativeProviderTime.Bounds bounds=NativeProviderTime.observe(sample,profile,platform,point);
            if(bounds==null){
                // An observed reboot/horizon failure cannot later revive this
                // sample if counters return to an old apparently usable value.
                // Preserve original evidence; only a NEW authenticated sample
                // with continuous high-water readings may establish authority.
                record.put("state","REFRESH_REQUIRED").put("last_observed_elapsed_ms",point.elapsedMillis).put("last_observed_boot_count",point.bootCount);
                Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,key,record);commit(snapshot,writes);return unknown;
            }
            if(point.elapsedMillis>number(record,"last_observed_elapsed_ms")){
                record.put("last_observed_elapsed_ms",point.elapsedMillis);Map<ProviderRecordStore.Key,char[]> writes=new HashMap<>();put(writes,key,record);commit(snapshot,writes);
            }
            return new Observation(bounds,point.elapsedMillis,point.bootCount);
        });
    }
    private static ProviderRecordStore.Key clockKey(String generation) throws VaultFailure {
        NativeLegacyLineageJournal.uuid(generation);return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA,"clock-"+generation);
    }
    private static JSONObject clockRecord(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key) throws Exception {
        JSONObject r=required(snapshot,key);
        NativeProviderClockExchange.exact(r,"schema","clock_version","state","authority_state","principal","principal_digest","engine_revision",
            "provider_epoch","binding_id","generation_id","profile_id","profile_fingerprint","sample","last_observed_elapsed_ms","last_observed_boot_count","conflicting_sample");
        if(!Integer.valueOf(1).equals(r.get("clock_version"))||!key.equals(clockKey(r.getString("generation_id")))
            ||!Arrays.asList("CURRENT","FENCED","REFRESH_REQUIRED").contains(r.getString("state"))
            ||!Arrays.asList("CURRENT","REVOKED_OR_FOREIGN").contains(r.getString("authority_state"))
            ||!r.getString("profile_fingerprint").matches("[0-9a-f]{64}")
            ||!r.getString("profile_id").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))throw corrupt();
        NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(r.getJSONObject("principal"));
        if(!principal.digest.equals(r.getString("principal_digest")))throw corrupt();NativeLegacyLineageJournal.uuid(r.getString("binding_id"));
        number(r,"engine_revision");number(r,"provider_epoch");number(r,"last_observed_elapsed_ms");
        if(number(r,"last_observed_boot_count")>Integer.MAX_VALUE)throw corrupt();
        NativeProviderClockExchange.Unqualified.restore(r.getJSONObject("sample"));
        if(!r.isNull("conflicting_sample"))NativeProviderClockExchange.Unqualified.restore(r.getJSONObject("conflicting_sample"));return r;
    }
    private static boolean clockBoundTo(JSONObject record,NativeProviderPrincipal current,long revision,JSONObject meta,NativeProviderTime.Profile profile) throws Exception {
        return profile!=null&&"CURRENT".equals(record.get("state"))&&"CURRENT".equals(record.get("authority_state"))
            &&current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))
            &&record.get("binding_id").equals(meta.get("binding_id"))&&record.get("generation_id").equals(meta.get("current_generation"))
            &&number(record,"engine_revision")==revision&&number(record,"provider_epoch")==number(meta,"invalidation_epoch")
            &&profile.id.equals(record.get("profile_id"))&&profile.fingerprint().equals(record.get("profile_fingerprint"));
    }

    private static void requireAvailable(JSONObject meta, NativeProviderPrincipal current) throws VaultFailure, org.json.JSONException {
        if (!"AVAILABLE".equals(meta.getString("availability")) || current == null || !current.same(principal(meta)))
            throw new VaultFailure("custodial_provider_waiting_native_principal");
    }
    private static void requirePrepared(JSONObject record, NativeProviderPrincipal current) throws VaultFailure, org.json.JSONException {
        if (!"PREPARED_QUARANTINE".equals(record.getString("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))
            || !current.digest.equals(record.getString("principal_digest"))) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static NativeProviderPrincipal principal(JSONObject meta) throws VaultFailure, org.json.JSONException {
        return meta.get("principal") == JSONObject.NULL ? null : NativeProviderPrincipal.fromNativeJournal(meta.getJSONObject("principal"));
    }
    private static void retireRegistrationRecords(ProviderRecordStore.Snapshot snapshot, JSONObject meta, Map<ProviderRecordStore.Key, char[]> writes) throws Exception {
        for (ProviderRecordStore.Key key : snapshot.keys()) {
            if (key.domain == ProviderEnvelopeCrypto.Domain.TOKEN || key.domain == ProviderEnvelopeCrypto.Domain.GENERATION) {
                JSONObject record = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(record.getString("state"))) {
                    record.put("state", "REVOKED_OR_FOREIGN"); put(writes, key, record);
                }
            } else if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX || key.domain == ProviderEnvelopeCrypto.Domain.QUARANTINE
                || key.domain == ProviderEnvelopeCrypto.Domain.EVENT || key.domain == ProviderEnvelopeCrypto.Domain.TOMBSTONE) {
                JSONObject record = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(record.getString("authority_state"))) {
                    // Preserve payload, original identity, event state and all action facts.
                    record.put("authority_state", "REVOKED_OR_FOREIGN");
                    if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                        queueOsCancel(record); record.put("mirror_retire_pending", true);
                    }
                    put(writes, key, record);
                }
            } else if (key.domain == ProviderEnvelopeCrypto.Domain.METADATA && key.id.startsWith("clock-")) {
                JSONObject clock=clockRecord(snapshot,key);
                if(!"REVOKED_OR_FOREIGN".equals(clock.getString("authority_state"))){
                    clock.put("authority_state","REVOKED_OR_FOREIGN");put(writes,key,clock);
                }
            } else if (key.domain == ProviderEnvelopeCrypto.Domain.METADATA && key.id.startsWith("recovery-")
                && !key.equals(ProviderRecordStore.DIAGNOSTIC)) {
                NativeLegacyLineageJournal.uuid(key.id.substring("recovery-".length()));
                JSONObject recovery = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(recovery.getString("authority_state"))) {
                    recovery.put("authority_state", "REVOKED_OR_FOREIGN"); put(writes, key, recovery);
                }
            } else if (key.equals(MAINTENANCE)) {
                // Known non-authoritative diagnostic stays byte-identical. Its old
                // binding/epoch cannot be exposed as current after the fence changes.
                maintenanceDiagnostic(snapshot);
            } else if (!key.equals(META) && !key.equals(ProviderRecordStore.DIAGNOSTIC)) {
                // Refuse incomplete fence ownership, rather than ignoring future inbox/events.
                throw new VaultFailure("custodial_provider_removal_slice_incomplete");
            }
        }
        meta.put("retired_capture_sequence", number(meta, "capture_sequence")).put("pending_generation", JSONObject.NULL).put("current_generation", JSONObject.NULL);
    }
    private static JSONObject metadata(ProviderRecordStore.Snapshot snapshot) throws VaultFailure, org.json.JSONException {
        if (snapshot.keys().isEmpty() && snapshot.revision == 0) return new JSONObject().put("schema", SCHEMA)
            .put("invalidation_epoch", 0).put("capture_sequence", 0).put("retired_capture_sequence", 0)
            .put("binding_id", JSONObject.NULL).put("recovery_epoch", 0)
            .put("availability", "UNAVAILABLE").put("principal", JSONObject.NULL).put("ever_bound", false)
            .put("pending_generation", JSONObject.NULL).put("current_generation", JSONObject.NULL);
        JSONObject meta = required(snapshot, META);
        if (meta.length() != 11 || !(meta.get("ever_bound") instanceof Boolean)
            || !(meta.get("pending_generation") == JSONObject.NULL || meta.get("pending_generation") instanceof String)
            || !(meta.get("current_generation") == JSONObject.NULL || meta.get("current_generation") instanceof String)
            || !java.util.Arrays.asList("UNAVAILABLE", "AVAILABLE", "REMOVED").contains(meta.get("availability"))) throw corrupt();
        number(meta, "invalidation_epoch"); number(meta, "recovery_epoch");
        if (meta.get("binding_id") != JSONObject.NULL) NativeLegacyLineageJournal.uuid(meta.getString("binding_id"));
        else if (meta.getBoolean("ever_bound")) throw corrupt();
        if (number(meta, "retired_capture_sequence") > number(meta, "capture_sequence")) throw corrupt();
        principal(meta); return meta;
    }
    private static JSONObject required(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key) throws VaultFailure {
        char[] text = snapshot.read(key);
        if (text == null) throw corrupt();
        try {
            JSONObject result = new JSONObject(new String(text));
            if (!SCHEMA.equals(result.get("schema"))) throw corrupt(); return result;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_journal_corrupt_preserved", error); }
        finally { Arrays.fill(text, '\0'); }
    }
    private static ProviderRecordStore.Key tokenKey(long sequence) { return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-" + sequence); }
    private static ProviderRecordStore.Key generationKey(String id) { return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.GENERATION, id); }
    private static long number(JSONObject value, String field) throws VaultFailure {
        Object number = value.opt(field);
        if (!(number instanceof Integer || number instanceof Long) || ((Number) number).longValue() < 0) throw corrupt();
        return ((Number) number).longValue();
    }
    private static long increment(long value) throws VaultFailure {
        if (value == Long.MAX_VALUE) throw new VaultFailure("custodial_provider_sequence_exhausted"); return value + 1;
    }
    private static void put(Map<ProviderRecordStore.Key, char[]> writes, ProviderRecordStore.Key key, JSONObject value) {
        char[] old = writes.put(key, value.toString().toCharArray()); if (old != null) Arrays.fill(old, '\0');
    }
    private void commit(ProviderRecordStore.Snapshot previous, Map<ProviderRecordStore.Key, char[]> writes) throws VaultFailure {
        commit(previous, writes, Collections.emptySet());
    }
    private void commit(ProviderRecordStore.Snapshot previous, Map<ProviderRecordStore.Key, char[]> writes, Set<ProviderRecordStore.Key> removals) throws VaultFailure {
        try { store.commit(previous.revision, writes, removals); }
        catch (VaultFailure error) {
            if ("custodial_provider_capacity_preserved".equals(error.code)) {
                // No rejected write was committed. Preserve every unresolved record and mark bounded recovery.
                char[] diagnostic = ("{\"schema\":\"" + SCHEMA + "\",\"recovery_needed\":true,\"reason\":\"CAPACITY_PRESERVED\"}").toCharArray();
                try { store.commit(previous.revision, Collections.singletonMap(ProviderRecordStore.DIAGNOSTIC, diagnostic), Collections.emptySet()); }
                finally { Arrays.fill(diagnostic, '\0'); }
            }
            throw error;
        }
        finally { for (char[] value : writes.values()) Arrays.fill(value, '\0'); }
    }
    private interface Transition<T> { T run() throws Exception; }
    private <T> T transition(Transition<T> action) throws VaultFailure {
        synchronized (lock) {
            if(ordinaryReadRevision==Long.MAX_VALUE)ordinaryReadUnknown=true;else ordinaryReadRevision++;
            if(ordinaryReadDepth==Integer.MAX_VALUE)ordinaryReadUnknown=true;else ordinaryReadDepth++;
            try { return action.run(); }
            catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_journal_corrupt_preserved", error); }
            finally {if(ordinaryReadDepth>0)ordinaryReadDepth--;else ordinaryReadUnknown=true;}
        }
    }
    private static VaultFailure corrupt() { return new VaultFailure("custodial_provider_journal_corrupt_preserved"); }
}
