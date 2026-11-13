package org.memphiszoo.custodial.vault;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** DIAGNOSTIC ONLY. Observes the existing action worker, never a global trace.
 * Stack collection can perturb execution and its native latency is not bounded.
 * No authority, accepted-work, whole timing or private ACK qualification. */
@RunWith(AndroidJUnit4.class)
public final class OriginalFirstBrowserWorkerProfileAndroidRuntimeTest {
    @Test(timeout=3_000_000)
    public void profileFirstBrowserWorkerDiagnosticOnly()throws Exception {
        var args=InstrumentationRegistry.getArguments();
        org.junit.Assume.assumeTrue("Explicit diagnostic selector required",
            "first-browser-only".equals(args.getString("custodialThreadProfile")));
        String supplied=args.getString("additionalTestOutputDir");
        assertNotNull("AGP must supply its supported additional test output directory",supplied);
        var output=new File(supplied).getCanonicalFile();
        assertTrue("AGP output must already exist and be writable",output.isDirectory()&&output.canWrite());
        ProtectedRecoveryEntryAndroidRuntimeTest.withFirstBrowserActionDiagnostic(
            app->new WorkerProfile(app,output.toPath()));
        System.out.println("DIAGNOSTIC_ONLY_FIRST_BROWSER_WORKER_FINISHED_NO_ACCEPTANCE_OR_SPEEDUP_CLAIM");
    }

