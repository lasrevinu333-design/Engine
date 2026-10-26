package org.memphiszoo.custodial.vault;

/** RF-family-qualified discovery identity, never supplied by the WebView.
 * Assumes ordinary standards-compliant tags with distinct, fixed IDs in the installed
 * inventory. Equality of observations is not cryptographic tag authentication.
 * Known random/non-unique NFC-A IDs and unclassified RF families are refused.
 */
public final class PhysicalNfcTagIdentity {
    private PhysicalNfcTagIdentity() {}
    public static String observe(byte[] uid, String[] technologies) {
        if (uid == null || technologies == null) return "";
        String family = "";
        for (String tech : technologies) {
            String candidate;
            if ("android.nfc.tech.NfcA".equals(tech)) candidate = "nfc-a.v1:";
            else if ("android.nfc.tech.NfcV".equals(tech)) candidate = "nfc-v.v1:";
            else if ("android.nfc.tech.NfcB".equals(tech) || "android.nfc.tech.NfcF".equals(tech)
                || "android.nfc.tech.NfcBarcode".equals(tech)) return "";
            else continue; // Ndef, IsoDep and MIFARE are additional technologies, not RF namespaces.
            if (!family.isEmpty() && !family.equals(candidate)) return "";
            family = candidate;
        }
        if (family.isEmpty() || !supportedUid(family, uid)) return "";
        StringBuilder hex = new StringBuilder();
        for (byte part : uid) hex.append(String.format(java.util.Locale.ROOT,"%02x",part & 0xff));
        return family + hex;
    }
    private static boolean supportedUid(String family, byte[] uid) {
        if (uid.length == 0) return false;
        boolean allZero = true, allOnes = true;
        for (byte part : uid) { allZero &= part == 0; allOnes &= (part & 0xff) == 0xff; }
        if (allZero || allOnes) return false;
        if (family.equals("nfc-v.v1:")) return uid.length == 8; // ISO 15693 fixed 64-bit UID; retain observed byte order.
        if (!family.equals("nfc-a.v1:") || (uid.length != 4 && uid.length != 7 && uid.length != 10)) return false;
        int first = uid[0] & 0xff;
        if (first == 0x88) return false; // Cascade marker is not part of a complete UID.
        return uid.length != 4 || (first != 0x08 && first != 0xf8 && (first & 0x0f) != 0x0f);
    }
    static boolean valid(String value) {
        if (value == null) return false;
        // Prior isolated candidate identity remains readable, without rewriting protected rows.
        if (value.matches("ntag21x\\.v1:04[0-9a-f]{12}")) return true;
        if (!value.matches("nfc-[av]\\.v1:[0-9a-f]+")) return false;
        int colon = value.indexOf(':'); String hex = value.substring(colon + 1);
        if (hex.length() % 2 != 0 || hex.length() > 20) return false;
        byte[] uid = new byte[hex.length() / 2];
        for (int i = 0; i < uid.length; i++) uid[i] = (byte)Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return supportedUid(value.substring(0, colon + 1), uid);
    }
    static boolean sameObservedTag(String original, String observed) {
        if (!valid(original) || !valid(observed)) return false;
        return canonical(original).equals(canonical(observed));
    }
    private static String canonical(String value) {
        return value.startsWith("ntag21x.v1:") ? "nfc-a.v1:" + value.substring("ntag21x.v1:".length()) : value;
    }
    static String require(String value) throws VaultFailure {
        if (!valid(value))
            throw new VaultFailure("custodial_native_tag_identity_unavailable");
        return value;
    }
    static String fromRecord(java.util.Map<String,Object> record) {
        Object value = record == null ? null : record.get("native_tag_identity");
        return value instanceof String ? (String)value : "";
    }
}
