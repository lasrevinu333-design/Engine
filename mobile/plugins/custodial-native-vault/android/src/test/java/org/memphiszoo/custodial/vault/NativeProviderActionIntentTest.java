package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderActionIntentTest {
    private static final String RECORD = "a".repeat(64), ATTEMPT = "12345678-1234-4234-8234-123456789abc";
    private static final String DATA = "mz-custodial-provider://notification/" + RECORD + "/" + ATTEMPT + "/";
    private NativeProviderActionIntent parse(String action, String data, boolean open) throws Exception {
        return NativeProviderActionIntent.parse(NativeProviderActionIntent.PACKAGE, NativeProviderActionIntent.PACKAGE,
            open ? NativeProviderActionIntent.OPEN_ACTIVITY : NativeProviderActionIntent.ACTION_RECEIVER,
            NativeProviderActionIntent.ACTION_PREFIX + action, data, false, open);
    }
    @Test public void exactThreeActionsHaveOpaqueIdentityOnly() throws Exception {
        for (String action : new String[]{"opened", "acknowledged", "dismissed"}) {
            NativeProviderActionIntent value = parse(action, DATA + action, "opened".equals(action));
            assertEquals(RECORD, value.recordId); assertEquals(ATTEMPT, value.attemptId); assertEquals(action, value.action);
        }
    }
    @Test public void wrongComponentAndExtraAuthorityAreRejected() throws Exception {
        for (String component : new String[]{null, "org.memphiszoo.custodial.MainActivity", NativeProviderActionIntent.ACTION_RECEIVER}) {
            ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () ->
                NativeProviderActionIntent.parse(NativeProviderActionIntent.PACKAGE, NativeProviderActionIntent.PACKAGE,
                    component, NativeProviderActionIntent.ACTION_PREFIX + "opened", DATA + "opened", false, true));
        }
        for (String packageName : new String[]{null, "org.example", NativeProviderActionIntent.PACKAGE + ".extra"}) {
            ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () ->
                NativeProviderActionIntent.parse(packageName, NativeProviderActionIntent.PACKAGE,
                    NativeProviderActionIntent.OPEN_ACTIVITY, NativeProviderActionIntent.ACTION_PREFIX + "opened", DATA + "opened", false, true));
            ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () ->
                NativeProviderActionIntent.parse(NativeProviderActionIntent.PACKAGE, packageName,
                    NativeProviderActionIntent.OPEN_ACTIVITY, NativeProviderActionIntent.ACTION_PREFIX + "opened", DATA + "opened", false, true));
        }
        ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () ->
            NativeProviderActionIntent.parse(NativeProviderActionIntent.PACKAGE, NativeProviderActionIntent.PACKAGE,
                NativeProviderActionIntent.OPEN_ACTIVITY, NativeProviderActionIntent.ACTION_PREFIX + "opened", DATA + "opened", true, true));
    }
    @Test public void aliasesPayloadsMismatchedActionsAndCrossSurfacesCannotCreateAnAction() throws Exception {
        String valid = DATA + "opened";
        for (String data : new String[]{null, "", valid + "/", valid + "?route=scan", valid + "#opened", valid + "\n",
            valid.replace("notification/", "notification:80/"), valid.replace("notification/", "user@notification/"),
            valid.replace("notification/", "NOTIFICATION/"), valid.replace("mz-custodial-provider", "https"),
            valid.replace(RECORD, RECORD.toUpperCase()), valid.replace(RECORD, "%61" + RECORD.substring(1)),
            valid.replace(ATTEMPT, "1234"), valid.replace(ATTEMPT, ATTEMPT.toUpperCase()),
            valid.replace("/opened", "/../opened"), valid.replace("/opened", "/acknowledged")}) {
            ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () -> parse("opened", data, true));
        }
        ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () -> parse("opened", valid, false));
        ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () -> parse("acknowledged", DATA + "acknowledged", true));
        ProviderRecordStoreTest.failure("custodial_provider_action_intent_invalid", () -> parse("displayed", DATA + "displayed", false));
    }
    @Test public void suspendedRuntimeCannotTurnAnExactLocatorIntoReceiptOrNavigation() throws Exception {
        NativeProviderComponentRuntime runtime = NativeProviderComponentRuntime.SUSPENDED;
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND, runtime.pendingWork());
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND, runtime.synchronize(null));
        NativeProviderActionIntent action = parse("opened", DATA + "opened", true);
        ProviderRecordStoreTest.failure("custodial_provider_runtime_not_admitted", () -> runtime.applyAction(action));
        ProviderRecordStoreTest.failure("custodial_provider_runtime_not_admitted", () -> runtime.openCommitted(action, () -> fail("must not navigate")));
    }
}
