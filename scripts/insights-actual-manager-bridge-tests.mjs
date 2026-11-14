import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;const rows=[];
async function run(mode){
const nodes=new Map(),events=new Map(),docs=new Map(),requests=[],timers=new Map();let timerId=0;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,listeners:new Map(),classList:{add(){},remove(){},toggle(){}},addEventListener(k,fn){this.listeners.set(k,fn)},focus(){}});return nodes.get(id)};
let now=Date.parse('2026-11-14T12:00:00Z');class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now}}
const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');
const session={role:'ops_manager',token:'SYNTHETIC_ONLY',device_id:'synthetic-manager-device',manager_id:id(2),credential_id:id(3),expires_at:'2026-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
let serverSession=session;const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const fetch=async(url,options={})=>{const path=new URL(url).pathname;requests.push({path,method:options.method||'GET'});let body;
if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:serverSession.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:serverSession}};
else if(path.endsWith('/revoke'))body={ok:true,revoked:true};else body={ok:true,data:path.endsWith('/cleaning-performance')?[{employee_name:'SYNTHETIC_PROTECTED_INSIGHTS',location_name:'Synthetic',cleaning_count:1,inspection_count:1}]:[]};return {ok:true,status:200,json:async()=>body};};
const window={fetch,CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:e=>events.get(e.type)?.(e),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id),location:new URL('https://synthetic.invalid/operational-insights.html'),navigator:{},localStorage,MemphisCompletionEvidence:{create:()=>({clear(){}}),canReadRow:()=>false},addEventListener(k,fn){events.set(k,fn)}};
const context=vm.createContext({window,localStorage,navigator:window.navigator,document:{getElementById:node,querySelectorAll:()=>[],addEventListener(k,fn){docs.set(k,fn)}},fetch,URL,Headers,Request,Blob,FormData,URLSearchParams,AbortSignal,Date:Clock,Intl,console,setTimeout,clearTimeout});
vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);
const bridge=new vm.SourceTextModule(readFileSync(root+'/mobile/src/shared/mobile-bridge.js','utf8'),{context,identifier:root+'/mobile/src/shared/mobile-bridge.js'});
await bridge.link(async spec=>{assert.equal(spec,'@capacitor/status-bar');return new vm.SyntheticModule(['StatusBar'],function(){this.setExport('StatusBar',{hide:async()=>{}})},{context})});await bridge.evaluate();
vm.runInContext(readFileSync(root+'/operational-insights-native-auth.js','utf8'),context);
vm.runInContext(readFileSync(root+'/operational-insights.js','utf8'),context);await new Promise(r=>setImmediate(r));
assert.match(node('performance-list').innerHTML,/SYNTHETIC_PROTECTED_INSIGHTS/);assert.equal(window.MemphisCustodialSecurity,undefined);
if(mode==='confirmed-revoke'){await window.MemphisAuth.clearSession();assert.equal(window.MemphisAuth.readSession(),null);}
else if(mode==='expiry'){now+=61000;for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn();}}
else {serverSession={...session,manager_id:id(99),token:'SYNTHETIC_SUCCESSOR',expires_at:'2026-11-14T12:03:00Z'};await window.MemphisMobile.refresh({force:true});}
events.get('focus')?.();docs.get('visibilitychange')?.();await new Promise(r=>setImmediate(r));
const result={root,mode,actual_memphis_auth:true,actual_manager_mobile_bridge:true,actual_insights_native_adapter:true,actual_insights:true,synthetic_statusbar_network_dom:true,read_session_null:window.MemphisAuth.readSession()===null,security_object_present:!!window.MemphisCustodialSecurity,marker_retained:node('performance-list').innerHTML.includes('SYNTHETIC_PROTECTED_INSIGHTS'),status:node('global-status').textContent};console.log(JSON.stringify(result));return result;}
for(const mode of ['confirmed-revoke','expiry','successor'])rows.push(await run(mode));assert.equal(rows.filter(x=>x.marker_retained).length,0,'Actual manager native bridge must withdraw settled Insights after authority changes');
