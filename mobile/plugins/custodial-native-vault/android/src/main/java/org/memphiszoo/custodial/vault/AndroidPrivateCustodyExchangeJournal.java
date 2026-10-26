package org.memphiszoo.custodial.vault;
import android.content.Context;
import android.os.Build;
/** UNMOUNTED fixed native no-backup factory. No plugin/path/user input. */
final class AndroidPrivateCustodyExchangeJournal {
    static VaultEngine.NativePrivateCustodyExchangeJournal fromNativeContext(Context context)throws VaultFailure {
        if(context==null||Build.VERSION.SDK_INT<26)throw new VaultFailure(NativeRetainedAttempt.FAILURE);Context app=context.getApplicationContext();
        if(app==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        java.io.File root;
        try{root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app);}
        catch(VaultFailure unavailable){throw new VaultFailure(NativeRetainedAttempt.FAILURE);}
        return VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(root);
    }
    private AndroidPrivateCustodyExchangeJournal(){}
}
