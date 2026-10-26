package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;

/** NEW existing-slot owning consumer only. Old fixture factories are setup,
 * not old test replay. Context/runtime binding is source/compile qualification,
 * not Android lifecycle/storage/TLS or current SQL/native/browser semantics. */
public final class NativePrivateCustodyStoredPieceConsumerTest {
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {
        NativePrivateCustodyOwnerTest.denied(action);
    }
    static void safe(JSONObject value)throws Exception {
        NativePrivateCustodyReturnedPieceSetTest.noAuthority(value);
        assertTrue(value.getBoolean("owning_consumer_reads_existing_original_query_slots_only"));
        assertFalse(value.getBoolean("caller_selected_query_list_range_response_or_pins"));
        assertFalse(value.getBoolean("missing_query_preparation_or_pending_promotion_performed"));
    }
    static VaultEngine.NativePrivateCustodyStoredPieceSetObservation read(NativePrivateCustodyReturnedPieceSetTest.Fixture x)throws Exception {
        var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.x.f.root.toFile());
        return x.f.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(x.f.plan,journal);
    }
    @Test public void owningConsumerRecoversClosedOriginalQueryHandlesWithoutPreparingRenewingOrSending()throws Exception {
        try(var x=new NativePrivateCustodyReturnedPieceSetTest.Fixture()){
            x.sendAll();var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            int count=x.queries.size();for(var query:x.queries)query.close();x.queries.clear();x.f.clock.now+=86400000;
            try(var observed=read(x)){var value=observed.projection();safe(value);
                assertTrue(value.getBoolean("all_original_returned_piece_bindings_present"));
                assertTrue(value.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                assertEquals(count,value.getInt("historical_exact_original_returned_pieces"));
                assertEquals(x.f.plan.projection().get("frame_sha256"),value.get("assembled_frame_sha256"));}
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(count,x.x.opens);
        }
    }
    @Test public void missingAllOriginalQueriesRemainsPendingAndDoesNotCreateExchangeNamespace()throws Exception {
        try(var x=new NativePrivateCustodyExchangeTest.Fixture()){
            assertFalse(Files.exists(x.dir));
            try(var observed=x.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(x.plan,x.journal)){
                var value=observed.projection();safe(value);
                assertFalse(value.getBoolean("all_original_returned_piece_bindings_present"));
                assertEquals(0,value.getInt("historical_exact_original_returned_pieces"));
                assertEquals(0,value.getJSONArray("original_query_and_observation_artifacts").length());
            }
            assertFalse(Files.exists(x.dir));assertNotNull(x.plan.projection());
        }
    }
    @Test public void partialRepliesStayPendingAndDanglingOriginalOutcomeCannotMasqueradeAsMissingQuery()throws Exception {
        try(var x=new NativePrivateCustodyReturnedPieceSetTest.Fixture()){
            x.send(0,x.data(0));var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            try(var observed=read(x)){var value=observed.projection();safe(value);
                assertEquals(1,value.getInt("historical_exact_original_returned_pieces"));
                assertFalse(value.getBoolean("all_original_returned_piece_bindings_present"));}
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);
            // Disposable synthetic corruption only: preserve displaced bytes
            // outside the fixed store, then prove the owning reader refuses.
            var query=x.f.dir.resolve("query-0.bin");var preserved=x.f.x.f.root.resolve("test-displaced-original-query.bin");
            Files.move(query,preserved);var damaged=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(()->read(x));NativePrivateCustodyOwnerTest.sameFiles(damaged,x.f.dir);assertTrue(Files.exists(preserved));assertEquals(1,x.x.opens);
        }
    }
    @Test public void pendingPreparedAndPendingResponseArePreservedWithoutAutomaticPromotion()throws Exception {
        try(var x=new NativePrivateCustodyReturnedPieceSetTest.Fixture()){
            x.send(0,x.data(0));var query=x.f.dir.resolve("query-0.bin");var pending=x.f.dir.resolve("query-0.pending");
            Files.move(query,pending);var prepared=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(()->read(x));NativePrivateCustodyOwnerTest.sameFiles(prepared,x.f.dir);
            Files.move(pending,query);var response=x.f.dir.resolve("query_observation-0.bin");var pendingResponse=x.f.dir.resolve("query_observation-0.pending");
            Files.move(response,pendingResponse);var pendingFiles=NativePrivateCustodyOwnerTest.files(x.f.dir);
            try(var observed=read(x)){var value=observed.projection();safe(value);assertEquals(0,value.getInt("historical_exact_original_returned_pieces"));
                assertEquals("PENDING",value.getJSONArray("original_query_and_observation_artifacts").getJSONObject(0).get("observation_phase"));}
            NativePrivateCustodyOwnerTest.sameFiles(pendingFiles,x.f.dir);assertFalse(Files.exists(response));assertEquals(1,x.x.opens);
        }
    }
    @Test public void immutableConsumerSnapshotReReadsOriginalSlotsAndRejectsLaterOutcomeOrChangedOwner()throws Exception {
        try(var x=new NativePrivateCustodyReturnedPieceSetTest.Fixture();var observed=read(x)){
            x.send(0,x.data(0));var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(observed::projection);NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);
            x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("stored-consumer-owner-change","synthetic");
            denied(()->read(x));NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(1,x.x.opens);
        }
    }
    @Test public void closedConsumerDoesNotCloseBorrowedPlanAndInvalidInputsCannotCreateOrReadForeignSlots()throws Exception {
        try(var x=new NativePrivateCustodyExchangeTest.Fixture()){
            denied(()->x.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(null,x.journal));
            denied(()->x.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(x.plan,null));
            denied(()->AndroidPrivateCustodyPieceRecovery.observeOriginal(null,x.engine,x.plan));
            var observed=x.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(x.plan,x.journal);observed.close();observed.close();
            denied(observed::projection);assertNotNull(x.plan.projection());assertFalse(Files.exists(x.dir));
            x.plan.close();denied(()->x.engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(x.plan,x.journal));assertFalse(Files.exists(x.dir));
        }
    }
}
