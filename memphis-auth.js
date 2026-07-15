(function(){
  'use strict';

  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const OPS_SESSION_URL=`${BACKEND_ORIGIN}/auth-api/session`;
  const OPS_SESSION_KEY='memphisOpsManagerSession.v2';
  const GEMINI_SESSION_KEY='memphisGeminiAdminSession.v1';
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const DEFAULT_MANAGER_HUB='./start_page1.html';
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);

  function purgeRetiredClientAccessState(){
    try{
      [
        String.fromCharCode(109,101,109,112,104,105,115,68,97,105,108,121,80,105,110,83,101,115,115,105,111,110,46,118,49),
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
    return ['read','readonly','read_only'].includes(normalized)?'read_only':'full_access';
  }

  function requestedAccessLevel(options={}){
    if(options.accessLevel||options.access_level)return normalizeAccessLevel(options.accessLevel||options.access_level);
    try{
      const url=new URL(window.location.href);
      return normalizeAccessLevel(url.searchParams.get('manager_access')||url.searchParams.get('access_level')||'full_access');
    }catch{return 'full_access';}
  }

  function normalizeDeviceId(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    if(/^kiosk[-_ ]?\d{1,2}$/i.test(raw)){
      const digits=(raw.match(/\d+/)||[''])[0];
      return digits?`KIOSK_${digits.padStart(2,'0')}`:raw.toUpperCase();
    }
    return raw;
  }

  function stableManagerBrowserId(){
    let value='';
    try{value=String(localStorage.getItem(DEVICE_KEY)||'').trim();}catch{}
    if(value&&!/^(visitor|device)-/i.test(value))return value;
    value=`manager-browser-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    try{localStorage.setItem(DEVICE_KEY,value);}catch{}
    return value;
  }

  function getDeviceId(){
    try{
      const shared=window.MemphisDeviceIdentity?.resolve?.({url:new URL(window.location.href)});
      if(shared?.deviceId)return shared.deviceId;
    }catch{}
    const url=new URL(window.location.href);
    const explicit=normalizeDeviceId(url.searchParams.get('device')||url.searchParams.get('deviceId')||'');
    if(explicit&&!/^(visitor|device)-/i.test(explicit)){
      try{localStorage.setItem(DEVICE_KEY,explicit);}catch{}
      return explicit;
    }
    for(const key of [DEVICE_KEY,LEGACY_DEVICE_KEY]){
      try{
        const value=normalizeDeviceId(localStorage.getItem(key)||'');
        if(value&&!/^(visitor|device)-/i.test(value))return value;
      }catch{}
    }
    return stableManagerBrowserId();
  }

  function readJsonStorage(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function writeJsonStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}

  function readSession(){
    const session=readJsonStorage(OPS_SESSION_KEY);
    if(session&&session.token&&session.role==='ops_manager'&&Date.parse(session.expires_at)>Date.now())return session;
    try{localStorage.removeItem(OPS_SESSION_KEY);}catch{}
    return null;
  }

  function clearSessionRecord(){try{localStorage.removeItem(OPS_SESSION_KEY);}catch{}}
  function clearSession(){clearSessionRecord();purgeRetiredClientAccessState();}

  function isOpsManager(session){return Boolean(session&&session.role==='ops_manager'&&session.token);}
  function isReadOnlySession(session=readSession()){return Boolean(session&&(session.read_only===true||session.access_level==='read_only'));}
  function canMutateOpsManagerSurface(session=readSession()){return Boolean(isOpsManager(session)&&!isReadOnlySession(session));}
  function sessionAccessLevel(session){return isReadOnlySession(session)?'read_only':'full_access';}

  async function parseSessionResponse(response){
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok||!payload.data?.session?.token){
      const error=new Error((payload&&payload.error)||`Ops Manager session failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    const session={...payload.data.session,token:payload.data.session.token};
    writeJsonStorage(OPS_SESSION_KEY,session);
    return session;
  }

  async function requestPublicOpsSession(accessLevel='full_access'){
    const normalized=normalizeAccessLevel(accessLevel);
    const url=new URL(OPS_SESSION_URL);
    url.searchParams.set('access_level',normalized);
    return parseSessionResponse(await fetch(url.toString(),{
      method:'GET',cache:'no-store',headers:{'X-Device-Id':getDeviceId()}
    }));
  }

  async function verifyStoredOpsSession(){
    const session=readSession();
    if(!session)return null;
    try{
      const response=await fetch(OPS_SESSION_URL,{
        method:'GET',cache:'no-store',headers:{Authorization:`Bearer ${session.token}`,'X-Device-Id':getDeviceId()}
      });
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.ok||!payload.data?.session){clearSessionRecord();return null;}
      const refreshed={...session,...payload.data.session,token:session.token};
      writeJsonStorage(OPS_SESSION_KEY,refreshed);
      return refreshed;
    }catch{return readSession();}
  }

  function redirectToManagerHub(accessLevel='full_access'){
    const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target=new URL(DEFAULT_MANAGER_HUB,window.location.href);
    target.searchParams.set('return',current);
    target.searchParams.set('manager_access',normalizeAccessLevel(accessLevel));
    window.location.replace(target.toString());
  }

  async function requireOpsManagerSession(options={}){
    const redirect=options.redirect===true;
    const requested=requestedAccessLevel(options);
    const existing=await verifyStoredOpsSession();
    if(existing&&sessionAccessLevel(existing)===requested)return existing;
    if(existing)clearSessionRecord();
    try{return await requestPublicOpsSession(requested);}catch(error){
      if(redirect&&!/\/start_page1\.html$/i.test(window.location.pathname||''))redirectToManagerHub(requested);
      if(options.throwOnFailure===true)throw error;
      return null;
    }
  }

  async function opsManagerAuthHeaders(){
    const session=await requireOpsManagerSession({redirect:false,throwOnFailure:true});
    return {Authorization:`Bearer ${session.token}`,'X-Device-Id':getDeviceId()};
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

  function isOpsManagerOpenSurface(){return true;}

  window.MemphisAuth={
    loginGeminiAdmin,requireOpsManagerSession,requireGeminiAdminSession,opsManagerAuthHeaders,geminiAdminAuthHeaders,
    readSession,readGeminiSession,clearSession,clearGeminiSession,getDeviceId,isOpsManager,isReadOnlySession,
    canMutateOpsManagerSurface,redirectToManagerHub,requestPublicOpsSession,normalizeAccessLevel,
    opsManagerAuthDisabled:true,authUrl:AUTH_URL,backendOrigin:BACKEND_ORIGIN,getCSTDate,getCSTDateString,
    isOpsManagerOpenSurface,normalizeDeviceId,managerOverviewDeviceIds:MANAGER_OVERVIEW_DEVICE_IDS
  };
})();
