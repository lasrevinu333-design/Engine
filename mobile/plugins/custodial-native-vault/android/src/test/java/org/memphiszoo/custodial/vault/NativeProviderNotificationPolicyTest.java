package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.Arrays;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderNotificationPolicyTest {
    @Test public void frozenThreeChannelAdapterReproducesRequiredKindRefusal() throws Exception {
        // Exact old adapter allowlist: the payload was valid, the display
        // adapter alone rejected Events and Messenger.
        for (boolean event : new boolean[]{true, false}) {
            NativeProviderPayload payload = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.requiredKind(event));
            assertFalse(Arrays.asList("employee-lunch-coverage", "employee-due-soon", "employee-overdue").contains(payload.get("channel_id")));
            assertNotNull(NativeProviderNotificationPolicy.channelTitle(payload.get("channel_id")));
        }
    }
    @Test public void allFourOperationalKindsDismissOutsideMessenger() throws Exception {
        for (Map<String,String> wire : Arrays.asList(
            NativeProviderPayloadTest.lunch(NativeProviderPayloadTest.fixture().prepared),
            NativeProviderPayloadTest.location(false,false),
            NativeProviderPayloadTest.location(true,false),
            NativeProviderPayloadTest.requiredKind(true))) {
            NativeProviderPayload payload=NativeProviderPayloadTest.accept(wire);
            assertEquals("dismissed",NativeProviderNotificationPolicy.action(payload));
            assertEquals("Dismiss",NativeProviderNotificationPolicy.actionLabel(payload));
            assertFalse(payload.get("route").startsWith("messages.html"));
            assertNull(payload.get("thread_id"));
        }
    }
    @Test public void actualMessageRetainsSeparateConversationAndAcknowledgment() throws Exception {
        NativeProviderPayload payload=NativeProviderPayloadTest.accept(NativeProviderPayloadTest.requiredKind(false));
        assertEquals("Messenger",NativeProviderNotificationPolicy.channelTitle(payload.get("channel_id")));
        assertEquals("acknowledged",NativeProviderNotificationPolicy.action(payload));
        assertEquals("Acknowledge",NativeProviderNotificationPolicy.actionLabel(payload));
        assertTrue(payload.get("route").startsWith("messages.html?hub=employee&thread_id="));
    }
    @Test public void unknownOrAmbiguousChannelsFailClosed() throws Exception {
        for(String channel:new String[]{null,"","employee-events ","employee_event","generic","employee-messages/other"}) {
            ProviderRecordStoreTest.failure("custodial_provider_channel_invalid",()->NativeProviderNotificationPolicy.channelTitle(channel));
        }
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid",()->NativeProviderNotificationPolicy.action(null));
    }
    @Test public void channelCorrectionDoesNotAdmitCrossKindPayloads() throws Exception {
        Map<String,String> wire=NativeProviderPayloadTest.requiredKind(true);
        wire.put("channel_id","employee-messages");
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid",()->NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(wire)));
    }
}
