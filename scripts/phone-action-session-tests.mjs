// Actual auth and page scripts, synthetic DOM/storage/network. No real phone operation.
import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;
for(const mode of ['current-read','late-revoke','late-successor']){
 const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');const nodes=new Map(),events=new Map(),docs=new Map(),requests=[];
 const node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',textContent:'',innerHTML:'',className:'',disabled:false,addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return nodes.get(k)};
 const record={device_id:'SYNTHETIC_PHONE',operation_id:id(98),expected_employee_id:id(8),expected_assignment_epoch:7,action:'activate_or_recover'};
 const saved=JSON.stringify({version:1,requests:[record]}),storage=new Map([['custodial.manager.activation-requests.v1',saved]]);let release;
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const session={role:'ops_manager',token:'SYNTHETIC_ONLY',device_id:'synthetic-manager-device',manager_id:id(2),credential_id:id(3),expires_at:'2099-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};let serverSession=session;
 const window={CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:e=>events.get(e.type)?.(e),location:new URL('https://synthetic.invalid/phone-assignments.html'),navigator:{},localStorage,addEventListener:(k,f)=>events.set(k,f)};
 const fetch=async(url,options={})=>{const path=new URL(url).pathname;requests.push({path,method:options.method||'GET'});let body;
  if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:serverSession.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:serverSession}};
  else if(path.endsWith('/revoke'))body={ok:true,revoked:true};
  else if(path==='/leadership-api/phone-assignments')body={ok:true,data:{devices:[{device_id:record.device_id,assigned_employee_id:id(8),assignment_epoch:7}],employees:[{id:id(8),display_name:'SYNTHETIC_EMPLOYEE'}]}};
  else if(path.includes('/assigned-activation-operations/')){if(mode!=='current-read')await new Promise(r=>release=r);body={ok:true,data:{operation_id:record.operation_id,device_id:record.device_id,employee_id:id(8),assignment_epoch:7,state:'expired'}};}
  else throw Error('Unexpected synthetic operation '+path);
  return{ok:true,status:200,json:async()=>body};
 };
 const context=vm.createContext({window,localStorage,navigator:window.navigator,document:{getElementById:node,addEventListener:(k,f)=>docs.set(k,f)},fetch,URL,AbortSignal,Date,Intl,console,setTimeout,clearTimeout,crypto:{randomUUID:()=>id(99)}});
 vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);await window.MemphisAuth.refreshLeadershipSession();
 const page=readFileSync(root+'/phone-assignments.js','utf8');assert.equal(page.split('  void load();').length,2);
 vm.runInContext(page.replace('  void load();','  globalThis.testActivation=activationRow;\n  void load();'),context);await new Promise(r=>setImmediate(r));
 node('[data-employee]').value=id(8);const row={dataset:{device:record.device_id},querySelector:node};
 const pending=context.testActivation(row,mode!=='current-read');await new Promise(r=>setImmediate(r));
 if(mode!=='current-read'){
  assert.equal(typeof release,'function');if(mode==='late-revoke')await window.MemphisAuth.clearSession();else {serverSession={...session,manager_id:id(44),token:'SYNTHETIC_SUCCESSOR'};await window.MemphisAuth.refreshLeadershipSession();}
  release();
 }
 await pending;assert.equal(storage.get('custodial.manager.activation-requests.v1'),saved,'durable original operation history must remain exact');
 assert.equal(requests.filter(x=>x.path.includes('activation-operations')&&x.method!=='GET').length,0,'no successor activation dispatch');
 if(mode==='current-read')assert.match(node('[data-activation-result]').textContent,/Request expired/);
 else assert.equal(node('phone-list').innerHTML,'');
 console.log(JSON.stringify({mode,activation_writes:0,original_history_exact:true,status:'PASS'}));
}
