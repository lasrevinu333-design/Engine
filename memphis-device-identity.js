(() => {
  'use strict';

  const RELEASE='release-2026.07.19.custodial-v3.12';
  const BACKEND_ORIGIN=window.MemphisAuth?.backendOrigin||'https://memphis-zoo-mcp.onrender.com';
  const STATUS_URL=`${BACKEND_ORIGIN}/device-auth/status`;
  const ENROLL_URL=`${BACKEND_ORIGIN}/device-auth/enroll`;
  const STORAGE_KEYS=['mz_scan_device_id','mz_employee_hub_device_id','memphisAssignedDeviceId'];
  const MANAGER_DEVICE_IDS=new Set(['KIOSK_01','KIOSK_1','1E74FE4C-DC20B3B9','ERICH_PC','ERICH_DESKTOP','MANAGER_PC']);
  const hasNativeFetch=typeof window.fetch==='function';
  const nativeFetch=hasNativeFetch?window.fetch.bind(window):async()=>{throw new Error('fetch unavailable');};
  const RequestCtor=typeof Request==='function'?Request:(typeof window.Request==='function'?window.Request:null);
  const HeadersCtor=typeof Headers==='function'?Headers:(typeof window.Headers==='function'?window.Headers:null);
  const hasDom=typeof document!=='undefined'&&Boolean(document?.createElement);
  let credentialStatus=null;
  let statusRequest=null;
  let enrollmentPromise=null;
  let banner=null;
  let overlay=null;
  let nativeCustodialObserved=false;

  function isNativeCustodialSecurity(){
    // Evidence requires the protected reader; it never supplies an identity.
    // Once observed, missing/unreadable successors cannot thaw raw web writes.
    if(nativeCustodialObserved)return true;
    try{
      if(window.MemphisCustodialSecurity?.native===true
        || window.MemphisMobile?.edition==='custodial'
        || window.MemphisMobileBuildIdentity?.edition==='custodial'
        || window.Capacitor?.isNativePlatform?.()===true
        || ['android','ios'].includes(window.Capacitor?.getPlatform?.()))nativeCustodialObserved=true;
    }catch(_err){nativeCustodialObserved=true;}
    return nativeCustodialObserved;
  }

  function nativeIdentityOwner(){
    try{
      if(!isNativeCustodialSecurity())return null;
      const security=window.MemphisCustodialSecurity,mobile=window.MemphisMobile;
      const reader=security?.getStatus,principalReader=mobile?.principalIdentity;
      if(security?.native!==true||mobile?.edition!=='custodial'
        ||typeof reader!=='function'||typeof principalReader!=='function')return null;
      const status=reader.call(security),identity=principalReader.call(mobile);
      const deviceId=status?.deviceId;
      if(status?.ready!==true||status.available!==true||status.quarantined!==false
        ||!Number.isSafeInteger(status.generation)||status.generation<1
        ||typeof deviceId!=='string'||normalize(deviceId)!==deviceId||!isEmployeeKiosk(deviceId)
        ||status.principal?.device_id!==deviceId||typeof identity!=='string'||!identity)return null;
      const securityReady=security.ready,mobileReady=mobile.ready,pending=mobileReady||securityReady;
      if(!pending||typeof pending.then!=='function')return null;
      return Object.freeze({security,mobile,reader,principalReader,securityReady,mobileReady,pending,
        identity,generation:status.generation,deviceId,status});
    }catch(_err){return null;}
  }

  function sameNativeIdentityOwner(original){
    const current=nativeIdentityOwner();
    return current&&['security','mobile','reader','principalReader','securityReady','mobileReady','pending',
      'identity','generation','deviceId'].every(key=>current[key]===original[key])?current:null;
  }

  function protectedNativeDeviceId(){
    return nativeIdentityOwner()?.deviceId||'';
  }

  function normalize(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    if(/^kiosk[-_ ]?\d{1,2}$/i.test(raw)){
      const digits=(raw.match(/\d+/)||[''])[0].padStart(2,'0');
      return `KIOSK_${digits}`;
    }
    return raw;
  }

  function isPlausible(value){
    const normalized=normalize(value);
    if(!normalized)return false;
    if(/^(visitor|device)-/i.test(normalized))return false;
    if(/^KIOSK_\d{2}$/i.test(normalized))return true;
    if(/^[a-z0-9]{6,}-[a-z0-9]{6,}$/i.test(normalized))return true;
    return false;
  }

  function isCanonicalKiosk(value){return /^KIOSK_(0[1-9]|10)$/i.test(normalize(value));}
  function isEmployeeKiosk(value){return /^KIOSK_(0[2-9]|10)$/i.test(normalize(value));}
  function isManagerDevice(value){return MANAGER_DEVICE_IDS.has(String(normalize(value)||'').toUpperCase());}

  function isFullyKiosk(){
    try{if(window.fully)return true;}catch(_err){}
    return /FullyKiosk/i.test(String(navigator.userAgent||''));
  }

  function callFully(method){
    try{
      const fn=window.fully&&window.fully[method];
      if(typeof fn!=='function')return '';
      return normalize(fn.call(window.fully));
    }catch(_err){return '';}
  }

  function fullyCandidates(){
    if(!isFullyKiosk())return [];
    return [
      {value:callFully('getDeviceId'),source:'fully_device_id'},
      {value:callFully('getSerialNumber'),source:'fully_serial'},
      {value:callFully('getMacAddress'),source:'fully_mac'},
      {value:callFully('getDeviceName'),source:'fully_device_name'},
    ].filter((candidate)=>isPlausible(candidate.value));
  }

  function resolveFullyIdentifier(){
    if(isNativeCustodialSecurity())return protectedNativeDeviceId();
    const candidates=fullyCandidates();
    const canonical=candidates.find((candidate)=>isCanonicalKiosk(candidate.value));
    return canonical?.value||candidates[0]?.value||'';
  }

  // Synchronous return values below are resolver DATA, never save receipts.
  // One private original attempt is joined by resolveReady(), not retried.
  let browserPersistence=null,browserAdmissionPromise=null,browserPersistenceUncertain=false,browserPageIdentityOwner=null;
  const BROWSER_ROOT_IDENTITY=Symbol('original-three-key-identity'),BROWSER_PAGE_IDENTITY=Symbol('page-two-or-three-key-identity');
  const browserPersistenceUnavailable=()=>new Error('Original browser identity persistence unavailable.');
  function browserIdentitySource(){
    const area=localStorage,prototype=Object.getPrototypeOf(area),navigatorObject=window.navigator,
      locks=navigatorObject?.locks,request=locks?.request,methods={};
    for(const name of ['getItem','setItem']){
      const descriptor=Object.getOwnPropertyDescriptor(prototype,name);
      if(!descriptor||descriptor.writable!==true||descriptor.configurable!==true
        ||typeof descriptor.value!=='function'||area[name]!==descriptor.value)throw browserPersistenceUnavailable();
      methods[name]=descriptor.value;
    }
    if(typeof request!=='function')throw browserPersistenceUnavailable();
    const current=()=>{
      if(isNativeCustodialSecurity()||localStorage!==area||window.localStorage!==area
        ||Object.getPrototypeOf(area)!==prototype||window.navigator!==navigatorObject
        ||navigatorObject.locks!==locks||locks.request!==request)throw browserPersistenceUnavailable();
      for(const name of Object.keys(methods)){
        const descriptor=Object.getOwnPropertyDescriptor(prototype,name);
        if(area[name]!==methods[name]||descriptor?.value!==methods[name]
          ||descriptor.writable!==true||descriptor.configurable!==true)throw browserPersistenceUnavailable();
      }
    };
    const read=key=>{
      current();const raw=methods.getItem.call(area,key);current();
      if(raw!==null&&typeof raw!=='string')throw browserPersistenceUnavailable();return raw;
    };
    const write=(key,value)=>{current();methods.setItem.call(area,key,value);current();};
    current();return {current,read,write,locks,storage:Object.freeze({getItem:read,setItem:write})};
  }
  function browserIdentityAdmission(source){
    if(!browserAdmissionPromise)browserAdmissionPromise=(async()=>{
      const module=await import('./mobile/src/custodial/protected-browser-admission.js');source.current();
      const gate=module.createProtectedBrowserAdmission({storage:source.storage,locks:source.locks});
      source.current();return {gate,current:source.current};
    })();
    return browserAdmissionPromise;
  }
  function persistBrowserIdentity(value,policy){
    if(policy!==BROWSER_ROOT_IDENTITY&&policy!==BROWSER_PAGE_IDENTITY)throw browserPersistenceUnavailable();
    // Repeated calls for this SAME selection AND closed policy join a refusal.
    // A cached DATA selection does not validate source or confirm persistence.
    if(browserPersistence?.value===value&&browserPersistence.policy===policy)return;
    const attempt={value,policy,settled:null,requireResult:()=>{throw browserPersistenceUnavailable();}};
    browserPersistence=attempt;
    try{
      if(browserPersistenceUncertain)throw browserPersistenceUnavailable();
      const source=browserIdentitySource(),original=STORAGE_KEYS.map(source.read),expected=original.slice();
      const count=policy===BROWSER_ROOT_IDENTITY||/^KIOSK_[0-9]{2}$/i.test(value)?3:2;
      const intended=original.map((raw,index)=>index<count?value:raw),pageOwner=policy===BROWSER_PAGE_IDENTITY?browserPageIdentityOwner:null;
      let owner=null,entered=false,effectAttempted=false;
      const current=()=>{
        if(browserPersistence!==attempt||browserPersistenceUncertain)throw browserPersistenceUnavailable();
        if(policy===BROWSER_PAGE_IDENTITY&&(!pageOwner||window.MemphisDeviceIdentity!==pageOwner
          ||pageOwner.persistPageDeviceId!==persistPageDeviceId))throw browserPersistenceUnavailable();
        source.current();if(owner)owner.current();
      };
      const exact=rows=>{
        for(let index=0;index<STORAGE_KEYS.length;index++){
          current();if(source.read(STORAGE_KEYS[index])!==rows[index])throw browserPersistenceUnavailable();current();
        }
      };
      const checkpoint=()=>{current();owner.gate.requireMutation();current();};
      attempt.requireResult=()=>{
        current();owner.gate.requireAdmission();exact(intended);owner.gate.requireAdmission();current();
      };
      attempt.settled=(async()=>{
        owner=await browserIdentityAdmission(source);current();exact(original);
        const result=await owner.gate.mutate(()=>{
          if(entered)throw browserPersistenceUnavailable();entered=true;
          for(let index=0;index<count;index++){
            checkpoint();exact(expected);checkpoint();effectAttempted=true;
            source.write(STORAGE_KEYS[index],value);expected[index]=value;
            checkpoint();exact(expected);checkpoint();
          }
          return true;
        });
        if(result!==true||!entered)throw browserPersistenceUnavailable();
        attempt.requireResult();return true;
      })().catch(()=>{
        // A partial/uncertain effect is retained, never adopted as a new
        // original for an automatic retry, refund or compensating rollback.
        if(effectAttempted)browserPersistenceUncertain=true;
        return false;
      });
    }catch(_err){attempt.settled=Promise.resolve(false);}
  }

  function persist(value){
    const normalized=normalize(value);
    if(isNativeCustodialSecurity()){
      const protectedId=protectedNativeDeviceId();
      return normalized===protectedId?protectedId:'';
    }
    if(!isPlausible(normalized))return '';
    persistBrowserIdentity(normalized,BROWSER_ROOT_IDENTITY);
    return normalized;
  }

  // Fixed ordinary page DATA operation: no caller policy, keys or callback.
  // The page has already normalized this string; do not reinterpret its ID.
  function persistPageDeviceId(value){
    if(typeof value!=='string'||!value)return '';
    try{
      if(!browserPageIdentityOwner||window.MemphisDeviceIdentity!==browserPageIdentityOwner
        ||browserPageIdentityOwner.persistPageDeviceId!==persistPageDeviceId)return '';
      if(isNativeCustodialSecurity()){
        const protectedId=protectedNativeDeviceId();return value===protectedId?protectedId:'';
      }
      persistBrowserIdentity(value,BROWSER_PAGE_IDENTITY);return value;
    }catch(_err){return '';}
  }

  function storedCandidates(){
    if(isNativeCustodialSecurity())return [];
    const values=[];
    for(const key of STORAGE_KEYS){
      try{
        const value=normalize(localStorage.getItem(key)||'');
        if(isPlausible(value)&&!values.includes(value))values.push(value);
      }catch(_err){}
    }
    return values;
  }

  function readStored(){
    const values=storedCandidates();
    return values.find(isCanonicalKiosk)||values[0]||'';
  }

  function resolve(options={}){
    if(isNativeCustodialSecurity()){
      const protectedId=protectedNativeDeviceId();
      return protectedId
        ? {deviceId:protectedId,source:'protected_native_credential'}
        : {deviceId:'',source:'protected_native_unavailable'};
    }
    const url=options.url instanceof URL?options.url:new URL(window.location.href);
    const explicit=normalize(url.searchParams.get('device')||url.searchParams.get('deviceId')||'');
    const stored=storedCandidates();
    const fully=fullyCandidates();

    const fullyCanonical=fully.find((candidate)=>isCanonicalKiosk(candidate.value));
    if(fullyCanonical)return {deviceId:persist(fullyCanonical.value),source:fullyCanonical.source};

    if(isCanonicalKiosk(explicit))return {deviceId:persist(explicit),source:'url_canonical'};

    const storedCanonical=stored.find(isCanonicalKiosk);
    if(storedCanonical)return {deviceId:persist(storedCanonical),source:'storage_canonical'};

    if(isPlausible(explicit))return {deviceId:persist(explicit),source:'url'};

    const fullyHardware=fully.find((candidate)=>!isCanonicalKiosk(candidate.value));
    if(fullyHardware)return {deviceId:persist(fullyHardware.value),source:fullyHardware.source};

    const storedFallback=stored[0]||'';
    if(storedFallback)return {deviceId:persist(storedFallback),source:'storage'};

    return {deviceId:'',source:'unconfigured'};
  }

  async function waitForAuthority(){
    if(!isNativeCustodialSecurity())return null;
    const original=nativeIdentityOwner();
    if(!original)return null;
    try{
      await original.pending;
      return sameNativeIdentityOwner(original)?.status||null;
    }catch(_err){return null;}
  }

  async function resolveReady(options={}){
    if(!isNativeCustodialSecurity()){
      const original=resolve(options),attempt=browserPersistence;
      if(!original.deviceId)return original;
      try{
        if(!attempt||attempt.policy!==BROWSER_ROOT_IDENTITY||attempt.value!==original.deviceId||!await attempt.settled)throw browserPersistenceUnavailable();
        attempt.requireResult();return original;
      }catch(_err){return {deviceId:'',source:'browser_persistence_unavailable'};}
    }
    const unavailable={deviceId:'',source:'protected_native_unavailable'};
    const original=nativeIdentityOwner();
    // No original ready principal exists: this request cannot adopt one that
    // happens to appear during bootstrap. A later explicit call may observe it.
    if(!original)return unavailable;
    try{
      await original.pending;
      return sameNativeIdentityOwner(original)
        ? {deviceId:original.deviceId,source:'protected_native_credential'}:unavailable;
    }catch(_err){return unavailable;}
  }

  function currentDeviceId(){return resolve().deviceId||'';}

  function backendUrl(input){
    try{
      const raw=RequestCtor&&input instanceof RequestCtor?input.url:String(input||'');
      return new URL(raw,window.location.href);
    }catch(_err){return null;}
  }

  function isBackendRequest(input){return backendUrl(input)?.origin===BACKEND_ORIGIN;}
  function isManagerAuthRequest(input){const url=backendUrl(input);return url?.origin===BACKEND_ORIGIN&&url.pathname.startsWith('/auth-api/');}

  async function backendHeaders(input,init={}){
    if(!HeadersCtor)return init.headers||{};
    const headers=new HeadersCtor(RequestCtor&&input instanceof RequestCtor?input.headers:undefined);
    if(init.headers){
      const overrides=new HeadersCtor(init.headers);
      overrides.forEach((value,name)=>headers.set(name,value));
    }
    const deviceId=currentDeviceId();
    if(deviceId&&!headers.has('X-Device-Id'))headers.set('X-Device-Id',deviceId);
    if(deviceId&&isManagerDevice(deviceId)&&!isManagerAuthRequest(input)&&!headers.has('Authorization')&&typeof window.MemphisAuth?.opsManagerAuthHeaders==='function'){
      try{
        const managerHeaders=await window.MemphisAuth.opsManagerAuthHeaders();
        for(const [name,value] of Object.entries(managerHeaders||{}))if(value&&!headers.has(name))headers.set(name,String(value));
      }catch(_err){}
    }
    return headers;
  }

  async function enrollmentResponseState(response){
    const hinted=response?.headers?.get('X-Device-Enrollment-Required')==='true';
    if(response?.status!==401)return{required:hinted,retry:false};
    try{
      const payload=await response.clone().json();
      const required=payload?.code==='device_credential_required'||payload?.enrollment_required===true;
      return{required,retry:required};
    }catch(_err){return{required:false,retry:false};}
  }

  async function deviceAwareFetch(input,init={}){
    if(!isBackendRequest(input))return nativeFetch(input,init);
    if(!hasNativeFetch||!RequestCtor||!HeadersCtor)return nativeFetch(input,init);
    const request=new RequestCtor(input,{...init,credentials:'include',headers:await backendHeaders(input,init)});
    const retry=request.clone();
    let response=await nativeFetch(request);
    const enrollment=await enrollmentResponseState(response);
    if(enrollment.required&&!enrollment.retry){
      credentialStatus={
        ...(credentialStatus||{}),
        authenticated:false,
        enrollment_required:true,
        policy_mode:credentialStatus?.policy_mode||'enroll',
        canonical_device_id:credentialStatus?.canonical_device_id||currentDeviceId(),
      };
      updateBanner();
      return response;
    }
    if(enrollment.retry){
      const enrolled=await ensureCredential({interactive:true,force:true});
      if(enrolled)response=await nativeFetch(retry);
    }
    return response;
  }

  if(hasNativeFetch&&RequestCtor&&HeadersCtor&&!isNativeCustodialSecurity())window.fetch=deviceAwareFetch;

  function ready(callback){
    if(!hasDom)return false;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',callback,{once:true});
    else callback();
    return true;
  }

  function installUi(){
    if(!hasDom)return false;
    if(document.getElementById('memphis-device-auth-style'))return true;
    const style=document.createElement('style');
    style.id='memphis-device-auth-style';
    style.textContent=`
      .mzDeviceEnrollBanner{position:fixed;left:50%;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));transform:translateX(-50%);z-index:2147483000;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(15,23,42,.96);color:#f8fafc;padding:11px 16px;font:800 14px/1.2 Arial,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.4);cursor:pointer;max-width:min(92vw,620px)}
      .mzDeviceEnrollOverlay{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:18px;background:rgba(3,7,18,.82);backdrop-filter:blur(8px)}
      .mzDeviceEnrollOverlay[hidden]{display:none!important}.mzDeviceEnrollCard{width:min(94vw,520px);padding:24px;border-radius:24px;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,.18);box-shadow:0 24px 70px rgba(0,0,0,.55);font-family:Arial,sans-serif}.mzDeviceEnrollCard h2{margin:0 0 10px;font-size:1.7rem}.mzDeviceEnrollCard p{margin:0 0 16px;color:#cbd5e1;line-height:1.4}.mzDeviceEnrollMeta{padding:10px 12px;margin:0 0 14px;border-radius:14px;background:rgba(255,255,255,.07);font-weight:800}.mzDeviceEnrollInput{width:100%;font-size:2rem;letter-spacing:.25em;text-align:center;padding:15px;border:0;border-radius:14px;background:#fff;color:#111827}.mzDeviceEnrollActions{display:flex;gap:10px;margin-top:14px}.mzDeviceEnrollActions button{flex:1;padding:14px;border:0;border-radius:14px;font-size:1rem;font-weight:900;cursor:pointer}.mzDeviceEnrollSubmit{background:#9be11f;color:#111827}.mzDeviceEnrollCancel{background:#334155;color:#f8fafc}.mzDeviceEnrollStatus{min-height:1.4em;margin-top:12px;color:#fde68a;font-weight:800}
    `;
    document.head.appendChild(style);

    banner=document.createElement('button');
    banner.type='button';
    banner.className='mzDeviceEnrollBanner';
    banner.hidden=true;
    banner.textContent='Secure this employee device — tap to enter its enrollment code';
    banner.addEventListener('click',()=>ensureCredential({interactive:true,force:true}));
    document.body.appendChild(banner);

    overlay=document.createElement('div');
    overlay.className='mzDeviceEnrollOverlay';
    overlay.hidden=true;
    overlay.innerHTML=`<section class="mzDeviceEnrollCard" role="dialog" aria-modal="true" aria-labelledby="mz-device-enroll-title"><h2 id="mz-device-enroll-title">Secure this employee device</h2><p>An Ops Manager generates a short-lived eight-digit code for this phone. Enrollment is required only once unless the phone is reset or revoked.</p><div id="mz-device-enroll-meta" class="mzDeviceEnrollMeta"></div><input id="mz-device-enroll-code" class="mzDeviceEnrollInput" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="00000000" aria-label="Eight-digit device enrollment code"><div class="mzDeviceEnrollActions"><button id="mz-device-enroll-cancel" class="mzDeviceEnrollCancel" type="button">Later</button><button id="mz-device-enroll-submit" class="mzDeviceEnrollSubmit" type="button">Enroll Device</button></div><div id="mz-device-enroll-status" class="mzDeviceEnrollStatus" role="status" aria-live="polite"></div></section>`;
    document.body.appendChild(overlay);
    return true;
  }

  function optionalEnrollment(status){
    // A successful status for an active assigned employee kiosk may offer
    // enrollment without changing observe mode or granting employee authority.
    return Boolean(status&&status.authenticated===false&&status.status_unavailable!==true
      &&status.policy_mode==='observe'&&status.enrollment_required!==true
      &&isEmployeeKiosk(status.canonical_device_id)
      &&status.canonical_device_id===currentDeviceId());
  }

  function updateBanner(){
    ready(()=>{
      installUi();
      if(!banner)return;
      const enrollmentNeeded=Boolean(credentialStatus&&!credentialStatus.authenticated
        &&(credentialStatus.enrollment_required||optionalEnrollment(credentialStatus)));
      banner.hidden=!enrollmentNeeded;
      if(!enrollmentNeeded&&overlay){
        overlay.hidden=true;
        const input=overlay.querySelector('#mz-device-enroll-code');
        const status=overlay.querySelector('#mz-device-enroll-status');
        if(input)input.value='';
        if(status)status.textContent='';
      }
      if(enrollmentNeeded&&credentialStatus?.canonical_device_id){
        banner.textContent=`Secure ${credentialStatus.canonical_device_id}${credentialStatus.employee_name?` · ${credentialStatus.employee_name}`:''} — tap to enroll`;
      }
    });
  }

  async function refreshCredentialStatus({force=false}={}){
    const deviceId=currentDeviceId();
    if(!deviceId||!isEmployeeKiosk(deviceId))return null;
    if(statusRequest&&!force)return statusRequest;
    statusRequest=(async()=>{
      try{
        const url=new URL(STATUS_URL);
        url.searchParams.set('device_id',deviceId);
        const response=await nativeFetch(url.toString(),{cache:'no-store',credentials:'include',headers:{'X-Device-Id':deviceId}});
        const payload=await response.json().catch(()=>null);
        if(!response.ok||!payload?.ok){
          if(payload?.code==='device_credential_required'){
            credentialStatus={authenticated:false,enrollment_required:true,policy_mode:payload.policy_mode||'enforce',canonical_device_id:deviceId};
            updateBanner();
            return credentialStatus;
          }
          credentialStatus=null;updateBanner();return null;
        }
        credentialStatus=payload.data||null;
        updateBanner();
        if(credentialStatus?.enrollment_required&&credentialStatus?.policy_mode==='enforce')void ensureCredential({interactive:true,force:true});
        return credentialStatus;
      }catch(error){
        credentialStatus={
          ...(credentialStatus||{}),
          authenticated:false,
          enrollment_required:false,
          policy_mode:credentialStatus?.policy_mode||'observe',
          status_unavailable:true,
          status_error:String(error?.message||'Device credential status unavailable.'),
          canonical_device_id:credentialStatus?.canonical_device_id||deviceId,
        };
        updateBanner();
        return credentialStatus;
      }
      finally{statusRequest=null;}
    })();
    return statusRequest;
  }

  function showEnrollmentDialog(status){
    if(!hasDom)return Promise.resolve(false);
    ready(()=>installUi());
    return new Promise((resolvePromise)=>{
      ready(()=>{
        installUi();
        const input=overlay.querySelector('#mz-device-enroll-code');
        const submit=overlay.querySelector('#mz-device-enroll-submit');
        const cancel=overlay.querySelector('#mz-device-enroll-cancel');
        const statusEl=overlay.querySelector('#mz-device-enroll-status');
        const meta=overlay.querySelector('#mz-device-enroll-meta');
        const enforced=status?.policy_mode==='enforce';
        meta.textContent=`${status?.canonical_device_id||currentDeviceId()}${status?.employee_name?` · ${status.employee_name}`:''}`;
        cancel.hidden=enforced;
        overlay.hidden=false;
        input.value='';
        statusEl.textContent='';
        setTimeout(()=>input.focus(),50);

        let finished=false;
        const finish=(value)=>{
          if(finished)return;
          finished=true;
          overlay.hidden=true;
          submit.removeEventListener('click',submitHandler);
          cancel.removeEventListener('click',cancelHandler);
          input.removeEventListener('keydown',keyHandler);
          resolvePromise(value);
        };
        const cancelHandler=()=>finish(false);
        const keyHandler=(event)=>{if(event.key==='Enter'){event.preventDefault();submitHandler();}};
        const submitHandler=async()=>{
          const code=String(input.value||'').replace(/\D/g,'').slice(0,8);
          if(!/^\d{8}$/.test(code)){statusEl.textContent='Enter all eight digits.';return;}
          submit.disabled=true;cancel.disabled=true;statusEl.textContent='Enrolling this phone…';
          try{
            const deviceId=currentDeviceId();
            const response=await nativeFetch(ENROLL_URL,{
              method:'POST',cache:'no-store',credentials:'include',
              headers:{'Content-Type':'application/json','X-Device-Id':deviceId},
              body:JSON.stringify({device_id:deviceId,enrollment_code:code,device_label:String(navigator.userAgent||'').slice(0,160)}),
            });
            const payload=await response.json().catch(()=>null);
            if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);
            credentialStatus=null;
            const verified=await refreshCredentialStatus({force:true});
            if(!verified?.authenticated){
              throw new Error('The secure credential was issued, but this browser did not retain its protected cookie. Do not enable enforcement. Enable third-party cookies or use the same-origin employee URL, then ask an Ops Manager for a new code.');
            }
            updateBanner();
            if(typeof window.dispatchEvent==='function'){
              const EventCtor=typeof CustomEvent==='function'?CustomEvent:(typeof window.CustomEvent==='function'?window.CustomEvent:null);
              if(EventCtor)window.dispatchEvent(new EventCtor('memphis-device-enrolled',{detail:credentialStatus}));
            }
            finish(true);
          }catch(error){statusEl.textContent=error?.message||'Device enrollment failed.';}
          finally{submit.disabled=false;cancel.disabled=false;}
        };
        submit.addEventListener('click',submitHandler);
        cancel.addEventListener('click',cancelHandler);
        input.addEventListener('keydown',keyHandler);
      });
    });
  }

  async function ensureCredential({interactive=false,force=false}={}){
    if(isNativeCustodialSecurity())return false;
    if(enrollmentPromise)return enrollmentPromise;
    enrollmentPromise=(async()=>{
      const status=await refreshCredentialStatus({force});
      if(!status)return false;
      if(status.authenticated)return true;
      if(!status.enrollment_required&&!optionalEnrollment(status))return false;
      if(!interactive&&status.policy_mode!=='enforce')return false;
      return showEnrollmentDialog(status);
    })();
    try{return await enrollmentPromise;}finally{enrollmentPromise=null;}
  }

  if(hasDom&&hasNativeFetch&&!isNativeCustodialSecurity())ready(()=>{installUi();void refreshCredentialStatus();});

  window.MemphisDeviceIdentity=browserPageIdentityOwner={
    RELEASE,
    normalize,
    isPlausible,
    isCanonicalKiosk,
    isEmployeeKiosk,
    isManagerDevice,
    isFullyKiosk,
    resolveFullyIdentifier,
    readStored,
    persist,
    persistPageDeviceId,
    resolve,
    resolveReady,
    ready:waitForAuthority,
    credentialStatus:()=>credentialStatus,
    refreshCredentialStatus,
    ensureCredential,
    nativeFetch,
  };
})();
