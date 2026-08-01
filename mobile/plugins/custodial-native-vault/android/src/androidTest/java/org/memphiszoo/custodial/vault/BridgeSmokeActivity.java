package org.memphiszoo.custodial.vault;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public final class BridgeSmokeActivity extends BridgeActivity {
    private static volatile CustodialNativeVaultPlugin testPlugin;

    static void install(CustodialNativeVaultPlugin plugin) {
        testPlugin = plugin;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        CustodialNativeVaultPlugin plugin = testPlugin;
        if (plugin == null) throw new IllegalStateException("Managed-emulator plugin fixture is missing");
        bridgeBuilder.addPluginInstance(plugin);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        testPlugin = null;
    }
}