    private static final class WorkerProfile implements AutoCloseable {
        private static final long INTERVAL_MILLIS=100,CAP_NANOS=180_000_000_000L,CLOSE_JOIN_MILLIS=1000;
        private static final int MAX_SAMPLES=1800,MAX_FRAMES=16,MAX_FRAME_CHARS=160,MAX_LINE_BYTES=32*1024;
        private static final long MAX_SAMPLE_BYTES=8*1024*1024;
        private final Path directory;
        private final Thread worker=Thread.currentThread(),sampler;
        private final long startedNanos=System.nanoTime();
        private final AtomicBoolean stopRequested=new AtomicBoolean();
        private volatile Throwable sampleFailure;
        private volatile int completedSamples;
        private volatile long sampleBytes;
        WorkerProfile(Context app,Path output)throws Exception {
            directory=output.resolve("custodial-first-browser-worker-"+UUID.randomUUID());
            Files.createDirectory(directory);
            record("START.json",new JSONObject().put("schema","custodial.first-browser-worker-diagnostic.v1")
                .put("scope","FIRST_NORMAL_BROWSER_ACTION_ONLY_NOT_ACCEPTANCE")
                .put("test_package",app.getPackageName()).put("pid",android.os.Process.myPid())
                .put("worker_thread_id",worker.getId()).put("worker_thread_name",worker.getName())
                .put("sampling_interval_millis",INTERVAL_MILLIS).put("profile_cap_nanos",CAP_NANOS)
                .put("max_samples",MAX_SAMPLES).put("max_frames",MAX_FRAMES)
                .put("max_frame_chars",MAX_FRAME_CHARS).put("max_sample_bytes",MAX_SAMPLE_BYTES)
                .put("close_join_millis",CLOSE_JOIN_MILLIS).put("global_tracing_session",false)
                .put("inflight_sample_may_finish_after_stop_request",true)
                .put("deadline_or_guard_changes",false).put("Android_performance_qualified",false).put("private_ACK",false));
            // The sampler exclusively owns its stream. Owner cleanup never waits
            // for an in-flight getStackTrace or closes that stream underneath it.
            OutputStream samples=Files.newOutputStream(directory.resolve("SAMPLES.jsonl"),
                StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE);
            try{
                sampler=new Thread(()->sample(samples),"custodial-owned-worker-stack-sampler");
                sampler.setDaemon(true);sampler.start();
            }
            catch(RuntimeException|Error failure){try{samples.close();}catch(Exception cleanup){failure.addSuppressed(cleanup);}throw failure;}
        }
        private void sample(OutputStream stream){
            String reason="STOP_REQUESTED";
            try(var samples=stream){
                for(int sequence=0;sequence<MAX_SAMPLES&&!stopRequested.get();sequence++){
                    long began=System.nanoTime();
                    if(began-startedNanos>=CAP_NANOS){reason="PROFILE_CAP";break;}
                    String stateBefore=worker.getState().name();
                    StackTraceElement[] stack=worker.getStackTrace();
                    long returned=System.nanoTime();
                    // Refuse a late native return when close/cap is observed
                    // here. A concurrent close may follow this check; only a
                    // settled join makes sample files and counts final.
                    if(stopRequested.get()){reason="STOP_REQUESTED_AFTER_STACK_RETURN";break;}
                    if(returned-startedNanos>=CAP_NANOS){reason="PROFILE_CAP_AFTER_STACK_RETURN";break;}
                    JSONArray frames=new JSONArray();int truncatedFrameNames=0;
                    for(int index=0;index<Math.min(stack.length,MAX_FRAMES);index++){
                        String frame=stack[index].toString();
                        if(frame.length()>MAX_FRAME_CHARS){frame=frame.substring(0,MAX_FRAME_CHARS);truncatedFrameNames++;}
                        frames.put(frame);
                    }
                    JSONObject value=new JSONObject().put("sequence",sequence)
                        .put("sample_started_elapsed_nanos",began-startedNanos)
                        .put("sample_returned_elapsed_nanos",returned-startedNanos)
                        .put("stack_capture_latency_nanos",returned-began)
                        .put("worker_state_before",stateBefore).put("worker_state_after",worker.getState().name())
                        .put("observed_stack_depth",stack.length).put("frames_truncated",stack.length>MAX_FRAMES)
                        .put("frame_names_truncated",truncatedFrameNames).put("frames",frames);
                    byte[] bytes=(value.toString()+"\n").getBytes(StandardCharsets.UTF_8);
                    try{
                        if(bytes.length>MAX_LINE_BYTES){reason="LINE_BYTE_CAP";break;}
                        if(sampleBytes+bytes.length>MAX_SAMPLE_BYTES){reason="TOTAL_BYTE_CAP";break;}
                        samples.write(bytes);samples.flush();sampleBytes+=bytes.length;completedSamples++;
                    }finally{java.util.Arrays.fill(bytes,(byte)0);}
                    if(sequence+1==MAX_SAMPLES){reason="SAMPLE_COUNT_CAP";break;}
                    // Interval is a requested pause AFTER each capture, not a
                    // claimed fixed-frequency or CPU-time measurement.
                    try{Thread.sleep(INTERVAL_MILLIS);}
                    catch(InterruptedException done){reason="STOP_REQUESTED_INTERRUPT";break;}
                }
            }catch(Throwable failure){sampleFailure=failure;reason="SAMPLER_FAILURE";}
            finally{
                try{record("SAMPLER_STOP.json",new JSONObject().put("schema","custodial.first-browser-worker-stop.v1")
                    .put("reason",reason).put("elapsed_nanos",System.nanoTime()-startedNanos)
                    .put("completed_samples",completedSamples).put("sample_bytes",sampleBytes)
                    .put("failure_type",sampleFailure==null?JSONObject.NULL:sampleFailure.getClass().getName())
                    .put("diagnostic_only",true).put("acceptance_qualified",false));}
                catch(Throwable failure){if(sampleFailure==null)sampleFailure=failure;else sampleFailure.addSuppressed(failure);}
            }
        }
        private void record(String name,JSONObject value)throws Exception {
            byte[] bytes=(value.toString()+"\n").getBytes(StandardCharsets.UTF_8);
            try(var out=Files.newOutputStream(directory.resolve(name),StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE)){
                out.write(bytes);
            }finally{java.util.Arrays.fill(bytes,(byte)0);}
        }
        @Override public void close()throws Exception {
            assertSame("Diagnostic scope must close on its original action worker",worker,Thread.currentThread());
            stopRequested.set(true);sampler.interrupt();sampler.join(CLOSE_JOIN_MILLIS);
            boolean stillAlive=sampler.isAlive();
            record("SCOPE_EXIT.json",new JSONObject().put("schema","custodial.first-browser-worker-scope-exit.v1")
                .put("elapsed_nanos",System.nanoTime()-startedNanos).put("sampler_still_alive",stillAlive)
                .put("sample_counts_final",!stillAlive).put("sample_file_settled",!stillAlive)
                .put("completed_samples",completedSamples).put("sample_bytes",sampleBytes)
                .put("diagnostic_only",true).put("normal_authority_deadlines_unchanged",true).put("acceptance_qualified",false));
            // No Thread.stop, global tracing stop, unlimited join, or retry.
            if(stillAlive)throw new AssertionError("Owned stack sampler did not settle within bounded owner join");
            if(sampleFailure!=null)throw new AssertionError("Owned stack sampler failed",sampleFailure);
        }
    }
}
