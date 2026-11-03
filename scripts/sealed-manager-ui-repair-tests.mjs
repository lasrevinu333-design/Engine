import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {zooLocalInstant,zooLocalInput} from '../zoo-local-time.mjs';
import {attendanceFacts} from '../mobile/src/custodial/home-facts.js';
import {installManagerWeather} from '../mobile/src/manager/home-weather.js';
import {createManagerHomeContext} from '../mobile/src/manager/home-context.js';
const results=[];const test=async(name,fn)=>{if(process.env.SEALED_MANAGER_CASE&&!name.includes(process.env.SEALED_MANAGER_CASE))return;await fn();results.push(name);console.log('ok - '+name);};
const settle=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
class Element {
  value='';textContent='';innerHTML='';hidden=false;disabled=false;dataset={};children=[];listeners=new Map();
  classList={toggle(){},remove(){},add(){}};
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  fire(type,event={}){return Promise.all((this.listeners.get(type)||[]).map(fn=>fn(event)));}
  setAttribute(){} removeAttribute(){} focus(){} append(...children){this.children.push(...children);} replaceChildren(...children){this.children=children;this.textContent='';this.innerHTML='';}
}
const documentFixture=()=>{const nodes=new Map();return{nodes,hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element()};};
await test('F23 Zoo civil conversion independent of browser zone; gap/fold and invalid civil dates',()=>{
  const previous=process.env.TZ;
  try{for(const zone of ['America/Chicago','America/New_York','UTC']){process.env.TZ=zone;assert.equal(zooLocalInstant('2026-10-31T13:00'),'2026-10-31T18:00:00.000Z');}}
  finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  assert.throws(()=>zooLocalInstant('2026-03-08T02:30'),/does not exist/);
  assert.throws(()=>zooLocalInstant('2026-11-01T01:30'),/occurs twice/);
  assert.equal(zooLocalInstant('2026-11-01T01:30','earlier'),'2026-11-01T06:30:00.000Z');
  assert.equal(zooLocalInstant('2026-11-01T01:30','later'),'2026-11-01T07:30:00.000Z');
  assert.equal(zooLocalInput('2026-11-01T07:30:00Z'),'2026-11-01T01:30:00');
  for(const value of ['2026-02-30T12:00','2026-10-31T24:00','2026-10-31T13:60','2026-10-31','2026-10-31T13:00Z'])assert.throws(()=>zooLocalInstant(value));
});
await test('F04 actual notification client sends canonical cohort CSRF and rejects owner changes',async()=>{
  const source=readFileSync(new URL('../mobile/src/manager/notifications-client.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  let session={role:'ops_manager',manager_id:'synthetic-manager',credential_id:'synthetic-registration',device_id:'SYNTHETIC_BROWSER',token:'SYNTHETIC_TOKEN',expires_at:'2099-01-01T00:00:00Z',auth_mode:'leadership_cohort'};
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch;let calls=[];
  try{
    globalThis.window={MemphisAuth:{readSession:()=>session,opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'SYNTHETIC_CSRF'})}};
    globalThis.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({ok:true,data:{registered:true}})};};
    const module=await import('data:text/javascript,'+encodeURIComponent(source));
    await module.managerNotificationRequest('/manager-notifications-api/register',{method:'POST',body:{token:'SYNTHETIC_PUSH_TOKEN'}});
    assert.equal(calls[0].options.headers['X-CSRF-Token'],'SYNTHETIC_CSRF');assert.equal(calls[0].options.headers.Authorization,'Bearer SYNTHETIC_TOKEN');
    window.MemphisAuth.opsManagerAuthHeaders=async()=>{session={...session,credential_id:'NEW_REGISTRATION'};return{Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'OTHER'};};
    await assert.rejects(module.managerNotificationRequest('/manager-notifications-api/register',{method:'DELETE'}),/access changed/);assert.equal(calls.length,1);
    window.MemphisAuth.opsManagerAuthHeaders=async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'SYNTHETIC_CSRF'});
    globalThis.fetch=async()=>({ok:true,json:async()=>{session={...session,token:'DIFFERENT'};return{ok:true,data:{registered:true}};}});
    await assert.rejects(module.managerNotificationRequest('/manager-notifications-api/register',{method:'DELETE'}),/outcome has not been confirmed/);
  }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
