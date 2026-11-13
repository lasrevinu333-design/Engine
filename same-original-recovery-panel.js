(function(global,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else global.MemphisSameOriginalRecoveryPanel=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // DOM only. Main supplies the original controller and a mount-bound page
 // ownership fence; neither this display nor ownsPage creates authorization.
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const STATES=new Set(['IDLE','REVIEWING','REVIEW_ONLY','SAVING_ORIGINAL','CONFIRMING','UNKNOWN','RECORDED','HELD','UNAVAILABLE','CLOSED']);
 const IDS=['sameOriginalChallenge','sameOriginalReview','sameOriginalConfirm','sameOriginalStatus','sameOriginalSummary','sameOriginalMessage'];
 function mountSameOriginalRecoveryPanel({root,controller,ownsPage}={}){
  if(!root||typeof root.querySelector!=='function'||typeof root.addEventListener!=='function'
   ||typeof root.removeEventListener!=='function')throw new TypeError('Same-original panel root is unavailable');
  const nodes=IDS.map(id=>root.querySelector('#'+id));
  if(nodes.some(n=>!n||typeof n.addEventListener!=='function'||typeof n.removeEventListener!=='function'))
   throw new TypeError('Same-original panel markup is incomplete');
  const [challenge,review,confirm,status,summary,message]=nodes;
  const available=controller&&['getState','review','confirm','resume'].every(k=>typeof controller[k]==='function');
  let alive=true,lost=false,pending=false,panelGeneration=0,actionGeneration=0,reviewedChallenge=null;
  const listeners=[];
  function owned(){try{return typeof ownsPage==='function'&&ownsPage()===true;}catch{return false;}}
  function disable(){challenge.disabled=true;review.disabled=true;confirm.disabled=true;status.disabled=true;}
  function hideOriginal(){summary.textContent='';summary.hidden=true;challenge.value='';}
  function withdraw(){
   if(!lost){lost=true;panelGeneration++;actionGeneration++;}
   disable();hideOriginal();message.textContent='This panel is no longer owned by the current page. Any saved original remains retained.';
  }
  function current(t){
   if(!alive||lost||t.panel!==panelGeneration||t.action!==actionGeneration)return false;
   if(!owned()){withdraw();return false;}return true;
  }
  function view(){
   if(!alive||lost)return null;
   if(!owned()){withdraw();return null;}
   if(!available)return null;
   let state;try{state=controller.getState();}catch{return null;}
   if(!owned()){withdraw();return null;}
   return state&&STATES.has(state.state)?state:null;
  }
  const retained=s=>s.original_request!=null||s.retention_confirmed===true||s.state==='UNKNOWN'||s.state==='RECORDED';
  const canReview=s=>!retained(s)&&['IDLE','REVIEW_ONLY','HELD'].includes(s.state);
  const canConfirm=s=>s.can_confirm===true&&s.state==='REVIEW_ONLY'&&!retained(s)
   &&s.original_target!=null&&reviewedChallenge!==null&&challenge.value===reviewedChallenge;
  const canStatus=s=>s.can_read_original_status===true&&s.original_request!=null;
  const text=value=>typeof value==='string'?value:'Unavailable';
  function render(customMessage){
   const state=view();if(!alive||lost)return;
   if(!state){disable();hideOriginal();message.textContent='Preparation review is unavailable. No authorization or original-status port is inferred.';return;}
   const hasOriginal=retained(state);
   challenge.disabled=pending||hasOriginal||['UNAVAILABLE','CLOSED','REVIEWING','SAVING_ORIGINAL','CONFIRMING'].includes(state.state);
   if(state.original_request)challenge.value=text(state.original_request.challenge_id);
   review.disabled=pending||!canReview(state);
   confirm.disabled=pending||!canConfirm(state);
   status.disabled=pending||!canStatus(state);
   const target=state.original_target;
   summary.textContent=target?[
    'Purpose: '+text(state.purpose),
    'Original device: '+text(target.canonical_device_id)+' / '+text(target.canonical_device_pk),
    'Original employee: '+text(target.employee_id),
    'Original operation: '+text(target.operation_id),
    'Original generation: '+text(target.original_generation_id),
    'Capsule SHA256: '+text(target.capsule_sha256),
    'Source capture SHA256: '+text(target.source_capture_sha256),
    'Server expiry (unchanged): '+text(state.server_expires_at)
   ].join('\n'):'';
   summary.hidden=!target;
   const messages={
    IDLE:'Enter the exact original challenge UUID, then review its preparation binding.',
    REVIEW_ONLY:'Review this exact original target and server expiry. Confirming records preparation only, not a native grant or phone readiness.',
    REVIEWING:'Reading the original preparation review.',
    SAVING_ORIGINAL:'Saving the original confirmation before any approval request.',
    CONFIRMING:'One original confirmation is in progress. No replacement or repeat request is available.',
    RECORDED:'Preparation recorded ONLY. This is not native approval, work acceptance, key removal, finalization, or phone readiness.',
    UNKNOWN:'Outcome unknown. The original remains retained. Original-status only; no resend or replacement.',
    HELD:'Review is held. Any saved original remains retained; no inferred authority or resend.',
    UNAVAILABLE:'Preparation ports are unavailable. No action is enabled.',
    CLOSED:'The controller is closed. Any saved original remains retained.'
   };
   message.textContent=customMessage||(pending?'The original action is in progress. No second action is enabled.':messages[state.state]);
  }
  async function action(kind,event){
   event?.preventDefault();
   if(!alive||lost||pending)return;
   const state=view();if(!state)return render();
   if(!(kind==='review'?canReview(state):kind==='confirm'?canConfirm(state):canStatus(state)))return render();
   // Preserve exact entered bytes. Do not trim, normalize, or mint a challenge.
   const entered=challenge.value;
   if(kind==='review'&&(typeof entered!=='string'||!UUID.test(entered))){
    reviewedChallenge=null;render('Enter the exact canonical original challenge UUID. No request was sent.');return;
   }
   const t={panel:panelGeneration,action:++actionGeneration};
   pending=true;render();
   try{
    if(!current(t))return;
    if(kind==='review')await controller.review(entered);
    else if(kind==='confirm')await controller.confirm();
    else await controller.resume();
    if(!current(t))return;
    const latest=view();if(!latest)return;
    if(kind==='review')reviewedChallenge=latest.state==='REVIEW_ONLY'&&latest.can_confirm===true&&challenge.value===entered?entered:null;
    pending=false;render();
   }catch{
    if(!current(t))return;
    pending=false;render('The original action was not confirmed. Any saved original remains retained; use only original-status when available.');
   }finally{
    if(current(t)){pending=false;render();}
   }
  }
  function listen(node,type,callback){node.addEventListener(type,callback);listeners.push([node,type,callback]);}
  listen(review,'click',event=>action('review',event));
  listen(confirm,'click',event=>action('confirm',event));
  listen(status,'click',event=>action('status',event));
  listen(challenge,'input',()=>{reviewedChallenge=null;render();});
  listen(root,'focusin',()=>render());
  listen(root,'pointerdown',()=>{if(alive&&!lost&&!owned())withdraw();});
  render();
  return function dispose(){
   if(!alive)return;alive=false;panelGeneration++;actionGeneration++;pending=false;reviewedChallenge=null;
   for(const [node,type,callback] of listeners)node.removeEventListener(type,callback);
   disable();hideOriginal();message.textContent='Preparation panel closed. Any saved original remains retained.';
   // Do not dispose/reset the controller, delete storage, or cancel an original.
  };
 }
 return Object.freeze({mountSameOriginalRecoveryPanel});
});
