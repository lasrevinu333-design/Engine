import {mountStaffingPage} from './manager-staffing-page.mjs';

const native=w=>w.MemphisCustodialSecurity?.native===true||w.MemphisMobile?.edition==='custodial'
  ||w.MemphisMobileBuildIdentity?.edition==='custodial'||w.Capacitor?.isNativePlatform?.()===true;
export async function mountStaffingRuntime({w=window,d=document,fetchImpl=w.fetch.bind(w),mount=mountStaffingPage}={}){
  if(native(w))return null;
  const auth=w.MemphisAuth,authority=w.MemphisSchedulerActions;
  if(!auth||!authority)throw Error('Normal manager service dependencies are unavailable.');
  let owner=null,helper=null,configuration=null,closed=false,page=null;
  const requests=new Set();
  function current(){const p=authority.principal(auth),s=auth.readSession(),permissions=authority.permissions(auth);
    if(closed||native(w)||!p||permissions.read!==true||!(Date.parse(s.expires_at)>Date.now()))throw Error('Current manager access is required.');
    const value={...p,token:s.token,expiresAt:s.expires_at,readOnly:s.read_only,permissions:JSON.stringify(s.permissions)};
    if(owner&&Object.keys(owner).some(k=>owner[k]!==value[k]))throw Error('Manager access changed. Original work is preserved.');
    owner||=value;return value;}
  async function request(url,options={}){
    const abort=new AbortController(),signal=options.signal,timer=w.setTimeout(()=>abort.abort(),65000);
    const cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    requests.add(abort);
    try{const response=await fetchImpl(url,{...options,cache:'no-store',redirect:'error',signal:abort.signal});
      const payload=await response.json().catch(()=>null);return{response,payload};}
    finally{w.clearTimeout(timer);signal?.removeEventListener('abort',cancel);requests.delete(abort);}
  }
  async function base(){if(!configuration)configuration=(async()=>{
      const {response:r,payload:body}=await request('https://memphis-zoo-mcp.onrender.com/scheduler-runtime-config');
      const url=new URL(body?.data?.public_url||'');
      if(!r.ok||body?.ok!==true||url.protocol!=='https:'||!url.hostname.endsWith('.onrender.com')
        ||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('The approved scheduler service is unavailable.');
      return url.origin;
    })();return configuration;}
  const api=async(path,options={})=>{
    const expected=current();if(!path.startsWith('/static-weekly/')||options.expectedManagerId&&options.expectedManagerId!==expected.managerId)throw Error('Exact manager scheduler request required.');
    const headers=await auth.opsManagerAuthHeaders();current();
    const origin=await base();current();const {expectedManagerId,signal,...input}=options;
    const {response,payload}=await request(origin+path,{...input,signal,headers:{'Content-Type':'application/json',...headers}});current();
    if(!response.ok||payload?.ok!==true){const e=Object.assign(Error(payload?.error||'Current staffing request unavailable.'),{
      status:response.status,code:payload?.code,serverRejected:payload?.ok===false&&payload.operation_outcome!=='unknown'&&payload.operation_outcome!=='accepted'});
      if(payload?.operation_outcome==='accepted')e.acceptedResult=payload.accepted_result;throw e;}
    return payload.data;
  };
  async function ensureHelper(){current();if(!authority.permissions(auth).owner)throw Error('Staffing changes require current owner access.');
    if(!helper)helper=authority.create({auth,api,baseUrl:await base()});return helper;}
  // The existing helper is created only after the real page authentication;
  // readonly views never read its storage or install owner action adapters.
  const savedRequests={
    pending(){if(!helper){current();if(!authority.permissions(auth).owner)return null;
      throw Error('Owner saved-request service has not initialized.');}return helper.pending();},
    run:(...args)=>helper.run(...args),retry:()=>helper.retry(),acknowledge:value=>helper.acknowledge(value)
  };
  const normalApi=async(path,options)=>{
    const data=await api(path,options);
    if(authority.permissions(auth).owner&&!helper)await ensureHelper();
    return data;
  };
  page=mount({w,d,auth,authority,api:normalApi,savedRequests});
  const stop=()=>{if(closed)return;closed=true;for(const abort of requests)abort.abort();requests.clear();page.stop();w.removeEventListener('pagehide',stop);};
  w.addEventListener('pagehide',stop,{once:true});
  if(!await page.init()){stop();return null;}return Object.freeze({page,stop});
}
if(typeof window!=='undefined'&&window.document?.getElementById('staffing-workspace')&&!native(window)){
  mountStaffingRuntime().catch(()=>{const s=document.getElementById('staffing-status');if(s)s.textContent='Current manager staffing service is unavailable. No change was sent.';});
}
