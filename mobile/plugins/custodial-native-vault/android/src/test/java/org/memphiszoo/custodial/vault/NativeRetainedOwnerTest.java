package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import org.junit.Test;

/** Actual owner/frozen-work/attempt Android adapters and prepared HTTPS code.
 * ALL auth/key/durable disk and HttpsURLConnection are synthetic fixtures.
 * No live TLS/SQL, original phone values, activation or physical clock proof. */
public final class NativeRetainedOwnerTest {
    /** Only newly affected engine composition; no old owning suite replay. */
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--active-completion-capacity-only".equals(args[0])){
            new NativeRetainedOwnerTest().ACTIVE_completionCapacityUsesPurposeSizedWorkCipher();
            System.out.println("PASS_NEW_ACTIVE_COMPLETION_CAPACITY_PREREQUISITE synthetic store/cipher only; not SQL/Android/ACK");return;
        }
        if(args.length!=1||!"--pending-prepare-engine-only".equals(args[0]))throw new IllegalArgumentException("owning selector required");
        var test=new NativeRetainedOwnerTest();
        test.ENGINE_writeFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds();
        System.out.println("PASS_SOURCE_MOCK ENGINE_writeFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds");
        test.ENGINE_queryFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds();
        System.out.println("PASS_SOURCE_MOCK ENGINE_queryFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds");
        System.out.println("SOURCE_ENGINE_COMPOSITION_NOT_ANDROID_OR_CURRENT_SERVER_ACCEPTANCE");
    }
    interface Hook {void run() throws Exception;}
    interface Action {void run() throws Exception;}
    static void denied(Action action)throws Exception{try{action.run();fail("must remain preserved/pending");}catch(VaultFailure expected){}}
    static String id(int n){return NativeSeparationContextTest.id(n);}
    static final class WorkDisk {
        Map<String,Object> memory=new HashMap<>(),durable=new HashMap<>();boolean fail,memoryOnly;int commits;
        Hook afterCommit=()->{};
        SharedPreferences preferences(){return (SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(p,m,args)->{
            switch(m.getName()){
                case "getAll":return new HashMap<>(memory);
                case "contains":return memory.containsKey(args[0]);
                case "getString":case "getStringSet":case "getLong":case "getInt":case "getFloat":case "getBoolean":return memory.getOrDefault(args[0],args[1]);
                case "registerOnSharedPreferenceChangeListener":case "unregisterOnSharedPreferenceChangeListener":return null;
                case "edit":break;
                default:throw new AssertionError(m.getName());
            }
            Map<String,Object> puts=new HashMap<>();Set<String> removes=new HashSet<>();
            return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(e,method,a)->{
                if(method.getName().startsWith("put")){puts.put((String)a[0],a[1]);return e;}
                if(method.getName().equals("remove")){removes.add((String)a[0]);return e;}
                if(!method.getName().equals("commit"))throw new AssertionError("no clear/apply "+method.getName());
                commits++;if(fail)return false;for(String key:removes)memory.remove(key);memory.putAll(puts);afterCommit.run();
                if(!memoryOnly)durable=new HashMap<>(memory);return !memoryOnly;
            });
        });}
    }
    static final class TrackingCipher implements CredentialCipher {
        final TestCipher delegate;final List<char[]> reads=new ArrayList<>();
        TrackingCipher(){delegate=new TestCipher();}
        TrackingCipher(int maximumCiphertextCharacters){delegate=new TestCipher(maximumCiphertextCharacters);}
        private int wipeCursor;
        public EncryptedSecret encrypt(char[] clear)throws VaultFailure{return delegate.encrypt(clear);}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{return delegate.encryptWithExistingKey(clear);}
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{char[] result=delegate.decrypt(value);reads.add(result);wipeCursor=retireVerifiedZeroReads(reads,wipeCursor);return result;}
        public void destroyKey(){throw new AssertionError("key removal is not this source scope");}
        void wiped(){assertOutstandingReadsWiped(reads);}
    }
    // TEST collection only: no wiping, weak references or unchecked eviction.
    // Tombstones preserve the existing cumulative reads.size() denial proof.
    // The just-prior read catches sequential owner wipes; a fixed rotating
    // budget revisits overlapping reads without a quadratic full scan.
    static int retireVerifiedZeroReads(List<char[]> reads,int cursor){
        if(reads.size()>1)retireVerifiedZeroRead(reads,reads.size()-2);
        for(int checked=0;checked<8&&!reads.isEmpty();checked++){
            if(cursor>=reads.size())cursor=0;retireVerifiedZeroRead(reads,cursor++);
        }return cursor;
    }
    private static void retireVerifiedZeroRead(List<char[]> reads,int index){
        char[] value=reads.get(index);if(value==null)return;
        for(char character:value)if(character!='\0')return;
        reads.set(index,null); // Every character was verified zero above.
    }
    static void assertOutstandingReadsWiped(List<char[]> reads){
        for(int index=0;index<reads.size();index++){
            char[] value=reads.get(index);if(value==null)continue;
            for(char character:value)assertEquals("outstanding decrypted buffer was not wiped",'\0',character);
            reads.set(index,null); // Retire only after the final assertion.
        }
    }
    static final class PrincipalMemory implements NativePrincipalJournal.Store {
        String value;PrincipalMemory(String value){this.value=value;}public String loadPrincipal(){return value;}public void savePrincipal(String value){this.value=value;}
    }
    static final class Connection extends HttpsURLConnection {
        final Map<String,String> headers=new HashMap<>();final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        byte[] response="{\"ok\":true,\"data\":{\"status\":\"synthetic-transport-only\"}}".getBytes(StandardCharsets.UTF_8);
        Map<String,List<String>> replyHeaders=Map.of("Content-Type",List.of("application/json; charset=utf-8"));
        Hook output=()->{},reply=()->{};boolean loseReply;int disconnects,status=200;
        Connection(URL url){super(url);}
        public String getCipherSuite(){return "synthetic-only";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
        public void setRequestProperty(String key,String value){headers.put(key,value);}
        public OutputStream getOutputStream()throws java.io.IOException{try{output.run();}catch(Exception error){throw new java.io.IOException(error);}return sent;}
        public int getResponseCode()throws java.io.IOException{try{reply.run();}catch(Exception error){throw new java.io.IOException(error);}if(loseReply)throw new java.net.SocketTimeoutException("lost synthetic reply");return status;}
        public Map<String,List<String>> getHeaderFields(){return replyHeaders;}
        public InputStream getInputStream(){return new ByteArrayInputStream(response);}public InputStream getErrorStream(){return getInputStream();}
        public void disconnect(){disconnects++;}public boolean usingProxy(){return false;}public void connect(){}
    }
    static final class Fixture {
        /** Explicit SOURCE fixture opt-in only. Sample once before any native
         * enrollment/original is made; never retime an existing fixture.
         * This is not an Android clock or server-time/authentication claim.
         */
        private static long initialOriginalFixtureMillis(){
            String source=System.getProperty("custodial.fixture.original-clock-source");
            if(source==null)return 1800000000000L;
            if(!"fresh-host-before-originals".equals(source))throw new IllegalArgumentException("unknown_original_fixture_clock_source");
            return System.currentTimeMillis();
        }
        final MutableClock clock=new MutableClock(initialOriginalFixtureMillis());final MemoryPersistence persistence=new MemoryPersistence();
        final TrackingCipher vaultCipher=new TrackingCipher(),workCipher;final WorkDisk workDisk=new WorkDisk();
        final AndroidOfflineAuthorityTimeStore work;
        NativePrincipalJournal principal;
        final FakeTransport enrollment=new FakeTransport(clock);VaultEngine engine;
        final NativeRetainedAttemptTest.Disk journalDisk=new NativeRetainedAttemptTest.Disk();
        final NativeRetainedAttemptTest.ExistingCipher journalCipher=new NativeRetainedAttemptTest.ExistingCipher();
        NativeRetainedAttemptJournal journal;
        final NativeRetainedHttp.Attempt network=new NativeRetainedHttp.Attempt();
        int ids,opened;Connection connection;Hook beforeOutput=()->{},onReply=()->{};boolean loseReply;
        private enum InitialPhase { FROZEN_ORIGINAL, ACTIVE_BEFORE_SEPARATION }
        Fixture()throws Exception {this(InitialPhase.FROZEN_ORIGINAL);}
        /** New SOURCE fixture setup only. It creates the ordinary synthetic
         * enrollment/principal but cannot read or invent a later separation
         * context. Default retained tests keep their original frozen setup. */
        static Fixture activeBeforeSeparation()throws Exception {return new Fixture(InitialPhase.ACTIVE_BEFORE_SEPARATION);}
        private Fixture(InitialPhase initial)throws Exception {
            // Existing 32MiB receipt-store TEST recipe ONLY for active WORK.
            // Credential/default frozen fixtures retain the original16KiB bound.
            workCipher=initial==InitialPhase.ACTIVE_BEFORE_SEPARATION?new TrackingCipher(32*1024*1024):new TrackingCipher();
            work=new AndroidOfflineAuthorityTimeStore(workDisk.preferences(),workCipher);principal=new NativePrincipalJournal(work);
            engine=new VaultEngine(persistence,vaultCipher,enrollment,new FakeLegacySource(),new TestSealGenerator(),clock);
            engine.enroll(id(4),"KIOSK_08","enrollment","12345678".toCharArray());engine.completeLocalBinding(id(4));engine.confirmEnrollment(id(4));
            var state=engine.getState();String credential=(String)state.get("active_credential_id");
            JSONObject data=new JSONObject().put("authenticated",true).put("canonical_device_id","KIOSK_08").put("employee_id",id(2)).put("assignment_epoch",7).put("credential_id",credential);
            principal.capture(state,new AuthorizedRequest("/device-auth/status","GET",Map.of(),new byte[0]),NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(data)));
            workDisk.memory.put("unknown-original-work","unreadable original ciphertext");workDisk.memory.put("raw-set",Set.of("original","ñ"));
            workDisk.durable=new HashMap<>(workDisk.memory);
            if(initial==InitialPhase.FROZEN_ORIGINAL){
                NativeProviderPrincipal original=NativeProviderPrincipal.fromNativeJournal(principal.readFor(state));
                JSONObject ctx=NativeSeparationContextTest.data().put("credential_id",credential);
                NativeSeparationContext context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(ctx)),original);
                var raw=work.separationRawSnapshot();var proof=engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),principal,null);
                work.freezeSeparationSnapshot(raw,proof);
            }
            journal=new AndroidRetainedAttemptStore(journalDisk.preferences(),journalCipher).journal();
        }
        VaultEngine.NativeRetainedOperation prepare()throws VaultFailure{return engine.prepareNativeRetainedChunk(work,principal,null,journal,()->id(100+(++ids)),0);}
        NativeRetainedHttp http(){return new NativeRetainedHttp(url->{opened++;connection=new Connection(url);connection.output=beforeOutput;connection.reply=onReply;connection.loseReply=loseReply;return connection;},clock);}
        NativeRetainedHttp.Exchange send(VaultEngine.NativeRetainedOperation operation)throws VaultFailure{return engine.sendNativeRetainedChunk(operation,http(),network);}
        void bumpVault()throws Exception{VaultSnapshot s=persistence.current();persistence.commit(s.revision,s.next(s.phase,s.secretKind,s.secret,s.operationId,s.deviceId,s.flow,s.expiresAtMillis,s.installation,s.metadata,s.removalOperationId,s.blockedReason,s.legacyHadBinding,s.legacySeal));}
        PrincipalMemory independentReader()throws Exception{var store=new PrincipalMemory(work.loadPrincipal());principal=new NativePrincipalJournal(store);return store;}
        void wiped(){vaultCipher.wiped();workCipher.wiped();assertEquals(0,journalCipher.creates);assertEquals(0,journalCipher.destroys);}
    }
    /** New prerequisite only: synthetic identity/cipher/preferences, actual
     * capacity/ordinary-work adapter. No SQL, authentication or ACK proof. */
    @Test public void ACTIVE_completionCapacityUsesPurposeSizedWorkCipher()throws Exception {
        var f=Fixture.activeBeforeSeparation();byte[] original=null;char[] large=new char[13_000],small="same-original".toCharArray();
        try{
            assertFalse(f.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
            assertFalse(f.workDisk.memory.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            var vault=f.persistence.current();var principal=f.principal.readFor(f.engine.getState());
            Arrays.fill(large,'x');
            denied(()->f.vaultCipher.encryptWithExistingKey(large));
            var ordinary=new TestCipher();denied(()->ordinary.encrypt(large));
            var ordinarySecret=ordinary.encrypt(small);
            assertEquals(java.util.Base64.getEncoder().encodeToString(new String(small).getBytes(StandardCharsets.UTF_8)),ordinarySecret.ciphertext);
            assertEquals("dGVzdC1pdi12Mg==",ordinarySecret.iv);
            char[] clear=ordinary.decrypt(ordinarySecret);try{assertArrayEquals(small,clear);}finally{VaultValidation.wipe(clear);}
            try{new TestCipher(32*1024*1024+1);fail("unbounded synthetic cipher");}catch(IllegalArgumentException expected){}

            var args=NativeCompletionJournalTest.args();var request=NativeCompletionJournalTest.request(args);original=request.body.clone();
            var before=new HashMap<>(f.workDisk.memory);var durable=new HashMap<>(f.workDisk.durable);int commits=f.workDisk.commits;
            int encrypts=f.workCipher.delegate.existingKeyEncryptCalls;
            var journal=new NativeCompletionJournal(f.work);journal.preflight("KIOSK_08",request);
            assertTrue(f.workCipher.delegate.existingKeyEncryptCalls>encrypts);
            assertEquals(before,f.workDisk.memory);assertEquals(durable,f.workDisk.durable);assertEquals(commits,f.workDisk.commits);
            assertArrayEquals(original,request.body);assertSame(vault,f.persistence.current());
            assertTrue(ProviderWireJson.same(principal,f.principal.readFor(f.engine.getState())));

            // Existing synthetic response only: actual encrypted persistence/
            // recreation, never proof of remote acceptance or authentication.
            journal.captureAuthenticatedResponse("KIOSK_08",request,NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));
            var after=new HashMap<>(f.workDisk.memory);var afterDurable=new HashMap<>(f.workDisk.durable);
            var restarted=new NativeCompletionJournal(new AndroidOfflineAuthorityTimeStore(f.workDisk.preferences(),f.workCipher));
            assertTrue(ProviderWireJson.same(NativeCompletionJournalTest.result(),restarted.recover("KIOSK_08",args)));
            String key=f.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)).findFirst().orElseThrow();
            try(var saved=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",key.substring(NativeRetainedCompletionSemanticsTest.PREFIX.length()),
                f.work.loadCompletionReceipt(key.substring(NativeRetainedCompletionSemanticsTest.PREFIX.length())))){
                assertArrayEquals(original,saved.originalBody());assertTrue(ProviderWireJson.same(args,saved.originalArgs()));
            }
            assertEquals(after,f.workDisk.memory);assertEquals(afterDurable,f.workDisk.durable);
            f.work.prepareSeparationProbe(f.work.separationRawSnapshot());
            var held=new HashMap<>(f.workDisk.memory);var heldDurable=new HashMap<>(f.workDisk.durable);int heldCommits=f.workDisk.commits;
            // The actual protected-store hold still denies the new receipt
            // reservation, with no clearing/waiver by the sized test cipher.
            denied(()->new NativeCompletionJournal(f.work).preflight("KIOSK_08",
                NativeCompletionJournalTest.request(new JSONObject(args.toString()).put("p_client_completion_id",id(97)))));
            assertEquals(held,f.workDisk.memory);assertEquals(heldDurable,f.workDisk.durable);assertEquals(heldCommits,f.workDisk.commits);
            assertArrayEquals(original,request.body);assertSame(vault,f.persistence.current());assertEquals(0,f.opened);
        }finally{VaultValidation.wipe(large);VaultValidation.wipe(small);if(original!=null)Arrays.fill(original,(byte)0);f.wiped();}
    }

    @Test public void actualOwnerAndPreparedAdapterPreserveExactNonceBodyAndOriginalRecords()throws Exception {
        var f=new Fixture();var old=new HashMap<>(f.workDisk.durable);var vault=f.persistence.current();
        try(var operation=f.prepare()){
            assertEquals(3,f.ids);JSONObject prepared=f.journal.observe().record();String exact=prepared.getString("body_base64");
            try(var response=f.send(operation)){
                assertEquals(operation.requestId(),f.connection.headers.get("X-Memphis-Native-Request-Id"));assertEquals(operation.bodySha256(),NativeRetainedAttempt.hash(f.connection.sent.toByteArray()));
                assertArrayEquals(NativeRetainedAttempt.base64(exact,393216),f.connection.sent.toByteArray());assertEquals(3,f.ids);
                assertFalse(response.workAccepted);assertFalse(response.inventoryAcknowledged);assertFalse(response.keyRemovalAllowed);
                assertEquals("https://memphis-zoo-mcp.onrender.com/device-auth/separation-evidence",f.connection.getURL().toString());
                assertFalse(f.connection.getInstanceFollowRedirects());assertTrue(f.connection.getConnectTimeout()<=5000);assertTrue(f.connection.getReadTimeout()<=10000);
            }
            assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);assertEquals(old,f.workDisk.durable);assertEquals(vault,f.persistence.current());assertTrue(f.connection.disconnects>0);denied(()->f.send(operation));
        }f.wiped();
    }
    @Test public void originalMemoryOnlyFreezeMustBeRecommittedBeforePreparation()throws Exception {
        var f=new Fixture();String marker=(String)f.workDisk.memory.get(NativeRetainedWorkCapture.FENCE);f.workDisk.durable.remove(NativeRetainedWorkCapture.FENCE);
        try(var operation=f.prepare()){assertEquals(marker,f.workDisk.durable.get(NativeRetainedWorkCapture.FENCE));assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);}
        assertEquals(0,f.opened);f.wiped();
    }
    @Test public void ENGINE_writeFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds()throws Exception {
        for(boolean thrown:new boolean[]{false,true}){
            var f=new Fixture();if(thrown)f.journalDisk.throwBefore=true;else f.journalDisk.fail=true;
            denied(()->f.prepare());assertTrue(f.journalDisk.memory.isEmpty());assertTrue(f.journalDisk.durable.isEmpty());
            assertEquals(3,f.ids);assertEquals(0,f.opened);
            Map<String,Object> candidate=new HashMap<>(f.journalDisk.candidates.get(0));
            f.journalDisk.throwBefore=false;f.journalDisk.fail=false;
            // Recreate engine/adapter while the same process memento persists.
            f.engine=new VaultEngine(f.persistence,f.vaultCipher,f.enrollment,new FakeLegacySource(),new TestSealGenerator(),f.clock);
            f.journal=new AndroidRetainedAttemptStore(f.journalDisk.preferences(),f.journalCipher).journal();
            try(var restored=f.prepare()){
                assertEquals(3,f.ids);assertEquals(candidate,f.journalDisk.durable);
                assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);
                assertEquals(f.journal.observe().record().getString("native_request_id"),restored.requestId());
            }
            assertEquals(0,f.opened);f.wiped();
        }
    }
    @Test public void ENGINE_queryFalseOrThrowBeforeMemoryRestoresOriginalBeforeNewIds()throws Exception {
        for(boolean thrown:new boolean[]{false,true}){
            var f=new Fixture();try(var original=f.prepare()){}
            var disk=new NativeRetainedAttemptTest.Disk();var cipher=new NativeRetainedAttemptTest.ExistingCipher();
            NativeRetainedQueryJournal reads=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
            int[] queryIds={0};HttpsEnrollmentTransport.RequestIdGenerator generator=()->id(900+(++queryIds[0]));
            if(thrown)disk.throwBefore=true;else disk.fail=true;
            NativeRetainedQueryJournal initial=reads;
            denied(()->f.engine.prepareNativeRetainedQuery(f.work,f.principal,null,f.journal,initial,generator));
            assertEquals(1,queryIds[0]);assertTrue(disk.memory.isEmpty());assertTrue(disk.durable.isEmpty());
            Map<String,Object> candidate=new HashMap<>(disk.candidates.get(0));
            disk.throwBefore=false;disk.fail=false;
            f.engine=new VaultEngine(f.persistence,f.vaultCipher,f.enrollment,new FakeLegacySource(),new TestSealGenerator(),f.clock);
            reads=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
            try(var restored=f.engine.prepareNativeRetainedQuery(f.work,f.principal,null,f.journal,reads,generator)){
                assertEquals(1,queryIds[0]);assertEquals(candidate,disk.durable);
                assertEquals(NativeRetainedQueryJournal.PREPARED,reads.observe().state);
            }
            assertEquals(0,f.opened);f.wiped();
        }
    }
    @Test public void failedFreezeCommitGrantsNoJournalOrTransportCapability()throws Exception {
        var f=new Fixture();f.workDisk.fail=true;denied(()->f.prepare());assertTrue(f.journalDisk.memory.isEmpty());assertEquals(0,f.opened);f.wiped();
    }
    @Test public void falseJournalCommitRestoresSamePreparedNonceWithoutMinting()throws Exception {
        var f=new Fixture();f.journalDisk.memoryOnly=true;denied(()->f.prepare());assertTrue(f.journalDisk.durable.isEmpty());String nonce=f.journal.observe().record().getString("native_request_id");
        f.journalDisk.memoryOnly=false;try(var operation=f.prepare()){assertEquals(nonce,operation.requestId());assertEquals(3,f.ids);assertFalse(f.journalDisk.durable.isEmpty());}f.wiped();
    }
    @Test public void missingCorruptOrProbeFreezeIsNotARecoverableEmptyInventory()throws Exception {
        for(int variant=0;variant<3;variant++){var f=new Fixture();if(variant==0)f.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);else if(variant==1)f.workDisk.memory.put(NativeRetainedWorkCapture.FENCE,"corrupt");else f.workDisk.memory.put(NativeRetainedWorkCapture.PROBE,"pending");
            var before=new HashMap<>(f.workDisk.memory);denied(()->f.prepare());assertEquals(before,f.workDisk.memory);assertEquals(0,f.ids);assertEquals(0,f.opened);assertTrue(f.journalDisk.memory.isEmpty());f.wiped();}
    }
    @Test public void originalRawValueChangeBeforeSendRefusesWithoutDispatch()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.workDisk.memory.put("unknown-original-work","changed bytes");denied(()->f.send(operation));assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);assertEquals(0,f.opened);}f.wiped();
    }
    @Test public void changedFullPrincipalAtSameVaultRevisionRefusesSettlement()throws Exception {
        var f=new Fixture();var reader=f.independentReader();long revision=f.persistence.current().revision;
        try(var operation=f.prepare()){f.onReply=()->reader.value=new JSONObject(reader.value).put("assignment_epoch",8).toString();denied(()->f.send(operation));assertEquals(1,f.opened);assertEquals(revision,f.persistence.current().revision);assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);}f.wiped();
    }
    @Test public void engineRevisionChangeDuringTransportCannotBeLockedOutOrAccepted()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.onReply=()->{Thread t=new Thread(()->{try{f.bumpVault();}catch(Exception error){throw new AssertionError(error);}});t.start();t.join(1500);assertFalse("vault monitor held across HTTP",t.isAlive());};
            denied(()->f.send(operation));assertEquals(1,f.opened);assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);}f.wiped();
    }
    @Test public void originalRawChangeDuringHttpRefusesReplyButPreservesUnknown()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.onReply=()->f.workDisk.memory.put("unknown-original-work","changed during reply");denied(()->f.send(operation));assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);assertTrue(f.connection.disconnects>0);}f.wiped();
    }
    @Test public void mutationDuringJournalCommitRefusesOwnerCapability()throws Exception {
        var f=new Fixture();var backing=new AndroidRetainedAttemptStore(f.journalDisk.preferences(),f.journalCipher);var gate=new Object();
        f.journal=new NativeRetainedAttemptJournal(new NativeRetainedAttemptJournal.Backend(){
            public Map<String,?> readAll(){return backing.readAll();}
            public boolean compareAndCommit(Map<String,String> before,Map<String,String> next)throws Exception{boolean result=backing.compareAndCommit(before,next);f.workDisk.memory.put("unknown-original-work","changed after journal commit");return result;}
        },f.journalCipher,gate);
        denied(()->f.prepare());assertEquals(0,f.opened);assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);f.wiped();
    }
    @Test public void privateOperationCannotBeUsedByForeignOwnerOrAfterClose()throws Exception {
        var f=new Fixture();var other=new Fixture();try(var operation=f.prepare()){denied(()->other.engine.sendNativeRetainedChunk(operation,f.http(),f.network));assertEquals(0,f.opened);operation.close();denied(()->f.send(operation));}f.wiped();other.wiped();
    }
    @Test public void canceledBeforeDispatchDoesNotWriteUnknownOrOpenNetwork()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.network.cancel();denied(()->f.send(operation));assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);assertEquals(0,f.opened);}f.wiped();
    }
    @Test public void canceledAtOutputSendsNoBytesAndRetainsUnknown()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.beforeOutput=()->f.network.cancel();denied(()->f.send(operation));assertEquals(0,f.connection.sent.size());assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);assertTrue(f.connection.disconnects>0);}f.wiped();
    }
    @Test public void lostReplyCannotProduceFreshNonceOrBlindResend()throws Exception {
        var f=new Fixture();String nonce;try(var operation=f.prepare()){nonce=operation.requestId();f.loseReply=true;denied(()->f.send(operation));assertTrue(f.connection.sent.size()>0);}
        var disk=new HashMap<>(f.journalDisk.durable);try(var restored=f.prepare()){assertEquals(nonce,restored.requestId());denied(()->f.send(restored));assertEquals(3,f.ids);assertEquals(1,f.opened);assertEquals(disk,f.journalDisk.durable);}f.wiped();
    }
    @Test public void staleAndFuturePreparedTimestampsNeverGetRenewed()throws Exception {
        for(long skew:new long[]{120001,-15001}){var f=new Fixture();try(var operation=f.prepare()){f.clock.now+=skew;denied(()->f.send(operation));assertEquals(0,f.opened);assertEquals(3,f.ids);assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal.observe().state);}f.wiped();}
    }
    @Test public void restartedEngineUsesExactJournalBodyNotReserializedWire()throws Exception {
        var f=new Fixture();String id,body;try(var first=f.prepare()){id=first.requestId();body=first.bodySha256();}
        f.engine=new VaultEngine(f.persistence,f.vaultCipher,f.enrollment,new FakeLegacySource(),new TestSealGenerator(),f.clock);
        try(var restarted=f.prepare()){assertEquals(id,restarted.requestId());assertEquals(body,restarted.bodySha256());assertEquals(3,f.ids);try(var response=f.send(restarted)){assertFalse(response.workAccepted);}}f.wiped();
    }
    @Test public void exactSecretEchoAndMalformedResponseRemainUnknownNotScrubbedSuccess()throws Exception {
        for(boolean secret:new boolean[]{true,false}){var f=new Fixture();try(var operation=f.prepare()){
            f.onReply=()->f.connection.response=(secret?"{\"credential\":\"forbidden\"}":"{\"ok\":true,\"ok\":true}").getBytes(StandardCharsets.UTF_8);denied(()->f.send(operation));assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);assertTrue(f.connection.disconnects>0);}f.wiped();}
    }
    @Test public void oversizedOrAmbiguousHeaderResponseIsNotAnAcceptedPartialReply()throws Exception {
        for(boolean oversized:new boolean[]{true,false}){var f=new Fixture();try(var operation=f.prepare()){f.onReply=()->{if(oversized)f.connection.response=new byte[262145];else f.connection.replyHeaders=Map.of("Content-Type",List.of("application/json","application/json"));};
            denied(()->f.send(operation));assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);assertTrue(f.connection.disconnects>0);}f.wiped();}
    }
    @Test public void invalidFixedOriginConnectionAndDelayedFreshnessRefuseTransport()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){NativeRetainedHttp wrong=new NativeRetainedHttp(url->{f.opened++;return new Connection(new URL("https://example.invalid/"));},f.clock);denied(()->f.engine.sendNativeRetainedChunk(operation,wrong,f.network));assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);}f.wiped();
        var delayed=new Fixture();try(var operation=delayed.prepare()){NativeRetainedHttp oldClock=new NativeRetainedHttp(url->{throw new AssertionError("must not open");},()->delayed.clock.nowMillis()+120001);denied(()->delayed.engine.sendNativeRetainedChunk(operation,oldClock,delayed.network));assertEquals(NativeRetainedAttemptJournal.UNKNOWN,delayed.journal.observe().state);}delayed.wiped();
    }
    @Test public void partialResponseAndReportedServerSuccessNeverBecomeWorkOrKeyAuthority()throws Exception {
        var f=new Fixture();try(var operation=f.prepare()){f.onReply=()->f.connection.response="{\"ok\":true,\"data\":{\"record_values_retained\":true,\"work_accepted\":true}}".getBytes(StandardCharsets.UTF_8);
            try(var observation=f.send(operation)){assertFalse(observation.workAccepted);assertFalse(observation.inventoryAcknowledged);assertFalse(observation.keyRemovalAllowed);assertEquals(200,observation.status);}assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal.observe().state);}f.wiped();
    }
}
