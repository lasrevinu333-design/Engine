(function(){
  'use strict';

  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const OPS_SESSION_URL=`${AUTH_URL}/session`;
  const OPS_SHARED_ENROLLMENT_URL=`${AUTH_URL}/ops/shared-enrollment`;
  const OPS_TRUSTED_DEVICES_URL=`${AUTH_URL}/ops/trusted-devices`;
  const DEVICE_SECURITY_URL=`${BACKEND_ORIGIN}/admin-api/device-security`;
  const OPS_LOGOUT_URL=`${AUTH_URL}/ops/logout`;
  const GEMINI_SESSION_KEY='memphisGeminiAdminSession.v1';
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const FULL_MANAGER_ENTRY='./ops-manager-hub.html';
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);
  let opsSession=null;
  let opsSessionRequest=null;
  let deviceSecurityCsrfToken='';

  function purgeRetiredClientAccessState(){
    try{
      [
        'memphisOpsManagerSession.v2',
        'memphisOpsManagerOpenSession.v1',
        'memphisOpsAccessKey.v1',
        'memphisOpsFullAccessKey.v1',
        'memphisOpsReadOnlyAccessKey.v1',
      ].forEach((key)=>localStorage.removeItem(key));
    }catch{}
  }
  purgeRetiredClientAccessState();

  function getCSTDate(date=new Date()){
    return date.toLocaleString('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
  }
  function getCSTDateString(){return getCSTDate();}

  function normalizeAccessLevel(value){
    const normalized=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
    return ['full','write','admin','full_access'].includes(normalized)?'full_access':'read_only';
  }

  function requestedAccessLevel(options={}){
    if(options.accessLevel||options.access_level)return normalizeAccessLevel(options.accessLevel||options.access_level);
    return 'full_access';
  }

  function normalizeDeviceId(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    if(/^kiosk[-_ ]?\d{1,2}$/i.test(raw)){
      const digits=(raw.match(/\d+/)||[''])[0];
      return digits?`KIOSK_${digits.padStart(2,'0')}`:raw.toUpperCase();
    }
    return raw.replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,96);
  }

  function stableManagerBrowserId(){
    let value='';
    try{value=normalizeDeviceId(localStorage.getItem(DEVICE_KEY)||'');}catch{}
    if(value&&!/^(visitor|device)-/i.test(value))return value;
    value=`manager-browser-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    try{localStorage.setItem(DEVICE_KEY,value);}catch{}
    return value;
  }

  function persistDeviceId(value){
    const normalized=normalizeDeviceId(value);
    if(!normalized)return '';
    try{localStorage.setItem(DEVICE_KEY,normalized);}catch{}
    return normalized;
  }

  function getDeviceId(){
    try{
      const shared=window.MemphisDeviceIdentity?.resolve?.({url:new URL(window.location.href)});
      if(shared?.deviceId)return persistDeviceId(shared.deviceId);
    }catch{}
    const url=new URL(window.location.href);
    const explicit=normalizeDeviceId(url.searchParams.get('device')||url.searchParams.get('deviceId')||'');
    if(explicit&&!/^(visitor|device)-/i.test(explicit))return persistDeviceId(explicit);
    for(const key of [DEVICE_KEY,LEGACY_DEVICE_KEY]){
      try{
        const value=normalizeDeviceId(localStorage.getItem(key)||'');
        if(value&&!/^(visitor|device)-/i.test(value))return persistDeviceId(value);
      }catch{}
    }
    return stableManagerBrowserId();
  }

  function deviceLabel(){
    const platform=String(navigator.userAgentData?.platform||navigator.platform||'browser').trim();
    return `Ops Manager · ${platform}`.slice(0,160);
  }

  function normalizeManagerCode(value){
    const normalized=String(value||'').trim().replace(/[\s-]+/g,'');
    return /^\d{8}$/.test(normalized)?normalized:'';
  }

  function readJsonStorage(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function writeJsonStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}

  function readSession(){
    if(opsSession&&opsSession.token&&opsSession.role==='ops_manager'&&Date.parse(opsSession.expires_at)>Date.now())return opsSession;
    opsSession=null;
    return null;
  }

  function clearSessionRecord(){opsSession=null;}
  function isOpsManager(session){return Boolean(session&&session.role==='ops_manager'&&session.token);}
  function isReadOnlySession(session=readSession()){return Boolean(session&&(session.read_only===true||session.access_level==='read_only'));}
  function canMutateOpsManagerSurface(session=readSession()){return Boolean(isOpsManager(session)&&!isReadOnlySession(session));}
  function hasRole(role,session=readSession()){const wanted=String(role||'').toUpperCase();return Boolean(session&&Array.isArray(session.roles)&&session.roles.map((r)=>String(r).toUpperCase()).includes(wanted));}
  function sessionAccessLevel(session){return isReadOnlySession(session)?'read_only':'full_access';}

  async function parseSessionResponse(response){
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok||!payload.data?.session?.token){
      const error=new Error((payload&&payload.error)||`Ops Manager authentication failed: HTTP ${response.status}`);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    opsSession={...payload.data.session,token:payload.data.session.token};
    const canonicalDevice=payload.data?.trusted_device?.device_id||opsSession.device_id;
    if(canonicalDevice)persistDeviceId(canonicalDevice);
    return opsSession;
  }

  async function requestTrustedOpsSession(accessLevel='full_access'){
    const normalized=normalizeAccessLevel(accessLevel);
    const url=new URL(OPS_SESSION_URL);
    url.searchParams.set('access_level',normalized);
    return parseSessionResponse(await fetch(url.toString(),{
      method:'GET',cache:'no-store',credentials:'include',headers:{'X-Device-Id':getDeviceId()}
    }));
  }

  async function consumeSharedEnrollmentPasscode(options={}){
    const code=normalizeManagerCode(options.code||options.manager_code||options.one_time_code);
    if(!code)throw new Error('Enter the eight-digit enrollment passcode.');
    const label=String(options.device_label||options.deviceLabel||'').trim().slice(0,160)||deviceLabel();
    try{
      return await parseSessionResponse(await fetch(`${OPS_SHARED_ENROLLMENT_URL}/consume`,{
        method:'POST',cache:'no-store',credentials:'include',
        headers:{'Content-Type':'application/json','X-Device-Id':getDeviceId(),'X-Device-Label':label},
        body:JSON.stringify({
          code,
          device_id:getDeviceId(),
          device_label:label,
        })
      }));
    }finally{
      if(options&&typeof options.clear==='function')options.clear();
    }
  }

  async function getSharedEnrollmentStatus(){
    const headers=await opsManagerAuthHeaders();
    const response=await fetch(OPS_SHARED_ENROLLMENT_URL,{method:'GET',cache:'no-store',credentials:'include',headers});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){
      const error=new Error(payload?.error||`Enrollment status failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    return payload.data;
  }

  async function createSharedEnrollmentWindow(){
    const headers=await opsManagerAuthHeaders();headers['Content-Type']='application/json';
    const response=await fetch(OPS_SHARED_ENROLLMENT_URL,{method:'POST',cache:'no-store',credentials:'include',headers,body:'{}'});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok||!payload.data?.passcode){
      const error=new Error(payload?.error||`Enrollment passcode generation failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    return payload.data;
  }

  async function disableSharedEnrollmentWindow(windowId,reason='disabled_by_custodial_manager'){
    const headers=await opsManagerAuthHeaders();headers['Content-Type']='application/json';
    const response=await fetch(`${OPS_SHARED_ENROLLMENT_URL}/${encodeURIComponent(windowId)}/disable`,{method:'POST',cache:'no-store',credentials:'include',headers,body:JSON.stringify({reason})});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){const error=new Error(payload?.error||`Enrollment disable failed: HTTP ${response.status}`);error.status=response.status;error.payload=payload;throw error;}
    return payload.data;
  }

  async function listOpsManagerTrustedDevices(){
    const headers=await opsManagerAuthHeaders();
    const response=await fetch(OPS_TRUSTED_DEVICES_URL,{method:'GET',cache:'no-store',credentials:'include',headers});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){
      const error=new Error(payload?.error||`Trusted-device list failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    return payload.data;
  }

  async function deviceSecuritySession(){
    const headers=await opsManagerAuthHeaders();
    const response=await fetch(`${DEVICE_SECURITY_URL}/session`,{method:'GET',cache:'no-store',credentials:'include',headers});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){return {configured:false,unlocked:false,error:payload?.error||`HTTP ${response.status}`};}
    return payload.data;
  }
  async function unlockDeviceSecurity(password){
    const headers=await opsManagerAuthHeaders();headers['Content-Type']='application/json';
    const response=await fetch(`${DEVICE_SECURITY_URL}/unlock`,{method:'POST',cache:'no-store',credentials:'include',headers,body:JSON.stringify({password})});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){const error=new Error(payload?.error||`Device Security unlock failed: HTTP ${response.status}`);error.status=response.status;error.payload=payload;throw error;}
    deviceSecurityCsrfToken=String(payload.data?.csrf_token||'');
    return payload.data;
  }
  async function lockDeviceSecurity(){
    const headers=await opsManagerAuthHeaders();
    if(deviceSecurityCsrfToken)headers['X-Device-Security-CSRF']=deviceSecurityCsrfToken;
    const response=await fetch(`${DEVICE_SECURITY_URL}/lock`,{method:'POST',cache:'no-store',credentials:'include',headers});
    deviceSecurityCsrfToken='';
    return response.ok;
  }
  async function deviceSecurityAuthHeaders(){
    const headers=await opsManagerAuthHeaders();
    if(deviceSecurityCsrfToken)headers['X-Device-Security-CSRF']=deviceSecurityCsrfToken;
    return headers;
  }

  async function revokeOpsManagerTrustedDevice(credentialId,reason='manager_revoke_device'){
    const headers=await opsManagerAuthHeaders();
    headers['Content-Type']='application/json';
    const response=await fetch(`${OPS_TRUSTED_DEVICES_URL}/${encodeURIComponent(credentialId)}/revoke`,{
      method:'POST',cache:'no-store',credentials:'include',headers,body:JSON.stringify({reason})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){
      const error=new Error(payload?.error||`Trusted-device revoke failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    if(payload.data?.revoked_credential_id&&readSession()?.credential_id===payload.data.revoked_credential_id)clearSessionRecord();
    return payload.data;
  }

  async function renameOpsManagerTrustedDevice(credentialId,deviceLabel){
    const headers=await opsManagerAuthHeaders();headers['Content-Type']='application/json';
    const response=await fetch(`${OPS_TRUSTED_DEVICES_URL}/${encodeURIComponent(credentialId)}`,{
      method:'PATCH',cache:'no-store',credentials:'include',headers,body:JSON.stringify({device_label:String(deviceLabel||'').trim().slice(0,160)})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){const error=new Error(payload?.error||`Trusted-device rename failed: HTTP ${response.status}`);error.status=response.status;error.payload=payload;throw error;}
    return payload.data;
  }

  async function revokeAllOpsManagerTrustedDevices(reason='manager_revoke_all'){
    const headers=await opsManagerAuthHeaders();
    headers['Content-Type']='application/json';
    const response=await fetch(`${OPS_TRUSTED_DEVICES_URL}/revoke-all`,{
      method:'POST',cache:'no-store',credentials:'include',headers,body:JSON.stringify({reason})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){
      const error=new Error(payload?.error||`Trusted-device revoke-all failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    return payload.data;
  }

  async function verifyStoredOpsSession(accessLevel='full_access'){
    try{return await requestTrustedOpsSession(accessLevel);}catch(error){
      clearSessionRecord();
      if(Number(error?.status)===401)return null;
      throw error;
    }
  }

  function redirectToManagerHub(){
    const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target=new URL(FULL_MANAGER_ENTRY,window.location.href);
    target.searchParams.set('return',current);
    target.searchParams.set('manager_access','full_access');
    window.location.replace(target.toString());
  }

  async function requireOpsManagerSession(options={}){
    const interactive=options.interactive!==false;
    const redirect=options.redirect===true;
    const requested=requestedAccessLevel(options);
    const existing=readSession();
    if(existing&&sessionAccessLevel(existing)===requested)return existing;

    if(!opsSessionRequest){
      opsSessionRequest=(async()=>{
        const refreshed=await verifyStoredOpsSession(requested);
        if(refreshed)return refreshed;
        return null;
      })().finally(()=>{opsSessionRequest=null;});
    }

    try{
      const session=await opsSessionRequest;
      if(session)return session;
      if(redirect&&!/\/(?:start_page1|ops-manager-hub)\.html$/i.test(window.location.pathname||''))redirectToManagerHub(requested);
      if(options.throwOnFailure===true)throw new Error('This browser is not trusted for Ops Manager access. Enter the shared enrollment passcode on the normal Hub URL.');
      return null;
    }catch(error){
      if(redirect&&!/\/(?:start_page1|ops-manager-hub)\.html$/i.test(window.location.pathname||''))redirectToManagerHub(requested);
      if(options.throwOnFailure===true)throw error;
      return null;
    }
  }

  async function opsManagerAuthHeaders(){
    const session=await requireOpsManagerSession({redirect:false,interactive:false,throwOnFailure:true});
    return {Authorization:`Bearer ${session.token}`,'X-Device-Id':session.device_id||getDeviceId()};
  }

  async function clearSession(){
    clearSessionRecord();
    purgeRetiredClientAccessState();
    try{
      await fetch(OPS_LOGOUT_URL,{method:'POST',cache:'no-store',credentials:'include',headers:{'X-Device-Id':getDeviceId()}});
    }catch{}
  }

  function readGeminiSession(){
    const session=readJsonStorage(GEMINI_SESSION_KEY);
    if(session&&session.token&&Date.parse(session.expires_at)>Date.now())return session;
    try{localStorage.removeItem(GEMINI_SESSION_KEY);}catch{}
    return null;
  }
  function clearGeminiSession(){try{localStorage.removeItem(GEMINI_SESSION_KEY);}catch{}}

  async function loginGeminiAdmin(password){
    const response=await fetch(`${AUTH_URL}/gemini/login`,{
      method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok||!payload.data?.token){
      const error=new Error((payload&&payload.error)||`Gemini login failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    writeJsonStorage(GEMINI_SESSION_KEY,payload.data);
    return payload.data;
  }

  async function verifyGeminiSession(){
    const session=readGeminiSession();
    if(!session)return null;
    const response=await fetch(`${AUTH_URL}/gemini/session`,{method:'GET',cache:'no-store',headers:{Authorization:`Bearer ${session.token}`}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){clearGeminiSession();return null;}
    return payload.data?.session?{...session,...payload.data.session,token:session.token}:session;
  }

  async function requireGeminiAdminSession(options={}){
    const interactive=options.interactive!==false;
    const existing=await verifyGeminiSession();
    if(existing)return existing;
    if(!interactive)return null;
    for(let attempt=1;attempt<=3;attempt+=1){
      const password=(window.prompt('Enter Gemini password.')||'').trim();
      if(!password)throw new Error('Gemini password required.');
      try{return await loginGeminiAdmin(password);}catch(error){
        if(attempt>=3)throw error;
        window.alert(`Gemini password rejected. ${3-attempt} ${3-attempt===1?'try':'tries'} left.`);
      }
    }
    throw new Error('Gemini password required.');
  }

  async function geminiAdminAuthHeaders(){
    const session=await requireGeminiAdminSession({interactive:true});
    return {Authorization:`Bearer ${session.token}`};
  }

  function isOpsManagerOpenSurface(){return false;}

  window.MemphisAuth={
    loginGeminiAdmin,consumeSharedEnrollmentPasscode,getSharedEnrollmentStatus,createSharedEnrollmentWindow,
    disableSharedEnrollmentWindow,listOpsManagerTrustedDevices,renameOpsManagerTrustedDevice,
    revokeOpsManagerTrustedDevice,revokeAllOpsManagerTrustedDevices,requestTrustedOpsSession,
    deviceSecuritySession,unlockDeviceSecurity,lockDeviceSecurity,deviceSecurityAuthHeaders,
    requireOpsManagerSession,requireGeminiAdminSession,opsManagerAuthHeaders,geminiAdminAuthHeaders,
    readSession,readGeminiSession,clearSession,clearGeminiSession,getDeviceId,isOpsManager,isReadOnlySession,
    canMutateOpsManagerSurface,hasRole,redirectToManagerHub,requestPublicOpsSession:requestTrustedOpsSession,normalizeAccessLevel,
    opsManagerAuthDisabled:false,authUrl:AUTH_URL,backendOrigin:BACKEND_ORIGIN,getCSTDate,getCSTDateString,
    isOpsManagerOpenSurface,normalizeDeviceId,managerOverviewDeviceIds:MANAGER_OVERVIEW_DEVICE_IDS
  };
})();
