import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=process.argv[2]||process.cwd();
async function scenario(mode){
 const nodes=new Map(),events=new Map(),docEvents=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,listeners:new Map(),classList:{remove(){},toggle(){}},addEventListener(k,fn){this.listeners.set(k,fn);},focus(){}});return nodes.get(id);};
 let now=Date.parse('2026-11-14T12:00:00Z');class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const account='ba000000-0000-4000-8000-000000000001',manager='ba000000-0000-4000-8000-000000000002',registration='ba000000-0000-4000-8000-000000000003';
 const session={role:'ops_manager',token:'AUDIT_SYNTHETIC_ONLY_NOT_A_CREDENTIAL',device_id:'audit-device',manager_id:manager,credential_id:registration,expires_at:'2026-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
 let serverSession=session;const timers=new Map();let timerId=0;
 const localStorage={getItem(){return null;},setItem(){},removeItem(){}};
 const window={CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent:e=>events.get(e.type)?.(e),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),location:new URL('https://synthetic.invalid/operational-insights.html'),navigator:{},localStorage,MemphisCompletionEvidence:{create:()=>({clear(){}}),canReadRow:()=>false},addEventListener(k,fn){events.set(k,fn);}};
 const fetch=async(url,options={})=>{requests.push({path:new URL(url).pathname,method:options.method||'GET'});const path=new URL(url).pathname;
 let body;if(path.endsWith('/session')&&serverSession===null)body={ok:false,error:'denied'};
 else if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'AUDIT_SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:registration,claimedAccount:{accountId:account},cohort:{principalId:serverSession.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:serverSession}};
 else if(path.endsWith('/revoke'))body={ok:true,revoked:true};
 else body={ok:true,data:path.endsWith('/cleaning-performance')?[{employee_name:'SYNTHETIC_PROTECTED_ROW',location_name:'Synthetic',cleaning_count:1,inspection_count:1}]:[]};
 return {ok:!(mode==='denied-refresh'&&serverSession===null),status:mode==='denied-refresh'&&serverSession===null?403:200,json:async()=>body};};
 const context=vm.createContext({window,localStorage,navigator:window.navigator,document:{getElementById:node,querySelectorAll:()=>[],addEventListener(k,fn){docEvents.set(k,fn);}},fetch,URL,Date:Clock,Intl,AbortSignal,console});
 vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);
 await window.MemphisAuth.refreshLeadershipSession();
 const nativeStatus={ready:true,available:true,generation:1,deviceId:'SYNTHETIC',principal:{employee_id:'synthetic'}};
 if(mode.startsWith('native-')){window.MemphisCustodialSecurity={getStatus:()=>nativeStatus};window.MemphisMobile={authHeaders:async()=>({Authorization:'synthetic-native'})};}
 vm.runInContext(readFileSync(root+'/operational-insights.js','utf8'),context);
 await new Promise(r=>setImmediate(r));
 assert.match(node('performance-list').innerHTML,/SYNTHETIC_PROTECTED_ROW/);
 node('performance-employee').value='SYNTHETIC_SELECTED_ID';
 if(mode==='denied-refresh'){serverSession=null;await assert.rejects(window.MemphisAuth.refreshLeadershipSession());}
 else if(mode==='pagehide'){events.get('pagehide')?.();}
 else if(mode==='confirmed-revoke')await window.MemphisAuth.clearSession();
 else if(mode==='successor'||mode==='renewal'){
  serverSession={...session,token:'SYNTHETIC_NEW_TOKEN',expires_at:'2026-11-14T12:03:00Z',...(mode==='successor'?{manager_id:'ba000000-0000-4000-8000-000000000099'}:{})};
  await window.MemphisAuth.refreshLeadershipSession();
 }else if(mode==='native-withdrawal'){nativeStatus.ready=false;events.get('memphis:custodial-security-state')?.();}
 else{now+=61000;if(mode==='expiry-timer')for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}
 if(!['successor','renewal','native-withdrawal','pagehide'].includes(mode))assert.equal(window.MemphisAuth.readSession(),null);
 const before=requests.length;events.get('focus')?.();events.get('storage')?.({key:'irrelevant-event-key'});docEvents.get('visibilitychange')?.();await new Promise(r=>setImmediate(r));
 const result={root,mode,actual_memphis_auth:true,actual_insights:true,synthetic_fetch_only:true,auth_is_null:window.MemphisAuth.readSession()===null,protected_marker_retained:node('performance-list').innerHTML.includes('SYNTHETIC_PROTECTED_ROW'),post_withdrawal_network:requests.length-before,status:node('global-status').textContent};
 console.log(JSON.stringify(result));assert.equal(result.protected_marker_retained,mode==='native-offline',mode);
 if(mode!=='native-offline')assert.equal(node('performance-employee').value,'','Sensitive filters withdrawn');
 if(mode==='pagehide'){events.get('pageshow')?.();await new Promise(r=>setImmediate(r));assert.match(node('performance-list').innerHTML,/SYNTHETIC_PROTECTED_ROW/);}
 if(mode==='renewal'){await node('refresh-insights').listeners.get('click')();await new Promise(r=>setImmediate(r));assert.match(node('performance-list').innerHTML,/SYNTHETIC_PROTECTED_ROW/);}
 return result;
}
const results=[];for(const mode of ['expiry','expiry-timer','confirmed-revoke','successor','renewal','native-withdrawal','native-offline','denied-refresh','pagehide'])results.push(await scenario(mode));
assert.equal(results.filter(r=>r.protected_marker_retained).length,1,'Settled Insights protected rows must be withdrawn when actual auth no longer has a session');
