package org.memphiszoo.custodial.vault;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** NEW native resource-clock guard only. No WebView/document, manager, saved
 * work, trusted event clock, inventory ACK or finalizer authority is created. */
public final class NativeOriginalBrowserSourceLifetimeTest {
    private static void check(Method method,long originalStart,boolean refused)throws Exception {
        try{
            method.invoke(null,originalStart);
            if(refused)throw new AssertionError("Expired/future original start was accepted");
        }catch(InvocationTargetException failure){
            if(!refused||!(failure.getCause() instanceof VaultFailure))throw failure;
            VaultFailure cause=(VaultFailure)failure.getCause();
            if(!"custodial_original_browser_preparation_unavailable".equals(cause.code))throw failure;
        }
    }
    private static void deliveryCheck(Method method,long start,NativePrivateCustodyFrameReadControl control,
        String expectedFailure)throws Exception {
        try{
            method.invoke(null,start,control);
            if(expectedFailure!=null)throw new AssertionError("Unavailable queued command was accepted");
        }catch(InvocationTargetException failure){
            if(expectedFailure==null||!(failure.getCause() instanceof VaultFailure)
                ||!expectedFailure.equals(((VaultFailure)failure.getCause()).code))throw failure;
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--emit-native-browser-realm-source-only".equals(args[0])){
            java.nio.file.Files.writeString(java.nio.file.Path.of(args[1]),
                NativeOriginalBrowserRealmSource.script("a".repeat(64),"b".repeat(64)),StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.StandardOpenOption.WRITE);
            System.out.println("EMITTED_CURRENT_REALM_FIXTURE_SOURCE_WITH_SYNTHETIC_TOKENS_NO_AUTHORITY");return;
        }
        if(args.length==2&&"--native-browser-realm-source-only".equals(args[0])){
            String grant="a".repeat(64),reply="b".repeat(64),request="c".repeat(64),phase="d".repeat(64);
            var binding=new JSONObject().put("operation_id","11111111-1111-4111-8111-111111111111")
                .put("frame_sha256","e".repeat(64)).put("original_generation_id","22222222-2222-4222-8222-222222222222")
                .put("native_mutation_stamp","SYNTHETIC_REPRESENTATION_ONLY");
            var data=new JSONObject(binding.toString()).put("schema","custodial.native-original-browser-realm-observation.v1")
                .put("state","PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY")
                .put("reply_token",reply).put("request_nonce",request).put("phase_nonce",phase);
            NativeOriginalBrowserRealmSource.verify(data.toString(),reply,request,phase,binding);
            int refused=0;
            for(String key:new String[]{"reply_token","request_nonce","phase_nonce","operation_id","state"}){
                var changed=new JSONObject(data.toString()).put(key,"changed");
                try{NativeOriginalBrowserRealmSource.verify(changed.toString(),reply,request,phase,binding);
                    throw new AssertionError("Foreign realm representation accepted: "+key);}
                catch(VaultFailure expected){refused++;}
            }
            var extra=new JSONObject(data.toString()).put("inventory_acknowledged",true);
            try{NativeOriginalBrowserRealmSource.verify(extra.toString(),reply,request,phase,binding);
                throw new AssertionError("Caller effect field accepted");}
            catch(VaultFailure expected){refused++;}
            String script=NativeOriginalBrowserRealmSource.script(grant,reply);
            java.nio.file.Files.writeString(java.nio.file.Path.of(args[1]),script,StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.StandardOpenOption.WRITE);
            System.out.println("PASS_NEW_REALM_REPRESENTATION one exact and "+refused+" foreign/extra shapes; actual emitted fixture Source saved");
            System.out.println("REPRESENTATION_ONLY_SYNTHETIC_TOKENS_NO_NATIVE_PLATFORM_AUTHORITY_OR_ACK");return;
        }
        if(args.length==1&&"--native-browser-attachment-identity-only".equals(args[0])){
            var same=CustodialNativeRuntime.class.getDeclaredMethod("sameOriginalBrowserAttachment",
                Object.class,Object.class,Object.class,Object.class,Object.class,Object.class);
            same.setAccessible(true);
            Object owner=new Object(),bridge=new Object(),view=new Object();
            Object[] exact={owner,bridge,view,owner,bridge,view};
            if(!Boolean.TRUE.equals(same.invoke(null,exact)))throw new AssertionError("Same native attachment identity refused");
            int denied=0;
            for(int index=0;index<exact.length;index++)for(Object replacement:new Object[]{null,new Object()}){
                Object[] changed=exact.clone();changed[index]=replacement;
                if(!Boolean.FALSE.equals(same.invoke(null,changed)))throw new AssertionError("Foreign or missing native attachment accepted: "+index);
                denied++;
            }
            System.out.println("PASS_NEW_ATTACHMENT_IDENTITY exact tuple and "+denied+" missing/foreign fields");
            System.out.println("PURE_NATIVE_IDENTITY_COMPARISON_ONLY_NO_ACTIVITY_WEBVIEW_MANAGER_OR_ACK_PROOF");return;
        }
        if(args.length==1&&"--native-retirement-sticky-signal-only".equals(args[0])){
            stickyRetirementSignalCases();return;
        }
        if(args.length==1&&"--native-retirement-interrupt-reproduction-only".equals(args[0])){
            try(var original=new NativePrivateCustodyFrameReadControl()){
                // Original Activity retirement used interrupt without a sticky
                // control signal for ordinary actions. Model a platform await
                // consuming that flag BEFORE the next control checkpoint.
                Thread.currentThread().interrupt();
                if(!Thread.interrupted())throw new AssertionError("interrupt prerequisite absent");
                boolean refused=false;
                try{original.check();}catch(VaultFailure expected){refused=true;}
                if(!refused)throw new AssertionError("Interrupt-only retirement was consumed; original control remained current");
            }
            return;
        }
        if(args.length==1&&"--native-browser-post-finalization-hold-only".equals(args[0])){
            postFinalizationHoldCases();return;
        }
        if(args.length==1&&"--native-browser-explicit-reload-guard-only".equals(args[0])){
            Method guard=NativeOriginalBrowserPreparation.class.getDeclaredMethod("requireReloadCommandLifetime",long.class,
                NativePrivateCustodyFrameReadControl.class);guard.setAccessible(true);
            try(var control=new NativePrivateCustodyFrameReadControl()){
                long original=System.nanoTime();deliveryCheck(guard,original,control,null);
                deliveryCheck(guard,original,control,null);
                deliveryCheck(guard,System.nanoTime()-6_000_000_000L,control,"custodial_original_browser_preparation_unavailable");
                deliveryCheck(guard,System.nanoTime()+60_000_000_000L,control,"custodial_original_browser_preparation_unavailable");
                deliveryCheck(guard,System.nanoTime(),null,"custodial_original_browser_preparation_unavailable");
            }
            System.out.println("PASS_NEW_EXPLICIT_RELOAD_GUARD same bounded original UI action; expired future null cannot run");
            try(var control=new NativePrivateCustodyFrameReadControl()){
                long original=System.nanoTime();control.cancel();
                deliveryCheck(guard,original,control,"custodial_private_custody_transport_outcome_unknown");
            }
            try(var control=new NativePrivateCustodyFrameReadControl()){
                long original=System.nanoTime();control.close();
                deliveryCheck(guard,original,control,"custodial_private_custody_transport_outcome_unknown");
            }
            System.out.println("PASS_NEW_EXPLICIT_RELOAD_GUARD canceled or closed maintenance cannot authorize delayed UI work");
            System.out.println("GUARD_ONLY; ACTUAL_WEBVIEW_RELOAD_REATTACH_RETAINED_ORIGINAL_NEXT_MANAGER_READ_NOT_RUN; NO_ACK");return;
        }
        if(args.length==1&&"--native-browser-post-decision-hold-only".equals(args[0])){
            postDecisionHoldCases();return;
        }
        if(args.length==1&&"--native-browser-original-frame-hold-only".equals(args[0])){
            originalFrameHoldCases();return;
        }
        if(args.length==1&&"--native-browser-terminal-hold-only".equals(args[0])){
            terminalHoldCases();return;
        }
        if(args.length==1&&"--native-browser-queued-command-only".equals(args[0])){
            Method delivery=NativeOriginalBrowserPreparation.class.getDeclaredMethod("requireCaptureLifetime",long.class,
                NativePrivateCustodyFrameReadControl.class);delivery.setAccessible(true);
            try(var control=new NativePrivateCustodyFrameReadControl()){
                long original=System.nanoTime();deliveryCheck(delivery,original,control,null);
                control.cancel();deliveryCheck(delivery,original,control,"custodial_private_custody_transport_outcome_unknown");
            }
            try(var control=new NativePrivateCustodyFrameReadControl()){
                long original=System.nanoTime();deliveryCheck(delivery,original,control,null);
                control.close();deliveryCheck(delivery,original,control,"custodial_private_custody_transport_outcome_unknown");
            }
            try(var control=new NativePrivateCustodyFrameReadControl()){
                deliveryCheck(delivery,System.nanoTime()-31_000_000_000L,control,"custodial_original_browser_preparation_unavailable");
                deliveryCheck(delivery,System.nanoTime()+60_000_000_000L,control,"custodial_original_browser_preparation_unavailable");
                deliveryCheck(delivery,System.nanoTime(),null,"custodial_original_browser_preparation_unavailable");
            }
            System.out.println("PASS_NEW_QUEUED_COMMAND_GUARD cancelled/closed original control and expired/future/null inputs refuse");
            System.out.println("GUARD_UNIT_ONLY; REAL_UI_QUEUE_WEBVIEW_LIFECYCLE_NOT_RUN; NO_ACK_OR_FINALIZER");return;
        }
        if(args.length!=1||!"--native-browser-source-lifetime-only".equals(args[0]))
            throw new IllegalArgumentException("New resource-lifetime cases only");
        Method guard=NativeOriginalBrowserPreparation.class.getDeclaredMethod("requireCaptureLifetime",long.class);
        guard.setAccessible(true);
        long fresh=System.nanoTime();check(guard,fresh,false);check(guard,fresh,false);
        System.out.println("PASS_NEW_NATIVE_RESOURCE_GUARD same original fresh start");
        long expired=System.nanoTime()-31_000_000_000L;
        check(guard,expired,true);check(guard,expired,true);
        check(guard,System.nanoTime()+60_000_000_000L,true);
        System.out.println("PASS_NEW_NATIVE_RESOURCE_GUARD expired original cannot renew; future start refuses");
        System.out.println("RESOURCE_CLOCK_ONLY; WEBVIEW_LIFECYCLE_AND_OWNING_HOLD_NOT_RUN; NO_ACK_OR_FINALIZER");
    }

