import assert from 'node:assert/strict';
import { attendanceFacts, currentWeatherFacts, scheduleFacts, weatherFacts, homeIdentity, homeBinding, timeMinutes, zooServiceDate } from '../mobile/src/custodial/home-facts.js';
import { createHomeFacts } from '../mobile/src/custodial/home-facts-runtime.js';
const NOW=Date.parse('2026-09-18T15:00:00.000Z'),stamp=new Date(NOW).toISOString();
const identity={deviceId:'KIOSK_08',employeeId:'00000000-0000-4000-8000-000000000809',employeeName:'Fixture Custodian',credentialId:'fixture'};
const day={service_date:'2026-09-18',device_id:'KIOSK_08',canonical_device_id:'KIOSK_08',employee_id:identity.employeeId,employee_name:identity.employeeName,
  projection_status:'current',shift:{active:true,shift_start:'08:00',shift_end:'17:00',lunch_start:'12:00',lunch_end:'13:00'}};
const weather={hourly_units:{time:'unixtime',temperature_2m:'°F',precipitation_probability:'%'},hourly:{time:[0,1,2,3].map(n=>NOW/1000+n*3600),temperature_2m:[70,71,72,73],precipitation_probability:[0,25,50,100]}};
const originalWeather={current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:NOW/1000,temperature_2m:72.1,weather_code:1,wind_speed_10m:2.6},daily_units:{time:'unixtime',temperature_2m_max:'°F',temperature_2m_min:'°F'},daily:{time:[NOW/1000-5*3600],temperature_2m_max:[94.3],temperature_2m_min:[71.7]},hourly_units:{time:'unixtime',precipitation_probability:'%'},hourly:{time:[NOW/1000],precipitation_probability:[0]}};
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
await check('canonical shift and lunch use published times',()=>{const v=scheduleFacts(day,identity,stamp,NOW);assert.equal(v.shift,'8:00 AM–5:00 PM');assert.equal(v.lunch,'12:00 PM–1:00 PM');assert.equal(v.stale,false);});
await check('unpublished lunch is not guessed',()=>{const v=scheduleFacts({...day,shift:{active:true,start:'08:00 AM',end:'05:00 PM'}},identity,stamp,NOW);assert.equal(v.lunch,'Lunch not published');});
await check('day off is distinct from missing schedule',()=>assert.equal(scheduleFacts({...day,schedule_status:'off'},identity,stamp,NOW).shift,'Not scheduled today'));
await check('yesterday cannot masquerade as current shift',()=>assert.equal(scheduleFacts({...day,service_date:'2026-09-17'},identity,stamp,NOW).shift,'Schedule unavailable'));
await check('wrong employee and contradictory device are rejected',()=>{assert.equal(scheduleFacts({...day,employee_id:'another'},identity,stamp,NOW).shift,'Schedule unavailable');assert.equal(scheduleFacts({...day,device_id:'KIOSK_04'},identity,stamp,NOW).shift,'Schedule unavailable');});
await check('stale projection and old fetch are explicit',()=>{assert.equal(scheduleFacts({...day,projection_status:'stale_staffing_change'},identity,stamp,NOW).shift,'Schedule unavailable');assert.equal(scheduleFacts(day,identity,new Date(NOW-3600000).toISOString(),NOW).stale,true);});
await check('clock parser handles midnight, noon and invalid values',()=>{assert.equal(timeMinutes('12:00 AM'),0);assert.equal(timeMinutes('12:00 PM'),720);assert.equal(timeMinutes('24:00'),null);assert.equal(timeMinutes('12:99'),null);});
await check('service date is Chicago rather than UTC',()=>assert.equal(zooServiceDate(Date.parse('2026-01-02T02:00:00Z')),'2026-01-01'));
await check('actual guest count zero stays zero',()=>assert.equal(attendanceFacts({attendance:0,source_timestamp:stamp},NOW).value,'0'));
await check('original guest comparisons are not employee attendance',()=>{const value=attendanceFacts({attendance:0,planned:100,last_year:80,yesterday_plan:90,source_timestamp:stamp},NOW);assert.equal(value.comparison,'Planned 100 · Last Year 80 / Plan 90');assert.equal(attendanceFacts({attendance:10,planned:null,source_timestamp:stamp},NOW).comparison,'Planned -- · Last Year -- / Plan --');});
await check('original weather panel restores current, high/low, wind and rain',()=>{const value=currentWeatherFacts(originalWeather,stamp,NOW);assert.equal(value.temperature,'72°F');assert.equal(value.condition,'partly cloudy');assert.equal(value.summary,'High 94° / Low 72° · 3 mph · Precipitation 0%');assert.equal(value.stale,false);});
await check('weather observation age cannot be hidden by a new fetch',()=>{const value=currentWeatherFacts({...originalWeather,current:{...originalWeather.current,time:NOW/1000-7200}},stamp,NOW);assert.equal(value.stale,true);});
await check('unknown weather input is not displayed as zero or clear',()=>{for(const temperature of [null,undefined,'',' ',true,Infinity])assert.equal(currentWeatherFacts({...originalWeather,current:{...originalWeather.current,temperature_2m:temperature}},stamp,NOW).temperature,'Unavailable');assert.equal(currentWeatherFacts({...originalWeather,current_units:{}},stamp,NOW).temperature,'Unavailable');assert.equal(currentWeatherFacts({...originalWeather,current:{...originalWeather.current,weather_code:null}},stamp,NOW).condition,'');});
await check('future and previous-day current weather fail closed',()=>{for(const time of [NOW/1000+3600,NOW/1000-2*86400])assert.equal(currentWeatherFacts({...originalWeather,current:{...originalWeather.current,time}},stamp,NOW).temperature,'Unavailable');});
await check('wrong-day daily extrema and invalid rain remain absent',()=>{const value=currentWeatherFacts({...originalWeather,daily:{...originalWeather.daily,time:[NOW/1000-86400]},hourly:{...originalWeather.hourly,precipitation_probability:[101]}},stamp,NOW);assert.equal(value.summary,'3 mph');});
await check('optional fact-kind selection stays independent of the complete Home integration',async()=>{const requested=[],app=createHomeFacts({identity:()=>identity,storage:{getItem:()=>null,setItem:()=>{}},mutate:async fn=>fn(),now:()=>NOW,kinds:['attendance','weather'],request:async kind=>{requested.push(kind);return kind==='attendance'?{attendance:12,source_timestamp:stamp}:originalWeather;},render:()=>{}});try{await app.refresh();assert.deepEqual(requested,['attendance','weather']);}finally{app.dispose();}});
await check('missing, whitespace and invalid guest counts stay unknown',()=>{for(const value of [null,undefined,'','  ',true,-1,1.2,'none'])assert.equal(attendanceFacts({attendance:value,source_timestamp:stamp},NOW).value,'Unavailable',String(value));});
await check('stale guest source is not refreshed by a new download',()=>assert.equal(attendanceFacts({attendance:200,source_timestamp:'2026-09-17T15:00:00Z'},NOW).stale,true));
await check('future guest timestamps are not current',()=>assert.equal(attendanceFacts({attendance:200,source_timestamp:'2026-09-19T15:00:00Z'},NOW).stale,true));
await check('hourly data uses explicit units and observation hours',()=>{const v=weatherFacts(weather,stamp,NOW);assert.equal(v.hours.length,4);assert.equal(v.hours[0].temperature,'70°F');assert.equal(v.hours[0].rain,'0% rain');});
await check('unknown units and missing temperatures do not become zero',()=>{assert.equal(weatherFacts({...weather,hourly_units:{}},stamp,NOW).hours.length,0);const v=weatherFacts({...weather,hourly:{...weather.hourly,temperature_2m:[null,'',undefined,' '] }},stamp,NOW);assert.equal(v.hours.length,0);});
await check('unauthenticated Home cannot reuse a profile',()=>{assert.equal(homeIdentity({authenticated:false,canonical_device_id:'KIOSK_08',employee_name:'Old'},'KIOSK_08'),null);assert.notEqual(homeBinding(identity),homeBinding({...identity,credentialId:'next'}));});
await check('same-person assignment generation and protected installation cannot share fact caches',()=>{
 for(const change of [{assignmentEpoch:9},{protectedBinding:'different-protected-credential-and-installation'}])
  assert.notEqual(homeBinding(identity),homeBinding({...identity,...change}));
});
function memory(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
const payload=kind=>kind==='schedule'?day:kind==='attendance'?{attendance:321,source_timestamp:stamp}:weather;
await check('failed optional data does not block available facts',async()=>{
  const storage=memory(),seen=[];const app=createHomeFacts({identity:()=>identity,storage,mutate:async fn=>fn(),now:()=>NOW,
    request:async kind=>{if(kind==='weather')throw Error('provider unavailable');return payload(kind);},render:value=>seen.push(value)});
  await app.refresh();assert.equal(seen.at(-1).attendance.value,'321');assert.equal(seen.at(-1).schedule.shift,'8:00 AM–5:00 PM');assert.deepEqual(seen.at(-1).weather.hours,[]);app.dispose();
});
await check('offline cached facts are identity bound and stay marked stale',async()=>{
  const storage=memory(),seen=[];let time=NOW;
  const app=createHomeFacts({identity:()=>identity,storage,mutate:async fn=>fn(),now:()=>time,request:async kind=>payload(kind),render:value=>seen.push(value)});
  await app.refresh();app.dispose();time+=2*3600000;
  const offline=createHomeFacts({identity:()=>identity,storage,mutate:async fn=>fn(),now:()=>time,request:async()=>{throw Error('offline');},render:value=>seen.push(value)});
  await offline.refresh();assert.equal(seen.at(-1).attendance.value,'321');assert.equal(seen.at(-1).attendance.stale,true);offline.dispose();
  const other=createHomeFacts({identity:()=>({...identity,employeeId:'another',employeeName:'New'}),storage,mutate:async fn=>fn(),now:()=>time,request:async()=>{throw Error('offline');},render:value=>seen.push(value)});
  await other.refresh();assert.equal(seen.at(-1).attendance.value,'Unavailable');assert.equal(seen.at(-1).schedule.shift,'Schedule unavailable');other.dispose();
});
await check('late response cannot update the next employee',async()=>{
  let current=identity;const storage=memory(),resolvers=[],seen=[];
  const app=createHomeFacts({identity:()=>current,storage,mutate:async fn=>fn(),now:()=>NOW,request:async kind=>new Promise(resolve=>resolvers.push(()=>resolve(payload(kind)))),render:value=>seen.push(value)});
  const running=app.refresh();assert.equal(resolvers.length,3);const count=seen.length;current={...identity,employeeId:'another',employeeName:'Other'};
  resolvers.forEach(resolve=>resolve());await running;assert.equal(seen.length,count);assert.equal(storage.values.size,0);app.dispose();
});
await check('page disposal settles held optional requests without writing cached facts',async()=>{
  const storage=memory(),seen=[],app=createHomeFacts({identity:()=>identity,storage,mutate:async fn=>fn(),now:()=>NOW,request:async()=>new Promise(()=>{}),render:value=>seen.push(value)});
  const pending=app.refresh();app.dispose();await pending;assert.equal(storage.values.size,0);assert.equal(seen.length,1);
});
await check('a new fetch failure marks a recent last-good response stale without zeroing it',async()=>{
  const storage=memory(),seen=[];let failed=false;
  const app=createHomeFacts({identity:()=>identity,storage,mutate:async fn=>fn(),now:()=>NOW,request:async kind=>{if(failed)throw Error('network lost');return payload(kind);},render:value=>seen.push(value)});
  await app.refresh();failed=true;await app.refresh({force:true});assert.equal(seen.at(-1).attendance.value,'321');assert.equal(seen.at(-1).attendance.stale,true);assert.equal(seen.at(-1).weather.stale,true);app.dispose();
});
console.log(JSON.stringify({scope:'Home support modules; pure and simulated lifecycle tests only; no physical UI or real provider proof',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
process.exitCode=results.some(result=>!result.passed)?1:0;