function insightsFixture(){
  const d=documentFixture(),tickets=[7,30].map(n=>{const e=new Element();e.dataset.window=String(n);return e;}),tabs=['performance','cleanings','tickets','inspections'].map(name=>{const e=new Element();e.dataset.tab=name;return e;});
  d.querySelectorAll=selector=>selector==='[data-window]'?tickets:selector==='[data-tab]'?tabs:[];
  let session={role:'ops_manager',manager_id:'SYNTHETIC_MANAGER',credential_id:'SYNTHETIC_ENROLLMENT',device_id:'SYNTHETIC_DEVICE',token:'SYNTHETIC',expires_at:'2099-01-01T00:00:00Z'};
  const requests=[],w={location:{hash:'#panel-cleanings'},addEventListener(){},MemphisAuth:{readSession:()=>session},MemphisMobile:{readSession:()=>session,authHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id}),requestEnvelope:path=>{const job=deferred();requests.push({path,...job});return job.promise;}}};
  vm.runInNewContext((process.env.SEALED_MANAGER_BASELINE==='1'?readFileSync(process.env.SEALED_MANAGER_BASELINE_FILE,'utf8'):readFileSync(new URL('../operational-insights.js',import.meta.url),'utf8')),{window:w,document:d,URL,Date,console});
  return{d,tickets,tabs,requests,change:()=>{session={...session,credential_id:'OTHER'};}};
}
await test('F24 actual insights script late success/error cannot overwrite selected window or status',async()=>{
  const f=insightsFixture();await settle();if(process.env.SEALED_MANAGER_BASELINE!=='1')assert.equal(f.tabs.find(t=>t.dataset.tab==='cleanings').tabIndex,0);
  for(const r of f.requests)r.resolve({data:r.path.includes('inspection-coverage')?null:[]});await settle();
  f.tickets[0].fire('click');await settle();const old=f.requests.at(-1);f.tickets[1].fire('click');await settle();const latest=f.requests.at(-1);
  latest.resolve({data:[{location_name:'NEW_30_DAY',ticket_count_last_30_days:3}]});await settle();old.resolve({data:[{location_name:'OLD_7_DAY',ticket_count_last_7_days:99}]});await settle();
  assert.match(f.d.nodes.get('tickets-list').innerHTML,/NEW_30_DAY/);assert.doesNotMatch(f.d.nodes.get('tickets-list').innerHTML,/OLD_7_DAY/);assert.match(f.d.nodes.get('tickets-list').innerHTML,/3 in 30 days/);
  const status=f.d.nodes.get('global-status').textContent;
  f.tickets[0].fire('click');await settle();const failed=f.requests.at(-1);f.tickets[1].fire('click');await settle();f.requests.at(-1).resolve({data:[]});await settle();failed.reject(new Error('OLD_FAILURE'));await settle();
  assert.equal(f.d.nodes.get('global-status').textContent,status);
});
await test('F24 actual insights filter change withdraws old cards and changed principal rejects native read',async()=>{
  const f=insightsFixture();await settle();for(const r of f.requests)r.resolve({data:r.path.includes('inspection-coverage')?null:[]});await settle();
  const employee=f.d.nodes.get('cleanings-employee');employee.value='selected';employee.fire('change');assert.match(f.d.nodes.get('cleanings-list').innerHTML,/unavailable/);
  f.d.nodes.get('apply-cleanings').fire('click');await settle();const old=f.requests.at(-1);employee.value='new-selection';employee.fire('change');old.resolve({data:[{location_name:'OLD_FILTER'}]});await settle();assert.doesNotMatch(f.d.nodes.get('cleanings-list').innerHTML,/OLD_FILTER/);
  f.d.nodes.get('apply-cleanings').fire('click');await settle();f.change();f.requests.at(-1).resolve({data:[{location_name:'OTHER_PRINCIPAL'}]});await settle();assert.doesNotMatch(f.d.nodes.get('cleanings-list').innerHTML,/OTHER_PRINCIPAL/);assert.match(f.d.nodes.get('global-status').textContent,/session changed/);
});
await test('F20/F26 actual Home controller keeps source statuses, rejects invalid queue and late responses',async()=>{
  const d=documentFixture(),now=Date.parse('2026-10-31T18:00:00Z');let current=true,queue={schema:'custodial.open-problems.v1',generated_at:new Date(now).toISOString(),total:2,items:[{source:'maintenance',source_id:'a',source_label:'Cleaning issue / maintenance reminder',location:'Primate',summary:'Soap',observed_at:new Date(now).toISOString(),status:'open'},{source:'saved_work',source_id:'b',source_label:'Protected saved work needs review',status:'quarantined'}]};
  const event={id:'a',name:'Sourced event',date:'2026-10-31',status:'SCHEDULED',start_at:'2026-10-31T18:00:00Z',end_at:'2026-10-31T20:00:00Z'};
  let pending=null;const controller=createManagerHomeContext({document:d,now:()=>now,isCurrent:()=>current,request:async path=>pending?pending.promise:path.endsWith('open-problems')?queue:{schema:'custodial.operations-board.v1',timezone:'America/Chicago',generated_at:new Date(now).toISOString(),events:[event,{...event,id:'b',name:'Cancelled event',status:'CANCELLED'}]}});
  await controller.refresh();assert.equal(d.nodes.get('today-open-problems').textContent,'2');assert.equal(d.nodes.get('today-events').children.length,2);assert.match(d.nodes.get('today-events').children[1].children[1].textContent,/Cancelled/);assert.match(d.nodes.get('open-problems-list').children[1].children[3].textContent,/quarantined/);
  queue={...queue,total:null};await controller.refresh();assert.equal(d.nodes.get('today-open-problems').textContent,'Unavailable');assert.match(d.nodes.get('open-problems-source').textContent,/unavailable/);
  pending=deferred();const request=controller.refresh();controller.clear();current=false;pending.resolve(queue);await request;assert.equal(d.nodes.get('open-problems-list').children.length,0);assert.equal(d.nodes.get('today-events').children.length,0);
});
await test('F21 actual weather controller mounts 8 hours, rain/feels-like/wind and preserves stale last good on failure',async()=>{
  const d=documentFixture(),now=Date.parse('2026-10-31T18:00:00Z'),timers=new Set();let failed=false;
  const weather={current_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mph'},current:{time:now/1000,temperature_2m:70,apparent_temperature:72,weather_code:0,wind_speed_10m:8},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mph',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>now/1000+i*3600),temperature_2m:Array(8).fill(70),apparent_temperature:Array(8).fill(72),weather_code:Array(8).fill(0),wind_speed_10m:Array(8).fill(8),precipitation_probability:Array(8).fill(20)}};
  const c=installManagerWeather({document:d,now:()=>now,requestJson:async url=>{if(failed)throw new Error('offline');return url.includes('weather.gov')?{type:'FeatureCollection',features:[]}:weather;},setIntervalFn:fn=>{timers.add(fn);return fn;},clearIntervalFn:fn=>timers.delete(fn)});
  try{await c.start();assert.equal((d.nodes.get('manager-weather-hours').innerHTML.match(/<li>/g)||[]).length,8);assert.match(d.nodes.get('manager-weather-hours').innerHTML,/Feels like 72°F.*Wind 8 mph.*20% rain/);assert.match(d.nodes.get('manager-alerts-freshness').textContent,/No active alerts reported/);
    failed=true;await c.refresh({force:true});assert.match(d.nodes.get('manager-weather-current').textContent,/70°F/);assert.equal(d.nodes.get('manager-weather-freshness').dataset.stale,'true');c.stop({clear:false});assert.equal(timers.size,0);await c.start();assert.match(d.nodes.get('manager-weather-current').textContent,/70°F/);
  }finally{c.stop();assert.equal(timers.size,0);}
});
await test('F21 actual web Home boot mounts shared weather and retires its timers on pagehide',async()=>{
  const d=documentFixture(),listeners=new Map(),timers=new Set(),now=Date.parse('2026-10-31T18:00:00Z');d.addEventListener=()=>{};
  const session={role:'ops_manager',manager_id:'SYNTHETIC_MANAGER',credential_id:'SYNTHETIC_REGISTRATION',device_id:'SYNTHETIC_BROWSER',token:'SYNTHETIC_TOKEN',expires_at:'2099-01-01T00:00:00Z',roles:['CUSTODIAL_MANAGER'],permissions:{owner:true},read_only:false};
  const window={location:{href:'https://synthetic.invalid/start_page1.html',origin:'https://synthetic.invalid',pathname:'/start_page1.html',search:'',hash:'',replace(){throw new Error('Unexpected navigation');}},addEventListener:(event,fn)=>listeners.set(event,fn),MemphisAuth:{backendOrigin:'https://synthetic.invalid',getDeviceId:()=>session.device_id,readSession:()=>session,isOpsManager:s=>s===session,requireOpsManagerSession:async()=>session,hasRole:()=>true,canMutateOpsManagerSurface:()=>true,isCustodialManagementAdmin:()=>true}};
  const weather={current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mph'},current:{time:now/1000,temperature_2m:75,weather_code:0,wind_speed_10m:6},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mph',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>now/1000+i*3600),temperature_2m:Array(8).fill(75),apparent_temperature:Array(8).fill(76),weather_code:Array(8).fill(0),wind_speed_10m:Array(8).fill(6),precipitation_probability:Array(8).fill(0)}};
  const interval=fn=>{timers.add(fn);return fn;},clear=fn=>timers.delete(fn),publicCalls=[];
  const install=options=>installManagerWeather({...options,now:()=>now,setIntervalFn:interval,clearIntervalFn:clear,requestJson:async url=>{publicCalls.push(url);return url.includes('weather.gov')?{type:'FeatureCollection',features:[]}:weather;}});
  vm.runInNewContext(readFileSync(new URL('../ops-hub.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),{window,document:d,URL,URLSearchParams,Date,console,setInterval:interval,clearInterval:clear,installManagerWeather:install,fetch:async url=>({ok:true,json:async()=>url.endsWith('/version')?{version:'SYNTHETIC'}:{ok:true,data:url.endsWith('/guest-api/status')?{enabled:false}:{attendance:1,stale:false,source_timestamp:new Date().toISOString()}}})});
  await settle();await settle();assert.match(d.nodes.get('weather-value').textContent,/75°F/);assert.equal(publicCalls.length,2);assert.equal((d.nodes.get('manager-weather-hours').innerHTML.match(/<li>/g)||[]).length,8);assert.match(d.nodes.get('manager-alerts-freshness').textContent,/No active alerts reported/);
  listeners.get('pagehide')();assert.equal(timers.size,0);
});
await test('F19/F20/F21/F26/F28 actual native manager app boot and confirmed removal failure/cancel/success',async()=>{
  const d=documentFixture(),events=new Map(),timers=new Set(),now=Date.parse('2026-10-31T18:00:00Z');d.addEventListener=(k,fn)=>events.set(k,fn);d.body=new Element();
  let session={role:'ops_manager',manager_id:'SYNTHETIC_MANAGER',credential_id:'SYNTHETIC_REGISTRATION',device_id:'SYNTHETIC_BROWSER',token:'SYNTHETIC',expires_at:'2099-01-01T00:00:00Z',roles:['CUSTODIAL_MANAGER'],permissions:{owner:true},read_only:false},allowed=false,failRemoval=true,removed=0,weatherStarts=0,weatherStops=0;
  const window={addEventListener:(k,fn)=>events.set(k,fn),MemphisMobile:{adoptSession(){}},MemphisAuth:{readSession:()=>session,isCustodialManagementAdmin:()=>true,requireOpsManagerSession:async()=>session,opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'SYNTHETIC_CSRF'}),clearSession:async()=>{removed++;if(failRemoval)throw new Error('Synthetic unavailable');session=null;}}};
  const storage=new Map(),calls=[];let attendanceData={attendance:4,stale:false,source_timestamp:new Date(now).toISOString()};
  const fetch=async(url,opts)=>{calls.push({url,opts});const path=new URL(url).pathname;const data=path==='/dashboard-api/summary'?{snapshot:{overdue_locations:1,due_soon_locations:2,in_progress_locations:3,snapshot_at:new Date(now).toISOString(),open_ticket_count:999}}:path.endsWith('/current-attendance')?attendanceData:path.endsWith('/operations')?{schema:'custodial.operations-board.v1',timezone:'America/Chicago',generated_at:new Date(now).toISOString(),events:[]}:{schema:'custodial.open-problems.v1',generated_at:new Date(now).toISOString(),total:0,items:[]};return{ok:true,json:async()=>({ok:true,data})};};
  vm.runInNewContext(readFileSync(new URL('../mobile/src/manager/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),{window,document:d,Date,URL,console,fetch,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),confirm:()=>allowed,App:{addListener:async()=>({remove(){}})},Network:{addListener:async()=>({remove(){}})},StatusBar:{hide:async()=>{}},ensurePushRegistration:async()=>{},unregisterPushNotifications:async()=>{},installNotificationRouting:async()=>{},attendanceFacts:data=>attendanceFacts(data,now),createManagerHomeContext:options=>createManagerHomeContext({...options,now:()=>now}),installManagerWeather:()=>({start:async()=>{weatherStarts++;},stop:()=>{weatherStops++;}})});
  await settle();await settle();assert.equal(d.nodes.get('hub').hidden,false);assert.equal(d.nodes.get('today-overdue').textContent,'1');assert.equal(d.nodes.get('today-open-problems').textContent,'0');assert.ok(weatherStarts>0);assert.equal(calls.length,4);assert.ok(calls.every(c=>c.opts.headers['X-CSRF-Token']==='SYNTHETIC_CSRF'));
  for(const [data,expected] of [[{attendance:0,source_timestamp:new Date(now).toISOString()},'0'],[{attendance:8,available:false,source_timestamp:new Date(now).toISOString()},'Unavailable'],[{attendance:9,source_timestamp:'2026-10-31T04:59:59Z'},'Unavailable'],[{attendance:10,source_timestamp:new Date(now+61000).toISOString()},'Unavailable']]){attendanceData=data;await d.nodes.get('refresh').fire('click');await settle();assert.equal(d.nodes.get('today-guest-count').textContent,expected);}
  d.nodes.get('logout').fire('click');await settle();assert.equal(removed,0);
  allowed=true;d.nodes.get('logout').fire('click');await settle();assert.equal(removed,1);assert.equal(d.nodes.get('hub').hidden,false);assert.match(d.nodes.get('hub-status').textContent,/access was kept/);
  failRemoval=false;d.nodes.get('logout').fire('click');await settle();assert.equal(removed,2);assert.equal(d.nodes.get('hub').hidden,true);assert.ok(weatherStops>0);events.get('pagehide')();assert.equal(timers.size,0);
});
await test('F20/F21/F28 shipped source wiring and protected removal placement',()=>{
  const html=readFileSync(new URL('../mobile/src/manager/index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../mobile/src/manager/app.js',import.meta.url),'utf8'),web=readFileSync(new URL('../start_page1.html',import.meta.url),'utf8'),hub=readFileSync(new URL('../ops-hub.js',import.meta.url),'utf8');
  assert.match(html,/href="\.\/operations-dashboard.html"/);assert.match(html,/href="\.\/events.html"/);assert.match(app,/createManagerHomeContext/);assert.match(app,/managerWeather.start\(\)/);
  assert.match(html,/<details id="phone-settings"[\s\S]*id="logout"[\s\S]*<\/details>/);assert.equal((html.match(/id="logout"/g)||[]).length,1);assert.match(app,/if \(confirm\('Remove leadership enrollment.*Employee saved work will not be erased/);
  assert.match(web,/https:\/\/api.weather.gov;/);assert.match(web,/<script type="module" src="\.\/ops-hub/);assert.match(hub,/installManagerWeather/);
  for(const id of ['manager-weather-hours','manager-weather-alerts','manager-weather-freshness','manager-alerts-freshness']){assert.match(html,new RegExp('id="'+id+'"'));assert.match(web,new RegExp('id="'+id+'"'));}
});
console.log(JSON.stringify({suite:'sealed manager UI repair source/DOM mocks',passed:results.length,failed:0,network:false,device:false,independentAcceptance:false,cases:results}));
