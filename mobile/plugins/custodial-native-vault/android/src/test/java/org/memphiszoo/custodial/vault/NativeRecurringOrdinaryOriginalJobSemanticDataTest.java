package org.memphiszoo.custodial.vault;

import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual strict protected-payload parser + pure dual-source formatter DATA.
 * No original owner/read/SDK fact/Current/physical clock is manufactured. */
public final class NativeRecurringOrdinaryOriginalJobSemanticDataTest {
    private static final class Fixture {
        final NativeProviderPayload payload;final JSONObject data,target,effect;
        final String device;
        Fixture(boolean location)throws Exception {
            Map<String,String> source;
            if(location){
                source=NativeProviderPayloadTest.location(false,false);
                source.put("title","Teton restroom is due soon");
                source.put("body","Eric Operle, Teton restroom on your assigned route is due soon for a check.");
                NativeProviderPayloadTest.signed(source);
            }else source=NativeProviderPayloadTest.lunch(new NativeProviderRegistrationReceiptTest.Fixture(false).prepared);
            payload=NativeProviderPayloadTest.accept(source);device=payload.get("receipt_device_id");
            target=new JSONObject().put("projectionId",payload.get("projection_id")).put("authorityRevision",17L)
                .put("employeeId",payload.get("receipt_employee_id"));data=new JSONObject();
            if(location){
                target.put("publicationId",payload.get("publication_id"));
                for(String key:new String[]{"kind","notification_type","notification_key","service_date","projection_id","publication_id","location_id",
                    "location_code","location_name","group_code","group_name","form_type","status_code","receipt_employee_id","receipt_credential_id",
                    "receipt_device_id","receipt_assignment_epoch"})data.put(key,payload.get(key));
                data.put("device_id",device).put("employee_id",payload.get("receipt_employee_id")).put("employee_name","Eric Operle")
                    .put("schedule_authority_revision","17");
                effect=new JSONObject().put("origin","EXHAUSTIVE_NORMAL_CURRENT_LOCATION_CYCLES").put("notification_key",payload.notificationKey)
                    .put("required_audio",true).put("data",data);
            }else{
                target.put("lunchDocumentIdentity",payload.get("document_identity"));
                for(String key:new String[]{"kind","notification_type","notification_key","service_date","loan_id","event","scheduled_time","scheduled_at","valid_until",
                    "coverer_slot_id","projection_id","document_identity","receipt_employee_id","receipt_credential_id","receipt_device_id","receipt_assignment_epoch","route"})
                    data.put(key,payload.get(key));
                effect=new JSONObject().put("origin","FULL_ACCEPTED_LUNCH_DOCUMENT").put("notification_key",payload.notificationKey).put("required_audio",true)
                    .put("notification",new JSONObject().put("title",payload.get("title")).put("body",payload.get("body")).put("data",data));
            }
        }
        JSONObject render(boolean location)throws Exception {
            return location?NativeRecurringOrdinaryOriginalJobSemanticData.location(effect,target,payload,"Eric Operle",device)
                :NativeRecurringOrdinaryOriginalJobSemanticData.lunch(effect,target,payload,"Eric Operle",device);
        }
    }
    @Test public void lunchExactOriginalNativeAndNormalFormatterTextsMatchAsData()throws Exception {
        Fixture f=new Fixture(false);JSONObject normal=f.render(false);
        assertEquals(f.payload.get("body"),normal.get("body"));assertEquals(f.payload.get("body"),normal.get("speech_text"));
        assertEquals("Lunch coverage",normal.get("kicker"));assertEquals("lunch_coverage",normal.get("notification_type"));
        assertTrue(normal.getString("open_url").startsWith("https://localhost/employee-schedule.html?hub=employee&device="));
    }
    @Test public void wrongOriginalLunchLoanCannotBeSubstitutedBySameProjection()throws Exception {
        Fixture f=new Fixture(false);f.data.put("loan_id","d".repeat(64));assertThrows(VaultFailure.class,()->f.render(false));
    }
    @Test public void originalJobIdIsNeverInjectedIntoNormalSemanticNotificationData()throws Exception {
        Fixture f=new Fixture(false);f.data.put("receipt_job_id",f.payload.jobId);assertThrows(VaultFailure.class,()->f.render(false));
    }
    @Test public void lunchChangedWordsCannotBorrowOriginalNativeCompletion()throws Exception {
        Fixture f=new Fixture(false);f.effect.getJSONObject("notification").put("body","Different accepted words");assertThrows(VaultFailure.class,()->f.render(false));
    }
    @Test public void locationRetainsTwoLegitimatelyDifferentWordContracts()throws Exception {
        Fixture f=new Fixture(true);JSONObject normal=f.render(true);
        assertEquals("Teton restroom on Teton in your current areas is getting close to its next cleaning time.",normal.get("body"));
        assertEquals("Hey Eric, Teton restroom is due soon. Please check it soon.",normal.get("speech_text"));
        assertNotEquals(f.payload.get("body"),normal.get("speech_text"));assertNotEquals(f.payload.get("body"),normal.get("body"));
        assertEquals("Eric Operle, Teton restroom on your assigned route is due soon for a check.",f.payload.get("body"));
        assertEquals("Teton restroom is due soon",normal.get("title"));assertTrue(normal.getString("open_url").endsWith("&highlight=TETM"));
    }
    @Test public void locationWrongAuthorityRevisionCannotBorrowSameOriginalJob()throws Exception {
        Fixture f=new Fixture(true);f.data.put("schedule_authority_revision","18");assertThrows(VaultFailure.class,()->f.render(true));
    }
    @Test public void locationWrongPublicationCannotBorrowSameOriginalJob()throws Exception {
        Fixture f=new Fixture(true);f.target.put("publicationId","99000000-0000-4000-8000-000000000001");assertThrows(VaultFailure.class,()->f.render(true));
    }
    @Test public void locationWrongStatusCannotBorrowSameOriginalJob()throws Exception {
        Fixture f=new Fixture(true);f.data.put("status_code","overdue");assertThrows(VaultFailure.class,()->f.render(true));
    }
    @Test public void missingNativeOriginalReadNeverBecomesAParsedPlanAuthority()throws Exception {
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryOriginalJobSemanticData.requireOriginal(new JSONObject(),new JSONObject(),new JSONObject(),null,null));
    }
}
