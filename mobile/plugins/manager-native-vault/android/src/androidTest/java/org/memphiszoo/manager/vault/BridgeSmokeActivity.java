package org.memphiszoo.manager.vault;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public final class BridgeSmokeActivity extends BridgeActivity {
    private static volatile ManagerNativeVaultPlugin testPlugin;

    static void install(ManagerNativeVaultPlugin plugin) {
        testPlugin = plugin;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ManagerNativeVaultPlugin plugin = testPlugin;
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
