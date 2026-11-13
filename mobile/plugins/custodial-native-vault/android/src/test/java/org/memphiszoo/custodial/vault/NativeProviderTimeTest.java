package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.time.Instant;
import java.util.Collections;
import org.json.JSONObject;
import org.junit.Test;

/** All profiles are SYNTHETIC model inputs, never target-device qualification. */
public final class NativeProviderTimeTest {
    static final String ID = "SYNTHETIC_ONLY_PC01";
    static NativeProviderTime.Platform platform() throws Exception {
        return new NativeProviderTime.Platform("SYNTHETIC elapsedRealtime", "SYNTHETIC build", "SYNTHETIC device");
    }
    static NativeProviderTime.Profile profile(long q, long p, long age) throws Exception {
        return new NativeProviderTime.Profile(ID, platform(), q, p, age, String.join("", Collections.nCopies(64, "a")));
    }
    static NativeProviderClockExchange.Unqualified sample(long a, long b, int boot, long server, long horizon) throws Exception {
        String nonce = "44000000-0000-4000-8000-000000000003";
        return new NativeProviderClockExchange(new AuthorizedResponse(200, Collections.singletonMap("Content-Type", "application/json"), new byte[0]),
            nonce, "/employee-notifications-api/native-provider/status", String.join("", Collections.nCopies(64, "b")),
            new NativeProviderClockExchange.Point(a, boot), new NativeProviderClockExchange.Point(b, boot))
            .validateClock(new JSONObject().put("native_request_id", nonce).put("server_now", NativeProviderTime.canonical(server))
                .put("valid_until", NativeProviderTime.canonical(Math.addExact(server, horizon))));
    }
    static NativeProviderTime.Bounds bounds(long a, long b, long n, long server, NativeProviderTime.Profile profile) throws Exception {
        return NativeProviderTime.observe(sample(a,b,4,server,900_000_000L), profile, platform(), new NativeProviderClockExchange.Point(n,4));
    }
    static NativeProviderTime.Bounds at(Instant earliest, long elapsed, int boot) throws Exception {
        return NativeProviderTime.observe(sample(elapsed,elapsed,boot,Math.addExact(NativeProviderTime.micros(earliest),1),900_000_000L),
            profile(0,0,900_000_000_000L),platform(),new NativeProviderClockExchange.Point(elapsed,boot));
    }
    static NativeProviderJournal.Observation observation(Instant earliest, long elapsed, int boot) throws Exception {
        return new NativeProviderJournal.Observation(earliest == null ? null : at(earliest,elapsed,boot),elapsed,boot);
    }
    @Test public void originalSubMillisecondCounterexampleIsEnclosed() throws Exception {
        NativeProviderTime.Bounds value = bounds(0,100,100,0,profile(1_000_000,10_000,900_000_000_000L));
        assertNotNull(value);assertTrue(value.earliestMicros <= 100998);assertTrue(value.latestMicros >= 100998);
        assertFalse(NativeProviderTime.before(value,Instant.ofEpochSecond(0,100500000)));
    }
    @Test public void quantizationAndSlowFastFullHorizonEncloseConstructedRealTimes() throws Exception {
        NativeProviderTime.Profile profile = profile(1_000_000,10_000,910_000_000_000L);
        int enclosures=0;
        for(long rate:new long[]{990000,995000,1000000,1005000,1010000})
            for(long offset:new long[]{1,999999,1734567}) for(long request:new long[]{1,100998000,44000000000L})
                for(int part:new int[]{0,1,2}) for(long post:new long[]{0,1,799999999999L}) {
                    long start=offset,end=start+request,now=end+post,sampled=start+request*part/2;
                    long a=start*rate/1_000_000/1_000_000,b=end*rate/1_000_000/1_000_000,n=now*rate/1_000_000/1_000_000;
                    NativeProviderTime.Bounds value=bounds(a,b,n,(sampled+500)/1000,profile);
                    assertNotNull(value);assertTrue(value.earliestMicros*1000<=now);assertTrue(value.latestMicros*1000>=now);enclosures++;
                }
        assertEquals(405,enclosures);
    }
    @Test public void unknownMissingMismatchRevocationAndBootDoNotGrantTime() throws Exception {
        NativeProviderClockExchange.Unqualified sample=sample(0,100,4,0,900_000_000L);
        NativeProviderClockExchange.Point now=new NativeProviderClockExchange.Point(100,4);
        assertNull(NativeProviderTime.observe(sample,null,platform(),now));
        assertNull(NativeProviderTime.Profiles.NONE.select(platform()));
        NativeProviderTime.Profile profile=profile(0,0,900_000_000_000L);
        assertNull(NativeProviderTime.observe(sample,profile,new NativeProviderTime.Platform("different", "SYNTHETIC build", "SYNTHETIC device"),now));
        assertNull(NativeProviderTime.observe(sample,profile,platform(),new NativeProviderClockExchange.Point(100,5)));
        assertNull(NativeProviderTime.observe(sample,profile,platform(),new NativeProviderClockExchange.Point(99,4)));
    }
    @Test public void qualifiedRequestUpperBoundStrictlyBelowFortyFiveSeconds() throws Exception {
        NativeProviderTime.Profile zero=profile(0,0,900_000_000_000L);
        assertNotNull(bounds(0,44999,44999,0,zero));
        // Necessary raw45s rejection is earlier. Sub45s can STILL exceed the
        // conservative limit with quantization or rate error.
        assertNull(bounds(0,44999,44999,0,profile(1_000_000,0,900_000_000_000L)));
        assertNull(bounds(0,44999,44999,0,profile(0,100,900_000_000_000L)));
    }
    @Test public void ownHorizonEqualityAndQualifiedWholeIntervalAgeAreFailClosed() throws Exception {
        NativeProviderTime.Profile p=profile(0,0,900_000_000_000L);
        NativeProviderTime.Bounds value=bounds(0,100,200,0,p);assertNotNull(value);
        assertNull(NativeProviderTime.observe(sample(0,100,4,0,value.latestMicros),p,platform(),new NativeProviderClockExchange.Point(200,4)));
        assertNotNull(NativeProviderTime.observe(sample(0,100,4,0,value.latestMicros+1),p,platform(),new NativeProviderClockExchange.Point(200,4)));
        assertNull(bounds(0,100,200,0,profile(0,0,199_999_999L)));
        assertNotNull(bounds(0,100,200,0,profile(0,0,200_000_000L)));
        assertNull(bounds(0,100,900000,0,p));
    }
    @Test public void checkedOverflowNeverSaturatesOrReturnsNarrowerBounds() throws Exception {
        assertNull(bounds(0,100,100,0,profile(Long.MAX_VALUE,0,Long.MAX_VALUE)));
        assertNull(bounds(0,100,Long.MAX_VALUE,0,profile(0,0,Long.MAX_VALUE)));
        assertNull(bounds(0,100,10_000_000,0,profile(0,0,Long.MAX_VALUE)));
        for(long[] bad:new long[][]{{-1,0},{0,-1},{0,1000000}}) {
            try { profile(bad[0],bad[1],100);fail(); }catch(VaultFailure expected){assertEquals("custodial_provider_time_unknown",expected.code);}
        }
    }
    @Test public void negativeEpochAndOutwardSignedRoundingRemainCanonical() throws Exception {
        assertEquals(-1,Math.floorDiv(-1L,1000L));assertEquals(0,NativeProviderTime.ceil(-1,1000));
        assertEquals("1969-12-31T23:59:59.999999Z",NativeProviderTime.canonical(-1));
        assertEquals(-1,NativeProviderClockExchange.micros(NativeProviderTime.canonical(-1)));
        NativeProviderTime.Bounds b=bounds(0,0,0,-1000,profile(0,0,1000));
        assertEquals(-1001,b.earliestMicros);assertEquals(-999,b.latestMicros);
    }
    @Test public void endpointOwnerNeverUsesLatestForDeletionOrEarliestForFreshness() throws Exception {
        NativeProviderTime.Bounds b=bounds(0,30_000,30_000,0,profile(0,0,900_000_000_000L));
        Instant middle=Instant.ofEpochSecond(15);
        assertFalse(NativeProviderTime.before(b,middle));assertFalse(NativeProviderTime.reached(b,middle));
        assertTrue(NativeProviderTime.reached(b,Instant.ofEpochSecond(-1)));
        assertFalse(NativeProviderTime.live(b,Instant.EPOCH,Instant.ofEpochSecond(60)));
        assertFalse(NativeProviderTime.before(null,middle));assertFalse(NativeProviderTime.reached(null,middle));
        assertTrue(NativeProviderTime.overlaps(b,b));
        assertFalse(NativeProviderTime.overlaps(b,bounds(0,0,0,100_000_000,profile(0,0,1000))));
    }
}
