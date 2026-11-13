package org.memphiszoo.custodial.vault;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Explicit operator preparation screen, never employee/WebView/plugin/startup.
 * Manifest DUMP protects external launch. API34's original-launch UID rejects
 * same-app launches, including a plugin attempting to bypass the manifest gate.
 * Neither platform permission nor a button press authenticates a manager:
 * only the fixed current SQL/session/original read can return its observation.
 * Read/retention actions grant no effects. A separate confirmed separation
 * action still needs the Engine's private current original ACK; it keeps all
 * original work and keys and cannot release a phone or replay work. */
public final class NativeProtectedRecoveryPreparationActivity extends Activity {
    static final String ACTION="org.memphiszoo.custodial.ORIGINAL_RECOVERY_PREPARATION";
    private static final AtomicBoolean FLIGHT=new AtomicBoolean();
    private final Object lifecycle=new Object();
    private NativePrivateCustodyFrameReadControl control;
    private Thread worker;
    private boolean admitted,foreground,retired,controlClosed,workCheckAttempted,baselineAttempted,retentionAttempted,pieceRecoveryAttempted,custodyAttempted,stageAttempted,readAttempted,browserAttempted,writerHoldAttempted,holdStatusAttempted,heldVerificationAttempted;
    private boolean inventoryIntentAttempted,inventoryStatusAttempted,inventoryRegistrationAttempted,inventoryServerStatusAttempted,inventoryManifestAttempted,inventoryDecisionAttempted,inventoryDecisionRetentionAttempted;
    private Button inventoryIntentButton,inventoryStatusButton,inventoryRegistrationButton,inventoryServerStatusButton,inventoryManifestButton,inventoryDecisionButton,inventoryDecisionRetentionButton;
    private TextView message;
    private Button workCheckButton,baselineButton,retainButton,pieceRecoveryButton,custodyButton,stageButton,readButton,browserButton,writerHoldButton,holdStatusButton,heldVerificationButton;
    private Button reloadRecoveryButton;
    private boolean reloadRecoveryAttempted;
    private boolean finalizationReadAttempted;
    private Button finalizationReadButton;
    private boolean nativeCustodyReadAttempted;
    private Button nativeCustodyReadButton;
    private boolean finalizationAttempted,finalizationConfirmationOpen;
    private Button finalizeEnrollmentButton;
    private enum Preparation { RELOAD_CONSUMED_RECOVERY_DOCUMENT, READ_LOCAL_FINALIZATION_STATUS, SEPARATE_ENROLLMENT_KEEP_WORK, CHECK_ORIGINAL_WORK, INITIAL_BASELINE, RETAIN_FIRST_ORIGINAL, RECOVER_ORIGINAL_PIECES, RETAIN_SAVED_CUSTODY, READ_CURRENT_NATIVE_CUSTODY, STAGE_ORIGINAL, READ_ORIGINAL, READ_ORIGINAL_BROWSER, HOLD_ORIGINAL_WRITERS, READ_NATIVE_HOLD_STATUS, VERIFY_HELD_ORIGINAL, RETAIN_HELD_INVENTORY_INTENT, READ_HELD_INVENTORY_STATUS, REGISTER_FIRST_HELD_INVENTORY_REQUEST, READ_HELD_INVENTORY_SERVER_STATUS, ADVANCE_HELD_INVENTORY_MANIFEST, READ_HELD_INVENTORY_MANAGER_DECISION, RETAIN_HELD_INVENTORY_MANAGER_DECISION }

