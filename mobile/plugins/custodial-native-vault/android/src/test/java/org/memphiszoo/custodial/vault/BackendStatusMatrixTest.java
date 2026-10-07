package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Consume JSON emitted by the actual backend route matrix, not copied shapes. */
public final class BackendStatusMatrixTest {
    @Test public void backendShapesDriveProtectedNoRotationAndRecoveryAcrossRestart() throws Exception {
        JSONObject matrix=new JSONObject(new String(Files.readAllBytes(Path.of(System.getenv("CUSTODIAL_STATUS_MATRIX_JSON"))),java.nio.charset.StandardCharsets.UTF_8));
        JSONArray cases=matrix.getJSONArray("cases");int executed=0;
        for(int i=0;i<cases.length();i++) {
            JSONObject c=cases.getJSONObject(i);String name=c.getString("name");
            if(!(name.endsWith("/healthy")||name.endsWith("/revoked")||name.endsWith("/expired")||name.endsWith("/wrong_secret")))continue;
            String oldOperation=c.getString("expected_credential"),requested="11111111-1111-4111-8111-111111111111";
            String device=c.getString("expected_device");boolean healthy=name.endsWith("/healthy");
            MemoryPersistence persistence=new MemoryPersistence();TestCipher cipher=new TestCipher();
            MutableClock clock=new MutableClock(1800000000000L);FakeTransport delegate=new FakeTransport(clock);
            boolean[] loseStatus={false};
            final HttpsEnrollmentTransport.HttpResult statusResult=new HttpsEnrollmentTransport.HttpResult(c.getInt("status"),Map.of(),
                c.getJSONObject("body").toString().getBytes(StandardCharsets.UTF_8));
            EnrollmentTransport transport=new EnrollmentTransport() {
                public EnrollmentResult enroll(EnrollmentRequest r,char[] code)throws VaultFailure{return delegate.enroll(r,code);}
                public TerminalResult confirm(String op,String d,char[] cred)throws VaultFailure{return delegate.confirm(op,d,cred);}
                public TerminalResult cancel(String op,String d,char[] cred)throws VaultFailure{return delegate.cancel(op,d,cred);}
                public TerminalResult remove(String op,String d,char[] cred)throws VaultFailure{return delegate.remove(op,d,cred);}
                public String verifyLegacyIdentity(String d,char[] cred)throws VaultFailure{return delegate.verifyLegacyIdentity(d,cred);}
                public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] cred)throws VaultFailure{return delegate.authorized(r,d,cred);}
                public String reportAssignedActivation(String op,String d,char[] cred,Map<String,Object> receipt)throws VaultFailure{return delegate.reportAssignedActivation(op,d,cred,receipt);}
                public ActiveCredentialStatus verifyActiveCredential(String d,String id,char[] cred)throws VaultFailure {
                    if(loseStatus[0]){loseStatus[0]=false;throw new VaultFailure("custodial_native_credential_revalidation_failed",503);}
                    return HttpsEnrollmentTransport.classifyActiveCredentialStatus(
                        statusResult,d,id);
                }
            };
            FakeLegacySource legacy=new FakeLegacySource();TestSealGenerator seals=new TestSealGenerator();
            VaultEngine engine=new VaultEngine(persistence,cipher,transport,legacy,seals,clock);
            char[] code="12345678".toCharArray();
            engine.enroll(oldOperation,device,"enrollment",code);engine.completeLocalBinding(oldOperation);engine.confirmEnrollment(oldOperation);
            InstallationBinding original=persistence.current().installation;
            EncryptedSecret saved=cipher.encryptWithExistingKey("saved original work and draft".toCharArray());
            int commits=persistence.commitAttempts.get();loseStatus[0]=true;
            try {engine.activateAssignedDevice(requested,device,code);fail(name+" must not guess on lost status");}
            catch(VaultFailure error){assertEquals("custodial_native_credential_revalidation_failed",error.code);}
            assertEquals(commits,persistence.commitAttempts.get());assertEquals(1,delegate.issuanceCount.get());
            if(!healthy) {
                delegate.loseEnrollAfterSuccess=1;
                try {engine.activateAssignedDevice(requested,device,code);fail(name+" expected lost enrollment response");}
                catch(VaultFailure error){assertEquals("custodial_native_network_unavailable",error.code);}
            }
            engine=new VaultEngine(persistence,cipher,transport,legacy,seals,clock);
            Map<String,Object> state=engine.activateAssignedDevice(requested,device,code);
            assertEquals(original,persistence.current().installation);assertEquals(healthy?1:2,delegate.issuanceCount.get());
            assertArrayEquals("saved original work and draft".toCharArray(),cipher.decrypt(saved));assertEquals(0,cipher.destroyCalls);
            String[] journalValue={null};NativeAssignedActivationJournal journal=new NativeAssignedActivationJournal(new NativeAssignedActivationJournal.Store(){
                public String loadAssignedActivation(){return journalValue[0];}
                public void saveAssignedActivation(String value){journalValue[0]=value;}
            });
            journal.captureConfirmed(state);String digest=journal.digestFor(state);
            String active=healthy?oldOperation:requested;delegate.loseAssignedReceipt=true;
            try {engine.reportAssignedActivation(requested,device,active,active,digest);fail("expected lost receipt response");}
            catch(VaultFailure error){assertEquals("custodial_native_network_unavailable",error.code);}
            engine=new VaultEngine(persistence,cipher,transport,legacy,seals,clock);
            assertEquals(healthy?"not_required":"native_active",engine.reportAssignedActivation(requested,device,active,active,digest));
            assertEquals(oldOperation,delegate.assignedReceipt.get("lineage_operation_id"));
            assertEquals(healthy?1:2,delegate.issuanceCount.get());executed++;
        }
        assertEquals(16,executed);
    }

    @Test public void actualBackendStatusMatchesNativeClassifier() throws Exception {
        String path=System.getenv("CUSTODIAL_STATUS_MATRIX_JSON");
        assertNotNull("Actual backend matrix file is required",path);
        JSONObject matrix=new JSONObject(new String(Files.readAllBytes(Path.of(path)),java.nio.charset.StandardCharsets.UTF_8));
        assertEquals(1,matrix.getInt("schema"));assertTrue(matrix.getBoolean("synthetic"));
        JSONArray cases=matrix.getJSONArray("cases");assertEquals(36,cases.length());
        java.util.ArrayList<String> failures=new java.util.ArrayList<>();
        for(int i=0;i<cases.length();i++) {
            JSONObject c=cases.getJSONObject(i);String actual;
            try {
                actual=HttpsEnrollmentTransport.classifyActiveCredentialStatus(
                    new HttpsEnrollmentTransport.HttpResult(c.getInt("status"),
                        Map.of("content-type",List.of("application/json")),
                        c.getJSONObject("body").toString().getBytes(StandardCharsets.UTF_8)),
                    c.getString("expected_device"),c.getString("expected_credential")).name();
            } catch(VaultFailure error) {
                assertEquals(c.getString("name"),"custodial_native_credential_revalidation_refused",error.code);
                actual="REFUSED";
            }
            if(!c.getString("expected").equals(actual)) failures.add(c.getString("name")+": "+actual+" expected "+c.getString("expected"));
        }
        assertEquals(String.join("\n",failures),0,failures.size());
    }
}
