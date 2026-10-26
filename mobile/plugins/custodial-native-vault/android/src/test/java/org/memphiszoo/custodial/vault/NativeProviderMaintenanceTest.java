package org.memphiszoo.custodial.vault;

import org.json.JSONObject;
import org.junit.Test;
import java.util.Map;
import java.util.HashMap;
import static org.junit.Assert.*;

/** Actual conditional owner/journal; synthetic clock profile and no-network HTTP. */
public final class NativeProviderMaintenanceTest {
    @Test public void failedOriginalExchangeHasDurableNonsecretDiagnosticAcrossRestart() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        x.loseResponse=true;
        ProviderRecordStoreTest.failure("custodial_provider_network_unavailable",x::sync);
        String original=x.f.prepared.generationId;
        x.owner=x.reconstruct();
        Object diagnostic=x.owner.localStatus().get("last_local_failure");
        assertNotNull("The exact failure cannot disappear into a generic pending retry",diagnostic);
        assertEquals(original,x.f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"journal").getString("pending_generation"));
        assertEquals(0,x.surface.shows);
    }
    @Test public void runtimeInvokesExistingCompactionAfterFreshClockAndExactSettlements() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);
        x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        x.owner.applyAction(NativeProviderCompositionTest.action(x,p,"dismissed"));
        x.journal.confirmMirrorRetired(x.f.principal,x.journal.presentation(x.f.principal,p.recordId));
        x.sync();assertTrue(x.journal.pendingEvents(x.f.principal,16).events.isEmpty());
        x.inventoryRows=new NativeProviderPayload[0];
        x.elapsed=3_600_100;x.responseServerNow="2026-09-24T18:00:00.123457Z";x.responseClockEnd="2026-09-24T18:15:00.123457Z";
        x.sync();
        assertTrue("The runtime must actually call its accepted cleanup owner",x.f.provider.storage.store().load().keys().stream()
            .anyMatch(k->k.domain==ProviderEnvelopeCrypto.Domain.TOMBSTONE&&k.id.equals(p.recordId)));
        JSONObject tomb=x.f.provider.read(ProviderEnvelopeCrypto.Domain.TOMBSTONE,p.recordId);
        assertEquals(p.contentHash,tomb.getString("content_sha256"));
        assertEquals("2026-09-26T18:00:00.000000Z",tomb.getString("dedupe_until"));
    }
    static NativeProviderJournalTest.Fixture fixture(NativeProviderPrincipal p) throws Exception {
        NativeProviderJournalTest.Fixture f=new NativeProviderJournalTest.Fixture();f.journal().observeActivePrincipal(p);return f;
    }
    static Map<String,Object> withoutDiagnostic(Map<String,Object> raw) {
        Map<String,Object> copy=new HashMap<>(raw);copy.remove("index");copy.remove("METADATA:last-local-failure");return copy;
    }
    @Test public void diagnosticPreservesEveryOriginalRecordAndHasNoRawErrorOrIdentityReadback() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        f.journal().captureToken("synthetic-secret-token");NativeProviderJournal.Prepared prepared=f.journal().prepareRegistration(p,NativeProviderJournalTest.app());
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,10);Map<String,Object> before=new HashMap<>(f.storage.memory.raw);
        assertTrue(f.journal().recordMaintenanceFailure(p,10,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN));
        assertEquals(withoutDiagnostic(before),withoutDiagnostic(f.storage.memory.raw));
        Map<String,Object> visible=f.journal().lastLocalFailure(p,10);
        assertEquals(java.util.Set.of("reason","handling","durable"),visible.keySet());
        assertFalse(visible.toString().contains(p.digest));assertFalse(visible.toString().contains(prepared.operationId));
        assertFalse(f.storage.memory.raw.toString().contains("synthetic-secret-token"));
        JSONObject row=f.read(ProviderEnvelopeCrypto.Domain.METADATA,"last-local-failure");
        assertEquals("NATIVE_INVOCATION_ONLY",row.getString("scope_kind"));assertFalse(row.has("principal"));assertFalse(row.has("token"));
    }
    @Test public void identicalFailureReplayedAfterRestartDoesNotWriteChurnOrBecomeSettlement() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v2();NativeProviderJournalTest.Fixture f=fixture(p);
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,7);
        assertTrue(f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED));
        int commits=f.storage.memory.commits;Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);
        assertTrue(f.journal().recordMaintenanceFailure(p,7,f.journal().maintenanceScope(p,7),NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED));
        assertEquals(commits,f.storage.memory.commits);assertEquals(saved,f.storage.memory.raw);
        assertEquals("RETRY_ORIGINAL",f.journal().lastLocalFailure(p,7).get("handling"));
    }
    @Test public void engineRevisionAndEveryNativePrincipalFieldFenceLateFailure() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,7);Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);
        assertFalse(f.journal().recordMaintenanceFailure(p,8,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN));
        NativeProviderPrincipal changed=NativeProviderPrincipal.fromNativeJournal(p.json().put("installation_seal",p.json().getString("installation_seal")+"different"));
        assertFalse(f.journal().recordMaintenanceFailure(changed,7,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN));
        assertEquals(saved,f.storage.memory.raw);
    }
    @Test public void unavailableThenSamePrincipalCannotReviveOldDiagnosticScope() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,7);
        f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN);
        f.journal().observeUnavailable();f.journal().observeActivePrincipal(p);Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);
        assertFalse(f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED));
        assertNull(f.journal().lastLocalFailure(p,7));assertEquals(saved,f.storage.memory.raw);
    }
    @Test public void oldFailureNotRelabeledAfterRemovalOrAToBToA() throws Exception {
        NativeProviderPrincipal a=NativeProviderJournalTest.v1(),b=NativeProviderPrincipal.fromNativeJournal(a.json().put("assignment_epoch",5));
        NativeProviderJournalTest.Fixture f=fixture(a);NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(a,7);
        f.journal().recordMaintenanceFailure(a,7,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN);
        String encrypted=f.storage.memory.raw.get("METADATA:last-local-failure").toString();
        f.journal().observeRemoved();f.journal().observeActivePrincipal(b);assertNull(f.journal().lastLocalFailure(b,7));
        f.journal().observeActivePrincipal(a);Map<String,Object> before=new HashMap<>(f.storage.memory.raw);
        assertFalse(f.journal().recordMaintenanceFailure(a,7,scope,NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED));
        assertNull(f.journal().lastLocalFailure(a,7));assertEquals(before,f.storage.memory.raw);
        assertEquals(encrypted,f.storage.memory.raw.get("METADATA:last-local-failure"));
    }
    @Test public void ambiguousDiagnosticCommitIsReadBackOnRestartWithoutNewOperation() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,7);f.storage.memory.persistThenReject=true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved",()->f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN));
        f.storage.memory.persistThenReject=false;int commits=f.storage.memory.commits;
        assertTrue(f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN));assertEquals(commits,f.storage.memory.commits);
        assertEquals("TRANSPORT_UNCERTAIN",f.journal().lastLocalFailure(p,7).get("reason"));
    }
    @Test public void diagnosticCannotRepairMissingKeyOrClearRetainedCiphertext() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        NativeProviderJournal.MaintenanceScope scope=f.journal().maintenanceScope(p,7);f.storage.keys.value=null;
        Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);int created=f.storage.keys.creations;
        ProviderRecordStoreTest.failure("custodial_provider_key_missing_preserved",()->f.journal().recordMaintenanceFailure(p,7,scope,NativeProviderFailureDisposition.STORE_PRESERVED));
        assertEquals(saved,f.storage.memory.raw);assertEquals(created,f.storage.keys.creations);
    }
    @Test public void reservedCapacityDiagnosticIsNotOverwrittenByLocalFailure() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        ProviderRecordStore store=f.storage.store();char[] raw="{\"schema\":\"custodial.native-provider-journal.v1\",\"recovery_needed\":true,\"reason\":\"CAPACITY_PRESERVED\"}".toCharArray();
        try{store.commit(store.load().revision,Map.of(ProviderRecordStore.DIAGNOSTIC,raw),java.util.Set.of());}finally{java.util.Arrays.fill(raw,'\0');}
        Object original=f.storage.memory.raw.get(ProviderRecordStore.DIAGNOSTIC.storageName());
        f.journal().recordMaintenanceFailure(p,7,f.journal().maintenanceScope(p,7),NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN);
        assertEquals(original,f.storage.memory.raw.get(ProviderRecordStore.DIAGNOSTIC.storageName()));
    }
    @Test public void failedStaleHttpCannotWriteDiagnosticUnderSuccessorAuthority() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        x.duringHttp=()->x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,NativeProviderHttpTest.DEVICE);
        ProviderRecordStoreTest.failure("custodial_native_vault_concurrent_change",x::sync);
        assertFalse(x.f.provider.storage.store().load().keys().stream().anyMatch(k->k.id.equals("last-local-failure")));
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.owner.pendingWork());assertEquals(0,x.surface.shows);
    }
    static void expire(NativeProviderCompositionTest.Composition x) {
        x.inventoryRows=new NativeProviderPayload[0];x.elapsed=3_600_100;
        x.responseServerNow="2026-09-24T18:00:00.123457Z";x.responseClockEnd="2026-09-24T18:15:00.123457Z";
    }
    @Test public void unhandledAndUncertainSpeechSurviveRuntimeMaintenance() throws Exception {
        for(boolean uncertain:new boolean[]{false,true}){
            NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
            NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
            if(uncertain){Object attachment=new Object();x.owner.attach(attachment);NativeProviderClaims.Claim claim=x.owner.claimNext(attachment);
                x.owner.applyClaim(attachment,claim.id,"displayed");x.owner.applyClaim(attachment,claim.id,"audio_started");
                x.owner.applyClaim(attachment,claim.id,"dismissed");x.owner.retireClaim(attachment,claim.id);x.owner.detach(attachment);}
            x.sync();expire(x);x.sync();assertEquals(p.contentHash,x.inbox(p.recordId).getString("content_sha256"));
            assertEquals(uncertain?"IN_PROGRESS":"PENDING",x.inbox(p.recordId).getString("audio_state"));
            assertFalse(x.f.provider.storage.store().load().keys().stream().anyMatch(k->k.domain==ProviderEnvelopeCrypto.Domain.TOMBSTONE));
        }
    }
    @Test public void qualificationLossCannotTurnCleanupIntoAClockFallback() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        expire(x);x.profile=null;Map<String,Object> saved=new HashMap<>(x.f.provider.storage.memory.raw);int network=x.paths.size();
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.sync());assertEquals(network,x.paths.size());assertEquals(saved,x.f.provider.storage.memory.raw);
    }
    @Test public void cleanupIsBoundedAtSixteenAndLaterPassDoesNotDropRemainder() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);x.inventoryRows=new NativeProviderPayload[20];
        for(int i=0;i<20;i++)x.inventoryRows[i]=NativeProviderInventoryTest.payload(x.f.prepared,i+1);
        for(int i=0;i<4;i++)x.sync();assertEquals(20,x.surface.shows);
        for(NativeProviderPayload p:x.inventoryRows){NativeProviderJournal.Presentation record=x.journal.presentation(x.f.principal,p.recordId);
            x.journal.applyPresentationAction(x.f.principal,record,"dismissed",NativeProviderCompositionTest.observed());x.journal.confirmMirrorRetired(x.f.principal,record);}
        x.owner.reconcileLocalEffects();expire(x);x.sync();
        assertEquals(16,x.f.provider.storage.store().load().keys().stream().filter(k->k.domain==ProviderEnvelopeCrypto.Domain.TOMBSTONE).count());
        assertEquals(4,x.f.provider.storage.store().load().keys().stream().filter(k->k.domain==ProviderEnvelopeCrypto.Domain.INBOX).count());
        x.sync();assertEquals(20,x.f.provider.storage.store().load().keys().stream().filter(k->k.domain==ProviderEnvelopeCrypto.Domain.TOMBSTONE).count());
    }
    @Test public void actualTyped401403AndMalformedResponsesPreserveOriginalRetryNotRevocation() throws Exception {
        for(int status:new int[]{401,403,200}){
            NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);x.responseStatus=status;
            if(status==200)x.overrideResponse="<html>not an authenticated receipt</html>".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            ProviderRecordStoreTest.failure(status==200?"custodial_provider_wire_json_invalid":"custodial_provider_registration_receipt_invalid",x::sync);
            assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.owner.pendingWork());assertEquals(0,x.surface.shows);
            assertEquals("PREPARED_QUARANTINE",x.f.provider.read(ProviderEnvelopeCrypto.Domain.GENERATION,x.f.prepared.generationId).getString("state"));
            assertEquals("RESPONSE_UNCONFIRMED",((Map<?,?>)x.owner.localStatus().get("last_local_failure")).get("reason"));
            x.responseStatus=200;x.overrideResponse=null;x.sync();
            assertEquals(x.requests.get(0).getString("operation_id"),x.requests.get(1).getString("operation_id"));
        }
    }
    @Test public void diagnosticWriteFailureDoesNotReplaceOriginalTransportErrorOrData() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);x.loseResponse=true;
        x.duringHttp=()->x.f.provider.storage.memory.reject=true;Map<String,Object> before=new HashMap<>(x.f.provider.storage.memory.raw);
        try{x.sync();fail("Expected original unknown result");}catch(VaultFailure failure){
            assertEquals("custodial_provider_network_unavailable",failure.code);assertEquals(1,failure.getSuppressed().length);
            assertEquals("custodial_provider_commit_failed_preserved",((VaultFailure)failure.getSuppressed()[0]).code);
        }
        assertEquals(before,x.f.provider.storage.memory.raw);x.f.provider.storage.memory.reject=false;
        x.duringHttp=null;x.loseResponse=false;x.sync();assertEquals(0,x.surface.shows);
    }
    @Test public void exactKnownDiagnosticAllowsRemovalButUnknownMetadataStillFailsClosed() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        f.journal().recordMaintenanceFailure(p,7,f.journal().maintenanceScope(p,7),NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN);
        ProviderRecordStore store=f.storage.store();char[] raw="{\"schema\":\"custodial.native-provider-journal.v1\"}".toCharArray();
        try{store.commit(store.load().revision,Map.of(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA,"unknown-owned-work"),raw),java.util.Set.of());}
        finally{java.util.Arrays.fill(raw,'\0');}
        Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_removal_slice_incomplete",()->f.journal().observeRemoved());assertEquals(saved,f.storage.memory.raw);
    }
    @Test public void malformedDiagnosticIsNotAnIgnoredAuthorityFenceException() throws Exception {
        NativeProviderPrincipal p=NativeProviderJournalTest.v1();NativeProviderJournalTest.Fixture f=fixture(p);
        f.journal().recordMaintenanceFailure(p,7,f.journal().maintenanceScope(p,7),NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN);
        JSONObject bad=f.read(ProviderEnvelopeCrypto.Domain.METADATA,"last-local-failure");bad.put("reason","SERVER_REVOKED");
        ProviderRecordStore store=f.storage.store();char[] raw=bad.toString().toCharArray();
        try{store.commit(store.load().revision,Map.of(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA,"last-local-failure"),raw),java.util.Set.of());}
        finally{java.util.Arrays.fill(raw,'\0');}
        Map<String,Object> saved=new HashMap<>(f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_journal_corrupt_preserved",()->f.journal().observeRemoved());assertEquals(saved,f.storage.memory.raw);
    }
    @Test public void absentNativePrincipalRetainsOriginalSuspendedResultWithoutHttpOrSyntheticDiagnostic() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,NativeProviderHttpTest.DEVICE);
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.sync());assertTrue(x.paths.isEmpty());
        assertFalse(x.f.provider.storage.store().load().keys().stream().anyMatch(k->k.id.equals("last-local-failure")));
    }
}
