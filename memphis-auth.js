(function(){
  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const GEMINI_SESSION_KEY='memphisGeminiAdminSession.v1';
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const DEFAULT_MANAGER_HUB='./start_page1.html';
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);
  const OPEN_SESSION_TTL_MS=8*60*60*1000;

  function purgeRetiredClientAccessState(){
    try{
      const retiredKey=String.fromCharCode(109,101,109,112,104,105,115,68,97,105,108,121,80,105,110,83,101,115,115,105,111,110,46,118,49);
      localStorage.removeItem(retiredKey);
    }catch{}
  }
  purgeRetiredClientAccessState();

  function getCSTDate(date=new Date()){
    return date.toLocaleString('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
  }
  function getCSTDateString(){ return getCSTDate(); }

  function normalizeDeviceId(value){
    const raw=String(value||'').trim();
    if(!raw) return '';
    if(/^kiosk[-_]?\d+$/i.test(raw)){
      const digits=(raw.match(/\d+/)||[''])[0];
      if(!digits) return raw.toUpperCase();
      return `KIOSK_${digits.padStart(2,'0')}`;
    }
    return raw.toUpperCase();
  }

  function getDeviceId(){
    const pageConfig=window.CONFIG||{};
    const config={
      DEVICE_STORAGE_KEY:pageConfig.AUTH_DEVICE_STORAGE_KEY||pageConfig.DEVICE_STORAGE_KEY||DEVICE_KEY,
      DEV_FALLBACK_DEVICE_ID:pageConfig.DEV_FALLBACK_DEVICE_ID||''
    };
    const stored=String(localStorage.getItem(config.DEVICE_STORAGE_KEY)||'').trim();
    if(stored) return stored;
    if(location.hostname.includes('github.io')){
      const fallback=String(config.DEV_FALLBACK_DEVICE_ID||'').trim();
      if(fallback){
        try{localStorage.setItem(config.DEVICE_STORAGE_KEY,fallback);}catch{}
        try{localStorage.setItem(DEVICE_KEY,fallback);}catch{}
        return fallback;
      }
    }
    let id=localStorage.getItem(DEVICE_KEY)||localStorage.getItem(LEGACY_DEVICE_KEY)||'';
    if(!id){id=`device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;}
    try{localStorage.setItem(config.DEVICE_STORAGE_KEY,id);}catch{}
    try{localStorage.setItem(DEVICE_KEY,id);}catch{}
    return id;
  }

  function buildOpenOpsSession(role='ops_manager'){
    return {
      token:'ops-manager-open-access',
      role,
      device_id:getDeviceId(),
      operational_day:getCSTDateString(),
      expires_at:new Date(Date.now()+OPEN_SESSION_TTL_MS).toISOString(),
      auth_mode:'open'
    };
  }

  function readSession(){ return buildOpenOpsSession('ops_manager'); }
  function clearSession(){}
  function isOpsManager(session){return !!(session&&session.role==='ops_manager');}

  function redirectToManagerHub(){
    const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target=new URL(DEFAULT_MANAGER_HUB,window.location.href);
    target.searchParams.set('return',current);
    window.location.replace(target.toString());
  }

  function readGeminiSession(){
    try{
      const session=JSON.parse(localStorage.getItem(GEMINI_SESSION_KEY)||'null');
      if(session&&session.token&&Date.parse(session.expires_at)>Date.now())return session;
    }catch{}
    localStorage.removeItem(GEMINI_SESSION_KEY);
    return null;
  }

  function clearGeminiSession(){localStorage.removeItem(GEMINI_SESSION_KEY);}

  async function loginGeminiAdmin(password){
    const response=await fetch(`${AUTH_URL}/gemini/login`,{
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok||!payload.data||!payload.data.token){
      const error=new Error((payload&&payload.error)||`Gemini login failed: HTTP ${response.status}`);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    localStorage.setItem(GEMINI_SESSION_KEY,JSON.stringify(payload.data));
    return payload.data;
  }

  async function verifyGeminiSession(){
    const session=readGeminiSession();
    if(!session)return null;
    const response=await fetch(`${AUTH_URL}/gemini/session`,{
      method:'GET',
      cache:'no-store',
      headers:{Authorization:`Bearer ${session.token}`}
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok){clearGeminiSession();return null;}
    return payload.data&&payload.data.session?{...session,...payload.data.session,token:session.token}:session;
  }

  async function requireGeminiAdminSession(options={}){
    const interactive=options.interactive!==false;
    const existing=await verifyGeminiSession();
    if(existing)return existing;
    if(!interactive)return null;
    for(let attempt=1;attempt<=3;attempt+=1){
      const password=(window.prompt('Enter Gemini password.')||'').trim();
      if(!password)throw new Error('Gemini password required.');
      try{return await loginGeminiAdmin(password);}
      catch(error){
        if(attempt>=3)throw error;
        window.alert(`Gemini password rejected. ${3-attempt} ${3-attempt===1?'try':'tries'} left.`);
      }
    }
    throw new Error('Gemini password required.');
  }

  async function requireOpsManagerSession(){ return buildOpenOpsSession('ops_manager'); }
  async function opsManagerAuthHeaders(){ return {'X-Device-Id':getDeviceId()}; }
  async function geminiAdminAuthHeaders(){
    const session=await requireGeminiAdminSession({interactive:true});
    return {Authorization:`Bearer ${session.token}`};
  }
  function isOpsManagerOpenSurface(){ return true; }

  window.MemphisAuth={
    loginGeminiAdmin,
    requireOpsManagerSession,
    requireGeminiAdminSession,
    opsManagerAuthHeaders,
    geminiAdminAuthHeaders,
    readSession,
    readGeminiSession,
    clearSession,
    clearGeminiSession,
    getDeviceId,
    isOpsManager,
    redirectToManagerHub,
    opsManagerAuthDisabled:true,
    authUrl:AUTH_URL,
    backendOrigin:BACKEND_ORIGIN,
    getCSTDate,
    getCSTDateString,
    isOpsManagerOpenSurface,
    normalizeDeviceId,
    managerOverviewDeviceIds:MANAGER_OVERVIEW_DEVICE_IDS
  };
})();
