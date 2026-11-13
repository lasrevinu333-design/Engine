package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.security.cert.Certificate;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.junit.Test;

/** NEW source/host-file and synthetic TLS-connection cases ONLY. No real
 * server, Android keystore/storage, runtime mount, semantic ACK or phone proof. */
public final class NativePrivateCustodyHttpOutcomeTest {
    private static void mark(String stage){System.out.println("NEW_SOURCE_PHASE "+stage);System.out.flush();}
    interface Hook {void run()throws Exception;}
    static class Connection extends HttpsURLConnection {
        final ByteArrayOutputStream sent=new ByteArrayOutputStream();final java.util.HashMap<String,String> headers=new java.util.HashMap<>();
        byte[] response="{\"ok\":true,\"data\":{\"state\":\"TRANSPORT_ONLY_UNVERIFIED\"}}".getBytes(StandardCharsets.UTF_8);
        Map<String,List<String>> replyHeaders=Map.of("Content-Type",List.of("application/json; charset=utf-8"));
        int status=200,disconnects;boolean timeout;Hook onReply=()->{};
        Connection(URL url){super(url);}
        public String getCipherSuite(){return "synthetic";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
        public void setRequestProperty(String key,String value){headers.put(key,value);}
        public OutputStream getOutputStream(){return sent;}
        public int getResponseCode()throws java.io.IOException{try{onReply.run();}catch(Exception e){throw new java.io.IOException(e);}if(timeout)throw new java.net.SocketTimeoutException("synthetic unknown");return status;}
        public Map<String,List<String>> getHeaderFields(){return replyHeaders;}
        public InputStream getInputStream(){return new ByteArrayInputStream(response);}public InputStream getErrorStream(){return getInputStream();}
        public void disconnect(){disconnects++;}public boolean usingProxy(){return false;}public void connect(){}
    }
    static final class Fixture implements AutoCloseable {
        final NativePrivateCustodyExchangeTest.Fixture f=new NativePrivateCustodyExchangeTest.Fixture();int opens;Connection connection;Hook configure=()->{};
        Fixture()throws Exception{}
        NativePrivateCustodyHttp http(){return new NativePrivateCustodyHttp(url->{opens++;assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
            connection=new Connection(url);configure.run();return connection;},f.clock);}
        JSONObject send(VaultEngine.NativePrivateCustodyPreparedExchange p)throws Exception{return f.engine.sendOriginalPrivateCustodyExchange(p,http(),new NativeRetainedHttp.Attempt());}
        @Override public void close(){f.close();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativePrivateCustodyOwnerTest.denied(a);}
    static void noAuthority(JSONObject p)throws Exception {NativePrivateCustodyExchangeTest.noAuthority(p);assertFalse(p.toString().contains("response_base64"));assertFalse(p.toString().contains("TRANSPORT_ONLY_UNVERIFIED"));}
    /** Select NEW owning cases only; do not replay the historical nine cases. */
    public static void main(String[] names)throws Exception {
        if(names.length==1&&names[0].equals("--saved-browser-preload-only")){
            for(String name:new String[]{"BROWSER_PRELOAD_privateTransferUsesExistingConstructorAndTerminalGuards",
                "BROWSER_PRELOAD_constructorSourceChunkMutationCannotEscapeAsBrowserData",
                "BROWSER_PRELOAD_constructorSourceFrameMutationCannotEscapeAsBrowserData",
                "BROWSER_PRELOAD_constructorSourceQueryMutationRefuses",
                "BROWSER_PRELOAD_constructorSourceExpiryRefuses"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--saved-browser-private-adoption-only")){
            for(String name:new String[]{"BROWSER_SET_initialPublicationUsesActualSavedDataAndZeroConstructorSource",
                "BROWSER_DATA_privateAdoptionLastSourceChunkMutationRefuses",
                "BROWSER_DATA_privateAdoptionLastSourceFrameMutationRefuses",
                "BROWSER_DATA_privateAdoptionLastSourceQueryMutationRefuses",
                "BROWSER_DATA_privateAdoptionLastSourceExpiryRefuses"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--saved-browser-local-data-bracket-only")){
            for(String name:new String[]{"LOCAL_BROWSER_DATA_factoryReadsActualCiphertextWithCallbackFreeChunkLookup",
                "LOCAL_BROWSER_DATA_lastLockedSourceCiphertextMutationCannotPublish",
                "LOCAL_BROWSER_DATA_lastLockedSourceCancellationCannotPublish",
                "BROWSER_SET_initialPublicationUsesActualSavedDataAndZeroConstructorSource",
                "BROWSER_SET_lastSourceQueryUnknownMutationCannotPublishOrRevive",
                "BROWSER_SET_lastSourceQueryExpiryCannotPublishOrRevive",
                "BROWSER_SET_lastSourceBrowserChunkMutationCannotPublishOrRevive",
                "BROWSER_SET_lastSourceBrowserFrameMutationCannotPublishOrRevive",
                "BROWSER_LOCAL_absenceRefusesOrphanInsertedDuringLastLockedSource",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--retention-unknown-denial-probe-only")){
            for(String name:new String[]{"RETENTION_UNKNOWN_probeHasNoSourceAndPreservesActualPendingOriginal",
                "RETENTION_UNKNOWN_orphanCannotAuthorizeQueryOrHttp",
                "COLD_NEW_firstOriginalWriteQueryThenCurrentRead",
                "COLD_NEW_reopenedCommittedUnknownNeverResends",
                "COLD_CURRENT_pendingQueryUnknownRefusesBeforeAnyContinuation",
                "CONTROLLED_FIRST_PREPARATION_currentOwnerPublishesExactOriginalOnce",
                "CONTROLLED_FIRST_PREPARATION_sourceCancellationCannotCreateRequest",
                "CONTROLLED_FIRST_PREPARATION_existingExpiredOriginalCannotBeRenewed",
                "CONTROLLED_FIRST_UNKNOWN_currentOriginalSendsOnceAndSettlesSameControl",
                "CONTROLLED_FIRST_UNKNOWN_appendSourceCancellationPreventsAllocation",
                "INITIAL_QUERY_dispatchChecksAllOriginalsAfterLastSource",
                "INITIAL_QUERY_firstFenceOwnsTargetsAndRejectsPriorOutcome",
                "FIRST_UNKNOWN_noSourceCallbackInsideEmptyNewRecord"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--first-retention-source-composition-only")){
            System.out.println("ACTUAL_FIRST_RETENTION_APPEND_AND_TYPED_TAKE_SOURCE_CONTROLS_ONLY");
            for(String name:new String[]{"CONTROLLED_FIRST_PREPARATION_currentOwnerPublishesExactOriginalOnce",
                "CONTROLLED_FIRST_PREPARATION_sourceCancellationCannotCreateRequest",
                "CONTROLLED_FIRST_PREPARATION_existingExpiredOriginalCannotBeRenewed",
                "CONTROLLED_FIRST_UNKNOWN_currentOriginalSendsOnceAndSettlesSameControl",
                "CONTROLLED_FIRST_UNKNOWN_appendSourceCancellationPreventsAllocation",
                "INITIAL_QUERY_dispatchChecksAllOriginalsAfterLastSource",
                "INITIAL_QUERY_firstFenceOwnsTargetsAndRejectsPriorOutcome",
                "FIRST_UNKNOWN_noSourceCallbackInsideEmptyNewRecord"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--immutable-browser-binding-only")){
            System.out.println("IMMUTABLE_ORIGINAL_BINDING_DATA_AND_ACTUAL_SOURCE_TERMINAL_GUARDS_ONLY");
            for(String name:new String[]{"BINDING_DATA_originalTupleDetachedAndCallbackFree",
                "BINDING_DATA_lateUnknownRefusesActualReadGetter",
                "BINDING_DATA_queryExpiryRefusesActualReadGetter",
                "COLD_NEW_reopenedCommittedUnknownNeverResends",
                "BROWSER_DOCUMENT_detachedDataAndActualEncryptedReadback",
                "BROWSER_DOCUMENT_changedUnknownAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_queryExpiryAtEffectEntryRefusesBeforeCreation",
                "STATUS_TAKE_changedOriginalAtBirthRefusesBeforeManagerHTTP",
                "STATUS_TAKE_queryExpiryAtBirthRefusesBeforeManagerHTTP"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--fixed-status-birth-take-only")){
            System.out.println("FIXED_STATUS_MANAGER_BIRTH_TAKE_ACTUAL_SOURCE_GUARDS_ONLY_NO_MANAGER_SQL_ACK_AUTHORITY");
            for(String name:new String[]{"CONTROLLED_RECOVERY_firstChallengeThenStatusOwnOriginalLoans",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement",
                "STATUS_READ_sourceCancellationBeforeDispatchRetainsOriginals",
                "STATUS_TAKE_changedOriginalAtBirthRefusesBeforeManagerHTTP",
                "STATUS_TAKE_queryExpiryAtBirthRefusesBeforeManagerHTTP"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--browser-preservation-composition-only")){
            for(String name:new String[]{"BROWSER_DOCUMENT_detachedDataAndActualEncryptedReadback",
                "BROWSER_DOCUMENT_changedUnknownAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_queryExpiryAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_metadataExpiryWithdrawsWithoutRevival",
                "BROWSER_DOCUMENT_fixedLookupUsesActualCiphertextWithoutSourceCallbacks",
                "BROWSER_DOCUMENT_fixedEffectLateQueryChangeRemainsPartialAndTerminalReadRefuses",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive",
                "COMPLETION_SET_terminalOriginalQueryExpiryCannotPublishOrRevive",
                "BROWSER_LOCAL_absenceRefusesOrphanInsertedDuringLastLockedSource"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--browser-preservation-data-only")){
            System.out.println("BROWSER_DOCUMENT_DATA_AND_ACTUAL_NATIVE_JOURNAL_GUARDS_ONLY_NO_BROWSER_AUTHORITY");
            for(String name:new String[]{"BROWSER_DOCUMENT_detachedDataAndActualEncryptedReadback",
                "BROWSER_DOCUMENT_changedUnknownAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_queryExpiryAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_metadataExpiryWithdrawsWithoutRevival",
                "BROWSER_DOCUMENT_fixedLookupUsesActualCiphertextWithoutSourceCallbacks"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--browser-disposition-initial-publication-only")){
            for(String name:new String[]{"BROWSER_SET_initialPublicationUsesActualSavedDataAndZeroConstructorSource",
                "BROWSER_SET_lastSourceQueryUnknownMutationCannotPublishOrRevive",
                "BROWSER_SET_lastSourceQueryExpiryCannotPublishOrRevive",
                "BROWSER_SET_lastSourceBrowserChunkMutationCannotPublishOrRevive",
                "BROWSER_SET_lastSourceBrowserFrameMutationCannotPublishOrRevive",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive",
                "COMPLETION_SET_terminalOriginalQueryExpiryCannotPublishOrRevive",
                "BROWSER_DOCUMENT_fixedEffectLateQueryChangeRemainsPartialAndTerminalReadRefuses",
                "BROWSER_DOCUMENT_changedUnknownAtEffectEntryRefusesBeforeCreation",
                "BROWSER_DOCUMENT_queryExpiryAtEffectEntryRefusesBeforeCreation"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--controlled-current-birth-take-only")){
            for(String name:new String[]{"CURRENT_BIRTH_controlledBirthOccursInsideActualTakeAndFileLock",
                "CURRENT_BIRTH_lastSourceQueryUnknownMutationRefusesBeforeHTTP",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "CURRENT_READ_terminalChangedUnknownRefusesBeforeTarget",
                "CURRENT_READ_terminalQueryExpiryRefusesBeforeTarget",
                "FRAME_CURRENT_ownedPieceOutlivesDisconnectAndWipesBody",
                "FRAME_CURRENT_preentryCancellationStartsNoTransport",
                "IDENTITY_NEW_currentFrameOriginalReplacementRefusesHeldRead",
                "CURRENT_READ_currentOuterEnvelopeKeepsOriginalQueryAndExistingTransportControls",
                "COLD_NEW_firstOriginalWriteQueryThenCurrentRead",
                "COLD_CURRENT_pendingQueryUnknownRefusesBeforeAnyContinuation"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--current-read-data-boundaries-only")){
            System.out.println("ACTUAL_CURRENT_READ_SOURCE_BOUNDARIES_ONLY_NO_GENUINE_SQL_BROWSER_OR_ACK");
            for(String name:new String[]{"CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "CURRENT_READ_terminalChangedUnknownRefusesBeforeTarget",
                "CURRENT_READ_terminalQueryExpiryRefusesBeforeTarget"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--first-browser-binding-data-only")){
            main(new String[]{"--prepared-browser-composition-data-only"});
            main(new String[]{"--browser-private-data-terminal-only"});return;
        }
        if(names.length==1&&names[0].equals("--prepared-browser-composition-data-only")){
            System.out.println("ACTUAL_PRE_CAPTURE_PRIVATE_DATA_ONLY_NO_BROWSER_MANAGER_SQL_ACK_AUTHORITY");
            for(String name:new String[]{"PRE_CAPTURE_DATA_completeOriginalsAndAbsenceStayOwned",
                "PRE_CAPTURE_DATA_terminalChangedUnknownCannotPublishOrRevive",
                "PRE_CAPTURE_DATA_terminalQueryExpiryCannotPublishOrRevive",
                "PRE_CAPTURE_DATA_orphanDuringLastSourceRefusesWithoutReplacement",
                "PREPARED_NATIVE_DATA_originalSemanticsStayScoped",
                "PREPARED_NATIVE_DATA_lastSourceChangedUnknownRefusesAndCannotRevive",
                "PREPARED_NATIVE_DATA_lastSourceQueryExpiryRefusesAndCannotRevive",
                "COMPLETION_COPY_privateCopiesStayOwnedAndTerminalSourceWithdrawalRefuses",
                "COMPLETION_COPY_originalQueryExpiryCannotReturnOrRevive"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--prepared-browser-native-data-only")){
            System.out.println("ACTUAL_PREPARED_NATIVE_DATA_ONLY_NOT_BROWSER_MANAGER_SQL_OR_ACK_AUTHORITY");
            for(String name:new String[]{"PREPARED_NATIVE_DATA_originalSemanticsStayScoped",
                "PREPARED_NATIVE_DATA_lastSourceChangedUnknownRefusesAndCannotRevive",
                "PREPARED_NATIVE_DATA_lastSourceQueryExpiryRefusesAndCannotRevive"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--browser-first-private-composition-only")){
            for(String name:new String[]{"BROWSER_ENTRY_changedOriginalRefusesBeforeManagerHTTP",
                "COMPLETION_COPY_privateCopiesStayOwnedAndTerminalSourceWithdrawalRefuses",
                "COMPLETION_COPY_originalQueryExpiryCannotReturnOrRevive"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--browser-private-data-terminal-only")){
            for(String name:new String[]{"SAVED_BROWSER_READ_sameOwnerBoundAndWithdrawalRetainsOriginals",
                "BROWSER_DATA_factorySourceMutationRefusesBeforePublication",
                "BROWSER_DATA_factoryOriginalQueryExpiryRefusesBeforePublication",
                "BROWSER_DATA_restoreSourceMutationRefusesBeforeReturn",
                "BROWSER_DATA_restoreOriginalQueryExpiryRefusesBeforeReturn",
                "BROWSER_DATA_privateMetadataExpiryWithdrawsActualReadWithoutRevival"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--completion-initial-publication-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMPLETION_SET_terminalOriginalQueryExpiryCannotPublishOrRevive");return;
        }
        if(names.length==1&&names[0].equals("--browser-absence-last-source-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "BROWSER_LOCAL_absenceRefusesOrphanInsertedDuringLastLockedSource");return;
        }
        if(names.length==1&&names[0].equals("--completion-birth-take-only")){
            for(String name:new String[]{"CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "COMPLETION_BIRTH_lastSourceChangedQueryOrUnknownRefusesBeforeHTTPAndCannotRevive",
                "CONTROLLED_COMPLETION_lostReplyRetainsOriginalsAndConsumesSameRead",
                "CONTROLLED_COMPLETION_sourceWithdrawalAfterReplyRefusesAndRetainsEvidence",
                "COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive",
                "COMPLETION_SET_terminalOriginalQueryExpiryCannotPublishOrRevive"})
                NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,name);
            return;
        }
        if(names.length==1&&names[0].equals("--completion-birth-last-source-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMPLETION_BIRTH_lastSourceChangedQueryOrUnknownRefusesBeforeHTTPAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--completion-copy-lifetime-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMPLETION_COPY_privateCopiesStayOwnedAndTerminalSourceWithdrawalRefuses");return;
        }
        if(names.length==1&&names[0].equals("--completion-display-terminal-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive");return;
        }
        if(names.length==1&&names[0].equals("--completion-local-entry-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "BROWSER_ENTRY_changedOriginalRefusesBeforeManagerHTTP");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "MANAGER_LEASE_changedOriginalUnknownRefusesCompletionAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--manager-response-local-summary-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "MANAGER_RESPONSE_postSummarySourceMutationCannotPublishOrRevive");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "MANAGER_RESPONSE_postSummaryOriginalQueryExpiryCannotPublishOrRevive");return;
        }
        if(names.length==1&&names[0].equals("--existing-recovery-request-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "EXISTING_RECOVERY_REQUEST_exactPairRestoresWithoutFirstSendAuthority");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "EXISTING_RECOVERY_REQUEST_lastSourceMutationRefusesAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--saved-browser-owner-join-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "SAVED_BROWSER_READ_sameOwnerBoundAndWithdrawalRetainsOriginals");return;
        }
        if(names.length==1&&names[0].equals("--controlled-first-unknown-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_FIRST_UNKNOWN_currentOriginalSendsOnceAndSettlesSameControl");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_FIRST_UNKNOWN_appendSourceCancellationPreventsAllocation");return;
        }
        if(names.length==1&&names[0].equals("--controlled-first-publication-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_FIRST_PREPARATION_currentOwnerPublishesExactOriginalOnce");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_FIRST_PREPARATION_sourceCancellationCannotCreateRequest");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_FIRST_PREPARATION_existingExpiredOriginalCannotBeRenewed");return;
        }
        if(names.length==1&&names[0].equals("--initial-query-owned-target-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "INITIAL_QUERY_privateTargetCopiesSurviveLoanAndRefuseChangedOriginal");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "INITIAL_QUERY_dispatchChecksAllOriginalsAfterLastSource");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "INITIAL_QUERY_firstFenceOwnsTargetsAndRejectsPriorOutcome");return;
        }
        if(names.length==1&&names[0].equals("--committed-prepared-force-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "COMMITTED_FORCE_sameOriginalSurvivesForceAndPostSourceMutationRefuses");return;
        }
        if(names.length==1&&names[0].equals("--first-purpose-pair-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_cancellationAfterLocalBirthRetainsUnknownNoSend");return;
        }
        if(names.length==1&&names[0].equals("--target-frame-join-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "TARGET_FRAME_terminalSourceMutationCannotReturnOrReviveTarget");return;
        }
        if(names.length==1&&names[0].equals("--compound-query-birth-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CURRENT_READ_currentOuterEnvelopeKeepsOriginalQueryAndExistingTransportControls");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "TARGET_FRAME_terminalSourceMutationCannotReturnOrReviveTarget");return;
        }
        if(names.length==1&&names[0].equals("--readonly-original-data-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "READONLY_PREFLIGHT_lastSourceMutationRetainsOriginalsBeforeHTTP");return;
        }
        if(names.length==1&&names[0].equals("--first-challenge-fence-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_CHALLENGE_FENCE_cancellationAfterDurableUnknownRetainsWithoutSend");return;
        }
        if(names.length==1&&names[0].equals("--original-dispatch-join-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "ORIGINAL_DISPATCH_liveSourceMutationRefusesTakeAndCannotRevive");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");return;
        }
        if(names.length==1&&names[0].equals("--response-publication-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "ACTUAL_RESPONSE_publicationCancellationRetainsOriginalsWithoutResend");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_COMPLETION_lostReplyRetainsOriginalsAndConsumesSameRead");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_COMPLETION_sourceWithdrawalAfterReplyRefusesAndRetainsEvidence");return;
        }
        if(names.length==1&&names[0].equals("--existing-response-read-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "EXISTING_RESPONSE_lastSourceMutationRefusesReadAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--existing-response-last-source-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "EXISTING_RESPONSE_lastSourceMutationRefusesReadAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--original-status-owned-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "STATUS_READ_sourceCancellationBeforeDispatchRetainsOriginals");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");return;
        }
        if(names.length==1&&names[0].equals("--manager-lease-original-unknown-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "MANAGER_LEASE_changedOriginalUnknownRefusesCompletionAndCannotRevive");return;
        }
        if(names.length==1&&names[0].equals("--recovery-intent-original-revalidation-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "RECOVERY_INTENT_currentOwnerRefusesChangedOriginalWithoutResend");return;
        }
        if(names.length==1&&names[0].equals("--sealed-recovery-original-revalidation-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "SEALED_RECOVERY_originalsRejectMutationIdentityAndNegativeAba");return;
        }
        if(names.length==1&&names[0].equals("--current-frame-original-revalidation-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "FRAME_ORIGINAL_fourFilesRejectMutationIdentityAndNegativeAba");return;
        }
        if(names.length==1&&names[0].equals("--current-original-revalidation-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "CURRENT_ORIGINAL_fourFilesRejectMutationIdentityAndNegativeAba");return;
        }
        if(names.length==1&&names[0].equals("--prepared-original-revalidation-only")){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,
                "PREPARED_ORIGINAL_sameInodeChangedCiphertextRefusesWithoutRebaseline");return;
        }
        if(names.length==2&&names[0].equals("--controlled-recovery-owning-only")){
            if(!java.util.Set.of("CONTROLLED_RECOVERY_firstChallengeThenStatusOwnOriginalLoans",
                "CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion",
                "CONTROLLED_COMPLETION_lostReplyRetainsOriginalsAndConsumesSameRead",
                "CONTROLLED_COMPLETION_sourceWithdrawalAfterReplyRefusesAndRetainsEvidence").contains(names[1]))
                throw new IllegalArgumentException("affected owning recovery member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--fixed-purpose-take-only")){
            if(!java.util.Set.of("CURRENT_READ_currentOuterEnvelopeKeepsOriginalQueryAndExistingTransportControls",
                "FRAME_CURRENT_ownedPieceOutlivesDisconnectAndWipesBody",
                "FRAME_CURRENT_preentryCancellationStartsNoTransport",
                "FRAME_TARGET_originalLostReplySettlesPieceAndStaysOneUse",
                "FRAME_STATUS_missingTypedDispatchStartsNoPieceOrTransport",
                "FIXED_PURPOSE_changedOuterBodyRefusesWithoutConsumingOrTransport").contains(names[1]))
                throw new IllegalArgumentException("affected fixed-purpose take member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--original-completion-http-only")){
            if(!java.util.Set.of("ORIGINAL_COMPLETION_HTTP_missingDispatchCannotOpenConnection",
                "ORIGINAL_COMPLETION_HTTP_rawRequestCannotEnterTypedSender").contains(names[1]))throw new IllegalArgumentException("new completion HTTP member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--local-recovery-current-frame-join-only")){
            if(!java.util.Set.of("RECOVERY_JOIN_sameOriginalPendingAndAliasThenCurrentCompletion",
                "RECOVERY_JOIN_sourceWithdrawalBeforeFreshReadOpensNothing").contains(names[1]))throw new IllegalArgumentException("new recovery join member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--lifecycle-original-outcome-only")){
            if(!java.util.Set.of("LIFECYCLE_NEW_signalDuringFirstReplySurvivesConsumedInterrupt",
                "LIFECYCLE_NEW_signalAndLostFirstReplyKeepExactUnknown").contains(names[1]))
                throw new IllegalArgumentException("new lifecycle original outcome member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--first-original-custody-only")){
            if(!java.util.Set.of("COLD_NEW_firstOriginalWriteQueryThenCurrentRead",
                "COLD_NEW_reopenedCommittedUnknownNeverResends",
                "COLD_CURRENT_pendingQueryUnknownRefusesBeforeAnyContinuation",
                "QUERY_TARGET_existingOriginalPairStaysExactAndPendingRefuses",
                "COLD_NEW_cancellationDuringFirstReplyKeepsUnknown",
                "COLD_NEW_ambiguousFirstReplyKeepsOriginals").contains(names[1]))throw new IllegalArgumentException("new cold custody member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==2&&names[0].equals("--http-identity-workflow-only")){
            if(!java.util.Set.of("IDENTITY_NEW_dispatchUnknownReplacementDuringReplyRefusesOutcome",
                "IDENTITY_NEW_currentQueryUnknownReplacementDuringReplyRefusesRead",
                "IDENTITY_NEW_currentFrameSameAncestryRemainsLive",
                "IDENTITY_NEW_currentFrameOriginalReplacementRefusesHeldRead").contains(names[1]))throw new IllegalArgumentException("new HTTP identity member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyHttpOutcomeTest.class,names[1]);return;
        }
        if(names.length==0)throw new IllegalArgumentException("explicit_LIFETIME_cases_required");
        for(String name:names){if(!name.startsWith("LIFETIME_")&&!name.startsWith("FRAME_CONTROL_")&&!java.util.Set.of("CURRENT_READ_missingTypedDispatchCannotOpenConnection",
            "CURRENT_READ_currentOuterEnvelopeKeepsOriginalQueryAndExistingTransportControls",
            "G08_CHALLENGE_nullTypedDispatchCannotOpenConnection",
            "G08_CHALLENGE_wrongTypeCannotEnterTypedSender").contains(name))throw new IllegalArgumentException("new_owning_cases_only");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyHttpOutcomeTest.class,name));
            if(!result.wasSuccessful()){for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);}
            System.out.println("PASS_SOURCE_MOCK "+name);
        }
        System.out.println("SOURCE_ONLY_SYNTHETIC_CONNECTION_NO_ANDROID_TLS_OR_SERVER_PROOF");
    }
    /** Distinct first-use originals: the real statusTaken guard deliberately
     * forbids status followed by manager on the same prepared request. These
     * SYNTHETIC connection cases create no real manager/SQL/ACK authority. */
    @Test public void CONTROLLED_RECOVERY_firstChallengeThenStatusOwnOriginalLoans()throws Exception{
        owningControlledRecoveryReads(false);
    }
    @Test public void CONTROLLED_RECOVERY_firstChallengeManagerRequiresNonemptyOriginalCompletion()throws Exception{
        owningControlledRecoveryReads(true);
    }
    @Test public void MANAGER_RESPONSE_postSummarySourceMutationCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.MANAGER_SUMMARY_CHANGED_SOURCE);
    }
    @Test public void MANAGER_RESPONSE_postSummaryOriginalQueryExpiryCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.MANAGER_SUMMARY_EXPIRED_QUERY);
    }
    @Test public void PREPARED_NATIVE_DATA_originalSemanticsStayScoped()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PREPARED_NATIVE_DATA_NORMAL);
    }
    @Test public void PREPARED_NATIVE_DATA_lastSourceChangedUnknownRefusesAndCannotRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PREPARED_NATIVE_DATA_SOURCE);
    }
    @Test public void PREPARED_NATIVE_DATA_lastSourceQueryExpiryRefusesAndCannotRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PREPARED_NATIVE_DATA_CLOCK);
    }
    @Test public void PRE_CAPTURE_DATA_completeOriginalsAndAbsenceStayOwned()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PRE_CAPTURE_DATA_NORMAL);
    }
    @Test public void PRE_CAPTURE_DATA_terminalChangedUnknownCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PRE_CAPTURE_DATA_SOURCE);
    }
    @Test public void PRE_CAPTURE_DATA_terminalQueryExpiryCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PRE_CAPTURE_DATA_CLOCK);
    }
    @Test public void PRE_CAPTURE_DATA_orphanDuringLastSourceRefusesWithoutReplacement()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.PRE_CAPTURE_DATA_ORPHAN);
    }
    @Test public void CURRENT_READ_terminalChangedUnknownRefusesBeforeTarget()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.CURRENT_READ_SOURCE);
    }
    @Test public void CURRENT_READ_terminalQueryExpiryRefusesBeforeTarget()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.CURRENT_READ_CLOCK);
    }
    @Test public void COMPLETION_SET_terminalSourceMutationCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.COMPLETION_SET_TERMINAL_SOURCE);
    }
    @Test public void COMPLETION_SET_terminalOriginalQueryExpiryCannotPublishOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.COMPLETION_SET_TERMINAL_CLOCK);
    }
    @Test public void COMPLETION_COPY_privateCopiesStayOwnedAndTerminalSourceWithdrawalRefuses()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.COMPLETION_COPY_TERMINAL_SOURCE);
    }
    @Test public void COMPLETION_COPY_originalQueryExpiryCannotReturnOrRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.COMPLETION_COPY_TERMINAL_CLOCK);
    }
    @Test public void BROWSER_LOCAL_absenceRefusesOrphanInsertedDuringLastLockedSource()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.BROWSER_ABSENCE_LAST_SOURCE_ORPHAN);
    }
    @Test public void CONTROLLED_COMPLETION_lostReplyRetainsOriginalsAndConsumesSameRead()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.LOST_REPLY);
    }
    @Test public void CONTROLLED_COMPLETION_sourceWithdrawalAfterReplyRefusesAndRetainsEvidence()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.SOURCE_WITHDRAWAL);
    }
    /** Actual normal completion birth only; no synthetic capability or HTTP
     * refusal substitutes for its terminal native Source/raw-original guard. */
    @Test public void COMPLETION_BIRTH_lastSourceChangedQueryOrUnknownRefusesBeforeHTTPAndCannotRevive()throws Exception{
        for(var failure:new CompletionFailure[]{CompletionFailure.COMPLETION_BIRTH_QUERY_CHANGED_SOURCE,
            CompletionFailure.COMPLETION_BIRTH_QUERY_UNKNOWN_CHANGED_SOURCE})owningControlledRecoveryReads(true,failure);
    }
    /** One affected shipping guard: changed bytes on the SAME inode cannot
     * pass as the earlier authenticated prepared original, even with the old
     * timestamp restored. Restoring bytes after refusal must not revive it. */
    @Test public void PREPARED_ORIGINAL_sameInodeChangedCiphertextRefusesWithoutRebaseline()throws Exception {
        for(String subject:new String[]{"WRITE","QUERY_WRITE","QUERY_WRITE_UNKNOWN"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            boolean query=subject.startsWith("QUERY_");
            if(query)f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var prepared=query?f.query(0):write){
            var file=f.dir.resolve(subject.equals("QUERY_WRITE_UNKNOWN")?"write_unknown-0.bin":"write-0.bin");
            var attributes=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(file),changed=original.clone();
            try{
                prepared.projection();changed[changed.length/2]^=1;
                Files.write(file,changed);Files.setLastModifiedTime(file,attributes.lastModifiedTime());
                assertEquals(attributes.fileKey(),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertEquals(attributes.lastModifiedTime(),Files.getLastModifiedTime(file));
                var failure=assertThrows(VaultFailure.class,prepared::projection);
                assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                assertTrue("The actual exact-original byte guard must refuse, not an unrelated fixture prerequisite",
                    Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("requireExistingPreparedOriginalCurrent")));
                assertArrayEquals(changed,Files.readAllBytes(file));
                // Negative ABA only: never recreate/re-sign a request or use
                // the restored bytes as a new successful baseline/capability.
                Files.write(file,original);Files.setLastModifiedTime(file,attributes.lastModifiedTime());
                assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,prepared::projection).code);
                assertArrayEquals(original,Files.readAllBytes(file));
                assertEquals(query,Files.exists(f.dir.resolve("write_unknown-0.bin")));
                assertEquals(query,Files.exists(f.dir.resolve("query-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                System.out.println("PREPARED_RAW_ORIGINAL_WITHDRAWN "+subject);
            }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
            }
        }
    }
    /** Newly changed initial QUERY constructor: its fixed original WRITE and
     * UNKNOWN DATA outlive the closed factory loan, but never replace a live
     * file guard. One typed synthetic send; a different changed original is
     * refused before its QUERY UNKNOWN or connection can be created. */
    @Test public void INITIAL_QUERY_privateTargetCopiesSurviveLoanAndRefuseChangedOriginal()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            var originalWrite=write.projection();f.engine.fenceOriginalPrivateCustodyExchange(write);
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            try(var query=f.query(0)){
                // preparePrivateCustodyExchange has already closed its target
                // loan; this owner must hold its own SAME immutable copies.
                var before=query.projection();NativePrivateCustodyExchangeTest.noAuthority(before);
                assertEquals(originalWrite.get("prepared_record_sha256"),before.get("target_write_record_sha256"));
                var connections=new java.util.ArrayList<Connection>();
                var http=new NativePrivateCustodyHttp(url->{var connection=new Connection(url);connections.add(connection);return connection;},f.clock);
                var outcome=f.engine.sendOriginalPrivateCustodyExchange(query,http,new NativeRetainedHttp.Attempt());
                NativePrivateCustodyExchangeTest.noAuthority(outcome);assertEquals(1,connections.size());
                var sent=connections.get(0);assertEquals(1,sent.disconnects);
                assertEquals(before.get("native_request_id"),sent.headers.get("X-Memphis-Native-Request-Id"));
                assertEquals(before.get("native_request_timestamp"),sent.headers.get("X-Memphis-Native-Request-Timestamp"));
                assertEquals(before.get("request_body_sha256"),NativeRetainedAttempt.hash(sent.sent.toByteArray()));
                assertTrue(Files.exists(f.dir.resolve("query_unknown-0.bin")));coldSame(originals,inodes);
                var saved=coldOriginals(f);var savedInodes=coldInodes(saved);
                try(var reopened=f.query(0)){
                    var observed=reopened.projection();NativePrivateCustodyExchangeTest.noAuthority(observed);
                    for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256",
                        "target_write_record_sha256","target_unknown_record_sha256"})assertEquals(before.get(key),observed.get(key));
                    assertTrue(observed.getBoolean("dispatch_unknown_fence_observed"));coldSame(saved,savedInodes);
                    assertThrows("Reopened DATA does not grant a second first send",VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(reopened));
                    assertEquals(1,connections.size());coldSame(saved,savedInodes);
                }finally{for(var bytes:saved.values())Arrays.fill(bytes,(byte)0);}
                assertThrows(VaultFailure.class,()->f.engine.sendOriginalPrivateCustodyExchange(query,http,new NativeRetainedHttp.Attempt()));
                assertEquals(1,connections.size());coldSame(originals,inodes);
            }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        }
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                var path=f.dir.resolve("write-0.bin");var before=Files.readAttributes(path,
                    java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                var opens=new java.util.concurrent.atomic.AtomicInteger();
                var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();return new Connection(url);},f.clock);
                try{
                    Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                    assertThrows(VaultFailure.class,()->f.engine.sendOriginalPrivateCustodyExchange(query,http,new NativeRetainedHttp.Attempt()));
                    assertEquals(0,opens.get());assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                    var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    assertArrayEquals(changed,Files.readAllBytes(path));
                    Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                    assertThrows("Old bytes do not revive a refused QUERY",VaultFailure.class,query::projection);
                    assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));assertEquals(0,opens.get());
                }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
            }
        }
    }
    /** The new fixed dispatch bracket must catch a target or issued UNKNOWN
     * changed by its LAST Source callback, not merely an earlier inode check. */
    @Test public void INITIAL_QUERY_dispatchChecksAllOriginalsAfterLastSource()throws Exception {
        for(String filename:new String[]{"write-0.bin","query_unknown-0.bin","query_observation-0.pending"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                var lines=new java.util.HashSet<Integer>();var path=f.dir.resolve(filename);
                final byte[][] original={null},changed={null};
                final java.nio.file.attribute.PosixFileAttributes[] attributes={null};
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        var trace=Thread.currentThread().getStackTrace();boolean take=false;
                        for(var frame:trace)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyDispatch")
                            &&frame.getMethodName().equals("takeRequest"))take=true;
                        if(armed.get()&&!fired.get()&&take)for(var frame:trace)
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("requireExistingPreparedOriginalCurrent")){
                                lines.add(frame.getLineNumber());
                                if(lines.size()==1&&fired.compareAndSet(false,true))try{
                                    try(var lockProbe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),
                                        java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS)){
                                        assertThrows("The remaining Source callback must run under the actual journal FileLock",
                                            java.nio.channels.OverlappingFileLockException.class,lockProbe::tryLock);
                                    }
                                    if(filename.startsWith("query_observation-")){
                                        original[0]=Files.readAllBytes(f.dir.resolve("write_unknown-0.bin"));changed[0]=original[0].clone();
                                        Files.write(path,changed[0],java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.StandardOpenOption.WRITE);
                                        Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                                        attributes[0]=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                    }else{
                                        attributes[0]=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                        original[0]=Files.readAllBytes(path);changed[0]=original[0].clone();changed[0][changed[0].length/2]^=1;
                                        Files.write(path,changed[0]);Files.setLastModifiedTime(path,attributes[0].lastModifiedTime());
                                    }
                                }catch(Exception failure){throw new AssertionError("Last-Source dispatch mutation prerequisite failed",failure);}
                                break;
                            }
                        return super.entrySet();
                    }
                });
                var opens=new java.util.concurrent.atomic.AtomicInteger();
                var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();return new Connection(url);},f.clock);
                try{
                    var failure=assertThrows(VaultFailure.class,()->f.engine.sendOriginalPrivateCustodyExchange(query,http,new NativeRetainedHttp.Attempt()));
                    armed.set(false);assertTrue("The actual terminal dispatch Source callback must run",fired.get());assertEquals(1,lines.size());
                    assertEquals(NativeRetainedAttempt.FAILURE,failure.code);assertEquals(0,opens.get());
                    assertTrue(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertTrue(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                    assertArrayEquals(changed[0],Files.readAllBytes(path));
                    var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(attributes[0].fileKey(),after.fileKey());assertEquals(attributes[0].lastModifiedTime(),after.lastModifiedTime());
                    if(filename.startsWith("query_observation-")){
                        assertArrayEquals("Late orphan creation cannot change its copied source",original[0],Files.readAllBytes(f.dir.resolve("write_unknown-0.bin")));
                    }else{Files.write(path,original[0]);Files.setLastModifiedTime(path,attributes[0].lastModifiedTime());}
                    assertThrows("Restoring old DATA cannot revive this refused dispatch",VaultFailure.class,query::projection);assertEquals(0,opens.get());
                }finally{
                    armed.set(false);source.unknown.put(namespace,map);
                    if(original[0]!=null)Arrays.fill(original[0],(byte)0);if(changed[0]!=null)Arrays.fill(changed[0],(byte)0);
                }
            }
        }
    }
    /** Exercise the SAME private controlled preparation used by the shipping
     * retained-frame caller. Reflection opens no production API or authority;
     * real fixture plan/journal/control owners still admit or refuse it. */
    private static VaultEngine.NativePrivateCustodyPreparedExchange prepareControlledFirstOriginal(
        NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        String kind,NativePrivateCustodyFrameReadControl control)throws Exception {
        Class<?> kindType=Class.forName(VaultEngine.NativePrivateCustodyExchangeJournal.class.getName()+"$Kind");
        Object fixedKind=Arrays.stream(kindType.getEnumConstants()).filter(value->((Enum<?>)value).name().equals(kind)).findFirst().orElseThrow();
        var method=VaultEngine.class.getDeclaredMethod("prepareOriginalPrivateCustodyExchange",
            VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,VaultEngine.NativePrivateCustodyExchangeJournal.class,
            kindType,int.class,NativePrivateCustodyFrameReadControl.class);
        method.setAccessible(true);
        try{synchronized(f.engine){return (VaultEngine.NativePrivateCustodyPreparedExchange)method.invoke(f.engine,f.plan,f.journal,fixedKind,0,control);}}
        catch(java.lang.reflect.InvocationTargetException failure){
            var cause=failure.getCause();if(cause instanceof Exception exception)throw exception;
            if(cause instanceof Error error)throw error;throw failure;
        }
    }
    @Test public void CONTROLLED_FIRST_PREPARATION_currentOwnerPublishesExactOriginalOnce()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            for(String kind:new String[]{"WRITE","QUERY"}){
                try(var prepared=prepareControlledFirstOriginal(f,kind,control)){
                    var before=prepared.projection();noAuthority(before);var originals=coldOriginals(f);var inodes=coldInodes(originals);
                    try{
                        assertEquals(kind,before.getString("kind"));
                        String prefix=kind.equals("WRITE")?"write":"query";
                        assertTrue(Files.exists(f.dir.resolve(prefix+"-0.bin")));
                        assertFalse(Files.exists(f.dir.resolve(prefix+"_unknown-0.bin")));
                        var fenced=f.engine.fenceOriginalPrivateCustodyExchange(prepared);noAuthority(fenced);
                        for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256"})
                            assertEquals("Controlled first preparation keeps the SAME original",before.get(key),fenced.get(key));
                        assertTrue(fenced.getBoolean("dispatch_unknown_fence_observed"));coldSame(originals,inodes);stable.check();
                        assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(prepared));
                    }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
                }
            }
        }
    }
    @Test public void CONTROLLED_FIRST_PREPARATION_sourceCancellationCannotCreateRequest()throws Exception {
        for(String kind:new String[]{"WRITE","QUERY"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            if(kind.equals("QUERY"))
                try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
            var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
            source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                    if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.class.getName())
                            &&frame.getMethodName().equals("prepareOriginalPrivateCustodyExchange")
                            &&fired.compareAndSet(false,true)){control.requestCancellation();break;}
                    return super.entrySet();
                }
            });
            try{
                assertThrows(VaultFailure.class,()->{try(var unexpected=prepareControlledFirstOriginal(f,kind,control)){fail("Canceled action cannot publish a first original");}});
                armed.set(false);assertTrue("Cancellation came from the actual preparation Source callback",fired.get());
                String prefix=kind.equals("WRITE")?"write":"query";
                for(String suffix:new String[]{"-0.bin","-0.pending","_unknown-0.bin","_unknown-0.pending","_observation-0.bin"})
                    assertFalse("No request/outcome may be born after cancellation",Files.exists(f.dir.resolve(prefix+suffix)));
                coldSame(originals,inodes);
            }finally{armed.set(false);source.unknown.put(namespace,originalMap);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void CONTROLLED_FIRST_PREPARATION_existingExpiredOriginalCannotBeRenewed()throws Exception {
        for(String kind:new String[]{"WRITE","QUERY"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            if(kind.equals("QUERY"))
                try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            org.json.JSONObject original;
            try(var prepared=prepareControlledFirstOriginal(f,kind,control)){original=prepared.projection();}
            var originals=coldOriginals(f);var inodes=coldInodes(originals);f.clock.now+=120001;
            try{
                try(var restored=prepareControlledFirstOriginal(f,kind,control)){
                    var observed=restored.projection();
                    for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256"})
                        assertEquals("An expired saved original must not be re-created",original.get(key),observed.get(key));
                    assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(restored));
                }catch(VaultFailure refusal){/* Earlier refusal is allowed, replacement is not. */}
                coldSame(originals,inodes);
                String prefix=kind.equals("WRITE")?"write":"query";
                assertFalse(Files.exists(f.dir.resolve(prefix+"_unknown-0.bin")));
                assertFalse(Files.exists(f.dir.resolve(prefix+"_unknown-0.pending")));
            }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    private static void sendControlledFirstOriginal(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        VaultEngine.NativePrivateCustodyPreparedExchange prepared,NativePrivateCustodyHttp http,
        NativePrivateCustodyFrameReadControl control)throws Exception {
        var method=VaultEngine.class.getDeclaredMethod("sendOriginalPrivateCustodyExchangeUnderControl",
            VaultEngine.NativePrivateCustodyPreparedExchange.class,NativePrivateCustodyHttp.class,NativePrivateCustodyFrameReadControl.class);
        method.setAccessible(true);
        try{method.invoke(f.engine,prepared,http,control);}
        catch(java.lang.reflect.InvocationTargetException failure){
            var cause=failure.getCause();if(cause instanceof Exception exception)throw exception;
            if(cause instanceof Error error)throw error;throw failure;
        }
    }
    private static void fenceControlledFirstOriginal(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        VaultEngine.NativePrivateCustodyPreparedExchange prepared,NativePrivateCustodyFrameReadControl control)throws Exception {
        var method=VaultEngine.class.getDeclaredMethod("fenceOriginalPrivateCustodyExchangeOwned",
            VaultEngine.NativePrivateCustodyPreparedExchange.class,NativePrivateCustodyFrameReadControl.class);
        method.setAccessible(true);
        try{synchronized(f.engine){try(var issued=(AutoCloseable)method.invoke(f.engine,prepared,control)){assertNotNull(issued);}}}
        catch(java.lang.reflect.InvocationTargetException failure){
            var cause=failure.getCause();if(cause instanceof Exception exception)throw exception;
            if(cause instanceof Error error)throw error;throw failure;
        }
    }
    private static boolean retentionUnknownProbe(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        String name,int index,NativePrivateCustodyFrameReadControl control)throws Exception {
        var kinds=Arrays.stream(f.journal.getClass().getDeclaredClasses()).filter(c->c.getSimpleName().equals("Kind")).findFirst().orElseThrow();
        Object kind=Arrays.stream(kinds.getEnumConstants()).filter(k->k.toString().equals(name)).findFirst().orElseThrow();
        var method=f.journal.getClass().getDeclaredMethod("retainedUnknownForFirstRetention",
            VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kinds,int.class,NativePrivateCustodyFrameReadControl.class);
        method.setAccessible(true);
        synchronized(f.engine){try{return (Boolean)method.invoke(f.journal,f.plan,kind,index,control);}
            catch(java.lang.reflect.InvocationTargetException failure){
                if(failure.getCause() instanceof Exception cause)throw cause;
                if(failure.getCause() instanceof Error cause)throw cause;throw new AssertionError(failure.getCause());
            }}
    }
    private static boolean retentionUnknownProbeWithoutSource(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        String name,int index,NativePrivateCustodyFrameReadControl control)throws Exception {
        var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
        var callbacks=new java.util.concurrent.atomic.AtomicInteger();
        source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){callbacks.incrementAndGet();return super.entrySet();}
        });
        try{return retentionUnknownProbe(f,name,index,control);}
        finally{source.unknown.put(namespace,map);assertEquals("Denial DATA must not invoke a Source callback",0,callbacks.get());}
    }
    @Test public void RETENTION_UNKNOWN_probeHasNoSourceAndPreservesActualPendingOriginal()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            assertFalse(Files.exists(f.dir));assertFalse(retentionUnknownProbeWithoutSource(f,"WRITE_UNKNOWN",0,control));
            assertFalse(Files.exists(f.dir));
            try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            var committed=f.dir.resolve("write_unknown-0.bin");var pending=f.dir.resolve("write_unknown-0.pending");
            byte[] bytes=Files.readAllBytes(committed);var attrs=Files.readAttributes(committed,java.nio.file.attribute.PosixFileAttributes.class);
            try{
                assertTrue(retentionUnknownProbeWithoutSource(f,"WRITE_UNKNOWN",0,control));
                assertFalse(retentionUnknownProbeWithoutSource(f,"QUERY_UNKNOWN",0,control));
                assertThrows(VaultFailure.class,()->retentionUnknownProbeWithoutSource(f,"WRITE",0,control));
                assertThrows(VaultFailure.class,()->retentionUnknownProbeWithoutSource(f,"WRITE_UNKNOWN",-1,control));
                Files.move(committed,pending);assertTrue(retentionUnknownProbeWithoutSource(f,"WRITE_UNKNOWN",0,control));
                assertArrayEquals(bytes,Files.readAllBytes(pending));assertEquals(attrs.fileKey(),
                    Files.readAttributes(pending,java.nio.file.attribute.PosixFileAttributes.class).fileKey());
                assertFalse(Files.exists(committed));control.cancel();
                assertThrows(VaultFailure.class,()->retentionUnknownProbeWithoutSource(f,"WRITE_UNKNOWN",0,control));
                assertArrayEquals(bytes,Files.readAllBytes(pending));
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void RETENTION_UNKNOWN_orphanCannotAuthorizeQueryOrHttp()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            var original=f.dir.resolve("write-0.bin");var held=f.x.f.root.resolve("UNIT-held-actual-write-original.bin");
            Files.move(original,held);var originals=coldOriginals(f);var inodes=coldInodes(originals);var owner=coldSavedOwner(f);
            var opens=new java.util.concurrent.atomic.AtomicInteger();
            try{
                var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("Orphan UNKNOWN admitted HTTP");},f.clock);
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyRequests(owner,f.journal,http,control));
                assertEquals(0,opens.get());assertTrue(Files.exists(f.dir.resolve("write_unknown-0.bin")));
                assertTrue(Files.exists(held));assertFalse(Files.exists(original));assertFalse(Files.exists(f.dir.resolve("query-0.bin")));
                coldSame(originals,inodes);control.check();
            }finally{owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void CONTROLLED_FIRST_UNKNOWN_currentOriginalSendsOnceAndSettlesSameControl()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            var connections=new java.util.ArrayList<Connection>();
            var http=new NativePrivateCustodyHttp(url->{
                assertFalse(Thread.holdsLock(f.engine));
                assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                var connection=new Connection(url);connections.add(connection);return connection;
            },f.clock);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            for(String kind:new String[]{"WRITE","QUERY"})try(var prepared=prepareControlledFirstOriginal(f,kind,control)){
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                try{
                    sendControlledFirstOriginal(f,prepared,http,control);control.check();
                    String prefix=kind.equals("WRITE")?"write":"query";
                    assertTrue(Files.exists(f.dir.resolve(prefix+"_unknown-0.bin")));
                    assertTrue(Files.exists(f.dir.resolve(prefix+"_observation-0.bin")));
                    assertFalse(Files.exists(f.dir.resolve(prefix+"_unknown-0.pending")));
                    coldSame(originals,inodes);stable.check();
                    assertThrows(VaultFailure.class,()->sendControlledFirstOriginal(f,prepared,http,control));
                    control.check();
                }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
            assertEquals(2,connections.size());
            for(var connection:connections){assertTrue(connection.sent.size()>0);assertEquals(1,connection.disconnects);}
        }
    }
    @Test public void FIRST_UNKNOWN_noSourceCallbackInsideEmptyNewRecord()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
            var callbacks=new java.util.concurrent.atomic.AtomicInteger();var connections=new java.util.ArrayList<Connection>();
            var http=new NativePrivateCustodyHttp(url->{var c=new Connection(url);connections.add(c);return c;},f.clock);
            source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                    callbacks.incrementAndGet();
                    try{for(String key:new String[]{"write_unknown-0.bin","query_unknown-0.bin"}){
                        var path=f.dir.resolve(key);
                        if(Files.exists(path))assertTrue("No arbitrary Source callback may stall an allocated empty UNKNOWN",Files.size(path)>=64);
                    }}catch(java.io.IOException failure){throw new AssertionError("Actual allocated UNKNOWN Source window",failure);}
                    return super.entrySet();
                }
            });
            try{
                for(String kind:new String[]{"WRITE","QUERY"})try(var prepared=prepareControlledFirstOriginal(f,kind,control)){
                    var original=prepared.projection();
                    sendControlledFirstOriginal(f,prepared,http,control);control.check();
                    String prefix=kind.equals("WRITE")?"write":"query";
                    assertTrue(Files.size(f.dir.resolve(prefix+"_unknown-0.bin"))>=64);
                    var c=connections.get(connections.size()-1);assertEquals(original.get("native_request_id"),c.headers.get("X-Memphis-Native-Request-Id"));
                    assertEquals(original.get("request_body_sha256"),NativeRetainedAttempt.hash(c.sent.toByteArray()));
                    assertThrows(VaultFailure.class,()->sendControlledFirstOriginal(f,prepared,http,control));
                }
                assertTrue(callbacks.get()>0);assertEquals(2,connections.size());
                for(var c:connections)assertEquals(1,c.disconnects);
            }finally{source.unknown.put(namespace,map);}
        }
    }
    @Test public void CONTROLLED_FIRST_UNKNOWN_appendSourceCancellationPreventsAllocation()throws Exception {
        for(String kind:new String[]{"WRITE","QUERY"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            if(kind.equals("QUERY"))try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            try(var prepared=prepareControlledFirstOriginal(f,kind,control)){
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("append")&&fired.compareAndSet(false,true)){
                                control.requestCancellation();break;
                            }
                        return super.entrySet();
                    }
                });
                try{
                    var failure=assertThrows(VaultFailure.class,()->fenceControlledFirstOriginal(f,prepared,control));armed.set(false);
                    assertTrue("Actual UNKNOWN append Source callback canceled this SAME control",fired.get());
                    assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                    String prefix=kind.equals("WRITE")?"write":"query";
                    for(String suffix:new String[]{"_unknown-0.bin","_unknown-0.pending","_observation-0.bin","_observation-0.pending"})
                        assertFalse("No UNKNOWN may be allocated after this cancellation",Files.exists(f.dir.resolve(prefix+suffix)));
                    coldSame(originals,inodes);
                }finally{armed.set(false);source.unknown.put(namespace,originalMap);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    /** The consolidated first-force boundary owns every QUERY original, not
     * only the request. Same-slot orphan/uncertain outcomes refuse before
     * force's terminal Source callback or any new UNKNOWN/transport. */
    @Test public void INITIAL_QUERY_firstFenceOwnsTargetsAndRejectsPriorOutcome()throws Exception {
        for(String filename:new String[]{"query-0.bin","write-0.bin","write_unknown-0.bin"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var path=f.dir.resolve(filename);var before=Files.readAttributes(path,
                    java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                var lines=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("forceCommittedPreparedOriginal")){
                                lines.add(frame.getLineNumber());
                                if(lines.size()==2&&fired.compareAndSet(false,true))try{
                                    assertTrue(Thread.holdsLock(f.engine));Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                }catch(Exception failure){throw new AssertionError("Post-force QUERY original mutation prerequisite failed",failure);}
                                break;
                            }
                        return super.entrySet();
                    }
                });
                try{
                    var failure=assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(query));
                    armed.set(false);assertTrue("Actual terminal force Source must be reached",fired.get());assertEquals(2,lines.size());
                    assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                    assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("forceCommittedPreparedOriginal")));
                    assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));assertArrayEquals(changed,Files.readAllBytes(path));
                    var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                    assertThrows(VaultFailure.class,query::projection);assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                }finally{armed.set(false);source.unknown.put(namespace,map);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
            }
        }
        for(String filename:new String[]{"query_unknown-0.pending","query_observation-0.bin"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                var path=f.dir.resolve(filename);Files.copy(f.dir.resolve("write_unknown-0.bin"),path);
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var armed=new java.util.concurrent.atomic.AtomicBoolean(true);var lines=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get())for(var frame:Thread.currentThread().getStackTrace())
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("forceCommittedPreparedOriginal")){lines.add(frame.getLineNumber());break;}
                        return super.entrySet();
                    }
                });
                try{
                    var failure=assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(query));armed.set(false);
                    assertTrue("The fixed force boundary, not an observer probe, must refuse the prior outcome",
                        Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("forceCommittedPreparedOriginal")));
                    assertEquals("Refuse before the post-force Source callback",1,lines.size());
                    assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));assertTrue(Files.exists(path));coldSame(originals,inodes);
                }finally{armed.set(false);source.unknown.put(namespace,map);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    /** Actual first-fence owner, no network. The private COMMITTED force
     * preserves the original bytes/identity/time, then refuses a same-inode
     * change injected by the existing Source reader AFTER that force. */
    @Test public void COMMITTED_FORCE_sameOriginalSurvivesForceAndPostSourceMutationRefuses()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            for(boolean query:new boolean[]{false,true})try(var prepared=query?f.query(0):write){
                var before=prepared.projection();var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var file=f.dir.resolve(query?"query-0.bin":"write-0.bin");
                var attributes=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                try{
                    var fenced=f.engine.fenceOriginalPrivateCustodyExchange(prepared);NativePrivateCustodyExchangeTest.noAuthority(fenced);
                    for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256"})
                        assertEquals("Force cannot replace the original request",before.get(key),fenced.get(key));
                    assertTrue(fenced.getBoolean("dispatch_unknown_fence_observed"));coldSame(originals,inodes);stable.check();
                    var now=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(attributes.fileKey(),now.fileKey());assertEquals(attributes.size(),now.size());
                    assertEquals(attributes.lastModifiedTime(),now.lastModifiedTime());assertEquals(attributes.permissions(),now.permissions());
                    assertEquals(attributes.owner(),now.owner());assertEquals(attributes.group(),now.group());
                    assertTrue(Files.exists(f.dir.resolve(query?"query_unknown-0.bin":"write_unknown-0.bin")));
                    assertThrows("An original fence remains single-use",VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(prepared));
                    coldSame(originals,inodes);stable.check();
                }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        }
        for(String expectedGuard:new String[]{"forceCommittedPreparedOriginal","requireExistingPreparedOriginalCurrent"})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var prepared=f.write(0)){
            var source=f.x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var file=f.dir.resolve("write-0.bin");var attributes=Files.readAttributes(file,
                java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(file),changed=original.clone();changed[changed.length/2]^=1;
            var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
            var sourceLines=new java.util.HashSet<Integer>();String namespace="MemphisZooCustodialNativeVaultV1";
            var originalMap=source.unknown.get(namespace);
            source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                    if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                            &&frame.getMethodName().equals(expectedGuard)){
                            sourceLines.add(frame.getLineNumber());
                            if(sourceLines.size()==2&&fired.compareAndSet(false,true))try{
                                assertTrue(Thread.holdsLock(f.engine));
                                Files.write(file,changed);Files.setLastModifiedTime(file,attributes.lastModifiedTime());
                            }catch(Exception failure){throw new AssertionError("Post-force Source mutation prerequisite failed",failure);}
                            break;
                        }
                    return super.entrySet();
                }
            });
            try{
                var failure=assertThrows(VaultFailure.class,()->{
                    if(expectedGuard.equals("forceCommittedPreparedOriginal"))f.engine.fenceOriginalPrivateCustodyExchange(prepared);
                    else prepared.projection();
                });armed.set(false);
                assertTrue("Actual post-force Source callback must have changed the file",fired.get());assertEquals(2,sourceLines.size());
                assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                assertTrue("The fixed post-force exact-byte guard must reject",Arrays.stream(failure.getStackTrace())
                    .anyMatch(frame->frame.getMethodName().equals(expectedGuard)));
                assertArrayEquals(changed,Files.readAllBytes(file));
                var now=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(attributes.fileKey(),now.fileKey());assertEquals(attributes.lastModifiedTime(),now.lastModifiedTime());
                assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));stable.check();
                Files.write(file,original);Files.setLastModifiedTime(file,attributes.lastModifiedTime());
                assertThrows("Restored original DATA cannot revive the refused owner",VaultFailure.class,prepared::projection);
                assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(prepared));
                assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertArrayEquals(original,Files.readAllBytes(file));stable.check();
            }finally{armed.set(false);source.unknown.put(namespace,originalMap);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
        }
        firstAppendPostSourceBytesRefuse();
    }
    /** The first authenticated readback must not publish DATA changed during
     * its terminal Source callback, even on the original inode/mtime. */
    private static void firstAppendPostSourceBytesRefuse()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var source=f.x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var originals=coldOriginals(f);var inodes=coldInodes(originals);var file=f.dir.resolve("write-0.bin");
            var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
            var sourceLines=new java.util.HashSet<Integer>();String namespace="MemphisZooCustodialNativeVaultV1";
            var originalMap=source.unknown.get(namespace);final byte[][] saved={null},changed={null};
            final java.nio.file.attribute.PosixFileAttributes[] before={null};
            source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                    if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                            &&frame.getMethodName().equals("append")){
                            sourceLines.add(frame.getLineNumber());
                            if(sourceLines.size()==4&&fired.compareAndSet(false,true))try{
                                assertTrue(Thread.holdsLock(f.engine));
                                before[0]=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                saved[0]=Files.readAllBytes(file);assertTrue(saved[0].length>=64);changed[0]=saved[0].clone();changed[0][changed[0].length/2]^=1;
                                Files.write(file,changed[0]);Files.setLastModifiedTime(file,before[0].lastModifiedTime());
                            }catch(Exception failure){throw new AssertionError("Post-readback Source mutation prerequisite failed",failure);}
                            break;
                        }
                    return super.entrySet();
                }
            });
            try{
                var failure=assertThrows("Changed first original cannot escape as a prepared owner",VaultFailure.class,()->{
                    try(var unexpected=f.write(0)){fail("Changed original append returned an owner");}
                });armed.set(false);
                assertTrue("Actual terminal append Source callback must be reached",fired.get());assertEquals(4,sourceLines.size());
                assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                boolean append=false;Throwable cause=failure;
                for(int i=0;i<16&&cause!=null;i++,cause=cause.getCause())for(var frame:cause.getStackTrace())
                    if(frame.getMethodName().equals("append")&&frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal"))append=true;
                assertTrue("The actual journal publication must refuse",append);assertArrayEquals(changed[0],Files.readAllBytes(file));
                var now=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(before[0].fileKey(),now.fileKey());assertEquals(before[0].lastModifiedTime(),now.lastModifiedTime());
                assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));coldSame(originals,inodes);stable.check();
                // Restore only negative fixture DATA; no failed handle exists
                // to revive and no second preparation/send is attempted.
                Files.write(file,saved[0]);Files.setLastModifiedTime(file,before[0].lastModifiedTime());
                coldSame(originals,inodes);stable.check();
            }finally{
                armed.set(false);source.unknown.put(namespace,originalMap);
                if(saved[0]!=null)Arrays.fill(saved[0],(byte)0);if(changed[0]!=null)Arrays.fill(changed[0],(byte)0);
                for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
            }
        }
    }
    /** Fixed CURRENT QUERY/target journal guard, actual normal typed dispatch.
     * HOST file mutations are negative UNIT DATA, not Android/current-manager
     * authority. No reflective constructor, raw request or replacement send. */
    @Test public void CURRENT_ORIGINAL_fourFilesRejectMutationIdentityAndNegativeAba()throws Exception {
        for(String name:new String[]{"query-0.bin","write-0.bin","write_unknown-0.bin","query_unknown-0.bin"})
        for(boolean replaceIdentity:new boolean[]{false,true})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
                byte[] changed=null;
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                    for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,
                        java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    dispatch.requirePurpose(false);coldSame(originals,inodes);stable.check();
                    var file=f.dir.resolve(name);var before=attributes.get(file);
                    var preserved=f.x.f.root.resolve("unit-current-original-preserved");
                    var rejected=f.x.f.root.resolve("unit-current-original-rejected");
                    if(replaceIdentity){
                        // Preserve the actual original inode. The equal-byte
                        // substitute is only a negative unknown HOST file.
                        Files.move(file,preserved,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                        Files.copy(preserved,file);Files.setPosixFilePermissions(file,before.permissions());
                        Files.setLastModifiedTime(file,before.lastModifiedTime());
                    }else{
                        changed=originals.get(file).clone();changed[changed.length/2]^=1;
                        Files.write(file,changed);Files.setLastModifiedTime(file,before.lastModifiedTime());
                    }
                    var after=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    assertEquals(before.permissions(),after.permissions());assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());
                    if(replaceIdentity)assertNotEquals(before.fileKey(),after.fileKey());else assertEquals(before.fileKey(),after.fileKey());
                    var failure=assertThrows(VaultFailure.class,()->dispatch.requirePurpose(false));
                    assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                    assertTrue("Must reach the actual fixed four-original guard, not an unrelated prerequisite",
                        Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("requireCurrentQueryDispatchCurrent")));
                    byte[] refusedBytes=Files.readAllBytes(file);
                    try{assertArrayEquals(replaceIdentity?originals.get(file):changed,refusedBytes);}finally{Arrays.fill(refusedBytes,(byte)0);}
                    // Negative ABA observation only. Do not mint a fresh
                    // dispatch or use restored DATA as a successful baseline.
                    if(replaceIdentity){
                        Files.move(file,rejected,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                        Files.move(preserved,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                    }else{Files.write(file,originals.get(file));Files.setLastModifiedTime(file,before.lastModifiedTime());}
                    coldSame(originals,inodes);stable.check();
                    assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,()->dispatch.requirePurpose(false)).code);
                    assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,dispatch::takeCurrentQueryRequest).code);
                    coldSame(originals,inodes);stable.check();
                    for(var entry:attributes.entrySet()){
                        var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        var old=entry.getValue();assertEquals(old.fileKey(),now.fileKey());assertEquals(old.size(),now.size());
                        assertEquals(old.lastModifiedTime(),now.lastModifiedTime());assertEquals(old.permissions(),now.permissions());
                        assertEquals(old.owner(),now.owner());assertEquals(old.group(),now.group());
                    }
                    assertFalse(Files.exists(f.dir.resolve("query_observation-0.bin")));
                    assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                }finally{if(changed!=null)Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    /** Actual published full current-frame owner; synthetic HOST response
     * DATA only. Negative file arrangements cannot grant a fresh read, ACK,
     * replacement request, native admission or Android/runtime qualification. */
    @Test public void FRAME_ORIGINAL_fourFilesRejectMutationIdentityAndNegativeAba()throws Exception {
        for(String name:new String[]{"write-0.bin","write_unknown-0.bin","query-0.bin","query_unknown-0.bin"})
        for(boolean replaceIdentity:new boolean[]{false,true})
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var queries=new java.util.ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();
            var replies=new java.util.ArrayList<byte[]>();var connections=new java.util.ArrayList<Connection>();
            Map<java.nio.file.Path,byte[]> originals=null;byte[] changed=null;
            try{
                int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
                for(int i=0;i<count;i++)try(var write=f.write(i)){
                    var row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=f.query(i);queries.add(query);f.engine.fenceOriginalPrivateCustodyExchange(query);
                    replies.add(identityPieceReply(f,query,row,i));
                }
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
                var http=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,url.toString());
                    assertFalse(Thread.holdsLock(f.engine));int i=connections.size();assertTrue(i<count);
                    var connection=new Connection(url){@Override public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}};
                    connection.response=replies.get(i);connections.add(connection);return connection;
                },f.clock);
                try(var control=new NativePrivateCustodyFrameReadControl();
                    var read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control)){
                    var first=read.projection();coldNoAuthority(first);assertEquals(count,first.getInt("current_transport_piece_count"));
                    assertEquals(first.toString(),read.projection().toString());assertEquals(count,connections.size());
                    for(var connection:connections)assertEquals(1,connection.disconnects);
                    originals=coldOriginals(f);var inodes=coldInodes(originals);stable.check();
                    var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
                    for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,
                        java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    var file=f.dir.resolve(name);var before=attributes.get(file);
                    var preserved=f.x.f.root.resolve("unit-frame-original-preserved");var rejected=f.x.f.root.resolve("unit-frame-original-rejected");
                    if(replaceIdentity){
                        Files.move(file,preserved,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                        Files.copy(preserved,file);Files.setPosixFilePermissions(file,before.permissions());
                        Files.setLastModifiedTime(file,before.lastModifiedTime());
                    }else{
                        changed=originals.get(file).clone();changed[changed.length/2]^=1;
                        Files.write(file,changed);Files.setLastModifiedTime(file,before.lastModifiedTime());
                    }
                    var after=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    assertEquals(before.permissions(),after.permissions());assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());
                    if(replaceIdentity)assertNotEquals(before.fileKey(),after.fileKey());else assertEquals(before.fileKey(),after.fileKey());
                    var failure=assertThrows(VaultFailure.class,read::projection);assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                    assertTrue("Must reach the actual published-frame original guard",
                        Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("sealedCurrentFrameCryptoProjection")));
                    byte[] refusedBytes=Files.readAllBytes(file);
                    try{assertArrayEquals(replaceIdentity?originals.get(file):changed,refusedBytes);}finally{Arrays.fill(refusedBytes,(byte)0);}
                    // Negative ABA only: preserve both original and unknown
                    // substitute inodes; never create a successor read/claim.
                    if(replaceIdentity){
                        Files.move(file,rejected,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                        Files.move(preserved,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                    }else{Files.write(file,originals.get(file));Files.setLastModifiedTime(file,before.lastModifiedTime());}
                    coldSame(originals,inodes);stable.check();
                    assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,read::projection).code);
                    assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,read::takeCompletionSemantics).code);
                    assertEquals(count,connections.size());coldSame(originals,inodes);stable.check();
                    for(var entry:attributes.entrySet()){
                        var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        var old=entry.getValue();assertEquals(old.fileKey(),now.fileKey());assertEquals(old.size(),now.size());
                        assertEquals(old.lastModifiedTime(),now.lastModifiedTime());assertEquals(old.permissions(),now.permissions());
                        assertEquals(old.owner(),now.owner());assertEquals(old.group(),now.group());
                    }
                    assertFalse(Files.exists(f.dir.resolve("query_observation-0.bin")));
                    assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                }
            }finally{
                if(changed!=null)Arrays.fill(changed,(byte)0);if(originals!=null)for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                for(var query:queries)query.close();for(var reply:replies)Arrays.fill(reply,(byte)0);
            }
        }
    }
    /** Existing complete owning route, stopped only after its real prepared
     * owner is constructed and sealed. Mutations are negative HOST DATA, not
     * a replacement request, synthetic capability or manager/Android proof. */
    @Test public void SEALED_RECOVERY_originalsRejectMutationIdentityAndNegativeAba()throws Exception {
        for(String name:new String[]{"write-0.bin","write_unknown-0.bin","query-0.bin","query_unknown-0.bin",
            "recovery_intent-0.bin","recovery_request-0.bin"})
        for(boolean replaceIdentity:new boolean[]{false,true})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,(f,prepared,control)->{
            var positive=prepared.projection();owningRecoveryNoEffects(positive);
            assertTrue(positive.getBoolean("original_request_committed_observed"));assertFalse(positive.getBoolean("unknown_fence_observed"));
            var originals=coldOriginals(f);var inodes=coldInodes(originals);byte[] changed=null;
            var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
            try{
                for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,
                    java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var file=f.dir.resolve(name);var before=attributes.get(file);assertNotNull(before);
                var preserved=f.x.f.root.resolve("unit-sealed-original-preserved");
                var rejected=f.x.f.root.resolve("unit-sealed-original-rejected");
                if(replaceIdentity){
                    Files.move(file,preserved,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                    Files.copy(preserved,file);Files.setPosixFilePermissions(file,before.permissions());
                    Files.setLastModifiedTime(file,before.lastModifiedTime());
                }else{
                    changed=originals.get(file).clone();changed[changed.length/2]^=1;
                    Files.write(file,changed);Files.setLastModifiedTime(file,before.lastModifiedTime());
                }
                var after=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                if(replaceIdentity)assertNotEquals(before.fileKey(),after.fileKey());else assertEquals(before.fileKey(),after.fileKey());
                var failure=assertThrows(VaultFailure.class,prepared::projection);assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                assertTrue("Must reach the actual sealed prepared/read guard, not an unrelated prerequisite",
                    Arrays.stream(failure.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent")));
                byte[] refused=Files.readAllBytes(file);
                try{assertArrayEquals(replaceIdentity?originals.get(file):changed,refused);}finally{Arrays.fill(refused,(byte)0);}
                // Negative ABA only. Preserve the original and substituted
                // inode; restored DATA must not revive this SAME prepared.
                if(replaceIdentity){
                    Files.move(file,rejected,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                    Files.move(preserved,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                }else{Files.write(file,originals.get(file));Files.setLastModifiedTime(file,before.lastModifiedTime());}
                coldSame(originals,inodes);control.check();
                assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,prepared::projection).code);
                coldSame(originals,inodes);
                for(var entry:attributes.entrySet()){
                    var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    var old=entry.getValue();assertEquals(old.fileKey(),now.fileKey());assertEquals(old.size(),now.size());
                    assertEquals(old.lastModifiedTime(),now.lastModifiedTime());assertEquals(old.owner(),now.owner());
                    assertEquals(old.group(),now.group());assertEquals(old.permissions(),now.permissions());
                }
                assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("recovery_observation-0.bin")));
                // The helper's existing finally verifies native rows, keys,
                // all known original files/root attrs and closes actual owners.
            }finally{if(changed!=null)Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        });
    }
    /** Newly affected intent owner only, using the SAME normal owning chain
     * before any challenge request. No private reflection or seeded record. */
    @Test public void RECOVERY_INTENT_currentOwnerRefusesChangedOriginalWithoutResend()throws Exception {
        for(String name:new String[]{"recovery_intent-0.bin","query_unknown-0.bin"})
        for(boolean replaceIdentity:new boolean[]{false,true})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public boolean intentOnly(){return true;}
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Intent-only case reached request preparation");
            }
            @Override public void checkIntent(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyFrameReadControl control)throws Exception{
                var first=intent.projection();assertTrue(first.getBoolean("original_local_intent_committed_observed"));
                assertFalse(first.getBoolean("network_dispatch_allowed"));assertFalse(first.getBoolean("manager_approval"));owningRecoveryNoEffects(first);
                var originals=coldOriginals(f);var inodes=coldInodes(originals);byte[] changed=null;
                var file=f.dir.resolve(name);var before=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                var preserved=f.x.f.root.resolve("unit-intent-original-preserved");var rejected=f.x.f.root.resolve("unit-intent-original-rejected");
                try{
                    assertFalse(Files.exists(f.dir.resolve("recovery_request-0.bin")));assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                    if(replaceIdentity){Files.move(file,preserved,java.nio.file.StandardCopyOption.ATOMIC_MOVE);Files.copy(preserved,file);Files.setPosixFilePermissions(file,before.permissions());}
                    else{changed=originals.get(file).clone();changed[changed.length/2]^=1;Files.write(file,changed);}
                    Files.setLastModifiedTime(file,before.lastModifiedTime());
                    var after=Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    if(replaceIdentity)assertNotEquals(before.fileKey(),after.fileKey());else assertEquals(before.fileKey(),after.fileKey());
                    var failure=assertThrows(VaultFailure.class,intent::projection);control.check();
                    assertTrue("Actual intent owner must refuse",Arrays.stream(failure.getStackTrace()).anyMatch(frame->
                        frame.getClassName().equals(VaultEngine.class.getName()+"$NativeSameOriginalRecoveryPreparationIntent")&&frame.getMethodName().equals("requireCurrent")));
                    if(replaceIdentity){Files.move(file,rejected,java.nio.file.StandardCopyOption.ATOMIC_MOVE);Files.move(preserved,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE);}
                    else{Files.write(file,originals.get(file));Files.setLastModifiedTime(file,before.lastModifiedTime());}
                    coldSame(originals,inodes);control.check();
                    assertThrows("Restored bytes cannot revive this refused owner",VaultFailure.class,intent::projection);
                    assertThrows("No request/nonce/time/signature after refusal",VaultFailure.class,intent::takeOriginalChallengeRequest);
                    assertFalse(Files.exists(f.dir.resolve("recovery_request-0.bin")));assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                    coldSame(originals,inodes);
                }finally{if(changed!=null)Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        });
    }
    @Test public void BROWSER_PRELOAD_privateTransferUsesExistingConstructorAndTerminalGuards()throws Exception {browserDataPreload(0);}
    @Test public void BROWSER_PRELOAD_constructorSourceChunkMutationCannotEscapeAsBrowserData()throws Exception {browserDataPreload(1);}
    @Test public void BROWSER_PRELOAD_constructorSourceFrameMutationCannotEscapeAsBrowserData()throws Exception {browserDataPreload(2);}
    @Test public void BROWSER_PRELOAD_constructorSourceQueryMutationRefuses()throws Exception {browserDataPreload(3);}
    @Test public void BROWSER_PRELOAD_constructorSourceExpiryRefuses()throws Exception {browserDataPreload(4);}
    /** Actual current-reader factory and normal existing request producers.
     * The seeded AEAD browser bytes are DATA, never browser/ACK authority. */
    private static void browserDataPreload(int fault)throws Exception {
        owningControlledRecoveryReads(true,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest p,NativePrivateCustodyFrameReadControl c){
                throw new AssertionError("Existing original route required");
            }
            @Override public boolean existingRequestOnly(){return true;}
            @Override public boolean existingRequestAfterChallenge(){return true;}
            @Override public boolean usesSavedBrowserPublication(){return true;}
            @Override public boolean existingBrowserPublicationCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyHttp http,
                NativePrivateCustodyFrameReadControl control)throws Exception {
                try(var p=intent.takeOriginalChallengeRequest()){
                    seedEmptySavedBrowserData(f,(VaultEngine.NativePrivateCustodyCurrentFrameRead)
                        NativePrivateCustodyExchangeTest.field(p,"originalRead"));
                }
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var path=f.dir.resolve(fault==2?"browser_frame-0.bin":fault==3?"query_unknown-0.bin":"browser_chunk-0.bin");
                byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                var attrs=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class);long clock=f.clock.now;
                var constructorSeen=new java.util.concurrent.atomic.AtomicBoolean();
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var postConstructorLocalSource=new java.util.concurrent.atomic.AtomicInteger();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        var stack=Thread.currentThread().getStackTrace();
                        boolean factory=Arrays.stream(stack).anyMatch(s->s.getClassName().equals(VaultEngine.class.getName())
                            &&s.getMethodName().equals("readCurrentOriginalPrivateCustodyFrameForBrowserPreparation"));
                        boolean constructor=factory&&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(
                            VaultEngine.class.getName()+"$NativePrivateCustodyCurrentFrameRead")&&s.getMethodName().equals("<init>"));
                        if(constructor)constructorSeen.set(true);
                        if(factory&&!constructor&&constructorSeen.get()&&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(
                            VaultEngine.class.getName()+"$NativeOriginalBrowserLocalData")&&s.getMethodName().equals("requireCurrent")))
                            postConstructorLocalSource.incrementAndGet();
                        if(fault!=0&&constructor&&fired.compareAndSet(false,true))try{
                            if(fault==4)f.clock.now=clock+120_001L;
                            else{Files.write(path,changed);Files.setLastModifiedTime(path,attrs.lastModifiedTime());}
                        }catch(Exception failure){throw new AssertionError("Actual current constructor Source prerequisite",failure);}
                        return super.entrySet();
                    }
                });
                try{
                    if(fault>=3){
                        assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalPrivateCustodyFrameForBrowserPreparation(f.plan,f.journal,http,control));
                    }else try(var current=f.engine.readCurrentOriginalPrivateCustodyFrameForBrowserPreparation(f.plan,f.journal,http,control)){
                        assertTrue(constructorSeen.get());assertEquals("Private preload transfer cannot repeat arbitrary Source callbacks",0,postConstructorLocalSource.get());
                        assertNotNull(NativePrivateCustodyExchangeTest.field(current,"preloadedBrowserLocalData"));
                        if(fault==0){
                            try(var target=current.takeOriginalRecoveryTarget(http);var next=target.takeExistingOriginalPreparationIntent();
                                var prepared=next.takeOriginalChallengeRequest()){
                                var result=f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,null);
                                assertEquals("CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY",result.getString("state"));
                                owningRecoveryNoEffects(result);assertFalse(result.getBoolean("current_browser_source_authenticated"));
                                assertNull(NativePrivateCustodyExchangeTest.field(current,"preloadedBrowserLocalData"));
                            }
                        }else assertThrows("Private preload DATA cannot bypass outward browser authentication",VaultFailure.class,current::observeSavedOriginalBrowserValues);
                    }
                    if(fault!=0)assertTrue(fired.get());assertTrue(constructorSeen.get());
                    source.unknown.put(namespace,map);f.clock.now=clock;Files.write(path,original);Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                    coldSame(originals,inodes);control.check();
                    System.out.println("ACTUAL_SAVED_DATA_PRELOAD_AND_TERMINAL_GUARDS_NOT_BROWSER_ACK_OR_LIVE_SQL");return true;
                }finally{
                    source.unknown.put(namespace,map);f.clock.now=clock;Files.write(path,original);Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                    Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                }
            }
        });
    }
    @Test public void LOCAL_BROWSER_DATA_factoryReadsActualCiphertextWithCallbackFreeChunkLookup()throws Exception {localBrowserDataFactory(0);}
    @Test public void LOCAL_BROWSER_DATA_lastLockedSourceCiphertextMutationCannotPublish()throws Exception {localBrowserDataFactory(1);}
    @Test public void LOCAL_BROWSER_DATA_lastLockedSourceCancellationCannotPublish()throws Exception {localBrowserDataFactory(2);}
    private static void localBrowserDataFactory(int fault)throws Exception {
        owningControlledRecoveryReads(true,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control)throws Exception {
                var read=(VaultEngine.NativePrivateCustodyCurrentFrameRead)NativePrivateCustodyExchangeTest.field(prepared,"originalRead");
                var plan=(VaultEngine.NativePrivateCustodyChunkIdentityPlan)NativePrivateCustodyExchangeTest.field(read,"plan");
                var journal=(VaultEngine.NativePrivateCustodyExchangeJournal)NativePrivateCustodyExchangeTest.field(read,"journal");
                seedEmptySavedBrowserData(f,read);
                var originals=coldOriginals(f);var inodes=coldInodes(originals);
                var path=f.dir.resolve("browser_chunk-0.bin");byte[] original=Files.readAllBytes(path),changed=original.clone();
                changed[changed.length/2]^=1;var attrs=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class);
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var callbacks=new java.util.concurrent.atomic.AtomicInteger();var lookupCallbacks=new java.util.concurrent.atomic.AtomicInteger();
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        callbacks.incrementAndGet();var stack=Thread.currentThread().getStackTrace();
                        if(Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("readBrowserDocumentForLocalData")))lookupCallbacks.incrementAndGet();
                        if(fault!=0&&!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(
                            VaultEngine.class.getName()+"$NativeOriginalBrowserLocalData")&&s.getMethodName().equals("requireCurrent")))
                            for(int i=0;i+1<stack.length;i++)
                                if(stack[i].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyChunkIdentityPlan")
                                    &&stack[i].getMethodName().equals("requireCurrent")
                                    &&stack[i+1].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&stack[i+1].getMethodName().equals("originalBrowserPartSet")){
                                    sites.add(stack[i+1].getLineNumber());
                                    if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                        try(var probe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),java.nio.file.StandardOpenOption.WRITE)){
                                            assertThrows(java.nio.channels.OverlappingFileLockException.class,probe::tryLock);
                                        }
                                        if(fault==2)control.cancel();
                                        else{Files.write(path,changed);Files.setLastModifiedTime(path,attrs.lastModifiedTime());}
                                    }catch(Exception failure){throw new AssertionError("Actual local-data final locked Source prerequisite",failure);}
                                    break;
                                }
                        return super.entrySet();
                    }
                });
                try{
                    if(fault==0)try(var local=f.engine.readSavedOriginalBrowserLocalData(plan,journal,control)){
                        assertNotNull(local);assertEquals(false,NativePrivateCustodyExchangeTest.field(local,"closed"));
                        assertNotNull(NativePrivateCustodyExchangeTest.field(local,"records"));
                        assertEquals(1,((java.util.List<?>)NativePrivateCustodyExchangeTest.field(local,"nativeArgumentSha256")).size());
                    }else{
                        assertThrows("Last Source change cannot publish local browser DATA",VaultFailure.class,
                            ()->f.engine.readSavedOriginalBrowserLocalData(plan,journal,control));
                        assertTrue(fired.get());assertEquals(2,sites.size());
                    }
                    assertTrue(callbacks.get()>0);assertEquals(0,lookupCallbacks.get());
                    source.unknown.put(namespace,map);Files.write(path,original);Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                    coldSame(originals,inodes);
                    System.out.println("ACTUAL_LOCAL_AEAD_DATA_FACTORY_NOT_BROWSER_MANAGER_SQL_ACK_AUTHORITY");
                }finally{
                    source.unknown.put(namespace,map);Files.write(path,original);Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                    Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                }
            }
        });
    }
    @Test public void BROWSER_SET_initialPublicationUsesActualSavedDataAndZeroConstructorSource()throws Exception {browserDispositionPublication(0);}
    @Test public void BROWSER_SET_lastSourceQueryUnknownMutationCannotPublishOrRevive()throws Exception {browserDispositionPublication(1);}
    @Test public void BROWSER_SET_lastSourceQueryExpiryCannotPublishOrRevive()throws Exception {browserDispositionPublication(2);}
    @Test public void BROWSER_SET_lastSourceBrowserChunkMutationCannotPublishOrRevive()throws Exception {browserDispositionPublication(3);}
    @Test public void BROWSER_SET_lastSourceBrowserFrameMutationCannotPublishOrRevive()throws Exception {browserDispositionPublication(4);}
    @Test public void BROWSER_DATA_privateAdoptionLastSourceChunkMutationRefuses()throws Exception {browserDispositionPublication(5);}
    @Test public void BROWSER_DATA_privateAdoptionLastSourceFrameMutationRefuses()throws Exception {browserDispositionPublication(6);}
    @Test public void BROWSER_DATA_privateAdoptionLastSourceQueryMutationRefuses()throws Exception {browserDispositionPublication(7);}
    @Test public void BROWSER_DATA_privateAdoptionLastSourceExpiryRefuses()throws Exception {browserDispositionPublication(8);}
    /** Valid binary/AEAD local DATA, not an injected browser Source. The
     * actual existing-owner Engine route must construct its own disposition
     * set; no private capability constructor or synthetic owner is reflected. */
    static void seedEmptySavedBrowserData(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        VaultEngine.NativePrivateCustodyCurrentFrameRead read)throws Exception {
        String observation="[\"custodial.browser-protected-observation.v1\",{\"local\":[],\"session\":null,\"databases\":[]}]";
        String observationSha=NativeRetainedAttempt.hash(observation.getBytes(StandardCharsets.UTF_16BE));
        byte[] frame=java.nio.ByteBuffer.allocate(72).put("MZBRV001".getBytes(StandardCharsets.US_ASCII))
            .put(java.util.HexFormat.of().parseHex(observationSha)).putInt(0).putInt(-1).putInt(0).putInt(0)
            .put((byte)5).putInt(3).put((byte)5).putInt(0).put((byte)0).put((byte)5).putInt(0).array();
        try{
            String sha=NativeRetainedAttempt.hash(frame);
            var metadata=new JSONObject().put("schema","custodial.browser-original-value-frame.v1").put("encoding","MZBRV001")
                .put("observation_sha256",observationSha).put("frame_sha256",sha).put("byte_count",frame.length)
                .put("chunk_bytes",1048576).put("chunk_count",1).put("record_count",0).put("session_storage_state","NOT_DECLARED_UNKNOWN")
                .put("chunk_sha256",new org.json.JSONArray().put(sha)).put("native_authority",false).put("durable_retention",false)
                .put("inventory_acknowledged",false).put("finalizer_allowed",false).put("key_removal",false);
            assertEquals(0,NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,java.util.List.of(frame),java.util.List.of()).recordCount);
            synchronized(f.engine){
                var frameDocument=(JSONObject)actualBrowserDocumentMethod(read,false,"BROWSER_FRAME",0,metadata,null);
                var chunkDocument=(JSONObject)actualBrowserDocumentMethod(read,false,"BROWSER_CHUNK",0,metadata,frame);
                actualBrowserDocumentMethod(read,true,"BROWSER_FRAME",0,frameDocument,null);
                actualBrowserDocumentMethod(read,true,"BROWSER_CHUNK",0,chunkDocument,null);
                var journal=NativePrivateCustodyExchangeTest.field(read,"journal");
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var callbacks=new java.util.concurrent.atomic.AtomicInteger();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){callbacks.incrementAndGet();return super.entrySet();}
                });
                try{
                    var data=journal.getClass().getDeclaredMethod("originalBrowserPartSetDataForPublication",
                        VaultEngine.NativePrivateCustodyCurrentFrameRead.class,JSONObject.class);data.setAccessible(true);
                    Object digest=data.invoke(journal,read,metadata);
                    assertTrue(digest instanceof String);assertEquals(64,((String)digest).length());
                    assertEquals("Private part-set identity DATA cannot borrow a Source verdict",0,callbacks.get());
                }finally{source.unknown.put(namespace,map);}
            }
        }finally{Arrays.fill(frame,(byte)0);}
    }
    private static void browserDispositionPublication(int fault)throws Exception {
        owningControlledRecoveryReads(true,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Expected actual existing-request route, never a newly fabricated owner");
            }
            @Override public boolean existingRequestOnly(){return true;}
            @Override public boolean existingRequestAfterChallenge(){return true;}
            @Override public boolean usesSavedBrowserPublication(){return true;}
            @Override public boolean existingBrowserPublicationCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyHttp http,
                NativePrivateCustodyFrameReadControl control)throws Exception {
                try(var prepared=intent.takeOriginalChallengeRequest()){
                    var read=(VaultEngine.NativePrivateCustodyCurrentFrameRead)NativePrivateCustodyExchangeTest.field(prepared,"originalRead");
                    seedEmptySavedBrowserData(f,read);
                    var originals=coldOriginals(f);var inodes=coldInodes(originals);
                    var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                    var path=f.dir.resolve(fault==3||fault==5?"browser_chunk-0.bin":fault==4||fault==6?"browser_frame-0.bin":"query_unknown-0.bin");
                    byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                    var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    long clock=f.clock.now;var constructorCallbacks=new java.util.concurrent.atomic.AtomicInteger();
                    var publicationSeen=new java.util.concurrent.atomic.AtomicBoolean();var fired=new java.util.concurrent.atomic.AtomicBoolean();
                    var adoptionSeen=new java.util.concurrent.atomic.AtomicBoolean();
                    var sites=new java.util.HashSet<Integer>();
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            var stack=Thread.currentThread().getStackTrace();String set=VaultEngine.class.getName()+"$NativeOriginalBrowserDispositionSet";
                            if(Arrays.stream(stack).anyMatch(s->s.getClassName().equals(set)&&s.getMethodName().equals("<init>")))constructorCallbacks.incrementAndGet();
                            boolean publication=Arrays.stream(stack).anyMatch(s->s.getClassName().equals(set)&&s.getMethodName().equals("requireCurrentForInitialPublication"));
                            boolean adoption=fault>=5&&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("prepareOriginalBrowserData"))
                                &&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("requireCurrentForPrivateDataReturn"));
                            if(publication)publicationSeen.set(true);
                            if(adoption)adoptionSeen.set(true);
                            if(fault>=5?adoption:publication){
                                if(fault!=0&&!fired.get())for(int i=0;i+1<stack.length;i++)
                                    if(stack[i].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyChunkIdentityPlan")&&stack[i].getMethodName().equals("requireCurrent")
                                        &&stack[i+1].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                        &&stack[i+1].getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                        sites.add(stack[i+1].getLineNumber());
                                        if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                            try(var probe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),java.nio.file.StandardOpenOption.WRITE)){
                                                assertThrows(java.nio.channels.OverlappingFileLockException.class,probe::tryLock);
                                            }
                                            if(fault==2||fault==8)f.clock.now=clock+120_001L;
                                            else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                        }catch(Exception failure){throw new AssertionError("Actual browser initial-publication last locked Source prerequisite",failure);}
                                        break;
                                    }
                            }
                            return super.entrySet();
                        }
                    });
                    try{
                        if(fault==0){
                            var result=f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,null);
                            assertEquals("CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY",result.getString("state"));
                            owningRecoveryNoEffects(result);assertFalse(result.getBoolean("current_browser_source_authenticated"));
                            assertEquals(1,result.getJSONObject("current_original_completion_read_observation").getInt("selected_argument_count"));
                        }else{
                            assertThrows("Late Source mutation/expiry cannot publish actual browser disposition DATA",VaultFailure.class,
                                ()->f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,null));
                            assertTrue(fired.get());assertEquals(2,sites.size());
                            source.unknown.put(namespace,map);f.clock.now=clock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restoring original bytes/time cannot revive refused preparation",VaultFailure.class,prepared::projection);
                        }
                        if(fault>=5){assertTrue(adoptionSeen.get());assertFalse(publicationSeen.get());}
                        else assertTrue(publicationSeen.get());
                        assertEquals(0,constructorCallbacks.get());coldSame(originals,inodes);control.check();
                        System.out.println("SYNTHETIC_SAVED_BROWSER_DATA_INITIAL_PUBLICATION_NOT_LIVE_BROWSER_SQL_ACK");return true;
                    }finally{
                        source.unknown.put(namespace,map);f.clock.now=clock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                    }
                }
            }
        });
    }
    static void withActualOriginalNativeRecoveryForFinalization(SealedRecoveryCheck check)throws Exception {
        owningControlledRecoveryReads(true,CompletionFailure.NONE,check);
    }
    interface SealedRecoveryCheck {
        void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control)throws Exception;
        default boolean currentFrameCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws Exception{return false;}
        default boolean firstPairCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativeSameOriginalRecoveryTargetObservation target,NativePrivateCustodyFrameReadControl control)throws Exception{return false;}
        default boolean targetCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativePrivateCustodyCurrentFrameRead read,NativePrivateCustodyHttp http,
            NativePrivateCustodyFrameReadControl control)throws Exception{return false;}
        default boolean intentOnly(){return false;}
        default boolean existingRequestOnly(){return false;}
        default boolean existingRequestAfterChallenge(){return false;}
        default boolean usesSavedBrowserPublication(){return false;}
        default boolean existingBrowserPublicationCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyHttp http,
            NativePrivateCustodyFrameReadControl control)throws Exception{return false;}
        default void checkExistingRequest(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,JSONObject first,
            NativePrivateCustodyFrameReadControl control)throws Exception{throw new AssertionError("No existing request case selected");}
        default void checkIntent(NativePrivateCustodyExchangeTest.GuardedIdentityFixture fixture,
            VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyFrameReadControl control)throws Exception{
            throw new AssertionError("No intent-only case selected");
        }
    }
    @Test public void EXISTING_RECOVERY_REQUEST_exactPairRestoresWithoutFirstSendAuthority()throws Exception {
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest p,NativePrivateCustodyFrameReadControl c){throw new AssertionError("Existing-only branch required");}
            @Override public boolean existingRequestOnly(){return true;}
            @Override public void checkExistingRequest(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,JSONObject first,NativePrivateCustodyFrameReadControl control)throws Exception {
                var originals=coldOriginals(f);var inodes=coldInodes(originals);var opens=new java.util.concurrent.atomic.AtomicInteger();
                try{
                    try(var restored=intent.takeOriginalChallengeRequest()){
                        var observed=restored.projection();owningRecoveryNoEffects(observed);
                        for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256"})
                            assertEquals("Restore keeps the exact original request",first.get(key),observed.get(key));
                        coldSame(originals,inodes);
                        var blocked=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("Restored request gained first-send authority");},f.clock);
                        assertThrows(VaultFailure.class,()->f.engine.sendOriginalRecoveryChallenge(restored,blocked,control));
                        assertEquals(0,opens.get());assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                        coldSame(originals,inodes);control.check();
                    }
                    assertThrows(VaultFailure.class,intent::takeOriginalChallengeRequest);
                    coldSame(originals,inodes);
                }finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        },true);
    }
    @Test public void BROWSER_ENTRY_changedOriginalRefusesBeforeManagerHTTP()throws Exception {
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest p,NativePrivateCustodyFrameReadControl c){throw new AssertionError("Existing-only branch required");}
            @Override public boolean existingRequestOnly(){return true;}
            @Override public boolean existingRequestAfterChallenge(){return true;}
            @Override public void checkExistingRequest(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,JSONObject first,NativePrivateCustodyFrameReadControl control)throws Exception {
                try(var restored=intent.takeOriginalChallengeRequest()){
                    var originals=coldOriginals(f);var inodes=coldInodes(originals);var file=f.dir.resolve("write_unknown-0.bin");
                    var before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    byte[] original=Files.readAllBytes(file),changed=original.clone();changed[changed.length/2]^=1;
                    var opened=new java.util.concurrent.atomic.AtomicInteger();
                    var blocked=new NativePrivateCustodyHttp(url->{opened.incrementAndGet();throw new AssertionError("Changed original reached manager HTTP");},f.clock);
                    try{
                        Files.write(file,changed);Files.setLastModifiedTime(file,before.lastModifiedTime());
                        var failure=assertThrows(VaultFailure.class,()->f.engine.preserveOriginalBrowserUnderCurrentManager(restored,blocked,control,null));
                        assertTrue("The actual complete original guard must refuse, not an absent UNKNOWN prerequisite",
                            Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getMethodName().equals("requireSealedRecoveryPreparedCurrent")));
                        assertEquals(0,opened.get());assertArrayEquals(changed,Files.readAllBytes(file));
                        assertEquals(before.fileKey(),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                        Files.write(file,original);Files.setLastModifiedTime(file,before.lastModifiedTime());
                        assertThrows("Restored bytes cannot revive this refused owner",VaultFailure.class,restored::projection);
                        assertThrows(VaultFailure.class,()->f.engine.preserveOriginalBrowserUnderCurrentManager(restored,blocked,control,null));
                        assertEquals(0,opened.get());assertFalse(Files.exists(f.dir.resolve("browser_frame-0.bin")));
                        assertTrue(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));coldSame(originals,inodes);
                    }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
                }
            }
        },true);
    }
    @Test public void EXISTING_RECOVERY_REQUEST_lastSourceMutationRefusesAndCannotRevive()throws Exception {
        for(String filename:new String[]{"recovery_request-0.bin","recovery_intent-0.bin","write-0.bin","write_unknown-0.bin","query-0.bin","query_unknown-0.bin"})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest p,NativePrivateCustodyFrameReadControl c){throw new AssertionError("Existing-only branch required");}
            @Override public boolean existingRequestOnly(){return true;}
            @Override public void checkExistingRequest(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,JSONObject first,NativePrivateCustodyFrameReadControl control)throws Exception {
                var originals=coldOriginals(f);var inodes=coldInodes(originals);var path=f.dir.resolve(filename);
                var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);var sites=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get()&&!fired.get()){
                            var stack=Thread.currentThread().getStackTrace();
                            boolean restoration=Arrays.stream(stack).anyMatch(frame->frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("restoreExistingCommittedRecoveryRequest"));
                            if(restoration)for(var frame:stack)
                                if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&frame.getMethodName().equals("sealedCurrentFrameCryptoProjection")){
                                    sites.add(frame.getLineNumber());
                                    if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                        Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                    }catch(Exception failure){throw new AssertionError("Existing-request terminal Source mutation prerequisite failed",failure);}
                                    break;
                                }
                        }
                        return super.entrySet();
                    }
                });
                try{
                    assertThrows(VaultFailure.class,()->{try(var unexpected=intent.takeOriginalChallengeRequest()){fail("Changed original returned a prepared request");}});
                    armed.set(false);assertTrue("The actual restoration terminal Source must be reached",fired.get());assertEquals(2,sites.size());
                    assertArrayEquals(changed,Files.readAllBytes(path));
                    assertEquals(before.fileKey(),Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                    Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                    assertThrows("Restoring bytes cannot revive the consumed/refused intent",VaultFailure.class,intent::takeOriginalChallengeRequest);
                    assertThrows(VaultFailure.class,intent::projection);coldSame(originals,inodes);
                    assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                }finally{armed.set(false);source.unknown.put(namespace,originalMap);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            }
        },true);
    }
    private enum CompletionFailure { NONE, LOST_REPLY, SOURCE_WITHDRAWAL, RESPONSE_PUBLICATION_CANCELED, EXISTING_OBSERVATION_CHANGED_SOURCE, STATUS_SOURCE_CANCELED, STATUS_TAKE_SOURCE, STATUS_TAKE_CLOCK, MANAGER_UNKNOWN_CHANGED, MANAGER_SUMMARY_CHANGED_SOURCE, MANAGER_SUMMARY_EXPIRED_QUERY, PREPARED_NATIVE_DATA_NORMAL, PREPARED_NATIVE_DATA_SOURCE, PREPARED_NATIVE_DATA_CLOCK, PRE_CAPTURE_DATA_NORMAL, PRE_CAPTURE_DATA_SOURCE, PRE_CAPTURE_DATA_CLOCK, PRE_CAPTURE_DATA_ORPHAN, CURRENT_READ_SOURCE, CURRENT_READ_CLOCK, COMPLETION_SET_TERMINAL_SOURCE, COMPLETION_COPY_TERMINAL_SOURCE, COMPLETION_BIRTH_QUERY_CHANGED_SOURCE, COMPLETION_BIRTH_QUERY_UNKNOWN_CHANGED_SOURCE, BROWSER_ABSENCE_LAST_SOURCE_ORPHAN, COMPLETION_SET_TERMINAL_CLOCK, COMPLETION_COPY_TERMINAL_CLOCK }
    @Test public void STATUS_TAKE_changedOriginalAtBirthRefusesBeforeManagerHTTP()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.STATUS_TAKE_SOURCE);
    }
    @Test public void STATUS_TAKE_queryExpiryAtBirthRefusesBeforeManagerHTTP()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.STATUS_TAKE_CLOCK);
    }
    /** Existing actual private DATA-copy method only. This never invokes an
     * owner/capability constructor or fabricates authority. All originals and
     * the published typed set come from the normal owning workflow below. */
    @SuppressWarnings("unchecked")
    private static java.util.List<byte[]> copyActualOriginalArgumentData(Object actualSet)throws Exception{
        var method=actualSet.getClass().getDeclaredMethod("copyCompleteOriginalArguments");method.setAccessible(true);
        try{return(java.util.List<byte[]>)method.invoke(actualSet);}
        catch(java.lang.reflect.InvocationTargetException failure){
            Throwable cause=failure.getCause();if(cause instanceof Error)throw(Error)cause;
            if(cause instanceof Exception)throw(Exception)cause;throw new AssertionError(cause);
        }
    }
    /** Invoke only the actual private DATA calculation with the prepared
     * owner produced by normal WORK/current/manager/completion calls. This
     * creates no owner, browser exchange, capability or authority flag. */
    private static JSONObject inspectActualPreparedNativeCompletionData(Object actualPrepared,java.util.List<byte[]> arguments)throws Exception{
        var read=NativePrivateCustodyExchangeTest.field(actualPrepared,"originalRead");
        var method=read.getClass().getDeclaredMethod("inspectPreparedNativeCompletionData",actualPrepared.getClass(),java.util.List.class);
        method.setAccessible(true);
        try{return(JSONObject)method.invoke(read,actualPrepared,arguments);}
        catch(java.lang.reflect.InvocationTargetException failure){
            Throwable cause=failure.getCause();if(cause instanceof Error)throw(Error)cause;
            if(cause instanceof Exception)throw(Exception)cause;throw new AssertionError(cause);
        }
    }
    private static Object prepareActualOriginalBrowserData(Object actualPrepared)throws Exception{
        var read=NativePrivateCustodyExchangeTest.field(actualPrepared,"originalRead");
        var method=read.getClass().getDeclaredMethod("prepareOriginalBrowserData",actualPrepared.getClass());method.setAccessible(true);
        try{return method.invoke(read,actualPrepared);}
        catch(java.lang.reflect.InvocationTargetException failure){
            Throwable cause=failure.getCause();if(cause instanceof Error)throw(Error)cause;
            if(cause instanceof Exception)throw(Exception)cause;throw new AssertionError(cause);
        }
    }
    private static JSONObject owningRecoveryLimits()throws Exception{
        var limits=new JSONObject();for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed",
            "finalizer_allowed","key_removal","phone_released"})limits.put(name,false);return limits;
    }
    private static void owningRecoveryNoEffects(JSONObject value)throws Exception{
        for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
            assertFalse(name,value.getBoolean(name));
    }
    private static byte[] owningRecoveryWire(JSONObject data)throws Exception{
        return new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);
    }
    // Pure document math from the canonical public wire grammar; NOT signing,
    // admission, controller approval, a manager identity or a capability API.
    private static String owningRecoveryCanonical(JSONObject value)throws Exception{
        var out=new StringBuilder("{");boolean first=true;
        for(String name:new java.util.TreeSet<String>(value.keySet())){
            if(!first)out.append(',');first=false;Object item=value.get(name);
            out.append(JSONObject.quote(name)).append(':').append(item instanceof JSONObject?
                owningRecoveryCanonical((JSONObject)item):JSONObject.valueToString(item));
        }return out.append('}').toString();
    }
    private static String owningRecoveryHashText(String value)throws Exception{
        byte[] bytes=value.getBytes(StandardCharsets.UTF_8);try{return NativeRetainedAttempt.hash(bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static String owningRecoveryDocument(String kind,JSONObject value)throws Exception{
        var copy=new JSONObject(value.toString());if(kind.equals("receipt"))copy.remove("receipt_sha256");
        return owningRecoveryHashText("custodial.same-original-recovery-"+kind+".v1\n"+owningRecoveryCanonical(copy));
    }
    private static String owningRecoveryMicros(long millis)throws Exception{
        String time=VaultTimestamps.fromEpochMillisExact(millis);return time.substring(0,time.length()-1)+"000Z";
    }
    private static String owningRecoveryAttestation(byte[] body,Map<String,String> headers,String credentialId,String path)throws Exception{
        byte[] transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION).put(credentialId)
            .put(headers.get("X-Device-Id")).put("POST").put(path).put(NativeRetainedAttempt.hash(body))
            .put(headers.get("X-Memphis-Native-Request-Id")).put(headers.get("X-Memphis-Native-Request-Timestamp"))
            .put(headers.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8);
        try{return NativeRetainedAttempt.hash(transcript);}finally{Arrays.fill(transcript,(byte)0);}
    }
    private static JSONObject owningRecoveryRegistration(byte[] actualBody,Map<String,String> actualHeaders,String credentialId)throws Exception{
        var body=ProviderWireJson.object(actualBody,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);
        String id=actualHeaders.get("X-Memphis-Native-Request-Id");
        assertTrue(id.equals(body.getString("native_challenge_intent_id")));
        long original=VaultTimestamps.epochMillis(actualHeaders.get("X-Memphis-Native-Request-Timestamp"),NativeRetainedAttempt.FAILURE);
        var value=new JSONObject().put("schema","custodial.same-original-recovery-native-challenge-receipt.v1")
            .put("state","ORIGINAL_CHALLENGE_RECORDED_PREPARATION_ONLY").put("challenge_id",id)
            .put("original_target_sha256",body.get("original_target_sha256")).put("native_challenge_intent_id",id)
            .put("native_challenge_intent_record_sha256",body.get("native_challenge_intent_record_sha256"))
            .put("registered_at",owningRecoveryMicros(original)).put("expires_at",owningRecoveryMicros(original+240000))
            .put("retry_safe",false).put("limits",owningRecoveryLimits());
        value.put("challenge_sha256",owningRecoveryHashText("custodial.same-original-native-challenge-binding.v1\n"+id+'\n'
            +NativeRetainedAttempt.hash(actualBody)+'\n'+owningRecoveryAttestation(actualBody,actualHeaders,credentialId,NativeSameOriginalRecoveryChallengeEnvelope.PATH)+'\n'
            +value.getString("native_challenge_intent_record_sha256")+'\n'+value.getString("original_target_sha256")+'\n'
            +value.getString("registered_at")+'\n'+value.getString("expires_at")));
        return value;
    }
    private static JSONObject owningRecoveryManager(JSONObject registration,JSONObject target)throws Exception{
        var preview=new JSONObject().put("schema","custodial.same-original-recovery-review.v1").put("state","ORIGINAL_BINDING_REVIEW_ONLY")
            .put("purpose",NativeSameOriginalRecoveryPreparationWire.PURPOSE).put("challenge_id",registration.get("challenge_id"))
            .put("challenge_sha256",registration.get("challenge_sha256")).put("original_target",target)
            .put("expires_at",registration.get("expires_at")).put("limits",owningRecoveryLimits());
        String previewSha=owningRecoveryDocument("preview",preview);
        // EXACT existing WireTest UNIT issuer literals, never a real manager.
        String manager="95000000-0000-4000-8000-000000000031",credential="95000000-0000-4000-8000-000000000032";
        var request=new JSONObject().put("schema","custodial.same-original-recovery-approval-request.v1")
            .put("request_id","95000000-0000-4000-8000-000000000033").put("challenge_id",registration.get("challenge_id"))
            .put("expected_challenge_sha256",registration.get("challenge_sha256")).put("expected_preview_sha256",previewSha)
            .put("expected_manager_id",manager).put("expected_manager_credential_id",credential).put("expected_manager_device_id","manager-fixture")
            .put("decision",NativeSameOriginalRecoveryPreparationWire.PURPOSE).put("manager_confirmation","CONFIRM_THIS_SAME_ORIGINAL_ONLY");
        long original=VaultTimestamps.epochMillis(registration.getString("registered_at"),NativeRetainedAttempt.FAILURE);
        var approval=new JSONObject().put("schema","custodial.same-original-recovery-approval-receipt.v1").put("state","APPROVAL_RECORDED_ONLY")
            .put("approval_id","95000000-0000-4000-8000-000000000034").put("original_request",request)
            .put("original_request_sha256",owningRecoveryDocument("request",request))
            .put("issuer",new JSONObject().put("manager_id",manager).put("manager_credential_id",credential).put("manager_device_id","manager-fixture"))
            .put("challenge_sha256",registration.get("challenge_sha256")).put("preview_sha256",previewSha).put("original_target",target)
            .put("purpose_admission_id",NativeSameOriginalRecoveryPreparationWire.ADMISSION).put("issued_at",owningRecoveryMicros(original))
            .put("expires_at",owningRecoveryMicros(original+180000)).put("retry_safe",false).put("limits",owningRecoveryLimits());
        approval.put("receipt_sha256",owningRecoveryDocument("receipt",approval));
        return new JSONObject().put("schema",NativeSameOriginalRecoveryManagerPreparationWire.SCHEMA)
            .put("state",NativeSameOriginalRecoveryManagerPreparationWire.STATE).put("purpose_admission_id",NativeSameOriginalRecoveryPreparationWire.ADMISSION)
            .put("original_registration_utf8",registration.toString()).put("original_approval_receipt_utf8",approval.toString())
            .put("observed_at",owningRecoveryMicros(original)).put("current_until",owningRecoveryMicros(original+120000))
            .put("transaction_authority",false).put("limits",owningRecoveryLimits());
    }
    /** Pure piece DATA derived from real WRITE/QUERY HTTP, no private frame. */
    private static byte[] owningRecoveryPiece(byte[] writeBytes,byte[] queryBytes,Map<String,String> writeHeaders,
        Map<String,String> queryHeaders,String credentialId)throws Exception{
        var w=ProviderWireJson.object(writeBytes,NativeRetainedAttempt.MAX_BODY);
        var q=ProviderWireJson.object(queryBytes,NativeRetainedAttempt.MAX_BODY);
        for(String key:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256",
            "frame_sha256","record_sha256","plan_sha256","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes","chunk_sha256"})
            assertTrue(w.getString(key).equals(q.getString(key)));
        assertTrue(writeHeaders.get("X-Memphis-Native-Request-Id").equals(q.getString("target_native_request_id")));
        assertTrue(NativeRetainedAttempt.hash(writeBytes).equals(q.getString("target_request_body_sha256")));
        assertTrue(owningRecoveryAttestation(writeBytes,writeHeaders,credentialId,VaultEngine.NativePrivateCustodyPreparedExchange.PATH).equals(q.getString("target_attestation_digest")));
        var row=new JSONObject().put("schema","custodial.private-custody-chunk-readback.v1").put("state","OPAQUE_CHUNK_READ_ONLY_PENDING_RECONCILIATION")
            .put("operation_id",w.get("operation_id")).put("generation_id",w.get("original_generation_id"))
            .put("chunk_index",Integer.parseInt(w.getString("chunk_index"))).put("native_request_id",writeHeaders.get("X-Memphis-Native-Request-Id"))
            .put("request_body_sha256",NativeRetainedAttempt.hash(writeBytes)).put("attestation_digest",q.get("target_attestation_digest"))
            .put("chunk_bytes",Integer.parseInt(w.getString("chunk_bytes")))
            .put("received_at",owningRecoveryMicros(VaultTimestamps.epochMillis(writeHeaders.get("X-Memphis-Native-Request-Timestamp"),NativeRetainedAttempt.FAILURE)))
            .put("frame_complete_syntax_verified",false);
        for(String key:new String[]{"frame_sha256","record_sha256","plan_sha256","chunk_sha256"})row.put(key,w.get(key));
        for(String key:new String[]{"inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})row.put(key,false);
        var data=new JSONObject().put("schema","custodial.private-custody-original-frame-piece.v1")
            .put("state","CURRENT_SQL_ORIGINAL_ENCRYPTED_PIECE_NOT_NATIVE_OR_SEMANTIC_ACK").put("generation_id",q.get("original_generation_id"))
            .put("encrypted_piece_base64",w.get("chunk_base64")).put("readback",row)
            .put("query_witness",new JSONObject().put("native_request_id",queryHeaders.get("X-Memphis-Native-Request-Id"))
                .put("request_body_sha256",NativeRetainedAttempt.hash(queryBytes))
                .put("attestation_digest",owningRecoveryAttestation(queryBytes,queryHeaders,credentialId,VaultEngine.NativePrivateCustodyPreparedExchange.PATH))
                .put("purpose_binding_sha256",q.get("purpose_binding_sha256")).put("target_prepared_record_sha256",q.get("target_prepared_record_sha256"))
                .put("target_unknown_record_sha256",q.get("target_unknown_record_sha256")));
        for(String key:new String[]{"operation_id","principal_digest","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_sha256"})data.put(key,q.get(key));
        for(String key:new String[]{"engine_revision","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes"})data.put(key,Long.parseLong(q.getString(key)));
        // Existing untrusted response grammar only, not caller currentness.
        for(String key:new String[]{"current_SQL_snapshot_frame_readback","frame_complete_syntax_verified","exact_authenticated_original_owner_proof_bytes_match",
            "read_snapshot_is_not_future_acceptance_or_transaction_write_authority"})data.put(key,true);
        for(String key:new String[]{"original_device_key_GCM_server_verified","raw_namespace_values_recovered","complete_namespace_inventory",
            "all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})data.put(key,false);
        return owningRecoveryWire(data);
    }

    /** Initial UNIT production only: normal active WORK APIs and the same
     * owner's native signature/receipt path, BEFORE any separation/capture.
     * No raw row insertion, erased fence, transplanted identity or live API. */
    private static NativeRetainedCompletionSemanticsTest.Fixture owningRecoveryCompletionBeforeFreeze()throws Exception{
        var input=NativeRetainedCompletionSemanticsTest.Fixture.activeBeforeSeparation();var owner=input.owner;
        assertFalse(owner.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
        assertFalse(owner.workDisk.memory.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));owner.work.requireWorkAdmission();
        var vault=owner.persistence.current();var principal=owner.principal.readFor(owner.engine.getState());
        assertEquals(0,input.start.length());assertEquals(0,input.end.length());
        // Existing native semantic fixture's original UNIT civil values, not
        // a qualified platform clock or a retimed captured completion.
        input.args.put("p_client_started_at","2026-09-26T12:00:00.000Z").put("p_client_ended_at","2026-09-26T12:20:00.000Z");
        input.sign();
        var occurrence=new OfflineAuthorityTime.OfflineOccurrence(NativeCompletionJournalTest.SESSION,"KIOSK_08","NOCX",
            "a".repeat(64),"2026-09-26T10:00:00.000Z","2026-09-27T18:00:00.000Z","2026-09-26T10:00:00.000Z",
            1000L,3,NativeSeparationContextTest.id(43),input.args.getString("p_client_started_at"),input.args.getString("p_client_ended_at"));
        assertNull(owner.work.loadOccurrence(occurrence.clientSessionId));
        owner.work.saveOccurrence(occurrence);owner.work.saveFinishEntryId(occurrence,NativeCompletionJournalTest.FINISH);
        assertTrue(NativeCompletionJournalTest.FINISH.equals(owner.work.loadFinishEntryId(owner.work.loadOccurrence(occurrence.clientSessionId))));
        var request=NativeCompletionJournalTest.request(input.args);
        var response=NativeCompletionJournalTest.response(NativeCompletionJournalTest.result());
        Throwable primary=null;
        try{
            new NativeCompletionJournal(owner.work).captureAuthenticatedResponse("KIOSK_08",request,response);
            var receipts=owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)).toList();
            assertEquals("Exactly one normally produced initial receipt",1,receipts.size());
            input.receiptKey=receipts.get(0).substring(NativeRetainedCompletionSemanticsTest.PREFIX.length());
            try(var saved=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",input.receiptKey,owner.work.loadCompletionReceipt(input.receiptKey))){
                assertTrue(saved.originalValuesAvailable);byte[] original=saved.originalBody();
                try{assertTrue("Same normal request retained",Arrays.equals(request.body,original));}finally{Arrays.fill(original,(byte)0);}
                assertTrue(ProviderWireJson.same(input.args,saved.originalArgs()));
            }
            assertFalse(owner.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
            assertFalse(owner.workDisk.memory.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));owner.work.requireWorkAdmission();
            assertSame(vault,owner.persistence.current());assertTrue(ProviderWireJson.same(principal,owner.principal.readFor(owner.engine.getState())));
            assertEquals(0,owner.opened);return input;
        }catch(Exception|Error failure){primary=failure;throw failure;}
        finally{Arrays.fill(request.body,(byte)0);Arrays.fill(response.body,(byte)0);
            try{owner.wiped();}catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
    }
    private static byte[] owningRecoverySavedCompletionArguments(NativeRetainedCompletionSemanticsTest.Fixture input)throws Exception{
        try(var saved=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",input.receiptKey,input.owner.work.loadCompletionReceipt(input.receiptKey))){
            assertTrue(saved.originalValuesAvailable);var args=saved.originalArgs();
            assertTrue(ProviderWireJson.same(input.args,args));return args.toString().getBytes(StandardCharsets.UTF_8);
        }
    }
    private static NativePrivateCustodyExchangeTest.GuardedIdentityFixture owningRecoveryGuardedCompletion(
        NativeRetainedCompletionSemanticsTest.Fixture input)throws Exception{
        // The only first freeze happens inside this additive batch constructor.
        // Every following layer keeps this SAME owner/principal/WORK storage.
        var batch=new NativeRetainedBatchOwnerTest.Fixture(input.owner);
        var generation=new NativeGenerationBoundBatchTest.Fixture(batch);
        var census=new NativeRetainedNamespaceCensusTest.Fixture(generation);
        var semantic=new NativeRetainedNamespaceSemanticJoinTest.Fixture(census);
        var layout=new NativeRetainedNamespaceCustodyLayoutTest.Fixture(semantic);
        var owner=new NativePrivateCustodyOwnerTest.Fixture(layout);
        return new NativePrivateCustodyExchangeTest.GuardedIdentityFixture(owner);
    }
    private static void owningControlledRecoveryReads(boolean manager)throws Exception{
        owningControlledRecoveryReads(manager,CompletionFailure.NONE);
    }
    private static void owningControlledRecoveryReads(boolean manager,CompletionFailure completionFailure)throws Exception{
        owningControlledRecoveryReads(manager,completionFailure,null);
    }
    @Test public void FIRST_PURPOSE_PAIR_firstChallengeAndStatusKeepOriginalsWithoutReplacement()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.NONE,null,true);
    }
    @Test public void READONLY_PREFLIGHT_lastSourceMutationRetainsOriginalsBeforeHTTP()throws Exception{
        for(String filename:new String[]{"write-0.bin","write_unknown-0.bin","query-0.bin","query_unknown-0.bin"})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Read-only preflight failure returned a prepared owner");
            }
            @Override public boolean currentFrameCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws Exception{
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var old=coldOriginals(f);var inodes=coldInodes(old);var path=f.dir.resolve(filename);
                var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                var lines=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal$ReadOnlyQueryOriginalDataRestoration")
                                &&frame.getMethodName().equals("read")){
                                lines.add(frame.getLineNumber());
                                // Entry and terminal full Source are the two
                                // sites; all four records and both original
                                // HMACs have been checked before the latter.
                                if(lines.size()==2&&fired.compareAndSet(false,true))try{
                                    Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                }catch(Exception failure){throw new AssertionError("Read-only preflight LAST Source mutation prerequisite",failure);}
                                break;
                            }
                        return super.entrySet();
                    }
                });
                try{
                    assertThrows("No current frame escapes a changed original at the read-only terminal Source",VaultFailure.class,()->{
                        try(var unexpected=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control)){
                            throw new AssertionError("Changed original returned a current frame");
                        }
                    });
                    armed.set(false);source.unknown.put(namespace,map);control.check();
                    assertTrue("Actual terminal Source callback must have fired",fired.get());assertEquals(2,lines.size());
                    assertArrayEquals(changed,Files.readAllBytes(path));
                    var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());coldSame(old,inodes);
                    assertFalse(Files.exists(f.dir.resolve("recovery_intent-0.bin")));return true;
                }finally{armed.set(false);source.unknown.put(namespace,map);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);
                    for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
            }
        },true);
    }
    @Test public void ACTUAL_RESPONSE_publicationCancellationRetainsOriginalsWithoutResend()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.RESPONSE_PUBLICATION_CANCELED,null,true);
    }
    @Test public void EXISTING_RESPONSE_lastSourceMutationRefusesReadAndCannotRevive()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.EXISTING_OBSERVATION_CHANGED_SOURCE,null,true);
    }
    @Test public void STATUS_READ_sourceCancellationBeforeDispatchRetainsOriginals()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.STATUS_SOURCE_CANCELED,null,true);
    }
    @Test public void MANAGER_LEASE_changedOriginalUnknownRefusesCompletionAndCannotRevive()throws Exception{
        owningControlledRecoveryReads(true,CompletionFailure.MANAGER_UNKNOWN_CHANGED);
    }
    /** Actual first send entry, withdrawn only after its real UNKNOWN birth.
     * No test-furnished approval, fake clock or successful HTTP is involved. */
    @Test public void FIRST_CHALLENGE_FENCE_cancellationAfterDurableUnknownRetainsWithoutSend()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("First fence case must own its original preparation");
            }
            @Override public boolean firstPairCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryTargetObservation target,NativePrivateCustodyFrameReadControl control)throws Exception{
                try(var prepared=target.takeFirstOriginalChallengeRequest()){
                    var old=coldOriginals(f);var oldInodes=coldInodes(old);
                    var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                    var opens=new java.util.concurrent.atomic.AtomicInteger();
                    var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("Canceled UNKNOWN reached HTTP");},f.clock);
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            if(armed.get()&&!fired.get()&&Files.exists(f.dir.resolve("recovery_unknown-0.bin"))
                                &&fired.compareAndSet(false,true))control.requestCancellation();
                            return super.entrySet();
                        }
                    });
                    try{
                        assertThrows(VaultFailure.class,()->f.engine.sendOriginalRecoveryChallenge(prepared,http,control));
                        armed.set(false);source.unknown.put(namespace,map);
                        assertTrue("The actual Source callback observed durable original UNKNOWN",fired.get());assertEquals(0,opens.get());
                        assertThrows(VaultFailure.class,control::check);coldSame(old,oldInodes);
                        assertTrue(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                        assertFalse(Files.exists(f.dir.resolve("recovery_observation-0.bin")));
                        var retained=coldOriginals(f);var inodes=coldInodes(retained);
                        try{
                            assertThrows("Retained UNKNOWN cannot authorize another send",VaultFailure.class,
                                ()->f.engine.sendOriginalRecoveryChallenge(prepared,http,control));
                            assertEquals(0,opens.get());coldSame(retained,inodes);coldSame(old,oldInodes);
                        }finally{for(var bytes:retained.values())Arrays.fill(bytes,(byte)0);}
                    }finally{armed.set(false);source.unknown.put(namespace,map);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                return true;
            }
        },true);
    }
    /** Future typed take owns a fresh real Source/UNKNOWN check even when
     * birth already succeeded. Same inode/mtime cannot stand in for bytes. */
    @Test public void ORIGINAL_DISPATCH_liveSourceMutationRefusesTakeAndCannotRevive()throws Exception{
        for(String filename:new String[]{"recovery_unknown-0.bin","recovery_request-0.bin"})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Future dispatch owns its real preparation");
            }
            @Override public boolean firstPairCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryTargetObservation target,NativePrivateCustodyFrameReadControl control)throws Exception{
                try(var prepared=target.takeFirstOriginalChallengeRequest()){
                    prepared.fenceOriginalUnknown();
                    try(var dispatch=f.engine.prepareOriginalRecoveryChallengeDispatch(prepared)){
                        var old=coldOriginals(f);var inodes=coldInodes(old);var path=f.dir.resolve(filename);
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                        source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                if(armed.get()&&fired.compareAndSet(false,true))try{
                                    Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                }catch(Exception failure){throw new AssertionError("Future dispatch Source mutation prerequisite",failure);}
                                return super.entrySet();
                            }
                        });
                        try{
                            assertThrows("No typed request escapes a changed original",VaultFailure.class,dispatch::takeRequest);
                            armed.set(false);source.unknown.put(namespace,map);control.check();assertTrue(fired.get());
                            assertArrayEquals(changed,Files.readAllBytes(path));
                            var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                            Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restored bytes cannot revive refused dispatch",VaultFailure.class,dispatch::takeRequest);
                            coldSame(old,inodes);assertFalse(Files.exists(f.dir.resolve("recovery_observation-0.bin")));
                            return true;
                        }finally{armed.set(false);source.unknown.put(namespace,map);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);
                            for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                }
            }
        },true);
    }
    @Test public void TARGET_FRAME_terminalSourceMutationCannotReturnOrReviveTarget()throws Exception{
        for(String filename:new String[]{"query-0.bin","query_unknown-0.bin"})
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Changed original returned a target/prepared owner");
            }
            @Override public boolean targetCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativePrivateCustodyCurrentFrameRead read,NativePrivateCustodyHttp http,
                NativePrivateCustodyFrameReadControl control)throws Exception{
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var path=f.dir.resolve(filename);var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);byte[] original=Files.readAllBytes(path),changed=original.clone();
                changed[changed.length/2]^=1;var fired=new java.util.concurrent.atomic.AtomicBoolean();
                var armed=new java.util.concurrent.atomic.AtomicBoolean(true);var lines=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        var trace=Thread.currentThread().getStackTrace();boolean target=false;
                        for(var frame:trace)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativeSameOriginalRecoveryTargetObservation")
                            &&frame.getMethodName().equals("<init>"))target=true;
                        if(armed.get()&&!fired.get()&&target)for(var frame:trace)
                            if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("sealedCurrentFrameCryptoProjection")){
                                lines.add(frame.getLineNumber());
                                if(lines.size()==2&&fired.compareAndSet(false,true))try{
                                    Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                }catch(Exception failure){throw new AssertionError("Terminal target Source mutation prerequisite",failure);}
                                break;
                            }
                        return super.entrySet();
                    }
                });
                try{
                    var failure=assertThrows(VaultFailure.class,()->read.takeOriginalRecoveryTarget(http));
                    armed.set(false);source.unknown.put(namespace,map);control.check();
                    assertTrue("Actual target constructor's LAST frame Source callback reached",fired.get());assertEquals(2,lines.size());
                    assertEquals(NativeRetainedAttempt.FAILURE,failure.code);assertArrayEquals(changed,Files.readAllBytes(path));
                    var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                    Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                    assertThrows("Restored bytes cannot revive the same refused frame",VaultFailure.class,read::projection);
                    assertThrows("No second target request from refused original",VaultFailure.class,()->read.takeOriginalRecoveryTarget(http));
                    assertFalse(Files.exists(f.dir.resolve("recovery_intent-0.bin")));assertFalse(Files.exists(f.dir.resolve("recovery_request-0.bin")));
                    return true;
                }finally{armed.set(false);source.unknown.put(namespace,map);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
            }
        },true);
    }
    /** Actual persisted-purpose callback withdrawal, not a fabricated timer,
     * new HMAC or replacement request. New records remain unqualified DATA. */
    @Test public void FIRST_PURPOSE_PAIR_cancellationAfterLocalBirthRetainsUnknownNoSend()throws Exception{
        owningControlledRecoveryReads(false,CompletionFailure.NONE,new SealedRecoveryCheck(){
            @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyFrameReadControl control){
                throw new AssertionError("Canceled first birth returned a prepared request");
            }
            @Override public boolean firstPairCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                VaultEngine.NativeSameOriginalRecoveryTargetObservation target,NativePrivateCustodyFrameReadControl control)throws Exception{
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                var old=coldOriginals(f);var oldInodes=coldInodes(old);
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(armed.get()&&!fired.get()&&(Files.exists(f.dir.resolve("recovery_intent-0.bin"))
                            ||Files.exists(f.dir.resolve("recovery_intent-0.pending")))&&fired.compareAndSet(false,true))control.requestCancellation();
                        return super.entrySet();
                    }
                });
                try{
                    assertThrows("No prepared owner may escape the canceled local birth",VaultFailure.class,target::takeFirstOriginalChallengeRequest);
                    armed.set(false);source.unknown.put(namespace,map);
                    assertTrue("Actual Source callback must observe a persisted new purpose record",fired.get());
                    assertEquals("custodial_private_custody_transport_outcome_unknown",assertThrows(VaultFailure.class,control::check).code);
                    coldSame(old,oldInodes);
                    assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.pending")));
                    assertFalse(Files.exists(f.dir.resolve("recovery_observation-0.bin")));assertFalse(Files.exists(f.dir.resolve("recovery_observation-0.pending")));
                    var retained=coldOriginals(f);var retainedInodes=coldInodes(retained);
                    try{
                        assertThrows("Same canceled owner cannot sign or replace the retained purpose",VaultFailure.class,target::takeFirstOriginalChallengeRequest);
                        coldSame(retained,retainedInodes);coldSame(old,oldInodes);
                    }finally{for(var bytes:retained.values())Arrays.fill(bytes,(byte)0);}
                    return true;
                }finally{armed.set(false);source.unknown.put(namespace,map);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
            }
        },true);
    }
    private static void owningControlledRecoveryReads(boolean manager,CompletionFailure completionFailure,SealedRecoveryCheck sealedCheck)throws Exception{
        owningControlledRecoveryReads(manager,completionFailure,sealedCheck,false);
    }
    private static void owningControlledRecoveryReads(boolean manager,CompletionFailure completionFailure,SealedRecoveryCheck sealedCheck,boolean firstPair)throws Exception{
        if(!manager&&completionFailure!=CompletionFailure.NONE&&completionFailure!=CompletionFailure.RESPONSE_PUBLICATION_CANCELED
            &&completionFailure!=CompletionFailure.EXISTING_OBSERVATION_CHANGED_SOURCE&&completionFailure!=CompletionFailure.STATUS_SOURCE_CANCELED)
            throw new IllegalArgumentException("completion failure requires normal manager workflow");
        var completionInput=manager?owningRecoveryCompletionBeforeFreeze():null;
        var originalCompletionRows=new java.util.LinkedHashMap<String,Object>();
        if(manager)for(String key:new String[]{completionInput.key(false),completionInput.key(true),NativeRetainedCompletionSemanticsTest.PREFIX+completionInput.receiptKey}){
            Object value=completionInput.owner.workDisk.memory.get(key);assertNotNull(value);originalCompletionRows.put(key,value);
        }
        byte[] originalCompletionArguments=manager?owningRecoverySavedCompletionArguments(completionInput):null;
        try(var f=manager?owningRecoveryGuardedCompletion(completionInput):new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var source=f.x.f.x.f.x;var owner=source.f.batch.old;
            var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var originalVault=owner.persistence.current();
            var principal=owner.principal.readFor(f.engine.getState());String credentialId=principal.getString("credential_id");
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
            for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            var root=f.x.f.root;var rootAttributes=Files.readAttributes(root,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var connections=new java.util.ArrayList<Connection>();
            var observedBodies=new java.util.HashMap<String,byte[]>();
            var observedHeaders=new java.util.HashMap<String,Map<String,String>>();
            var counts=new java.util.HashMap<String,Integer>();
            var stage=new java.util.concurrent.atomic.AtomicReference<String>("WRITE");
            var expected=new java.util.concurrent.atomic.AtomicReference<JSONObject>();
            var targetData=new java.util.concurrent.atomic.AtomicReference<JSONObject>();
            var registration=new java.util.concurrent.atomic.AtomicReference<JSONObject>();
            var currentControl=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyFrameReadControl>();
            var completionAwait=new java.util.concurrent.atomic.AtomicInteger();
            var sourceWithdrawn=new java.util.concurrent.atomic.AtomicBoolean();
            var completionReplyConsumed=new java.util.concurrent.atomic.AtomicBoolean();
            var completionHeaders=new java.util.concurrent.atomic.AtomicReference<Map<String,String>>();
            var completionBodySha=new java.util.concurrent.atomic.AtomicReference<String>();
            var currentReplyObserved=new java.util.concurrent.atomic.AtomicBoolean();
            final String withdrawalNamespace="MemphisZooCustodialNativeVaultV1",withdrawalKey="during-completion-HTTP";
            final String withdrawalValue="UNIT_SOURCE_WITHDRAWN_NO_AUTHORITY";
            class Witness {
                /** Detached retained-DATA checks only. Do not restore the
                 * changed namespace or rebaseline any owning capability. */
                void retainedAfterWithdrawal(){
                    for(var namespace:stable.raw.entrySet()){
                        var original=namespace.getValue();var actual=source.raw(namespace.getKey());
                        var expectedKeys=new java.util.HashSet<String>(original.keySet());
                        if(namespace.getKey().equals(withdrawalNamespace))expectedKeys.add(withdrawalKey);
                        assertEquals(expectedKeys,actual.keySet());
                        for(var row:original.entrySet())assertTrue("Original row retained after source withdrawal",java.util.Objects.equals(row.getValue(),actual.get(row.getKey())));
                        if(namespace.getKey().equals(withdrawalNamespace))assertTrue(withdrawalValue.equals(actual.get(withdrawalKey)));
                    }
                    var model=source.f;
                    assertEquals(stable.ids,model.batch.ids);assertEquals(stable.opened,model.batch.old.opened);
                    assertEquals(stable.workCommits,model.batch.old.workDisk.commits);assertEquals(stable.writeCommits,model.batch.old.journalDisk.commits);
                    assertEquals(stable.queryCommits,model.batch.queryZeroDisk.commits);assertEquals(stable.batchCommits,model.batch.root.commits);
                    assertEquals(stable.providerCommits,model.store.memory.commits);assertEquals(stable.indexEncrypts,model.batch.indexCipher.encrypts);
                    assertEquals(stable.queryEncrypts,source.queryCipher.encrypts);source.queryCipher.wiped();
                    assertEquals(stable.writeEncrypts,model.batch.old.journalCipher.existing);
                    for(var row:model.batch.domains.entrySet())assertEquals((int)stable.domainEncrypts.getOrDefault(row.getKey(),0),row.getValue().encrypts);
                }
                void same()throws Exception{
                    if(manager){assertSame(completionInput.owner,owner);
                        assertTrue(owner.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
                        assertThrows("Original frozen WORK still denies ordinary admission",VaultFailure.class,owner.work::requireWorkAdmission);
                        for(var row:originalCompletionRows.entrySet())assertTrue("Original completion row retained exactly",java.util.Objects.equals(row.getValue(),owner.workDisk.memory.get(row.getKey())));}
                    coldSame(originals,inodes);if(sourceWithdrawn.get())retainedAfterWithdrawal();else stable.check();
                    for(var entry:attributes.entrySet()){
                        var before=entry.getValue();var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(before.fileKey(),now.fileKey());assertEquals(before.size(),now.size());assertEquals(before.lastModifiedTime(),now.lastModifiedTime());
                        assertEquals(before.owner(),now.owner());assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                    }
                    var now=Files.readAttributes(root,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(rootAttributes.fileKey(),now.fileKey());assertEquals(rootAttributes.owner(),now.owner());
                    assertEquals(rootAttributes.group(),now.group());assertEquals(rootAttributes.permissions(),now.permissions());
                }
                void observeNew()throws Exception{
                    same();if(Files.notExists(f.dir,java.nio.file.LinkOption.NOFOLLOW_LINKS))return;
                    try(var paths=Files.newDirectoryStream(f.dir)){
                        for(var path:paths){String name=path.getFileName().toString();
                            assertTrue("Only normal committed original records",name.equals("exchange.lock")
                                ||name.matches("(?:write|write_unknown|write_observation|query|query_unknown|query_observation)-[0-9]+\\.bin")
                                ||name.matches("recovery_(?:intent|request|unknown|observation)-0\\.bin")
                                ||sealedCheck!=null&&sealedCheck.usesSavedBrowserPublication()
                                    &&(name.equals("browser_frame-0.bin")||name.equals("browser_chunk-0.bin")));
                            if(!originals.containsKey(path)){
                                var a=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                assertTrue(a.isRegularFile());assertFalse(a.isSymbolicLink());assertNotNull(a.fileKey());
                                assertEquals(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"),a.permissions());
                                assertTrue(a.size()>=0&&a.size()<=1_200_000);
                                originals.put(path,Files.readAllBytes(path));inodes.put(path,a.fileKey());attributes.put(path,a);
                            }
                        }
                    }same();
                }
            }
            var witness=new Witness();
            class Body extends ByteArrayOutputStream {void wipe(){Arrays.fill(buf,(byte)0);reset();}}
            class OwningConnection extends Connection {
                final String role;final Body body=new Body();byte[] owned,copy;boolean outputClosed;
                OwningConnection(URL url,String role){super(url);this.role=role;
                    if(role.equals("COMPLETION")&&completionFailure!=CompletionFailure.NONE){
                        timeout=completionFailure==CompletionFailure.LOST_REPLY;
                        onReply=()->{
                            assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                            assertEquals(1,completionAwait.incrementAndGet());
                            if(completionFailure==CompletionFailure.SOURCE_WITHDRAWAL){
                                assertFalse(sourceWithdrawn.get());assertFalse(source.unknown.get(withdrawalNamespace).containsKey(withdrawalKey));
                                // Existing originalNamespaceChangesDuringHTTP fixture seam:
                                // extra UNIT DATA withdraws the actual captured Source.
                                source.unknown.get(withdrawalNamespace).put(withdrawalKey,withdrawalValue);sourceWithdrawn.set(true);
                            }
                        };
                    }
                }
                @Override public OutputStream getOutputStream(){return new OutputStream(){
                    @Override public void write(int value){throw new AssertionError("original array expected");}
                    @Override public void write(byte[] bytes){assertNull(owned);owned=bytes;copy=bytes.clone();body.write(bytes,0,bytes.length);}
                    @Override public void close(){outputClosed=true;}
                };}
                @Override public int getResponseCode()throws java.io.IOException{
                    try{
                        assertTrue(outputClosed);assertNotNull(copy);assertEquals(copy.length,fixedContentLength);assertEquals("POST",getRequestMethod());
                        assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));witness.observeNew();
                        var control=currentControl.get();if(control!=null){assertFalse(Thread.holdsLock(control));assertThrows("Original piece must stay active at response",VaultFailure.class,control::beginPiece);}
                        assertTrue(NativeAttestation.REQUEST_VERSION.equals(headers.get("X-Memphis-Native-Attestation-Version")));
                        assertTrue(principal.getString("device_id").equals(headers.get("X-Device-Id")));
                        assertTrue(headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                        byte[] reply;
                        if(role.equals("WRITE")||role.equals("QUERY")){
                            var b=ProviderWireJson.object(copy,NativeRetainedAttempt.MAX_BODY);var p=expected.get();assertNotNull(p);
                            assertTrue(p.getString("native_request_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                            assertTrue(p.getString("request_body_sha256").equals(NativeRetainedAttempt.hash(copy)));
                            assertTrue(p.getString("native_request_timestamp").equals(headers.get("X-Memphis-Native-Request-Timestamp")));
                            assertTrue((role.equals("WRITE")?"custodial.original-native-private-custody-write.v1":"custodial.original-native-private-custody-query.v1").equals(b.getString("schema")));
                            String key=role+":"+b.getString("chunk_index");assertFalse(observedBodies.containsKey(key));
                            observedBodies.put(key,copy.clone());observedHeaders.put(key,new java.util.HashMap<>(headers));
                            reply=new byte[0]; // Historical transport DATA only, no receipt/custody.
                        }else if(role.equals("CURRENT")){
                            var envelope=ProviderWireJson.object(copy,526336);byte[] archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                            try{var q=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);String index=q.getString("chunk_index");
                                assertTrue(Arrays.equals(observedBodies.get("QUERY:"+index),archived));
                                assertTrue(observedHeaders.get("QUERY:"+index).get("X-Memphis-Native-Request-Timestamp").equals(envelope.getString("original_query_timestamp")));
                                assertTrue(observedHeaders.get("QUERY:"+index).get("X-Memphis-Native-Request-Attestation").equals(envelope.getString("original_query_http_attestation")));
                                assertTrue(NativeRetainedAttempt.hash(originals.get(f.dir.resolve("query_unknown-"+index+".bin"))).equals(envelope.getString("original_query_unknown_record_sha256")));
                                reply=owningRecoveryPiece(observedBodies.get("WRITE:"+index),archived,observedHeaders.get("WRITE:"+index),observedHeaders.get("QUERY:"+index),credentialId);
                            }finally{Arrays.fill(archived,(byte)0);}
                        }else if(role.equals("TARGET")){
                            var q=ProviderWireJson.object(observedBodies.get("QUERY:0"),NativeRetainedAttempt.MAX_BODY);
                            var target=targetData.get();byte[] targetBytes=target.toString().getBytes(StandardCharsets.UTF_8);
                            try{reply=owningRecoveryWire(new JSONObject().put("schema","custodial.same-original-recovery-target-observation.v1")
                                .put("state","ORIGINAL_TARGET_DESCRIPTOR_ONLY").put("original_target",target)
                                .put("original_target_sha256",NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes).documentSha256())
                                .put("original_read_query_id",q.get("read_query_id")).put("original_query_body_sha256",NativeRetainedAttempt.hash(observedBodies.get("QUERY:0")))
                                .put("original_query_unknown_record_sha256",NativeRetainedAttempt.hash(originals.get(f.dir.resolve("query_unknown-0.bin"))))
                                .put("current_request_body_sha256",NativeRetainedAttempt.hash(copy)).put("limits",owningRecoveryLimits()));
                            }finally{Arrays.fill(targetBytes,(byte)0);}
                        }else if(role.equals("CHALLENGE")){
                            var b=ProviderWireJson.object(copy,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);var p=expected.get();
                            assertTrue(p.getString("native_request_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                            assertTrue(p.getString("request_body_sha256").equals(NativeRetainedAttempt.hash(copy)));
                            assertTrue(p.getString("native_request_timestamp").equals(headers.get("X-Memphis-Native-Request-Timestamp")));
                            assertTrue(NativeRetainedAttempt.hash(originals.get(f.dir.resolve("recovery_intent-0.bin"))).equals(b.getString("native_challenge_intent_record_sha256")));
                            assertTrue(originals.containsKey(f.dir.resolve("recovery_unknown-0.bin")));
                            observedBodies.put("CHALLENGE",copy.clone());observedHeaders.put("CHALLENGE",new java.util.HashMap<>(headers));
                            registration.set(owningRecoveryRegistration(copy,headers,credentialId));reply=owningRecoveryWire(registration.get());
                        }else if(role.equals("STATUS")||role.equals("MANAGER")){
                            var b=ProviderWireJson.object(copy,NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS);
                            assertTrue((role.equals("STATUS")?NativeSameOriginalRecoveryChallengeEnvelope.STATUS_SCHEMA:"custodial.same-original-manager-preparation-native-read.v1").equals(b.getString("schema")));
                            byte[] archived=java.util.Base64.getDecoder().decode(b.getString("original_challenge_body_base64"));
                            try{assertTrue(Arrays.equals(observedBodies.get("CHALLENGE"),archived));}finally{Arrays.fill(archived,(byte)0);}
                            var first=observedHeaders.get("CHALLENGE");
                            assertTrue(first.get("X-Memphis-Native-Request-Id").equals(headers.get("X-Memphis-Native-Request-Id")));
                            assertTrue(first.get("X-Memphis-Native-Request-Timestamp").equals(b.getString("original_challenge_timestamp")));
                            assertTrue(first.get("X-Memphis-Native-Request-Attestation").equals(b.getString("original_challenge_http_attestation")));
                            reply=owningRecoveryWire(role.equals("STATUS")?registration.get():owningRecoveryManager(registration.get(),targetData.get()));
                        }else if(role.equals("COMPLETION")){
                            var b=ProviderWireJson.object(copy,NativeSameOriginalCompletionReadEnvelope.MAX_OUTPUT);
                            assertTrue(NativeSameOriginalCompletionReadEnvelope.SCHEMA.equals(b.getString("schema")));
                            assertEquals(java.util.Set.of("schema","current_original_query_envelope_base64","original_completion_arguments_base64"),b.keySet());
                            byte[] current=java.util.Base64.getDecoder().decode(b.getString("current_original_query_envelope_base64"));
                            byte[] arguments=java.util.Base64.getDecoder().decode(b.getString("original_completion_arguments_base64"));
                            byte[] query=null;
                            try{assertTrue("Actual native group, never empty success",arguments.length>0&&arguments.length<=NativeSameOriginalCompletionReadEnvelope.MAX_ARGUMENTS);
                                assertTrue(manager);assertNotNull(originalCompletionArguments);
                                assertTrue("Exact initial normally produced arguments",Arrays.equals(originalCompletionArguments,arguments));
                                var envelope=ProviderWireJson.object(current,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
                                query=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));assertTrue(Arrays.equals(observedBodies.get("QUERY:0"),query));
                                var q=ProviderWireJson.object(query,NativeRetainedAttempt.MAX_BODY);
                                assertTrue(q.getString("read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                                assertTrue(observedHeaders.get("QUERY:0").get("X-Memphis-Native-Request-Timestamp").equals(envelope.getString("original_query_timestamp")));
                                assertTrue(observedHeaders.get("QUERY:0").get("X-Memphis-Native-Request-Attestation").equals(envelope.getString("original_query_http_attestation")));
                                assertTrue(NativeRetainedAttempt.hash(originals.get(f.dir.resolve("query_unknown-0.bin"))).equals(envelope.getString("original_query_unknown_record_sha256")));
                                reply=owningRecoveryWire(new JSONObject().put("schema","custodial.same-original-completion-SQL-read.v1")
                                    .put("state","CURRENT_EXACT_ORIGINAL_COMPLETION_DISPOSITION_NOT_ACK").put("operation_id",q.get("operation_id"))
                                    .put("original_generation_id",q.get("original_generation_id")).put("argument_values_sha256",NativeRetainedAttempt.hash(arguments))
                                    .put("disposition","UNRESOLVED_RETAINED").put("result",JSONObject.NULL).put("transaction_authority",false).put("limits",owningRecoveryLimits()));
                            }finally{Arrays.fill(current,(byte)0);Arrays.fill(arguments,(byte)0);if(query!=null)Arrays.fill(query,(byte)0);}
                        }else throw new AssertionError("unrequested owning HTTP role");
                        assertTrue(reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);Arrays.fill(response,(byte)0);response=reply;
                        if(role.equals("COMPLETION")&&completionFailure!=CompletionFailure.NONE){
                            currentControl.get().check();assertFalse(Thread.currentThread().isInterrupted());
                            assertNull(completionHeaders.get());completionHeaders.set(new java.util.HashMap<>(headers));completionBodySha.set(NativeRetainedAttempt.hash(copy));
                            // Real existing Connection timeout/onReply behavior only,
                            // after exact native request and valid reply DATA above.
                            return super.getResponseCode();
                        }
                        if(role.equals("CURRENT"))currentReplyObserved.set(true);
                        return 200;
                    }catch(Exception failure){throw new java.io.IOException("UNIT_owning_recovery_response_data_failure",failure);}
                }
                @Override public InputStream getInputStream(){
                    var input=super.getInputStream();
                    if(!role.equals("COMPLETION")||completionFailure!=CompletionFailure.SOURCE_WITHDRAWAL)return input;
                    return new java.io.FilterInputStream(input){
                        @Override public int read(byte[] bytes,int offset,int length)throws java.io.IOException{
                            int count=super.read(bytes,offset,length);if(count<0)completionReplyConsumed.set(true);return count;
                        }
                    };
                }
                @Override public void disconnect(){
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                    assertNotNull(owned);assertTrue("Original bytes owned until disconnect settles",Arrays.equals(owned,copy));
                    var control=currentControl.get();if(control!=null){assertFalse(Thread.holdsLock(control));assertThrows("No early loan retirement",VaultFailure.class,control::beginPiece);}
                    super.disconnect();
                }
                void wipe(){body.wipe();if(copy!=null)Arrays.fill(copy,(byte)0);if(owned!=null)Arrays.fill(owned,(byte)0);Arrays.fill(response,(byte)0);headers.clear();}
            }
            var http=new NativePrivateCustodyHttp(url->{
                String role=stage.get();
                if(sealedCheck!=null&&sealedCheck.usesSavedBrowserPublication()){
                    if(NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH.equals(url.getPath()))role="MANAGER";
                    else if(NativeSameOriginalCompletionReadEnvelope.PATH.equals(url.getPath()))role="COMPLETION";
                    else if(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH.equals(url.getPath()))role="CURRENT";
                    else if(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH.equals(url.getPath()))role="TARGET";
                }
                String path=switch(role){
                    case "WRITE","QUERY" -> VaultEngine.NativePrivateCustodyPreparedExchange.PATH;
                    case "CURRENT" -> VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH;
                    case "TARGET" -> VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH;
                    case "CHALLENGE" -> NativeSameOriginalRecoveryChallengeEnvelope.PATH;
                    case "STATUS" -> NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH;
                    case "MANAGER" -> NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH;
                    case "COMPLETION" -> NativeSameOriginalCompletionReadEnvelope.PATH;
                    default -> throw new AssertionError("No further transport admitted by this case");};
                assertEquals(NativePrivateCustodyHttp.ORIGIN+path,url.toString());
                assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                counts.merge(role,1,Integer::sum);var connection=new OwningConnection(url,role);connections.add(connection);return connection;
            },f.clock);
            VaultEngine.NativePrivateCustodyCurrentFrameRead read=null;
            VaultEngine.NativeSameOriginalRecoveryTargetObservation targetOwner=null;
            VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent=null;
            VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared=null;
            NativePrivateCustodyFrameReadControl control=null;Throwable primary=null;
            try{
                int count=f.plan.projection().getInt("chunk_count");assertTrue(count>0);
                for(int i=0;i<count;i++){
                    stage.set("WRITE");try(var write=f.write(i)){
                        expected.set(write.projection());var attempt=new NativeRetainedHttp.Attempt();Throwable setupFailure=null;
                        try{f.engine.sendOriginalPrivateCustodyExchange(write,http,attempt);}
                        catch(Exception|Error failure){setupFailure=failure;throw failure;}
                        finally{try{attempt.cancel();}catch(RuntimeException|Error cleanup){if(setupFailure!=null)setupFailure.addSuppressed(cleanup);else throw cleanup;}}
                    }witness.observeNew();
                    stage.set("QUERY");try(var query=f.query(i)){
                        expected.set(query.projection());var attempt=new NativeRetainedHttp.Attempt();Throwable setupFailure=null;
                        try{f.engine.sendOriginalPrivateCustodyExchange(query,http,attempt);}
                        catch(Exception|Error failure){setupFailure=failure;throw failure;}
                        finally{try{attempt.cancel();}catch(RuntimeException|Error cleanup){if(setupFailure!=null)setupFailure.addSuppressed(cleanup);else throw cleanup;}}
                    }witness.observeNew();
                }
                assertEquals(count,(int)counts.getOrDefault("WRITE",0));assertEquals(count,(int)counts.getOrDefault("QUERY",0));
                var query=ProviderWireJson.object(observedBodies.get("QUERY:0"),NativeRetainedAttempt.MAX_BODY);
                byte[] proofBytes=java.util.Base64.getDecoder().decode(query.getString("owner_proof_base64"));
                try{var proof=ProviderWireJson.object(proofBytes,262144);var target=new JSONObject();
                    for(String name:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"})target.put(name,query.get(name));
                    for(String name:new String[]{"credential_id","original_wire_sha256","capsule_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})target.put(name,proof.get(name));
                    // Existing target WireTest/owning recipe's four unverified
                    // SYNTHETIC server mappings, never a verified principal.
                    target.put("employee_id",principal.getString("employee_id")).put("assignment_epoch",principal.get("assignment_epoch").toString())
                        .put("canonical_device_id",principal.getString("device_id")).put("separation_id","95000000-0000-4000-8000-000000000101")
                        .put("separation_authority_revision","7").put("canonical_device_pk","95000000-0000-4000-8000-000000000102")
                        .put("original_credential_secret_key_id","c".repeat(64));targetData.set(target);
                }finally{Arrays.fill(proofBytes,(byte)0);}
                control=new NativePrivateCustodyFrameReadControl();currentControl.set(control);
                stage.set("CURRENT");
                if(sealedCheck!=null&&sealedCheck.currentFrameCase(f,http,control)){
                    assertEquals("Preflight refuses before any current HTTP",0,(int)counts.getOrDefault("CURRENT",0));witness.same();return;
                }
                if(completionFailure==CompletionFailure.CURRENT_READ_SOURCE||completionFailure==CompletionFailure.CURRENT_READ_CLOCK){
                    final boolean expiredClock=completionFailure==CompletionFailure.CURRENT_READ_CLOCK;
                    final long originalClock=f.clock.now;var old=coldOriginals(f);var oldInodes=coldInodes(old);
                    var path=f.dir.resolve("query_unknown-0.bin");
                    var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                    String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            var stack=Thread.currentThread().getStackTrace();
                            if(!fired.get()&&currentReplyObserved.get()
                                &&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("readCurrentOriginalPrivateCustodyQueryPiece")))
                                for(var frame:stack)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&frame.getMethodName().equals("requireCurrentQueryDispatchCurrent")){
                                    sites.add(frame.getLineNumber());
                                    if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                        if(expiredClock)f.clock.now=originalClock+120_001L;
                                        else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                    }catch(Exception failure){throw new AssertionError("Current response terminal Source prerequisite",failure);}break;
                                }
                            return super.entrySet();
                        }
                    });
                    try{
                        var liveControl=control;
                        var failure=assertThrows("Actual returned CURRENT bytes cannot escape a late original withdrawal",VaultFailure.class,
                            ()->f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,liveControl));
                        assertTrue(currentReplyObserved.get());assertTrue(fired.get());assertEquals(2,sites.size());
                        assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getMethodName().equals("requireCurrentQueryDispatchCurrent")));
                        assertEquals(1,(int)counts.getOrDefault("CURRENT",0));assertEquals(0,(int)counts.getOrDefault("TARGET",0));
                        assertEquals(0,(int)counts.getOrDefault("MANAGER",0));assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                        source.unknown.put(namespace,originalMap);assertArrayEquals(expiredClock?original:changed,Files.readAllBytes(path));
                        assertEquals(before.fileKey(),Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                        f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        // Cleanup only, not another CURRENT attempt or renewed
                        // control: the actual IO owner has settled and wiped.
                        var piece=liveControl.beginPiece();try{piece.check();}finally{liveControl.endPiece(piece);}
                        for(var raw:connections){var actual=(OwningConnection)raw;assertEquals(1,actual.disconnects);
                            assertArrayEquals(new byte[actual.owned.length],actual.owned);}
                        coldSame(old,oldInodes);witness.same();return;
                    }finally{f.clock.now=originalClock;source.unknown.put(namespace,originalMap);
                        Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control);coldNoAuthority(read.projection());
                assertEquals(count,(int)counts.getOrDefault("CURRENT",0));
                stage.set("TARGET");
                if(sealedCheck!=null&&sealedCheck.targetCase(f,read,http,control)){
                    assertEquals("One actual TARGET response precedes terminal refusal",1,(int)counts.getOrDefault("TARGET",0));
                    witness.same();return;
                }
                targetOwner=read.takeOriginalRecoveryTarget(http);
                if(firstPair&&sealedCheck!=null&&sealedCheck.firstPairCase(f,targetOwner,control)){witness.observeNew();return;}
                JSONObject intentProjection=null;
                if(firstPair)prepared=targetOwner.takeFirstOriginalChallengeRequest();
                else{
                    intent=targetOwner.takeOriginalPreparationIntent();intentProjection=intent.projection();
                    if(sealedCheck!=null&&sealedCheck.intentOnly()){witness.observeNew();sealedCheck.checkIntent(f,intent,control);return;}
                    prepared=intent.takeOriginalChallengeRequest();
                }
                var preparedProjection=prepared.projection();witness.observeNew();
                assertFalse(preparedProjection.getBoolean("unknown_fence_observed"));
                if(!firstPair)assertTrue(intentProjection.getString("native_challenge_intent_id").equals(preparedProjection.getString("native_request_id")));
                else{
                    assertTrue(preparedProjection.getBoolean("original_request_committed_observed"));
                    assertTrue(Files.exists(f.dir.resolve("recovery_intent-0.bin")));assertTrue(Files.exists(f.dir.resolve("recovery_request-0.bin")));
                    assertFalse(Files.exists(f.dir.resolve("recovery_intent-0.pending")));assertFalse(Files.exists(f.dir.resolve("recovery_request-0.pending")));
                    assertFalse(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                }
                if(sealedCheck!=null&&sealedCheck.existingRequestOnly()){
                    if(sealedCheck.existingRequestAfterChallenge()){
                        // Actual first owner creates its own UNKNOWN/reply
                        // through normal typed transport before it closes.
                        // Reopening never seeds a marker or grants a resend.
                        expected.set(preparedProjection);stage.set("CHALLENGE");
                        f.engine.sendOriginalRecoveryChallenge(prepared,http,control);witness.observeNew();
                    }
                    // Settle the actual first owner. The next invocation reads
                    // the SAME immutable records through a fresh native scope;
                    // no private owner/validation flag is manufactured.
                    prepared.close();prepared=null;intent=null;targetOwner=null;read=null;
                    control.close();control=null;currentControl.set(null);
                    control=new NativePrivateCustodyFrameReadControl();currentControl.set(control);
                    stage.set("CURRENT");read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control);
                    assertEquals(count*2,(int)counts.getOrDefault("CURRENT",0));
                    stage.set("TARGET");targetOwner=read.takeOriginalRecoveryTarget(http);intent=targetOwner.takeExistingOriginalPreparationIntent();
                    if(sealedCheck.existingBrowserPublicationCase(f,intent,http,control)){witness.observeNew();witness.same();return;}
                    sealedCheck.checkExistingRequest(f,intent,preparedProjection,control);
                    assertEquals(2,(int)counts.getOrDefault("TARGET",0));
                    assertEquals(sealedCheck.existingRequestAfterChallenge()?1:0,(int)counts.getOrDefault("CHALLENGE",0));assertEquals(0,(int)counts.getOrDefault("STATUS",0));
                    witness.same();return;
                }
                if(sealedCheck!=null){sealedCheck.check(f,prepared,control);return;}
                expected.set(preparedProjection);stage.set("CHALLENGE");
                if(completionFailure==CompletionFailure.RESPONSE_PUBLICATION_CANCELED){
                    var old=coldOriginals(f);var oldInodes=coldInodes(old);
                    String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                    var file=f.dir.resolve("recovery_observation-0.bin");var liveControl=control;
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            if(armed.get()&&!fired.get())try{
                                if(Files.exists(file)&&Files.size(file)>64&&fired.compareAndSet(false,true))liveControl.requestCancellation();
                            }catch(java.io.IOException failure){throw new AssertionError("Actual response publication prerequisite",failure);}
                            return super.entrySet();
                        }
                    });
                    try{
                        var actualPrepared=prepared;
                        var failure=assertThrows("No result escapes cancellation during its real response publication",VaultFailure.class,
                            ()->f.engine.sendOriginalRecoveryChallenge(actualPrepared,http,liveControl));
                        armed.set(false);source.unknown.put(namespace,map);
                        assertTrue("Cancellation must reach actual persisted reply, not an earlier refusal",fired.get());
                        assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                        assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));assertEquals(0,(int)counts.getOrDefault("STATUS",0));
                        coldSame(old,oldInodes);assertTrue(Files.exists(file));assertTrue(Files.size(file)>64);
                        assertTrue(Files.exists(f.dir.resolve("recovery_unknown-0.bin")));
                        assertThrows(VaultFailure.class,liveControl::check);
                        var retained=coldOriginals(f);var retainedInodes=coldInodes(retained);
                        try{
                            assertThrows("Canceled original cannot authorize a second challenge",VaultFailure.class,
                                ()->f.engine.sendOriginalRecoveryChallenge(actualPrepared,http,liveControl));
                            assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));coldSame(retained,retainedInodes);coldSame(old,oldInodes);
                        }finally{for(var bytes:retained.values())Arrays.fill(bytes,(byte)0);}
                        witness.observeNew();witness.same();return;
                    }finally{armed.set(false);source.unknown.put(namespace,map);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                var sent=f.engine.sendOriginalRecoveryChallenge(prepared,http,control);owningRecoveryNoEffects(sent);
                assertTrue(sent.getBoolean("native_receipt_metadata_validated"));assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));
                witness.observeNew();
                if(completionFailure==CompletionFailure.STATUS_TAKE_SOURCE||completionFailure==CompletionFailure.STATUS_TAKE_CLOCK){
                    var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("query_unknown-0.bin");
                    var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                    String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);long originalClock=f.clock.now;
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var liveControl=control;var actualPrepared=prepared;
                    int connectionsBefore=connections.size();
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            var stack=Thread.currentThread().getStackTrace();
                            if(Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("takeFixedBirth"))
                                &&fired.compareAndSet(false,true))try{
                                if(completionFailure==CompletionFailure.STATUS_TAKE_CLOCK)f.clock.now=originalClock+120_001L;
                                else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                            }catch(Exception failure){throw new AssertionError("Actual fixed birth/take Source prerequisite",failure);}
                            return super.entrySet();
                        }
                    });
                    try{
                        var failure=assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalManagerPreparation(actualPrepared,http,liveControl));
                        assertTrue(fired.get());assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getMethodName().equals("takeFixedBirth")));
                        assertEquals("A failed actual birth cannot open another HTTP connection",connectionsBefore,connections.size());
                        assertEquals(0,(int)counts.getOrDefault("MANAGER",0));assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                        source.unknown.put(namespace,map);f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        assertThrows("Restored bytes/time cannot rearm consumed fixed birth",VaultFailure.class,
                            ()->f.engine.readCurrentOriginalManagerPreparation(actualPrepared,http,liveControl));
                        assertEquals(0,(int)counts.getOrDefault("MANAGER",0));coldSame(old,oldInodes);witness.same();liveControl.check();return;
                    }finally{source.unknown.put(namespace,map);f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                if(completionFailure==CompletionFailure.STATUS_SOURCE_CANCELED){
                    var old=coldOriginals(f);var oldInodes=coldInodes(old);
                    String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                    var liveControl=control;
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                                if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&frame.getMethodName().equals("prepareRecoveryStatusUnknown")){
                                    if(fired.compareAndSet(false,true))liveControl.requestCancellation();break;
                                }
                            return super.entrySet();
                        }
                    });
                    try{
                        stage.set("STATUS");var actualPrepared=prepared;
                        var failure=assertThrows("Actual status birth must honor Source cancellation before any status HTTP",VaultFailure.class,
                            ()->f.engine.readOriginalRecoveryChallengeStatus(actualPrepared,http,liveControl));
                        armed.set(false);source.unknown.put(namespace,map);
                        assertTrue("Cancellation must reach the owning status transaction",fired.get());
                        assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                        assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));assertEquals(0,(int)counts.getOrDefault("STATUS",0));
                        coldSame(old,oldInodes);witness.same();assertThrows(VaultFailure.class,liveControl::check);
                        assertThrows("Canceled status cannot obtain another request",VaultFailure.class,
                            ()->f.engine.readOriginalRecoveryChallengeStatus(actualPrepared,http,liveControl));
                        assertEquals(0,(int)counts.getOrDefault("STATUS",0));coldSame(old,oldInodes);return;
                    }finally{armed.set(false);source.unknown.put(namespace,map);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                if(completionFailure==CompletionFailure.EXISTING_OBSERVATION_CHANGED_SOURCE){
                    var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_observation-0.bin");
                    var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                    String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
                    var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                    var sourceLines=new java.util.HashSet<Integer>();
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            if(armed.get()&&!fired.get())for(var frame:Thread.currentThread().getStackTrace())
                                if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                    sourceLines.add(frame.getLineNumber());
                                    // Entry, locked readback, then LAST full
                                    // plan Source. Fixed returned-frame crypto
                                    // has no nested Source callback. Both
                                    // actual records were authenticated before
                                    // this third distinct owned Source site.
                                    if(sourceLines.size()==3&&fired.compareAndSet(false,true))try{
                                        Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                    }catch(Exception failure){throw new AssertionError("Existing reply LAST Source mutation prerequisite",failure);}
                                    break;
                                }
                            return super.entrySet();
                        }
                    });
                    try{
                        var actualPrepared=prepared;
                        assertThrows("Changed actual reply cannot produce an observation",VaultFailure.class,
                            ()->f.engine.observeOriginalRecoveryChallengeOutcome(actualPrepared));
                        armed.set(false);source.unknown.put(namespace,map);control.check();assertTrue(fired.get());assertEquals(3,sourceLines.size());
                        assertArrayEquals(changed,Files.readAllBytes(path));
                        var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                        Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        assertThrows("Restoring bytes cannot revive this refused read owner",VaultFailure.class,
                            ()->f.engine.observeOriginalRecoveryChallengeOutcome(actualPrepared));
                        assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));assertEquals(0,(int)counts.getOrDefault("STATUS",0));
                        coldSame(old,oldInodes);witness.same();return;
                    }finally{armed.set(false);source.unknown.put(namespace,map);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);
                        for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                }
                if(firstPair){
                    var observed=f.engine.observeOriginalRecoveryChallengeOutcome(prepared);owningRecoveryNoEffects(observed);
                    assertTrue(observed.getBoolean("native_receipt_metadata_validated"));
                    assertEquals(sent.get("original_observation_record_sha256"),observed.get("original_observation_record_sha256"));witness.same();
                }
                // Empty coordination probe only, NOT a resend/new request or
                // renewed original frame: successful Engine cleanup ended IO.
                var probe=control.beginPiece();try{probe.check();}finally{control.endPiece(probe);}
                var fixedNames=new java.util.TreeSet<String>();try(var paths=Files.newDirectoryStream(f.dir)){for(var path:paths)fixedNames.add(path.getFileName().toString());}
                if(manager){
                    if(completionFailure==CompletionFailure.MANAGER_SUMMARY_CHANGED_SOURCE
                        ||completionFailure==CompletionFailure.MANAGER_SUMMARY_EXPIRED_QUERY){
                        final boolean expiredClock=completionFailure==CompletionFailure.MANAGER_SUMMARY_EXPIRED_QUERY;
                        final long originalClock=f.clock.now;
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_unknown-0.bin");
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                        source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                var stack=Thread.currentThread().getStackTrace();
                                if(!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("copyRecoveryStatusResponse"))
                                    &&Arrays.stream(stack).noneMatch(s->s.getMethodName().equals("captureReadResponse")))
                                    for(var frame:stack)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                        &&frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                        sites.add(frame.getLineNumber());
                                        // Actual complete terminal Source
                                        // AFTER this response's summary IO.
                                        if(fired.compareAndSet(false,true))try{
                                            if(expiredClock)f.clock.now=originalClock+120_001L;
                                            else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                        }catch(Exception failure){throw new AssertionError("Manager summary Source mutation prerequisite",failure);}break;
                                    }
                                return super.entrySet();
                            }
                        });
                        try{
                            stage.set("MANAGER");var actualPrepared=prepared;var liveControl=control;
                            assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalManagerPreparation(actualPrepared,http,liveControl));
                            source.unknown.put(namespace,originalMap);assertTrue(fired.get());assertEquals(1,sites.size());
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                            assertArrayEquals(expiredClock?original:changed,Files.readAllBytes(path));
                            assertEquals(before.fileKey(),Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                            f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restored bytes cannot revive the refused actual response",VaultFailure.class,actualPrepared::projection);
                            assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalManagerPreparation(actualPrepared,http,liveControl));
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));coldSame(old,oldInodes);witness.same();return;
                        }finally{f.clock.now=originalClock;source.unknown.put(namespace,originalMap);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                    stage.set("MANAGER");var observed=f.engine.readCurrentOriginalManagerPreparation(prepared,http,control);owningRecoveryNoEffects(observed);
                    var data=observed.getJSONObject("manager_preparation_observation");assertFalse(data.getBoolean("transaction_authority"));owningRecoveryNoEffects(data.getJSONObject("limits"));
                    if(completionFailure==CompletionFailure.MANAGER_UNKNOWN_CHANGED){
                        // The actual initial manager READ of synthetic DATA
                        // returned and its status dispatch/HTTP are closed.
                        // This is not a genuine named-manager proof. Mutate the
                        // original local UNKNOWN before the next owning call.
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_unknown-0.bin");
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        try{
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));stage.set("COMPLETION");
                            Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            var actualPrepared=prepared;var liveControl=control;
                            assertThrows("Changed original UNKNOWN invalidates the actual manager lease before completion HTTP",VaultFailure.class,
                                ()->f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl));
                            liveControl.check();assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                            var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                            assertArrayEquals(changed,Files.readAllBytes(path));
                            Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restoring UNKNOWN cannot revive the refused original source",VaultFailure.class,actualPrepared::projection);
                            assertThrows(VaultFailure.class,()->f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl));
                            assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));coldSame(old,oldInodes);witness.same();return;
                        }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                    stage.set("COMPLETION");
                    if(completionFailure==CompletionFailure.COMPLETION_BIRTH_QUERY_CHANGED_SOURCE
                        ||completionFailure==CompletionFailure.COMPLETION_BIRTH_QUERY_UNKNOWN_CHANGED_SOURCE){
                        assertNotNull(originalCompletionArguments);assertTrue(originalCompletionArguments.length>0);
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);
                        var path=f.dir.resolve(completionFailure==CompletionFailure.COMPLETION_BIRTH_QUERY_CHANGED_SOURCE
                            ?"query-0.bin":"query_unknown-0.bin");
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();var armed=new java.util.concurrent.atomic.AtomicBoolean(true);
                        var sites=new java.util.HashSet<Integer>();int opened=connections.size();
                        source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                var stack=Thread.currentThread().getStackTrace();
                                String journal=VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal";
                                if(armed.get()&&!fired.get()
                                    &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(journal)&&s.getMethodName().equals("prepareCompletionDispatch"))
                                    &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(VaultEngine.class.getName()+"$NativeSameOriginalCompletionReadDispatch")&&s.getMethodName().equals("takeRequest")))
                                    for(int i=0;i+1<stack.length;i++)if(stack[i].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyChunkIdentityPlan")
                                        &&stack[i].getMethodName().equals("requireCurrent")&&stack[i+1].getClassName().equals(journal)
                                        &&stack[i+1].getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                        // Only the enclosing guard's direct
                                        // entry/terminal full-plan sites count;
                                        // nested restoration/signing callbacks
                                        // cannot masquerade as the LAST site.
                                        sites.add(stack[i+1].getLineNumber());
                                        if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                            try(var probe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),java.nio.file.StandardOpenOption.WRITE)){
                                                assertThrows(java.nio.channels.OverlappingFileLockException.class,probe::tryLock);
                                            }
                                            Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                        }catch(Exception failure){throw new AssertionError("Completion birth LAST Source mutation prerequisite",failure);}
                                        break;
                                    }
                                return super.entrySet();
                            }
                        });
                        try{
                            var actualPrepared=prepared;var liveControl=control;
                            var failure=assertThrows("Actual completion birth must refuse changed original before HTTP",VaultFailure.class,
                                ()->f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl));
                            armed.set(false);source.unknown.put(namespace,originalMap);
                            assertTrue("Actual completion birth terminal Source callback reached",fired.get());assertEquals(2,sites.size());
                            assertEquals(NativeRetainedAttempt.FAILURE,failure.code);assertEquals(0,failure.getSuppressed().length);
                            assertTrue("Refusal came through actual completion birth",Arrays.stream(failure.getStackTrace()).anyMatch(s->
                                s.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")&&s.getMethodName().equals("prepareCompletionDispatch")));
                            assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->
                                s.getClassName().equals(VaultEngine.class.getName()+"$NativeSameOriginalCompletionReadDispatch")&&s.getMethodName().equals("takeRequest")));
                            assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));assertEquals(0,completionAwait.get());assertEquals(opened,connections.size());
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(1,(int)counts.getOrDefault("CHALLENGE",0));
                            assertFalse(Thread.currentThread().isInterrupted());liveControl.check();
                            assertArrayEquals(changed,Files.readAllBytes(path));
                            var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                            assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                            for(var entry:old.entrySet())if(!entry.getKey().equals(path))assertArrayEquals(entry.getValue(),Files.readAllBytes(entry.getKey()));
                            Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restored original bytes cannot revive refused prepared owner",VaultFailure.class,actualPrepared::projection);
                            var duplicate=assertThrows("Same consumed completion read cannot dispatch again",VaultFailure.class,
                                ()->f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl));
                            assertEquals(NativeRetainedAttempt.FAILURE,duplicate.code);liveControl.check();
                            assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));assertEquals(opened,connections.size());
                            var nowNames=new java.util.TreeSet<String>();try(var paths=Files.newDirectoryStream(f.dir)){for(var file:paths)nowNames.add(file.getFileName().toString());}
                            assertEquals(fixedNames,nowNames);coldSame(old,oldInodes);witness.same();return;
                        }finally{armed.set(false);source.unknown.put(namespace,originalMap);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);
                            for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                    if(completionFailure==CompletionFailure.BROWSER_ABSENCE_LAST_SOURCE_ORPHAN){
                        var actualRead=(VaultEngine.NativePrivateCustodyCurrentFrameRead)NativePrivateCustodyExchangeTest.field(prepared,"originalRead");
                        var actualPlan=(VaultEngine.NativePrivateCustodyChunkIdentityPlan)NativePrivateCustodyExchangeTest.field(actualRead,"plan");
                        var actualJournal=(VaultEngine.NativePrivateCustodyExchangeJournal)NativePrivateCustodyExchangeTest.field(actualRead,"journal");
                        var liveControl=control;int opened=connections.size();
                        try(var absent=f.engine.readSavedOriginalBrowserLocalData(actualPlan,actualJournal,liveControl)){assertNull(absent);}
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var orphan=f.dir.resolve("browser_chunk-0.pending");
                        assertFalse(Files.exists(orphan));String namespace="MemphisZooCustodialNativeVaultV1";
                        var originalMap=source.unknown.get(namespace);var fired=new java.util.concurrent.atomic.AtomicBoolean();
                        var heldProbes=new java.util.ArrayList<java.nio.channels.FileChannel>();
                        source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                var stack=Thread.currentThread().getStackTrace();
                                boolean decoding=Arrays.stream(stack).anyMatch(s->s.getClassName().equals(VaultEngine.class.getName())
                                    &&s.getMethodName().equals("decodeSavedOriginalBrowserLocalData"));
                                boolean absence=decoding&&Arrays.stream(stack).anyMatch(s->
                                    s.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                    &&s.getMethodName().equals("read"));
                                if(absence&&!fired.get())try{
                                    var probe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),
                                        java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                    boolean retained=false;
                                    try{
                                        try(var available=probe.tryLock()){
                                            // The read's entry Source runs outside its journal lock.
                                        }catch(java.nio.channels.OverlappingFileLockException held){
                                            // Do not close a second descriptor to a process-locked file
                                            // until the actual owning operation has released its lock.
                                            heldProbes.add(probe);retained=true;
                                            if(fired.compareAndSet(false,true))Files.write(orphan,new byte[]{1},java.nio.file.StandardOpenOption.CREATE_NEW);
                                        }
                                    }finally{if(!retained)probe.close();}
                                }catch(Exception failure){throw new AssertionError("Locked absence Source fault prerequisite",failure);}
                                return super.entrySet();
                            }
                        });
                        try{
                            assertThrows("An orphan added during the last locked Source cannot become absent DATA",VaultFailure.class,
                                ()->f.engine.readSavedOriginalBrowserLocalData(actualPlan,actualJournal,liveControl));
                            assertTrue("Actual locked terminal Source reached",fired.get());assertArrayEquals(new byte[]{1},Files.readAllBytes(orphan));
                            assertEquals(opened,connections.size());assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                            coldSame(old,oldInodes);witness.same();return;
                        }finally{source.unknown.put(namespace,originalMap);for(var heldProbeChannel:heldProbes)heldProbeChannel.close();if(fired.get())Files.delete(orphan);
                            for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                    if(completionFailure==CompletionFailure.PRE_CAPTURE_DATA_NORMAL
                        ||completionFailure==CompletionFailure.PRE_CAPTURE_DATA_SOURCE
                        ||completionFailure==CompletionFailure.PRE_CAPTURE_DATA_CLOCK
                        ||completionFailure==CompletionFailure.PRE_CAPTURE_DATA_ORPHAN){
                        var completed=f.engine.readOriginalNativeCompletions(prepared,http,control);owningRecoveryNoEffects(completed);
                        assertEquals(1,completed.getInt("selected_argument_count"));
                        final long originalClock=f.clock.now;
                        final boolean expiredClock=completionFailure==CompletionFailure.PRE_CAPTURE_DATA_CLOCK;
                        final boolean orphanFault=completionFailure==CompletionFailure.PRE_CAPTURE_DATA_ORPHAN;
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_unknown-0.bin");
                        var orphan=f.dir.resolve("browser_chunk-7.pending");assertFalse(Files.exists(orphan));
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                        try{
                            if(completionFailure==CompletionFailure.PRE_CAPTURE_DATA_NORMAL){
                                var preCaptureData=prepareActualOriginalBrowserData(prepared);
                                try{
                                    var ownedArguments=(java.util.List<byte[]>)NativePrivateCustodyExchangeTest.field(preCaptureData,"arguments");
                                    assertEquals(1,ownedArguments.size());assertArrayEquals(originalCompletionArguments,ownedArguments.get(0));
                                    assertNull(NativePrivateCustodyExchangeTest.field(preCaptureData,"saved"));
                                    var semantics=new JSONObject((String)NativePrivateCustodyExchangeTest.field(preCaptureData,"nativeSemantics"));
                                    assertEquals(NativeRetainedNamespaceCompletionJoin.SCHEMA,semantics.getString("schema"));
                                    assertEquals(1,semantics.getInt("argument_candidate_count"));
                                    for(String flag:new String[]{"inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed",
                                        "key_removal","phone_released","browser_source_authenticated"})assertFalse(flag,semantics.getBoolean(flag));
                                    var compare=preCaptureData.getClass().getDeclaredMethod("matchesCompleteArguments",java.util.List.class);compare.setAccessible(true);
                                    byte[] candidate=ownedArguments.get(0).clone();
                                    try{synchronized(f.engine){
                                        assertEquals(Boolean.TRUE,compare.invoke(preCaptureData,java.util.List.of(candidate)));
                                        candidate[0]^=1;assertEquals(Boolean.FALSE,compare.invoke(preCaptureData,java.util.List.of(candidate)));
                                        assertEquals(Boolean.FALSE,compare.invoke(preCaptureData,java.util.List.of()));
                                    }}finally{Arrays.fill(candidate,(byte)0);}
                                    ((AutoCloseable)preCaptureData).close();
                                    assertArrayEquals(new byte[ownedArguments.get(0).length],ownedArguments.get(0));
                                    var actualSet=NativePrivateCustodyExchangeTest.field(prepared,"completionDispositions");
                                    var stillOwned=copyActualOriginalArgumentData(actualSet);
                                    try{assertArrayEquals(originalCompletionArguments,stillOwned.get(0));}
                                    finally{NativeRetainedCompletionCensus.wipe(stillOwned);}
                                }finally{((AutoCloseable)preCaptureData).close();}
                                coldSame(old,oldInodes);witness.same();return;
                            }
                            source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                    var stack=Thread.currentThread().getStackTrace();
                                    if(!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("prepareOriginalBrowserData")))
                                        for(var frame:stack)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                            &&frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                            sites.add(frame.getLineNumber());
                                            if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                                if(expiredClock)f.clock.now=originalClock+120_001L;
                                                else if(orphanFault)Files.write(orphan,new byte[]{1},java.nio.file.StandardOpenOption.CREATE_NEW);
                                                else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                            }catch(Exception failure){throw new AssertionError("Pre-capture DATA final Source prerequisite",failure);}break;
                                        }
                                    return super.entrySet();
                                }
                            });
                            var actualPrepared=prepared;
                            assertThrows("Late original/absence withdrawal cannot publish DATA or start capture",VaultFailure.class,
                                ()->prepareActualOriginalBrowserData(actualPrepared));
                            assertTrue(fired.get());assertEquals(2,sites.size());source.unknown.put(namespace,originalMap);
                            assertArrayEquals(expiredClock||orphanFault?original:changed,Files.readAllBytes(path));
                            if(orphanFault){assertArrayEquals(new byte[]{1},Files.readAllBytes(orphan));Files.delete(orphan);}
                            assertFalse(Files.exists(f.dir.resolve("browser_frame-0.bin")));
                            f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restored bytes/clock/absence cannot revive the refused owner",VaultFailure.class,actualPrepared::projection);
                            assertThrows(VaultFailure.class,()->prepareActualOriginalBrowserData(actualPrepared));
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));
                            coldSame(old,oldInodes);witness.same();return;
                        }finally{
                            f.clock.now=originalClock;source.unknown.put(namespace,originalMap);
                            if(orphanFault&&fired.get()&&Files.exists(orphan)){assertArrayEquals(new byte[]{1},Files.readAllBytes(orphan));Files.delete(orphan);}
                            Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);
                        }
                    }
                    if(completionFailure==CompletionFailure.PREPARED_NATIVE_DATA_NORMAL
                        ||completionFailure==CompletionFailure.PREPARED_NATIVE_DATA_SOURCE
                        ||completionFailure==CompletionFailure.PREPARED_NATIVE_DATA_CLOCK){
                        var completed=f.engine.readOriginalNativeCompletions(prepared,http,control);owningRecoveryNoEffects(completed);
                        assertEquals(1,completed.getInt("selected_argument_count"));assertEquals(0,completed.getInt("accepted_count"));
                        var actualSet=NativePrivateCustodyExchangeTest.field(prepared,"completionDispositions");
                        var arguments=copyActualOriginalArgumentData(actualSet);
                        assertEquals(1,arguments.size());assertArrayEquals(originalCompletionArguments,arguments.get(0));
                        final long originalClock=f.clock.now;
                        final boolean expiredClock=completionFailure==CompletionFailure.PREPARED_NATIVE_DATA_CLOCK;
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_unknown-0.bin");
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                        try{
                            if(completionFailure==CompletionFailure.PREPARED_NATIVE_DATA_NORMAL){
                                var semanticData=inspectActualPreparedNativeCompletionData(prepared,arguments);
                                assertEquals(NativeRetainedNamespaceCompletionJoin.SCHEMA,semanticData.getString("schema"));
                                assertEquals(1,semanticData.getInt("argument_candidate_count"));assertTrue(semanticData.getInt("record_count")>0);
                                for(String flag:new String[]{"inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed",
                                    "key_removal","phone_released","browser_source_authenticated"})assertFalse(flag,semanticData.getBoolean(flag));
                                assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));
                                coldSame(old,oldInodes);witness.same();return;
                            }
                            source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                    var stack=Thread.currentThread().getStackTrace();
                                    if(!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("inspectPreparedNativeCompletionData")))
                                        for(var frame:stack)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                            &&frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent")){
                                            sites.add(frame.getLineNumber());
                                            // Actual terminal prepared/UNKNOWN
                                            // Source AFTER native census/join IO.
                                            if(sites.size()==2&&fired.compareAndSet(false,true))try{
                                                if(expiredClock)f.clock.now=originalClock+120_001L;
                                                else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                            }catch(Exception failure){throw new AssertionError("Prepared native DATA last-Source prerequisite",failure);}break;
                                        }
                                    return super.entrySet();
                                }
                            });
                            var actualPrepared=prepared;
                            var failure=assertThrows("Late original withdrawal cannot publish native semantic DATA",VaultFailure.class,
                                ()->inspectActualPreparedNativeCompletionData(actualPrepared,arguments));
                            assertTrue("Actual complete terminal Source was reached",fired.get());assertEquals(2,sites.size());
                            if(expiredClock)assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getMethodName().equals("requireFresh")));
                            source.unknown.put(namespace,originalMap);
                            assertArrayEquals(expiredClock?original:changed,Files.readAllBytes(path));
                            assertEquals(before.fileKey(),Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                            f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restoring original bytes/clock cannot revive the refused owner",VaultFailure.class,actualPrepared::projection);
                            assertThrows(VaultFailure.class,()->inspectActualPreparedNativeCompletionData(actualPrepared,arguments));
                            assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));
                            coldSame(old,oldInodes);witness.same();return;
                        }finally{
                            f.clock.now=originalClock;source.unknown.put(namespace,originalMap);NativeRetainedCompletionCensus.wipe(arguments);
                            Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);
                        }
                    }
                    if(completionFailure==CompletionFailure.COMPLETION_SET_TERMINAL_SOURCE
                        ||completionFailure==CompletionFailure.COMPLETION_COPY_TERMINAL_SOURCE
                        ||completionFailure==CompletionFailure.COMPLETION_SET_TERMINAL_CLOCK
                        ||completionFailure==CompletionFailure.COMPLETION_COPY_TERMINAL_CLOCK){
                        final boolean privateCopy=completionFailure==CompletionFailure.COMPLETION_COPY_TERMINAL_SOURCE
                            ||completionFailure==CompletionFailure.COMPLETION_COPY_TERMINAL_CLOCK;
                        final boolean expiredClock=completionFailure==CompletionFailure.COMPLETION_SET_TERMINAL_CLOCK
                            ||completionFailure==CompletionFailure.COMPLETION_COPY_TERMINAL_CLOCK;
                        final long originalClock=f.clock.now;
                        if(privateCopy){
                            var completed=f.engine.readOriginalNativeCompletions(prepared,http,control);owningRecoveryNoEffects(completed);
                            assertEquals(1,completed.getInt("selected_argument_count"));assertEquals(0,completed.getInt("accepted_count"));
                        }
                        final Object copyOwner=privateCopy?NativePrivateCustodyExchangeTest.field(prepared,"completionDispositions"):null;
                        if(privateCopy){
                            assertNotNull(copyOwner);var copied=copyActualOriginalArgumentData(copyOwner);
                            try{
                                assertEquals(1,copied.size());assertArrayEquals(originalCompletionArguments,copied.get(0));
                                copied.get(0)[0]^=1;
                                var again=copyActualOriginalArgumentData(copyOwner);
                                try{assertArrayEquals("Caller mutation never changes the original group",originalCompletionArguments,again.get(0));}
                                finally{NativeRetainedCompletionCensus.wipe(again);}
                            }finally{NativeRetainedCompletionCensus.wipe(copied);}
                        }
                        var old=coldOriginals(f);var oldInodes=coldInodes(old);var path=f.dir.resolve("recovery_unknown-0.bin");
                        var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
                        String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                        var fired=new java.util.concurrent.atomic.AtomicBoolean();
                        source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                            @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                var stack=Thread.currentThread().getStackTrace();
                                String setClass=VaultEngine.class.getName()+"$NativeOriginalCompletionDispositionSet";
                                if(!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(setClass)
                                        &&s.getMethodName().equals(privateCopy?"requireCurrentForPrivateDataReturn":"requireCurrentForInitialPublication"))
                                    &&Arrays.stream(stack).noneMatch(s->s.getClassName().equals(setClass)&&s.getMethodName().equals("<init>"))
                                    &&(privateCopy?Arrays.stream(stack).anyMatch(s->s.getClassName().equals(setClass)&&s.getMethodName().equals("copyCompleteOriginalArguments")):
                                        Arrays.stream(stack).anyMatch(s->s.getClassName().equals(VaultEngine.class.getName())&&s.getMethodName().equals("readOriginalNativeCompletions")))
                                    &&fired.compareAndSet(false,true))try{
                                    if(expiredClock)f.clock.now=originalClock+120_001L;
                                    else {Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                }catch(Exception failure){throw new AssertionError("Final completion-set Source mutation prerequisite",failure);}
                                return super.entrySet();
                            }
                        });
                        try{
                            var actualPrepared=prepared;var liveControl=control;
                            var failure=assertThrows("Final current-set guard must reject changed original before display publication",VaultFailure.class,
                                ()->{if(privateCopy)NativeRetainedCompletionCensus.wipe(copyActualOriginalArgumentData(copyOwner));
                                    else f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl);});
                            source.unknown.put(namespace,originalMap);assertTrue("Actual final set Source boundary reached",fired.get());
                            assertEquals(NativeRetainedAttempt.FAILURE,failure.code);assertEquals(0,failure.getSuppressed().length);
                            assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getClassName().equals(VaultEngine.class.getName()+"$NativeOriginalCompletionDispositionSet")
                                &&s.getMethodName().equals(privateCopy?"requireCurrentForPrivateDataReturn":"requireCurrentForInitialPublication")));
                            if(expiredClock)assertTrue("Original query freshness is still enforced at publication",Arrays.stream(failure.getStackTrace()).anyMatch(s->
                                s.getClassName().equals(NativeRetainedAttempt.class.getName())&&s.getMethodName().equals("requireFresh")));
                            assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));assertEquals(1,(int)counts.getOrDefault("MANAGER",0));
                            if(privateCopy)assertSame(copyOwner,NativePrivateCustodyExchangeTest.field(actualPrepared,"completionDispositions"));
                            else assertNull("No partial disposition set may be published",NativePrivateCustodyExchangeTest.field(actualPrepared,"completionDispositions"));
                            var after=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                            assertArrayEquals(expiredClock?original:changed,Files.readAllBytes(path));liveControl.check();
                            f.clock.now=originalClock;
                            Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restoring bytes cannot revive the refused original source",VaultFailure.class,actualPrepared::projection);
                            if(privateCopy)assertThrows(VaultFailure.class,()->NativeRetainedCompletionCensus.wipe(copyActualOriginalArgumentData(copyOwner)));
                            else assertThrows(VaultFailure.class,()->f.engine.readOriginalNativeCompletions(actualPrepared,http,liveControl));
                            assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));coldSame(old,oldInodes);witness.same();return;
                        }finally{f.clock.now=originalClock;source.unknown.put(namespace,originalMap);Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:old.values())Arrays.fill(bytes,(byte)0);}
                    }
                    if(completionFailure==CompletionFailure.NONE){
                        var completed=f.engine.readOriginalNativeCompletions(prepared,http,control);owningRecoveryNoEffects(completed);
                        // The SAME initial active owner produced its tuple through
                        // normal WORK/receipt APIs before its first freeze/capture.
                        // Empty-group return still cannot qualify this transport.
                        int groups=completed.getInt("selected_argument_count");
                        assertTrue("Normal original completion tuple must reach HTTP, never empty-group qualification",groups>=1);
                        assertEquals("Only the one initial original tuple",1,groups);
                        assertEquals(groups,(int)counts.getOrDefault("COMPLETION",0));assertEquals(0,completed.getInt("accepted_count"));assertEquals(groups,completed.getInt("unresolved_selected_count"));
                    }else{
                        var completionPrepared=prepared;var completionControl=control;
                        var failure=assertThrows("Actual completion owning call must fail, not return acceptance",VaultFailure.class,
                            ()->f.engine.readOriginalNativeCompletions(completionPrepared,http,completionControl));
                        // The owning operation store maps a changed frame binding
                        // to its fixed operation-unknown code; it is not the
                        // retained-attempt factory. Require that exact guard.
                        assertEquals(completionFailure==CompletionFailure.LOST_REPLY?"custodial_private_custody_transport_outcome_unknown":
                            "custodial_native_private_custody_operation_unknown",failure.code);
                        assertEquals("No unexpected cleanup may masquerade as expected refusal",0,failure.getSuppressed().length);
                        assertEquals("Actual exact completion response await reached once",1,completionAwait.get());
                        assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));
                        var completionConnections=connections.stream().map(c->(OwningConnection)c).filter(c->c.role.equals("COMPLETION")).toList();
                        assertEquals(1,completionConnections.size());var connection=completionConnections.get(0);
                        assertTrue(completionHeaders.get().equals(connection.headers));
                        assertTrue(completionBodySha.get().equals(NativeRetainedAttempt.hash(connection.copy)));
                        assertEquals(1,connection.disconnects);
                        assertEquals(completionFailure==CompletionFailure.SOURCE_WITHDRAWAL,sourceWithdrawn.get());
                        assertEquals(completionFailure==CompletionFailure.SOURCE_WITHDRAWAL,completionReplyConsumed.get());
                        assertEquals(completionFailure==CompletionFailure.LOST_REPLY,connection.timeout);
                        assertTrue("Expected failure came from the owning completion path",Arrays.stream(failure.getStackTrace()).anyMatch(frame->
                            frame.getClassName().equals(VaultEngine.class.getName())&&frame.getMethodName().equals("readOriginalNativeCompletions")));
                        if(completionFailure==CompletionFailure.SOURCE_WITHDRAWAL){
                            assertTrue("Changed source refused by the actual original operation reader",Arrays.stream(failure.getStackTrace()).anyMatch(frame->
                                frame.getClassName().equals(NativePrivateCustodyOperationStore.class.getName())&&frame.getMethodName().equals("inspectOriginal")));
                            assertTrue("Actual production dispatch currentness guard refused after valid reply",Arrays.stream(failure.getStackTrace()).anyMatch(frame->
                                frame.getClassName().equals(VaultEngine.class.getName()+"$NativeSameOriginalCompletionReadDispatch")&&frame.getMethodName().equals("requireCurrent")));
                        }else assertTrue("Actual transport, not a preparation refusal",Arrays.stream(failure.getStackTrace()).anyMatch(frame->
                            frame.getClassName().equals(NativePrivateCustodyHttp.class.getName())&&frame.getMethodName().equals("sendOwned")));
                        // Do not credit deadline/cancellation as either targeted
                        // failure. This SAME original frame must remain live.
                        assertFalse(Thread.currentThread().isInterrupted());control.check();witness.same();
                        if(sourceWithdrawn.get())assertThrows("Changed original Source stays withdrawn",VaultFailure.class,completionPrepared::projection);
                        else{
                            var retained=completionPrepared.projection();owningRecoveryNoEffects(retained);
                            assertTrue(retained.getBoolean("unknown_fence_observed"));assertFalse(retained.getBoolean("network_dispatch_allowed"));assertFalse(retained.getBoolean("manager_approval"));
                            for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","prepared_record_sha256"})
                                assertTrue("Same original prepared DATA retained",preparedProjection.get(key).equals(retained.get(key)));
                        }
                    }
                    assertEquals(1,(int)counts.getOrDefault("MANAGER",0));assertEquals(0,(int)counts.getOrDefault("STATUS",0));
                }else{
                    stage.set("STATUS");var status=f.engine.readOriginalRecoveryChallengeStatus(prepared,http,control);owningRecoveryNoEffects(status);
                    assertTrue(status.getBoolean("native_receipt_metadata_validated"));assertEquals(1,(int)counts.getOrDefault("STATUS",0));
                    assertEquals(0,(int)counts.getOrDefault("MANAGER",0));assertEquals(0,(int)counts.getOrDefault("COMPLETION",0));
                }
                probe=control.beginPiece();try{probe.check();}finally{control.endPiece(probe);}
                witness.same();var nowNames=new java.util.TreeSet<String>();try(var paths=Files.newDirectoryStream(f.dir)){for(var path:paths)nowNames.add(path.getFileName().toString());}assertEquals(fixedNames,nowNames);
                for(var raw:connections){var c=(OwningConnection)raw;assertEquals(1,c.disconnects);assertNotNull(c.owned);assertTrue(Arrays.equals(new byte[c.owned.length],c.owned));}
                var samePrepared=prepared;var sameControl=control;int opened=connections.size();stage.set("NO_MORE_HTTP");
                assertThrows("Same original UNKNOWN never grants blind resend",VaultFailure.class,()->f.engine.sendOriginalRecoveryChallenge(samePrepared,http,sameControl));
                if(manager){
                    if(completionFailure==CompletionFailure.NONE)assertThrows(VaultFailure.class,()->f.engine.readOriginalNativeCompletions(samePrepared,http,sameControl));
                    else{
                        var duplicate=assertThrows("Same consumed completion read cannot dispatch again",VaultFailure.class,
                            ()->f.engine.readOriginalNativeCompletions(samePrepared,http,sameControl));
                        assertEquals(NativeRetainedAttempt.FAILURE,duplicate.code);assertEquals(0,duplicate.getSuppressed().length);
                    }
                }
                else assertThrows(VaultFailure.class,()->f.engine.readOriginalRecoveryChallengeStatus(samePrepared,http,sameControl));
                assertEquals(opened,connections.size());witness.same();
                control.requestCancellation();assertThrows("Same prepared source withdraws",VaultFailure.class,samePrepared::projection);
                assertEquals(opened,connections.size());witness.same();
                if(completionFailure==CompletionFailure.NONE)System.out.println("SOURCE_SYNTHETIC_CONTROLLED_RECOVERY_"+(manager?"MANAGER_NONEMPTY_COMPLETION":"CHALLENGE_STATUS")+"_NO_MANAGER_SQL_ACK_AUTHORITY");
                else System.out.println("SOURCE_SYNTHETIC_COMPLETION_"+completionFailure+"_REFUSED_ORIGINAL_DATA_RETAINED_NOT_ACCEPTANCE");
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{if(prepared!=null)prepared.close();else if(intent!=null)intent.close();else if(targetOwner!=null)targetOwner.close();else if(read!=null)read.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{
                    try{if(control!=null)control.close();witness.same();
                        char[] retained=owner.vaultCipher.decrypt(originalVault.secret);
                        try{NativeAttestation.requireStoredCredentialId(retained,credentialId);}finally{VaultValidation.wipe(retained);}
                        owner.wiped();
                    }catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                    finally{for(var raw:connections)((OwningConnection)raw).wipe();for(var bytes:observedBodies.values())Arrays.fill(bytes,(byte)0);
                        for(var headers:observedHeaders.values())headers.clear();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                        if(completionHeaders.get()!=null)completionHeaders.get().clear();}
                }
            }
        }finally{if(originalCompletionArguments!=null)Arrays.fill(originalCompletionArguments,(byte)0);}
    }

    /** Negative entry coverage only: no status dispatch/response loan or
     * principal is manufactured. Positive decoder lifetime needs the normal
     * owning challenge/manager fixture and remains separately unqualified. */
    @Test public void FRAME_STATUS_missingTypedDispatchStartsNoPieceOrTransport()throws Exception{
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("missing status dispatch opened HTTP");},()->0);
        char[] credential="UNIT-not-a-device-credential".toCharArray(),before=credential.clone();
        try(var control=new NativePrivateCustodyFrameReadControl()){
            assertThrows(VaultFailure.class,()->http.readOriginalRecoveryChallengeStatusUnderControl(null,"KIOSK_02",credential,control));
            assertThrows(VaultFailure.class,()->http.readCurrentOriginalManagerPreparationUnderControl(null,"KIOSK_02",credential,control));
            assertThrows(VaultFailure.class,()->http.readOriginalRecoveryChallengeStatusUnderControl(null,"KIOSK_02",credential,null));
            assertThrows(VaultFailure.class,()->http.readCurrentOriginalManagerPreparationUnderControl(null,"KIOSK_02",credential,null));
            assertEquals(0,opens.get());assertArrayEquals(before,credential);control.check();
            // Empty coordination probe only; neither failed entry took a
            // piece, request, response or network/manager capability.
            var probe=control.beginPiece();try{probe.check();}finally{control.endPiece(probe);}
        }finally{VaultValidation.wipe(credential);VaultValidation.wipe(before);}
    }
    /** Negative-only Source checks: no original owner or dispatch is invented.
     * Positive/lost-reply behavior requires the actual Engine owning factory. */
    @Test public void ORIGINAL_COMPLETION_HTTP_missingDispatchCannotOpenConnection()throws Exception{
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("missing completion dispatch opened connection");},()->0);
        char[] credential="synthetic-only-not-a-device-credential".toCharArray(),before=credential.clone();
        try{
            denied(()->http.readOriginalCompletion(null,"KIOSK_02",credential,new NativeRetainedHttp.Attempt()));
            denied(()->http.readOriginalCompletion(null,"KIOSK_02",credential,null));
            var cancelled=new NativeRetainedHttp.Attempt();cancelled.cancel();
            denied(()->http.readOriginalCompletion(null,"KIOSK_02",credential,cancelled));
            assertEquals(0,opens.get());assertArrayEquals(before,credential);
        }finally{VaultValidation.wipe(credential);VaultValidation.wipe(before);}
    }
    @Test public void ORIGINAL_COMPLETION_HTTP_rawRequestCannotEnterTypedSender()throws Exception{
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("raw completion request opened connection");},()->0);
        var method=NativePrivateCustodyHttp.class.getDeclaredMethod("readOriginalCompletion",
            VaultEngine.NativeSameOriginalCompletionReadDispatch.class,String.class,char[].class,NativeRetainedHttp.Attempt.class);
        assertEquals(NativePrivateCustodyHttp.Exchange.class,method.getReturnType());
        assertFalse(java.lang.reflect.Modifier.isPublic(method.getModifiers()));
        byte[] body="{\"schema\":\"untrusted-not-a-dispatch\"}".getBytes(StandardCharsets.UTF_8);
        var foreign=new AuthorizedRequest(NativeSameOriginalCompletionReadEnvelope.PATH,"POST",Map.of(),body);
        char[] credential=new char[0];
        try{
            // This checks Java argument-type refusal only, never a private
            // constructor, capability factory or accessibility override.
            try{method.invoke(http,foreign,"KIOSK_02",credential,new NativeRetainedHttp.Attempt());fail("raw request became a completion dispatch");}
            catch(IllegalArgumentException expected){/* method body not entered */}
            assertEquals(0,opens.get());assertArrayEquals(body,foreign.body);
        }finally{Arrays.fill(body,(byte)0);Arrays.fill(foreign.body,(byte)0);VaultValidation.wipe(credential);}
    }
    /** No owning capability is fabricated here. Missing/foreign data cannot
     * enter the new typed transport. This does not qualify a positive send. */
    @Test public void G08_CHALLENGE_nullTypedDispatchCannotOpenConnection()throws Exception{
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("missing typed challenge opened network");},()->0);
        char[] credential="synthetic-only-not-a-device-credential".toCharArray();
        char[] before=credential.clone();
        try{
            denied(()->http.sendOriginalRecoveryChallenge(null,"KIOSK_02",credential,new NativeRetainedHttp.Attempt()));
            denied(()->http.sendOriginalRecoveryChallenge(null,"KIOSK_02",credential,null));
            var cancelled=new NativeRetainedHttp.Attempt();cancelled.cancel();
            denied(()->http.sendOriginalRecoveryChallenge(null,"KIOSK_02",credential,cancelled));
            assertEquals(0,opens.get());assertArrayEquals(before,credential);
        }finally{VaultValidation.wipe(credential);VaultValidation.wipe(before);}
    }
    @Test public void G08_CHALLENGE_wrongTypeCannotEnterTypedSender()throws Exception{
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("foreign challenge opened network");},()->0);
        var method=NativePrivateCustodyHttp.class.getDeclaredMethod("sendOriginalRecoveryChallenge",
            VaultEngine.NativeSameOriginalRecoveryDispatch.class,String.class,char[].class,NativeRetainedHttp.Attempt.class);
        assertEquals(NativePrivateCustodyHttp.Exchange.class,method.getReturnType());
        assertFalse(java.lang.reflect.Modifier.isPublic(method.getModifiers()));
        byte[] body="{\"schema\":\"untrusted-not-a-dispatch\"}".getBytes(StandardCharsets.UTF_8);
        var foreign=new AuthorizedRequest(NativeSameOriginalRecoveryChallengeEnvelope.PATH,"POST",Map.of(),body);
        char[] credential=new char[0];
        try{
            // Reflection tests Java's actual typed rejection only; it never
            // accesses a private dispatch constructor/factory or bypasses it.
            try{method.invoke(http,foreign,"KIOSK_02",credential,new NativeRetainedHttp.Attempt());fail("raw request became a challenge dispatch");}
            catch(IllegalArgumentException expected){/* method body not entered */}
            assertEquals(0,opens.get());assertArrayEquals(body,foreign.body);
        }finally{Arrays.fill(body,(byte)0);Arrays.fill(foreign.body,(byte)0);}
    }
    @Test public void CURRENT_READ_missingTypedDispatchCannotOpenConnection()throws Exception{
        NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{throw new AssertionError("missing typed owner opened network");},()->0);
        denied(()->http.sendCurrentQuery(null,"KIOSK_02",new char[0],new NativeRetainedHttp.Attempt()));
        denied(()->http.sendCurrentQuery(null,"KIOSK_02",new char[0],null));
    }
    @Test public void CURRENT_READ_currentOuterEnvelopeKeepsOriginalQueryAndExistingTransportControls()throws Exception{
        // Existing actual cryptographic fixture and new Main-only typed factory;
        // connection/clock/credential are OWN TEST data, not Android/server proof.
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);
                byte[] original=NativePrivateCustodyExchangeTest.body(query);
                var oldHeaders=Map.copyOf((Map<String,String>)NativePrivateCustodyExchangeTest.field(query,"headers"));
                var stored=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=86_400_000;
                denied(()->NativeRetainedAttempt.requireFresh(oldHeaders.get("X-Memphis-Native-Request-Timestamp"),f.clock.nowMillis()));
                CredentialCipher cipher=(CredentialCipher)NativePrivateCustodyExchangeTest.field(f.engine,"cipher");
                VaultPersistence persistence=(VaultPersistence)NativePrivateCustodyExchangeTest.field(f.engine,"persistence");
                char[] credential=cipher.decrypt(persistence.load().secret);
                String device=persistence.load().deviceId;
                final int[] opens={0};final Connection[] used={null};final byte[][] ownedWrite={null};
                NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                    assertFalse(Thread.holdsLock(f.engine));opens[0]++;
                    used[0]=new Connection(url){@Override public OutputStream getOutputStream(){return new OutputStream(){
                        @Override public void write(int value){throw new AssertionError("exact original envelope array required");}
                        @Override public void write(byte[] bytes){ownedWrite[0]=bytes;sent.write(bytes,0,bytes.length);}
                    };}};return used[0];
                },f.clock);
                try{
                    try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                        AuthorizedRequest pending=(AuthorizedRequest)NativePrivateCustodyExchangeTest.field(dispatch,"request");
                        byte[] envelope=pending.body.clone();var headers=Map.copyOf(pending.headers);
                        // A genuine QUERY cannot be consumed through TARGET.
                        // Refusal leaves this SAME request available for its
                        // correct route; no replacement dispatch is minted.
                        denied(()->http.sendOriginalRecoveryTarget(dispatch,device,credential,new NativeRetainedHttp.Attempt()));
                        assertEquals(0,opens[0]);assertSame(pending,NativePrivateCustodyExchangeTest.field(dispatch,"request"));
                        assertArrayEquals(envelope,pending.body);assertEquals(headers,pending.headers);
                        NativePrivateCustodyOwnerTest.sameFiles(stored,f.dir);
                        try(var exchange=http.sendCurrentQuery(dispatch,device,credential,new NativeRetainedHttp.Attempt())){
                            assertEquals(200,exchange.status);assertEquals(oldHeaders.get("X-Memphis-Native-Request-Id"),exchange.nativeRequestId);
                            assertEquals(NativeRetainedAttempt.hash(envelope),exchange.bodySha256);assertEquals(1,opens[0]);
                            assertArrayEquals(envelope,used[0].sent.toByteArray());
                            JSONObject outer=ProviderWireJson.object(envelope,526336);
                            assertEquals(oldHeaders.get("X-Memphis-Native-Request-Timestamp"),outer.getString("original_query_timestamp"));
                            assertEquals(oldHeaders.get("X-Memphis-Native-Request-Attestation"),outer.getString("original_query_http_attestation"));
                            assertArrayEquals(original,java.util.Base64.getDecoder().decode(outer.getString("original_query_body_base64")));
                            assertNotEquals(oldHeaders.get("X-Memphis-Native-Request-Timestamp"),headers.get("X-Memphis-Native-Request-Timestamp"));
                            assertEquals(NativeAttestation.requestHeaders(new AuthorizedRequest("/device-auth/private-custody-current-read","POST",Map.of(),envelope),
                                device,credential,exchange.nativeRequestId,f.clock.nowMillis()),headers);
                            for(var header:headers.entrySet())assertEquals(header.getValue(),used[0].headers.get(header.getKey()));
                            assertFalse(used[0].getInstanceFollowRedirects());assertEquals("POST",used[0].getRequestMethod());
                            assertTrue(used[0].getConnectTimeout()>0&&used[0].getConnectTimeout()<=5000);
                            assertTrue(used[0].getReadTimeout()>0&&used[0].getReadTimeout()<=10000);
                            assertSame(HttpsURLConnection.getDefaultHostnameVerifier(),used[0].getHostnameVerifier());
                            assertSame(HttpsURLConnection.getDefaultSSLSocketFactory(),used[0].getSSLSocketFactory());
                            assertEquals("identity",used[0].headers.get("Accept-Encoding"));
                        }finally{Arrays.fill(envelope,(byte)0);}
                        assertArrayEquals(new byte[ownedWrite[0].length],ownedWrite[0]);assertEquals(1,used[0].disconnects);
                        denied(()->http.sendCurrentQuery(dispatch,device,credential,new NativeRetainedHttp.Attempt()));assertEquals(1,opens[0]);
                    }
                    try(var stale=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                        NativePrivateCustodyHttp later=new NativePrivateCustodyHttp(url->{throw new AssertionError("stale OUTER timestamp reached IO");},()->f.clock.now+120001);
                        denied(()->later.sendCurrentQuery(stale,device,credential,new NativeRetainedHttp.Attempt()));
                    }
                    try(var closed=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                        closed.close();denied(()->http.sendCurrentQuery(closed,device,credential,new NativeRetainedHttp.Attempt()));
                        assertEquals(1,opens[0]);
                    }
                    char[] wrong=credential.clone();wrong[wrong.length-1]^=1;
                    try(var different=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                        denied(()->http.sendCurrentQuery(different,device,wrong,new NativeRetainedHttp.Attempt()));assertEquals(1,opens[0]);
                    }finally{VaultValidation.wipe(wrong);}
                    NativePrivateCustodyOwnerTest.sameFiles(stored,f.dir);
                }finally{VaultValidation.wipe(credential);Arrays.fill(original,(byte)0);
                    NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(stored);}
            }
        }
    }
    /** Actual typed current dispatch and original control; synthetic HTTP DATA
     * only. Check ownership through disconnect and body wipe before piece
     * release, not a duration simulation or Android deadline qualification. */
    @Test public void FRAME_CURRENT_ownedPieceOutlivesDisconnectAndWipesBody()throws Exception{
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);var queryPins=query.projection();
                var original=coldOriginals(f);var inodes=coldInodes(original);
                var source=f.x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
                var owner=source.f.batch.old;var vault=owner.persistence.current();
                char[] credential=owner.vaultCipher.decrypt(vault.secret);
                final int[] opens={0};final Connection[] used={null};final byte[][] owned={null},copied={null};
                Throwable primary=null;
                try{
                    var http=new NativePrivateCustodyHttp(url->{
                        assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,url.toString());
                        assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                        assertEquals(1,++opens[0]);control.check();
                        assertThrows("Exactly one piece already owns this transport",VaultFailure.class,control::beginPiece);
                        used[0]=new Connection(url){
                            @Override public OutputStream getOutputStream(){return new OutputStream(){
                                @Override public void write(int value){throw new AssertionError("original envelope array required");}
                                @Override public void write(byte[] bytes){assertNull(owned[0]);owned[0]=bytes;copied[0]=bytes.clone();}
                            };}
                            @Override public int getResponseCode()throws java.io.IOException{
                                byte[] archived=null;
                                try{
                                    control.check();assertThrows(VaultFailure.class,control::beginPiece);
                                    assertNotNull(owned[0]);assertTrue(Arrays.equals(owned[0],copied[0]));
                                    assertEquals(owned[0].length,fixedContentLength);assertEquals("POST",getRequestMethod());
                                    assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                                    assertTrue(getConnectTimeout()>0&&getConnectTimeout()<=5000);
                                    assertTrue(getReadTimeout()>0&&getReadTimeout()<=10000);
                                    assertTrue(queryPins.getString("native_request_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                                    var envelope=ProviderWireJson.object(owned[0],526336);
                                    assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp",
                                        "original_query_http_attestation","original_query_unknown_record_sha256"),envelope.keySet());
                                    assertEquals("custodial.original-private-custody-current-query.v1",envelope.getString("schema"));
                                    archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                                    assertTrue(queryPins.getString("request_body_sha256").equals(NativeRetainedAttempt.hash(archived)));
                                    assertTrue(queryPins.getString("native_request_timestamp").equals(envelope.getString("original_query_timestamp")));
                                    assertTrue(NativeRetainedAttempt.hash(original.get(f.dir.resolve("query_unknown-0.bin")))
                                        .equals(envelope.getString("original_query_unknown_record_sha256")));
                                    coldSame(original,inodes);stable.check();return 200;
                                }catch(Exception failure){throw new java.io.IOException("UNIT_current_read_observation_failed",failure);}
                                finally{if(archived!=null)Arrays.fill(archived,(byte)0);}
                            }
                            @Override public void disconnect(){
                                assertFalse(Thread.holdsLock(control));assertFalse(Thread.holdsLock(f.engine));
                                assertNotNull(owned[0]);assertTrue("Original IO bytes still owned until disconnect settles",Arrays.equals(owned[0],copied[0]));
                                assertThrows("Piece cannot retire before disconnect",VaultFailure.class,control::beginPiece);
                                super.disconnect();
                            }
                        };
                        used[0].response=new byte[0];return used[0];
                    },f.clock);
                    try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                        try(var response=http.sendCurrentQueryUnderControl(dispatch,vault.deviceId,credential,control)){
                            assertEquals(200,response.status);
                            assertTrue(queryPins.getString("native_request_id").equals(response.nativeRequestId));
                            assertTrue(NativeRetainedAttempt.hash(copied[0]).equals(response.bodySha256));
                        }
                    }
                    assertEquals(1,opens[0]);assertEquals(1,used[0].disconnects);assertNotNull(owned[0]);
                    assertTrue("Owned request wiped before piece release/return",Arrays.equals(new byte[owned[0].length],owned[0]));
                    control.check();
                    // No HTTP or old Attempt reuse: this empty coordination
                    // probe only proves the settled piece no longer owns it.
                    var emptyProbe=control.beginPiece();
                    try{emptyProbe.check();}finally{control.endPiece(emptyProbe);}
                }catch(Exception|Error failure){primary=failure;throw failure;}
                finally{
                    try{coldSame(original,inodes);stable.check();}
                    catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                    finally{VaultValidation.wipe(credential);if(copied[0]!=null)Arrays.fill(copied[0],(byte)0);
                        if(owned[0]!=null)Arrays.fill(owned[0],(byte)0);
                        if(used[0]!=null)used[0].headers.clear();for(var bytes:original.values())Arrays.fill(bytes,(byte)0);}
                }
            }
        }
    }
    /** A genuinely canceled original frame refuses at its entry checkpoint;
     * no socket, new frame/Attempt, body replacement or alternate purpose. */
    @Test public void FRAME_CURRENT_preentryCancellationStartsNoTransport()throws Exception{
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);
                var original=coldOriginals(f);var inodes=coldInodes(original);
                var source=f.x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
                var owner=source.f.batch.old;var vault=owner.persistence.current();char[] credential=owner.vaultCipher.decrypt(vault.secret);
                var opens=new java.util.concurrent.atomic.AtomicInteger();Throwable primary=null;
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                    control.requestCancellation();
                    var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("canceled original reached HTTP");},f.clock);
                    var failure=assertThrows(VaultFailure.class,()->http.sendCurrentQueryUnderControl(dispatch,vault.deviceId,credential,control));
                    assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                    assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);
                    var trace=failure.getStackTrace();assertTrue(trace.length>=2);
                    assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[0].getClassName());assertEquals("failure",trace[0].getMethodName());
                    assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[1].getClassName());assertEquals("check",trace[1].getMethodName());
                    assertEquals(0,opens.get());assertThrows(VaultFailure.class,control::check);assertThrows(VaultFailure.class,control::beginPiece);
                    // No new control, second invocation or attempt to consume
                    // the unused request; caller closes this same dispatch.
                }catch(Exception|Error failure){primary=failure;throw failure;}
                finally{
                    try{coldSame(original,inodes);stable.check();}
                    catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                    finally{VaultValidation.wipe(credential);for(var bytes:original.values())Arrays.fill(bytes,(byte)0);}
                }
            }
        }
    }
    @Test public void FIXED_PURPOSE_changedOuterBodyRefusesWithoutConsumingOrTransport()throws Exception{
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);
                var stored=NativePrivateCustodyOwnerTest.files(f.dir);
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                    // Deliberate negative mutation of the dispatch-owned outer
                    // copy only; original archived QUERY/files stay untouched.
                    var pending=(AuthorizedRequest)NativePrivateCustodyExchangeTest.field(dispatch,"request");
                    pending.body[0]^=1;byte[] changed=pending.body.clone();
                    final int[] opens={0};
                    var http=new NativePrivateCustodyHttp(url->{opens[0]++;throw new AssertionError("changed outer body opened HTTP");},f.clock);
                    try{
                        denied(dispatch::takeCurrentQueryRequest);
                        assertSame(pending,NativePrivateCustodyExchangeTest.field(dispatch,"request"));
                        assertArrayEquals(changed,pending.body);
                        denied(()->http.sendCurrentQuery(dispatch,"KIOSK_08",new char[0],new NativeRetainedHttp.Attempt()));
                        assertEquals(0,opens[0]);assertSame(pending,NativePrivateCustodyExchangeTest.field(dispatch,"request"));
                        NativePrivateCustodyOwnerTest.sameFiles(stored,f.dir);
                    }finally{Arrays.fill(changed,(byte)0);}
                }finally{NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(stored);}
            }
        }
    }
    static final class LifetimeConnection extends Connection {
        final java.util.concurrent.CountDownLatch writeEntered=new java.util.concurrent.CountDownLatch(1),writeRelease=new java.util.concurrent.CountDownLatch(1),
            disconnectEntered=new java.util.concurrent.CountDownLatch(1),disconnectRelease=new java.util.concurrent.CountDownLatch(1),
            responseEntered=new java.util.concurrent.CountDownLatch(1),responseRelease=new java.util.concurrent.CountDownLatch(1),
            closeEntered=new java.util.concurrent.CountDownLatch(1),closeRelease=new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.atomic.AtomicInteger disconnectCalls=new java.util.concurrent.atomic.AtomicInteger(),writes=new java.util.concurrent.atomic.AtomicInteger(),responses=new java.util.concurrent.atomic.AtomicInteger();
        volatile byte[] ownedWrite;
        boolean blockWrite,disconnectUnblocksWrite,blockDisconnect,blockResponse,blockClose,failDisconnect;
        LifetimeConnection(URL url){super(url);}
        static void gate(java.util.concurrent.CountDownLatch gate){boolean interrupted=false;
            for(;;)try{gate.await();break;}catch(InterruptedException pending){interrupted=true;}
            if(interrupted)Thread.currentThread().interrupt();
        }
        @Override public OutputStream getOutputStream(){return new OutputStream(){
            @Override public void write(int b){throw new AssertionError("original_array_required");}
            @Override public void write(byte[] bytes){ownedWrite=bytes;writes.incrementAndGet();writeEntered.countDown();if(blockWrite)gate(writeRelease);sent.write(bytes,0,bytes.length);}
        };}
        @Override public int getResponseCode(){responses.incrementAndGet();responseEntered.countDown();if(blockResponse)gate(responseRelease);return status;}
        @Override public InputStream getInputStream(){return new ByteArrayInputStream(response){@Override public void close(){closeEntered.countDown();if(blockClose)gate(closeRelease);}};}
        @Override public void disconnect(){disconnectCalls.incrementAndGet();disconnectEntered.countDown();if(disconnectUnblocksWrite)writeRelease.countDown();
            if(blockDisconnect)gate(disconnectRelease);if(failDisconnect)throw new IllegalStateException("synthetic_cleanup_failure");}
        void settle(){writeRelease.countDown();responseRelease.countDown();closeRelease.countDown();disconnectRelease.countDown();}
    }
    static final class LifetimeSend implements AutoCloseable {
        final NativeRetainedHttp.Attempt attempt=new NativeRetainedHttp.Attempt();
        final LifetimeConnection connection=new LifetimeConnection(new URL(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH));
        final java.util.concurrent.CountDownLatch returned=new java.util.concurrent.CountDownLatch(1),ready=new java.util.concurrent.CountDownLatch(1),sendRelease=new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.atomic.AtomicInteger opens=new java.util.concurrent.atomic.AtomicInteger();
        final Thread caller;volatile byte[] original;volatile java.nio.file.Path dir;
        volatile Throwable failure;volatile JSONObject result,before,unknownOutcome;volatile boolean restoredInterrupt;
        Thread cancel;
        LifetimeSend(long budget)throws Exception {
            var constructor=NativePrivateCustodyHttp.class.getDeclaredConstructor(NativePrivateCustodyHttp.Connections.class,VaultClock.class,long.class);constructor.setAccessible(true);
            // Creation, dispatch, readback and close remain on ONE owning thread.
            caller=new Thread(()->{
                try(var f=new NativePrivateCustodyExchangeTest.Fixture();var prepared=f.write(0)){
                    original=NativePrivateCustodyExchangeTest.body(prepared);before=prepared.projection();dir=f.dir;
                    var http=constructor.newInstance((NativePrivateCustodyHttp.Connections)url->{assertEquals(connection.getURL(),url);opens.incrementAndGet();return connection;},f.clock,budget);
                    ready.countDown();LifetimeConnection.gate(sendRelease);mark("owning_send_begin");
                    try{result=f.engine.sendOriginalPrivateCustodyExchange(prepared,http,attempt);}catch(Throwable error){failure=error;}
                    mark("owning_send_settled");restoredInterrupt=Thread.currentThread().isInterrupted();Thread.interrupted();
                    try{if(failure!=null){
                        unknownOutcome=f.engine.observeOriginalPrivateCustodyExchangeOutcome(prepared);noAuthority(unknownOutcome);
                        var files=NativePrivateCustodyOwnerTest.files(f.dir);denied(()->f.engine.sendOriginalPrivateCustodyExchange(prepared,
                            new NativePrivateCustodyHttp(url->{opens.incrementAndGet();return connection;},f.clock),new NativeRetainedHttp.Attempt()));
                        NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
                    }}finally{if(restoredInterrupt)Thread.currentThread().interrupt();}
                }catch(Throwable error){if(failure!=null)error.addSuppressed(failure);failure=error;}
                finally{ready.countDown();returned.countDown();}
            },"synthetic-original-private-custody-caller");
            caller.start();assertTrue("owning fixture did not prepare",ready.await(30,java.util.concurrent.TimeUnit.SECONDS));
            if(before==null){close();throw new AssertionError("existing owning fixture failed",failure);}
        }
        void start(){sendRelease.countDown();}
        static void await(java.util.concurrent.CountDownLatch gate)throws Exception{assertTrue("owning gate not reached",gate.await(30,java.util.concurrent.TimeUnit.SECONDS));}
        void stillOwned()throws Exception {
            assertFalse(returned.await(80,java.util.concurrent.TimeUnit.MILLISECONDS));
            var active=NativeRetainedHttp.Attempt.class.getDeclaredField("active");active.setAccessible(true);
            synchronized(attempt){assertNotNull("connection detached before settlement",active.get(attempt));}
            assertArrayEquals("request wiped while IO still owns it",original,connection.ownedWrite);
            assertTrue(Files.exists(dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(dir.resolve("write_observation-0.bin")));
        }
        void cancelAsync(){cancel=new Thread(attempt::cancel,"synthetic-original-private-custody-cancel");cancel.start();}
        void unknownSettled()throws Exception {
            await(returned);caller.join(1000);assertFalse(caller.isAlive());assertTrue(failure instanceof VaultFailure);assertNull(result);
            assertArrayEquals(new byte[original.length],connection.ownedWrite);assertEquals(1,opens.get());assertEquals(1,connection.disconnectCalls.get());
            var active=NativeRetainedHttp.Attempt.class.getDeclaredField("active");active.setAccessible(true);assertNull(active.get(attempt));
            assertNotNull(unknownOutcome);noAuthority(unknownOutcome);
            assertFalse(unknownOutcome.getBoolean("http_observation_present"));assertTrue(unknownOutcome.getBoolean("unknown_fence_locally_committed_observed"));assertEquals(1,opens.get());
        }
        @Override public void close()throws Exception {
            connection.settle();sendRelease.countDown();caller.join(30000);assertFalse("owned caller leaked",caller.isAlive());
            if(cancel!=null){cancel.join(4000);assertFalse("owned cancellation leaked",cancel.isAlive());}
            if(original!=null)Arrays.fill(original,(byte)0);
        }
    }
    @Test public void LIFETIME_oneOriginalRequestSettlesBeforeUnverifiedObservation()throws Exception {try(var s=new LifetimeSend(30_000_000_000L)){
        var before=s.before;s.start();LifetimeSend.await(s.returned);assertNull(s.failure);noAuthority(s.result);
        assertArrayEquals(s.original,s.connection.sent.toByteArray());assertEquals(before.get("native_request_id"),s.connection.headers.get("X-Memphis-Native-Request-Id"));
        assertEquals(before.get("native_request_timestamp"),s.connection.headers.get("X-Memphis-Native-Request-Timestamp"));assertEquals(1,s.opens.get());
        assertEquals(1,s.connection.writes.get());assertEquals(1,s.connection.disconnectCalls.get());assertFalse(s.connection.getInstanceFollowRedirects());
        assertTrue(s.result.getBoolean("http_observation_locally_committed"));assertArrayEquals(new byte[s.original.length],s.connection.ownedWrite);
    }}
    @Test public void LIFETIME_deadlineSignalsOnlyOriginalConnectionAndNeverRetries()throws Exception {try(var s=new LifetimeSend(400_000_000L)){
        s.connection.blockWrite=true;s.connection.disconnectUnblocksWrite=true;s.start();LifetimeSend.await(s.connection.writeEntered);
        s.unknownSettled();assertEquals(0,s.connection.responses.get());assertEquals(1,s.connection.writes.get());
    }}
    @Test public void LIFETIME_unresolvedIOAndDisconnectKeepAttemptAndBytesOwned()throws Exception {try(var s=new LifetimeSend(400_000_000L)){
        s.connection.blockWrite=true;s.connection.blockDisconnect=true;s.start();LifetimeSend.await(s.connection.writeEntered);LifetimeSend.await(s.connection.disconnectEntered);
        s.stillOwned();s.connection.writeRelease.countDown();s.stillOwned();s.connection.disconnectRelease.countDown();s.unknownSettled();
    }}
    @Test public void LIFETIME_externalCancelJoinsSameCleanupWithoutEarlyDetach()throws Exception {try(var s=new LifetimeSend(30_000_000_000L)){
        s.connection.blockWrite=true;s.connection.blockDisconnect=true;s.start();LifetimeSend.await(s.connection.writeEntered);s.cancelAsync();LifetimeSend.await(s.connection.disconnectEntered);
        s.connection.writeRelease.countDown();s.stillOwned();assertTrue(s.cancel.isAlive());s.connection.disconnectRelease.countDown();s.unknownSettled();
        s.cancel.join(1000);assertFalse(s.cancel.isAlive());assertEquals(1,s.connection.disconnectCalls.get());
    }}
    @Test public void LIFETIME_interruptDuringResponseRetainsOwnerAndRestoresInterrupt()throws Exception {try(var s=new LifetimeSend(30_000_000_000L)){
        s.connection.blockResponse=true;s.connection.blockDisconnect=true;s.start();LifetimeSend.await(s.connection.responseEntered);s.caller.interrupt();
        LifetimeSend.await(s.connection.disconnectEntered);s.stillOwned();s.connection.responseRelease.countDown();s.stillOwned();
        s.connection.disconnectRelease.countDown();s.unknownSettled();assertTrue(s.restoredInterrupt);
    }}
    @Test public void LIFETIME_inputCloseMustSettleBeforeUnknownReturn()throws Exception {try(var s=new LifetimeSend(400_000_000L)){
        s.connection.blockClose=true;s.start();LifetimeSend.await(s.connection.closeEntered);LifetimeSend.await(s.connection.disconnectEntered);
        s.stillOwned();s.connection.closeRelease.countDown();s.unknownSettled();
    }}
    @Test public void LIFETIME_lateCleanupAndCancelCannotMintLateObservation()throws Exception {try(var s=new LifetimeSend(400_000_000L)){
        s.connection.blockDisconnect=true;s.start();LifetimeSend.await(s.connection.disconnectEntered);s.cancelAsync();s.stillOwned();
        s.connection.disconnectRelease.countDown();s.unknownSettled();s.cancel.join(1000);assertFalse(s.cancel.isAlive());
    }}
    @Test public void LIFETIME_cleanupPastDeadlineWithoutCancelCannotMintObservation()throws Exception {try(var s=new LifetimeSend(400_000_000L)){
        s.connection.blockDisconnect=true;s.start();LifetimeSend.await(s.connection.disconnectEntered);
        assertFalse(s.returned.await(650,java.util.concurrent.TimeUnit.MILLISECONDS));s.stillOwned();
        s.connection.disconnectRelease.countDown();s.unknownSettled();
    }}
    @Test public void LIFETIME_failedDisconnectCannotMintObservation()throws Exception {try(var s=new LifetimeSend(30_000_000_000L)){
        s.connection.failDisconnect=true;s.start();s.unknownSettled();
    }}
    @Test public void LIFETIME_primarySecretRefusalSurvivesDisconnectFailure()throws Exception {
        VaultFailure failure=primaryCleanupFailure(true);
        assertEquals("custodial_native_secret_response_refused",failure.code);
        assertEquals(1,failure.getSuppressed().length);
        assertTrue(failure.getSuppressed()[0] instanceof VaultFailure);
        VaultFailure cleanup=(VaultFailure)failure.getSuppressed()[0];
        assertEquals("custodial_private_custody_transport_outcome_unknown",cleanup.code);
        assertNull(cleanup.getCause());assertEquals(0,cleanup.getSuppressed().length);
    }
    @Test public void LIFETIME_cleanupOnlyFailureInvalidatesSuccessfulResponse()throws Exception {
        VaultFailure failure=primaryCleanupFailure(false);
        assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
        assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);
    }
    /** Exact private sender path with the existing connection fixture. This
     * test creates no engine dispatch, journal, Android key or acceptance. */
    private static VaultFailure primaryCleanupFailure(boolean secretResponse)throws Exception {
        String path=VaultEngine.NativePrivateCustodyPreparedExchange.PATH;
        long now=1_780_000_000_000L;
        char[] credential="20000000-0000-4000-8000-000000000002.synthetic-transport-test-secret".toCharArray();
        byte[] original="{\"schema\":\"synthetic.private-http-lifetime-only\"}".getBytes(StandardCharsets.UTF_8);
        var unsigned=new AuthorizedRequest(path,"POST",Map.of(),original);
        var request=new AuthorizedRequest(path,"POST",NativeAttestation.requestHeaders(unsigned,"KIOSK_02",credential,
            "30000000-0000-4000-8000-000000000003",now),original);
        var attempt=new NativeRetainedHttp.Attempt();
        var connection=new LifetimeConnection(new URL(NativePrivateCustodyHttp.ORIGIN+path));
        connection.failDisconnect=true;
        if(secretResponse)connection.response="{\"credential\":\"synthetic-response-secret\"}".getBytes(StandardCharsets.UTF_8);
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{assertEquals(connection.getURL(),url);opens.incrementAndGet();return connection;},()->now);
        var sender=NativePrivateCustodyHttp.class.getDeclaredMethod("sendOwned",AuthorizedRequest.class,String.class,char[].class,
            NativeRetainedHttp.Attempt.class,String.class,int.class,long.class);sender.setAccessible(true);
        NativePrivateCustodyHttp.Exchange result=null;VaultFailure failure=null;
        try {
            try{result=(NativePrivateCustodyHttp.Exchange)sender.invoke(http,request,"KIOSK_02",credential,attempt,
                path,NativeRetainedAttempt.MAX_BODY,System.nanoTime());}
            catch(java.lang.reflect.InvocationTargetException thrown){assertTrue(thrown.getCause() instanceof VaultFailure);failure=(VaultFailure)thrown.getCause();}
            assertNotNull("cleanup failure must refuse a result",failure);assertNull(result);
            assertEquals(1,opens.get());assertEquals(1,connection.writes.get());assertEquals(1,connection.responses.get());
            assertEquals(1,connection.disconnectCalls.get());assertArrayEquals(original,connection.sent.toByteArray());
            assertArrayEquals(new byte[request.body.length],request.body);assertSame(request.body,connection.ownedWrite);
            var active=NativeRetainedHttp.Attempt.class.getDeclaredField("active");active.setAccessible(true);
            synchronized(attempt){assertNull("owned connection must settle before detach",active.get(attempt));}
            assertFalse(connection.getInstanceFollowRedirects());
            assertEquals("identity",connection.headers.get("Accept-Encoding"));
            return failure;
        }finally{
            if(result!=null)result.close();connection.settle();VaultValidation.wipe(credential);
            Arrays.fill(original,(byte)0);Arrays.fill(unsigned.body,(byte)0);Arrays.fill(request.body,(byte)0);
        }
    }
    @Test public void allOriginalChunksAndQueryKeepOriginalIdentityAndDurableResponseWithoutACK()throws Exception {mark("fixture_begin");try(var x=new Fixture()){
        mark("fixture_ready");
        var f=x.f;int chunks=f.plan.projection().getInt("chunk_count");assertTrue(chunks>=2);String operation=f.plan.projection().getString("operation_id"),generation=null;
        for(int i=0;i<chunks;i++)try(var p=f.write(i)){
            mark("write_prepared_"+i);
            var before=p.projection();byte[] body=NativePrivateCustodyExchangeTest.body(p),prepared=Files.readAllBytes(f.dir.resolve("write-"+i+".bin"));
            try {mark("write_send_begin_"+i);var outcome=x.send(p);mark("write_send_complete_"+i);noAuthority(outcome);assertEquals(operation,outcome.get("operation_id"));if(generation==null)generation=outcome.getString("original_generation_id");else assertEquals(generation,outcome.get("original_generation_id"));
                assertTrue(outcome.getBoolean("http_observation_locally_committed"));assertEquals(200,outcome.getInt("http_status"));assertEquals(before.get("native_request_id"),x.connection.headers.get("X-Memphis-Native-Request-Id"));
                assertEquals(before.get("native_request_timestamp"),x.connection.headers.get("X-Memphis-Native-Request-Timestamp"));assertArrayEquals(body,x.connection.sent.toByteArray());assertArrayEquals(prepared,Files.readAllBytes(f.dir.resolve("write-"+i+".bin")));
                assertFalse(x.connection.getInstanceFollowRedirects());assertEquals(1,x.connection.disconnects);var files=NativePrivateCustodyOwnerTest.files(f.dir);
                mark("write_recovery_begin_"+i);try(var recovered=f.write(i)){assertEquals(outcome.toString(),f.engine.observeOriginalPrivateCustodyExchangeOutcome(recovered).toString());denied(()->x.send(recovered));}NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);mark("write_recovery_complete_"+i);
            }finally{Arrays.fill(body,(byte)0);Arrays.fill(prepared,(byte)0);}
        }
        try(var query=f.query(0)){JSONObject p=x.send(query);noAuthority(p);assertEquals(operation,p.get("operation_id"));assertEquals(generation,p.get("original_generation_id"));
            assertEquals(f.plan.chunkMetadata(0).get("read_query_id"),p.get("native_request_id"));assertEquals("QUERY",p.get("kind"));}
        assertEquals(chunks+1,x.opens);
    }}
    @Test public void lostReplyPreservesOriginalUNKNOWNAndNeverResendsOrInventsAnObservation()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        x.configure=()->x.connection.timeout=true;denied(()->x.send(p));assertEquals(1,x.opens);assertTrue(x.connection.sent.size()>0);assertEquals(1,x.connection.disconnects);
        var outcome=x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p);noAuthority(outcome);assertFalse(outcome.getBoolean("http_observation_present"));assertTrue(outcome.getBoolean("unknown_fence_locally_committed_observed"));
        var files=NativePrivateCustodyOwnerTest.files(x.f.dir);denied(()->x.f.engine.resumeOriginalPrivateCustodyExchangeOutcome(p));try(var recovered=x.f.write(0)){denied(()->x.send(recovered));}
        NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(1,x.opens);try(var query=x.f.query(0)){assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(query).getBoolean("http_observation_present"));}
    }}
    @Test public void canceledAndStaleAttemptFailBeforeNetworkAndDoNotRenewOriginalRequest()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        var files=NativePrivateCustodyOwnerTest.files(x.f.dir);var attempt=new NativeRetainedHttp.Attempt();attempt.cancel();denied(()->x.f.engine.sendOriginalPrivateCustodyExchange(p,x.http(),attempt));
        NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.opens);x.f.clock.now+=120001;denied(()->x.send(p));NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.opens);
        try(var recovered=x.f.write(0)){assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(recovered).getBoolean("http_observation_present"));denied(()->x.send(recovered));}NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);
    }}
    @Test public void originalNamespaceChangesDuringHTTPLeaveUNKNOWNWithoutCurrentAcceptance()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        var old=NativePrivateCustodyOwnerTest.files(x.f.x.f.dir);x.configure=()->x.connection.onReply=()->x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("during-private-HTTP","synthetic");
        denied(()->x.send(p));assertEquals(1,x.opens);assertTrue(Files.exists(x.f.dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(x.f.dir.resolve("write_observation-0.bin")));
        denied(()->x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p));NativePrivateCustodyOwnerTest.sameFiles(old,x.f.x.f.dir);
    }}
    @Test public void pendingObservationResumesExactCiphertextAndCorruptionNeverRepairsOrResends()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        var first=x.send(p);java.nio.file.Path committed=x.f.dir.resolve("write_observation-0.bin"),pending=x.f.dir.resolve("write_observation-0.pending");byte[] original=Files.readAllBytes(committed);Files.move(committed,pending);
        try(var recovered=x.f.write(0)){var seen=x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(recovered);assertEquals("PENDING",seen.get("http_observation_journal_phase"));assertFalse(seen.getBoolean("http_observation_locally_committed"));
            denied(()->x.send(recovered));assertEquals(first.toString(),x.f.engine.resumeOriginalPrivateCustodyExchangeOutcome(recovered).toString());assertArrayEquals(original,Files.readAllBytes(committed));}
        assertEquals(1,x.opens);byte[] corrupt=original.clone();corrupt[0]^=1;Files.write(committed,corrupt);var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
        denied(()->x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p));denied(()->x.f.engine.resumeOriginalPrivateCustodyExchangeOutcome(p));denied(()->x.send(p));NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);
        Arrays.fill(original,(byte)0);Arrays.fill(corrupt,(byte)0);
    }}
    @Test public void encodedOrOversizedResponseStaysAmbiguousAndBoundedWithoutRetry()throws Exception {
        try(var x=new Fixture();var p=x.f.write(0)){x.configure=()->x.connection.replyHeaders=Map.of("Content-Type",List.of("application/json"),"Content-Encoding",List.of("gzip"));denied(()->x.send(p));
            assertEquals(1,x.opens);assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p).getBoolean("http_observation_present"));}
        try(var x=new Fixture();var p=x.f.write(0)){x.configure=()->{x.connection.response=new byte[NativePrivateCustodyHttp.MAX_RESPONSE+1];Arrays.fill(x.connection.response,(byte)' ');};denied(()->x.send(p));
            assertEquals(1,x.opens);assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p).getBoolean("http_observation_present"));}
    }
    @Test public void echoedCredentialAndWrongOriginCannotBecomeDurableResponseEvidence()throws Exception {
        try(var x=new Fixture();var p=x.f.write(0)){x.configure=()->x.connection.onReply=()->x.connection.response=new JSONObject().put("echo",x.connection.headers.get("X-Device-Credential")).toString().getBytes(StandardCharsets.UTF_8);
            denied(()->x.send(p));assertEquals(1,x.opens);assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p).getBoolean("http_observation_present"));}
        try(var x=new Fixture();var p=x.f.write(0)){var http=new NativePrivateCustodyHttp(url->{x.opens++;x.connection=new Connection(new URL("https://example.invalid"));return x.connection;},x.f.clock);
            denied(()->x.f.engine.sendOriginalPrivateCustodyExchange(p,http,new NativeRetainedHttp.Attempt()));assertEquals(0,x.connection.sent.size());assertEquals(1,x.connection.disconnects);assertFalse(x.f.engine.observeOriginalPrivateCustodyExchangeOutcome(p).getBoolean("http_observation_present"));}
    }
    @Test public void nullForeignAndClosedOwnerCannotMintDispatchOrCreateAnOutcome()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        var files=NativePrivateCustodyOwnerTest.files(x.f.dir);denied(()->x.f.engine.sendOriginalPrivateCustodyExchange(null,x.http(),new NativeRetainedHttp.Attempt()));
        denied(()->x.f.engine.sendOriginalPrivateCustodyExchange(p,null,new NativeRetainedHttp.Attempt()));denied(()->x.f.engine.sendOriginalPrivateCustodyExchange(p,x.http(),null));
        var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();denied(()->other.f.engine().sendOriginalPrivateCustodyExchange(p,x.http(),new NativeRetainedHttp.Attempt()));
        p.close();denied(()->x.send(p));NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.opens);
    }}
    @Test public void lockedAbsentOnlyAppendRejectsIdenticalExistingUNKNOWNAsSecondDispatch()throws Exception {try(var x=new Fixture();var p=x.f.write(0)){
        x.f.engine.fenceOriginalPrivateCustodyExchange(p);Class<?> kinds=Class.forName(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal$Kind");
        Object kind=java.util.Arrays.stream(kinds.getEnumConstants()).filter(v->v.toString().equals("WRITE_UNKNOWN")).findFirst().orElseThrow();
        var read=x.f.journal.getClass().getDeclaredMethod("read",VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kinds,int.class);read.setAccessible(true);
        var append=x.f.journal.getClass().getDeclaredMethod("appendAbsent",VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kinds,int.class,String.class);append.setAccessible(true);
        try(var stored=(AutoCloseable)read.invoke(x.f.journal,x.f.plan,kind,0)){
            String document=(String)NativePrivateCustodyExchangeTest.field(stored,"document");var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(()->{try{append.invoke(x.f.journal,x.f.plan,kind,0,document);}catch(java.lang.reflect.InvocationTargetException e){if(e.getCause() instanceof VaultFailure)throw (VaultFailure)e.getCause();throw e;}});
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.opens);
        }
    }}

    @Test public void IDENTITY_NEW_dispatchUnknownReplacementDuringReplyRefusesOutcome()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var prepared=f.write(0)){
            var before=prepared.projection();byte[] original=NativePrivateCustodyExchangeTest.body(prepared);
            final int[] opens={0},callbacks={0};final Connection[] used={null};final java.nio.file.Path[] preserved={null};
            final Map<String,byte[]>[] recorded=new Map[]{null};
            var http=new NativePrivateCustodyHttp(url->{assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                assertFalse(Thread.holdsLock(f.engine));opens[0]++;used[0]=new Connection(url);
                used[0].onReply=()->{assertFalse(Thread.holdsLock(f.engine));callbacks[0]++;
                    recorded[0]=NativePrivateCustodyOwnerTest.files(f.dir);
                    preserved[0]=NativePrivateCustodyExchangeTest.replaceIdentityOriginal(f,"write_unknown-0.bin","dispatch-unknown");};return used[0];},f.clock);
            try{assertThrows(VaultFailure.class,()->f.engine.sendOriginalPrivateCustodyExchange(prepared,http,new NativeRetainedHttp.Attempt()));
                assertEquals(1,opens[0]);assertEquals(1,callbacks[0]);assertEquals(1,used[0].disconnects);
                assertArrayEquals(original,used[0].sent.toByteArray());
                assertEquals(before.get("native_request_id"),used[0].headers.get("X-Memphis-Native-Request-Id"));
                assertTrue(Files.exists(preserved[0]));assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                NativePrivateCustodyOwnerTest.sameFiles(recorded[0],f.dir);
                var unknown=f.engine.observeOriginalPrivateCustodyExchangeOutcome(prepared);noAuthority(unknown);
                assertFalse(unknown.getBoolean("http_observation_present"));assertTrue(unknown.getBoolean("unknown_fence_locally_committed_observed"));
                assertThrows(VaultFailure.class,()->f.engine.sendOriginalPrivateCustodyExchange(prepared,http,new NativeRetainedHttp.Attempt()));
                assertEquals(1,opens[0]);NativePrivateCustodyOwnerTest.sameFiles(recorded[0],f.dir);
            }finally{Arrays.fill(original,(byte)0);if(recorded[0]!=null)NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(recorded[0]);}
        }
    }
    // Reuse the existing private TEST response recipe; reflection observes
    // fixture bytes/DTO construction ONLY, never an Engine capability factory.
    private static byte[] identityPieceReply(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        VaultEngine.NativePrivateCustodyPreparedExchange query,JSONObject write,int index)throws Exception {
        byte[] frame=((byte[])NativePrivateCustodyExchangeTest.field(f.x.frame,"encoded")).clone();
        try{var recipe=NativePrivateCustodyReturnedPieceSetTest.class.getDeclaredMethod("currentCompletionPiece",
                VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,VaultEngine.NativePrivateCustodyPreparedExchange.class,JSONObject.class,byte[].class,int.class);
            recipe.setAccessible(true);
            try{return NativePrivateCustodyReturnedPieceSetTest.Fixture.wire((JSONObject)recipe.invoke(null,f.plan,query,write,frame,index));}
            catch(java.lang.reflect.InvocationTargetException failure){if(failure.getCause() instanceof Exception)throw (Exception)failure.getCause();throw failure;}
        }finally{Arrays.fill(frame,(byte)0);}
    }
    @Test public void IDENTITY_NEW_currentQueryUnknownReplacementDuringReplyRefusesRead()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var write=f.write(0)){
            var row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(query);byte[] reply=identityPieceReply(f,query,row,0);
                var saved=NativePrivateCustodyOwnerTest.files(f.dir);final int[] opens={0};final Connection[] used={null};
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                    var http=new NativePrivateCustodyHttp(url->{assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                        assertFalse(Thread.holdsLock(f.engine));opens[0]++;used[0]=new Connection(url);used[0].response=reply;
                        used[0].onReply=()->{assertFalse(Thread.holdsLock(f.engine));NativePrivateCustodyExchangeTest.replaceIdentityOriginal(f,"query_unknown-0.bin","current-query-unknown");};return used[0];},f.clock);
                    assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalPrivateCustodyQuery(dispatch,http,new NativeRetainedHttp.Attempt()));
                    assertEquals(1,opens[0]);assertEquals(1,used[0].disconnects);NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);
                    assertFalse(Files.exists(f.dir.resolve("query_observation-0.bin")));assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                    assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalPrivateCustodyQuery(dispatch,http,new NativeRetainedHttp.Attempt()));assertEquals(1,opens[0]);
                }finally{Arrays.fill(reply,(byte)0);NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(saved);}
            }
        }
    }
    @Test public void IDENTITY_NEW_currentFrameSameAncestryRemainsLive()throws Exception {currentFrameIdentity(false);}
    @Test public void IDENTITY_NEW_currentFrameOriginalReplacementRefusesHeldRead()throws Exception {currentFrameIdentity(true);}
    @Test public void CURRENT_BIRTH_controlledBirthOccursInsideActualTakeAndFileLock()throws Exception {currentFrameIdentity(false,true,false);}
    @Test public void CURRENT_BIRTH_lastSourceQueryUnknownMutationRefusesBeforeHTTP()throws Exception {currentFrameIdentity(false,true,true);}
    /** Actual complete current-frame factory followed by ONE original target
     * metadata lookup. The existing piece-reply recipe is synthetic HOST DATA;
     * the target reply is lost, never a fabricated descriptor or approval. */
    @Test public void FRAME_TARGET_originalLostReplySettlesPieceAndStaysOneUse()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var queries=new java.util.ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();
            var replies=new java.util.ArrayList<byte[]>();var currentConnections=new java.util.ArrayList<Connection>();
            Map<java.nio.file.Path,byte[]> originals=null;
            Map<java.nio.file.Path,Object> originalInodes=null;NativeRetainedNamespaceCensusTest.Stable originalStable=null;
            var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
            var directoryNames=new java.util.LinkedHashMap<java.nio.file.Path,java.util.Set<String>>();
            final Connection[] targetConnection={null};final byte[][] owned={null},copied={null};Throwable primary=null;
            try{
                var source=f.x.f.x.f.x;originalStable=new NativeRetainedNamespaceCensusTest.Stable(source);final var stable=originalStable;
                int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
                for(int i=0;i<count;i++)try(var write=f.write(i)){
                    var row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=f.query(i);queries.add(query);f.engine.fenceOriginalPrivateCustodyExchange(query);
                    replies.add(identityPieceReply(f,query,row,i));
                }
                var currentHttp=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,url.toString());
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                    int index=currentConnections.size();assertTrue(index<replies.size());
                    var connection=new Connection(url){@Override public OutputStream getOutputStream(){return new OutputStream(){
                        @Override public void write(int value){throw new AssertionError("original envelope array required");}
                        @Override public void write(byte[] bytes){/* no duplicate retained request buffer */}
                    };}};
                    connection.response=replies.get(index);currentConnections.add(connection);return connection;
                },f.clock);
                try(var control=new NativePrivateCustodyFrameReadControl();
                    var read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,currentHttp,control)){
                    coldNoAuthority(read.projection());assertEquals(count,currentConnections.size());
                    for(var connection:currentConnections)assertEquals(1,connection.disconnects);
                    originals=coldOriginals(f);originalInodes=coldInodes(originals);final var inodes=originalInodes;final var retained=originals;
                    for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,
                        java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    for(var directory:java.util.List.of(f.x.f.root,f.x.f.dir,f.x.dir,f.dir)){
                        attributes.put(directory,Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS));
                        try(var members=Files.list(directory)){directoryNames.put(directory,
                            members.map(path->path.getFileName().toString()).collect(java.util.stream.Collectors.toSet()));}
                    }
                    var queryPins=queries.get(0).projection();var opens=new java.util.concurrent.atomic.AtomicInteger();
                    var responses=new java.util.concurrent.atomic.AtomicInteger();var observedLoss=new java.util.concurrent.atomic.AtomicBoolean();
                    var observationFailure=new java.util.concurrent.atomic.AtomicReference<Throwable>();
                    var lost=new java.net.SocketTimeoutException("UNIT_original_target_response_lost");
                    var targetHttp=new NativePrivateCustodyHttp(url->{
                        assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH,url.toString());
                        assertEquals(1,opens.incrementAndGet());control.check();
                        assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(source.f.store.lock));
                        assertThrows(VaultFailure.class,control::beginPiece);
                        targetConnection[0]=new Connection(url){
                            @Override public OutputStream getOutputStream(){return new OutputStream(){
                                @Override public void write(int value){throw new AssertionError("original target envelope array required");}
                                @Override public void write(byte[] bytes){assertNull(owned[0]);owned[0]=bytes;copied[0]=bytes.clone();}
                            };}
                            @Override public int getResponseCode()throws java.io.IOException{
                                byte[] archived=null;
                                try{
                                    assertEquals(1,responses.incrementAndGet());control.check();assertThrows(VaultFailure.class,control::beginPiece);
                                    assertNotNull(owned[0]);assertTrue(Arrays.equals(owned[0],copied[0]));
                                    assertEquals(owned[0].length,fixedContentLength);assertEquals("POST",getRequestMethod());
                                    assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                                    assertTrue(getConnectTimeout()>0&&getConnectTimeout()<=5000);
                                    assertTrue(getReadTimeout()>0&&getReadTimeout()<=10000);
                                    assertTrue(queryPins.getString("native_request_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                                    String timestamp=headers.get("X-Memphis-Native-Request-Timestamp");
                                    assertNotNull(timestamp);assertTrue(timestamp.equals(VaultTimestamps.fromEpochMillisExact(
                                        VaultTimestamps.epochMillis(timestamp,NativeRetainedAttempt.FAILURE))));
                                    assertTrue(headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                                    var envelope=ProviderWireJson.object(owned[0],526336);
                                    assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp",
                                        "original_query_http_attestation","original_query_unknown_record_sha256"),envelope.keySet());
                                    assertEquals("custodial.original-private-custody-current-query.v1",envelope.getString("schema"));
                                    archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                                    assertTrue(queryPins.getString("request_body_sha256").equals(NativeRetainedAttempt.hash(archived)));
                                    assertTrue(queryPins.getString("native_request_timestamp").equals(envelope.getString("original_query_timestamp")));
                                    assertTrue(envelope.getString("original_query_http_attestation").matches("[a-f0-9]{64}"));
                                    assertTrue(NativeRetainedAttempt.hash(retained.get(f.dir.resolve("query_unknown-0.bin")))
                                        .equals(envelope.getString("original_query_unknown_record_sha256")));
                                    coldSame(retained,inodes);stable.check();control.check();
                                }catch(Exception|Error failure){observationFailure.set(failure);throw new java.io.IOException("UNIT_target_observation_failed",failure);}
                                finally{if(archived!=null)Arrays.fill(archived,(byte)0);}
                                observedLoss.set(true);throw lost;
                            }
                            @Override public void disconnect(){
                                assertFalse(Thread.holdsLock(control));assertFalse(Thread.holdsLock(f.engine));
                                assertFalse(Thread.holdsLock(source.f.store.lock));
                                assertNotNull(owned[0]);assertTrue(Arrays.equals(owned[0],copied[0]));
                                assertThrows("Target piece remains owned until disconnect settles",VaultFailure.class,control::beginPiece);
                                super.disconnect();
                            }
                            @Override public InputStream getInputStream(){throw new AssertionError("No target descriptor response");}
                            @Override public InputStream getErrorStream(){throw new AssertionError("No target error response");}
                            @Override public Map<String,List<String>> getHeaderFields(){throw new AssertionError("No target response headers");}
                        };return targetConnection[0];
                    },f.clock);
                    try(var unexpected=read.takeOriginalRecoveryTarget(targetHttp)){
                        fail("Lost target response cannot yield a target descriptor or approval");
                    }catch(VaultFailure failure){
                        if(observationFailure.get()!=null)failure.addSuppressed(observationFailure.get());
                        var trace=failure.getStackTrace();
                        if(!observedLoss.get()||opens.get()!=1||responses.get()!=1||failure.getCause()!=null||failure.getSuppressed().length!=0
                            ||!"custodial_private_custody_transport_outcome_unknown".equals(failure.code)||trace.length<2
                            ||!NativePrivateCustodyHttp.class.getName().equals(trace[0].getClassName())||!"unknown".equals(trace[0].getMethodName())
                            ||!NativePrivateCustodyHttp.class.getName().equals(trace[1].getClassName())||!"sendOwned".equals(trace[1].getMethodName()))throw failure;
                    }
                    assertTrue(observedLoss.get());assertEquals(1,opens.get());assertEquals(1,targetConnection[0].disconnects);
                    assertTrue("Owned target request wiped before piece release",Arrays.equals(new byte[owned[0].length],owned[0]));
                    control.check();
                    // Empty coordination probe only, no HTTP or old Attempt
                    // reuse: the settled network piece must be retired.
                    var emptyProbe=control.beginPiece();try{emptyProbe.check();}finally{control.endPiece(emptyProbe);}
                    var deniedAgain=assertThrows(VaultFailure.class,()->{
                        try(var unexpected=read.takeOriginalRecoveryTarget(targetHttp)){fail("one-use target claim revived");}
                    });
                    assertEquals(NativeRetainedAttempt.FAILURE,deniedAgain.code);assertEquals(1,opens.get());
                    assertEquals(NativeRetainedAttempt.FAILURE,assertThrows(VaultFailure.class,read::takeCompletionSemantics).code);
                    coldSame(originals,inodes);stable.check();
                }
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{
                    if(originals!=null&&originalInodes!=null)coldSame(originals,originalInodes);if(originalStable!=null)originalStable.check();
                    for(var entry:attributes.entrySet()){
                        var before=entry.getValue();var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(before.fileKey(),now.fileKey());assertEquals(before.owner(),now.owner());
                        assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                        if(before.isRegularFile()){assertEquals(before.size(),now.size());assertEquals(before.lastModifiedTime(),now.lastModifiedTime());}
                    }
                    for(var entry:directoryNames.entrySet())try(var members=Files.list(entry.getKey())){
                        assertEquals(entry.getValue(),members.map(path->path.getFileName().toString()).collect(java.util.stream.Collectors.toSet()));
                    }
                }
                catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                finally{
                    for(var query:queries)query.close();for(var reply:replies)Arrays.fill(reply,(byte)0);
                    for(var connection:currentConnections)connection.headers.clear();
                    if(targetConnection[0]!=null)targetConnection[0].headers.clear();
                    if(owned[0]!=null)Arrays.fill(owned[0],(byte)0);if(copied[0]!=null)Arrays.fill(copied[0],(byte)0);
                    if(originals!=null)for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);
                }
            }
        }
    }
    private static void currentFrameIdentity(boolean replace)throws Exception {
        currentFrameIdentity(replace,false,false);
    }
    private static void currentFrameIdentity(boolean replace,boolean verifyBirth,boolean mutateBirth)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var oldMap=source.unknown.get(namespace);
            var birthIndices=new java.util.TreeSet<Integer>();var birthSites=new java.util.HashSet<Integer>();
            var birthMutation=new java.util.concurrent.atomic.AtomicBoolean();
            var target=f.dir.resolve("query_unknown-0.bin");final byte[][] targetBytes={null,null};
            final java.nio.file.attribute.PosixFileAttributes[] targetAttributes={null};
            var queries=new java.util.ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();var replies=new java.util.ArrayList<byte[]>();
            var connections=new java.util.ArrayList<Connection>();Map<String,byte[]> saved=null,capsule=null,operation=null;
            try{int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
                for(int i=0;i<count;i++)try(var write=f.write(i)){
                    var row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=f.query(i);queries.add(query);f.engine.fenceOriginalPrivateCustodyExchange(query);replies.add(identityPieceReply(f,query,row,i));
                }
                saved=NativePrivateCustodyOwnerTest.files(f.dir);capsule=NativePrivateCustodyOwnerTest.files(f.x.f.dir);operation=NativePrivateCustodyOwnerTest.files(f.x.dir);
                if(verifyBirth){
                    if(mutateBirth){targetBytes[0]=Files.readAllBytes(target);targetBytes[1]=targetBytes[0].clone();targetBytes[1][targetBytes[1].length/2]^=1;
                        targetAttributes[0]=Files.readAttributes(target,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);}
                    source.unknown.put(namespace,new java.util.HashMap<String,Object>(oldMap){
                        @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                            var stack=Thread.currentThread().getStackTrace();String journal=VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal";
                            if(Arrays.stream(stack).anyMatch(s->s.getClassName().equals(journal)&&s.getMethodName().equals("readExistingOriginalCurrentQueryDispatch"))){
                                assertTrue("Current birth must occur in its actual controlled take",Arrays.stream(stack).anyMatch(s->
                                    s.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyCurrentQueryDispatch")&&s.getMethodName().equals("takeCurrentQueryRequest")));
                                assertTrue(Thread.holdsLock(f.engine));birthIndices.add(connections.size());
                                try(var probe=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),java.nio.file.StandardOpenOption.WRITE)){
                                    assertThrows(java.nio.channels.OverlappingFileLockException.class,probe::tryLock);
                                }catch(Exception failure){throw new AssertionError("Actual controlled current birth FileLock prerequisite",failure);}
                                if(mutateBirth&&connections.isEmpty())for(int i=0;i+1<stack.length;i++)
                                    if(stack[i].getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyChunkIdentityPlan")&&stack[i].getMethodName().equals("requireCurrent")
                                        &&stack[i+1].getClassName().equals(journal)&&stack[i+1].getMethodName().equals("readExistingOriginalCurrentQueryDispatch")){
                                        birthSites.add(stack[i+1].getLineNumber());
                                        if(birthSites.size()==2&&birthMutation.compareAndSet(false,true))try{
                                            Files.write(target,targetBytes[1]);Files.setLastModifiedTime(target,targetAttributes[0].lastModifiedTime());
                                        }catch(Exception failure){throw new AssertionError("Last actual current birth Source mutation prerequisite",failure);}
                                        break;
                                    }
                            }
                            return super.entrySet();
                        }
                    });
                }
                var http=new NativePrivateCustodyHttp(url->{assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                    assertFalse(Thread.holdsLock(f.engine));int index=connections.size();assertTrue(index<replies.size());var c=new Connection(url);c.response=replies.get(index);connections.add(c);return c;},f.clock);
                try(var control=new NativePrivateCustodyFrameReadControl()){
                    if(mutateBirth){
                        assertThrows("Last Source changed QUERY UNKNOWN must refuse before any HTTP",VaultFailure.class,
                            ()->f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control));
                        assertTrue(birthMutation.get());assertEquals(2,birthSites.size());assertEquals(0,connections.size());control.check();
                        assertArrayEquals(targetBytes[1],Files.readAllBytes(target));
                        var after=Files.readAttributes(target,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(targetAttributes[0].fileKey(),after.fileKey());assertEquals(targetAttributes[0].lastModifiedTime(),after.lastModifiedTime());
                        Files.write(target,targetBytes[0]);Files.setLastModifiedTime(target,targetAttributes[0].lastModifiedTime());
                        NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);return;
                    }
                    try(var read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control)){
                    var first=read.projection();assertEquals("CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK",first.get("state"));
                    assertTrue(first.getBoolean("all_fixed_original_query_and_issued_witnesses_current"));assertEquals(count,first.getInt("current_transport_piece_count"));
                    for(String flag:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(first.getBoolean(flag));
                    // Actual constructor-sealed native ancestry: four original
                    // ciphertext hashes interleaved with volatile identities.
                    var ancestry=new org.json.JSONArray((String)NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry"));assertEquals(count,ancestry.length());
                    for(int i=0;i<count;i++){var pins=ancestry.getJSONArray(i);assertEquals(8,pins.length());int slot=0;
                        for(String kind:new String[]{"write","write_unknown","query","query_unknown"}){
                            byte[] bytes=Files.readAllBytes(f.dir.resolve(kind+"-"+i+".bin"));
                            try{assertEquals(NativeRetainedAttempt.hash(bytes),pins.getString(slot));assertTrue(pins.getString(slot+1).matches("[a-f0-9]{64}"));}finally{Arrays.fill(bytes,(byte)0);}slot+=2;
                        }
                    }
                    assertEquals(first.toString(),read.projection().toString());
                    if(replace){NativePrivateCustodyExchangeTest.replaceIdentityOriginal(f,"write-0.bin","held-current-frame");
                        assertThrows(VaultFailure.class,read::projection);assertThrows(VaultFailure.class,read::takeCompletionSemantics);
                    }else{assertEquals(first.toString(),read.projection().toString());}
                    NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,f.x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operation,f.x.dir);
                    assertEquals(count,connections.size());for(var c:connections)assertEquals(1,c.disconnects);
                    if(verifyBirth)assertEquals(new java.util.TreeSet<>(java.util.stream.IntStream.range(0,count).boxed().toList()),birthIndices);
                    }
                }
            }finally{source.unknown.put(namespace,oldMap);
                if(targetBytes[0]!=null&&Files.exists(target)){Files.write(target,targetBytes[0]);Files.setLastModifiedTime(target,targetAttributes[0].lastModifiedTime());}
                for(var bytes:targetBytes)if(bytes!=null)Arrays.fill(bytes,(byte)0);
                for(var query:queries)query.close();for(byte[] reply:replies)Arrays.fill(reply,(byte)0);
                for(var snapshot:new Map[]{saved,capsule,operation})if(snapshot!=null)NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(snapshot);}
        }
    }
    // Actual saved-owner factory, existing guarded Source fixture, synthetic
    // HTTPS responses only. No reflected private capability, raw credential,
    // genuine restart/Android/TLS/SQL or semantic ACK claim.
    private static VaultEngine.NativePrivateCustodySavedReadOwner coldSavedOwner(
        NativePrivateCustodyExchangeTest.GuardedIdentityFixture f)throws Exception {
        var source=f.x.f.x.f.x;
        var existing=new java.util.TreeMap<String,android.content.SharedPreferences>();
        for(String name:source.unknown.keySet())existing.put(name,(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
            NativePrivateCustodyHttpOutcomeTest.class.getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                if(!method.getName().equals("getAll"))throw new AssertionError("saved reader edited original source");
                return new java.util.HashMap<>(source.raw(name));
            }));
        return f.engine.prepareSavedOriginalPrivateCustodyCurrentRead(source.f.batch.old.work,source.f.batch.old.principal,null,
            source.f.provider,source.f.batch.journal,AndroidProtectedNamespaceReaders.bind(existing),f.x.f.store,f.x.store);
    }
    private static Map<java.nio.file.Path,byte[]> coldOriginals(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f)throws Exception {
        var result=new java.util.LinkedHashMap<java.nio.file.Path,byte[]>();
        try{for(var dir:new java.nio.file.Path[]{f.x.f.dir,f.x.dir,f.dir})if(Files.exists(dir))
            try(var files=Files.newDirectoryStream(dir)){for(var file:files)result.put(file,Files.readAllBytes(file));}
            return result;
        }catch(Exception|Error failure){for(var bytes:result.values())Arrays.fill(bytes,(byte)0);throw failure;}
    }
    private static Map<java.nio.file.Path,Object> coldInodes(Map<java.nio.file.Path,byte[]> originals)throws Exception {
        var result=new java.util.LinkedHashMap<java.nio.file.Path,Object>();
        for(var path:originals.keySet())result.put(path,Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());return result;
    }
    private static void coldSame(Map<java.nio.file.Path,byte[]> originals,Map<java.nio.file.Path,Object> inodes)throws Exception {
        for(var entry:originals.entrySet()){
            byte[] current=Files.readAllBytes(entry.getKey());try{assertArrayEquals(entry.getValue(),current);}finally{Arrays.fill(current,(byte)0);}
            assertEquals(inodes.get(entry.getKey()),Files.readAttributes(entry.getKey(),java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        }
    }
    private static void coldNoAuthority(JSONObject result)throws Exception {
        assertEquals("custodial.native-current-original-frame-read.v1",result.get("schema"));
        assertEquals("CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK",result.get("state"));
        for(String flag:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged",
            "work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(result.getBoolean(flag));
    }
    private static NativePrivateCustodyHttp coldHttp(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        java.util.List<Connection> connections,java.util.List<String> order,java.util.List<byte[]> replies)throws Exception {
        return new NativePrivateCustodyHttp(url->{
            assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.x.f.x.f.x.f.store.lock));
            var connection=new Connection(url);connections.add(connection);
            connection.onReply=()->{
                assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.x.f.x.f.x.f.store.lock));
                byte[] sent=connection.sent.toByteArray();
                try{
                    if(url.toString().equals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read")){
                        JSONObject envelope=ProviderWireJson.object(sent,526336);byte[] archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                        int index;try{index=Integer.parseInt(ProviderWireJson.object(archived,393216).getString("chunk_index"));}finally{Arrays.fill(archived,(byte)0);}
                        order.add("CURRENT:"+index);
                        try(var write=f.write(index);var query=f.query(index)){
                            byte[] reply=identityPieceReply(f,query,NativePrivateCustodyReplySetTest.readback(write),index);
                            replies.add(reply);connection.response=reply;
                            assertEquals(query.projection().get("native_request_id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                        }
                    }else{
                        assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                        JSONObject body=ProviderWireJson.object(sent,393216);int index=Integer.parseInt(body.getString("chunk_index"));
                        String schema=body.getString("schema");assertTrue(schema.equals("custodial.original-native-private-custody-write.v1")
                            ||schema.equals("custodial.original-native-private-custody-query.v1"));
                        boolean write=schema.equals("custodial.original-native-private-custody-write.v1");order.add((write?"WRITE:":"QUERY:")+index);
                        assertEquals(f.plan.chunkMetadata(index).get(write?"attempt_id":"read_query_id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                        assertTrue(Files.exists(f.dir.resolve((write?"write_unknown-":"query_unknown-")+index+".bin")));
                    }
                }finally{Arrays.fill(sent,(byte)0);}
            };return connection;
        },f.clock);
    }
    @Test public void SAVED_BROWSER_READ_sameOwnerBoundAndWithdrawalRetainsOriginals()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            var owner=coldSavedOwner(f);
            try(var control=new NativePrivateCustodyFrameReadControl()){
                try(var read=f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,
                    coldHttp(f,connections,order,replies),control)){
                    assertSame("The returned browser read retains its actual original saved owner",owner,
                        NativePrivateCustodyExchangeTest.field(read,"savedOwner"));
                    coldNoAuthority(read.projection());coldSame(originals,inodes);stable.check();
                    assertFalse(Files.exists(f.dir.resolve("browser_frame-0.bin")));
                    owner.close();
                    assertThrows("A closed original owner cannot leave a usable current browser read",VaultFailure.class,read::projection);
                    coldSame(originals,inodes);stable.check();
                }
                var expected=new java.util.ArrayList<String>();for(int i=0;i<count;i++)expected.add("CURRENT:"+i);
                assertEquals(expected,order);assertEquals(count,connections.size());
                for(var connection:connections)assertEquals(1,connection.disconnects);
            }finally{owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);}
        }
    }
    /** Invoke only existing actual owner DATA/getter methods, never any
     * constructor or browser/source capability factory. */
    private static JSONObject actualOriginalBinding(VaultEngine.NativePrivateCustodyChunkIdentityPlan plan,boolean data)throws Exception {
        var method=VaultEngine.class.getDeclaredMethod(data?"originalBrowserBindingData":"originalBrowserBinding",plan.getClass());
        method.setAccessible(true);
        try{return (JSONObject)method.invoke(null,plan);}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw (Exception)failure.getCause();
            if(failure.getCause() instanceof Error)throw (Error)failure.getCause();throw new AssertionError(failure.getCause());
        }
    }
    @Test public void BINDING_DATA_originalTupleDetachedAndCallbackFree()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
            var callbacks=new java.util.concurrent.atomic.AtomicInteger();
            source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){callbacks.incrementAndGet();return super.entrySet();}
            });
            try{
                assertThrows("Unowned metadata lookup cannot escape the engine monitor",VaultFailure.class,()->actualOriginalBinding(f.plan,true));
                synchronized(f.engine){
                    var expected=actualOriginalBinding(f.plan,false);assertTrue("Live helper still executes actual Source callbacks",callbacks.get()>0);
                    callbacks.set(0);var data=actualOriginalBinding(f.plan,true);
                    assertTrue(ProviderWireJson.same(expected,data));assertEquals("Private binding DATA must not run arbitrary Source callbacks",0,callbacks.get());
                    data.put("native_mutation_stamp","DETACHED_CALLER_CHANGE");
                    assertTrue(ProviderWireJson.same(expected,actualOriginalBinding(f.plan,true)));assertEquals(0,callbacks.get());
                    f.plan.close();assertThrows(VaultFailure.class,()->actualOriginalBinding(f.plan,true));
                }
            }finally{source.unknown.put(namespace,map);}
        }
    }
    @Test public void BINDING_DATA_lateUnknownRefusesActualReadGetter()throws Exception {bindingDataReadTerminal(false);}
    @Test public void BINDING_DATA_queryExpiryRefusesActualReadGetter()throws Exception {bindingDataReadTerminal(true);}
    private static void bindingDataReadTerminal(boolean clockFault)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var originals=coldOriginals(f);var inodes=coldInodes(originals);var owner=coldSavedOwner(f);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var map=source.unknown.get(namespace);
            var path=f.dir.resolve("query_unknown-0.bin");var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
            long originalClock=f.clock.now;var fired=new java.util.concurrent.atomic.AtomicBoolean();
            try(var control=new NativePrivateCustodyFrameReadControl();
                var read=f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,coldHttp(f,connections,order,replies),control)){
                var expected=read.originalBrowserBinding();
                synchronized(f.engine){assertTrue(ProviderWireJson.same(expected,actualOriginalBinding(f.plan,true)));}
                int opened=connections.size();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(map){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        if(Arrays.stream(Thread.currentThread().getStackTrace()).anyMatch(s->s.getClassName().equals(read.getClass().getName())
                            &&s.getMethodName().equals("originalBrowserBinding"))&&fired.compareAndSet(false,true))try{
                            if(clockFault)f.clock.now=originalClock+120_001L;
                            else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                        }catch(Exception failure){throw new AssertionError("Actual binding read Source prerequisite",failure);}
                        return super.entrySet();
                    }
                });
                assertThrows("A descriptor cannot bypass the full actual current-read guard",VaultFailure.class,read::originalBrowserBinding);
                assertTrue(fired.get());assertEquals(opened,connections.size());
                source.unknown.put(namespace,map);f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                assertThrows("Restored bytes/time cannot revive the same refused read",VaultFailure.class,read::originalBrowserBinding);
                assertEquals(opened,connections.size());coldSame(originals,inodes);control.check();
            }finally{source.unknown.put(namespace,map);f.clock.now=originalClock;
                if(Files.exists(path)){Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);
                Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);}
        }
    }
    @Test public void BROWSER_DOCUMENT_detachedDataAndActualEncryptedReadback()throws Exception {browserPreservationData(0);}
    @Test public void BROWSER_DOCUMENT_changedUnknownAtEffectEntryRefusesBeforeCreation()throws Exception {browserPreservationData(1);}
    @Test public void BROWSER_DOCUMENT_queryExpiryAtEffectEntryRefusesBeforeCreation()throws Exception {browserPreservationData(2);}
    @Test public void BROWSER_DOCUMENT_metadataExpiryWithdrawsWithoutRevival()throws Exception {browserPreservationData(3);}
    @Test public void BROWSER_DOCUMENT_fixedLookupUsesActualCiphertextWithoutSourceCallbacks()throws Exception {browserPreservationData(4);}
    @Test public void BROWSER_DOCUMENT_fixedEffectLateQueryChangeRemainsPartialAndTerminalReadRefuses()throws Exception {browserPreservationData(5);}
    private static Object actualFixedBrowserLookup(VaultEngine.NativePrivateCustodyCurrentFrameRead read,
        Object journal,String kind,int index)throws Exception {
        var method=Arrays.stream(journal.getClass().getDeclaredMethods())
            .filter(m->m.getName().equals("readBrowserDocumentInsideCurrentFrameGuard")).findFirst().orElseThrow();
        var actualKind=Arrays.stream(method.getParameterTypes()[1].getEnumConstants())
            .filter(k->k.toString().equals(kind)).findFirst().orElseThrow();
        method.setAccessible(true);
        try{return method.invoke(journal,read,actualKind,index);}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw (Exception)failure.getCause();
            if(failure.getCause() instanceof Error)throw (Error)failure.getCause();throw new AssertionError(failure.getCause());
        }
    }
    /** Existing actual read methods only: a detached document builder and its
     * guarded native journal consumer. No browser owner/Exchange or capability
     * constructor is fabricated; this cannot prove live browser admission. */
    private static Object actualBrowserDocumentMethod(VaultEngine.NativePrivateCustodyCurrentFrameRead read,
        boolean retain,String kind,int index,JSONObject metadata,byte[] chunk)throws Exception {
        var method=Arrays.stream(read.getClass().getDeclaredMethods())
            .filter(m->m.getName().equals(retain?"retainBrowserDocument":"browserPreservationDocument")).findFirst().orElseThrow();
        // Select the actual closed fixed-name enum DATA, never an owner or
        // capability constructor. Its containing implementation stays private.
        var actualKind=Arrays.stream(method.getParameterTypes()[0].getEnumConstants())
            .filter(k->k.toString().equals(kind)).findFirst().orElseThrow();
        method.setAccessible(true);
        try{return method.invoke(read,retain?new Object[]{actualKind,index,metadata}:new Object[]{actualKind,index,metadata,chunk});}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw (Exception)failure.getCause();
            if(failure.getCause() instanceof Error)throw (Error)failure.getCause();throw new AssertionError(failure.getCause());
        }
    }
    private static void browserPreservationData(int mode)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var originals=coldOriginals(f);var inodes=coldInodes(originals);var owner=coldSavedOwner(f);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var oldMap=source.unknown.get(namespace);
            var path=f.dir.resolve("query_unknown-0.bin");var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(path),changed=original.clone(),data=new byte[56];changed[changed.length/2]^=1;
            long originalClock=f.clock.now;var fired=new java.util.concurrent.atomic.AtomicBoolean();
            try(var control=new NativePrivateCustodyFrameReadControl();
                var read=f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,coldHttp(f,connections,order,replies),control)){
                var frameKind="BROWSER_FRAME";
                var chunkKind="BROWSER_CHUNK";
                String sha=NativeRetainedAttempt.hash(data);
                // Synthetic bounded frame DATA only; no claim that these raw
                // bytes came from an injected document or encode accepted work.
                var metadata=new JSONObject().put("schema","custodial.browser-original-value-frame.v1").put("encoding","MZBRV001")
                    .put("observation_sha256",sha).put("frame_sha256",sha).put("byte_count",data.length).put("chunk_bytes",1048576)
                    .put("chunk_count",1).put("record_count",0).put("session_storage_state","NOT_DECLARED_UNKNOWN")
                    .put("chunk_sha256",new org.json.JSONArray().put(sha)).put("native_authority",false).put("durable_retention",false)
                    .put("inventory_acknowledged",false).put("finalizer_allowed",false).put("key_removal",false);
                synchronized(f.engine){
                    if(mode==3){
                        f.clock.now=originalClock+120_001L;
                        assertThrows(VaultFailure.class,()->actualBrowserDocumentMethod(read,false,frameKind,0,metadata,null));
                    }else{
                        var frame=(JSONObject)actualBrowserDocumentMethod(read,false,frameKind,0,metadata,null);
                        var chunk=(JSONObject)actualBrowserDocumentMethod(read,false,chunkKind,0,metadata,data);
                        assertFalse(frame.getBoolean("inventory_acknowledged"));assertFalse(frame.getBoolean("key_removal"));
                        metadata.put("record_count",1);assertEquals(0,frame.getJSONObject("browser_value_frame").getInt("record_count"));
                        if(mode==5){
                            // This actual read supplies the fixed body's full
                            // entry, then repeats its full terminal boundary.
                            // No browser owner or capability is constructed;
                            // these detached test bytes prove local DATA only.
                            read.projection();
                            source.unknown.put(namespace,new java.util.HashMap<String,Object>(oldMap){
                                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                    if(Arrays.stream(Thread.currentThread().getStackTrace()).anyMatch(s->s.getMethodName().equals("append"))
                                        &&fired.compareAndSet(false,true))try{
                                        Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());
                                    }catch(Exception failure){throw new AssertionError("Actual browser append Source mutation prerequisite",failure);}
                                    return super.entrySet();
                                }
                            });
                            var method=Arrays.stream(read.getClass().getDeclaredMethods())
                                .filter(m->m.getName().equals("retainBrowserDocumentInsideFixedReadBracket")).findFirst().orElseThrow();
                            var actualKind=Arrays.stream(method.getParameterTypes()[0].getEnumConstants())
                                .filter(k->k.toString().equals(frameKind)).findFirst().orElseThrow();
                            method.setAccessible(true);method.invoke(read,actualKind,0,frame);
                            assertTrue(fired.get());assertTrue(Files.size(f.dir.resolve("browser_frame-0.bin"))>=64);
                            assertFalse(Files.exists(f.dir.resolve("browser_chunk-0.bin")));
                            assertThrows("Complete terminal read must reject the changed QUERY before DATA adoption",VaultFailure.class,read::projection);
                            source.unknown.put(namespace,oldMap);Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                            assertThrows("Restoration cannot revive the same refused read",VaultFailure.class,read::projection);
                        }else if(mode==0||mode==4){
                            var lookupCallbacks=new java.util.concurrent.atomic.AtomicInteger();
                            if(mode==4){
                                source.unknown.put(namespace,new java.util.HashMap<String,Object>(oldMap){
                                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                        if(Arrays.stream(Thread.currentThread().getStackTrace()).anyMatch(s->
                                            s.getMethodName().equals("readBrowserDocumentInsideCurrentFrameGuard")))lookupCallbacks.incrementAndGet();
                                        return super.entrySet();
                                    }
                                });
                                assertNull(actualFixedBrowserLookup(read,f.journal,frameKind,0));
                                assertThrows(VaultFailure.class,()->actualFixedBrowserLookup(read,f.journal,"WRITE",0));
                                assertThrows(VaultFailure.class,()->actualFixedBrowserLookup(read,f.journal,frameKind,1));
                                assertThrows(VaultFailure.class,()->actualFixedBrowserLookup(read,f.journal,chunkKind,64));
                            }
                            actualBrowserDocumentMethod(read,true,frameKind,0,frame,null);
                            if(mode==4){
                                var stored=actualFixedBrowserLookup(read,f.journal,frameKind,0);assertNotNull(stored);
                                try{
                                    var field=stored.getClass().getDeclaredField("document");field.setAccessible(true);
                                    assertTrue(ProviderWireJson.same(frame,new JSONObject((String)field.get(stored))));
                                }finally{((AutoCloseable)stored).close();}
                            }
                            actualBrowserDocumentMethod(read,true,chunkKind,0,chunk,null);
                            var observed=read.observeSavedOriginalBrowserValues();
                            assertEquals("SAVED_ORIGINAL_LOCAL_PARTS_READ_BACK_NOT_REMOTE_ACK",observed.getString("state"));
                            assertFalse(observed.getBoolean("inventory_acknowledged"));assertFalse(observed.getBoolean("finalizer_allowed"));
                            assertEquals(1,observed.getInt("local_part_count"));
                            if(mode==4)assertEquals(0,lookupCallbacks.get());
                        }else{
                            source.unknown.put(namespace,new java.util.HashMap<String,Object>(oldMap){
                                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                                    var stack=Thread.currentThread().getStackTrace();
                                    if(Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("retainBrowserDocument"))
                                        &&fired.compareAndSet(false,true))try{
                                        if(mode==2)f.clock.now=originalClock+120_001L;
                                        else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                                    }catch(Exception failure){throw new AssertionError("Actual effect-entry Source prerequisite",failure);}
                                    return super.entrySet();
                                }
                            });
                            assertThrows(VaultFailure.class,()->actualBrowserDocumentMethod(read,true,frameKind,0,frame,null));
                            assertTrue(fired.get());
                        }
                    }
                    if(mode!=0&&mode!=4&&mode!=5){
                        assertFalse(Files.exists(f.dir.resolve("browser_frame-0.bin")));assertFalse(Files.exists(f.dir.resolve("browser_chunk-0.bin")));
                        source.unknown.put(namespace,oldMap);f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                        assertThrows("Original restoration cannot revive the refused read",VaultFailure.class,read::projection);
                    }
                }
                assertEquals(count,connections.size());coldSame(originals,inodes);control.check();
            }finally{source.unknown.put(namespace,oldMap);f.clock.now=originalClock;
                if(Files.exists(path)){Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);
                Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);Arrays.fill(data,(byte)0);}
        }
    }
    @Test public void BROWSER_DATA_factorySourceMutationRefusesBeforePublication()throws Exception {browserPrivateDataTerminal(false,false);}
    @Test public void BROWSER_DATA_factoryOriginalQueryExpiryRefusesBeforePublication()throws Exception {browserPrivateDataTerminal(false,true);}
    @Test public void BROWSER_DATA_restoreSourceMutationRefusesBeforeReturn()throws Exception {browserPrivateDataTerminal(true,false);}
    @Test public void BROWSER_DATA_restoreOriginalQueryExpiryRefusesBeforeReturn()throws Exception {browserPrivateDataTerminal(true,true);}
    @Test public void BROWSER_DATA_privateMetadataExpiryWithdrawsActualReadWithoutRevival()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var originals=coldOriginals(f);var inodes=coldInodes(originals);var owner=coldSavedOwner(f);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            long originalClock=f.clock.now;
            try(var control=new NativePrivateCustodyFrameReadControl();
                var read=f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,coldHttp(f,connections,order,replies),control)){
                var guard=read.getClass().getDeclaredMethod("requireLocalMetadataAndClockForPrivateData");guard.setAccessible(true);
                f.clock.now=originalClock+120_001L;
                synchronized(f.engine){
                    var denied=assertThrows(java.lang.reflect.InvocationTargetException.class,()->guard.invoke(read));
                    assertTrue(denied.getCause() instanceof VaultFailure);
                    assertEquals(NativeRetainedAttempt.FAILURE,((VaultFailure)denied.getCause()).code);
                    assertTrue(Arrays.stream(denied.getCause().getStackTrace()).anyMatch(s->s.getClassName().equals(NativeRetainedAttempt.class.getName())&&s.getMethodName().equals("requireFresh")));
                }
                f.clock.now=originalClock;
                assertThrows("Clock restoration cannot revive metadata-refused read",VaultFailure.class,read::projection);
                assertEquals(count,connections.size());coldSame(originals,inodes);control.check();
            }finally{f.clock.now=originalClock;owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);}
        }
    }
    /** Invoke only the actual read's private DATA method; no constructor or
     * capability is minted. Absence must still terminate in its full HTTP guard. */
    private static Object actualPrivateBrowserData(VaultEngine.NativePrivateCustodyCurrentFrameRead read)throws Exception {
        var method=read.getClass().getDeclaredMethod("restoreSavedOriginalBrowserRecords",java.util.List.class);
        method.setAccessible(true);
        try{return method.invoke(read,java.util.List.of());}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw (Exception)failure.getCause();
            if(failure.getCause() instanceof Error)throw (Error)failure.getCause();
            throw new AssertionError(failure.getCause());
        }
    }
    private static void browserPrivateDataTerminal(boolean restoring,boolean expiredClock)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var source=f.x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            var owner=coldSavedOwner(f);var liveRead=new java.util.concurrent.atomic.AtomicReference<VaultEngine.NativePrivateCustodyCurrentFrameRead>();
            final long originalClock=f.clock.now;String namespace="MemphisZooCustodialNativeVaultV1";
            var originalMap=source.unknown.get(namespace);var path=f.dir.resolve("query_unknown-0.bin");
            var before=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(path),changed=original.clone();changed[changed.length/2]^=1;
            var fired=new java.util.concurrent.atomic.AtomicBoolean();
            try(var control=new NativePrivateCustodyFrameReadControl()){
                var http=coldHttp(f,connections,order,replies);
                if(restoring){
                    liveRead.set(f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,http,control));
                    assertNull("Normal absence is DATA only",actualPrivateBrowserData(liveRead.get()));
                }
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        var stack=Thread.currentThread().getStackTrace();String engine=VaultEngine.class.getName(),journal=engine+"$NativePrivateCustodyExchangeJournal";
                        boolean target=restoring?Arrays.stream(stack).anyMatch(s->s.getClassName().equals(engine)&&s.getMethodName().equals("decodeSavedOriginalBrowserLocalData"))
                            &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(journal)&&s.getMethodName().equals("read"))
                            &&Arrays.stream(stack).noneMatch(s->s.getClassName().equals(journal)&&s.getMethodName().equals("key")):
                            Arrays.stream(stack).anyMatch(s->s.getClassName().equals(engine)&&s.getMethodName().equals("readCurrentOriginalPrivateCustodyFrameForBrowserPreparation"))
                            &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(engine+"$NativePrivateCustodyCurrentFrameRead")&&s.getMethodName().equals("requireCurrentCryptoProjectionUnderLock"))
                            // Empty unbound DATA has no later Source IO; the
                            // actual constructor owns this route's last guard.
                            &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(engine+"$NativePrivateCustodyCurrentFrameRead")&&s.getMethodName().equals("<init>"));
                        if(target&&fired.compareAndSet(false,true))try{
                            if(expiredClock)f.clock.now=originalClock+120_001L;
                            else{Files.write(path,changed);Files.setLastModifiedTime(path,before.lastModifiedTime());}
                        }catch(Exception failure){throw new AssertionError("Actual private browser DATA Source prerequisite",failure);}
                        return super.entrySet();
                    }
                });
                var failure=assertThrows("No private browser DATA may escape a changed or expired original",VaultFailure.class,()->{
                    if(restoring)actualPrivateBrowserData(liveRead.get());
                    else liveRead.set(f.engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(owner,f.journal,http,control));
                });
                assertTrue("Actual private Source boundary reached",fired.get());assertEquals(NativeRetainedAttempt.FAILURE,failure.code);
                assertEquals(0,failure.getSuppressed().length);
                if(expiredClock){
                    boolean originalFreshness=false;
                    for(Throwable cause=failure;cause!=null;cause=cause.getCause())
                        originalFreshness|=Arrays.stream(cause.getStackTrace()).anyMatch(s->s.getClassName().equals(NativeRetainedAttempt.class.getName())&&s.getMethodName().equals("requireFresh"));
                    assertTrue("Actual original-query freshness guard caused refusal",originalFreshness);
                }
                assertEquals(count,connections.size());for(var connection:connections)assertEquals(1,connection.disconnects);
                assertEquals(before.fileKey(),Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class).fileKey());
                assertEquals(before.lastModifiedTime(),Files.getLastModifiedTime(path));assertArrayEquals(expiredClock?original:changed,Files.readAllBytes(path));
                source.unknown.put(namespace,originalMap);f.clock.now=originalClock;Files.write(path,original);Files.setLastModifiedTime(path,before.lastModifiedTime());
                if(restoring)assertThrows("Restored bytes/clock cannot revive the refused read",VaultFailure.class,liveRead.get()::projection);
                else{assertNull(liveRead.get());assertEquals(Boolean.TRUE,NativePrivateCustodyExchangeTest.field(owner,"closed"));}
                assertFalse(Files.exists(f.dir.resolve("browser_frame-0.bin")));coldSame(originals,inodes);stable.check();control.check();
            }finally{
                source.unknown.put(namespace,originalMap);f.clock.now=originalClock;
                if(liveRead.get()!=null)liveRead.get().close();owner.close();
                Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);
            }
        }
    }
    @Test public void COLD_NEW_firstOriginalWriteQueryThenCurrentRead()throws Exception {coldCustody(false);}
    @Test public void COLD_NEW_reopenedCommittedUnknownNeverResends()throws Exception {coldCustody(true);}
    /** Changed existing-QUERY continuation: an actual pending original is
     * not a committed read witness and cannot admit any later piece send.
     * Crash arrangement moves the SAME encrypted inode; it creates no JSON,
     * authority, replacement key, new request or successful outcome. */
    @Test public void COLD_CURRENT_pendingQueryUnknownRefusesBeforeAnyContinuation()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            assertTrue(f.plan.projection().getInt("chunk_count")>=2);
            try(var write=f.write(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(0)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var committed=f.dir.resolve("query_unknown-0.bin");var pending=f.dir.resolve("query_unknown-0.pending");
            Object inode=Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
            assertFalse(Files.exists(pending));Files.move(committed,pending);
            assertEquals(inode,Files.readAttributes(pending,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            var owner=coldSavedOwner(f);var opens=new java.util.concurrent.atomic.AtomicInteger();
            try(var control=new NativePrivateCustodyFrameReadControl()){
                var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("pending QUERY admitted transport");},f.clock);
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,f.journal,http,control));
                assertEquals(0,opens.get());coldSame(originals,inodes);stable.check();
                assertTrue(Files.exists(pending));assertFalse(Files.exists(committed));
                assertFalse(Files.exists(f.dir.resolve("write-1.bin")));
            }finally{owner.close();for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    /** Fixed initial QUERY target acquisition only: a real Engine-produced
     * WRITE/UNKNOWN pair stays exact, then that same UNKNOWN inode in PENDING
     * cannot admit even an already prepared QUERY. HOST fixture DATA, no HTTP,
     * Android lifecycle, current custody, admission, ACK or finalization proof. */
    @Test public void QUERY_TARGET_existingOriginalPairStaysExactAndPendingRefuses()throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);}
            var originals=coldOriginals(f);var inodes=coldInodes(originals);
            var attributes=new java.util.LinkedHashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
            for(var path:originals.keySet())attributes.put(path,Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS));
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            Throwable primary=null;
            try{
                try(var query=f.query(0)){
                    var p=query.projection();NativePrivateCustodyExchangeTest.noAuthority(p);
                    assertEquals("QUERY",p.getString("kind"));assertEquals("PREPARED_NOT_SENT",p.getString("state"));
                    assertEquals(NativeRetainedAttempt.hash(originals.get(f.dir.resolve("write-0.bin"))),p.getString("target_write_record_sha256"));
                    assertEquals(NativeRetainedAttempt.hash(originals.get(f.dir.resolve("write_unknown-0.bin"))),p.getString("target_unknown_record_sha256"));
                    assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin"),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    coldSame(originals,inodes);stable.check();
                }
                // Add only the NEW normal Engine-produced QUERY witness. Old
                // expected WRITE/UNKNOWN/capsule/operation bytes never change.
                var queryPath=f.dir.resolve("query-0.bin");
                originals.put(queryPath,Files.readAllBytes(queryPath));
                var queryAttributes=Files.readAttributes(queryPath,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                inodes.put(queryPath,queryAttributes.fileKey());attributes.put(queryPath,queryAttributes);
                var committed=f.dir.resolve("write_unknown-0.bin");var pending=f.dir.resolve("write_unknown-0.pending");
                assertFalse(Files.exists(pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                originals.put(pending,originals.remove(committed));inodes.put(pending,inodes.remove(committed));
                attributes.put(pending,attributes.remove(committed));
                // This is only a disposable crash arrangement of the original
                // ciphertext inode, never a fabricated valid metadata record.
                var refused=assertThrows(VaultFailure.class,()->{try(var unexpected=f.query(0)){fail("PENDING WRITE_UNKNOWN admitted a QUERY");}});
                assertEquals(NativeRetainedAttempt.FAILURE,refused.code);
                assertFalse(Files.exists(committed,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin"),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                try(var members=Files.list(f.dir)){
                    assertEquals(java.util.Set.of("exchange.lock","write-0.bin","write_unknown-0.pending","query-0.bin"),
                        members.map(path->path.getFileName().toString()).collect(java.util.stream.Collectors.toSet()));
                }
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{
                    coldSame(originals,inodes);stable.check();
                    for(var entry:attributes.entrySet()){
                        var before=entry.getValue();var now=Files.readAttributes(entry.getKey(),java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(before.fileKey(),now.fileKey());assertEquals(before.size(),now.size());
                        assertEquals(before.lastModifiedTime(),now.lastModifiedTime());assertEquals(before.owner(),now.owner());
                        assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                    }
                }catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                finally{for(var bytes:originals.values())Arrays.fill(bytes,(byte)0);}
                // No transport, resume, pending removal, original or key reset.
            }
        }
    }
    private static void coldCustody(boolean existingUnknown)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture()){
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);assertFalse(Files.exists(f.dir));
            if(existingUnknown)for(int i=0;i<count;i++)try(var write=f.write(i)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);try(var query=f.query(i)){f.engine.fenceOriginalPrivateCustodyExchange(query);}
            }
            var original=coldOriginals(f);var inodes=coldInodes(original);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            var connections=new java.util.ArrayList<Connection>();var order=new java.util.ArrayList<String>();var replies=new java.util.ArrayList<byte[]>();
            var owner=coldSavedOwner(f);var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(f.x.f.root.toFile());
            try(var control=new NativePrivateCustodyFrameReadControl()){
                try(var result=f.engine.retainSavedOriginalPrivateCustodyFrame(owner,journal,coldHttp(f,connections,order,replies),control)){
                    var projection=result.projection();coldNoAuthority(projection);assertEquals(count,projection.getInt("current_transport_piece_count"));
                    assertEquals(projection.toString(),result.projection().toString());coldSame(original,inodes);stable.check();
                }
                var expected=new java.util.ArrayList<String>();
                if(!existingUnknown)for(int i=0;i<count;i++){expected.add("WRITE:"+i);expected.add("QUERY:"+i);}
                for(int i=0;i<count;i++)expected.add("CURRENT:"+i);
                assertEquals(expected,order);assertEquals(expected.size(),connections.size());
                for(var connection:connections)assertEquals(1,connection.disconnects);
                coldSame(original,inodes);stable.check();
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,journal,
                    new NativePrivateCustodyHttp(url->{throw new AssertionError("closed original reused");},f.clock),control));
            }finally{owner.close();for(var bytes:original.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);}
        }
    }
    @Test public void COLD_NEW_cancellationDuringFirstReplyKeepsUnknown()throws Exception {coldFirstRefusal(true);}
    @Test public void COLD_NEW_ambiguousFirstReplyKeepsOriginals()throws Exception {coldFirstRefusal(false);}
    private static void coldFirstRefusal(boolean cancel)throws Exception {
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            assertFalse(Files.exists(f.dir));var original=coldOriginals(f);var inodes=coldInodes(original);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);var owner=coldSavedOwner(f);
            final int[] opens={0};final Connection[] used={null};final Map<java.nio.file.Path,byte[]>[] fenced=new Map[]{null};
            final Map<java.nio.file.Path,Object>[] fencedInodes=new Map[]{null};
            var http=new NativePrivateCustodyHttp(url->{opens[0]++;assertFalse(Thread.holdsLock(f.engine));
                assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                used[0]=new Connection(url);used[0].timeout=!cancel;used[0].onReply=()->{
                    fenced[0]=coldOriginals(f);fencedInodes[0]=coldInodes(fenced[0]);if(cancel)control.cancel();
                };return used[0];},f.clock);
            try{
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,f.journal,http,control));
                assertEquals(1,opens[0]);assertEquals(1,used[0].disconnects);assertNotNull(fenced[0]);coldSame(fenced[0],fencedInodes[0]);
                assertTrue(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("query-0.bin")));coldSame(original,inodes);stable.check();
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,f.journal,http,control));
                assertEquals(1,opens[0]);coldSame(fenced[0],fencedInodes[0]);
            }finally{owner.close();for(var bytes:original.values())Arrays.fill(bytes,(byte)0);
                if(fenced[0]!=null)for(var bytes:fenced[0].values())Arrays.fill(bytes,(byte)0);}
        }
    }
    // Actual guarded saved-original Engine/UNKNOWN/HTTP ownership. Lifecycle
    // is synthetic, as are TLS connection and original actors. No reflected
    // private handles, new authority, real network or Android platform claim.
    @Test public void LIFECYCLE_NEW_signalDuringFirstReplySurvivesConsumedInterrupt()throws Exception {
        lifecycleFirstOriginalOutcome(false);
    }
    @Test public void LIFECYCLE_NEW_signalAndLostFirstReplyKeepExactUnknown()throws Exception {
        lifecycleFirstOriginalOutcome(true);
    }
    private static void lifecycleFirstOriginalOutcome(boolean lostReply)throws Exception {
        mark("lifecycle_guarded_original_setup");
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            assertFalse(Files.exists(f.dir));
            var original=coldOriginals(f);var inodes=coldInodes(original);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            var owner=coldSavedOwner(f);
            var entered=new java.util.concurrent.CountDownLatch(1);
            var signaled=new java.util.concurrent.CountDownLatch(1);
            var lifecycleFailure=new java.util.concurrent.atomic.AtomicReference<Throwable>();
            var stopLifecycle=new java.util.concurrent.atomic.AtomicBoolean();
            var used=new java.util.concurrent.atomic.AtomicReference<Connection>();
            var caller=Thread.currentThread();
            final int[] opens={0},replyCallbacks={0};
            final boolean[] consumedInterrupt={false};
            final byte[][] sent={null};
            final Map<java.nio.file.Path,byte[]>[] fenced=new Map[]{null};
            final Map<java.nio.file.Path,Object>[] fencedInodes=new Map[]{null};
            Thread lifecycle=new Thread(()->{
                try{
                    assertTrue("original reply boundary not reached",entered.await(5,java.util.concurrent.TimeUnit.SECONDS));
                    if(stopLifecycle.get())return;
                    control.requestCancellation(); // same live control/Attempt, no IO/close/end
                    caller.interrupt();
                }catch(Throwable failure){lifecycleFailure.set(failure);}
                finally{signaled.countDown();}
            },"synthetic-custody-activity-retirement");
            var http=new NativePrivateCustodyHttp(url->{
                assertFalse(Thread.holdsLock(f.engine));assertEquals(1,++opens[0]);
                assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                var connection=new Connection(url){
                    @Override public void disconnect(){
                        assertNotSame("lifecycle signal must not perform platform IO",lifecycle,Thread.currentThread());
                        super.disconnect();
                    }
                };
                used.set(connection);connection.timeout=lostReply;
                connection.onReply=()->{
                    replyCallbacks[0]++;
                    assertFalse(Thread.holdsLock(f.engine));
                    assertFalse(Thread.holdsLock(f.x.f.x.f.x.f.store.lock));
                    assertTrue(Files.exists(f.dir.resolve("write_unknown-0.bin")));
                    assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                    sent[0]=connection.sent.toByteArray();
                    var body=ProviderWireJson.object(sent[0],NativeRetainedAttempt.MAX_BODY);
                    assertEquals("custodial.original-native-private-custody-write.v1",body.get("schema"));
                    assertEquals("0",body.get("chunk_index"));
                    assertEquals(f.plan.chunkMetadata(0).get("attempt_id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                    fenced[0]=coldOriginals(f);fencedInodes[0]=coldInodes(fenced[0]);
                    mark("lifecycle_first_original_reply_owned");entered.countDown();
                    // Model a platform await that consumes interruption. The
                    // sticky same-control signal must still deny publication.
                    try{assertTrue("lifecycle signal did not finish",signaled.await(5,java.util.concurrent.TimeUnit.SECONDS));}
                    catch(InterruptedException consumed){consumedInterrupt[0]=true;}
                    assertTrue("lifecycle signal did not settle",signaled.await(5,java.util.concurrent.TimeUnit.SECONDS));
                    consumedInterrupt[0]|=Thread.interrupted();
                    assertTrue("worker interrupt was not exercised",consumedInterrupt[0]);
                    assertFalse(Thread.currentThread().isInterrupted());
                    if(lifecycleFailure.get()!=null)throw new AssertionError("lifecycle signal failed",lifecycleFailure.get());
                    mark(lostReply?"lifecycle_consumed_interrupt_then_lost_reply":"lifecycle_consumed_interrupt_before_reply");
                };
                return connection;
            },f.clock);
            try{
                lifecycle.start();
                VaultFailure refusal=assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,f.journal,http,control));
                // An observed cancellation comes from the exact Attempt's
                // checkpoint; a lost reply comes from the private HTTP catch.
                assertEquals(lostReply?"custodial_private_custody_transport_outcome_unknown":
                    "custodial_retained_transport_outcome_unknown",refusal.code);
                assertTrue("intended original reply was not reached",consumedInterrupt[0]);
                lifecycle.join(5000);assertFalse("lifecycle thread leaked",lifecycle.isAlive());assertNull(lifecycleFailure.get());
                assertEquals(1,opens[0]);assertEquals(1,replyCallbacks[0]);assertEquals(1,used.get().disconnects);
                assertFalse(Thread.currentThread().isInterrupted());assertThrows(VaultFailure.class,control::check);
                assertNotNull(fenced[0]);recoveryJoinSame(f,fenced[0],fencedInodes[0]);coldSame(original,inodes);stable.check();
                assertTrue(Files.exists(f.dir.resolve("write_unknown-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("write_observation-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("query-0.bin")));
                assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                // Reopen only the SAME saved write as DATA, with exact original
                // ID/time/body. Existing helper clones bytes from a legitimately
                // obtained owner; it does not construct a private capability.
                try(var archived=f.write(0)){
                    var projection=archived.projection();noAuthority(projection);
                    assertEquals(f.plan.projection().get("operation_id"),projection.get("operation_id"));
                    assertEquals(used.get().headers.get("X-Memphis-Native-Request-Id"),projection.get("native_request_id"));
                    assertEquals(used.get().headers.get("X-Memphis-Native-Request-Timestamp"),projection.get("native_request_timestamp"));
                    assertEquals(NativeRetainedAttempt.hash(sent[0]),projection.get("request_body_sha256"));
                    byte[] exact=NativePrivateCustodyExchangeTest.body(archived);
                    try{assertArrayEquals(sent[0],exact);}finally{Arrays.fill(exact,(byte)0);}
                }
                recoveryJoinSame(f,fenced[0],fencedInodes[0]);
                assertThrows(VaultFailure.class,()->f.engine.retainSavedOriginalPrivateCustodyFrame(owner,f.journal,http,control));
                assertEquals(1,opens[0]);recoveryJoinSame(f,fenced[0],fencedInodes[0]);stable.check();
                mark("lifecycle_original_unknown_retained_no_query_or_resend");
            }finally{
                stopLifecycle.set(true);entered.countDown();
                lifecycle.join(5000);assertFalse("lifecycle thread leaked during cleanup",lifecycle.isAlive());
                Thread.interrupted();owner.close();
                for(var bytes:original.values())Arrays.fill(bytes,(byte)0);
                if(fenced[0]!=null)for(var bytes:fenced[0].values())Arrays.fill(bytes,(byte)0);
                if(sent[0]!=null)Arrays.fill(sent[0],(byte)0);
            }
        }
    }
    // Newly affected composite only: authentic original synthetic dispatch,
    // explicit local recovery, then a DISTINCT real saved-owner current read.
    // This is not real transport, Android storage, SQL or semantic ACK proof.
    @Test public void RECOVERY_JOIN_sameOriginalPendingAndAliasThenCurrentCompletion()throws Exception {recoveryCurrentJoin(false);}
    @Test public void RECOVERY_JOIN_sourceWithdrawalBeforeFreshReadOpensNothing()throws Exception {recoveryCurrentJoin(true);}
    private static void recoveryJoinSame(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        Map<java.nio.file.Path,byte[]> original,Map<java.nio.file.Path,Object> inodes)throws Exception {
        var current=coldOriginals(f);
        try{assertEquals(original.keySet(),current.keySet());coldSame(original,inodes);}
        finally{for(var bytes:current.values())Arrays.fill(bytes,(byte)0);}
    }
    // Joined-test-only server recipe. Current callbacks use exact replies
    // prepared while original WRITE/QUERY handles were already open; they
    // never reconstruct a native owner or prepare an original piece again.
    private static NativePrivateCustodyHttp recoveryJoinHttp(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
        java.util.List<Connection> connections,java.util.List<String> order,java.util.List<byte[]> replies,
        java.util.List<byte[]> queryBodies,java.util.List<Map<String,String>> queryHeaders,java.util.List<String> queryUnknownHashes)throws Exception {
        return new NativePrivateCustodyHttp(url->{
            assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.x.f.x.f.x.f.store.lock));
            boolean current=url.toString().equals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read");
            if(!current)assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
            var connection=new Connection(url);connections.add(connection);
            connection.onReply=()->{
                assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.x.f.x.f.x.f.store.lock));
                byte[] sent=connection.sent.toByteArray(),archived=null;
                try{
                    if(current){
                        var envelope=ProviderWireJson.object(sent,526336);
                        NativeRetainedAttempt.keys(envelope,"schema","original_query_body_base64","original_query_timestamp",
                            "original_query_http_attestation","original_query_unknown_record_sha256");
                        assertEquals(NativePrivateCustodyCurrentQueryEnvelope.SCHEMA,envelope.get("schema"));
                        String encoded=envelope.getString("original_query_body_base64");archived=java.util.Base64.getDecoder().decode(encoded);
                        assertEquals(encoded,java.util.Base64.getEncoder().encodeToString(archived));
                        var query=ProviderWireJson.object(archived,393216);int index=Integer.parseInt(query.getString("chunk_index"));
                        assertEquals(Integer.toString(index),query.get("chunk_index"));assertTrue(index>=0&&index<replies.size());
                        assertEquals(replies.size(),queryBodies.size());assertEquals(replies.size(),queryHeaders.size());
                        assertEquals(replies.size(),queryUnknownHashes.size());
                        assertArrayEquals(queryBodies.get(index),archived);
                        var headers=queryHeaders.get(index);
                        assertEquals(headers.get("X-Memphis-Native-Request-Id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                        assertEquals(headers.get("X-Memphis-Native-Request-Timestamp"),envelope.get("original_query_timestamp"));
                        assertEquals(headers.get("X-Memphis-Native-Request-Attestation"),envelope.get("original_query_http_attestation"));
                        assertEquals(queryUnknownHashes.get(index),envelope.get("original_query_unknown_record_sha256"));
                        byte[] reply=replies.get(index);assertTrue(reply.length>0&&reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);
                        order.add("CURRENT:"+index);connection.response=reply;
                    }else{
                        var body=ProviderWireJson.object(sent,393216);int index=Integer.parseInt(body.getString("chunk_index"));
                        String schema=body.getString("schema");assertTrue(schema.equals("custodial.original-native-private-custody-write.v1")
                            ||schema.equals("custodial.original-native-private-custody-query.v1"));
                        boolean write=schema.equals("custodial.original-native-private-custody-write.v1");order.add((write?"WRITE:":"QUERY:")+index);
                        assertEquals(f.plan.chunkMetadata(index).get(write?"attempt_id":"read_query_id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                        assertTrue(Files.exists(f.dir.resolve((write?"write_unknown-":"query_unknown-")+index+".bin")));
                    }
                }finally{Arrays.fill(sent,(byte)0);if(archived!=null)Arrays.fill(archived,(byte)0);}
            };return connection;
        },f.clock);
    }
    private static void recoveryCurrentJoin(boolean withdraw)throws Exception {
        long diagnosticStart=System.nanoTime();
        java.util.function.Consumer<String> phase=stage->{System.out.println("RECOVERY_JOIN_ELAPSED_NS "+(System.nanoTime()-diagnosticStart)+" "+stage);System.out.flush();};
        phase.accept("fixture_setup_before");
        try(var f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            phase.accept("fixture_setup_after");
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            var connections=new java.util.ArrayList<Connection>();
            var order=new java.util.ArrayList<String>(){
                boolean firstCurrent;
                @Override public boolean add(String value){
                    // The joined recipe emits this inside its current reply
                    // callback, after decoding the sent original QUERY index.
                    if(!firstCurrent&&value.startsWith("CURRENT:")){firstCurrent=true;phase.accept("first_current_reply_callback_order");}
                    return super.add(value);
                }
            };
            var replies=new java.util.ArrayList<byte[]>();var queryBodies=new java.util.ArrayList<byte[]>();
            var queryHeaders=new java.util.ArrayList<Map<String,String>>();var queryUnknownHashes=new java.util.ArrayList<String>();
            var http=recoveryJoinHttp(f,connections,order,replies,queryBodies,queryHeaders,queryUnknownHashes);Map<java.nio.file.Path,byte[]> original=null;
            try{
                // Existing actual Engine sender creates each original UNKNOWN
                // before synthetic IO; no caller-issued dispatch capability.
                phase.accept("original_dispatch_before");
                for(int i=0;i<count;i++){
                    byte[] readback=null;
                    try{
                        try(var write=f.write(i)){
                            readback=NativePrivateCustodyReplySetTest.readback(write).toString().getBytes(StandardCharsets.UTF_8);
                            assertTrue(readback.length>0&&readback.length<=NativePrivateCustodyHttp.MAX_RESPONSE);
                            var attempt=new NativeRetainedHttp.Attempt();
                            try{var observed=f.engine.sendOriginalPrivateCustodyExchange(write,http,attempt);
                                assertTrue(observed.getBoolean("http_observation_locally_committed"));noAuthority(observed);
                            }finally{attempt.cancel();}
                        }
                        try(var query=f.query(i)){
                            var attempt=new NativeRetainedHttp.Attempt();
                            try{var observed=f.engine.sendOriginalPrivateCustodyExchange(query,http,attempt);
                                assertTrue(observed.getBoolean("http_observation_locally_committed"));noAuthority(observed);
                            }finally{attempt.cancel();}
                            phase.accept("fixture_reply_precompute_before_"+i);
                            byte[] reply=identityPieceReply(f,query,ProviderWireJson.object(readback,NativePrivateCustodyHttp.MAX_RESPONSE),i);
                            try{assertTrue(reply.length>0&&reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);replies.add(reply);reply=null;}
                            finally{if(reply!=null)Arrays.fill(reply,(byte)0);}
                            byte[] body=NativePrivateCustodyExchangeTest.body(query);
                            try{assertTrue(body.length>0&&body.length<=393216);queryBodies.add(body);body=null;}
                            finally{if(body!=null)Arrays.fill(body,(byte)0);}
                            var originalConnection=connections.get(connections.size()-1);
                            assertEquals("QUERY:"+i,order.get(order.size()-1));
                            byte[] sent=originalConnection.sent.toByteArray();
                            try{assertArrayEquals(queryBodies.get(i),sent);}finally{Arrays.fill(sent,(byte)0);}
                            queryHeaders.add(new java.util.HashMap<>(originalConnection.headers));
                            byte[] unknown=Files.readAllBytes(f.dir.resolve("query_unknown-"+i+".bin"));
                            try{queryUnknownHashes.add(NativeRetainedAttempt.hash(unknown));}finally{Arrays.fill(unknown,(byte)0);}
                            phase.accept("fixture_reply_precompute_after_"+i);
                        }
                    }finally{if(readback!=null)Arrays.fill(readback,(byte)0);}
                }
                assertEquals(count,replies.size());assertEquals(count,queryBodies.size());assertEquals(count,queryHeaders.size());assertEquals(count,queryUnknownHashes.size());
                phase.accept("original_dispatch_after");
                assertEquals(count*2,connections.size());mark("recovery_join_originals_ready");
                original=coldOriginals(f);var inodes=coldInodes(original);
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
                var source=f.x.guardedSemantics.projection();
                // Both supported authentic phases in this SAME original:
                // one pending QUERY UNKNOWN and one same-inode WRITE alias.
                Files.move(f.dir.resolve("query_unknown-0.bin"),f.dir.resolve("query_unknown-0.pending"));
                Files.createLink(f.dir.resolve("write_unknown-0.pending"),f.dir.resolve("write_unknown-0.bin"));
                phase.accept("recovery_saved_owner_before");
                try(var saved=coldSavedOwner(f)){
                    phase.accept("recovery_saved_owner_after");phase.accept("local_recovery_before");
                    var recovered=f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(saved,f.journal,control);
                    phase.accept("local_recovery_after");
                    assertEquals("custodial.native-saved-original-piece-journal-resume.v1",recovered.get("schema"));
                    assertEquals("EXISTING_ORIGINAL_PIECE_JOURNALS_LOCALLY_RECOVERED_NO_TRANSPORT_OR_ACK",recovered.get("state"));
                    assertEquals(count*6,recovered.getInt("existing_records_observed"));assertEquals(2,recovered.getInt("pending_or_alias_records_recovered"));
                    for(String flag:new String[]{"missing_records_created","network_dispatch_allowed","remote_future_acceptance_or_transaction_authority",
                        "inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertEquals(Boolean.FALSE,recovered.get(flag));
                    assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(saved,f.journal,control));
                }
                mark("recovery_join_local_recovery_complete");
                phase.accept("post_recovery_file_check_before");recoveryJoinSame(f,original,inodes);phase.accept("post_recovery_file_check_after");
                phase.accept("post_recovery_stable_check_before");stable.check();phase.accept("post_recovery_stable_check_after");
                assertEquals(count*2,connections.size());
                // The consumed recovery owner is never reused for the read.
                phase.accept("fresh_saved_owner_before");
                try(var fresh=coldSavedOwner(f)){
                    phase.accept("fresh_saved_owner_after");
                    if(withdraw){
                        // Existing all8 source mutation seam, not a fabricated
                        // owner flag or replacement provider/control/clock.
                        var vault=f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");
                        String key="recovery-join-source-withdrawal";assertFalse(vault.containsKey(key));
                        vault.put(key,"synthetic changed retained source");
                        try{
                            assertThrows(VaultFailure.class,()->f.engine.readSavedOriginalPrivateCustodyCurrentFrame(fresh,f.journal,http,control));
                            assertEquals(count*2,connections.size());recoveryJoinSame(f,original,inodes);
                        }finally{vault.remove(key);}
                        stable.check();mark("recovery_join_withdrawal_refused_before_transport");
                    }else{
                        phase.accept("saved_current_frame_read_before");
                        try(var read=f.engine.readSavedOriginalPrivateCustodyCurrentFrame(fresh,f.journal,http,control)){
                            phase.accept("saved_current_frame_read_after");
                            mark("recovery_join_fresh_current_frame_ready");coldNoAuthority(read.projection());
                            try(var completion=read.takeCompletionSemantics()){
                                var p=completion.projection();NativeRetainedNamespaceCompletionJoinTest.noAuthority(p);
                                assertEquals(NativeRetainedNamespaceCompletionJoin.SCHEMA,p.get("schema"));
                                for(String pin:new String[]{"source_capture_sha256","values_sha256","principal_digest","engine_revision","original_generation_id","record_count"})
                                    assertEquals(pin,source.get(pin),p.get(pin));
                                assertEquals(source.get("semantic_join_sha256"),p.get("original_source_join_sha256"));
                                assertThrows(VaultFailure.class,read::takeCompletionSemantics);
                                recoveryJoinSame(f,original,inodes);stable.check();mark("recovery_join_current_completion_ready");
                            }
                            assertThrows(VaultFailure.class,read::projection);
                        }
                    }
                }
                var expected=new java.util.ArrayList<String>();for(int i=0;i<count;i++){expected.add("WRITE:"+i);expected.add("QUERY:"+i);}
                if(!withdraw)for(int i=0;i<count;i++)expected.add("CURRENT:"+i);
                assertEquals(expected,order);assertEquals(expected.size(),connections.size());
                for(var connection:connections)assertEquals(1,connection.disconnects);
                recoveryJoinSame(f,original,inodes);stable.check();mark("recovery_join_owning_closures_complete");
            }finally{if(original!=null)for(var bytes:original.values())Arrays.fill(bytes,(byte)0);for(var reply:replies)Arrays.fill(reply,(byte)0);
                for(var body:queryBodies)Arrays.fill(body,(byte)0);for(var headers:queryHeaders)headers.clear();queryUnknownHashes.clear();}
        }
    }
    // TASK10 FRAME_CONTROL: source-only transient coordination; no original
    // crypto fixture, network, journal, credential or clock/audio proof.
    private static Object frameControlField(Object value,String name)throws Exception {
        var field=value.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(value);
    }
    private static void expireFrameControlOnly(NativePrivateCustodyFrameReadControl control)throws Exception {
        // Advance ONLY this disposable resource-budget fixture toward failure;
        // no production clock/timeout setter and no renewed original Attempt.
        var field=control.getClass().getDeclaredField("deadline");field.setAccessible(true);field.setLong(control,System.nanoTime()-1);
    }
    @Test public void FRAME_CONTROL_fixedFrameAndExistingPieceBudgetsNeverRenewAttempt()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl()){
            long frameDeadline=(Long)frameControlField(control,"deadline");assertTrue(frameDeadline-System.nanoTime()>0);assertTrue(frameDeadline-System.nanoTime()<=180_000_000_000L);
            var first=control.beginPiece();long pieceDeadline=(Long)frameControlField(first,"deadline");
            assertTrue(pieceDeadline-System.nanoTime()>0);assertTrue(pieceDeadline-System.nanoTime()<=30_000_000_000L);
            assertEquals(frameDeadline,(long)(Long)frameControlField(control,"deadline"));control.endPiece(first);denied(first::check);
            var second=control.beginPiece();assertNotSame(first,second);second.check();denied(first::check);
            assertEquals(frameDeadline,(long)(Long)frameControlField(control,"deadline"));control.endPiece(second);denied(second::check);control.check();
        }
    }
    @Test public void FRAME_CONTROL_onlyExactCallingOwnerCanEndActivePiece()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl()){
            var piece=control.beginPiece();var foreign=new NativeRetainedHttp.Attempt();
            try{denied(control::beginPiece);denied(()->control.endPiece(null));denied(()->control.endPiece(foreign));piece.check();
                var failure=new java.util.concurrent.atomic.AtomicReference<Throwable>();
                Thread wrong=new Thread(()->{try{control.endPiece(piece);failure.set(new AssertionError("foreign thread ended piece"));}catch(VaultFailure expected){}catch(Throwable error){failure.set(error);}},"synthetic-frame-wrong-end-owner");
                wrong.start();wrong.join(2000);assertFalse(wrong.isAlive());assertNull(failure.get());assertSame(piece,frameControlField(control,"active"));
                control.endPiece(piece);denied(()->control.endPiece(piece));assertNull(frameControlField(control,"active"));
            }finally{foreign.cancel();}
        }
    }
    @Test public void FRAME_CONTROL_closeSignalsOnlyAndKeepsOwnedPieceUntilSettledEnd()throws Exception {
        var control=new NativePrivateCustodyFrameReadControl();var piece=control.beginPiece();
        var connection=new Connection(new URL(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read")){
            @Override public void disconnect(){assertFalse(Thread.holdsLock(control));super.disconnect();}
        };
        piece.attach(connection);control.close();assertEquals(1,connection.disconnects);denied(piece::check);denied(control::beginPiece);
        assertSame(piece,frameControlField(control,"active"));
        // Simulate only the existing HTTP owner's finally after its IO settled.
        piece.detach(connection);control.endPiece(piece);assertNull(frameControlField(control,"active"));denied(control::check);control.close();
    }
    @Test public void FRAME_CONTROL_expiryCancelsExactActiveAndNeverReopens()throws Exception {
        var control=new NativePrivateCustodyFrameReadControl();var piece=control.beginPiece();
        var connection=new Connection(new URL(NativePrivateCustodyHttp.ORIGIN));piece.attach(connection);
        expireFrameControlOnly(control);denied(control::check);assertEquals(1,connection.disconnects);denied(piece::check);
        assertSame(piece,frameControlField(control,"active"));piece.detach(connection);control.endPiece(piece);
        denied(control::beginPiece);control.close();
    }
    @Test public void FRAME_CONTROL_blockedDisconnectRetainsOwnershipWithoutControlMonitor()throws Exception {
        var control=new NativePrivateCustodyFrameReadControl();var piece=control.beginPiece();
        var connection=new LifetimeConnection(new URL(NativePrivateCustodyHttp.ORIGIN));connection.blockDisconnect=true;
        piece.attach(connection);var failure=new java.util.concurrent.atomic.AtomicReference<Throwable>();
        Thread cancellation=new Thread(()->{try{control.cancel();}catch(Throwable error){failure.set(error);}},"synthetic-frame-cancel");
        try{
            cancellation.start();assertTrue(connection.disconnectEntered.await(2,java.util.concurrent.TimeUnit.SECONDS));
            synchronized(control){assertSame(piece,frameControlField(control,"active"));}
            assertTrue(cancellation.isAlive());denied(control::beginPiece); // No join or replacement of unsettled active IO.
        }finally{connection.settle();cancellation.join(2000);}
        assertFalse(cancellation.isAlive());assertNull(failure.get());assertSame(piece,frameControlField(control,"active"));
        piece.detach(connection);control.endPiece(piece);assertNull(frameControlField(control,"active"));control.close();
    }
    @Test public void FRAME_CONTROL_cancelFailurePreservesPrimaryOwnershipAndEndRefusesRelease()throws Exception {
        var control=new NativePrivateCustodyFrameReadControl();var piece=control.beginPiece();
        var connection=new LifetimeConnection(new URL(NativePrivateCustodyHttp.ORIGIN));connection.failDisconnect=true;piece.attach(connection);
        try{control.cancel();fail("cleanup error hidden");}catch(IllegalStateException expected){}
        assertSame(piece,frameControlField(control,"active"));
        try{control.endPiece(piece);fail("failed cleanup released owner");}catch(IllegalStateException expected){}
        assertSame(piece,frameControlField(control,"active"));assertFalse((Boolean)frameControlField(control,"ending"));
        try{control.check();fail("canceled frame accepted");}catch(VaultFailure expected){assertEquals(1,expected.getSuppressed().length);assertTrue(expected.getSuppressed()[0] instanceof IllegalStateException);}
        // The actual HTTP owner would detach only after its own cleanup settles.
        connection.failDisconnect=false;connection.disconnect();piece.detach(connection);control.endPiece(piece);assertNull(frameControlField(control,"active"));control.close();
    }
    @Test public void FRAME_CONTROL_interruptionAndClosedNoPieceStayTerminal()throws Exception {
        var control=new NativePrivateCustodyFrameReadControl();try{
            Thread.currentThread().interrupt();denied(control::check);assertTrue(Thread.currentThread().isInterrupted());
        }finally{Thread.interrupted();}
        denied(control::beginPiece);control.close();
        var closed=new NativePrivateCustodyFrameReadControl();closed.close();denied(closed::beginPiece);denied(closed::check);closed.close();
    }
}
