package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Typed transport evidence only. No QP profile, authority interval, ingress time or
 * effect/expiry permission can be obtained from this class. Never a WebView API. */
final class NativeProviderClockExchange {
    interface Readings { Point read() throws VaultFailure; }
    static final class Point {
        final long elapsedMillis; final int bootCount;
        Point(long elapsedMillis, int bootCount) throws VaultFailure {
            if (elapsedMillis < 0 || bootCount < 0) throw invalid();
            this.elapsedMillis = elapsedMillis; this.bootCount = bootCount;
        }
    }
    final AuthorizedResponse response;
    final String requestId, path, bodySha256;
    final Point before, after;
    NativeProviderClockExchange(AuthorizedResponse response, String requestId, String path, String bodySha256, Point before, Point after) throws VaultFailure {
        if (response == null || requestId == null || !requestId.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}")
            || path == null || !path.matches("/employee-notifications-api/native-provider/(register|status|inventory|events)")
            || bodySha256 == null || !bodySha256.matches("[0-9a-f]{64}")
            || before == null || after == null || before.bootCount != after.bootCount || after.elapsedMillis < before.elapsedMillis)
            throw invalid();
        this.response = response; this.requestId = requestId; this.path = path; this.bodySha256 = bodySha256;
        this.before = before; this.after = after;
    }
    /** Immutable UNQUALIFIED candidate. It must not be stored as an admitted anchor.
     * A future qualified owner must recheck same boot/current principal, checked
     * q_ns/p_ppm interval math, strict <45s upper bound, expiry and removal fences. */
    static final class Unqualified {
        final String requestId, path, bodySha256;
        final Point before, after;
        final long serverMicros, validUntilMicros;
        private Unqualified(NativeProviderClockExchange exchange, long serverMicros, long validUntilMicros) {
            requestId = exchange.requestId; path = exchange.path; bodySha256 = exchange.bodySha256;
            before = exchange.before; after = exchange.after; this.serverMicros = serverMicros; this.validUntilMicros = validUntilMicros;
        }
        JSONObject json() throws Exception {
            return new JSONObject().put("request_id",requestId).put("path",path).put("body_sha256",bodySha256)
                .put("before_elapsed_ms",before.elapsedMillis).put("after_elapsed_ms",after.elapsedMillis).put("boot_count",before.bootCount)
                .put("server_now",NativeProviderTime.canonical(serverMicros)).put("valid_until",NativeProviderTime.canonical(validUntilMicros));
        }
        /** Only encrypted provider records may use this restore seam. Restoring
         * transport facts does NOT produce Bounds; every use rechecks native pin. */
        static Unqualified restore(JSONObject value) throws Exception {
            exact(value,"request_id","path","body_sha256","before_elapsed_ms","after_elapsed_ms","boot_count","server_now","valid_until");
            for(String field:new String[]{"before_elapsed_ms","after_elapsed_ms","boot_count"})
                if(!(value.get(field) instanceof Integer || value.get(field) instanceof Long))throw invalid();
            long boot=value.getLong("boot_count"); if(boot<0 || boot>Integer.MAX_VALUE)throw invalid();
            NativeProviderClockExchange exchange=new NativeProviderClockExchange(new AuthorizedResponse(200,java.util.Collections.emptyMap(),new byte[0]),
                value.getString("request_id"),value.getString("path"),value.getString("body_sha256"),
                new Point(value.getLong("before_elapsed_ms"),(int)boot),new Point(value.getLong("after_elapsed_ms"),(int)boot));
            return exchange.validateClock(new JSONObject().put("native_request_id",exchange.requestId)
                .put("server_now",value.get("server_now")).put("valid_until",value.get("valid_until")));
        }
    }
    static final class Settlement {
        final NativeProviderJournal.Prepared registration;
        final Unqualified unqualifiedClock;
        final String principalDigest;
        final long engineRevision, providerEpoch;
        Settlement(NativeProviderJournal.Prepared registration, Unqualified clock, String principalDigest, long engineRevision, long providerEpoch) {
            this.registration = registration; this.unqualifiedClock = clock; this.principalDigest = principalDigest;
            this.engineRevision = engineRevision; this.providerEpoch = providerEpoch;
        }
    }
    Unqualified validateClock(JSONObject block) throws VaultFailure {
        try {
            exact(block, "native_request_id", "server_now", "valid_until");
            if (!requestId.equals(block.get("native_request_id"))) throw invalid();
            long server = micros(block.get("server_now")), valid = micros(block.get("valid_until"));
            long horizon = Math.subtractExact(valid, server);
            if (horizon <= 0 || horizon > 900000000L) throw invalid();
            // Necessary raw rejection only; NOT a substitute for the qualified duration bound.
            if (Math.subtractExact(after.elapsedMillis, before.elapsedMillis) >= 45000) throw invalid();
            return new Unqualified(this, server, valid);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_clock_context_invalid", error); }
    }
    static long micros(Object value) throws VaultFailure {
        try {
            if (!(value instanceof String) || !((String) value).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z")) throw invalid();
            if (((String)value).startsWith("0000-")) throw invalid();
            Instant time = Instant.parse((String) value);
            if (!new DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(time).equals(value)) throw invalid();
            return Math.addExact(Math.multiplyExact(time.getEpochSecond(), 1000000L), time.getNano() / 1000);
        } catch (Exception error) { throw invalid(); }
    }
    static void exact(JSONObject value, String... fields) throws VaultFailure {
        if (value == null) throw invalid();
        Set<String> keys = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) keys.add(it.next());
        if (!keys.equals(new HashSet<>(Arrays.asList(fields)))) throw invalid();
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_clock_context_invalid"); }
}