    @Override protected void onCreate(Bundle saved){
        super.onCreate(saved);
        // No restoration/automatic request. Older API cannot establish this
        // same-app exclusion; ordinary cleaning support is not changed.
        int uid=Build.VERSION.SDK_INT>=34?getLaunchedFromUid():Process.myUid();
        admitted=saved==null&&NativeProtectedPreparationEntryPolicy.permits(
            Build.VERSION.SDK_INT,uid,Process.myUid(),cleanIntent(getIntent()));
        if(!admitted){finish();return;}
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
        TextView title=new TextView(this);title.setText(NativeManagerPreparationPresentation.title());layout.addView(title);
        TextView explanation=new TextView(this);explanation.setText(NativeManagerPreparationPresentation.explanation());layout.addView(explanation);
        message=new TextView(this);message.setText(NativeManagerPreparationPresentation.explanation());layout.addView(message);
        reloadRecoveryButton=new Button(this);reloadRecoveryButton.setText("Reload consumed recovery page; keep saved originals");layout.addView(reloadRecoveryButton);
        TextView reloadNote=new TextView(this);reloadNote.setText("Use only between completed browser recovery attempts, with no active exchange. This reloads the fixed app page, not this maintenance screen. It does not resend, clear a hold, or authenticate a manager. After it settles, close and reopen maintenance for the next explicit original-verification step.");layout.addView(reloadNote);
        workCheckButton=new Button(this);workCheckButton.setText(NativeManagerPreparationPresentation.prepareWorkButton());layout.addView(workCheckButton);
        baselineButton=new Button(this);baselineButton.setText(NativeManagerPreparationPresentation.baselineButton());layout.addView(baselineButton);
        retainButton=new Button(this);retainButton.setText(NativeManagerPreparationPresentation.retainFirstButton());layout.addView(retainButton);
        pieceRecoveryButton=new Button(this);pieceRecoveryButton.setText(NativeManagerPreparationPresentation.recoverOriginalPiecesButton());layout.addView(pieceRecoveryButton);
        custodyButton=new Button(this);custodyButton.setText(NativeManagerPreparationPresentation.retainSavedCustodyButton());layout.addView(custodyButton);
        nativeCustodyReadButton=new Button(this);nativeCustodyReadButton.setText(NativeManagerPreparationPresentation.readSavedCustodyButton());layout.addView(nativeCustodyReadButton);
        stageButton=new Button(this);stageButton.setText(NativeManagerPreparationPresentation.stageButton());layout.addView(stageButton);
        readButton=new Button(this);readButton.setText(NativeManagerPreparationPresentation.readButton());layout.addView(readButton);
        browserButton=new Button(this);browserButton.setText("Preserve original browser work locally");layout.addView(browserButton);
        writerHoldButton=new Button(this);writerHoldButton.setText("Hold original native writers; keep all records");layout.addView(writerHoldButton);
        holdStatusButton=new Button(this);holdStatusButton.setText("Read existing native hold status");layout.addView(holdStatusButton);
        heldVerificationButton=new Button(this);heldVerificationButton.setText("Verify saved original work under native hold");layout.addView(heldVerificationButton);
        inventoryIntentButton=new Button(this);inventoryIntentButton.setText("Retain original signed inventory request locally; no send");layout.addView(inventoryIntentButton);
        inventoryStatusButton=new Button(this);inventoryStatusButton.setText("Read existing inventory request and unknown status; no retention or send");layout.addView(inventoryStatusButton);
        inventoryRegistrationButton=new Button(this);inventoryRegistrationButton.setText("Register first original inventory request once; not ACK");layout.addView(inventoryRegistrationButton);
        inventoryServerStatusButton=new Button(this);inventoryServerStatusButton.setText("Read server registration status for existing original; no resend");layout.addView(inventoryServerStatusButton);
        inventoryManifestButton=new Button(this);inventoryManifestButton.setText("Publish remaining original inventory manifest; uncertain chunks use status only");layout.addView(inventoryManifestButton);
        inventoryDecisionButton=new Button(this);inventoryDecisionButton.setText("Read current manager decision for original inventory; no native ACK");layout.addView(inventoryDecisionButton);
        inventoryDecisionRetentionButton=new Button(this);inventoryDecisionRetentionButton.setText("Retain ORIGINAL manager decision locally; not native ACK");layout.addView(inventoryDecisionRetentionButton);
        finalizationReadButton=new Button(this);finalizationReadButton.setText("Read retained local finalization status; no repeat write");layout.addView(finalizationReadButton);
        finalizeEnrollmentButton=new Button(this);finalizeEnrollmentButton.setText("Separate original enrollment; keep all work and keys");layout.addView(finalizeEnrollmentButton);
        TextView inventoryRegistrationNote=new TextView(this);inventoryRegistrationNote.setText(
            "First creation only. A request previously retained by the local-only action cannot be sent here, even if no unknown marker is found; use existing status instead. "
            +"Registration is not inventory acceptance or acknowledgement. Its response is not saved locally; an interrupted outcome remains unknown and must not be resent.");layout.addView(inventoryRegistrationNote);
        Button close=new Button(this);close.setText("Close maintenance");layout.addView(close);
        workCheckButton.setOnClickListener(view->begin(Preparation.CHECK_ORIGINAL_WORK));
        baselineButton.setOnClickListener(view->begin(Preparation.INITIAL_BASELINE));
        retainButton.setOnClickListener(view->begin(Preparation.RETAIN_FIRST_ORIGINAL));
        pieceRecoveryButton.setOnClickListener(view->begin(Preparation.RECOVER_ORIGINAL_PIECES));
        custodyButton.setOnClickListener(view->begin(Preparation.RETAIN_SAVED_CUSTODY));
        nativeCustodyReadButton.setOnClickListener(view->begin(Preparation.READ_CURRENT_NATIVE_CUSTODY));
        stageButton.setOnClickListener(view->begin(Preparation.STAGE_ORIGINAL));
        readButton.setOnClickListener(view->begin(Preparation.READ_ORIGINAL));
        browserButton.setOnClickListener(view->begin(Preparation.READ_ORIGINAL_BROWSER));
        writerHoldButton.setOnClickListener(view->begin(Preparation.HOLD_ORIGINAL_WRITERS));
        holdStatusButton.setOnClickListener(view->begin(Preparation.READ_NATIVE_HOLD_STATUS));
        heldVerificationButton.setOnClickListener(view->begin(Preparation.VERIFY_HELD_ORIGINAL));
        inventoryIntentButton.setOnClickListener(view->begin(Preparation.RETAIN_HELD_INVENTORY_INTENT));
        inventoryStatusButton.setOnClickListener(view->begin(Preparation.READ_HELD_INVENTORY_STATUS));
        inventoryRegistrationButton.setOnClickListener(view->begin(Preparation.REGISTER_FIRST_HELD_INVENTORY_REQUEST));
        inventoryServerStatusButton.setOnClickListener(view->begin(Preparation.READ_HELD_INVENTORY_SERVER_STATUS));
        inventoryManifestButton.setOnClickListener(view->begin(Preparation.ADVANCE_HELD_INVENTORY_MANIFEST));
        inventoryDecisionButton.setOnClickListener(view->begin(Preparation.READ_HELD_INVENTORY_MANAGER_DECISION));
        inventoryDecisionRetentionButton.setOnClickListener(view->begin(Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION));
        finalizationReadButton.setOnClickListener(view->begin(Preparation.READ_LOCAL_FINALIZATION_STATUS));
        finalizeEnrollmentButton.setOnClickListener(view->confirmOriginalEnrollmentSeparation());
        close.setOnClickListener(view->finish());
        reloadRecoveryButton.setOnClickListener(view->begin(Preparation.RELOAD_CONSUMED_RECOVERY_DOCUMENT));
        // New FIRST controls must not push Close/readback off-screen on a
        // short display or with the operator's enlarged system font.
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.addView(layout);setContentView(scroll);
    }

