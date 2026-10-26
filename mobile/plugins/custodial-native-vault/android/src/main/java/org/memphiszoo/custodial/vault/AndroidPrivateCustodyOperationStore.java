package org.memphiszoo.custodial.vault;
import android.content.Context;
import android.os.Build;
/** Fixed private native factory. No WebView input/path or plugin endpoint.
 * Android filesystem/crash qualification remains pending. */
final class AndroidPrivateCustodyOperationStore {
    /** Presence only chooses whether to attempt SAME-original recovery; it is
     * not admission or proof that any pending bytes are valid. No directory,
     * key or operation is created. Unreadable paths are not treated as absent. */
    static boolean pendingOriginalPresent(Context context)throws VaultFailure {
        if(context==null||Build.VERSION.SDK_INT<26)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context app=context.getApplicationContext();if(app==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        try {
            java.io.File root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app);
            if(root==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
            java.nio.file.Files.readAttributes(root.toPath().resolve(NativePrivateCustodyOperationStore.DIRECTORY)
                .resolve(NativePrivateCustodyOperationStore.PENDING),java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);
            return true;
        }catch(java.nio.file.NoSuchFileException absent){return false;}
        catch(Exception unknown){throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);}
    }
    static NativePrivateCustodyOperationStore fromNativeContext(Context context)throws VaultFailure {
        if(context==null||Build.VERSION.SDK_INT<26)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context app=context.getApplicationContext();if(app==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        java.io.File root;
        try{root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app);}
        catch(VaultFailure unavailable){throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);}
        return NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root);
    }
    private AndroidPrivateCustodyOperationStore(){}
}
