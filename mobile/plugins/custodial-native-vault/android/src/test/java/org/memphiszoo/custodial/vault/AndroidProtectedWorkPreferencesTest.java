package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Actual Android adapter and offline store; synthetic durable preferences and
 * TestCipher only. Not AndroidKeyStore, disk fsync, process death or phone proof. */
public final class AndroidProtectedWorkPreferencesTest {
    public static void main(String[] args)throws Exception{
        if(args.length==2&&"--epoch-external-write-reopen-only".equals(args[0])){
            var root=java.nio.file.Path.of(args[1]);var dir=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var saved=metadataFiles(dir);
            assertTrue(java.nio.file.Files.exists(dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(root.toFile()));
            denied(()->NativePrivateMutationEpochStore.recoverExistingFromNativeNoBackupRootOrAbsent(root.toFile()));
            denied(()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(root.toFile()));
            metadataSame(saved,dir);
            System.out.println("PASS_NEW_EXTERNAL_UNKNOWN_FRESH_PROCESS existing-only recovery refused; no callback entry");return;
        }
        if(args.length==2&&"--epoch-external-write-only".equals(args[0])){
            if(!Set.of("EXT_WRITE_lockHeldAndExactlyOneSuccessCounter",
                "EXT_WRITE_throwErrorAndFalseRetainUnknownAcrossFreshProcess",
                "EXT_WRITE_uncertainPromotionCannotRecoverExternalEffect",
                "EXT_WRITE_malformedMarkerRefusesEffectAndRecovery",
                "EXT_WRITE_existingHeldDenialDataNeverInvokesEffect",
                "EXT_WRITE_reentrantScopeCannotDispatchSecondEffect").contains(args[1]))
                throw new IllegalArgumentException("new_external_epoch_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_EXTERNAL_WRITE_EPOCH "+args[1]+"; actual host files/locks, synthetic fixture only, not Android/all8/ACK/finalization/G04 proof");return;
        }
        if(args.length==2&&"--epoch-held-existing-file-only".equals(args[0])){
            if(!Set.of("HELD_FILE_v3ExistingReadDeniesOrdinaryAndPreservesFiles","HELD_FILE_v3MalformedPairChecksumRemainRetained","HELD_FILE_sameBytesSuccessorRevokesCurrentPermanently","HELD_FILE_v2RemainsExplicitlyUnboundAndReadOnly").contains(args[1]))
                throw new IllegalArgumentException("new_held_existing_file_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_HELD_EXISTING_FILE "+args[1]+"; constructed DENIAL DATA/real host file reader, not first-hold/token/manager/browser/Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-browser-held-codec-only".equals(args[0])){
            if(!Set.of("HELD_CODEC_v1AndLegacyV2RemainByteExact","HELD_CODEC_v3ExactBrowserPairRoundTrips","HELD_CODEC_missingOneBadExtraAndLegacyUpgradeRefuse","HELD_CODEC_checksumKeyHeaderAndBindingSyntaxRefuse").contains(args[1]))
                throw new IllegalArgumentException("new_browser_held_codec_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_BROWSER_HELD_CODEC "+args[1]+"; codec DATA only, not token/current inode/hold/Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-core-uid-owner-only".equals(args[0])){
            if(!Set.of("UID_OWNER_sameStatBindingAndFreshNativeAttributes",
                "UID_OWNER_foreignAndApplicationLoaderRetainFullComparison",
                "UID_OWNER_modeAndEqualByteInodeChangesRevoke",
                "UID_OWNER_postForceModeIsNotCached",
                "UID_OWNER_invalidNativeUidCannotBecomeOwner",
                "UID_OWNER_vmCoreAnchorCannotAdoptApplicationLoader").contains(args[1]))
                throw new IllegalArgumentException("new_core_uid_owner_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_CORE_UID_OWNER "+args[1]+"; real host files/owner, synthetic native fixture; not Android/G28/whole-latency/ACK proof");return;
        }
        if(args.length==2&&"--epoch-baseline-live-identity-only".equals(args[0])){
            if(!Set.of("BASELINE_LIVE_pinnedReadRejectsEqualByteSuccessor",
                "BASELINE_LIVE_contentPermissionsAndSymlinkRevoke",
                "BASELINE_LIVE_pendingAndUnknownArtifactsStayRetained").contains(args[1]))
                throw new IllegalArgumentException("new_epoch_baseline_live_identity_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_EPOCH_BASELINE_LIVE_IDENTITY "+args[1]+"; real metadata, synthetic native owner; not concurrent-race/whole-latency/Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-current-read-boundary-only".equals(args[0])){
            if(!Set.of("EPOCH_READ_BOUNDARY_baselineAndLockSuccessorsRevokeOnlyOriginal",
                "EPOCH_READ_BOUNDARY_exactCurrentAndUnsettledArtifactsRefuse",
                "EPOCH_READ_BOUNDARY_contendedLockClosesOnlyOwnReadHandle").contains(args[1]))
                throw new IllegalArgumentException("new_epoch_current_read_boundary_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_EPOCH_CURRENT_READ_BOUNDARY "+args[1]+"; real metadata/locks, synthetic native owner; no in-read race/hold/Android/ACK or latency proof");return;
        }
        if(args.length==2&&"--installed-held-read-refusal-only".equals(args[0])){
            if(!Set.of("HELD_READ_absentHasNoProvisioning",
                "HELD_READ_installedV1NeverBecomesHeld",
                "HELD_READ_pendingDoesNotRecoverOrReplaceOriginal").contains(args[1]))
                throw new IllegalArgumentException("new_installed_held_read_refusal_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_INSTALLED_HELD_READ_REFUSAL "+args[1]+"; no fabricated HELD/token; not positive held-recovery/Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-attributes-only".equals(args[0])){
            if(!Set.of("EPOCH_ATTRIBUTES_ownerAndPermissionsStillDeny",
                "EPOCH_ATTRIBUTES_symlinkAndSameBytesReplacementRevokeCurrent",
                "EPOCH_ATTRIBUTES_postForceReadbackIsFresh").contains(args[1]))
                throw new IllegalArgumentException("new_epoch_attribute_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_EPOCH_ATTRIBUTES "+args[1]+"; synthetic owner/preferences, real private metadata; not hold/Android/ACK or overall latency proof");return;
        }
        if(args.length==2&&"--durable-hold-refusal-only".equals(args[0])){
            if(!Set.of("DURABLE_HOLD_nullTokenCannotCreateIntent",
                "DURABLE_HOLD_malformedV2RetainsOriginalAndDeniesAdapters").contains(args[1]))
                throw new IllegalArgumentException("new_durable_hold_refusal_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_DURABLE_HOLD_REFUSAL "+args[1]+"; synthetic preferences/owner, real metadata; no positive hold-token or Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-writer-refusal-only".equals(args[0])){
            if(!Set.of("EPOCH_WRITER_replacedCurrentRefusalCannotRevive",
                "EPOCH_WRITER_interruptedPreparationRetainsExactCandidateAndRevokes",
                "EPOCH_WRITER_pendingClosedNullForeignDoNotDestroyTransition").contains(args[1]))
                throw new IllegalArgumentException("new_writer_refusal_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_OWNED_EPOCH_WRITER_REVOCATION "+args[1]+"; synthetic owner/preferences, real metadata files; not durable all-writer/Android/ACK proof");return;
        }
        if(args.length==2&&"--epoch-refused-current-only".equals(args[0])){
            if(!Set.of("EPOCH_CURRENT_refusedSameInodeRestorationRequiresNewHandle",
                "EPOCH_CURRENT_pendingRefusalWipesOnlyCurrentAndKeepsRecovery",
                "EPOCH_CURRENT_closedNullAndForeignTokensDoNotRevokeOtherStore").contains(args[1]))
                throw new IllegalArgumentException("new_refused_current_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_OWNED_EPOCH_CURRENT_REVOCATION "+args[1]+"; synthetic owner/preferences, real metadata files; not durable all-writer/Android/ACK proof");return;
        }
        if(args.length==2&&"--durable-cross-adapter-only".equals(args[0])){
            if(!Set.of("CROSS_realEpochAcrossSixAdapterWriters","CROSS_interruptedEpochDeniesSixDataWriters",
                "CROSS_reconstructedAdaptersRejectSameBytesObservation").contains(args[1]))throw new IllegalArgumentException("new cross-adapter member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProtectedWorkPreferencesTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS NEW "+args[1]+"; actual metadata files + bound adapter test seams; synthetic prefs/ciphers; NOT all-writer/Android/auth/ACK proof");return;
        }
        if(args.length==2&&"--epoch-ordinary-admission-only".equals(args[0])){
            if(!Set.of("ADMISSION_failedRecoveryDeniesOrdinaryEffects","ADMISSION_unsettledJournalDeniesOrdinaryEffects").contains(args[1]))
                throw new IllegalArgumentException("new owning admission case required");
            try{AndroidProtectedWorkPreferencesTest.class.getMethod(args[1]).invoke(new AndroidProtectedWorkPreferencesTest());}
            catch(java.lang.reflect.InvocationTargetException failure){throw new AssertionError(args[1],failure.getCause());}
            System.out.println("PASS NEW "+args[1]+"; actual metadata files/adapter admission, synthetic preferences; no all-writer/Android/ACK authority");return;
        }
        if(args.length==2&&"--epoch-metadata-resume-only".equals(args[0])){
            if(!Set.of("METADATA_restartPendingSameCandidate","METADATA_boundFailureInvalidatesOldObservation",
                "METADATA_forceRefusalRetainsPending","METADATA_aliasRefusalRetainsCandidate",
                "METADATA_absentStaysProcessOnly","METADATA_corruptPendingStaysUnavailable",
                "METADATA_foreignBootstrapAndUnknownStayUnavailable").contains(args[1]))throw new IllegalArgumentException("new metadata case required");
            try{AndroidProtectedWorkPreferencesTest.class.getMethod(args[1]).invoke(new AndroidProtectedWorkPreferencesTest());}
            catch(java.lang.reflect.InvocationTargetException failure){throw new AssertionError(args[1],failure.getCause());}
            System.out.println("PASS NEW "+args[1]+"; actual host files/Engine token, synthetic preferences; no Android runtime authority");return;
        }
        if(args.length==1&&"--audit-receipt-store-capacity-only".equals(args[0])){
            new AndroidProtectedWorkPreferencesTest().auditReceiptCapacityPreservesExactOriginalAcrossStoreRestart();
            System.out.println("NEW1 actual store capacity/preflight/restart case PASS; synthetic preferences/cipher, not Android fsync/TLS");return;
        }
        if(args.length==1&&"--owned-probe-cancellation-regression-only".equals(args[0])){
            new AndroidProtectedWorkPreferencesTest().memoryOnlyCancellationReestablishesSameOriginalProbe();return;
        }
        if(args.length==1&&"--owned-probe-cancellation-continuation-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();
            test.memoryOnlyCancellationReestablishesSameOriginalProbe();test.preMemoryCancellationFailureUsesSamePlannedSuccessor();
            test.failedProbeRecommitRetainsExactContinuation();test.repeatedCancellationFailureDoesNotMintAnotherGeneration();
            test.foreignContinuationStateCannotBeNormalized();test.restartedMismatchedV1ProbeHasNoPredecessorAuthority();
            test.unreadableOriginalProbeCannotBeReissued();test.staleCancellationCannotRetireRestoredOrFutureProbe();
            System.out.println("NEW8 owning probe cancellation continuation PASS; synthetic preferences/cipher, no signed freeze/ACK/Android/physical authority");return;
        }
        if(args.length==1&&"--owned-probe-cancellation-boundary-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.thrownCancellationAndRecommitRetainExactOriginal();
            test.contaminatedCancellationReadbackCannotBeAdopted();
            System.out.println("NEW2 thrown commit/contaminated readback probe boundaries PASS; synthetic preferences only");return;
        }
        if(args.length==1&&"--durable-aba-regression-only".equals(args[0])){
            new AndroidProtectedWorkPreferencesTest().ordinaryAbaChangesDurableObservation();return;
        }
        if(args.length==1&&"--durable-original-epoch-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();
            test.ordinaryAbaChangesDurableObservation();test.durableEpochInvalidatesRecreatedAdapterAndStagedEditor();
            test.externalWriterPersistsFenceBeforeCallback();test.failedEpochCannotRunExternalWriter();
            test.failedOrdinaryEpochKeepsUncertainty();test.malformedOrExhaustedEpochPreservesBytes();
            test.workEpochRecoversExactInterruptedOriginal();test.nfcEpochRecoversExactInterruptedOriginal();
            test.legacyAttemptsRemainRetainedWithoutEpochAuthority();test.originalEpochRejectsForeignRawMutation();
            test.cancelProbeChangesDurableEpochWithoutThaw();test.failedCancellationPreservesPendingOriginal();
            test.rawEpochCannotBeRemovedOrMaskedBySuccessfulReadback();
            test.newEpochSchemasAreClosedAndRawCensusVisible();
            System.out.println("NEW14 durable WORK/NFC/preferences original epoch cases PASS; synthetic preferences, not Android crash/fsync/all8/ACK/key proof");return;
        }
        if(args.length==1&&"--quarantine-schema-caller-composition-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.quarantineSchemaCannotWidenToDispositionOrDeletion();test.interruptedQuarantineRestoresOriginalNamespace();
            System.out.println("AFFECTED2 quarantine schema/null-row and recreated-owner composition PASS");return;
        }
        if(args.length==1&&"--scan-disposition-original-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.scanDispositionCommitsSameFourRowOperation();test.interruptedDispositionCannotLookResolvedOnRecreatedOwner();
            test.dispositionRefusesForeignSourceOrUnknownHistoricalPointer();test.dispositionPendingRefusesForeignCandidateOrSource();
            System.out.println("NEW4 original scan disposition atomic replacement/receipt/pointer recovery PASS; synthetic local rows, not real manager/ACK/key authority");return;
        }
        if(args.length==1&&"--quarantine-dedup-and-digest-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.quarantineWritersPreserveSourcesAndAdvanceGeneration();test.existingQuarantineMetadataRemainsOriginal();
            System.out.println("NEW1 historical quarantine metadata preservation + AFFECTED1 source digest/three producer branches PASS");return;
        }
        if(args.length==1&&"--preservation-map-composition-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.interruptedOrdinarySaveRecoversExactOriginalOnRecreatedOwner();
            test.existingSingleRowDeletesChangeDurableGeneration();test.interruptedOccurrencePairRestoresOriginalsOnRecreatedOwner();
            System.out.println("AFFECTED3 original scalar/pair schema and row-map recovery composition PASS");return;
        }
        if(args.length==1&&"--quarantine-original-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.quarantineWritersPreserveSourcesAndAdvanceGeneration();
            test.interruptedQuarantineRestoresOriginalNamespace();test.quarantineCannotAdoptChangedSourceOrForeignRows();test.quarantineSchemaCannotWidenToDispositionOrDeletion();
            System.out.println("NEW4 existing quarantine writers original-delta recovery PASS; synthetic only, no physical read/manager disposition/ACK authority");return;
        }
        if(args.length==1&&"--occurrence-pair-delete-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.occurrencePairDeletionChangesOneGeneration();
            test.interruptedOccurrencePairRestoresOriginalsOnRecreatedOwner();test.occurrencePairRejectsForeignProofOrUnrelatedDrift();
            test.occurrencePairCannotWidenKeysOrUseMalformedJournal();test.absentOccurrencePairIsNoopButOrphanProofIsJournaled();
            System.out.println("NEW5 atomic occurrence/finish-proof deletion recovery PASS; synthetic preferences/cipher, not remote ACK/Android/key authority");return;
        }
        if(args.length==1&&"--row-map-composition-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.ordinaryEncryptedSaveHasDurableGeneration();test.existingSingleRowDeletesChangeDurableGeneration();
            System.out.println("AFFECTED2 scalar save/delete row-map composition PASS; not old whole groups");return;
        }
        if(args.length==1&&"--single-row-delete-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.existingSingleRowDeletesChangeDurableGeneration();
            test.interruptedReceiptDeletionRestoresSameOriginalAndAttempt();test.originalDeleteCannotWidenTargetsOrCrossHold();
            System.out.println("NEW3 single-row deletion recovery PASS; synthetic local rows only, not finalizer/identity/key authority");return;
        }
        if(args.length==1&&"--legacy-record-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();test.legacySingleRowSaveChangesSameDurableGeneration();
            test.interruptedLegacySaveRecoversOriginalCiphertextAndAttempt();test.heldLegacySaveCannotEncryptOrReplaceOriginal();
            System.out.println("NEW3 legacy original-row recovery PASS; synthetic preferences/cipher only");return;
        }
        if(args.length==1&&"--ordinary-and-legacy-record-recovery-only".equals(args[0])){
            main(new String[]{"--ordinary-record-recovery-only"});main(new String[]{"--legacy-record-recovery-only"});return;
        }
        if(args.length==1&&"--ordinary-record-recovery-only".equals(args[0])){
            var test=new AndroidProtectedWorkPreferencesTest();
            test.ordinaryEncryptedSaveHasDurableGeneration();
            test.interruptedOrdinarySaveRecoversExactOriginalOnRecreatedOwner();
            test.ordinaryPendingRejectsThirdValueOrOtherRowDrift();
            test.ordinaryPendingMissingKeyCannotRegenerateOrRemove();
            test.ordinaryPendingAndMalformedGenerationBlockOrdinaryAuthority();
            test.failedOrdinaryStageCanRecoverWithoutReplacingOriginal();
            System.out.println("NEW6 ordinary original-row recovery PASS; synthetic preferences/cipher only, not all-writer/Android/ACK authority");return;
        }
        if(args.length!=1||!"--staged-currentness-only".equals(args[0]))throw new IllegalArgumentException("focused cases required");
        var test=new AndroidProtectedWorkPreferencesTest();
        test.stagedEditorCannotCrossPendingCheckCancellation();
        test.stagedEditorCannotCrossOrdinaryAbaOrBeReused();
        test.failedOrdinaryCommitInvalidatesOtherStagedEditors();
        System.out.println("NEW3 ordinary staged-editor currentness PASS; synthetic preferences only, not durable all-writer or Android lifecycle proof");
    }
    @Test public void auditReceiptCapacityPreservesExactOriginalAcrossStoreRestart()throws Exception{
        var p=new Preferences();var cipher=new CredentialCipher(){
            public EncryptedSecret encrypt(char[] clear)throws VaultFailure{return new EncryptedSecret(
                java.util.Base64.getEncoder().encodeToString(String.valueOf(clear).getBytes(java.nio.charset.StandardCharsets.UTF_8)),"dGVzdC1pdi12Mg==",32*1024*1024);}
            public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{return encrypt(clear);}
            public char[] decrypt(EncryptedSecret secret){return new String(java.util.Base64.getDecoder().decode(secret.ciphertext),java.nio.charset.StandardCharsets.UTF_8).toCharArray();}
            public void destroyKey(){throw new AssertionError("No key retirement");}
        };var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var journal=new NativeCompletionJournal(store);var args=NativeCompletionJournalTest.args();
        args.getJSONObject("p_response_json").put("notes","漢".repeat(50000));var request=NativeCompletionJournalTest.request(args);
        var before=new HashMap<>(p.disk);int commits=p.commits;journal.preflight(NativeCompletionJournalTest.DEVICE,request);
        assertEquals(before,p.disk);assertEquals(commits,p.commits);
        journal.captureAuthenticatedResponse(NativeCompletionJournalTest.DEVICE,request,NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));
        p.disk=new HashMap<>(p.durableDisk);var restarted=new NativeCompletionJournal(new AndroidOfflineAuthorityTimeStore(p.object(),cipher));
        assertNotNull(restarted.recover(NativeCompletionJournalTest.DEVICE,args));
        String key=p.disk.keySet().stream().filter(k->k.startsWith("authenticated_completion_receipt_sha256:")).findFirst().get();
        String retained=new AndroidOfflineAuthorityTimeStore(p.object(),cipher).loadCompletionReceipt(key.substring(key.indexOf(':')+1));
        try(var receipt=NativeCompletionJournal.inspectRetainedOriginalRequest(NativeCompletionJournalTest.DEVICE,key.substring(key.indexOf(':')+1),retained)){
            assertArrayEquals(request.body,receipt.originalBody());assertEquals("漢".repeat(50000),receipt.originalArgs().getJSONObject("p_response_json").getString("notes"));
        }
    }
    interface Hook { void run() throws Exception; }
    // Reuses the actual package owning Engine-token fixture. Every selector is
    // a separate JVM; no reflection resets or adopts static registry state.
    @Test public void EXT_WRITE_lockHeldAndExactlyOneSuccessCounter()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();int[]calls={0};
            try(var original=x.journal.readCurrent()){
                long counter=original.counter();
                var result=x.journal.commitOrdinaryExternalWrite(original,()->{
                    calls[0]++;
                    try{
                        assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
                        try(var second=java.nio.channels.FileChannel.open(x.dir.resolve(NativePrivateMutationEpochStore.LOCK),
                            java.nio.file.StandardOpenOption.WRITE)){
                            boolean contended=false;
                            try(var other=second.tryLock()){contended=other==null;}
                            catch(java.nio.channels.OverlappingFileLockException expected){contended=true;}
                            assertTrue("actual lock must cover external callback",contended);
                        }
                        denied(()->x.journal.readCurrent());denied(()->x.journal.recoverCurrentMetadata());
                        denied(()->x.journal.requireOrdinaryAdmission(original));
                        return "original external result";
                    }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw new VaultFailure("fixture_external_failure",failure);}
                });
                try(var current=result.current){
                    assertEquals(1,calls[0]);assertEquals("original external result",result.value);
                    assertEquals(counter+1,current.counter());x.journal.requireCurrent(current);
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
                    denied(original::counter);assertEquals(raw,x.raw());
                }
            }
        }
    }
    @Test public void EXT_WRITE_throwErrorAndFalseRetainUnknownAcrossFreshProcess()throws Exception{
        for(String mode:new String[]{"throw","error","false-as-owner-exception"}){
            try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
                x.bootstrap();var before=metadataFiles(x.dir);Object oldKey=metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT));
                int[]calls={0};var original=x.journal.readCurrent();
                try{
                    x.journal.commitOrdinaryExternalWrite(original,()->{
                        calls[0]++;
                        if(mode.equals("error"))throw new AssertionError("synthetic external Error");
                        throw new VaultFailure(mode.equals("throw")?"synthetic_external_throw":"synthetic_false_result_converted_by_owner");
                    });fail("unknown external callback returned");
                }catch(VaultFailure failure){assertFalse(mode.equals("error"));}
                catch(AssertionError failure){if(!mode.equals("error")||!"synthetic external Error".equals(failure.getMessage()))throw failure;}
                assertEquals(1,calls[0]);denied(original::counter);
                assertArrayEquals(before.get(NativePrivateMutationEpochStore.CURRENT),
                    java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                assertEquals(oldKey,metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
                assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
                assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
                var saved=metadataFiles(x.dir);
                denied(x.journal::readCurrent);denied(x.journal::recoverCurrentMetadata);
                denied(()->x.journal.commitOrdinaryExternalWrite(original,()->{calls[0]++;return null;}));
                externalUnknownFreshProcess(x.root);
                metadataSame(saved,x.dir);assertEquals(1,calls[0]);
            }
        }
    }
    @Test public void EXT_WRITE_uncertainPromotionCannotRecoverExternalEffect()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();int[]calls={0};var original=x.journal.readCurrent();
            Object normal=metadataIo(x.journal,(name,delegate,args)->{
                metadataNormal(delegate,name,args);
                if(name.equals("linkCandidate"))throw new java.io.IOException("synthetic failure after actual promotion link");
            });
            try{denied(()->x.journal.commitOrdinaryExternalWrite(original,()->{calls[0]++;return null;}));}
            finally{metadataRestoreIo(x.journal,normal);}
            assertEquals(1,calls[0]);denied(original::counter);
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            assertTrue(java.nio.file.Files.isSameFile(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),
                x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
            var saved=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
            for(String name:saved.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
            denied(x.journal::recoverCurrentMetadata);denied(x.journal::readPreparedForResume);
            externalUnknownFreshProcess(x.root);
            metadataSame(saved,x.dir);
            for(String name:saved.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
            assertEquals(1,calls[0]);
        }
    }
    @Test public void EXT_WRITE_malformedMarkerRefusesEffectAndRecovery()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var original=x.journal.readCurrent();
            java.nio.file.Files.write(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN),new byte[]{1,2,3},
                java.nio.file.StandardOpenOption.CREATE_NEW);
            java.nio.file.Files.setPosixFilePermissions(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN),
                java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            var saved=metadataFiles(x.dir);int[]calls={0};
            denied(()->x.journal.commitOrdinaryExternalWrite(original,()->{calls[0]++;return null;}));
            denied(original::counter);denied(x.journal::readCurrent);denied(x.journal::recoverCurrentMetadata);
            metadataSame(saved,x.dir);assertEquals(0,calls[0]);
        }
    }
    @Test public void EXT_WRITE_existingHeldDenialDataNeverInvokesEffect()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();String[]fields=heldFileDenialFields(x,3);
            java.nio.file.Files.write(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),heldFileWire(x,3,fields));
            var saved=metadataFiles(x.dir);var raw=x.raw();int[]calls={0};
            try(var original=x.journal.readCurrent()){
                assertNotNull(original.heldOriginal());
                denied(()->x.journal.commitOrdinaryExternalWrite(original,()->{calls[0]++;return null;}));
                denied(original::counter);
            }
            metadataSame(saved,x.dir);assertEquals(raw,x.raw());assertEquals(0,calls[0]);
        }
    }
    @Test public void EXT_WRITE_reentrantScopeCannotDispatchSecondEffect()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();int[]calls={0,0};var original=x.journal.readCurrent();
            denied(()->x.journal.commitOrdinaryExternalWrite(original,()->{
                calls[0]++;
                try{x.journal.commitOrdinaryExternalWrite(original,()->{calls[1]++;return null;});}
                catch(VaultFailure expected){return null;}
                throw new AssertionError("nested external scope accepted");
            }));
            assertEquals(1,calls[0]);assertEquals(0,calls[1]);denied(original::counter);
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            denied(x.journal::recoverCurrentMetadata);
        }
    }
    private static void externalUnknownFreshProcess(java.nio.file.Path root)throws Exception{
        var process=new ProcessBuilder(System.getProperty("java.home")+"/bin/java","-Xmx128m",
            "-cp",System.getProperty("java.class.path"),AndroidProtectedWorkPreferencesTest.class.getName(),
            "--epoch-external-write-reopen-only",root.toString()).inheritIO().start();
        boolean finished=false;
        try{
            finished=process.waitFor(20,TimeUnit.SECONDS);
            assertTrue("bounded fresh-process existing-only reader",finished);
            assertEquals(0,process.exitValue());
        }finally{if(!finished){process.destroyForcibly();process.waitFor(5,TimeUnit.SECONDS);}}
    }
    private static final String EPOCH_DIR=NativePrivateMutationEpochStore.DIRECTORY;
    private static Map<String,byte[]> metadataFiles(java.nio.file.Path dir)throws Exception {
        var result=new java.util.TreeMap<String,byte[]>();try(var paths=java.nio.file.Files.newDirectoryStream(dir)){
            for(var path:paths)result.put(path.getFileName().toString(),java.nio.file.Files.readAllBytes(path));
        }return result;
    }
    private static Object metadataKey(java.nio.file.Path path)throws Exception {
        return java.nio.file.Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
    }
    private static void metadataSame(Map<String,byte[]> before,java.nio.file.Path dir)throws Exception {
        var after=metadataFiles(dir);assertEquals(before.keySet(),after.keySet());
        for(var key:before.keySet())assertArrayEquals(key,before.get(key),after.get(key));
    }
    private interface MetadataFault {void invoke(String name,Object normal,Object[] args)throws Exception;}
    private static Object metadataIo(NativePrivateMutationEpochStore store,MetadataFault fault)throws Exception {
        var field=store.getClass().getDeclaredField("io");field.setAccessible(true);Object normal=field.get(store);
        field.set(store,Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},
            (proxy,method,args)->{fault.invoke(method.getName(),normal,args);return null;}));return normal;
    }
    private static void metadataNormal(Object normal,String operation,Object[] args)throws Exception {
        var method=normal.getClass().getDeclaredMethod(operation,args==null?new Class<?>[]{}:new Class<?>[]{java.nio.channels.FileChannel.class});method.setAccessible(true);
        try{method.invoke(normal,args);}catch(java.lang.reflect.InvocationTargetException failure){throw (Exception)failure.getCause();}
    }
    private static void metadataRestoreIo(NativePrivateMutationEpochStore store,Object normal)throws Exception {
        var field=store.getClass().getDeclaredField("io");field.setAccessible(true);field.set(store,normal);
    }
    private static void metadataRecover(java.nio.file.Path root)throws VaultFailure {
        AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournalFromNativeNoBackupRoot(root.toFile());
    }
    private static void metadataCandidatePreserved(java.nio.file.Path dir,byte[] bytes,Object inode)throws Exception {
        assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
        assertEquals(inode,metadataKey(dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
        assertFalse(java.nio.file.Files.exists(dir.resolve(NativePrivateMutationEpochStore.PENDING)));
        assertFalse(java.nio.file.Files.exists(dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
    }
    private static VaultSnapshot crossEmptySuccessor(VaultSnapshot current)throws VaultFailure{
        return current.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,EnrollmentMetadata.empty(),"","",false,"");
    }
    private static ProviderRecordStore crossProvider(Preferences provider,AndroidProtectedWorkPreferences gate,ProviderRecordStoreTest.Keys keys){
        return new AndroidProviderStore(provider.object(),gate,new ProviderEnvelopeCrypto(keys,()->provider.disk.isEmpty(),AndroidProviderCipher.STORE_LOCK)).records();
    }
    private static NativeRetainedAttempt crossOriginalWrite(NativePrivateCustodyOperationTest.DurableJoinFixture x)throws Exception{
        var f=x.source.x.f;var owner=f.batch.old;var capture=NativeRetainedWorkCapture.capture(owner.work);
        byte[] wire=capture.wire().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
        try{var manifest=f.batch.journal.observe();return NativeRetainedAttempt.prepareChunk(wire,capture.values,f.principal,
            owner.persistence.current().revision,credential,manifest.operationId,manifest.generationId,0,NativeSeparationContextTest.id(9601),owner.clock.now);
        }finally{java.util.Arrays.fill(wire,(byte)0);VaultValidation.wipe(credential);}
    }
    private static NativeRetainedReadQuery crossOriginalQuery(NativePrivateCustodyOperationTest.DurableJoinFixture x,NativeRetainedAttempt write)throws Exception{
        var f=x.source.x.f;var owner=f.batch.old;char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
        try{return NativeRetainedReadQuery.prepare(write,f.principal,owner.persistence.current().revision,credential,
            NativeSeparationContextTest.id(9602),owner.clock.now);}finally{VaultValidation.wipe(credential);}
    }
    private static void crossAdvanced(NativePrivateCustodyOperationTest.DurableJoinFixture x,AndroidProtectedWorkPreferences gate,
        AndroidProtectedWorkPreferences.ReadOnlyObservation before,long counter)throws Exception{
        assertTrue("actual persisted global journal must advance",x.counter()>counter);
        assertEquals("DURABLE_ATTEMPT:"+x.counter(),AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        assertFalse(gate.matchesReadOnly(before));
        assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
    }
    /** One real metadata-file baseline across six actual writer adapters.
     * Package bound-admission seams substitute only synthetic namespace prefs,
     * cipher and provider keys; not a Context/runtime/native/auth mounting test.
     * The original frozen WORK fixture remains unchanged throughout.
     */
    @Test public void CROSS_realEpochAcrossSixAdapterWriters()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();assertEquals(0,x.counter());
            var work=new Preferences();work.disk.put("retained-original","A");work.durableDisk=new HashMap<>(work.disk);
            var gate=adapter(work);var vault=new Preferences();var codec=new VaultSnapshotCodec();
            var vaultAdapter=new SharedPreferencesVaultPersistence(vault.object(),codec,gate);
            var before=gate.observeReadOnly();long counter=x.counter();var first=crossEmptySuccessor(VaultSnapshot.empty());
            vaultAdapter.commit(0,first);crossAdvanced(x,gate,before,counter);
            assertArrayEquals(codec.encode(first),codec.encode(vaultAdapter.load()));
            var provider=new Preferences();var keys=new ProviderRecordStoreTest.Keys();
            before=gate.observeReadOnly();counter=x.counter();var record=ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.EVENT,"cross-original");
            crossProvider(provider,gate,keys).commit(0,ProviderRecordStoreTest.values(record,"original provider value"),Set.of());
            crossAdvanced(x,gate,before,counter);assertEquals(1,provider.commits);
            var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(work.object(),cipher);
            String originalPrincipal=x.source.x.f.batch.old.work.loadPrincipal();assertNotNull(originalPrincipal);
            before=gate.observeReadOnly();counter=x.counter();store.savePrincipal(originalPrincipal);
            crossAdvanced(x,gate,before,counter);
            assertTrue(ProviderWireJson.same(new JSONObject(originalPrincipal),new JSONObject(store.loadPrincipal())));
            var batch=x.source.x.f.batch;
            try(var write=crossOriginalWrite(x);var query=crossOriginalQuery(x,write)){
                before=gate.observeReadOnly();counter=x.counter();batch.old.journal.prepare(write);crossAdvanced(x,gate,before,counter);
                var exactWrite=new HashMap<>(batch.old.journalDisk.memory);
                before=gate.observeReadOnly();counter=x.counter();
                new AndroidRetainedAttemptStore(batch.old.journalDisk.preferences(),batch.old.journalCipher).journal().prepare(write);
                crossAdvanced(x,gate,before,counter);assertEquals(exactWrite,batch.old.journalDisk.memory); // exact-byte attempted recommit
                before=gate.observeReadOnly();counter=x.counter();batch.queryZero.prepare(query);crossAdvanced(x,gate,before,counter);
                var exactQuery=new HashMap<>(batch.queryZeroDisk.memory);
                before=gate.observeReadOnly();counter=x.counter();
                new AndroidRetainedQueryStore(batch.queryZeroDisk.preferences(),batch.queryZeroCipher).journal().prepare(query);
                crossAdvanced(x,gate,before,counter);assertEquals(exactQuery,batch.queryZeroDisk.memory);
            }
            var exactBatch=new HashMap<>(batch.root.memory);
            before=gate.observeReadOnly();counter=x.counter();x.reaffirm();crossAdvanced(x,gate,before,counter);
            assertEquals(exactBatch,batch.root.memory);
            var fresh=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
            try(var diskCurrent=fresh.readCurrent()){assertEquals(x.counter(),diskCurrent.counter());}
            assertEquals("A",work.disk.get("retained-original"));assertEquals(0,work.clears);assertEquals(0,provider.clears);
            assertEquals(0,batch.old.opened);assertEquals(0,cipher.destroyCalls);
        }
    }
    @Test public void CROSS_interruptedEpochDeniesSixDataWriters()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();work.disk.put("retained-original","A");work.durableDisk=new HashMap<>(work.disk);
            var gate=adapter(work);var observation=gate.observeReadOnly();var vault=new Preferences();var provider=new Preferences();
            var keys=new ProviderRecordStoreTest.Keys();var cipher=new TestCipher();var batch=x.source.x.f.batch;
            var next=crossEmptySuccessor(VaultSnapshot.empty());
            String originalPrincipal=x.source.x.f.batch.old.work.loadPrincipal();assertNotNull(originalPrincipal);
            try(var write=crossOriginalWrite(x);var query=crossOriginalQuery(x,write)){
                Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                    if(operation.equals("forceFile"))throw new java.io.IOException("NEW cross-adapter original metadata force refusal");
                    metadataNormal(delegate,operation,args);
                });
                try{
                    denied(()->new SharedPreferencesVaultPersistence(vault.object(),new VaultSnapshotCodec(),gate).commit(0,next));
                    assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
                    var metadata=metadataFiles(x.dir);var originals=x.raw();int writeCommits=batch.old.journalDisk.commits;
                    int queryCommits=batch.queryZeroDisk.commits,batchCommits=batch.root.commits;
                    denied(()->crossProvider(provider,gate,keys).commit(0,
                        ProviderRecordStoreTest.values(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.EVENT,"held"),"must not persist"),Set.of()));
                    denied(()->new AndroidOfflineAuthorityTimeStore(work.object(),cipher).savePrincipal(originalPrincipal));
                    denied(()->batch.old.journal.prepare(write));denied(()->batch.queryZero.prepare(query));denied(x::reaffirm);
                    assertEquals(0,vault.commits);assertEquals(0,provider.commits);assertEquals(0,work.commits);assertEquals(0,keys.creations);
                    assertEquals(0,cipher.existingKeyEncryptCalls);assertEquals(writeCommits,batch.old.journalDisk.commits);
                    assertEquals(queryCommits,batch.queryZeroDisk.commits);assertEquals(batchCommits,batch.root.commits);
                    assertEquals(originals,x.raw());metadataSame(metadata,x.dir);assertEquals("A",work.disk.get("retained-original"));
                    assertTrue(gate.frozen());assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);
                    assertFalse(gate.matchesReadOnly(observation)); // process attempt already invalidated this observation
                    assertEquals(0,batch.old.opened);
                }finally{metadataRestoreIo(x.journal,normal);}
            }
        }
    }
    @Test public void CROSS_reconstructedAdaptersRejectSameBytesObservation()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();work.disk.put("retained-original","A");work.disk.put("unknown",17);work.durableDisk=new HashMap<>(work.disk);
            var first=adapter(work);var original=first.observeReadOnly();long originalCounter=x.counter();
            assertTrue(first.edit().putString("retained-original","B").commit());
            assertTrue(adapter(work).edit().putString("retained-original","A").commit());
            assertEquals("A",work.durableDisk.get("retained-original"));assertEquals(17,work.durableDisk.get("unknown"));
            assertTrue(x.counter()>=originalCounter+2);assertFalse(adapter(work).matchesReadOnly(original));
            var rebuilt=adapter(restarted(work));assertFalse(rebuilt.matchesReadOnly(original));
            assertTrue(rebuilt.matchesReadOnly(rebuilt.observeReadOnly()));
            var disk=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
            try(var current=disk.readCurrent()){assertEquals(x.counter(),current.counter());}
            assertEquals(0,work.clears);assertEquals(0,work.applies);
        }
    }

    @Test public void ADMISSION_failedRecoveryDeniesOrdinaryEffects()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var ordinary=new Preferences();ordinary.disk.put("retained-original","unchanged");
            var owner=new AndroidProtectedWorkPreferences(ordinary.object());int[] effects={0};
            assertFalse(owner.frozen());owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;});assertEquals(1,effects[0]);
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){}
            var files=metadataFiles(x.dir);var originals=x.raw();
            Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                if(operation.equals("forceFile"))throw new java.io.IOException("owning metadata recovery force refusal");
                metadataNormal(delegate,operation,args);
            });
            denied(()->metadataRecover(x.root));metadataSame(files,x.dir);assertEquals(originals,x.raw());
            try{
                denied(()->owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;}));
                assertEquals(1,effects[0]);assertTrue(owner.frozen());assertEquals(0,ordinary.commits);
            }finally{metadataRestoreIo(x.journal,normal);}
            metadataRecover(x.root);assertFalse(owner.frozen());
            owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;});assertEquals(2,effects[0]);
            assertEquals(Map.of("retained-original","unchanged"),ordinary.disk);assertEquals(originals,x.raw());
        }
    }
    @Test public void ADMISSION_unsettledJournalDeniesOrdinaryEffects()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var ordinary=new Preferences();var owner=new AndroidProtectedWorkPreferences(ordinary.object());int[] effects={0};
            assertFalse(owner.frozen());owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;});
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){}
            var files=metadataFiles(x.dir);var originals=x.raw();
            denied(()->owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;}));
            assertEquals(1,effects[0]);assertTrue(owner.frozen());assertEquals(0,ordinary.commits);
            metadataSame(files,x.dir);assertEquals(originals,x.raw());
            metadataRecover(x.root);assertFalse(owner.frozen());owner.withOrdinaryWorkAdmission(()->{effects[0]++;return null;});
            assertEquals(2,effects[0]);assertEquals(originals,x.raw());
        }
    }
    @Test public void METADATA_restartPendingSameCandidate()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();byte[] candidate,baseline;Object inode;
            baseline=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.BASELINE));
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){
                candidate=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
                inode=metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
            }
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));
            metadataRecover(x.root);assertEquals("DURABLE_ATTEMPT:1",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            metadataCandidatePreserved(x.dir,candidate,inode);assertEquals(raw,x.raw());
            // Next metadata attempt uses the existing typed successor, not an
            // intent reconstructed from a caller's counter or defaults.
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){
                assertEquals(1,pending.predecessorCounter());assertEquals(2,pending.nextCounter());
                candidate=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
                inode=metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
            }
            metadataRecover(x.root);assertEquals("DURABLE_ATTEMPT:2",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            metadataCandidatePreserved(x.dir,candidate,inode);assertEquals(raw,x.raw());
            assertArrayEquals(baseline,java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.BASELINE)));
        }
    }
    @Test public void METADATA_boundFailureInvalidatesOldObservation()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new AndroidProtectedWorkPreferences(x.source.x.f.batch.old.workDisk.preferences());
            var observation=work.observeReadOnly();var raw=x.raw();int editors=x.batchEditors;
            Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                if(operation.equals("forceFile"))throw new java.io.IOException("synthetic epoch force refusal");metadataNormal(delegate,operation,args);
            });
            denied(x::reaffirm);assertEquals(editors,x.batchEditors);assertEquals(raw,x.raw());
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
            byte[] candidate=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
            Object inode=metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));metadataRestoreIo(x.journal,normal);
            long before=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            metadataRecover(x.root);assertTrue(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>before);
            assertFalse(work.matchesReadOnly(observation));assertTrue(work.matchesReadOnly(work.observeReadOnly()));
            assertEquals("DURABLE_ATTEMPT:1",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            metadataCandidatePreserved(x.dir,candidate,inode);assertEquals(raw,x.raw());assertEquals(editors,x.batchEditors);
        }
    }
    @Test public void METADATA_forceRefusalRetainsPending()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new AndroidProtectedWorkPreferences(x.source.x.f.batch.old.workDisk.preferences());var observation=work.observeReadOnly();
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){}
            var original=metadataFiles(x.dir);var raw=x.raw();long process=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                if(operation.equals("forceFile"))throw new java.io.IOException("synthetic recovery force refusal");metadataNormal(delegate,operation,args);
            });
            denied(()->metadataRecover(x.root));metadataSame(original,x.dir);assertEquals(raw,x.raw());
            assertTrue(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>process);assertFalse(work.matchesReadOnly(observation));
            assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);
            assertThrows(IllegalStateException.class,work::observeReadOnly);
            metadataRestoreIo(x.journal,normal);metadataRecover(x.root);
            assertEquals("DURABLE_ATTEMPT:1",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());assertEquals(raw,x.raw());
        }
    }
    @Test public void METADATA_aliasRefusalRetainsCandidate()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){}
            byte[] candidate=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));
            Object inode=metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.PENDING));var raw=x.raw();
            Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                metadataNormal(delegate,operation,args);if(operation.equals("linkCandidate"))throw new java.io.IOException("synthetic after-alias refusal");
            });
            denied(()->metadataRecover(x.root));assertTrue(java.nio.file.Files.isSameFile(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));
            assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);
            metadataRestoreIo(x.journal,normal);metadataRecover(x.root);metadataCandidatePreserved(x.dir,candidate,inode);
            assertEquals("DURABLE_ATTEMPT:1",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());assertEquals(raw,x.raw());
        }
    }
    @Test public void METADATA_absentStaysProcessOnly()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            java.nio.file.Files.setPosixFilePermissions(x.root,java.nio.file.attribute.PosixFilePermissions.fromString("rwxr-xr-x"));
            var original=x.root.resolve("retained-unknown");byte[] bytes={3,1,4};java.nio.file.Files.write(original,bytes);Object rootKey=metadataKey(x.root);
            metadataRecover(x.root);assertFalse(java.nio.file.Files.exists(x.dir));assertEquals(rootKey,metadataKey(x.root));assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(original));
            assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        }
    }
    @Test public void METADATA_corruptPendingStaysUnavailable()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var path=x.dir.resolve(NativePrivateMutationEpochStore.PENDING);java.nio.file.Files.write(path,new byte[]{1,2,3});
            java.nio.file.Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            var original=metadataFiles(x.dir);var raw=x.raw();
            denied(()->NativePrivateMutationEpochStore.recoverExistingFromNativeNoBackupRootOrAbsent(x.root.toFile()));metadataSame(original,x.dir);
            denied(()->metadataRecover(x.root));metadataSame(original,x.dir);assertEquals(raw,x.raw());
            assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);
        }
    }
    @Test public void METADATA_foreignBootstrapAndUnknownStayUnavailable()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();String parent=System.getProperty("custodial.custody.fixture.root");
            var foreign=java.nio.file.Files.createTempDirectory(java.nio.file.Path.of(parent),"foreign-epoch-",java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
            var child=foreign.resolve(EPOCH_DIR);java.nio.file.Files.createDirectory(child,java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
            for(var entry:metadataFiles(x.dir).entrySet()){
                var path=child.resolve(entry.getKey());java.nio.file.Files.write(path,entry.getValue());java.nio.file.Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            }
            var foreignBefore=metadataFiles(child);denied(()->NativePrivateMutationEpochStore.recoverExistingFromNativeNoBackupRootOrAbsent(foreign.toFile()));metadataSame(foreignBefore,child);
            for(String file:new String[]{NativePrivateMutationEpochStore.BOOTSTRAP,"arbitrary-original"}){
                var path=x.dir.resolve(file);java.nio.file.Files.write(path,new byte[]{9});java.nio.file.Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            }
            var original=metadataFiles(x.dir);denied(()->metadataRecover(x.root));metadataSame(original,x.dir);
            assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);
            var absentForeign=java.nio.file.Files.createTempDirectory(java.nio.file.Path.of(parent),"foreign-absent-",java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
            denied(()->metadataRecover(absentForeign));assertFalse(java.nio.file.Files.exists(absentForeign.resolve(EPOCH_DIR)));
            assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::retainedMutationStampForReadOnlyCapture);metadataSame(original,x.dir);
        }
    }
    // NEW owning Current lifetime only. Every handle comes from the existing
    // Engine-token bootstrap/read/recovery fixture, never a constructor or a
    // fabricated metadata record. Reflection observes owned wipe buffers only.
    private static byte[] refusedEpochBuffer(NativePrivateMutationEpochStore.Current current)throws Exception {
        var field=current.getClass().getDeclaredField("bytes");field.setAccessible(true);return (byte[])field.get(current);
    }
    @Test public void EPOCH_CURRENT_refusedSameInodeRestorationRequiresNewHandle()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var before=metadataFiles(x.dir);Object inode=metadataKey(file);
            var held=x.root.resolve("preserved-genuine-epoch-current");var replacement=x.root.resolve("same-bytes-epoch-successor");
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);long counter=current.counter();byte[] owned=refusedEpochBuffer(current);
                assertNotNull(owned);var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                java.nio.file.Files.createLink(held,file);java.nio.file.Files.copy(file,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(inode,metadataKey(file));assertEquals(inode,metadataKey(held));metadataSame(before,x.dir);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(inode,metadataKey(file));metadataSame(before,x.dir);
                assertThrows("same refused epoch Current revived after genuine inode restoration",VaultFailure.class,
                    ()->x.journal.requireCurrent(current));
                assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));
                assertArrayEquals(new byte[owned.length],owned);
                // Only a NEW trusted read may observe the restored original.
                try(var reread=x.journal.readCurrent()){assertNotSame(current,reread);x.journal.requireCurrent(reread);assertEquals(counter,reread.counter());}
                metadataSame(before,x.dir);assertEquals(inode,metadataKey(file));
            }finally{
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                for(byte[] bytes:before.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void EPOCH_CURRENT_pendingRefusalWipesOnlyCurrentAndKeepsRecovery()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){
                byte[] owned=refusedEpochBuffer(current);long expected=pending.nextCounter();
                var original=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                try{
                    assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                    assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));
                    assertArrayEquals(new byte[owned.length],owned);
                    assertEquals(expected,pending.nextCounter()); // unrelated Prepared was not revoked
                    metadataSame(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                    try(var recovered=x.journal.recoverCurrentMetadata()){
                        assertNotSame(current,recovered);x.journal.requireCurrent(recovered);assertEquals(expected,recovered.counter());
                    }
                    assertEquals(expected,pending.nextCounter());
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
                }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    @Test public void EPOCH_CURRENT_closedNullAndForeignTokensDoNotRevokeOtherStore()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var foreign=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile());
            var original=metadataFiles(x.dir);
            try(var own=x.journal.readCurrent();var other=foreign.readCurrent()){
                byte[] borrowed=refusedEpochBuffer(other),unchanged=borrowed.clone();
                try{
                    long counter=other.counter();
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(other));
                    assertArrayEquals(unchanged,borrowed);assertSame(borrowed,refusedEpochBuffer(other));
                    foreign.requireCurrent(other);assertEquals(counter,other.counter());
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(null));x.journal.requireCurrent(own);
                    byte[] owned=refusedEpochBuffer(own);own.close();
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(own));
                    assertNull(refusedEpochBuffer(own));assertArrayEquals(new byte[owned.length],owned);
                    // A rejected foreign/null/closed token cannot destroy the
                    // original disk or another store instance's live handle.
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(other));
                    foreign.requireCurrent(other);assertArrayEquals(unchanged,borrowed);
                    metadataSame(original,x.dir);
                    try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(counter,fresh.counter());}
                    metadataSame(original,x.dir);
                }finally{java.util.Arrays.fill(unchanged,(byte)0);}
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    // NEW writer entry: do not call public requireCurrent before the failed
    // prepareNext, since that separate sticky guard would hide this defect.
    @Test public void EPOCH_WRITER_replacedCurrentRefusalCannotRevive()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var original=metadataFiles(x.dir);Object inode=metadataKey(file);
            var held=x.root.resolve("writer-genuine-current");var replacement=x.root.resolve("writer-same-bytes-replacement");
            try(var current=x.journal.readCurrent()){
                long counter=current.counter();byte[] owned=refusedEpochBuffer(current);
                var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                java.nio.file.Files.createLink(held,file);java.nio.file.Files.copy(file,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(inode,metadataKey(file));metadataSame(original,x.dir);
                assertThrows(VaultFailure.class,()->x.journal.prepareNext(current));metadataSame(original,x.dir);
                java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(inode,metadataKey(file));metadataSame(original,x.dir);
                assertThrows("failed writer preparation left Current live after genuine inode restoration",VaultFailure.class,current::counter);
                assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                assertThrows(VaultFailure.class,()->x.journal.prepareNext(current));metadataSame(original,x.dir);
                try(var fresh=x.journal.readCurrent()){assertNotSame(current,fresh);x.journal.requireCurrent(fresh);assertEquals(counter,fresh.counter());}
                metadataSame(original,x.dir);assertEquals(inode,metadataKey(file));
            }finally{
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void EPOCH_WRITER_interruptedPreparationRetainsExactCandidateAndRevokes()throws Exception {
        for(boolean fatal:new boolean[]{false,true})try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var before=metadataFiles(x.dir);var raw=x.raw();
            try(var current=x.journal.readCurrent()){
                long counter=current.counter();byte[] owned=refusedEpochBuffer(current);
                var interrupted=new AssertionError("synthetic existing metadata directory force failure");
                Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                    if(operation.equals("forceDirectory")){
                        if(fatal)throw interrupted;
                        throw new java.io.IOException("synthetic existing metadata directory force failure");
                    }
                    metadataNormal(delegate,operation,args);
                });
                try{
                    if(fatal)assertSame(interrupted,assertThrows(AssertionError.class,()->x.journal.prepareNext(current)));
                    else assertThrows(VaultFailure.class,()->x.journal.prepareNext(current));
                }finally{metadataRestoreIo(x.journal,normal);}
                var saved=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                for(String name:saved.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                try{
                    assertTrue(saved.containsKey(NativePrivateMutationEpochStore.PENDING));
                    for(String name:before.keySet())assertArrayEquals(before.get(name),saved.get(name));
                    byte[] candidate=saved.get(NativePrivateMutationEpochStore.PENDING);Object candidateKey=keys.get(NativePrivateMutationEpochStore.PENDING);
                    assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                    assertThrows(VaultFailure.class,()->x.journal.prepareNext(current));metadataSame(saved,x.dir);
                    for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                    assertEquals(raw,x.raw());
                    try(var recovered=x.journal.recoverCurrentMetadata()){
                        assertNotSame(current,recovered);x.journal.requireCurrent(recovered);assertEquals(counter+1,recovered.counter());
                        metadataCandidatePreserved(x.dir,candidate,candidateKey);
                    }
                    assertThrows(VaultFailure.class,current::counter);assertEquals(raw,x.raw());
                }finally{for(byte[] bytes:saved.values())java.util.Arrays.fill(bytes,(byte)0);}
            }finally{for(byte[] bytes:before.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void EPOCH_WRITER_pendingClosedNullForeignDoNotDestroyTransition()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var otherStore=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile());
            var original=metadataFiles(x.dir);
            try(var current=x.journal.readCurrent();var foreign=otherStore.readCurrent();var closed=x.journal.readCurrent()){
                byte[] other=refusedEpochBuffer(foreign),copy=other.clone();long counter=current.counter();
                try{
                    assertThrows(VaultFailure.class,()->x.journal.prepareNext(foreign));
                    assertSame(other,refusedEpochBuffer(foreign));assertArrayEquals(copy,other);otherStore.requireCurrent(foreign);
                    assertThrows(VaultFailure.class,()->x.journal.prepareNext(null));closed.close();
                    assertThrows(VaultFailure.class,()->x.journal.prepareNext(closed));metadataSame(original,x.dir);
                    try(var prepared=x.journal.prepareNext(current)){
                        var saved=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                        for(String name:saved.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                        byte[] owned=refusedEpochBuffer(current);
                        try{
                            assertEquals(counter+1,prepared.nextCounter());
                            assertThrows(VaultFailure.class,()->x.journal.prepareNext(current));
                            assertThrows(VaultFailure.class,current::counter);assertArrayEquals(new byte[owned.length],owned);
                            assertNull(refusedEpochBuffer(current));assertEquals(counter+1,prepared.nextCounter());
                            metadataSame(saved,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                            try(var recovered=x.journal.recoverCurrentMetadata()){
                                x.journal.requireCurrent(recovered);assertEquals(counter+1,recovered.counter());
                                metadataCandidatePreserved(x.dir,saved.get(NativePrivateMutationEpochStore.PENDING),keys.get(NativePrivateMutationEpochStore.PENDING));
                            }
                            assertEquals(counter+1,prepared.nextCounter());assertThrows(VaultFailure.class,current::counter);
                        }finally{for(byte[] bytes:saved.values())java.util.Arrays.fill(bytes,(byte)0);}
                    }
                }finally{java.util.Arrays.fill(copy,(byte)0);}
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    // Negative-only prerequisites. A real closed hold token is minted by the
    // separate existing manager/native/browser owning workflow, never here.
    @Test public void DURABLE_HOLD_nullTokenCannotCreateIntent()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=metadataFiles(x.dir);var raw=x.raw();
            var keys=new java.util.TreeMap<String,Object>();for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
            try(var current=x.journal.readCurrent()){
                assertNull(current.heldOriginal());x.journal.requireOrdinaryAdmission(current);
                assertThrows(VaultFailure.class,()->AndroidProtectedWorkPreferences.holdOriginalWriters(null));
                assertThrows(VaultFailure.class,()->x.journal.holdOriginalWriters(current,null));
                assertEquals(0,current.counter());assertNull(current.heldOriginal());x.journal.requireCurrent(current);
                assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
                metadataSame(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                assertEquals(raw,x.raw());
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void DURABLE_HOLD_malformedV2RetainsOriginalAndDeniesAdapters()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var current=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var held=x.root.resolve("retained-genuine-v1-current");java.nio.file.Files.createLink(held,current);
            byte[] malformed=java.nio.file.Files.readAllBytes(current);java.nio.ByteBuffer.wrap(malformed).putInt(4,2);
            // Unsupported/truncated v2 is NOT authenticated HELD. It is kept
            // unavailable, never interpreted as empty or a v1 writable zero.
            java.nio.file.Files.delete(current);java.nio.file.Files.write(current,malformed);
            java.nio.file.Files.setPosixFilePermissions(current,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            var saved=metadataFiles(x.dir);var raw=x.raw();var ordinary=new Preferences();ordinary.disk.put("original","unchanged");
            var gate=adapter(ordinary);int[] effects={0};
            try{
                assertThrows(VaultFailure.class,()->NativePrivateMutationEpochStore.recoverExistingFromNativeNoBackupRootOrAbsent(x.root.toFile()));
                assertTrue(gate.frozen());assertTrue(adapter(restarted(ordinary)).frozen());
                assertThrows(VaultFailure.class,()->gate.withOrdinaryWorkAdmission(()->{effects[0]++;return null;}));
                assertThrows(VaultFailure.class,()->gate.withOrdinaryWriteAdmission(()->{effects[0]++;return null;}));
                assertEquals(0,effects[0]);assertEquals(0,ordinary.commits);assertEquals(Map.of("original","unchanged"),ordinary.disk);
                assertThrows(VaultFailure.class,()->metadataRecover(x.root));metadataSame(saved,x.dir);assertEquals(raw,x.raw());
                assertTrue(java.nio.file.Files.exists(held));assertArrayEquals(malformed,java.nio.file.Files.readAllBytes(current));
            }finally{java.util.Arrays.fill(malformed,(byte)0);for(byte[] bytes:saved.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    // Existing private validation seam only. Both expected principals below
    // are actual host filesystem principals; no chown, fabricated principal,
    // private capability constructor, or production I/O substitute is used.
    private static java.nio.file.attribute.PosixFileAttributes epochPrivateAttributes(java.nio.file.Path path,
        java.nio.file.attribute.UserPrincipal owner)throws Exception {
        var method=NativePrivateMutationEpochStore.class.getDeclaredMethod("privateFile",java.nio.file.Path.class,java.nio.file.attribute.UserPrincipal.class);
        method.setAccessible(true);try{return(java.nio.file.attribute.PosixFileAttributes)method.invoke(null,path,owner);}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw(Exception)failure.getCause();throw(Error)failure.getCause();
        }
    }
    @Test public void EPOCH_ATTRIBUTES_ownerAndPermissionsStillDeny()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var original=metadataFiles(x.dir);var raw=x.raw();
            var keys=new java.util.TreeMap<String,Object>();for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var foreignOwner=java.nio.file.Files.getOwner(java.nio.file.Path.of("/"),java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertNotEquals("existing foreign host principal required; no synthetic owner substitute",attributes.owner(),foreignOwner);
            var checked=epochPrivateAttributes(file,attributes.owner());
            assertEquals(attributes.fileKey(),checked.fileKey());assertEquals(attributes.size(),checked.size());
            assertEquals(attributes.permissions(),checked.permissions());assertEquals(attributes.owner(),checked.owner());
            assertThrows(VaultFailure.class,()->epochPrivateAttributes(file,foreignOwner));
            try{
                for(String name:new String[]{NativePrivateMutationEpochStore.CURRENT,NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.LOCK}){
                    var changed=x.dir.resolve(name);var permissions=java.nio.file.Files.getPosixFilePermissions(changed,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    try(var current=x.journal.readCurrent()){
                        byte[] owned=refusedEpochBuffer(current);
                        try{
                            java.nio.file.Files.setPosixFilePermissions(changed,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r-----"));
                            assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                        }finally{java.nio.file.Files.setPosixFilePermissions(changed,permissions);}
                        assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));
                        assertArrayEquals(new byte[owned.length],owned);
                        assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                        try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                        metadataSame(original,x.dir);for(String key:keys.keySet())assertEquals(keys.get(key),metadataKey(x.dir.resolve(key)));
                    }
                }
                assertEquals(raw,x.raw());
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void EPOCH_ATTRIBUTES_symlinkAndSameBytesReplacementRevokeCurrent()throws Exception {
        for(String fault:new String[]{"symlink","same-bytes"})try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);var original=metadataFiles(x.dir);var raw=x.raw();
            var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var held=x.root.resolve("attribute-genuine-current");var replacement=x.root.resolve("attribute-replacement-current");
            try(var current=x.journal.readCurrent()){
                byte[] owned=refusedEpochBuffer(current);java.nio.file.Files.createLink(held,file);
                if(fault.equals("symlink"))java.nio.file.Files.createSymbolicLink(replacement,held);
                else{
                    java.nio.file.Files.copy(file,replacement);java.nio.file.Files.setPosixFilePermissions(replacement,attributes.permissions());
                    java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                }
                java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(attributes.fileKey(),metadataKey(file));
                if(fault.equals("symlink"))assertTrue(java.nio.file.Files.isSymbolicLink(file));
                else assertArrayEquals(original.get(NativePrivateMutationEpochStore.CURRENT),java.nio.file.Files.readAllBytes(file));
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(attributes.fileKey(),metadataKey(file));metadataSame(original,x.dir);
                assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                assertEquals(raw,x.raw());
            }finally{
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void EPOCH_ATTRIBUTES_postForceReadbackIsFresh()throws Exception {
        for(String fault:new String[]{"permissions","same-bytes"})try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var file=x.dir.resolve(NativePrivateMutationEpochStore.PENDING);
            try(var current=x.journal.readCurrent();var prepared=x.journal.prepareNext(current)){
                var original=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                var held=x.root.resolve("attribute-genuine-pending");var replacement=x.root.resolve("attribute-replacement-pending");
                java.nio.file.Files.createLink(held,file);int[] calls={0};
                Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                    metadataNormal(delegate,operation,args);
                    if(operation.equals("forceFile")&&calls[0]++==0){
                        if(fault.equals("permissions"))java.nio.file.Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r-----"));
                        else{
                            java.nio.file.Files.copy(file,replacement);java.nio.file.Files.setPosixFilePermissions(replacement,attributes.permissions());
                            java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                            java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                });
                try{
                    assertThrows(VaultFailure.class,()->x.journal.commitPrepared(prepared));assertEquals(1,calls[0]);
                    assertEquals(1,prepared.nextCounter()); // not blanket-closed on unrelated validation refusal
                    assertArrayEquals(original.get(NativePrivateMutationEpochStore.CURRENT),java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                    assertEquals(keys.get(NativePrivateMutationEpochStore.CURRENT),metadataKey(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                    assertArrayEquals(original.get(NativePrivateMutationEpochStore.PENDING),java.nio.file.Files.readAllBytes(held));
                    assertEquals(attributes.fileKey(),metadataKey(held));assertEquals(raw,x.raw());
                }finally{
                    metadataRestoreIo(x.journal,normal);
                    java.nio.file.Files.setPosixFilePermissions(held,attributes.permissions());
                    java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                // Restore only the test-owned preserved original inode, then
                // observe the SAME saved transition through trusted readback.
                metadataSame(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                try(var saved=x.journal.readPreparedForResume()){assertEquals(0,saved.predecessorCounter());assertEquals(1,saved.nextCounter());}
                assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void EPOCH_READ_BOUNDARY_baselineAndLockSuccessorsRevokeOnlyOriginal()throws Exception {
        for(String name:new String[]{NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.LOCK})
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var original=metadataFiles(x.dir);
            var keys=new java.util.TreeMap<String,Object>();for(String key:original.keySet())keys.put(key,metadataKey(x.dir.resolve(key)));
            var file=x.dir.resolve(name);var genuine=x.root.resolve("read-boundary-genuine-"+name);
            var replacement=x.root.resolve("read-boundary-successor-"+name);
            var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);byte[] owned=refusedEpochBuffer(current);long counter=current.counter();
                java.nio.file.Files.createLink(genuine,file);java.nio.file.Files.copy(file,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,attributes.permissions());
                java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(attributes.fileKey(),metadataKey(file));metadataSame(original,x.dir);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                java.nio.file.Files.move(genuine,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(attributes.fileKey(),metadataKey(file));metadataSame(original,x.dir);
                assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));assertThrows(VaultFailure.class,current::counter);
                try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(counter,fresh.counter());}
                for(String key:keys.keySet())assertEquals(keys.get(key),metadataKey(x.dir.resolve(key)));assertEquals(raw,x.raw());
            }finally{
                if(java.nio.file.Files.exists(genuine))java.nio.file.Files.move(genuine,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void EPOCH_READ_BOUNDARY_exactCurrentAndUnsettledArtifactsRefuse()throws Exception {
        for(String fault:new String[]{"same-bytes-current","pending","foreign-artifact"})
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var genuine=x.root.resolve("read-boundary-original-current");
            var replacement=x.root.resolve("read-boundary-new-current");
            var foreign=x.dir.resolve("read-boundary-unknown-original");
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);byte[] owned=refusedEpochBuffer(current);
                NativePrivateMutationEpochStore.Prepared prepared=null;
                try{
                    if(fault.equals("pending"))prepared=x.journal.prepareNext(current);
                    else if(fault.equals("foreign-artifact")){
                        java.nio.file.Files.write(foreign,new byte[]{7},java.nio.file.StandardOpenOption.CREATE_NEW);
                        java.nio.file.Files.setPosixFilePermissions(foreign,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                    }else{
                        var attrs=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        java.nio.file.Files.createLink(genuine,file);java.nio.file.Files.copy(file,replacement);
                        java.nio.file.Files.setPosixFilePermissions(replacement,attrs.permissions());
                        java.nio.file.Files.setLastModifiedTime(replacement,attrs.lastModifiedTime());
                        java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        assertNotEquals(metadataKey(genuine),metadataKey(file));
                    }
                    var retained=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                    for(String name:retained.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                    try{
                        assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                        assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                        assertThrows(VaultFailure.class,current::counter);metadataSame(retained,x.dir);
                        for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                        if(prepared!=null){assertEquals(0,prepared.predecessorCounter());assertEquals(1,prepared.nextCounter());}
                        if(fault.equals("same-bytes-current")){
                            java.nio.file.Files.move(genuine,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                            assertArrayEquals(retained.get(NativePrivateMutationEpochStore.CURRENT),java.nio.file.Files.readAllBytes(file));
                            assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                            try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                        }
                        assertEquals(raw,x.raw());
                    }finally{for(byte[] bytes:retained.values())java.util.Arrays.fill(bytes,(byte)0);}
                }finally{if(prepared!=null)prepared.close();}
            }finally{
                if(java.nio.file.Files.exists(genuine))java.nio.file.Files.move(genuine,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }
    @Test public void EPOCH_READ_BOUNDARY_contendedLockClosesOnlyOwnReadHandle()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var other=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile());
            var raw=x.raw();var original=metadataFiles(x.dir);
            try(var current=x.journal.readCurrent();var foreign=other.readCurrent()){
                byte[] owned=refusedEpochBuffer(current),foreignBuffer=refusedEpochBuffer(foreign),foreignCopy=foreignBuffer.clone();
                var locked=new CountDownLatch(1);var release=new CountDownLatch(1);
                var error=new java.util.concurrent.atomic.AtomicReference<Throwable>();
                Thread holder=new Thread(()->{
                    try(var channel=java.nio.channels.FileChannel.open(x.dir.resolve(NativePrivateMutationEpochStore.LOCK),
                        java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        var held=channel.lock()){
                        if(!held.isValid())throw new AssertionError("owned lock unavailable");locked.countDown();
                        if(!release.await(15,TimeUnit.SECONDS))throw new AssertionError("owned lock release absent");
                    }catch(Throwable failure){error.set(failure);locked.countDown();}
                },"owned-epoch-read-boundary-lock");
                holder.start();
                try{
                    assertTrue(locked.await(10,TimeUnit.SECONDS));if(error.get()!=null)throw new AssertionError(error.get());
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                    assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                    assertSame(foreignBuffer,refusedEpochBuffer(foreign));assertArrayEquals(foreignCopy,foreignBuffer);
                    assertEquals(0,foreign.counter());metadataSame(original,x.dir);assertEquals(raw,x.raw());
                }finally{
                    release.countDown();holder.join(5000);
                    if(holder.isAlive()){holder.interrupt();holder.join(5000);}
                    if(holder.isAlive())throw new AssertionError("owned lock thread did not settle");
                    java.util.Arrays.fill(foreignCopy,(byte)0);
                }
                if(error.get()!=null)throw new AssertionError(error.get());
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));other.requireCurrent(foreign);
                try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                metadataSame(original,x.dir);assertEquals(raw,x.raw());
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    // The exact existing private fixed-file helper is inspected on disposable
    // real metadata only. It cannot mint Current/Prepared/token authority.
    private static byte[] baselineLiveRead(java.nio.file.Path path,int size,
        java.nio.file.attribute.UserPrincipal owner,Object key,boolean pinned)throws Exception {
        var method=pinned?NativePrivateMutationEpochStore.class.getDeclaredMethod("readFixed",java.nio.file.Path.class,
            int.class,java.nio.file.attribute.UserPrincipal.class,Object.class)
            :NativePrivateMutationEpochStore.class.getDeclaredMethod("readFixed",java.nio.file.Path.class,
                int.class,java.nio.file.attribute.UserPrincipal.class);
        method.setAccessible(true);try{return(byte[])(pinned?method.invoke(null,path,size,owner,key):method.invoke(null,path,size,owner));}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw(Exception)failure.getCause();throw(Error)failure.getCause();
        }
    }
    @Test public void BASELINE_LIVE_pinnedReadRejectsEqualByteSuccessor()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var original=metadataFiles(x.dir);var path=x.dir.resolve(NativePrivateMutationEpochStore.BASELINE);
            var attrs=java.nio.file.Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var held=x.root.resolve("live-baseline-genuine");var replacement=x.root.resolve("live-baseline-equal-successor");
            try(var current=x.journal.readCurrent()){
                byte[] read=baselineLiveRead(path,(int)attrs.size(),attrs.owner(),attrs.fileKey(),true);
                try{assertArrayEquals(original.get(NativePrivateMutationEpochStore.BASELINE),read);}finally{java.util.Arrays.fill(read,(byte)0);}
                java.nio.file.Files.createLink(held,path);java.nio.file.Files.copy(path,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,attrs.permissions());java.nio.file.Files.setLastModifiedTime(replacement,attrs.lastModifiedTime());
                java.nio.file.Files.move(replacement,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(attrs.fileKey(),metadataKey(path));metadataSame(original,x.dir);
                // Model the actual read seeing a same-byte successor after an
                // outer precheck: its own pinned attribute check must refuse.
                assertThrows(VaultFailure.class,()->baselineLiveRead(path,(int)attrs.size(),attrs.owner(),attrs.fileKey(),true));
                byte[] ordinary=baselineLiveRead(path,(int)attrs.size(),attrs.owner(),null,false);
                try{assertArrayEquals(original.get(NativePrivateMutationEpochStore.BASELINE),ordinary);}finally{java.util.Arrays.fill(ordinary,(byte)0);}
                // Full original admission is still strict; no adoption of the
                // new inode through either constructor or live Current path.
                assertThrows(VaultFailure.class,()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile()));
                byte[] owned=refusedEpochBuffer(current);assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                java.nio.file.Files.move(held,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(attrs.fileKey(),metadataKey(path));metadataSame(original,x.dir);
                assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                var freshStore=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile());
                try(var fresh=freshStore.readCurrent()){freshStore.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                assertEquals(raw,x.raw());
            }finally{
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void BASELINE_LIVE_contentPermissionsAndSymlinkRevoke()throws Exception {
        for(String fault:new String[]{"content","permissions","symlink"})
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var original=metadataFiles(x.dir);var raw=x.raw();var path=x.dir.resolve(NativePrivateMutationEpochStore.BASELINE);
            var attrs=java.nio.file.Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);var held=x.root.resolve("baseline-original-"+fault);
            var replacement=x.root.resolve("baseline-symlink");
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);byte[] owned=refusedEpochBuffer(current);
                try{
                    if(fault.equals("content")){
                        byte[] changed=original.get(NativePrivateMutationEpochStore.BASELINE).clone();
                        try{changed[changed.length-1]^=1;java.nio.file.Files.write(path,changed,java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);}
                        finally{java.util.Arrays.fill(changed,(byte)0);}
                    }else if(fault.equals("permissions"))
                        java.nio.file.Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r-----"));
                    else{
                        java.nio.file.Files.createLink(held,path);java.nio.file.Files.createSymbolicLink(replacement,held);
                        java.nio.file.Files.move(replacement,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        assertTrue(java.nio.file.Files.isSymbolicLink(path));
                    }
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                }finally{
                    if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    if(fault.equals("content"))java.nio.file.Files.write(path,original.get(NativePrivateMutationEpochStore.BASELINE),java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
                    java.nio.file.Files.setPosixFilePermissions(path,attrs.permissions());java.nio.file.Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                }
                assertEquals(attrs.fileKey(),metadataKey(path));metadataSame(original,x.dir);
                assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);assertThrows(VaultFailure.class,current::counter);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
                assertEquals(raw,x.raw());
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void BASELINE_LIVE_pendingAndUnknownArtifactsStayRetained()throws Exception {
        for(String artifact:new String[]{NativePrivateMutationEpochStore.PENDING,NativePrivateMutationEpochStore.BOOTSTRAP,"unknown-baseline-file"})
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);NativePrivateMutationEpochStore.Prepared prepared=null;
                try{
                    if(artifact.equals(NativePrivateMutationEpochStore.PENDING))prepared=x.journal.prepareNext(current);
                    else{
                        var file=x.dir.resolve(artifact);java.nio.file.Files.write(file,new byte[]{7},java.nio.file.StandardOpenOption.CREATE_NEW);
                        java.nio.file.Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                    }
                    var retained=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                    for(String name:retained.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                    try{
                        byte[] owned=refusedEpochBuffer(current);assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                        assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                        metadataSame(retained,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                        assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                        if(prepared!=null){assertEquals(0,prepared.predecessorCounter());assertEquals(1,prepared.nextCounter());}
                        assertEquals(raw,x.raw());
                    }finally{for(byte[] bytes:retained.values())java.util.Arrays.fill(bytes,(byte)0);}
                }finally{if(prepared!=null)prepared.close();}
            }
        }
    }
    // Private DATA reader calls only: no native owner/capability is constructed
    // or injected. Full owning cases below use the existing durable fixture.
    private static Object uidOwnerCall(String name,Class<?>[] types,Object...arguments)throws Exception {
        var method=NativePrivateMutationEpochStore.class.getDeclaredMethod(name,types);method.setAccessible(true);
        try{return method.invoke(null,arguments);}catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw(Exception)failure.getCause();throw(Error)failure.getCause();
        }
    }
    private static Long uidOwnerExpected(NativePrivateMutationEpochStore journal)throws Exception {
        var field=NativePrivateMutationEpochStore.class.getDeclaredField("ownerUid");field.setAccessible(true);return(Long)field.get(journal);
    }
    private static java.nio.file.attribute.BasicFileAttributes uidOwnerFile(java.nio.file.Path path,
        java.nio.file.attribute.UserPrincipal owner,Long uid)throws Exception {
        return(java.nio.file.attribute.BasicFileAttributes)uidOwnerCall("privateFile",new Class<?>[]{java.nio.file.Path.class,
            java.nio.file.attribute.UserPrincipal.class,Long.class},path,owner,uid);
    }
    @Test public void UID_OWNER_sameStatBindingAndFreshNativeAttributes()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var original=metadataFiles(x.dir);
            var root=java.nio.file.Files.readAttributes(x.root,"unix:uid,owner,fileKey,mode",java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var owner=(java.nio.file.attribute.UserPrincipal)root.get("owner");
            assertEquals(java.nio.file.Files.class.getClassLoader(),x.root.getFileSystem().provider().getClass().getClassLoader());
            assertEquals(java.nio.file.Files.class.getClassLoader(),owner.getClass().getClassLoader());
            assertEquals(((Number)root.get("uid")).longValue(),uidOwnerExpected(x.journal).longValue());
            assertEquals(root.get("uid") instanceof Integer?Long.valueOf((Integer)root.get("uid")):(Long)root.get("uid"),
                uidOwnerCall("originalNativeUid",new Class<?>[]{java.nio.file.Path.class,java.nio.file.attribute.UserPrincipal.class,Object.class},
                    x.root,owner,root.get("fileKey")));
            assertThrows(VaultFailure.class,()->uidOwnerCall("originalNativeUid",new Class<?>[]{java.nio.file.Path.class,
                java.nio.file.attribute.UserPrincipal.class,Object.class},x.root,owner,new Object()));
            for(String name:original.keySet()){
                var path=x.dir.resolve(name);var full=epochPrivateAttributes(path,owner);
                var fast=uidOwnerFile(path,owner,uidOwnerExpected(x.journal));
                assertFalse("native snapshot must not fabricate an owner getter",fast instanceof java.nio.file.attribute.PosixFileAttributes);
                assertEquals(full.fileKey(),fast.fileKey());assertEquals(full.size(),fast.size());
                assertEquals(full.lastModifiedTime(),fast.lastModifiedTime());assertEquals(full.lastAccessTime(),fast.lastAccessTime());
                assertEquals(full.creationTime(),fast.creationTime());assertEquals(full.isRegularFile(),fast.isRegularFile());
                assertEquals(full.isDirectory(),fast.isDirectory());assertEquals(full.isSymbolicLink(),fast.isSymbolicLink());
                assertEquals(full.isOther(),fast.isOther());
            }
            try(var current=x.journal.readCurrent()){x.journal.requireCurrent(current);x.journal.requireCurrent(current);assertEquals(0,current.counter());}
            try(var input=new java.io.DataInputStream(new java.io.ByteArrayInputStream(original.get(NativePrivateMutationEpochStore.BASELINE)))){
                input.readInt();input.readInt();String[] fields=new String[7];for(int i=0;i<fields.length;i++)fields[i]=input.readUTF();
                assertEquals(owner.getName(),fields[5]);assertEquals(uidOwnerExpected(x.journal).toString(),fields[6]);
            }
            metadataSame(original,x.dir);assertEquals(raw,x.raw());
            for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void UID_OWNER_foreignAndApplicationLoaderRetainFullComparison()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var original=metadataFiles(x.dir);var path=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var owner=java.nio.file.Files.getOwner(path,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var foreign=java.nio.file.Files.readAttributes(java.nio.file.Path.of("/"),"unix:uid,owner",java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var foreignOwner=(java.nio.file.attribute.UserPrincipal)foreign.get("owner");
            assertNotEquals("normal existing foreign host UID required",owner,foreignOwner);
            assertThrows(VaultFailure.class,()->uidOwnerFile(path,foreignOwner,((Number)foreign.get("uid")).longValue()));
            // This negative-only application-loader principal must be compared
            // through equals, NEVER accepted merely because supplied UID agrees.
            int[] comparisons={0};
            java.nio.file.attribute.UserPrincipal untrusted=new java.nio.file.attribute.UserPrincipal(){
                public String getName(){throw new AssertionError("name is not authority");}
                @Override public boolean equals(Object value){comparisons[0]++;return false;}
                @Override public int hashCode(){return 0;}
            };
            assertEquals(Boolean.FALSE,uidOwnerCall("coreNativeOwner",new Class<?>[]{java.nio.file.Path.class,
                java.nio.file.attribute.UserPrincipal.class},path,untrusted));
            assertNull(uidOwnerCall("originalNativeUid",new Class<?>[]{java.nio.file.Path.class,
                java.nio.file.attribute.UserPrincipal.class,Object.class},x.root,untrusted,metadataKey(x.root)));
            assertThrows(VaultFailure.class,()->uidOwnerFile(path,untrusted,uidOwnerExpected(x.journal)));
            assertEquals(1,comparisons[0]);
            var full=uidOwnerFile(path,owner,null);assertTrue(full instanceof java.nio.file.attribute.PosixFileAttributes);
            assertEquals(owner,((java.nio.file.attribute.PosixFileAttributes)full).owner());
            metadataSame(original,x.dir);for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void UID_OWNER_modeAndEqualByteInodeChangesRevoke()throws Exception {
        for(String fault:new String[]{"mode","baseline-inode","current-inode"})
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();assertNotNull(uidOwnerExpected(x.journal));var original=metadataFiles(x.dir);var raw=x.raw();
            var path=x.dir.resolve(fault.equals("current-inode")?NativePrivateMutationEpochStore.CURRENT:NativePrivateMutationEpochStore.BASELINE);
            var attrs=java.nio.file.Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var held=x.root.resolve("uid-owner-original");var replacement=x.root.resolve("uid-owner-replacement");
            try(var current=x.journal.readCurrent()){
                x.journal.requireCurrent(current);byte[] owned=refusedEpochBuffer(current);
                try{
                    if(fault.equals("mode"))java.nio.file.Files.setPosixFilePermissions(path,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r-----"));
                    else{
                        java.nio.file.Files.createLink(held,path);java.nio.file.Files.copy(path,replacement);
                        java.nio.file.Files.setPosixFilePermissions(replacement,attrs.permissions());java.nio.file.Files.setLastModifiedTime(replacement,attrs.lastModifiedTime());
                        java.nio.file.Files.move(replacement,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        assertNotEquals(attrs.fileKey(),metadataKey(path));assertArrayEquals(original.get(path.getFileName().toString()),java.nio.file.Files.readAllBytes(path));
                    }
                    assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                }finally{
                    if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,path,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    java.nio.file.Files.setPosixFilePermissions(path,attrs.permissions());java.nio.file.Files.setLastModifiedTime(path,attrs.lastModifiedTime());
                }
                assertEquals(attrs.fileKey(),metadataKey(path));metadataSame(original,x.dir);assertEquals(raw,x.raw());
                assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                assertThrows(VaultFailure.class,()->x.journal.requireCurrent(current));
                try(var fresh=x.journal.readCurrent()){x.journal.requireCurrent(fresh);assertEquals(0,fresh.counter());}
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void UID_OWNER_postForceModeIsNotCached()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();assertNotNull(uidOwnerExpected(x.journal));var raw=x.raw();
            try(var current=x.journal.readCurrent();var prepared=x.journal.prepareNext(current)){
                var original=metadataFiles(x.dir);var pending=x.dir.resolve(NativePrivateMutationEpochStore.PENDING);
                var permissions=java.nio.file.Files.getPosixFilePermissions(pending);int[] calls={0};
                Object normal=metadataIo(x.journal,(operation,delegate,args)->{
                    metadataNormal(delegate,operation,args);
                    if(operation.equals("forceFile")&&calls[0]++==0)
                        java.nio.file.Files.setPosixFilePermissions(pending,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r-----"));
                });
                try{
                    assertThrows(VaultFailure.class,()->x.journal.commitPrepared(prepared));assertEquals(1,calls[0]);
                    metadataSame(original,x.dir);assertEquals(raw,x.raw());
                    assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
                }finally{metadataRestoreIo(x.journal,normal);java.nio.file.Files.setPosixFilePermissions(pending,permissions);}
                try(var saved=x.journal.readPreparedForResume()){assertEquals(0,saved.predecessorCounter());assertEquals(1,saved.nextCounter());}
                for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void UID_OWNER_invalidNativeUidCannotBecomeOwner()throws Exception {
        for(Object value:new Object[]{-1,0x1_0000_0000L,"0",Double.valueOf(0),null})
            assertThrows(VaultFailure.class,()->uidOwnerCall("uidValue",new Class<?>[]{Object.class},value));
        assertEquals(Long.valueOf(0),uidOwnerCall("uidValue",new Class<?>[]{Object.class},0));
        assertEquals(Long.valueOf(123),uidOwnerCall("uidValue",new Class<?>[]{Object.class},Long.valueOf(123)));
    }
    @Test public void UID_OWNER_vmCoreAnchorCannotAdoptApplicationLoader()throws Exception {
        assertSame("normal VM core anchor",Object.class.getClassLoader(),java.nio.file.Files.class.getClassLoader());
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();assertNotNull(uidOwnerExpected(x.journal));var raw=x.raw();var original=metadataFiles(x.dir);
            var path=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var owner=java.nio.file.Files.getOwner(path,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertSame(Object.class.getClassLoader(),path.getFileSystem().provider().getClass().getClassLoader());
            assertSame(Object.class.getClassLoader(),owner.getClass().getClassLoader());
            assertEquals(Boolean.TRUE,uidOwnerCall("coreNativeOwner",new Class<?>[]{java.nio.file.Path.class,
                java.nio.file.attribute.UserPrincipal.class},path,owner));
            try(var child=new java.net.URLClassLoader(new java.net.URL[0],Object.class.getClassLoader())){
                int[] compared={0};
                var foreign=(java.nio.file.attribute.UserPrincipal)java.lang.reflect.Proxy.newProxyInstance(child,
                    new Class<?>[]{java.nio.file.attribute.UserPrincipal.class},(proxy,method,args)->{
                        if(method.getName().equals("equals")){compared[0]++;return false;}
                        throw new AssertionError("only original owner comparison permitted");
                    });
                assertNotSame(Object.class.getClassLoader(),foreign.getClass().getClassLoader());
                assertEquals(Boolean.FALSE,uidOwnerCall("coreNativeOwner",new Class<?>[]{java.nio.file.Path.class,
                    java.nio.file.attribute.UserPrincipal.class},path,foreign));
                assertThrows(VaultFailure.class,()->uidOwnerFile(path,foreign,uidOwnerExpected(x.journal)));
                assertEquals(1,compared[0]);
            }
            try(var current=x.journal.readCurrent()){x.journal.requireCurrent(current);assertEquals(0,current.counter());}
            metadataSame(original,x.dir);assertEquals(raw,x.raw());for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);
        }
    }
    // Negative factory states use actual existing journal/token fixtures only.
    // No valid HELD lease is manufactured to test post-open lifecycle; those
    // checks require Main's actual native hold transition owning workflow.
    @Test public void HELD_READ_absentHasNoProvisioning()throws Exception {
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
        assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::openInstalledOriginalHeldRead);
        assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
    }
    @Test public void HELD_READ_installedV1NeverBecomesHeld()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=metadataFiles(x.dir);var raw=x.raw();
            var keys=new java.util.TreeMap<String,Object>();for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
            long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            try(var current=x.journal.readCurrent()){
                assertNull(current.heldOriginal());assertEquals(0,current.counter());
                assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::openInstalledOriginalHeldRead);
                x.journal.requireCurrent(current);assertNull(current.heldOriginal());assertEquals(0,current.counter());
                assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
                assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
                metadataSame(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                assertEquals(raw,x.raw());
            }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void HELD_READ_pendingDoesNotRecoverOrReplaceOriginal()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var raw=x.raw();
            try(var current=x.journal.readCurrent();var prepared=x.journal.prepareNext(current)){
                var original=metadataFiles(x.dir);var keys=new java.util.TreeMap<String,Object>();
                for(String name:original.keySet())keys.put(name,metadataKey(x.dir.resolve(name)));
                long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
                var ordinary=new Preferences();ordinary.disk.put("retained","unchanged");var gate=adapter(ordinary);int[] effects={0};
                try{
                    assertTrue(original.containsKey(NativePrivateMutationEpochStore.PENDING));assertNull(current.heldOriginal());
                    assertThrows(VaultFailure.class,AndroidProtectedWorkPreferences::openInstalledOriginalHeldRead);
                    assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
                    assertTrue(gate.frozen());
                    assertThrows(VaultFailure.class,()->gate.withOrdinaryWorkAdmission(()->{effects[0]++;return null;}));
                    assertThrows(VaultFailure.class,()->gate.withOrdinaryWriteAdmission(()->{effects[0]++;return null;}));
                    assertEquals(0,effects[0]);assertEquals(0,ordinary.commits);assertEquals(Map.of("retained","unchanged"),ordinary.disk);
                    assertEquals(0,current.counter());assertEquals(1,prepared.nextCounter());
                    metadataSame(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),metadataKey(x.dir.resolve(name)));
                    assertEquals(raw,x.raw());
                }finally{for(byte[] bytes:original.values())java.util.Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    private static Preferences pendingProbe(TestCipher cipher)throws Exception{
        var p=new Preferences();p.disk.put("foreign_unreadable",17);p.disk.put("saved_original","original bytes");p.durableDisk=new HashMap<>(p.disk);
        var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);store.prepareSeparationProbe(store.separationRawSnapshot());return p;
    }
    @Test public void memoryOnlyCancellationReestablishesSameOriginalProbe()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var original=store.preparePendingSeparationRecovery();String record=(String)original.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(original));
        assertEquals("1",p.disk.get(EPOCH));assertFalse(p.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertEquals(record,p.durableDisk.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertTrue(adapter(p).frozen());
        int encryptions=cipher.existingKeyEncryptCalls;p.persistThenFail=false;
        var recreated=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);var restored=recreated.preparePendingSeparationRecovery();
        assertEquals(record,restored.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("1",restored.get(EPOCH));
        assertEquals(restored,p.durableDisk);assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(p).frozen());
        Map<String,Object> predecessor=new HashMap<>(original);predecessor.remove(AndroidProtectedWorkPreferences.PROBE_KEY);
        assertNotEquals(NativeProtectedWorkSnapshot.capture(predecessor).digest,NativeProtectedWorkSnapshot.capture(withoutProbe(restored)).digest);
        recreated.cancelPendingSeparationRecovery(restored);
        assertEquals("1",p.disk.get(EPOCH));assertFalse(p.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));assertFalse(adapter(p).frozen());
        assertEquals(17,p.disk.get("foreign_unreadable"));assertEquals("original bytes",p.disk.get("saved_original"));
        assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertEquals(0,cipher.destroyCalls);
    }
    private static Map<String,Object> withoutProbe(Map<String,?> raw){
        Map<String,Object> result=new HashMap<>(raw);result.remove(AndroidProtectedWorkPreferences.PROBE_KEY);return result;
    }
    @Test public void preMemoryCancellationFailureUsesSamePlannedSuccessor()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var captured=store.separationRawSnapshot();String record=(String)captured.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        p.fail=true;denied(()->store.cancelPendingSeparationRecovery(captured));assertFalse(p.disk.containsKey(EPOCH));
        int encryptions=cipher.existingKeyEncryptCalls;p.fail=false;
        var restored=store.preparePendingSeparationRecovery();assertEquals(record,restored.get(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertEquals("1",restored.get(EPOCH));store.cancelPendingSeparationRecovery(restored);
        assertEquals("1",p.durableDisk.get(EPOCH));assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertFalse(adapter(p).frozen());
    }
    @Test public void failedProbeRecommitRetainsExactContinuation()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var captured=store.separationRawSnapshot();String record=(String)captured.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(captured));
        int encryptions=cipher.existingKeyEncryptCalls;denied(store::preparePendingSeparationRecovery);
        assertEquals(record,p.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("1",p.disk.get(EPOCH));
        assertTrue(adapter(p).frozen());assertEquals(encryptions,cipher.existingKeyEncryptCalls);
        p.persistThenFail=false;var restored=new AndroidOfflineAuthorityTimeStore(p.object(),cipher).preparePendingSeparationRecovery();
        assertEquals(record,restored.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("1",p.durableDisk.get(EPOCH));
        store.cancelPendingSeparationRecovery(restored);assertFalse(adapter(p).frozen());assertEquals("1",p.disk.get(EPOCH));
    }
    @Test public void repeatedCancellationFailureDoesNotMintAnotherGeneration()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var captured=store.separationRawSnapshot();String record=(String)captured.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        int encryptions=cipher.existingKeyEncryptCalls;
        for(int i=0;i<3;i++){
            p.persistThenFail=true;var held=captured;denied(()->store.cancelPendingSeparationRecovery(held));
            p.persistThenFail=false;captured=new AndroidOfflineAuthorityTimeStore(p.object(),cipher).preparePendingSeparationRecovery();
            assertEquals(record,captured.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("1",captured.get(EPOCH));
            assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(p).frozen());
        }
        store.cancelPendingSeparationRecovery(captured);assertEquals("1",p.durableDisk.get(EPOCH));assertEquals(0,cipher.destroyCalls);
    }
    @Test public void foreignContinuationStateCannotBeNormalized()throws Exception{
        for(String key:new String[]{EPOCH,"saved_original",AndroidProtectedWorkPreferences.PROBE_KEY,
            AndroidProtectedWorkPreferences.FENCE_KEY,AndroidProtectedWorkPreferences.NFC_WRITE_KEY,WORK_PENDING}){
            var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
            var original=store.separationRawSnapshot();p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(original));p.persistThenFail=false;
            p.disk.put(key,EPOCH.equals(key)?"9":"foreign preserved bytes");var before=new HashMap<>(p.disk);
            int commits=p.commits,encryptions=cipher.existingKeyEncryptCalls;
            denied(store::preparePendingSeparationRecovery);assertEquals(before,p.disk);assertEquals(commits,p.commits);
            assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(p).frozen());
        }
    }
    @Test public void restartedMismatchedV1ProbeHasNoPredecessorAuthority()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var original=store.separationRawSnapshot();p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(original));p.persistThenFail=false;
        var restored=store.preparePendingSeparationRecovery();String record=(String)restored.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        var next=restarted(p);var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);int encryptions=cipher.existingKeyEncryptCalls;
        assertEquals(record,next.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY));var before=new HashMap<>(next.disk);
        denied(recreated::preparePendingSeparationRecovery);denied(()->recreated.cancelPendingSeparationRecovery(next.disk));
        assertEquals(before,next.disk);assertEquals(0,next.commits);assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(next).frozen());
    }
    @Test public void unreadableOriginalProbeCannotBeReissued()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var original=store.separationRawSnapshot();p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(original));p.persistThenFail=false;
        JSONObject envelope=new JSONObject((String)original.get(AndroidProtectedWorkPreferences.PROBE_KEY));
        cipher.makeUnreadable(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
        int commits=p.commits,encryptions=cipher.existingKeyEncryptCalls;var before=new HashMap<>(p.disk);
        denied(store::preparePendingSeparationRecovery);assertEquals(before,p.disk);assertEquals(commits,p.commits);
        assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(p).frozen());
    }
    @Test public void staleCancellationCannotRetireRestoredOrFutureProbe()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var original=store.separationRawSnapshot();p.persistThenFail=true;denied(()->store.cancelPendingSeparationRecovery(original));p.persistThenFail=false;
        int commits=p.commits;denied(()->store.cancelPendingSeparationRecovery(original));assertEquals(commits,p.commits);
        var restored=store.preparePendingSeparationRecovery();store.cancelPendingSeparationRecovery(restored);
        store.prepareSeparationProbe(store.separationRawSnapshot());var future=new HashMap<>(p.disk);int encryptions=cipher.existingKeyEncryptCalls;
        commits=p.commits;denied(()->store.cancelPendingSeparationRecovery(restored));assertEquals(commits,p.commits);
        assertEquals(future,p.disk);assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertTrue(adapter(p).frozen());
    }
    @Test public void thrownCancellationAndRecommitRetainExactOriginal()throws Exception{
        for(boolean after:new boolean[]{false,true}){
            var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
            var original=store.separationRawSnapshot();String record=(String)original.get(AndroidProtectedWorkPreferences.PROBE_KEY);
            Hook exception=()->{throw new IllegalStateException("synthetic preference commit exception");};
            if(after)p.afterCommit=exception;else p.beforeCommit=exception;
            denied(()->store.cancelPendingSeparationRecovery(original));assertTrue(adapter(p).frozen());
            assertEquals(record,adapter(p).recoverableProbe());int encryptions=cipher.existingKeyEncryptCalls;
            denied(store::preparePendingSeparationRecovery);assertTrue(adapter(p).frozen());
            p.beforeCommit=()->{};p.afterCommit=()->{};
            var restored=store.preparePendingSeparationRecovery();assertEquals("1",restored.get(EPOCH));
            assertEquals(record,restored.get(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals(encryptions,cipher.existingKeyEncryptCalls);
            store.cancelPendingSeparationRecovery(restored);assertEquals("1",p.durableDisk.get(EPOCH));assertEquals(0,cipher.destroyCalls);
        }
    }
    @Test public void contaminatedCancellationReadbackCannotBeAdopted()throws Exception{
        var cipher=new TestCipher();var p=pendingProbe(cipher);var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        var original=store.separationRawSnapshot();p.corruptReadback=true;denied(()->store.cancelPendingSeparationRecovery(original));p.corruptReadback=false;
        var contaminated=new HashMap<>(p.disk);assertEquals("unknown preserved bytes",contaminated.get("stray"));
        int commits=p.commits,encryptions=cipher.existingKeyEncryptCalls;denied(store::preparePendingSeparationRecovery);
        assertEquals(contaminated,p.disk);assertEquals(commits,p.commits);assertEquals(encryptions,cipher.existingKeyEncryptCalls);
        assertTrue(adapter(p).frozen());
    }
    private static final String EPOCH="native_work_mutation_epoch.v1";
    @Test public void ordinaryAbaChangesDurableObservation()throws Exception{
        var p=new Preferences();p.disk.put("saved_original","A");p.disk.put("foreign_unreadable",17);p.durableDisk=new HashMap<>(p.disk);
        var original=new HashMap<>(p.durableDisk);var work=adapter(p);
        assertTrue(work.edit().putString("saved_original","B").commit());
        assertTrue(work.edit().putString("saved_original","A").commit());
        assertEquals("A",p.durableDisk.get("saved_original"));assertEquals(17,p.durableDisk.get("foreign_unreadable"));
        assertNotEquals("A -> B -> A must not recreate the original durable observation",original,p.durableDisk);
        assertEquals(p.disk,p.durableDisk);
    }
    @Test public void durableEpochInvalidatesRecreatedAdapterAndStagedEditor()throws Exception{
        var p=new Preferences();p.disk.put("saved_original","A");p.durableDisk=new HashMap<>(p.disk);
        var first=adapter(p);var observation=first.observeReadOnly();var staged=first.edit().putString("saved_original","stale");
        var originalAttempt=NativeWorkOriginalWriteAttempt.prepare(observation.values,"authenticated_principal",null,"saved candidate");
        String originalWire=originalAttempt.encode().toString();
        assertTrue(adapter(p).edit().putString("saved_original","B").commit());
        assertTrue(adapter(p).edit().putString("saved_original","A").commit());
        // Simulate loss of ONLY the process counter: disk epoch must still fence.
        var epoch=AndroidProtectedWorkPreferences.class.getDeclaredField("mutationEpoch");epoch.setAccessible(true);
        long after=epoch.getLong(null);var originalEpoch=observation.getClass().getDeclaredField("mutationEpoch");originalEpoch.setAccessible(true);
        epoch.setLong(null,originalEpoch.getLong(observation));
        try{assertFalse(adapter(p).matchesReadOnly(observation));assertFalse(staged.commit());}
        finally{epoch.setLong(null,after);}
        var next=restarted(p);assertEquals("A",next.disk.get("saved_original"));assertEquals(p.disk.get(EPOCH),next.disk.get(EPOCH));
        denied(()->NativeWorkOriginalWriteAttempt.decode(new JSONObject(originalWire)).originalFrom(next.disk));
        var recreated=adapter(next);assertTrue(recreated.matchesReadOnly(recreated.observeReadOnly()));
    }
    @Test public void externalWriterPersistsFenceBeforeCallback()throws Exception{
        var p=new Preferences();var work=adapter(p);var before=work.observeReadOnly();
        denied(()->work.withOrdinaryWriteAdmission(()->{
            assertEquals(p.disk.get(EPOCH),p.durableDisk.get(EPOCH));assertNotNull(p.disk.get(EPOCH));
            throw new VaultFailure("synthetic external commit uncertain");
        }));
        assertFalse(work.matchesReadOnly(before));assertNotNull(restarted(p).disk.get(EPOCH));
    }
    @Test public void failedEpochCannotRunExternalWriter()throws Exception{
        var p=new Preferences();p.fail=true;int[] calls={0};
        denied(()->adapter(p).withOrdinaryWriteAdmission(()->{calls[0]++;return true;}));
        assertEquals(0,calls[0]);assertTrue(adapter(p).frozen());assertTrue(p.durableDisk.isEmpty());
    }
    @Test public void failedOrdinaryEpochKeepsUncertainty()throws Exception{
        var p=new Preferences();p.disk.put("saved_original","A");p.durableDisk=new HashMap<>(p.disk);p.persistThenFail=true;
        assertFalse(adapter(p).edit().putString("saved_original","B").commit());
        assertTrue(adapter(p).frozen());assertEquals("A",p.durableDisk.get("saved_original"));
        assertFalse(adapter(p).edit().putString("saved_original","C").commit());
        var next=restarted(p);assertEquals("A",next.disk.get("saved_original"));assertFalse(adapter(next).frozen());
    }
    @Test public void malformedOrExhaustedEpochPreservesBytes()throws Exception{
        for(Object value:new Object[]{false,17,"","0","01","-1","9223372036854775808","9223372036854775807"}){
            var p=new Preferences();p.disk.put(EPOCH,value);p.disk.put("foreign","unaltered");p.durableDisk=new HashMap<>(p.disk);
            var before=new HashMap<>(p.disk);assertFalse(adapter(p).edit().putString("saved_original","B").commit());
            assertEquals(before,p.disk);assertEquals(0,p.commits);
        }
    }
    @Test public void workEpochRecoversExactInterruptedOriginal()throws Exception{
        var p=new Preferences();p.disk.put("authenticated_principal","original");p.disk.put("foreign",17);p.durableDisk=new HashMap<>(p.disk);
        var work=adapter(p);var observation=work.observeReadOnly();
        var attempt=NativeWorkOriginalWriteAttempt.prepare(observation.values,"authenticated_principal","original","candidate");
        String record=attempt.encode().toString();var prepared=work.prepareWorkOriginal(observation,attempt,record);
        assertEquals("1",p.durableDisk.get(EPOCH));p.persistThenFail=true;assertFalse(work.commitWorkOriginal(prepared,false));
        assertEquals(record,p.durableDisk.get(WORK_PENDING));assertEquals("original",p.durableDisk.get("authenticated_principal"));
        var next=restarted(p);var recovered=adapter(next);var decoded=NativeWorkOriginalWriteAttempt.decode(new JSONObject(record));
        var same=recovered.recoverWorkOriginal(decoded,record);assertTrue(recovered.commitWorkOriginal(same,true));
        assertEquals(attempt.id,next.durableDisk.get(WORK_GEN));assertEquals("2",next.durableDisk.get(EPOCH));
        assertEquals("original",next.disk.get("authenticated_principal"));assertEquals(17,next.disk.get("foreign"));
        assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(next.disk,next.durableDisk);
    }
    @Test public void nfcEpochRecoversExactInterruptedOriginal()throws Exception{
        var p=new Preferences();p.disk.put(NativeNfcOriginalWriteAttempt.KEY,"original");p.disk.put("foreign",17);p.durableDisk=new HashMap<>(p.disk);
        var work=adapter(p);var observation=work.observeReadOnly();var attempt=NativeNfcOriginalWriteAttempt.prepare(observation.values,"original","candidate");
        String record=attempt.encode().toString();var prepared=work.prepareNfcOriginal(observation,attempt,record);
        p.persistThenFail=true;assertFalse(work.commitNfcOriginal(prepared,false));
        var next=restarted(p);var recovered=adapter(next);var same=NativeNfcOriginalWriteAttempt.decode(new JSONObject(record));
        assertTrue(recovered.commitNfcOriginal(recovered.recoverNfcOriginal(same,record),true));
        assertEquals(attempt.id,next.disk.get(AndroidProtectedWorkPreferences.NFC_GENERATION_KEY));assertEquals("2",next.disk.get(EPOCH));
        assertEquals("original",next.disk.get(NativeNfcOriginalWriteAttempt.KEY));assertEquals(17,next.disk.get("foreign"));
        assertFalse(next.disk.containsKey(AndroidProtectedWorkPreferences.NFC_WRITE_KEY));
    }
    @Test public void legacyAttemptsRemainRetainedWithoutEpochAuthority()throws Exception{
        for(boolean nfc:new boolean[]{false,true}){
            var p=new Preferences();p.disk.put(nfc?NativeNfcOriginalWriteAttempt.KEY:"authenticated_principal","original");
            JSONObject legacy=nfc?NativeNfcOriginalWriteAttempt.prepare(p.disk,"original","candidate").encode():
                NativeWorkOriginalWriteAttempt.prepare(p.disk,"authenticated_principal","original","candidate").encode();
            legacy.remove("previous_mutation_epoch");legacy.put("schema",legacy.getString("schema").replace(".v2",".v1"));
            String record=legacy.toString(),marker=nfc?AndroidProtectedWorkPreferences.NFC_WRITE_KEY:WORK_PENDING;
            p.disk.put(marker,record);p.durableDisk=new HashMap<>(p.disk);var before=new HashMap<>(p.disk);var work=adapter(p);
            if(nfc){var old=NativeNfcOriginalWriteAttempt.decode(legacy);assertTrue(ProviderWireJson.same(legacy,old.encode()));denied(()->work.recoverNfcOriginal(old,record));}
            else{var old=NativeWorkOriginalWriteAttempt.decode(legacy);assertTrue(ProviderWireJson.same(legacy,old.encode()));denied(()->work.recoverWorkOriginal(old,record));}
            assertEquals(before,p.disk);assertEquals(0,p.commits);assertTrue(work.frozen());
        }
    }
    @Test public void originalEpochRejectsForeignRawMutation()throws Exception{
        for(boolean nfc:new boolean[]{false,true})for(String wrong:new String[]{"2","3","999"}){
            var p=new Preferences();p.disk.put(nfc?NativeNfcOriginalWriteAttempt.KEY:"authenticated_principal","original");
            var work=adapter(p);var observation=work.observeReadOnly();
            if(nfc){var attempt=NativeNfcOriginalWriteAttempt.prepare(observation.values,"original","candidate");String record=attempt.encode().toString();
                work.prepareNfcOriginal(observation,attempt,record);p.disk.put(EPOCH,wrong);denied(()->work.recoverNfcOriginal(attempt,record));}
            else{var attempt=NativeWorkOriginalWriteAttempt.prepare(observation.values,"authenticated_principal","original","candidate");String record=attempt.encode().toString();
                work.prepareWorkOriginal(observation,attempt,record);p.disk.put(EPOCH,wrong);denied(()->work.recoverWorkOriginal(attempt,record));}
        }
    }
    @Test public void cancelProbeChangesDurableEpochWithoutThaw()throws Exception{
        var p=new Preferences();var work=adapter(p);var original=work.protectedSnapshot();var observation=work.observeReadOnly();
        work.prepareProbe(original,"original encrypted pending");work.cancelProbe(original,"original encrypted pending");
        assertEquals("1",p.durableDisk.get(EPOCH));assertFalse(work.matchesReadOnly(observation));assertFalse(work.frozen());
        var current=work.protectedSnapshot();work.freeze(current,"original encrypted fence");
        assertEquals("original encrypted fence",p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
        denied(()->work.cancelProbe(current,"original encrypted pending"));assertTrue(work.frozen());
    }
    @Test public void failedCancellationPreservesPendingOriginal()throws Exception{
        var p=new Preferences();var work=adapter(p);var original=work.protectedSnapshot();work.prepareProbe(original,"original encrypted pending");
        p.persistThenFail=true;denied(()->work.cancelProbe(original,"original encrypted pending"));
        assertTrue(work.frozen());assertEquals("original encrypted pending",work.recoverableProbe());
        assertEquals("original encrypted pending",p.durableDisk.get(AndroidProtectedWorkPreferences.PROBE_KEY));
        var next=restarted(p);assertEquals("original encrypted pending",adapter(next).recoverableProbe());assertTrue(adapter(next).frozen());
    }
    @Test public void rawEpochCannotBeRemovedOrMaskedBySuccessfulReadback()throws Exception{
        var p=new Preferences();assertTrue(adapter(p).edit().putString("foreign","retained").commit());
        var original=new HashMap<>(p.disk);assertFalse(adapter(p).edit().remove(EPOCH).commit());assertEquals(original,p.disk);
        p.corruptReadback=true;assertFalse(adapter(p).edit().putString("ordinary","candidate").commit());
        assertTrue(adapter(p).frozen());assertEquals("retained",p.disk.get("foreign"));assertEquals("unknown preserved bytes",p.disk.get("stray"));
    }
    @Test public void newEpochSchemasAreClosedAndRawCensusVisible()throws Exception{
        var p=new Preferences();assertTrue(adapter(p).edit().putString("authenticated_principal","original").commit());
        NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(p.disk);assertEquals(p.disk.size(),snapshot.recordCount);
        var without=new HashMap<>(p.disk);without.remove(EPOCH);assertNotEquals(snapshot.digest,NativeProtectedWorkSnapshot.capture(without).digest);
        for(boolean nfc:new boolean[]{false,true}){
            JSONObject record=nfc?NativeNfcOriginalWriteAttempt.prepare(p.disk,null,"candidate").encode():
                NativeWorkOriginalWriteAttempt.prepare(p.disk,"authenticated_principal","original","candidate").encode();
            for(Object wrong:new Object[]{17,"0","01","9223372036854775807"}){
                JSONObject poisoned=new JSONObject(record.toString()).put("previous_mutation_epoch",wrong);
                if(nfc)denied(()->NativeNfcOriginalWriteAttempt.decode(poisoned));else denied(()->NativeWorkOriginalWriteAttempt.decode(poisoned));
            }
            JSONObject missing=new JSONObject(record.toString());missing.remove("previous_mutation_epoch");
            JSONObject extra=new JSONObject(record.toString()).put("foreign_authority",true);
            if(nfc){denied(()->NativeNfcOriginalWriteAttempt.decode(missing));denied(()->NativeNfcOriginalWriteAttempt.decode(extra));}
            else{denied(()->NativeWorkOriginalWriteAttempt.decode(missing));denied(()->NativeWorkOriginalWriteAttempt.decode(extra));}
        }
    }
    static final class Preferences {
        Map<String,Object> disk=new HashMap<>(),durableDisk=new HashMap<>();int commits,applies,clears;boolean fail,persistThenFail,corruptReadback;
        private SharedPreferences instance;
        Hook beforeCommit=()->{},afterCommit=()->{};
        SharedPreferences object(){if(instance!=null)return instance;instance=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            switch(method.getName()){
                case "getAll":return new HashMap<>(disk);
                case "contains":return disk.containsKey(args[0]);
                case "getString":case "getStringSet":case "getInt":case "getLong":case "getFloat":case "getBoolean":return disk.getOrDefault(args[0],args[1]);
                case "registerOnSharedPreferenceChangeListener":case "unregisterOnSharedPreferenceChangeListener":return null;
                case "edit":break;
                default:throw new AssertionError(method.getName());
            }
            Map<String,Object> puts=new HashMap<>();Set<String> removes=new HashSet<>();
            return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,action,input)->{
                if(action.getName().startsWith("put")){if(input[1]==null){removes.add((String)input[0]);puts.remove(input[0]);}else{puts.put((String)input[0],input[1]);removes.remove(input[0]);}return editor;}
                switch(action.getName()){
                    case "remove":removes.add((String)input[0]);puts.remove(input[0]);return editor;
                    case "clear":clears++;throw new AssertionError("namespace clear");
                    case "apply":applies++;throw new AssertionError("async persistence");
                    case "commit":
                        commits++;beforeCommit.run();if(fail)return false;
                        Map<String,Object> next=new HashMap<>(disk);for(String key:removes)next.remove(key);next.putAll(puts);disk=next;
                        if(corruptReadback)disk.put("stray","unknown preserved bytes");afterCommit.run();
                        if(!persistThenFail)durableDisk=new HashMap<>(disk);return !persistThenFail;
                    default:throw new AssertionError(action.getName());
                }
            });
        });return instance;}
    }
    interface Attempt{void run()throws Exception;}
    static void denied(Attempt attempt)throws Exception{try{attempt.run();fail("expected refusal");}catch(VaultFailure expected){}}
    static AndroidProtectedWorkPreferences adapter(Preferences p){return new AndroidProtectedWorkPreferences(p.object());}
    private static final String WORK_PENDING="native_work_original_write_attempt.v1",WORK_GEN="native_work_original_write_generation.v1";
    private static Preferences restarted(Preferences p){var next=new Preferences();next.disk=new HashMap<>(p.durableDisk);next.durableDisk=new HashMap<>(next.disk);return next;}
    private static Preferences interruptedWork(TestCipher cipher)throws Exception{
        var p=new Preferences();p.disk.put("unknown_retained","original unreadable bytes");p.durableDisk=new HashMap<>(p.disk);
        var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);store.savePrincipal("{\"original\":true}");
        int bodyCommit=p.commits+2;p.beforeCommit=()->p.persistThenFail=p.commits>=bodyCommit;
        denied(()->store.savePrincipal("{\"candidate\":true}"));
        assertTrue(p.durableDisk.containsKey(WORK_PENDING));return p;
    }
    @Test public void ordinaryEncryptedSaveHasDurableGeneration()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"original\":true}");assertTrue(p.disk.get(WORK_GEN) instanceof String);
        String first=(String)p.disk.get(WORK_GEN);assertEquals(first,NativeNfcOriginalWriteAttempt.uuid(first));
        assertFalse(p.disk.containsKey(WORK_PENDING));assertEquals(p.disk,p.durableDisk);
        store.saveCompletionReceipt("a".repeat(64),"original authenticated receipt");
        assertNotEquals(first,p.disk.get(WORK_GEN));assertEquals("original authenticated receipt",store.loadCompletionReceipt("a".repeat(64)));
        assertEquals(0,cipher.destroyCalls);
    }
    @Test public void interruptedOrdinarySaveRecoversExactOriginalOnRecreatedOwner()throws Exception{
        var cipher=new TestCipher();var p=interruptedWork(cipher);Object original=p.durableDisk.get("authenticated_principal");
        JSONObject e=new JSONObject((String)p.durableDisk.get(WORK_PENDING));char[] clear=cipher.decrypt(new EncryptedSecret(e.getString("ciphertext"),e.getString("iv")));
        String id;try{id=new JSONObject(String.valueOf(clear)).getString("operation_id");}finally{VaultValidation.wipe(clear);}
        int encrypts=cipher.existingKeyEncryptCalls;var next=restarted(p);var store=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);
        assertEquals("{\"original\":true}",store.loadPrincipal());assertEquals(original,next.disk.get("authenticated_principal"));
        assertEquals(id,next.disk.get(WORK_GEN));assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(next.disk,next.durableDisk);
        assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertEquals("original unreadable bytes",next.disk.get("unknown_retained"));
        store.savePrincipal("{\"fresh_after_recovery\":true}");assertEquals("{\"fresh_after_recovery\":true}",store.loadPrincipal());
    }
    @Test public void ordinaryPendingRejectsThirdValueOrOtherRowDrift()throws Exception{
        for(boolean third:new boolean[]{false,true}){
            var cipher=new TestCipher();var next=restarted(interruptedWork(cipher));
            if(third)next.disk.put("authenticated_principal","unknown third ciphertext");else next.disk.put("unknown_retained","changed unknown bytes");
            next.durableDisk=new HashMap<>(next.disk);var before=new HashMap<>(next.disk);
            var store=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);denied(store::loadPrincipal);
            assertEquals(0,next.commits);assertEquals(before,next.disk);assertTrue(next.disk.containsKey(WORK_PENDING));
        }
    }
    @Test public void ordinaryPendingMissingKeyCannotRegenerateOrRemove()throws Exception{
        var next=restarted(interruptedWork(new TestCipher()));var before=new HashMap<>(next.disk);
        CredentialCipher missing=new CredentialCipher(){public EncryptedSecret encrypt(char[] c){throw new AssertionError("no new key");}
            public EncryptedSecret encryptWithExistingKey(char[] c){throw new AssertionError("no new encryption");}
            public char[] decrypt(EncryptedSecret c)throws VaultFailure{throw new VaultFailure("synthetic missing existing key");}
            public void destroyKey(){throw new AssertionError("no retirement");}};
        var store=new AndroidOfflineAuthorityTimeStore(next.object(),missing);denied(store::loadPrincipal);
        assertEquals(0,next.commits);assertEquals(before,next.disk);
    }
    @Test public void ordinaryPendingAndMalformedGenerationBlockOrdinaryAuthority()throws Exception{
        for(String key:new String[]{WORK_PENDING,WORK_GEN})for(Object value:new Object[]{false,17,"malformed"}){
            var p=new Preferences();p.disk.put(key,value);p.durableDisk=new HashMap<>(p.disk);var cipher=new TestCipher();
            var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);denied(store::requireWorkAdmission);denied(store::requireOrdinaryVaultAdmission);
            int encrypts=cipher.existingKeyEncryptCalls;denied(()->store.savePrincipal("{}"));
            assertEquals(0,p.commits);assertEquals(encrypts,cipher.existingKeyEncryptCalls);
            assertFalse(adapter(p).edit().remove(key).commit());assertEquals(value,p.disk.get(key));
        }
    }
    @Test public void failedOrdinaryStageCanRecoverWithoutReplacingOriginal()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"original\":true}");Object original=p.disk.get("authenticated_principal");
        p.fail=true;denied(()->store.savePrincipal("{\"never_entered_body\":true}"));assertTrue(adapter(p).frozen());
        p.fail=false;int encrypts=cipher.existingKeyEncryptCalls;
        assertEquals("{\"original\":true}",store.loadPrincipal());assertEquals(original,p.disk.get("authenticated_principal"));
        assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertFalse(adapter(p).frozen());assertEquals(p.disk,p.durableDisk);
    }
    @Test public void legacySingleRowSaveChangesSameDurableGeneration()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"existing_principal\":true}");Object before=p.disk.get(WORK_GEN);store.saveLegacyRecord("principal","original lineage");
        assertNotEquals(before,p.disk.get(WORK_GEN));assertEquals("original lineage",store.loadLegacyRecord("principal"));
        before=p.disk.get(WORK_GEN);store.saveLegacyRecord("binding:00000000-0000-4000-8000-000000000013","original binding");
        assertNotEquals(before,p.disk.get(WORK_GEN));assertFalse(p.disk.containsKey(WORK_PENDING));assertEquals(p.disk,p.durableDisk);
    }
    @Test public void interruptedLegacySaveRecoversOriginalCiphertextAndAttempt()throws Exception{
        var p=new Preferences();p.disk.put("unrelated_retained","original bytes");p.durableDisk=new HashMap<>(p.disk);
        var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.saveLegacyRecord("principal","original lineage");Object original=p.disk.get("legacy_lineage:principal");
        int bodyCommit=p.commits+2;p.beforeCommit=()->p.persistThenFail=p.commits>=bodyCommit;
        denied(()->store.saveLegacyRecord("principal","candidate lineage"));assertTrue(p.durableDisk.containsKey(WORK_PENDING));
        JSONObject e=new JSONObject((String)p.durableDisk.get(WORK_PENDING));char[] clear=cipher.decrypt(new EncryptedSecret(e.getString("ciphertext"),e.getString("iv")));
        String id;try{id=new JSONObject(String.valueOf(clear)).getString("operation_id");}finally{VaultValidation.wipe(clear);}
        int encrypts=cipher.existingKeyEncryptCalls;var next=restarted(p);var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);
        assertEquals("original lineage",recreated.loadLegacyRecord("principal"));assertEquals(original,next.disk.get("legacy_lineage:principal"));
        assertEquals(id,next.disk.get(WORK_GEN));assertEquals(encrypts,cipher.existingKeyEncryptCalls);
        assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals("original bytes",next.disk.get("unrelated_retained"));assertEquals(next.disk,next.durableDisk);
    }
    @Test public void heldLegacySaveCannotEncryptOrReplaceOriginal()throws Exception{
        var p=new Preferences();p.disk.put(WORK_PENDING,"unreadable retained attempt");p.durableDisk=new HashMap<>(p.disk);
        var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);int encrypts=cipher.existingKeyEncryptCalls;
        denied(()->store.saveLegacyRecord("principal","replacement"));denied(()->store.saveLegacyRecord("not-an-owning-key","replacement"));
        assertEquals(0,p.commits);assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertEquals(p.disk,p.durableDisk);
    }
    @Test public void existingSingleRowDeletesChangeDurableGeneration()throws Exception{
        var p=new Preferences();p.disk.put("other_retained","original bytes");p.durableDisk=new HashMap<>(p.disk);
        var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.saveCompletionReceipt("a".repeat(64),"original receipt");Object before=p.disk.get(WORK_GEN);
        store.deleteCompletionReceipt("a".repeat(64));assertNull(store.loadCompletionReceipt("a".repeat(64)));
        assertNotEquals(before,p.disk.get(WORK_GEN));assertEquals("original bytes",p.disk.get("other_retained"));
        store.saveRollbackFence(new OfflineAuthorityTime.RollbackFence("synthetic-device","00000000-0000-4000-8000-000000000014"));
        before=p.disk.get(WORK_GEN);store.deleteRollbackFence();assertNull(store.loadRollbackFence());
        assertNotEquals(before,p.disk.get(WORK_GEN));assertFalse(p.disk.containsKey(WORK_PENDING));assertEquals(p.disk,p.durableDisk);
    }
    @Test public void interruptedReceiptDeletionRestoresSameOriginalAndAttempt()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.saveCompletionReceipt("a".repeat(64),"original receipt");Object original=p.disk.get("authenticated_completion_receipt_sha256:"+"a".repeat(64));
        int bodyCommit=p.commits+2;p.beforeCommit=()->p.persistThenFail=p.commits>=bodyCommit;
        denied(()->store.deleteCompletionReceipt("a".repeat(64)));assertTrue(p.durableDisk.containsKey(WORK_PENDING));
        JSONObject e=new JSONObject((String)p.durableDisk.get(WORK_PENDING));char[] clear=cipher.decrypt(new EncryptedSecret(e.getString("ciphertext"),e.getString("iv")));
        String id;try{JSONObject record=new JSONObject(String.valueOf(clear));assertEquals("custodial.native-work-original-delete-attempt.v1",record.getString("schema"));id=record.getString("operation_id");}finally{VaultValidation.wipe(clear);}
        int encrypts=cipher.existingKeyEncryptCalls;var next=restarted(p);var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);
        assertEquals("original receipt",recreated.loadCompletionReceipt("a".repeat(64)));
        assertEquals(original,next.disk.get("authenticated_completion_receipt_sha256:"+"a".repeat(64)));
        assertEquals(id,next.disk.get(WORK_GEN));assertEquals(encrypts,cipher.existingKeyEncryptCalls);
        assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(p.durableDisk.get("authenticated_principal"),next.disk.get("authenticated_principal"));
    }
    @Test public void originalDeleteCannotWidenTargetsOrCrossHold()throws Exception{
        denied(()->NativeWorkOriginalWriteAttempt.prepare(Map.of("authenticated_principal","original"),"authenticated_principal","original",null));
        var p=new Preferences();p.disk.put(WORK_PENDING,"unreadable original");p.durableDisk=new HashMap<>(p.disk);
        var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        denied(()->store.deleteCompletionReceipt("a".repeat(64)));denied(store::deleteRollbackFence);
        assertEquals(0,p.commits);assertEquals(0,cipher.existingKeyEncryptCalls);assertEquals(p.disk,p.durableDisk);assertEquals(0,cipher.destroyCalls);
    }
    private static final String PAIR_SESSION="original-pair-session",PAIR_SUFFIX=pairSuffix();
    private static String pairSuffix(){try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(PAIR_SESSION.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception error){throw new AssertionError(error);}}
    private static final String PAIR_KEY="offline_occurrence_sha256:"+PAIR_SUFFIX,PAIR_PROOF="offline_finish_proof_sha256:"+PAIR_SUFFIX;
    private static Preferences occurrencePairPreferences()throws Exception{
        var p=new Preferences();p.disk.put(PAIR_KEY,"exact original occurrence ciphertext");p.disk.put(PAIR_PROOF,"exact original finish ciphertext");
        p.disk.put("other_retained","unrelated original bytes");p.disk.put(WORK_GEN,"00000000-0000-4000-8000-000000000081");
        p.durableDisk=new HashMap<>(p.disk);return p;
    }
    private static Preferences interruptedOccurrencePair(TestCipher cipher)throws Exception{
        var p=occurrencePairPreferences();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        p.beforeCommit=()->p.persistThenFail=p.commits>=2;denied(()->store.deleteOccurrence(PAIR_SESSION));
        assertTrue(p.durableDisk.containsKey(WORK_PENDING));return p;
    }
    @Test public void occurrencePairDeletionChangesOneGeneration()throws Exception{
        var p=occurrencePairPreferences();var cipher=new TestCipher();Object generation=p.disk.get(WORK_GEN);
        new AndroidOfflineAuthorityTimeStore(p.object(),cipher).deleteOccurrence(PAIR_SESSION);
        assertFalse(p.disk.containsKey(PAIR_KEY));assertFalse(p.disk.containsKey(PAIR_PROOF));assertNotEquals(generation,p.disk.get(WORK_GEN));
        assertEquals(2,p.commits);assertFalse(p.disk.containsKey(WORK_PENDING));assertEquals(p.disk,p.durableDisk);
        assertEquals("unrelated original bytes",p.disk.get("other_retained"));assertEquals(0,cipher.destroyCalls);
    }
    @Test public void interruptedOccurrencePairRestoresOriginalsOnRecreatedOwner()throws Exception{
        for(int shape=0;shape<3;shape++){
            var cipher=new TestCipher();var interrupted=interruptedOccurrencePair(cipher);var next=restarted(interrupted);
            if(shape>=1)next.disk.remove(PAIR_KEY);if(shape==2)next.disk.remove(PAIR_PROOF);
            next.durableDisk=new HashMap<>(next.disk);JSONObject envelope=new JSONObject((String)next.disk.get(WORK_PENDING));
            char[] clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            String id;try{JSONObject journal=new JSONObject(String.valueOf(clear));assertEquals("custodial.native-work-original-occurrence-delete-attempt.v1",journal.getString("schema"));id=journal.getString("operation_id");}finally{VaultValidation.wipe(clear);}
            int encrypts=cipher.existingKeyEncryptCalls;var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);
            assertNull(recreated.loadPrincipal());recreated.requireWorkAdmission();
            assertEquals("exact original occurrence ciphertext",next.disk.get(PAIR_KEY));assertEquals("exact original finish ciphertext",next.disk.get(PAIR_PROOF));
            assertEquals(id,next.disk.get(WORK_GEN));assertEquals(encrypts,cipher.existingKeyEncryptCalls);
            assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(1,next.commits);assertEquals(next.disk,next.durableDisk);
        }
    }
    @Test public void occurrencePairRejectsForeignProofOrUnrelatedDrift()throws Exception{
        for(String key:new String[]{PAIR_KEY,PAIR_PROOF,"other_retained",WORK_GEN}){
            var cipher=new TestCipher();var next=restarted(interruptedOccurrencePair(cipher));next.disk.put(key,"foreign changed bytes");
            next.durableDisk=new HashMap<>(next.disk);var before=new HashMap<>(next.disk);
            denied(()->new AndroidOfflineAuthorityTimeStore(next.object(),cipher).loadPrincipal());
            assertEquals(before,next.disk);assertEquals(0,next.commits);assertTrue(next.disk.containsKey(WORK_PENDING));
        }
    }
    @Test public void occurrencePairCannotWidenKeysOrUseMalformedJournal()throws Exception{
        var raw=occurrencePairPreferences().disk;
        var attempt=NativeWorkOriginalWriteAttempt.prepareOccurrenceDelete(raw,PAIR_KEY,PAIR_PROOF);
        for(String field:new String[]{"proof_key","original_proof_wire_sha256","candidate_wire"}){
            JSONObject altered=attempt.encode().put(field,"changed");denied(()->NativeWorkOriginalWriteAttempt.decode(altered));}
        denied(()->NativeWorkOriginalWriteAttempt.decode(attempt.encode().put("extra","not allowed")));
        denied(()->NativeWorkOriginalWriteAttempt.prepareOccurrenceDelete(raw,PAIR_KEY,"offline_finish_proof_sha256:"+"b".repeat(64)));
        denied(()->NativeWorkOriginalWriteAttempt.prepareOccurrenceDelete(Map.of("authenticated_principal","original"),"authenticated_principal",PAIR_PROOF));
        var p=occurrencePairPreferences();p.disk.put(WORK_PENDING,"unreadable pending");p.durableDisk=new HashMap<>(p.disk);var cipher=new TestCipher();
        denied(()->new AndroidOfflineAuthorityTimeStore(p.object(),cipher).deleteOccurrence(PAIR_SESSION));assertEquals(0,p.commits);assertEquals(0,cipher.existingKeyEncryptCalls);
    }
    @Test public void absentOccurrencePairIsNoopButOrphanProofIsJournaled()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.deleteOccurrence(PAIR_SESSION);assertEquals(0,p.commits);assertEquals(0,cipher.existingKeyEncryptCalls);
        p.disk.put(PAIR_PROOF,"original orphan finish ciphertext");p.durableDisk=new HashMap<>(p.disk);
        p.beforeCommit=()->p.persistThenFail=p.commits>=2;denied(()->store.deleteOccurrence(PAIR_SESSION));
        var next=restarted(p);assertNull(new AndroidOfflineAuthorityTimeStore(next.object(),cipher).loadPrincipal());
        assertFalse(next.disk.containsKey(PAIR_KEY));assertEquals("original orphan finish ciphertext",next.disk.get(PAIR_PROOF));assertFalse(next.disk.containsKey(WORK_PENDING));
    }
    private static String quarantineSource(String purpose){return "ANCHOR".equals(purpose)?"offline_authority_anchor":"SCAN".equals(purpose)?"offline_scan_entries":"native_nfc_handoffs";}
    private static Preferences unreadableSource(String purpose){var p=new Preferences();p.disk.put(quarantineSource(purpose),"original unreadable envelope");p.disk.put("other_retained","original bytes");p.durableDisk=new HashMap<>(p.disk);return p;}
    private static void preserve(AndroidOfflineAuthorityTimeStore store,String purpose)throws Exception{
        if("ANCHOR".equals(purpose))assertTrue(store.preserveUnreadableAuthorityAnchor("KIOSK_08","2026-10-11T12:00:00.000Z"));
        else if("SCAN".equals(purpose))store.preserveUnreadableScanJournal("synthetic corrupt source");
        else store.loadNfcHandoffsForPhysicalRead();
    }
    @Test public void quarantineWritersPreserveSourcesAndAdvanceGeneration()throws Exception{
        for(String purpose:new String[]{"ANCHOR","SCAN","NFC"}){var p=unreadableSource(purpose);var cipher=new TestCipher();
            preserve(new AndroidOfflineAuthorityTimeStore(p.object(),cipher),purpose);
            assertEquals("original unreadable envelope",p.disk.get(quarantineSource(purpose)));assertEquals("original bytes",p.disk.get("other_retained"));
            assertTrue(p.disk.get(WORK_GEN) instanceof String);assertFalse(p.disk.containsKey(WORK_PENDING));assertEquals(2,p.commits);assertEquals(p.disk,p.durableDisk);assertEquals(0,cipher.destroyCalls);}
    }
    private static Preferences interruptedQuarantine(TestCipher cipher,String purpose)throws Exception{
        var p=unreadableSource(purpose);p.beforeCommit=()->p.persistThenFail=p.commits>=2;
        denied(()->preserve(new AndroidOfflineAuthorityTimeStore(p.object(),cipher),purpose));assertTrue(p.durableDisk.containsKey(WORK_PENDING));return p;
    }
    @Test public void interruptedQuarantineRestoresOriginalNamespace()throws Exception{
        for(String purpose:new String[]{"ANCHOR","SCAN","NFC"}){var cipher=new TestCipher();var p=interruptedQuarantine(cipher,purpose);var next=restarted(p);
            JSONObject e=new JSONObject((String)next.disk.get(WORK_PENDING));char[] clear=cipher.decrypt(new EncryptedSecret(e.getString("ciphertext"),e.getString("iv")));
            String id;try{JSONObject journal=new JSONObject(String.valueOf(clear));assertEquals("custodial.native-work-original-preservation-attempt.v1",journal.getString("schema"));assertEquals(purpose,journal.getString("purpose"));id=journal.getString("operation_id");}finally{VaultValidation.wipe(clear);}
            int encrypts=cipher.existingKeyEncryptCalls;assertNull(new AndroidOfflineAuthorityTimeStore(next.object(),cipher).loadPrincipal());
            assertEquals(3,next.disk.size());assertEquals("original unreadable envelope",next.disk.get(quarantineSource(purpose)));assertEquals("original bytes",next.disk.get("other_retained"));
            assertEquals(id,next.disk.get(WORK_GEN));assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertEquals(next.disk,next.durableDisk);}
    }
    @Test public void quarantineCannotAdoptChangedSourceOrForeignRows()throws Exception{
        for(String purpose:new String[]{"ANCHOR","SCAN","NFC"})for(String key:new String[]{quarantineSource(purpose),"other_retained"}){
            var cipher=new TestCipher();var next=restarted(interruptedQuarantine(cipher,purpose));next.disk.put(key,"changed foreign bytes");next.durableDisk=new HashMap<>(next.disk);var original=new HashMap<>(next.disk);
            denied(()->new AndroidOfflineAuthorityTimeStore(next.object(),cipher).loadPrincipal());assertEquals(0,next.commits);assertEquals(original,next.disk);}
    }
    @Test public void quarantineSchemaCannotWidenToDispositionOrDeletion()throws Exception{
        var raw=unreadableSource("SCAN").disk;String record="offline_scan_journal_quarantine_record:00000000-0000-4000-8000-000000000092";
        String digest=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest("original unreadable envelope".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        String meta=new JSONObject().put("source_key","offline_scan_entries").put("source_sha256",digest).put("quarantine_key",record).toString();
        var candidate=Map.of(record,"original unreadable envelope","offline_scan_journal_quarantine_active",meta);
        var attempt=NativeWorkOriginalWriteAttempt.preparePreservation(raw,"SCAN",candidate);
        denied(()->NativeWorkOriginalWriteAttempt.preparePreservation(raw,"DISPOSITION",candidate));
        denied(()->NativeWorkOriginalWriteAttempt.preparePreservation(raw,"SCAN",Map.of(record,"other ciphertext","offline_scan_journal_quarantine_active",meta)));
        denied(()->NativeWorkOriginalWriteAttempt.decode(attempt.encode().put("extra","not allowed")));
        JSONObject deletion=attempt.encode();deletion.getJSONArray("rows").getJSONObject(0).put("candidate_wire",JSONObject.NULL);
        denied(()->NativeWorkOriginalWriteAttempt.decode(deletion));
    }
    @Test public void existingQuarantineMetadataRemainsOriginal()throws Exception{
        var p=unreadableSource("ANCHOR");var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);preserve(store,"ANCHOR");
        String metadataKey=p.disk.keySet().stream().filter(k->k.startsWith("offline_authority_anchor_quarantine_metadata:")).findFirst().orElseThrow();
        Object metadata=p.disk.get(metadataKey);assertTrue(store.preserveUnreadableAuthorityAnchor("KIOSK_08","2026-10-11T13:00:00.000Z"));
        assertEquals(metadata,p.disk.get(metadataKey));assertEquals(p.disk,p.durableDisk);
        int commits=p.commits;denied(()->store.preserveUnreadableAuthorityAnchor("KIOSK_09","2026-10-11T13:00:00.000Z"));assertEquals(commits,p.commits);
        p.disk.put(metadataKey,"unreadable original metadata");p.durableDisk=new HashMap<>(p.disk);var before=new HashMap<>(p.disk);
        denied(()->store.preserveUnreadableAuthorityAnchor("KIOSK_08","2026-10-11T13:00:00.000Z"));assertEquals(before,p.disk);assertEquals(commits,p.commits);
    }
    private static final String SCAN_RECOVERY="00000000-0000-4000-8000-000000000094",SCAN_RECORD="offline_scan_journal_quarantine_record:"+SCAN_RECOVERY,SCAN_ACTIVE="offline_scan_journal_quarantine_active",SCAN_LATEST="offline_scan_journal_disposition_latest";
    private static Preferences preservedScanFixture()throws Exception{
        var p=unreadableSource("SCAN");String source=(String)p.disk.get("offline_scan_entries");
        String digest=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(source.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        JSONObject metadata=new JSONObject().put("schema_version","custodial-scan-journal-quarantine.v1").put("state","CORRUPTED").put("preserved",true).put("manager_recovery_required",true)
            .put("recovery_id",SCAN_RECOVERY).put("source_key","offline_scan_entries").put("source_sha256",digest).put("quarantine_key",SCAN_RECORD)
            .put("reason","synthetic corrupt source").put("preserved_at","2026-10-11T12:00:00.000Z");
        p.disk.put(SCAN_RECORD,source);p.disk.put(SCAN_ACTIVE,metadata.toString());p.durableDisk=new HashMap<>(p.disk);return p;
    }
    private static void resolve(AndroidOfflineAuthorityTimeStore store)throws Exception{store.resolvePreservedScanJournal("00000000-0000-4000-8000-000000000095","KIOSK_08","2026-10-11T13:00:00.000Z");}
    @Test public void scanDispositionCommitsSameFourRowOperation()throws Exception{
        var p=preservedScanFixture();Object original=p.disk.get(SCAN_RECORD);var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);resolve(store);
        assertEquals(2,p.commits);assertTrue(p.disk.containsKey(WORK_GEN));assertFalse(p.disk.containsKey(WORK_PENDING));assertFalse(p.disk.containsKey(SCAN_ACTIVE));
        assertEquals(original,p.disk.get(SCAN_RECORD));assertEquals(p.disk.get(SCAN_LATEST),p.disk.get("offline_scan_journal_disposition:"+SCAN_RECOVERY));
        assertEquals("RESOLVED",store.loadLatestScanJournalDisposition().get("state"));assertTrue(store.loadScanEntries().isEmpty());assertEquals(p.disk,p.durableDisk);assertEquals(0,cipher.destroyCalls);
    }
    private static Preferences interruptedDisposition(TestCipher cipher)throws Exception{
        var p=preservedScanFixture();p.beforeCommit=()->p.persistThenFail=p.commits>=2;
        denied(()->resolve(new AndroidOfflineAuthorityTimeStore(p.object(),cipher)));assertTrue(p.durableDisk.containsKey(WORK_PENDING));return p;
    }
    @Test public void interruptedDispositionCannotLookResolvedOnRecreatedOwner()throws Exception{
        var cipher=new TestCipher();var original=interruptedDisposition(cipher);var next=restarted(original);int encrypts=cipher.existingKeyEncryptCalls;
        var store=new AndroidOfflineAuthorityTimeStore(next.object(),cipher);assertTrue(store.loadLatestScanJournalDisposition().isEmpty());assertFalse(next.disk.containsKey(SCAN_LATEST));
        assertEquals(original.durableDisk.get("offline_scan_entries"),next.disk.get("offline_scan_entries"));assertEquals(original.durableDisk.get(SCAN_ACTIVE),next.disk.get(SCAN_ACTIVE));
        assertEquals(original.durableDisk.get(SCAN_RECORD),next.disk.get(SCAN_RECORD));assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertEquals(1,next.commits);
        assertFalse(next.disk.containsKey(WORK_PENDING));assertEquals(next.disk,next.durableDisk);denied(store::loadScanEntries);
    }
    @Test public void dispositionRefusesForeignSourceOrUnknownHistoricalPointer()throws Exception{
        for(String key:new String[]{"offline_scan_entries",SCAN_RECORD,SCAN_LATEST}){
            var p=preservedScanFixture();p.disk.put(key,"foreign unknown bytes");p.durableDisk=new HashMap<>(p.disk);var before=new HashMap<>(p.disk);var cipher=new TestCipher();
            denied(()->resolve(new AndroidOfflineAuthorityTimeStore(p.object(),cipher)));assertEquals(0,p.commits);assertEquals(0,cipher.existingKeyEncryptCalls);assertEquals(before,p.disk);}
    }
    @Test public void dispositionPendingRefusesForeignCandidateOrSource()throws Exception{
        for(String key:new String[]{"offline_scan_entries",SCAN_ACTIVE,SCAN_RECORD,SCAN_LATEST}){
            var cipher=new TestCipher();var next=restarted(interruptedDisposition(cipher));next.disk.put(key,"foreign outcome bytes");next.durableDisk=new HashMap<>(next.disk);var before=new HashMap<>(next.disk);
            denied(()->new AndroidOfflineAuthorityTimeStore(next.object(),cipher).loadLatestScanJournalDisposition());assertEquals(before,next.disk);assertEquals(0,next.commits);assertTrue(next.disk.containsKey(WORK_PENDING));}
    }
    @Test public void stagedEditorCannotCrossPendingCheckCancellation()throws Exception{
        Preferences p=new Preferences();p.disk.put("occurrence","original");
        var a=adapter(p);var stale=a.edit().putString("occurrence","old-staged-replacement");
        var original=a.protectedSnapshot();a.prepareProbe(original,"exact-pending");a.cancelProbe(original,"exact-pending");
        assertFalse(a.frozen());int commits=p.commits;
        assertFalse(stale.commit());assertEquals(commits,p.commits);assertEquals("original",p.disk.get("occurrence"));
        assertTrue(a.edit().putString("occurrence","fresh-after-cancellation").commit());
        assertEquals("fresh-after-cancellation",p.disk.get("occurrence"));
    }
    @Test public void stagedEditorCannotCrossOrdinaryAbaOrBeReused()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var b=adapter(p);
        assertTrue(a.edit().putString("occurrence","A").commit());
        var stale=b.edit().putString("occurrence","stale");
        assertTrue(a.edit().putString("occurrence","B").commit());assertTrue(a.edit().putString("occurrence","A").commit());
        int commits=p.commits;assertFalse(stale.commit());assertEquals(commits,p.commits);assertEquals("A",p.disk.get("occurrence"));
        var current=b.edit().putString("occurrence","new");assertTrue(current.commit());
        commits=p.commits;assertFalse(current.putString("occurrence","reused").commit());
        assertEquals(commits,p.commits);assertEquals("new",p.disk.get("occurrence"));
    }
    @Test public void failedOrdinaryCommitInvalidatesOtherStagedEditors()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var stale=a.edit().putString("receipt","stale");
        p.fail=true;assertFalse(a.edit().putString("other","attempted").commit());p.fail=false;
        int commits=p.commits;assertFalse(stale.commit());assertEquals(commits,p.commits);assertFalse(p.disk.containsKey("receipt"));
        assertTrue(a.edit().putString("receipt","fresh").commit());assertEquals("fresh",p.disk.get("receipt"));
    }
    @Test public void normalExactWritesRemainAvailableBeforeFence(){
        Preferences p=new Preferences();var a=adapter(p);
        assertTrue(a.edit().putString("occurrence","original").putLong("number",4L).commit());
        assertEquals("original",a.getString("occurrence",null));assertEquals(4,a.getLong("number",0));assertFalse(a.frozen());
        assertTrue(a.edit().remove("number").commit());assertEquals(2,p.commits);assertEquals(0,p.applies);assertEquals(0,p.clears);
    }
    @Test public void exactFreezeRetainsOriginalBytesAndOldStagedEditorCannotCommit()throws Exception{
        Preferences p=new Preferences();p.disk.put("occurrence","unreadable-original-ciphertext");
        var a=adapter(p);var b=adapter(p);var original=a.protectedSnapshot();var stale=b.edit().putString("occurrence","overwrite");
        a.freeze(original,"protected-context-fixture");assertEquals(1,p.commits);assertTrue(b.frozen());
        assertFalse(stale.commit());assertFalse(b.edit().remove("occurrence").commit());assertFalse(b.edit().putString("new-occurrence","new").commit());
        assertEquals("unreadable-original-ciphertext",p.disk.get("occurrence"));assertEquals(2,p.disk.size());
        b.freeze(original,"protected-context-fixture");assertEquals(2,p.commits); // Recommit identical fence, never replace original records.
        denied(()->b.freeze(original,"different-context"));assertEquals(2,p.commits);
    }
    @Test public void changedSnapshotNeverFreezesStaleInventory()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var before=a.protectedSnapshot();
        assertTrue(adapter(p).edit().putString("pending","new protected work").commit());
        denied(()->a.freeze(before,"context"));assertFalse(a.frozen());assertEquals(1,p.commits);
        a.freeze(a.protectedSnapshot(),"context");assertTrue(a.frozen());assertEquals("new protected work",p.disk.get("pending"));
    }
    @Test public void failedAndAmbiguousCommitRetainBytesAndExactRetry()throws Exception{
        for(boolean ambiguous:new boolean[]{false,true}){
            Preferences p=new Preferences();p.disk.put("draft","original");var a=adapter(p);var before=a.protectedSnapshot();
            p.fail=!ambiguous;p.persistThenFail=ambiguous;denied(()->a.freeze(before,"context"));
            assertEquals("original",p.disk.get("draft"));assertEquals(ambiguous,a.frozen());
            p.fail=false;p.persistThenFail=false;adapter(p).freeze(before,"context");assertTrue(a.frozen());
            assertEquals(2,p.commits);assertEquals(0,p.clears);
        }
    }
    @Test public void corruptReadbackPreservesUnknownAndDoesNotAcknowledge()throws Exception{
        Preferences p=new Preferences();p.disk.put("draft","original");var a=adapter(p);var before=a.protectedSnapshot();
        p.corruptReadback=true;denied(()->a.freeze(before,"context"));assertTrue(a.frozen());
        assertEquals("original",p.disk.get("draft"));assertEquals("unknown preserved bytes",p.disk.get("stray"));
        denied(()->adapter(p).freeze(before,"context"));assertEquals(1,p.commits);
    }
    @Test public void malformedExistingFenceStillBlocksAndCannotBeRemoved(){
        Preferences p=new Preferences();p.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,7);
        var a=adapter(p);assertTrue(a.frozen());assertFalse(a.edit().remove(AndroidProtectedWorkPreferences.FENCE_KEY).commit());
        assertFalse(a.edit().putString("new","work").commit());assertEquals(7,p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));assertEquals(0,p.commits);
    }
    @Test public void ordinaryEditorCannotMintFenceClearOrApply(){
        Preferences p=new Preferences();var a=adapter(p);
        assertFalse(a.edit().putString(AndroidProtectedWorkPreferences.FENCE_KEY,"forged").commit());assertFalse(a.edit().clear().commit());
        try{a.edit().putString("draft","x").apply();fail();}catch(IllegalStateException expected){}
        assertTrue(p.disk.isEmpty());assertEquals(0,p.commits);assertEquals(0,p.clears);assertEquals(0,p.applies);
    }
    @Test public void snapshotAndSetCopiesCannotMutateOriginalStore(){
        Preferences p=new Preferences();p.disk.put("set",new HashSet<>(Set.of("original")));var a=adapter(p);
        try{a.protectedSnapshot().clear();fail();}catch(UnsupportedOperationException expected){}
        a.getStringSet("set",null).clear();assertEquals(Set.of("original"),p.disk.get("set"));
    }
    @Test public void actualOfflineStoreAllInstancesRespectFenceWithoutDeletingSavedWork()throws Exception{
        Preferences p=new Preferences();TestCipher cipher=new TestCipher();
        var first=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);var second=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        first.savePrincipal("{\"synthetic\":\"original principal\"}");first.saveCompletionReceipt("a".repeat(64),"exact original receipt");
        first.saveLegacyRecord("principal","exact original legacy record");var original=new HashMap<>(p.disk);
        var gate=adapter(p);gate.freeze(gate.protectedSnapshot(),"protected context fixture");int count=p.commits;
        denied(()->second.savePrincipal("{\"synthetic\":\"replacement\"}"));
        denied(()->second.saveCompletionReceipt("b".repeat(64),"new receipt"));
        denied(()->second.deleteCompletionReceipt("a".repeat(64)));
        denied(()->second.saveLegacyRecord("principal","replacement"));
        for(var entry:original.entrySet())assertEquals(entry.getValue(),p.disk.get(entry.getKey()));assertEquals(count,p.commits);
        assertEquals("exact original receipt",second.loadCompletionReceipt("a".repeat(64)));
        assertEquals("exact original legacy record",second.loadLegacyRecord("principal"));assertEquals(0,cipher.destroyCalls);
    }
    @Test public void differentInstancesSerializeInFlightCommitAndFreeze()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var b=adapter(p);var prior=a.protectedSnapshot();
        CountDownLatch inCommit=new CountDownLatch(1),release=new CountDownLatch(1),attempted=new CountDownLatch(1);
        p.beforeCommit=()->{inCommit.countDown();if(!release.await(2,TimeUnit.SECONDS))throw new AssertionError("bounded release");};
        var pool=Executors.newFixedThreadPool(2);
        try{
            var writer=pool.submit(()->a.edit().putString("occurrence","arrived first").commit());assertTrue(inCommit.await(2,TimeUnit.SECONDS));
            var freezing=pool.submit(()->{attempted.countDown();denied(()->b.freeze(prior,"context"));return true;});
            assertTrue(attempted.await(2,TimeUnit.SECONDS));assertFalse(freezing.isDone());release.countDown();
            assertTrue(writer.get(2,TimeUnit.SECONDS));assertTrue(freezing.get(2,TimeUnit.SECONDS));assertFalse(a.frozen());
            p.beforeCommit=()->{};b.freeze(b.protectedSnapshot(),"context");assertEquals("arrived first",p.disk.get("occurrence"));
        }finally{release.countDown();pool.shutdownNow();assertTrue(pool.awaitTermination(2,TimeUnit.SECONDS));}
    }
    @Test public void rawCasRejectsDistinctFloatNaNPayloadsAcrossProbeFreezeAndCancel()throws Exception{
        float first=Float.intBitsToFloat(0x7fc00001),second=Float.intBitsToFloat(0x7fc00002);
        Preferences p=new Preferences();p.disk.put("float",first);p.durableDisk=new HashMap<>(p.disk);
        var a=adapter(p);Map<String,?> stale=a.protectedSnapshot();
        assertFalse(NativeProtectedWorkSnapshot.exactRawEquals(stale,Map.of("float",second)));
        p.disk.put("float",second);p.durableDisk=new HashMap<>(p.disk);
        denied(()->a.prepareProbe(stale,"pending"));denied(()->a.freeze(stale,"context"));
        Map<String,?> current=a.protectedSnapshot();a.prepareProbe(current,"pending");
        denied(()->a.cancelProbe(stale,"pending"));
        assertEquals("pending",p.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertEquals(0x7fc00002,Float.floatToRawIntBits((Float)p.disk.get("float")));
    }

    @Test public void failedVaultCommitCannotPromoteVolatileStateAndFreshRestartSeesDurableTruth()throws Exception{
        Preferences p=new Preferences();SharedPreferencesVaultPersistence storage=
            new SharedPreferencesVaultPersistence(p.object(),new VaultSnapshotCodec());
        VaultSnapshot current=VaultSnapshot.empty();
        VaultSnapshot next=current.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,
            EnrollmentMetadata.empty(),"","",false,"");
        p.persistThenFail=true;
        try{storage.commit(current.revision,next);fail();}catch(VaultFailure expected){
            assertEquals("custodial_native_vault_commit_failed",expected.code);
        }
        assertTrue(p.durableDisk.isEmpty());
        try{storage.load();fail();}catch(VaultFailure expected){
            assertEquals("custodial_native_vault_durability_unconfirmed",expected.code);
        }
        Preferences restarted=new Preferences();restarted.disk=new HashMap<>(p.durableDisk);restarted.durableDisk=new HashMap<>(p.durableDisk);
        assertEquals(current,new SharedPreferencesVaultPersistence(restarted.object(),new VaultSnapshotCodec()).load());
        p.persistThenFail=false;storage.commit(current.revision,next);
        assertEquals(next,storage.load());assertFalse(p.durableDisk.isEmpty());
    }

    static final String DEVICE="KIOSK_08", SNAPSHOT="a".repeat(64), SESSION="22222222-2222-4222-8222-222222222222", ENTRY="33333333-3333-4333-8333-333333333333";
    static final String GENERATED="2026-09-27T08:00:00.000Z", EXPIRY="2026-09-27T09:00:00.000Z";
    static final class WorkFixture {
        final Preferences p=new Preferences();final TestCipher cipher=new TestCipher();
        final AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        Hook clockRead=()->{};
        final OfflineAuthorityTime time=new OfflineAuthorityTime(store,new OfflineAuthorityTime.MonotonicClock(){
            public long now(){try{clockRead.run();}catch(Exception e){throw new IllegalStateException(e);}return 1000;}
            public int bootCount(){return 7;}
        });
        WorkFixture()throws Exception{time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY);time.authorizeNewWork(DEVICE,SNAPSHOT);}
        void freeze()throws Exception{var gate=adapter(p);gate.freeze(gate.protectedSnapshot(),"protected context fixture");}
    }
    @Test public void frozenAnchorCannotAuthorizeByNoWriteRetryAndRetainsReadOnlyEvidence()throws Exception{
        for(boolean malformed:new boolean[]{false,true}){
            var f=new WorkFixture();var before=new HashMap<>(f.p.disk);
            if(malformed)f.p.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,7);else f.freeze();
            int commits=f.p.commits;
            denied(()->f.time.authorizeNewWork(DEVICE,SNAPSHOT));
            denied(()->f.time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY));
            var restarted=new OfflineAuthorityTime(new AndroidOfflineAuthorityTimeStore(f.p.object(),f.cipher),new OfflineAuthorityTime.MonotonicClock(){public long now(){return 1000;}public int bootCount(){return 7;}});
            denied(()->restarted.authorizeNewWork(DEVICE,SNAPSHOT));
            assertNotNull(f.store.loadAnchor());assertNotNull(f.time.providerObservation(DEVICE));
            for(var e:before.entrySet())assertEquals(e.getValue(),f.p.disk.get(e.getKey()));assertEquals(commits,f.p.commits);
        }
    }
    @Test public void frozenExactStartAndFinishRetriesCannotReturnOrdinaryWorkAuthority()throws Exception{
        var f=new WorkFixture();String started=f.time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);
        f.time.completeOccurrenceFromScan(DEVICE,"TETM",SESSION,started,ENTRY,true);
        var before=new HashMap<>(f.p.disk);f.freeze();int commits=f.p.commits;
        denied(()->f.time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT));
        denied(()->f.time.completeOccurrence(DEVICE,"TETM",SESSION,started));
        denied(()->f.time.completeOccurrenceFromScan(DEVICE,"TETM",SESSION,started,ENTRY,true));
        assertNotNull(f.store.loadOccurrence(SESSION));
        for(var e:before.entrySet())assertEquals(e.getValue(),f.p.disk.get(e.getKey()));assertEquals(commits,f.p.commits);
    }
    @Test public void fenceArrivingDuringReadOnlyAdmissionCannotEscapeThroughCachedSuccess()throws Exception{
        for(boolean authorize:new boolean[]{false,true}){
            var f=new WorkFixture();f.clockRead=()->{f.clockRead=()->{};f.freeze();};
            if(authorize)denied(()->f.time.authorizeNewWork(DEVICE,SNAPSHOT));
            else denied(()->f.time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY));
            assertTrue(adapter(f.p).frozen());assertNotNull(f.store.loadAnchor());assertEquals(0,f.cipher.destroyCalls);
        }
    }
    @Test public void retryMustEstablishDurabilityAfterFailedCommitChangedOnlyMemory()throws Exception{
        var p=new Preferences();var a=adapter(p);assertTrue(a.edit().putString("draft","original").commit());
        var before=a.protectedSnapshot();p.persistThenFail=true;denied(()->a.freeze(before,"context"));
        assertTrue(a.frozen());assertFalse(p.durableDisk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        p.persistThenFail=false;adapter(p).freeze(before,"context");
        // A successful retry must survive a new process, not just see old volatile bytes.
        p.disk=new HashMap<>(p.durableDisk);assertTrue(adapter(p).frozen());assertEquals("original",p.disk.get("draft"));
    }
    static NativeSeparationEvidence proof(Map<String,?> original)throws Exception{
        char[] secret=NativeSeparationEvidenceTest.credential();
        try{return NativeSeparationEvidence.sign(NativeSeparationEvidenceTest.context(),NativeProtectedWorkSnapshot.capture(original),secret);}
        finally{VaultValidation.wipe(secret);}
    }
    @Test public void actualStoreFreezesEncryptedSignedSnapshotAndRetainsEveryOriginalByte()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");p.disk.put("unreadable","corrupt protected original");
        var original=store.separationRawSnapshot();var evidence=proof(original);int existing=cipher.existingKeyEncryptCalls;
        store.freezeSeparationSnapshot(original,evidence);assertEquals(existing+1,cipher.existingKeyEncryptCalls);
        String encrypted=(String)p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        assertFalse(encrypted.contains("manifest_body"));assertFalse(encrypted.contains(evidence.signature));
        var restarted=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);restarted.freezeSeparationSnapshot(original,evidence);
        assertEquals(encrypted,p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));assertEquals(existing+1,cipher.existingKeyEncryptCalls);
        denied(()->restarted.requireWorkAdmission());assertEquals(original.size()+1,p.disk.size());
        for(var entry:original.entrySet())assertEquals(entry.getValue(),p.disk.get(entry.getKey()));assertEquals(0,cipher.destroyCalls);
        assertTrue(restarted.separationRawSnapshot().containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
    }
    @Test public void signedSnapshotMismatchInterveningWriterAndMissingKeyCannotFreezeWrongWork()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");var original=store.separationRawSnapshot();var evidence=proof(original);
        denied(()->store.freezeSeparationSnapshot(Map.of("other","wrong"),evidence));assertFalse(adapter(p).frozen());
        store.savePrincipal("{\"new\":true}");denied(()->store.freezeSeparationSnapshot(original,evidence));assertFalse(adapter(p).frozen());
        var captured=store.separationRawSnapshot();var signed=proof(captured);cipher.existingKeyUnavailable=true;
        denied(()->store.freezeSeparationSnapshot(captured,signed));
        assertFalse(adapter(p).frozen());assertEquals(0,cipher.destroyCalls);
    }
    @Test public void signedFreezeRetryReusesExactCiphertextAndEstablishesDurability()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");var original=store.separationRawSnapshot();var evidence=proof(original);p.persistThenFail=true;
        denied(()->store.freezeSeparationSnapshot(original,evidence));String retained=(String)p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        int encryptions=cipher.existingKeyEncryptCalls;p.persistThenFail=false;
        new AndroidOfflineAuthorityTimeStore(p.object(),cipher).freezeSeparationSnapshot(original,evidence);
        assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertEquals(retained,p.durableDisk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
        p.disk=new HashMap<>(p.durableDisk);denied(()->new AndroidOfflineAuthorityTimeStore(p.object(),cipher).requireWorkAdmission());
    }
    @Test public void pendingProbeBlocksEveryOrdinaryWriterAndReservedMutation()throws Exception{
        var p=new Preferences();p.disk.put("draft","exact original saved draft");var a=adapter(p);var b=adapter(p);
        var original=a.protectedSnapshot();var staged=b.edit().putString("draft","overwritten");
        assertFalse(a.edit().putString(AndroidProtectedWorkPreferences.PROBE_KEY,"forged check").commit());
        a.prepareProbe(original,"encrypted pending check");assertTrue(a.frozen());assertTrue(b.frozen());
        assertFalse(staged.commit());assertFalse(b.edit().remove(AndroidProtectedWorkPreferences.PROBE_KEY).commit());
        assertEquals("exact original saved draft",p.disk.get("draft"));assertEquals(p.disk,p.durableDisk);
        denied(()->b.freeze(original,"encrypted final context"));
        b.freeze(original,"encrypted final context","encrypted pending check");
        assertFalse(p.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("encrypted final context",p.durableDisk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
    }
    @Test public void corruptOrChangedProbeCannotBecomeOrdinaryAdmissionOrBeReplaced()throws Exception{
        for(Object value:new Object[]{"unreadable guard",7,null}){
            var p=new Preferences();p.disk.put("work","original");p.disk.put(AndroidProtectedWorkPreferences.PROBE_KEY,value);
            var a=adapter(p);assertTrue(a.frozen());var before=new HashMap<>(p.disk);
            denied(()->a.prepareProbe(Map.of("work","original"),"different pending"));assertEquals(before,p.disk);
            assertFalse(a.edit().putString("ordinary","new work").commit());assertEquals(before,p.disk);
        }
    }

    // Codec DATA only: synthetic file-key text is not a Current, native token or inode proof.
    private static String[] heldCodecFields(){
        return new String[]{"codec-current-key","codec-predecessor-key","1".repeat(64),"2".repeat(64),
            "3".repeat(64),"11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222","4".repeat(64)};
    }
    private static byte[] heldCodecWire(int version,long predecessor,long counter,String...fields)throws Exception{
        var output=new java.io.ByteArrayOutputStream();
        try(var data=new java.io.DataOutputStream(output)){
            data.writeInt(0x4d5a4531);data.writeInt(version);data.writeLong(predecessor);data.writeLong(counter);
            for(String value:fields)data.writeUTF(value);
        }
        output.write(java.security.MessageDigest.getInstance("SHA-256").digest(output.toByteArray()));
        return output.toByteArray();
    }
    private static Object heldCodecRead(byte[] bytes,Object key)throws Exception{
        var type=Class.forName(NativePrivateMutationEpochStore.class.getName()+"$Record");
        var constructor=type.getDeclaredConstructor(byte[].class,Object.class);constructor.setAccessible(true);
        try{return constructor.newInstance(bytes,key);}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof Exception)throw(Exception)failure.getCause();throw(Error)failure.getCause();
        }
    }
    private static Object heldCodecField(Object value,String name)throws Exception{
        var field=value.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(value);
    }
    private static byte[] heldCodecReencode(Object record)throws Exception{
        return(byte[])uidOwnerCall("encodeHeld",new Class<?>[]{NativePrivateMutationEpochStore.HeldOriginal.class},
            heldCodecField(record,"held"));
    }
    private static void heldCodecRefuses(byte[] bytes,Object key)throws Exception{
        byte[] before=bytes.clone();
        try{heldCodecRead(bytes,key);fail("malformed HELD DATA admitted");}
        catch(VaultFailure|java.io.EOFException|java.io.UTFDataFormatException expected){}
        finally{assertArrayEquals("decoder must not alter loan",before,bytes);}
    }
    @Test public void HELD_CODEC_v1AndLegacyV2RemainByteExact()throws Exception{
        byte[] v1=heldCodecWire(1,-1,0);
        Object ordinary=heldCodecRead(v1,"ordinary-key");assertNull(heldCodecField(ordinary,"held"));
        assertArrayEquals(v1,(byte[])uidOwnerCall("encode",new Class<?>[]{long.class},0L));
        String[] fields=heldCodecFields();byte[] v2=heldCodecWire(2,0,1,fields);
        Object record=heldCodecRead(v2,fields[0]);var held=(NativePrivateMutationEpochStore.HeldOriginal)heldCodecField(record,"held");
        assertEquals(0,held.originalCounter);assertNull(held.browserFrameSha256);assertNull(held.browserPartSetSha256);
        assertArrayEquals(v2,heldCodecReencode(record));
        var legacy=NativePrivateMutationEpochStore.HeldOriginal.class.getDeclaredConstructor(long.class,
            String.class,String.class,String.class,String.class,String.class,String.class,String.class,String.class);
        legacy.setAccessible(true);Object old=legacy.newInstance(0L,fields[0],fields[1],fields[2],fields[3],
            fields[4],fields[5],fields[6],fields[7]);
        assertArrayEquals(v2,(byte[])uidOwnerCall("encodeHeld",new Class<?>[]{NativePrivateMutationEpochStore.HeldOriginal.class},old));
    }
    @Test public void HELD_CODEC_v3ExactBrowserPairRoundTrips()throws Exception{
        String[] fields=java.util.Arrays.copyOf(heldCodecFields(),10);fields[8]="5".repeat(64);fields[9]="6".repeat(64);
        byte[] bytes=heldCodecWire(3,7,8,fields),before=bytes.clone();
        Object record=heldCodecRead(bytes,fields[0]);var held=(NativePrivateMutationEpochStore.HeldOriginal)heldCodecField(record,"held");
        assertEquals(7,held.originalCounter);assertEquals(fields[4],held.originalValuesSha256);
        assertEquals(fields[5],held.originalGenerationId);assertEquals(fields[6],held.originalOperationId);
        assertEquals(fields[7],held.originalPlanSha256);assertEquals(fields[8],held.browserFrameSha256);
        assertEquals(fields[9],held.browserPartSetSha256);assertArrayEquals(bytes,heldCodecReencode(record));
        assertArrayEquals(before,bytes);
        String[] other=fields.clone();other[9]="7".repeat(64);
        var otherHeld=(NativePrivateMutationEpochStore.HeldOriginal)heldCodecField(heldCodecRead(heldCodecWire(3,7,8,other),fields[0]),"held");
        assertNotEquals(held.browserPartSetSha256,otherHeld.browserPartSetSha256);
    }
    @Test public void HELD_CODEC_missingOneBadExtraAndLegacyUpgradeRefuse()throws Exception{
        String[] fields=heldCodecFields();
        heldCodecRefuses(heldCodecWire(3,0,1,fields),fields[0]);
        String[] one=java.util.Arrays.copyOf(fields,9);one[8]="5".repeat(64);
        heldCodecRefuses(heldCodecWire(3,0,1,one),fields[0]);
        String[] pair=java.util.Arrays.copyOf(one,10);pair[9]="6".repeat(64);
        for(int index:new int[]{8,9})for(String bad:new String[]{"","A".repeat(64),"a".repeat(63),"g".repeat(64)}){
            String[] changed=pair.clone();changed[index]=bad;
            heldCodecRefuses(heldCodecWire(3,0,1,changed),fields[0]);
        }
        String[] extra=java.util.Arrays.copyOf(pair,11);extra[10]="extra";
        heldCodecRefuses(heldCodecWire(3,0,1,extra),fields[0]);
        heldCodecRefuses(heldCodecWire(2,0,1,pair),fields[0]);
        var ctor=NativePrivateMutationEpochStore.HeldOriginal.class.getDeclaredConstructor(long.class,
            String.class,String.class,String.class,String.class,String.class,String.class,String.class,String.class,String.class,String.class);
        ctor.setAccessible(true);
        for(String[] broken:new String[][]{{null,pair[9]},{pair[8],null},{"A".repeat(64),pair[9]}}){
            try{ctor.newInstance(0L,fields[0],fields[1],fields[2],fields[3],fields[4],fields[5],fields[6],fields[7],broken[0],broken[1]);
                fail("partial browser pair admitted");}
            catch(java.lang.reflect.InvocationTargetException expected){assertTrue(expected.getCause() instanceof VaultFailure);}
        }
    }
    @Test public void HELD_CODEC_checksumKeyHeaderAndBindingSyntaxRefuse()throws Exception{
        String[] pair=java.util.Arrays.copyOf(heldCodecFields(),10);pair[8]="5".repeat(64);pair[9]="6".repeat(64);
        byte[] good=heldCodecWire(3,0,1,pair);
        byte[] checksum=good.clone();checksum[checksum.length-1]^=1;heldCodecRefuses(checksum,pair[0]);
        byte[] body=good.clone();body[body.length-40]^=1;heldCodecRefuses(body,pair[0]);
        heldCodecRefuses(good,"same-bytes-successor-key");
        heldCodecRefuses(heldCodecWire(3,0,2,pair),pair[0]);
        heldCodecRefuses(heldCodecWire(3,-1,0,pair),pair[0]);
        heldCodecRefuses(heldCodecWire(4,0,1,pair),pair[0]);
        heldCodecRefuses(java.util.Arrays.copyOf(good,good.length-1),pair[0]);
        heldCodecRefuses(new byte[4097],pair[0]);
        for(int index:new int[]{2,3,4,7}){
            String[] bad=pair.clone();bad[index]="not-a-digest";heldCodecRefuses(heldCodecWire(3,0,1,bad),pair[0]);
        }
    }

    // Actual existing-root/file reader tests. The records placed here are DENIAL DATA,
    // NOT first-hold/token/manager/browser authentication or a production transition.
    private static String heldFileDigest(byte[] bytes)throws Exception{
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    private static String[] heldFileDenialFields(NativePrivateCustodyOperationTest.DurableJoinFixture x,int version)throws Exception{
        var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
        try(var actual=x.journal.readCurrent()){x.journal.requireCurrent(actual);assertNull(actual.heldOriginal());}
        var original=x.root.resolve("preserved-genuine-v1-denial-data");
        java.nio.file.Files.createLink(original,file);
        byte[] old=java.nio.file.Files.readAllBytes(original);
        assertEquals(56,old.length);assertEquals(1,java.nio.ByteBuffer.wrap(old).getInt(4));
        java.nio.file.Files.delete(file);
        java.nio.file.Files.createFile(file,java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
            java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")));
        String[] fields=java.util.Arrays.copyOf(heldCodecFields(),version==3?10:8);
        fields[0]=metadataKey(file).toString();fields[1]=metadataKey(original).toString();
        fields[2]=heldFileDigest(old);
        fields[3]=heldFileDigest(java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.BASELINE)));
        if(version==3){fields[8]="5".repeat(64);fields[9]="6".repeat(64);}
        return fields;
    }
    private static byte[] heldFileWire(NativePrivateCustodyOperationTest.DurableJoinFixture x,int version,String[] fields)throws Exception{
        byte[] old=java.nio.file.Files.readAllBytes(x.root.resolve("preserved-genuine-v1-denial-data"));
        long originalCounter=java.nio.ByteBuffer.wrap(old).getLong(16);
        return heldCodecWire(version,originalCounter,originalCounter+1,fields);
    }
    private static Map<String,Object> heldFileKeys(NativePrivateCustodyOperationTest.DurableJoinFixture x)throws Exception{
        var keys=new java.util.TreeMap<String,Object>();keys.put("root",metadataKey(x.root));keys.put("directory",metadataKey(x.dir));
        for(String name:metadataFiles(x.dir).keySet())keys.put("file:"+name,metadataKey(x.dir.resolve(name)));
        keys.put("genuine-v1",metadataKey(x.root.resolve("preserved-genuine-v1-denial-data")));return keys;
    }
    private static void heldFileUnchanged(NativePrivateCustodyOperationTest.DurableJoinFixture x,
        Map<String,byte[]> files,Map<String,Object> keys,Map<String,Map<String,Object>> raw)throws Exception{
        metadataSame(files,x.dir);assertEquals(keys,heldFileKeys(x));assertEquals(raw,x.raw());
        assertArrayEquals(files.get(NativePrivateMutationEpochStore.BASELINE),
            java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.BASELINE)));
        assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));
        assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PREVIOUS)));
    }
    private static void heldFileOrdinaryDenied(NativePrivateCustodyOperationTest.DurableJoinFixture x,
        NativePrivateMutationEpochStore actual)throws Exception{
        try(var current=actual.readCurrent()){
            actual.requireCurrent(current);assertNotNull(current.heldOriginal());
            assertThrows(VaultFailure.class,()->actual.requireOrdinaryAdmission(current));
            assertThrows(VaultFailure.class,()->actual.prepareNext(current));
        }
        // Normal existing metadata attachment, not a private registry reset or a
        // hold-token factory. This test-built record can establish DENIAL only.
        metadataRecover(x.root);
        var prefs=new Preferences();prefs.disk.put("original","unchanged");
        var gate=adapter(prefs);int[] callbacks={0};
        assertTrue(gate.frozen());
        assertThrows(VaultFailure.class,()->gate.withOrdinaryWorkAdmission(()->{callbacks[0]++;return null;}));
        assertThrows(VaultFailure.class,()->gate.withOrdinaryWriteAdmission(()->{callbacks[0]++;return null;}));
        assertEquals(0,callbacks[0]);assertEquals(0,prefs.commits);assertEquals(Map.of("original","unchanged"),prefs.disk);
    }
    @Test public void HELD_FILE_v3ExistingReadDeniesOrdinaryAndPreservesFiles()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var genuine=metadataFiles(x.dir);
            String[] fields=heldFileDenialFields(x,3);byte[] data=heldFileWire(x,3,fields);
            java.nio.file.Files.write(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),data);
            var files=metadataFiles(x.dir);var keys=heldFileKeys(x);
            var actual=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());assertNotNull(actual);
            try(var current=actual.readCurrent()){
                actual.requireCurrent(current);var held=current.heldOriginal();assertNotNull(held);
                assertEquals(1,current.counter());assertEquals(0,held.originalCounter);
                assertEquals(fields[4],held.originalValuesSha256);assertEquals(fields[5],held.originalGenerationId);
                assertEquals(fields[6],held.originalOperationId);assertEquals(fields[7],held.originalPlanSha256);
                assertEquals(fields[8],held.browserFrameSha256);assertEquals(fields[9],held.browserPartSetSha256);
            }
            heldFileOrdinaryDenied(x,actual);heldFileUnchanged(x,files,keys,raw);
            assertArrayEquals(genuine.get(NativePrivateMutationEpochStore.CURRENT),
                java.nio.file.Files.readAllBytes(x.root.resolve("preserved-genuine-v1-denial-data")));
        }
    }
    @Test public void HELD_FILE_v3MalformedPairChecksumRemainRetained()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var genuine=metadataFiles(x.dir);String[] fields=heldFileDenialFields(x,3);
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            for(String fault:new String[]{"bad-frame","missing-pair","one-field","checksum","foreign-baseline"}){
                String[] changed=fields.clone();
                if(fault.equals("bad-frame"))changed[8]="A".repeat(64);
                if(fault.equals("missing-pair"))changed=java.util.Arrays.copyOf(changed,8);
                if(fault.equals("one-field"))changed=java.util.Arrays.copyOf(changed,9);
                if(fault.equals("foreign-baseline"))changed[3]="0".repeat(64);
                byte[] data=heldFileWire(x,3,changed);if(fault.equals("checksum"))data[data.length-1]^=1;
                java.nio.file.Files.write(file,data);var files=metadataFiles(x.dir);var keys=heldFileKeys(x);
                assertThrows(fault,VaultFailure.class,()->{try(var refused=x.journal.readCurrent()){}});
                assertThrows(fault,VaultFailure.class,()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));
                heldFileUnchanged(x,files,keys,raw);assertArrayEquals(data,java.nio.file.Files.readAllBytes(file));
            }
            assertArrayEquals(genuine.get(NativePrivateMutationEpochStore.CURRENT),
                java.nio.file.Files.readAllBytes(x.root.resolve("preserved-genuine-v1-denial-data")));
        }
    }
    @Test public void HELD_FILE_sameBytesSuccessorRevokesCurrentPermanently()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();String[] fields=heldFileDenialFields(x,3);
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            java.nio.file.Files.write(file,heldFileWire(x,3,fields));var files=metadataFiles(x.dir);var keys=heldFileKeys(x);
            var actual=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
            var genuine=x.root.resolve("preserved-genuine-v3-denial-data");
            var replacement=x.root.resolve("same-byte-v3-denial-data");
            try(var current=actual.readCurrent()){
                actual.requireCurrent(current);byte[] owned=refusedEpochBuffer(current);
                var attrs=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                java.nio.file.Files.createLink(genuine,file);java.nio.file.Files.copy(file,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                java.nio.file.Files.setLastModifiedTime(replacement,attrs.lastModifiedTime());
                try{
                    java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    assertNotEquals(attrs.fileKey(),metadataKey(file));metadataSame(files,x.dir);
                    assertThrows(VaultFailure.class,()->actual.requireCurrent(current));
                    assertThrows(VaultFailure.class,()->{try(var refused=actual.readCurrent()){}});
                }finally{
                    java.nio.file.Files.move(genuine,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                assertEquals(attrs.fileKey(),metadataKey(file));
                assertThrows(VaultFailure.class,()->actual.requireCurrent(current));
                assertThrows(VaultFailure.class,current::counter);assertNull(refusedEpochBuffer(current));assertArrayEquals(new byte[owned.length],owned);
                try(var fresh=actual.readCurrent()){
                    assertNotSame(current,fresh);actual.requireCurrent(fresh);assertEquals(fields[8],fresh.heldOriginal().browserFrameSha256);
                    assertThrows(VaultFailure.class,()->actual.requireOrdinaryAdmission(fresh));
                }
                heldFileUnchanged(x,files,keys,raw);
            }
        }
    }
    @Test public void HELD_FILE_v2RemainsExplicitlyUnboundAndReadOnly()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var raw=x.raw();var genuine=metadataFiles(x.dir);String[] fields=heldFileDenialFields(x,2);
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);byte[] v2=heldFileWire(x,2,fields);
            java.nio.file.Files.write(file,v2);var files=metadataFiles(x.dir);var keys=heldFileKeys(x);
            var actual=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());assertNotNull(actual);
            try(var current=actual.readCurrent()){
                actual.requireCurrent(current);assertEquals(1,current.counter());var held=current.heldOriginal();assertNotNull(held);
                assertNull(held.browserFrameSha256);assertNull(held.browserPartSetSha256);assertEquals(fields[4],held.originalValuesSha256);
            }
            heldFileOrdinaryDenied(x,actual);heldFileUnchanged(x,files,keys,raw);
            assertEquals(2,java.nio.ByteBuffer.wrap(java.nio.file.Files.readAllBytes(file)).getInt(4));assertArrayEquals(v2,java.nio.file.Files.readAllBytes(file));
            assertArrayEquals(genuine.get(NativePrivateMutationEpochStore.CURRENT),
                java.nio.file.Files.readAllBytes(x.root.resolve("preserved-genuine-v1-denial-data")));
        }
    }
}
