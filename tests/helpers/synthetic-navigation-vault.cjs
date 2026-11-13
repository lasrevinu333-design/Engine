// Explicit synthetic Android public DATA/transport ports for browser navigation.
// No private ACK, keys, native enrollment, removal, hardware or phone proof.
function installSyntheticNavigationVaultFixture(){
 window.__testInstallNavigationVault=({deviceId,credential,seal,principal})=>{
  const rawFetch=window.fetch.bind(window);
  const profile={authenticated:true,canonical_device_id:deviceId,device_id:deviceId,employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:principal.assignment_epoch,employee_name:'Karen Robinson',employee_role:'staff'};
  localStorage.setItem('mz_custodial_home_cache:'+encodeURIComponent(JSON.stringify(principal)),JSON.stringify({schema_version:'custodial-home-cache.v4',principal,device_id:deviceId,cached_at:new Date().toISOString(),profile}));
  const state={schema_version:1,state:'ACTIVE',active:true,credential_present:true,blocked:false,principal,
   installation:{schema_version:1,device_id:deviceId,installation_seal:seal,enrolled_at:principal.enrolled_at,enrollment_operation_id:principal.credential_operation_id,migrated_from_credential_only_state:false}};
  window.androidBridge={};window.Capacitor={PluginHeaders:[{name:'App',methods:['addListener','removeListener','getLaunchUrl'].map(name=>({name,rtype:'promise'}))},{name:'CustodialNativeVault',methods:['getState','authorizedRequest','attestScanIntent','recoverPendingScanIntent','resumeEnrollment','confirmEnrollment','cancelEnrollment','removeEnrollment','finalizeRemoval'].map(name=>({name,rtype:'promise'}))}],
   nativePromise(plugin,method,options){
    if(plugin==='App')return Promise.resolve(method==='addListener'?'synthetic-navigation-listener':{});
    if(plugin!=='CustodialNativeVault')return Promise.reject(Error('Unprovided synthetic native plugin'));
    if(method==='getState')return Promise.resolve(structuredClone(state));
    // Synthetic public routing DATA only: no physical NFC attestation claim.
    if(method==='recoverPendingScanIntent')return Promise.resolve({recovered:false});
    if(method==='attestScanIntent'){const url=new URL(options.url,location.href);return Promise.resolve({url:url.toString(),entry_id:crypto.randomUUID()});}
    if(method!=='authorizedRequest')return Promise.reject(Error('No synthetic authority for '+method));
    if(typeof options?.path!=='string'||!options.path.startsWith('/')||options.path.startsWith('//'))return Promise.reject(Error('Bound synthetic API path required'));
    const headers={'X-Device-Id':deviceId,Authorization:'Device '+credential,...(options.headers||{})};
    const body=options.body_base64?Uint8Array.from(atob(options.body_base64),c=>c.charCodeAt(0)):undefined;
    return rawFetch('https://memphis-zoo-mcp.onrender.com'+options.path,{method:options.method||'GET',headers,body}).then(async response=>({status:response.status,headers:Object.fromEntries(response.headers),body_base64:btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())))}));
   }};
 };
}
module.exports={installSyntheticNavigationVaultFixture};
