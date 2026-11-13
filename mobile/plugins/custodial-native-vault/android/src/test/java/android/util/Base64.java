package android.util;

/** Desktop-only test shim for Android Base64 API stubs. */
public final class Base64 {
    public static final int NO_WRAP = 2;
    private Base64() {}

    public static String encodeToString(byte[] value, int flags) {
        return java.util.Base64.getEncoder().encodeToString(value);
    }

    public static byte[] decode(String value, int flags) {
        return java.util.Base64.getDecoder().decode(value);
    }
}
