(() => {
  'use strict';

  const API = window.MemphisAuth?.backendOrigin || 'https://memphis-zoo-mcp.onrender.com';
  const APP_VERSION = 'release-2026.07.19.custodial-v3.12';
  const ZONE = 'America/Chicago';
  const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
  const sourceInstant = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const localDay = time => new Intl.DateTimeFormat('en-CA', {timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
  const state={currentDeviceId:'',session:null,sessionBinding:'',auth:null,generation:0,retired:false};
  const intervals=new Set();
  const els={
    accessMode:document.getElementById('access-mode'),managerName:document.getElementById('manager-name'),managerTitle:document.getElementById('manager-title'),
    clock:document.getElementById('clock'),date:document.getElementById('date'),weatherValue:document.getElementById('weather-value'),weatherMeta:document.getElementById('weather-meta'),
    attendanceValue:document.getElementById('attendance-value'),attendanceMeta:document.getElementById('attendance-meta'),hubStatus:document.getElementById('hub-status'),buildStamp:document.getElementById('build-stamp'),
    messagesLink:document.getElementById('messages-link'),scheduleLink:document.getElementById('schedule-link'),
    dashboardLink:document.getElementById('dashboard-link'),dashboardMapLink:document.getElementById('dashboard-map-link'),insightsLink:document.getElementById('insights-link'),guestIssuesLink:document.getElementById('guest-issues-link'),feedbackLink:document.getElementById('feedback-link'),
    notificationsLink:document.getElementById('notifications-link'),phoneAssignmentsLink:document.getElementById('phone-assignments-link'),managerAccessLink:document.getElementById('manager-access-link'),
    deviceSecurityLink:document.getElementById('device-security-link'),releaseCanaryLink:document.getElementById('release-canary-link'),geminiConsoleLink:document.getElementById('gemini-console-link'),
  };

  function resolveDeviceId(){return String(window.MemphisAuth?.getDeviceId?.()||'').trim();}
  function safe(error){return error instanceof Error?error.message:String(error||'Unknown error');}
  function setStatus(text='',kind=''){els.hubStatus.textContent=text;els.hubStatus.className=`uxStatus${kind?` ${kind}`:''}`;}
  const coverageLink=document.getElementById('owner-coverage-link');
  const coverageHref=coverageLink?.href;
  const managerLinks=[els.messagesLink,els.scheduleLink,els.dashboardLink,els.dashboardMapLink,els.insightsLink,
    els.guestIssuesLink,els.feedbackLink,els.notificationsLink,els.phoneAssignmentsLink,els.managerAccessLink,
    els.deviceSecurityLink,els.releaseCanaryLink,els.geminiConsoleLink,coverageLink].filter(Boolean);
  // A rejection fence only. MemphisAuth remains the session/role authority;
  // an unchanged local snapshot does not prove current backend permission.
  function sessionBinding(session){
    return JSON.stringify([session.role,session.manager_id,session.credential_id,session.device_id,session.token,
      session.expires_at,session.access_level,session.read_only,session.trusted_device,
      session.roles,session.permissions,session.manager_display_name,session.manager_job_title]);
  }
  function clearManagerView(){
    for(const link of managerLinks){link.hidden=true;link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
    els.managerName.textContent='';els.managerTitle.textContent='';
    els.accessMode.textContent='Named manager access must be verified';els.accessMode.className='accessMode';
  }
  function retire(){
    if(state.retired)return;
    state.retired=true;state.generation++;
    for(const interval of intervals)clearInterval(interval);intervals.clear();
    clearManagerView();state.session=null;state.sessionBinding='';
    setStatus('Manager access changed or page retired. Reload to verify access.','error');
  }
  function current(generation){
    if(state.retired||generation!==state.generation)return false;
    try{
      const auth=window.MemphisAuth,session=auth?.readSession?.();
      if(auth!==state.auth||!session||session!==state.session||!auth.isOpsManager(session)
        ||resolveDeviceId()!==state.currentDeviceId||session.device_id!==state.currentDeviceId
        ||sessionBinding(session)!==state.sessionBinding){retire();return false;}
      return true;
    }catch{retire();return false;}
  }
  function every(callback,delay){
    const handle=setInterval(callback,delay);intervals.add(handle);
  }
  for(const link of managerLinks)link.addEventListener('click',event=>{if(!current(state.generation))event.preventDefault();});
  window.addEventListener('pagehide',retire);
  const checkIdentity=()=>{if(state.session)current(state.generation);
    else if(state.currentDeviceId&&resolveDeviceId()!==state.currentDeviceId)retire();};
  window.addEventListener('storage',checkIdentity);window.addEventListener('focus',checkIdentity);
  document.addEventListener('visibilitychange',checkIdentity);

  function updateLinks(){
    if(!current(state.generation))return;
    const messagesUrl=new URL('./messages.html',window.location.href);
    const scheduleUrl=new URL('./schedule-weekly.html',window.location.href);
    const dashboardMapUrl=new URL('./operations-dashboard.html',window.location.href);
    const dashboardUrl=new URL('./dashboard.html',window.location.href);
    const insightsUrl=new URL('./operational-insights.html',window.location.href);
    const guestIssuesUrl=new URL('./guest-issues.html',window.location.href);
    const feedbackUrl=new URL('./system-feedback.html',window.location.href);
    const notificationsUrl=new URL('./notifications.html',window.location.href);
    const phoneAssignmentsUrl=new URL('./phone-assignments.html',window.location.href);
    const managerAccessUrl=new URL('./manager-access.html',window.location.href);
    const deviceSecurityUrl=new URL('./device-security.html',window.location.href);
    const releaseCanaryUrl=new URL('./admin.html#release-canary-controls',window.location.href);
    const geminiConsoleUrl=new URL('./gemini-admin.html',window.location.href);
    const urls=[messagesUrl,scheduleUrl,dashboardUrl,dashboardMapUrl,insightsUrl,guestIssuesUrl,feedbackUrl,notificationsUrl,phoneAssignmentsUrl,managerAccessUrl,deviceSecurityUrl,releaseCanaryUrl,geminiConsoleUrl];
    for(const url of urls)url.searchParams.set('hub','manager');
    if(state.currentDeviceId){for(const url of urls)url.searchParams.set('device',state.currentDeviceId);}
    els.messagesLink.href=messagesUrl.toString();
    els.scheduleLink.href=scheduleUrl.toString();
    els.dashboardLink.href=dashboardUrl.toString();
    els.dashboardMapLink.href=dashboardMapUrl.toString();
    els.insightsLink.href=insightsUrl.toString();
    els.guestIssuesLink.href=guestIssuesUrl.toString();
    els.feedbackLink.href=feedbackUrl.toString();
    els.notificationsLink.href=notificationsUrl.toString();
    els.phoneAssignmentsLink.href=phoneAssignmentsUrl.toString();
    els.managerAccessLink.href=managerAccessUrl.toString();
    els.deviceSecurityLink.href=deviceSecurityUrl.toString();
    els.releaseCanaryLink.href=releaseCanaryUrl.toString();
    els.geminiConsoleLink.href=geminiConsoleUrl.toString();
    for(const link of managerLinks){link.hidden=false;link.removeAttribute('aria-disabled');}
    if(coverageLink&&coverageHref)coverageLink.href=coverageHref;
    // A current positive feature response, not old display state, exposes it.
    els.guestIssuesLink.hidden=true;
  }

  function applyRoleVisibility(session){
    if(!current(state.generation))return;
    const owner=window.MemphisAuth.canMutateOpsManagerSurface(session);
    const coverageLink=document.getElementById('owner-coverage-link');if(coverageLink)coverageLink.hidden=!owner;
    const custodial=window.MemphisAuth.hasRole('CUSTODIAL_MANAGER',session);
    const director=window.MemphisAuth.hasRole('DIRECTOR',session);
    const security=window.MemphisAuth.hasRole('SECURITY_ADMIN',session);
    for(const element of [els.insightsLink,els.phoneAssignmentsLink,els.managerAccessLink,els.geminiConsoleLink])if(element)element.hidden=!custodial;
    if(els.deviceSecurityLink)els.deviceSecurityLink.hidden=!(custodial||security);
    if(els.releaseCanaryLink)els.releaseCanaryLink.hidden=!(director||security);
  }

  function showAccessRequired(){
    if(els.accessMode){els.accessMode.textContent='Named manager enrollment required';els.accessMode.className='accessMode';}
    const target=new URL('./ops-manager-hub.html',window.location.href);
    target.searchParams.set('return',`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.location.replace(target.toString());
  }

  function startClock(generation){
    const update=()=>{if(!current(generation))return;const now=new Date();els.clock.textContent=now.toLocaleTimeString([],{timeZone:ZONE,hour:'numeric',minute:'2-digit'});els.date.textContent=now.toLocaleDateString([],{timeZone:ZONE,weekday:'long',month:'short',day:'numeric'});};
    update();every(update,1000);
  }

  async function refreshWeather(){
    const generation=state.generation;if(!current(generation))return;
    try{
      const response=await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.1506&longitude=-89.9944&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timeformat=unixtime&timezone=America%2FChicago&forecast_days=1',{cache:'no-store'});
      if(!current(generation))return;
      const data=await response.json();if(!current(generation))return;if(!response.ok||!data?.current)throw new Error(`HTTP ${response.status}`);
      const now=Date.now(),temp=numeric(data.current.temperature_2m),observed=numeric(data.current.time);
      if(temp===null||observed===null||data.current_units?.time!=='unixtime'||data.current_units?.temperature_2m!=='°F'||observed*1000>now+60000||observed*1000<now-86400000)throw new Error('Weather observation unavailable');
      const daily=data.daily,idx=Array.isArray(daily?.time)&&data.daily_units?.time==='unixtime'?daily.time.findIndex(t=>numeric(t)!==null&&localDay(Number(t)*1000)===localDay(now)):-1;
      const high=numeric(daily?.temperature_2m_max?.[idx]),low=numeric(daily?.temperature_2m_min?.[idx]);
      const extremes=idx>=0&&data.daily_units?.temperature_2m_max==='°F'&&data.daily_units?.temperature_2m_min==='°F'&&high!==null&&low!==null&&high>=low?`High ${Math.round(high)}° / Low ${Math.round(low)}°`:'Daily high/low unavailable';
      const stale=now-observed*1000>45*60000,at=new Date(observed*1000).toLocaleTimeString([],{timeZone:ZONE,hour:'numeric',minute:'2-digit'});
      els.weatherValue.textContent=`${Math.round(temp)}°F · ${weatherText(data.current.weather_code)}`;els.weatherMeta.textContent=`${extremes} · ${stale?'Stale forecast':'Forecast updated'} ${at} Central`;
      els.weatherMeta.classList.toggle('stale',stale);
    }catch{if(!current(generation))return;els.weatherValue.textContent='Unavailable';els.weatherMeta.textContent='Weather feed could not refresh.';els.weatherMeta.classList.add('stale');}
  }
  function weatherText(code){const value=numeric(code);if(value===0)return'Clear';if([1,2,3].includes(value))return'Clouds';if([45,48].includes(value))return'Fog';if([51,53,55,56,57].includes(value))return'Drizzle';if([61,63,65,66,67,80,81,82].includes(value))return'Rain';if([71,73,75,77,85,86].includes(value))return'Snow';if([95,96,99].includes(value))return'Storms';return'Conditions unavailable';}

  async function refreshAttendance(){
    const generation=state.generation;if(!current(generation))return;
    try{
      const response=await fetch(`${API}/dashboard-api/current-attendance`,{cache:'no-store'});if(!current(generation))return;
      const payload=await response.json().catch(()=>null);if(!current(generation))return;
      if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);
      const data=payload.data||{},count=numeric(data.attendance),now=Date.now();
      if(count===null||!Number.isSafeInteger(count)||count<0||data.available===false)throw new Error('Guest count unavailable');
      const at=sourceInstant(data.source_timestamp||data.fetched_at||data.updated_at),declared=data.service_date??data.date;
      if(at!==null&&(at>now+60000||localDay(at)!==localDay(now))||declared!==undefined&&declared!==localDay(now))throw new Error('Today’s guest count unavailable');
      const freshnessUnknown=at===null||typeof data.stale!=='boolean',stale=freshnessUnknown||data.stale===true||now-at>3600000;
      els.attendanceValue.textContent=count.toLocaleString();
      const plan=numeric(data.planned),planned=plan!==null&&Number.isSafeInteger(plan)&&plan>=0?plan.toLocaleString():'unavailable';
      const sourceLabel=at!==null?new Date(at).toLocaleTimeString([],{timeZone:ZONE,hour:'numeric',minute:'2-digit'}):'unknown';
      els.attendanceMeta.textContent=`${freshnessUnknown?'Gate count; freshness unknown':stale?'Stale gate count':'Current gate count'} · Planned ${planned} · source ${sourceLabel}${at!==null?' Central':''}`;
      els.attendanceMeta.classList.toggle('stale',stale);
    }catch{if(!current(generation))return;els.attendanceValue.textContent='Unavailable';els.attendanceMeta.textContent='Gate count feed could not refresh.';els.attendanceMeta.classList.add('stale');}
  }

  async function setBuildStamp(){
    const generation=state.generation;if(!current(generation))return;
    try{const response=await fetch(`${API}/version`,{cache:'no-store'});if(!current(generation))return;const payload=await response.json().catch(()=>null);if(!current(generation))return;els.buildStamp.textContent=`${APP_VERSION}${payload?.version?` · ${payload.version}`:''}`;}
    catch{if(current(generation))els.buildStamp.textContent=APP_VERSION;}
  }

  async function refreshGuestFeature(){
    const generation=state.generation;if(!current(generation))return;
    if(!els.guestIssuesLink)return;
    try{
      const response=await fetch(`${API}/guest-api/status`,{cache:'no-store'});
      if(!current(generation))return;
      const payload=await response.json().catch(()=>null);
      if(!current(generation))return;
      els.guestIssuesLink.hidden=!(response.ok&&payload?.ok&&payload?.data?.enabled===true);
    }catch{if(current(generation))els.guestIssuesLink.hidden=true;}
  }

  async function init(){
    const generation=++state.generation;state.auth=window.MemphisAuth;
    clearManagerView();
    state.currentDeviceId=resolveDeviceId();
    if(!state.currentDeviceId||!['getDeviceId','readSession','isOpsManager','requireOpsManagerSession','hasRole','canMutateOpsManagerSurface']
      .every(method=>typeof state.auth?.[method]==='function')){showAccessRequired();return;}
    const priorSession=state.auth.readSession(),priorBinding=priorSession?sessionBinding(priorSession):'';
    let session=null;
    try{session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:true,redirect:false,throwOnFailure:true});}
    catch(error){console.warn('Ops Manager access failed',error);}
    if(state.retired||generation!==state.generation)return;
    if(priorSession&&(session!==priorSession||sessionBinding(session)!==priorBinding)){retire();return;}
    if(!session||!window.MemphisAuth.isOpsManager(session)){showAccessRequired();return;}
    state.session=session;
    state.sessionBinding=sessionBinding(session);
    if(!current(generation))return;
    const returnPath=new URLSearchParams(window.location.search).get('return');
    if(returnPath){try{const resolved=new URL(returnPath,window.location.href);if(resolved.origin===window.location.origin&&!resolved.pathname.includes('..')){window.location.replace(resolved.toString());return;}}catch{}}
    const name=session.manager_display_name||'Operations Leadership';const title=session.manager_job_title||'';
    els.managerName.textContent=name;els.managerTitle.textContent=title;els.accessMode.textContent=`${window.MemphisAuth.canMutateOpsManagerSurface(session)?"Owner · full control":"Read-only · absence routes, CoverAll and scan tickets"} · ${name}`;els.accessMode.className=window.MemphisAuth.canMutateOpsManagerSurface(session)?"accessMode full":"accessMode";
    updateLinks();applyRoleVisibility(session);startClock(generation);setStatus('Access current.','ok');
    await Promise.allSettled([refreshWeather(),refreshAttendance(),setBuildStamp(),refreshGuestFeature()]);
    if(!current(generation))return;
    every(refreshAttendance,30000);every(refreshWeather,600000);
  }

  void init().catch((error)=>{if(!state.retired)setStatus(safe(error),'error');});
})();