    private static boolean cleanIntent(Intent value){
        try{return value!=null&&ACTION.equals(value.getAction())&&value.getData()==null
            &&value.getClipData()==null&&value.getSelector()==null
            &&(value.getExtras()==null||value.getExtras().isEmpty());}
        catch(RuntimeException invalid){return false;}
    }

    @Override protected void onResume(){
        super.onResume();synchronized(lifecycle){if(admitted&&!retired)foreground=true;}
    }
    @Override protected void onNewIntent(Intent value){super.onNewIntent(value);retire();finish();}
    @Override protected void onPause(){retire();super.onPause();}
    @Override protected void onDestroy(){retire();super.onDestroy();}

    private void requireCurrent()throws VaultFailure {
        synchronized(lifecycle){if(!admitted||!foreground||retired)throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");}
        control.check();
    }

    private void confirmOriginalEnrollmentSeparation(){
        synchronized(lifecycle){
            if(!admitted||!foreground||retired||controlClosed||worker!=null||control!=null
                ||finalizationAttempted||finalizationConfirmationOpen||!cleanIntent(getIntent()))return;
            finalizationConfirmationOpen=true;
        }
        new android.app.AlertDialog.Builder(this)
            .setTitle("Separate this original enrollment?")
            .setMessage("This is one local enrollment transition, not a work submission, key removal or phone release. "
                +"The existing original inventory, live holds and current manager approval must all verify independently. "
                +"All saved original work and encryption keys remain protected. If interrupted, use retained local finalization status; do not repeat the write.")
            .setNegativeButton("Cancel",(dialog,which)->{})
            .setPositiveButton("Separate; keep all work",(dialog,which)->{
                synchronized(lifecycle){finalizationConfirmationOpen=false;}
                begin(Preparation.SEPARATE_ENROLLMENT_KEEP_WORK);
            })
            .setOnDismissListener(dialog->{synchronized(lifecycle){finalizationConfirmationOpen=false;}})
            .show();
    }

    private void begin(Preparation preparation){
        synchronized(lifecycle){
            if(!admitted||!foreground||retired||controlClosed||worker!=null||finalizationConfirmationOpen||finalizationAttempted||nativeCustodyReadAttempted||!cleanIntent(getIntent())||reloadRecoveryAttempted||inventoryIntentAttempted||inventoryStatusAttempted||inventoryRegistrationAttempted||inventoryServerStatusAttempted||inventoryManifestAttempted||inventoryDecisionAttempted||inventoryDecisionRetentionAttempted
                ||finalizationReadAttempted||workCheckAttempted||baselineAttempted||retentionAttempted||pieceRecoveryAttempted||custodyAttempted||readAttempted||browserAttempted||writerHoldAttempted||holdStatusAttempted||heldVerificationAttempted||preparation==Preparation.INITIAL_BASELINE&&stageAttempted
                ||preparation==Preparation.RETAIN_FIRST_ORIGINAL&&stageAttempted
                ||preparation==Preparation.RECOVER_ORIGINAL_PIECES&&stageAttempted
                ||preparation==Preparation.RETAIN_SAVED_CUSTODY&&stageAttempted
                ||preparation==Preparation.CHECK_ORIGINAL_WORK&&stageAttempted
                ||preparation==Preparation.REGISTER_FIRST_HELD_INVENTORY_REQUEST&&stageAttempted
                ||preparation==Preparation.READ_HELD_INVENTORY_SERVER_STATUS&&stageAttempted
                ||preparation==Preparation.ADVANCE_HELD_INVENTORY_MANIFEST&&stageAttempted
                ||preparation==Preparation.READ_HELD_INVENTORY_MANAGER_DECISION&&stageAttempted
                ||preparation==Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION&&stageAttempted
                ||preparation==Preparation.STAGE_ORIGINAL&&stageAttempted||!FLIGHT.compareAndSet(false,true))return;
            if(preparation==Preparation.READ_LOCAL_FINALIZATION_STATUS)finalizationReadAttempted=true;
            else if(preparation==Preparation.SEPARATE_ENROLLMENT_KEEP_WORK)finalizationAttempted=true;
            else if(preparation==Preparation.RELOAD_CONSUMED_RECOVERY_DOCUMENT)reloadRecoveryAttempted=true;
            else if(preparation==Preparation.CHECK_ORIGINAL_WORK)workCheckAttempted=true;
            else if(preparation==Preparation.INITIAL_BASELINE)baselineAttempted=true;
            else if(preparation==Preparation.RETAIN_FIRST_ORIGINAL)retentionAttempted=true;
            else if(preparation==Preparation.RECOVER_ORIGINAL_PIECES)pieceRecoveryAttempted=true;
            else if(preparation==Preparation.RETAIN_SAVED_CUSTODY)custodyAttempted=true;
            else if(preparation==Preparation.READ_CURRENT_NATIVE_CUSTODY)nativeCustodyReadAttempted=true;
            else if(preparation==Preparation.STAGE_ORIGINAL)stageAttempted=true;
            else if(preparation==Preparation.HOLD_ORIGINAL_WRITERS)writerHoldAttempted=true;
            else if(preparation==Preparation.READ_NATIVE_HOLD_STATUS)holdStatusAttempted=true;
            else if(preparation==Preparation.VERIFY_HELD_ORIGINAL)heldVerificationAttempted=true;
            else if(preparation==Preparation.RETAIN_HELD_INVENTORY_INTENT)inventoryIntentAttempted=true;
            else if(preparation==Preparation.READ_HELD_INVENTORY_STATUS)inventoryStatusAttempted=true;
            else if(preparation==Preparation.REGISTER_FIRST_HELD_INVENTORY_REQUEST)inventoryRegistrationAttempted=true;
            else if(preparation==Preparation.READ_HELD_INVENTORY_SERVER_STATUS)inventoryServerStatusAttempted=true;
            else if(preparation==Preparation.ADVANCE_HELD_INVENTORY_MANIFEST)inventoryManifestAttempted=true;
            else if(preparation==Preparation.READ_HELD_INVENTORY_MANAGER_DECISION)inventoryDecisionAttempted=true;
            else if(preparation==Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION)inventoryDecisionRetentionAttempted=true;
            else if(preparation==Preparation.READ_ORIGINAL_BROWSER)browserAttempted=true;else readAttempted=true;
            workCheckButton.setEnabled(false);baselineButton.setEnabled(false);retainButton.setEnabled(false);pieceRecoveryButton.setEnabled(false);custodyButton.setEnabled(false);stageButton.setEnabled(false);readButton.setEnabled(false);browserButton.setEnabled(false);writerHoldButton.setEnabled(false);holdStatusButton.setEnabled(false);heldVerificationButton.setEnabled(false);
            nativeCustodyReadButton.setEnabled(false);
            inventoryIntentButton.setEnabled(false);inventoryStatusButton.setEnabled(false);inventoryRegistrationButton.setEnabled(false);inventoryServerStatusButton.setEnabled(false);inventoryManifestButton.setEnabled(false);
            inventoryDecisionButton.setEnabled(false);
            inventoryDecisionRetentionButton.setEnabled(false);
            reloadRecoveryButton.setEnabled(false);
            finalizationReadButton.setEnabled(false);
            finalizeEnrollmentButton.setEnabled(false);
            // No caller IDs, bodies, credentials or effect selector reaches Runtime.
            try{
                // Start the finite budget only after the first explicit action
                // wins admission and FLIGHT, not while the idle screen is read.
                // A later STAGE -> READ keeps this SAME control and deadline.
                if(control==null)control=new NativePrivateCustodyFrameReadControl();
                worker=new Thread(()->runOriginal(preparation),"CustodialOriginalPreparation");
                worker.start();
            }catch(RuntimeException|Error failed){
                // Construction/start failed before a worker could own IO.
                worker=null;retired=true;
                if(control!=null){control.close();controlClosed=true;}
                FLIGHT.set(false);
                message.setText(NativeManagerPreparationPresentation.held());
            }
        }
    }

    private void runOriginal(Preparation preparation){
        boolean successfulStage=false,settled=false;String text=preparation==Preparation.SEPARATE_ENROLLMENT_KEEP_WORK
            ?NativeManagerPreparationPresentation.enrollmentSeparationUnknown()
            :NativeManagerPreparationPresentation.held();
        try{
            requireCurrent();
            CustodialNativeRuntime runtime=preparation==Preparation.VERIFY_HELD_ORIGINAL||preparation==Preparation.RETAIN_HELD_INVENTORY_INTENT
                ?CustodialNativeRuntime.forProtectedHeldOriginalVerification(getApplicationContext(),control)
                :preparation==Preparation.RELOAD_CONSUMED_RECOVERY_DOCUMENT||preparation==Preparation.READ_NATIVE_HOLD_STATUS||preparation==Preparation.READ_HELD_INVENTORY_STATUS||preparation==Preparation.REGISTER_FIRST_HELD_INVENTORY_REQUEST||preparation==Preparation.READ_HELD_INVENTORY_SERVER_STATUS||preparation==Preparation.ADVANCE_HELD_INVENTORY_MANIFEST||preparation==Preparation.READ_HELD_INVENTORY_MANAGER_DECISION||preparation==Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION||preparation==Preparation.SEPARATE_ENROLLMENT_KEEP_WORK||preparation==Preparation.READ_LOCAL_FINALIZATION_STATUS
                ?CustodialNativeRuntime.existingForProtectedHeldRead(getApplicationContext())
                :CustodialNativeRuntime.get(getApplicationContext());
            requireCurrent();
            if(preparation==Preparation.RELOAD_CONSUMED_RECOVERY_DOCUMENT){
                runtime.reloadConsumedOriginalRecoveryDocument(control);requireCurrent();
                text="The fixed recovery app page reload was requested. This maintenance action did not clear saved originals or holds, issue a recovery request, or create manager/finalization authority. App-page startup and readiness are not confirmed here. Close and reopen maintenance; the next step must verify the same original under current authentication. If interrupted, do not assume the page is ready.";
            }else if(preparation==Preparation.CHECK_ORIGINAL_WORK){
                runtime.prepareOriginalWorkForCustody(control);requireCurrent();
                text=NativeManagerPreparationPresentation.originalWorkHeld();
            }else if(preparation==Preparation.INITIAL_BASELINE){
                // First-entry rejection metadata only. The owning Runtime
                // proves fixed authenticated WORK, all8 and absence before
                // installation. Never rebind an existing saved operation.
                runtime.establishInitialNativeMutationBaseline(control);requireCurrent();
                text=NativeManagerPreparationPresentation.baselineInstalled();
            }else if(preparation==Preparation.RETAIN_FIRST_ORIGINAL){
                JSONObject result=runtime.retainInitialOriginalPrivateCustody(control);requireCurrent();
                if(!"ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY".equals(result.get("state"))
                    ||!Boolean.TRUE.equals(result.get("local_operation_committed_observed")))
                    throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
                for(String flag:new String[]{"network_dispatch_allowed","writer_authority","durable_retention",
                    "current_server_readback","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard",
                    "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed",
                    "finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
                text=NativeManagerPreparationPresentation.firstOriginalRetained();
            }else if(preparation==Preparation.RECOVER_ORIGINAL_PIECES){
                // Explicit local recovery of present original journals only.
                // No HTTP, missing-record creation or automatic custody send.
                JSONObject result=runtime.resumeSavedOriginalNativePieceJournals(control);requireCurrent();
                text=NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(result);requireCurrent();
            }else if(preparation==Preparation.RETAIN_SAVED_CUSTODY){
                // Fixed original transport stage only. Do not hide a new
                // current read inside the producer's nearly spent deadline.
                JSONObject result=runtime.retainSavedOriginalNativeCustody(control);requireCurrent();
                text=NativeManagerPreparationPresentation.originalRequestsRetained(result);requireCurrent();
            }else if(preparation==Preparation.READ_CURRENT_NATIVE_CUSTODY){
                // This separately selected invocation receives its own normal
                // finite control, never a renewed producer or request time.
                JSONObject result=runtime.readSavedOriginalNativeCustody(control);requireCurrent();
                text=NativeManagerPreparationPresentation.currentOriginalCustodyObserved(result);requireCurrent();
            }else if(preparation==Preparation.ADVANCE_HELD_INVENTORY_MANIFEST){
                JSONObject result=runtime.advanceHeldOriginalInventoryManifest(control);requireCurrent();
                if(!"custodial.native-original-inventory-manifest-publication.v1".equals(result.get("schema")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                String state=result.getString("state");
                if("ONE_ORIGINAL_CHUNK_RECEIPT_DURABLY_OBSERVED_NOT_ACK".equals(state)){
                    int index=result.getInt("manifest_chunk_index"),count=result.getInt("manifest_chunk_count");
                    if(index<0||index>=count||count>512)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                    text="Original inventory chunk "+(index+1)+" of "+count+" has a saved exact server receipt. "
                        +"Reopen protected maintenance to continue; an uncertain existing request is checked by status only. No work or keys were removed; this is not inventory ACK.";
                }else if("ALL_ORIGINAL_CHUNK_RECEIPTS_LOCALLY_OBSERVED_NOT_ACK".equals(state))
                    text="All original manifest chunk receipts are saved locally. Current semantic manager review and private native ACK are still required. No work or keys were removed.";
                else throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            }else if(preparation==Preparation.SEPARATE_ENROLLMENT_KEEP_WORK){
                JSONObject result=runtime.separateHeldOriginalEnrollmentKeepingWork(control);requireCurrent();
                // DATA presentation is closed independently of the Engine's
                // private effect admission. A contradictory result must not
                // display local success or disclose original identities.
                text=NativeManagerPreparationPresentation.enrollmentSeparationObserved(result);
            }else if(preparation==Preparation.READ_LOCAL_FINALIZATION_STATUS){
                JSONObject result=runtime.inspectExistingOriginalEnrollmentFinalization(control);requireCurrent();
                if(result.length()!=11||!"custodial.native-original-enrollment-finalization-readback.v1".equals(result.get("schema")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                String state=result.getString("state");
                boolean present=!"NO_LOCAL_FINALIZATION_INTENT_OBSERVED_NO_WRITE_PERMISSION".equals(state);
                if(present&&!"ORIGINAL_SNAPSHOT_RETAINED_NO_REPEAT_WRITE".equals(state)
                    &&!"EXACT_SUCCESSOR_SNAPSHOT_PRESENT_WORK_STILL_HELD".equals(state))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String field:new String[]{"original_rows_compared","original_credential_readable","original_capsule_ciphertext_compared"})
                    if(!Boolean.valueOf(present).equals(result.get(field)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text=!present?"No local finalization intent was observed. This is not permission to repeat a write or create another operation."
                    :state.equals("ORIGINAL_SNAPSHOT_RETAINED_NO_REPEAT_WRITE")
                    ?"The exact original enrollment snapshot is still present. Retained native rows and original capsule bytes match, and the original credential remains locally readable. Do not repeat finalization; current authorization and the owning workflow remain separate."
                    :"The exact local successor snapshot is present and the other original native rows remain retained. Original capsule bytes match and the original credential is still locally readable. Work remains held; no ACK, retry, key removal or phone release is granted.";
            }else if(preparation==Preparation.READ_HELD_INVENTORY_MANAGER_DECISION||preparation==Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION){
                boolean retain=preparation==Preparation.RETAIN_HELD_INVENTORY_MANAGER_DECISION;
                JSONObject result=retain?runtime.retainHeldOriginalInventoryManagerDecisionObservation(control):
                    runtime.readHeldOriginalInventoryManagerDecisionStatus(control);requireCurrent();
                if(result.length()!=10||!"custodial.native-original-inventory-manager-decision-observation.v1".equals(result.get("schema"))
                    ||!(retain?"CURRENT_MANAGER_DECISION_ORIGINAL_LOCALLY_RETAINED_NOT_NATIVE_ACK":
                        "CURRENT_MANAGER_DECISION_OBSERVED_DATA_ONLY_NOT_NATIVE_ACK").equals(result.get("state"))
                    ||!Boolean.valueOf(retain).equals(result.get("local_response_persisted")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))
                        throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="A current server decision matching the existing original inventory and local manifest was observed. "
                    +"This is decision DATA only, not private native ACK or finalization. All original work and keys remain retained. "
                    +(retain?"The original response is retained in the existing encrypted journal; a saved observation never supplies current authority. ":
                        "The response was not persisted locally. ")
                    +"Missing, denied, expired or interrupted outcomes remain unknown; do not resend the original writer.";
            }else if(preparation==Preparation.READ_HELD_INVENTORY_SERVER_STATUS){
                JSONObject result=runtime.readHeldOriginalInventoryRegistrationStatus(control);
                requireCurrent();
                if(result.length()!=10||!"custodial.native-original-inventory-registration-status-observation.v1".equals(result.get("schema"))
                    ||!"ORIGINAL_REGISTRATION_OBSERVED_NOT_CURRENT_EFFECT_AUTHORITY".equals(result.get("state"))
                    ||!Boolean.FALSE.equals(result.get("local_response_persisted")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                JSONObject registration=result.getJSONObject("registration"),limits=registration.getJSONObject("limits");
                if(registration.length()!=11||limits.length()!=6
                    ||!"custodial.native-original-inventory-request-registration.v1".equals(registration.get("schema"))
                    ||!"REGISTERED_REQUEST_ONLY_NOT_ACK".equals(registration.get("state")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag))||!Boolean.FALSE.equals(limits.get(flag)))
                        throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="Historical registration of the exact original request was observed through a current authenticated server read. "
                    +"It is not an inventory ACK, acceptance or current effect authority, and does not authorize reuse, replay, finalization, key removal or phone release. "
                    +"This action creates no intent, request or unknown marker and does not resend registration. The response is not persisted locally. "
                    +"Missing, expired, denied or interrupted observations remain unproved or unknown; keep the original work and keys, with no blind resend or replacement request.";
                text+="\n\n"+NativeManagerPreparationPresentation.originalInventoryRequestReference(registration.get("native_request_id"));
            }else if(preparation==Preparation.REGISTER_FIRST_HELD_INVENTORY_REQUEST){
                JSONObject result=runtime.registerHeldOriginalInventoryRequest(control);
                requireCurrent();
                if(result.length()!=10||!"custodial.native-original-inventory-registration-observation.v1".equals(result.get("schema"))
                    ||!"ORIGINAL_REQUEST_REGISTERED_NOT_INVENTORY_ACK".equals(result.get("state"))
                    ||!Boolean.FALSE.equals(result.get("local_response_persisted")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                JSONObject registration=result.getJSONObject("registration"),limits=registration.getJSONObject("limits");
                if(registration.length()!=11||limits.length()!=6
                    ||!"custodial.native-original-inventory-request-registration.v1".equals(registration.get("schema"))
                    ||!"REGISTERED_REQUEST_ONLY_NOT_ACK".equals(registration.get("state")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag))||!Boolean.FALSE.equals(limits.get(flag)))
                        throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="The exact first original request was registered, not acknowledged or accepted as a complete inventory. "
                    +"This does not authorize reuse, replay, finalization, key removal or phone release. "
                    +"The response is not persisted locally; the original signed request and dispatch-unknown marker remain protected. "
                    +"If this response is lost or the action is interrupted, the outcome remains unknown and needs same-original status recovery, never a resend or replacement request.";
                text+="\n\n"+NativeManagerPreparationPresentation.originalInventoryRequestReference(registration.get("native_request_id"));
            }else if(preparation==Preparation.READ_HELD_INVENTORY_STATUS){
                JSONObject result=runtime.inspectHeldOriginalInventoryAckStatus(control);
                requireCurrent();
                if(!"custodial.native-original-inventory-ack-local-status.v1".equals(result.get("schema")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                String state=result.getString("state");
                boolean localAbsent="ORIGINAL_INTENT_ABSENT_UNPROVEN_NOT_SEND_AUTHORITY".equals(state)
                    ||"ORIGINAL_REQUEST_ABSENT_UNPROVEN_NOT_SEND_AUTHORITY".equals(state);
                boolean unknownObserved="EXISTING_DISPATCH_UNKNOWN_NOT_ACK".equals(state);
                if(!(localAbsent||unknownObserved||"ABSENT_UNPROVEN_NOT_SEND_AUTHORITY".equals(state))
                    ||result.length()!=(localAbsent?8:9))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                if(!localAbsent){
                    JSONObject observed=result.getJSONObject("observation");
                    if(observed.length()!=10||!"custodial.native-original-inventory-ack-dispatch-unknown-observation.v1".equals(observed.get("schema"))
                        ||!state.equals(observed.get("state")))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                    for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                        if(!Boolean.FALSE.equals(observed.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                }
                text=unknownObserved?"The exact original dispatch-unknown marker is retained. Its outcome remains unknown; do not resend.":
                    localAbsent?"The original local inventory intent or request was not found. Absence does not prove it was never sent or authorize a replacement.":
                    "The original signed inventory request is retained; no dispatch-unknown marker was found. Absence does not prove it was never sent or authorize sending.";
                text+=" This action only reads existing local records and current authenticated server observations; it creates or repairs no records and sends no inventory registration. All original work and keys remain protected. "
                    +"This is not an inventory acknowledgement, acceptance, finalization or phone release.";
            }else if(preparation==Preparation.RETAIN_HELD_INVENTORY_INTENT){
                // Local native request journal only. Read-only VERIFY retains its old
                // contract; this explicit action cannot accept or remove work.
                JSONObject result=runtime.retainHeldOriginalInventoryAckRequest(control);requireCurrent();
                if(!"custodial.native-original-inventory-ack-request-observation.v1".equals(result.get("schema"))
                    ||!"LOCAL_SIGNED_REQUEST_RETAINED_NOT_ACK".equals(result.get("state")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="Original signed inventory request retained locally. This action sends nothing; retention does not establish the outcome of an earlier dispatch. All original work and encryption keys remain protected. "
                    +"This is not an inventory acknowledgement, completed recovery, finalization or phone release. "
                    +"An interrupted result remains unknown: do not create or resend a replacement operation.";
            }else if(preparation==Preparation.VERIFY_HELD_ORIGINAL){
                // Explicit saved-original verification only. The existing Runtime
                // cannot initialize/recover here or substitute a browser capture.
                JSONObject result=runtime.reconstructHeldSavedOriginalBrowserPreparation(control);requireCurrent();
                if(result.length()!=13
                    ||!"custodial.native-held-original-reconstruction.v1".equals(result.get("schema"))
                    ||!"AUTHENTICATED_SAVED_ORIGINAL_CURRENT_READ_NOT_ACK".equals(result.get("state"))
                    ||!Boolean.TRUE.equals(result.get("original_data_authenticated"))
                    ||!(result.get("observation") instanceof JSONObject))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"transaction_authority","complete_namespace_inventory",
                    "all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted",
                    "replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                requireCurrent();
                text="Saved original data verified under the existing native hold. Unresolved work remains retained. "
                    +"This is not complete inventory verification or manager approval. "
                    +"No acknowledgement, finalization, phone release or new enrollment is authorized.";
            }else if(preparation==Preparation.READ_NATIVE_HOLD_STATUS){
                // Existing installed hold metadata only: no original verification,
                // manager authentication, bootstrap, new operation or retry.
                JSONObject result=runtime.observeSavedOriginalNativeWriterHold(control);requireCurrent();
                // The Android JSONObject API has no keySet(). Exact length plus
                // every required typed field also rejects foreign fields.
                if(result.length()!=11
                    ||!"custodial.native-existing-writer-hold-observation.v1".equals(result.get("schema"))
                    ||!"EXISTING_NATIVE_HOLD_OBSERVED_NOT_ORIGINAL_VERIFIED".equals(result.get("state"))
                    ||!Boolean.TRUE.equals(result.get("native_writer_hold_observed")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"original_inventory_verified","transaction_authority","inventory_acknowledged",
                    "work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="Existing native hold observed. Saved original verification remains pending. "
                    +"No acknowledgement, finalization, phone release or new enrollment is authorized.";
            }else if(preparation==Preparation.HOLD_ORIGINAL_WRITERS){
                JSONObject result=runtime.holdSavedOriginalNativeWriters(control);requireCurrent();
                if(!"custodial.native-original-writer-hold-observation.v1".equals(result.get("schema"))
                    ||!"ORIGINAL_NATIVE_WRITERS_HELD_NOT_ACK".equals(result.get("state"))
                    ||!Boolean.TRUE.equals(result.get("native_writer_hold_observed")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"transaction_authority","inventory_acknowledged","work_accepted",
                    "replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text="Original native writers are held. All original records and encryption keys remain retained. "
                    +"No work acknowledgement, finalization, phone release or new enrollment is authorized. "
                    +"If the result was interrupted, retain this original operation for exact recovery; do not start another.";
            }else if(preparation==Preparation.READ_ORIGINAL_BROWSER){
                JSONObject result=runtime.preserveSavedOriginalBrowserPreparation(control);requireCurrent();
                boolean restored="CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY".equals(result.get("state"));
                if(!"custodial.native-current-original-browser-preparation.v3".equals(result.get("schema"))
                    ||!restored&&!"CURRENT_MANAGER_AND_LOCAL_BROWSER_CUSTODY_OBSERVED_NOT_ACK".equals(result.get("state")))
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                for(String flag:new String[]{"manager_approval","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                // Counts only from the SAME still-live original native read.
                // Neither browser claims nor this screen can authorize removal.
                JSONObject manager=result.getJSONObject("manager_preparation_observation");
                if(!Boolean.FALSE.equals(manager.get("transaction_authority")))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                text=NativeManagerPreparationPresentation.observed(manager.getString("observed_at"),manager.getString("current_until"));
                if(restored){
                    JSONObject saved=result.getJSONObject("original_browser_local_custody");
                    Object count=saved.get("record_count");
                    if(!"custodial.native-original-browser-saved-data.v1".equals(saved.get("schema"))
                        ||!"SAVED_ORIGINAL_TYPED_DATA_RESTORED_NOT_CURRENT_BROWSER_AUTHORITY".equals(saved.get("state"))
                        ||!Boolean.FALSE.equals(result.get("current_browser_source_authenticated"))
                        ||!Boolean.TRUE.equals(saved.get("existing_shared_key_retained"))
                        ||!(count instanceof Integer)||((Integer)count)<0||((Integer)count)>4096)
                        throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                    for(String flag:new String[]{"current_browser_source_authenticated","all_writer_durable_freeze_or_ABA_guard",
                        "inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})
                        if(!Boolean.FALSE.equals(saved.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                    text+="\n\nSaved browser original rows read from the existing encrypted journal: "+count
                        +". No fresh browser capture was substituted. Current browser authority and completeness remain unproved; "
                        +"this does not authorize acceptance or finalization.";
                }else{
                    text+="\n\nOriginal browser work was locally encrypted, read back and rechecked. This is not remote acceptance; no finalization is authorized.\n\n"
                        +NativeManagerInventoryPresentation.completionSummary(result.getJSONObject("original_native_completion_observation"));
                }
                text+="\n\n"+NativeManagerInventoryPresentation.currentCompletionReadSummary(result.getJSONObject("current_original_completion_read_observation"));
            }else{
            boolean stage=preparation==Preparation.STAGE_ORIGINAL;
            JSONObject result=stage?runtime.sendSavedOriginalRecoveryChallenge(control):runtime.readCurrentSavedOriginalManagerPreparation(control);
            requireCurrent();
            for(String flag:new String[]{"manager_approval","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
            if(stage){
                if(!Boolean.TRUE.equals(result.get("native_receipt_metadata_validated")))throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
                text=NativeManagerPreparationPresentation.staged(result.getJSONObject("native_receipt").getString("challenge_id"));successfulStage=true;
            }else{
                if(!"custodial.native-current-manager-preparation-observation.v1".equals(result.get("schema"))
                    ||!"CURRENT_ORIGINAL_MANAGER_PREPARATION_OBSERVED_NOT_EFFECT_AUTHORITY".equals(result.get("state")))
                    throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
                JSONObject observed=result.getJSONObject("manager_preparation_observation");
                if(!Boolean.FALSE.equals(observed.get("transaction_authority")))throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
                text=NativeManagerPreparationPresentation.observed(observed.getString("observed_at"),observed.getString("current_until"));
                // The owning Engine has already checked this SAME original
                // all8 capture before and after the manager-purpose read.
                // Display counts only; this cannot mint an inventory ACK.
                text+="\n\n"+NativeManagerInventoryPresentation.summary(result.getJSONObject("original_native_inventory_observation"));
                // Same owning read, not caller-selected completion arguments.
                // The renderer exposes only retained/matched/unresolved counts;
                // these local dispositions cannot authorize acceptance or removal.
                text+="\n\n"+NativeManagerInventoryPresentation.completionSummary(
                    result.getJSONObject("original_native_completion_observation"));
            }
            }
            requireCurrent();
        }catch(Exception refused){successfulStage=false;text=preparation==Preparation.SEPARATE_ENROLLMENT_KEEP_WORK
            ?NativeManagerPreparationPresentation.enrollmentSeparationUnknown()
            :NativeManagerPreparationPresentation.held();}
        finally{
            // Runtime has settled its exact HTTP/owners before returning here.
            // Only a successful stage may retain the SAME finite control while
            // the manager confirms on the website. No renewal or background retry.
            boolean close;synchronized(lifecycle){
                close=retired||!successfulStage;
                // Stage HTTP/owners have already settled. An onPause racing
                // this transfer sees no worker and closes the idle control.
                if(!close)worker=null;
            }
            try{if(close)control.close();settled=true;}
            catch(RuntimeException|Error uncertain){text=NativeManagerPreparationPresentation.held();}
            if(settled){
                synchronized(lifecycle){worker=null;if(close)controlClosed=true;}
                FLIGHT.set(false);
            }
        }
        final String displayed=text;final boolean allowRead=successfulStage&&settled;
        runOnUiThread(()->{
            synchronized(lifecycle){
                if(!admitted||!foreground||retired||isFinishing())return;
                message.setText(displayed);workCheckButton.setEnabled(false);baselineButton.setEnabled(false);retainButton.setEnabled(false);pieceRecoveryButton.setEnabled(false);custodyButton.setEnabled(false);stageButton.setEnabled(false);readButton.setEnabled(allowRead&&!readAttempted);browserButton.setEnabled(allowRead&&!browserAttempted);holdStatusButton.setEnabled(false);heldVerificationButton.setEnabled(false);
                inventoryIntentButton.setEnabled(false);inventoryStatusButton.setEnabled(false);inventoryRegistrationButton.setEnabled(false);inventoryServerStatusButton.setEnabled(false);
                inventoryDecisionButton.setEnabled(false);inventoryManifestButton.setEnabled(false);
                inventoryDecisionRetentionButton.setEnabled(false);
                reloadRecoveryButton.setEnabled(false);
                finalizeEnrollmentButton.setEnabled(false);
            }
        });
    }

    private void retire(){
        Thread active;
        NativePrivateCustodyFrameReadControl original;
        synchronized(lifecycle){retired=true;foreground=false;active=worker;original=control;}
        // ALL actions retain sticky cancellation, even when a platform await
        // consumes the worker's interrupt. Never disconnect/join platform IO
        // from this UI callback or declare its original piece settled here.
        if(original!=null)original.requestCancellation();
        // Signal only, not forced termination or proof of IO settlement. Never
        // disconnect platform IO on the UI thread. Worker finally owns closure.
        if(active!=null)active.interrupt();
        else if(original!=null){original.close();synchronized(lifecycle){controlClosed=true;}}
        if(workCheckButton!=null)workCheckButton.setEnabled(false);
        if(baselineButton!=null)baselineButton.setEnabled(false);
        if(retainButton!=null)retainButton.setEnabled(false);
        if(pieceRecoveryButton!=null)pieceRecoveryButton.setEnabled(false);
        if(custodyButton!=null)custodyButton.setEnabled(false);
        if(stageButton!=null)stageButton.setEnabled(false);if(readButton!=null)readButton.setEnabled(false);
        if(browserButton!=null)browserButton.setEnabled(false);
        if(writerHoldButton!=null)writerHoldButton.setEnabled(false);
        if(holdStatusButton!=null)holdStatusButton.setEnabled(false);
        if(heldVerificationButton!=null)heldVerificationButton.setEnabled(false);
        if(inventoryStatusButton!=null)inventoryStatusButton.setEnabled(false);
        if(inventoryRegistrationButton!=null)inventoryRegistrationButton.setEnabled(false);
        if(inventoryServerStatusButton!=null)inventoryServerStatusButton.setEnabled(false);
        if(inventoryDecisionButton!=null)inventoryDecisionButton.setEnabled(false);
        if(inventoryDecisionRetentionButton!=null)inventoryDecisionRetentionButton.setEnabled(false);
        if(inventoryManifestButton!=null)inventoryManifestButton.setEnabled(false);
        if(reloadRecoveryButton!=null)reloadRecoveryButton.setEnabled(false);
        if(finalizationReadButton!=null)finalizationReadButton.setEnabled(false);
        if(finalizeEnrollmentButton!=null)finalizeEnrollmentButton.setEnabled(false);
        if(message!=null)message.setText(NativeManagerPreparationPresentation.closed());
    }
}
