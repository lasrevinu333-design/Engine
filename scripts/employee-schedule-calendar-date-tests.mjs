import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
import {createSyntheticNativeHome} from './fixtures/native-home-mutation-context.mjs';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';

// Real consumers, synthetic authenticated transport/storage; no physical-device claim.
const RealDate=Date,results=[];
const instants=['2026-11-10T05:59:59Z','2026-11-10T06:00:00Z','2026-11-10T09:59:59Z','2026-11-10T10:00:00Z'];
const dates=['2026-11-09','2026-11-10','2026-11-10','2026-11-10'];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const fixedDate=get=>class extends RealDate{constructor(...args){super(...(args.length?args:[get()]));}static now(){return get();}};
const data=(date,off=false)=>({service_date:date,employee_id:id(2),employee_name:'Synthetic employee',
  canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',credential_id:id(3),assignment_epoch:7,
  publication_id:id(4),projection_id:id(5),projection_status:'current',schedule_delivery_mode:'LEGACY_REGISTERED',
  full_day:true,schedule_status:off?'off':'working',phase:off?'off_day':'before_shift',
  shift:{active:!off,start:'05:00',end:'14:00'},lunch:{start:'09:30',end:'10:30'},
  raw_items:off?[]:[{name:'Synthetic Area',coverage_start:'05:00',coverage_end:'14:00'}],
  home_facts:{service_date:date,employee_id:id(2),employee_name:'Synthetic employee',publication_id:id(4),projection_id:id(5),
    projection_status:'current',schedule_status:off?'off':'working',phase:off?'off_day':'before_shift',
    shift:{active:!off,start:'05:00',end:'14:00'},lunch:{start:'09:30',end:'10:30'}}});
const node=()=>({textContent:'',innerHTML:'',hidden:false,dataset:{},addEventListener(){}});
async function test(name,run){await run();results.push({name,pass:true});}

async function home(instant,expected,off,{cross=false,wrong=false}={}){
  let now=RealDate.parse(instant),app;const saved=new Map(['Date','window','document','localStorage','fetch','setInterval','clearInterval'].map(k=>[k,globalThis[k]]));
  const nodes=new Map(),storage=new Map(),requests=[];
  const native=createSyntheticNativeHome('calendar-date');
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Synthetic employee',credential_id:id(3),assignment_epoch:7};
  const security={native:true,getStatus:native.status,mutateProtectedWork:native.mutate};
  const lockDescriptor=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks');
  try{
    globalThis.Date=fixedDate(()=>now);
    globalThis.document={hidden:false,getElementById:key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},addEventListener(){}};
    globalThis.window={MemphisCustodialSecurity:security,MemphisMobile:{principalIdentity:()=>native.binding,profileMatchesPrincipal:d=>d.employee_id===id(2)&&d.credential_id===id(3)&&d.assignment_epoch===7},addEventListener(){}};
    globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
    globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
    globalThis.fetch=async()=>new Response('{}',{status:503});
    Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:createSyntheticScheduleLocks()});
    app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:async path=>{
      const url=new URL(path,'https://synthetic.invalid');requests.push(url);
      // This backend model intentionally retains the real04:00 default. The
      // caller must select its calendar day rather than depending on that default.
      const selected=url.searchParams.get('service_date')||zooServiceDate(now-4*60*60*1000);
      if(cross)now=RealDate.parse('2026-11-10T06:00:00Z');
      return data(wrong?'2026-11-08':selected,off);
    }});
    await app.update();assert.equal(requests.length,1);
    assert.equal(requests[0].searchParams.get('service_date'),expected);
    assert.equal(requests[0].searchParams.get('device_id'),'KIOSK_08');
    if(cross||wrong){assert.equal(nodes.get('home-shift').textContent,'Schedule unavailable');
      assert.equal([...storage.keys()].filter(k=>k.startsWith('mz_employee_schedule_snapshot:')&&!k.includes(':availability:')).length,0,'wrong-day response never becomes a saved snapshot');}
    else{assert.equal(nodes.get('home-shift').textContent,off?'Not scheduled today':'5:00 AM–2:00 PM');
      assert.equal(nodes.get('home-lunch').textContent,off?'Not scheduled':'9:30 AM–10:30 AM');}
  }finally{app?.stop();if(lockDescriptor)Object.defineProperty(globalThis.navigator,'locks',lockDescriptor);else delete globalThis.navigator.locks;
    for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}

const helper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const sources={web:[...readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1],
  native:readFileSync(new URL('../mobile/src/custodial/employee-schedule-runtime.js',import.meta.url),'utf8').replace(/^export /m,'')+'\ninstallEmployeeSchedule();'};
async function schedule(mode,instant,expected,off,{cross=false,wrong=false}={}){
  let now=RealDate.parse(instant);const nodes=new Map(),storage=new Map(),requests=[],native=createSyntheticNativeHome('calendar-'+mode);
  const element=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);};
  const context=vm.createContext({Date:fixedDate(()=>now),Intl,URL,console,AbortController,
    document:{hidden:false,getElementById:element,addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},fetch:async path=>{
      const url=new URL(path);requests.push(url);const selected=url.searchParams.get('service_date')||zooServiceDate(now-4*60*60*1000);
      if(cross)now=RealDate.parse('2026-11-10T06:00:00Z');
      return{ok:true,json:async()=>({ok:true,data:data(wrong?'2026-11-08':selected,off)})};
    }});
  context.window={navigator:{locks:createSyntheticScheduleLocks()},addEventListener(){},
    MemphisCustodialSecurity:{native:true,getStatus:native.status,mutateProtectedWork:native.mutate},
    MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=>native.binding,
      profileMatchesPrincipal:d=>d.employee_id===id(2)&&d.credential_id===id(3)&&d.assignment_epoch===7,requestJson:async()=>({})}};
  vm.runInContext(helper,context);
  vm.runInContext(sources[mode].replace("void load('launch');","globalThis.testLoad=load;"),context);
  await context.testLoad();assert.equal(requests.length,1);
  assert.equal(requests[0].searchParams.get('service_date'),expected);
  const snapshots=[...storage].filter(([k])=>k.startsWith('mz_employee_schedule_snapshot:')&&!k.includes(':availability:'));
  if(cross||wrong){assert.equal(snapshots.length,0);assert.equal(element('content').hidden,true,'mismatched date is never shown as current');}
  else{assert.equal(snapshots.length,1);const saved=JSON.parse(snapshots[0][1]);assert.equal(saved.data.service_date,expected);
    assert.equal(saved.data.schedule_status,off?'off':'working');assert.equal(element('content').hidden,false);}
}
for(let i=0;i<instants.length;i++)for(const off of [false,true]){
  await test(`Home ${instants[i]} ${off?'off':'working'}`,()=>home(instants[i],dates[i],off));
  for(const mode of ['web','native'])await test(`${mode} Schedule ${instants[i]} ${off?'off':'working'}`,()=>schedule(mode,instants[i],dates[i],off));
}
for(const option of [{cross:true},{wrong:true}]){
  const instant=instants[0],expected=dates[0];
  await test(`Home rejects ${option.cross?'midnight-crossing':'wrong-day'} response`,()=>home(instant,expected,false,option));
  for(const mode of ['web','native'])await test(`${mode} Schedule rejects ${option.cross?'midnight-crossing':'wrong-day'} response`,()=>schedule(mode,instant,expected,false,option));
}
console.log(JSON.stringify({status:'EMPLOYEE_SCHEDULE_CALENDAR_DATE_PASS',cases:results.length,results},null,2));
