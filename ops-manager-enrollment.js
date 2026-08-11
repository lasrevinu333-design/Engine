(function(){
  'use strict';

  const ENROLLMENT_PATH='/leadership-api/enrollment/consume';
  const DEVICE_LABEL_DRAFT_KEY='memphisOpsManagerDeviceLabelDraft.v1';
  const INVALID_CODE_MESSAGE='That personal enrollment code is invalid, expired, or already used.';
  const form=document.getElementById('enroll-form');
  const intro=document.getElementById('intro');
  const code=document.getElementById('manager-code');
  const label=document.getElementById('device-label');
  const submit=document.getElementById('submit');
  const status=document.getElementById('status');
  let typedDeviceLabel='';
  try{typedDeviceLabel=String(sessionStorage.getItem(DEVICE_LABEL_DRAFT_KEY)||'').trim().slice(0,160);}catch{}

  function setStatus(text,error=false){status.textContent=text||'';status.className=`status${error?' error':''}`;}
  function defaultDeviceLabel(){
    const platform=String(navigator.userAgentData?.platform||navigator.platform||'computer').trim();
    return `Operations Leadership · ${platform}`.slice(0,160);
  }
  function selectedDeviceLabel(){
    let draft=typedDeviceLabel;
    try{draft=draft||String(sessionStorage.getItem(DEVICE_LABEL_DRAFT_KEY)||'').trim().slice(0,160);}catch{}
    return String(draft||label.value||defaultDeviceLabel()).trim().slice(0,160);
  }
  function rememberDeviceLabel(){
    const value=String(label.value||'').trim().slice(0,160);
    if(!value||value===defaultDeviceLabel()){
      typedDeviceLabel='';
      try{sessionStorage.removeItem(DEVICE_LABEL_DRAFT_KEY);}catch{}
      return;
    }
    typedDeviceLabel=value;
    try{sessionStorage.setItem(DEVICE_LABEL_DRAFT_KEY,value);}catch{}
  }
  function openHub(){
    const target=new URL('./start_page1.html',location.href);
    target.searchParams.set('manager_access','full_access');
    location.replace(target.toString());
  }
  function showEnrollment(message='This browser is not enrolled. Enter the personal code created for your leadership account.'){
    intro.textContent=message;
    form.classList.remove('hidden');
    label.value=typedDeviceLabel||label.value||defaultDeviceLabel();
    setStatus('');
    code.focus({preventScroll:true});
  }
  function normalizedIdentity(value){return String(value||'').trim();}
  function isNamedFullAccessSession(session){
    return Boolean(
      session
      && session.role==='ops_manager'
      && normalizedIdentity(session.manager_id)
      && normalizedIdentity(session.manager_display_name)
      && normalizedIdentity(session.device_id)
      && normalizedIdentity(session.credential_id)
      && normalizedIdentity(session.token)
      && session.access_level==='full_access'
      && session.read_only===false
      && session.trusted_device===true
      && Array.isArray(session.roles)
      && Number.isFinite(Date.parse(session.expires_at))
      && Date.parse(session.expires_at)>Date.now()
    );
  }
  function hasCredentialSecretMaterial(value,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return false;
    seen.add(value);
    for(const [key,nested] of Object.entries(value)){
      const normalized=String(key).toLowerCase().replace(/[^a-z0-9]/g,'');
      if(['credential','credentialsecret','secret','cookie','setcookie','enrollmentcode','managercode','onetimecode','passcode'].includes(normalized))return true;
      if(hasCredentialSecretMaterial(nested,seen))return true;
    }
    return false;
  }
  function requireNamedEnrollment(payload,submittedDeviceId){
    const data=payload?.data;
    const session=data?.session;
    const manager=data?.manager;
    const trusted=data?.trusted_device;
    const managerId=normalizedIdentity(session?.manager_id);
    const deviceId=normalizedIdentity(submittedDeviceId);
    if(
      payload?.ok!==true
      || hasCredentialSecretMaterial(data)
      || !isNamedFullAccessSession(session)
      || !manager||typeof manager!=='object'
      || !trusted||typeof trusted!=='object'
      || normalizedIdentity(manager.manager_id)!==managerId
      || normalizedIdentity(manager.display_name)!==normalizedIdentity(session.manager_display_name)
      || normalizedIdentity(trusted.manager_id)!==managerId
      || normalizedIdentity(session.device_id)!==deviceId
      || normalizedIdentity(trusted.device_id)!==deviceId
      || normalizedIdentity(trusted.credential_id)!==normalizedIdentity(session.credential_id)
      || trusted.max_access_level!=='full_access'
    )throw new Error('The server did not return a valid named manager enrollment.');
    return session;
  }
  function enrollmentErrorMessage(error){
    const responseStatus=Number(error?.status);
    if(responseStatus===401)return INVALID_CODE_MESSAGE;
    if(responseStatus===429)return 'Too many attempts. Try again later.';
    if(responseStatus===403)return 'This browser origin is not authorized for manager enrollment.';
    if(responseStatus===400)return 'Check the browser name and personal code, then try again.';
    return 'Manager enrollment is temporarily unavailable. Try again shortly.';
  }

  label.addEventListener('input',rememberDeviceLabel);
  label.addEventListener('change',rememberDeviceLabel);
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const normalizedCode=String(code.value||'').replace(/[\s-]+/g,'');
    rememberDeviceLabel();
    const submittedLabel=selectedDeviceLabel();
    const submittedDeviceId=normalizedIdentity(window.MemphisAuth?.getDeviceId?.());
    if(!/^\d{8}$/.test(normalizedCode)){setStatus('Enter the eight-digit personal enrollment code.',true);return;}
    if(!submittedDeviceId||submittedDeviceId.length>96||!submittedLabel){setStatus('This browser could not create a stable installation identity.',true);return;}
    submit.disabled=true;setStatus('Enrolling this browser…');
    try{
      const backendOrigin=String(window.MemphisAuth?.backendOrigin||'').replace(/\/$/,'');
      if(!/^https:\/\//.test(backendOrigin))throw new Error('Manager backend is unavailable.');
      const response=await fetch(`${backendOrigin}${ENROLLMENT_PATH}`,{
        method:'POST',cache:'no-store',credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code:normalizedCode,device_id:submittedDeviceId,device_label:submittedLabel})
      });
      const payload=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error('Manager enrollment request failed.'),{status:response.status});
      const session=requireNamedEnrollment(payload,submittedDeviceId);
      code.value='';
      try{sessionStorage.removeItem(DEVICE_LABEL_DRAFT_KEY);}catch{}
      setStatus(`Enrolled as ${session.manager_display_name}. Opening Hub…`);
      openHub();
    }catch(error){
      code.value='';
      setStatus(enrollmentErrorMessage(error),true);
      submit.disabled=false;
      code.focus();
    }
  });

  (async()=>{
    try{
      const session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:false,redirect:false,throwOnFailure:true});
      if(!isNamedFullAccessSession(session))throw new Error('No named trusted session.');
      openHub();
    }catch{showEnrollment();}
  })();
})();