    private static void unavailable(NativePrivateCustodyFrameReadControl control)throws Exception {
        try{control.check();throw new AssertionError("Retired original became current");}
        catch(VaultFailure expected){
            if(!"custodial_private_custody_transport_outcome_unknown".equals(expected.code))throw expected;
        }
    }
    private static void unavailable(NativeRetainedHttp.Attempt piece)throws Exception {
        try{piece.check();throw new AssertionError("Retired original piece became current");}
        catch(VaultFailure expected){
            if(!"custodial_retained_transport_outcome_unknown".equals(expected.code))throw expected;
        }
    }
    private static Object controlField(NativePrivateCustodyFrameReadControl control,String name)throws Exception {
        var field=NativePrivateCustodyFrameReadControl.class.getDeclaredField(name);field.setAccessible(true);return field.get(control);
    }
    /** Actual control/Attempt primitives, synthetic connection only. These
     * do not execute Android onPause, TLS, a manager transaction or finalizer. */
    private static void stickyRetirementSignalCases()throws Exception {
        try(var original=new NativePrivateCustodyFrameReadControl()){
            original.check();original.requestCancellation();
            Thread.currentThread().interrupt();
            if(!Thread.interrupted())throw new AssertionError("interrupt prerequisite absent");
            unavailable(original);original.requestCancellation();unavailable(original);
            try{original.beginPiece();throw new AssertionError("Retired original began a successor piece");}
            catch(VaultFailure expected){}
        }
        System.out.println("PASS_NEW_RETIREMENT sticky denial survives consumed interrupt; no new piece");
        var original=new NativePrivateCustodyFrameReadControl();var piece=original.beginPiece();
        final var disconnects=new java.util.concurrent.atomic.AtomicInteger();
        final var disconnectThread=new java.util.concurrent.atomic.AtomicReference<Thread>();
        var connection=new javax.net.ssl.HttpsURLConnection(new java.net.URL("https://localhost/synthetic-retirement-only")){
            public String getCipherSuite(){return "synthetic-only";}
            public java.security.cert.Certificate[] getLocalCertificates(){return null;}
            public java.security.cert.Certificate[] getServerCertificates(){return null;}
            public void disconnect(){disconnectThread.set(Thread.currentThread());disconnects.incrementAndGet();}
            public boolean usingProxy(){return false;}
            public void connect(){}
        };
        piece.attach(connection);final var error=new java.util.concurrent.atomic.AtomicReference<Throwable>();
        Thread lifecycle=new Thread(()->{try{original.requestCancellation();}catch(Throwable failure){error.set(failure);}},"synthetic-lifecycle-signal");
        lifecycle.start();lifecycle.join(2000);
        if(lifecycle.isAlive()||error.get()!=null||disconnects.get()!=0)throw new AssertionError("Lifecycle signal performed IO or did not settle",error.get());
        if(controlField(original,"active")!=piece||controlField(original,"pieceOwner")!=Thread.currentThread())
            throw new AssertionError("Lifecycle signal released original piece ownership");
        unavailable(piece);
        System.out.println("PASS_NEW_RETIREMENT lifecycle thread signals exact Attempt without disconnect or ownership release");
        unavailable(original);
        if(disconnects.get()!=1||disconnectThread.get()!=Thread.currentThread()||controlField(original,"active")!=piece)
            throw new AssertionError("Worker checkpoint did not retain/cancel its exact piece");
        System.out.println("PASS_NEW_RETIREMENT worker checkpoint owns disconnect; active piece remains until settled end");
        Thread foreign=new Thread(()->{try{original.endPiece(piece);error.set(new AssertionError("Foreign thread ended original piece"));}
            catch(VaultFailure expected){}catch(Throwable failure){error.set(failure);}},"synthetic-foreign-end");
        foreign.start();foreign.join(2000);
        if(foreign.isAlive()||error.get()!=null||controlField(original,"active")!=piece)
            throw new AssertionError("Canceled original lost its owning thread",error.get());
        // Model the SAME HTTP owner's finally, after its synthetic IO settled.
        piece.detach(connection);original.endPiece(piece);
        if(controlField(original,"active")!=null)throw new AssertionError("Settled piece still active");
        original.requestCancellation();unavailable(original);original.close();
        if(disconnects.get()!=1)throw new AssertionError("Detached piece caused duplicate cleanup");
        System.out.println("PASS_NEW_RETIREMENT foreign end refused; exact owner settles once; denial remains sticky");
        System.out.println("SOURCE_CONTROL_ONLY_ANDROID_LIFECYCLE_TLS_ACK_FINALIZER_NOT_RUN");
    }
    private static JSONObject holdData(String phase)throws Exception {
        String operation="77000000-0000-4000-8000-000000000001";
        String marker="{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\""+operation+"\",\"native_authority\":false}";
        JSONObject row=new JSONObject().put("schema","custodial.native-original-browser-hold-fence-response.v1")
            .put("command","HOLD_FENCE").put("reply_token","a".repeat(64)).put("request_nonce","b".repeat(64))
            .put("phase_nonce",phase).put("operation_id",operation).put("frame_sha256","c".repeat(64))
            .put("original_generation_id","77000000-0000-4000-8000-000000000002")
            .put("native_mutation_stamp","same original native stamp").put("state","SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK")
            .put("hold_marker_sha256",NativeRetainedAttempt.hash(marker.getBytes(StandardCharsets.UTF_8)))
            .put("mutation_epoch","7").put("observation_sha256","d".repeat(64));
        for(String key:new String[]{"native_authority","inventory_acknowledged","work_accepted","replay_allowed",
            "finalizer_allowed","key_removal","phone_released"})row.put(key,false);
        return row;
    }
    private static NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply decodeHold(JSONObject row)throws Exception {
        JSONObject tuple=new JSONObject();
        for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"})tuple.put(key,row.get(key));
        return NativeOriginalBrowserPreparationWire.decodeHoldFence(row.toString(),row.getString("reply_token"),
            row.getString("request_nonce"),row.getString("phase_nonce"),tuple,row.getString("observation_sha256"));
    }
    private static void sameHold(Method method,JSONObject first,JSONObject last,boolean refused)throws Exception {
        // Invoke only the pure comparison of already decoded DATA; no private
        // Exchange/control/manager constructor or Source authority is created.
        try(var original=decodeHold(first);var terminal=decodeHold(last)){
            try{method.invoke(null,original.json(),terminal.json());
                if(refused)throw new AssertionError("Changed original hold DATA was accepted");
            }catch(InvocationTargetException failed){
                if(!refused||!(failed.getCause() instanceof VaultFailure))throw failed;
            }
        }
    }
    private static void terminalHoldCases()throws Exception {
        Method compare=NativeOriginalBrowserPreparation.Exchange.class.getDeclaredMethod("requireSameOriginalHoldFence",JSONObject.class,JSONObject.class);
        compare.setAccessible(true);JSONObject first=holdData("1".repeat(64)),last=holdData("2".repeat(64));
        sameHold(compare,first,last,false);sameHold(compare,first,first,true);
        System.out.println("PASS_NEW_TERMINAL_HOLD_DATA same original only with distinct issued phase");
        for(String key:new String[]{"reply_token","request_nonce","frame_sha256","observation_sha256"}){
            JSONObject changed=holdData("2".repeat(64)).put(key,"e".repeat(64));sameHold(compare,first,changed,true);
        }
        for(String key:new String[]{"native_mutation_stamp","mutation_epoch","original_generation_id"}){
            String value=key.equals("mutation_epoch")?"8":key.equals("original_generation_id")?
                "77000000-0000-4000-8000-000000000003":"same bytes after attempted original write";
            sameHold(compare,first,holdData("2".repeat(64)).put(key,value),true);
        }
        System.out.println("PASS_NEW_TERMINAL_HOLD_DATA changed original request tuple observation or epoch refuses");
        System.out.println("DECODED_DATA_COMPOSITION_ONLY; PRIVATE_DOCUMENT_UI_NATIVE_LOCK_AND_ACK_NOT_RUN");
    }
    private static void samePostDecisionHold(Method method,JSONObject first,String terminalPhase,
        JSONObject last,boolean refused)throws Exception {
        // Only decoded DATA comparison. This does not construct an Exchange,
        // injected Source, private manager/control, or owning checked flag.
        try(var original=decodeHold(first);var post=decodeHold(last)){
            try{
                method.invoke(null,original.json(),terminalPhase,post.json());
                if(refused)throw new AssertionError("Changed post-decision original DATA was accepted");
            }catch(InvocationTargetException failed){
                if(!refused||!(failed.getCause() instanceof VaultFailure)
                    ||!"custodial_original_browser_preparation_unavailable".equals(((VaultFailure)failed.getCause()).code))throw failed;
            }
        }
    }
    private static void postFinalizationHoldCases()throws Exception {
        Method compare=NativeOriginalBrowserPreparation.Exchange.class.getDeclaredMethod("requireDistinctFinalizationHold",
            JSONObject.class,String.class,JSONObject.class,JSONObject.class);compare.setAccessible(true);
        JSONObject first=holdData("1".repeat(64)),decision=holdData("3".repeat(64));
        for(String phase:new String[]{"4","1","2","3"}){
            boolean refused=!phase.equals("4");
            try(var original=decodeHold(first);var currentDecision=decodeHold(decision);var finalized=decodeHold(holdData(phase.repeat(64)))){
                try{
                    compare.invoke(null,original.json(),"2".repeat(64),currentDecision.json(),finalized.json());
                    if(refused)throw new AssertionError("An earlier phase was reused as post-finalization DATA");
                }catch(InvocationTargetException failed){if(!refused||!(failed.getCause() instanceof VaultFailure))throw failed;}
            }
        }
        System.out.println("PASS_NEW_POST_FINALIZATION_DATA distinct fourth phase; initial terminal and decision phase reuse refused");
        for(String key:new String[]{"mutation_epoch","observation_sha256","native_mutation_stamp"}){
            JSONObject changed=holdData("4".repeat(64)).put(key,key.equals("mutation_epoch")?"8":key.equals("observation_sha256")?"e".repeat(64):"changed original");
            try(var original=decodeHold(first);var currentDecision=decodeHold(decision);var finalized=decodeHold(changed)){
                try{
                    compare.invoke(null,original.json(),"2".repeat(64),currentDecision.json(),finalized.json());
                    throw new AssertionError("Changed post-finalization held DATA was accepted");
                }catch(InvocationTargetException failed){if(!(failed.getCause() instanceof VaultFailure))throw failed;}
            }
        }
        System.out.println("PASS_NEW_POST_FINALIZATION_DATA original browser epoch observation and native stamp remain fixed");
        System.out.println("PURE_DECODED_DATA_ONLY; ACTUAL_SOURCE_AFTER_PERSISTENCE_AND_NATIVE_FINALIZATION_NOT_RUN; NO_ACK");
    }
    private static void postDecisionHoldCases()throws Exception {
        Method compare=NativeOriginalBrowserPreparation.Exchange.class.getDeclaredMethod(
            "requireSamePostDecisionOriginalHoldFence",JSONObject.class,String.class,JSONObject.class);
        compare.setAccessible(true);
        JSONObject original=holdData("1".repeat(64)),post=holdData("3".repeat(64));
        String terminal="2".repeat(64);
        samePostDecisionHold(compare,original,terminal,post,false);
        samePostDecisionHold(compare,original,terminal,original,true);
        samePostDecisionHold(compare,original,terminal,holdData(terminal),true);
        for(String invalid:new String[]{null,"","2".repeat(63),"A".repeat(64),"1".repeat(64)})
            samePostDecisionHold(compare,original,invalid,post,true);
        System.out.println("PASS_NEW_POST_DECISION_HOLD_DATA distinct initial terminal post phases; absent or reused phase refuses");
        for(String key:new String[]{"reply_token","request_nonce","frame_sha256","observation_sha256"})
            samePostDecisionHold(compare,original,terminal,holdData("3".repeat(64)).put(key,"e".repeat(64)),true);
        samePostDecisionHold(compare,original,terminal,holdData("3".repeat(64)).put("mutation_epoch","8"),true);
        samePostDecisionHold(compare,original,terminal,holdData("3".repeat(64)).put("native_mutation_stamp","foreign original stamp"),true);
        JSONObject foreign=holdData("3".repeat(64))
            .put("operation_id","77000000-0000-4000-8000-000000000003")
            .put("hold_marker_sha256",NativeRetainedAttempt.hash(("{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\"77000000-0000-4000-8000-000000000003\",\"native_authority\":false}").getBytes(StandardCharsets.UTF_8)));
        samePostDecisionHold(compare,original,terminal,foreign,true);
        samePostDecisionHold(compare,original,terminal,holdData("3".repeat(64))
            .put("original_generation_id","77000000-0000-4000-8000-000000000004"),true);
        System.out.println("PASS_NEW_POST_DECISION_HOLD_DATA original source tuple frame observation hold and epoch retained");
        System.out.println("DECODED_DATA_ONLY; ONE_SHOT_SOURCE_IO_WEBVIEW_MANAGER_POST_HTTP_LIFETIME_NOT_RUN; NO_ACK");
    }
    private static NativeOriginalBrowserValueFrame.OriginalRecords originalFrame(String operation,String epoch)throws Exception {
        // Borrow the existing qualified binary fixture encoder, not a private
        // product constructor or diagnostic JSON as authority.
        Class<?> fixture=Class.forName("org.memphiszoo.custodial.vault.NativeSameOriginalRecoveryPreparationWireTest");
        Method treeMethod=fixture.getDeclaredMethod("frameHoldTree",String.class,String.class);
        Method readMethod=fixture.getDeclaredMethod("frameHoldReadBoth",Object[].class,String.class,String.class);
        treeMethod.setAccessible(true);readMethod.setAccessible(true);
        String marker=operation==null?null:"{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\""+operation+"\",\"native_authority\":false}";
        Object[] tree=(Object[])treeMethod.invoke(null,marker,epoch);
        return (NativeOriginalBrowserValueFrame.OriginalRecords)readMethod.invoke(null,tree,operation,operation==null?null:epoch);
    }
    private static void checkOriginalFrame(Method method,NativeOriginalBrowserValueFrame.OriginalRecords frame,
        JSONObject originalBinding,JSONObject source,JSONObject metadata,boolean refused)throws Exception {
        try{method.invoke(null,frame,originalBinding,source,metadata);
            if(refused)throw new AssertionError("Foreign original frame hold was accepted");
        }catch(InvocationTargetException failed){if(!refused||!(failed.getCause() instanceof VaultFailure))throw failed;}
    }
    private static void originalFrameHoldCases()throws Exception {
        Method compare=NativeOriginalBrowserPreparation.Exchange.class.getDeclaredMethod("requireSameOriginalFrameHold",
            NativeOriginalBrowserValueFrame.OriginalRecords.class,JSONObject.class,JSONObject.class,JSONObject.class);
        compare.setAccessible(true);JSONObject source=holdData("1".repeat(64)),binding=new JSONObject();
        for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"})binding.put(key,source.get(key));
        var frame=originalFrame(binding.getString("operation_id"),"7");
        JSONObject metadata=new JSONObject().put("frame_sha256",frame.frameSha256).put("observation_sha256",frame.observationSha256)
            .put("record_count",frame.recordCount);source.put("observation_sha256",frame.observationSha256);
        checkOriginalFrame(compare,frame,binding,source,metadata,false);
        checkOriginalFrame(compare,originalFrame(null,null),binding,source,metadata,true);
        System.out.println("PASS_NEW_ORIGINAL_FRAME_HOLD actual binary local metadata required; absent stays unresolved");
        for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp",
            "hold_marker_sha256","mutation_epoch","observation_sha256"}){
            JSONObject changed=new JSONObject(source.toString()).put(key,key.equals("mutation_epoch")?"8":"foreign original");
            checkOriginalFrame(compare,frame,binding,changed,metadata,true);
        }
        for(String key:new String[]{"frame_sha256","observation_sha256","record_count"}){
            JSONObject changed=new JSONObject(metadata.toString()).put(key,key.equals("record_count")?frame.recordCount+1:"e".repeat(64));
            checkOriginalFrame(compare,frame,binding,source,changed,true);
        }
        System.out.println("PASS_NEW_ORIGINAL_FRAME_HOLD changed owning tuple raw marker epoch or frame metadata refuses");
        System.out.println("BINARY_DATA_CALLER_COMPOSITION_ONLY; AEAD_WEBVIEW_CURRENT_MANAGER_ALLWRITERS_ACK_NOT_RUN");
    }
}
