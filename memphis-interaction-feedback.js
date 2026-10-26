const ENABLED_KEY = 'mz_haptics_enabled';
function enabled(){try{return localStorage.getItem(ENABLED_KEY)!=='0'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch{return false;}}
function vibrate(pattern){if(!enabled()||typeof navigator.vibrate!=='function')return false;try{return navigator.vibrate(pattern);}catch{return false;}}
function selection(){return vibrate(8);}function success(){return vibrate([12,38,18]);}function warning(){return vibrate([24,45,24]);}function error(){return vibrate([40,35,40]);}
document.addEventListener('pointerdown',(event)=>{const control=event.target.closest('button,a,.tile,.tab,.threadRow,.cs-conversation');if(!control||control.matches('[disabled],[aria-disabled="true"]'))return;selection();},{passive:true});
window.addEventListener('memphis:feedback',(event)=>{const type=String(event.detail?.type||'selection');if(type==='success')success();else if(type==='error')error();else if(type==='warning')warning();else selection();});
const setHapticsEnabled=(()=>{
  let nativeRequired=false,webOwnerPromise=null;
  const unavailable=()=>Object.assign(new Error('Original preference mutation unavailable.'),{code:'custodial_security_state_unavailable'});
  function security(){
    try{
      const current=window.MemphisCustodialSecurity;
      // A never-native false facade is browser compatibility DATA, not a
      // native owner. Any native/ambiguous bootstrap still latches refusal.
      if((current!=null&&current.native!==false)||window.MemphisMobile?.edition==='custodial'||window.MemphisMobileBuildIdentity?.edition==='custodial'
        ||window.Capacitor?.isNativePlatform?.()===true||['android','ios'].includes(window.Capacitor?.getPlatform?.()))nativeRequired=true;
      if(nativeRequired&&(current?.native!==true||typeof current.getStatus!=='function'||typeof current.mutateProtectedWork!=='function'))throw unavailable();
      return nativeRequired?current:null;
    }catch{nativeRequired=true;throw unavailable();}
  }
  function nativeOwner(current){
    const reader=current.getStatus,writer=current.mutateProtectedWork,status=reader.call(current),principal=status?.principal;
    if(status?.ready!==true||status.available!==true||status.quarantined!==false
      ||!Number.isSafeInteger(status.generation)||status.generation<1||typeof status.deviceId!=='string'||!status.deviceId
      ||!principal||typeof principal!=='object'||Array.isArray(principal)||principal.device_id!==status.deviceId)throw unavailable();
    return {security:current,reader,writer,mobile:window.MemphisMobile,build:window.MemphisMobileBuildIdentity,
      capacitor:window.Capacitor,deviceId:status.deviceId,generation:status.generation,principal:JSON.stringify(principal)};
  }
  function rawArea(name){
    const area=window[name],prototype=area&&Object.getPrototypeOf(area),methods={};
    for(const key of ['getItem','setItem']){
      const descriptor=prototype&&Object.getOwnPropertyDescriptor(prototype,key);
      // Never bind an installed runtime firewall wrapper as raw admission.
      if(!descriptor||descriptor.writable!==true||descriptor.configurable!==true
        ||typeof descriptor.value!=='function'||area[key]!==descriptor.value)throw unavailable();
      methods[key]=descriptor.value;
    }
    const current=()=>{
      if(window[name]!==area||Object.getPrototypeOf(area)!==prototype)throw unavailable();
      for(const key of Object.keys(methods)){
        const descriptor=Object.getOwnPropertyDescriptor(prototype,key);
        if(area[key]!==methods[key]||descriptor?.value!==methods[key]
          ||descriptor.writable!==true||descriptor.configurable!==true)throw unavailable();
      }
    };
    return {current,storage:Object.freeze({
      getItem(key){current();return methods.getItem.call(area,key);},
      setItem(key,value){current();return methods.setItem.call(area,key,value);},
    })};
  }
  function webSource(){
    const local=rawArea('localStorage'),navigator=window.navigator,locks=navigator?.locks,request=locks?.request;
    if(typeof request!=='function')throw unavailable();
    const current=()=>{
      if(security()!==null||window.navigator!==navigator||navigator.locks!==locks||locks.request!==request)throw unavailable();
      local.current();
    };
    current();return {current,local,locks};
  }
  function webOwner(source){
    if(!webOwnerPromise)webOwnerPromise=(async()=>{
      const module=await import('./mobile/src/custodial/protected-browser-admission.js');source.current();
      // mutate() needs only raw local storage and this original shared lock;
      // inventory/capture/cipher resources are deliberately not acquired.
      const gate=module.createProtectedBrowserAdmission({storage:source.local.storage,locks:source.locks});
      source.current();return {gate,current:source.current};
    })();
    return webOwnerPromise;
  }
  return async function setHapticsEnabled(value){
    try{
      const current=security(),native=current?nativeOwner(current):null,source=native?null:webSource();
      const area=window.localStorage,reader=area.getItem,writer=area.setItem,original=reader.call(area,ENABLED_KEY),intended=value?'1':'0';
      if(original!==null&&typeof original!=='string')throw unavailable();
      let owner=null,confirmed=false;
      const identity=()=>{
        if(window.localStorage!==area||area.getItem!==reader||area.setItem!==writer)throw unavailable();
        if(native){const actual=security();if(actual!==native.security)throw unavailable();
          const next=nativeOwner(actual);if(Object.keys(native).some(key=>native[key]!==next[key]))throw unavailable();
        }else{source.current();if(owner)owner.current();}
      };
      const checkpoint=context=>{
        identity();
        if(native){
          if(typeof context?.assertCurrent!=='function'||context.deviceId!==native.deviceId||context.generation!==native.generation)throw unavailable();
          context.assertCurrent();
        }else owner.gate.requireMutation();
        identity();
      };
      const write=context=>{
        checkpoint(context);if(reader.call(area,ENABLED_KEY)!==original)throw unavailable();checkpoint(context);
        writer.call(area,ENABLED_KEY,intended);
        checkpoint(context);if(reader.call(area,ENABLED_KEY)!==intended)throw unavailable();checkpoint(context);
        confirmed=true;return true;
      };
      identity();
      let result;
      if(native)result=await native.writer.call(native.security,write,{requireEnrollment:true,expectedGeneration:native.generation});
      else{owner=await webOwner(source);identity();result=await owner.gate.mutate(()=>write());}
      // The callback has closed. Recheck original identities/readback, never
      // reuse its checkpoint or retry/compensate an unconfirmed effect.
      identity();if(result!==true||!confirmed||reader.call(area,ENABLED_KEY)!==intended)return false;identity();return true;
    }catch{return false;}
  };
})();
window.MemphisInteraction={selection,success,warning,error,setHapticsEnabled,hapticsEnabled:enabled};
