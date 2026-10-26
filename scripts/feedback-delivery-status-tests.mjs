import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual page handlers. DOM, storage bridge and HTTP are synthetic;
// these checks cannot establish mail transport, inbox receipt or phone behavior.
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const employee=read('employee-feedback.html').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const managerPage=read('system-feedback.html');
const managerSubmit=managerPage.slice(managerPage.indexOf('    async function submit(event)'),managerPage.indexOf("    els.form.addEventListener('submit', submit)"));
const operation='5a9f1f73-3e7c-4fb1-b1fc-0ab6be6a0e45';
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
async function employeeFixture({saved=true,accepted=[],flushError=false,category='app_problem',unknownRecovery=false}={}){
  const nodes=new Map(),bodies=[],pending=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'Full feedback\nmañana 0',textContent:'',events:{},disabled:false,hidden:false,
    addEventListener(event,fn){this.events[event]=fn;},querySelector:()=>category?{value:category}:null,reset(){},removeAttribute(){}});return nodes.get(id);};
  const context=vm.createContext({crypto:{randomUUID:()=>operation},document:{getElementById:node,addEventListener(){}},
    window:{addEventListener(){},MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_SYNTHETIC',
      readCustodialHomeCache:()=>({profile:{employee_name:'Synthetic employee'}}),
      async pendingEmployeeFeedback(){return unknownRecovery?{state:'unknown'}:pending.size?{state:'pending',originals:[...pending.values()].map(body=>JSON.parse(JSON.stringify(body)))}:{state:'clear'};},
      async saveEmployeeFeedback(body){bodies.push(JSON.parse(JSON.stringify(body)));if(!saved)throw Error('synthetic save failed');pending.set(body.operation_id,JSON.parse(JSON.stringify(body)));},
      async flushEmployeeFeedback(){if(flushError)throw Error('synthetic offline');for(const id of accepted)pending.delete(id);return accepted;}}}});
  vm.runInContext(employee,context);await tick();
  await node('form').events.submit({preventDefault(){}});await tick();
  return {node,bodies,pending};
}
for(const [label,options,expected] of [
  ['server accepted',{accepted:[operation]},'Saved in the program.'],
  ['offline',{},'Saved on this phone. It will retry automatically.'],
  ['different operation accepted',{accepted:['other-operation']},'Saved on this phone. It will retry automatically.'],
  ['network loss',{flushError:true},'Saved on this phone. It will retry automatically.'],
  ['local save failure',{saved:false},'Save not confirmed. Retry keeps the same feedback.'],
  ['no category',{category:''},'Choose one option.'],
  ['unknown recovery',{unknownRecovery:true},'Saved feedback recovery is unavailable. Keep the original pending.'],
]){
  const f=await employeeFixture(options);check(f.node('status').textContent,expected,label+' has truthful visible state');
  if(options.category===''||options.unknownRecovery){check(f.bodies.length,0,label+' never starts a protected save');continue;}
  check(f.bodies.length,1,label+' attempts exactly one protected save');
  check(f.bodies[0].operation_id,operation,label+' preserves exact operation');
  check(f.bodies[0].message,'Full feedback\nmañana 0',label+' preserves complete message');
  check(Object.hasOwn(f.bodies[0],'image_attachment'),false,label+' text-only synthetic input does not invent an attachment');
  check(f.node('send').disabled,false,label+' permits current original retry after result');
  check(f.pending.size,options.accepted?.includes(operation)?0:options.saved===false?0:1,label+' exact persisted original disposition');
}
// Current page never creates B while the original A is uncertain. A second
// click must retain A's body/key, and a receipt naming B cannot retire A.
for(const acceptsOriginal of [false,true]){
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const nodes=new Map(),bodies=[],pending=new Map();let calls=0,nextId=0,resolveFlight;
  const flight=new Promise(resolve=>{resolveFlight=resolve;});
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',events:{},disabled:false,hidden:false,
    addEventListener(event,fn){this.events[event]=fn;},querySelector:()=>({value:'app_problem'}),reset(){},removeAttribute(){}});return nodes.get(id);};
  const context=vm.createContext({crypto:{randomUUID:()=>ids[nextId++]},document:{getElementById:node,addEventListener(){}},
    window:{addEventListener(){},MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_SYNTHETIC',
      readCustodialHomeCache:()=>({profile:{employee_name:'Synthetic employee'}}),
      async pendingEmployeeFeedback(){return pending.size?{state:'pending',originals:[...pending.values()].map(body=>JSON.parse(JSON.stringify(body)))}:{state:'clear'};},
      async saveEmployeeFeedback(body){bodies.push(JSON.parse(JSON.stringify(body)));pending.set(body.operation_id,JSON.parse(JSON.stringify(body)));},
      async flushEmployeeFeedback(){const accepted=++calls===1?[]:await flight;for(const id of accepted)pending.delete(id);return accepted;}}}});
  vm.runInContext(employee,context);await tick();
  node('message').value='First message A';await node('form').events.submit({preventDefault(){}});await tick();
  node('message').value='Attempted replacement B';await node('form').events.submit({preventDefault(){}});await tick();
  check(bodies.map(body=>body.operation_id),[ids[0],ids[0]],'uncertain original operation is reused, never a fresh B');
  check(bodies.map(body=>body.message),['First message A','First message A'],'attempted replacement does not rewrite retained original');
  check(nextId,1,'no second UUID is minted while A is uncertain');
  check(node('status').textContent,'Saved on this phone. It will retry automatically.','original pending while shared flush unresolved');
  resolveFlight(acceptsOriginal?[ids[0]]:[ids[1]]);await tick();
  check(node('status').textContent,acceptsOriginal?'Saved in the program.':'Saved on this phone. It will retry automatically.',
    acceptsOriginal?'only A acceptance controls A status':'foreign B acknowledgement cannot overwrite original A status');
  check(pending.size,acceptsOriginal?0:1,'only exact original receipt clears synthetic retained original');
  check(node('send').disabled,false,'settled shared flight leaves original retry available');
}
for(const scenario of ['accepted','rejected','response_lost']){
  let status='',posted=null,resets=0;
  const context=vm.createContext({crypto:{randomUUID:()=>operation},API:'https://synthetic.invalid',location:{href:'synthetic'},document:{title:'Feedback'},
    state:{operationId:operation,hub:'manager',deviceId:null,image:{name:'photo.jpg',type:'image/jpeg',dataUrl:'synthetic-private-image'}},
    els:{message:{value:'Full manager feedback\nzero 0'},category:{value:'need_help'},blocking:{checked:false},send:{disabled:false},form:{reset(){resets++;}}},
    resolve:async()=>{},isNativeCustodialAuthority:()=>false,submittedBy:()=> 'Synthetic named manager',serializedBodyFits:value=>new TextEncoder().encode(value).byteLength<=4*1024*1024-64*1024,
    managerHeaders:async()=>({'X-Synthetic-Manager':'not-a-credential'}),clearImage(){},window:{},safe:e=>e.message,
    setStatus:value=>{status=value;},fetch:async(path,options)=>{posted={path,body:JSON.parse(options.body),headers:options.headers};
      if(scenario==='response_lost')throw Error('synthetic unknown outcome');
      return {ok:scenario==='accepted',status:scenario==='accepted'?201:503,json:async()=>({ok:scenario==='accepted',error:'synthetic rejected'})};}});
  vm.runInContext(managerSubmit,context);await vm.runInContext('submit({preventDefault(){}})',context);
  check(posted.body.operation_id,operation,scenario+' manager operation retained');
  check(posted.headers['Idempotency-Key'],operation,scenario+' manager idempotency retained');
  check(posted.body.message,'Full manager feedback\nzero 0',scenario+' complete manager message');
  check(posted.body.image_attachment,{name:'photo.jpg',type:'image/jpeg',data_url:'synthetic-private-image'},scenario+' retained legacy manager Source preserves its exact supplied image; not cleaning admission');
  if(scenario==='accepted'){
    check(status,'Sent. Thank you.','retained manager Source copy is not proof of mail delivery or cleaning-page admission');check(resets,1,'accepted manager form resets once');
  }else{
    check(/Received|Sent|Delivered/.test(status),false,scenario+' never claims acceptance/delivery');
    check(vm.runInContext('state.operationId',context),operation,scenario+' same operation available for retry');check(resets,0,scenario+' form retained');
  }
}
// This retained full-system page test does not admit new cleaning feedback.
const {cleaningFirstDeferredPage,CLEANING_FIRST_DEFERRED_PAGES}=await import('../mobile/scripts/custodial-initial-release-pages.mjs');
for(const path of ['employee-feedback.html','system-feedback.html'])assert.ok(CLEANING_FIRST_DEFERRED_PAGES.includes(path));
assert.doesNotMatch(cleaningFirstDeferredPage(),/<(?:form|input|button)\b|image_attachment|saveEmployeeFeedback/i);
console.log(JSON.stringify({status:'PASS_FEEDBACK_VISIBLE_SAVE_STATUS_ONLY',checks,actualPageHandlers:true,
  notProven:['durable relay queue','SQL or HTTP authority','scheduled connector execution','email delivery','private app attachment viewing','native phone behavior','independent review']}));
