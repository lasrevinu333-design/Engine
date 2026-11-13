package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

/** Actual existing owning host producers; synthetic original/browser/HTTP DATA.
 * No authority constructor, provider replacement or reflected acceptance.
 * Reflection below observes DATA identities/wiping only. Not Android/SQL proof. */
public final class NativeOriginalCompletionGroupDataTest {
    @Test public void actualGroupsTransferOnceIntoActualDispositionSet()throws Exception {owning(0);}
    @Test public void closeBeforeConsumptionWipesActualArgumentBuffers()throws Exception {owning(1);}
    @Test public void changedOriginalQueryAfterPreloadCannotReachDisposition()throws Exception {owning(2);}
    @Test public void changedOriginalNamespaceAfterPreloadCannotReachDisposition()throws Exception {owning(3);}
    @Test public void expiredOriginalControlAfterPreloadCannotReachDisposition()throws Exception {owning(4);}
    @Test public void standaloneLocalDataDoesNotRetainRawGroups()throws Exception {owning(5);}

    private static Object field(Object value,String name)throws Exception {
        return NativePrivateCustodyExchangeTest.field(value,name);
    }
    private static void zero(byte[] value){for(byte b:value)assertEquals(0,b);}

    private static void owning(int fault)throws Exception {
        NativePrivateCustodyHttpOutcomeTest.withActualOriginalNativeRecoveryForFinalization(
            new NativePrivateCustodyHttpOutcomeTest.SealedRecoveryCheck(){
                @Override public void check(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                    VaultEngine.NativeSameOriginalRecoveryPreparedRequest p,NativePrivateCustodyFrameReadControl c){
                    throw new AssertionError("Actual existing signed request path required");
                }
                @Override public boolean existingRequestOnly(){return true;}
                @Override public boolean existingRequestAfterChallenge(){return true;}
                @Override public boolean usesSavedBrowserPublication(){return true;}
                @Override public boolean existingBrowserPublicationCase(NativePrivateCustodyExchangeTest.GuardedIdentityFixture f,
                    VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent,NativePrivateCustodyHttp http,
                    NativePrivateCustodyFrameReadControl control)throws Exception {
                    try(var p=intent.takeOriginalChallengeRequest()){
                        NativePrivateCustodyHttpOutcomeTest.seedEmptySavedBrowserData(f,
                            (VaultEngine.NativePrivateCustodyCurrentFrameRead)field(p,"originalRead"));
                    }
                    if(fault==5){
                        try(var local=f.engine.readSavedOriginalBrowserLocalData(f.plan,f.journal,control)){
                            assertNotNull(local);assertNull(field(local,"nativeGroups"));assertNull(field(local,"nativeGroupControl"));
                        }
                        return true;
                    }
                    var buffers=new ArrayList<byte[]>();
                    var query=f.dir.resolve("query_unknown-0.bin");byte[] original=Files.readAllBytes(query);
                    var modified=Files.getLastModifiedTime(query);long clock=f.clock.now;
                    var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";
                    var originalNamespace=source.unknown.get(namespace);
                    try(var current=f.engine.readCurrentOriginalPrivateCustodyFrameForBrowserPreparation(f.plan,f.journal,http,control)){
                        Object local=field(current,"preloadedBrowserLocalData");assertNotNull(local);
                        @SuppressWarnings("unchecked") var groups=(List<NativeRetainedCompletionCensus.NativeReadGroup>)field(local,"nativeGroups");
                        assertNotNull(groups);assertFalse("Actual original completion row required",groups.isEmpty());
                        assertSame(control,field(local,"nativeGroupControl"));
                        for(var group:groups){var raw=(byte[])field(group,"arguments");assertNotNull(raw);assertTrue(raw.length>0);buffers.add(raw);}
                        if(fault==1){
                            current.close();
                            for(byte[] bytes:buffers)zero(bytes);
                            for(var group:groups)assertThrows(VaultFailure.class,group::argumentsCopy);
                            assertThrows(VaultFailure.class,()->current.takeOriginalRecoveryTarget(http));
                        }else try(var target=current.takeOriginalRecoveryTarget(http);
                            var next=target.takeExistingOriginalPreparationIntent();var prepared=next.takeOriginalChallengeRequest()){
                            if(fault==2){byte[] changed=original.clone();changed[changed.length/2]^=1;
                                try{Files.write(query,changed);Files.setLastModifiedTime(query,modified);}finally{Arrays.fill(changed,(byte)0);}}
                            if(fault==3){var changed=new java.util.HashMap<String,Object>(originalNamespace);
                                changed.put("synthetic-postpreload-mutation","changed");source.unknown.put(namespace,changed);}
                            if(fault==4)f.clock.now=clock+240_001L;
                            if(fault!=0){
                                assertThrows(VaultFailure.class,()->f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,null));
                                assertNull(field(prepared,"completionDispositions"));
                            }else{
                                var result=f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,null);
                                assertEquals("CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY",result.getString("state"));
                                assertFalse(result.getBoolean("current_browser_source_authenticated"));
                                assertFalse(result.getBoolean("inventory_acknowledged"));
                                Object set=field(prepared,"completionDispositions");assertNotNull(set);
                                var retained=(List<?>)field(set,"groups");assertEquals(groups.size(),retained.size());
                                for(int i=0;i<groups.size();i++)assertSame("Exact collected group, no second collector",groups.get(i),retained.get(i));
                                assertNull(field(local,"nativeGroups"));assertNull(field(local,"nativeGroupControl"));
                                assertThrows("Actual one-use preparation cannot reborrow groups",VaultFailure.class,
                                    ()->f.engine.readOriginalNativeCompletions(prepared,http,control));
                            }
                        }
                    }finally{
                        source.unknown.put(namespace,originalNamespace);f.clock.now=clock;
                        Files.write(query,original);Files.setLastModifiedTime(query,modified);Arrays.fill(original,(byte)0);
                    }
                    for(byte[] bytes:buffers)zero(bytes);
                    return true;
                }
            });
    }
}
