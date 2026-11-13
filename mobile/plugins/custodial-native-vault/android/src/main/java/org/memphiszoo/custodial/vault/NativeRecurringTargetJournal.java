package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native actual-response and actual-vendor-operation DATA. No state in this
 * journal is an OS settlement, currentness verdict, receipt or resend grant. */
final class NativeRecurringTargetJournal {
    static final String FAILURE="custodial_native_recurring_journal_pending";
    static final String TARGET_PREFIX="native_recurring_target_sha256:";
    static final String VIEW_PREFIX="native_recurring_view_chunk_sha256:";
    static final int VIEW_CHUNK_BYTES=32_768,MAX_VIEW_BYTES=8*1024*1024;
    static final String MUTATION_PREFIX="native_notification_mutation_sha256:";
    static final int MAX_RECORD=98_304,MAX_NOTIFICATION=16_384;
    interface Store {
        String loadRecurringRecord(String key)throws VaultFailure;
        void compareAndRetainRecurringRecord(String key,String previous,String candidate)throws VaultFailure;
        Map<String,String> recurringRecords()throws VaultFailure;
        /** Actual adapter must return native mutation rows and their linked
         * target rows from ONE readonly observation, checking after its final
         * decode/key callback. No fallback pretends sequential reads atomic. */
        default Map<String,String> notificationEffectRecords(NativeProviderPrincipal principal,String serviceDate)throws VaultFailure {throw new VaultFailure(FAILURE);}

    }
    /** Only the Engine's lexical actual HTTPS invocation may supply this.
     * An interface implementation alone is not authentication. */
    interface ResponseOwner {
        NativeProviderPrincipal requireCurrent()throws VaultFailure;
        void requireActual(AuthorizedRequest request,AuthorizedResponse response)throws VaultFailure;
    }
    /** Callback-free one-use handoff from the ACTUAL durable generation
     * birth. It cannot be reconstructed by reading an old journal row. */
    private final Map<String,BornEffect> originalEffectBirths=new java.util.LinkedHashMap<>();
    static final class BornEffect {
        final NativeProviderPrincipal principal;final String generation,group,rawNotification,serviceDate,targetReference;final int id;
        private BornEffect(NativeProviderPrincipal principal,String generation,int id,String group,String raw,String day,String target){
            this.principal=principal;this.generation=generation;this.id=id;this.group=group;rawNotification=raw;serviceDate=day;targetReference=target;
        }
        boolean sameOriginal(KnownEffect other){return other!=null&&principal.same(other.principal)&&generation.equals(other.generation)
            &&id==other.id&&group.equals(other.group)&&rawNotification.equals(other.rawNotification)
            &&serviceDate.equals(other.serviceDate)&&java.util.Objects.equals(targetReference,other.targetReference);}
    }
    BornEffect takeOriginalEffectBirth(String generation){
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native writer fence missing");
        return originalEffectBirths.remove(generation);
    }
    private final Store store;
    NativeRecurringTargetJournal(Store store){this.store=java.util.Objects.requireNonNull(store);}
    static boolean isTargetRead(AuthorizedRequest request)throws VaultFailure {
        return request!=null&&"GET".equals(request.method)
            &&"/schedule-api/my-day-summary".equals(RequestPolicy.genericRequestUri(request).getPath());
    }
    /** Exact retained row DATA from this actual capture, never authentication or
     * application authority by type alone. Only the Engine's lexical native
     * response operation may wrap this in its own private original holder. */
    static final class RetainedTargetData {
        final String principalSha256,key,record;
        private RetainedTargetData(String principalSha256,String key,String record){
            this.principalSha256=principalSha256;this.key=key;this.record=record;
        }
    }
    RetainedTargetData captureActualTarget(AuthorizedRequest request,AuthorizedResponse response,ResponseOwner owner)throws VaultFailure {
        if(!isTargetRead(request)||response==null||response.status!=200)return null;
        byte[] body=response.body.clone();
        try {
            NativeProviderPrincipal principal=owner.requireCurrent();owner.requireActual(request,response);
            JSONObject envelope=ProviderWireJson.object(body,8*1024*1024);
            if(!Boolean.TRUE.equals(envelope.opt("ok")))return null;
            JSONObject data=envelope.getJSONObject("data");String mode=data.optString("schedule_delivery_mode");
            if(!Set.of("RECURRING_SCHEDULE","RECURRING_TERMINAL").contains(mode))return null;
            JSONObject p=principal.json(),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
            JSONObject meta=envelope.getJSONObject("meta");
            for(String name:new String[]{"employee_id","credential_id","canonical_device_id","assignment_epoch"})
                if(!java.util.Objects.equals(data.get(name),meta.get(name)))throw invalid();
            if(!Set.of(mode.equals("RECURRING_TERMINAL")?"DEVICE_REPORTED_BLOCKED":"DEVICE_REPORTED_APPLIED","PENDING")
                .contains(delivery.getString("applicationStatus")))throw invalid();
            requireUuid(delivery.getString("intentId"));requireDigest(delivery.getString("targetDigest"));
            if(!p.getString("device_id").equals(data.get("canonical_device_id"))
                ||!p.getString("employee_id").equals(data.get("employee_id"))
                ||!p.getString("credential_id").equals(data.get("credential_id"))
                ||p.getLong("assignment_epoch")!=exactPositive(data.get("assignment_epoch")))throw invalid();
            requireUuid(data.getString("canonical_device_pk"));
            requireTarget(target,data,mode);
            String targetText=targetText(target);if(!NativeProviderPrincipal.hash(targetText).equals(delivery.get("targetDigest")))throw invalid();
            boolean blocked=mode.equals("RECURRING_TERMINAL");String originalView=null;
            if(blocked) {
                if(!Boolean.FALSE.equals(delivery.opt("replacementCoverageReady"))
                    ||!delivery.isNull("viewJsonText")||!delivery.isNull("view"))throw invalid();
            } else {
                String view=delivery.getString("viewJsonText");originalView=view;
                if(view.length()>4*1024*1024||!NativeProviderPrincipal.hash(view).equals(target.get("viewDigest"))
                    ||!target.get("viewDigest").equals(delivery.get("viewDigest")))throw invalid();
                // Exact original view bytes are DATA, never DOM/OS settlement.
            }
            String responseSha=NativeRetainedAttempt.hash(body);
            JSONObject record=new JSONObject().put("schema","custodial.native-recurring-authenticated-target-data.v1")
                .put("principal",p).put("intent_id",delivery.get("intentId")).put("target",target)
                .put("target_text",targetText).put("target_digest",delivery.get("targetDigest"))
                .put("native_authorized_response_sha256",responseSha).put("state","AUTHENTICATED_TARGET_DATA_NOT_APPLIED")
                .put("original_view_bytes_retained",false).put("receipt_eligible",false);
            String key=TARGET_PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+delivery.getString("intentId"));
            String previous=store.loadRecurringRecord(key),retainedTarget=previous;
            if(previous!=null) {
                JSONObject existing=record(previous);requireSamePrincipal(existing,principal);
                if(!existing.getString("target_text").equals(targetText)
                    ||!existing.get("target_digest").equals(delivery.get("targetDigest")))throw invalid();
                if("custodial.native-recurring-authenticated-target-data.v2".equals(existing.get("schema"))&&!existing.isNull("original_view"))
                    requireViewMatches(principal,delivery.getString("intentId"),existing.getJSONObject("original_view"),originalView,
                        existing.getString("native_authorized_response_sha256"));
                // Preserve first actual response digest and all original values;
                // a legacy v1 record is never upgraded by a later response.
            } else {
                // A complete target row is published only after every bounded
                // immutable view chunk is durably retained and reread. Partial
                // chunks are preserved DATA on refusal, never a completion.
                JSONObject view=originalView==null?null:retainOriginalView(principal,delivery.getString("intentId"),originalView,responseSha);
                record.put("schema","custodial.native-recurring-authenticated-target-data.v2")
                    .put("original_view_bytes_retained",view!=null).put("original_view",nullable(view));
                owner.requireActual(request,response);
                if(!principal.same(owner.requireCurrent())||!java.util.Arrays.equals(body,response.body))throw invalid();
                if(view!=null)requireViewMatches(principal,delivery.getString("intentId"),view,originalView,responseSha);
                store.compareAndRetainRecurringRecord(key,null,record.toString());
                String retained=store.loadRecurringRecord(key);
                if(!record.toString().equals(retained))throw invalid();retainedTarget=retained;
            }
            owner.requireActual(request,response);
            if(!principal.same(owner.requireCurrent())||!java.util.Arrays.equals(body,response.body))throw invalid();
            // A legacy v1 is preserved, not promoted to a complete-view birth.
            if(!"custodial.native-recurring-authenticated-target-data.v2".equals(record(retainedTarget).get("schema")))return null;
            return new RetainedTargetData(principal.digest,key,retainedTarget);
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
        finally{java.util.Arrays.fill(body,(byte)0);}
    }
    /** Separate narrow WORK family. Ordinary cell/namespace bounds remain
     * unchanged. Values are exact UTF-8 DATA from the actual native response,
     * not caller-provided replacement view or a ready/currentness observation. */
    private JSONObject retainOriginalView(NativeProviderPrincipal principal,String intent,String view,String responseSha)throws Exception {
        requireDigest(responseSha);
        byte[] bytes=view.getBytes(StandardCharsets.UTF_8);
        try {
            if(bytes.length>MAX_VIEW_BYTES||!view.equals(new String(bytes,StandardCharsets.UTF_8)))throw invalid();
            int count=Math.max(1,(bytes.length+VIEW_CHUNK_BYTES-1)/VIEW_CHUNK_BYTES);
            String digest=NativeRetainedAttempt.hash(bytes);
            JSONObject descriptor=new JSONObject().put("schema","custodial.native-recurring-original-view.v1")
                .put("byte_count",bytes.length).put("chunk_count",count).put("sha256",digest)
                .put("native_authorized_response_sha256",responseSha);
            for(int i=0;i<count;i++) {
                byte[] part=java.util.Arrays.copyOfRange(bytes,i*VIEW_CHUNK_BYTES,Math.min(bytes.length,(i+1)*VIEW_CHUNK_BYTES));
                try {
                    JSONObject chunk=new JSONObject().put("schema","custodial.native-recurring-original-view-chunk.v1")
                        .put("principal",principal.json()).put("intent_id",intent).put("index",i)
                        .put("chunk_count",count).put("byte_count",bytes.length).put("view_sha256",digest)
                        .put("chunk_sha256",NativeRetainedAttempt.hash(part)).put("hex",hex(part))
                        .put("native_authorized_response_sha256",responseSha).put("receipt_eligible",false);
                    String key=viewKey(principal,intent,i),previous=store.loadRecurringRecord(key);
                    if(previous==null)store.compareAndRetainRecurringRecord(key,null,chunk.toString());
                    // Existing chunks, including unknown/malformed ones, are
                    // never overwritten or silently adopted as this original.
                    else if(!chunk.toString().equals(previous))throw invalid();
                    if(!chunk.toString().equals(store.loadRecurringRecord(key)))throw invalid();
                }finally{java.util.Arrays.fill(part,(byte)0);}
            }
            requireViewMatches(principal,intent,descriptor,view,responseSha);return descriptor;
        }finally{java.util.Arrays.fill(bytes,(byte)0);}
    }
    private void requireViewMatches(NativeProviderPrincipal principal,String intent,JSONObject descriptor,String expected,String responseSha)throws Exception {
        requireDigest(responseSha);
        if(!responseSha.equals(descriptor.get("native_authorized_response_sha256")))throw invalid();
        byte[] retained=readOriginalView(principal,intent,descriptor),original=expected.getBytes(StandardCharsets.UTF_8);
        try {if(!java.util.Arrays.equals(retained,original))throw invalid();}
        finally{java.util.Arrays.fill(retained,(byte)0);java.util.Arrays.fill(original,(byte)0);}
    }
    /** Returns owned original DATA only. The caller must supply its independent
     * native document/effect/currentness proof before any receipt purpose. */
    byte[] readOriginalView(NativeProviderPrincipal principal,String intent,JSONObject descriptor)throws VaultFailure {
        byte[] assembled=null;
        try {
            requireUuid(intent);requireViewDescriptor(descriptor);
            int length=descriptor.getInt("byte_count"),count=descriptor.getInt("chunk_count");
            // SAME Store's whole raw/ciphertext observation is checked after
            // its last decrypt/key callback. Parse this owned immutable DATA
            // frame without lending independent per-file positive reads.
            Map<String,String> frame=Map.copyOf(store.recurringRecords());
            assembled=new byte[length];
            for(int i=0;i<count;i++) {
                JSONObject chunk=record(frame.get(viewKey(principal,intent,i)));
                requireSamePrincipal(chunk,principal);
                if(!intent.equals(chunk.get("intent_id"))||chunk.getInt("index")!=i
                    ||chunk.getInt("chunk_count")!=count||chunk.getInt("byte_count")!=length
                    ||!descriptor.get("sha256").equals(chunk.get("view_sha256"))
                    ||!descriptor.get("native_authorized_response_sha256").equals(chunk.get("native_authorized_response_sha256")))throw invalid();
                byte[] part=unhex(chunk.getString("hex"));
                try {
                    int expected=Math.min(VIEW_CHUNK_BYTES,length-i*VIEW_CHUNK_BYTES);
                    if(part.length!=expected||!NativeRetainedAttempt.hash(part).equals(chunk.get("chunk_sha256")))throw invalid();
                    System.arraycopy(part,0,assembled,i*VIEW_CHUNK_BYTES,part.length);
                }finally{java.util.Arrays.fill(part,(byte)0);}
            }
            if(!NativeRetainedAttempt.hash(assembled).equals(descriptor.get("sha256")))throw invalid();
            // Invalid or lossy UTF-8 is not the original Java view string.
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(assembled));
            byte[] result=assembled;assembled=null;return result;
        }catch(VaultFailure unavailable){throw unavailable;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
        finally{if(assembled!=null)java.util.Arrays.fill(assembled,(byte)0);}
    }
    private static void requireViewDescriptor(JSONObject value)throws Exception {
        NativeRetainedAttempt.keys(value,"schema","byte_count","chunk_count","sha256","native_authorized_response_sha256");
        requireDigest(value.getString("native_authorized_response_sha256"));
        if(!"custodial.native-recurring-original-view.v1".equals(value.get("schema")))throw invalid();
        int length=exactBoundedInt(value.get("byte_count"),0,MAX_VIEW_BYTES),count=exactBoundedInt(value.get("chunk_count"),1,MAX_VIEW_BYTES/VIEW_CHUNK_BYTES);
        if(count!=Math.max(1,(length+VIEW_CHUNK_BYTES-1)/VIEW_CHUNK_BYTES))throw invalid();requireDigest(value.getString("sha256"));
    }
    private static int exactBoundedInt(Object value,int minimum,int maximum)throws VaultFailure {
        if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<minimum||((Number)value).longValue()>maximum)throw invalid();
        return ((Number)value).intValue();
    }
    static String viewKey(NativeProviderPrincipal principal,String intent,int index)throws VaultFailure {
        requireUuid(intent);if(index<0||index>=MAX_VIEW_BYTES/VIEW_CHUNK_BYTES)throw invalid();
        return VIEW_PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+intent+":"+index);
    }
    private static String hex(byte[] bytes){char[] alphabet="0123456789abcdef".toCharArray(),out=new char[bytes.length*2];for(int i=0;i<bytes.length;i++){out[2*i]=alphabet[(bytes[i]&255)>>>4];out[2*i+1]=alphabet[bytes[i]&15];}return new String(out);}
    private static byte[] unhex(String value)throws VaultFailure {
        if(value==null||value.length()>2*VIEW_CHUNK_BYTES||(value.length()&1)!=0||!value.matches("[a-f0-9]*"))throw invalid();
        byte[] out=new byte[value.length()/2];for(int i=0;i<out.length;i++)out[i]=(byte)((Character.digit(value.charAt(2*i),16)<<4)|Character.digit(value.charAt(2*i+1),16));return out;
    }
    /** Whole original protected journal DATA, not a settlement verdict. Only
     * acquisition/terminal checks of the native writer lease consume this. */
    static final class KnownWriterFrame {
        private final String digest;private final int count;
        private KnownWriterFrame(String digest,int count){this.digest=digest;this.count=count;}
    }
    KnownWriterFrame captureKnownWriterFrame()throws VaultFailure {
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw invalid();
        try {
            Map<String,String> original=Map.copyOf(store.recurringRecords());
            if(original.size()>4096)throw invalid();
            for(var entry:original.entrySet()){
                JSONObject row=record(entry.getValue());
                NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
                String schema=row.getString("schema"),expectedKey;
                if(schema.startsWith("custodial.native-notification-mutation-data.")){
                    expectedKey=mutationKey(row.getString("generation"));
                    if(!"custodial.native-notification-mutation-data.v2".equals(schema)
                        ||row.isNull("post_effect_frame")
                        ||!Set.of("SCHEDULE_CALLED","RESTORE_CALLED","CANCEL_CALLED","DISPATCH_CALLED").contains(row.getString("state")))throw invalid();
                }else if(schema.startsWith("custodial.native-recurring-authenticated-target-data.")){
                    expectedKey=TARGET_PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+row.getString("intent_id"));
                }else if("custodial.native-recurring-original-view-chunk.v1".equals(schema)){
                    expectedKey=viewKey(principal,row.getString("intent_id"),row.getInt("index"));
                }else throw invalid();
                if(!expectedKey.equals(entry.getKey()))throw invalid();
            }
            return new KnownWriterFrame(NativeProtectedWorkSnapshot.capture(original).digest,original.size());
        }catch(VaultFailure unavailable){throw unavailable;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void requireKnownWriterFrame(KnownWriterFrame original)throws VaultFailure {
        if(original==null)throw invalid();KnownWriterFrame terminal=captureKnownWriterFrame();
        if(original.count!=terminal.count||!original.digest.equals(terminal.digest))throw invalid();
    }
    /** Known IDs never become untracked because their current raw DATA,
     * principal, group or native-only generation disappeared or changed. */
    private JSONObject knownMutation(int id)throws VaultFailure {
        try {
            JSONObject found=null;
            for(var entry:store.recurringRecords().entrySet())if(entry.getKey().startsWith(MUTATION_PREFIX)) {
                JSONObject row=record(entry.getValue());if(row.getInt("id")!=id)continue;
                if(found!=null)throw invalid();found=row;
            }
            return found;
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void requireUntrackedId(int id)throws VaultFailure {if(knownMutation(id)!=null)throw invalid();}
    private JSONObject requireKnownOriginal(NativeProviderPrincipal principal,int id,String raw)throws Exception {
        JSONObject row=knownMutation(id);if(row==null)return null;
        requireSamePrincipal(row,principal);
        if(raw==null||!row.getString("raw_notification").equals(raw)
            ||ownedNotification(principal,id,raw)==null)throw invalid();
        return row;
    }
    private static long originalAlarmDeadline(JSONObject row)throws Exception {
        JSONObject notification=new JSONObject(row.getString("raw_notification"));
        JSONObject schedule=notification.getJSONObject("schedule");
        if(!(schedule.get("at") instanceof String)||schedule.optBoolean("repeats")
            ||schedule.has("every")||schedule.has("on"))throw invalid();
        long deadline=java.time.Instant.parse(schedule.getString("at")).toEpochMilli();
        if(deadline<=0)throw invalid();return deadline;
    }
    void requireRestoreCandidate(NativeProviderPrincipal principal,int id,String raw,long observedNow)throws VaultFailure {
        try {
            JSONObject row=requireKnownOriginal(principal,id,raw);if(row==null)return;
            if(!"custodial.native-notification-mutation-data.v2".equals(row.get("schema"))
                ||!Set.of("SCHEDULE_CALLED","RESTORE_CALLED").contains(row.getString("state"))
                ||originalAlarmDeadline(row)<=observedNow)throw invalid();
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    String beforeRestore(NativeProviderPrincipal principal,int id,String raw,long actualDeadline,long observedNow)throws VaultFailure {
        try {
            JSONObject row=requireKnownOriginal(principal,id,raw);if(row==null)return null;
            if(!"custodial.native-notification-mutation-data.v2".equals(row.get("schema"))
                ||!Set.of("SCHEDULE_CALLED","RESTORE_CALLED").contains(row.getString("state"))
                ||originalAlarmDeadline(row)!=actualDeadline||actualDeadline<=observedNow)throw invalid();
            String generation=row.getString("generation");
            // A distinct normal boot restore consumes this SAME generation.
            // Unknown or partially called restore can never start it again.
            transition(generation,Set.of(row.getString("state")),"RESTORE_ATTEMPTED");return generation;
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void requireRestoreCurrent(NativeProviderPrincipal principal,String generation,int id,String raw,
        long actualDeadline,long observedNow)throws VaultFailure {
        try {
            JSONObject row=requireKnownOriginal(principal,id,raw);
            if(row==null||!generation.equals(row.get("generation"))||!"RESTORE_ATTEMPTED".equals(row.get("state"))
                ||originalAlarmDeadline(row)!=actualDeadline||actualDeadline<=observedNow)throw invalid();
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void restoreCalled(String generation,NativeNotificationOriginalFrame frame)throws VaultFailure {
        called(generation,Set.of("RESTORE_ATTEMPTED"),"RESTORE_CALLED",frame);
    }
    void requireDispatchCurrent(NativeProviderPrincipal principal,String generation,int id,String group)throws VaultFailure {
        if(generation==null){requireUntrackedId(id);return;}
        try {
            JSONObject row=knownMutation(id);
            if(row==null||!generation.equals(row.get("generation"))||!java.util.Objects.equals(group,row.get("group"))
                ||!"DISPATCH_ATTEMPTED".equals(row.get("state")))throw invalid();
            requireSamePrincipal(row,principal);
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    /** Native vendor source calls this BEFORE the actual OS operation. Caller
     * JSON supplies only opaque operation DATA, never principal or acceptance. */
    String beforeSchedule(NativeProviderPrincipal principal,int id,String original)throws VaultFailure {
        requireUntrackedId(id);
        JSONObject notification=ownedNotification(principal,id,original);if(notification==null)return null;
        try {
            for(var existing:store.recurringRecords().entrySet())if(existing.getKey().startsWith(MUTATION_PREFIX)) {
                JSONObject retained=record(existing.getValue());
                // The real normal scheduler permanently reserves numeric IDs.
                // A prior known/unknown generation is never an instruction to
                // replace or resubmit this original under a new generation.
                if(retained.getInt("id")==id)throw invalid();
            }
            String generation=UUID.randomUUID().toString();
            JSONObject row=new JSONObject().put("schema","custodial.native-notification-mutation-data.v2")
                .put("principal",principal.json()).put("generation",generation).put("id",id)
                .put("group",notification.get("group")).put("raw_notification",original)
                .put("raw_sha256",NativeProviderPrincipal.hash(original)).put("state","SCHEDULE_ATTEMPTED")
                .put("target_reference",nullable(findTargetReference(principal,notification)))
                .put("post_effect_frame",JSONObject.NULL).put("receipt_eligible",false);
            String key=mutationKey(generation);store.compareAndRetainRecurringRecord(key,null,row.toString());
            if(originalEffectBirths.size()<1024&&!row.isNull("target_reference"))originalEffectBirths.put(generation,
                new BornEffect(principal,generation,id,row.getString("group"),original,
                    notification.getJSONObject("extra").getString("service_date"),row.getString("target_reference")));
            return generation;
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void scheduleCalled(String generation)throws VaultFailure {
        if(generation==null)return;
        try {
            JSONObject row=record(store.loadRecurringRecord(mutationKey(generation)));
            if("DISPATCH_CALLED".equals(row.get("state")))return; // Immediate actual notify already recorded, never downgrade it.
            transition(generation,Set.of("SCHEDULE_ATTEMPTED"),"SCHEDULE_CALLED");
        }catch(VaultFailure unavailable){throw unavailable;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void scheduleCalled(String generation,NativeNotificationOriginalFrame frame)throws VaultFailure {
        if(generation==null)return;
        try {
            JSONObject row=record(store.loadRecurringRecord(mutationKey(generation)));
            if("DISPATCH_CALLED".equals(row.get("state")))return; // Preserve first actual immediate-dispatch trace.
            called(generation,Set.of("SCHEDULE_ATTEMPTED"),"SCHEDULE_CALLED",frame);
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    String beforeCancel(NativeProviderPrincipal principal,int id,String currentRaw)throws VaultFailure {
        try {
            JSONObject row=requireKnownOriginal(principal,id,currentRaw);if(row==null)return null;
            String generation=row.getString("generation");
            transition(generation,Set.of("SCHEDULE_ATTEMPTED","SCHEDULE_CALLED","RESTORE_ATTEMPTED","RESTORE_CALLED",
                "DISPATCH_ATTEMPTED","DISPATCH_CALLED"),"CANCEL_ATTEMPTED");return generation;
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    String beforeDeliveredCancel(NativeProviderPrincipal principal,int id,String group)throws VaultFailure {
        try {
            JSONObject row=knownMutation(id);if(row==null)return null;
            requireSamePrincipal(row,principal);
            if(!java.util.Objects.equals(group,row.get("group")))throw invalid();
            String generation=row.getString("generation");
            transition(generation,Set.of("SCHEDULE_ATTEMPTED","SCHEDULE_CALLED","RESTORE_ATTEMPTED","RESTORE_CALLED",
                "DISPATCH_ATTEMPTED","DISPATCH_CALLED"),"CANCEL_ATTEMPTED");return generation;
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void cancelCalled(String generation)throws VaultFailure {transition(generation,Set.of("CANCEL_ATTEMPTED"),"CANCEL_CALLED");}
    void cancelCalled(String generation,NativeNotificationOriginalFrame frame)throws VaultFailure {called(generation,Set.of("CANCEL_ATTEMPTED"),"CANCEL_CALLED",frame);}
    void dispatchCalled(String generation,NativeNotificationOriginalFrame frame)throws VaultFailure {called(generation,Set.of("DISPATCH_ATTEMPTED"),"DISPATCH_CALLED",frame);}
    private void called(String generation,Set<String> expected,String next,NativeNotificationOriginalFrame frame)throws VaultFailure {
        if(generation==null)return;
        try {
            if(frame==null)throw invalid();String key=mutationKey(generation),previous=store.loadRecurringRecord(key);JSONObject row=record(previous);
            if(!generation.equals(row.get("generation"))||!expected.contains(row.getString("state"))
                ||!"custodial.native-notification-mutation-data.v2".equals(row.get("schema")))throw invalid();
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            row.put("post_effect_frame",frame.data(principal,generation)).put("state",next);
            // Historical actual-native-call DATA only. OS identity observation
            // does not attest browser/OS effect settlement or currentness.
            store.compareAndRetainRecurringRecord(key,previous,row.toString());
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    /** An old queued intent bearing this exact NEW native generation can be
     * denied only by its own durable explicit cancellation. Unknown old vendor
     * intents remain untouched. This Boolean is never receipt evidence. */
    boolean beforeDispatch(NativeProviderPrincipal principal,String generation,int id,String group)throws VaultFailure {
        if(generation==null){requireUntrackedId(id);return true;}
        try {
            JSONObject row=record(store.loadRecurringRecord(mutationKey(generation)));
            if(row.getInt("id")!=id||!row.getString("group").equals(group))throw invalid();
            requireSamePrincipal(row,principal);
            String state=row.getString("state");
            if(Set.of("CANCEL_ATTEMPTED","CANCEL_CALLED").contains(state))return false;
            // A consumed/uncertain dispatch generation never starts another
            // episode. Repeating vendor work is NOT upgraded by this stage.
            if(!Set.of("SCHEDULE_ATTEMPTED","SCHEDULE_CALLED","RESTORE_CALLED").contains(state))throw invalid();
            transition(generation,Set.of(state),"DISPATCH_ATTEMPTED");return true;
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    void dispatchCalled(String generation)throws VaultFailure {transition(generation,Set.of("DISPATCH_ATTEMPTED"),"DISPATCH_CALLED");}
    private void transition(String generation,Set<String> allowed,String next)throws VaultFailure {
        if(generation==null)return;
        try {
            String key=mutationKey(generation),previous=store.loadRecurringRecord(key);JSONObject row=record(previous);
            if(!generation.equals(row.get("generation"))||!allowed.contains(row.getString("state")))throw invalid();
            row.put("state",next);store.compareAndRetainRecurringRecord(key,previous,row.toString());
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    /** Constructor-private retained DATA, not a generation/authority factory.
     * Ordinary effect observations only use generations already born in the
     * actual normal native writer. No mutation schema or old11 guard changes. */
    static final class KnownEffect {
        final NativeProviderPrincipal principal;
        final String generation,group,rawNotification,state,serviceDate,targetReference,recordText,targetText;
        final int id;
        private KnownEffect(NativeProviderPrincipal principal,JSONObject row,String recordText,String targetText)throws Exception {
            this.principal=principal;this.recordText=recordText;this.targetText=targetText;
            generation=row.getString("generation");id=row.getInt("id");group=row.getString("group");
            rawNotification=row.getString("raw_notification");state=row.getString("state");targetReference=row.getString("target_reference");
            serviceDate=new JSONObject(rawNotification).getJSONObject("extra").getString("service_date");
            if(!serviceDate.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw invalid();java.time.LocalDate.parse(serviceDate);
        }
        boolean sameOriginal(KnownEffect other){return other!=null&&principal.same(other.principal)&&generation.equals(other.generation)
            &&id==other.id&&group.equals(other.group)&&rawNotification.equals(other.rawNotification)
            &&serviceDate.equals(other.serviceDate)&&targetReference.equals(other.targetReference)&&targetText.equals(other.targetText);}
    }
    KnownEffect readKnownEffect(NativeProviderPrincipal principal,String serviceDate,String generation)throws VaultFailure {
        KnownEffect value=readOrdinaryEffectScope(principal,serviceDate).get(generation);if(value==null)throw invalid();return value;
    }
    private static KnownEffect knownEffect(Map<String,String> rows,String generation)throws VaultFailure {
        try {
            String text=rows.get(mutationKey(generation));JSONObject row=record(text);
            if(!generation.equals(row.get("generation"))||!"custodial.native-notification-mutation-data.v2".equals(row.get("schema"))
                ||row.isNull("target_reference"))throw invalid();
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            String targetText=rows.get(row.getString("target_reference"));JSONObject target=record(targetText);requireSamePrincipal(target,principal);
            KnownEffect result=new KnownEffect(principal,row,text,targetText);
            if(!result.serviceDate.equals(target.getJSONObject("target").getString("serviceDate")))throw invalid();return result;
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    Map<String,KnownEffect> readOrdinaryEffectScope(NativeProviderPrincipal principal,String serviceDate)throws VaultFailure {
        try {
            if(principal==null||serviceDate==null||!serviceDate.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw invalid();
            java.time.LocalDate.parse(serviceDate);Map<String,KnownEffect> result=new java.util.TreeMap<>();
            Map<String,String> snapshot=store.notificationEffectRecords(principal,serviceDate);
            for(var entry:snapshot.entrySet())if(entry.getKey().startsWith(MUTATION_PREFIX)) {
                if(entry.getValue()==null||entry.getValue().length()>MAX_RECORD)throw invalid();JSONObject hint=new JSONObject(entry.getValue());
                NativeProviderPrincipal other=NativeProviderPrincipal.fromNativeJournal(hint.getJSONObject("principal"));
                if(!principal.same(other))continue;
                JSONObject notification=new JSONObject(hint.getString("raw_notification")),extra=notification.getJSONObject("extra");String date=extra.getString("service_date");
                if(!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw invalid();java.time.LocalDate.parse(date);
                if(!serviceDate.equals(date))continue;
                KnownEffect known=knownEffect(snapshot,hint.getString("generation"));
                if(!mutationKey(known.generation).equals(entry.getKey())||!principal.same(known.principal)||!serviceDate.equals(known.serviceDate)
                    ||result.put(known.generation,known)!=null)throw invalid();
            }
            return java.util.Collections.unmodifiableMap(result);
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    private String findTargetReference(NativeProviderPrincipal principal,JSONObject notification)throws Exception {
        JSONObject extra=notification.getJSONObject("extra");String found=null;
        for(var entry:store.recurringRecords().entrySet())if(entry.getKey().startsWith(TARGET_PREFIX)) {
            JSONObject row=record(entry.getValue());
            if(!NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal")).same(principal))continue;
            JSONObject t=row.getJSONObject("target");
            Object revision=extra.opt("schedule_authority_revision");
            if(!java.util.Objects.equals(extra.opt("service_date"),t.opt("serviceDate"))
                ||!(revision instanceof String||revision instanceof Integer||revision instanceof Long)
                ||!revision.toString().matches("[1-9][0-9]{0,15}")
                ||!revision.toString().equals(t.get("authorityRevision").toString())
                ||extra.has("publication_id")&&!java.util.Objects.equals(extra.opt("publication_id"),t.opt("publicationId")))continue;
            if(found!=null)throw invalid();found=entry.getKey();
        }
        return found; // A reference binds raw DATA only, never a current target verdict.
    }
    private static JSONObject ownedNotification(NativeProviderPrincipal principal,int id,String raw)throws VaultFailure {
        if(principal==null||raw==null||raw.length()>MAX_NOTIFICATION||id<1)return null;
        try {
            JSONObject row=new JSONObject(raw),extra=row.getJSONObject("extra");
            // This first generation family is one-shot only. Never consume or
            // retime an existing repeating/interval/cron episode as one shot.
            JSONObject schedule=row.optJSONObject("schedule");
            if(schedule!=null&&(!(schedule.opt("at") instanceof String)||schedule.optBoolean("repeats")
                ||schedule.has("every")||schedule.has("on")))return null;
            if(exactPositive(row.get("id"))!=id||!String.valueOf(id).equals(extra.get("native_presentation_id"))
                ||!row.getString("group").matches("mz-custodial-owned:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"))return null;
            NativeProviderPrincipal claimed=NativeProviderPrincipal.fromNativeJournal(new JSONObject(extra.getString("native_presentation_principal")));
            return principal.same(claimed)?row:null;
        }catch(Exception foreign){return null;}
    }
    private static JSONObject record(String text)throws VaultFailure {
        try {if(text==null||text.length()>MAX_RECORD)throw invalid();JSONObject row=new JSONObject(text);
            if(!Boolean.FALSE.equals(row.get("receipt_eligible")))throw invalid();
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            if(Set.of("custodial.native-recurring-authenticated-target-data.v1","custodial.native-recurring-authenticated-target-data.v2").contains(row.optString("schema"))) {
                boolean complete="custodial.native-recurring-authenticated-target-data.v2".equals(row.get("schema"));
                if(complete)NativeRetainedAttempt.keys(row,"schema","principal","intent_id","target","target_text","target_digest",
                    "native_authorized_response_sha256","state","original_view_bytes_retained","original_view","receipt_eligible");
                else NativeRetainedAttempt.keys(row,"schema","principal","intent_id","target","target_text","target_digest",
                    "native_authorized_response_sha256","state","original_view_bytes_retained","receipt_eligible");
                requireUuid(row.getString("intent_id"));requireDigest(row.getString("target_digest"));
                requireDigest(row.getString("native_authorized_response_sha256"));
                boolean hasView=complete&&!row.isNull("original_view");
                if(complete&&hasView!=!"BLOCKED_RECURRING_AUTHORITY".equals(row.getJSONObject("target").opt("targetType")))throw invalid();
                if(!"AUTHENTICATED_TARGET_DATA_NOT_APPLIED".equals(row.get("state"))
                    ||!Boolean.valueOf(hasView).equals(row.get("original_view_bytes_retained"))
                    ||!targetText(row.getJSONObject("target")).equals(row.get("target_text"))
                    ||!NativeProviderPrincipal.hash(row.getString("target_text")).equals(row.get("target_digest")))throw invalid();
                if(hasView){requireViewDescriptor(row.getJSONObject("original_view"));
                    if(!row.getJSONObject("original_view").get("sha256").equals(row.getJSONObject("target").get("viewDigest"))
                        ||!row.getJSONObject("original_view").get("native_authorized_response_sha256").equals(row.get("native_authorized_response_sha256")))throw invalid();}
            }else if("custodial.native-recurring-original-view-chunk.v1".equals(row.opt("schema"))) {
                NativeRetainedAttempt.keys(row,"schema","principal","intent_id","index","chunk_count","byte_count","view_sha256","chunk_sha256","hex","native_authorized_response_sha256","receipt_eligible");
                requireDigest(row.getString("native_authorized_response_sha256"));
                requireUuid(row.getString("intent_id"));requireDigest(row.getString("view_sha256"));requireDigest(row.getString("chunk_sha256"));
                int index=exactBoundedInt(row.get("index"),0,MAX_VIEW_BYTES/VIEW_CHUNK_BYTES-1);
                int count=exactBoundedInt(row.get("chunk_count"),1,MAX_VIEW_BYTES/VIEW_CHUNK_BYTES);
                int length=exactBoundedInt(row.get("byte_count"),0,MAX_VIEW_BYTES);
                if(index>=count||count!=Math.max(1,(length+VIEW_CHUNK_BYTES-1)/VIEW_CHUNK_BYTES))throw invalid();
                byte[] part=unhex(row.getString("hex"));try{if(part.length!=Math.min(VIEW_CHUNK_BYTES,length-index*VIEW_CHUNK_BYTES)
                    ||!NativeRetainedAttempt.hash(part).equals(row.get("chunk_sha256")))throw invalid();}finally{java.util.Arrays.fill(part,(byte)0);}
            }else if(Set.of("custodial.native-notification-mutation-data.v1","custodial.native-notification-mutation-data.v2").contains(row.optString("schema"))) {
                boolean observed="custodial.native-notification-mutation-data.v2".equals(row.get("schema"));
                if(observed)NativeRetainedAttempt.keys(row,"schema","principal","generation","id","group","raw_notification","raw_sha256","state","target_reference","post_effect_frame","receipt_eligible");
                else NativeRetainedAttempt.keys(row,"schema","principal","generation","id","group","raw_notification","raw_sha256","state","target_reference","receipt_eligible");
                if(observed&&!row.isNull("post_effect_frame"))NativeNotificationOriginalFrame.requireDescriptor(row.getJSONObject("post_effect_frame"),principal,row.getString("generation"));
                requireUuid(row.getString("generation"));requireDigest(row.getString("raw_sha256"));
                if(exactPositive(row.get("id"))>2147483647L
                    ||!NativeProviderPrincipal.hash(row.getString("raw_notification")).equals(row.get("raw_sha256"))
                    ||!Set.of("SCHEDULE_ATTEMPTED","SCHEDULE_CALLED","RESTORE_ATTEMPTED","RESTORE_CALLED","CANCEL_ATTEMPTED","CANCEL_CALLED","DISPATCH_ATTEMPTED","DISPATCH_CALLED").contains(row.getString("state")))throw invalid();
                JSONObject notification=ownedNotification(principal,row.getInt("id"),row.getString("raw_notification"));
                if(notification==null||!notification.get("group").equals(row.get("group")))throw invalid();
                if(!row.isNull("target_reference")&&!row.getString("target_reference").matches("native_recurring_target_sha256:[a-f0-9]{64}"))throw invalid();
            }else throw invalid();
            return row;
        }catch(VaultFailure unavailable){throw unavailable;}catch(Exception malformed){throw new VaultFailure(FAILURE,malformed);}
    }
    private static void requireSamePrincipal(JSONObject row,NativeProviderPrincipal p)throws Exception {if(!p.same(NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"))))throw invalid();}
    private static String mutationKey(String generation)throws VaultFailure {requireUuid(generation);return MUTATION_PREFIX+NativeProviderPrincipal.hash(generation);}
    private static void requireUuid(String x)throws VaultFailure {if(x==null||!x.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))throw invalid();}
    private static void requireDigest(String x)throws VaultFailure {if(x==null||!x.matches("[a-f0-9]{64}"))throw invalid();}
    private static long exactPositive(Object value)throws VaultFailure {if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<1||((Number)value).longValue()>9007199254740991L)throw invalid();return ((Number)value).longValue();}
    private static void requireTarget(JSONObject t,JSONObject data,String mode)throws Exception {
        boolean blocked=mode.equals("RECURRING_TERMINAL");
        String[] base={"schema","targetType","operationId","publicationId","serviceDate","authorityRevision","employeeId","deviceId","credentialId","assignmentEpoch"};
        Set<String> keys=new TreeSet<>(java.util.Arrays.asList(base));keys.addAll(blocked?Set.of("invalidationId","reasonCode"):Set.of("projectionId","lunchDocumentIdentity","viewDigest"));
        Set<String> actual=new TreeSet<>();t.keys().forEachRemaining(actual::add);if(!keys.equals(actual))throw invalid();
        if(!(blocked?"static-weekly.recurring-terminal-target.v1":"static-weekly.recurring-application-target.v1").equals(t.get("schema"))
            ||!(blocked?"BLOCKED_RECURRING_AUTHORITY":"SCHEDULE").equals(t.get("targetType"))
            ||!data.get("employee_id").equals(t.get("employeeId"))||!data.get("credential_id").equals(t.get("credentialId"))
            ||!data.get("canonical_device_pk").equals(t.get("deviceId"))||exactPositive(data.get("assignment_epoch"))!=exactPositive(t.get("assignmentEpoch"))
            ||!data.get("service_date").equals(t.get("serviceDate")))throw invalid();
        exactPositive(t.get("authorityRevision"));if(!t.getString("serviceDate").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw invalid();java.time.LocalDate.parse(t.getString("serviceDate"));
        for(String key:new String[]{"operationId","publicationId","employeeId","deviceId","credentialId"})requireUuid(t.getString(key));
        if(blocked){requireUuid(t.getString("invalidationId"));if(!Set.of("ROSTER_DEPENDENCY_CHANGED","SOURCE_RETIRED","RESTRICTION_DEPENDENCY_CHANGED").contains(t.getString("reasonCode")))throw invalid();}
        else{requireUuid(t.getString("projectionId"));requireDigest(t.getString("lunchDocumentIdentity"));requireDigest(t.getString("viewDigest"));}
    }
    private static String targetText(JSONObject target)throws Exception {
        var keys=new java.util.ArrayList<String>();target.keys().forEachRemaining(keys::add);
        keys.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder s=new StringBuilder("{");for(String key:keys){if(s.length()>1)s.append(", ");Object v=target.get(key);
            if(!(v instanceof String||v instanceof Integer||v instanceof Long))throw invalid();
            s.append(JSONObject.quote(key)).append(": ").append(v instanceof String?JSONObject.quote((String)v):v.toString());}
        return s.append('}').toString();
    }
    private static Object nullable(Object value){return value==null?JSONObject.NULL:value;}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
