import {homeBinding,homeIdentity,HOME_WEATHER_URL,HOME_WEATHER_ALERTS_URL,weatherHoursHtml,weatherAlertsHtml} from './home-facts.js';
import {createHomeFacts,HOME_IDENTITY_SUPERSEDED} from './home-facts-runtime.js';
import {createScheduleHomeConvergence} from './schedule-home-convergence.js';
import {principalIdentity} from './protected-principal.js';
const ATTENDANCE='https://memphis-zoo-mcp.onrender.com/dashboard-api/current-attendance';
// The existing project forecast point is not the employee's live GPS location.
const WEATHER=HOME_WEATHER_URL;
export function installHomeFacts({getProfile,getDeviceId,isVisible,security,requestJson}) {
  const byId=id=>document.getElementById(id);
  const els={guests:byId('home-guest-count'),guestDetails:byId('home-guest-details'),attendance:byId('home-attendance-freshness'),
    weatherCurrent:byId('home-weather-current'),weatherIcon:byId('home-weather-icon'),weatherSummary:byId('home-weather-summary'),weather:byId('home-weather-freshness'),hours:byId('home-weather-hours'),hourlyFreshness:byId('home-hourly-freshness'),alerts:byId('home-weather-alerts'),alertFreshness:byId('home-alerts-freshness'),shift:byId('home-shift'),lunch:byId('home-lunch'),schedule:byId('home-schedule-freshness')};
  let facts=null,binding='',timer=null,securityBlocked=false,securityGeneration=0,protectedBinding='',updateSequence=0,pendingReady=null;
  const healthy=value=>{try{return value!==null&&typeof value==='object'&&value.ready===true&&value.available===true&&value.quarantined===false;}catch{return false;}};
  function clearSchedule(){if(els.shift)els.shift.textContent='Schedule unavailable';if(els.lunch)els.lunch.textContent='Lunch unavailable';
    if(els.schedule){els.schedule.textContent='Phone identity must be verified.';els.schedule.dataset.stale='true';}}
  function quarantine(){++securityGeneration;securityBlocked=true;pendingReady=null;clearSchedule();return null;}
  function readyProof(status){
    if(!healthy(status)||!Number.isSafeInteger(status.generation)||status.generation<1)return null;
    const principal=principalIdentity(status.principal);
    return principal?{principal,generation:status.generation}:null;
  }
  const sameReady=(a,b)=>Boolean(a&&b&&a.principal===b.principal&&a.generation===b.generation);
  // No live getter or bridge result escapes this boundary. A nested handler
  // may invalidate an outer capture, including a positive recovery attempt.
  function captureSecurity({recover=false,data}={}){
    const generation=securityGeneration,invocation=updateSequence;
    const ownsCapture=()=>generation===securityGeneration&&invocation===updateSequence;
    try{
      const native=security.native===true,profile=getProfile();
      if(!ownsCapture())return HOME_IDENTITY_SUPERSEDED;
      // A normally absent profile is a lifecycle transition, not a thrown
      // security read. update() disposes its old generation before a new one.
      if(profile===null||profile===undefined){clearSchedule();return null;}
      const id=homeIdentity(profile,getDeviceId());
      if(!id)throw Error('identity');
      if(id.assignmentEpoch!==null&&!Number.isSafeInteger(id.assignmentEpoch))throw Error('epoch');
      let principal='browser:'+homeBinding(id);
      if(native){
        if(!healthy(security.getStatus()))throw Error('security');
        const mobile=window.MemphisMobile;
        if(mobile?.profileMatchesPrincipal?.(profile)!==true||data!==undefined&&mobile.profileMatchesPrincipal(data)!==true)throw Error('profile');
        principal=mobile.principalIdentity();
        if(typeof principal!=='string'||!principal.trim())throw Error('principal');
      }
      if(!ownsCapture())return HOME_IDENTITY_SUPERSEDED;
      if(securityBlocked&&!recover)return null;
      return {native,id:{...id,protectedBinding:principal}};
    }catch{return ownsCapture()?quarantine():HOME_IDENTITY_SUPERSEDED;}
  }
  const identity=()=>{const captured=captureSecurity();return captured===HOME_IDENTITY_SUPERSEDED?captured:captured?.id??null;};
  const admitted=captured=>captured!==null&&captured!==HOME_IDENTITY_SUPERSEDED;
  const sourceStorage=localStorage;
  let activeMutation=null,nativeWriterObserved=false;
  const mutationInvalidated=()=>Object.assign(new Error('Home mutation invalidated'),{code:'schedule_request_invalidated'});
  // Only the three existing Home/shared-schedule rows participate. Track our
  // exact successful writes, never adopt arbitrary post-callback row values.
  // This stays private to the installed Home; it is not an admission port.
  const cacheStorage={getItem:key=>sourceStorage.getItem(key),setItem:(key,value)=>{
    const scope=activeMutation;
    if(!scope){if(nativeWriterObserved||security.native===true)throw mutationInvalidated();return sourceStorage.setItem(key,value);}
    if(!scope.expected.has(key)||typeof value!=='string')throw mutationInvalidated();
    scope.checkpoint();
    try{scope.write.call(sourceStorage,key,value);}
    catch{
      // Only an unchanged original owner and unchanged rows can distinguish
      // storage failure from authority replacement. Preserve that distinction
      // so a validated terminal can remain blocking in this live Home.
      scope.checkpoint();
      throw Object.assign(new Error('Home cache storage unavailable'),{code:'schedule_cache_storage_unavailable'});
    }
    if(scope.read.call(sourceStorage,key)!==value)throw mutationInvalidated();
    scope.expected.set(key,value);scope.checkpoint();
  }};
  const captureProtectedMutation=operation=>{
    const invocation=updateSequence,epoch=securityGeneration,owner=facts;
    const captured=captureSecurity();if(!admitted(captured))throw Error('identity');
    if(invocation!==updateSequence||epoch!==securityGeneration||facts!==owner)throw mutationInvalidated();
    if(!captured.native){
      if(nativeWriterObserved)throw mutationInvalidated();
      const originalBinding=homeBinding(captured.id);let invoked=false;
      return ()=>{
        if(invoked)throw mutationInvalidated();invoked=true;
        const current=captureSecurity();
        if(!admitted(current)||current.native||nativeWriterObserved||homeBinding(current.id)!==originalBinding
          ||invocation!==updateSequence||epoch!==securityGeneration||facts!==owner)throw mutationInvalidated();
        return operation();
      };
    }
    nativeWriterObserved=true;
    const nativeWindow=window,mobile=nativeWindow.MemphisMobile,writer=security.mutateProtectedWork,reader=security.getStatus;
    const identityReader=mobile?.principalIdentity,matcher=mobile?.profileMatchesPrincipal;
    if(nativeWindow.MemphisCustodialSecurity!==security||typeof writer!=='function'||typeof reader!=='function'
      ||typeof identityReader!=='function'||typeof matcher!=='function')throw mutationInvalidated();
    const proof=readyProof(reader.call(security)),originalBinding=homeBinding(captured.id);
    if(!proof||proof.principal!==captured.id.protectedBinding)throw mutationInvalidated();
    const read=sourceStorage.getItem,write=sourceStorage.setItem;
    const principal=encodeURIComponent(captured.id.protectedBinding);
    const expected=new Map(['mz_custodial_home_cache:'+encodeURIComponent(originalBinding)+':facts',
      'mz_employee_schedule_snapshot:'+principal,'mz_employee_schedule_snapshot:availability:'+principal]
      .map(key=>[key,read.call(sourceStorage,key)]));
    const requireOriginal=()=>{
      if(window!==nativeWindow||nativeWindow.MemphisCustodialSecurity!==security||security.native!==true
        ||security.mutateProtectedWork!==writer||security.getStatus!==reader||nativeWindow.MemphisMobile!==mobile
        ||mobile.principalIdentity!==identityReader||mobile.profileMatchesPrincipal!==matcher
        ||localStorage!==sourceStorage||sourceStorage.getItem!==read||sourceStorage.setItem!==write
        ||facts!==owner||invocation!==updateSequence||epoch!==securityGeneration)throw mutationInvalidated();
      const current=captureSecurity(),currentProof=readyProof(reader.call(security));
      if(!admitted(current)||!current.native||homeBinding(current.id)!==originalBinding||!sameReady(proof,currentProof)
        ||facts!==owner||invocation!==updateSequence||epoch!==securityGeneration)throw mutationInvalidated();
      for(const [key,raw] of expected)if(read.call(sourceStorage,key)!==raw)throw mutationInvalidated();
    };
    // Capture happens BEFORE the shared schedule lock. Only the returned
    // original callback may enter native FIFO, once the lock grants it.
    requireOriginal();let invoked=false;
    return ()=>{
    if(invoked)throw mutationInvalidated();invoked=true;requireOriginal();
    const completion=Object.freeze({});let completed=false,result,pending;
    try{pending=writer.call(security,context=>{
      if(activeMutation!==null||typeof context?.assertCurrent!=='function'||context.generation!==proof.generation
        ||context.deviceId!==captured.id.deviceId)throw mutationInvalidated();
      const scope={expected,read,write,checkpoint:()=>{
        if(activeMutation!==scope)throw mutationInvalidated();
        context.assertCurrent();requireOriginal();context.assertCurrent();
      }};
      activeMutation=scope;
      try{
        scope.checkpoint();result=operation();
        if(result&&typeof result.then==='function')throw mutationInvalidated();
        scope.checkpoint();completed=true;return completion;
      }finally{activeMutation=null;}
    },{requireEnrollment:true,expectedGeneration:proof.generation});}
    catch(error){if(error?.code?.startsWith('schedule_'))throw error;throw mutationInvalidated();}
    return Promise.resolve(pending).then(value=>{
      if(value!==completion||!completed)throw mutationInvalidated();requireOriginal();return result;
    },error=>{if(error?.code?.startsWith('schedule_'))throw error;throw mutationInvalidated();});
    };
  };
  const protectedMutation=operation=>captureProtectedMutation(operation)();
  // Browser cache has an explicitly browser-only principal. It uses the same
  // validated row/fence rather than the unverifiable flattened facts cache;
  // browser storage never establishes native persistence or a phone ACK.
  const schedule=createScheduleHomeConvergence({identity:()=>{const id=identity();return id===HOME_IDENTITY_SUPERSEDED?null:id;},storage:cacheStorage,
    captureMutation:captureProtectedMutation,matches:data=>admitted(captureSecurity({data}))});
  function draw(value){
    if(!isVisible()||!Object.values(els).every(Boolean))return;
    els.guests.textContent=value.attendance.value;els.attendance.textContent=value.attendance.detail;
    els.guestDetails.textContent=value.attendance.comparison||'';
    els.attendance.dataset.stale=String(value.attendance.stale);
    els.weatherCurrent.textContent=[value.currentWeather.temperature,value.currentWeather.condition].filter(Boolean).join(' · ');
    els.weatherIcon.textContent=value.currentWeather.icon;els.weatherSummary.textContent=value.currentWeather.summary;
    els.weather.textContent=value.currentWeather.detail;els.weather.dataset.stale=String(value.currentWeather.stale);
    els.hours.innerHTML=weatherHoursHtml(value.weather);els.hourlyFreshness.textContent=value.weather.detail;els.hourlyFreshness.dataset.stale=String(value.weather.stale);
    els.alerts.innerHTML=weatherAlertsHtml(value.alerts);els.alertFreshness.textContent=value.alerts.detail;els.alertFreshness.dataset.stale=String(value.alerts.stale);
    els.shift.textContent=value.schedule.shift;els.lunch.textContent=value.schedule.lunch;els.schedule.textContent=value.schedule.detail;els.schedule.dataset.stale=String(value.schedule.stale);
  }
  async function request(kind,id,signal){
    if(kind==='schedule'){
      const owner=facts,generation=securityGeneration,invocation=updateSequence,originalBinding=homeBinding(id);
      const currentRequest=()=>{
        if(signal?.aborted||owner!==facts||generation!==securityGeneration||invocation!==updateSequence)return false;
        const captured=captureSecurity();
        return admitted(captured)&&owner===facts&&generation===securityGeneration&&invocation===updateSequence
          &&!signal?.aborted&&homeBinding(captured.id)===originalBinding;
      };
      const requireCurrent=()=>{
        if(!currentRequest())throw Object.assign(new Error('Schedule request invalidated'),{code:'schedule_request_invalidated'});
      };
      requireCurrent();
      const observedAvailability=await schedule.begin(id,{signal});
      requireCurrent();
      let day;try{day=await requestJson(`/schedule-api/my-day-summary?device_id=${encodeURIComponent(id.deviceId)}`,{signal});}
      catch(error){
        requireCurrent();
        // A received HTTP failure is not a cancelled/offline request. Keep the
        // unresolved read if the transport could not persist UNAVAILABLE;
        // restoring its prior AVAILABLE would revive stale work on restart.
        let noResponse=false;
        try{const status=error?.status;noResponse=status===undefined||status===null||status===0;}catch{ /* Unreadable response metadata remains uncertain. */ }
        if(noResponse){
          requireCurrent();
          await schedule.cancel(id,observedAvailability).catch(()=>{});
          requireCurrent();
        }
        throw error;
      }
      requireCurrent();
      if(!admitted(captureSecurity({data:day})))throw Error('Schedule assignment changed');
      requireCurrent();
      const accepted=await schedule.accept(day,id,{signal,observedAvailability});
      requireCurrent();
      return accepted;
    }
    const response=await fetch(kind==='attendance'?ATTENDANCE:kind==='alerts'?HOME_WEATHER_ALERTS_URL:WEATHER,{cache:'no-store',credentials:'omit',signal});
    const body=await response.json();if(!response.ok||kind==='attendance'&&body.ok!==true)throw Error('Facts unavailable');
    return kind==='attendance'?body.data:body;
  }
  function authenticatedProfileRestored(profile,proof){
    // This local capability is called only by app.restore's fresh authenticated
    // status response, never by polling or a cached-profile fallback. Ordinary
    // ensureSecurityState checks may advance the raw generation without a new
    // material ready event; that does NOT relax the pending-event fence below.
    const invocation=++updateSequence,generation=securityGeneration;
    const owns=()=>invocation===updateSequence&&generation===securityGeneration;
    try{
      if(security.native!==true||profile?.authenticated!==true||getProfile()!==profile||!owns())return false;
      const expected={principal:proof?.principal,generation:proof?.generation};
      const before=readyProof(security.getStatus());
      if(!owns()||!sameReady(expected,before))return false;
      const captured=captureSecurity({recover:true,data:profile});
      if(!owns()||!admitted(captured)||captured.id.protectedBinding!==expected.principal)return false;
      if(getProfile()!==profile||!owns())return false;
      const after=readyProof(security.getStatus());
      if(!owns()||!sameReady(expected,after))return false;
      pendingReady=null;securityBlocked=false;protectedBinding=expected.principal;
      return true;
    }catch{if(owns())quarantine();return false;}
  }
  function update(force=false){
    const invocation=++updateSequence,generation=securityGeneration;
    const owns=()=>invocation===updateSequence&&generation===securityGeneration;
    if(securityBlocked&&pendingReady){
      // The real ready event may precede app.restore's authenticated profile.
      // It is not authority to show facts yet. Finish that SAME event only if
      // the current ready generation/principal and later profile still agree.
      // Merely polling healthy status after denial never creates this proof.
      const pending=pendingReady;
      try{
        const before=readyProof(security.getStatus());
        if(!owns())return;
        if(!sameReady(pending,before))pendingReady=null;
        else{
          const captured=captureSecurity({recover:true});
          if(!owns()||captured===HOME_IDENTITY_SUPERSEDED)return;
          const after=readyProof(security.getStatus());
          if(!owns())return;
          if(!sameReady(pending,after))pendingReady=null;
          else if(captured&&captured.id.protectedBinding===pending.principal){
            pendingReady=null;securityBlocked=false;
          }else if(captured)pendingReady=null;
        }
      }catch{if(owns())quarantine();return;}
    }
    const id=identity();
    if(invocation!==updateSequence||id===HOME_IDENTITY_SUPERSEDED)return;
    if(!id){const failedGeneration=securityGeneration,retired=stop();if(retired===updateSequence&&failedGeneration===securityGeneration)clearSchedule();return;}
    if(!owns())return;
    if(!isVisible()||!Object.values(els).every(Boolean))return;
    if(!owns())return;const next=homeBinding(id);
    protectedBinding=id.protectedBinding;
    if(!facts||binding!==next){
      retireResources();if(!owns())return;binding=next;
      facts=createHomeFacts({identity,identityVersion:()=>securityGeneration,sourceVersion:()=>updateSequence,storage:cacheStorage,mutate:protectedMutation,request,render:draw,
        resolveSchedule:(id,data)=>schedule.resolve(id,data),onIdentityMismatch:quarantine,kinds:['schedule','attendance','weather','alerts']});
    }
    if(!owns())return;
    const owner=facts,pending=owner.refresh({force});
    if(owner!==facts||!owns())return pending;
    if(!timer)timer=setInterval(()=>{if(!document.hidden&&isVisible()){facts?.redraw();update();}},30000);
    return pending;
  }
  function stop(){const invocation=++updateSequence;retireResources();return invocation;}
  function retireResources(){
    // Detach the exact old resources before abort listeners can re-enter and
    // install a newer owner. Never clean shared slots after disposing it.
    const owner=facts,oldTimer=timer;facts=null;binding='';timer=null;
    clearInterval(oldTimer);owner?.dispose();
  }
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>update());
  window.addEventListener('online',()=>update(true));
  window.addEventListener('memphis:schedule-refresh',()=>update(true));
  window.addEventListener('memphis:native-notification-received',()=>update(true));
  window.addEventListener('memphis:custodial-security-state',event=>{
    const generation=++securityGeneration;securityBlocked=true;pendingReady=null;const invocation=stop();
    const owns=()=>generation===securityGeneration&&invocation===updateSequence;
    if(!owns())return;clearSchedule();
    let captured;try{if(healthy(event.detail)&&owns()){
      captured=captureSecurity({recover:true});
      if(owns()&&captured===null&&security.native===true){
        const announced=readyProof(event.detail),current=readyProof(security.getStatus());
        if(owns()&&sameReady(announced,current))pendingReady=current;
      }
    }}catch{if(owns())quarantine();}
    if(!owns()||!captured||captured===HOME_IDENTITY_SUPERSEDED)return;
    securityBlocked=false;protectedBinding=captured.id.protectedBinding;
    update(true);
  });
  window.addEventListener('storage',event=>{
    const key=event.key;
    if(key!==null&&(!protectedBinding||!['mz_employee_schedule_snapshot:'+encodeURIComponent(protectedBinding),
      'mz_employee_schedule_snapshot:availability:'+encodeURIComponent(protectedBinding)].includes(key)))return;
    ++securityGeneration;
    const id=identity();if(id===HOME_IDENTITY_SUPERSEDED)return;
    if(!id)update();else facts?.redraw();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  return {update,stop,authenticatedProfileRestored};
}
