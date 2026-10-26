(function(global,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(
  require('./same-original-recovery-client.js'),require('./same-original-recovery-panel.js'),require('./same-original-recovery-original-store.js'));
 else global.MemphisSameOriginalRecoveryPage=factory(global.MemphisSameOriginalRecovery,
  global.MemphisSameOriginalRecoveryPanel,global.MemphisSameOriginalRecoveryOriginalStore);
})(typeof globalThis==='object'?globalThis:this,function(client,panel,originalStore){
 'use strict';
 // Composition only. All real authority, guarded transport, storage admission
 // and page/security retirement come from Main. No defaults or new intent IDs.
 const OWNER=['manager_id','manager_credential_id','manager_device_id','page_generation'];
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const IDS=['sameOriginalChallenge','sameOriginalReview','sameOriginalConfirm','sameOriginalStatus','sameOriginalSummary','sameOriginalMessage'];
 const failure=code=>Object.assign(new Error('same_original_recovery_page_'+code),{code:'same_original_recovery_page_'+code});
 function snapshot(value){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||!Object.isFrozen(value))throw failure('owner_unavailable');
  const keys=Reflect.ownKeys(value);
  if(keys.length!==OWNER.length||keys.some(k=>!OWNER.includes(k)))throw failure('owner_unavailable');
  const copy={};for(const k of OWNER){const d=Object.getOwnPropertyDescriptor(value,k);
   if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw failure('owner_unavailable');copy[k]=d.value;}
  if(typeof copy.manager_id!=='string'||!UUID.test(copy.manager_id)||typeof copy.manager_credential_id!=='string'||!UUID.test(copy.manager_credential_id)
   ||typeof copy.manager_device_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(copy.manager_device_id))throw failure('owner_unavailable');
  if(!(typeof copy.page_generation==='string'&&copy.page_generation.length>0&&copy.page_generation.length<=128)
   &&!(Number.isSafeInteger(copy.page_generation)&&copy.page_generation>=0))throw failure('owner_unavailable');
  return Object.freeze(copy);
 }
 async function mountSameOriginalRecoveryPage({root,storage,currentOwner,mutate,request,ownsPage}={}){
  if(!root||typeof root.querySelector!=='function'||typeof root.addEventListener!=='function'||typeof root.removeEventListener!=='function')
   throw failure('markup_unavailable');
  const nodes=IDS.map(id=>root.querySelector('#'+id));
  function quiet(message){
   for(const node of nodes.slice(0,4))if(node)node.disabled=true;
   if(nodes[0])nodes[0].value='';
   if(nodes[4]){nodes[4].textContent='';nodes[4].hidden=true;}
   if(nodes[5])nodes[5].textContent=message;
  }
  quiet('Preparation is loading. Original records are not changed.');
  if(nodes.some(n=>!n||typeof n.addEventListener!=='function'||typeof n.removeEventListener!=='function'))throw failure('markup_unavailable');
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'
   ||![currentOwner,mutate,request,ownsPage].every(fn=>typeof fn==='function'))throw failure('ports_unavailable');
  if(typeof client?.createSameOriginalRecoveryController!=='function'||typeof panel?.mountSameOriginalRecoveryPanel!=='function'
   ||typeof originalStore?.createSameOriginalRecoveryOriginalStore!=='function')throw failure('modules_unavailable');
  let bound,controller=null,disposePanel=null,controllerClosed=false,closed=false,closeMessage=null,hydrating=true,hydrationRequestFailed=false;
  function owned(){try{return ownsPage()===true;}catch{return false;}}
  function requireCurrent(){
   if(closed)throw failure('closed');
   if(!owned())throw failure('ownership_lost');
   const value=currentOwner(),now=snapshot(value);
   if(bound&&!OWNER.every(k=>now[k]===bound[k]))throw failure('owner_changed');
   if(closed||!owned())throw failure('ownership_lost');
   return value;
  }
  function close(message){
   const first=!closed;if(first)closeMessage=message;
   closed=true;
   // Panel mount itself can observe retirement before returning its disposer;
   // a later close must still remove that newly returned listener lifetime.
   const release=disposePanel;disposePanel=null;
   try{if(release)release();}finally{if(controller&&!controllerClosed){controllerClosed=true;controller.dispose();}}
   // A late reply/error may finish resource cleanup, but must not repaint an
   // already retired page or replace the first closure disposition.
   if(first||release)quiet(closeMessage);
  }
  async function awaited(effect){requireCurrent();const result=await effect();requireCurrent();return result;}
  // Preserve Main's exact request object/body. This adds only rejection fences
  // and does not replace the actual transport/session/CSRF authorization.
  async function guardedRequest(call){
   try{return await awaited(()=>request(call));}
   catch{if(hydrating)hydrationRequestFailed=true;
    close('Preparation is unavailable. Any original remains retained; no replacement request is enabled.');
    throw failure('request_unconfirmed');}
  }
  try{
   bound=snapshot(requireCurrent());requireCurrent();
   const store=originalStore.createSameOriginalRecoveryOriginalStore({storage,currentOwner:requireCurrent,mutate});
   requireCurrent();controller=client.createSameOriginalRecoveryController({currentOwner:requireCurrent,request:guardedRequest,
    retainOriginal:store.retainOriginal,readOriginal:store.readOriginal});
   const retained=await awaited(()=>store.readOriginal());requireCurrent();
   if(retained!==null){
    await awaited(()=>controller.resume());requireCurrent();
    if(hydrationRequestFailed)throw failure('hydration_request_unconfirmed');
   }
   // No listener exists until original discovery/status and all owner fences
   // have settled. Empty storage leaves the actual controller IDLE.
   hydrating=false;requireCurrent();
   disposePanel=panel.mountSameOriginalRecoveryPanel({root,controller,ownsPage:()=>{
    try{requireCurrent();return true;}catch{
     close('Preparation is unavailable. Any original remains retained; no replacement request is enabled.');return false;}
   }});
   requireCurrent();
   return function dispose(){close('Preparation page closed. Any original remains retained.');};
  }catch{
   close('Preparation is unavailable. Any original remains retained; no replacement request is enabled.');
   throw failure('mount_unconfirmed');
  }
 }
 return Object.freeze({mountSameOriginalRecoveryPage});
});
