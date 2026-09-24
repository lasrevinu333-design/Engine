import {homeBinding,homeIdentity,HOME_WEATHER_URL,HOME_WEATHER_ALERTS_URL,weatherHoursHtml,weatherAlertsHtml} from './home-facts.js';
import {createHomeFacts} from './home-facts-runtime.js';
const ATTENDANCE='https://memphis-zoo-mcp.onrender.com/dashboard-api/current-attendance';
// The existing project forecast point is not the employee's live GPS location.
const WEATHER=HOME_WEATHER_URL;
export function installHomeFacts({getProfile,getDeviceId,isVisible,security,requestJson}) {
  const byId=id=>document.getElementById(id);
  const els={guests:byId('home-guest-count'),guestDetails:byId('home-guest-details'),attendance:byId('home-attendance-freshness'),
    weatherCurrent:byId('home-weather-current'),weatherIcon:byId('home-weather-icon'),weatherSummary:byId('home-weather-summary'),weather:byId('home-weather-freshness'),hours:byId('home-weather-hours'),hourlyFreshness:byId('home-hourly-freshness'),alerts:byId('home-weather-alerts'),alertFreshness:byId('home-alerts-freshness'),shift:byId('home-shift'),lunch:byId('home-lunch'),schedule:byId('home-schedule-freshness')};
  let facts=null,binding='',timer=null;
  const identity=()=>{
    const profile=getProfile(),id=homeIdentity(profile,getDeviceId());
    if(!id)return null;
    if(security.native===true){
      if(window.MemphisMobile?.profileMatchesPrincipal?.(profile)!==true)return null;
      const protectedBinding=window.MemphisMobile.principalIdentity();if(!protectedBinding)return null;
      return {...id,protectedBinding};
    }
    return id;
  };
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
      const day=await requestJson(`/schedule-api/my-day-summary?device_id=${encodeURIComponent(id.deviceId)}`,{signal});
      if(security.native===true&&window.MemphisMobile?.profileMatchesPrincipal?.(day)!==true)throw Error('Schedule assignment changed');
      return day?.home_facts?{...day.home_facts,canonical_device_id:day.canonical_device_id,device_id:day.device_id}:day;
    }
    const response=await fetch(kind==='attendance'?ATTENDANCE:kind==='alerts'?HOME_WEATHER_ALERTS_URL:WEATHER,{cache:'no-store',credentials:'omit',signal});
    const body=await response.json();if(!response.ok||kind==='attendance'&&body.ok!==true)throw Error('Facts unavailable');
    return kind==='attendance'?body.data:body;
  }
  function update(force=false){
    if(!isVisible())return;
    const id=identity();if(!id||!Object.values(els).every(Boolean))return;
    const next=homeBinding(id);
    if(!facts||binding!==next){
      facts?.dispose();binding=next;
      facts=createHomeFacts({identity,storage:localStorage,mutate:operation=>security.mutateProtectedWork(operation),request,render:draw,kinds:['schedule','attendance','weather','alerts']});
    }
    const pending=facts.refresh({force});
    if(!timer)timer=setInterval(()=>{if(!document.hidden&&isVisible()){facts?.redraw();update();}},30000);
    return pending;
  }
  function stop(){facts?.dispose();facts=null;binding='';clearInterval(timer);timer=null;}
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>update());
  window.addEventListener('online',()=>update(true));
  window.addEventListener('memphis:schedule-refresh',()=>update(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  return {update,stop};
}
