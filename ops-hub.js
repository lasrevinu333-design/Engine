import { installManagerWeather } from './mobile/src/manager/home-weather.js?v=2026.11.11.weather-details';
(() => {
  'use strict';

  const API = window.MemphisAuth?.backendOrigin || 'https://memphis-zoo-mcp.onrender.com';
  const APP_VERSION = 'release-2026.07.19.custodial-v3.12';
  const ZONE = 'America/Chicago';
  const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
  const sourceInstant = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const localDay = time => new Intl.DateTimeFormat('en-CA', {timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
  const state={currentDeviceId:'',session:null,sessionBinding:'',admittedOwnerBinding:'',auth:null,authMethods:null,generation:0,retired:false,suspended:false,resumeBinding:'',verifying:true,renewing:null};
  const authMethodNames=['getDeviceId','readSession','isOpsManager','requireOpsManagerSession','hasRole','canMutateOpsManagerSurface','isCustodialManagementAdmin'];
  const intervals=new Set();
  const els={
    accessMode:document.getElementById('access-mode'),managerName:document.getElementById('manager-name'),managerTitle:document.getElementById('manager-title'),
    clock:document.getElementById('clock'),date:document.getElementById('date'),weatherValue:document.getElementById('weather-value'),weatherMeta:document.getElementById('weather-meta'),
    attendanceValue:document.getElementById('attendance-value'),attendanceMeta:document.getElementById('attendance-meta'),hubStatus:document.getElementById('hub-status'),buildStamp:document.getElementById('build-stamp'),
    messagesLink:document.getElementById('messages-link'),scheduleLink:document.getElementById('schedule-link'),eventsLink:document.getElementById('events-link'),
    dashboardLink:document.getElementById('dashboard-link'),dashboardMapLink:document.getElementById('dashboard-map-link'),insightsLink:document.getElementById('insights-link'),guestIssuesLink:document.getElementById('guest-issues-link'),feedbackLink:document.getElementById('feedback-link'),
    notificationsLink:document.getElementById('notifications-link'),phoneAssignmentsLink:document.getElementById('phone-assignments-link'),
    deviceSecurityLink:document.getElementById('device-security-link'),releaseCanaryLink:document.getElementById('release-canary-link'),geminiConsoleLink:document.getElementById('gemini-console-link'),
  };

  const weatherIds={'manager-home-date':'date','manager-home-clock':'clock','manager-weather-current':'weather-value','manager-weather-summary':'weather-meta'};
  const weather=installManagerWeather({document:{getElementById:id=>document.getElementById(weatherIds[id]||id)},isVisible:()=>!document.hidden&&current(state.generation)});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)weather.stop({clear:false});else if(state.session&&!state.retired)void weather.start();});

  function resolveDeviceId(){return String(window.MemphisAuth?.getDeviceId?.()||'').trim();}
  function safe(error){return error instanceof Error?error.message:String(error||'Unknown error');}
  function setStatus(text='',kind=''){els.hubStatus.textContent=text;els.hubStatus.className=`uxStatus${kind?` ${kind}`:''}`;}
  const coverageLink=document.getElementById('owner-coverage-link');
  const coverageHref=coverageLink?.href;
  const managerLinks=[els.messagesLink,els.scheduleLink,els.eventsLink,els.dashboardLink,els.dashboardMapLink,els.insightsLink,
    els.guestIssuesLink,els.feedbackLink,els.notificationsLink,els.phoneAssignmentsLink,
    els.deviceSecurityLink,els.releaseCanaryLink,els.geminiConsoleLink,coverageLink].filter(Boolean);
  // A rejection fence only. MemphisAuth remains the session/role authority;
  // an unchanged local snapshot does not prove current backend permission.
  function sessionBinding(session){
    return JSON.stringify([session.role,session.manager_id,session.credential_id,session.device_id,session.token,
      session.expires_at,session.access_level,session.read_only,session.trusted_device,
      session.roles,session.permissions,session.manager_display_name,session.manager_job_title,
      session.auth_mode,session.owner,session.custodial_management_admin,session.claimed_manager_id,
      session.claimed_manager_display_name,session.identity_assurance,session.individual_identity_verified]);
  }
  function resumeBinding(session){
    if(!session)return '';
    // A renewed bearer may change. The person, device and effective access may
    // not be substituted while a suspended page is being revalidated.
    const {token,expires_at,...bound}=session;void token;void expires_at;
    return sessionBinding(bound);
  }
  function clearManagerView(){
    for(const link of managerLinks){link.hidden=true;link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
    els.managerName.textContent='';els.managerTitle.textContent='';
    els.accessMode.textContent='Restoring manager access…';els.accessMode.className='accessMode';
  }
  function originalAuthMethods(auth,methods){
    return !!auth&&!!methods&&authMethodNames.every(name=>auth[name]===methods[name]);
  }
  function stopRefreshes(){
    weather.stop();for(const interval of intervals)clearInterval(interval);intervals.clear();
  }
  function renewKnownOwner(){
    if(state.retired||state.suspended||state.renewing||!state.session)return;
    const expectedBinding=state.admittedOwnerBinding,methods=state.authMethods;
    if(!expectedBinding||sessionBinding(state.session)!==state.sessionBinding){retire();return;}
    state.resumeBinding=expectedBinding;state.verifying=true;state.generation++;
    stopRefreshes();clearManagerView();state.session=null;state.sessionBinding='';
    setStatus('Checking saved manager access…');
    const pending=Promise.resolve().then(()=>init({resuming:true,expectedBinding,expectedMethods:methods}))
      .catch(()=>{if(!state.retired&&!state.suspended)setStatus('Manager access could not be checked. Retrying…','error');})
      .finally(()=>{if(state.renewing===pending)state.renewing=null;});
    state.renewing=pending;
  }
  function retire({persisted=false}={}){
    if(state.retired)return;
    state.resumeBinding=persisted?(state.resumeBinding||state.admittedOwnerBinding):'';
    state.suspended=persisted;state.retired=!persisted;state.verifying=false;state.generation++;stopRefreshes();
    clearManagerView();state.session=null;state.sessionBinding='';
    setStatus(persisted?'Verifying manager access when this page returns.':'Manager access changed or page retired. Reload to verify access.','error');
  }
  function current(generation){
    if(state.retired||state.suspended||state.verifying||generation!==state.generation)return false;
    try{
      const auth=window.MemphisAuth,session=auth?.readSession?.();
      if(auth!==state.auth||!originalAuthMethods(auth,state.authMethods)||resolveDeviceId()!==state.currentDeviceId){retire();return false;}
      // Check the captured admission before expiry or a replacement can enter
      // renewal. The mutable old session object is not an identity source.
      if(!state.session||sessionBinding(state.session)!==state.sessionBinding){retire();return false;}
      if(!session){
        if(state.session&&Date.parse(state.session.expires_at)<=Date.now())renewKnownOwner();else retire();
        return false;
      }
      if(!auth.isOpsManager(session)||session.device_id!==state.currentDeviceId){retire();return false;}
      if(session!==state.session){
        if(resumeBinding(session)===state.admittedOwnerBinding)renewKnownOwner();else retire();
        return false;
      }
      if(sessionBinding(session)!==state.sessionBinding){retire();return false;}
      return true;
    }catch{retire();return false;}
  }
  function every(callback,delay){
    const handle=setInterval(callback,delay);intervals.add(handle);return handle;
  }
  for(const link of managerLinks)link.addEventListener('click',event=>{if(!current(state.generation))event.preventDefault();});
  window.addEventListener('pagehide',event=>retire({persisted:event?.persisted===true}));
  window.addEventListener('pageshow',event=>{
    if(event?.persisted!==true||!state.suspended||state.retired)return;
    if(window.MemphisAuth!==state.auth){retire();return;}
    const expectedBinding=state.resumeBinding;state.suspended=false;
    void init({resuming:true,expectedBinding}).catch(error=>{if(!state.retired&&!state.suspended)setStatus(safe(error),'error');});
  });
  const checkIdentity=()=>{if(state.verifying)return;if(state.session)current(state.generation);
    else if(state.currentDeviceId&&resolveDeviceId()!==state.currentDeviceId)retire();};
  window.addEventListener('storage',checkIdentity);window.addEventListener('focus',checkIdentity);
  document.addEventListener('visibilitychange',checkIdentity);

  function updateLinks(){
    if(!current(state.generation))return;
    const messagesUrl=new URL('./messages.html',window.location.href);
    const scheduleUrl=new URL('./schedule-weekly.html',window.location.href);
    const eventsUrl=new URL('./events-admin.html',window.location.href);
    const dashboardMapUrl=new URL('./operations-dashboard.html',window.location.href);
    const dashboardUrl=new URL('./dashboard.html',window.location.href);
    const insightsUrl=new URL('./operational-insights.html',window.location.href);
    const guestIssuesUrl=new URL('./guest-issues.html',window.location.href);
    const feedbackUrl=new URL('./system-feedback.html',window.location.href);
    const notificationsUrl=new URL('./notifications.html',window.location.href);
    const phoneAssignmentsUrl=new URL('./phone-assignments.html',window.location.href);
    const deviceSecurityUrl=new URL('./device-security.html',window.location.href);
    const releaseCanaryUrl=new URL('./admin.html#release-canary-controls',window.location.href);
    const geminiConsoleUrl=new URL('./gemini-admin.html',window.location.href);
    const urls=[messagesUrl,scheduleUrl,eventsUrl,dashboardUrl,dashboardMapUrl,insightsUrl,guestIssuesUrl,feedbackUrl,notificationsUrl,phoneAssignmentsUrl,deviceSecurityUrl,releaseCanaryUrl,geminiConsoleUrl];
    for(const url of urls)url.searchParams.set('hub','manager');
    if(state.currentDeviceId){for(const url of urls)url.searchParams.set('device',state.currentDeviceId);}
    els.messagesLink.href=messagesUrl.toString();
    els.scheduleLink.href=scheduleUrl.toString();
    els.eventsLink.href=eventsUrl.toString();
    els.dashboardLink.href=dashboardUrl.toString();
    els.dashboardMapLink.href=dashboardMapUrl.toString();
    els.insightsLink.href=insightsUrl.toString();
    els.guestIssuesLink.href=guestIssuesUrl.toString();
    els.feedbackLink.href=feedbackUrl.toString();
    els.notificationsLink.href=notificationsUrl.toString();
    els.phoneAssignmentsLink.href=phoneAssignmentsUrl.toString();
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
    const custodial=window.MemphisAuth.hasRole('CUSTODIAL_MANAGER',session)||window.MemphisAuth.isCustodialManagementAdmin?.(session)===true;
    const director=window.MemphisAuth.hasRole('DIRECTOR',session);
    const security=window.MemphisAuth.hasRole('SECURITY_ADMIN',session);
    for(const element of [els.insightsLink,els.phoneAssignmentsLink,els.geminiConsoleLink])if(element)element.hidden=!custodial;
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
      els.attendanceValue.textContent=stale?'Unavailable':count.toLocaleString();
      const plan=numeric(data.planned),planned=!stale&&plan!==null&&Number.isSafeInteger(plan)&&plan>=0?plan.toLocaleString():'unavailable';
      els.attendanceMeta.textContent=`Today’s plan: ${planned}`;
      els.attendanceMeta.classList.toggle('stale',stale);
    }catch{if(!current(generation))return;els.attendanceValue.textContent='Unavailable';els.attendanceMeta.textContent='Today’s plan: Unavailable';els.attendanceMeta.classList.add('stale');}
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

  async function init({resuming=false,expectedBinding='',expectedMethods=null}={}){
    if(state.retired||state.suspended)return;
    if(resuming&&(window.MemphisAuth!==state.auth||!originalAuthMethods(state.auth,expectedMethods||state.authMethods))){retire();return;}
    const generation=++state.generation;state.auth=window.MemphisAuth;state.verifying=true;
    state.authMethods=Object.freeze(Object.fromEntries(authMethodNames.map(name=>[name,state.auth?.[name]])));
    const auth=state.auth,methods=state.authMethods;
    stopRefreshes();
    clearManagerView();
    state.currentDeviceId=resolveDeviceId();
    if(!state.currentDeviceId||!['getDeviceId','readSession','isOpsManager','requireOpsManagerSession','hasRole','canMutateOpsManagerSurface']
      .every(method=>typeof state.auth?.[method]==='function')){showAccessRequired();return;}
    const priorSession=auth.readSession(),requiredBinding=expectedBinding||(priorSession?resumeBinding(priorSession):'');
    let session=null,accessError=null;
    try{session=await auth.requireOpsManagerSession({accessLevel:'full_access',interactive:false,forceRefresh:resuming,redirect:false,throwOnFailure:true});}
    catch(error){accessError=error;}
    if(state.retired||state.suspended||generation!==state.generation)return;
    if(window.MemphisAuth!==auth||!originalAuthMethods(auth,methods)){retire();return;}
    if(accessError&&accessError.code!=='MANAGER_SIGN_IN_REQUIRED'){
      state.verifying=false;
      els.accessMode.textContent='Manager access could not be checked';
      if(accessError.code==='MANAGER_ACCESS_DENIED'){
        retire();els.accessMode.textContent='Manager access was denied';
        setStatus('Manager access was denied. Your saved sign-in has not been replaced.','error');return;
      }
      state.resumeBinding=requiredBinding;
      setStatus('Manager access is temporarily unavailable. Retrying your saved sign-in…','error');
      const retry=every(()=>{
        clearInterval(retry);intervals.delete(retry);
        if(state.retired||state.suspended||generation!==state.generation)return;
        if(window.MemphisAuth!==auth||!originalAuthMethods(auth,methods)||resolveDeviceId()!==state.currentDeviceId){retire();return;}
        void init({resuming:Boolean(requiredBinding),expectedBinding:requiredBinding,expectedMethods:methods})
          .catch(()=>{if(!state.retired)setStatus('Manager access could not be checked.','error');});
      },5000);
      return;
    }
    if((resuming&&!expectedBinding)||(requiredBinding&&resumeBinding(session)!==requiredBinding)){retire();return;}
    if(!session||!window.MemphisAuth.isOpsManager(session)){showAccessRequired();return;}
    if(auth.readSession()!==session){retire();return;}
    if(!priorSession&&window.MemphisAuth.isCustodialManagementAdmin?.(session))state.currentDeviceId=resolveDeviceId();
    state.session=session;state.resumeBinding='';
    state.sessionBinding=sessionBinding(session);state.admittedOwnerBinding=resumeBinding(session);state.verifying=false;
    if(!current(generation))return;
    const returnPath=new URLSearchParams(window.location.search).get('return');
    if(returnPath){try{const resolved=new URL(returnPath,window.location.href);if(resolved.origin===window.location.origin&&!resolved.pathname.includes('..')){window.location.replace(resolved.toString());return;}}catch{}}
    const leadership=window.MemphisAuth.isCustodialManagementAdmin?.(session);
    const selectedName=leadership?session.claimed_manager_display_name:session.manager_display_name;
    const fullNames={Haley:'Haley Lejman',Jennifer:'Jennifer Sheffield',Annie:'Annie Feist'};
    const name=fullNames[selectedName]||selectedName||'Custodial management';const title=session.manager_job_title||'';
    els.managerName.textContent=name;els.managerTitle.textContent=title;els.accessMode.textContent=leadership?"Manager access":session.permissions?.owner===true?"Owner · full control":"Read-only";els.accessMode.className=window.MemphisAuth.canMutateOpsManagerSurface(session)?"accessMode full":"accessMode";
    updateLinks();applyRoleVisibility(session);setStatus('Access current.','ok');
    // Optional feeds start independently; a delayed weather or feature request
    // cannot hold the remembered-access transition or attendance refresh loop.
    void weather.start().catch(()=>{});void refreshAttendance();void setBuildStamp();void refreshGuestFeature();
    every(refreshAttendance,30000);
  }

  void init().catch((error)=>{if(!state.retired)setStatus(safe(error),'error');});
})();
