package android.net;

/** Host-only URI adapter for ordinary synthetic handoff URLs, not Android/NFC proof. */
public final class Uri {
    private final java.net.URI value;
    private Uri(String value) { this.value = java.net.URI.create(value); }
    public static Uri parse(String value) { return new Uri(value); }
    public String getScheme() { return value.getScheme(); }
    public java.util.List<String> getQueryParameters(String name) {
        java.util.List<String> result = new java.util.ArrayList<>();
        String query = value.getRawQuery();
        if (query != null) for (String item : query.split("&")) {
            String[] pair = item.split("=", 2);
            if (java.net.URLDecoder.decode(pair[0], java.nio.charset.StandardCharsets.UTF_8).equals(name))
                result.add(java.net.URLDecoder.decode(pair.length == 2 ? pair[1] : "", java.nio.charset.StandardCharsets.UTF_8));
        }
        return result;
    }
}
