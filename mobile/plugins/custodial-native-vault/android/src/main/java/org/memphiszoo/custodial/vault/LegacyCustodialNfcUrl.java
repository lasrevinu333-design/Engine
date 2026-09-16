package org.memphiszoo.custodial.vault;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Converts the two deployed Google Forms tag families into the canonical app scan URL. */
public final class LegacyCustodialNfcUrl {
    private static final String EXHIBIT_FORM_ID =
        "1FAIpQLSdWR9SY-s1ZNn9riF6IumT7RWQFrDq71wwYIym2p7HiLamdPg";
    private static final String RESTROOM_FORM_ID =
        "1FAIpQLSdgjTn3Z-IwsRtXXKBxW063f3ifEPQzhqmazKyZXEOpArgrdw";
    private static final String EXHIBIT_ENTRY = "entry.646771738";
    private static final String RESTROOM_ENTRY = "entry.1155432101";

    private LegacyCustodialNfcUrl() {}

    /**
     * Returns an approved current URL unchanged, a canonical scan URL for a known deployed
     * Google Forms tag, or an empty string for every unsupported/malformed destination.
     */
    public static String normalize(String value) {
        String raw = value == null ? "" : value.trim();
        if (raw.isEmpty()) return "";
        final URI uri;
        try {
            uri = URI.create(raw);
        } catch (IllegalArgumentException error) {
            return "";
        }
        if (uri.getUserInfo() != null
            || (uri.getPort() != -1 && uri.getPort() != 443)
            || uri.getFragment() != null) return "";

        String scheme = String.valueOf(uri.getScheme()).toLowerCase(java.util.Locale.ROOT);
        String host = String.valueOf(uri.getHost()).toLowerCase(java.util.Locale.ROOT);
        String path = String.valueOf(uri.getPath());
        if (("memphiszoo".equals(scheme) || "memphiszoo-custodial".equals(scheme))
            && "scan".equals(host)) return raw;
        if ("https".equals(scheme)
            && "lasrevinu333-design.github.io".equals(host)
            && ("/Engine/".equals(path)
                || "/Engine/index".equals(path)
                || "/Engine/index.html".equals(path)
                || "/Engine/scan".equals(path)
                || "/Engine/scan.html".equals(path))) return raw;
        if (!"https".equals(scheme) || !"docs.google.com".equals(host)) return "";

        String prefix = "/forms/d/e/";
        String suffix = "/viewform";
        if (!path.startsWith(prefix) || !path.endsWith(suffix)) return "";
        String formId = path.substring(prefix.length(), path.length() - suffix.length());
        String entryName;
        boolean exhibit;
        if (EXHIBIT_FORM_ID.equals(formId)) {
            entryName = EXHIBIT_ENTRY;
            exhibit = true;
        } else if (RESTROOM_FORM_ID.equals(formId)) {
            entryName = RESTROOM_ENTRY;
            exhibit = false;
        } else {
            return "";
        }

        List<String> values = queryValues(uri.getRawQuery(), entryName);
        if (values.size() != 1) return "";
        String code = exhibit ? exhibitCode(values.get(0)) : restroomCode(values.get(0));
        return code.isEmpty() ? "" : "memphiszoo://scan?code=" + code;
    }

    private static List<String> queryValues(String rawQuery, String wantedName) {
        List<String> values = new ArrayList<>();
        if (rawQuery == null || rawQuery.isEmpty()) return values;
        for (String part : rawQuery.split("&", -1)) {
            int separator = part.indexOf('=');
            String rawName = separator < 0 ? part : part.substring(0, separator);
            String rawValue = separator < 0 ? "" : part.substring(separator + 1);
            String name = decode(rawName);
            if (name.startsWith("entry.") && !wantedName.equals(name)) return List.of();
            if (wantedName.equals(name)) values.add(decode(rawValue));
        }
        return values;
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            return "";
        }
    }

    private static String exhibitCode(String value) {
        return switch (String.valueOf(value == null ? "" : value).trim()) {
            case "Aquarium" -> "AQUX";
            case "Cat Country" -> "CATX";
            case "China" -> "CHNX";
            case "East Admin Building" -> "EABX";
            case "Education" -> "EDUX";
            case "Event Center" -> "EVCX";
            case "Expo" -> "EXOX";
            case "Herpetarium" -> "HERX";
            case "Komodos" -> "KOMX";
            case "Nocturnal" -> "NOCX";
            case "North West Passage" -> "NWPX";
            case "Primate Canyon" -> "PRCX";
            case "Primate Pavillion" -> "PRPX";
            case "Teton" -> "TETX";
            case "Tropical Birds" -> "TRBX";
            case "West Admin Building" -> "WABX";
            case "Zambezi" -> "ZAMX";
            default -> "";
        };
    }

    private static String restroomCode(String value) {
        return switch (String.valueOf(value == null ? "" : value).trim()) {
            case "Bonobos Men's Restroom" -> "BONM";
            case "Bonobos Women's Restroom" -> "BONW";
            case "Breezeway Men's Restroom" -> "BREM";
            case "Breezeway Women's Restroom" -> "BREW";
            case "Cathouse Cafe Men's Restroom" -> "CATM";
            case "Cathouse Cafe Women's Restroom" -> "CATW";
            case "China Men's Restroom" -> "CHIM";
            case "China Women's Restroom" -> "CHIW";
            case "Courtyard Men's Restroom" -> "COURM";
            case "Courtyard Women's Restroom" -> "COURW";
            case "East Admin Men's Restroom" -> "EADM";
            case "East Admin Women's Restroom" -> "EADW";
            case "East End Men's Restroom" -> "EENDM";
            case "East End Women's Restroom" -> "EENDW";
            case "Event Center Left Restroom" -> "EVCM";
            case "Event Center Right Restroom" -> "EVCW";
            case "Expo Men's Restroom" -> "EXPOM";
            case "Expo Women's Restroom" -> "EXPOW";
            case "MemMex Men's Restroom" -> "MEMM";
            case "MemMex Women's Restroom" -> "MEMW";
            case "Splash Pad Men's Restroom" -> "SPLM";
            case "Splash Pad Women's Restroom" -> "SPLW";
            case "Teton Men's Restroom" -> "TETM";
            case "Teton Women's Restroom" -> "TETW";
            case "West Admin Downstairs Men's Restroom" -> "WADM";
            case "West Admin Downstairs Women's Restroom" -> "WADW";
            case "West Admin Upstairs Men's Restroom" -> "WAUM";
            case "West Admin Upstairs Women's Restroom" -> "WAUW";
            case "Zambezi Men's Restroom" -> "ZAMM";
            case "Zambezi Women's Restroom" -> "ZAMW";
            default -> "";
        };
    }
}
