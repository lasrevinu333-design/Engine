(function(){
  const BACKEND_ORIGIN='https://memphis-zoo-mcp.onrender.com';
  const AUTH_URL=`${BACKEND_ORIGIN}/auth-api`;
  const SESSION_KEY='memphisDailyPinSession.v1';
  const DEVICE_KEY='memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY='mz_scan_device_id';
  const DEFAULT_MANAGER_HUB='./start_page1.html';
  const OPS_MANAGER_OPEN_PAGES=new Set(['start_page1.html','admin.html','dashboard.html','events-admin.html','schedule-simple.html','schedule.html','gemini-admin.html']);
  const MANAGER_OVERVIEW_DEVICE_IDS=new Set(['1E74FE4C-DC20B3B9','KIOSK_01','KIOSK_1']);
  const OPEN_SESSION_TTL_MS=8*60*60*1000;

  // Central Standard Time (America/Chicago) - handles DST automatically
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
      const padded=digits.padStart(2,'0');
      return `KIOSK_${padded}`;
    }
    return raw.toUpperCase();
  }

  function isOpsManagerOpenSurface(){
    try{
      const url=new URL(window.location.href);
      if(url.searchParams.get('dev')==='1') return true;
      if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1') return true;
      const page=String(url.pathname||'').split('/').pop()||'';
      if(!OPS_MANAGER_OPEN_PAGES.has(page)) return false;
      const explicit=normalizeDeviceId(url.searchParams.get('device')||url.searchParams.get('deviceId'));
      const stored=normalizeDeviceId(localStorage.getItem(DEVICE_KEY)||localStorage.getItem(LEGACY_DEVICE_KEY));
      const pageConfig=window.CONFIG||{};
      const fallback=normalizeDeviceId(pageConfig.DEV_FALLBACK_DEVICE_ID||'');
      if(explicit)return MANAGER_OVERVIEW_DEVICE_IDS.has(explicit);
      return [stored,fallback].some((id)=>MANAGER_OVERVIEW_DEVICE_IDS.has(id));
    }catch{}
    return false;
  }

  const OPS_MANAGER_AUTH_DISABLED=isOpsManagerOpenSurface();

  function buildOpenSession(role='ops_manager'){
    return {
      token:'ops-manager-open-access',
      role,
      device_id:getDeviceId(),
      operational_day:getCSTDateString(),
      expires_at:new Date(Date.now()+OPEN_SESSION_TTL_MS).toISOString(),
      auth_mode:'open'
    };
  }

  function getDeviceId(){
    const pageConfig=window.CONFIG||{};
    const CONFIG={
      DEVICE_STORAGE_KEY:pageConfig.AUTH_DEVICE_STORAGE_KEY||pageConfig.DEVICE_STORAGE_KEY||DEVICE_KEY,
      DEV_FALLBACK_DEVICE_ID:pageConfig.DEV_FALLBACK_DEVICE_ID||''
    };
    const stored=String(localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY)||'').trim(); if(stored) return stored; if(location.hostname.includes('github.io')){
      const fallback=String(CONFIG.DEV_FALLBACK_DEVICE_ID||'').trim();
      if(fallback){
        try{localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY,fallback);}catch{}
        try{localStorage.setItem(DEVICE_KEY,fallback);}catch{}
        return fallback;
      }
    }
    let id=localStorage.getItem(DEVICE_KEY)||localStorage.getItem(LEGACY_DEVICE_KEY)||'';
    if(!id){id=`device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;}
    try{localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY,id);}catch{}
    localStorage.setItem(DEVICE_KEY,id);
    return id;
  }

  function readSession(){
    try{
      const session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      if(session&&session.token&&Date.parse(session.expires_at)>Date.now())return session;
    }catch{}
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  function clearSession(){localStorage.removeItem(SESSION_KEY);}

  function isOpsManager(session){return !!(session&&session.role==='ops_manager'&&session.token);}

  function redirectToManagerHub(){
    const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target=new URL(DEFAULT_MANAGER_HUB,window.location.href);
    target.searchParams.set('return',current);
    window.location.replace(target.toString());
  }

  async function loginWithPin(pin,role='ops_manager'){
    const response=await fetch(`${AUTH_URL}/pin/login`,{
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({pin,device_id:getDeviceId(),role})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok||!payload.data||!payload.data.token){
      const error=new Error((payload&&payload.error)||`PIN login failed: HTTP ${response.status}`);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    localStorage.setItem(SESSION_KEY,JSON.stringify(payload.data));
    return payload.data;
  }

  async function verifySession(role='ops_manager'){
    const session=readSession();
    if(OPS_MANAGER_AUTH_DISABLED&&role==='ops_manager'){
      if(session&&isOpsManager(session))return session;
      const openSession=buildOpenSession(role);
      localStorage.setItem(SESSION_KEY,JSON.stringify(openSession));
      return openSession;
    }
    if(!session)return null;
    if(role==='ops_manager'&&!isOpsManager(session))return null;
    const response=await fetch(`${AUTH_URL}/session`,{
      method:'GET',
      cache:'no-store',
      headers:{Authorization:`Bearer ${session.token}`,'X-Device-Id':getDeviceId()}
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload||!payload.ok){clearSession();return null;}
    return session;
  }

  async function requireOpsManagerSession(options={}){
    if(OPS_MANAGER_AUTH_DISABLED)return await verifySession('ops_manager');
    const interactive=options.interactive!==false;
    const redirect=options.redirect===true;
    const existing=await verifySession('ops_manager');
    if(existing)return existing;
    if(redirect){redirectToManagerHub();return null;}
    if(!interactive)return null;
    for(let attempt=1;attempt<=3;attempt+=1){
      const pin=(window.prompt('Enter today\'s Ops Manager PIN.')||'').trim();
      if(!pin)throw new Error('Ops Manager PIN required.');
      try{return await loginWithPin(pin,'ops_manager');}
      catch(error){
        if(error.status===429)throw error;
        if(attempt>=3)throw error;
        window.alert(`PIN rejected. ${3-attempt} ${3-attempt===1?'try':'tries'} left.`);
      }
    }
    throw new Error('Ops Manager PIN required.');
  }

  async function opsManagerAuthHeaders(){
    if(OPS_MANAGER_AUTH_DISABLED)return {'X-Device-Id':getDeviceId()};
    const session=await requireOpsManagerSession({interactive:true});
    return {Authorization:`Bearer ${session.token}`,'X-Device-Id':getDeviceId()};
  }

  window.MemphisAuth={
    loginWithPin,
    requireOpsManagerSession,
    opsManagerAuthHeaders,
    readSession,
    clearSession,
    getDeviceId,
    isOpsManager,
    redirectToManagerHub,
    opsManagerAuthDisabled:OPS_MANAGER_AUTH_DISABLED,
    authUrl:AUTH_URL,
    backendOrigin:BACKEND_ORIGIN,
    getCSTDate,
    getCSTDateString,
    isOpsManagerOpenSurface
  };
})();
