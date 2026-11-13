package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Keystore-protected durable state for monotonic offline work time. */
final class AndroidOfflineAuthorityTimeStore implements OfflineAuthorityTime.OfflineAuthorityTimeStore, NativeAssignedActivationJournal.Store, NativePrincipalJournal.Store, NativeLegacyLineageJournal.Store, NativeSeparationFreeze.RecoveryStore, NativeSeparationFreeze.OrdinaryVaultAdmission, NativeRecurringTargetJournal.Store, NativeRecurringOrdinaryPurposeJournal.Store, NativeRecurringOrdinaryAttemptJournal.Store {
    private static final String PREFERENCES = "MemphisZooCustodialOfflineAuthorityTimeV1";
    private static final String ANCHOR_KEY = "offline_authority_anchor";
    private static final String ANCHOR_QUARANTINE_RECORD_PREFIX = "offline_authority_anchor_quarantine_record:";
    private static final String ANCHOR_QUARANTINE_METADATA_PREFIX = "offline_authority_anchor_quarantine_metadata:";
    private static final String ROLLBACK_FENCE_KEY = "rollback_fence";
    private static final String SCAN_ENTRIES_KEY = "offline_scan_entries";
    private static final String SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY = "offline_scan_journal_quarantine_active";
    private static final String SCAN_JOURNAL_QUARANTINE_PREFIX = "offline_scan_journal_quarantine_record:";
    private static final String SCAN_JOURNAL_DISPOSITION_LATEST_KEY = "offline_scan_journal_disposition_latest";
    private static final String SCAN_JOURNAL_DISPOSITION_PREFIX = "offline_scan_journal_disposition:";
    private static final String NFC_HANDOFFS_KEY = "native_nfc_handoffs";
    private static final String OCCURRENCE_PREFIX = "offline_occurrence_sha256:";
    private static final String FINISH_PROOF_PREFIX = "offline_finish_proof_sha256:";
    private static final String PROTECTION_AAD = "org.memphiszoo.custodial.native-vault.offline-authority-time.v1";
    private static final int MAX_PROTECTED_RECORD_CHARACTERS = 131_072;
    private static final int MAX_COMPLETION_RECORD_CHARACTERS = 2*NativeCompletionJournal.MAX_RECORD+128;
    private static final int MAX_WORK_ATTEMPT_CHARACTERS = 16*1024*1024;
    private final AndroidProtectedWorkPreferences preferences;
    private final SharedPreferences rawPreferences;
    private static final Object NFC_WRITE_LOCK = new Object();
    private static final Object WORK_WRITE_LOCK = new Object();
    private static final Map<SharedPreferences, WorkWrite> UNCERTAIN_WORK_WRITES = new java.util.IdentityHashMap<>();
    private static final class WorkWrite {
        final NativeWorkOriginalWriteAttempt attempt;final String record;
        WorkWrite(NativeWorkOriginalWriteAttempt attempt,String record){this.attempt=attempt;this.record=record;}
    }
    private static final Map<SharedPreferences, NfcWrite> UNCERTAIN_NFC_WRITES = new java.util.IdentityHashMap<>();
    enum NfcWriteResult { DURABLE, REFUSED, UNCERTAIN }
    private static final class NfcWrite {
        final NativeNfcOriginalWriteAttempt attempt;final String record;
        NfcWrite(NativeNfcOriginalWriteAttempt attempt,String record){this.attempt=attempt;this.record=record;}
    }
    // Actual principal producers only. This memory lifetime detects failed,
    // pending and ABA entry across adapters of the SAME private namespace. It
    // is not a durable generation, principal authority or an all-WORK lease.
    private static final Object ORDINARY_PRINCIPAL_LOCK=new Object();
    private static final Map<SharedPreferences,OrdinaryPrincipalState> ORDINARY_PRINCIPAL_STATES=new java.util.IdentityHashMap<>();
    private static final class OrdinaryPrincipalState {long revision;int pending;boolean unknown;}
    static final class OrdinaryPrincipalRead {
        private final AndroidOfflineAuthorityTimeStore owner;private final OrdinaryPrincipalState state;private final long revision;
        private OrdinaryPrincipalRead(AndroidOfflineAuthorityTimeStore owner,OrdinaryPrincipalState state){this.owner=owner;this.state=state;revision=state.revision;}
        void requireCurrent()throws VaultFailure {synchronized(ORDINARY_PRINCIPAL_LOCK){
            if(ORDINARY_PRINCIPAL_STATES.get(owner.rawPreferences)!=state||state.unknown||state.pending!=0||state.revision!=revision)
                throw new VaultFailure(NativePrincipalJournal.FAILURE);
        }}
    }
    OrdinaryPrincipalRead captureOrdinaryPrincipalRead()throws VaultFailure {synchronized(ORDINARY_PRINCIPAL_LOCK){
        OrdinaryPrincipalState state=ORDINARY_PRINCIPAL_STATES.get(rawPreferences);
        if(state==null){state=new OrdinaryPrincipalState();ORDINARY_PRINCIPAL_STATES.put(rawPreferences,state);}
        if(state.unknown||state.pending!=0)throw new VaultFailure(NativePrincipalJournal.FAILURE);
        return new OrdinaryPrincipalRead(this,state);
    }}
    private OrdinaryPrincipalState beginOrdinaryPrincipalWrite()throws VaultFailure {synchronized(ORDINARY_PRINCIPAL_LOCK){
        OrdinaryPrincipalState state=ORDINARY_PRINCIPAL_STATES.get(rawPreferences);
        if(state==null){state=new OrdinaryPrincipalState();ORDINARY_PRINCIPAL_STATES.put(rawPreferences,state);}
        if(state.unknown||state.revision==Long.MAX_VALUE||state.pending==Integer.MAX_VALUE){state.unknown=true;throw new VaultFailure(NativePrincipalJournal.FAILURE);}
        state.revision++;state.pending++;return state;
    }}
    private static void endOrdinaryPrincipalWrite(OrdinaryPrincipalState state){synchronized(ORDINARY_PRINCIPAL_LOCK){
        if(state.pending<=0){state.unknown=true;return;}state.pending--;
    }}

    private final CredentialCipher cipher;
    private final CredentialCipher legacyLineageCipher;
    private final CredentialCipher nfcWriteCipher;
    private final CredentialCipher workWriteCipher;
    private final CredentialCipher completionCipher;

