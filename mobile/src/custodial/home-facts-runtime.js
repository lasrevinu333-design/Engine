import { attendanceFacts, currentWeatherFacts, homeBinding, scheduleFacts, weatherFacts, weatherAlertsFacts, zooServiceDate } from './home-facts.js';

// Fact panels never own the scan workflow, employee selection, or schedule writes.
export function createHomeFacts({identity,storage,mutate,request,render,now=()=>Date.now(),kinds=['schedule','attendance','weather']}) {
  if(!Array.isArray(kinds)||kinds.some(kind=>!['schedule','attendance','weather','alerts'].includes(kind)))throw new TypeError('Unknown informational fact kind');
  const requestedKinds=[...new Set(kinds)];
  let binding='',records={},flight=null,disposed=false;
  const requests=new Set();
  const key=id=>`mz_custodial_home_cache:${id}:facts`;
  function draw(id) {
    if(disposed||homeBinding(identity())!==homeBinding(id))return;
    const data=kind=>records[kind]?.data && (records[kind].failed||records[kind].fromCache) ? {...records[kind].data,stale:true} : records[kind]?.data;
    render({date:zooServiceDate(now()),schedule:scheduleFacts(data('schedule'),id,records.schedule?.received_at,now()),
      attendance:attendanceFacts(data('attendance'),now()),weather:weatherFacts(data('weather'),records.weather?.received_at,now()),currentWeather:currentWeatherFacts(data('weather'),records.weather?.received_at,now()),alerts:weatherAlertsFacts(data('alerts'),records.alerts?.received_at,now())});
  }
  function load(id) {
    const next=homeBinding(id);if(binding===next)return;
    binding=next;records={};
    try{
      const raw=storage.getItem(key(id.deviceId));if(!raw||raw.length>150000)return;
      const saved=JSON.parse(raw);
      if(saved?.schema_version==='custodial-home-facts.v2-original-hub'&&saved.binding===next&&saved.records&&typeof saved.records==='object'){
        records=saved.records;for(const value of Object.values(records))if(value&&typeof value==='object')value.fromCache=true;
      }
    }catch{records={};}
  }
  async function persist(id) {
    const expected=homeBinding(id);
    if(disposed||homeBinding(identity())!==expected)return;
    const encoded=JSON.stringify({schema_version:'custodial-home-facts.v2-original-hub',binding:expected,records});
    if(encoded.length>150000)return;
    try{await mutate(()=>{
      if(disposed||homeBinding(identity())!==expected)return;
      storage.setItem(key(id.deviceId),encoded);
    });}catch{ /* Optional fact-cache failure must not interrupt cleaning. */ }
  }
  async function refresh({force=false}={}) {
    if(disposed)return;
    const id=identity();if(!id)return;
    load(id);draw(id);
    if(flight)return flight;
    const captured=homeBinding(id);
    flight=Promise.allSettled(requestedKinds.map(async kind=>{
      const before=records[kind],age=now()-Date.parse(before?.received_at||'');
      const ttl=kind==='weather'?10*60000:kind==='alerts'?60000:30000;
      if(!force&&Number.isFinite(age)&&age>=0&&age<ttl)return;
      const controller=new AbortController();requests.add(controller);
      let timeout;
      try{
        const data=await Promise.race([request(kind,id,controller.signal),new Promise((_,reject)=>{
          controller.signal.addEventListener('abort',()=>reject(Error('Facts update interrupted')),{once:true});
          timeout=setTimeout(()=>controller.abort(),8000);
        })]);
        if(!data||disposed||homeBinding(identity())!==captured)return;
        records[kind]={data,received_at:new Date(now()).toISOString()};
        draw(id);await persist(id);
      }catch{if(!disposed&&homeBinding(identity())===captured){if(records[kind])records[kind].failed=true;draw(id);}}
      finally{clearTimeout(timeout);requests.delete(controller);}
    })).finally(()=>{flight=null;});
    return flight;
  }
  function dispose(){disposed=true;for(const controller of requests)controller.abort();requests.clear();}
  return {refresh,dispose,redraw:()=>{const id=identity();if(id){load(id);draw(id);}}};
}
