const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const valid=value=>value&&Object.keys(value).sort().join(',')==='notice_id,operation_id,reason'
 &&uuid(value.notice_id)&&uuid(value.operation_id)&&typeof value.reason==='string'
 &&value.reason===value.reason.trim()&&value.reason.length>0&&value.reason.length<=1000;
const same=(a,b)=>valid(a)&&valid(b)&&a.notice_id===b.notice_id&&a.operation_id===b.operation_id&&a.reason===b.reason;

// Manager operation data only: no bearer token, credential secret or new authority.
// The origin lock covers durable read/write AND the original request/readback.
export function createUnfinishedWorkJournal({storage,locks}){
 return {run(owner,action){
  if(typeof owner!=='string'||!owner||!storage||typeof locks?.request!=='function')throw Error('Saved clear storage unavailable.');
  const key='mz_unfinished_clear:v1:'+encodeURIComponent(owner);
  return locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock)throw Error('Another tab is checking the original clear.');
   const read=()=>{const raw=storage.getItem(key);if(raw===null)return null;
    const value=JSON.parse(raw);if(!valid(value))throw Error('Saved original clear is invalid.');return value;};
   return action({read,write(value){
    if(!valid(value))throw Error('Invalid original clear.');
    const prior=read();if(prior&&!same(prior,value))throw Error('A different original is still saved.');
    const raw=JSON.stringify(value);storage.setItem(key,raw);
    if(storage.getItem(key)!==raw)throw Error('Original clear was not saved.');
   },remove(value){
    if(!same(read(),value))throw Error('Original clear changed.');
    storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Original clear is still saved.');
   }});
  });
 }};
}

