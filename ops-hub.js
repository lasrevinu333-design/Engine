(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const APP_VERSION = 'release-2026.07.19.custodial-v3.12';
  const ANNIE_RETURN_URL='https://memphis-zoo-mcp.onrender.com/moxie/';
  const ANNIE_ORIGIN_SESSION_KEY='mz_annie_origin_session';
  const state={currentDeviceId:'',session:null};
  const els={
    accessMode:document.getElementById('access-mode'),managerName:document.getElementById('manager-name'),managerTitle:document.getElementById('manager-title'),
    clock:document.getElementById('clock'),date:document.getElementById('date'),weatherValue:document.getElementById('weather-value'),weatherMeta:document.getElementById('weather-meta'),weatherHours:document.getElementById('weather-hours'),hourlyMeta:document.getElementById('hourly-weather-meta'),weatherAlerts:document.getElementById('weather-alerts'),alertsMeta:document.getElementById('weather-alerts-meta'),
    attendanceValue:document.getElementById('attendance-value'),attendanceMeta:document.getElementById('attendance-meta'),hubStatus:document.getElementById('hub-status'),buildStamp:document.getElementById('build-stamp'),
    messagesLink:document.getElementById('messages-link'),scheduleLink:document.getElementById('schedule-link'),eventsLink:document.getElementById('events-link'),eventsAdminLink:document.getElementById('events-admin-link'),
    dashboardLink:document.getElementById('dashboard-link'),insightsLink:document.getElementById('insights-link'),guestIssuesLink:document.getElementById('guest-issues-link'),feedbackLink:document.getElementById('feedback-link'),
    notificationsLink:document.getElementById('notifications-link'),phoneAssignmentsLink:document.getElementById('phone-assignments-link'),managerAccessLink:document.getElementById('manager-access-link'),
    deviceSecurityLink:document.getElementById('device-security-link'),releaseCanaryLink:document.getElementById('release-canary-link'),geminiConsoleLink:document.getElementById('gemini-console-link'),moxieLink:document.getElementById('moxie-link'),
  };

  function isAnnieOrigin(url=new URL(window.location.href)){
    const marker=String(url.searchParams.get('origin')||'').trim().toLowerCase()==='annie';
    const fromAnnie=String(document.referrer||'').startsWith(ANNIE_RETURN_URL);
    if(marker||fromAnnie){try{sessionStorage.setItem(ANNIE_ORIGIN_SESSION_KEY,'1');}catch{}return true;}
    try{return sessionStorage.getItem(ANNIE_ORIGIN_SESSION_KEY)==='1';}catch{return false;}
  }
  function preserveAnnieOrigin(url){if(isAnnieOrigin())url.searchParams.set('origin','annie');return url;}
  function resolveDeviceId(){return String(window.MemphisAuth?.getDeviceId?.()||localStorage.getItem('memphisAssignedDeviceId')||localStorage.getItem('mz_scan_device_id')||'').trim();}
  function safe(error){return error instanceof Error?error.message:String(error||'Unknown error');}
  function setStatus(text='',kind=''){els.hubStatus.textContent=text;els.hubStatus.className=`uxStatus${kind?` ${kind}`:''}`;}

  function updateLinks(){
    const messagesUrl=preserveAnnieOrigin(new URL('./messages.html',window.location.href));
    const scheduleUrl=preserveAnnieOrigin(new URL('./schedule-weekly.html',window.location.href));
    const eventsUrl=preserveAnnieOrigin(new URL('./events.html',window.location.href));
    const eventsAdminUrl=preserveAnnieOrigin(new URL('./events-admin.html',window.location.href));
    const dashboardUrl=preserveAnnieOrigin(new URL('./dashboard.html',window.location.href));
    const insightsUrl=preserveAnnieOrigin(new URL('./operational-insights.html',window.location.href));
    const guestIssuesUrl=preserveAnnieOrigin(new URL('./guest-issues.html',window.location.href));
    const feedbackUrl=preserveAnnieOrigin(new URL('./system-feedback.html',window.location.href));
    const notificationsUrl=preserveAnnieOrigin(new URL('./notifications.html',window.location.href));
    const phoneAssignmentsUrl=preserveAnnieOrigin(new URL('./phone-assignments.html',window.location.href));
    const managerAccessUrl=preserveAnnieOrigin(new URL('./manager-access.html',window.location.href));
    const deviceSecurityUrl=preserveAnnieOrigin(new URL('./device-security.html',window.location.href));
    const releaseCanaryUrl=preserveAnnieOrigin(new URL('./admin.html#release-canary-controls',window.location.href));
    const geminiConsoleUrl=preserveAnnieOrigin(new URL('./gemini-admin.html',window.location.href));
    const moxieUrl=new URL(ANNIE_RETURN_URL);
    const urls=[messagesUrl,scheduleUrl,eventsUrl,eventsAdminUrl,dashboardUrl,insightsUrl,guestIssuesUrl,feedbackUrl,notificationsUrl,phoneAssignmentsUrl,managerAccessUrl,deviceSecurityUrl,releaseCanaryUrl,geminiConsoleUrl];
    for(const url of urls)url.searchParams.set('hub','manager');
    if(state.currentDeviceId){for(const url of urls)url.searchParams.set('device',state.currentDeviceId);moxieUrl.searchParams.set('device',state.currentDeviceId);}
    els.messagesLink.href=messagesUrl.toString();
    els.scheduleLink.href=scheduleUrl.toString();
    els.eventsLink.href=eventsUrl.toString();
    els.eventsAdminLink.href=eventsAdminUrl.toString();
    els.dashboardLink.href=dashboardUrl.toString();
    els.insightsLink.href=insightsUrl.toString();
    els.guestIssuesLink.href=guestIssuesUrl.toString();
    els.feedbackLink.href=feedbackUrl.toString();
    els.notificationsLink.href=notificationsUrl.toString();
    els.phoneAssignmentsLink.href=phoneAssignmentsUrl.toString();
    els.managerAccessLink.href=managerAccessUrl.toString();
    els.deviceSecurityLink.href=deviceSecurityUrl.toString();
    els.releaseCanaryLink.href=releaseCanaryUrl.toString();
    els.geminiConsoleLink.href=geminiConsoleUrl.toString();
    els.moxieLink.href=moxieUrl.toString();
  }

  function applyRoleVisibility(session){
    const custodial=window.MemphisAuth.hasRole('CUSTODIAL_MANAGER',session);
    const director=window.MemphisAuth.hasRole('DIRECTOR',session);
    const security=window.MemphisAuth.hasRole('SECURITY_ADMIN',session);
    const displayName=String(session?.manager_display_name||'').trim();
    const title=String(session?.manager_job_title||'').trim();
    const isAnnie=displayName==='Annie Feist'||title==='Operations Admin';
    for(const element of [els.insightsLink,els.phoneAssignmentsLink,els.managerAccessLink,els.geminiConsoleLink])if(element)element.hidden=!custodial;
    if(els.deviceSecurityLink)els.deviceSecurityLink.hidden=!(custodial||security);
    if(els.releaseCanaryLink)els.releaseCanaryLink.hidden=!(director||security);
    if(els.moxieLink)els.moxieLink.hidden=!(custodial||isAnnie);
  }

  function showAccessRequired(){
    if(els.accessMode){els.accessMode.textContent='Named manager enrollment required';els.accessMode.className='accessMode';}
    const target=new URL('./ops-manager-hub.html',window.location.href);
    target.searchParams.set('return',`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.location.replace(target.toString());
  }

  function startClock(){
    const update=()=>{const now=new Date();els.clock.textContent=now.toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});els.date.textContent=now.toLocaleDateString('en-US',{timeZone:'America/Chicago',weekday:'long',month:'short',day:'numeric',year:'numeric'});};
    update();setInterval(update,1000);
  }

  let factsModule=null,weatherRecord=null,alertsRecord=null;
  const homeFacts=()=>factsModule||(factsModule=import('./mobile/src/custodial/home-facts.js'));
  async function readFactSource(url){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(`HTTP ${response.status}`);return data;}
    finally{clearTimeout(timeout);}
  }
  async function refreshWeather(){
    const facts=await homeFacts();let failed=false;
    try{weatherRecord={data:await readFactSource(facts.HOME_WEATHER_URL),receivedAt:new Date().toISOString()};}catch{failed=true;}
    const data=weatherRecord?.data?{...weatherRecord.data,stale:failed}:null,current=facts.currentWeatherFacts(data,weatherRecord?.receivedAt),hourly=facts.weatherFacts(data,weatherRecord?.receivedAt);
    els.weatherValue.textContent=[current.temperature,current.condition].filter(Boolean).join(' · ');
    els.weatherMeta.textContent=[current.summary,current.detail].filter(Boolean).join(' · ');els.weatherMeta.classList.toggle('stale',current.stale);
    els.weatherHours.innerHTML=facts.weatherHoursHtml(hourly);els.hourlyMeta.textContent=hourly.detail;els.hourlyMeta.classList.toggle('stale',hourly.stale);
  }
  async function refreshWeatherAlerts(){
    const facts=await homeFacts();let failed=false;
    try{alertsRecord={data:await readFactSource(facts.HOME_WEATHER_ALERTS_URL),receivedAt:new Date().toISOString()};}catch{failed=true;}
    const data=alertsRecord?.data?{...alertsRecord.data,stale:failed}:null,value=facts.weatherAlertsFacts(data,alertsRecord?.receivedAt);
    els.weatherAlerts.innerHTML=facts.weatherAlertsHtml(value);els.alertsMeta.textContent=value.detail;els.alertsMeta.classList.toggle('stale',value.stale);
  }

  async function refreshAttendance(){
    try{
      const response=await fetch(`${API}/dashboard-api/current-attendance`,{cache:'no-store'});const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);
      const value=(await homeFacts()).attendanceFacts(payload.data||{});
      els.attendanceValue.textContent=value.value;
      els.attendanceMeta.textContent=[value.comparison,value.detail].filter(Boolean).join(' · ');
      els.attendanceMeta.classList.toggle('stale',value.stale);
    }catch{els.attendanceValue.textContent='Unavailable';els.attendanceMeta.textContent='Gate count feed could not refresh.';els.attendanceMeta.classList.add('stale');}
  }

  async function setBuildStamp(){
    try{const response=await fetch(`${API}/version`,{cache:'no-store'});const payload=await response.json().catch(()=>null);els.buildStamp.textContent=`${APP_VERSION}${payload?.version?` · ${payload.version}`:''}`;}
    catch{els.buildStamp.textContent=APP_VERSION;}
  }

  async function refreshGuestFeature(){
    if(!els.guestIssuesLink)return;
    try{
      const response=await fetch(`${API}/guest-api/status`,{cache:'no-store'});
      const payload=await response.json().catch(()=>null);
      els.guestIssuesLink.hidden=!(response.ok&&payload?.ok&&payload?.data?.enabled===true);
    }catch{els.guestIssuesLink.hidden=true;}
  }

  async function init(){
    state.currentDeviceId=resolveDeviceId();
    let session=null;
    try{session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:true,redirect:false,throwOnFailure:true});}
    catch(error){console.warn('Ops Manager access failed',error);}
    if(!session||window.MemphisAuth.isReadOnlySession(session)){showAccessRequired();return;}
    state.session=session;
    const returnPath=new URLSearchParams(window.location.search).get('return');
    if(returnPath){try{const resolved=new URL(returnPath,window.location.href);if(resolved.origin===window.location.origin&&!resolved.pathname.includes('..')){window.location.replace(resolved.toString());return;}}catch{}}
    const name=session.manager_display_name||'Operations Leadership';const title=session.manager_job_title||'';
    els.managerName.textContent=name;els.managerTitle.textContent=title;els.accessMode.textContent=`Full-access Ops Manager · ${name}`;els.accessMode.className='accessMode full';
    updateLinks();applyRoleVisibility(session);startClock();setStatus('Access current.','ok');
    await Promise.allSettled([refreshWeather(),refreshWeatherAlerts(),refreshAttendance(),setBuildStamp(),refreshGuestFeature()]);
    setInterval(refreshAttendance,30000);setInterval(refreshWeather,600000);setInterval(refreshWeatherAlerts,60000);
    const refreshFacts=()=>void Promise.allSettled([refreshWeather(),refreshWeatherAlerts(),refreshAttendance()]);
    window.addEventListener('online',refreshFacts);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFacts();});
  }

  void init().catch((error)=>setStatus(safe(error),'error'));
})();
