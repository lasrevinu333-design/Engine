package org.memphiszoo.custodial.vault;

import android.content.Context;
import org.json.JSONObject;

/** Fixed application-owned native reader. No employee/plugin endpoint, URL,
 * path, query-list, signing, send, storage creation or retirement capability.
 * A live original engine-minted plan is required; this does not reconstruct
 * missing generation/frame/capsule owners after process death. Android actual
 * storage/TLS/Keystore and complete semantic acceptance remain unqualified. */
final class AndroidPrivateCustodyPieceRecovery {
    static JSONObject observeOriginal(Context context,VaultEngine engine,
        VaultEngine.NativePrivateCustodyChunkIdentityPlan plan)throws VaultFailure {
        if(context==null||engine==null||plan==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        var journal=AndroidPrivateCustodyExchangeJournal.fromNativeContext(context);
        try(var observed=engine.recoverStoredOriginalPrivateCustodyReturnedPieceSet(plan,journal)){
            return observed.projection();
        }
    }
    private AndroidPrivateCustodyPieceRecovery(){}
}
