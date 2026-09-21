import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {installManagerWeather} from '../mobile/src/manager/home-weather.js';
import {HOME_WEATHER_URL} from '../mobile/src/custodial/home-facts.js';
const NOW=Date.parse('2026-09-21T18:15:00Z');
function fixture(){
  let clock=NOW,visible=true,sequence=0;
  const elements=new Map(),timers=new Map(),calls=[];
  const element=id=>{
    if(!elements.has(id)){
      const values={textContent:'',innerHTML:''},writes={textContent:0,innerHTML:0};
      const el={dataset:{},writes};
      for(const key of Object.keys(values))Object.defineProperty(el,key,{get:()=>values[key],set:value=>{values[key]=value;writes[key]++;}});
      elements.set(id,el);
    }
    return elements.get(id);
  };
  const hour=Math.floor(NOW/3600000)*3600;
  const weather={current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:NOW/1000,temperature_2m:80,weather_code:1,wind_speed_10m:5},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>hour+i*3600),temperature_2m:Array(8).fill(80),apparent_temperature:Array(8).fill(84),weather_code:Array(8).fill(1),wind_speed_10m:Array(8).fill(5),precipitation_probability:Array(8).fill(0)}};
  const controller=installManagerWeather({document:{getElementById:element},now:()=>clock,isVisible:()=>visible,
    setIntervalFn:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearIntervalFn:id=>timers.delete(id),
    requestJson:async url=>{calls.push(url);return url===HOME_WEATHER_URL?weather:{type:'FeatureCollection',features:[]};}});
  return {controller,element,calls,timers,advance:ms=>{clock+=ms;},hide:()=>{visible=false;}};
}
test('one-second clock ticks do not rewrite hourly weather or live warnings',async()=>{
  const f=fixture();try{
    await f.controller.start();
    const ids=['manager-weather-hours','manager-weather-alerts','manager-alerts-freshness'];
    const counts=ids.map(id=>({...f.element(id).writes}));
    f.advance(1000);for(const timer of f.timers.values())if(timer.ms===1000)timer.fn();
    assert.match(f.element('manager-home-clock').textContent,/1:15:01/);
    ids.forEach((id,i)=>assert.deepEqual(f.element(id).writes,counts[i],id));
    assert.equal(f.calls.length,2);
  }finally{f.controller.stop();}
});
test('unchanged refresh leaves the warning live region untouched',async()=>{
  const f=fixture();try{
    await f.controller.start();const before={...f.element('manager-weather-alerts').writes};
    await f.controller.refresh();assert.deepEqual(f.element('manager-weather-alerts').writes,before);
    assert.equal(f.calls.length,2);
  }finally{f.controller.stop();}
});
test('warning renderer has a matching semantic list and list-item styling',()=>{
  const html=readFileSync(new URL('../mobile/src/manager/index.html',import.meta.url),'utf8');
  assert.match(html,/<ul\b[^>]*id="manager-weather-alerts"[^>]*aria-live="polite"[^>]*><\/ul>/);
  assert.match(html,/\.managerWeatherAlerts li\s*\{/);
  assert.doesNotMatch(html,/\.managerWeatherAlerts article/);
});
