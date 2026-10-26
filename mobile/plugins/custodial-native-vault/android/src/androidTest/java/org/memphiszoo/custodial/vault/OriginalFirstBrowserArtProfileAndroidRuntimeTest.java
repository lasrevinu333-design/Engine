package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.Debug;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** DIAGNOSTIC ONLY. No acceptance, private ACK or timing qualification.
 * The selected first normal action retains every original guard and witness.
 * Run only in the lead's newly owned isolated emulator/test process. */
@RunWith(AndroidJUnit4.class)
public final class OriginalFirstBrowserArtProfileAndroidRuntimeTest {
    @Test(timeout=3_000_000)
    public void profileFirstBrowserActionDiagnosticOnly()throws Exception {
        var args=InstrumentationRegistry.getArguments();
        org.junit.Assume.assumeTrue("Explicit diagnostic selector required",
            "first-browser-only".equals(args.getString("custodialArtProfile")));
        String supplied=args.getString("additionalTestOutputDir");
        assertNotNull("AGP must supply its supported additional test output directory",supplied);
        var output=new File(supplied).getCanonicalFile();
        assertTrue("AGP output must already exist and be writable",output.isDirectory()&&output.canWrite());
        ProtectedRecoveryEntryAndroidRuntimeTest.withFirstBrowserActionDiagnostic(
            app->new BoundedProfile(app,output.toPath()));
        System.out.println("DIAGNOSTIC_ONLY_FIRST_BROWSER_ACTION_FINISHED_NO_ACCEPTANCE_OR_SPEEDUP_CLAIM");
    }

    private static final class BoundedProfile implements AutoCloseable {
        private static final int BUFFER_BYTES=16*1024*1024,INTERVAL_US=10_000;
        private static final long CAP_MILLIS=180_000;
        private final Path directory,trace;
        private final long startedNanos=System.nanoTime();
        private final AtomicBoolean stopping=new AtomicBoolean();
        private final CountDownLatch stopped=new CountDownLatch(1);
        private final Thread limiter;
        private volatile Throwable stopFailure;
        BoundedProfile(Context app,Path output)throws Exception {
            // New directory only: Debug truncates an existing trace path.
            // No old output, original, request, journal or key is changed.
            directory=output.resolve("custodial-first-browser-art-"+UUID.randomUUID());
            Files.createDirectory(directory);trace=directory.resolve("first-browser.trace");
            assertFalse(Files.exists(trace));
            record("START.json",new JSONObject().put("schema","custodial.first-browser-art-diagnostic.v1")
                .put("scope","FIRST_NORMAL_BROWSER_ACTION_ONLY_NOT_ACCEPTANCE")
                .put("test_package",app.getPackageName()).put("pid",android.os.Process.myPid())
                .put("sampling_interval_us",INTERVAL_US).put("buffer_bytes",BUFFER_BYTES)
                .put("profile_cap_millis",CAP_MILLIS).put("deadline_or_guard_changes",false)
                .put("Android_performance_qualified",false).put("private_ACK",false));
            limiter=new Thread(()->{
                try{Thread.sleep(CAP_MILLIS);stop("PROFILE_CAP_ONLY_ACTION_CONTINUES_UNCHANGED");}
                catch(InterruptedException expected){/* owner scope settled */}
            },"custodial-owned-art-profile-cap");
            limiter.setDaemon(true);
            Debug.startMethodTracingSampling(trace.toString(),BUFFER_BYTES,INTERVAL_US);
            try{limiter.start();}
            catch(RuntimeException|Error failure){stop("PROFILE_LIMITER_START_FAILED");throw failure;}
        }
        private void record(String name,JSONObject value)throws Exception {
            byte[] bytes=(value.toString()+"\n").getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try(var out=Files.newOutputStream(directory.resolve(name),StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE)){
                out.write(bytes);
            }finally{java.util.Arrays.fill(bytes,(byte)0);}
        }
        private void stop(String reason){
            if(!stopping.compareAndSet(false,true))return;
            try{Debug.stopMethodTracing();}
            catch(Throwable failure){stopFailure=failure;}
            finally{
                try{record("STOP.json",new JSONObject().put("schema","custodial.first-browser-art-stop.v1")
                    .put("reason",reason).put("elapsed_nanos",System.nanoTime()-startedNanos)
                    .put("trace_bytes",Files.exists(trace)?Files.size(trace):0)
                    .put("stop_failure_type",stopFailure==null?JSONObject.NULL:stopFailure.getClass().getName())
                    .put("diagnostic_only",true).put("acceptance_qualified",false));}
                catch(Throwable failure){if(stopFailure==null)stopFailure=failure;else stopFailure.addSuppressed(failure);}
                finally{stopped.countDown();}
            }
        }
        @Override public void close()throws Exception {
            stop("FIRST_ACTION_SCOPE_EXIT");limiter.interrupt();
            if(!stopped.await(30,TimeUnit.SECONDS))throw new AssertionError("Owned profiler cleanup did not settle");
            limiter.join(1000);
            if(limiter.isAlive())throw new AssertionError("Owned profiler cap thread did not settle");
            record("SCOPE_EXIT.json",new JSONObject().put("schema","custodial.first-browser-art-scope-exit.v1")
                .put("elapsed_nanos",System.nanoTime()-startedNanos).put("diagnostic_only",true)
                .put("normal_authority_deadlines_unchanged",true).put("acceptance_qualified",false));
            if(stopFailure!=null)throw new AssertionError("Owned profiler cleanup failed",stopFailure);
        }
    }
}
