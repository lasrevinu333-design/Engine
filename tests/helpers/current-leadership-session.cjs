// Explicit synthetic transport DATA for the current leadership enrollment API.
// No PIN, cookie, SQL, native enrollment or physical acceptance is established.
const uuid=n=>'42000000-0000-4000-8000-'+String(n).padStart(12,'0');
function currentLeadershipSession({deviceId='fixture-manager-browser',managerId=uuid(1),credentialId=uuid(2),accountId=uuid(3),displayName='Synthetic selected manager',session={}}={}){
 return {ok:true,enrolled:true,csrfToken:'synthetic-fixture-csrf',session:{registrationId:credentialId,identityAssurance:'SELF_ASSERTED_NAME',
  claimedAccount:{accountId,displayName,contact:null},cohort:{principalId:managerId,policyVersion:1,permissions:['custodialManagementAdmin']},
  managerSession:{token:'synthetic-fixture-token-'+credentialId,role:'ops_manager',manager_id:managerId,credential_id:credentialId,device_id:deviceId,
   manager_display_name:'Custodial leadership cohort',roles:['CUSTODIAL_MANAGER','SECURITY_ADMIN'],access_level:'full_access',read_only:false,
   owner:false,custodial_management_admin:true,auth_mode:'custodial_leadership_pin',expires_at:'2099-01-01T00:00:00Z',
   permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1,manage_absences:true,manage_coverall:true,regenerate_routes:true,close_scan_tickets:true},...session}}};
}
module.exports={currentLeadershipSession};
