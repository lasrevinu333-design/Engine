package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;

/** NEW owning engine call-site proof under synthetic cipher/persistence/source.
 * Exact read object identity and credential wiping, not real migration/auth. */
public final class LegacyReadIdentityEngineTest {
    static final class Source implements LegacyVaultSource {
        final FakeLegacySource delegate=new FakeLegacySource("SYNTHETIC_ORIGINAL_CREDENTIAL".toCharArray(),null,"");
        LegacyMaterial read;int boundCalls,unboundCalls;boolean failOnce;
        @Override public LegacyMaterial read()throws VaultFailure{return read=delegate.read();}
        @Override public void cleanup()throws VaultFailure{unboundCalls++;throw new AssertionError("unbound cleanup forbidden");}
        @Override public void cleanupAfterRead(LegacyMaterial original)throws VaultFailure{
            boundCalls++;assertSame(read,original);assertNotNull(original);
            for(char c:original.credential)assertEquals('\0',c); // comparison already finished/wiped
            if(failOnce){failOnce=false;throw new VaultFailure("test_bound_cleanup_failure");}
            delegate.cleanup();
        }
        @Override public boolean isClean()throws VaultFailure{return delegate.isClean();}
    }
    @Test public void enginePassesExactComparedReadObjectAfterWipingNotLatestGenericCleanup()throws Exception{
        var p=new MemoryPersistence();var c=new TestCipher();var clock=new MutableClock(1800000000000L);var t=new FakeTransport(clock);var s=new Source();
        var e=new VaultEngine(p,c,t,s,new TestSealGenerator(),clock);
        assertEquals("LEGACY_PENDING",e.getState().get("state"));assertEquals(1,s.boundCalls);assertEquals(0,s.unboundCalls);
        assertEquals(0,c.destroyCalls);assertEquals(0,t.enrollCalls.get());
    }
    @Test public void boundCleanupFailureRetainsPendingCredentialAndRestartUsesNewComparedIdentity()throws Exception{
        var p=new MemoryPersistence();var c=new TestCipher();var clock=new MutableClock(1800000000000L);var t=new FakeTransport(clock);var s=new Source();s.failOnce=true;
        var e=new VaultEngine(p,c,t,s,new TestSealGenerator(),clock);
        try{e.getState();fail("failure must remain pending");}catch(VaultFailure expected){assertEquals("test_bound_cleanup_failure",expected.code);}
        assertEquals(VaultPhase.LEGACY_CLEANUP_PENDING,p.current().phase);var first=s.read;
        var restarted=new VaultEngine(p,c,t,s,new TestSealGenerator(),new MutableClock(1800000000000L));
        assertEquals("LEGACY_PENDING",restarted.getState().get("state"));assertNotSame(first,s.read);
        assertEquals(2,s.boundCalls);assertEquals(0,s.unboundCalls);assertEquals(0,c.destroyCalls);assertEquals(0,t.enrollCalls.get());
    }
}
