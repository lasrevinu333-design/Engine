import {currentWeatherFacts,weatherFacts,weatherAlertsFacts,weatherHoursHtml,weatherAlertsHtml,HOME_WEATHER_URL,HOME_WEATHER_ALERTS_URL} from '../custodial/home-facts.js';

// Informational Home facts only. This controller never changes access or work.
async function publicJson(url,{signal}) {
  const response=await fetch(url,{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Weather source unavailable.');
  return response.json();
}
export function installManagerWeather({document=globalThis.document,requestJson=publicJson,isVisible=()=>true,now=()=>Date.now(),setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}) {
  const ids=['manager-home-date','manager-home-clock','manager-weather-current','manager-weather-summary','manager-weather-hours','manager-weather-freshness','manager-weather-alerts','manager-alerts-freshness'];
  const elements=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  let active=false,generation=0,clockTimer=null,refreshTimer=null,flight=null,records={};
  const controllers=new Set();
  const visible=()=>active&&isVisible()&&Object.values(elements).every(Boolean);
  const element=id=>elements[id];
  function write(id,property,value) {
    const target=element(id);
    if(target[property]!==value)target[property]=value;
  }
  function drawClock() {
    if(!visible())return;
    const instant=new Date(now()),options={timeZone:'America/Chicago'};
    element('manager-home-date').textContent=instant.toLocaleDateString('en-US',{...options,weekday:'long',month:'long',day:'numeric',year:'numeric'});
    element('manager-home-clock').textContent=instant.toLocaleTimeString('en-US',{...options,hour:'numeric',minute:'2-digit',second:'2-digit'});
  }
  function draw() {
    if(!visible())return;
    drawClock();
    const value=kind=>records[kind]?.failed?{...records[kind].data,stale:true}:records[kind]?.data;
    const current=currentWeatherFacts(value('weather'),records.weather?.receivedAt,now());
    const hourly=weatherFacts(value('weather'),records.weather?.receivedAt,now());
    const alerts=weatherAlertsFacts(value('alerts'),records.alerts?.receivedAt,now());
    element('manager-weather-current').textContent=[current.temperature,current.condition].filter(Boolean).join(' · ');
    element('manager-weather-summary').textContent=current.summary||'';
    write('manager-weather-hours','innerHTML',weatherHoursHtml(hourly));
    element('manager-weather-freshness').textContent=[current.detail,hourly.detail].filter(Boolean).join(' · ');
    element('manager-weather-freshness').dataset.stale=String(current.stale||hourly.stale);
    write('manager-weather-alerts','innerHTML',weatherAlertsHtml(alerts));
    write('manager-alerts-freshness','textContent',alerts.detail);
    element('manager-alerts-freshness').dataset.stale=String(alerts.stale);
  }
  async function refresh({force=false}={}) {
    if(!visible())return;
    draw();if(flight)return flight;
    const captured=generation;
    flight=Promise.allSettled(['weather','alerts'].map(async kind=>{
      const age=now()-Date.parse(records[kind]?.receivedAt||'');
      const ttl=kind==='weather'?600000:60000;
      if(!force&&Number.isFinite(age)&&age>=0&&age<ttl)return;
      const controller=new AbortController();controllers.add(controller);
      const timeout=setTimeout(()=>controller.abort(),8000);
      try {
        const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Weather update interrupted.')),{once:true}));
        const data=await Promise.race([requestJson(kind==='weather'?HOME_WEATHER_URL:HOME_WEATHER_ALERTS_URL,{signal:controller.signal}),aborted]);
        if(!active||captured!==generation)return;
        if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid weather response.');
        records[kind]={data,receivedAt:new Date(now()).toISOString()};draw();
      }catch{
        if(active&&captured===generation){if(records[kind])records[kind].failed=true;draw();}
      }finally{clearTimeout(timeout);controllers.delete(controller);}
    })).finally(()=>{if(captured===generation)flight=null;});
    return flight;
  }
  function start() {
    if(!isVisible())return Promise.resolve();
    if(!active){
      active=true;generation+=1;
      clockTimer=setIntervalFn(drawClock,1000);
      refreshTimer=setIntervalFn(()=>{void refresh();},30000);
    }
    return refresh();
  }
  function stop() {
    active=false;generation+=1;
    if(clockTimer!==null)clearIntervalFn(clockTimer);
    if(refreshTimer!==null)clearIntervalFn(refreshTimer);
    clockTimer=null;refreshTimer=null;
    for(const controller of controllers)controller.abort();
    controllers.clear();flight=null;records={};
  }
  return {start,refresh,stop};
}
