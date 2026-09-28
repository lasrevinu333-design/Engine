import { attendanceFacts, currentWeatherFacts, homeBinding, scheduleFacts, weatherFacts, weatherAlertsFacts, zooServiceDate } from './home-facts.js';

// Fact panels never own the scan workflow, employee selection, or schedule writes.
export const HOME_IDENTITY_SUPERSEDED=Symbol('home-identity-superseded');
export function createHomeFacts({identity,identityVersion=()=>0,storage,mutate,request,render,resolveSchedule=(_id,data)=>data,onIdentityMismatch=()=>{},now=()=>Date.now(),kinds=['schedule','attendance','weather']}) {
  if(!Array.isArray(kinds)||kinds.some(kind=>!['schedule','attendance','weather','alerts'].includes(kind)))throw new TypeError('Unknown informational fact kind');
  const requestedKinds=[...new Set(kinds)];
  let binding='',records={},flight=null,disposed=false,generation=0,refreshSequence=0;
  const requests=new Set();
  const key=id=>`mz_custodial_home_cache:${encodeURIComponent(homeBinding(id))}:facts`;
  function draw(id) {
    if(disposed)return;
    const epoch=generation,version=identityVersion(),current=identity();
    // A reentrant event can dispose this owner while identity is sampled.
    // It owns neither the newer presentation nor its failure state.
    if(disposed||epoch!==generation||version!==identityVersion()||current===HOME_IDENTITY_SUPERSEDED)return;
    if(homeBinding(current)!==homeBinding(id)){invalidate();onIdentityMismatch();return;}
    const data=kind=>records[kind]?.data && (records[kind].failed||records[kind].fromCache) ? {...records[kind].data,stale:true} : records[kind]?.data;
    const schedule=resolveSchedule(id,data('schedule'));
    if(disposed||epoch!==generation||version!==identityVersion())return;
    render({date:zooServiceDate(now()),schedule:scheduleFacts(schedule,id,schedule?.schedule_readback_at??records.schedule?.received_at,now()),
      attendance:attendanceFacts(data('attendance'),now()),weather:weatherFacts(data('weather'),records.weather?.received_at,now()),currentWeather:currentWeatherFacts(data('weather'),records.weather?.received_at,now()),alerts:weatherAlertsFacts(data('alerts'),records.alerts?.received_at,now())});
  }
  function load(id) {
    const next=homeBinding(id);if(binding===next)return;
    invalidate();binding=next;
    try{
      const raw=storage.getItem(key(id));if(!raw||raw.length>150000)return;
      const saved=JSON.parse(raw);
      if(saved?.schema_version==='custodial-home-facts.v2-original-hub'&&saved.binding===next&&saved.records&&typeof saved.records==='object'){
        records=saved.records;for(const value of Object.values(records))if(value&&typeof value==='object')value.fromCache=true;
      }
    }catch{records={};}
  }
  async function persist(id,epoch) {
    const expected=homeBinding(id);
    if(disposed||epoch!==generation||homeBinding(identity())!==expected)return;
    const encoded=JSON.stringify({schema_version:'custodial-home-facts.v2-original-hub',binding:expected,records});
    if(encoded.length>150000)return;
    try{await mutate(()=>{
      if(disposed||epoch!==generation||homeBinding(identity())!==expected)return;
      storage.setItem(key(id),encoded);
    });}catch{ /* Optional fact-cache failure must not interrupt cleaning. */ }
  }
  async function refresh({force=false}={}) {
    if(disposed)return;
    const invocation=++refreshSequence;
    const version=identityVersion(),id=identity();
    const ownsLaunch=()=>!disposed&&invocation===refreshSequence&&version===identityVersion();
    if(!ownsLaunch()||id===HOME_IDENTITY_SUPERSEDED)return;
    if(!id){invalidate();return;}
    load(id);if(!ownsLaunch())return;draw(id);
    if(!ownsLaunch())return;
    if(flight&&!force)return flight;
    if(flight){
      const replacement=++generation,retiring=[...requests];requests.clear();flight=null;
      for(const controller of retiring)controller.abort();
      // Abort listeners run synchronously and may replace/dispose this owner.
      // Only its detached requests were cancelled; never start new work from
      // a superseded frame or clear requests belonging to a nested refresh.
      if(!ownsLaunch()||replacement!==generation)return flight;
    }
    const captured=homeBinding(id),epoch=++generation;
    const ownsFlight=()=>!disposed&&epoch===generation&&version===identityVersion();
    // Publish ownership BEFORE invoking any request: synchronous callbacks may
    // themselves refresh. A joining refresh does not cancel this owner; a new
    // forced flight advances generation and retires every remaining dispatch.
    let settle;const pending=new Promise(resolve=>{settle=resolve;});flight=pending;
    Promise.allSettled(requestedKinds.map(async kind=>{
      if(!ownsFlight())return;
      const before=records[kind],age=now()-Date.parse(before?.received_at||'');
      const ttl=kind==='weather'?10*60000:kind==='alerts'?60000:30000;
      if(!force&&Number.isFinite(age)&&age>=0&&age<ttl)return;
      const controller=new AbortController();requests.add(controller);
      let timeout;
      try{
        const response=request(kind,id,controller.signal);
        if(!ownsFlight()||controller.signal.aborted){Promise.resolve(response).catch(()=>{});return;}
        const data=await Promise.race([response,new Promise((_,reject)=>{
          controller.signal.addEventListener('abort',()=>reject(Error('Facts update interrupted')),{once:true});
          timeout=setTimeout(()=>controller.abort(),8000);
        })]);
        if(!data||!ownsFlight()||controller.signal.aborted)return;
        const current=identity();if(!ownsFlight()||current===HOME_IDENTITY_SUPERSEDED||homeBinding(current)!==captured)return;
        records[kind]={data,received_at:new Date(now()).toISOString()};
        draw(id);await persist(id,epoch);
      }catch{if(ownsFlight()){const current=identity();if(ownsFlight()&&current!==HOME_IDENTITY_SUPERSEDED&&homeBinding(current)===captured){if(records[kind])records[kind].failed=true;draw(id);}}}
      finally{clearTimeout(timeout);requests.delete(controller);}
    })).then(()=>{if(flight===pending)flight=null;settle();});
    return flight;
  }
  function invalidate(){generation++;const retiring=[...requests];requests.clear();binding='';records={};flight=null;for(const controller of retiring)controller.abort();}
  function dispose(){disposed=true;invalidate();}
  return {refresh,dispose,invalidate,redraw:()=>{const version=identityVersion(),id=identity();
    if(disposed||id===HOME_IDENTITY_SUPERSEDED||version!==identityVersion())return;
    if(id){load(id);draw(id);}else invalidate();}};
}
