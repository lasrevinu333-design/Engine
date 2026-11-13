package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.time.format.DateTimeFormatterBuilder;

/** Provider-only timing; never the cleaning/NFC clock. Historical qualified
 * intervals remain readable. The explicit Android policy estimates reminder
 * time and never promotes elapsed-time estimates to expiration authority. */
final class NativeProviderTime {
    private static final long SCALE = 1_000_000L;
    static final long MAX_REQUEST_NS = 45_000_000_000L;
    static final long MAX_HORIZON_US = 900_000_000L;
    static final String ANDROID_BEST_EFFORT = "android-elapsed-best-effort.v1";

    static final class Platform {
        final String api, build, device;
        Platform(String api, String build, String device) throws VaultFailure {
            this.api = text(api); this.build = text(build); this.device = text(device);
        }
    }
    /** Immutable native pin, never parsed from HTTP, prefs, payload or WebView.
     * q covers real resolution/rounding and p the entire operating envelope.
     * Evidence quality is a release prerequisite, not validated by a boolean. */
    static final class Profile {
        final String id, evidenceSha256;
        final Platform platform;
        final long quantizationNanos, ratePpm, maxAgeNanos;
        final boolean bestEffort;
        Profile(String id, Platform platform, long quantizationNanos, long ratePpm,
            long maxAgeNanos, String evidenceSha256) throws VaultFailure {
            this.id = text(id);
            if (!id.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) throw invalid();
            if (platform == null || quantizationNanos < 0 || ratePpm < 0 || ratePpm >= SCALE
                || maxAgeNanos <= 0 || evidenceSha256 == null || !evidenceSha256.matches("[0-9a-f]{64}")) throw invalid();
            this.platform = platform; this.quantizationNanos = quantizationNanos;
            this.ratePpm = ratePpm; this.maxAgeNanos = maxAgeNanos; this.evidenceSha256 = evidenceSha256;
            this.bestEffort = false;
        }
        private Profile(String id, Platform platform, String evidenceSha256) throws VaultFailure {
            this.id = text(id);
            if (!id.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}") || platform == null
                || evidenceSha256 == null || !evidenceSha256.matches("[0-9a-f]{64}")) throw invalid();
            this.platform = platform; this.evidenceSha256 = evidenceSha256; this.bestEffort = true;
            // Sentinels, not zero-error assumptions. The interval arithmetic rejects this policy.
            this.quantizationNanos = -1; this.ratePpm = -1; this.maxAgeNanos = -1;
        }
        static Profile androidBestEffort(String id, Platform platform, String evidenceSha256) throws VaultFailure {
            return new Profile(id, platform, evidenceSha256);
        }
        boolean matches(Platform actual) {
            return actual != null && platform.api.equals(actual.api) && platform.build.equals(actual.build)
                && platform.device.equals(actual.device);
        }
        String fingerprint() throws VaultFailure {
            if (bestEffort) return NativeProviderPrincipal.hash(id + "\n" + platform.api + "\n" + platform.build + "\n" + platform.device
                + "\n" + ANDROID_BEST_EFFORT + "\n" + evidenceSha256);
            return NativeProviderPrincipal.hash(id + "\n" + platform.api + "\n" + platform.build + "\n" + platform.device
                + "\n" + quantizationNanos + "\n" + ratePpm + "\n" + maxAgeNanos + "\n" + evidenceSha256);
        }
    }
    interface Profiles {
        Profile select(Platform actual);
        Profiles NONE = actual -> null;
    }
    static final class Duration {
        final long lowNanos, highNanos;
        private Duration(long low, long high) { lowNanos = low; highNanos = high; }
    }
    static final class Bounds {
        final long earliestMicros, latestMicros;
        final NativeProviderClockExchange.Point point;
        final String profileId;
        final boolean bestEffort;
        final long serverObservedMicros;
        private Bounds(long earliest, long latest, NativeProviderClockExchange.Point point, String profileId) {
            earliestMicros = earliest; latestMicros = latest; this.point = point; this.profileId = profileId;
            bestEffort = false; serverObservedMicros = Long.MIN_VALUE;
        }
        private Bounds(long estimate, long serverObserved, NativeProviderClockExchange.Point point, Profile profile) {
            earliestMicros = estimate; latestMicros = estimate; this.point = point; this.profileId = profile.id;
            bestEffort = true; serverObservedMicros = serverObserved;
        }
        String earliest() throws VaultFailure { return canonical(earliestMicros); }
        String latest() throws VaultFailure { return canonical(latestMicros); }
    }

    static Duration duration(long a, long b, Profile profile) throws VaultFailure {
        try {
            if (profile == null || profile.bestEffort || a < 0 || b < a) throw invalid();
            // Absolute readings must also fit the selected signed64 ns model.
            Math.multiplyExact(a, SCALE); Math.multiplyExact(b, SCALE);
            long delta = Math.multiplyExact(Math.subtractExact(b, a), SCALE);
            long allowance = Math.multiplyExact(2L, profile.quantizationNanos);
            long low = Math.max(0L, Math.subtractExact(delta, allowance));
            long high = Math.addExact(delta, allowance);
            return new Duration(Math.floorDiv(Math.multiplyExact(low, SCALE), Math.addExact(SCALE, profile.ratePpm)),
                ceil(Math.multiplyExact(high, SCALE), Math.subtractExact(SCALE, profile.ratePpm)));
        } catch (VaultFailure failure) { throw failure; }
        catch (ArithmeticException failure) { throw invalid(); }
    }
    /** Null is UNKNOWN: no effect or destructive cleanup, retain prior evidence. */
    static Bounds observe(NativeProviderClockExchange.Unqualified sample, Profile profile,
        Platform actual, NativeProviderClockExchange.Point now) {
        try {
            if (sample == null || profile == null || !profile.matches(actual) || now == null
                || sample.before.bootCount != sample.after.bootCount || sample.after.bootCount != now.bootCount
                || sample.before.elapsedMillis > sample.after.elapsedMillis || sample.after.elapsedMillis > now.elapsedMillis)
                return null;
            long horizon = Math.subtractExact(sample.validUntilMicros, sample.serverMicros);
            if (horizon <= 0 || horizon > MAX_HORIZON_US) return null;
            if (profile.bestEffort) {
                long requestMs = Math.subtractExact(sample.after.elapsedMillis, sample.before.elapsedMillis);
                long ageMs = Math.subtractExact(now.elapsedMillis, sample.before.elapsedMillis);
                long postMs = Math.subtractExact(now.elapsedMillis, sample.after.elapsedMillis);
                // These retain the protocol's operational 45-second request / 15-minute
                // sample horizons. They are not measured hardware accuracy bounds.
                if (requestMs >= MAX_REQUEST_NS / SCALE || Math.multiplyExact(ageMs, 1000L) >= horizon) return null;
                long estimate = Math.addExact(sample.serverMicros,
                    Math.addExact(Math.multiplyExact(postMs, 1000L), Math.multiplyExact(requestMs, 500L)));
                if (estimate >= sample.validUntilMicros) return null;
                canonical(estimate);
                return new Bounds(estimate, sample.serverMicros, now, profile);
            }
            Duration request = duration(sample.before.elapsedMillis, sample.after.elapsedMillis, profile);
            Duration age = duration(sample.before.elapsedMillis, now.elapsedMillis, profile);
            Duration post = duration(sample.after.elapsedMillis, now.elapsedMillis, profile);
            if (request.highNanos >= MAX_REQUEST_NS || age.highNanos > profile.maxAgeNanos) return null;
            long earliest = Math.addExact(Math.subtractExact(sample.serverMicros, 1L), Math.floorDiv(post.lowNanos, 1000L));
            long latest = Math.addExact(Math.addExact(sample.serverMicros, 1L), ceil(age.highNanos, 1000L));
            if (latest < earliest || latest >= sample.validUntilMicros) return null;
            canonical(earliest); canonical(latest);
            return new Bounds(earliest, latest, now, profile.id);
        } catch (Exception failure) { return null; }
    }
    static boolean reached(Bounds bounds, Instant cutoff) throws VaultFailure {
        return bounds != null && bounds.earliestMicros >= micros(cutoff);
    }
    /** Only a server timestamp already observed, or a qualified historical lower
     * bound, may authorize expiry cleanup. An estimate never advances this floor. */
    static boolean authoritativelyReached(Bounds bounds, Instant cutoff) throws VaultFailure {
        return bounds != null && (bounds.bestEffort ? bounds.serverObservedMicros : bounds.earliestMicros) >= micros(cutoff);
    }
    static boolean before(Bounds bounds, Instant cutoff) throws VaultFailure {
        return bounds != null && bounds.latestMicros < micros(cutoff);
    }
    static boolean live(Bounds bounds, Instant reservation, Instant expiry) throws VaultFailure {
        return reached(bounds, reservation) && before(bounds, expiry);
    }
    static boolean overlaps(Bounds first, Bounds second) {
        return first != null && second != null && first.earliestMicros <= second.latestMicros
            && second.earliestMicros <= first.latestMicros;
    }
    static long micros(Instant value) throws VaultFailure {
        try {
            if (value == null || value.getNano() % 1000 != 0) throw invalid();
            return Math.addExact(Math.multiplyExact(value.getEpochSecond(), SCALE), value.getNano() / 1000);
        } catch (ArithmeticException failure) { throw invalid(); }
    }
    static String canonical(long micros) throws VaultFailure {
        try {
            String value = new DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(
                Instant.ofEpochSecond(Math.floorDiv(micros, SCALE), Math.multiplyExact(Math.floorMod(micros, SCALE), 1000L)));
            if (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z") || value.startsWith("0000-")) throw invalid();
            return value;
        } catch (Exception failure) { throw invalid(); }
    }
    static long ceil(long numerator, long denominator) throws VaultFailure {
        try {
            if (denominator <= 0) throw invalid();
            long floor = Math.floorDiv(numerator, denominator);
            return Math.floorMod(numerator, denominator) == 0 ? floor : Math.addExact(floor, 1L);
        } catch (ArithmeticException failure) { throw invalid(); }
    }
    private static String text(String value) throws VaultFailure {
        if (value == null || value.isEmpty() || value.length() > 512 || value.matches(".*[\\p{Cntrl}].*")) throw invalid();
        return value;
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_time_unknown"); }
}
