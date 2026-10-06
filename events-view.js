(function(root){
'use strict';
const API='https://memphis-zoo-mcp.onrender.com', SCHEMA='custodial.events-feed.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isNative=w=>w.MemphisCustodialSecurity?.native===true||w.MemphisMobile?.edition==='custodial'||w.MemphisMobileBuildIdentity?.edition==='custodial';
const same=(a,b)=>!!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);
function validate(payload){
 const f=payload?.feed;
 if(payload?.ok!==true||f?.schema!==SCHEMA||f.timezone!=='America/Chicago'||f.source!=='events_app_events'
  ||!['snapshot','current'].includes(f.state)||!Number.isFinite(Date.parse(f.generated_at))||!Array.isArray(f.rows)||f.rows.length>500)
  throw Error('events_contract_unavailable');
 if(f.state==='current'&&(f.mailbox_completeness_verified!==true||!Number.isFinite(Date.parse(f.source_checked_at))))throw Error('events_freshness_unverified');
 const ids=new Set();for(const r of f.rows){if(!r||!UUID.test(r.id||'')||!Number.isSafeInteger(r.revision)||r.revision<1
  ||ids.has(r.id.toLowerCase())||r.timezone!=='America/Chicago')throw Error('events_identity_invalid');ids.add(r.id.toLowerCase());}
 return f;
}
function principal(w,now=Date.now(),allowExpired=false){
 if(isNative(w)){
  const s=w.MemphisCustodialSecurity?.getStatus?.(),p=w.MemphisMobile?.readCustodialHomeCache?.()?.profile;
  const e=p?.employee_id||p?.assigned_employee_id||p?.employee?.id;
  if(s?.state!=='enrolled'||s.ready!==true||s.available!==true||s.quarantined||!s.deviceId
   ||!Number.isSafeInteger(s.generation)||s.generation<1||!UUID.test(e||''))return null;
  return{kind:'employee',device:String(s.deviceId).toUpperCase(),employee:e.toLowerCase(),generation:s.generation,
   assignment_epoch:p.assignment_epoch??null,credential_id:p.credential_id??null};
 }
 const s=w.MemphisAuth?.readSession?.();
 if(s?.role!=='ops_manager'||!UUID.test(s.manager_id||'')||!s.credential_id||!s.token||!Number.isFinite(Date.parse(s.expires_at))||(!allowExpired&&!(Date.parse(s.expires_at)>now)))return null;
 return{kind:'manager',manager:s.manager_id,credential:s.credential_id,device:s.device_id||''};
}
function returnTarget(w,p){
 const employee=p?.kind==='employee'||isNative(w),u=new URL(employee?'./index.html':'./operations-dashboard.html',w.location.href);
 // Native Home obtains identity from enrollment, never a navigation selector.
 if(!employee){u.searchParams.set('hub','manager');if(p?.device)u.searchParams.set('device',p.device);}
 return u.toString();
}
function create({window:w=root,document:d=w.document,fetchImpl=(...a)=>w.fetch(...a),now=()=>Date.now()}={}){
 const el=id=>d.getElementById(id),page=el('shared-events-page'),content=el('events-content'),status=el('events-status'),data=w.MemphisOperationsData;
 if(!page||!content||!status||!data)throw Error('events_view_missing');
 const listeners=[],listen=(target,type,fn,options)=>{target?.addEventListener?.(type,fn,options);listeners.push([target,type,fn,options]);};
 const motion=w.matchMedia?.('(prefers-reduced-motion: reduce)');
 let owner=null,active=false,closed=false,initializing=false,seq=0,controller=null,deadline=null,feed=null,stale=false,lastAttempt=-Infinity;
 let poll=null,guard=null,frame=null,lastFrame=null,fingerprint='',lastMinute=null,paused=motion?.matches===true,hover=false,fsSeq=0;
 const read=()=>principal(w,now(),true);
 const message=(text,old=false)=>{status.textContent=text;page.dataset.stale=String(old);};
 const pauseLabel=()=>{el('events-pause').textContent=paused?'Resume scrolling':'Pause scrolling';el('events-pause').setAttribute('aria-pressed',String(paused));};
 const node=(tag,text,cls)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function cancel(){seq++;controller?.abort();controller=null;if(deadline!==null)w.clearTimeout(deadline);deadline=null;}
 function halt(){active=false;initializing=false;cancel();fsSeq++;for(const id of[poll,guard])if(id!==null)w.clearInterval(id);poll=guard=null;
  if(frame!==null)w.cancelAnimationFrame(frame);frame=null;lastFrame=null;}
 function deny(){halt();owner=null;feed=null;content.replaceChildren();fingerprint='';page.dataset.denied='true';
  message(isNative(w)?'This phone needs a manager. Saved work has not been erased.':'Access changed. Return to the map and sign in again.');}
 function current(renewing=false){const p=read();if(same(owner,p))return true;if(renewing&&owner?.kind==='manager'&&!p)return true;deny();return false;}
 function render(force=false){
  if(!active||!owner||!current()||!feed)return;
  const v=data.events(feed.rows,now()),key=JSON.stringify(v);if(!force&&key===fingerprint)return;
  fingerprint=key;const top=content.scrollTop,opened=content.querySelector('details')?.open===true;
  const card=c=>{const a=node('article',null,'boardCard');a.dataset.state=c.state;a.dataset.eventId=c.id;a.dataset.revision=String(c.revision);
   a.append(node('span','Event','sourceTag'),node('h3',c.title));for(const line of c.lines)a.append(node('p',line));return a;};
  const nodes=v.cards.length?v.cards.map(card):[node('p','No upcoming events in the retrieved event records.','boardCard')];
  if(v.history?.length){const h=node('details');h.open=opened;h.append(node('summary',`Event history · ${v.history.length} records (not active)`),...v.history.map(card));nodes.push(h);}
  content.replaceChildren(...nodes);content.scrollTop=top;
 }
 function feedMessage(){const t=new Intl.DateTimeFormat('en-US',{timeZone:data.ZONE,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(feed.generated_at));
  message(`${stale?'Current connection unavailable — showing saved information':'Event records checked'} · ${t} Central. ${feed.mailbox_completeness_verified===true?'Outlook source checked.':'Outlook collection completeness is not verified.'}`,stale);}
 function snapshot(){if(owner?.kind!=='employee')return null;
  try{const r=JSON.parse(w.localStorage.getItem('mz_employee_events_snapshot:'+owner.device)||'null'),age=now()-Date.parse(r?.saved_at);
   if(r?.schema_version!=='shared-events-snapshot.v2'||!same(r.owner,owner)||!Number.isFinite(age)||age<0||age>86400000)return null;
   return validate({ok:true,feed:r.feed});}catch{return null;}}
 function checkResponseIdentity(meta,p){
  if(p.kind==='manager')return meta?.manager_id===p.manager&&meta?.credential_id===p.credential;
  return String(meta?.canonical_device_id||'').toUpperCase()===p.device&&String(meta?.employee_id||'').toLowerCase()===p.employee
   &&UUID.test(meta?.credential_id||'')&&Number.isSafeInteger(meta?.assignment_epoch)&&meta.assignment_epoch>=1
   &&(p.assignment_epoch===null||p.assignment_epoch===meta.assignment_epoch)
   &&(p.credential_id===null||p.credential_id===meta.credential_id);
 }
 async function save(next,p){if(p.kind!=='employee')return true;
  const value=JSON.stringify({schema_version:'shared-events-snapshot.v2',owner:p,saved_at:new Date(now()).toISOString(),feed:next});
  try{await w.MemphisCustodialSecurity.mutateProtectedWork(()=>{if(!same(p,read()))throw Error('identity_changed');
   const key='mz_employee_events_snapshot:'+p.device;w.localStorage.setItem(key,value);if(w.localStorage.getItem(key)!==value)throw Error('cache_failed');});return true;}catch{return false;}}
 function bounded(promise,signal){
  if(signal.aborted)return Promise.reject(signal.reason||Error('events_refresh_cancelled'));
  return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason||Error('events_refresh_cancelled'));
   signal.addEventListener('abort',abort,{once:true});
   Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
 }
 async function refresh(){
  if(!active||closed||d.hidden||!owner||!current(true))return false;
  cancel();lastAttempt=now();const attempt=seq,p=owner,abort=new AbortController();controller=abort;
  deadline=w.setTimeout(()=>abort.abort(),10000);
  const valid=()=>active&&!closed&&seq===attempt&&current()&&!abort.signal.aborted;
  async function request(force=false){
   const employee=p.kind==='employee';let headers={};
   if(!employee){
    const session=await bounded(w.MemphisAuth.requireOpsManagerSession({interactive:false,redirect:false,throwOnFailure:true,forceRefresh:force}),abort.signal);
    if(!valid())return null;
    if(!session?.token||Date.parse(session.expires_at)<=now()){deny();return null;}
    headers={Authorization:`Bearer ${session.token}`,'X-Device-Id':p.device};
   }
   if(!valid())return null;
   return fetchImpl(API+(employee?'/employee-events-api':'/dashboard-api/events-feed'),{method:'GET',cache:'no-store',redirect:'error',headers,signal:abort.signal});
  }
  try{
   let r=await request();if(!r||!valid())return false;
   if(r.status===401&&p.kind==='manager'&&!w.MemphisMobile?.handlesManagerAuthenticationRetry){r=await request(true);if(!r||!valid())return false;}
   if([401,403].includes(r.status)){deny();return false;}
   if(!r.ok)throw Error('events_unavailable');const payload=await r.json();
   if(!valid())return false;
   const next=validate(payload);if(!checkResponseIdentity(payload.meta,p)){deny();return false;}
   const saved=await save(next,p);if(!valid())return false;
   feed=next;stale=false;render();feedMessage();if(!saved)message(status.textContent+' Offline saving failed.');return true;
  }catch(error){
   if(!active||closed||seq!==attempt||!current(true))return false;
   if([401,403].includes(error?.status)){deny();return false;}
   if(p.kind==='manager'&&!principal(w,now())){
    content.replaceChildren();fingerprint='';message('Sign-in could not refresh. Retrying without changing your account.',true);return false;
   }
   feed=feed||snapshot();stale=true;if(feed){render();feedMessage();}else{content.replaceChildren();fingerprint='';message('Events could not update. No verified event list is available.',true);}return false;
  }finally{if(seq===attempt){if(deadline!==null)w.clearTimeout(deadline);deadline=null;controller=null;}}
 }

 function animate(time){frame=null;if(!active||closed)return;const dt=lastFrame===null?0:Math.min(100,Math.max(0,time-lastFrame));lastFrame=time;
  if(owner&&!paused&&!hover&&!motion?.matches&&!d.hidden){const bottom=Math.max(0,content.scrollHeight-content.clientHeight),speed=Number(el('events-speed').value);
   if(bottom>0&&[18,32,48].includes(speed))content.scrollTop=content.scrollTop>=bottom-1?0:Math.min(bottom,content.scrollTop+speed*dt/1000);}
  frame=w.requestAnimationFrame(animate);}
 async function init(){if(closed||active||initializing)return false;initializing=true;const attempt=++seq;
  try{if(isNative(w))await(w.MemphisMobile?.ready||w.MemphisCustodialSecurity?.ready);
   else await w.MemphisAuth?.requireOpsManagerSession?.({interactive:false,redirect:false});
   if(closed||seq!==attempt)return false;const p=read();if(!p||(owner&&!same(owner,p))){deny();return false;}
   owner=p;active=true;page.dataset.denied='false';d.body.dataset.memphisContext=p.kind;
   el('events-back').textContent=p.kind==='employee'?'Back to Home':'Back to Map';pauseLabel();
   poll=w.setInterval(()=>void refresh(),30000);guard=w.setInterval(()=>{
    if(owner?.kind==='manager'&&!principal(w,now())){content.replaceChildren();fingerprint='';if(controller===null&&now()-lastAttempt>=30000)void refresh();return;}
    if(!current())return;
    // Re-evaluate expiration even offline and while scrolling is paused.
    render();
   },1000);
   frame=w.requestAnimationFrame(animate);await refresh();return true;
  }catch{if(seq===attempt)deny();return false;}finally{initializing=false;}}
 function stop(){if(closed)return;halt();closed=true;owner=null;feed=null;content.replaceChildren();for(const[t,e,fn,o]of listeners)t?.removeEventListener?.(e,fn,o);listeners.length=0;}
 listen(el('events-back'),'click',()=>w.location.assign(returnTarget(w,owner)));
 listen(el('events-pause'),'click',()=>{paused=!paused;pauseLabel();});
 for(const e of['wheel','touchstart','focusin','keydown'])listen(content,e,()=>{paused=true;pauseLabel();},{passive:true});
 listen(content,'mouseenter',()=>{hover=true;});listen(content,'mouseleave',()=>{hover=false;});
 listen(motion,'change',()=>{if(motion.matches){paused=true;pauseLabel();}});
 listen(el('events-fullscreen'),'click',async()=>{if(!active||!current())return;const expected=++fsSeq;
  try{if(d.fullscreenElement===page)await d.exitFullscreen();else{if(!page.requestFullscreen)throw Error('unavailable');await page.requestFullscreen();}
   if((!active||closed||expected!==fsSeq)&&d.fullscreenElement===page)await d.exitFullscreen?.();}
  catch{if(active&&!closed&&expected===fsSeq)message('Events fill this window; native full-screen control is unavailable.');}});
 listen(w,'online',()=>void refresh());listen(w,'memphis:native-notification-received',()=>void refresh());
 listen(w,'offline',()=>{cancel();if(owner&&current()){feed=feed||snapshot();stale=true;if(feed){render();feedMessage();}else message('Offline. No saved event list is available.',true);}});
 listen(w,'memphis:custodial-security-state',()=>{if(owner&&!same(owner,read()))deny();});
 listen(d,'visibilitychange',()=>{if(d.hidden)cancel();else void refresh();});
 listen(w,'pagehide',e=>{if(e.persisted){halt();content.replaceChildren();fingerprint='';}else stop();});
 listen(w,'pageshow',e=>{if(e.persisted&&!closed)void init();});
 listen(d,'keydown',e=>{if(e.key==='Escape'&&!d.fullscreenElement){e.preventDefault();w.location.assign(returnTarget(w,owner));}});
 return Object.freeze({init,refresh,stop,render});
}
const api=Object.freeze({create,validate,principal,returnTarget,SCHEMA});root.MemphisSharedEvents=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document?.getElementById('shared-events-page'))void create().init();
})(typeof globalThis!=='undefined'?globalThis:this);
