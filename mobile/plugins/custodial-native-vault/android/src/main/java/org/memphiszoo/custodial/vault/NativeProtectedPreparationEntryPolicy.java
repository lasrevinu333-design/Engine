package org.memphiszoo.custodial.vault;

/** Rejection-only entry filter. The Activity's android.permission.DUMP OS
 * gate and original/session validation remain separate and mandatory.
 * INVALID_UID (-1) is not a manager identity or authentication result.
 */
final class NativeProtectedPreparationEntryPolicy {
    private NativeProtectedPreparationEntryPolicy(){}

    static boolean permits(int sdk,int launchedUid,int ownUid,boolean cleanIntent){
        return sdk>=34 && ownUid>=0 && launchedUid>=-1 && launchedUid!=ownUid && cleanIntent;
    }
}
