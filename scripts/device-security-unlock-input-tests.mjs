// Existing unlock action compatibility: actual inline page, synthetic authority/DOM.
// No real password, registration, browser clipboard, server or phone is used.
import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;
for(const mode of ['accepted','rejected']){
 const nodes=new Map(),calls=[],storage=new Map([['original-history','SYNTHETIC_ORIGINAL']]);
 const node=k=>{if(!nodes.has(k)){const classes=new Set(k==='app'?['hidden']:[]);nodes.set(k,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,listeners:new Map(),classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},addEventListener(k,f){this.listeners.set(k,f)},querySelector:s=>node(s),querySelectorAll:()=>[],scrollIntoView(){}});}return nodes.get(k)};
 const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');const session={role:'ops_manager',manager_id:id(1),credential_id:id(2),device_id:'SYNTHETIC_MANAGER',token:'SYNTHETIC_TOKEN',trusted_device:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true},roles:['SECURITY_ADMIN'],access_level:'full_access',read_only:false,expires_at:'2026-11-14T12:10:00Z'};
 let unlocked=false;class Clock extends Date{constructor(...a){super(...(a.length?a:['2026-11-14T12:00:00Z']));}static now(){return Date.parse('2026-11-14T12:00:00Z');}}
 const auth={readSession:()=>session,getDeviceId:()=>session.device_id,hasRole:()=>true,requireOpsManagerSession:async()=>session,isCustodialManagementAdmin:()=>false,deviceSecuritySession:async()=>({configured:true,unlocked,manager_id:session.manager_id,expires_at:'2026-11-14T12:05:00Z'}),deviceSecurityAuthHeaders:async()=>({'SYNTHETIC':'ONLY'}),unlockDeviceSecurity:async value=>{calls.push(value);if(mode==='rejected')throw Error('Synthetic rejection');unlocked=true;}};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))};
 const globals={window:null,MemphisAuth:auth,localStorage,navigator:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},document:{getElementById:node,addEventListener(){},documentElement:node('html')},fetch:async()=>({ok:true,status:200,json:async()=>({ok:true,data:{coverage:{devices:[]},policy:{mode:'observe'}}})}),Date:Clock,console,performance,AbortController,URL};globals.window=globals;
 const context=vm.createContext(globals);const inline=[...readFileSync(root+'/device-security.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(inline.length,1);
 await vm.runInContext(inline[0][1],context,{importModuleDynamically:async()=>{throw Error('Optional fixture unavailable');}});
 node('password').value='SYNTHETIC_UI_INPUT';await node('unlock').listeners.get('click')();
 assert.deepEqual(calls,['SYNTHETIC_UI_INPUT'],'display withdrawal cannot erase intended transient input before submission');assert.equal(node('password').value,'');assert.equal(node('app').classList.contains('hidden'),mode==='rejected');assert.equal(storage.get('original-history'),'SYNTHETIC_ORIGINAL');
 console.log(JSON.stringify({mode,result:'PASS',unlock_calls:calls.length,original_history_preserved:true}));
}
