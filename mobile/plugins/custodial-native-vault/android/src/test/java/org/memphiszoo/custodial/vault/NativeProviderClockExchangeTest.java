package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Synthetic fixed-origin HTTPS plus actual engine/journal/coordinator. This is
 * transport proof, never a measurement or qualification of a device oscillator. */
public final class NativeProviderClockExchangeTest {
    static final String RID2 = "44000000-0000-4000-8000-000000000003";
    static JSONObject envelope(NativeProviderHttpTest.Fixture f, String rid) throws Exception { return new JSONObject(new String(NativeProviderHttpTest.clockResponse(
        NativeProviderRegistrationReceiptTest.data(f.prepared, null, NativeProviderRegistrationReceiptTest.TIME), rid), StandardCharsets.UTF_8)); }
    static NativeProviderHttp http(NativeProviderHttpTest.Fixture f, JSONObject envelope, String rid, NativeProviderClockExchange.Readings readings) {
        return new NativeProviderHttp(url -> { f.opened++; f.connection = new NativeProviderHttpTest.Connection(url, envelope.toString().getBytes(StandardCharsets.UTF_8)); return f.connection; },
            () -> NativeProviderHttpTest.NOW, () -> rid, readings);
    }
    @Test public void actualOwnerReturnsExactMicrosecondsAndNativeContextButNoAuthority() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            NativeProviderRegistrationCoordinatorTest.Fixture x = new NativeProviderRegistrationCoordinatorTest.Fixture(legacy);
            int[] reads = {0};
            NativeProviderClockExchange.Readings clock = () -> {
                if (reads[0]++ == 0) { assertEquals(0, x.f.opened); return new NativeProviderClockExchange.Point(100, 7); }
                assertTrue(x.f.connection.sent.size() > 0); return new NativeProviderClockExchange.Point(112, 7);
            };
            x.owner = x.make(http(x.f, envelope(x.f, RID2), RID2, clock));
            NativeProviderRegistrationCoordinator.ExchangeResult result = x.owner.registerWithClock(x.f.attempt, false);
            assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, result.status);
            NativeProviderClockExchange.Settlement s = result.settlement;
            assertTrue(s.registration.confirmed); assertEquals(x.f.principal.digest, s.principalDigest);
            assertEquals(x.f.persistence.current().revision, s.engineRevision);
            assertEquals(RID2, s.unqualifiedClock.requestId); assertEquals(100, s.unqualifiedClock.before.elapsedMillis); assertEquals(112, s.unqualifiedClock.after.elapsedMillis);
            assertEquals(7, s.unqualifiedClock.before.bootCount); assertEquals(7, s.unqualifiedClock.after.bootCount);
            assertEquals(1654321, s.unqualifiedClock.serverMicros % 10000000);
            assertEquals(900000000, s.unqualifiedClock.validUntilMicros - s.unqualifiedClock.serverMicros);
            assertEquals(2, reads[0]); assertEquals(NativeProviderPrincipal.hash(new String(x.f.connection.sent.toByteArray(), StandardCharsets.UTF_8)), s.unqualifiedClock.bodySha256);
            assertEquals("/employee-notifications-api/native-provider/register", s.unqualifiedClock.path);
            assertNull(x.observation.bounds); // Registration cannot upgrade ingress time.
        }
    }
    @Test public void confirmedStatusRefreshHasNewNonceAndDoesNotRewriteAdmissionOrToken() throws Exception {
        NativeProviderRegistrationCoordinatorTest.Fixture x = new NativeProviderRegistrationCoordinatorTest.Fixture(false);
        x.owner.registerWithClock(x.f.attempt, false);
        JSONObject original = x.f.provider.journal().prepareRegistration(x.f.principal, NativeProviderJournalTest.app()).json();
        x.owner = x.make(http(x.f, envelope(x.f, RID2), RID2, NativeProviderHttpTest.readings()));
        NativeProviderRegistrationCoordinator.ExchangeResult refreshed = x.owner.registerWithClock(new NativeProviderHttp.Attempt(), true);
        assertEquals(RID2, refreshed.settlement.unqualifiedClock.requestId);
        assertEquals("/employee-notifications-api/native-provider/status", refreshed.settlement.unqualifiedClock.path);
        JSONObject body = ProviderWireJson.object(x.f.connection.sent.toByteArray(), 65536);
        assertFalse(body.has("token")); assertEquals(original.get("operation_id"), body.get("operation_id"));
        assertTrue(NativeLegacyLineageJournal.same(original, x.f.provider.journal().prepareRegistration(x.f.principal, NativeProviderJournalTest.app()).json()));
        // A cached old response cannot become the new request's clock, even though
        // all original registration fields still match exactly.
        x.owner = x.make(http(x.f, envelope(x.f, NativeProviderHttpTest.RID), RID2, NativeProviderHttpTest.readings()));
        ProviderRecordStoreTest.failure("custodial_provider_clock_context_invalid", () -> x.owner.registerWithClock(new NativeProviderHttp.Attempt(), true));
    }
    @Test public void missingReplayMalformedOrExpiredHorizonNeverConfirmsOriginalOperation() throws Exception {
        for (String fault : new String[]{"missing", "nonce", "short_fraction", "leap_second", "normalized_date", "zero", "negative", "too_long", "extra", "past_admission"}) {
            NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); JSONObject env = envelope(f, NativeProviderHttpTest.RID), clock = env.getJSONObject("clock");
            switch (fault) {
                case "missing": env.remove("clock"); break;
                case "nonce": clock.put("native_request_id", RID2); break;
                case "short_fraction": clock.put("server_now", "2026-09-24T12:00:01.654Z"); break;
                case "leap_second": clock.put("server_now", "2026-09-24T12:00:60.654321Z"); break;
                case "normalized_date": clock.put("server_now", "2026-02-30T12:00:01.654321Z"); break;
                case "zero": clock.put("valid_until", clock.get("server_now")); break;
                case "negative": clock.put("valid_until", NativeProviderRegistrationReceiptTest.TIME); break;
                case "too_long": clock.put("valid_until", "2026-09-24T12:15:01.654322Z"); break;
                case "extra": clock.put("q_ns", 0); break;
                case "past_admission": clock.put("server_now", "2026-09-24T11:59:59.654321Z").put("valid_until", "2026-09-24T12:14:59.654321Z"); break;
            }
            try { f.send(false, http(f, env, NativeProviderHttpTest.RID, NativeProviderHttpTest.readings())); fail(fault); }
            catch (VaultFailure expected) { assertTrue(fault, expected.code.startsWith("custodial_provider_")); }
            NativeProviderJournal.Prepared pending = f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
            assertFalse(pending.confirmed); assertEquals(f.prepared.operationId, pending.operationId);
        }
    }
    @Test public void rebootBackwardsUnknownAndRawFortyFiveSecondsFailClosed() throws Exception {
        for (String fault : new String[]{"reboot", "backward", "unknown", "slow"}) {
            NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); int[] reads = {0};
            NativeProviderClockExchange.Readings readings = () -> {
                if (fault.equals("unknown")) throw new VaultFailure("custodial_provider_clock_context_unavailable");
                if (reads[0]++ == 0) return new NativeProviderClockExchange.Point(100, 7);
                return new NativeProviderClockExchange.Point(fault.equals("backward") ? 99 : fault.equals("slow") ? 45100 : 101, fault.equals("reboot") ? 8 : 7);
            };
            try { f.send(false, http(f, envelope(f, NativeProviderHttpTest.RID), NativeProviderHttpTest.RID, readings)); fail(fault); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_clock_context_")); }
            assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
        }
    }
    @Test public void oldConfirmedStatusCannotRaceAnAlreadyPreparedRotation() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false);
        NativeProviderJournal.Prepared old = f.send(false, f.http());
        f.provider.journal().captureToken("new-native-token");
        NativeProviderJournal.Prepared next = f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
        assertNotEquals(old.generationId, next.generationId);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.provider.journal().registrationRequest(f.principal, old, true));
    }
    @Test public void clockReadAfterBodyFailureIsNeverConstructed() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); int[] reads = {0};
        NativeProviderHttp http = new NativeProviderHttp(url -> {
            f.connection = new NativeProviderHttpTest.Connection(url, f.response()) {
                @Override public java.io.InputStream getInputStream() { return new java.io.InputStream() {
                    @Override public int read() throws java.io.IOException { throw new java.io.IOException("synthetic response loss"); }
                }; }
            }; return f.connection;
        }, () -> NativeProviderHttpTest.NOW, () -> RID2, () -> { reads[0]++; return new NativeProviderClockExchange.Point(100, 7); });
        ProviderRecordStoreTest.failure("custodial_provider_network_unavailable", () -> f.send(false, http));
        assertEquals(1, reads[0]); assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
    }
}
