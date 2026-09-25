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
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
async function employeeFixture({saved=true,accepted=[],flushError=false,category='app_problem'}={}){
  const nodes=new Map(),bodies=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'Full feedback\nmañana 0',textContent:'',events:{},disabled:false,hidden:false,
    addEventListener(event,fn){this.events[event]=fn;},querySelector:()=>category?{value:category}:null,reset(){},removeAttribute(){}});return nodes.get(id);};
  const context=vm.createContext({crypto:{randomUUID:()=>operation},document:{getElementById:node,addEventListener(){}},
    window:{addEventListener(){},MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_SYNTHETIC',
      readCustodialHomeCache:()=>({profile:{employee_name:'Synthetic employee'}}),
      async saveEmployeeFeedback(body){bodies.push(JSON.parse(JSON.stringify(body)));if(!saved)throw Error('synthetic save failed');},
      async flushEmployeeFeedback(){if(flushError)throw Error('synthetic offline');return accepted;}}}});
  vm.runInContext(employee,context);await tick();
  await node('form').events.submit({preventDefault(){}});await tick();
  return {node,bodies};
}
for(const [label,options,expected] of [
  ['server accepted',{accepted:[operation]},'Received by the program.'],
  ['offline',{},'Saved on this phone. Waiting to upload.'],
  ['different operation accepted',{accepted:['other-operation']},'Saved on this phone. Waiting to upload.'],
  ['network loss',{flushError:true},'Saved on this phone. Waiting to upload.'],
  ['local save failure',{saved:false},'Feedback could not be saved. Try again.'],
  ['no category',{category:''},'Choose one option.'],
]){
  const f=await employeeFixture(options);check(f.node('status').textContent,expected,label+' has truthful visible state');
  if(options.category===''){check(f.bodies.length,0,'invalid form never saved');continue;}
  check(f.bodies.length,1,label+' attempts exactly one protected save');
  check(f.bodies[0].operation_id,operation,label+' preserves exact operation');
  check(f.bodies[0].message,'Full feedback\nmañana 0',label+' preserves complete message');
  check(Object.hasOwn(f.bodies[0],'image_attachment'),false,label+' new employee feedback is text-only');
  check(f.node('send').disabled,false,label+' releases form after result');
}
// Two independently saved operations can share the bridge's single-flight flush.
// Its result may include only A even though the form already reports B's status.
for(const acceptedLatest of [false,true]){
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const nodes=new Map(),bodies=[];let calls=0,nextId=0,resolveFlight;
  const flight=new Promise(resolve=>{resolveFlight=resolve;});
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',events:{},disabled:false,hidden:false,
    addEventListener(event,fn){this.events[event]=fn;},querySelector:()=>({value:'app_problem'}),reset(){},removeAttribute(){}});return nodes.get(id);};
  const context=vm.createContext({crypto:{randomUUID:()=>ids[nextId++]},document:{getElementById:node,addEventListener(){}},
    window:{addEventListener(){},MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_SYNTHETIC',
      readCustodialHomeCache:()=>({profile:{employee_name:'Synthetic employee'}}),
      async saveEmployeeFeedback(body){bodies.push(JSON.parse(JSON.stringify(body)));},
      flushEmployeeFeedback(){return ++calls===1?Promise.resolve([]):flight;}}}});
  vm.runInContext(employee,context);await tick();
  node('message').value='First message A';await node('form').events.submit({preventDefault(){}});await tick();
  node('message').value='Latest message B';await node('form').events.submit({preventDefault(){}});await tick();
  check(bodies.map(body=>body.operation_id),ids,'overlap saves two distinct original operation identities');
  check(bodies.map(body=>body.message),['First message A','Latest message B'],'overlap retains both complete messages');
  check(node('status').textContent,'Saved on this phone. Waiting to upload.','B pending while shared flush unresolved');
  resolveFlight(acceptedLatest?ids:[ids[0]]);await tick();
  check(node('status').textContent,acceptedLatest?'Received by the program.':'Saved on this phone. Waiting to upload.',
    acceptedLatest?'B acceptance controls visible B status':'older A acceptance cannot overwrite pending B status');
  check(node('send').disabled,false,'shared flight never blocks a subsequent protected save');
}
for(const scenario of ['accepted','rejected','response_lost']){
  let status='',posted=null,resets=0;
  const context=vm.createContext({crypto:{randomUUID:()=>operation},API:'https://synthetic.invalid',location:{href:'synthetic'},document:{title:'Feedback'},
    state:{operationId:operation,hub:'manager',deviceId:null,image:{name:'photo.jpg',type:'image/jpeg',dataUrl:'synthetic-private-image'}},
    els:{message:{value:'Full manager feedback\nzero 0'},category:{value:'need_help'},blocking:{checked:false},send:{disabled:false},form:{reset(){resets++;}}},
    resolve:async()=>{},isNativeCustodialAuthority:()=>false,submittedBy:()=> 'Synthetic named manager',serializedBodyFits:()=>true,
    managerHeaders:async()=>({'X-Synthetic-Manager':'not-a-credential'}),clearImage(){},window:{},safe:e=>e.message,
    setStatus:value=>{status=value;},fetch:async(path,options)=>{posted={path,body:JSON.parse(options.body),headers:options.headers};
      if(scenario==='response_lost')throw Error('synthetic unknown outcome');
      return {ok:scenario==='accepted',status:scenario==='accepted'?201:503,json:async()=>({ok:scenario==='accepted',error:'synthetic rejected'})};}});
  vm.runInContext(managerSubmit,context);await vm.runInContext('submit({preventDefault(){}})',context);
  check(posted.body.operation_id,operation,scenario+' manager operation retained');
  check(posted.headers['Idempotency-Key'],operation,scenario+' manager idempotency retained');
  check(posted.body.message,'Full manager feedback\nzero 0',scenario+' complete manager message');
  check(Object.hasOwn(posted.body,'image_attachment'),false,scenario+' new manager feedback omits even a stale image state');
  if(scenario==='accepted'){
    check(status,'Received by the program. Thank you.','server save is not email receipt');check(resets,1,'accepted manager form resets once');
  }else{
    check(/Received|Sent|Delivered/.test(status),false,scenario+' never claims acceptance/delivery');
    check(vm.runInContext('state.operationId',context),operation,scenario+' same operation available for retry');check(resets,0,scenario+' form retained');
  }
}
console.log(JSON.stringify({status:'PASS_FEEDBACK_VISIBLE_SAVE_STATUS_ONLY',checks,actualPageHandlers:true,
  notProven:['durable relay queue','SQL or HTTP authority','scheduled connector execution','email delivery','private app attachment viewing','native phone behavior','independent review']}));
