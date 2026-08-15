(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const APP_VERSION = 'release-2026.07.19.custodial-v3.12';
  const ANNIE_RETURN_URL='https://memphis-zoo-mcp.onrender.com/moxie/';
  const ANNIE_ORIGIN_SESSION_KEY='mz_annie_origin_session';
  const state={currentDeviceId:'',session:null};
  const els={
    accessMode:document.getElementById('access-mode'),managerName:document.getElementById('manager-name'),managerTitle:document.getElementById('manager-title'),
    clock:document.getElementById('clock'),date:document.getElementById('date'),weatherValue:document.getElementById('weather-value'),weatherMeta:document.getElementById('weather-meta'),
    attendanceValue:document.getElementById('attendance-value'),attendanceMeta:document.getElementById('attendance-meta'),hubStatus:document.getElementById('hub-status'),buildStamp:document.getElementById('build-stamp'),
    messagesLink:document.getElementById('messages-link'),scheduleLink:document.getElementById('schedule-link'),eventsLink:document.getElementById('events-link'),eventsAdminLink:document.getElementById('events-admin-link'),
    dashboardLink:document.getElementById('dashboard-link'),insightsLink:document.getElementById('insights-link'),guestIssuesLink:document.getElementById('guest-issues-link'),feedbackLink:document.getElementById('feedback-link'),
    notificationsLink:document.getElementById('notifications-link'),phoneAssignmentsLink:document.getElementById('phone-assignments-link'),managerAccessLink:document.getElementById('manager-access-link'),
    deviceSecurityLink:document.getElementById('device-security-link'),geminiConsoleLink:document.getElementById('gemini-console-link'),moxieLink:document.getElementById('moxie-link'),
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
    const geminiConsoleUrl=preserveAnnieOrigin(new URL('./gemini-admin.html',window.location.href));
    const moxieUrl=new URL(ANNIE_RETURN_URL);
    const urls=[messagesUrl,scheduleUrl,eventsUrl,eventsAdminUrl,dashboardUrl,insightsUrl,guestIssuesUrl,feedbackUrl,notificationsUrl,phoneAssignmentsUrl,managerAccessUrl,deviceSecurityUrl,geminiConsoleUrl];
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
    els.geminiConsoleLink.href=geminiConsoleUrl.toString();
    els.moxieLink.href=moxieUrl.toString();
  }

  function applyRoleVisibility(session){
    const custodial=window.MemphisAuth.hasRole('CUSTODIAL_MANAGER',session);
    const security=window.MemphisAuth.hasRole('SECURITY_ADMIN',session);
    const displayName=String(session?.manager_display_name||'').trim();
    const title=String(session?.manager_job_title||'').trim();
    const isAnnie=displayName==='Annie Feist'||title==='Operations Admin';
    for(const element of [els.insightsLink,els.phoneAssignmentsLink,els.managerAccessLink,els.geminiConsoleLink])if(element)element.hidden=!custodial;
    if(els.deviceSecurityLink)els.deviceSecurityLink.hidden=!(custodial||security);
    if(els.moxieLink)els.moxieLink.hidden=!(custodial||isAnnie);
  }

  function showAccessRequired(){
    if(els.accessMode){els.accessMode.textContent='Named manager enrollment required';els.accessMode.className='accessMode';}
    const target=new URL('./ops-manager-hub.html',window.location.href);
    target.searchParams.set('return',`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.location.replace(target.toString());
  }

  function startClock(){
    const update=()=>{const now=new Date();els.clock.textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});els.date.textContent=now.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});};
    update();setInterval(update,1000);
  }

  async function refreshWeather(){
    try{
      const response=await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.1506&longitude=-89.9944&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FChicago&forecast_days=1',{cache:'no-store'});
      const data=await response.json();if(!response.ok||!data?.current)throw new Error(`HTTP ${response.status}`);
      const fahrenheit=(c)=>Math.round(Number(c)*9/5+32);const temp=fahrenheit(data.current.temperature_2m);const high=fahrenheit(data.daily?.temperature_2m_max?.[0]);const low=fahrenheit(data.daily?.temperature_2m_min?.[0]);
      const condition=weatherText(data.current.weather_code);els.weatherValue.textContent=`${temp}° · ${condition}`;els.weatherMeta.textContent=`High ${high}° / Low ${low}°`;
    }catch{els.weatherValue.textContent='Unavailable';els.weatherMeta.textContent='Weather feed could not refresh.';}
  }
  function weatherText(code){const value=Number(code);if(value===0)return'Clear';if([1,2,3].includes(value))return'Clouds';if([45,48].includes(value))return'Fog';if([51,53,55,56,57].includes(value))return'Drizzle';if([61,63,65,66,67,80,81,82].includes(value))return'Rain';if([71,73,75,77,85,86].includes(value))return'Snow';if([95,96,99].includes(value))return'Storms';return'Mixed';}

  async function refreshAttendance(){
    try{
      const response=await fetch(`${API}/dashboard-api/current-attendance`,{cache:'no-store'});const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);
      const data=payload.data||{};els.attendanceValue.textContent=Number.isFinite(Number(data.attendance))?Number(data.attendance).toLocaleString():'—';
      const planned=Number.isFinite(Number(data.planned))?Number(data.planned).toLocaleString():'—';els.attendanceMeta.textContent=`Planned ${planned}`;
    }catch{els.attendanceValue.textContent='Unavailable';els.attendanceMeta.textContent='Gate count feed could not refresh.';}
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
    await Promise.allSettled([refreshWeather(),refreshAttendance(),setBuildStamp(),refreshGuestFeature()]);
    setInterval(refreshAttendance,30000);setInterval(refreshWeather,600000);
  }

  void init().catch((error)=>setStatus(safe(error),'error'));
})();
