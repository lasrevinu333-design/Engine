package org.memphiszoo.custodial.vault;

import org.json.JSONObject;

/** Focused presentation/source-result checks. Result cases use synthetic JSON
 * with the actual shipping method, not Android/auth/native-effect proof. */
final class NativeManagerPreparationPresentationTest {
    private static int checks;
    private static final String ID = "98000000-0000-4000-8000-000000000009";
    private static final String AT = "2026-10-14T12:00:00.000001Z";
    private static final String UNTIL = "2026-10-14T12:00:00.000002Z";

    public static void main(String[] args) {
        if(args.length==1&&"--retention-read-boundary-only".equals(args[0])){
            try{retentionReadBoundary();}
            catch(Exception failure){throw new AssertionError("Retention/read boundary fixture failed",failure);}
            System.out.println("RETENTION_READ_BOUNDARY_PRESENTATION_ONLY_PASS checks="+checks+" Android=false auth=false IO=false effects=false");
            return;
        }
        if(args.length==1&&"--inventory-request-reference-only".equals(args[0])){
            inventoryRequestReferenceRendered();
            inventoryRequestReferenceRefused();
            System.out.println("INVENTORY_REQUEST_REFERENCE_PRESENTATION_ONLY_PASS groups=2 checks="+checks
                +" Android=false auth=false IO=false effects=false");
            return;
        }
        if(args.length==1&&"--enrollment-separation-result-only".equals(args[0])){
            try{enrollmentSeparationResult();}
            catch(Exception failure){throw new AssertionError("Enrollment separation result fixture failed",failure);}
            System.out.println("ENROLLMENT_SEPARATION_RESULT_ONLY_PASS groups=1 checks="+checks
                +" syntheticData=true Android=false auth=false IO=false effects=false");
            return;
        }
        if(args.length==1&&"--browser-journal-result-only".equals(args[0])){
            try{
                browserJournalStatesRendered();
                browserJournalVersionBoundary();
                browserJournalClosedShapes();
                browserJournalPrimitiveTypes();
                browserJournalEffectsRefused();
                browserJournalContradictionsRefused();
                browserJournalDigestPrivate();
            }catch(Exception failure){throw new AssertionError("Browser journal result fixture failed",failure);}
            System.out.println("BROWSER_JOURNAL_RESULT_ONLY_PASS groups=7 checks="+checks
                +" Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--piece-local-result-only".equals(args[0])) {
            try {
                localPieceResultAccepted();
                localPieceResultShapeRefused();
                localPieceResultEffectsRefused();
                localPieceResultCountsRefused();
            } catch (Exception failure) {
                throw new AssertionError("Local result fixture failed", failure);
            }
            System.out.println("PIECE_LOCAL_RESULT_ONLY_PASS groups=4 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--piece-local-recovery-presentation-only".equals(args[0])) {
            localPieceRecoveryButtonWording();
            localPieceRecoveryResultWording();
            System.out.println("PIECE_LOCAL_RECOVERY_PRESENTATION_ONLY_PASS groups=2 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--first-original-custody-presentation-only".equals(args[0])) {
            initialCustodyButtonWording();
            originalCustodyObservationWording();
            System.out.println("FIRST_ORIGINAL_CUSTODY_PRESENTATION_ONLY_PASS groups=2 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--first-original-retention-presentation-only".equals(args[0])) {
            retainFirstButtonWording();
            firstOriginalRetainedWording();
            System.out.println("FIRST_ORIGINAL_RETENTION_PRESENTATION_ONLY_PASS groups=2 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--initial-baseline-presentation-only".equals(args[0])) {
            baselineButtonWording();
            baselineInstalledWording();
            System.out.println("INITIAL_BASELINE_PRESENTATION_ONLY_PASS groups=2 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length == 1 && "--held-unknown-outcome-only".equals(args[0])) {
            heldUnknownOutcomeWording();
            System.out.println("HELD_UNKNOWN_OUTCOME_PRESENTATION_ONLY_PASS groups=1 checks=" + checks
                + " Android=false auth=false IO=false effects=false");
            return;
        }
        if (args.length != 1 || !"--presentation-only".equals(args[0]))
            throw new IllegalArgumentException("Explicit presentation-only selector required");
        wording();
        snapshots();
        uuids();
        ordering();
        calendar();
        malformed();
        System.out.println("PRESENTATION_ONLY_PASS groups=6 checks=" + checks
            + " Android=false auth=false IO=false effects=false");
    }

    private static void inventoryRequestReferenceRendered() {
        for(String id:new String[]{ID,"abcdef01-2345-1234-9abc-abcdef012345","abcdef01-2345-5234-babc-abcdef012345"}){
            String text=NativeManagerPreparationPresentation.originalInventoryRequestReference(id);
            check(text.startsWith("Original inventory request UUID: "+id+"\n"));
            check(text.indexOf(id)==text.lastIndexOf(id));
            check(text.contains("existing manager inventory-review panel's Original native request UUID field"));
            check(text.contains("not the earlier preparation challenge UUID"));
            check(text.contains("reference alone is not manager confirmation or native ACK"));
            check(text.contains("does not authorize work acceptance, replay, finalization, key removal or phone release"));
            check(!text.contains("registered")&&!text.contains("ready")&&!text.contains("http")&&!text.contains("credential"));
            check(text.equals(NativeManagerPreparationPresentation.originalInventoryRequestReference(id)));
        }
    }

    private static void inventoryRequestReferenceRefused() {
        for(Object value:new Object[]{null,JSONObject.NULL,"",ID.substring(1),ID+"0"," "+ID,ID+" ",ID+"\n",
            ID.substring(0,35)+"\n",ID.replace("-",""),"ABCDEF01-2345-1234-9ABC-ABCDEF012345",
            ID.replace("-4000-","-0000-"),ID.replace("-4000-","-6000-"),ID.replace("-8000-","-7000-"),
            ID.substring(0,35)+Character.toString((char)0xd800),ID.substring(0,35)+"\u0661","x".repeat(1000),
            Boolean.TRUE,Integer.valueOf(1),new JSONObject(),
            new Object(){@Override public String toString(){return ID;}}}){
            String[] rendered={null};
            refused(()->rendered[0]=NativeManagerPreparationPresentation.originalInventoryRequestReference(value));
            check(rendered[0]==null);
        }
    }

    // Synthetic Engine-shaped DATA only; no control, ACK or manager is minted.
    private static JSONObject enrollmentSeparation(String original,String observed)throws Exception{
        return new JSONObject()
            .put("schema","custodial.native-original-enrollment-successor-observation.v1")
            .put("state","ORIGINAL_SUCCESSOR_OBSERVED_ALL_WORK_RETAINED_NOT_RELEASED")
            .put("original_operation_id",ID)
            .put("original_generation_id","abcdef01-2345-1234-9abc-abcdef012345")
            .put("original_vault_revision",original).put("observed_vault_revision",observed)
            .put("all_original_work_retained",true).put("inventory_acknowledged",true)
            .put("work_accepted",false).put("replay_allowed",false).put("finalizer_allowed",false)
            .put("key_removal",false).put("phone_released",false);
    }

    private static String separationRendered(JSONObject value)throws Exception{
        String before=value.toString();
        String text=NativeManagerPreparationPresentation.enrollmentSeparationObserved(value);
        check(before.equals(value.toString()));
        check(text.contains("exact local enrollment successor was observed"));
        check(text.contains("All original work, history and encryption keys remain retained and held"));
        check(text.contains("does not accept or resend work, permit replay or repeat finalization, remove keys or release the phone"));
        check(text.contains("retained local finalization status only; do not repeat separation"));
        check(!text.contains((String)value.get("original_operation_id")));
        check(!text.contains((String)value.get("original_generation_id")));
        check(!text.contains("revision")&&!text.contains("credential")&&!text.contains("ready"));
        return text;
    }

    private static void separationRefused(JSONObject value)throws Exception{
        String before=value==null?null:value.toString(),text=null;
        checks++;
        try{text=NativeManagerPreparationPresentation.enrollmentSeparationObserved(value);}
        catch(VaultFailure expected){
            check("custodial_original_browser_preparation_unavailable".equals(expected.code));
            check(text==null);
            check(value==null||before.equals(value.toString()));
            return;
        }
        throw new AssertionError("Malformed separation result returned success at check "+checks);
    }

    private static void enrollmentSeparationResult()throws Exception{
        String fixed=separationRendered(enrollmentSeparation("0","1"));
        check(fixed.equals(separationRendered(enrollmentSeparation("9","10"))));
        check(fixed.equals(separationRendered(enrollmentSeparation("9223372036854775806","9223372036854775807"))));
        separationRendered(enrollmentSeparation("0","1")
            .put("original_operation_id","abcdef01-2345-5234-babc-abcdef012345"));
        separationRefused(null);
        check(enrollmentSeparation("0","1").length()==13);
        java.util.List<String> fields=new java.util.ArrayList<>();
        for(var keys=enrollmentSeparation("0","1").keys();keys.hasNext();)fields.add(keys.next());
        for(String field:fields){
            JSONObject missing=enrollmentSeparation("0","1");missing.remove(field);separationRefused(missing);
            JSONObject replaced=enrollmentSeparation("0","1");replaced.remove(field);replaced.put("foreign",false);separationRefused(replaced);
            separationRefused(enrollmentSeparation("0","1").put(field,JSONObject.NULL));
        }
        separationRefused(enrollmentSeparation("0","1").put("secret","DO_NOT_DISPLAY"));
        for(String field:new String[]{"schema","state"}){
            for(Object invalid:new Object[]{"OTHER",Boolean.TRUE,Integer.valueOf(1),new JSONObject()})
                separationRefused(enrollmentSeparation("0","1").put(field,invalid));
        }
        for(String field:new String[]{"all_original_work_retained","inventory_acknowledged"}){
            for(Object invalid:new Object[]{Boolean.FALSE,"true",Integer.valueOf(1),new JSONObject()})
                separationRefused(enrollmentSeparation("0","1").put(field,invalid));
        }
        for(String field:new String[]{"work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"}){
            for(Object invalid:new Object[]{Boolean.TRUE,"false",Integer.valueOf(0),new JSONObject()})
                separationRefused(enrollmentSeparation("0","1").put(field,invalid));
        }
        for(String field:new String[]{"original_operation_id","original_generation_id"}){
            for(Object invalid:new Object[]{"","ABCDEF01-2345-1234-9ABC-ABCDEF012345"," "+ID,ID+"\n",
                ID.replace("-4000-","-0000-"),ID.replace("-4000-","-6000-"),
                ID.replace("-8000-","-7000-"),ID.replace("-",""),"x".repeat(1000),
                ID.substring(0,35)+Character.toString((char)0xd800),Integer.valueOf(0),Boolean.TRUE,new JSONObject()})
                separationRefused(enrollmentSeparation("0","1").put(field,invalid));
        }
        for(String field:new String[]{"original_vault_revision","observed_vault_revision"}){
            for(Object invalid:new Object[]{"","00","01","+1","-0","-1"," 1","1 ","1\n","1.0","1e0",
                "\u0661","9223372036854775808","18446744073709551615","1".repeat(1000),
                Character.toString((char)0xd800),Integer.valueOf(0),Long.valueOf(1),Double.valueOf(1),Boolean.FALSE,new JSONObject()})
                separationRefused(enrollmentSeparation("0","1").put(field,invalid));
        }
        for(String[] pair:new String[][]{{"0","0"},{"1","0"},{"0","2"},{"10","9"},
            {"9223372036854775805","9223372036854775807"},
            {"9223372036854775807","9223372036854775807"},{"9223372036854775807","0"}})
            separationRefused(enrollmentSeparation(pair[0],pair[1]));
        String unknown=NativeManagerPreparationPresentation.enrollmentSeparationUnknown();
        check(unknown.contains("outcome is unconfirmed"));
        check(unknown.contains("Preserve all original work and keys"));
        check(unknown.contains("retained local finalization status only"));
        check(unknown.contains("Do not repeat separation or retry a write"));
        check(unknown.contains("No work acceptance, resend, replay, repeat finalization, key removal or phone release is authorized"));
        check(!unknown.contains(ID)&&!unknown.contains("ready")&&!unknown.contains("successor was observed"));
        check(unknown.equals(NativeManagerPreparationPresentation.enrollmentSeparationUnknown()));
    }

    private static final String[] BROWSER_STATES={"NO_SAVED_BROWSER_FRAME_OBSERVED","ORPHAN_BROWSER_PARTS_RETAINED",
        "INCOMPLETE_BROWSER_ORIGINAL_PARTS_RETAINED","EXISTING_BROWSER_PARTS_LOCALLY_RECOVERED_NOT_REMOTE_ACK"};
    private static final String LOCAL_DIGEST="abcdef0123456789".repeat(4);

    private static String[] browserJournalFlags(){
        return new String[]{"missing_records_created","network_dispatch_allowed","current_remote_browser_custody",
            "inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"};
    }

    private static JSONObject browserJournal(int state)throws Exception{
        JSONObject result=new JSONObject().put("schema","custodial.native-original-browser-local-journal-resume.v1")
            .put("state",BROWSER_STATES[state]).put("existing_records_observed",new int[]{0,2,2,3}[state])
            .put("pending_or_alias_records_recovered",state<2?0:1)
            .put("declared_chunk_count",state<2?JSONObject.NULL:Integer.valueOf(2))
            .put("missing_chunk_count",state<2?JSONObject.NULL:Integer.valueOf(state==2?1:0))
            .put("all_original_browser_parts_committed_observed",state==3)
            .put("current_local_part_set_sha256",state==3?LOCAL_DIGEST:"");
        for(String flag:browserJournalFlags())result.put(flag,false);
        return result;
    }

    private static JSONObject browserResult(JSONObject browser)throws Exception{
        return localPieceResult(7,3).put("schema","custodial.native-saved-original-piece-journal-resume.v2")
            .put("browser_local_journal",browser);
    }

    private static void browserRefused(JSONObject browser)throws Exception{
        localPieceResultRefused(browserResult(browser));
    }

    private static String browserRendered(JSONObject browser)throws Exception{
        JSONObject result=browserResult(browser);String before=result.toString();
        String text=NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(result);
        check(before.equals(result.toString()));
        check(text.startsWith("Native original piece journals:\n"));
        check(text.contains("Browser original local journal:\n"));
        check(text.contains("Existing records observed: 7\nPending/alias records recovered: 3"));
        check(text.contains("No network dispatch, current server custody, inventory ACK, new work acceptance, finalization, key removal, or phone release is authorized."));
        check(!text.contains(LOCAL_DIGEST));
        return text;
    }

    private static void browserJournalStatesRendered()throws Exception{
        check(browserRendered(browserJournal(0)).contains("UNKNOWN, not empty"));
        check(browserRendered(browserJournal(1)).contains("recovery is incomplete"));
        check(browserRendered(browserJournal(2)).contains("Not all original browser parts were recovered"));
        check(browserRendered(browserJournal(3)).contains("LOCALLY ONLY"));
        for(int declared:new int[]{1,64}){
            JSONObject complete=browserJournal(3).put("declared_chunk_count",declared)
                .put("existing_records_observed",1+declared).put("pending_or_alias_records_recovered",1+declared);
            check(browserRendered(complete).contains("not server custody or remote ACK"));
            for(int missing:new int[]{1,declared}){
                int observed=1+declared-missing;
                browserRendered(browserJournal(2).put("declared_chunk_count",declared).put("missing_chunk_count",missing)
                    .put("existing_records_observed",observed).put("pending_or_alias_records_recovered",observed));
            }
        }
        for(int observed:new int[]{1,64})browserRendered(browserJournal(1).put("existing_records_observed",observed));
    }

    private static void browserJournalVersionBoundary()throws Exception{
        JSONObject v1=localPieceResult(7,3);
        check(NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(v1).equals(
            NativeManagerPreparationPresentation.originalPiecesLocallyRecovered()+"\n\nExisting records observed: 7\nPending/alias records recovered: 3"));
        localPieceResultRefused(localPieceResult(7,3).put("browser_local_journal",browserJournal(3)));
        localPieceResultRefused(localPieceResult(7,3).put("schema","custodial.native-saved-original-piece-journal-resume.v2"));
        localPieceResultRefused(browserResult(browserJournal(3)).put("schema","custodial.native-saved-original-piece-journal-resume.v3"));
        for(Object invalid:new Object[]{JSONObject.NULL,"not a journal",Integer.valueOf(0),Boolean.FALSE})
            localPieceResultRefused(browserResult(browserJournal(3)).put("browser_local_journal",invalid));
        localPieceResultRefused(browserResult(browserJournal(3)).put("extra",false));
    }

    private static void browserJournalClosedShapes()throws Exception{
        for(int state=0;state<4;state++){
            java.util.List<String> fields=new java.util.ArrayList<>();
            for(var keys=browserJournal(state).keys();keys.hasNext();)fields.add(keys.next());
            check(fields.size()==16);
            for(String field:fields){
                JSONObject missing=browserJournal(state);missing.remove(field);browserRefused(missing);
                JSONObject replaced=browserJournal(state);replaced.remove(field);replaced.put("foreign",false);browserRefused(replaced);
            }
            browserRefused(browserJournal(state).put("extra",false));
            browserRefused(browserJournal(state).put("schema","other"));
            browserRefused(browserJournal(state).put("state","UNRECOGNIZED"));
        }
        java.util.List<String> outer=new java.util.ArrayList<>();
        for(var keys=browserResult(browserJournal(3)).keys();keys.hasNext();)outer.add(keys.next());
        check(outer.size()==14);
        for(String field:outer){JSONObject missing=browserResult(browserJournal(3));missing.remove(field);localPieceResultRefused(missing);}
    }

    private static void browserJournalPrimitiveTypes()throws Exception{
        Object[] nonIntegers={"0",Long.valueOf(0),Double.valueOf(0),Boolean.FALSE,JSONObject.NULL};
        for(int state=0;state<4;state++){
            for(String field:new String[]{"existing_records_observed","pending_or_alias_records_recovered"})
                for(Object invalid:nonIntegers)browserRefused(browserJournal(state).put(field,invalid));
            for(Object invalid:new Object[]{"false",Integer.valueOf(0),JSONObject.NULL})
                browserRefused(browserJournal(state).put("all_original_browser_parts_committed_observed",invalid));
            if(state>=2)for(String field:new String[]{"declared_chunk_count","missing_chunk_count"})
                for(Object invalid:nonIntegers)browserRefused(browserJournal(state).put(field,invalid));
            else for(String field:new String[]{"declared_chunk_count","missing_chunk_count"})
                browserRefused(browserJournal(state).put(field,0));
        }
        for(String field:new String[]{"existing_records_observed","pending_or_alias_records_recovered"})
            for(Object invalid:nonIntegers)localPieceResultRefused(browserResult(browserJournal(3)).put(field,invalid));
    }

    private static void browserJournalEffectsRefused()throws Exception{
        for(int state=0;state<4;state++)for(String flag:browserJournalFlags())
            for(Object invalid:new Object[]{Boolean.TRUE,"false",JSONObject.NULL,Integer.valueOf(0)})
                browserRefused(browserJournal(state).put(flag,invalid));
        for(String flag:localPieceResultFlags())localPieceResultRefused(browserResult(browserJournal(3)).put(flag,true));
    }

    private static void browserJournalContradictionsRefused()throws Exception{
        for(int state=0;state<4;state++){
            for(int invalid:new int[]{-1,66,Integer.MAX_VALUE})browserRefused(browserJournal(state).put("existing_records_observed",invalid));
            for(int invalid:new int[]{-1,66,Integer.MAX_VALUE})browserRefused(browserJournal(state).put("pending_or_alias_records_recovered",invalid));
            browserRefused(browserJournal(state).put("all_original_browser_parts_committed_observed",state!=3));
        }
        browserRefused(browserJournal(0).put("existing_records_observed",1));
        browserRefused(browserJournal(0).put("pending_or_alias_records_recovered",1));
        browserRefused(browserJournal(1).put("existing_records_observed",0));
        browserRefused(browserJournal(1).put("existing_records_observed",65));
        browserRefused(browserJournal(1).put("pending_or_alias_records_recovered",1));
        for(int state:new int[]{2,3}){
            for(int invalid:new int[]{-1,0,65,Integer.MAX_VALUE})browserRefused(browserJournal(state).put("declared_chunk_count",invalid));
            browserRefused(browserJournal(state).put("existing_records_observed",1));
            browserRefused(browserJournal(state).put("pending_or_alias_records_recovered",4));
        }
        for(int invalid:new int[]{-1,0,3,Integer.MAX_VALUE})browserRefused(browserJournal(2).put("missing_chunk_count",invalid));
        for(int invalid:new int[]{-1,1,2,Integer.MAX_VALUE})browserRefused(browserJournal(3).put("missing_chunk_count",invalid));
        localPieceResultRefused(browserResult(browserJournal(3)).put("pending_or_alias_records_recovered",8));
    }

    private static void browserJournalDigestPrivate()throws Exception{
        for(int state=0;state<3;state++)browserRefused(browserJournal(state).put("current_local_part_set_sha256",LOCAL_DIGEST));
        for(Object invalid:new Object[]{JSONObject.NULL,Boolean.FALSE,Integer.valueOf(0),"",LOCAL_DIGEST.toUpperCase(),
            "a".repeat(63),"a".repeat(65),"g".repeat(64),LOCAL_DIGEST+"\n"})
            browserRefused(browserJournal(3).put("current_local_part_set_sha256",invalid));
        String text=browserRendered(browserJournal(3));
        check(!text.contains("sha256"));check(!text.contains("operation_id"));
    }

    private static void check(boolean value) {
        checks++;
        if (!value) throw new AssertionError("Presentation check " + checks);
    }

    private static String[] localPieceResultFlags() {
        return new String[]{"missing_records_created","network_dispatch_allowed",
            "remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted",
            "resend_allowed","finalizer_allowed","key_removal","phone_released"};
    }

    private static JSONObject localPieceResult(int observed,int recovered)throws Exception {
        JSONObject result=new JSONObject().put("schema","custodial.native-saved-original-piece-journal-resume.v1")
            .put("state","EXISTING_ORIGINAL_PIECE_JOURNALS_LOCALLY_RECOVERED_NO_TRANSPORT_OR_ACK")
            .put("existing_records_observed",observed).put("pending_or_alias_records_recovered",recovered);
        for(String flag:localPieceResultFlags())result.put(flag,false);
        return result;
    }

    private static void localPieceResultRefused(JSONObject value)throws Exception {
        checks++;
        String admittedText=null;
        String before=value==null?null:value.toString();
        try { admittedText=NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(value); }
        catch(VaultFailure expected) {
            check("custodial_private_custody_transport_outcome_unknown".equals(expected.code));
            check(admittedText==null); // no success/count text reaches the caller
            check(value==null||before.equals(value.toString()));
            return;
        }
        throw new AssertionError("Refused local result returned outcome text at check "+checks);
    }

    private static void localPieceResultAccepted()throws Exception {
        JSONObject empty=localPieceResult(0,0);String before=empty.toString();
        String text=NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(empty);
        check(text.equals(NativeManagerPreparationPresentation.originalPiecesLocallyRecovered()
            +"\n\nExisting records observed: 0\nPending/alias records recovered: 0"));
        check(before.equals(empty.toString()));
        JSONObject some=localPieceResult(7,3);String someBefore=some.toString();
        text=NativeManagerPreparationPresentation.originalPiecesLocallyRecovered(some);
        check(text.endsWith("Existing records observed: 7\nPending/alias records recovered: 3"));
        check(text.contains("Missing records were not created."));
        check(text.contains("does not establish server custody or authorize transport, resend"));
        check(text.contains("Preserve originals and close this view before any next action."));
        check(someBefore.equals(some.toString()));
    }

    private static void localPieceResultShapeRefused()throws Exception {
        localPieceResultRefused(null);
        localPieceResultRefused(localPieceResult(2,1).put("schema","other.schema"));
        localPieceResultRefused(localPieceResult(2,1).put("state","OTHER_STATE"));
        localPieceResultRefused(localPieceResult(2,1).put("schema",JSONObject.NULL));
        localPieceResultRefused(localPieceResult(2,1).put("state",JSONObject.NULL));
        localPieceResultRefused(localPieceResult(2,1).put("extra",false));
        java.util.List<String> fields=new java.util.ArrayList<>();
        for(var keys=localPieceResult(2,1).keys();keys.hasNext();)fields.add(keys.next());
        for(String field:fields){JSONObject missing=localPieceResult(2,1);missing.remove(field);localPieceResultRefused(missing);}
        JSONObject replaced=localPieceResult(2,1);replaced.remove("network_dispatch_allowed");replaced.put("foreign",false);
        localPieceResultRefused(replaced); // same length is insufficient without every exact field
    }

    private static void localPieceResultEffectsRefused()throws Exception {
        for(String flag:localPieceResultFlags()){
            localPieceResultRefused(localPieceResult(2,1).put(flag,true));
            localPieceResultRefused(localPieceResult(2,1).put(flag,"false"));
            localPieceResultRefused(localPieceResult(2,1).put(flag,JSONObject.NULL));
        }
    }

    private static void localPieceResultCountsRefused()throws Exception {
        for(String field:new String[]{"existing_records_observed","pending_or_alias_records_recovered"}){
            for(Object invalid:new Object[]{"0",Long.valueOf(0),Double.valueOf(0),Boolean.FALSE,JSONObject.NULL,Integer.valueOf(-1)})
                localPieceResultRefused(localPieceResult(2,1).put(field,invalid));
        }
        localPieceResultRefused(localPieceResult(1,2));
    }

    private static void localPieceRecoveryButtonWording() {
        String text = NativeManagerPreparationPresentation.recoverOriginalPiecesButton();
        check("LOCAL RECOVER ORIGINAL PIECE JOURNALS".equals(text));
        check(!text.contains("send"));
        check(!text.contains("ready"));
    }

    private static void localPieceRecoveryResultWording() {
        String text = NativeManagerPreparationPresentation.originalPiecesLocallyRecovered();
        check(text.startsWith("Existing original piece journals were checked"));
        check(text.contains("any pending or alias recovery completed LOCALLY ONLY"));
        check(text.contains("Missing records were not created."));
        check(text.contains("does not establish server custody or authorize transport, resend"));
        check(text.contains("work acceptance, inventory ACK, finalization, key removal, phone release"));
        check(text.contains("or current manager authority"));
        check(text.contains("Preserve originals and close this view before any next action."));
        check(text.contains("Interrupted or partial recovery remains retained"));
        check(text.endsWith("never automatically retry, reopen, replace, or reset originals."));
        check(!text.contains("ready"));
        check(text.equals(NativeManagerPreparationPresentation.originalPiecesLocallyRecovered()));
    }

    private static void initialCustodyButtonWording() {
        check("Retain ORIGINAL native requests only (NO ACK)".equals(
            NativeManagerPreparationPresentation.retainSavedCustodyButton()));
        check(!NativeManagerPreparationPresentation.retainSavedCustodyButton().contains("resend"));
        check(!NativeManagerPreparationPresentation.retainSavedCustodyButton().contains("ready"));
    }

    private static void originalCustodyObservationWording() {
        String text = NativeManagerPreparationPresentation.originalCustodyObserved();
        check(text.contains("current native encrypted-frame read were observed"));
        check(text.contains("A preserved UNKNOWN is not resend authority."));
        check(text.contains("not inventory ACK, current manager authority"));
        check(text.contains("work acceptance, replay, finalization, key removal, or phone release"));
        check(text.contains("Preserve originals and close this view before staging preparation."));
        check(text.endsWith("This observation is not semantic acceptance."));
        check(!text.contains("ready"));
        check(text.equals(NativeManagerPreparationPresentation.originalCustodyObserved()));
    }

    private static JSONObject retentionStage()throws Exception {
        var value=new JSONObject().put("schema","custodial.native-original-custody-retention-stage.v1")
            .put("state","ORIGINAL_REQUEST_PHASE_RETURNED_CURRENT_READ_NOT_RUN").put("operation_id",ID).put("original_generation_id",ID)
            .put("frame_sha256","a".repeat(64)).put("plan_sha256","b".repeat(64));
        for(String key:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})value.put(key,false);
        return value;
    }
    private static void stageRefused(JSONObject value)throws Exception {
        checks++;try{NativeManagerPreparationPresentation.originalRequestsRetained(value);}
        catch(VaultFailure expected){check(NativeRetainedAttempt.FAILURE.equals(expected.code)||"custodial_private_custody_transport_outcome_unknown".equals(expected.code));return;}
        throw new AssertionError("Invalid retention DATA was displayed as a completed phase");
    }
    private static void retentionReadBoundary()throws Exception {
        initialCustodyButtonWording();check(NativeManagerPreparationPresentation.readSavedCustodyButton().contains("NO RESEND / ACK"));
        var stage=retentionStage();String text=NativeManagerPreparationPresentation.originalRequestsRetained(stage);
        check(text.contains("Current server readback has NOT run"));check(text.contains("Close this maintenance view and reopen it"));
        check(!text.contains(ID));check(!text.contains("a".repeat(64)));check(!text.contains("ready"));
        for(String key:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"}){
            stageRefused(retentionStage().put(key,true));stageRefused(retentionStage().put(key,"false"));
        }
        var missing=retentionStage();missing.remove("plan_sha256");stageRefused(missing);
        stageRefused(retentionStage().put("current_native_frame",true));stageRefused(retentionStage().put("frame_sha256","bad"));
        stageRefused(retentionStage().put("operation_id",JSONObject.NULL));stageRefused(retentionStage().put("state","CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK"));
        var current=new JSONObject().put("schema","custodial.native-current-original-frame-read.v1")
            .put("state","CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK");
        for(String key:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})current.put(key,false);
        for(String state:new String[]{"UNKNOWN_NOT_OBSERVED","LOCAL_PRESERVATION_INCOMPLETE_RETAINED","SAVED_ORIGINAL_LOCAL_PARTS_READ_BACK_NOT_REMOTE_ACK"}){
            current.put("browser_local_custody",new JSONObject().put("state",state));
            String observed=NativeManagerPreparationPresentation.currentOriginalCustodyObserved(current);
            check(observed.contains("separate current native encrypted-frame read"));check(observed.contains("did not resend"));check(!observed.contains("ready"));
        }
        stageRefused(current);checks++;
        try{NativeManagerPreparationPresentation.currentOriginalCustodyObserved(stage);throw new AssertionError("Stage DATA became current readback");}
        catch(VaultFailure expected){check("custodial_private_custody_transport_outcome_unknown".equals(expected.code));}
    }

    private static void baselineButtonWording() {
        check("Initialize FIRST native durable-fence baseline only".equals(
            NativeManagerPreparationPresentation.baselineButton()));
        check(!NativeManagerPreparationPresentation.baselineButton().contains("recovery"));
        check(!NativeManagerPreparationPresentation.baselineButton().contains("browser"));
    }

    private static void baselineInstalledWording() {
        String text = NativeManagerPreparationPresentation.baselineInstalled();
        check(text.startsWith("Native rejection metadata installed."));
        check(text.contains("Previously captured native observations are invalidated."));
        check(text.contains("does not authorize saved-original replacement, work acceptance, replay, ACK, finalization"));
        check(text.contains("key removal, phone release, or current manager authority"));
        check(text.contains("Native-only: this is not browser or all-writer completion."));
        check(text.endsWith("Close this view before any later original workflow."));
        check(!text.contains("ready"));
        check(text.equals(NativeManagerPreparationPresentation.baselineInstalled()));
    }

    private static void retainFirstButtonWording() {
        check("Retain FIRST encrypted NATIVE original (LOCAL ONLY)".equals(
            NativeManagerPreparationPresentation.retainFirstButton()));
        check(!NativeManagerPreparationPresentation.retainFirstButton().contains("server"));
        check(!NativeManagerPreparationPresentation.retainFirstButton().contains("ready"));
    }

    private static void firstOriginalRetainedWording() {
        String text = NativeManagerPreparationPresentation.firstOriginalRetained();
        check(text.startsWith("The original encrypted native snapshot and LOCAL operation were observed."));
        check(text.contains("This local observation does not establish server custody"));
        check(text.contains("or authorize work acceptance, replay, ACK, removal, finalization, key removal"));
        check(text.contains("browser freeze, or phone release"));
        check(text.contains("Preserve originals and close this view before any later workflow."));
        check(text.contains("Later saved-original recovery must never replace this original."));
        check(text.endsWith("This message supplies no authentication, attempt, or receipt."));
        check(!text.contains("ready"));
        check(text.equals(NativeManagerPreparationPresentation.firstOriginalRetained()));
    }

    private static void heldUnknownOutcomeWording() {
        String text = NativeManagerPreparationPresentation.held();
        check(text.startsWith("Outcome unconfirmed."));
        check(text.contains("Exact retained state has not been verified."));
        check(text.contains("Preserve original data and keys."));
        check(text.contains("Use the protected status and recovery process"));
        check(text.contains("Do not resend, replace the original, reset state"));
        check(text.contains("or initiate another native action."));
        check(!text.contains("original remains retained"));
        check(!text.contains("accepted"));
        check(!text.contains("delivered"));
        check(!text.contains("safe to erase"));
        check(!text.contains("ready"));
        check(text.equals(NativeManagerPreparationPresentation.held()));
    }

    private static void refused(Runnable call) {
        checks++;
        try { call.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Malformed presentation accepted at check " + checks);
    }

    private static void wording() {
        check("Same-original recovery preparation".equals(NativeManagerPreparationPresentation.title()));
        check(NativeManagerPreparationPresentation.explanation().contains("do not establish current manager authority"));
        check(NativeManagerPreparationPresentation.explanation().contains(
            "does not accept work, authorize replay or finalization, remove keys, or release a phone"));
        check(NativeManagerPreparationPresentation.stageButton().contains("original preparation only"));
        check(NativeManagerPreparationPresentation.readButton().contains("original server snapshot"));
        check(NativeManagerPreparationPresentation.held().contains("Exact retained state has not been verified"));
        check(NativeManagerPreparationPresentation.held().contains("Do not resend, replace the original, reset state"));
        check(NativeManagerPreparationPresentation.closed().contains("does not reset data or authorize another attempt"));
        check(NativeManagerPreparationPresentation.staged(ID).contains(
            "not work acceptance, replay or finalizer authorization, key removal, phone release, or current manager authority"));
        String text = NativeManagerPreparationPresentation.observed(AT, UNTIL);
        check(text.contains("Captured server snapshot"));
        check(text.contains("not live freshness, current manager authority, or permission"));
        check(text.contains("No work acceptance, replay, finalization, key removal, or phone release is authorized"));
    }

    private static void snapshots() {
        String text = NativeManagerPreparationPresentation.observed(AT, UNTIL);
        check(text.contains(AT)); check(text.contains(UNTIL));
        String old = "1900-01-01T00:00:00.000000Z", oldUntil = "1900-01-01T00:00:00.000001Z";
        String stale = NativeManagerPreparationPresentation.observed(old, oldUntil);
        check(stale.contains(old)); check(stale.contains(oldUntil)); check(stale.contains("not live freshness"));
        check(NativeManagerPreparationPresentation.observed("0001-01-01T00:00:00.000000Z",
            "0001-01-01T00:00:00.000001Z").contains("0001-01-01T00:00:00.000000Z"));
        check(NativeManagerPreparationPresentation.observed("9999-12-31T23:59:59.999998Z",
            "9999-12-31T23:59:59.999999Z").contains("9999-12-31T23:59:59.999999Z"));
        check(NativeManagerPreparationPresentation.staged(ID).contains(ID));
        check(NativeManagerPreparationPresentation.staged("abcdef01-2345-1234-9abc-abcdef012345").contains("abcdef01"));
        check(NativeManagerPreparationPresentation.staged("abcdef01-2345-5234-babc-abcdef012345").contains("abcdef01"));
    }

    private static void uuids() {
        for (String value : new String[]{null, "", "ABCDEF01-2345-1234-9ABC-ABCDEF012345", " " + ID, ID + "\n",
            ID.replace("-4000-", "-0000-"), ID.replace("-4000-", "-6000-"),
            ID.replace("-8000-", "-7000-"), ID.replace("-", ""), "x".repeat(100000),
            "98000000-0000-4000-8000-00000000000" + Character.toString((char)0xd800)}) {
            refused(() -> NativeManagerPreparationPresentation.staged(value));
        }
    }

    private static void ordering() {
        refused(() -> NativeManagerPreparationPresentation.observed(AT, AT));
        refused(() -> NativeManagerPreparationPresentation.observed(UNTIL, AT));
        refused(() -> NativeManagerPreparationPresentation.observed("2027-01-01T00:00:00.000000Z", AT));
    }

    private static void calendar() {
        check(NativeManagerPreparationPresentation.observed("2000-02-29T23:59:59.999999Z",
            "2000-03-01T00:00:00.000000Z").contains("2000-02-29"));
        check(NativeManagerPreparationPresentation.observed("2024-02-29T00:00:00.000000Z",
            "2024-03-01T00:00:00.000000Z").contains("2024-02-29"));
        for (String value : new String[]{"0000-01-01T00:00:00.000000Z", "1900-02-29T00:00:00.000000Z",
            "1500-02-29T00:00:00.000000Z", "2026-02-29T00:00:00.000000Z", "2026-02-30T00:00:00.000000Z",
            "2026-00-01T00:00:00.000000Z", "2026-13-01T00:00:00.000000Z", "2026-01-00T00:00:00.000000Z",
            "2026-04-31T00:00:00.000000Z", "2026-01-01T24:00:00.000000Z", "2026-01-01T00:60:00.000000Z",
            "2026-12-31T23:59:60.000000Z"}) {
            refused(() -> NativeManagerPreparationPresentation.observed(value, UNTIL));
            refused(() -> NativeManagerPreparationPresentation.observed(AT, value));
        }
    }

    private static void malformed() {
        for (String value : new String[]{null, "", "2026-10-14T12:00:00.001Z",
            "2026-10-14T12:00:00.0000010Z", "2026-10-14T12:00:00.000001+00:00",
            "2026-10-14T12:00:00.000001z", "2026-10-14 12:00:00.000001Z",
            " 2026-10-14T12:00:00.000001Z", "+2026-10-14T12:00:00.000001Z", "x".repeat(100000),
            AT.substring(0, 26) + Character.toString((char)0xd800),
            AT.substring(0, 26) + Character.toString((char)0xdc00),
            AT.substring(0, 25) + new String(new char[]{(char)0xd800, (char)0xdc00}),
            AT.substring(0, 26) + "\0", AT.substring(0, 26) + "\n"}) {
            refused(() -> NativeManagerPreparationPresentation.observed(value, UNTIL));
            refused(() -> NativeManagerPreparationPresentation.observed(AT, value));
        }
    }
}
