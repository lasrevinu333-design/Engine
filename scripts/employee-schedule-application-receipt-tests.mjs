import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1]||'';
const now=Date.parse('2026-09-21T18:00:00Z');
const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,dataset:{},addEventListener(){}});return elements.get(id);};
const stored=new Map(),calls=[];
const projection='84000000-0000-4000-8000-000000000008';
const data={service_date:'2026-09-21',employee_id:'30000000-0000-4000-8000-000000000099',employee_name:'Taylor New',
  projection_id:projection,projection_authority_revision:19,full_day:true,shift:{start:'07:00',end:'16:00'},
  raw_items:[{id:'area',name:'Teton Restroom',coverage_start:'11:00',coverage_end:'14:00',coverage_purpose:'area_owner'}],
  current_items:[],schedule_application:{intent_id:'82000000-0000-4000-8000-000000000008',
    application_status:'PENDING',authority_revision:19,publication_id:'83000000-0000-4000-8000-000000000008',
    projection_id:projection,lunch_document_identity:'a'.repeat(64)}};
const context={Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,
  document:{getElementById:element,addEventListener(){},hidden:false},
  localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)},
  fetch:async()=>({ok:true,json:async()=>({ok:true,data})}),
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
context.window={addEventListener(){},MemphisCustodialSecurity:{native:true,getStatus:()=>({deviceId:'KIOSK_08'}),
  mutateProtectedWork:async operation=>operation()},MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',
  principalIdentity:()=> 'KIOSK_08|credential|employee|7',profileMatchesPrincipal:()=>true,
  requestJson:async(path,options)=>{calls.push({path,options});return{};}}};
vm.createContext(context);vm.runInContext(inline,context);await new Promise(resolve=>setTimeout(resolve,40));
const receipt=calls.find(call=>call.path==='/schedule-api/my-day-summary/application-receipt');
assert.ok(receipt,'a successfully saved and rendered exact target must report device application');
const body=JSON.parse(receipt.options.body);
assert.deepEqual(Object.keys(body).sort(),['applied_at','authority_revision','intent_id','lunch_document_identity','projection_id','rendered_digest']);
assert.equal(body.intent_id,data.schedule_application.intent_id);assert.equal(body.projection_id,projection);
assert.match(body.rendered_digest,/^[0-9a-f]{64}$/);assert.equal(stored.size,1,'receipt follows protected cache readback');
assert.match(element('areas').innerHTML,/Teton Restroom/,'receipt follows actual schedule render');
console.log(JSON.stringify({status:'PASS',checks:7,scope:'protected cache then render then exact device receipt; synthetic DOM only'}));