export function createUnfinishedWorkPanel({document,content,status,api,binding,storageBinding=binding,journal,operationId=()=>crypto.randomUUID()}){
 let generation=0,owner=null,scope=null,pending=null,busy=false,retryAllowed=false,attempted=false;
 const current=()=>owner!==null&&owner===binding()&&scope===storageBinding();
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const button=(label,action)=>{const b=node('button',label);b.type='button';b.className='uxButton';b.addEventListener('click',()=>{void action();});return b;};
 const deny=()=>{generation++;busy=false;retryAllowed=false;content.replaceChildren();status.textContent='Manager access changed. Recheck access before continuing.';};
 const owns=at=>at===generation&&current();
 function receipt(v,original){if(!v||v.notice_id!==original.notice_id||v.operation_id!==original.operation_id||v.history_preserved!==true||v.phone_released!==false||v.key_removal!==false||!['cancelled_without_completion','already_terminal_acknowledged'].includes(v.status))throw Error('Matching saved outcome unavailable.');}
 function unknown(){content.replaceChildren(node('p','The clear outcome is not confirmed. Check the original saved operation before another action.'),
  ...(!busy?[...(attempted?[button('Check original clear',check)]:[button('Cancel preview',cancel)]),...(retryAllowed?[button('Retry this exact clear',retry)]:[])]:[]));
  status.textContent=busy?'Checking the original clear…':'Clear needs confirmation. Original work and history remain protected.';}
 async function finish(v,original,port,at){
  receipt(v,original);if(!owns(at))return false;
  port.remove(original);pending=null;attempted=false;return true;
 }
 async function act(kind){
  if(!pending||busy||kind==='clear'&&!retryAllowed)return;
  const original={...pending},wasAttempted=attempted,at=++generation;
  busy=true;retryAllowed=false;unknown();let completed=false;
  try{
   if(!current())return deny();
   await journal.run(scope,async port=>{
    if(!owns(at))return;
    const saved=port.read();
    if(saved&&!same(saved,original)){pending=saved;attempted=true;return;}
    if(wasAttempted&&!same(saved,original)&&kind==='clear')throw Error('Original clear storage changed.');
    if(kind==='clear'){
     // Mark attempted before saving: even a partial storage failure cannot
     // make Cancel discard an operation that may have reached storage.
     attempted=true;port.write(original);
     if(!owns(at))return;
     const value=await api.clear(original.notice_id,original.operation_id,original.reason);
     if(owns(at))completed=await finish(value,original,port,at);
    }else{
     if(!saved)port.write(original);
     const value=await api.outcome(original.notice_id,original.operation_id);
     if(!owns(at))return;
     if(value?.found===true)completed=await finish(value,original,port,at);
     else if(value?.found===false&&value.notice_id===original.notice_id&&value.operation_id===original.operation_id)retryAllowed=true;
     else throw Error('Original outcome unavailable.');
    }
   });
  }catch{ /* Keep the exact original and require readback; never invent success. */ }
  finally{if(at===generation)busy=false;}
  if(at!==generation)return;
  if(!current())return deny();
  if(completed){if(await load())status.textContent='The original clear was confirmed. History is preserved; no cleaning completion was recorded.';}
  else {unknown();if(retryAllowed)status.textContent='The original clear was not found. You may retry this same saved operation.';}
 }
 const check=()=>act('outcome'),retry=()=>act('clear');
 async function cancel(){if(busy||attempted||!pending)return;if(!current())return deny();pending=null;retryAllowed=false;await load();}
 async function select(item){
  if(pending||busy||!current())return;const at=generation;
  const reason=node('textarea','');reason.maxLength=1000;reason.setAttribute('aria-label','Reason for clearing unfinished work');
  content.replaceChildren(node('h2',item.location),node('p',item.employee),node('p','Clear this unfinished work without recording a completed cleaning. Original records, actor history and recovery keys stay preserved.'),reason,
   button('Preview clear',async()=>{
    if(!owns(at)||pending||busy)return;
    const text=reason.value?.trim();if(!text||text.length>1000){status.textContent='Enter a reason for this clear.';return;}
    const id=operationId();if(!uuid(id)){status.textContent='This clear could not be prepared. Refresh to try again.';return;}
    pending={notice_id:item.notice_id,operation_id:id,reason:text};attempted=false;retryAllowed=true;
    content.replaceChildren(node('h2','Confirm this original work'),node('p',item.location+' · '+item.employee),node('p',text),button('Confirm clear',retry),button('Cancel preview',cancel));
    status.textContent='Review this work and reason, then explicitly confirm.';
   }),button('Back',load));
 }
 async function load(){
  if(busy)return false;
  if(pending&&!attempted){if(current())return false;return deny();}
  owner=binding();scope=storageBinding();if(!owner||!scope)return deny();
  const at=++generation;busy=true;retryAllowed=false;content.replaceChildren();status.textContent='Checking unfinished work…';
  try{
   await journal.run(scope,port=>{if(!owns(at))return;const saved=port.read();
    if(pending&&!saved)throw Error('Original clear storage changed.');pending=saved;attempted=!!saved;});
   if(!owns(at))return false;
   if(pending){busy=false;unknown();return false;}
   const v=await api.list();if(!owns(at))return false;
   if(!v||!Array.isArray(v.items)||v.items.length>100||typeof v.truncated!=='boolean'||v.items.some(x=>!uuid(x.notice_id)||x.attention_required!==true||typeof x.location!=='string'||typeof x.employee!=='string'||!Number.isFinite(Date.parse(x.deadline_at))))throw Error();
   const cards=v.items.map(item=>{const card=node('article','');card.className='uxCard';card.append(node('h2',item.location),node('p',item.employee),node('p','Needs attention since '+new Date(item.deadline_at).toLocaleString('en-US',{timeZone:'America/Chicago'})),button('Review and clear',()=>select(item)));return card;});
   content.replaceChildren(...cards);status.textContent=v.truncated?'More than100 records need attention. Clear reviewed entries, then refresh.':v.items.length+' unfinished work item(s) need your attention.';return true;
  }catch{if(owns(at)){content.replaceChildren();status.textContent='Unfinished work or its saved clear could not be checked. Refresh to try again.';}return false;}
  finally{if(at===generation){busy=false;if(!current())deny();}}
 }
 return {load,check,retry,hasUnresolved:()=>pending!==null,revalidate(){if(owner&&!current())deny();},retire:deny,getPending:()=>pending?{...pending}:null};
}
