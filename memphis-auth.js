(function(){
  'use strict';

  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const OPS_SESSION_URL=`${AUTH_URL}/session`;
  const OPS_ENROLL_URL=`${AUTH_URL}/manager/enroll`;
  const OPS_LOGOUT_URL=`${AUTH_URL}/manager/logout`;
  const OPS_SESSION_KEY='memphisOpsManagerSession.v3';
  const GEMINI_SESSION_KEY='memphisGeminiAdminSession.v1';
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const DEFAULT_MANAGER_HUB='./start_page1.html';
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);
  let cachedOpsSession=null;
  const nativeFetch=window.fetch.bind(window);
  if(!window.__memphisCredentialFetchInstalled){
    window.__memphisCredentialFetchInstalled=true;
    window.fetch=function(input,init={}){
      let target='';
      try{target=new URL(typeof input==='string'?input:input?.url||'',window.location.href).origin;}catch{}
      if(target===BACKEND_ORIGIN)return nativeFetch(input,{...init,credentials:'include'});
      return nativeFetch(input,init);
    };
  }

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
    return ['full','write','full_access','administrator','admin'].includes(normalized)?'full_access':'read_only';
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
    return raw.replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,96);
  }

  function stableManagerBrowserId(){
    let value='';
    try{value=String(localStorage.getItem(DEVICE_KEY)||'').trim();}catch{}
    if(value&&!/^(visitor|device)-/i.test(value))return value;
    try{
      if(window.crypto&&typeof window.crypto.randomUUID==='function')value=`manager-browser-${window.crypto.randomUUID()}`;
    }catch{}
    if(!value)value=`manager-browser-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    try{localStorage.setItem(DEVICE_KEY,value);}catch{}
    return value;
  }

  function getDeviceId(){
    try{
      const shared=window.MemphisDeviceIdentity?.resolve?.({url:new URL(window.location.href)});
      if(shared?.deviceId)return normalizeDeviceId(shared.deviceId);
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

  function readJsonSessionStorage(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function writeJsonSessionStorage(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  function readJsonLocalStorage(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function writeJsonLocalStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}

  function readSession(){
    if(cachedOpsSession&&cachedOpsSession.role==='ops_manager')return cachedOpsSession;
    const session=readJsonSessionStorage(OPS_SESSION_KEY);
    if(session&&session.role==='ops_manager'){
      cachedOpsSession=session;
      return session;
    }
    return null;
  }

  function cacheSession(session){
    cachedOpsSession=session&&session.role==='ops_manager'?session:null;
    if(cachedOpsSession)writeJsonSessionStorage(OPS_SESSION_KEY,cachedOpsSession);
    else{try{sessionStorage.removeItem(OPS_SESSION_KEY);}catch{}}
    return cachedOpsSession;
  }

  function clearSessionRecord(){cacheSession(null);}

  function clearSession(){
    clearSessionRecord();
    purgeRetiredClientAccessState();
    fetch(OPS_LOGOUT_URL,{
      method:'POST',
      cache:'no-store',
      credentials:'include',
      headers:{'Content-Type':'application/json','X-Device-Id':getDeviceId()},
      body:JSON.stringify({device_id:getDeviceId()}),
    }).catch(()=>{});
  }

  function isOpsManager(session){return Boolean(session&&session.role==='ops_manager');}
  function isReadOnlySession(session=readSession()){return Boolean(session&&(session.read_only===true||session.access_level==='read_only'));}
  function canMutateOpsManagerSurface(session=readSession()){return Boolean(isOpsManager(session)&&!isReadOnlySession(session));}
  function sessionAccessLevel(session){return isReadOnlySession(session)?'read_only':'full_access';}

  async function parseSessionResponse(response){
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok||!payload.data?.session){
      const error=new Error((payload&&payload.error)||`Ops Manager session failed: HTTP ${response.status}`);
      error.status=response.status;error.payload=payload;throw error;
    }
    return cacheSession({...payload.data.session,token:undefined});
  }

  async function verifyStoredOpsSession(){
    try{
      const response=await fetch(OPS_SESSION_URL,{
        method:'GET',
        cache:'no-store',
        credentials:'include',
        headers:{'X-Device-Id':getDeviceId()},
      });
      if(!response.ok){clearSessionRecord();return null;}
      return await parseSessionResponse(response);
    }catch{
      return readSession();
    }
  }

  function managerDeviceLabel(){
    const platform=String(navigator.userAgentData?.platform||navigator.platform||'').trim();
    const browser=String(navigator.userAgent||'').slice(0,120);
    return `${platform||'Manager device'}${browser?` · ${browser}`:''}`.slice(0,160);
  }

  async function enrollManagerDevice(password,{accessLevel='full_access'}={}){
    const response=await fetch(OPS_ENROLL_URL,{
      method:'POST',
      cache:'no-store',
      credentials:'include',
      headers:{'Content-Type':'application/json','X-Device-Id':getDeviceId()},
      body:JSON.stringify({
        password:String(password||''),
        device_id:getDeviceId(),
        device_label:managerDeviceLabel(),
        access_level:normalizeAccessLevel(accessLevel),
      }),
    });
    return parseSessionResponse(response);
  }

  function promptForManagerPassword(){
    return String(window.prompt('Enter the Ops Manager password once for this device. This device will stay signed in until you log out, clear its browser data, or revoke it.')||'').trim();
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
    const interactive=options.interactive===true;
    const requested=requestedAccessLevel(options);
    const existing=await verifyStoredOpsSession();
    if(existing&&(requested==='read_only'||sessionAccessLevel(existing)==='full_access'||sessionAccessLevel(existing)===requested))return existing;
    if(existing&&requested==='full_access')clearSessionRecord();

    if(interactive){
      const password=promptForManagerPassword();
      if(password){
        try{return await enrollManagerDevice(password,{accessLevel:requested});}
        catch(error){
          if(options.throwOnFailure===true)throw error;
          window.alert(error?.message||'Ops Manager login failed.');
          return null;
        }
      }
    }

    if(redirect&&!/\/start_page1\.html$/i.test(window.location.pathname||''))redirectToManagerHub(requested);
    if(options.throwOnFailure===true)throw new Error('Ops Manager login required.');
    return null;
  }

  async function opsManagerAuthHeaders(){
    const session=await requireOpsManagerSession({redirect:false,interactive:false,throwOnFailure:true});
    if(!session)throw new Error('Ops Manager login required.');
    return {'X-Device-Id':getDeviceId()};
  }

  function readGeminiSession(){
    const session=readJsonLocalStorage(GEMINI_SESSION_KEY);
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
    writeJsonLocalStorage(GEMINI_SESSION_KEY,payload.data);
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
    loginGeminiAdmin,enrollManagerDevice,requireOpsManagerSession,requireGeminiAdminSession,opsManagerAuthHeaders,geminiAdminAuthHeaders,
    readSession,readGeminiSession,clearSession,clearGeminiSession,getDeviceId,isOpsManager,isReadOnlySession,
    canMutateOpsManagerSurface,redirectToManagerHub,normalizeAccessLevel,
    opsManagerAuthDisabled:false,authUrl:AUTH_URL,backendOrigin:BACKEND_ORIGIN,getCSTDate,getCSTDateString,
    isOpsManagerOpenSurface,normalizeDeviceId,managerOverviewDeviceIds:MANAGER_OVERVIEW_DEVICE_IDS
  };
})();
