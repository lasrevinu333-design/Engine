// DOM-only manager surface. Main mounts the authenticated client separately.
// Nothing in this panel calls native removal, finalization, replay or URLs.
export function mountInventorySeparationPanel(root,{client}={}){
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const doc=root?.ownerDocument;
 if(!doc||typeof doc.createElement!=='function'||typeof root.appendChild!=='function'
  ||!client||!['open','confirm','recoverOriginalStatus','getState','subscribe','close'].every(k=>typeof client[k]==='function'))
  throw new TypeError('Inventory separation panel ports unavailable');
 const section=doc.createElement('section');section.setAttribute('aria-label','Exact original inventory logical separation');
 const make=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;section.appendChild(n);return n;};
 make('h2','Review retained original inventory');
 make('p','Keep ALL original work and keys. Logical separation is NOT phone release, history deletion, work acceptance or replay.');
 const label=make('label','Original native request UUID');
 const input=doc.createElement('input');input.type='text';input.autocomplete='off';input.spellcheck=false;label.appendChild(input);
 const review=make('button','Review exact original');review.type='button';
 const summary=make('pre');summary.setAttribute('aria-label','Complete original inventory summary');
 const confirmation=make('p','Explicit confirmation: record inventory ACK and logical separation for ONLY this reviewed original. Keep every original work record and key. No phone release, history deletion, work acceptance or replay.');
 const confirm=make('button','Confirm exact-original logical separation');confirm.type='button';
 // Visible confirmation is adjacent and remains text, never arbitrary HTML.
 confirmation.setAttribute('role','note');
 const status=make('button','Check original outcome (no resend)');status.type='button';
 const message=make('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const reported=make('pre');reported.setAttribute('aria-label','Server-reported receipt DATA');
 root.appendChild(section);let alive=true,pending=false;
 const methods=Object.fromEntries(['open','confirm','recoverOriginalStatus','getState','subscribe','close'].map(k=>[k,client[k]]));
 const cleanups=[];
 function current(){return alive&&Object.keys(methods).every(k=>client[k]===methods[k]);}
 function disable(){for(const n of [input,review,confirm,status])n.disabled=true;}
 function render(){
  if(!current()){disable();summary.textContent='';reported.textContent='';message.textContent='Panel unavailable. All originals remain retained.';return;}
  const s=methods.getState.call(client),v=s.review;
  input.disabled=pending||s.busy||s.original_request!==null||['CLOSED','UNAVAILABLE','HELD'].includes(s.state);
  review.disabled=input.disabled;
  confirm.disabled=pending||!s.can_confirm||!v||input.value!==v.native_request_id;
  status.disabled=pending||!s.can_recover_original_status;
  if(s.original_request)input.value=s.original_request.native_request_id;
  summary.textContent=v?[
   'Employee: '+v.original_employee_label,
   'Device: '+v.original_device_label+' ('+v.original_target.canonical_device_id+')',
   'Exact original operation: '+v.original_target.operation_id,
   'Original generation: '+v.original_target.original_generation_id,
   'Native request: '+v.native_request_id,
   ...v.native_namespaces.map(n=>n.namespace+': '+n.record_count+' total; '+n.accepted_exact_original_count+' accepted exact original; '+n.unresolved_retained_count+' unresolved RETAINED'),
   'Browser: '+v.browser_summary.declared_domains+' domains; '+v.browser_summary.record_count+' total; '+v.browser_summary.accepted_exact_original_count+' accepted exact original; '+v.browser_summary.unresolved_retained_count+' unresolved RETAINED',
   'Retained key families: '+v.retained_key_family_count+' (keep ALL keys)',
   'Registration receipt SHA256: '+v.registration_receipt_sha256,
   'Inventory manifest SHA256: '+v.inventory_manifest_sha256,
   'Review SHA256: '+v.review_sha256,
   'Browser frame / part set: '+v.browser_summary.frame_sha256+' / '+v.browser_summary.part_set_sha256,
   'Review expiry (server DATA): '+v.expires_at
  ].join('\n'):'';
  const texts={IDLE:'Enter the exact original native request, then explicitly review.',
   OPENING:'Opening exact original review or retained original. No approval is automatic.',
   REVIEW_ONLY:'Read-only review. Confirm is available only to the same current full-write manager and session.',
   RETAINING_UNKNOWN:'Retaining original UNKNOWN before any approval POST. Do not repeat.',
   UNKNOWN:'Outcome UNKNOWN. Keep originals and keys. Check only this original outcome; never resend.',
   SERVER_REPORTED_RECORDED:'Server-reported DATA: inventory ACK and logical separation ONLY. This panel grants no native authority and performs no finalizer/key action.',
   HELD:'Action held or owner withdrawn. Originals remain retained. No inferred permission or retry.',
   CLOSED:'Closed. Originals remain retained.',UNAVAILABLE:'Required original storage, locks or authenticated ports unavailable.'};
  message.textContent=texts[s.state]||'Unavailable. Originals remain retained.';
  reported.textContent=s.receipt?'Server-reported receipt DATA\nApproval: '+s.receipt.approval_id+'\nReceipt SHA256: '+s.receipt.receipt_sha256+
   '\nNo work acceptance, replay, key removal or phone release. No finalizer is invoked by this panel.':'';
 }
 async function action(kind){
  if(!current()||pending)return;render();
  const button=kind==='open'?review:kind==='confirm'?confirm:status;if(button.disabled)return;
  const entered=input.value;
  if(kind==='open'&&(typeof entered!=='string'||entered.length!==36||!UUID.test(entered))){
   message.textContent='Enter the exact canonical original native request UUID. No request was sent.';return;
  }
  pending=true;render();
  try{if(!current())return;await methods[kind].call(client,...(kind==='open'?[entered]:[]));}
  catch{if(current())message.textContent='Action unconfirmed. Keep original data; no resend.';}
  finally{pending=false;if(current())render();}
 }
 function listen(n,type,fn){n.addEventListener(type,fn);cleanups.push(()=>n.removeEventListener(type,fn));}
 listen(review,'click',()=>{void action('open');});
 listen(confirm,'click',()=>{void action('confirm');});
 listen(status,'click',()=>{void action('recoverOriginalStatus');});
 listen(input,'input',render);listen(section,'focusin',render);listen(section,'pointerdown',render);
 const unsubscribe=methods.subscribe.call(client,render);render();
 return function unmount(){if(!alive)return;alive=false;for(const off of cleanups)off();unsubscribe();
  disable();methods.close.call(client);section.remove();};
}
