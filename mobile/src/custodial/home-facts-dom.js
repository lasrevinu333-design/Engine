import {homeBinding,homeIdentity} from './home-facts.js';
import {createHomeFacts} from './home-facts-runtime.js';
const ATTENDANCE='https://memphis-zoo-mcp.onrender.com/dashboard-api/current-attendance';
// The existing project forecast point is not the employee's live GPS location.
const WEATHER='https://api.open-meteo.com/v1/forecast?latitude=35.1506&longitude=-89.9944&hourly=temperature_2m,precipitation_probability&temperature_unit=fahrenheit&timeformat=unixtime&timezone=America%2FChicago&forecast_hours=6';
export function installHomeFacts({getProfile,getDeviceId,isVisible,security,requestJson}) {
  const byId=id=>document.getElementById(id);
  const els={day:byId('home-service-date'),shift:byId('home-shift'),lunch:byId('home-lunch'),schedule:byId('home-schedule-freshness'),
    guests:byId('home-guest-count'),attendance:byId('home-attendance-freshness'),hours:byId('home-weather-hours'),weather:byId('home-weather-freshness')};
  let facts=null,binding='',timer=null;
  const identity=()=>homeIdentity(getProfile(),getDeviceId());
  function draw(value){
    if(!isVisible()||!Object.values(els).every(Boolean))return;
    els.day.textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',month:'short',day:'numeric'}).format(new Date(`${value.date}T18:00:00Z`));
    els.shift.textContent=value.schedule.shift;els.lunch.textContent=value.schedule.lunch;
    els.schedule.textContent=value.schedule.detail;els.schedule.dataset.stale=String(value.schedule.stale);
    els.guests.textContent=value.attendance.value;els.attendance.textContent=value.attendance.detail;
    els.attendance.dataset.stale=String(value.attendance.stale);
    els.hours.replaceChildren(...value.weather.hours.map(hour=>{
      const row=document.createElement('li'),time=document.createElement('span'),temp=document.createElement('strong'),rain=document.createElement('small');
      time.textContent=hour.label;temp.textContent=hour.temperature;rain.textContent=hour.rain;row.append(time,temp,rain);return row;
    }));
    els.weather.textContent=value.weather.detail;els.weather.dataset.stale=String(value.weather.stale);
  }
  async function request(kind,id,signal){
    if(kind==='schedule'){
      const day=await requestJson(`/schedule-api/my-day-summary?device_id=${encodeURIComponent(id.deviceId)}`,{signal});
      return day?.home_facts?{...day.home_facts,canonical_device_id:day.canonical_device_id,device_id:day.device_id}:day;
    }
    const response=await fetch(kind==='attendance'?ATTENDANCE:WEATHER,{cache:'no-store',credentials:'omit',signal});
    const body=await response.json();if(!response.ok||kind==='attendance'&&body.ok!==true)throw Error('Facts unavailable');
    return kind==='attendance'?body.data:body;
  }
  function update(force=false){
    if(!isVisible())return;
    const id=identity();if(!id||!Object.values(els).every(Boolean))return;
    const next=homeBinding(id);
    if(!facts||binding!==next){
      facts?.dispose();binding=next;
      facts=createHomeFacts({identity,storage:localStorage,mutate:operation=>security.mutateProtectedWork(operation),request,render:draw});
    }
    void facts.refresh({force});
    if(!timer)timer=setInterval(()=>{if(!document.hidden&&isVisible()){facts?.redraw();update();}},60000);
  }
  function stop(){facts?.dispose();facts=null;binding='';clearInterval(timer);timer=null;}
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>update());
  window.addEventListener('online',()=>update(true));
  window.addEventListener('memphis:schedule-refresh',()=>update(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  return {update,stop};
}
