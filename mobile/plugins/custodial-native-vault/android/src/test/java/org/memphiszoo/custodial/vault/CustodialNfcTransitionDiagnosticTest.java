package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;

import java.util.Set;
import org.junit.Test;

public final class CustodialNfcTransitionDiagnosticTest {
    @Test
    public void boundsWebViewProvidedStageAndOutcome() {
        assertEquals(
            "shell_listener_ready",
            NativeNfcScanHandoff.boundedDiagnostic(
                " SHELL_LISTENER_READY ", Set.of("shell_listener_ready")
            )
        );
        assertEquals(
            "unclassified",
            NativeNfcScanHandoff.boundedDiagnostic(
                "employee=Karen Robinson", Set.of("shell_listener_ready")
            )
        );
        assertEquals(
            "unclassified",
            NativeNfcScanHandoff.boundedDiagnostic(null, Set.of("ready"))
        );
    }

    @Test
    public void webViewCannotNameNativeOnlyMilestones() {
        assertEquals(
            "unclassified",
            NativeNfcScanHandoff.boundedWebViewStage("reader_callback_entered")
        );
        assertEquals(
            "shell_listener_ready",
            NativeNfcScanHandoff.boundedWebViewStage("shell_listener_ready")
        );
    }

    @Test
    public void exposesOnlyShortOpaqueCorrelationTrace() {
        assertEquals(
            "11111111",
            NativeNfcScanHandoff.diagnosticTrace("11111111-2222-4333-8444-555555555555")
        );
        assertEquals("none", NativeNfcScanHandoff.diagnosticTrace("not-a-handoff"));
        assertEquals("none", NativeNfcScanHandoff.diagnosticTrace(null));
    }
}
