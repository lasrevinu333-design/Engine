import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {managerHomeFixture} from './operations-dashboard-tests.mjs';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';
import {HOME_WEATHER_URL,HOME_WEATHER_ALERTS_URL} from '../mobile/src/custodial/home-facts.js';
// Current shared weather owner and actual authenticated web Home boot. The
// imported fixture captures the real static import, not obsolete inline owners.
const NOW=Date.parse('2026-09-21T18:15:00Z'),stamp=new Date(NOW).toISOString(),hour=Math.floor(NOW/3600000)*3600;
const html=readFileSync(new URL('../start_page1.html',import.meta.url),'utf8');
for(const id of ['weather-value','weather-meta','manager-weather-hours','manager-weather-freshness','manager-weather-alerts','manager-alerts-freshness','attendance-value','attendance-meta','clock','date'])assert.ok(html.includes(`id="${id}"`),'Actual manager Home contains '+id);
const weather={current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:NOW/1000,temperature_2m:80,weather_code:1,wind_speed_10m:5},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>hour+i*3600),temperature_2m:Array(8).fill(80),apparent_temperature:Array(8).fill(84),weather_code:Array(8).fill(1),wind_speed_10m:Array(8).fill(5),precipitation_probability:Array(8).fill(0)}};
const results=[];async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
await check('Manager runtime graph includes the actual shared fact and weather modules',()=>{const files=discoverRuntimeFiles(new URL('..',import.meta.url).pathname);for(const file of ['mobile/src/custodial/home-facts.js','mobile/src/manager/home-weather.js'])assert.ok(files.includes(file));});
const f=await managerHomeFixture({now:NOW,weather,attendance:{attendance:0,source_timestamp:stamp}});
try {
 await check('Actual manager controller renders eight hourly periods and all required values',()=>{const hours=f.node('manager-weather-hours').innerHTML;assert.equal((hours.match(/<li>/g)||[]).length,8);assert.match(hours,/Feels like 84°F/);assert.match(hours,/5 mph/);assert.match(hours,/0% rain/);assert.ok(f.requests.includes(HOME_WEATHER_URL));});
 await check('Manager clock uses Memphis time',()=>{assert.match(f.node('date').textContent,/September 21, 2026/);assert.match(f.node('clock').textContent,/1:15/);});
 await check('Genuine zero attendance renders and absent attendance is unavailable',async()=>{assert.equal(f.node('attendance-value').textContent,'0');f.attendance={attendance:null};f.intervals.get(30000)();await f.turn();assert.equal(f.node('attendance-value').textContent,'Unavailable');});
 await check('Failed refresh preserves marked last-good weather and never reports an alert all-clear',async()=>{f.fetchOverride=async()=>{throw Error('Synthetic network loss');};await f.weatherController.refresh({force:true});assert.match(f.node('weather-value').textContent,/80°F/);assert.equal(f.node('manager-weather-freshness').dataset.stale,'true');assert.doesNotMatch(f.node('manager-alerts-freshness').textContent,/No active alerts reported/);f.fetchOverride=null;});
 await check('Malformed current observation does not fabricate a temperature',async()=>{f.weather={current:{time:NOW/1000,temperature_2m:null},current_units:{time:'unixtime',temperature_2m:'°F'}};await f.weatherController.refresh({force:true});assert.equal(f.node('weather-value').textContent,'Unavailable');});
 await check('Actual alert feed is requested and malformed feed stays unavailable',async()=>{assert.ok(f.requests.includes(HOME_WEATHER_ALERTS_URL));f.alerts={};await f.weatherController.refresh({force:true});assert.doesNotMatch(f.node('manager-alerts-freshness').textContent,/No active alerts reported/);assert.equal(f.node('manager-alerts-freshness').dataset.stale,'true');});
} finally {f.emit('pagehide');assert.equal(f.intervals.size,0);}
console.log(JSON.stringify({scope:'Actual current web Home with synthetic providers; not hosted or physical proof',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
process.exitCode=results.some(r=>!r.passed)?1:0;
