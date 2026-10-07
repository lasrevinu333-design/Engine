package org.memphiszoo.custodial.vault;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

/** Read exactly the identity emitted by our immutable explicit PendingIntent. */
final class AndroidProviderActionIntent {
    static NativeProviderActionIntent read(Context context, Intent intent, boolean open) throws VaultFailure {
        if (context == null || intent == null) throw invalid();
        try {
            ComponentName component = intent.getComponent();
            if (component == null) throw invalid();
            boolean extraSurface = intent.getSelector() != null || intent.getClipData() != null
                || intent.getType() != null || intent.getCategories() != null
                || (intent.getPackage() != null && !context.getPackageName().equals(intent.getPackage()))
                || (intent.getExtras() != null && !intent.getExtras().isEmpty());
            return NativeProviderActionIntent.parse(context.getPackageName(), component.getPackageName(),
                component.getClassName(), intent.getAction(), intent.getDataString(), extraSurface, open);
        } catch (VaultFailure failure) { throw failure; }
        catch (RuntimeException malformedParcel) { throw invalid(); }
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_action_intent_invalid"); }
    private AndroidProviderActionIntent() {}
}
