package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.Test;

public final class LegacyCustodialNfcUrlTest {
    private static final String EXHIBIT =
        "https://docs.google.com/forms/d/e/1FAIpQLSdWR9SY-s1ZNn9riF6IumT7RWQFrDq71wwYIym2p7HiLamdPg/viewform?usp=pp_url&entry.646771738=";
    private static final String RESTROOM =
        "https://docs.google.com/forms/d/e/1FAIpQLSdgjTn3Z-IwsRtXXKBxW063f3ifEPQzhqmazKyZXEOpArgrdw/viewform?usp=pp_url&entry.1155432101=";

    @Test
    public void mapsEveryDeployedExhibitTagToItsCanonicalCode() {
        Map<String, String> expected = Map.ofEntries(
            Map.entry("Aquarium", "AQUX"), Map.entry("Cat Country", "CATX"),
            Map.entry("China", "CHNX"), Map.entry("East Admin Building", "EABX"),
            Map.entry("Education", "EDUX"), Map.entry("Event Center", "EVCX"),
            Map.entry("Expo", "EXOX"), Map.entry("Herpetarium", "HERX"),
            Map.entry("Komodos", "KOMX"), Map.entry("Nocturnal", "NOCX"),
            Map.entry("North West Passage", "NWPX"), Map.entry("Primate Canyon", "PRCX"),
            Map.entry("Primate Pavillion", "PRPX"), Map.entry("Teton", "TETX"),
            Map.entry("Tropical Birds", "TRBX"), Map.entry("West Admin Building", "WABX"),
            Map.entry("Zambezi", "ZAMX")
        );
        expected.forEach((name, code) -> assertEquals(
            "memphiszoo://scan?code=" + code,
            LegacyCustodialNfcUrl.normalize(EXHIBIT + encoded(name))
        ));
    }

    @Test
    public void mapsEveryDeployedRestroomTagToItsCanonicalCode() {
        Map<String, String> expected = Map.ofEntries(
            Map.entry("Bonobos Men's Restroom", "BONM"), Map.entry("Bonobos Women's Restroom", "BONW"),
            Map.entry("Breezeway Men's Restroom", "BREM"), Map.entry("Breezeway Women's Restroom", "BREW"),
            Map.entry("Cathouse Cafe Men's Restroom", "CATM"), Map.entry("Cathouse Cafe Women's Restroom", "CATW"),
            Map.entry("China Men's Restroom", "CHIM"), Map.entry("China Women's Restroom", "CHIW"),
            Map.entry("Courtyard Men's Restroom", "COURM"), Map.entry("Courtyard Women's Restroom", "COURW"),
            Map.entry("East Admin Men's Restroom", "EADM"), Map.entry("East Admin Women's Restroom", "EADW"),
            Map.entry("East End Men's Restroom", "EENDM"), Map.entry("East End Women's Restroom", "EENDW"),
            Map.entry("Event Center Left Restroom", "EVCM"), Map.entry("Event Center Right Restroom", "EVCW"),
            Map.entry("Expo Men's Restroom", "EXPOM"), Map.entry("Expo Women's Restroom", "EXPOW"),
            Map.entry("MemMex Men's Restroom", "MEMM"), Map.entry("MemMex Women's Restroom", "MEMW"),
            Map.entry("Splash Pad Men's Restroom", "SPLM"), Map.entry("Splash Pad Women's Restroom", "SPLW"),
            Map.entry("Teton Men's Restroom", "TETM"), Map.entry("Teton Women's Restroom", "TETW"),
            Map.entry("West Admin Downstairs Men's Restroom", "WADM"),
            Map.entry("West Admin Downstairs Women's Restroom", "WADW"),
            Map.entry("West Admin Upstairs Men's Restroom", "WAUM"),
            Map.entry("West Admin Upstairs Women's Restroom", "WAUW"),
            Map.entry("Zambezi Men's Restroom", "ZAMM"), Map.entry("Zambezi Women's Restroom", "ZAMW")
        );
        expected.forEach((name, code) -> assertEquals(
            "memphiszoo://scan?code=" + code,
            LegacyCustodialNfcUrl.normalize(RESTROOM + encoded(name))
        ));
    }

    @Test
    public void failsClosedForUnknownOrAmbiguousLegacyFormsAndPreservesCurrentTags() {
        assertEquals("", LegacyCustodialNfcUrl.normalize(EXHIBIT + "Unknown"));
        assertEquals("", LegacyCustodialNfcUrl.normalize(EXHIBIT + "Nocturnal&entry.646771738=Zambezi"));
        assertEquals("", LegacyCustodialNfcUrl.normalize(EXHIBIT + "Nocturnal&entry.1155432101=Nocturnal"));
        assertEquals("", LegacyCustodialNfcUrl.normalize(EXHIBIT + "nocturnal"));
        assertEquals("", LegacyCustodialNfcUrl.normalize(
            "https://docs.google.com/forms/d/e/not-approved/viewform?entry.646771738=Nocturnal"
        ));
        assertEquals("", LegacyCustodialNfcUrl.normalize(
            "https://docs.google.com/forms/d/e/viewform?entry.646771738=Nocturnal"
        ));
        assertEquals("", LegacyCustodialNfcUrl.normalize(
            "https://docs.google.com/forms/d/e/1FAIpQLSdWR9SY-s1ZNn9riF6IumT7RWQFrDq71wwYIym2p7HiLamdPg/edit?entry.646771738=Nocturnal"
        ));
        assertEquals("", LegacyCustodialNfcUrl.normalize(
            "https://docs.google.com:444/forms/d/e/1FAIpQLSdWR9SY-s1ZNn9riF6IumT7RWQFrDq71wwYIym2p7HiLamdPg/viewform?entry.646771738=Nocturnal"
        ));
        assertEquals("", LegacyCustodialNfcUrl.normalize(
            "https://user@docs.google.com/forms/d/e/1FAIpQLSdWR9SY-s1ZNn9riF6IumT7RWQFrDq71wwYIym2p7HiLamdPg/viewform?entry.646771738=Nocturnal"
        ));
        assertEquals("", LegacyCustodialNfcUrl.normalize(EXHIBIT + "Nocturnal#fragment"));
        assertEquals("", LegacyCustodialNfcUrl.normalize("https://attacker.example/scan?code=NOCX"));
        assertEquals(
            "memphiszoo://scan?code=NOCX",
            LegacyCustodialNfcUrl.normalize("memphiszoo://scan?code=NOCX")
        );
        assertEquals(
            "https://lasrevinu333-design.github.io/Engine/scan.html?code=NOCX",
            LegacyCustodialNfcUrl.normalize("https://lasrevinu333-design.github.io/Engine/scan.html?code=NOCX")
        );
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
