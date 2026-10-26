(function(){
  'use strict';

  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const OPS_SESSION_URL=`${AUTH_URL}/session`;
  const OPS_TRUSTED_DEVICES_URL=`${AUTH_URL}/ops/trusted-devices`;
  const DEVICE_SECURITY_URL=`${BACKEND_ORIGIN}/admin-api/device-security`;
  const OPS_LOGOUT_URL=`${AUTH_URL}/ops/logout`;
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const FULL_MANAGER_ENTRY='./ops-manager-hub.html';
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);
  let opsSession=null;
  let opsSessionRequest=null;
  let deviceSecurityCsrfToken='';
  const RETIRED_CLIENT_KEYS=Object.freeze([
    'memphisOpsManagerSession.v2','memphisOpsManagerOpenSession.v1','memphisOpsAccessKey.v1',
    'memphisOpsFullAccessKey.v1','memphisOpsReadOnlyAccessKey.v1','memphisGeminiAdminSession.v1',
  ]);
  const CACHE_KEYS=new Set([DEVICE_KEY,...RETIRED_CLIENT_KEYS]);
  let cacheOwnerPromise=null,cacheUncertain=false,nativeCacheObserved=false,identityCacheSelection=null,browserIdData='';

  // These values are non-authoritative browser cache DATA. Retired access
  // strings are never read as sessions or permissions, even if a hold defers
  // their deletion. No login/token/server authorization path is changed here.
  function browserCacheSource(){
    const area=localStorage,prototype=Object.getPrototypeOf(area),nav=window.navigator,
      locks=nav?.locks,request=locks?.request,methods={};
    const unavailable=()=>new Error('Original manager browser cache unavailable.');
    const native=()=>{
      try{
        const security=window.MemphisCustodialSecurity;
        if((security!=null&&security.native!==false)||window.MemphisMobile?.edition==='custodial'
          ||window.MemphisMobileBuildIdentity?.edition==='custodial'||window.Capacitor?.isNativePlatform?.()===true
          ||['android','ios'].includes(window.Capacitor?.getPlatform?.()))nativeCacheObserved=true;
      }catch{nativeCacheObserved=true;}
      if(nativeCacheObserved)throw unavailable();
    };
    for(const name of ['getItem','setItem','removeItem']){
      const descriptor=Object.getOwnPropertyDescriptor(prototype,name);
      if(!descriptor||descriptor.writable!==true||descriptor.configurable!==true
        ||typeof descriptor.value!=='function'||area[name]!==descriptor.value)throw unavailable();
      methods[name]=descriptor.value;
    }
    const current=()=>{
      native();
      if(localStorage!==area||window.localStorage!==area||Object.getPrototypeOf(area)!==prototype
        ||window.navigator!==nav||nav?.locks!==locks||typeof request!=='function'||locks.request!==request)throw unavailable();
      for(const name of Object.keys(methods)){
        const descriptor=Object.getOwnPropertyDescriptor(prototype,name);
        if(area[name]!==methods[name]||descriptor?.value!==methods[name]
          ||descriptor.writable!==true||descriptor.configurable!==true)throw unavailable();
      }
    };
    const read=key=>{current();const value=methods.getItem.call(area,key);current();
      if(value!==null&&typeof value!=='string')throw unavailable();return value;};
    const set=(key,value)=>{current();methods.setItem.call(area,key,value);current();};
    const remove=key=>{current();methods.removeItem.call(area,key);current();};
    current();return {current,read,set,remove,locks,storage:Object.freeze({getItem:read,setItem:set})};
  }
  function managerCacheOwner(source){
    if(!cacheOwnerPromise)cacheOwnerPromise=(async()=>{
      const module=await import('./mobile/src/custodial/protected-browser-admission.js');source.current();
      const gate=module.createProtectedBrowserAdmission({storage:source.storage,locks:source.locks});
      source.current();return {gate,current:source.current};
    })();
    return cacheOwnerPromise;
  }
  function mutateOriginalCache(changes,requireSelection=()=>{}){
    let effectAttempted=false;
    try{
      if(cacheUncertain||changes.some(([key,value])=>!CACHE_KEYS.has(key)||value!==null&&typeof value!=='string'))throw Error('Cache refused');
      const source=browserCacheSource(),original=changes.map(([key])=>source.read(key)),expected=original.slice();
      let owner=null,entered=false;
      const current=()=>{if(cacheUncertain)throw Error('Cache outcome unresolved');requireSelection();source.current();if(owner)owner.current();};
      const exact=()=>{for(let i=0;i<changes.length;i++){current();if(source.read(changes[i][0])!==expected[i])throw Error('Original cache changed');current();}};
      const checkpoint=()=>{current();owner.gate.requireMutation();current();};
      return(async()=>{
        owner=await managerCacheOwner(source);current();exact();
        const result=await owner.gate.mutate(()=>{
          if(entered)throw Error('Original cache callback repeated');entered=true;
          for(let i=0;i<changes.length;i++){
            checkpoint();exact();checkpoint();const [key,value]=changes[i];
            if(expected[i]!==value){
              effectAttempted=true;if(value===null)source.remove(key);else source.set(key,value);expected[i]=value;
              checkpoint();exact();checkpoint();
            }
          }
          return true;
        });
        if(result!==true||!entered)throw Error('Cache save unconfirmed');
        current();owner.gate.requireAdmission();exact();owner.gate.requireAdmission();current();return true;
      })().catch(()=>{if(effectAttempted)cacheUncertain=true;return false;});
    }catch{return Promise.resolve(false);}
  }

  function purgeRetiredClientAccessState(){
    return mutateOriginalCache(RETIRED_CLIENT_KEYS.map(key=>[key,null]));
  }
  purgeRetiredClientAccessState();

  function chicagoParts(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter((part)=>part.type!=='literal').map((part)=>[part.type,part.value]));
  }
  function getOperationalServiceDate(date=new Date()){
    const parts=chicagoParts(date);
    const calendarDate=`${parts.year}-${parts.month}-${parts.day}`;
    if(Number(parts.hour)>=4)return calendarDate;
    const prior=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)-1));
    return prior.toISOString().slice(0,10);
  }
  function getChicagoMinutes(date=new Date()){
    const parts=chicagoParts(date);
    return Number(parts.hour)*60+Number(parts.minute);
  }
  function getCSTDate(date=new Date()){return getOperationalServiceDate(date);}
  function getCSTDateString(date=new Date()){return getOperationalServiceDate(date);}

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
    if(!browserIdData)browserIdData=`manager-browser-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    return persistDeviceId(browserIdData);
  }

  function persistDeviceId(value){
    const normalized=normalizeDeviceId(value);
    if(!normalized)return '';
    if(identityCacheSelection?.value!==normalized){
      const original={value:normalized,settled:null};identityCacheSelection=original;
      original.settled=mutateOriginalCache([[DEVICE_KEY,normalized]],()=>{
        if(identityCacheSelection!==original)throw Error('Original manager browser identity changed');
      });
    }
    // As before, the synchronous return is an identity selection, NOT a
    // persistence receipt. No unknown result is retried or rolled back.
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
      method:'GET',cache:'no-store',credentials:'include',signal:AbortSignal.timeout(10000),headers:{'X-Device-Id':getDeviceId()}
    }));
  }

  function hasPermission(action,session=window.MemphisAuth?.readSession?.()){
    const p=session?.permissions;
    return p?.schema==='custodial.manager-permissions.v1'&&p.read===true&&p[action]===true;
  }
  async function signInWithMap(email,password){
    const configResponse=await fetch(`${AUTH_URL}/map-config`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    const config=await configResponse.json();
    if(!configResponse.ok||!config?.ok||config.data?.url!=='https://dwzdqekusvivjbxsapdu.supabase.co'||!String(config.data?.publishable_key||'').startsWith('sb_publishable_'))throw new Error('Map sign-in is unavailable.');
    // Password goes directly to the same Map identity provider. Never store it,
    // the provider refresh token, or a Custodial bearer in browser storage.
    const loginResponse=await fetch(`${config.data.url}/auth/v1/token?grant_type=password`,{
      method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',apikey:config.data.publishable_key},
      body:JSON.stringify({email:String(email||'').trim(),password:String(password||'')})
    });
    const login=await loginResponse.json().catch(()=>null);
    if(!loginResponse.ok||!login?.access_token)throw new Error('The Map email or password was not accepted.');
    const response=await fetch(`${AUTH_URL}/map-session`,{method:'POST',credentials:'include',cache:'no-store',
      signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-Device-Id':getDeviceId()},
      body:JSON.stringify({access_token:login.access_token})});
    return parseSessionResponse(response);
  }
  async function ownerCoverage(change=null){
    const response=await fetch(`${BACKEND_ORIGIN}/admin-api/access/coverage`,{
      method:change===null?'GET':'POST',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',...(await opsManagerAuthHeaders())},
      ...(change===null?{}:{body:JSON.stringify(change)})});
    const result=await response.json().catch(()=>null);
    if(!response.ok||!result?.ok)throw new Error(result?.error||'Coverage settings could not be read.');
    return result.data;
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
    if(options.forceRefresh!==true&&existing&&(sessionAccessLevel(existing)===requested||existing.permissions?.schema==='custodial.manager-permissions.v1'))return existing;

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
      if(options.throwOnFailure===true)throw new Error('Sign in on the Hub entry page using your existing Memphis Zoo Map email and password.');
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

  function isOpsManagerOpenSurface(){return false;}

  window.MemphisAuth={
    listOpsManagerTrustedDevices,renameOpsManagerTrustedDevice,
    revokeOpsManagerTrustedDevice,revokeAllOpsManagerTrustedDevices,requestTrustedOpsSession,
    deviceSecuritySession,unlockDeviceSecurity,lockDeviceSecurity,deviceSecurityAuthHeaders,
    requireOpsManagerSession,opsManagerAuthHeaders,
    readSession,clearSession,getDeviceId,isOpsManager,isReadOnlySession,
    canMutateOpsManagerSurface,hasRole,hasPermission,signInWithMap,ownerCoverage,redirectToManagerHub,requestPublicOpsSession:requestTrustedOpsSession,normalizeAccessLevel,
    opsManagerAuthDisabled:false,authUrl:AUTH_URL,backendOrigin:BACKEND_ORIGIN,getCSTDate,getCSTDateString,getOperationalServiceDate,getChicagoMinutes,
    isOpsManagerOpenSurface,normalizeDeviceId,managerOverviewDeviceIds:MANAGER_OVERVIEW_DEVICE_IDS
  };
})();
