// Preview only. Main supplies the approved origin and owns manager/actor wiring.
// No PIN, account directory, credentials or roles are persisted by this module.
export async function mountLeadershipEnrollment({document:d=document,fetchImpl=fetch,serviceOrigin='',onSession=()=>{}}={}){
 const id=name=>d.getElementById(name),pin=id('leadership-pin'),names=id('approved-name'),status=id('status'),pinForm=id('pin-form'),nameForm=id('name-form'),enrolled=id('enrolled'),check=id('check-session');
 if(!serviceOrigin){status.textContent='Preview is not connected. Leadership enrollment is not activated.';return{stop(){},configured:false};}
 const origin=new URL(serviceOrigin);
 if(origin.origin!==serviceOrigin||origin.username||origin.password||origin.protocol!=='https:'&&!['http://127.0.0.1','http://localhost'].some(p=>origin.origin===p||origin.origin.startsWith(p+':')))throw Error('Approved enrollment service origin required.');
 let csrf=null,approved=[],busy=false,closed=false,mutationHeld=false,controller=null;const listeners=[];
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push([target,type,fn]);};
 const text=(value,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max;
 const controls=()=>{for(const e of [pin,names,id('verify-pin'),id('enroll-browser'),id('revoke-browser')])e.disabled=busy||mutationHeld;check.disabled=busy;};
 function clearChallenge(){approved=[];names.replaceChildren(new Option('Choose your name',''));nameForm.hidden=true;}
 async function acceptSession(body){
  if(body?.ok!==true||typeof body.enrolled!=='boolean'||!text(body.csrfToken,4096))throw Error('Browser enrollment response is unverified.');
  const v=body.session;
  if(body.enrolled&&(v?.identityAssurance!=='SELF_ASSERTED_NAME'||!text(v.claimedAccount?.accountId)||!text(v.claimedAccount?.displayName)
    ||!text(v.cohort?.principalId)||!Number.isSafeInteger(v.cohort?.policyVersion)||v.cohort.policyVersion<1||!Array.isArray(v.cohort.permissions)||!v.managerSession))throw Error('Leadership enrollment identity/permission response is unverified.');
  csrf=body.csrfToken;mutationHeld=false;clearChallenge();pin.value='';pinForm.hidden=body.enrolled;enrolled.hidden=!body.enrolled;check.hidden=false;
  id('claimed-name').textContent=body.enrolled?v.claimedAccount.displayName+' · self-selected name':'';
  // Contact is deliberately not displayed here: Main verifies its provenance.
  status.textContent=body.enrolled?'This browser has an opaque server enrollment. Your chosen name is self-asserted.':'Enter the leadership PIN to choose an approved name.';
  await onSession(body);return body;
 }
 async function request(path,body){
  controller=new AbortController();const current=controller,timer=setTimeout(()=>current.abort(),15000);
  try{
   const response=await fetchImpl(origin.origin+'/custodial-leadership-api'+path,{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',redirect:'error',signal:current.signal,
    headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value=await response.json();if(closed)throw Error('Enrollment view closed.');
   if(!response.ok||value?.ok!==true){const error=Error(response.status===429?'Too many attempts. Wait for the server attempt limit to clear.':response.status===503?'Leadership enrollment is not enabled. No new enrollment is available.':'The server refused this enrollment request.');error.serverRejected=true;throw error;}return value;
  }finally{clearTimeout(timer);if(controller===current)controller=null;}
 }
 async function perform(work){if(busy||closed)return;busy=true;controls();try{await work();}catch(error){
   if(!error.serverRejected)mutationHeld=true;if(!closed)status.textContent=error.serverRejected?error.message:'The result is unconfirmed. Check browser enrollment before trying another change.';
  }finally{busy=false;if(!closed)controls();}}
 check.hidden=false;
 const read=()=>perform(async()=>acceptSession(await request('/session')));
 listen(pinForm,'submit',event=>{event.preventDefault();const value=pin.value;pin.value='';
  if(mutationHeld||!csrf)return;if(!/^[0-9]{4}$/.test(value)){status.textContent='Enter exactly four digits.';return;}
  return perform(async()=>{clearChallenge();const body=await request('/challenge',{pin:value});
   if(!Array.isArray(body.approvedNames)||body.approvedNames.length===0||body.approvedNames.length>64
    ||body.approvedNames.some(n=>!text(n?.accountId)||!text(n?.displayName))||new Set(body.approvedNames.map(n=>n.accountId)).size!==body.approvedNames.length)throw Error('Approved name response is unverified.');
   approved=body.approvedNames.map(({accountId,displayName})=>({accountId,displayName}));
   for(const n of approved)names.add(new Option(n.displayName,n.accountId));pinForm.hidden=true;nameForm.hidden=false;
   status.textContent='Choose your approved name. This choice does not grant a role or verify individual identity.';
  });
 });
 listen(nameForm,'submit',event=>{event.preventDefault();const accountId=names.value;
  if(mutationHeld||!csrf)return;if(!approved.some(n=>n.accountId===accountId)){status.textContent='Choose a name returned by the verified PIN challenge.';return;}
  return perform(async()=>acceptSession(await request('/enroll',{accountId})));
 });
 listen(id('revoke-browser'),'click',()=>!mutationHeld&&perform(async()=>{await request('/revoke',{});acceptSession(await request('/session'));}));
 listen(check,'click',read);
 await read();
 return Object.freeze({configured:true,read,stop(){closed=true;controller?.abort();pin.value='';clearChallenge();for(const [e,type,fn]of listeners)e.removeEventListener(type,fn);}});
}
if(typeof document!=='undefined'&&document.getElementById('leadership-pin'))mountLeadershipEnrollment({
 serviceOrigin:window.MemphisAuth?.backendOrigin||'',
 onSession:async body=>{
  const link=document.getElementById('open-manager');if(link)link.hidden=true;
  if(!body.enrolled)return;
  if(typeof window.MemphisAuth?.refreshLeadershipSession!=='function')throw Error('Manager session adapter unavailable.');
  const session=await window.MemphisAuth.refreshLeadershipSession();
  if(session.manager_id!==body.session.cohort.principalId||session.credential_id!==body.session.registrationId
   ||!window.MemphisAuth.isCustodialManagementAdmin(session))throw Error('Current server manager adapter binding changed.');
  const target=new URL('./start_page1.html',location.href),requested=new URLSearchParams(location.search).get('return');
  if(requested){const candidate=new URL(requested,location.href);if(candidate.origin===location.origin&&/\.html$/.test(candidate.pathname)&&!candidate.pathname.endsWith('/ops-manager-hub.html'))target.href=candidate.href;}
  if(link){link.href=target.href;link.hidden=false;}
 }
}).catch(()=>{document.getElementById('status').textContent='Leadership enrollment configuration or manager adapter is unavailable.';});
