// Name-first manager sign-in. The server still verifies the challenge and account.
// No PIN, account directory, credentials or roles are persisted by this module.
export const LEADERSHIP_DISPLAY_NAMES=Object.freeze(['Eric McKenney','Haley','Brandy Gull','Jennifer','Annie','Eric Operle']);
export async function mountLeadershipEnrollment({document:d=document,fetchImpl=fetch,serviceOrigin='',onSession=()=>{}}={}){
 const id=name=>d.getElementById(name),pin=id('leadership-pin'),names=id('approved-name'),status=id('status'),pinForm=id('pin-form'),nameForm=id('name-form'),enrolled=id('enrolled'),check=id('check-session');
 if(!serviceOrigin){status.textContent='Preview is not connected. Leadership enrollment is not activated.';return{stop(){},configured:false};}
 const origin=new URL(serviceOrigin);
 if(origin.origin!==serviceOrigin||origin.username||origin.password||origin.protocol!=='https:'&&!['http://127.0.0.1','http://localhost'].some(p=>origin.origin===p||origin.origin.startsWith(p+':')))throw Error('Approved enrollment service origin required.');
 let csrf=null,selectedName=null,busy=false,closed=false,mutationHeld=false,controller=null;const listeners=[];
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push([target,type,fn]);};
 const text=(value,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max;
 const controls=()=>{for(const e of [pin,names,id('verify-pin'),id('enroll-browser'),id('revoke-browser')])e.disabled=busy||mutationHeld;check.disabled=busy;};
 function clearChallenge(){selectedName=null;names.replaceChildren(new Option('Choose your name',''));for(const name of LEADERSHIP_DISPLAY_NAMES)names.add(new Option(name,name));nameForm.hidden=true;}
 async function acceptSession(body){
  if(body?.ok!==true||typeof body.enrolled!=='boolean'||!text(body.csrfToken,4096))throw Error('Browser enrollment response is unverified.');
  const v=body.session;
  if(body.enrolled&&(v?.identityAssurance!=='SELF_ASSERTED_NAME'||!text(v.claimedAccount?.accountId)||!text(v.claimedAccount?.displayName)
    ||!text(v.cohort?.principalId)||!Number.isSafeInteger(v.cohort?.policyVersion)||v.cohort.policyVersion<1||!Array.isArray(v.cohort.permissions)||!v.managerSession))throw Error('Leadership enrollment identity/permission response is unverified.');
  csrf=body.csrfToken;mutationHeld=false;clearChallenge();pin.value='';pinForm.hidden=true;nameForm.hidden=body.enrolled;enrolled.hidden=!body.enrolled;check.hidden=false;
  id('claimed-name').textContent=body.enrolled?v.claimedAccount.displayName:'';
  // Contact is deliberately not displayed here: Main verifies its provenance.
  status.textContent=body.enrolled?'This browser is ready for manager access.':'Choose your name to sign in.';
  await onSession(body);return body;
 }
 async function request(path,body){
  controller=new AbortController();const current=controller,timer=setTimeout(()=>current.abort(),15000);
  try{
   const response=await fetchImpl(origin.origin+'/custodial-leadership-api'+path,{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',redirect:'error',signal:current.signal,
    headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value=await response.json();if(closed)throw Error('Enrollment view closed.');
   if(!response.ok||value?.ok!==true){const error=Error(response.status===429?'Too many attempts. Wait for the server attempt limit to clear.':response.status===503?(value?.error==='leadership_disabled'?'Manager sign-in is not enabled yet.':'Leadership access is temporarily unavailable. Check browser enrollment again when connected.'):'The server refused this enrollment request.');error.serverRejected=true;throw error;}return value;
  }finally{clearTimeout(timer);if(controller===current)controller=null;}
 }
 async function perform(work){if(busy||closed)return;busy=true;controls();try{await work();}catch(error){
   if(!error.serverRejected)mutationHeld=true;if(!closed)status.textContent=error.serverRejected?error.message:'The result is unconfirmed. Check sign-in status before trying again.';
  }finally{busy=false;if(!closed)controls();}}
 check.hidden=false;
 const read=()=>perform(async()=>acceptSession(await request('/session')));
 listen(nameForm,'submit',event=>{event.preventDefault();
  if(busy||mutationHeld||!csrf||closed)return;
  if(!LEADERSHIP_DISPLAY_NAMES.includes(names.value)){status.textContent='Choose your name.';return;}
  selectedName=names.value;nameForm.hidden=true;pinForm.hidden=false;pin.value='';
  status.textContent='Enter the manager PIN for '+selectedName+'.';pin.focus?.();
 });
 listen(pinForm,'submit',event=>{event.preventDefault();const value=pin.value;pin.value='';const chosen=selectedName;
  if(busy||mutationHeld||!csrf||closed)return;if(!LEADERSHIP_DISPLAY_NAMES.includes(chosen)){status.textContent='Choose your name first.';return;}
  if(!/^[0-9]{4}$/.test(value)){status.textContent='Enter exactly four digits.';return;}
  return perform(async()=>{const body=await request('/challenge',{pin:value});
   if(!Array.isArray(body.approvedNames)||body.approvedNames.length===0||body.approvedNames.length>64
    ||body.approvedNames.some(n=>!text(n?.accountId)||!text(n?.displayName))||new Set(body.approvedNames.map(n=>n.accountId)).size!==body.approvedNames.length)throw Error('Approved name response is unverified.');
   const matches=body.approvedNames.filter(n=>n.displayName===chosen);
   if(matches.length!==1)throw Error('Selected manager is unavailable.');
   await acceptSession(await request('/enroll',{accountId:matches[0].accountId}));
  });
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
