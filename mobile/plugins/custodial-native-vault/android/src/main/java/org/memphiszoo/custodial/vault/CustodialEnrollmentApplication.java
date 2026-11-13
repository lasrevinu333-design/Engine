package org.memphiszoo.custodial.vault;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.WebView;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.util.Set;

/** An enrollment partition changes only after the existing protected native
 * finalizer has durably retained the original all8/browser inventory. The app
 * must restart before using its next partition. Original preferences, browser
 * directory, private capsules, employee attribution and all keys remain.
 * Canonical device identity, application ID/UID and installation do not change.
 */
public final class CustodialEnrollmentApplication extends Application {
    private static final Set<String> PROTECTED=Set.of(
        "MemphisZooCustodialNativeProviderV1","MemphisZooCustodialNativeVaultV1",
        "MemphisZooCustodialNativeVaultV2","MemphisZooCustodialOfflineAuthorityTimeV1",
        "MemphisZooCustodialRetainedAttemptV1","MemphisZooCustodialRetainedBatchV1",
        "MemphisZooCustodialRetainedReadQueryV1","WSSecureStorageSharedPreferences");
    private File originalRoot,currentRoot;
    private String realm=NativeRetainedEnrollmentRealmStore.LEGACY;
    private String pointerSha="";

    @Override protected void attachBaseContext(Context base){
        super.attachBaseContext(base);
        try{
            originalRoot=super.getNoBackupFilesDir().getCanonicalFile();currentRoot=originalRoot;
            if(Files.exists(originalRoot.toPath().resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY),LinkOption.NOFOLLOW_LINKS)){
                var store=existingStore();
                // Only completion of an already encrypted durable pointer
                // intent; never a new inventory/finalizer/manager decision.
                var state=store.finishPrepared();realm=state.realm;pointerSha=state.sha256;
                currentRoot=store.realmRoot(state).toFile();
            }
            if(!NativeRetainedEnrollmentRealmStore.LEGACY.equals(realm)){
                if(Build.VERSION.SDK_INT<28)throw new VaultFailure("custodial_retained_enrollment_webview_partition_unsupported");
                // Before ContentProviders/Capacitor can create a WebView. The
                // previous origin's local/session/IDB data is left untouched.
                WebView.setDataDirectorySuffix(browserSuffix(realm));
            }
        }catch(Exception e){throw new IllegalStateException(NativeRetainedEnrollmentRealmStore.FAILURE,e);}
    }
    @Override public SharedPreferences getSharedPreferences(String name,int mode){
        return super.getSharedPreferences(preferenceName(name,realm),mode);
    }
    /** Custodial private journals only. Other SDKs keep Android's original
     * no-backup directory and their own lifecycle. */
    File nativeNoBackupRoot(){if(currentRoot==null)throw new IllegalStateException("native enrollment partition unavailable");return currentRoot;}
    static File nativeNoBackupRoot(Context application){
        return application instanceof CustodialEnrollmentApplication app?app.nativeNoBackupRoot():application.getNoBackupFilesDir();
    }
    static String preferenceName(String name,String realm){
        if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(realm)||!PROTECTED.contains(name))return name;
        requireRealm(realm);return name+".retained-realm-"+realm;
    }
    static String browserSuffix(String realm){requireRealm(realm);return "custodial_assignment_"+realm;}
    private static void requireRealm(String value){
        if(value==null||!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw new IllegalArgumentException("invalid retained enrollment partition");
    }
    private NativeRetainedEnrollmentRealmStore existingStore()throws VaultFailure {
        return new NativeRetainedEnrollmentRealmStore(originalRoot.toPath(),
            new AndroidKeystoreCipher(NativeRetainedEnrollmentRealmStore.AAD,4*1024*1024),false);
    }
    static CustodialEnrollmentApplication actual(Context context)throws VaultFailure {
        if(context==null||!(context.getApplicationContext() instanceof CustodialEnrollmentApplication application)
            ||application.originalRoot==null||application.currentRoot==null)throw new VaultFailure("custodial_retained_enrollment_application_required");
        return application;
    }
    NativeRetainedEnrollmentRealmStore retainedStoreForProtectedRead()throws VaultFailure {
        requireStartupPartitionCurrent();return existingStore();
    }
    File previousOriginalRoot(NativeRetainedEnrollmentRealmStore.State state,NativeRetainedEnrollmentFiles.Check check)throws VaultFailure {
        var store=retainedStoreForProtectedRead();var current=store.read();
        if(state==null||NativeRetainedEnrollmentRealmStore.LEGACY.equals(current.realm))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
        var selected=selectRetainedState(state.operationId,check);
        if(!selected.realm.equals(state.realm)||!selected.sha256.equals(state.sha256))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
        if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(state.previousRealm))return originalRoot;
        return store.realmRoot(store.retiredState(state.previousRealm)).toFile();
    }
    NativeRetainedEnrollmentRealmStore.State selectRetainedState(String originalOperation,NativeRetainedEnrollmentFiles.Check check)throws VaultFailure {
        var store=retainedStoreForProtectedRead();var selected=store.read();
        if(originalOperation!=null&&!originalOperation.isEmpty())VaultValidation.operationId(originalOperation);
        var seen=new java.util.HashSet<String>();
        for(int n=0;n<4096;n++){
            check.current();
            if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(selected.realm)||!seen.add(selected.realm))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
            if(originalOperation==null||originalOperation.isEmpty()||selected.operationId.equals(originalOperation))return selected;
            if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(selected.previousRealm))break;
            var previous=store.retiredState(selected.previousRealm);
            if(!previous.sha256.equals(selected.previousSha256))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
            selected=previous;
        }
        throw new VaultFailure("custodial_retained_original_operation_not_found");
    }
    /** Ordinary owners must keep the partition selected at process startup.
     * A committed maintenance transition cannot be adopted by a stale runtime. */
    void requireStartupPartitionCurrent()throws VaultFailure {
        if(!Files.exists(originalRoot.toPath().resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY),LinkOption.NOFOLLOW_LINKS)){
            if(!NativeRetainedEnrollmentRealmStore.LEGACY.equals(realm)||!pointerSha.isEmpty())throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
            return;
        }
        var current=existingStore().read();
        if(!realm.equals(current.realm)||!pointerSha.equals(current.sha256))throw new VaultFailure("custodial_retained_enrollment_restart_required");
    }
    boolean hasRetainedOriginalKeyDependencies()throws VaultFailure {
        requireStartupPartitionCurrent();return !NativeRetainedEnrollmentRealmStore.LEGACY.equals(realm);
    }
    NativeRetainedEnrollmentRealmStore.State findRetainedState(String originalOperation,NativeRetainedEnrollmentFiles.Check check)throws VaultFailure {
        if(originalOperation==null||originalOperation.isEmpty())throw new VaultFailure("custodial_retained_original_operation_required");
        VaultValidation.operationId(originalOperation);requireStartupPartitionCurrent();
        if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(realm))return null;
        var store=retainedStoreForProtectedRead();var selected=store.read();var seen=new java.util.HashSet<String>();
        for(int n=0;n<4096;n++){
            check.current();if(!seen.add(selected.realm))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
            if(selected.operationId.equals(originalOperation))return selected;
            if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(selected.previousRealm))return null;
            var previous=store.retiredState(selected.previousRealm);
            if(!previous.sha256.equals(selected.previousSha256))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
            selected=previous;
        }
        throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
    }
    NativeRetainedEnrollmentRealmStore writerStore()throws VaultFailure {
        requireStartupPartitionCurrent();
        return new NativeRetainedEnrollmentRealmStore(originalRoot.toPath(),new AndroidKeystoreCipher(NativeRetainedEnrollmentRealmStore.AAD,4*1024*1024));
    }
    /** The owner uses only its actual startup root. No WebView/caller path or
     * original realm/employee identity can select a predecessor. */
    NativeRetainedEnrollmentRealmStore.State startupState(NativeRetainedEnrollmentRealmStore store)throws VaultFailure {
        requireStartupPartitionCurrent();var state=store.read();
        if(!realm.equals(state.realm)||!pointerSha.equals(state.sha256)||!store.realmRoot(state).toFile().equals(currentRoot))throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);
        return state;
    }
}