    /** Fixed existing WORK namespace binding only; no editor, cipher or key. */
    static AndroidProtectedWorkPreferences bindOrdinaryAdmission(Context context) {
        return new AndroidProtectedWorkPreferences(AndroidProtectedWorkPreferences.bindExistingNativeEpoch(context,
            context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)));
    }

    AndroidOfflineAuthorityTimeStore(Context context) {
        this(
            AndroidProtectedWorkPreferences.bindExistingNativeEpoch(context,
                context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)),
            new AndroidKeystoreCipher(PROTECTION_AAD, MAX_PROTECTED_RECORD_CHARACTERS),
            new AndroidKeystoreCipher(PROTECTION_AAD+".legacy-lineage.v1", MAX_PROTECTED_RECORD_CHARACTERS),
            new AndroidKeystoreCipher(PROTECTION_AAD+".original-nfc-write.v1", MAX_PROTECTED_RECORD_CHARACTERS),
            new AndroidKeystoreCipher(PROTECTION_AAD+".original-work-write.v1", MAX_WORK_ATTEMPT_CHARACTERS),
            new AndroidKeystoreCipher(PROTECTION_AAD, MAX_COMPLETION_RECORD_CHARACTERS)
        );
    }

    /** Package-private fault-injection seam for the encrypted journal adapter. */
    AndroidOfflineAuthorityTimeStore(SharedPreferences preferences, CredentialCipher cipher) {
        this(preferences,cipher,cipher,cipher,cipher,cipher);
    }
    private AndroidOfflineAuthorityTimeStore(SharedPreferences preferences,CredentialCipher cipher,CredentialCipher legacyLineageCipher,CredentialCipher nfcWriteCipher,CredentialCipher workWriteCipher,CredentialCipher completionCipher) {
        this.rawPreferences = preferences;
        this.preferences = new AndroidProtectedWorkPreferences(preferences);
        this.cipher = cipher;
        this.legacyLineageCipher=legacyLineageCipher;
        this.nfcWriteCipher=nfcWriteCipher;
        this.workWriteCipher=workWriteCipher;
        this.completionCipher=completionCipher;
    }

    /** Ordinary work admission is separate from read-only retained evidence.
     * Presence of even an unreadable fence denies new authority. Recovery uses
     * its own purpose-specific path, never an ordinary cached-success return. */
    @Override public void requireWorkAdmission() throws VaultFailure {
        try {
            if (preferences.frozen()) throw new VaultFailure(AndroidProtectedWorkPreferences.FAILURE);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(AndroidProtectedWorkPreferences.FAILURE,error); }
    }

    /** No new store, marker, key or interpretation. Even a malformed persisted
     * FENCE/PROBE or an uncertain in-memory cancellation denies ordinary vault
     * recovery/rotation/HTTP. This check is not an all-writer atomic lease. */
    @Override public void requireOrdinaryVaultAdmission() throws VaultFailure {
        requireWorkAdmission();
    }

    /** Actual SAME store's complete encrypted WORK observation. This is not a
     * writer lease, semantic empty-work verdict, OS effect or receipt grant.
     * PROCESS_ONLY may be observed as DATA, but cannot pass the mandatory
     * installed-native-generation check used by the private Engine join. */
    static final class WholeWorkRead implements AutoCloseable {
        private final AndroidOfflineAuthorityTimeStore owner;
        private AndroidProtectedWorkPreferences.ReadOnlyObservation original;
        private AndroidProtectedWorkPreferences.OrdinaryReadGeneration generation;
        private boolean retired;
        private WholeWorkRead(AndroidOfflineAuthorityTimeStore owner,
            AndroidProtectedWorkPreferences.ReadOnlyObservation original,
            AndroidProtectedWorkPreferences.OrdinaryReadGeneration generation){
            this.owner=owner;this.original=original;this.generation=generation;
        }
        void requireReadOnlyCurrent(AndroidOfflineAuthorityTimeStore expected)throws VaultFailure {
            synchronized(this){
                if(retired||owner!=expected||original==null||original.frozen)throw workReadFailure();
                owner.requireNoUncertainOriginalWrites();owner.requireWorkAdmission();
                if(!owner.preferences.matchesReadOnly(original))throw workReadFailure();
                if(generation!=null)AndroidProtectedWorkPreferences.requireOrdinaryReadGeneration(generation);
                owner.requireNoUncertainOriginalWrites();owner.requireWorkAdmission();
                if(!owner.preferences.matchesReadOnly(original))throw workReadFailure();
            }
        }
        void requireInstalledNativeGeneration(AndroidOfflineAuthorityTimeStore expected)throws VaultFailure {
            synchronized(this){
                requireReadOnlyCurrent(expected);
                AndroidProtectedWorkPreferences.requireOrdinaryReadGeneration(generation);
                requireReadOnlyCurrent(expected);
            }
        }
        void requireExactOriginalTarget(AndroidOfflineAuthorityTimeStore expected,
            NativeRecurringTargetJournal.RetainedTargetData target,String actualResponseSha256)throws VaultFailure {
            synchronized(this){
                requireInstalledNativeGeneration(expected);
                if(target==null||actualResponseSha256==null)throw workReadFailure();
                requireRecurringKey(target.key);Object raw=original.values.get(target.key);
                if(!(raw instanceof String))throw workReadFailure();
                // Decode ONLY the original captured ciphertext; no selected
                // live row read or uncertain-write reconciliation is invoked.
                JSONObject decoded=owner.decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE);
                if(!target.record.equals(decoded.toString())
                    ||!"custodial.native-recurring-authenticated-target-data.v2".equals(decoded.opt("schema"))
                    ||!Boolean.FALSE.equals(decoded.opt("receipt_eligible"))
                    ||!actualResponseSha256.equals(decoded.opt("native_authorized_response_sha256")))
                    throw workReadFailure();
                // First retained-wire identity and latest-issued wire identity
                // must match here; ordinary GET capture remains unchanged.
                requireInstalledNativeGeneration(expected);
            }
        }
        @Override public synchronized void close(){retired=true;original=null;generation=null;}
    }
    private static VaultFailure workReadFailure(){return new VaultFailure(NativeRecurringTargetJournal.FAILURE);}
    private void requireNoUncertainOriginalWrites()throws VaultFailure {
        // Short independent observations, never nested NFC/WORK monitors and
        // never a monitor held over UI, crypto, HTTP or a caller callback.
        synchronized(WORK_WRITE_LOCK){if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw workReadFailure();}
        synchronized(NFC_WRITE_LOCK){if(UNCERTAIN_NFC_WRITES.containsKey(rawPreferences))throw workReadFailure();}
    }
    WholeWorkRead captureWholeWorkRead()throws VaultFailure {
        try{
            requireNoUncertainOriginalWrites();requireWorkAdmission();
            var generation=AndroidProtectedWorkPreferences.observeOrdinaryReadGeneration();
            var original=preferences.observeReadOnly();
            if(original.frozen)throw workReadFailure();
            // Include every raw key/type/value, including unreadable and
            // unrecognized ciphertext. Existing whole-WORK bounds stay exact.
            NativeProtectedWorkSnapshot.capture(original.values);
            WholeWorkRead read=new WholeWorkRead(this,original,generation);
            try{read.requireReadOnlyCurrent(this);return read;}
            catch(VaultFailure|RuntimeException|Error failure){read.close();throw failure;}
        }catch(VaultFailure failure){throw failure;}
        catch(RuntimeException failure){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,failure);}
    }

    /** Capture once under original storage locks, decode only the immutable view,
     * and recheck original complete bytes/admission before reporting. No editor. */
    NativeReadinessObservation.Snapshot captureReadinessObservation(OfflineAuthorityTime time) throws VaultFailure {
        synchronized(NFC_WRITE_LOCK) {
            AndroidProtectedWorkPreferences.ReadOnlyObservation original=preferences.observeReadOnly();
            boolean uncertain=UNCERTAIN_NFC_WRITES.containsKey(rawPreferences);
            AndroidOfflineAuthorityTimeStore frozen=new AndroidOfflineAuthorityTimeStore(new AndroidReadOnlyPreferences(original.values),cipher,legacyLineageCipher,nfcWriteCipher,workWriteCipher,completionCipher);
            return new NativeReadinessObservation.Snapshot(time.readOnlyView(frozen),new NativePrincipalJournal(frozen),new NativeLegacyLineageJournal(frozen),
                original.frozen || uncertain, () -> { synchronized(NFC_WRITE_LOCK) {
                    return uncertain==UNCERTAIN_NFC_WRITES.containsKey(rawPreferences) && preferences.matchesReadOnly(original);
                }});
        }
    }

    /** Native owner captures this BEFORE validating/signing its original
     * principal; final CAS refuses any intervening work or identity mutation.
     * An existing fence is intentionally not hidden from a fresh inventory. */
    @Override public Map<String,?> separationRawSnapshot() throws VaultFailure {
        try{return preferences.protectedSnapshot();}
        catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }

    @Override public synchronized void prepareSeparationProbe(Map<String,?> original)throws VaultFailure{
        final String code=AndroidProtectedWorkPreferences.FAILURE;
        try{
            NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(original);
            Object retained=preferences.recoverableProbe();
            String encoded;
            if(retained==null&&!preferences.contains(AndroidProtectedWorkPreferences.PROBE_KEY)){
                JSONObject pending=new JSONObject().put("schema","custodial.separation-check-pending.v1")
                    .put("operation_id",UUID.randomUUID().toString()).put("raw_snapshot_sha256",snapshot.digest).put("separation_observed",false);
                encoded=protect(pending,code,true);
            }else{
                if(!(retained instanceof String))throw new VaultFailure(code);
                encoded=(String)retained;requirePendingProbe(encoded,original);
            }
            preferences.prepareProbe(original,encoded);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(code,error);}
    }

    private void requirePendingProbe(String encoded,String digest)throws VaultFailure{
        final String code=AndroidProtectedWorkPreferences.FAILURE;
        try{
            JSONObject pending=decodeProtectedRecord(encoded,code);
            requireKeys(pending,code,"schema","operation_id","raw_snapshot_sha256","separation_observed");
            if(!"custodial.separation-check-pending.v1".equals(pending.get("schema"))
                ||!(pending.get("operation_id") instanceof String)
                ||!pending.getString("operation_id").matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                ||!digest.equals(pending.get("raw_snapshot_sha256"))||!Boolean.FALSE.equals(pending.get("separation_observed")))throw new VaultFailure(code);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(code,error);}
    }

    private void requirePendingProbe(String encoded,Map<String,?> currentWithoutProbe)throws VaultFailure {
        AndroidProtectedWorkPreferences.ProbeContinuation continuation=
            preferences.ownedProbeContinuation(currentWithoutProbe,encoded);
        // Only the exact native cancellation handle can name a predecessor.
        // No handle after restart: the existing v1 full-raw check still fails
        // closed when the visible epoch differs from the encrypted original.
        Map<String,?> original=continuation==null?currentWithoutProbe:continuation.original;
        requirePendingProbe(encoded,NativeProtectedWorkSnapshot.capture(original).digest);
    }

    @Override public synchronized Map<String,?> preparePendingSeparationRecovery()throws VaultFailure{
        Map<String,Object> raw=new java.util.HashMap<>(separationRawSnapshot());
        if(raw.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY)||preferences.recoverableProbe()==null)
            throw new VaultFailure(AndroidProtectedWorkPreferences.FAILURE);
        raw.remove(AndroidProtectedWorkPreferences.PROBE_KEY);
        // Recommit the SAME operation before network, including an ambiguous
        // earlier cancellation. No missing check is created by this operation.
        prepareSeparationProbe(raw);
        return separationRawSnapshot();
    }

    @Override public synchronized void cancelPendingSeparationRecovery(Map<String,?> captured)throws VaultFailure{
        if(captured==null)throw new VaultFailure(AndroidProtectedWorkPreferences.FAILURE);
        Map<String,Object> raw=new java.util.HashMap<>(captured);
        Object encoded=raw.remove(AndroidProtectedWorkPreferences.PROBE_KEY);
        if(raw.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY)||!(encoded instanceof String))
            throw new VaultFailure(AndroidProtectedWorkPreferences.FAILURE);
        requirePendingProbe((String)encoded,raw);
        preferences.cancelProbe(raw,(String)encoded);
    }

    @Override public JSONObject readSeparationSnapshotEvidence(Map<String,?> captured)throws VaultFailure{
        Object encoded=captured==null?null:captured.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        if(!(encoded instanceof String)||((String)encoded).isEmpty())throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
        return decodeProtectedRecord((String)encoded,NativeProtectedWorkSnapshot.FAILURE);
    }

    /** Read-only native discovery from EXACT captured ciphertext, not live
     * getters that could silently cross inventories. No clear records or keys
     * leave this native-only decoder; the discovery returns digests/IDs only. */
    @Override public NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence proof)throws VaultFailure{
        return NativeProtectedWorkInventory.inspect(original,proof,(key,raw)->{
            char[] clear=null;
            try{
                if(!(raw instanceof String)||((String)raw).isEmpty())throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
                JSONObject envelope=ProviderWireJson.object(((String)raw).getBytes(StandardCharsets.UTF_8),262144);
                requireKeys(envelope,NativeProtectedWorkSnapshot.FAILURE,"ciphertext","iv");
                if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
                CredentialCipher decoder=key.startsWith("legacy_lineage:")?legacyLineageCipher:cipher;
                clear=decoder.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
                if(clear.length>MAX_PROTECTED_RECORD_CHARACTERS)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
                java.nio.ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                    .encode(java.nio.CharBuffer.wrap(clear));
                byte[] bytes=new byte[encoded.remaining()];encoded.get(bytes);
                try{return new NativeProtectedWorkInventory.Decoded(ProviderWireJson.object(bytes,262144),sha256(new String(clear)));}
                finally{java.util.Arrays.fill(bytes,(byte)0);}
            }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
            finally{if(clear!=null)VaultValidation.wipe(clear);}
        });
    }

    /** Read-only one-receipt argument comparison from captured original encrypted
     * values. Proof authentication and before/after actor/raw checks belong to
     * the native separation coordinator; no ordinary getter/editor is used. */
    @Override public NativeCompletionJournal.RetainedArgumentMatch compareRetainedCompletionArguments(Map<String,?> original,
        NativeSeparationEvidence proof,String sourceKey,byte[] candidate)throws VaultFailure{
        char[] clear=null;byte[] bytes=null;
        try{
            if(original==null||proof==null||sourceKey==null||!sourceKey.matches("[a-f0-9]{64}")
                ||!NativeProtectedWorkSnapshot.capture(original).digest.equals(proof.rawSnapshotDigest))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            Object raw=original.get(serverReceiptKey(sourceKey));if(!(raw instanceof String))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            JSONObject envelope=ProviderWireJson.object(((String)raw).getBytes(StandardCharsets.UTF_8),262144);
            requireKeys(envelope,NativeProtectedWorkSnapshot.FAILURE,"ciphertext","iv");
            if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            if(clear.length>MAX_PROTECTED_RECORD_CHARACTERS)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            java.nio.ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(clear));
            try{bytes=new byte[encoded.remaining()];encoded.get(bytes);}finally{if(encoded.hasArray())java.util.Arrays.fill(encoded.array(),(byte)0);}
            JSONObject wrapper=ProviderWireJson.object(bytes,262144);requireKeys(wrapper,NativeProtectedWorkSnapshot.FAILURE,"receipt");
            if(!(wrapper.get("receipt") instanceof String))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            JSONObject principal=new JSONObject(proof.body).getJSONObject("original_principal");
            return NativeCompletionJournal.compareRetainedArgumentValues(principal.getString("device_id"),sourceKey,wrapper.getString("receipt"),candidate);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
        finally{if(clear!=null)VaultValidation.wipe(clear);if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);}
    }

    @Override public NativeRetainedCompletionSemantics.Observation inspectRetainedCompletionSemantics(Map<String,?> original,
        NativeSeparationEvidence proof,String sourceKey,byte[] candidate,char[] credential)throws VaultFailure{
        return NativeRetainedCompletionSemantics.inspect(original,proof,sourceKey,candidate,credential,this::decodeRetainedCompletionValue);
    }
    @Override public NativeRetainedCompletionCensus.Observation inspectRetainedCompletionCensus(Map<String,?> original,
        NativeSeparationEvidence proof,java.util.List<byte[]> candidates,char[] credential)throws VaultFailure{
        return NativeRetainedCompletionCensus.inspect(original,proof,candidates,credential,this::decodeRetainedCompletionValue);
    }
    @Override public java.util.List<byte[]> collectRetainedCompletionReadArguments(Map<String,?> original,
        NativeSeparationEvidence proof,char[] credential)throws VaultFailure{
        return NativeRetainedCompletionCensus.collectNativeReadArguments(original,proof,credential,this::decodeRetainedCompletionValue);
    }
    @Override public java.util.List<NativeRetainedCompletionCensus.NativeReadGroup> collectRetainedCompletionReadGroups(
        Map<String,?> original,NativeSeparationEvidence proof,char[] credential)throws VaultFailure{
        return NativeRetainedCompletionCensus.collectNativeReadGroups(original,proof,credential,this::decodeRetainedCompletionValue);
    }
    private NativeProtectedWorkInventory.Decoded decodeRetainedCompletionValue(String key,Object raw)throws VaultFailure{
            char[] clear=null;byte[] bytes=null;
            try{
                if(!(raw instanceof String)||((String)raw).isEmpty())throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE);
                JSONObject envelope=ProviderWireJson.object(((String)raw).getBytes(StandardCharsets.UTF_8),262144);
                requireKeys(envelope,NativeRetainedCompletionSemantics.FAILURE,"ciphertext","iv");
                if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE);
                clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
                if(clear.length>MAX_PROTECTED_RECORD_CHARACTERS)throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE);
                java.nio.ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(clear));
                try{bytes=new byte[encoded.remaining()];encoded.get(bytes);}finally{if(encoded.hasArray())java.util.Arrays.fill(encoded.array(),(byte)0);}
                return new NativeProtectedWorkInventory.Decoded(ProviderWireJson.object(bytes,262144),sha256(new String(clear)));
            }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE,error);}
            finally{if(clear!=null)VaultValidation.wipe(clear);if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);}
    }

    /** Unmounted H04 storage stage. Only the exact signed raw snapshot can be
     * frozen; semantic/browser inventory remain UNKNOWN. Existing work key is
     * required, never generated/replaced. This grants no recovery ACK or reuse.
     */
    @Override public synchronized void freezeSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence evidence)throws VaultFailure{
        final String code=AndroidProtectedWorkPreferences.FAILURE;
        try{
            if(evidence==null||!NativeProtectedWorkSnapshot.capture(original).digest.equals(evidence.rawSnapshotDigest))
                throw new VaultFailure(code);
            JSONObject wire=evidence.json();String protectedRecord=preferences.getString(AndroidProtectedWorkPreferences.FENCE_KEY,null);
            if(protectedRecord==null)protectedRecord=protect(wire,code,true);
            else{
                JSONObject prior=load(AndroidProtectedWorkPreferences.FENCE_KEY,code);
                if(prior==null||!ProviderWireJson.same(prior,wire))throw new VaultFailure(code);
            }
            // Reuses exact ciphertext on ambiguous retry; primitive recommits
            // it to disk before success. Original records are never rewritten.
            String probe=preferences.getString(AndroidProtectedWorkPreferences.PROBE_KEY,null);
            if(probe!=null)requirePendingProbe(probe,evidence.rawSnapshotDigest);
            preferences.freeze(original,protectedRecord,probe);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(code,error);}
    }

    private String legacyKey(String key)throws VaultFailure{
        if(!"principal".equals(key)&&!key.matches("(binding|activation|terminal|invalidated):[a-f0-9-]{36}"))throw NativeLegacyLineageJournal.invalid();
        return "legacy_lineage:"+key;
    }
    @Override public synchronized String loadLegacyRecord(String key)throws VaultFailure{
        synchronized(WORK_WRITE_LOCK){
        reconcileUncertainWorkWrite();
        String encoded=preferences.getString(legacyKey(key),null);if(encoded==null)return null;
        char[] clear=null;
        try{
            JSONObject envelope=new JSONObject(encoded);requireKeys(envelope,NativeLegacyLineageJournal.FAILURE,"ciphertext","iv");
            clear=legacyLineageCipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            if(clear.length>8192)throw NativeLegacyLineageJournal.invalid();
            JSONObject record=new JSONObject(String.valueOf(clear));
            requireKeys(record,NativeLegacyLineageJournal.FAILURE,"key","value");
            if(!key.equals(record.getString("key")))throw NativeLegacyLineageJournal.invalid();
            return record.getString("value");
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeLegacyLineageJournal.invalid(e);}
        finally{if(clear!=null)VaultValidation.wipe(clear);}
        }
    }
    @Override public synchronized void saveLegacyRecord(String key,String value)throws VaultFailure{
        OrdinaryPrincipalState principalWrite=beginOrdinaryPrincipalWrite();
        try{saveLegacyRecordOriginal(key,value);}
        finally{endOrdinaryPrincipalWrite(principalWrite);}
    }
    private void saveLegacyRecordOriginal(String key,String value)throws VaultFailure{
        String target=legacyKey(key);char[] clear=null;
        try{synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();
            var observation=preferences.observeReadOnly();Object old=observation.values.get(target);
            if(old!=null&&!(old instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
            if(value==null||value.length()>4096)throw NativeLegacyLineageJournal.invalid();
            if(!preferences.contains(target)&&preferences.getAll().keySet().stream().filter(k->k.startsWith("legacy_lineage:")).count()>=1024)
                throw new VaultFailure("custodial_legacy_lineage_capacity");
            clear=new JSONObject().put("key",key).put("value",value).toString().toCharArray();
            EncryptedSecret secret=legacyLineageCipher.encryptWithExistingKey(clear);
            String encoded=new JSONObject().put("ciphertext",secret.ciphertext).put("iv",secret.iv).toString();
            persistOriginalWorkValue(observation,target,(String)old,encoded);
            if(!value.equals(loadLegacyRecord(key)))throw NativeLegacyLineageJournal.invalid();
        }
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeLegacyLineageJournal.invalid(e);}
        finally{if(clear!=null)VaultValidation.wipe(clear);}
    }

    private static final String SERVER_RECEIPT_PREFIX = "authenticated_completion_receipt_sha256:";
    @Override public synchronized String loadPrincipal() throws VaultFailure {
        JSONObject record=load("authenticated_principal",NativePrincipalJournal.FAILURE);
        return record==null?null:record.toString();
    }
    @Override public synchronized void savePrincipal(String record) throws VaultFailure {
        OrdinaryPrincipalState principalWrite=beginOrdinaryPrincipalWrite();
        try{save("authenticated_principal",new JSONObject(record),NativePrincipalJournal.FAILURE,true);}
        catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(NativePrincipalJournal.FAILURE,e);}
        finally{endOrdinaryPrincipalWrite(principalWrite);}
    }
    @Override public synchronized String loadAssignedActivation() throws VaultFailure {
        JSONObject record=load("assigned_activation_proof",NativeAssignedActivationJournal.FAILURE);
        return record==null?null:record.toString();
    }
    @Override public synchronized String loadAssignedActivationTransport() throws VaultFailure {
        JSONObject record=load("assigned_activation_transport",NativeAssignedActivationJournal.FAILURE);
        return record==null?null:record.toString();
    }
    @Override public synchronized void saveAssignedActivationTransport(String record) throws VaultFailure {
        try {save("assigned_activation_transport",new JSONObject(record),NativeAssignedActivationJournal.FAILURE,true);}
        catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(NativeAssignedActivationJournal.FAILURE,e);}
    }
    @Override public synchronized void saveAssignedActivation(String record) throws VaultFailure {
        try {save("assigned_activation_proof",new JSONObject(record),NativeAssignedActivationJournal.FAILURE,true);}
        catch(VaultFailure e){throw e;}
        catch(Exception e){throw new VaultFailure(NativeAssignedActivationJournal.FAILURE,e);}
    }
    private static void requireRecurringKey(String key)throws VaultFailure {
        if(key==null||!key.matches("(?:native_recurring_target_sha256:|native_recurring_view_chunk_sha256:|native_notification_mutation_sha256:)[a-f0-9]{64}"))
            throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
    }
    @Override public String loadRecurringRecord(String key)throws VaultFailure {
        requireRecurringKey(key);
        synchronized(WORK_WRITE_LOCK) {
            reconcileUncertainWorkWrite();requireWorkAdmission();
            var observation=preferences.observeReadOnly();Object raw=observation.values.get(key);
            if(raw==null){if(!preferences.matchesReadOnly(observation))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);return null;}
            if(!(raw instanceof String))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            String original=(String)raw;
            JSONObject decoded=decodeProtectedRecord(original,NativeRecurringTargetJournal.FAILURE);
            if(!preferences.matchesReadOnly(observation))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return decoded.toString();
        }
    }
    @Override public Map<String,String> recurringRecords()throws VaultFailure {
        synchronized(WORK_WRITE_LOCK) {
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            Map<String,String> rows=new LinkedHashMap<>();
            for(String key:new java.util.TreeSet<>(observation.values.keySet())) {
                if(!key.startsWith(NativeRecurringTargetJournal.TARGET_PREFIX)&&!key.startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)&&!key.startsWith(NativeRecurringTargetJournal.VIEW_PREFIX))continue;
                requireRecurringKey(key);Object raw=observation.values.get(key);
                if(!(raw instanceof String))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                rows.put(key,decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString());
            }
            if(rows.size()>1024||!preferences.matchesReadOnly(observation))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return java.util.Collections.unmodifiableMap(rows);
        }
    }
    @Override public Map<String,String> notificationEffectRecords(NativeProviderPrincipal principal,String serviceDate)throws VaultFailure {
        synchronized(WORK_WRITE_LOCK) {
            if(principal==null||serviceDate==null||!serviceDate.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            Map<String,String> rows=new java.util.TreeMap<>();java.util.Set<String> targets=new java.util.TreeSet<>();
            for(String key:observation.values.keySet())if(key.startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)) {
                requireRecurringKey(key);Object raw=observation.values.get(key);
                if(!(raw instanceof String))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                JSONObject decoded=decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE);
                try {
                    if(!principal.same(NativeProviderPrincipal.fromNativeJournal(decoded.getJSONObject("principal"))))continue;
                    String date=new JSONObject(decoded.getString("raw_notification")).getJSONObject("extra").getString("service_date");
                    if(!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);java.time.LocalDate.parse(date);
                    if(!serviceDate.equals(date))continue;
                }catch(VaultFailure unknown){throw unknown;}catch(Exception unknown){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,unknown);}
                rows.put(key,decoded.toString());
                Object target=decoded.opt("target_reference");
                if(target instanceof String&&((String)target).matches("native_recurring_target_sha256:[a-f0-9]{64}"))targets.add((String)target);
            }
            if(rows.size()>1024)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            for(String key:targets){Object raw=observation.values.get(key);
                if(raw==null)continue; // Relevant strict reader will refuse missing original; never create it.
                if(!(raw instanceof String))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                rows.put(key,decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString());
            }
            // One actual raw observation brackets ALL final decode/key calls.
            // No view chunks, new writes/namespace or all-WORK admission verdict.
            if(!preferences.matchesReadOnly(observation))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return java.util.Collections.unmodifiableMap(rows);
        }
    }
    @Override public void compareAndRetainRecurringRecord(String key,String previous,String candidate)throws VaultFailure {
        requireRecurringKey(key);
        try {synchronized(WORK_WRITE_LOCK) {
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            Object raw=observation.values.get(key);
            if(raw!=null&&!(raw instanceof String)||candidate==null||candidate.length()>NativeRecurringTargetJournal.MAX_RECORD)
                throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            String actual=raw==null?null:decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString();
            if(!java.util.Objects.equals(actual,previous))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            long count=observation.values.keySet().stream().filter(k->k.startsWith(NativeRecurringTargetJournal.TARGET_PREFIX)
                ||k.startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)||k.startsWith(NativeRecurringTargetJournal.VIEW_PREFIX)).count();
            if(raw==null&&count>=1024)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            JSONObject value=new JSONObject(candidate);
            if(!Boolean.FALSE.equals(value.get("receipt_eligible")))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            String encoded=protect(value,NativeRecurringTargetJournal.FAILURE,true);
            Map<String,Object> projected=new LinkedHashMap<>(observation.values);projected.put(key,encoded);
            // Enforce the complete ordinary + narrow view-family quota BEFORE
            // retaining a one-row attempt; never strand a new overbound row.
            NativeProtectedWorkSnapshot.capture(projected);
            // SAME actual original WORK CAS/epoch/unknown-commit owner. No new
            // preference namespace, key creation, blind replay or deletion.
            persistOriginalWorkValue(observation,key,(String)raw,encoded);
            if(!value.toString().equals(loadRecurringRecord(key)))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
        }}catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    /** Short normal encrypted WORK CAS only. No all-WORK lease, baseline,
     * native Current, monitor over UI/HTTP, or receipt/effect permission. */
    @Override public String retainOrdinaryRecurringPrepared(String key,NativeRecurringTargetJournal.RetainedTargetData target,
        String candidate,NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
        if(key==null||!key.matches("native_recurring_purpose_sha256:[a-f0-9]{64}")||target==null||owner==null)
            throw NativeRecurringOrdinaryPurposeJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            // No implicit reconciliation while establishing this expectation.
            // Unrelated existing raw rows remain untouched by original CAS.
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryPurposeJournal.invalid();
            requireWorkAdmission();owner.requireLatest();var observation=preferences.observeReadOnly();
            Object rawTarget=observation.values.get(target.key);
            if(!(rawTarget instanceof String)||!target.record.equals(decodeProtectedRecord((String)rawTarget,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            Object raw=observation.values.get(key);if(raw!=null&&!(raw instanceof String))throw NativeRecurringOrdinaryPurposeJournal.invalid();
            JSONObject wanted=NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,candidate);
            if(raw!=null){
                String retained=decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString();
                NativeRecurringOrdinaryPurposeJournal.requireSamePrepared(key,retained,candidate);
                owner.requireLatest();requireWorkAdmission();
                if(!preferences.matchesReadOnly(observation))throw NativeRecurringOrdinaryPurposeJournal.invalid();
                return retained; // Preserve first purpose wire and every original byte.
            }
            long count=observation.values.keySet().stream().filter(k->k.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX)).count();
            if(count>=256)return null; // Pending capacity; never discard old originals.
            String encoded=protect(wanted,NativeRecurringTargetJournal.FAILURE,true);
            owner.requireLatest();requireWorkAdmission();
            Map<String,Object> projected=new LinkedHashMap<>(observation.values);projected.put(key,encoded);
            NativeProtectedWorkSnapshot.capture(projected);
            persistOriginalWorkValue(observation,key,null,encoded);
            // Short verified exact own successor; do not adopt a later epoch
            // or impose long-lived equality on unrelated normal WORK activity.
            var after=preferences.observeReadOnly();Object saved=after.values.get(key);
            if(!(saved instanceof String)||!candidate.equals(decodeProtectedRecord((String)saved,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            Object afterTarget=after.values.get(target.key);
            if(!(afterTarget instanceof String)||!target.record.equals(decodeProtectedRecord((String)afterTarget,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            owner.requireLatest();requireWorkAdmission();
            if(!preferences.matchesReadOnly(after))throw NativeRecurringOrdinaryPurposeJournal.invalid();
            return candidate;
        }}catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    /** Last narrow birth observation AFTER all Engine owner callbacks. No
     * callback/crypto result is lent past its final actual raw observation. */
    @Override public void requireOrdinaryRecurringPreparedCurrent(NativeRecurringTargetJournal.RetainedTargetData target,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
        if(target==null||prepared==null||owner==null)throw NativeRecurringOrdinaryPurposeJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryPurposeJournal.invalid();
            owner.requireLatest();requireWorkAdmission();var observed=preferences.observeReadOnly();
            Object rawTarget=observed.values.get(target.key),rawPurpose=observed.values.get(prepared.key);
            if(!(rawTarget instanceof String)||!(rawPurpose instanceof String)
                ||!target.record.equals(decodeProtectedRecord((String)rawTarget,NativeRecurringTargetJournal.FAILURE).toString())
                ||!prepared.record.equals(decodeProtectedRecord((String)rawPurpose,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record);
            owner.requireLatest();requireWorkAdmission();
            // Includes the original raw mutation stamp; a callback's change
            // to either relevant row, even during decrypt/owner checks, refuses.
            // The short observation may also stale-refuse an unrelated write;
            // no exclusion/lease is held over UI or HTTP.
            if(!preferences.matchesReadOnly(observed))throw NativeRecurringOrdinaryPurposeJournal.invalid();
        }}catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    /** Ordinary target-specific observation. No installed Current, reconciliation,
     * all-record scan or long-lived WORK lease. Only exact own target/purpose/view
     * cells are decoded; unrelated unreadable originals remain untouched. */
    void requireOrdinaryRecurringDeliveryCurrent(NativeRecurringTargetJournal.RetainedTargetData target,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,byte[] actualBody,
        NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
        if(target==null||prepared==null||actualBody==null||owner==null)throw NativeRecurringOrdinaryPurposeJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryPurposeJournal.invalid();
            owner.requireLatest();requireWorkAdmission();var observed=preferences.observeReadOnly();
            Object rawTarget=observed.values.get(target.key),rawPurpose=observed.values.get(prepared.key);
            if(!(rawTarget instanceof String)||!(rawPurpose instanceof String)
                ||!target.record.equals(decodeProtectedRecord((String)rawTarget,NativeRecurringTargetJournal.FAILURE).toString())
                ||!prepared.record.equals(decodeProtectedRecord((String)rawPurpose,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            JSONObject purpose=NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record);
            JSONObject row=ProviderWireJson.object(target.record.getBytes(java.nio.charset.StandardCharsets.UTF_8),524288);
            JSONObject delivery=ProviderWireJson.object(actualBody,8*1024*1024).getJSONObject("data").getJSONObject("recurring_delivery");
            if(!row.isNull("original_view")){
                JSONObject descriptor=row.getJSONObject("original_view");Object countValue=descriptor.get("chunk_count");
                if(!(countValue instanceof Integer||countValue instanceof Long)||((Number)countValue).longValue()<1
                    ||((Number)countValue).longValue()>256)throw NativeRecurringOrdinaryPurposeJournal.invalid();
                NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
                Map<String,String> chunks=new LinkedHashMap<>();
                for(int i=0;i<((Number)countValue).intValue();i++){
                    String key=NativeRecurringTargetJournal.viewKey(principal,row.getString("intent_id"),i);
                    Object value=observed.values.get(key);if(!(value instanceof String))throw NativeRecurringOrdinaryPurposeJournal.invalid();
                    chunks.put(key,decodeProtectedRecord((String)value,NativeRecurringTargetJournal.FAILURE).toString());
                }
                NativeRecurringTargetJournal.Store owned=new NativeRecurringTargetJournal.Store(){
                    public String loadRecurringRecord(String key){return chunks.get(key);}
                    public Map<String,String> recurringRecords(){return java.util.Map.copyOf(chunks);}
                    public void compareAndRetainRecurringRecord(String key,String old,String next)throws VaultFailure{throw NativeRecurringOrdinaryPurposeJournal.invalid();}
                };
                byte[] view=new NativeRecurringTargetJournal(owned).readOriginalView(principal,row.getString("intent_id"),descriptor);
                byte[] latest=delivery.getString("viewJsonText").getBytes(java.nio.charset.StandardCharsets.UTF_8);
                try{if(!java.util.Arrays.equals(view,latest))throw NativeRecurringOrdinaryPurposeJournal.invalid();}
                finally{java.util.Arrays.fill(view,(byte)0);java.util.Arrays.fill(latest,(byte)0);}
            }else if(!"BLOCKED_RECURRING_AUTHORITY".equals(purpose.getJSONObject("target").get("targetType")))
                throw NativeRecurringOrdinaryPurposeJournal.invalid();
            owner.requireLatest();requireWorkAdmission();
            if(!preferences.matchesReadOnly(observed))throw NativeRecurringOrdinaryPurposeJournal.invalid();
        }}catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    /** Latent ordinary DATA transition only. No native producer/dispatch grant.
     * Future Engine caller must supply its original17+18a owners, never a flag. */
    @Override public void retainOrdinaryRecurringAttempt(NativeRecurringTargetJournal.RetainedTargetData target,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,byte[] latestActualBody,
        NativeRecurringOrdinaryAttemptJournal.Data candidate,
        NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
        if(target==null||prepared==null||latestActualBody==null||candidate==null||owner==null)throw NativeRecurringOrdinaryAttemptJournal.invalid();
        byte[] actual=latestActualBody.clone();
        try{synchronized(WORK_WRITE_LOCK){
            if(!prepared.key.equals(candidate.key))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            JSONObject next=NativeRecurringOrdinaryAttemptJournal.requireData(candidate.key,candidate.record);
            if(!prepared.record.equals(next.get("prepared_record"))||!"UNKNOWN".equals(next.getJSONObject("outcome").get("kind"))
                ||!NativeRetainedAttempt.hash(actual).equals(next.get("latest_native_response_sha256")))
                throw NativeRecurringOrdinaryAttemptJournal.invalid();
            // Real narrow17 target/view/PREPARED checks. No native Current and
            // no unrelated record decode or long-lived WORK exclusion.
            requireOrdinaryRecurringDeliveryCurrent(target,prepared,actual,owner);
            owner.requireLatest();requireWorkAdmission();
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            var before=preferences.observeReadOnly();Object old=before.values.get(prepared.key);
            if(!(old instanceof String)||!prepared.record.equals(decodeProtectedRecord((String)old,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryAttemptJournal.invalid();
            requireOrdinaryAttemptTargetAndViewRows(before.values,before.values,target);
            String encoded=protect(next,NativeRecurringTargetJournal.FAILURE,true);
            owner.requireLatest();requireWorkAdmission();
            if(!java.util.Arrays.equals(actual,latestActualBody)||!NativeRetainedAttempt.hash(latestActualBody).equals(next.get("latest_native_response_sha256"))||!preferences.matchesReadOnly(before))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            Map<String,Object> projected=new LinkedHashMap<>(before.values);projected.put(prepared.key,encoded);NativeProtectedWorkSnapshot.capture(projected);
            persistOriginalWorkValue(before,prepared.key,(String)old,encoded);
            var after=preferences.observeReadOnly();Object saved=after.values.get(prepared.key);
            if(!(saved instanceof String)||!candidate.record.equals(decodeProtectedRecord((String)saved,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryAttemptJournal.invalid();
            requireOrdinaryAttemptTargetAndViewRows(before.values,after.values,target);
            owner.requireLatest();requireWorkAdmission();
            if(!java.util.Arrays.equals(actual,latestActualBody)||!NativeRetainedAttempt.hash(latestActualBody).equals(next.get("latest_native_response_sha256"))||!preferences.matchesReadOnly(after))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            // No effectful callback after this terminal observation. An
            // ambiguous saved successor remains ATTEMPTED/outcome-only.
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw NativeRecurringOrdinaryAttemptJournal.invalid();}
        finally{java.util.Arrays.fill(actual,(byte)0);}
    }
    private void requireOrdinaryAttemptTargetAndViewRows(Map<String,?> original,Map<String,?> observed,
        NativeRecurringTargetJournal.RetainedTargetData target)throws Exception {
        Object raw=original.get(target.key);
        if(!(raw instanceof String)||!java.util.Objects.equals(raw,observed.get(target.key))
            ||!target.record.equals(decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString()))
            throw NativeRecurringOrdinaryAttemptJournal.invalid();
        JSONObject row=ProviderWireJson.object(target.record.getBytes(java.nio.charset.StandardCharsets.UTF_8),524288);
        if(!row.isNull("original_view")){
            Object count=row.getJSONObject("original_view").get("chunk_count");
            if(!(count instanceof Integer||count instanceof Long)||((Number)count).longValue()<1||((Number)count).longValue()>256)
                throw NativeRecurringOrdinaryAttemptJournal.invalid();
            var principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            for(int i=0;i<((Number)count).intValue();i++){
                String key=NativeRecurringTargetJournal.viewKey(principal,row.getString("intent_id"),i);Object value=original.get(key);
                if(!(value instanceof String)||!java.util.Objects.equals(value,observed.get(key)))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            }
        }
    }
    /** Original-intent outcome DATA may arrive after current winner changes.
     * It matches the retained original only, never asserts new target authority. */
    @Override public void retainOrdinaryRecurringOutcome(NativeRecurringOrdinaryAttemptJournal.Data original,
        NativeRecurringOrdinaryAttemptJournal.Data candidate,NativeProviderPrincipal principal)throws VaultFailure {
        if(original==null||candidate==null||principal==null)throw NativeRecurringOrdinaryAttemptJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            NativeRecurringOrdinaryAttemptJournal.requireOutcomeSuccessor(original,candidate);
            requireOrdinaryAttemptPrincipal(original,principal);requireWorkAdmission();
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            var before=preferences.observeReadOnly();Object raw=before.values.get(original.key);
            if(!(raw instanceof String))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            String saved=decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString();
            if(!original.record.equals(saved))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            if(candidate.record.equals(original.record)){
                requireWorkAdmission();if(!preferences.matchesReadOnly(before))throw NativeRecurringOrdinaryAttemptJournal.invalid();return;
            }
            String encoded=protect(NativeRecurringOrdinaryAttemptJournal.requireData(candidate.key,candidate.record),NativeRecurringTargetJournal.FAILURE,true);
            requireWorkAdmission();if(!preferences.matchesReadOnly(before))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            Map<String,Object> projected=new LinkedHashMap<>(before.values);projected.put(candidate.key,encoded);NativeProtectedWorkSnapshot.capture(projected);
            persistOriginalWorkValue(before,original.key,(String)raw,encoded);
            var after=preferences.observeReadOnly();Object current=after.values.get(original.key);
            if(!(current instanceof String)||!candidate.record.equals(decodeProtectedRecord((String)current,NativeRecurringTargetJournal.FAILURE).toString()))
                throw NativeRecurringOrdinaryAttemptJournal.invalid();
            requireWorkAdmission();if(!preferences.matchesReadOnly(after))throw NativeRecurringOrdinaryAttemptJournal.invalid();
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw NativeRecurringOrdinaryAttemptJournal.invalid();}
    }
    @Override public NativeRecurringOrdinaryAttemptJournal.Data readOrdinaryRecurringAttempt(String key,NativeProviderPrincipal principal)throws VaultFailure {
        if(key==null||!key.matches("native_recurring_purpose_sha256:[a-f0-9]{64}")||principal==null)throw NativeRecurringOrdinaryAttemptJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            // Read-only: no reconciliation, write, winner inference or reset.
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            var before=preferences.observeReadOnly();Object raw=before.values.get(key);if(raw==null)return null;
            if(!(raw instanceof String))throw NativeRecurringOrdinaryAttemptJournal.invalid();
            String saved=decodeProtectedRecord((String)raw,NativeRecurringTargetJournal.FAILURE).toString();
            JSONObject value=ProviderWireJson.object(saved.getBytes(java.nio.charset.StandardCharsets.UTF_8),64*1024);
            if("custodial.native-recurring-ordinary-purpose.v1".equals(value.opt("schema"))){
                JSONObject prepared=NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,saved);
                if(!principal.same(NativeProviderPrincipal.fromNativeJournal(prepared.getJSONObject("principal"))))throw NativeRecurringOrdinaryAttemptJournal.invalid();
                if(!preferences.matchesReadOnly(before))throw NativeRecurringOrdinaryAttemptJournal.invalid();return null;
            }
            var data=NativeRecurringOrdinaryAttemptJournal.restoredData(key,saved);requireOrdinaryAttemptPrincipal(data,principal);
            if(!preferences.matchesReadOnly(before))throw NativeRecurringOrdinaryAttemptJournal.invalid();return data;
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw NativeRecurringOrdinaryAttemptJournal.invalid();}
    }
    /** Read-only DATA discovery of THIS ordinary-purpose family only. It
     * never scans/adopts Task7/8/Mail submissions, changes a row or returns a
     * POST owner. Partial unreadable history is explicit, not an empty proof. */
    static final class OrdinaryRecoverySelection {
        final java.util.List<String> originalKeys;final int unavailable;final boolean observationUnavailable;
        private OrdinaryRecoverySelection(java.util.List<String> keys,int unavailable,boolean observationUnavailable){
            originalKeys=java.util.List.copyOf(keys);this.unavailable=unavailable;this.observationUnavailable=observationUnavailable;
        }
    }
    OrdinaryRecoverySelection observeOrdinaryRecoveryOriginals(NativeProviderPrincipal principal)throws VaultFailure {
        if(principal==null)throw NativeRecurringOrdinaryAttemptJournal.invalid();
        try{synchronized(WORK_WRITE_LOCK){
            if(UNCERTAIN_WORK_WRITES.containsKey(rawPreferences))return new OrdinaryRecoverySelection(java.util.List.of(),0,true);
            var observed=preferences.observeReadOnly();var originals=new java.util.ArrayList<String>();int count=0,unavailable=0;
            for(String key:observed.values.keySet())if(key.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX))count++;
            // SAME existing admission quota, no deletion or stale-row adoption.
            if(count>256)return new OrdinaryRecoverySelection(java.util.List.of(),count,true);
            for(var entry:new java.util.TreeMap<>(observed.values).entrySet()){
                String key=entry.getKey();if(!key.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX))continue;
                try{
                    if(!key.matches("native_recurring_purpose_sha256:[a-f0-9]{64}")||!(entry.getValue() instanceof String))throw NativeRecurringOrdinaryAttemptJournal.invalid();
                    String raw=decodeProtectedRecord((String)entry.getValue(),NativeRecurringTargetJournal.FAILURE).toString();
                    JSONObject value=ProviderWireJson.object(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8),64*1024);
                    if("custodial.native-recurring-ordinary-purpose.v1".equals(value.opt("schema"))){
                        NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,raw);continue;
                    }
                    var original=NativeRecurringOrdinaryAttemptJournal.restoredData(key,raw);
                    JSONObject prepared=NativeRecurringOrdinaryAttemptJournal.originalPrepared(key,raw);
                    NativeProviderPrincipal actual=NativeProviderPrincipal.fromNativeJournal(prepared.getJSONObject("principal"));
                    if(!principal.same(actual))continue; // Exact full installation principal, not only device label/UUID.
                    String kind=NativeRecurringOrdinaryAttemptJournal.requireData(key,raw).getJSONObject("outcome").getString("kind");
                    if("UNKNOWN".equals(kind)||"NO_RECORDED_RECEIPT".equals(kind))originals.add(original.key);
                }catch(Exception unreadable){unavailable++;} // Preserve original raw bytes; no clean-history inference.
            }
            // LAST actual raw observation after every key/decrypt/parser callback.
            if(!preferences.matchesReadOnly(observed))return new OrdinaryRecoverySelection(java.util.List.of(),count,true);
            return new OrdinaryRecoverySelection(originals,unavailable,false);
        }}catch(VaultFailure unavailable){throw unavailable;}catch(Exception unavailable){throw NativeRecurringOrdinaryAttemptJournal.invalid();}
    }
    private static void requireOrdinaryAttemptPrincipal(NativeRecurringOrdinaryAttemptJournal.Data data,NativeProviderPrincipal principal)throws VaultFailure {
        try{if(!principal.same(NativeProviderPrincipal.fromNativeJournal(NativeRecurringOrdinaryAttemptJournal.originalPrepared(data.key,data.record).getJSONObject("principal"))))
            throw NativeRecurringOrdinaryAttemptJournal.invalid();}
        catch(VaultFailure error){throw error;}catch(Exception error){throw NativeRecurringOrdinaryAttemptJournal.invalid();}
    }
    private String serverReceiptKey(String key) throws VaultFailure {
        if (key == null || !key.matches("[a-f0-9]{64}")) throw new VaultFailure(NativeCompletionJournal.FAILURE);
        return SERVER_RECEIPT_PREFIX + key;
    }
    @Override public synchronized String loadCompletionReceipt(String key) throws VaultFailure {
        JSONObject value;
        synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();String encoded=preferences.getString(serverReceiptKey(key),null);
            value=encoded==null?null:decodeProtectedRecord(encoded,NativeCompletionJournal.FAILURE,completionCipher,MAX_COMPLETION_RECORD_CHARACTERS);
        }
        if (value == null) return null;
        if (value.length()!=1 || !(value.opt("receipt") instanceof String)
            || value.optString("receipt").isEmpty()) throw new VaultFailure(NativeCompletionJournal.FAILURE);
        return value.optString("receipt");
    }
    @Override public synchronized void saveCompletionReceipt(String key, String receipt) throws VaultFailure {
        String target = serverReceiptKey(key);
        if (!preferences.contains(target) && preferences.getAll().keySet().stream()
            .filter(name -> name.startsWith(SERVER_RECEIPT_PREFIX)).count() >= 1024)
            throw new VaultFailure("custodial_native_server_receipt_capacity");
        try {
            if (receipt == null || receipt.length() > NativeCompletionJournal.MAX_RECORD) throw new VaultFailure(NativeCompletionJournal.CAPACITY);
            JSONObject value = new JSONObject(); value.put("receipt", receipt);
            synchronized(WORK_WRITE_LOCK){
                reconcileUncertainWorkWrite();requireWorkAdmission();var original=preferences.observeReadOnly();
                Object old=original.values.get(target);if(old!=null&&!(old instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
                String encoded=protect(value,NativeCompletionJournal.FAILURE,true,completionCipher,MAX_COMPLETION_RECORD_CHARACTERS);
                persistOriginalWorkValue(original,target,(String)old,encoded);
            }
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(NativeCompletionJournal.FAILURE,error); }
    }
    @Override public synchronized void deleteCompletionReceipt(String key) throws VaultFailure {
        removeOriginalWorkValue(serverReceiptKey(key));
    }
    @Override public synchronized void requireCompletionCapacity(String key,int maximumReceiptCharacters)throws VaultFailure {
        if(maximumReceiptCharacters<1||maximumReceiptCharacters>NativeCompletionJournal.MAX_RECORD)throw new VaultFailure(NativeCompletionJournal.CAPACITY);
        synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();String target=serverReceiptKey(key);
            var original=preferences.observeReadOnly();Object old=original.values.get(target);
            if(old!=null)return; // Capture/recovery verifies the original, never replaces it.
            if(original.values.keySet().stream().filter(name->name.startsWith(SERVER_RECEIPT_PREFIX)).count()>=1024)
                throw new VaultFailure(NativeCompletionJournal.CAPACITY);
            char[] reservation=new char[maximumReceiptCharacters];java.util.Arrays.fill(reservation,'x');
            try{
                String encoded=protect(new JSONObject().put("receipt",String.valueOf(reservation)),NativeCompletionJournal.CAPACITY,
                    true,completionCipher,MAX_COMPLETION_RECORD_CHARACTERS);
                // Exercise exact existing writer/encryption size bounds WITHOUT
                // saving a receipt, marker, ciphertext, ACK or new generation.
                protectOriginalWorkAttempt(NativeWorkOriginalWriteAttempt.prepare(original.values,target,null,encoded));
            }catch(VaultFailure e){throw e;}
            catch(Exception e){throw new VaultFailure(NativeCompletionJournal.CAPACITY,e);}
            finally{VaultValidation.wipe(reservation);}
        }
    }

    @Override
    public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor() throws VaultFailure {
        try {
            JSONObject value = load(ANCHOR_KEY, "custodial_native_offline_anchor_refused");
            if (value == null) return null;
            Set<String> keys = keys(value);
            Set<String> legacyKeys = setOf(
                "device_id", "snapshot_id", "generated_at", "expires_at",
                "anchor_elapsed_realtime_ms", "boot_count"
            );
            Set<String> currentKeys = setOf(
                "device_id", "snapshot_id", "generated_at", "expires_at", "clock_base_at",
                "anchor_elapsed_realtime_ms", "boot_count", "new_work_authorized", "snapshot_json"
            );
            if (!keys.equals(legacyKeys) && !keys.equals(currentKeys)) {
                throw new VaultFailure("custodial_native_offline_anchor_refused");
            }
            boolean legacy = keys.equals(legacyKeys);
            return new OfflineAuthorityTime.OfflineAuthorityAnchor(
                value.getString("device_id"),
                value.getString("snapshot_id"),
                value.getString("generated_at"),
                value.getString("expires_at"),
                legacy ? value.getString("generated_at") : value.getString("clock_base_at"),
                value.getLong("anchor_elapsed_realtime_ms"),
                value.getInt("boot_count"),
                !legacy && value.getBoolean("new_work_authorized"),
                legacy ? "" : value.getString("snapshot_json")
            );
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    @Override
    public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor anchor) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("device_id", anchor.deviceId);
            value.put("snapshot_id", anchor.snapshotId);
            value.put("generated_at", anchor.generatedAt);
            value.put("expires_at", anchor.expiresAt);
            value.put("clock_base_at", anchor.clockBaseAt);
            value.put("anchor_elapsed_realtime_ms", anchor.anchorElapsedRealtimeMillis);
            value.put("boot_count", anchor.bootCount);
            value.put("new_work_authorized", anchor.newWorkAuthorized);
            value.put("snapshot_json", anchor.snapshotJson);
            save(ANCHOR_KEY, value, "custodial_native_offline_anchor_refused");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    @Override
    public boolean preserveUnreadableAuthorityAnchor(String deviceId, String preservedAt) throws VaultFailure {
        final String code = "custodial_native_offline_anchor_preservation_failed";
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            String canonicalDevice = VaultValidation.deviceId(deviceId);
            String canonicalPreservedAt = String.valueOf(preservedAt);
            if (!canonicalPreservedAt.matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$")) {
                throw new VaultFailure(code);
            }
            VaultTimestamps.epochMillis(canonicalPreservedAt, code);
            String protectedRecord = preferences.getString(ANCHOR_KEY, null);
            if (protectedRecord == null || protectedRecord.isEmpty()) return false;

            String sourceDigest = sha256(protectedRecord, code);
            String recordKey = ANCHOR_QUARANTINE_RECORD_PREFIX + sourceDigest;
            String metadataKey = ANCHOR_QUARANTINE_METADATA_PREFIX + sourceDigest;
            String preservedRecord = preferences.getString(recordKey, null);
            if (preservedRecord != null && !preservedRecord.equals(protectedRecord)) {
                throw new VaultFailure(code);
            }

            JSONObject metadata = new JSONObject();
            metadata.put("schema_version", "custodial-authority-anchor-quarantine.v1");
            metadata.put("source_key", ANCHOR_KEY);
            metadata.put("source_sha256", sourceDigest);
            metadata.put("quarantine_key", recordKey);
            metadata.put("device_id", canonicalDevice);
            metadata.put("preserved_at", canonicalPreservedAt);
            metadata.put("reason", "unreadable_protected_authority_anchor");
            String encodedMetadata=preferences.getString(metadataKey,null);
            if(encodedMetadata==null)encodedMetadata=metadata.toString();
            else{
                JSONObject retainedMetadata=new JSONObject(encodedMetadata);
                requireKeys(retainedMetadata,code,"schema_version","source_key","source_sha256","quarantine_key","device_id","preserved_at","reason");
                if(!"custodial-authority-anchor-quarantine.v1".equals(retainedMetadata.get("schema_version"))
                    ||!ANCHOR_KEY.equals(retainedMetadata.get("source_key"))||!sourceDigest.equals(retainedMetadata.get("source_sha256"))
                    ||!recordKey.equals(retainedMetadata.get("quarantine_key"))||!canonicalDevice.equals(retainedMetadata.get("device_id"))
                    ||!"unreadable_protected_authority_anchor".equals(retainedMetadata.get("reason")))throw new VaultFailure(code);
                VaultTimestamps.epochMillis(retainedMetadata.getString("preserved_at"),code);
            }

            persistOriginalWorkAttempt(observation,NativeWorkOriginalWriteAttempt.preparePreservation(observation.values,"ANCHOR",
                Map.of(recordKey,protectedRecord,metadataKey,encodedMetadata)));
            if (!protectedRecord.equals(preferences.getString(recordKey, null))
                || !encodedMetadata.equals(preferences.getString(metadataKey, null))
                || !sourceDigest.equals(sha256(preferences.getString(recordKey, ""), code))) {
                throw new VaultFailure(code);
            }
            return true;
        }} catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        }
    }

    @Override
    public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String clientSessionId) throws VaultFailure {
        try {
            JSONObject value = load(occurrenceKey(clientSessionId), "custodial_native_offline_occurrence_mismatch");
            if (value == null) return null;
            Set<String> legacyKeys = setOf(
                "client_session_id",
                "device_id",
                "location_code",
                "snapshot_id",
                "generated_at",
                "expires_at",
                "anchor_elapsed_realtime_ms",
                "boot_count",
                "native_scan_entry_id",
                "started_at",
                "completed_at"
            );
            Set<String> currentKeys = new HashSet<>(legacyKeys);
            currentKeys.add("clock_base_at");
            Set<String> actualKeys = keys(value);
            Set<String> identityKeys = new HashSet<>(currentKeys);
            identityKeys.add("native_tag_identity");
            if (!actualKeys.equals(legacyKeys) && !actualKeys.equals(currentKeys) && !actualKeys.equals(identityKeys)) {
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            }
            boolean legacy = actualKeys.equals(legacyKeys);
            if (!clientSessionId.equals(value.getString("client_session_id"))) {
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            }
            return new OfflineAuthorityTime.OfflineOccurrence(
                value.getString("client_session_id"),
                value.getString("device_id"),
                value.getString("location_code"),
                value.getString("snapshot_id"),
                value.getString("generated_at"),
                value.getString("expires_at"),
                legacy ? value.getString("generated_at") : value.getString("clock_base_at"),
                value.getLong("anchor_elapsed_realtime_ms"),
                value.getInt("boot_count"),
                value.getString("native_scan_entry_id"),
                value.getString("started_at"),
                value.getString("completed_at"),
                value.has("native_tag_identity") ? PhysicalNfcTagIdentity.require(value.getString("native_tag_identity")) : ""
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        }
    }

    @Override
    public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence occurrence) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("client_session_id", occurrence.clientSessionId);
            value.put("device_id", occurrence.deviceId);
            value.put("location_code", occurrence.locationCode);
            value.put("snapshot_id", occurrence.snapshotId);
            value.put("generated_at", occurrence.generatedAt);
            value.put("expires_at", occurrence.expiresAt);
            value.put("clock_base_at", occurrence.clockBaseAt);
            value.put("anchor_elapsed_realtime_ms", occurrence.anchorElapsedRealtimeMillis);
            value.put("boot_count", occurrence.bootCount);
            value.put("native_scan_entry_id", occurrence.nativeScanEntryId);
            if (!occurrence.nativeTagIdentity.isEmpty())
                value.put("native_tag_identity", PhysicalNfcTagIdentity.require(occurrence.nativeTagIdentity));
            value.put("started_at", occurrence.startedAt);
            value.put("completed_at", occurrence.completedAt);
            save(occurrenceKey(occurrence.clientSessionId), value, "custodial_native_offline_occurrence_mismatch");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        }
    }

    /** Safe counts only: no credentials, identifiers, coordinates, or saved answers. */
    Map<String, Object> offlineWorkDiagnostics() {
        Map<String, Object> out = new LinkedHashMap<>();
        int total=0, unfinished=0, finished=0, unreadable=0;
        for (String key : preferences.getAll().keySet()) {
            if (!key.startsWith(OCCURRENCE_PREFIX)) continue;
            total++;
            try {
                JSONObject raw=load(key,"custodial_native_offline_occurrence_mismatch");
                String id=raw==null?"":raw.optString("client_session_id","");
                if (!key.equals(occurrenceKey(id))) throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
                OfflineAuthorityTime.OfflineOccurrence row=loadOccurrence(id);
                if (row==null) throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
                if (row.completedAt.isEmpty() || loadFinishEntryId(row).isEmpty()) unfinished++;
                else finished++;
            } catch (Exception error) { unreadable++; }
        }
        out.put("native_record_count",total);
        out.put("unfinished_or_unsealed_count",unfinished);
        out.put("finished_awaiting_upload_count",finished);
        out.put("unreadable_record_count",unreadable);
        try { out.put("anchor_state",loadAnchor()==null?"absent":"readable"); }
        catch(Exception error){out.put("anchor_state","unreadable");}
        try { out.put("recovery_fence_state",loadRollbackFence()==null?"absent":"active"); }
        catch(Exception error){out.put("recovery_fence_state","unreadable");}
        return out;
    }

    private String finishProofKey(String sessionId) throws VaultFailure {
        return FINISH_PROOF_PREFIX + sha256(sessionId, "custodial_native_offline_occurrence_mismatch");
    }

    @Override
    public String loadFinishEntryId(OfflineAuthorityTime.OfflineOccurrence occurrence) throws VaultFailure {
        final String code = "custodial_native_offline_occurrence_mismatch";
        JSONObject value = load(finishProofKey(occurrence.clientSessionId), code);
        if (value == null) return "";
        try {
            requireKeys(value, code, "client_session_id", "device_id", "location_code", "started_at", "completed_at", "entry_id");
            String entry = value.getString("entry_id");
            if (!occurrence.clientSessionId.equals(value.getString("client_session_id"))
                || !occurrence.deviceId.equals(value.getString("device_id"))
                || !occurrence.locationCode.equals(value.getString("location_code"))
                || !occurrence.startedAt.equals(value.getString("started_at"))
                || !occurrence.completedAt.equals(value.getString("completed_at"))
                || occurrence.completedAt.isEmpty() || !entry.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")) throw new VaultFailure(code);
            return entry;
        } catch (Exception error) { throw new VaultFailure(code, error); }
    }

    @Override
    public void saveFinishEntryId(OfflineAuthorityTime.OfflineOccurrence occurrence, String entryId) throws VaultFailure {
        final String code = "custodial_native_offline_occurrence_mismatch";
        String existing = loadFinishEntryId(occurrence);
        if (!existing.isEmpty()) {
            if (!existing.equals(entryId)) throw new VaultFailure(code);
            return;
        }
        if (occurrence.completedAt.isEmpty() || !entryId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")) throw new VaultFailure(code);
        try {
            JSONObject value = new JSONObject();
            value.put("client_session_id", occurrence.clientSessionId);
            value.put("device_id", occurrence.deviceId);
            value.put("location_code", occurrence.locationCode);
            value.put("started_at", occurrence.startedAt);
            value.put("completed_at", occurrence.completedAt);
            value.put("entry_id", entryId);
            save(finishProofKey(occurrence.clientSessionId), value, code, true);
        } catch (Exception error) { throw new VaultFailure(code, error); }
    }

    @Override
    public boolean hasUnfinishedOccurrences() throws VaultFailure {
        for (String key : preferences.getAll().keySet()) {
            if (!key.startsWith(OCCURRENCE_PREFIX)) continue;
            JSONObject raw = load(key, "custodial_native_offline_occurrence_mismatch");
            if (raw == null) throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            String sessionId = raw.optString("client_session_id", "");
            if (!key.equals(occurrenceKey(sessionId))) throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            OfflineAuthorityTime.OfflineOccurrence occurrence = loadOccurrence(sessionId);
            if (occurrence == null || occurrence.completedAt.isEmpty() || loadFinishEntryId(occurrence).isEmpty()) return true;
        }
        return false;
    }

    @Override
    public void deleteOccurrence(String clientSessionId) throws VaultFailure {
        synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();
            var observation=preferences.observeReadOnly();String key=occurrenceKey(clientSessionId),proofKey=finishProofKey(clientSessionId);
            if(!observation.values.containsKey(key)&&!observation.values.containsKey(proofKey))return;
            persistOriginalWorkAttempt(observation,NativeWorkOriginalWriteAttempt.prepareOccurrenceDelete(observation.values,key,proofKey));
        }
    }

    @Override
    public OfflineAuthorityTime.RollbackFence loadRollbackFence() throws VaultFailure {
        try {
            JSONObject value = load(ROLLBACK_FENCE_KEY, "custodial_native_rollback_fence_mismatch");
            if (value == null) return null;
            requireKeys(value, "custodial_native_rollback_fence_mismatch", "device_id", "fence_id");
            return new OfflineAuthorityTime.RollbackFence(
                VaultValidation.deviceId(value.getString("device_id")),
                value.getString("fence_id")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_rollback_fence_mismatch", error);
        }
    }

    @Override
    public void saveRollbackFence(OfflineAuthorityTime.RollbackFence fence) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("device_id", fence.deviceId);
            value.put("fence_id", fence.fenceId);
            save(ROLLBACK_FENCE_KEY, value, "custodial_native_rollback_fence_mismatch");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_rollback_fence_mismatch", error);
        }
    }

    @Override
    public void deleteRollbackFence() throws VaultFailure {
        removeOriginalWorkValue(ROLLBACK_FENCE_KEY);
    }

    @Override
    public boolean hasOccurrences() {
        for (String key : preferences.getAll().keySet()) {
            if (key.startsWith(OCCURRENCE_PREFIX)) return true;
        }
        return false;
    }

    @Override
    public Map<String, Map<String, Object>> loadScanEntries() throws VaultFailure {
        try {
            JSONObject value = load(SCAN_ENTRIES_KEY, "custodial_native_scan_journal_refused");
            if (value == null) return new LinkedHashMap<>();
            requireKeys(value, "custodial_native_scan_journal_refused", "entries");
            JSONArray entries = value.getJSONArray("entries");
            if (entries.length() > 4) throw new VaultFailure("custodial_native_scan_journal_refused");
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            for (int index = 0; index < entries.length(); index += 1) {
                JSONObject record = entries.getJSONObject(index);
                Map<String, Object> converted = new LinkedHashMap<>();
                java.util.Iterator<String> iterator = record.keys();
                while (iterator.hasNext()) {
                    String key = iterator.next();
                    Object item = record.get(key);
                    converted.put(key, item == JSONObject.NULL ? null : item);
                }
                String entryId = record.getString("entry_id");
                if (result.put(entryId, converted) != null) {
                    throw new VaultFailure("custodial_native_scan_journal_refused");
                }
            }
            return result;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_refused", error);
        }
    }

    @Override
    public void saveScanEntries(Map<String, Map<String, Object>> entries) throws VaultFailure {
        if (entries == null || entries.size() > 4) throw new VaultFailure("custodial_native_scan_journal_refused");
        try {
            JSONArray encodedEntries = new JSONArray();
            for (Map.Entry<String, Map<String, Object>> entry : entries.entrySet()) {
                if (!entry.getKey().equals(String.valueOf(entry.getValue().get("entry_id")))) {
                    throw new VaultFailure("custodial_native_scan_journal_refused");
                }
                encodedEntries.put(new JSONObject(entry.getValue()));
            }
            JSONObject value = new JSONObject();
            value.put("entries", encodedEntries);
            save(SCAN_ENTRIES_KEY, value, "custodial_native_scan_journal_refused");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_refused", error);
        }
    }

    @Override
    public Map<String, Object> preserveUnreadableScanJournal(String reason) throws VaultFailure {
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            String protectedRecord = preferences.getString(SCAN_ENTRIES_KEY, null);
            if (protectedRecord == null || protectedRecord.isEmpty()) {
                throw new VaultFailure("custodial_native_scan_journal_preservation_failed");
            }
            String digest = sha256(protectedRecord);
            Map<String, Object> existing = loadScanJournalQuarantine();
            if (digest.equals(existing.get("source_sha256"))) return existing;

            String recoveryId = UUID.randomUUID().toString();
            String recordKey = SCAN_JOURNAL_QUARANTINE_PREFIX + recoveryId;
            JSONObject metadata = new JSONObject();
            metadata.put("schema_version", "custodial-scan-journal-quarantine.v1");
            metadata.put("state", "CORRUPTED");
            metadata.put("preserved", true);
            metadata.put("manager_recovery_required", true);
            metadata.put("recovery_id", recoveryId);
            metadata.put("source_key", SCAN_ENTRIES_KEY);
            metadata.put("source_sha256", digest);
            metadata.put("quarantine_key", recordKey);
            metadata.put("reason", String.valueOf(reason == null ? "custodial_native_scan_journal_refused" : reason));
            metadata.put("preserved_at", VaultTimestamps.fromEpochMillisExact(System.currentTimeMillis()));
            String encodedMetadata = metadata.toString();

            persistOriginalWorkAttempt(observation,NativeWorkOriginalWriteAttempt.preparePreservation(observation.values,"SCAN",
                Map.of(recordKey,protectedRecord,SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY,encodedMetadata)));
            if (!protectedRecord.equals(preferences.getString(SCAN_ENTRIES_KEY, null))
                || !protectedRecord.equals(preferences.getString(recordKey, null))
                || !encodedMetadata.equals(preferences.getString(SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY, null))) {
                throw new VaultFailure("custodial_native_scan_journal_preservation_failed");
            }
            return jsonMap(metadata);
        }} catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_preservation_failed", error);
        }
    }

    @Override
    public Map<String, Object> loadScanJournalQuarantine() throws VaultFailure {
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();
            String encoded = preferences.getString(SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY, null);
            if (encoded == null || encoded.isEmpty()) return new LinkedHashMap<>();
            JSONObject metadata = new JSONObject(encoded);
            requireKeys(
                metadata,
                "custodial_native_scan_journal_preservation_failed",
                "schema_version", "state", "preserved", "manager_recovery_required",
                "recovery_id", "source_key", "source_sha256", "quarantine_key",
                "reason", "preserved_at"
            );
            if (!"custodial-scan-journal-quarantine.v1".equals(metadata.getString("schema_version"))
                || !"CORRUPTED".equals(metadata.getString("state"))
                || !metadata.getBoolean("preserved")
                || !metadata.getBoolean("manager_recovery_required")
                || !SCAN_ENTRIES_KEY.equals(metadata.getString("source_key"))) {
                throw new VaultFailure("custodial_native_scan_journal_preservation_failed");
            }
            String protectedRecord = preferences.getString(metadata.getString("quarantine_key"), null);
            if (protectedRecord == null
                || !sha256(protectedRecord).equals(metadata.getString("source_sha256"))) {
                throw new VaultFailure("custodial_native_scan_journal_preservation_failed");
            }
            return jsonMap(metadata);
        }} catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_preservation_failed", error);
        }
    }

    @Override
    public Map<String, Object> resolvePreservedScanJournal(
        String managerRecoveryOperationId,
        String deviceId,
        String managerRecoveryEnrolledAt
    ) throws VaultFailure {
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            loadLatestScanJournalDisposition();
            String operationId = VaultValidation.operationId(managerRecoveryOperationId);
            String canonicalDeviceId = VaultValidation.deviceId(deviceId);
            String enrolledAt = VaultValidation.timestamp(
                managerRecoveryEnrolledAt,
                "custodial_native_scan_journal_recovery_refused"
            );
            Map<String, Object> quarantine = loadScanJournalQuarantine();
            if (quarantine.isEmpty()) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_refused");
            }
            String preservedAt = String.valueOf(quarantine.get("preserved_at"));
            long preservedMillis = VaultTimestamps.epochMillis(
                preservedAt,
                "custodial_native_scan_journal_recovery_refused"
            );
            long enrolledMillis = VaultTimestamps.epochMillis(
                enrolledAt,
                "custodial_native_scan_journal_recovery_refused"
            );
            // A recovery credential can resolve only evidence that was already
            // quarantined when that exact manager operation enrolled the phone.
            // A later corruption therefore requires a new manager recovery.
            if (preservedMillis >= enrolledMillis) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_refused");
            }

            String sourceRecord = preferences.getString(SCAN_ENTRIES_KEY, null);
            String quarantineKey = String.valueOf(quarantine.get("quarantine_key"));
            String quarantineRecord = preferences.getString(quarantineKey, null);
            String sourceDigest = String.valueOf(quarantine.get("source_sha256"));
            if (sourceRecord == null
                || !sourceRecord.equals(quarantineRecord)
                || !sha256(sourceRecord).equals(sourceDigest)) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_refused");
            }

            JSONObject replacement = new JSONObject();
            replacement.put("entries", new JSONArray());
            String protectedReplacement = protect(
                replacement,
                "custodial_native_scan_journal_recovery_refused"
            );
            String recoveryId = String.valueOf(quarantine.get("recovery_id"));
            String dispositionKey = SCAN_JOURNAL_DISPOSITION_PREFIX + recoveryId;
            JSONObject disposition = new JSONObject();
            disposition.put("schema_version", "custodial-scan-journal-disposition.v1");
            disposition.put("state", "RESOLVED");
            disposition.put("preserved", true);
            disposition.put("manager_recovery_required", false);
            disposition.put("recovery_id", recoveryId);
            disposition.put("source_key", SCAN_ENTRIES_KEY);
            disposition.put("source_sha256", sourceDigest);
            disposition.put("quarantine_key", quarantineKey);
            disposition.put("reason", String.valueOf(quarantine.get("reason")));
            disposition.put("preserved_at", preservedAt);
            disposition.put("disposition_key", dispositionKey);
            disposition.put("manager_recovery_operation_id", operationId);
            disposition.put("device_id", canonicalDeviceId);
            disposition.put("manager_recovery_enrolled_at", enrolledAt);
            disposition.put("resolved_at", VaultTimestamps.fromEpochMillisExact(System.currentTimeMillis()));
            disposition.put("replacement_journal_sha256", sha256(protectedReplacement));
            String encodedDisposition = disposition.toString();

            Map<String,String> candidates=new HashMap<>();candidates.put(SCAN_ENTRIES_KEY,protectedReplacement);
            candidates.put(dispositionKey,encodedDisposition);candidates.put(SCAN_JOURNAL_DISPOSITION_LATEST_KEY,encodedDisposition);
            candidates.put(SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY,null);
            persistOriginalWorkAttempt(observation,NativeWorkOriginalWriteAttempt.preparePreservation(observation.values,"SCAN_DISPOSITION",candidates));
            if (!protectedReplacement.equals(preferences.getString(SCAN_ENTRIES_KEY, null))
                || !quarantineRecord.equals(preferences.getString(quarantineKey, null))
                || !encodedDisposition.equals(preferences.getString(dispositionKey, null))
                || !encodedDisposition.equals(preferences.getString(SCAN_JOURNAL_DISPOSITION_LATEST_KEY, null))
                || preferences.contains(SCAN_JOURNAL_QUARANTINE_ACTIVE_KEY)) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_failed");
            }
            return jsonMap(disposition);
        }} catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_recovery_failed", error);
        }
    }

    @Override
    public Map<String, Object> loadLatestScanJournalDisposition() throws VaultFailure {
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();
            String encoded = preferences.getString(SCAN_JOURNAL_DISPOSITION_LATEST_KEY, null);
            if (encoded == null || encoded.isEmpty()) return new LinkedHashMap<>();
            JSONObject disposition = new JSONObject(encoded);
            requireKeys(
                disposition,
                "custodial_native_scan_journal_recovery_failed",
                "schema_version", "state", "preserved", "manager_recovery_required",
                "recovery_id", "source_key", "source_sha256", "quarantine_key",
                "reason", "preserved_at", "disposition_key",
                "manager_recovery_operation_id", "device_id", "manager_recovery_enrolled_at",
                "resolved_at", "replacement_journal_sha256"
            );
            if (!"custodial-scan-journal-disposition.v1".equals(disposition.getString("schema_version"))
                || !"RESOLVED".equals(disposition.getString("state"))
                || !disposition.getBoolean("preserved")
                || disposition.getBoolean("manager_recovery_required")
                || !SCAN_ENTRIES_KEY.equals(disposition.getString("source_key"))) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_failed");
            }
            VaultValidation.operationId(disposition.getString("manager_recovery_operation_id"));
            VaultValidation.deviceId(disposition.getString("device_id"));
            VaultValidation.timestamp(
                disposition.getString("manager_recovery_enrolled_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            VaultValidation.timestamp(
                disposition.getString("preserved_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            VaultValidation.timestamp(
                disposition.getString("resolved_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            String recoveryId = VaultValidation.operationId(disposition.getString("recovery_id"));
            if (!disposition.getString("disposition_key").equals(SCAN_JOURNAL_DISPOSITION_PREFIX + recoveryId)
                || !disposition.getString("quarantine_key").equals(SCAN_JOURNAL_QUARANTINE_PREFIX + recoveryId)
                || !disposition.getString("source_sha256").matches("^[a-f0-9]{64}$")) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_failed");
            }
            long preservedMillis = VaultTimestamps.epochMillis(
                disposition.getString("preserved_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            long enrolledMillis = VaultTimestamps.epochMillis(
                disposition.getString("manager_recovery_enrolled_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            long resolvedMillis = VaultTimestamps.epochMillis(
                disposition.getString("resolved_at"),
                "custodial_native_scan_journal_recovery_failed"
            );
            if (preservedMillis >= enrolledMillis || enrolledMillis > resolvedMillis) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_failed");
            }
            String unique = preferences.getString(disposition.getString("disposition_key"), null);
            String quarantineRecord = preferences.getString(disposition.getString("quarantine_key"), null);
            if (!encoded.equals(unique)
                || quarantineRecord == null
                || !sha256(quarantineRecord).equals(disposition.getString("source_sha256"))
                || !disposition.getString("replacement_journal_sha256").matches("^[a-f0-9]{64}$")) {
                throw new VaultFailure("custodial_native_scan_journal_recovery_failed");
            }
            return jsonMap(disposition);
        }} catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_recovery_failed", error);
        }
    }


    /** Carries the recovery decision from the protected load into its replacement write. */
    static final class NfcHandoffCapture {
        final Map<String, Map<String, Object>> handoffs;
        private final AndroidOfflineAuthorityTimeStore owner;
        private final boolean recovered;
        private final String original;
        private final AndroidProtectedWorkPreferences.ReadOnlyObservation observation;

        private NfcHandoffCapture(AndroidOfflineAuthorityTimeStore owner,
            Map<String, Map<String, Object>> handoffs, boolean recovered, String original,
            AndroidProtectedWorkPreferences.ReadOnlyObservation observation) {
            this.owner = owner;
            this.handoffs = handoffs;
            this.recovered = recovered;
            this.original = original;
            this.observation = observation;
        }
    }

    /** Used only while recording a NEW physical tag read. Claims never recover old bytes. */
    NfcHandoffCapture loadNfcHandoffsForPhysicalRead() throws VaultFailure {
        synchronized (NFC_WRITE_LOCK) {
        reconcileUncertainNfcWrite();
        requireWorkAdmission();
        var observation=preferences.observeReadOnly();
        final String original = preferences.getString(NFC_HANDOFFS_KEY, null);
        try {
            var handoffs=loadNfcHandoffs();
            if(!preferences.matchesReadOnly(observation))throw NativeNfcOriginalWriteAttempt.invalid();
            return new NfcHandoffCapture(this,handoffs,false,original,observation);
        } catch (VaultFailure failure) {
            if (original == null || original.isEmpty() || !recoverableNfcHandoffFailure(failure)) {
                throw failure;
            }
            preserveUnreadableNfcHandoffs(original, failure);
            // The original ciphertext is durably retained. The caller must still
            // persist a fresh physical read before it can return a handoff ID.
            var preserved=preferences.observeReadOnly();
            if(!java.util.Objects.equals(original,preserved.values.get(NFC_HANDOFFS_KEY)))throw NativeNfcOriginalWriteAttempt.invalid();
            return new NfcHandoffCapture(this,new LinkedHashMap<>(),true,original,preserved);
        }
        }
    }

    void saveNfcHandoffsAfterPhysicalRead(NfcHandoffCapture capture) throws VaultFailure {
        if (capture == null || capture.owner != this) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused");
        }
        if (persistPhysicalNfcHandoffs(capture) != NfcWriteResult.DURABLE)
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
    }

    /** A false commit may already have changed memory. Never report that as
     * definite absence. Only this NEW-read path creates an additional locator. */
    NfcWriteResult persistPhysicalNfcHandoffs(NfcHandoffCapture capture) throws VaultFailure {
        synchronized (NFC_WRITE_LOCK) {
            reconcileUncertainNfcWrite();
            if(capture==null||capture.owner!=this||!preferences.matchesReadOnly(capture.observation)
                ||!java.util.Objects.equals(capture.original,preferences.getString(NFC_HANDOFFS_KEY,null)))
                throw new VaultFailure("custodial_native_nfc_handoff_refused");
            String encoded=protect(encodeNfcHandoffs(capture.handoffs),
                "custodial_native_nfc_handoff_refused",capture.recovered);
            return persistOriginalNfcValue(capture.observation,capture.original,encoded);
        }
    }
    /** Journal precedes the body write. The same original encrypted candidate
     * and native-generated attempt survive restart; no re-encryption/new ID on
     * retry, and no journal removal without exact commit plus full readback. */
    private NfcWriteResult persistOriginalNfcValue(AndroidProtectedWorkPreferences.ReadOnlyObservation observation,
        String original,String candidate)throws VaultFailure {
        NativeNfcOriginalWriteAttempt attempt=NativeNfcOriginalWriteAttempt.prepare(observation.values,original,candidate);
        String record=protectOriginalNfcAttempt(attempt);
        NfcWrite write=new NfcWrite(attempt,record);
        AndroidProtectedWorkPreferences.PreparedNfcOriginal prepared;
        try{prepared=preferences.prepareNfcOriginal(observation,attempt,record);}
        catch(VaultFailure refused){
            // No body write has been entered. Preserve even a memory-only
            // marker and return an honest located uncertainty until rollback.
            if(!record.equals(preferences.recoverableNfcOriginal()))return NfcWriteResult.REFUSED;
            UNCERTAIN_NFC_WRITES.put(rawPreferences,write);
            if(rollbackNfcWrite(write)){UNCERTAIN_NFC_WRITES.remove(rawPreferences);return NfcWriteResult.REFUSED;}
            return NfcWriteResult.UNCERTAIN;
        }
        UNCERTAIN_NFC_WRITES.put(rawPreferences,write);
        if(commitNfcOriginal(prepared,false)||commitNfcOriginal(prepared,false)){
            UNCERTAIN_NFC_WRITES.remove(rawPreferences);return NfcWriteResult.DURABLE;
        }
        if(rollbackNfcWrite(write)){UNCERTAIN_NFC_WRITES.remove(rawPreferences);return NfcWriteResult.REFUSED;}
        return NfcWriteResult.UNCERTAIN;
    }
    private String protectOriginalNfcAttempt(NativeNfcOriginalWriteAttempt attempt)throws VaultFailure {
        char[] clear=null;
        try{String value=attempt.encode().toString();if(value.length()>MAX_PROTECTED_RECORD_CHARACTERS)throw NativeNfcOriginalWriteAttempt.invalid();
            clear=value.toCharArray();final char[] original=clear;
            EncryptedSecret secret=preferences.withOrdinaryWorkAdmission(()->nfcWriteCipher.encryptWithExistingKey(original));
            return new JSONObject().put("ciphertext",secret.ciphertext).put("iv",secret.iv).toString();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeNfcOriginalWriteAttempt.invalid();}
        finally{VaultValidation.wipe(clear);}
    }
    private NativeNfcOriginalWriteAttempt decodeOriginalNfcAttempt(String encoded)throws VaultFailure {
        char[] clear=null;
        try{if(encoded==null||encoded.isEmpty()||encoded.length()>524288)throw NativeNfcOriginalWriteAttempt.invalid();
            JSONObject envelope=new JSONObject(encoded);requireKeys(envelope,NativeNfcOriginalWriteAttempt.FAILURE,"ciphertext","iv");
            if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw NativeNfcOriginalWriteAttempt.invalid();
            clear=nfcWriteCipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            if(clear.length>MAX_PROTECTED_RECORD_CHARACTERS)throw NativeNfcOriginalWriteAttempt.invalid();
            return NativeNfcOriginalWriteAttempt.decode(new JSONObject(String.valueOf(clear)));
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeNfcOriginalWriteAttempt.invalid();}
        finally{VaultValidation.wipe(clear);}
    }
    private boolean commitNfcOriginal(AndroidProtectedWorkPreferences.PreparedNfcOriginal prepared,boolean rollback){
        try{return preferences.commitNfcOriginal(prepared,rollback);}catch(VaultFailure|RuntimeException refused){return false;}
    }
    private boolean rollbackNfcWrite(NfcWrite write){
        try{return commitNfcOriginal(preferences.recoverNfcOriginal(write.attempt,write.record),true);}
        catch(VaultFailure|RuntimeException refused){return false;}
    }
    private void reconcileUncertainNfcWrite()throws VaultFailure {
        NfcWrite write=UNCERTAIN_NFC_WRITES.get(rawPreferences);
        Object stored=preferences.recoverableNfcOriginal();
        if(write==null&&stored==null)return;
        if(!(stored instanceof String))throw NativeNfcOriginalWriteAttempt.invalid();
        if(write==null)write=new NfcWrite(decodeOriginalNfcAttempt((String)stored),(String)stored);
        if(!write.record.equals(stored)||!rollbackNfcWrite(write))throw NativeNfcOriginalWriteAttempt.invalid();
        UNCERTAIN_NFC_WRITES.remove(rawPreferences);
    }

    private static boolean recoverableNfcHandoffFailure(VaultFailure failure) {
        if ("custodial_native_nfc_handoff_refused".equals(failure.code)
            || "custodial_native_vault_corrupt".equals(failure.code)) return true;
        if (!"custodial_native_vault_decrypt_failed".equals(failure.code)) return false;
        Throwable cause = failure;
        for (int depth = 0; depth < 8 && cause != null; depth++, cause = cause.getCause()) {
            if (cause instanceof javax.crypto.AEADBadTagException) return true;
        }
        return false;
    }

    private void preserveUnreadableNfcHandoffs(String original, VaultFailure failure) throws VaultFailure {
        final String code = "custodial_native_nfc_handoff_preservation_failed";
        final String recordPrefix = "native_nfc_handoff_quarantine_record:";
        final String metadataPrefix = "native_nfc_handoff_quarantine_metadata:";
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            if (original.length() > MAX_PROTECTED_RECORD_CHARACTERS * 2
                || !original.equals(preferences.getString(NFC_HANDOFFS_KEY, null))) {
                throw new VaultFailure(code);
            }
            String digest = sha256(original, code);
            String recordKey = recordPrefix + digest;
            String metadataKey = metadataPrefix + digest;
            String retained = preferences.getString(recordKey, null);
            String encodedMetadata = preferences.getString(metadataKey, null);
            if (retained != null && !original.equals(retained)) throw new VaultFailure(code);
            if (retained == null) {
                long count = preferences.getAll().keySet().stream()
                    .filter(key -> key.startsWith(recordPrefix)).count();
                if (count >= 4) throw new VaultFailure("custodial_native_nfc_handoff_preservation_capacity_reached");
            }
            if (encodedMetadata == null) {
                JSONObject metadata = new JSONObject();
                metadata.put("schema_version", "custodial-nfc-handoff-quarantine.v1");
                metadata.put("state", "preserved_unreadable");
                metadata.put("source_key", NFC_HANDOFFS_KEY);
                metadata.put("source_sha256", digest);
                metadata.put("quarantine_key", recordKey);
                metadata.put("reason", "custodial_native_vault_decrypt_failed".equals(failure.code)
                    ? "authentication_failed" : "malformed_record");
                metadata.put("preserved_at", VaultTimestamps.fromEpochMillisExact(System.currentTimeMillis()));
                encodedMetadata = metadata.toString();
            } else {
                JSONObject metadata = new JSONObject(encodedMetadata);
                requireKeys(metadata, code, "schema_version", "state", "source_key", "source_sha256",
                    "quarantine_key", "reason", "preserved_at");
                if (!"custodial-nfc-handoff-quarantine.v1".equals(metadata.getString("schema_version"))
                    || !"preserved_unreadable".equals(metadata.getString("state"))
                    || !NFC_HANDOFFS_KEY.equals(metadata.getString("source_key"))
                    || !digest.equals(metadata.getString("source_sha256"))
                    || !recordKey.equals(metadata.getString("quarantine_key"))
                    || !Set.of("authentication_failed", "malformed_record").contains(metadata.getString("reason"))) {
                    throw new VaultFailure(code);
                }
                VaultTimestamps.epochMillis(metadata.getString("preserved_at"), code);
            }
            // Two phases: retain and verify the exact old bytes BEFORE any active
            // record replacement. A crash here leaves the old record in place;
            // the same ciphertext is deduplicated on the next physical attempt.
            // Recommit even on a retry: a failed prior SharedPreferences commit
            // can leave values in memory that have not reached durable storage.
            persistOriginalWorkAttempt(observation,NativeWorkOriginalWriteAttempt.preparePreservation(observation.values,"NFC",
                Map.of(recordKey,original,metadataKey,encodedMetadata)));
            if (!original.equals(preferences.getString(NFC_HANDOFFS_KEY, null))
                || !original.equals(preferences.getString(recordKey, null))
                || !encodedMetadata.equals(preferences.getString(metadataKey, null))
                || !digest.equals(sha256(preferences.getString(recordKey, ""), code))) {
                throw new VaultFailure(code);
            }
        }} catch (VaultFailure failureToPreserve) {
            throw failureToPreserve;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        }
    }

    Map<String, Map<String, Object>> loadNfcHandoffs() throws VaultFailure {
        synchronized (NFC_WRITE_LOCK) {
        reconcileUncertainNfcWrite();
        try {
            JSONObject value = load(NFC_HANDOFFS_KEY, "custodial_native_nfc_handoff_refused");
            if (value == null) return new LinkedHashMap<>();
            requireKeys(value, "custodial_native_nfc_handoff_refused", "handoffs");
            JSONArray handoffs = value.getJSONArray("handoffs");
            if (handoffs.length() > 4) throw new VaultFailure("custodial_native_nfc_handoff_refused");
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            for (int index = 0; index < handoffs.length(); index += 1) {
                JSONObject record = handoffs.getJSONObject(index);
                Map<String, Object> converted = new LinkedHashMap<>();
                java.util.Iterator<String> iterator = record.keys();
                while (iterator.hasNext()) {
                    String key = iterator.next();
                    Object item = record.get(key);
                    converted.put(key, item == JSONObject.NULL ? null : item);
                }
                String handoffId = record.getString("handoff_id");
                if (result.put(handoffId, converted) != null) {
                    throw new VaultFailure("custodial_native_nfc_handoff_refused");
                }
            }
            return result;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
        }
    }

    void saveNfcHandoffs(Map<String, Map<String, Object>> handoffs) throws VaultFailure {
        saveNfcHandoffs(handoffs, false);
    }

    private void saveNfcHandoffs(Map<String, Map<String, Object>> handoffs,
        boolean existingKeyOnly) throws VaultFailure {
        synchronized (NFC_WRITE_LOCK) {
            reconcileUncertainNfcWrite();
            requireWorkAdmission();
            var original=preferences.observeReadOnly();
            String old=preferences.getString(NFC_HANDOFFS_KEY,null);
            String candidate=protect(encodeNfcHandoffs(handoffs),"custodial_native_nfc_handoff_refused",existingKeyOnly);
            if(persistOriginalNfcValue(original,old,candidate)!=NfcWriteResult.DURABLE)
                throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
    }

    private JSONObject encodeNfcHandoffs(Map<String, Map<String, Object>> handoffs) throws VaultFailure {
        if (handoffs == null || handoffs.size() > 4) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused");
        }
        try {
            JSONArray encodedHandoffs = new JSONArray();
            for (Map.Entry<String, Map<String, Object>> entry : handoffs.entrySet()) {
                if (!entry.getKey().equals(String.valueOf(entry.getValue().get("handoff_id")))) {
                    throw new VaultFailure("custodial_native_nfc_handoff_refused");
                }
                encodedHandoffs.put(new JSONObject(entry.getValue()));
            }
            JSONObject value = new JSONObject();
            value.put("handoffs", encodedHandoffs);
            return value;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
    }

    private JSONObject load(String key, String code) throws VaultFailure {
        synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();
            String encoded = preferences.getString(key, null);
            if (encoded == null || encoded.isEmpty()) return null;
            return decodeProtectedRecord(encoded,code);
        }
    }

    /** Decode the exact captured ciphertext, never a later live-preferences row. */
    private JSONObject decodeProtectedRecord(String encoded,String code)throws VaultFailure{
        return decodeProtectedRecord(encoded,code,cipher,MAX_PROTECTED_RECORD_CHARACTERS);
    }
    private JSONObject decodeProtectedRecord(String encoded,String code,CredentialCipher recordCipher,int limit)throws VaultFailure{
        char[] clear = null;
        try {
            JSONObject envelope = new JSONObject(encoded);
            requireKeys(envelope, code, "ciphertext", "iv");
            clear = recordCipher.decrypt(new EncryptedSecret(
                envelope.getString("ciphertext"),
                envelope.getString("iv"),Math.max(16_384,4*limit+64)
            ));
            String value = String.valueOf(clear);
            if (value.length() > limit) throw new VaultFailure(code);
            return new JSONObject(value);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        } finally {
            if (clear != null) VaultValidation.wipe(clear);
        }
    }

    private void save(String key, JSONObject value, String code) throws VaultFailure {
        save(key, value, code, false);
    }

    private void save(String key, JSONObject value, String code, boolean existingKeyOnly) throws VaultFailure {
        try {synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();
            var observation=preferences.observeReadOnly();Object old=observation.values.get(key);
            if(old!=null&&!(old instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
            String encoded=protect(value,code,existingKeyOnly);
            persistOriginalWorkValue(observation,key,(String)old,encoded);
        }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        }
    }

    /** Both ordinary and legacy row producers retain their original encryption
     * domain; this shared local write path receives only their saved ciphertext. */
    private void persistOriginalWorkValue(AndroidProtectedWorkPreferences.ReadOnlyObservation observation,
        String key,String original,String encoded)throws VaultFailure {
            var attempt=NativeWorkOriginalWriteAttempt.prepare(observation.values,key,original,encoded);
            persistOriginalWorkAttempt(observation,attempt);
    }
    private void persistOriginalWorkAttempt(AndroidProtectedWorkPreferences.ReadOnlyObservation observation,
        NativeWorkOriginalWriteAttempt attempt)throws VaultFailure {
            String record=protectOriginalWorkAttempt(attempt);var write=new WorkWrite(attempt,record);
            AndroidProtectedWorkPreferences.PreparedWorkOriginal prepared;
            try{prepared=preferences.prepareWorkOriginal(observation,attempt,record);}
            catch(VaultFailure refused){
                if(record.equals(preferences.recoverableWorkOriginal())){
                    UNCERTAIN_WORK_WRITES.put(rawPreferences,write);
                    if(rollbackWorkWrite(write))UNCERTAIN_WORK_WRITES.remove(rawPreferences);
                }
                throw refused;
            }
            UNCERTAIN_WORK_WRITES.put(rawPreferences,write);
            if(commitWorkOriginal(prepared,false)||commitWorkOriginal(prepared,false)){
                UNCERTAIN_WORK_WRITES.remove(rawPreferences);return;
            }
            if(rollbackWorkWrite(write))UNCERTAIN_WORK_WRITES.remove(rawPreferences);
            throw NativeWorkOriginalWriteAttempt.invalid();
    }

    /** Same existing caller's one-row deletion only. No generic removal API,
     * inventory ACK, identity finalizer or permission to destroy a shared key. */
    private void removeOriginalWorkValue(String key)throws VaultFailure {
        synchronized(WORK_WRITE_LOCK){
            reconcileUncertainWorkWrite();requireWorkAdmission();var observation=preferences.observeReadOnly();
            Object original=observation.values.get(key);if(original==null)return;
            if(!(original instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
            persistOriginalWorkValue(observation,key,(String)original,null);
        }
    }

    private String protectOriginalWorkAttempt(NativeWorkOriginalWriteAttempt attempt)throws VaultFailure {
        char[] clear=null;
        try{String value=attempt.encode().toString();if(value.length()>MAX_WORK_ATTEMPT_CHARACTERS)throw NativeWorkOriginalWriteAttempt.invalid();
            clear=value.toCharArray();final char[] original=clear;
            EncryptedSecret secret=preferences.withOrdinaryWorkAdmission(()->workWriteCipher.encryptWithExistingKey(original));
            return new JSONObject().put("ciphertext",secret.ciphertext).put("iv",secret.iv).toString();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeWorkOriginalWriteAttempt.invalid();}
        finally{VaultValidation.wipe(clear);}
    }
    private NativeWorkOriginalWriteAttempt decodeOriginalWorkAttempt(String encoded)throws VaultFailure {
        char[] clear=null;
        try{if(encoded==null||encoded.isEmpty()||encoded.length()>32*1024*1024)throw NativeWorkOriginalWriteAttempt.invalid();
            JSONObject envelope=new JSONObject(encoded);requireKeys(envelope,NativeWorkOriginalWriteAttempt.FAILURE,"ciphertext","iv");
            if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
            clear=workWriteCipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv"),4*MAX_WORK_ATTEMPT_CHARACTERS+64));
            if(clear.length>MAX_WORK_ATTEMPT_CHARACTERS)throw NativeWorkOriginalWriteAttempt.invalid();
            return NativeWorkOriginalWriteAttempt.decode(new JSONObject(String.valueOf(clear)));
        }catch(VaultFailure e){throw e;}catch(Exception e){throw NativeWorkOriginalWriteAttempt.invalid();}
        finally{VaultValidation.wipe(clear);}
    }
    private boolean commitWorkOriginal(AndroidProtectedWorkPreferences.PreparedWorkOriginal prepared,boolean rollback){
        try{return preferences.commitWorkOriginal(prepared,rollback);}catch(VaultFailure|RuntimeException refused){return false;}
    }
    private boolean rollbackWorkWrite(WorkWrite write){
        try{return commitWorkOriginal(preferences.recoverWorkOriginal(write.attempt,write.record),true);}
        catch(VaultFailure|RuntimeException refused){return false;}
    }
    /** Recreated owner uses the saved key/attempt/ciphertexts, never new IDs or
     * encryption. Only a verified local rollback closes a failed local save;
     * remote original operations and every destructive authority are separate. */
    private void reconcileUncertainWorkWrite()throws VaultFailure {
        WorkWrite write=UNCERTAIN_WORK_WRITES.get(rawPreferences);Object stored=preferences.recoverableWorkOriginal();
        if(write==null&&stored==null)return;
        if(rawPreferences instanceof AndroidReadOnlyPreferences||!(stored instanceof String))throw NativeWorkOriginalWriteAttempt.invalid();
        if(write==null)write=new WorkWrite(decodeOriginalWorkAttempt((String)stored),(String)stored);
        if(!write.record.equals(stored)||!rollbackWorkWrite(write))throw NativeWorkOriginalWriteAttempt.invalid();
        UNCERTAIN_WORK_WRITES.remove(rawPreferences);
    }

    private String protect(JSONObject value, String code) throws VaultFailure {
        return protect(value, code, false);
    }

    private String protect(JSONObject value, String code, boolean existingKeyOnly) throws VaultFailure {
        return protect(value,code,existingKeyOnly,cipher,MAX_PROTECTED_RECORD_CHARACTERS);
    }
    private String protect(JSONObject value,String code,boolean existingKeyOnly,CredentialCipher recordCipher,int limit)throws VaultFailure {
        String encodedValue = value.toString();
        if (encodedValue.length() > limit) throw new VaultFailure(code);
        char[] clear = encodedValue.toCharArray();
        try {
            EncryptedSecret protectedValue = existingKeyOnly
                ? recordCipher.encryptWithExistingKey(clear)
                : preferences.withOrdinaryWorkAdmission(() -> recordCipher.encrypt(clear));
            JSONObject envelope = new JSONObject();
            envelope.put("ciphertext", protectedValue.ciphertext);
            envelope.put("iv", protectedValue.iv);
            return envelope.toString();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        } finally {
            VaultValidation.wipe(clear);
        }
    }

    private static String occurrenceKey(String clientSessionId) throws VaultFailure {
        if (clientSessionId == null || clientSessionId.isEmpty()) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        byte[] clear = clientSessionId.getBytes(StandardCharsets.UTF_8);
        byte[] digest = null;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(clear);
            StringBuilder encoded = new StringBuilder(digest.length * 2);
            for (byte value : digest) encoded.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return OCCURRENCE_PREFIX + encoded;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (digest != null) Arrays.fill(digest, (byte) 0);
        }
    }

    private static String sha256(String value) throws VaultFailure {
        return sha256(value, "custodial_native_scan_journal_preservation_failed");
    }

    private static String sha256(String value, String code) throws VaultFailure {
        byte[] clear = String.valueOf(value).getBytes(StandardCharsets.UTF_8);
        byte[] digest = null;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(clear);
            StringBuilder encoded = new StringBuilder(digest.length * 2);
            for (byte item : digest) encoded.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            return encoded.toString();
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (digest != null) Arrays.fill(digest, (byte) 0);
        }
    }

    private static Map<String, Object> jsonMap(JSONObject value) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        java.util.Iterator<String> iterator = value.keys();
        while (iterator.hasNext()) {
            String key = iterator.next();
            Object item = value.get(key);
            result.put(key, item == JSONObject.NULL ? null : item);
        }
        return result;
    }

    private static void requireKeys(JSONObject value, String code, String... expected) throws VaultFailure {
        Set<String> keys = keys(value);
        Set<String> allowed = setOf(expected);
        if (!keys.equals(allowed)) throw new VaultFailure(code);
    }

    private static Set<String> keys(JSONObject value) {
        Set<String> keys = new HashSet<>();
        java.util.Iterator<String> iterator = value.keys();
        while (iterator.hasNext()) keys.add(iterator.next());
        return keys;
    }

    private static Set<String> setOf(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
