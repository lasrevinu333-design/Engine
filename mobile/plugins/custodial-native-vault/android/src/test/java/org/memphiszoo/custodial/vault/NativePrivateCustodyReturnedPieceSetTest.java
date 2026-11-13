package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;

/** NEW owning bounded-response/journal/assembly composition ONLY. Existing
 * original request factories are prerequisites, not repeated tests. JCE keys,
 * clock, owner, values and HTTPS connections are SYNTHETIC; host fsync is not
 * Android power-loss/Keystore, actual SQL/current TLS or semantic acceptance.
 * Reflection accesses only this disposable fixture's test data/private parser.
 */
public final class NativePrivateCustodyReturnedPieceSetTest {
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--browser-bound-durable-current-only".equals(args[0])){
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyReturnedPieceSetTest.class,
                "BROWSER_DURABLE_HOST_originalQueryRestoresSavedBrowserDataOnly");
            System.out.println("HOST_DURABLE_ORIGINAL_BROWSER_DATA_ONLY_NOT_MANAGER_BROWSER_ACK_ANDROID_OR_A2_PROOF");return;
        }
        if(args.length==2&&"--current-frame-mid-key-cancellation-only".equals(args[0])){
            if(!"TERMINAL_CANCEL_sameLiveControlClosedDuringKeyCheckRefuses".equals(args[1]))
                throw new IllegalArgumentException("new_mid_key_cancellation_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);
                throw new AssertionError("mid_key_cancellation_selected_case_failed");
            }
            System.out.println("PASS_NEW_SAME_CONTROL_MID_KEY_CANCELLATION_SOURCE_ONLY "+args[1]);return;
        }
        if(args.length==2&&"--browser-existing-slot-only".equals(args[0])){
            if(!java.util.Set.of("BROWSER_SLOTS_NEW_absenceAndOrphansNeverWrite",
                "BROWSER_SLOTS_NEW_partialPhaseAndExactResume","BROWSER_SLOTS_NEW_surplusInodeAndSourceRefuse").contains(args[1]))
                throw new IllegalArgumentException("new fixed browser-slot member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);
                throw new AssertionError("new browser slot owning member failed");
            }
            System.out.println("PASS_NEW_FIXED_BROWSER_SLOTS_DATA_ONLY "+args[1]);return;
        }
        if(args.length==2&&"--current-frame-terminal-projection-only".equals(args[0])){
            if(!java.util.Set.of("CURRENT_QUERY_lockedUnknownReplacementCannotRevive",
                "QUERY_RESTORE_lockedSourceIOEqualByteReplacementRefuses",
                "SEALED_QUERY_LOCK_sameControlCanceledOnlyInsideActualJournalLock",
                "TERMINAL_FRAME_detachedCurrentProjectionRequiresOwnerMonitor",
                "TERMINAL_FRAME_changedCiphertextAndEqualByteInodeRefuse",
                "TERMINAL_FRAME_closedControlClosedReadAndExpiredReadRefuse",
                "TERMINAL_FRAME_withdrawnOriginalSourceRefuses").contains(args[1]))
                throw new IllegalArgumentException("new_current_frame_terminal_projection_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);
                throw new AssertionError("current_frame_terminal_projection_selected_case_failed");
            }
            System.out.println("PASS_NEW_CURRENT_FRAME_TERMINAL_PROJECTION_SOURCE_ONLY "+args[1]);return;
        }
        if(args.length==2&&"--prepared-original-ancestry-only".equals(args[0])){
            if(!java.util.Set.of("PREPARED_BATCH_midCryptoOriginalRequestReplacementRevokesSameOwner",
                "PREPARED_ANCESTRY_firstFullAndUnchangedRead","PREPARED_ANCESTRY_sameBytesRequestReplacement",
                "PREPARED_ANCESTRY_changedIntentCiphertext","PREPARED_ANCESTRY_queryUnknownReplacement",
                "PREPARED_ANCESTRY_expiredRead","PREPARED_ANCESTRY_closedControl","PREPARED_ANCESTRY_withdrawnSource").contains(args[1]))
                throw new AssertionError("explicit_new_prepared_ancestry_case_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,args[1]));
            if(!result.wasSuccessful()){for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);System.exit(1);}
            System.out.println("PASS_PREPARED_ORIGINAL_ANCESTRY_SOURCE_ONLY "+args[1]);return;
        }
        if(args.length==2&&"--browser-journal-restart-only".equals(args[0])){
            if(!java.util.Set.of("BROWSER_RESTART_absentFrameReturnsNullWithoutWrites",
                "BROWSER_RESTART_committedSavedFrameRestoresEveryOriginalRow",
                "BROWSER_RESTART_supportedOriginalPayloadMatchIsDataOnly",
                "BROWSER_RESTART_missingChunkIsNotEmptyOrReplacement",
                "BROWSER_RESTART_pendingFrameRetainsExactOriginal",
                "BROWSER_RESTART_pendingChunkRetainsExactOriginal",
                "BROWSER_RESTART_malformedSavedDocumentCannotPublish",
                "BROWSER_RESTART_orphanChunkCannotStartFreshCapture",
                "BROWSER_RESTART_changedOriginalPlanFileRefuses",
                "BROWSER_RESTART_changedPartInvalidatesHeldTypedRows",
                "BROWSER_RESTART_canceledControlPreservesSavedOriginals",
                "BROWSER_RESTART_withdrawnCurrentOwnerPreservesSavedOriginals").contains(args[1]))
                throw new IllegalArgumentException("new_browser_journal_restart_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("BROWSER_RESTART_FAILURE_CLASS "+error.getClass().getName());
                    if(error instanceof VaultFailure&&((VaultFailure)error).code.matches("[A-Za-z0-9_]{1,96}"))
                        System.err.println("BROWSER_RESTART_FAILURE_CODE "+((VaultFailure)error).code);
                    for(var point:error.getStackTrace())System.err.println("BROWSER_RESTART_FAILURE_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError("browser_restart_selected_case_failed");
            }
            System.out.println("PASS_NEW_EXISTING_KEY_BROWSER_JOURNAL_RESTART_SOURCE_ONLY "+args[1]);
            System.out.println("NO_ANDROID_POWER_LOSS_BROWSER_AUTH_MANAGER_SQL_CUSTODY_OR_ACK_AUTHORITY");return;
        }
        if(args.length==2&&"--assembly-copy-owning-only".equals(args[0])){
            if(!java.util.Set.of("ASSEMBLY_COPY_NEW_detachedMetadataCannotRetargetEitherAssembler",
                "ASSEMBLY_COPY_NEW_sourceWithdrawalRefusesAcceptAndTransfer",
                "ASSEMBLY_COPY_NEW_sameBytesOperationReplacementRefusesAcceptAndTransfer",
                "ASSEMBLY_COPY_NEW_partialDuplicateAndBadPieceKeepInputsAndWipe",
                "ASSEMBLY_COPY_NEW_closeAfterWithdrawalWipesWithoutSourceRead").contains(args[1]))
                throw new IllegalArgumentException("new owning assembly copy member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyReturnedPieceSetTest.class,args[1]);return;
        }
        if(args.length==1&&"--g08-target-owning-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
                NativePrivateCustodyReturnedPieceSetTest.class,"G08_TARGET_sameOriginalReadTransfersOnlyUnapprovedMetadata"));
            System.out.println("G08_TARGET_CASE tests="+result.getRunCount()+" failures="+result.getFailureCount());
            if(!result.wasSuccessful()){for(var failure:result.getFailures()){
                var error=failure.getException();System.err.println("G08_TARGET_FAILURE_CLASS "+error.getClass().getName());
                if(error instanceof VaultFailure)System.err.println("G08_TARGET_FAILURE_CODE "+((VaultFailure)error).code);
                for(var point:error.getStackTrace())System.err.println("G08_TARGET_FAILURE_AT "+point);
            }System.exit(1);}return;
        }
        if(args.length==1&&"--current-frame-completion-only".equals(args[0])){
            runCurrentFrameCompletionOnly();return;
        }
        if(args.length==2&&"--current-frame-consumer-only".equals(args[0])){runCurrentFrameConsumerOnly(args[1]);return;}
        if(args.length!=1||!"--frame-assembly-only".equals(args[0]))throw new IllegalArgumentException("new frame assembly selector required");
        for(String name:new String[]{"currentFrameAssemblyExactPiecesTransferOnlyOnce","currentFrameAssemblyInvalidPiecesCloseAndWipe",
            "currentFrameAssemblyMissingOrCorruptedWholeFrameCloses","currentFrameAssemblyStaleOwnerOrClosedPlanPreservesBorrowedBytes"}){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,name));
            System.out.println("FRAME_ASSEMBLY_CASE "+name+" tests="+result.getRunCount()+" failures="+result.getFailureCount());
            if(!result.wasSuccessful()){for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);System.exit(1);}
        }
    }
    @Test public void TERMINAL_CANCEL_sameLiveControlClosedDuringKeyCheckRefuses()throws Exception {
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f)){
            var control=x.controls.get(0);
            assertSame(control,NativePrivateCustodyExchangeTest.field(read,"control"));control.check();
            var valid=read.projection();assertEquals(Boolean.FALSE,valid.get("inventory_acknowledged"));
            int connections=x.connections.size();Object ancestry=NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry");
            assertNotNull(ancestry);int[] callbacks={0};
            NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,(Runnable)()->{
                assertTrue("same owning projection monitor",Thread.holdsLock(x.f.engine));
                callbacks[0]++;control.close();
                System.out.println("CURRENT_FRAME_TERMINAL_CANCEL_PHASE same_live_control_closed_inside_key_check");
            });
            try{denied(read::projection);}
            finally{
                assertEquals("callback must occur after initial control admission",1,callbacks[0]);
                assertEquals(connections,x.connections.size());originals.unchanged();
            }
            denied(control::check);denied(read::projection);
            assertSame(ancestry,NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry"));
            assertEquals(connections,x.connections.size());originals.unchanged();
            for(var connection:x.connections)assertEquals(1,connection.disconnects);
        }
    }
    // Actual guarded read factory; no substitute crypto, injected authority,
    // historical @Test setup, reflected constructor or positive field change.
    @Test public void SEALED_QUERY_LOCK_sameControlCanceledOnlyInsideActualJournalLock()throws Exception {
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f);
            var probeChannel=java.nio.channels.FileChannel.open(x.f.dir.resolve("exchange.lock"),
                java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS)){
            read.projection();var control=x.controls.get(0);control.check();int connections=x.connections.size();
            Object ancestry=NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry");assertNotNull(ancestry);
            int[] callbacks={0},observed={0};Runnable[] probe={null};
            probe[0]=()->{
                assertTrue("same owning monitor",Thread.holdsLock(x.f.engine));
                if(++callbacks[0]>128)throw new AssertionError("bounded actual exchange-lock observation not reached");
                // Keep this pre-opened descriptor until the projection exits;
                // never close another descriptor while its target lock is live.
                try(var available=probeChannel.tryLock()){
                    assertNotNull("foreign lock cannot substitute for actual same-process overlap",available);
                }catch(java.nio.channels.OverlappingFileLockException actualOwnedLock){
                    boolean actualCrypto=false;
                    for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.class.getName())
                            &&frame.getMethodName().equals("inspectPrivateCustodyReturnedFrameBytes"))actualCrypto=true;
                    // Generic ancestry also ends with a locked plan check.
                    // That earlier overlap must NOT satisfy this crypto target.
                    if(actualCrypto){observed[0]++;control.cancel();return;}
                }catch(java.io.IOException failure){throw new AssertionError("actual exchange-lock probe failed",failure);}
                // Existing TEST key-check seam only; no wait/retry loop or
                // production hook. Cancel ONLY after real overlap is observed.
                try{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);}
                catch(Exception failure){throw new AssertionError("existing key-check seam unavailable",failure);}
            };
            NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);
            VaultFailure refused=null;
            try{try{read.projection();}catch(VaultFailure failure){refused=failure;}}
            finally{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},0,(Runnable)null);}
            assertTrue("actual target callback must execute",callbacks[0]>0);
            assertEquals("must observe actual lock before cancellation, not an earlier refusal",1,observed[0]);
            assertNotNull("same-control cancellation must refuse the projection",refused);
            denied(control::check);assertSame(control,NativePrivateCustodyExchangeTest.field(read,"control"));
            assertSame(ancestry,NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry"));
            assertEquals(connections,x.connections.size());originals.unchanged();
            for(var connection:x.connections)assertEquals(1,connection.disconnects);
        }
    }
    @Test public void QUERY_RESTORE_lockedSourceIOEqualByteReplacementRefuses()throws Exception {
        try(var x=new BrowserRestartCurrent();var originals=new BrowserRestartFiles(x.f);
            var probeChannel=java.nio.channels.FileChannel.open(x.f.dir.resolve("exchange.lock"),
                java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS)){
            var file=x.f.dir.resolve("query-0.bin");byte[] bytes=Files.readAllBytes(file);
            Object inode=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            int connections=x.connections.size();int[] callbacks={0},observed={0};
            java.nio.file.Path[] held={null};Runnable[] probe={null};
            probe[0]=()->{
                assertTrue(Thread.holdsLock(x.f.engine));
                if(++callbacks[0]>128)throw new AssertionError("bounded fixed QUERY restoration target not reached");
                try(var available=probeChannel.tryLock()){
                    assertNotNull("foreign lock cannot substitute for the same owned journal lock",available);
                }catch(java.nio.channels.OverlappingFileLockException sameOwnedLock){
                    boolean actual=false;
                    for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.NativePrivateCustodyExchangeJournal.class.getName())
                            &&frame.getMethodName().equals("readExistingOriginalQueryForCurrentRead"))actual=true;
                    if(actual){
                        observed[0]++;
                        try{held[0]=browserRestartReplaceOriginal(file,x.f.x.f.root,"locked-current-query");}
                        catch(Exception failure){throw new AssertionError("existing original-inode fault failed",failure);}
                        return;
                    }
                }catch(java.io.IOException failure){throw new AssertionError("fixed QUERY journal lock probe failed",failure);}
                try{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);}
                catch(Exception failure){throw new AssertionError("existing key-check seam unavailable",failure);}
            };
            try{
                NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);
                VaultFailure refused=null;
                try{try(var dispatch=x.f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(x.f.plan,x.f.journal,0)){
                    fail("changed original QUERY must not publish a current dispatch");
                }catch(VaultFailure failure){refused=failure;}}
                finally{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},0,(Runnable)null);}
                assertTrue("the actual source callback must execute",callbacks[0]>0);
                assertEquals("an earlier refusal is not the fixed locked source target",1,observed[0]);
                assertNotNull(refused);assertNotNull(held[0]);
                assertTrue("actual fixed QUERY restoration must refuse at the original file identity",
                    Arrays.stream(refused.getStackTrace()).anyMatch(frame->frame.getClassName().equals(
                        VaultEngine.NativePrivateCustodyExchangeJournal.class.getName()+"$FileIdentity")
                        &&frame.getMethodName().equals("requireCurrent")));
                assertTrue(Arrays.stream(refused.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("readExistingOriginalQueryForCurrentRead")));
                assertNotEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertEquals(inode,Files.readAttributes(held[0],java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(bytes,Files.readAllBytes(file));assertArrayEquals(bytes,Files.readAllBytes(held[0]));
                assertEquals(connections,x.connections.size());
                Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);held[0]=null;
                assertEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                originals.unchanged();
            }finally{
                if(held[0]!=null)Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void CURRENT_QUERY_lockedUnknownReplacementCannotRevive()throws Exception {
        try(var x=new BrowserRestartCurrent();
            var dispatch=x.f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(x.f.plan,x.f.journal,0);
            var originals=new BrowserRestartFiles(x.f);
            var probeChannel=java.nio.channels.FileChannel.open(x.f.dir.resolve("exchange.lock"),
                java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS)){
            var file=x.f.dir.resolve("query_unknown-0.bin");byte[] bytes=Files.readAllBytes(file);
            Object inode=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            Object originalRequest=NativePrivateCustodyExchangeTest.field(dispatch,"request");assertNotNull(originalRequest);
            int connections=x.connections.size();int[] callbacks={0},observed={0};
            java.nio.file.Path[] held={null};Runnable[] probe={null};
            probe[0]=()->{
                assertTrue(Thread.holdsLock(x.f.engine));
                if(++callbacks[0]>128)throw new AssertionError("bounded fixed CURRENT QUERY target not reached");
                try(var available=probeChannel.tryLock()){
                    assertNotNull("foreign lock cannot stand in for the actual owned journal lock",available);
                }catch(java.nio.channels.OverlappingFileLockException sameOwnedLock){
                    boolean actual=false;
                    for(var frame:Thread.currentThread().getStackTrace())
                        if(frame.getClassName().equals(VaultEngine.NativePrivateCustodyExchangeJournal.class.getName())
                            &&frame.getMethodName().equals("requireCurrentQueryDispatchCurrent"))actual=true;
                    if(actual){
                        observed[0]++;
                        try{held[0]=browserRestartReplaceOriginal(file,x.f.x.f.root,"locked-current-query-unknown");}
                        catch(Exception failure){throw new AssertionError("existing original-inode fault failed",failure);}
                        return;
                    }
                }catch(java.io.IOException failure){throw new AssertionError("CURRENT QUERY journal lock probe failed",failure);}
                try{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);}
                catch(Exception failure){throw new AssertionError("existing key-check seam unavailable",failure);}
            };
            try{
                NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);
                VaultFailure refused=null;
                try{try{
                    var wronglyPublished=dispatch.takeCurrentQueryRequest();Arrays.fill(wronglyPublished.body,(byte)0);
                    fail("replaced original UNKNOWN must not publish a current request");
                }catch(VaultFailure failure){refused=failure;}}
                finally{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},0,(Runnable)null);}
                assertTrue("actual key/source callback must execute",callbacks[0]>0);
                assertEquals("an earlier refusal is not the fixed locked CURRENT QUERY target",1,observed[0]);
                assertNotNull(refused);assertNotNull(held[0]);
                assertTrue("actual original identity must reject the equal-byte replacement",
                    Arrays.stream(refused.getStackTrace()).anyMatch(frame->frame.getClassName().equals(
                        VaultEngine.NativePrivateCustodyExchangeJournal.class.getName()+"$FileIdentity")
                        &&frame.getMethodName().equals("requireCurrent")));
                assertTrue(Arrays.stream(refused.getStackTrace()).anyMatch(frame->frame.getMethodName().equals("requireCurrentQueryDispatchCurrent")));
                assertEquals("the failed owning check must latch this dispatch",Boolean.TRUE,NativePrivateCustodyExchangeTest.field(dispatch,"refused"));
                assertSame("failed validation must not consume the request",originalRequest,NativePrivateCustodyExchangeTest.field(dispatch,"request"));
                assertNotEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertEquals(inode,Files.readAttributes(held[0],java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(bytes,Files.readAllBytes(file));assertArrayEquals(bytes,Files.readAllBytes(held[0]));
                Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);held[0]=null;
                assertEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                denied(()->{dispatch.takeCurrentQueryRequest();});
                assertEquals(connections,x.connections.size());originals.unchanged();
            }finally{
                if(held[0]!=null)Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void TERMINAL_FRAME_detachedCurrentProjectionRequiresOwnerMonitor()throws Exception {
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f)){
            int connections=x.connections.size();var first=read.projection();String exact=first.toString();
            assertEquals("custodial.native-current-original-frame-read.v1",first.get("schema"));
            assertEquals("CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK",first.get("state"));
            for(String flag:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged",
                "work_accepted","finalizer_allowed","key_removal","phone_released"})assertEquals(Boolean.FALSE,first.get(flag));
            Object ancestry=NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry");assertNotNull(ancestry);
            // Calling this private DATA-returning path without THIS owner
            // monitor must refuse, even though the read itself is genuine.
            denied(()->browserRestartCall(read.getClass(),read,"requireCurrentCryptoProjectionUnderLock",new Class<?>[0]));
            synchronized(new Object()){
                denied(()->browserRestartCall(read.getClass(),read,"requireCurrentCryptoProjectionUnderLock",new Class<?>[0]));
            }
            first.put("work_accepted",true).getJSONObject("crypto").put("returned_frame_sha256","0".repeat(64));
            var second=read.projection();assertTrue(ProviderWireJson.same(new JSONObject(exact),second));
            assertNotSame(first,second);assertNotSame(first.getJSONObject("crypto"),second.getJSONObject("crypto"));
            assertSame(ancestry,NativePrivateCustodyExchangeTest.field(read,"originalQueryAncestry"));
            assertEquals(connections,x.connections.size());originals.unchanged();
        }
    }
    @Test public void TERMINAL_FRAME_changedCiphertextAndEqualByteInodeRefuse()throws Exception {
        for(boolean sameBytesReplacement:new boolean[]{true,false})
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f)){
            read.projection();int connections=x.connections.size();
            var file=x.f.dir.resolve("query_unknown-0.bin");
            var attributes=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(file);java.nio.file.Path held=null;
            try{
                if(sameBytesReplacement){
                    held=browserRestartReplaceOriginal(file,x.f.x.f.root,"terminal-query-unknown");
                    assertArrayEquals(original,Files.readAllBytes(held));assertArrayEquals(original,Files.readAllBytes(file));
                }else{
                    // A retained encrypted-byte copy, NOT an authority source.
                    // Same inode/size/mtime cannot conceal changed ciphertext
                    // from the real authenticated ancestry read on each call.
                    var backup=x.f.x.f.root.resolve("terminal-query-unknown-original-ciphertext");Files.copy(file,backup);
                    byte[] changed=original.clone();
                    try{changed[changed.length/2]^=1;Files.write(file,changed);Files.setLastModifiedTime(file,attributes.lastModifiedTime());}
                    finally{Arrays.fill(changed,(byte)0);}
                    assertEquals(attributes.fileKey(),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                    assertArrayEquals(original,Files.readAllBytes(backup));
                }
                denied(read::projection);assertEquals(connections,x.connections.size());
            }finally{
                if(held!=null)Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                else Files.write(file,original);
                Files.setLastModifiedTime(file,attributes.lastModifiedTime());Arrays.fill(original,(byte)0);
            }
            assertEquals(attributes.fileKey(),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            originals.unchanged();
        }
    }
    @Test public void TERMINAL_FRAME_closedControlClosedReadAndExpiredReadRefuse()throws Exception {
        for(String state:new String[]{"closed-control","closed-read","expired-read"})
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f)){
            read.projection();int connections=x.connections.size();
            if(state.equals("closed-control"))x.controls.get(0).close();
            else if(state.equals("closed-read"))read.close();
            else x.f.clock.now+=120001; // negative synthetic expiry, never renewed/reset
            denied(read::projection);
            assertEquals(connections,x.connections.size());originals.unchanged();
        }
    }
    @Test public void TERMINAL_FRAME_withdrawnOriginalSourceRefuses()throws Exception {
        try(var x=new BrowserRestartCurrent();var read=x.read();var originals=new BrowserRestartFiles(x.f)){
            read.projection();int connections=x.connections.size();
            var source=x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");
            source.put("terminal-original-source-withdrawn","synthetic retained unknown");
            denied(read::projection);assertEquals("synthetic retained unknown",source.get("terminal-original-source-withdrawn"));
            assertEquals(connections,x.connections.size());originals.unchanged();
        }
    }
    /** Reuses the guarded current-frame fixture and the existing G08 target
     * response recipe. Four server mappings remain explicit SYNTHETIC data;
     * no manager, private authority constructor, SQL or network is supplied. */
    private static final class PreparedAncestryCurrent implements AutoCloseable {
        final BrowserRestartCurrent current=new BrowserRestartCurrent();
        VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared;
        byte[] targetResponse;
        PreparedAncestryCurrent()throws Exception {
            VaultEngine.NativePrivateCustodyCurrentFrameRead read=null;
            VaultEngine.NativeSameOriginalRecoveryTargetObservation targetOwner=null;
            VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent=null;
            byte[] queryBytes=null,proofBytes=null;
            try{
                read=current.read();
                queryBytes=NativePrivateCustodyExchangeTest.body(current.queries.get(0));
                var query=ProviderWireJson.object(queryBytes,NativeRetainedAttempt.MAX_BODY);
                proofBytes=NativeRetainedAttempt.base64(query.getString("owner_proof_base64"),262144);
                var proof=ProviderWireJson.object(proofBytes,262144);
                var principal=current.f.x.f.x.f.x.f.batch.old.principal.readFor(current.f.engine.getState());
                var target=new JSONObject();
                for(String key:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"})target.put(key,query.get(key));
                for(String key:new String[]{"credential_id","original_wire_sha256","capsule_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})target.put(key,proof.get(key));
                target.put("employee_id",principal.getString("employee_id")).put("assignment_epoch",principal.get("assignment_epoch").toString())
                    .put("canonical_device_id",principal.getString("device_id")).put("separation_id","95000000-0000-4000-8000-000000000101")
                    .put("separation_authority_revision","7").put("canonical_device_pk","95000000-0000-4000-8000-000000000102")
                    .put("original_credential_secret_key_id","c".repeat(64));
                String targetSha=NativeSameOriginalRecoveryPreparationWire.decodeTarget(target.toString().getBytes(StandardCharsets.UTF_8)).documentSha256();
                var first=new org.json.JSONArray((String)NativePrivateCustodyExchangeTest.field(read,"reads")).getJSONObject(0);
                var queryPins=current.queries.get(0).projection();final String querySha=NativeRetainedAttempt.hash(queryBytes);
                var http=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/same-original-recovery/target",url.toString());assertFalse(Thread.holdsLock(current.f.engine));
                    var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);current.connections.add(connection);
                    connection.onReply=()->{
                        byte[] sent=connection.sent.toByteArray();
                        try{var limits=new JSONObject();for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})limits.put(key,false);
                            targetResponse=Fixture.wire(new JSONObject().put("schema","custodial.same-original-recovery-target-observation.v1")
                                .put("state","ORIGINAL_TARGET_DESCRIPTOR_ONLY").put("original_target",new JSONObject(target.toString()))
                                .put("original_target_sha256",targetSha).put("original_read_query_id",queryPins.get("native_request_id"))
                                .put("original_query_body_sha256",querySha).put("original_query_unknown_record_sha256",first.get("original_query_unknown_record_sha256"))
                                .put("current_request_body_sha256",NativeRetainedAttempt.hash(sent)).put("limits",limits));connection.response=targetResponse;
                        }finally{Arrays.fill(sent,(byte)0);}
                    };return connection;
                },current.f.clock);
                targetOwner=read.takeOriginalRecoveryTarget(http);intent=targetOwner.takeOriginalPreparationIntent();
                prepared=intent.takeOriginalChallengeRequest();
                currentFrameConsumerMark("prepared_ancestry_actual_full_constructor_returned");
            }catch(Exception|Error failure){
                if(prepared!=null)prepared.close();else if(intent!=null)intent.close();else if(targetOwner!=null)targetOwner.close();else if(read!=null)read.close();
                close();throw failure;
            }finally{if(queryBytes!=null)Arrays.fill(queryBytes,(byte)0);if(proofBytes!=null)Arrays.fill(proofBytes,(byte)0);}
        }
        @Override public void close(){if(prepared!=null)prepared.close();if(targetResponse!=null)Arrays.fill(targetResponse,(byte)0);current.close();}
    }
    private static void preparedAncestryRevoked(PreparedAncestryCurrent x)throws Exception {
        assertEquals(Boolean.TRUE,NativePrivateCustodyExchangeTest.field(x.prepared,"originalAncestryRefused"));
        assertNull(NativePrivateCustodyExchangeTest.field(x.prepared,"originalRecoveryAncestry"));
        denied(x.prepared::projection);
    }
    @Test public void PREPARED_BATCH_midCryptoOriginalRequestReplacementRevokesSameOwner()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f);
            var probeChannel=java.nio.channels.FileChannel.open(x.current.f.dir.resolve("exchange.lock"),
                java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS)){
            assertNotNull(NativePrivateCustodyExchangeTest.field(x.prepared,"originalRecoveryAncestry"));
            var file=x.current.f.dir.resolve("recovery_request-0.bin");byte[] bytes=Files.readAllBytes(file);
            Object inode=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            int connections=x.current.connections.size();int[] callbacks={0},observed={0};
            java.nio.file.Path[] held={null};Runnable[] probe={null};
            probe[0]=()->{
                assertTrue(Thread.holdsLock(x.current.f.engine));
                if(++callbacks[0]>128)throw new AssertionError("bounded composed crypto-lock target not reached");
                try(var available=probeChannel.tryLock()){
                    assertNotNull("foreign lock is not same-process composed overlap",available);
                }catch(java.nio.channels.OverlappingFileLockException actualOwnedLock){
                    boolean composed=false,crypto=false;
                    for(var frame:Thread.currentThread().getStackTrace()){
                        if(frame.getClassName().equals(VaultEngine.NativePrivateCustodyExchangeJournal.class.getName())
                            &&frame.getMethodName().equals("requireSealedRecoveryPreparedCurrent"))composed=true;
                        if(frame.getClassName().equals(VaultEngine.class.getName())
                            &&frame.getMethodName().equals("inspectPrivateCustodyReturnedFrameBytes"))crypto=true;
                    }
                    if(composed&&crypto){
                        observed[0]++;
                        try{held[0]=browserRestartReplaceOriginal(file,x.current.f.x.f.root,"prepared-batch-request");}
                        catch(Exception failure){throw new AssertionError("existing original-inode fault failed",failure);}
                        return;
                    }
                }catch(java.io.IOException failure){throw new AssertionError("composed journal lock probe failed",failure);}
                try{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);}
                catch(Exception failure){throw new AssertionError("existing key-check seam unavailable",failure);}
            };
            try{
                NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,probe[0]);
                VaultFailure refused=null;
                try{try{x.prepared.projection();}catch(VaultFailure failure){refused=failure;}}
                finally{NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},0,(Runnable)null);}
                assertTrue("actual target callback must execute",callbacks[0]>0);
                assertEquals("earlier refusal cannot substitute for the composed crypto target",1,observed[0]);
                assertNotNull("changed original recovery inode must refuse",refused);assertNotNull(held[0]);
                assertTrue("refusal must reach the actual post-crypto file-identity guard",
                    Arrays.stream(refused.getStackTrace()).anyMatch(frame->frame.getClassName().equals(
                        VaultEngine.NativePrivateCustodyExchangeJournal.class.getName()+"$FileIdentity")
                        &&frame.getMethodName().equals("requireCurrent")));
                assertNotEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertEquals(inode,Files.readAttributes(held[0],java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(bytes,Files.readAllBytes(file));assertArrayEquals(bytes,Files.readAllBytes(held[0]));
                preparedAncestryRevoked(x);assertEquals(connections,x.current.connections.size());
                Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);held[0]=null;
                assertEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                preparedAncestryRevoked(x);originals.unchanged();
            }finally{
                if(held[0]!=null)Files.move(held[0],file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void PREPARED_ANCESTRY_firstFullAndUnchangedRead()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            Object seal=NativePrivateCustodyExchangeTest.field(x.prepared,"originalRecoveryAncestry");assertNotNull(seal);
            int connections=x.current.connections.size();var before=x.prepared.projection();var after=x.prepared.projection();
            assertTrue(ProviderWireJson.same(before,after));assertSame(seal,NativePrivateCustodyExchangeTest.field(x.prepared,"originalRecoveryAncestry"));
            assertEquals(Boolean.FALSE,NativePrivateCustodyExchangeTest.field(x.prepared,"originalAncestryRefused"));
            assertEquals(connections,x.current.connections.size());originals.unchanged();
            for(String flag:new String[]{"network_dispatch_allowed","manager_approval","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})assertEquals(Boolean.FALSE,after.get(flag));
        }
    }
    private static void preparedAncestryReplaceAndRestore(PreparedAncestryCurrent x,String filename,boolean corrupt)throws Exception {
        var file=x.current.f.dir.resolve(filename);byte[] original=Files.readAllBytes(file);
        var inode=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
        var held=browserRestartReplaceOriginal(file,x.current.f.x.f.root,"prepared-"+filename);
        try{
            if(corrupt){byte[] changed=original.clone();try{changed[changed.length/2]^=1;Files.write(file,changed);}finally{Arrays.fill(changed,(byte)0);}}
            denied(x.prepared::projection);preparedAncestryRevoked(x);assertArrayEquals(original,Files.readAllBytes(held));
            Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            assertEquals(inode,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            assertArrayEquals(original,Files.readAllBytes(file));preparedAncestryRevoked(x);
        }finally{Arrays.fill(original,(byte)0);}
    }
    @Test public void PREPARED_ANCESTRY_sameBytesRequestReplacement()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            preparedAncestryReplaceAndRestore(x,"recovery_request-0.bin",false);originals.unchanged();
        }
    }
    @Test public void PREPARED_ANCESTRY_changedIntentCiphertext()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            preparedAncestryReplaceAndRestore(x,"recovery_intent-0.bin",true);originals.unchanged();
        }
    }
    @Test public void PREPARED_ANCESTRY_queryUnknownReplacement()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            preparedAncestryReplaceAndRestore(x,"query_unknown-0.bin",false);originals.unchanged();
        }
    }
    @Test public void PREPARED_ANCESTRY_expiredRead()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            long original=x.current.f.clock.now;x.current.f.clock.now+=120001;
            denied(x.prepared::projection);x.current.f.clock.now=original;preparedAncestryRevoked(x);originals.unchanged();
        }
    }
    @Test public void PREPARED_ANCESTRY_closedControl()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            x.current.controls.get(0).close();denied(x.prepared::projection);preparedAncestryRevoked(x);originals.unchanged();
        }
    }
    @Test public void PREPARED_ANCESTRY_withdrawnSource()throws Exception {
        try(var x=new PreparedAncestryCurrent();var originals=new BrowserRestartFiles(x.current.f)){
            x.current.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("prepared-original-source-withdrawn","synthetic retained unknown");
            denied(x.prepared::projection);preparedAncestryRevoked(x);originals.unchanged();
        }
    }
    // Fixed existing browser-slot batch only. Existing owning fixture/parser/
    // cipher APIs remain actual; reflection inspects private DATA, never mints
    // a plan, saved owner, manager, token or acceptance capability.
    private static Object browserSlotsRead(BrowserRestartCurrent x)throws Exception {
        synchronized(x.f.engine){return browserRestartCall(x.f.journal.getClass(),x.f.journal,"readExistingBrowserSlots",
            new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class},x.f.plan);}
    }
    private static void browserSlotsCurrent(BrowserRestartCurrent x,Object slots)throws Exception {
        synchronized(x.f.engine){browserRestartCall(x.f.journal.getClass(),x.f.journal,"requireExistingBrowserSlotsCurrent",
            new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,slots.getClass()},x.f.plan,slots);}
    }
    private static int[] browserSlotsPhases(Object slots)throws Exception {
        return ((int[])NativePrivateCustodyExchangeTest.field(slots,"phases")).clone();
    }
    private static void browserSlotsPartSet(BrowserRestartCurrent x,BrowserRestartVector vector)throws Exception {
        synchronized(x.f.engine){
            var binding=(JSONObject)browserRestartCall(VaultEngine.class,null,"originalBrowserBinding",
                new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class},x.f.plan);
            browserRestartCall(x.f.journal.getClass(),x.f.journal,"originalBrowserPartSet",
                new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,JSONObject.class,JSONObject.class},x.f.plan,vector.metadata,binding);
        }
    }
    @Test public void BROWSER_SLOTS_NEW_absenceAndOrphansNeverWrite()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            Object absent=browserSlotsRead(x);
            try(var saved=new BrowserRestartFiles(x.f)){
                assertArrayEquals(new int[65],browserSlotsPhases(absent));browserSlotsCurrent(x,absent);saved.unchanged();
                assertThrows(VaultFailure.class,()->browserRestartCall(x.f.journal.getClass(),x.f.journal,"readExistingBrowserSlots",
                    new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class},x.f.plan));
            }
            try(var read=x.read()){browserRestartAppend(x,read,vector,0,false);}
            try(var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserSlotsCurrent(x,absent));
                Object orphan=browserSlotsRead(x);int[] phases=browserSlotsPhases(orphan);
                assertEquals(0,phases[0]);assertEquals(1,phases[1]);for(int i=2;i<65;i++)assertEquals(0,phases[i]);
                browserSlotsCurrent(x,orphan);
                synchronized(x.f.engine){
                    assertThrows(VaultFailure.class,()->browserRestartCall(x.f.journal.getClass(),x.f.journal,"requireNoSavedBrowserOriginal",
                        new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class},x.f.plan));
                }
                saved.unchanged();assertFalse(Files.exists(x.f.dir.resolve("browser_frame-0.bin")));
                assertFalse(Files.exists(x.f.dir.resolve("browser_frame-0.pending")));
            }
        }
    }
    @Test public void BROWSER_SLOTS_NEW_partialPhaseAndExactResume()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,false,false);Object partial=browserSlotsRead(x);
            assertEquals(1,browserSlotsPhases(partial)[0]);for(int i=1;i<65;i++)assertEquals(0,browserSlotsPhases(partial)[i]);
            try(var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserSlotsPartSet(x,vector));browserSlotsCurrent(x,partial);saved.unchanged();
            }
            var committed=x.f.dir.resolve("browser_frame-0.bin");var pending=x.f.dir.resolve("browser_frame-0.pending");
            byte[] original=Files.readAllBytes(committed);Object inode=Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try{
                Files.move(committed,pending);Object pendingSlots=browserSlotsRead(x);assertEquals(2,browserSlotsPhases(pendingSlots)[0]);
                browserSlotsCurrent(x,pendingSlots);assertThrows(VaultFailure.class,()->browserSlotsCurrent(x,partial));
                Files.createLink(committed,pending);assertThrows(VaultFailure.class,()->browserSlotsCurrent(x,pendingSlots));
                Object aliasSlots=browserSlotsRead(x);assertEquals(3,browserSlotsPhases(aliasSlots)[0]);
                synchronized(x.f.engine){
                    Enum<?> kind=browserRestartKind(-1);Class<?>[] signature={VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kind.getDeclaringClass(),int.class};
                    try(var stored=(AutoCloseable)browserRestartCall(x.f.journal.getClass(),x.f.journal,"read",signature,x.f.plan,kind,0)){
                        assertEquals("COMMITTED_PENDING_ALIAS",NativePrivateCustodyExchangeTest.field(stored,"phase"));
                        try(var resumed=(AutoCloseable)browserRestartCall(x.f.journal.getClass(),x.f.journal,"resumeOriginal",
                            new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kind.getDeclaringClass(),int.class,stored.getClass()},x.f.plan,kind,0,stored)){
                            assertEquals("COMMITTED",NativePrivateCustodyExchangeTest.field(resumed,"phase"));
                            browserRestartCall(aliasSlots.getClass(),aliasSlots,"resumed",new Class<?>[]{int.class,resumed.getClass()},0,resumed);
                        }
                    }
                }
                assertEquals(1,browserSlotsPhases(aliasSlots)[0]);browserSlotsCurrent(x,aliasSlots);
                assertFalse(Files.exists(pending));assertArrayEquals(original,Files.readAllBytes(committed));
                assertEquals(inode,Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                try(var saved=new BrowserRestartFiles(x.f)){
                    assertThrows(VaultFailure.class,()->browserSlotsPartSet(x,vector));saved.unchanged();
                    assertFalse(Files.exists(x.f.dir.resolve("browser_chunk-0.bin")));
                }
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void BROWSER_SLOTS_NEW_surplusInodeAndSourceRefuse()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);assertTrue(vector.chunks.size()<64);Object complete=browserSlotsRead(x);
            browserSlotsCurrent(x,complete);browserSlotsPartSet(x,vector);
            // Deliberately unclaimed surplus ORIGINAL DATA via the normal
            // owning journal; no forged capability or supplied accepted flag.
            try(var read=x.read()){synchronized(x.f.engine){
                Enum<?> kind=browserRestartKind(0);
                JSONObject document=(JSONObject)browserRestartCall(read.getClass(),read,"browserPreservationDocument",
                    new Class<?>[]{kind.getDeclaringClass(),int.class,JSONObject.class,byte[].class},kind,0,vector.metadata,vector.chunks.get(0));
                document.put("entry_key","browser_chunk-63").put("chunk_index",63);
                try(var stored=(AutoCloseable)browserRestartCall(x.f.journal.getClass(),x.f.journal,"appendAbsent",
                    new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kind.getDeclaringClass(),int.class,String.class},
                    x.f.plan,kind,63,document.toString())){assertNotNull(stored);}
            }}
            Object surplus=browserSlotsRead(x);assertEquals(1,browserSlotsPhases(surplus)[64]);
            try(var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserSlotsCurrent(x,complete));browserSlotsCurrent(x,surplus);
                assertThrows(VaultFailure.class,()->browserSlotsPartSet(x,vector));saved.unchanged();
            }
            var file=x.f.dir.resolve("browser_chunk-0.bin");byte[] original=Files.readAllBytes(file);
            var held=NativePrivateCustodyExchangeTest.replaceIdentityOriginal(x.f,"browser_chunk-0.bin","fixed-slot-inode");
            try(var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserSlotsCurrent(x,surplus));
                assertArrayEquals(original,Files.readAllBytes(file));assertArrayEquals(original,Files.readAllBytes(held));saved.unchanged();
                x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("fixed-slot-source-withdrawn","synthetic retained original");
                assertThrows(VaultFailure.class,()->browserSlotsRead(x));saved.unchanged();
            }finally{Arrays.fill(original,(byte)0);}
        }
    }

    // BEGIN NEW browser original journal restart composition. Reflection calls
    // actual private owning methods or existing DATA fixture builders only;
    // no private capability constructor, cipher, parser or Engine substitute.
    private static Object browserRestartCall(Class<?> type,Object receiver,String method,Class<?>[] signature,Object... arguments)throws Exception {
        var callable=type.getDeclaredMethod(method,signature);callable.setAccessible(true);
        try{return callable.invoke(receiver,arguments);}
        catch(java.lang.reflect.InvocationTargetException failed){
            Throwable cause=failed.getCause();if(cause instanceof Exception)throw (Exception)cause;
            if(cause instanceof Error)throw (Error)cause;throw failed;
        }
    }
    /** The already-proved guarded identity/current-frame composition, using
     * its normal original WRITE/UNKNOWN/QUERY/UNKNOWN preparation and response
     * recipe. Historical @Test methods and unguarded fixtures are not setup. */
    static final class BrowserRestartCurrent implements AutoCloseable {
        // Test construction only. This mode neither supplies nor mints an
        // Engine control, HELD, ACK, current manager or browser authority.
        enum OriginalSetup { BOUND_DURABLE_FIRST_HOST_MODEL }
        final NativePrivateCustodyExchangeTest.GuardedIdentityFixture f;
        final List<VaultEngine.NativePrivateCustodyPreparedExchange> queries=new ArrayList<>();
        final List<byte[]> replies=new ArrayList<>();
        final List<NativePrivateCustodyHttpOutcomeTest.Connection> connections=new ArrayList<>();
        final List<NativePrivateCustodyFrameReadControl> controls=new ArrayList<>();
        BrowserRestartCurrent()throws Exception {
            currentFrameConsumerMark("browser_restart_guarded_original_preparation_begin");
            try(var issuer=new CurrentFrameConsumerIssuer()){f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();}
            try{
                int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
                for(int i=0;i<count;i++)try(var write=f.write(i)){
                    JSONObject row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=f.query(i);queries.add(query);f.engine.fenceOriginalPrivateCustodyExchange(query);
                    replies.add((byte[])browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"identityPieceReply",
                        new Class<?>[]{NativePrivateCustodyExchangeTest.GuardedIdentityFixture.class,VaultEngine.NativePrivateCustodyPreparedExchange.class,JSONObject.class,int.class},f,query,row,i));
                }
                currentFrameConsumerMark("browser_restart_all_original_QUERY_issued");
            }catch(Exception|Error failed){close();throw failed;}
        }
        BrowserRestartCurrent(OriginalSetup setup)throws Exception {
            if(setup!=OriginalSetup.BOUND_DURABLE_FIRST_HOST_MODEL)
                throw new IllegalArgumentException("fixed_bound_durable_original_host_setup_required");
            currentFrameConsumerMark("browser_restart_bound_durable_original_preparation_begin");
            try(var issuer=new CurrentFrameConsumerIssuer()){
                f=NativePrivateCustodyExchangeTest.GuardedIdentityFixture.boundDurableFirstOriginalForHostModel();
            }
            try{
                int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
                for(int i=0;i<count;i++)try(var write=f.write(i)){
                    JSONObject row=NativePrivateCustodyReplySetTest.readback(write);f.engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=f.query(i);queries.add(query);f.engine.fenceOriginalPrivateCustodyExchange(query);
                    replies.add((byte[])browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"identityPieceReply",
                        new Class<?>[]{NativePrivateCustodyExchangeTest.GuardedIdentityFixture.class,VaultEngine.NativePrivateCustodyPreparedExchange.class,JSONObject.class,int.class},f,query,row,i));
                }
                currentFrameConsumerMark("browser_restart_all_original_QUERY_issued");
            }catch(Exception|Error failed){close();throw failed;}
        }
        VaultEngine.NativePrivateCustodyCurrentFrameRead read()throws Exception {
            int base=connections.size();var control=new NativePrivateCustodyFrameReadControl();controls.add(control);
            var http=new NativePrivateCustodyHttp(url->{
                assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                assertFalse(Thread.holdsLock(f.engine));int index=connections.size()-base;assertTrue(index<replies.size());
                var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);connection.response=replies.get(index);connections.add(connection);return connection;
            },f.clock);
            currentFrameConsumerMark("browser_restart_actual_current_read_begin");
            var read=f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,control);
            currentFrameConsumerMark("browser_restart_actual_current_read_returned");
            assertEquals(queries.size(),connections.size()-base);for(var connection:connections)assertEquals(1,connection.disconnects);return read;
        }
        @Override public void close(){
            for(var control:controls)control.close();for(var query:queries)query.close();for(byte[] reply:replies)Arrays.fill(reply,(byte)0);f.close();
        }
    }
    /** Borrow only sealed dfec200d WireTest's existing lossless vectors. This
     * holder owns DATA buffers, never a browser Exchange or native authority. */
    private static final class BrowserRestartVector implements AutoCloseable {
        JSONObject metadata,observation;final List<byte[]> chunks=new ArrayList<>();byte[] argument;
        BrowserRestartVector(boolean supported)throws Exception {
            byte[] frame=null;
            try{
                Object tree;
                if(supported){
                    argument=(byte[])browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"primaryPayloadArguments",new Class<?>[]{int.class},1);
                    var reply=(JSONObject)browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"primaryPayloadReply",
                        new Class<?>[]{byte[].class,boolean.class,boolean.class},argument,false,false);
                    observation=reply.getJSONObject("observation");tree=browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"primaryPayloadTree",new Class<?>[]{boolean.class,boolean.class},false,false);
                }else{
                    observation=(JSONObject)browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"valueObservation",new Class<?>[]{boolean.class},false);
                    tree=browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"valueTree",new Class<?>[]{boolean.class},false);
                }
                frame=(byte[])browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"valueBytes",new Class<?>[]{Object.class,JSONObject.class},tree,observation);
                @SuppressWarnings("unchecked") List<byte[]> parts=(List<byte[]>)browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"valueChunks",new Class<?>[]{byte[].class},frame);chunks.addAll(parts);
                metadata=(JSONObject)browserRestartCall(NativeSameOriginalRecoveryPreparationWireTest.class,null,"valueMetadata",new Class<?>[]{List.class,JSONObject.class},chunks,observation);
                assertEquals(1,chunks.size());assertEquals(supported?1:3,observation.getInt("record_count"));
            }catch(Exception|Error failed){close();throw failed;}
            finally{if(frame!=null)Arrays.fill(frame,(byte)0);}
        }
        @Override public void close(){for(byte[] chunk:chunks)Arrays.fill(chunk,(byte)0);if(argument!=null)Arrays.fill(argument,(byte)0);}
    }
    /** Reuse existing normal original-byte/inode snapshot helpers. */
    private static final class BrowserRestartFiles implements AutoCloseable {
        final NativePrivateCustodyExchangeTest.GuardedIdentityFixture f;
        final java.util.Map<java.nio.file.Path,byte[]> files;final java.util.Map<java.nio.file.Path,Object> inodes;
        @SuppressWarnings("unchecked") BrowserRestartFiles(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f)throws Exception {
            this.f=f;files=(java.util.Map<java.nio.file.Path,byte[]>)browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"coldOriginals",
                new Class<?>[]{NativePrivateCustodyExchangeTest.GuardedIdentityFixture.class},f);
            try{inodes=(java.util.Map<java.nio.file.Path,Object>)browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"coldInodes",new Class<?>[]{java.util.Map.class},files);}
            catch(Exception|Error failed){for(byte[] bytes:files.values())Arrays.fill(bytes,(byte)0);throw failed;}
        }
        @SuppressWarnings("unchecked") void unchanged()throws Exception {
            var now=(java.util.Map<java.nio.file.Path,byte[]>)browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"coldOriginals",
                new Class<?>[]{NativePrivateCustodyExchangeTest.GuardedIdentityFixture.class},f);
            try{assertEquals(files.keySet(),now.keySet());browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"coldSame",new Class<?>[]{java.util.Map.class,java.util.Map.class},files,inodes);}
            finally{for(byte[] bytes:now.values())Arrays.fill(bytes,(byte)0);}
        }
        @Override public void close(){for(byte[] bytes:files.values())Arrays.fill(bytes,(byte)0);}
    }
    @SuppressWarnings({"rawtypes","unchecked"}) private static Enum<?> browserRestartKind(int index)throws Exception {
        Class<? extends Enum> type=(Class<? extends Enum>)Class.forName(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal$Kind");
        return Enum.valueOf(type,index<0?"BROWSER_FRAME":"BROWSER_CHUNK");
    }
    private static void browserRestartAppend(BrowserRestartCurrent x,VaultEngine.NativePrivateCustodyCurrentFrameRead read,
        BrowserRestartVector vector,int index,boolean malformed)throws Exception {
        synchronized(x.f.engine){
            Enum<?> kind=browserRestartKind(index);
            JSONObject document=(JSONObject)browserRestartCall(read.getClass(),read,"browserPreservationDocument",
                new Class<?>[]{kind.getDeclaringClass(),int.class,JSONObject.class,byte[].class},kind,index<0?0:index,vector.metadata,index<0?null:vector.chunks.get(index));
            if(malformed)document.put("inventory_acknowledged",true); // Deliberate negative DATA copy; never a grant.
            try(var stored=(AutoCloseable)browserRestartCall(x.f.journal.getClass(),x.f.journal,"appendAbsent",
                new Class<?>[]{VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kind.getDeclaringClass(),int.class,String.class},x.f.plan,kind,index<0?0:index,document.toString())){
                assertNotNull(stored);assertEquals("COMMITTED",NativePrivateCustodyExchangeTest.field(stored,"phase"));
                browserRestartCall(stored.getClass(),stored,"open",new Class<?>[0]);
            }
        }
    }
    private static void browserRestartSeed(BrowserRestartCurrent x,BrowserRestartVector vector,boolean chunks,boolean malformed)throws Exception {
        try(var read=x.read()){
            browserRestartAppend(x,read,vector,-1,malformed);
            if(chunks)for(int i=0;i<vector.chunks.size();i++)browserRestartAppend(x,read,vector,i,false);
        }
    }
    private static JSONObject browserRestartRestore(VaultEngine.NativePrivateCustodyCurrentFrameRead read,List<byte[]> pool)throws Exception {
        currentFrameConsumerMark("browser_restart_private_restore_begin");
        JSONObject result=(JSONObject)browserRestartCall(read.getClass(),read,"restoreSavedOriginalBrowserRecords",new Class<?>[]{List.class},pool);
        currentFrameConsumerMark("browser_restart_private_restore_returned");return result;
    }
    private static NativeOriginalBrowserValueFrame.OriginalRecords browserRestartRows(VaultEngine.NativePrivateCustodyCurrentFrameRead read)throws Exception {
        return (NativeOriginalBrowserValueFrame.OriginalRecords)browserRestartCall(read.getClass(),read,"requireRetainedOriginalBrowserRecordsCurrent",new Class<?>[0]);
    }
    private static void browserRestartNoPublication(VaultEngine.NativePrivateCustodyCurrentFrameRead read)throws Exception {
        for(String field:new String[]{"browserOriginalRecords","browserOriginalMetadata","browserOriginalPartSet"})assertNull(NativePrivateCustodyExchangeTest.field(read,field));
    }
    private static void browserRestartAssertRows(VaultEngine.NativePrivateCustodyCurrentFrameRead read,JSONObject restored,
        BrowserRestartVector vector,List<byte[]> pool,boolean match)throws Exception {
        assertEquals("custodial.native-original-browser-saved-data.v1",restored.get("schema"));
        assertEquals("SAVED_ORIGINAL_TYPED_DATA_RESTORED_NOT_CURRENT_BROWSER_AUTHORITY",restored.get("state"));
        for(String flag:new String[]{"current_browser_source_authenticated","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,restored.getBoolean(flag));
        assertTrue(restored.getBoolean("existing_shared_key_retained"));
        var records=browserRestartRows(read);assertEquals(vector.observation.getInt("record_count"),records.recordCount);
        assertEquals(records.recordCount,restored.getInt("record_count"));assertEquals(records.recordCount,records.originalRecords().size());
        assertEquals(records.recordCount,records.nativeArgumentPayloadMatches().size());
        assertEquals(vector.metadata.getString("frame_sha256"),records.frameSha256);assertEquals(records.frameSha256,restored.get("browser_value_frame_sha256"));
        assertEquals(vector.observation.getString("observation_sha256"),records.observationSha256);
        for(int i=0;i<records.recordCount;i++){
            var row=records.originalRecords().get(i);var expected=vector.observation.getJSONArray("records").getJSONObject(i);
            assertEquals(i,row.ordinal);assertEquals(expected.getString("store"),row.store);assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
            assertEquals(expected.getString("key_sha256"),row.keySha256);assertEquals(expected.getString("body_sha256"),row.bodySha256);
            assertEquals(expected.has("database")?expected.getString("database"):null,row.database);
            assertEquals(expected.has("object_store")?expected.getString("object_store"):null,row.objectStore);
            assertEquals(expected.has("version")?Long.valueOf(expected.getLong("version")):null,row.version);
            var nativeMatch=records.nativeArgumentPayloadMatches().get(i);assertEquals(i,nativeMatch.captureRecordOrdinal);
            assertEquals(match,nativeMatch.matchesOriginalPayload);assertEquals(match?0:-1,nativeMatch.nativeArgumentOrdinal);
            assertEquals(match?NativeRetainedAttempt.hash(pool.get(0)):"",nativeMatch.argumentSha256);
        }
        String parts=(String)NativePrivateCustodyExchangeTest.field(read,"browserOriginalPartSet");assertTrue(parts.matches("[a-f0-9]{64}"));
        assertSame(records,browserRestartRows(read));
        try{records.originalRecords().clear();fail("mutable restored row DATA");}catch(UnsupportedOperationException expected){}
    }
    private static java.nio.file.Path browserRestartReplaceOriginal(java.nio.file.Path file,java.nio.file.Path root,String label)throws Exception {
        var before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var held=root.resolve("synthetic-browser-original-"+label);var replacement=root.resolve("synthetic-browser-replacement-"+label);
        Files.createLink(held,file);Files.copy(file,replacement);
        Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));Files.setLastModifiedTime(replacement,before.lastModifiedTime());
        Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        assertNotEquals(before.fileKey(),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        assertEquals(before.fileKey(),Files.readAttributes(held,java.nio.file.attribute.BasicFileAttributes.class).fileKey());return held;
    }
    /** Changed construction + existing original exchange/browser composition.
     * Actual fixed journal/crypto/read code runs when selected; response,
     * credential, clock and browser vectors remain synthetic HOST TEST DATA. */
    @Test public void BROWSER_DURABLE_HOST_originalQueryRestoresSavedBrowserDataOnly()throws Exception {
        assertThrows(IllegalArgumentException.class,()->new BrowserRestartCurrent(null));
        try(var x=new BrowserRestartCurrent(BrowserRestartCurrent.OriginalSetup.BOUND_DURABLE_FIRST_HOST_MODEL);
            var vector=new BrowserRestartVector(true);var issued=new BrowserRestartFiles(x.f)){
            JSONObject operation=x.f.operation.projection();
            assertEquals("DURABLE_ATTEMPT:0",operation.getString("original_native_mutation_stamp"));
            assertEquals("DURABLE_ATTEMPT:0",x.f.x.guardedNamespaces.originalMutationStampForOwningOperation());
            String originalOperation=operation.toString(),originalPlan=x.f.plan.projection().toString();
            int count=x.f.plan.projection().getInt("chunk_count");assertEquals(count,x.queries.size());
            List<String> originalQueries=new ArrayList<>();
            for(int i=0;i<count;i++){
                var pins=x.f.plan.chunkMetadata(i);var query=x.queries.get(i).projection();
                assertEquals(pins.get("read_query_id"),query.get("native_request_id"));
                byte[] bytes=NativePrivateCustodyExchangeTest.body(x.queries.get(i));
                try{
                    var body=ProviderWireJson.object(bytes,NativeRetainedAttempt.MAX_BODY);
                    assertEquals(operation.get("operation_id"),body.get("operation_id"));
                    assertEquals(pins.get("attempt_id"),body.get("target_native_request_id"));
                    assertNotEquals(query.get("native_request_id"),body.get("target_native_request_id"));
                    assertEquals(NativeRetainedAttempt.hash(bytes),query.get("request_body_sha256"));
                }finally{Arrays.fill(bytes,(byte)0);}
                originalQueries.add(query.toString());
            }
            var epochDirectory=x.f.x.f.root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var epoch=NativePrivateCustodyOperationTest.saved(epochDirectory);
            byte[] argument=vector.argument.clone(),originalArgument=argument.clone();
            try{
                browserRestartSeed(x,vector,true,false);
                // New saved browser slots are expected. Every already-issued
                // native operation/WRITE/QUERY file must keep its bytes/inode.
                browserRestartCall(NativePrivateCustodyHttpOutcomeTest.class,null,"coldSame",
                    new Class<?>[]{java.util.Map.class,java.util.Map.class},issued.files,issued.inodes);
                try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                    int connections=x.connections.size();List<byte[]> pool=List.of(argument);
                    var restored=browserRestartRestore(read,pool);
                    browserRestartAssertRows(read,restored,vector,pool,true);
                    assertEquals(connections,x.connections.size());assertArrayEquals(originalArgument,argument);
                    saved.unchanged();
                }
                assertEquals(originalOperation,x.f.operation.projection().toString());
                assertEquals(originalPlan,x.f.plan.projection().toString());
                for(int i=0;i<count;i++)assertEquals(originalQueries.get(i),x.queries.get(i).projection().toString());
                NativePrivateCustodyOperationTest.same(epoch,epochDirectory);
                assertEquals("DURABLE_ATTEMPT:0",x.f.x.guardedNamespaces.originalMutationStampForOwningOperation());
            }finally{
                Arrays.fill(argument,(byte)0);Arrays.fill(originalArgument,(byte)0);
                for(byte[] bytes:epoch.values())Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void BROWSER_RESTART_absentFrameReturnsNullWithoutWrites()throws Exception {
        try(var x=new BrowserRestartCurrent();var read=x.read();var saved=new BrowserRestartFiles(x.f)){
            int connections=x.connections.size();assertNull(browserRestartRestore(read,List.of()));browserRestartNoPublication(read);
            assertEquals(connections,x.connections.size());saved.unchanged();assertFalse(Files.exists(x.f.dir.resolve("browser_frame-0.bin")));
        }
    }
    @Test public void BROWSER_RESTART_committedSavedFrameRestoresEveryOriginalRow()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                int connections=x.connections.size();browserRestartAssertRows(read,browserRestartRestore(read,List.of()),vector,List.of(),false);
                assertEquals(connections,x.connections.size());saved.unchanged();
            }
        }
    }
    @Test public void BROWSER_RESTART_supportedOriginalPayloadMatchIsDataOnly()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(true)){
            browserRestartSeed(x,vector,true,false);byte[] argument=vector.argument.clone(),before=argument.clone();
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                int connections=x.connections.size();List<byte[]> pool=List.of(argument);
                browserRestartAssertRows(read,browserRestartRestore(read,pool),vector,pool,true);assertArrayEquals(before,argument);
                assertEquals(connections,x.connections.size());saved.unchanged();
            }finally{Arrays.fill(argument,(byte)0);Arrays.fill(before,(byte)0);}
        }
    }
    @Test public void BROWSER_RESTART_missingChunkIsNotEmptyOrReplacement()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,false,false);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
                assertFalse(Files.exists(x.f.dir.resolve("browser_chunk-0.bin")));
            }
        }
    }
    private static void browserRestartPending(boolean frame)throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);String key=frame?"browser_frame-0":"browser_chunk-0";
            var committed=x.f.dir.resolve(key+".bin");var pending=x.f.dir.resolve(key+".pending");
            Object inode=Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();Files.move(committed,pending);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
                assertFalse(Files.exists(committed));assertEquals(inode,Files.readAttributes(pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            }
        }
    }
    @Test public void BROWSER_RESTART_pendingFrameRetainsExactOriginal()throws Exception {browserRestartPending(true);}
    @Test public void BROWSER_RESTART_pendingChunkRetainsExactOriginal()throws Exception {browserRestartPending(false);}
    @Test public void BROWSER_RESTART_malformedSavedDocumentCannotPublish()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,false,true);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
            }
        }
    }
    @Test public void BROWSER_RESTART_orphanChunkCannotStartFreshCapture()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);var frame=x.f.dir.resolve("browser_frame-0.bin");var held=x.f.x.f.root.resolve("synthetic-browser-orphan-original-frame");
            byte[] original=Files.readAllBytes(frame);Files.move(frame,held);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                int connections=x.connections.size();assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));
                browserRestartNoPublication(read);saved.unchanged();assertArrayEquals(original,Files.readAllBytes(held));
                assertFalse(Files.exists(frame));assertFalse(Files.exists(x.f.dir.resolve("browser_frame-0.pending")));assertEquals(connections,x.connections.size());
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void BROWSER_RESTART_changedOriginalPlanFileRefuses()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);
            try(var read=x.read()){
                var file=x.f.x.dir.resolve(NativePrivateCustodyOperationStore.COMMITTED);byte[] original=Files.readAllBytes(file);
                var held=browserRestartReplaceOriginal(file,x.f.x.f.root,"operation");
                try(var saved=new BrowserRestartFiles(x.f)){
                    assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
                    assertArrayEquals(original,Files.readAllBytes(held));assertArrayEquals(original,Files.readAllBytes(file));
                }finally{Arrays.fill(original,(byte)0);}
            }
        }
    }
    @Test public void BROWSER_RESTART_changedPartInvalidatesHeldTypedRows()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);
            try(var read=x.read()){
                browserRestartAssertRows(read,browserRestartRestore(read,List.of()),vector,List.of(),false);
                var file=x.f.dir.resolve("browser_chunk-0.bin");byte[] original=Files.readAllBytes(file);
                var held=NativePrivateCustodyExchangeTest.replaceIdentityOriginal(x.f,"browser_chunk-0.bin","browser-restart-part");
                try(var saved=new BrowserRestartFiles(x.f)){
                    assertThrows(VaultFailure.class,()->browserRestartRows(read));saved.unchanged();
                    assertArrayEquals(original,Files.readAllBytes(held));assertArrayEquals(original,Files.readAllBytes(file));
                }finally{Arrays.fill(original,(byte)0);}
            }
        }
    }
    @Test public void BROWSER_RESTART_canceledControlPreservesSavedOriginals()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                ((NativePrivateCustodyFrameReadControl)NativePrivateCustodyExchangeTest.field(read,"control")).cancel();
                assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
            }
        }
    }
    @Test public void BROWSER_RESTART_withdrawnCurrentOwnerPreservesSavedOriginals()throws Exception {
        try(var x=new BrowserRestartCurrent();var vector=new BrowserRestartVector(false)){
            browserRestartSeed(x,vector,true,false);
            try(var read=x.read();var saved=new BrowserRestartFiles(x.f)){
                x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("browser-restart-currentness-withdrawn","synthetic retained original");
                assertThrows(VaultFailure.class,()->browserRestartRestore(read,List.of()));browserRestartNoPublication(read);saved.unchanged();
            }
        }
    }
    // END NEW browser original journal restart composition.

    /** Assembly needs the actual native plan/frame, not unrelated HTTP journal preparation. */
    private static final class AssemblyFixture implements AutoCloseable {
        final NativePrivateCustodyExchangeTest.Fixture f=new NativePrivateCustodyExchangeTest.Fixture();
        AssemblyFixture()throws Exception{}
        @Override public void close(){f.close();}
    }
    private static byte[] assemblyFrame(AssemblyFixture x)throws Exception {
        return ((byte[])NativePrivateCustodyExchangeTest.field(x.f.x.frame,"encoded")).clone();
    }
    private static byte[] assemblyPiece(AssemblyFixture x,byte[] frame,int index)throws Exception {
        var row=x.f.plan.chunkMetadata(index);
        return Arrays.copyOfRange(frame,row.getInt("offset"),row.getInt("offset")+row.getInt("chunk_bytes"));
    }
    private static byte[] assemblyBuffer(NativePrivateCustodyCurrentFrameAssembler assembler)throws Exception {
        return (byte[])NativePrivateCustodyExchangeTest.field(assembler,"frame");
    }
    private static void zeroed(byte[] buffer){for(byte b:buffer)assertEquals(0,b);}
    @Test public void currentFrameAssemblyExactPiecesTransferOnlyOnce()throws Exception {
        try(var x=new AssemblyFixture()){
            assertFalse(Files.exists(x.f.dir));var original=NativePrivateCustodyOwnerTest.files(x.f.x.f.dir);
            var pins=x.f.engine.currentOriginalPrivateCustodyFramePins(x.f.plan);
            byte[] frame=assemblyFrame(x),taken=null;
            try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){
                // Out-of-order arrival still uses original fixed offsets.
                for(int i=pins.chunkCount()-1;i>=0;i--){byte[] piece=assemblyPiece(x,frame,i),before=piece.clone();
                    try{a.accept(i,piece);assertArrayEquals(before,piece);Arrays.fill(piece,(byte)0);}
                    finally{Arrays.fill(piece,(byte)0);Arrays.fill(before,(byte)0);}}
                byte[] owned=assemblyBuffer(a);taken=a.takeCompleteFrame();assertSame(owned,taken);assertArrayEquals(frame,taken);
                a.close();assertArrayEquals(frame,taken);denied(a::takeCompleteFrame);
                byte[] piece=assemblyPiece(x,frame,0);try{denied(()->a.accept(0,piece));assertArrayEquals(assemblyPiece(x,frame,0),piece);}finally{Arrays.fill(piece,(byte)0);}
                assertFalse(Files.exists(x.f.dir));NativePrivateCustodyOwnerTest.sameFiles(original,x.f.x.f.dir);
            }finally{Arrays.fill(frame,(byte)0);if(taken!=null)Arrays.fill(taken,(byte)0);}
        }
    }
    @Test public void currentFrameAssemblyInvalidPiecesCloseAndWipe()throws Exception {
        try(var x=new AssemblyFixture()){
            var pins=x.f.engine.currentOriginalPrivateCustodyFramePins(x.f.plan);byte[] frame=assemblyFrame(x),piece=assemblyPiece(x,frame,0);
            try{
                denied(()->new NativePrivateCustodyCurrentFrameAssembler(null));
                for(int mode=0;mode<6;mode++)try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){
                    byte[] buffer=assemblyBuffer(a);a.accept(0,piece);int index=mode==0?0:mode==1?-1:mode==2?pins.chunkCount():1;
                    byte[] next=mode==3?null:assemblyPiece(x,frame,Math.min(1,pins.chunkCount()-1));
                    if(mode==4)next=Arrays.copyOf(next,next.length-1);if(mode==5)next[0]^=1;
                    final byte[] borrowed=next,before=next==null?null:next.clone();
                    try{denied(()->a.accept(index,borrowed));zeroed(buffer);assertNull(assemblyBuffer(a));denied(a::takeCompleteFrame);
                        if(before!=null)assertArrayEquals(before,borrowed);}
                    finally{if(next!=null)Arrays.fill(next,(byte)0);if(before!=null)Arrays.fill(before,(byte)0);}
                }
            }finally{Arrays.fill(frame,(byte)0);Arrays.fill(piece,(byte)0);}
        }
    }
    @Test public void currentFrameAssemblyMissingOrCorruptedWholeFrameCloses()throws Exception {
        try(var x=new AssemblyFixture()){
            var pins=x.f.engine.currentOriginalPrivateCustodyFramePins(x.f.plan);byte[] frame=assemblyFrame(x);
            try{
                try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){byte[] buffer=assemblyBuffer(a),piece=assemblyPiece(x,frame,0);
                    try{a.accept(0,piece);denied(a::takeCompleteFrame);zeroed(buffer);}finally{Arrays.fill(piece,(byte)0);}}
                try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){
                    for(int i=0;i<pins.chunkCount();i++){byte[] piece=assemblyPiece(x,frame,i);try{a.accept(i,piece);}finally{Arrays.fill(piece,(byte)0);}}
                    byte[] buffer=assemblyBuffer(a);buffer[0]^=1;denied(a::takeCompleteFrame);zeroed(buffer);assertNull(assemblyBuffer(a));
                }
                try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){byte[] buffer=assemblyBuffer(a);a.close();a.close();zeroed(buffer);denied(a::takeCompleteFrame);}
            }finally{Arrays.fill(frame,(byte)0);}
        }
    }
    @Test public void currentFrameAssemblyStaleOwnerOrClosedPlanPreservesBorrowedBytes()throws Exception {
        try(var x=new AssemblyFixture()){
            var pins=x.f.engine.currentOriginalPrivateCustodyFramePins(x.f.plan);byte[] frame=assemblyFrame(x),piece=assemblyPiece(x,frame,0),before=piece.clone();
            try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){
                byte[] buffer=assemblyBuffer(a);a.accept(0,piece);x.f.plan.close();denied(()->a.accept(1,piece));zeroed(buffer);
                assertArrayEquals(before,piece);denied(()->new NativePrivateCustodyCurrentFrameAssembler(pins));
            }finally{Arrays.fill(frame,(byte)0);Arrays.fill(piece,(byte)0);Arrays.fill(before,(byte)0);}
        }
        try(var x=new AssemblyFixture()){
            var pins=x.f.engine.currentOriginalPrivateCustodyFramePins(x.f.plan);byte[] frame=assemblyFrame(x);
            try(var a=new NativePrivateCustodyCurrentFrameAssembler(pins)){
                for(int i=0;i<pins.chunkCount();i++){byte[] piece=assemblyPiece(x,frame,i);try{a.accept(i,piece);}finally{Arrays.fill(piece,(byte)0);}}
                byte[] buffer=assemblyBuffer(a);
                x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("frame-assembly-owner-change","synthetic");
                denied(a::takeCompleteFrame);zeroed(buffer);
            }finally{Arrays.fill(frame,(byte)0);}
        }
    }
    /** Guarded original operation and actual Engine pins factory. No HTTP,
     * forged pins, reflected capability constructor or durability override. */
    private static final class AssemblyCopyFixture implements AutoCloseable {
        final NativePrivateCustodyExchangeTest.GuardedIdentityFixture f;
        final VaultEngine.NativePrivateCustodyCurrentFramePins pins;
        final JSONObject metadata;
        final byte[] frame;
        final java.util.Map<String,byte[]> capsule,operation;
        AssemblyCopyFixture()throws Exception {
            f=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture();byte[] captured=null;
            java.util.Map<String,byte[]> savedCapsule=null,savedOperation=null;
            try{
                pins=f.engine.currentOriginalPrivateCustodyFramePins(f.plan);
                metadata=pins.metadataForAssembly();
                assertEquals(java.util.Set.of("frame_bytes","chunk_count","frame_sha256","chunks"),metadata.keySet());
                frame=captured=((byte[])NativePrivateCustodyExchangeTest.field(f.x.frame,"encoded")).clone();
                assertEquals(frame.length,metadata.getInt("frame_bytes"));assertTrue(metadata.getInt("chunk_count")>=2);
                assertEquals(NativeRetainedAttempt.hash(frame),metadata.getString("frame_sha256"));
                assertEquals(metadata.getInt("chunk_count"),metadata.getJSONArray("chunks").length());
                for(int i=0;i<metadata.getInt("chunk_count");i++)assertEquals(
                    java.util.Set.of("chunk_index","offset","chunk_bytes","chunk_sha256"),metadata.getJSONArray("chunks").getJSONObject(i).keySet());
                savedCapsule=NativePrivateCustodyOwnerTest.files(f.x.f.dir);savedOperation=NativePrivateCustodyOwnerTest.files(f.x.dir);
                capsule=savedCapsule;operation=savedOperation;assertFalse(Files.exists(f.dir));
            }catch(Exception|Error failure){
                if(captured!=null)Arrays.fill(captured,(byte)0);
                if(savedCapsule!=null)NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(savedCapsule);
                if(savedOperation!=null)NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(savedOperation);
                f.close();throw failure;
            }
        }
        int count()throws Exception{return metadata.getInt("chunk_count");}
        byte[] piece(int index)throws Exception {
            var row=metadata.getJSONArray("chunks").getJSONObject(index);int offset=row.getInt("offset");
            return Arrays.copyOfRange(frame,offset,offset+row.getInt("chunk_bytes"));
        }
        void fill(NativePrivateCustodyCurrentFrameAssembler assembler)throws Exception {
            for(int i=count()-1;i>=0;i--){byte[] piece=piece(i),before=piece.clone();
                try{assembler.accept(i,piece);assertArrayEquals(before,piece);Arrays.fill(piece,(byte)0);}
                finally{Arrays.fill(piece,(byte)0);Arrays.fill(before,(byte)0);}}
        }
        void originals()throws Exception {
            NativePrivateCustodyOwnerTest.sameFiles(capsule,f.x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operation,f.x.dir);
            assertFalse(Files.exists(f.dir)); // No exchange preparation/append/dispatch.
        }
        @Override public void close(){
            Arrays.fill(frame,(byte)0);NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(capsule);
            NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(operation);f.close();
        }
    }
    @Test public void ASSEMBLY_COPY_NEW_detachedMetadataCannotRetargetEitherAssembler()throws Exception {
        try(var x=new AssemblyCopyFixture();var first=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
            byte[] firstOwned=assemblyBuffer(first),firstTaken=null,secondTaken=null;
            JSONObject separate=x.pins.metadataForAssembly();
            separate.put("frame_bytes",1).put("chunk_count",1).put("frame_sha256","0".repeat(64));
            var row=separate.getJSONArray("chunks").getJSONObject(0);
            row.put("chunk_index",77).put("offset",77).put("chunk_bytes",1).put("chunk_sha256","0".repeat(64));
            separate.getJSONArray("chunks").put(new JSONObject().put("untrusted","not a plan"));
            assertTrue(x.metadata.similar(x.pins.metadataForAssembly()));
            try(var second=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
                byte[] secondOwned=assemblyBuffer(second);assertNotSame(firstOwned,secondOwned);
                try{
                    x.fill(first);x.fill(second);firstTaken=first.takeCompleteFrame();secondTaken=second.takeCompleteFrame();
                    assertSame(firstOwned,firstTaken);assertSame(secondOwned,secondTaken);
                    assertArrayEquals(x.frame,firstTaken);assertArrayEquals(x.frame,secondTaken);
                    first.close();second.close();assertArrayEquals(x.frame,firstTaken);assertArrayEquals(x.frame,secondTaken);
                    denied(first::takeCompleteFrame);denied(second::takeCompleteFrame);x.originals();
                }finally{if(firstTaken!=null)Arrays.fill(firstTaken,(byte)0);if(secondTaken!=null)Arrays.fill(secondTaken,(byte)0);}
            }
        }
    }
    @Test public void ASSEMBLY_COPY_NEW_sourceWithdrawalRefusesAcceptAndTransfer()throws Exception {
        for(boolean transfer:new boolean[]{false,true})try(var x=new AssemblyCopyFixture();var assembler=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
            byte[] borrowed=x.piece(1),before=borrowed.clone(),owned=assemblyBuffer(assembler);
            try{
                if(transfer)x.fill(assembler);
                var rows=x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");
                rows.put("assembly-copy-withdrawal","synthetic unresolved original retained");var changed=new java.util.HashMap<>(rows);
                if(transfer)denied(assembler::takeCompleteFrame);else denied(()->assembler.accept(1,borrowed));
                zeroed(owned);assertNull(assemblyBuffer(assembler));assertArrayEquals(before,borrowed);
                assertEquals(changed,rows);x.originals();
            }finally{Arrays.fill(borrowed,(byte)0);Arrays.fill(before,(byte)0);}
        }
    }
    private static java.nio.file.Path replaceAssemblyOperation(AssemblyCopyFixture x,String suffix)throws Exception {
        var file=x.f.x.committed;var root=x.f.x.f.root;
        var preserved=root.resolve("assembly-copy-original-operation-"+suffix);
        var replacement=root.resolve("assembly-copy-replacement-"+suffix);
        var before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(before.fileKey());byte[] bytes=Files.readAllBytes(file);
        try{
            Files.createLink(preserved,file);Files.copy(file,replacement);
            Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            Files.setLastModifiedTime(replacement,before.lastModifiedTime());
            Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            var after=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertNotEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
            assertEquals(before.fileKey(),Files.readAttributes(preserved,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            assertArrayEquals(bytes,Files.readAllBytes(file));assertArrayEquals(bytes,Files.readAllBytes(preserved));return preserved;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    @Test public void ASSEMBLY_COPY_NEW_sameBytesOperationReplacementRefusesAcceptAndTransfer()throws Exception {
        for(boolean transfer:new boolean[]{false,true})try(var x=new AssemblyCopyFixture();var assembler=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
            byte[] borrowed=x.piece(1),before=borrowed.clone(),owned=assemblyBuffer(assembler);
            try{
                if(transfer)x.fill(assembler);
                var preserved=replaceAssemblyOperation(x,transfer?"transfer":"accept");
                if(transfer)denied(assembler::takeCompleteFrame);else denied(()->assembler.accept(1,borrowed));
                zeroed(owned);assertNull(assemblyBuffer(assembler));assertArrayEquals(before,borrowed);assertTrue(Files.exists(preserved));x.originals();
            }finally{Arrays.fill(borrowed,(byte)0);Arrays.fill(before,(byte)0);}
        }
    }
    @Test public void ASSEMBLY_COPY_NEW_partialDuplicateAndBadPieceKeepInputsAndWipe()throws Exception {
        try(var x=new AssemblyCopyFixture()){
            for(int mode=0;mode<3;mode++)try(var assembler=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
                byte[] owned=assemblyBuffer(assembler),first=x.piece(0),next=x.piece(mode==1?0:1);
                if(mode==2)next[0]^=1;byte[] before=next.clone();
                try{
                    assembler.accept(0,first);Arrays.fill(first,(byte)0);
                    if(mode==0)denied(assembler::takeCompleteFrame);
                    else {final int index=mode==1?0:1;denied(()->assembler.accept(index,next));}
                    assertArrayEquals(before,next);zeroed(owned);assertNull(assemblyBuffer(assembler));denied(assembler::takeCompleteFrame);x.originals();
                }finally{Arrays.fill(first,(byte)0);Arrays.fill(next,(byte)0);Arrays.fill(before,(byte)0);}
            }
        }
    }
    // Read observation of an existing SYNTHETIC raw-row map only. The actual
    // guarded SharedPreferences reader/pins/Engine remain untouched. This is
    // not a fake currentness guard, native IO measurement or authority port.
    private static final class AssemblyCopyReadRows extends java.util.HashMap<String,Object> {
        int reads;
        AssemblyCopyReadRows(java.util.Map<String,Object> original){super(original);}
        @Override public java.util.Set<java.util.Map.Entry<String,Object>> entrySet(){reads++;return super.entrySet();}
    }
    @Test public void ASSEMBLY_COPY_NEW_closeAfterWithdrawalWipesWithoutSourceRead()throws Exception {
        try(var x=new AssemblyCopyFixture()){
            var source=x.f.x.f.x.f.x;
            var rows=new AssemblyCopyReadRows(source.unknown.get("MemphisZooCustodialNativeVaultV1"));
            source.unknown.put("MemphisZooCustodialNativeVaultV1",rows);
            try(var assembler=new NativePrivateCustodyCurrentFrameAssembler(x.pins)){
                byte[] owned=assemblyBuffer(assembler),piece=x.piece(0),before=piece.clone();
                try{
                    assembler.accept(0,piece);assertArrayEquals(before,piece);assertTrue(rows.reads>0);
                    rows.put("assembly-copy-close-withdrawal","synthetic unresolved original retained");
                    int reads=rows.reads;assembler.close();assembler.close();
                    assertEquals("close must wipe without consulting current authority",reads,rows.reads);
                    zeroed(owned);assertNull(assemblyBuffer(assembler));assertArrayEquals(before,piece);
                    // Detect withdrawal only AFTER checking close's no-read
                    // boundary; prechecking could invalidate pins and mask IO.
                    denied(x.pins::requireCurrent);assertTrue(rows.containsKey("assembly-copy-close-withdrawal"));x.originals();
                }finally{Arrays.fill(piece,(byte)0);Arrays.fill(before,(byte)0);}
            }
        }
    }
    @Rule public final TestWatcher stages=new TestWatcher(){
        @Override protected void starting(Description d){System.out.println("NEW_PIECE_CASE_START "+d.getMethodName());System.out.flush();}
        @Override protected void succeeded(Description d){System.out.println("NEW_PIECE_CASE_PASS "+d.getMethodName());System.out.flush();}
        @Override protected void failed(Throwable e,Description d){System.out.println("NEW_PIECE_CASE_FAIL "+d.getMethodName());System.out.flush();}
    };
    static final class Fixture implements AutoCloseable {
        final NativePrivateCustodyHttpOutcomeTest.Fixture x=new NativePrivateCustodyHttpOutcomeTest.Fixture();
        final NativePrivateCustodyExchangeTest.Fixture f=x.f;
        final List<VaultEngine.NativePrivateCustodyPreparedExchange> queries=new ArrayList<>();
        final List<JSONObject> writeRows=new ArrayList<>();
        final List<Object> parserPins=new ArrayList<>();
        Fixture()throws Exception {
            int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++)try(var w=f.write(i)){writeRows.add(NativePrivateCustodyReplySetTest.readback(w));f.engine.fenceOriginalPrivateCustodyExchange(w);var q=f.query(i);queries.add(q);parserPins.add(null);}
        }
        JSONObject data(int index)throws Exception {
            var q=queries.get(index);byte[] body=NativePrivateCustodyExchangeTest.body(q),frame=((byte[])NativePrivateCustodyExchangeTest.field(f.x.frame,"encoded")).clone(),piece=null;
            try{var b=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);var seen=q.projection();var row=f.plan.chunkMetadata(index);
                piece=Arrays.copyOfRange(frame,row.getInt("offset"),row.getInt("offset")+row.getInt("chunk_bytes"));
                var d=new JSONObject().put("schema","custodial.private-custody-original-frame-piece.v1").put("state","CURRENT_SQL_ORIGINAL_ENCRYPTED_PIECE_NOT_NATIVE_OR_SEMANTIC_ACK")
                    .put("operation_id",b.get("operation_id")).put("generation_id",b.get("original_generation_id")).put("principal_digest",b.get("principal_digest"))
                    .put("original_frozen_work_sha256",b.get("original_frozen_work_sha256")).put("frame_sha256",b.get("frame_sha256")).put("record_sha256",b.get("record_sha256"))
                    .put("plan_sha256",b.get("plan_sha256")).put("chunk_sha256",b.get("chunk_sha256")).put("encrypted_piece_base64",NativeRetainedAttempt.encodeBase64(piece))
                    .put("readback",new JSONObject(writeRows.get(index).toString()))
                    .put("query_witness",new JSONObject().put("native_request_id",seen.get("native_request_id")).put("request_body_sha256",seen.get("request_body_sha256"))
                        .put("attestation_digest",seen.get("attestation_digest")).put("purpose_binding_sha256",seen.get("purpose_binding_sha256"))
                        .put("target_prepared_record_sha256",seen.get("target_write_record_sha256")).put("target_unknown_record_sha256",seen.get("target_unknown_record_sha256")));
                for(String key:new String[]{"engine_revision","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes"})d.put(key,Long.parseLong(b.getString(key)));
                for(String key:new String[]{"current_SQL_snapshot_frame_readback","frame_complete_syntax_verified","exact_authenticated_original_owner_proof_bytes_match",
                    "read_snapshot_is_not_future_acceptance_or_transaction_write_authority"})d.put(key,true);
                for(String key:new String[]{"original_device_key_GCM_server_verified","raw_namespace_values_recovered","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard",
                    "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})d.put(key,false);return d;
            }finally{for(byte[] v:new byte[][]{body,frame,piece})if(v!=null)Arrays.fill(v,(byte)0);}
        }
        static byte[] wire(JSONObject d)throws Exception{return new JSONObject().put("ok",true).put("data",d).toString().getBytes(StandardCharsets.UTF_8);}
        void send(int index,JSONObject d)throws Exception{byte[] response=wire(d);try{x.configure=()->x.connection.response=response;x.send(queries.get(index));}finally{Arrays.fill(response,(byte)0);}}
        void sendAll()throws Exception{for(int i=0;i<queries.size();i++)send(i,data(i));}
        VaultEngine.NativePrivateCustodyReturnedPieceSetObservation observe()throws Exception{return f.engine.observeOriginalPrivateCustodyReturnedPieceSet(f.plan,queries);}
        @Override public void close(){for(var q:queries)q.close();x.close();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {NativePrivateCustodyOwnerTest.denied(action);}
    static void noAuthority(JSONObject p)throws Exception {
        for(String key:new String[]{"writer_authority","durable_retention","current_SQL_snapshot_frame_readback","current_server_readback","transport_origin_authenticated",
            "actual_native_TLS_runtime_qualified","actual_Android_storage_qualified","actual_Android_keystore_qualified","application_values_applied_or_semantically_accepted",
            "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","raw_byte_record_response_or_credential_getter","original_saved_records_or_queries_modified",
            "replacement_key_IV_signature_operation_or_query_created","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(key,p.getBoolean(key));
        for(String key:new String[]{"encrypted_piece_base64","response_base64","body_base64","owner_proof_base64","original_signed_wire_base64","ciphertext","SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER"})assertFalse(p.toString().contains(key));
        assertTrue(p.getBoolean("bounded_response_cap_unchanged"));assertTrue(p.getBoolean("read_only_assembly_no_additional_store_or_query"));
    }
    /** Parser-only negative seam, deliberately NOT a persisted HTTP/SQL proof. */
    static JSONObject parse(Fixture x,int index,byte[] wire)throws Exception {
        var pins=x.parserPins.get(index);if(pins==null){var type=Class.forName(VaultEngine.class.getName()+"$NativePrivateCustodyReturnedPiecePins");
            var constructor=type.getDeclaredConstructor(VaultEngine.NativePrivateCustodyPreparedExchange.class);constructor.setAccessible(true);pins=constructor.newInstance(x.queries.get(index));x.parserPins.set(index,pins);}
        var method=VaultEngine.class.getDeclaredMethod("parseOriginalPrivateCustodyReturnedPiece",pins.getClass(),byte[].class,byte[].class);method.setAccessible(true);
        try{return (JSONObject)method.invoke(null,pins,wire,null);}
        catch(java.lang.reflect.InvocationTargetException e){if(e.getCause() instanceof VaultFailure)throw (VaultFailure)e.getCause();throw e;}
    }
    static JSONObject parse(Fixture x,int index,JSONObject data)throws Exception{byte[] w=Fixture.wire(data);try{return parse(x,index,w);}finally{Arrays.fill(w,(byte)0);}}
    @Test public void allDurableOriginalQueryPiecesAssembleSameKeyWithoutAuthorityOrStoreWrites()throws Exception {
        try(var x=new Fixture()){x.sendAll();var files=NativePrivateCustodyOwnerTest.files(x.f.dir);var original=NativePrivateCustodyOwnerTest.files(x.f.x.f.dir);
            try(var set=x.observe()){var p=set.projection();noAuthority(p);assertTrue(p.getBoolean("all_original_returned_piece_bindings_present"));assertTrue(p.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                assertTrue(p.getBoolean("exact_original_all8_values_compared_in_native_only"));assertEquals(x.queries.size(),p.getInt("historical_exact_original_returned_pieces"));
                assertEquals(x.f.plan.projection().get("frame_sha256"),p.get("assembled_frame_sha256"));assertEquals(x.f.plan.projection().get("frame_bytes"),p.get("assembled_frame_bytes"));
                assertTrue(p.getBoolean("pieces_retained_in_original_existing_key_encrypted_QUERY_observation_slots"));p.put("key_removal",true);assertFalse(set.projection().getBoolean("key_removal"));
                NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(original,x.f.x.f.dir);assertEquals(x.queries.size(),x.x.opens);}
        }
    }
    @Test public void originalQueryObjectAndJournalHandleRecoveryUsesExactSavedReplyNoRenewalOrSend()throws Exception {
        try(var x=new Fixture()){x.sendAll();var files=NativePrivateCustodyOwnerTest.files(x.f.dir);var previous=new ArrayList<JSONObject>();
            for(var q:x.queries){previous.add(q.projection());q.close();}x.queries.clear();x.f.clock.now+=86400000;
            // Reconstruct the original private journal handle from the same native root.
            var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.x.f.root.toFile());
            for(int i=0;i<previous.size();i++){var q=x.f.engine.prepareOriginalPrivateCustodyQuery(x.f.plan,journal,i);assertEquals(previous.get(i).toString(),q.projection().toString());x.queries.add(q);denied(()->x.x.send(q));}
            try(var set=x.observe()){noAuthority(set.projection());assertTrue(set.projection().getBoolean("all_original_returned_piece_bindings_present"));}
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(previous.size(),x.x.opens);
        }
    }
    @Test public void missingPartialAndAmbiguousOriginalQueryOutcomesRemainPendingWithoutReplacement()throws Exception {
        try(var x=new Fixture()){var first=x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(x.f.plan,List.of());try{assertEquals(0,first.projection().getInt("historical_exact_original_returned_pieces"));noAuthority(first.projection());}finally{first.close();}
            x.send(0,x.data(0));x.x.configure=()->x.x.connection.timeout=true;denied(()->x.x.send(x.queries.get(1)));var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            try(var set=x.observe()){var p=set.projection();noAuthority(p);assertEquals(1,p.getInt("historical_exact_original_returned_pieces"));assertFalse(p.getBoolean("all_original_returned_piece_bindings_present"));assertFalse(p.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));assertEquals(0,p.getInt("assembled_frame_bytes"));}
            denied(()->x.x.send(x.queries.get(1)));NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(2,x.x.opens);
        }
    }
    @Test public void validLegacyQueryAndNon200CannotBecomeEncryptedPieceOrNewQuery()throws Exception {
        try(var x=new Fixture()){byte[] legacy=NativePrivateCustodyReplySetTest.reply(x.writeRows.get(0),true);try{x.x.configure=()->x.x.connection.response=legacy;x.x.send(x.queries.get(0));}finally{Arrays.fill(legacy,(byte)0);}
            x.x.configure=()->{x.x.connection.status=503;x.x.connection.response=new byte[0];};x.x.send(x.queries.get(1));var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            try(var set=x.observe()){var p=set.projection();noAuthority(p);assertEquals(0,p.getInt("historical_exact_original_returned_pieces"));assertFalse(p.getBoolean("all_original_returned_piece_bindings_present"));}
            for(int i=0;i<2;i++){var q=x.queries.get(i);denied(()->x.x.send(q));}NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(2,x.x.opens);
        }
    }
    @Test public void closedSchemaRejectsUnknownMissingDuplicateKeysAndWrongIntegerKinds()throws Exception {
        try(var x=new Fixture()){var data=x.data(0);assertNotNull(parse(x,0,data));var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            var unknown=new JSONObject(data.toString()).put("extra",false);denied(()->parse(x,0,unknown));var missing=new JSONObject(data.toString());missing.remove("query_witness");denied(()->parse(x,0,missing));
            for(Object value:new Object[]{"0",JSONObject.NULL,true}){var wrong=new JSONObject(data.toString()).put("chunk_index",value);denied(()->parse(x,0,wrong));}
            String decimal=new String(Fixture.wire(data),StandardCharsets.UTF_8).replace("\"chunk_index\":0,","\"chunk_index\":0.0,");
            assertTrue(decimal.contains("\"chunk_index\":0.0,"));denied(()->parse(x,0,decimal.getBytes(StandardCharsets.UTF_8)));
            String raw="{\"ok\":true,\"ok\":true,\"data\":"+data+"}";denied(()->parse(x,0,raw.getBytes(StandardCharsets.UTF_8)));
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.x.opens);
        }
    }
    @Test public void queryNonceBodyPurposeAndOriginalWriteUnknownWitnessesAreAllRequired()throws Exception {
        try(var x=new Fixture()){var data=x.data(0);var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            for(String key:new String[]{"native_request_id","request_body_sha256","attestation_digest","purpose_binding_sha256","target_prepared_record_sha256","target_unknown_record_sha256"}){
                var wrong=new JSONObject(data.toString());var w=wrong.getJSONObject("query_witness");w.put(key,key.equals("native_request_id")?x.writeRows.get(0).get("native_request_id"):"a".repeat(64));denied(()->parse(x,0,wrong));}
            var added=new JSONObject(data.toString());added.getJSONObject("query_witness").put("new_request",true);denied(()->parse(x,0,added));
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertEquals(0,x.x.opens);
        }
    }
    @Test public void originalWriteReadbackNotQueryIdentityAndNoRowAuthorityExpansion()throws Exception {
        try(var x=new Fixture()){var data=x.data(0);var wrong=new JSONObject(data.toString());wrong.getJSONObject("readback").put("native_request_id",x.queries.get(0).projection().get("native_request_id"));denied(()->parse(x,0,wrong));
            for(String key:new String[]{"schema","generation_id","request_body_sha256","attestation_digest","received_at"}){var changed=new JSONObject(data.toString());changed.getJSONObject("readback").put(key,"invalid");denied(()->parse(x,0,changed));}
            for(String key:new String[]{"inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"}){
                var changed=new JSONObject(data.toString());changed.getJSONObject("readback").put(key,true);denied(()->parse(x,0,changed));}
        }
    }
    @Test public void sourceFlagsDoNotPermitTruthyValuesOrAnyCustodySemanticAcceptance()throws Exception {
        try(var x=new Fixture()){var data=x.data(0);
            for(String key:new String[]{"current_SQL_snapshot_frame_readback","frame_complete_syntax_verified","exact_authenticated_original_owner_proof_bytes_match","read_snapshot_is_not_future_acceptance_or_transaction_write_authority"}){
                var changed=new JSONObject(data.toString()).put(key,"true");denied(()->parse(x,0,changed));}
            for(String key:new String[]{"original_device_key_GCM_server_verified","raw_namespace_values_recovered","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"}){
                var changed=new JSONObject(data.toString()).put(key,true);denied(()->parse(x,0,changed));}
        }
    }
    @Test public void changedOwnerFramePlanIndexOffsetPieceLengthHashAndNoncanonicalBase64Refuse()throws Exception {
        try(var x=new Fixture()){var data=x.data(0);
            for(String key:new String[]{"operation_id","generation_id","principal_digest","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_sha256"}){
                var changed=new JSONObject(data.toString()).put(key,"b".repeat(64));denied(()->parse(x,0,changed));}
            for(String key:new String[]{"engine_revision","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes"}){var changed=new JSONObject(data.toString()).put(key,data.getLong(key)+1);denied(()->parse(x,0,changed));}
            String encoded=data.getString("encrypted_piece_base64");for(String v:new String[]{encoded+"\n",encoded.substring(1),"",NativeRetainedAttempt.encodeBase64(new byte[VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES+1])}){
                var changed=new JSONObject(data.toString()).put("encrypted_piece_base64",v);denied(()->parse(x,0,changed));}
            byte[] different=NativeRetainedAttempt.base64(encoded,VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES);different[0]^=1;
            try{var changed=new JSONObject(data.toString()).put("encrypted_piece_base64",NativeRetainedAttempt.encodeBase64(different));denied(()->parse(x,0,changed));}finally{Arrays.fill(different,(byte)0);}
        }
    }
    @Test public void pendingObservationOnlyExplicitExactCiphertextResumeMayJoinAndCorruptionIsPreserved()throws Exception {
        try(var x=new Fixture()){x.sendAll();var committed=x.f.dir.resolve("query_observation-0.bin");var pending=x.f.dir.resolve("query_observation-0.pending");byte[] original=Files.readAllBytes(committed);Files.move(committed,pending);
            try(var set=x.observe()){var p=set.projection();noAuthority(p);assertEquals(x.queries.size()-1,p.getInt("historical_exact_original_returned_pieces"));assertFalse(p.getBoolean("all_original_returned_piece_bindings_present"));}
            x.f.engine.resumeOriginalPrivateCustodyExchangeOutcome(x.queries.get(0));assertArrayEquals(original,Files.readAllBytes(committed));
            try(var set=x.observe()){assertTrue(set.projection().getBoolean("all_original_returned_piece_bindings_present"));original[0]^=1;Files.write(committed,original);var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
                denied(set::projection);denied(x::observe);NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);assertArrayEquals(original,Files.readAllBytes(committed));}
            finally{Arrays.fill(original,(byte)0);}assertEquals(x.queries.size(),x.x.opens);
        }
    }
    @Test public void duplicateWriteForeignPlanMixedJournalAndClosedBorrowedOwnerRefuse()throws Exception {
        try(var x=new Fixture()){var q=x.queries.get(0);var files=NativePrivateCustodyOwnerTest.files(x.f.dir);denied(()->x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(x.f.plan,List.of(q,q)));
            try(var write=x.f.write(0)){denied(()->x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(x.f.plan,List.of(write)));}
            denied(()->x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(null,List.of(q)));denied(()->x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(x.f.plan,null));
            var another=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.x.f.root.toFile());try(var other=x.f.engine.prepareOriginalPrivateCustodyQuery(x.f.plan,another,1)){
                denied(()->x.f.engine.observeOriginalPrivateCustodyReturnedPieceSet(x.f.plan,List.of(q,other)));}
            NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);try(var set=x.observe()){q.close();denied(set::projection);}denied(x::observe);assertEquals(0,x.x.opens);
        }
    }
    @Test public void originalKeyChangeAfterFullAssemblyCannotYieldCachedAuthority()throws Exception {
        try(var x=new Fixture()){x.sendAll();try(var set=x.observe()){var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);denied(set::projection);denied(x::observe);NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);}
        }
    }
    @Test public void originalNamespaceChangeAfterFullAssemblyCannotYieldCachedAuthority()throws Exception {
        try(var x=new Fixture()){x.sendAll();try(var set=x.observe()){var files=NativePrivateCustodyOwnerTest.files(x.f.dir);
            x.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("returned-pieces-owner-change","synthetic");denied(set::projection);denied(x::observe);NativePrivateCustodyOwnerTest.sameFiles(files,x.f.dir);}
        }
    }
    // BEGIN TASK10 CURRENT_FRAME_CONSUMER: independent of Task8 assembly cases.
    // Actual Engine/assembler/journal/crypto code executes; the connection,
    // enrollment credential and clock remain explicit disposable TEST inputs.
    // A bounded run that stops during preparation proves no later phase.
    private static void currentFrameConsumerMark(String phase){
        System.out.println("CURRENT_FRAME_CONSUMER_PHASE "+phase);System.out.flush();
    }
    private static final class CurrentFrameConsumerIssuer implements AutoCloseable {
        private static final String PROPERTY="custodial.fixture.backend-admissible-credential";
        private final String previous=System.getProperty(PROPERTY);
        CurrentFrameConsumerIssuer(){System.setProperty(PROPERTY,"true");}
        @Override public void close(){if(previous==null)System.clearProperty(PROPERTY);else System.setProperty(PROPERTY,previous);}
    }
    /** Uses existing constructors only, never historical @Test methods. */
    private static final class CurrentFrameConsumerFixture implements AutoCloseable {
        final Fixture original;
        final List<NativePrivateCustodyHttpOutcomeTest.Connection> connections=new ArrayList<>();
        final List<byte[]> responses=new ArrayList<>();
        NativePrivateCustodyHttpOutcomeTest.Hook beforeReply=()->{};
        CurrentFrameConsumerFixture()throws Exception {
            currentFrameConsumerMark("fixture_and_original_QUERY_preparation_begin");
            try(var issuer=new CurrentFrameConsumerIssuer()){original=new Fixture();}
            currentFrameConsumerMark("all_original_QUERY_prepared");
            try{for(int i=0;i<original.queries.size();i++){
                currentFrameConsumerMark("QUERY_UNKNOWN_begin_"+i);
                original.f.engine.fenceOriginalPrivateCustodyExchange(original.queries.get(i));
                currentFrameConsumerMark("QUERY_UNKNOWN_complete_"+i);
            }}catch(Exception|Error failed){original.close();throw failed;}
        }
        NativePrivateCustodyHttp http() {
            return new NativePrivateCustodyHttp(url->{
                assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                assertFalse("HTTP must be outside Engine monitor",Thread.holdsLock(original.f.engine));
                int index=connections.size();assertTrue(index<responses.size());
                var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);
                connection.response=responses.get(index);connection.onReply=beforeReply;connections.add(connection);
                currentFrameConsumerMark("current_transport_open_"+index);return connection;
            },original.f.clock);
        }
        void exactResponses()throws Exception {
            for(int i=0;i<original.queries.size();i++){
                currentFrameConsumerMark("original_piece_response_begin_"+i);
                responses.add(Fixture.wire(original.data(i)));
                currentFrameConsumerMark("original_piece_response_complete_"+i);
            }
        }
        VaultEngine.NativePrivateCustodyCurrentFrameRead read()throws Exception {
            currentFrameConsumerMark("owning_current_frame_read_begin");
            var result=original.f.engine.readCurrentOriginalPrivateCustodyFrame(original.f.plan,original.f.journal,http(),new NativePrivateCustodyFrameReadControl());
            currentFrameConsumerMark("owning_current_frame_read_returned");return result;
        }
        void closedConnections(){for(var connection:connections)assertEquals(1,connection.disconnects);}
        @Override public void close(){for(byte[] response:responses)Arrays.fill(response,(byte)0);original.close();}
    }
    /** Explicit single new selector; not a whole-class JUnit/suite replay.
     * Kept distinct from any Task8 main/assembly selector. */
    public static void runCurrentFrameConsumerOnly(String name)throws Exception {
        if(!java.util.Set.of("CURRENT_FRAME_CONSUMER_missingOriginalSlotsOpenZeroConnections",
            "CURRENT_FRAME_CONSUMER_allOriginalPiecesYieldCurrentTypedSameKeyRead",
            "CURRENT_FRAME_CONSUMER_changedOwnerDuringReplyRefusesWithoutJournalWrites",
            "CURRENT_FRAME_CONSUMER_changedIssuedUnknownDuringReplyRefusesAndPreserves",
            "CURRENT_FRAME_CONSUMER_duplicatePieceCannotBecomeCompleteFrame",
            "CURRENT_FRAME_CONSUMER_legacyReplyCannotBecomeCompleteFrame",
            "CURRENT_FRAME_CONSUMER_partialTransportCannotBecomeCompleteFrame").contains(name))throw new AssertionError("explicit_current_frame_consumer_selector_required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,name));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures()){
                var error=failure.getException();System.err.println("CURRENT_FRAME_CONSUMER_FAILURE_CLASS "+error.getClass().getName());
                if(error instanceof VaultFailure&&((VaultFailure)error).code.matches("[A-Za-z0-9_]{1,96}"))System.err.println("CURRENT_FRAME_CONSUMER_FAILURE_CODE "+((VaultFailure)error).code);
                for(var point:error.getStackTrace())System.err.println("CURRENT_FRAME_CONSUMER_FAILURE_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
            }
            throw new AssertionError("current_frame_consumer_case_failed");
        }
        System.out.println("PASS_SOURCE_MOCK "+name);System.out.flush();
    }
    @Test public void CURRENT_FRAME_CONSUMER_missingOriginalSlotsOpenZeroConnections()throws Exception {
        final NativePrivateCustodyExchangeTest.Fixture f;
        try(var issuer=new CurrentFrameConsumerIssuer()){f=new NativePrivateCustodyExchangeTest.Fixture();}
        try(f){
            final int[] opens={0};var http=new NativePrivateCustodyHttp(url->{opens[0]++;throw new AssertionError("missing original reached IO");},f.clock);
            var capsule=NativePrivateCustodyOwnerTest.files(f.x.f.dir);boolean priorDirectory=Files.exists(f.dir);
            currentFrameConsumerMark("missing_original_QUERY_read_begin");
            denied(()->f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,new NativePrivateCustodyFrameReadControl()));
            currentFrameConsumerMark("missing_original_QUERY_refused");
            assertEquals(0,opens[0]);assertEquals(priorDirectory,Files.exists(f.dir));NativePrivateCustodyOwnerTest.sameFiles(capsule,f.x.f.dir);
            try(var write=f.write(0)){
                f.engine.fenceOriginalPrivateCustodyExchange(write);
                try(var query=f.query(0)){
                    var saved=NativePrivateCustodyOwnerTest.files(f.dir);
                    assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                    currentFrameConsumerMark("missing_issued_QUERY_UNKNOWN_read_begin");
                    denied(()->f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,new NativePrivateCustodyFrameReadControl()));
                    currentFrameConsumerMark("missing_issued_QUERY_UNKNOWN_refused");
                    assertEquals(0,opens[0]);NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,f.x.f.dir);
                    f.engine.fenceOriginalPrivateCustodyExchange(query);assertTrue(f.plan.projection().getInt("chunk_count")>1);
                    var issuedFirst=NativePrivateCustodyOwnerTest.files(f.dir);assertFalse(Files.exists(f.dir.resolve("query-1.bin")));
                    currentFrameConsumerMark("later_missing_original_QUERY_read_begin");
                    denied(()->f.engine.readCurrentOriginalPrivateCustodyFrame(f.plan,f.journal,http,new NativePrivateCustodyFrameReadControl()));
                    currentFrameConsumerMark("later_missing_original_QUERY_refused");
                    assertEquals(0,opens[0]);NativePrivateCustodyOwnerTest.sameFiles(issuedFirst,f.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,f.x.f.dir);
                }
            }
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_allOriginalPiecesYieldCurrentTypedSameKeyRead()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.exactResponses();var original=x.original;var saved=NativePrivateCustodyOwnerTest.files(original.f.dir);
            var capsule=NativePrivateCustodyOwnerTest.files(original.f.x.f.dir);
            var queryBodies=new ArrayList<byte[]>();for(var query:original.queries)queryBodies.add(NativePrivateCustodyExchangeTest.body(query));
            original.f.clock.now+=86_400_000; // Historical original headers, fresh outer read only; synthetic clock.
            try(var result=x.read()){
                currentFrameConsumerMark("current_typed_projection_begin");var p=result.projection();currentFrameConsumerMark("current_typed_projection_complete");
                assertEquals("custodial.native-current-original-frame-read.v1",p.get("schema"));
                assertTrue(p.getBoolean("all_fixed_original_query_and_issued_witnesses_current"));assertTrue(p.getBoolean("transport_origin_authenticated"));
                assertEquals(original.queries.size(),p.getInt("current_transport_piece_count"));
                for(String flag:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,p.getBoolean(flag));
                var crypto=p.getJSONObject("crypto");assertTrue(crypto.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                assertTrue(crypto.getBoolean("exact_original_all8_values_compared_in_native_only"));
                assertEquals(NativeRetainedAttempt.hash((byte[])NativePrivateCustodyExchangeTest.field(original.f.x.frame,"encoded")),crypto.get("returned_frame_sha256"));
                assertEquals("UNKNOWN",crypto.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",crypto.get("browser_inventory_state"));
                assertFalse(crypto.getBoolean("application_values_applied_or_semantically_accepted"));assertFalse(crypto.getBoolean("raw_byte_record_or_credential_getter"));
                for(String flag:new String[]{"new_work_allowed","resend_allowed","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,crypto.getBoolean(flag));
                assertEquals(original.queries.size(),x.connections.size());
                for(int i=0;i<x.connections.size();i++){
                    var connection=x.connections.get(i);var outer=ProviderWireJson.object(connection.sent.toByteArray(),526336);
                    assertArrayEquals(queryBodies.get(i),java.util.Base64.getDecoder().decode(outer.getString("original_query_body_base64")));
                    assertEquals(original.queries.get(i).projection().get("native_request_id"),connection.headers.get("X-Memphis-Native-Request-Id"));
                }
                NativePrivateCustodyOwnerTest.sameFiles(saved,original.f.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,original.f.x.f.dir);x.closedConnections();
                original.f.clock.now+=120001;denied(result::projection); // A typed read must not outlive its actual observation freshness.
            }finally{for(byte[] body:queryBodies)Arrays.fill(body,(byte)0);}
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_changedOwnerDuringReplyRefusesWithoutJournalWrites()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.exactResponses();var saved=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            x.beforeReply=()->x.original.f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("current-frame-owner-change","synthetic");
            denied(x::read);assertEquals(1,x.connections.size());x.closedConnections();NativePrivateCustodyOwnerTest.sameFiles(saved,x.original.f.dir);
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_changedIssuedUnknownDuringReplyRefusesAndPreserves()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.exactResponses();var path=x.original.f.dir.resolve("query_unknown-0.bin");byte[] corrupted=Files.readAllBytes(path);corrupted[0]^=1;
            final java.util.Map<String,byte[]>[] afterFault=new java.util.Map[1];
            x.beforeReply=()->{Files.write(path,corrupted);afterFault[0]=NativePrivateCustodyOwnerTest.files(x.original.f.dir);};
            try{denied(x::read);assertEquals(1,x.connections.size());x.closedConnections();assertNotNull(afterFault[0]);
                NativePrivateCustodyOwnerTest.sameFiles(afterFault[0],x.original.f.dir);assertArrayEquals(corrupted,Files.readAllBytes(path));
            }finally{Arrays.fill(corrupted,(byte)0);}
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_duplicatePieceCannotBecomeCompleteFrame()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.exactResponses();Arrays.fill(x.responses.set(1,x.responses.get(0).clone()),(byte)0);
            var saved=NativePrivateCustodyOwnerTest.files(x.original.f.dir);denied(x::read);assertEquals(2,x.connections.size());x.closedConnections();
            NativePrivateCustodyOwnerTest.sameFiles(saved,x.original.f.dir);
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_legacyReplyCannotBecomeCompleteFrame()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.responses.add(NativePrivateCustodyReplySetTest.reply(x.original.writeRows.get(0),true));
            var saved=NativePrivateCustodyOwnerTest.files(x.original.f.dir);denied(x::read);assertEquals(1,x.connections.size());x.closedConnections();
            NativePrivateCustodyOwnerTest.sameFiles(saved,x.original.f.dir);
        }
    }
    @Test public void CURRENT_FRAME_CONSUMER_partialTransportCannotBecomeCompleteFrame()throws Exception {
        try(var x=new CurrentFrameConsumerFixture()){
            x.exactResponses();var saved=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            x.beforeReply=()->{if(x.connections.size()==2)x.connections.get(1).timeout=true;};
            denied(x::read);assertEquals(2,x.connections.size());x.closedConnections();NativePrivateCustodyOwnerTest.sameFiles(saved,x.original.f.dir);
        }
    }
    // END TASK10 CURRENT_FRAME_CONSUMER.

    // NEW current-read -> existing completion semantics only. Reuse the real
    // guarded-eight owner fixture; never construct semantic JSON/observations
    // or add a cipher/backend. Main alone executes this pending source case.
    private static JSONObject currentCompletionPiece(VaultEngine.NativePrivateCustodyChunkIdentityPlan plan,
        VaultEngine.NativePrivateCustodyPreparedExchange query,JSONObject write,byte[] frame,int index)throws Exception {
        byte[] body=NativePrivateCustodyExchangeTest.body(query),piece=null;
        try {
            var b=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);var seen=query.projection();var row=plan.chunkMetadata(index);
            piece=Arrays.copyOfRange(frame,row.getInt("offset"),row.getInt("offset")+row.getInt("chunk_bytes"));
            // SAME existing synthetic server-piece recipe as Fixture.data,
            // sourced from actual prepared original bodies/frame/witnesses.
            var d=new JSONObject().put("schema","custodial.private-custody-original-frame-piece.v1")
                .put("state","CURRENT_SQL_ORIGINAL_ENCRYPTED_PIECE_NOT_NATIVE_OR_SEMANTIC_ACK")
                .put("operation_id",b.get("operation_id")).put("generation_id",b.get("original_generation_id"))
                .put("principal_digest",b.get("principal_digest")).put("original_frozen_work_sha256",b.get("original_frozen_work_sha256"))
                .put("frame_sha256",b.get("frame_sha256")).put("record_sha256",b.get("record_sha256"))
                .put("plan_sha256",b.get("plan_sha256")).put("chunk_sha256",b.get("chunk_sha256"))
                .put("encrypted_piece_base64",NativeRetainedAttempt.encodeBase64(piece)).put("readback",write)
                .put("query_witness",new JSONObject().put("native_request_id",seen.get("native_request_id"))
                    .put("request_body_sha256",seen.get("request_body_sha256")).put("attestation_digest",seen.get("attestation_digest"))
                    .put("purpose_binding_sha256",seen.get("purpose_binding_sha256"))
                    .put("target_prepared_record_sha256",seen.get("target_write_record_sha256"))
                    .put("target_unknown_record_sha256",seen.get("target_unknown_record_sha256")));
            for(String key:new String[]{"engine_revision","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes"})d.put(key,Long.parseLong(b.getString(key)));
            for(String key:new String[]{"current_SQL_snapshot_frame_readback","frame_complete_syntax_verified","exact_authenticated_original_owner_proof_bytes_match",
                "read_snapshot_is_not_future_acceptance_or_transaction_write_authority"})d.put(key,true);
            for(String key:new String[]{"original_device_key_GCM_server_verified","raw_namespace_values_recovered","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard",
                "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})d.put(key,false);
            return d;
        } finally {Arrays.fill(body,(byte)0);if(piece!=null)Arrays.fill(piece,(byte)0);}
    }
    private static void runCurrentFrameCompletionOnly()throws Exception {
        String name="CURRENT_FRAME_COMPLETION_sameOriginalSemanticsOwnLiveReadAndRetainUnknownRows";
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedPieceSetTest.class,name));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures()){
                var error=failure.getException();System.err.println("CURRENT_FRAME_COMPLETION_FAILURE_CLASS "+error.getClass().getName());
                if(error instanceof VaultFailure&&((VaultFailure)error).code.matches("[A-Za-z0-9_]{1,96}"))System.err.println("CURRENT_FRAME_COMPLETION_FAILURE_CODE "+((VaultFailure)error).code);
                for(var point:error.getStackTrace())System.err.println("CURRENT_FRAME_COMPLETION_FAILURE_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
            }
            throw new AssertionError("current_frame_completion_case_failed");
        }
        System.out.println("PASS_SOURCE_MOCK "+name);System.out.flush();
    }
    /** Synthetic HTTPS metadata is assembled from this actual guarded owner's
     * QUERY/proof/principal. Only the four server-only mappings are invented
     * unit data; this never supplies manager approval or native permission. */
    @Test public void G08_TARGET_sameOriginalReadTransfersOnlyUnapprovedMetadata()throws Exception {
        try(var issuer=new CurrentFrameConsumerIssuer();var original=new NativePrivateCustodyOperationTest.Fixture(true);
            var operation=original.prepare();var plan=original.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var engine=original.f.engine();var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(original.f.root.toFile());
            var clock=original.f.x.f.x.f.batch.old.clock;
            var queries=new ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();var responses=new ArrayList<byte[]>();
            var connections=new ArrayList<NativePrivateCustodyHttpOutcomeTest.Connection>();
            byte[] frame=((byte[])NativePrivateCustodyExchangeTest.field(original.frame,"encoded")).clone(),queryBytes=null,proofBytes=null;
            String[] limits={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
            try{
                currentFrameConsumerMark("g08_original_prepare_begin");
                for(int i=0;i<plan.projection().getInt("chunk_count");i++)try(var write=engine.prepareOriginalPrivateCustodyWrite(plan,journal,i)){
                    var row=NativePrivateCustodyReplySetTest.readback(write);engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=engine.prepareOriginalPrivateCustodyQuery(plan,journal,i);queries.add(query);engine.fenceOriginalPrivateCustodyExchange(query);
                    responses.add(Fixture.wire(currentCompletionPiece(plan,query,row,frame,i)));
                }
                queryBytes=NativePrivateCustodyExchangeTest.body(queries.get(0));
                var query=ProviderWireJson.object(queryBytes,NativeRetainedAttempt.MAX_BODY);
                proofBytes=NativeRetainedAttempt.base64(query.getString("owner_proof_base64"),262144);
                var proof=ProviderWireJson.object(proofBytes,262144);
                var old=original.f.x.f.x.f.batch.old;var principal=old.principal.readFor(old.engine.getState());
                var target=new JSONObject();
                for(String key:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"})target.put(key,query.get(key));
                for(String key:new String[]{"credential_id","original_wire_sha256","capsule_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})target.put(key,proof.get(key));
                target.put("employee_id",principal.getString("employee_id")).put("assignment_epoch",principal.get("assignment_epoch").toString())
                    .put("canonical_device_id",principal.getString("device_id"))
                    .put("separation_id","95000000-0000-4000-8000-000000000101").put("separation_authority_revision","7")
                    .put("canonical_device_pk","95000000-0000-4000-8000-000000000102").put("original_credential_secret_key_id","c".repeat(64));
                String targetSha=NativeSameOriginalRecoveryPreparationWire.decodeTarget(target.toString().getBytes(StandardCharsets.UTF_8)).documentSha256();
                var saved=NativePrivateCustodyOwnerTest.files(original.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
                var capsule=NativePrivateCustodyOwnerTest.files(original.f.dir);var operationFiles=NativePrivateCustodyOwnerTest.files(original.dir);
                var stable=new NativeRetainedNamespaceCensusTest.Stable(original.f.x.f.x);
                var control=new NativePrivateCustodyFrameReadControl();
                var http=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());assertFalse(Thread.holdsLock(engine));
                    var c=new NativePrivateCustodyHttpOutcomeTest.Connection(url);c.response=responses.get(connections.size());connections.add(c);return c;
                },clock);
                try(var read=engine.readCurrentOriginalPrivateCustodyFrame(plan,journal,http,control)){
                    currentFrameConsumerMark("g08_current_frame_ready");
                    var first=new org.json.JSONArray((String)NativePrivateCustodyExchangeTest.field(read,"reads")).getJSONObject(0);
                    final byte[] originalQuery=queryBytes;final String originalQuerySha=NativeRetainedAttempt.hash(queryBytes);
                    final var queryPins=queries.get(0).projection();final int[] targetOpens={0},wrongOpens={0};
                    final String originalHttpAttestation=((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(queries.get(0),"headers")).get("X-Memphis-Native-Request-Attestation").toString();
                    var targetHttp=new NativePrivateCustodyHttp(url->{
                        targetOpens[0]++;assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/same-original-recovery/target",url.toString());
                        assertFalse(Thread.holdsLock(engine));var c=new NativePrivateCustodyHttpOutcomeTest.Connection(url);connections.add(c);
                        c.onReply=()->{
                            byte[] sent=c.sent.toByteArray(),decoded=null;
                            try{
                                var envelope=ProviderWireJson.object(sent,526336);decoded=NativeRetainedAttempt.base64(envelope.getString("original_query_body_base64"),393216);
                                assertArrayEquals(originalQuery,decoded);assertEquals(first.get("original_query_unknown_record_sha256"),envelope.get("original_query_unknown_record_sha256"));
                                assertEquals(queryPins.get("native_request_timestamp"),envelope.get("original_query_timestamp"));
                                assertEquals(originalHttpAttestation,envelope.get("original_query_http_attestation"));
                                assertEquals(queryPins.get("native_request_id"),c.headers.get("X-Memphis-Native-Request-Id"));
                                assertNotEquals(connections.get(0).headers.get("X-Memphis-Native-Request-Attestation"),c.headers.get("X-Memphis-Native-Request-Attestation"));
                                var deniedLimits=new JSONObject();for(String key:limits)deniedLimits.put(key,false);
                                c.response=Fixture.wire(new JSONObject().put("schema","custodial.same-original-recovery-target-observation.v1")
                                    .put("state","ORIGINAL_TARGET_DESCRIPTOR_ONLY").put("original_target",new JSONObject(target.toString()))
                                    .put("original_target_sha256",targetSha).put("original_read_query_id",queryPins.get("native_request_id"))
                                    .put("original_query_body_sha256",originalQuerySha).put("original_query_unknown_record_sha256",first.get("original_query_unknown_record_sha256"))
                                    .put("current_request_body_sha256",NativeRetainedAttempt.hash(sent)).put("limits",deniedLimits));
                            }finally{Arrays.fill(sent,(byte)0);if(decoded!=null)Arrays.fill(decoded,(byte)0);}
                        };return c;
                    },clock);
                    // The supported purpose negative uses a real ordinary Engine dispatch;
                    // it does not mint the private target-purpose boolean reflectively.
                    var neverOpen=new NativePrivateCustodyHttp(url->{wrongOpens[0]++;throw new AssertionError("purpose refusal must precede connection");},clock);
                    try(var dispatch=engine.prepareCurrentOriginalPrivateCustodyQueryRead(plan,journal,0)){
                        var attempt=new NativeRetainedHttp.Attempt();
                        denied(()->neverOpen.sendOriginalRecoveryTarget(dispatch,"synthetic",new char[0],attempt));assertEquals(0,wrongOpens[0]);
                    }
                    try(var observed=read.takeOriginalRecoveryTarget(targetHttp)){
                        currentFrameConsumerMark("g08_target_observed");var p=observed.projection();
                        assertEquals(targetSha,p.get("original_target_sha256"));assertEquals(target.toString(),p.getJSONObject("original_target").toString());
                        for(String key:limits)assertEquals(false,p.getJSONObject("limits").get(key));
                        assertTrue(p.getBoolean("native_target_observed_not_approved"));assertFalse(p.getBoolean("manager_approval"));assertFalse(p.getBoolean("server_mapping_independently_native_verified"));
                        p.getJSONObject("original_target").put("employee_id","95000000-0000-4000-8000-000000000103");p.getJSONObject("limits").put("key_removal",true);
                        var detached=observed.projection();assertEquals(target.get("employee_id"),detached.getJSONObject("original_target").get("employee_id"));assertFalse(detached.getJSONObject("limits").getBoolean("key_removal"));
                        denied(read::takeCompletionSemantics);denied(()->read.takeOriginalRecoveryTarget(targetHttp));assertEquals(1,targetOpens[0]);
                        clock.now+=120001;denied(observed::projection);denied(read::projection);currentFrameConsumerMark("g08_expired_refused");
                        read.close();denied(observed::projection);denied(()->read.takeOriginalRecoveryTarget(targetHttp));assertNull(NativePrivateCustodyExchangeTest.field(read,"crypto"));
                        observed.close();observed.close();currentFrameConsumerMark("g08_closed_refused");
                    }
                }
                assertEquals(queries.size()+1,connections.size());for(var c:connections){assertEquals(1,c.disconnects);Arrays.fill(c.response,(byte)0);}
                stable.check();NativePrivateCustodyOwnerTest.sameFiles(saved,original.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
                NativePrivateCustodyOwnerTest.sameFiles(capsule,original.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operationFiles,original.dir);
                assertArrayEquals(frame,(byte[])NativePrivateCustodyExchangeTest.field(original.frame,"encoded"));control.check();
                currentFrameConsumerMark("g08_originals_preserved_six_effects_false");
            }finally{for(var q:queries)q.close();for(byte[] response:responses)Arrays.fill(response,(byte)0);Arrays.fill(frame,(byte)0);if(queryBytes!=null)Arrays.fill(queryBytes,(byte)0);if(proofBytes!=null)Arrays.fill(proofBytes,(byte)0);}
        }
    }
    @Test public void CURRENT_FRAME_COMPLETION_sameOriginalSemanticsOwnLiveReadAndRetainUnknownRows()throws Exception {
        try(var issuer=new CurrentFrameConsumerIssuer();var original=new NativePrivateCustodyOperationTest.Fixture(true);
            var operation=original.prepare();var plan=original.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var engine=original.f.engine();var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(original.f.root.toFile());
            var clock=original.f.x.f.x.f.batch.old.clock;
            var queries=new ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();var responses=new ArrayList<byte[]>();
            var connections=new ArrayList<NativePrivateCustodyHttpOutcomeTest.Connection>();
            byte[] frame=((byte[])NativePrivateCustodyExchangeTest.field(original.frame,"encoded")).clone();
            try {
                for(int i=0;i<plan.projection().getInt("chunk_count");i++)try(var write=engine.prepareOriginalPrivateCustodyWrite(plan,journal,i)){
                    var row=NativePrivateCustodyReplySetTest.readback(write);engine.fenceOriginalPrivateCustodyExchange(write);
                    var query=engine.prepareOriginalPrivateCustodyQuery(plan,journal,i);queries.add(query);
                    engine.fenceOriginalPrivateCustodyExchange(query);
                    responses.add(Fixture.wire(currentCompletionPiece(plan,query,row,frame,i)));
                }
                var saved=NativePrivateCustodyOwnerTest.files(original.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
                var capsule=NativePrivateCustodyOwnerTest.files(original.f.dir);
                var operationFiles=NativePrivateCustodyOwnerTest.files(original.dir);
                var stable=new NativeRetainedNamespaceCensusTest.Stable(original.f.x.f.x);
                var source=original.guardedSemantics.projection();
                var control=new NativePrivateCustodyFrameReadControl();
                var http=new NativePrivateCustodyHttp(url->{
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                    assertFalse(Thread.holdsLock(engine));int index=connections.size();assertTrue(index<responses.size());
                    var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);connection.response=responses.get(index);
                    connections.add(connection);return connection;
                },clock);
                currentFrameConsumerMark("completion_current_read_begin");
                try(var read=engine.readCurrentOriginalPrivateCustodyFrame(plan,journal,http,control)){
                    currentFrameConsumerMark("completion_current_read_ready");
                    try(var semantics=read.takeCompletionSemantics()){
                        currentFrameConsumerMark("completion_same_original_semantics_ready");
                        var p=semantics.projection();NativeRetainedNamespaceCompletionJoinTest.noAuthority(p);
                        assertEquals(NativeRetainedNamespaceCompletionJoin.SCHEMA,p.get("schema"));
                        for(String pin:new String[]{"source_capture_sha256","values_sha256","principal_digest","engine_revision","original_generation_id","record_count"})
                            assertEquals(pin,source.get(pin),p.get(pin));
                        assertEquals(source.get("semantic_join_sha256"),p.get("original_source_join_sha256"));
                        int unknown=0;var rows=p.getJSONArray("records");
                        for(int i=0;i<rows.length();i++){
                            var row=rows.getJSONObject(i);if(!NativeRetainedNamespaceCensus.WORK.equals(row.get("namespace"))){
                                String namespace=row.getString("namespace");
                                if(namespace.equals("MemphisZooCustodialNativeVaultV1")||namespace.equals("WSSecureStorageSharedPreferences")
                                    ||!row.getBoolean("local_source_classified")){
                                    assertEquals("UNRECONCILED_RECORD_RETAINED",row.get("application_semantic_disposition"));unknown++;
                                }
                                for(String flag:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","cutoff_eligible","browser_source_authenticated"})assertEquals(false,row.get(flag));
                            }
                        }
                        assertTrue("actual original non-WORK rows must remain represented",unknown>0);
                        p.put("inventory_acknowledged",true);assertFalse(semantics.projection().getBoolean("inventory_acknowledged"));
                        denied(read::takeCompletionSemantics); // One owning transfer, never a second result.
                        clock.now+=120001; // Existing synthetic clock only, not business-clock qualification.
                        denied(semantics::projection);denied(read::projection);
                        currentFrameConsumerMark("completion_expired_read_refused");
                        read.close();denied(semantics::projection);denied(read::projection);denied(read::takeCompletionSemantics);
                        assertNull(NativePrivateCustodyExchangeTest.field(read,"crypto"));
                        semantics.close();semantics.close(); // Owned read close is idempotent, not a mutator.
                        currentFrameConsumerMark("completion_closed_read_refused");
                    }
                }
                assertEquals(queries.size(),connections.size());for(var connection:connections)assertEquals(1,connection.disconnects);
                stable.check();NativePrivateCustodyOwnerTest.sameFiles(saved,original.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
                NativePrivateCustodyOwnerTest.sameFiles(capsule,original.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operationFiles,original.dir);
                control.check();currentFrameConsumerMark("completion_originals_preserved_no_authority");
            } finally {for(var query:queries)query.close();for(byte[] response:responses)Arrays.fill(response,(byte)0);Arrays.fill(frame,(byte)0);}
        }
    }
}
