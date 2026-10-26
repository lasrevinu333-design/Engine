package org.memphiszoo.custodial.vault;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Opaque locator only. Parsing never admits payload, principal, receipt or route. */
final class NativeProviderActionIntent {
    static final String PACKAGE = "org.memphiszoo.custodial";
    static final String OPEN_ACTIVITY = PACKAGE + ".vault.ProviderNotificationOpenActivity";
    static final String ACTION_RECEIVER = PACKAGE + ".vault.ProviderNotificationActionReceiver";
    static final String ACTION_PREFIX = PACKAGE + ".PROVIDER_";
    private static final Pattern DATA = Pattern.compile(
        "mz-custodial-provider://notification/([a-f0-9]{64})/"
        + "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/"
        + "(opened|acknowledged|dismissed)");
    final String recordId, attemptId, action;
    private NativeProviderActionIntent(String recordId, String attemptId, String action) {
        this.recordId = recordId; this.attemptId = attemptId; this.action = action;
    }

    static NativeProviderActionIntent parse(String packageName, String componentPackage,
        String componentClass, String action, String data, boolean extraSurface, boolean open) throws VaultFailure {
        if (!PACKAGE.equals(packageName) || !PACKAGE.equals(componentPackage)
            || !(open ? OPEN_ACTIVITY : ACTION_RECEIVER).equals(componentClass)
            || extraSurface || data == null || data.length() > 256) throw invalid();
        Matcher match = DATA.matcher(data);
        if (!match.matches()) throw invalid(); // No decode/normalize of aliases, query, fragment or extra paths.
        String kind = match.group(3);
        if (!ACTION_PREFIX.concat(kind).equals(action) || open != "opened".equals(kind)) throw invalid();
        return new NativeProviderActionIntent(match.group(1), match.group(2), kind);
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_action_intent_invalid"); }
}
