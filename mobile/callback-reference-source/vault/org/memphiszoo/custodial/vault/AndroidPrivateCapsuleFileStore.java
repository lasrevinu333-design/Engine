package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.Build;

/** UNMOUNTED protected setup factory. Employee/plugin input supplies no path,
 * storage instance or permission. NIO/posix contract needs API26 or later;
 * unsupported devices fail before opening/creating a new custody domain.
 * Exact device filesystem/lock/fsync/hard-link effects remain unqualified.
 */
final class AndroidPrivateCapsuleFileStore {
    static NativePrivateCapsuleFileStore fromNativeContext(Context nativeContext)throws VaultFailure {
        if(nativeContext==null||Build.VERSION.SDK_INT<26)throw new VaultFailure(NativePrivateCapsuleFileStore.FAILURE);
        Context app=nativeContext.getApplicationContext();if(app==null)throw new VaultFailure(NativePrivateCapsuleFileStore.FAILURE);
        java.io.File root;
        try{root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app);}
        catch(VaultFailure unavailable){throw new VaultFailure(NativePrivateCapsuleFileStore.FAILURE);}
        return NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root);
    }
    private AndroidPrivateCapsuleFileStore(){}
}
