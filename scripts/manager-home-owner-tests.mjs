import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as facts from '../mobile/src/custodial/home-facts.js';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';
const NOW=Date.parse('2026-09-21T18:15:00Z'),stamp=new Date(NOW).toISOString(),hour=Math.floor(NOW/3600000)*3600;
const html=readFileSync(new URL('../start_page1.html',import.meta.url),'utf8'),source=readFileSync(new URL('../ops-hub.js',import.meta.url),'utf8');
const ids=['weather-value','weather-meta','weather-hours','hourly-weather-meta','weather-alerts','weather-alerts-meta','attendance-value','attendance-meta','clock','date'];
for(const id of ids)assert.ok(html.includes(`id="${id}"`),`Actual manager Home contains ${id}`);
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,classList:{toggle(){}},dataset:{}});return elements.get(id);};
const weather={current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:NOW/1000,temperature_2m:80,weather_code:1,wind_speed_10m:5},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>hour+i*3600),temperature_2m:Array(8).fill(80),apparent_temperature:Array(8).fill(84),weather_code:Array(8).fill(1),wind_speed_10m:Array(8).fill(5),precipitation_probability:Array(8).fill(0)}};
let count=0,failed=false,alertData={type:'FeatureCollection',features:[]};const urls=[];
const context={console,URL,AbortController,setTimeout,clearTimeout,setInterval:()=>1,Date:class extends Date{constructor(...args){super(...(args.length?args:[NOW]));}static now(){return NOW;}},Intl,
  document:{getElementById:element},loadFacts:async()=>({ ...facts,currentWeatherFacts:(data,at)=>facts.currentWeatherFacts(data,at,NOW),weatherFacts:(data,at)=>facts.weatherFacts(data,at,NOW),weatherAlertsFacts:(data,at)=>facts.weatherAlertsFacts(data,at,NOW),attendanceFacts:data=>facts.attendanceFacts(data,NOW)}),
  fetch:async url=>{urls.push(url);if(failed)throw Error('fixture network loss');const data=url.includes('current-attendance')?{ok:true,data:{attendance:count,source_timestamp:stamp}}:url.includes('api.weather.gov')?alertData:weather;return {ok:true,json:async()=>data};}};
vm.createContext(context);
vm.runInContext(source.replace("import('./mobile/src/custodial/home-facts.js')",'globalThis.loadFacts()').replace("void init().catch((error)=>setStatus(safe(error),'error'));",'globalThis.managerFactsTest={refreshWeather,refreshWeatherAlerts,refreshAttendance,startClock};'),context);
const results=[];async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
await check('Manager runtime graph includes the shared fact module',()=>assert.ok(discoverRuntimeFiles(new URL('..',import.meta.url).pathname).includes('mobile/src/custodial/home-facts.js')));
await check('Actual manager controller renders eight hourly periods and required values',async()=>{await context.managerFactsTest.refreshWeather();assert.equal((element('weather-hours').innerHTML.match(/<li>/g)||[]).length,8);assert.match(element('weather-hours').innerHTML,/Feels like 84°F/);assert.match(element('weather-hours').innerHTML,/0% rain/);assert.ok(urls.includes(facts.HOME_WEATHER_URL));});
await check('Manager clock uses Memphis time and the current service date',()=>{context.managerFactsTest.startClock();assert.match(element('clock').textContent,/1:15 PM/);assert.match(element('date').textContent,/Sep 21, 2026/);});
await check('A genuine count of zero is distinct from a missing count',async()=>{count=0;await context.managerFactsTest.refreshAttendance();assert.equal(element('attendance-value').textContent,'0');count=null;await context.managerFactsTest.refreshAttendance();assert.equal(element('attendance-value').textContent,'Unavailable');});
await check('A fresh empty warning feed gives a sourced, non-alarming result',async()=>{await context.managerFactsTest.refreshWeatherAlerts();assert.equal(element('weather-alerts').innerHTML,'');assert.match(element('weather-alerts-meta').textContent,/No active alerts reported/);});
await check('Provider failure retains last-good weather but removes any confident all-clear',async()=>{failed=true;await context.managerFactsTest.refreshWeather();await context.managerFactsTest.refreshWeatherAlerts();assert.match(element('weather-value').textContent,/80°F/);assert.match(element('weather-meta').textContent,/Last update/);assert.doesNotMatch(element('weather-alerts-meta').textContent,/No active alerts reported/);});
console.log(JSON.stringify({scope:'Actual manager fact controller with isolated synthetic providers; not rendered-browser or phone acceptance',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
process.exitCode=results.some(r=>!r.passed)?1:0;
