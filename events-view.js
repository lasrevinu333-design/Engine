(function(root){
'use strict';
const API='https://memphis-zoo-mcp.onrender.com', SCHEMA='custodial.events-feed.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nativeRequired=new WeakSet();
function isNative(w){
 if(nativeRequired.has(w))return true;
 let required=false;
 try{required=w.MemphisCustodialSecurity?.native===true||w.MemphisMobile?.edition==='custodial'
  ||w.MemphisMobileBuildIdentity?.edition==='custodial'||w.Capacitor?.isNativePlatform?.()===true
  ||['android','ios'].includes(w.Capacitor?.getPlatform?.());}catch{required=true;}
 if(required)nativeRequired.add(w);return required;
}
const same=(a,b)=>!!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);
const SCHOOL_SCHEMA='custodial.school-visitor-load-display.v1';
const SCHOOL_KEYS=['id','name','date','arrival_at','departure_at','departure_source','status',
 'students','chaperones','teachers','adults','unclassified','total','buses','notes'];
function schoolSnapshot(value){
 const unavailable=()=>({schema:SCHOOL_SCHEMA,state:'unavailable',coverage:'imported_only',
  mailbox_completeness_verified:false,generated_at:null,source_latest_at:null,rows:[]});
 try{
  const keys=['schema','state','coverage','mailbox_completeness_verified','generated_at','source_latest_at','rows'];
  const exact=(v,k)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
  const at=v=>typeof v==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
  const count=v=>Number.isSafeInteger(v)&&v>=0;
  if(!exact(value,keys)||value.schema!==SCHOOL_SCHEMA||value.coverage!=='imported_only'
   ||value.mailbox_completeness_verified!==false||!Array.isArray(value.rows)||value.rows.length>10000)return unavailable();
  if(value.state==='unavailable')return unavailable();
  if(value.state!=='snapshot'||!at(value.generated_at)||!at(value.source_latest_at))return unavailable();
  const ids=new Set(),rows=[];
  for(const r of value.rows){
   if(!exact(r,SCHOOL_KEYS)||!/^school:[a-f0-9]{64}$/.test(r.id||'')||ids.has(r.id)
    ||typeof r.name!=='string'||!r.name.trim()||r.name.length>240||/[\u0000-\u001f\u007f]/.test(r.name)
    ||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)
    ||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date
    ||!(r.arrival_at===null||at(r.arrival_at))||r.departure_at!==null||r.departure_source!==null
    ||!['SCHEDULED','CANCELLED','SUPERSEDED'].includes(r.status)||r.notes!==null
    ||!['students','chaperones','teachers','adults','unclassified','total'].every(k=>count(r[k]))
    ||r.adults!==r.chaperones+r.teachers||!count(r.students+r.adults+r.unclassified)
    ||r.total!==r.students+r.adults+r.unclassified||!(r.buses===null||count(r.buses)))return unavailable();
   ids.add(r.id);rows.push(Object.fromEntries(SCHOOL_KEYS.map(k=>[k,r[k]])));
  }
  return {schema:SCHOOL_SCHEMA,state:'snapshot',coverage:'imported_only',mailbox_completeness_verified:false,
   generated_at:value.generated_at,source_latest_at:value.source_latest_at,rows};
 }catch{return unavailable();}
}
function validate(payload){
 const f=payload?.feed;
 if(payload?.ok!==true||f?.schema!==SCHEMA||f.timezone!=='America/Chicago'||f.source!=='events_app_events'
  ||!['snapshot','current'].includes(f.state)||!Number.isFinite(Date.parse(f.generated_at))||!Array.isArray(f.rows)||f.rows.length>500)
  throw Error('events_contract_unavailable');
 if(f.state==='current'&&(f.mailbox_completeness_verified!==true||!Number.isFinite(Date.parse(f.source_checked_at))))throw Error('events_freshness_unverified');
 const ids=new Set();for(const r of f.rows){if(!r||!UUID.test(r.id||'')||!Number.isSafeInteger(r.revision)||r.revision<1
  ||ids.has(r.id.toLowerCase())||r.timezone!=='America/Chicago')throw Error('events_identity_invalid');ids.add(r.id.toLowerCase());}
 return {...f,schools:schoolSnapshot(f.schools)};
}
function principal(w,now=Date.now(),allowExpired=false){
 if(isNative(w)){
  try{
   const security=w.MemphisCustodialSecurity,mobile=w.MemphisMobile,s=security?.getStatus?.();
   const p=mobile?.readCustodialHomeCache?.()?.profile,e=p?.employee_id;
   if(security?.native!==true||s?.state!=='enrolled'||s.ready!==true||s.available!==true||s.quarantined||!s.deviceId
    ||!Number.isSafeInteger(s.generation)||s.generation<1||!UUID.test(e||'')
    ||!UUID.test(p?.credential_id||'')||!Number.isSafeInteger(p?.assignment_epoch)||p.assignment_epoch<1
    ||typeof mobile?.principalIdentity!=='function'||typeof mobile?.profileMatchesPrincipal!=='function')return null;
   const binding=mobile.principalIdentity();
   if(typeof binding!=='string'||!binding||mobile.profileMatchesPrincipal(p)!==true)return null;
   const after=security.getStatus();
   if(after?.generation!==s.generation||after.ready!==true||after.available!==true||after.quarantined
    ||String(after.deviceId).toUpperCase()!==String(s.deviceId).toUpperCase()||mobile.principalIdentity()!==binding)return null;
   // Status refresh is not a new employee. The immutable native journal binds
   // identity across same-install reloads, while reassignment/re-enrollment
   // changes the binding and cannot reuse the previous employee's cache.
   return{kind:'employee',device:String(s.deviceId).toUpperCase(),employee:e.toLowerCase(),
    assignment_epoch:p.assignment_epoch,credential_id:p.credential_id.toLowerCase(),protected_principal:binding};
  }catch{return null;}
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
  const v=data.events(feed.rows,now()),school=data.schools(feed.schools,now()),key=JSON.stringify({events:v,schools:school});if(!force&&key===fingerprint)return;
  fingerprint=key;const top=content.scrollTop,opened=content.querySelector('details')?.open===true;
  const card=c=>{const a=node('article',null,'boardCard');a.dataset.state=c.state;a.dataset.eventId=c.id;a.dataset.revision=String(c.revision);
   a.append(node('span','Event','sourceTag'),node('h3',c.title));for(const line of c.lines)a.append(node('p',line));return a;};
  const nodes=v.cards.length?v.cards.map(card):[node('p','No upcoming events in the retrieved event records.','boardCard')];
  if(v.history?.length){const h=node('details');h.open=opened;h.append(node('summary',`Event history · ${v.history.length} records (not active)`),...v.history.map(card));nodes.push(h);}
  const section=node('section',null,'visitorLoadSection');section.dataset.section='visitor-load';
  section.append(node('h2','Visitor load / Group arrivals'),node('p',school.note,'boardNote'));
  const schoolCard=c=>{const a=node('article',null,'boardCard');a.dataset.state=c.state;a.dataset.schoolId=c.id;
   a.append(node('span','Visitor load','sourceTag'),node('h3',c.title));for(const line of c.lines)a.append(node('p',line));return a;};
  section.append(...(school.cards.length?school.cards.map(schoolCard):[node('p',feed.schools.state==='snapshot'?'No active visitor-load rows for today in this imported snapshot.':'Visitor-load information is unavailable.','boardCard')]));
  if(school.history?.length){const h=node('details');h.append(node('summary',`Visit history · ${school.history.length} records (not active)`),...school.history.map(schoolCard));section.append(h);}
  nodes.push(section);
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
  try{
   // Generation fences this one save, not the persistent employee cache key.
   // Capture owner/methods/raw bytes BEFORE any protected FIFO await.
   const security=w.MemphisCustodialSecurity,mobile=w.MemphisMobile,writer=security?.mutateProtectedWork,reader=security?.getStatus;
   const identityReader=mobile?.principalIdentity,profileReader=mobile?.readCustodialHomeCache,matcher=mobile?.profileMatchesPrincipal;
   if(security?.native!==true||typeof writer!=='function'||typeof reader!=='function'
    ||typeof identityReader!=='function'||typeof profileReader!=='function'||typeof matcher!=='function')throw Error('events_save_unavailable');
   const generation=reader.call(security)?.generation,key='mz_employee_events_snapshot:'+p.device,raw=w.localStorage.getItem(key),attempt=seq;
   if(!Number.isSafeInteger(generation)||generation<1||(raw!==null&&typeof raw!=='string'))throw Error('events_save_unavailable');
   const value=JSON.stringify({schema_version:'shared-events-snapshot.v2',owner:p,saved_at:new Date(now()).toISOString(),feed:next});
   const requireOriginal=expected=>{
    if(!active||closed||seq!==attempt||!same(owner,p)||!isNative(w)
     ||w.MemphisCustodialSecurity!==security||w.MemphisMobile!==mobile||security.native!==true
     ||security.mutateProtectedWork!==writer||security.getStatus!==reader||mobile.principalIdentity!==identityReader
     ||mobile.readCustodialHomeCache!==profileReader||mobile.profileMatchesPrincipal!==matcher)throw Error('identity_changed');
    const s=reader.call(security);
    if(s?.state!=='enrolled'||s.ready!==true||s.available!==true||s.quarantined!==false||s.generation!==generation
     ||String(s.deviceId).toUpperCase()!==p.device||identityReader.call(mobile)!==p.protected_principal
     ||!same(p,read())||w.localStorage.getItem(key)!==expected)throw Error('identity_changed');
   };
   const checkpoint=(context,expected)=>{
    if(typeof context?.assertCurrent!=='function'||context.generation!==generation||context.deviceId!==p.device)throw Error('identity_changed');
    context.assertCurrent();requireOriginal(expected);context.assertCurrent();
   };
   requireOriginal(raw);let written=false;
   const result=await writer.call(security,context=>{
    checkpoint(context,raw);
    if(value!==raw)w.localStorage.setItem(key,value);
    checkpoint(context,value);written=true;return true;
   },{requireEnrollment:true,expectedGeneration:generation});
   if(result!==true||!written)return false;
   requireOriginal(value);return true;
  }catch{return false;}}
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
