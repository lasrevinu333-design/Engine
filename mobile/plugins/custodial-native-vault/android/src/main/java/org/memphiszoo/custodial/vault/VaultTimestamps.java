package org.memphiszoo.custodial.vault;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Strict ISO-8601 instant handling that is genuinely available on API 24. */
final class VaultTimestamps {
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");
    private static final Pattern INSTANT = Pattern.compile(
        "^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.([0-9]{1,9}))?(Z|([+-])([0-9]{2}):([0-9]{2}))$"
    );

    private VaultTimestamps() {}

    static String normalize(String value, String failureCode) throws VaultFailure {
        Parsed parsed = parse(value, failureCode);
        return format(parsed.epochSecond, parsed.nanoOfSecond);
    }

    static long epochMillis(String value, String failureCode) throws VaultFailure {
        Parsed parsed = parse(value, failureCode);
        try {
            return Math.addExact(Math.multiplyExact(parsed.epochSecond, 1000L), parsed.nanoOfSecond / 1_000_000L);
        } catch (ArithmeticException error) {
            throw new VaultFailure(failureCode, error);
        }
    }

    static String fromEpochMillis(long epochMillis) throws VaultFailure {
        long seconds = Math.floorDiv(epochMillis, 1000L);
        int millis = (int) Math.floorMod(epochMillis, 1000L);
        try {
            return format(seconds, millis * 1_000_000);
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_invalid_binding", error);
        }
    }

    static String fromEpochMillisExact(long epochMillis) throws VaultFailure {
        long seconds = Math.floorDiv(epochMillis, 1000L);
        int millis = (int) Math.floorMod(epochMillis, 1000L);
        try {
            long normalizedMillis = Math.multiplyExact(seconds, 1000L);
            SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
            GregorianCalendar calendar = new GregorianCalendar(UTC, Locale.ROOT);
            calendar.setGregorianChange(new Date(Long.MIN_VALUE));
            formatter.setCalendar(calendar);
            formatter.setTimeZone(UTC);
            return formatter.format(new Date(normalizedMillis))
                + String.format(Locale.ROOT, ".%03dZ", millis);
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_invalid_binding", error);
        }
    }

    private static Parsed parse(String value, String failureCode) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        Matcher match = INSTANT.matcher(clean);
        if (!match.matches()) throw new VaultFailure(failureCode);
        try {
            int year = Integer.parseInt(match.group(1));
            int month = Integer.parseInt(match.group(2));
            int day = Integer.parseInt(match.group(3));
            int hour = Integer.parseInt(match.group(4));
            int minute = Integer.parseInt(match.group(5));
            int second = Integer.parseInt(match.group(6));
            if (year < 1) throw new IllegalArgumentException("year");

            GregorianCalendar calendar = new GregorianCalendar(UTC, Locale.ROOT);
            calendar.setGregorianChange(new Date(Long.MIN_VALUE));
            calendar.setLenient(false);
            calendar.clear();
            calendar.set(Calendar.YEAR, year);
            calendar.set(Calendar.MONTH, month - 1);
            calendar.set(Calendar.DAY_OF_MONTH, day);
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            calendar.set(Calendar.SECOND, second);
            calendar.set(Calendar.MILLISECOND, 0);

            int offsetMinutes = 0;
            if (!"Z".equals(match.group(8))) {
                int offsetHour = Integer.parseInt(match.group(10));
                int offsetMinute = Integer.parseInt(match.group(11));
                if (offsetHour > 18 || offsetMinute > 59 || (offsetHour == 18 && offsetMinute != 0)) {
                    throw new IllegalArgumentException("offset");
                }
                offsetMinutes = offsetHour * 60 + offsetMinute;
                if ("-".equals(match.group(9))) offsetMinutes = -offsetMinutes;
            }

            long localMillis = calendar.getTimeInMillis();
            long instantMillis = Math.subtractExact(localMillis, Math.multiplyExact((long) offsetMinutes, 60_000L));
            long epochSecond = Math.floorDiv(instantMillis, 1000L);
            int nanos = fractionalNanos(match.group(7));
            return new Parsed(epochSecond, nanos);
        } catch (RuntimeException error) {
            throw new VaultFailure(failureCode, error);
        }
    }

    private static int fractionalNanos(String fraction) {
        if (fraction == null || fraction.isEmpty()) return 0;
        String padded = (fraction + "000000000").substring(0, 9);
        return Integer.parseInt(padded);
    }

    private static String format(long epochSecond, int nanoOfSecond) {
        long epochMillis = Math.multiplyExact(epochSecond, 1000L);
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
        GregorianCalendar calendar = new GregorianCalendar(UTC, Locale.ROOT);
        calendar.setGregorianChange(new Date(Long.MIN_VALUE));
        formatter.setCalendar(calendar);
        formatter.setTimeZone(UTC);
        StringBuilder result = new StringBuilder(formatter.format(new Date(epochMillis)));
        if (nanoOfSecond != 0) {
            String fraction = String.format(Locale.ROOT, "%09d", nanoOfSecond);
            int end = fraction.length();
            while (end > 0 && fraction.charAt(end - 1) == '0') end -= 1;
            result.append('.').append(fraction, 0, end);
        }
        return result.append('Z').toString();
    }

    private static final class Parsed {
        final long epochSecond;
        final int nanoOfSecond;

        Parsed(long epochSecond, int nanoOfSecond) {
            this.epochSecond = epochSecond;
            this.nanoOfSecond = nanoOfSecond;
        }
    }
}
