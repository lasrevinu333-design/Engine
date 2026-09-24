import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const source=readFileSync(new URL('../phone-assignments.js',import.meta.url),'utf8');
const employee='11000000-0000-4000-8000-000000000006';
const key='custodial.manager.activation-requests.v1';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({mobile=false,denyStorage=false}={}){
 const storage=new Map(),calls=[],events={},elements={};let loseResponse=false,server=null;
 const device={device_id:'KIOSK_08',assigned_employee_id:employee,employee_name:'Synthetic Custodian',assignment_epoch:2};
 const row={dataset:{device:'KIOSK_08'},querySelector:s=>controls[s]};
 const controls=Object.fromEntries(['[data-employee]','[data-activate]','[data-activation-status]','[data-activation-result]'].map(s=>[s,{value:employee,textContent:'',className:'',disabled:false,closest:()=>row}]));
 for(const id of ['phone-list','assignment-status','phone-search','refresh-assignments','assignment-toast'])
  elements[id]={value:'',innerHTML:'',textContent:'',className:'',addEventListener:(name,fn)=>{events[id+':'+name]=fn;}};
 async function api(path,options={}){
  const body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  calls.push({path,options,body});
  if(path==='/leadership-api/phone-assignments')return{devices:[device],employees:[{id:employee,display_name:'Synthetic Custodian'}]};
  if(options.method==='POST'){
   assert.equal(JSON.parse(storage.get(key)).requests.at(-1).operation_id,body.operation_id,'operation stored BEFORE sending');
   assert.equal(options.headers['Idempotency-Key'],body.operation_id);
   server={operation_id:body.operation_id,device_id:device.device_id,employee_id:body.expected_employee_id,assignment_epoch:body.expected_assignment_epoch,state:'requested'};
   if(loseResponse){loseResponse=false;throw new Error('Synthetic response lost');}
   return server;
  }
  if(!server)throw new Error('Synthetic request not found');return server;
 }
 const context={document:{getElementById:id=>elements[id]},window:{MemphisAuth:{requireOpsManagerSession:async()=>({token:'synthetic',device_id:'synthetic-browser'})}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(denyStorage)throw new Error('Storage unavailable');storage.set(k,v);}},
  crypto:{randomUUID},fetch:async(url,options)=>({ok:true,json:async()=>({ok:true,data:await api(url.replace('https://memphis-zoo-mcp.onrender.com',''),options)})}),
  setTimeout,clearTimeout,confirm:()=>false,console};
 if(mobile)context.window.MemphisMobile={requestEnvelope:async(path,options)=>({ok:true,data:await api(path,options)})};
 vm.runInNewContext(source,context);await tick();
 return{calls,storage,elements,controls,device,setServer:v=>{server=v;},server:()=>server,lose:()=>{loseResponse=true;},
  async click(selector){events['phone-list:click']({target:{closest:s=>s===selector?controls[s]:null}});await tick();await tick();}};
}
let checks=0;const check=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS',name);};
for(const mobile of [false,true]){
 const f=await fixture({mobile});
 check('assignments unwrap correctly '+mobile,f.elements['phone-list'].innerHTML.includes('KIOSK_08'));
 check('save distinct from activate '+mobile,f.elements['phone-list'].innerHTML.includes('Saving an assignment does not activate'));
 f.lose();await f.click('[data-activate]');
 check('lost response never claims active '+mobile,f.controls['[data-activation-result]'].textContent.includes('activation is not confirmed'));
 const first=f.calls.find(c=>c.options.method==='POST').body.operation_id;
 await f.click('[data-activate]');
 check('retry retains exact operation '+mobile,f.calls.filter(c=>c.options.method==='POST').every(c=>c.body.operation_id===first));
 check('requested is not active '+mobile,f.controls['[data-activation-result]'].textContent.startsWith('Requested —'));
 check('saved request contains no credential or token '+mobile,!/credential|token/i.test(f.storage.get(key)));
 f.server().state='delivered';await f.click('[data-activation-status]');
 check('delivery awaits native receipt '+mobile,f.controls['[data-activation-result]'].textContent.includes('waiting for the phone'));
 f.server().state='not_required';await f.click('[data-activation-status]');
 check('healthy current server confirmation shown '+mobile,f.controls['[data-activation-result]'].textContent.includes('no credential change'));
 f.server().employee_id='wrong';await f.click('[data-activation-status]');
 check('wrong principal status rejected '+mobile,f.controls['[data-activation-result]'].className.includes('error'));
}
const blocked=await fixture({denyStorage:true});await blocked.click('[data-activate]');
check('storage failure sends nothing',!blocked.calls.some(c=>c.options.method==='POST'));
const unsaved=await fixture();unsaved.controls['[data-employee]'].value='different';await unsaved.click('[data-activate]');
check('unsaved assignment never activates',!unsaved.calls.some(c=>c.options.method==='POST'));
const noRequest=await fixture();await noRequest.click('[data-activation-status]');
check('status-only never creates request',noRequest.calls.length===1);
console.log(JSON.stringify({status:'PASS',checks,actualController:true,syntheticServer:true,browserVisual:false,phoneRuntime:false}));
