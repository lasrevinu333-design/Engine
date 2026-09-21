import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
const html=readFileSync(new URL('../mobile/src/custodial/index.html',import.meta.url),'utf8');
const ids=['home-guest-count','home-guest-details','home-attendance-freshness','home-weather-current','home-weather-icon','home-weather-summary','home-weather-freshness','home-weather-hours','home-hourly-freshness','home-weather-alerts','home-alerts-freshness','home-shift','home-lunch','home-schedule-freshness'];
for(const id of ids)assert.ok(html.includes(`id="${id}"`),`DOM binding ${id} exists in the actual Home`);
const els=new Map(ids.map(id=>[id,{textContent:'',dataset:{}}])),listeners=[];
const originals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
const now=Date.now(),stamp=new Date(now).toISOString(),calls=[],storage=new Map();
let timer=null,cleared=false,app;
try{
  globalThis.document={getElementById:id=>els.get(id),addEventListener:(name,fn)=>listeners.push([name,fn])};
  globalThis.window={addEventListener:(name,fn)=>listeners.push([name,fn])};
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.setInterval=(_fn,delay)=>{assert.equal(delay,30000);timer=17;return timer;};
  globalThis.clearInterval=value=>{assert.equal(value,timer);cleared=true;};
  globalThis.fetch=async url=>{calls.push(url);const data=url.includes('current-attendance')?{ok:true,data:{attendance:0,planned:100,source_timestamp:stamp}}:url.includes('api.weather.gov')?{type:'FeatureCollection',features:[]}:{current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:Math.floor(now/1000),temperature_2m:72,weather_code:0,wind_speed_10m:3},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>Math.floor(now/3600000)*3600+i*3600),temperature_2m:Array(8).fill(72),apparent_temperature:Array(8).fill(74),weather_code:Array(8).fill(0),wind_speed_10m:Array(8).fill(3),precipitation_probability:Array(8).fill(0)}};return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  app=installHomeFacts({getProfile:()=>({authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Custodian',employee_id:'fixture-employee',credential_id:'fixture-credential'}),getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security:{mutateProtectedWork:async fn=>fn()},requestJson:async url=>{calls.push(url);return {canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',home_facts:{service_date:today,employee_id:'fixture-employee',employee_name:'Fixture Custodian',projection_status:'current',shift:{active:true,start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}};}});
  await app.update();
  assert.equal(calls.length,4);assert.equal(els.get('home-guest-count').textContent,'0');
  assert.equal(els.get('home-weather-current').textContent,'72°F · clear');
  assert.equal(els.get('home-weather-summary').textContent,'3 mph · Precipitation 0%');
  assert.equal(els.get('home-weather-freshness').dataset.stale,'false');
  assert.ok(calls.some(url=>url.includes('current=temperature_2m,weather_code,wind_speed_10m')));
  assert.ok(calls.some(url=>url.includes('my-day-summary')));
  assert.equal(els.get('home-shift').textContent,'8:00 AM–5:00 PM');assert.equal(els.get('home-lunch').textContent,'1:00 PM–2:00 PM');
  assert.equal((els.get('home-weather-hours').innerHTML.match(/<li>/g)||[]).length,8);
  assert.match(els.get('home-alerts-freshness').textContent,/No active alerts reported/);
  app.stop();app=null;assert.equal(cleared,true);
  console.log('Custodial original Home DOM bindings: PASS (simulated providers, no phone acceptance claim)');
}finally{
  app?.stop();
  for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}
