import {createUnfinishedWorkPanel,createUnfinishedWorkJournal} from './unfinished-work-panel.mjs';
const auth=window.MemphisAuth,API='https://memphis-zoo-mcp.onrender.com';
const storageBinding=()=>{const s=auth?.readSession?.();return s?.role==='ops_manager'&&auth?.canMutateOpsManagerSurface?.(s)===true?JSON.stringify([s.manager_id,s.claimed_manager_id,s.credential_id,s.device_id,s.auth_mode]):null;};
const binding=()=>{const owner=storageBinding();return owner?JSON.stringify([owner,auth.readSession().token]):null;};
async function request(path,{method='GET',operationId,reason}={}){
 const owner=binding();if(!owner)throw Error('Current manager access required.');
 const headers=await auth.opsManagerAuthHeaders();if(owner!==binding())throw Error('Manager access changed.');
 const s=auth.readSession();if(headers.Authorization!==`Bearer ${s.token}`||headers['X-Device-Id']!==s.device_id)throw Error('Manager access changed.');
 if(operationId){headers['Idempotency-Key']=operationId;headers['Content-Type']='application/json';}
 const response=await fetch(API+'/admin-api/custodial/unfinished-work'+path,{method,headers,credentials:'include',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),body:method==='POST'?JSON.stringify({reason}):undefined});
 const result=await response.json();if(owner!==binding())throw Error('Manager access changed.');
 if(!response.ok||result?.ok!==true||result.contract_version!=='custodial.unfinished-work.v1'||!result.data||typeof result.data!=='object')throw Error('Unfinished work outcome unavailable.');return result.data;
}
const panel=createUnfinishedWorkPanel({document,content:document.getElementById('work'),status:document.getElementById('status'),binding,storageBinding,journal:createUnfinishedWorkJournal({storage:window.localStorage,locks:navigator.locks}),api:{list:()=>request(''),clear:(id,operationId,reason)=>request('/'+encodeURIComponent(id)+'/clear',{method:'POST',operationId,reason}),outcome:(id,op)=>request('/'+encodeURIComponent(id)+'/operations/'+encodeURIComponent(op))}});
document.getElementById('refresh').addEventListener('click',()=>{void panel.load();});
for(const event of ['focus','storage'])window.addEventListener(event,()=>panel.revalidate());
document.addEventListener('visibilitychange',()=>panel.revalidate());window.addEventListener('pagehide',()=>panel.retire());window.addEventListener('pageshow',()=>{void panel.load();});
window.addEventListener('beforeunload',event=>{if(panel.hasUnresolved()){event.preventDefault();event.returnValue='';}});
try{await auth.refreshLeadershipSession();await panel.load();}catch{document.getElementById('status').textContent='Current Eric custodial manager selection is required. Open management access and check your selected name.';}
