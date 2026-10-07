import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOME_WEATHER_URL,HOME_WEATHER_ALERTS_URL} from '../mobile/src/custodial/home-facts.js';
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const base=new URL('../mobile/src/manager/',import.meta.url);
const html=readFileSync(new URL('index.html',base),'utf8');
const app=readFileSync(new URL('app.js',base),'utf8');
let installManagerWeather;
await check('Native manager weather controller exists',async()=>{({installManagerWeather}=await import(new URL('home-weather.js',base)));assert.equal(typeof installManagerWeather,'function');});
await check('Actual packaged Home includes date, time, hourly weather and warnings',()=>{for(const id of ['manager-home-date','manager-home-clock','manager-weather-current','manager-weather-summary','manager-weather-hours','manager-weather-freshness','manager-weather-alerts','manager-alerts-freshness'])assert.ok(html.includes(`id="${id}"`),id);});
await check('Manager lifecycle starts and stops the controller',()=>{assert.match(app,/from '\.\/home-weather\.js'/);assert.match(app,/managerWeather\.start\(/);assert.match(app,/managerWeather\.stop\(/);});
await check('Manager attendance uses the same validated fact interpretation',()=>{assert.match(app,/attendanceFacts/);assert.match(app,/data\?\.available/);});
const NOW=Date.parse('2026-09-21T18:15:00Z'),hour=Math.floor(NOW/3600000)*3600;
function weather(){return {current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:NOW/1000,temperature_2m:80,weather_code:1,wind_speed_10m:5},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>hour+i*3600),temperature_2m:Array(8).fill(80),apparent_temperature:Array(8).fill(84),weather_code:Array(8).fill(1),wind_speed_10m:Array(8).fill(5),precipitation_probability:Array(8).fill(0)}};}
function fixture(){
 const elements=new Map(),timers=new Map(),calls=[];let next=0,clock=NOW,visible=true,fail=false,pending=null;
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',dataset:{}});return elements.get(id);};
 const controller=installManagerWeather({document:{getElementById:element},now:()=>clock,isVisible:()=>visible,
  setIntervalFn:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearIntervalFn:id=>timers.delete(id),
  requestJson:async(url,{signal})=>{calls.push({url,signal});if(pending)return pending(url,signal);if(fail)throw Error('synthetic provider failure');return url===HOME_WEATHER_URL?weather():{type:'FeatureCollection',features:[]};}});
 return {controller,element,calls,timers,setFail:v=>{fail=v;},setVisible:v=>{visible=v;},advance:ms=>{clock+=ms;},setPending:fn=>{pending=fn;}};
}
if(installManagerWeather){
 await check('No provider requests before authenticated start',async()=>{const f=fixture();try{await f.controller.refresh();assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);}finally{f.controller.stop();}});
 await check('Eight hourly periods include feels-like wind and zero precipitation',async()=>{const f=fixture();try{await f.controller.start();assert.equal((f.element('manager-weather-hours').innerHTML.match(/<li>/g)||[]).length,8);assert.match(f.element('manager-weather-hours').innerHTML,/Feels like 84°F/);assert.match(f.element('manager-weather-hours').innerHTML,/5 mph/);assert.match(f.element('manager-weather-hours').innerHTML,/0% rain/);assert.ok(f.calls.some(c=>c.url===HOME_WEATHER_ALERTS_URL));}finally{f.controller.stop();}});
 await check('Clock uses Memphis time and ticks without re-fetching providers',async()=>{const f=fixture();try{await f.controller.start();assert.match(f.element('manager-home-clock').textContent,/1:15/);assert.match(f.element('manager-home-date').textContent,/September 21, 2026/);f.advance(60000);for(const timer of f.timers.values())if(timer.ms===1000)timer.fn();assert.match(f.element('manager-home-clock').textContent,/1:16/);assert.equal(f.calls.length,2);}finally{f.controller.stop();}});
 await check('Repeated start keeps one timer pair and respects provider refresh intervals',async()=>{const f=fixture();try{await f.controller.start();await f.controller.start();assert.equal(f.timers.size,2);assert.equal(f.calls.length,2);f.advance(61000);await f.controller.refresh();assert.equal(f.calls.filter(c=>c.url===HOME_WEATHER_ALERTS_URL).length,2);assert.equal(f.calls.filter(c=>c.url===HOME_WEATHER_URL).length,1);}finally{f.controller.stop();}});
 await check('Provider failure retains marked last-good weather without a false all-clear',async()=>{const f=fixture();try{await f.controller.start();f.setFail(true);await f.controller.refresh({force:true});assert.match(f.element('manager-weather-current').textContent,/80°F/);assert.equal(f.element('manager-weather-freshness').dataset.stale,'true');assert.doesNotMatch(f.element('manager-alerts-freshness').textContent,/No active alerts reported/);}finally{f.controller.stop();}});
 await check('Hidden Home does not request or render provider information',async()=>{const f=fixture();try{f.setVisible(false);await f.controller.start();assert.equal(f.calls.length,0);}finally{f.controller.stop();}});
 await check('Stopping clears timers and prevents a late response from rendering',async()=>{const f=fixture();let resolveWeather;f.setPending(url=>url===HOME_WEATHER_URL?new Promise(resolve=>{resolveWeather=resolve;}):Promise.resolve({type:'FeatureCollection',features:[]}));const running=f.controller.start();await Promise.resolve();f.controller.stop();const before=f.element('manager-weather-current').textContent;resolveWeather(weather());await running;assert.equal(f.element('manager-weather-current').textContent,before);assert.equal(f.timers.size,0);assert.ok(f.calls.every(call=>call.signal.aborted));});
 await check('Malformed alert feed cannot report an all-clear',async()=>{const f=fixture();try{f.setPending(async url=>url===HOME_WEATHER_URL?weather():{});await f.controller.start();assert.doesNotMatch(f.element('manager-alerts-freshness').textContent,/No active alerts reported/);assert.equal(f.element('manager-alerts-freshness').dataset.stale,'true');}finally{f.controller.stop();}});
}
console.log(JSON.stringify({scope:'Native manager Home source/controller with synthetic providers; no deployment, phone, notification/audio or physical evidence',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
process.exitCode=results.some(r=>!r.passed)?1:0;
