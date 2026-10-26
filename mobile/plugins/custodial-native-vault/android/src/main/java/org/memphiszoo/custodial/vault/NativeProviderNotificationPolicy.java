package org.memphiszoo.custodial.vault;

/** Presentation only, after closed-payload admission. Never creates a chat,
 * changes a cleaning status, or grants a delivery/receipt capability. */
final class NativeProviderNotificationPolicy {
    private NativeProviderNotificationPolicy() { }
    static String channelTitle(String channel) throws VaultFailure {
        if ("employee-lunch-coverage".equals(channel)) return "Lunch coverage";
        if ("employee-due-soon".equals(channel)) return "Cleaning reminders";
        if ("employee-overdue".equals(channel)) return "Overdue cleaning reminders";
        if ("employee-events".equals(channel)) return "Event reminders";
        if ("employee-messages".equals(channel)) return "Messenger";
        if ("employee-schedule-ownership".equals(channel)) return "Assignment updates";
        throw new VaultFailure("custodial_provider_channel_invalid");
    }
    static String action(NativeProviderPayload payload) throws VaultFailure {
        if (payload == null) throw new VaultFailure("custodial_provider_payload_invalid");
        channelTitle(payload.get("channel_id"));
        // Existing Message acknowledgment is separate from operational
        // pop-up dismissal; the latter must not acknowledge completed work.
        return "employee_message".equals(payload.get("kind")) ? "acknowledged" : "dismissed";
    }
    static String actionLabel(NativeProviderPayload payload) throws VaultFailure {
        return "dismissed".equals(action(payload)) ? "Dismiss" : "Acknowledge";
    }
}
