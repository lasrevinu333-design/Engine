import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import vm from 'node:vm';
import {createHash} from 'node:crypto';

// Native Source fixtures must cross the same real profile producer callback as
// the app. These recording response/status ports remain synthetic; no private
// WeakMap admission or public authenticated flag is injected by the fixture.
async function openChatProfileForSourceFixture(scope,mapped) {
 if(scope.EMPLOYEE_CONTEXT !== true || scope.window?.MemphisCustodialSecurity?.native !== true)return mapped;
 scope.identityRef ||= {current:mapped};scope.accessEpoch ||= {current:1};scope.mounted ||= {current:true};
 scope.currentDeviceId ||= mapped.canonical_device_id;scope.useCallback ||= fn=>fn;scope.setIdentity ||= ()=>{};
 const start=source.indexOf('  const loadIdentity = useCallback('),end=source.indexOf('\n  const loadThreads =',start);
 assert.ok(start>0&&end>start);const originalApi=scope.api;
 const profile={...mapped};delete profile.authenticated;
 scope.api=async path=>{assert.equal(path,'/me/by-device?device_id='+scope.currentDeviceId);return {ok:true,data:{...profile},meta:{fixture:true}};};
 try {
  vm.runInContext(source.slice(start,end)+'\nthis.openOriginalProfileFixture=loadIdentity;',scope);
  const produced=await scope.openOriginalProfileFixture();if(scope.state)scope.state.identity=produced;return produced;
 } catch(error) {
  if(!['messenger_original_owner_held','custodial_security_state_unavailable'].includes(error?.code))throw error;
  scope.originalProfileBirthError=error;return mapped;
 }
 finally {scope.api=originalApi;}
}

async function openLegacyProfileForSourceFixture(scope,mapped) {
 if(scope.state?.hub !== 'employee' || scope.window?.MemphisCustodialSecurity?.native !== true)return mapped;
 const legacy=readFileSync(join(root,'messages-app.js'),'utf8');
 const start=legacy.indexOf('  function originalEmployeeProfileRequestGuard('),end=legacy.indexOf('\n  async function loadThreads(',start);
 const roleStart=legacy.indexOf('  function roleTitle('),roleEnd=legacy.indexOf('\n  async function managerHeaders(',roleStart);
 const queryStart=legacy.indexOf('  function query('),queryEnd=legacy.indexOf('\n  function normalizeThread(',queryStart);
 assert.ok(start>0&&end>start&&roleStart>0&&queryStart>0);
 const originalApi=scope.api,originalQuery=scope.query;const profile={...mapped};delete profile.authenticated;
 scope.els ||= {};scope.els.identity ||= {textContent:''};scope.URLSearchParams=URLSearchParams;
 scope.api=async path=>{assert.equal(path,'/me/by-device?device_id='+scope.state.deviceId);return {ok:true,data:{...profile},meta:{fixture:true}};};
 try {
  vm.runInContext(legacy.slice(roleStart,roleEnd)+'\n'+legacy.slice(queryStart,queryEnd)+'\n'+legacy.slice(start,end)+'\nthis.openOriginalLegacyProfileFixture=loadIdentity;',scope);
  return await scope.openOriginalLegacyProfileFixture();
 } catch(error) {
  if(!['messenger_original_owner_held','custodial_security_state_unavailable'].includes(error?.code))throw error;
  scope.originalProfileBirthError=error;return mapped;
 } finally {scope.api=originalApi;if(originalQuery)scope.query=originalQuery;}
}

async function managerOutboxSessionCases(){
 const producerOnly=process.argv.includes('--manager-send-producer-only');
 const liveOnly=process.argv.includes('--manager-live-session-only');
 const destructiveOnly=process.argv.includes('--manager-destructive-session-only');
 const readOnly=process.argv.includes('--manager-read-session-only');
 const readerOnly=process.argv.includes('--manager-reader-session-only');
 const casePrefix=producerOnly?'--manager-send-producer-case=':liveOnly?'--manager-live-session-case=':destructiveOnly?'--manager-destructive-session-case=':readerOnly?'--manager-reader-session-case=':readOnly?'--manager-read-session-case=':'--manager-outbox-session-case=';
 const requested=process.argv.find(arg=>arg.startsWith(casePrefix))?.slice(casePrefix.length),completed=[];
 const retryStart=source.indexOf('  const retryOutbox = useCallback(() => {'),retryEnd=source.indexOf('\n  const discardMessageRecovery',retryStart);
 const readStart=source.indexOf('  const flushReadOutbox = useCallback('),readEnd=source.indexOf('\n  const loadMessages =',readStart);
 const identityStart=source.indexOf('  const loadIdentity = useCallback('),identityEnd=source.indexOf('\n  const flushReadOutbox =',identityStart);
 const messagesStart=source.indexOf('  const loadMessages = useCallback('),messagesEnd=source.indexOf('\n  const selectThread =',messagesStart);
 const destructiveStart=source.indexOf('  const discardMessageRecovery = useCallback('),destructiveEnd=source.indexOf('\n  useEffect',destructiveStart);
 const threadPollStart=source.indexOf('  useEffect(() => {\n    if (!identity?.msg_user_id) return undefined;\n    let stopped'),messagePollStart=source.indexOf('  useEffect(() => {\n    if (!identity?.msg_user_id || !selectedId) return undefined;'),pollEnd=source.indexOf('  useEffect(() => {\n    const withdraw =',messagePollStart);
 assert(threadPollStart>0&&messagePollStart>threadPollStart&&pollEnd>messagePollStart);
 function fixture({action='send',onApi,onRows,onPause,onMutation,onSettlement,onSet,onRemove,onAuth,onQueue,onConfirm,actualApi=false,error=null}={}){
  const producer=action==='producer-send'||action==='producer-compose';
  const destructive=action.startsWith('destructive-');
  const read=action==='read-flush'||action==='read-producer';
  const reader=action.startsWith('reader-')||producer;
  const live=action.startsWith('reader-live-');
  const saved=read?{schema_version:'chatscope-read-outbox.v2',id:U+':'+T,thread_id:T,user_id:U,device_id:entry.device_id,
   through_message_id:M,through_at:'2026-10-15T01:00:00Z',created_at:1,security_generation:null}:
   action==='send'||producer||action==='destructive-discard-message'?{...entry,security_generation:null}:{schema_version:'chatscope-delete-outbox.v2',id:M,thread_id:T,user_id:U,device_id:entry.device_id,created_at:1,security_generation:null};
  const key=read?'mz_chatscope_read_outbox:'+saved.id:action==='send'||producer||action==='destructive-discard-message'?'mz_chatscope_outbox:'+saved.id:'mz_chatscope_delete_outbox:'+saved.id;
  const raw='\n '+JSON.stringify(saved,null,2)+'\t',values=new Map([[key,raw],['unrecognized-original','{ "unknown": true }']]),before=new Map(values),writes=[],calls=[],sessionReads=[];
  const mapped={msg_user_id:U,canonical_device_id:saved.device_id,read_only:false};const views=[],autoReads=[];
  const session={token:'SYNTHETIC_MANAGER_A_TOKEN',manager_id:M,credential_id:OTHER,device_id:saved.device_id,
   expires_at:new Date(Date.now()+60000).toISOString(),role:'ops_manager',roles:['CUSTODIAL_MANAGER'],
   access_level:'full_access',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true}};
  let current=session,mutations=0,recoveries=[],uuids=0,dialogs=0;const heldReadChanges=[];
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,
   setItem(k,v){writes.push(['set',k]);values.set(k,String(v));onSet?.(x,k,v);},removeItem(k){onRemove?.(x,k);writes.push(['remove',k]);values.delete(k);}};
  const auth={readSession(){sessionReads.push(true);return current;},getDeviceId:()=>saved.device_id,
   async requireOpsManagerSession(){if(onAuth)await onAuth(x);return current;},isReadOnlySession:()=>current?.read_only===true};
  const window={MemphisAuth:auth,dispatchEvent(){}};
  const envelope=read?{ok:true,data:1}:action==='send'||producer?{ok:true,data:{...correct,body:saved.body}}:{ok:true,data:{ok:true,deleted:true,thread_id:T,user_id:U,operation_id:M,deletion_scope:'user',deleted_at:'2026-10-15T01:00:00Z',deleted_through:'2026-10-15T01:00:00Z'}};
  const scope=vm.createContext({localStorage:storage,navigator:{onLine:true},window,EMPLOYEE_CONTEXT:false,
   Date,Set,Map,JSON,Number,String,Object,Array,Error,AbortController,DOMException,setTimeout,clearTimeout,
   CustomEvent:class{constructor(type){this.type=type;}},API:'https://source.invalid/messaging-api',
   MAX_MESSAGE_LENGTH:2000,MESSAGE_OUTBOX_SCHEMA:'chatscope-message-outbox.v2',DELETE_OUTBOX_SCHEMA:'chatscope-delete-outbox.v2',
   isNativeCustodialAuthority:()=>false,useCallback:fn=>fn,currentDeviceId:saved.device_id,identityRef:{current:mapped},mounted:{current:true},accessEpoch:{current:1},
   outboxRetryInFlight:{current:null},selectedRef:{current:''},serializeDelivery:fn=>fn(),setMessageRecoveries:r=>{recoveries=r;},setDeleteRecoveries:r=>{recoveries=r;},
   setHeldReadOriginals:value=>heldReadChanges.push(value),
   setIdentity:value=>views.push(['identity',value]),setThreads:value=>views.push(['threads',value]),setMessages:value=>views.push(['messages',value]),
   setSelectedId:value=>views.push(['selected',value]),setLoadingMessages:value=>views.push(['loading',value]),setMobileThread:value=>views.push(['mobile',value]),
   threadsRef:{current:[{id:T,title:'SYNTHETIC THREAD',canSend:true}]},mobileThreadRef:{current:true},messageLoadSequence:{current:0},
   location:{href:'https://source.invalid/messages.html?thread_id='+T},URL,document:{visibilityState:'visible'},
   isRetiredThread:()=>false,normalizedThread:row=>row,compareThreads:()=>0,mergePendingMessages:rows=>rows,
   markRead:async(...args)=>{autoReads.push(args);},
   flushReadOutbox:async()=>{},flushMessageOutbox:async()=>({foreignCount:0}),loadThreads:async()=>{},loadMessages:async()=>{},setNotice:()=>{},safe:e=>e?.message||String(e)});
  const x={scope,auth,window,session,saved,key,raw,values,before,writes,calls,sessionReads,storage,
   setSession:value=>{current=value;},recoveries:()=>recoveries,mutations:()=>mutations,heldReadChanges,views,autoReads,mapped,
   thread:{id:T},through:{id:OTHER,thread_id:T,sent_at:'2026-10-15T02:00:00Z'}};
  x.uuids=()=>uuids;x.dialogs=()=>dialogs;
  const draftWrites=[];let pauses=0;
  if(producer){
   values.delete(key);before.delete(key);scope.crypto={randomUUID:()=>{uuids++;return saved.id.slice(4);}};
   scope.draftsRef={current:{[U+':'+T]:'<p>'+saved.body+'</p>'}};scope.savingDrafts={current:new Set()};
   scope.setDrafts=value=>{draftWrites.push(value);};scope.setComposerTooLong=value=>views.push(['too-long',value]);
   scope.setNotice=(...args)=>views.push(['notice',...args]);x.draftWrites=draftWrites;x.draftKey=U+':'+T;
   x.originalDraft=scope.draftsRef.current[x.draftKey];x.pauses=()=>pauses;
  }
  const effects=[],retryTimers=[],pollCalls=[],rowReads=[];
  if(live){
   scope.identity=mapped;scope.selectedId=T;scope.ZERO_TIME='1970-01-01T00:00:00Z';scope.ZERO_ID=U;
   scope.threadCursor={current:{after:'original-thread-time',id:U}};scope.messageCursor={current:{after:'original-message-time',id:OTHER}};
   scope.useEffect=fn=>effects.push(fn);
  }
  x.recovery={key,raw,securityGeneration:null,discardable:true};
  if(destructive){
   scope.crypto={randomUUID:()=>{uuids++;return M;}};
   scope.confirm=()=>{dialogs++;onConfirm?.(x);return true;};
   scope.setNotice=(...args)=>views.push(['notice',...args]);
   scope.setMessageRecoveries=scope.setDeleteRecoveries=value=>{recoveries=value;views.push(['recoveries']);};
   if(action==='destructive-delete'){values.delete(key);before.delete(key);}
  }
  scope.serializeDelivery=async fn=>{if(onQueue)await onQueue(x);return fn();};
  let armed=!reader||action==='reader-identity';
  x.arm=()=>{armed=true;};x.isArmed=()=>armed;x.reset=()=>{calls.length=0;writes.length=0;views.length=0;autoReads.length=0;x.before=new Map(values);};
  async function reply(path,options){calls.push({path,options});
   if(live&&armed&&path.includes('/updates?')){
    pollCalls.push({path,options});
    if(pollCalls.length>1)return new Promise((resolve,reject)=>{
     const abort=()=>reject(new DOMException('Fixture polling cleanup','AbortError'));
     if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
    });
    if(onApi)await onApi(x);if(error)throw error;
    return {ok:true,data:x.pollData||[],meta:{next_cursor:{after:'next-original-time',after_id:M}}};
   }
   if(armed&&onApi)await onApi(x);if(armed&&error)throw error;
   if(reader&&(!producer||path.includes('/me/by-device')||path.startsWith('/threads?')||path.includes('/messages?')))return {ok:true,data:path.includes('/me/by-device')?{...mapped}:path.startsWith('/threads?')?[{id:T,title:'SYNTHETIC THREAD',canSend:true}]:[{...correct}]};return envelope;}
  scope.api=reply;
  scope.fetch=async(path,options)=>({ok:true,status:200,json:async()=>reply(path,options)});
  const apiSource=actualApi?source.slice(to,source.indexOf('\nfunction readOriginalGroupIntent(',to)):'';
  const readerSource=source.slice(identityStart,identityEnd)+'\n'+source.slice(messagesStart,messagesEnd);
  // Expose the same actual reader callbacks to the existing recording ports;
  // their function bodies are not replaced by policy stubs.
  const owningReaders=live?readerSource.replace('  const loadThreads = useCallback(', '  this.loadThreads = useCallback(').replace('  const loadMessages = useCallback(', '  this.loadMessages = useCallback('):readerSource;
  const draftStart=source.indexOf('  const updateDraft = useCallback('),draftEnd=source.indexOf('  const [messageRecoveries',draftStart);
  const producerSource=producer?owningReaders+'\n'+source.slice(draftStart,draftEnd)+'\n'+source.slice(flushStart,retryStart)+'\n'+source.slice(source.indexOf('function clientMessageId()'),source.indexOf('function operationId('))+'\n'+source.slice(source.indexOf('function isMemphisRow('),source.indexOf('function isRetiredThread('))+'\n'+source.slice(source.indexOf('function isMemphis(thread)'),source.indexOf('function compareThreads(')):'';
  vm.runInContext(source.slice(from,to)+'\n'+apiSource+'\n'+(producer?producerSource:destructive?source.slice(destructiveStart,destructiveEnd):reader?owningReaders:read?source.slice(readStart,readEnd):action==='send'?source.slice(flushStart,flushEnd):source.slice(retryStart,retryEnd))
   +'\nthis.invoke='+(producer?action==='producer-compose'?'handleComposerChange':'sendMessage':live?'loadIdentity':action==='destructive-delete'?'deleteThread':action==='destructive-discard-message'?'discardMessageRecovery':action==='destructive-discard-delete'?'discardDeleteRecovery':action==='reader-identity'?'loadIdentity':action==='reader-threads'?'loadThreads':action==='reader-messages'?'loadMessages':action==='read-producer'?'markRead':action==='read-flush'?'flushReadOutbox':action==='send'?'flushMessageOutbox':'retryOutbox')+';'
   +(reader?'this.openIdentity=loadIdentity;this.captureWriter=()=>originalManagerOutboxOwner(identityRef.current,currentDeviceId,identityRef,accessEpoch,mounted);':''),scope,{timeout:1000});
  if(live){
   vm.runInContext(action==='reader-live-threads'?source.slice(threadPollStart,messagePollStart):source.slice(messagePollStart,pollEnd),scope,{timeout:1000});
   x.tick=()=>new Promise(resolve=>setImmediate(resolve));x.pollCalls=pollCalls;x.rowReads=rowReads;x.retryTimers=retryTimers;
   x.start=()=>{
    scope.identity=scope.identityRef.current;
    const loadThreads=scope.loadThreads,loadMessages=scope.loadMessages;
    scope.loadThreads=async options=>{rowReads.push(['threads',options]);if(onRows)await onRows(x);return loadThreads(options);};
    scope.loadMessages=async id=>{rowReads.push(['messages',id]);if(onRows)await onRows(x);return loadMessages(id);};
    const normalSetTimeout=scope.setTimeout;
    scope.setTimeout=(fn,ms)=>{if(ms<=1500){retryTimers.push({fn,ms});return -retryTimers.length;}return normalSetTimeout(fn,ms);};
    x.cleanup=effects[0]();x.originalCursor={...(action==='reader-live-threads'?scope.threadCursor.current:scope.messageCursor.current)};
   };
   x.finish=async()=>{x.cleanup?.();for(const timer of retryTimers.splice(0))timer.fn();await x.tick();};
   x.cursor=()=>action==='reader-live-threads'?scope.threadCursor.current:scope.messageCursor.current;
   x.restart=()=>effects[0]();
  }
  if(reader){scope.selectedRef.current=T;x.open=async()=>{await scope.openIdentity();x.reset();x.arm();};}
  // Existing recording mutation fixture: the callback is still actual shipping
  // source. This port is NOT native/security/manager authentication.
  const originalMutate=scope.mutateCustodialWork;
  scope.mutateCustodialWork=async(operation,options)=>{const number=++mutations;if(onMutation)await onMutation(x,number);const result=await originalMutate(operation,options);if(onSettlement)await onSettlement(x,number);return result;};
  if(producer){const originalPause=scope.custodialSecurityPaused;scope.custodialSecurityPaused=async()=>{pauses++;if(onPause)await onPause(x,pauses);return originalPause();};}
  return x;
 }
 const retained=x=>{assert.deepEqual(x.values,x.before);assert.equal(x.writes.length,0);};
 async function check(name,body){if(producerOnly?!name.startsWith('producer-'):name.startsWith('producer-')||(liveOnly?!name.startsWith('live-'):name.startsWith('live-')||(destructiveOnly?!name.startsWith('destructive-'):name.startsWith('destructive-')||(readerOnly? !name.startsWith('reader-'):name.startsWith('reader-')||readOnly!==name.startsWith('read-')))))return;if(requested&&requested!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_MANAGER_SESSION_SOURCE_VM_ONLY'}));}
 await check('producer-pause-session-switch-retains-original-draft-without-operation',async()=>{
  const x=fixture({action:'producer-send',onPause:(x,n)=>{if(n===1)x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR',manager_id:OTHER});}});
  await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);retained(x);assert.equal(x.scope.draftsRef.current[x.draftKey],x.originalDraft);
  assert.equal(x.draftWrites.length,0);assert.equal(x.uuids(),0);assert.equal(x.views.length,0);assert.equal(x.calls.length,0);assert.equal(x.scope.savingDrafts.current.size,0);
 });
 await check('producer-composer-withdrawal-cannot-edit-old-principal-draft',async()=>{
  const x=fixture({action:'producer-compose'});await x.open();x.setSession(null);x.scope.invoke('<p>successor edit</p>','successor edit');
  retained(x);assert.equal(x.scope.draftsRef.current[x.draftKey],x.originalDraft);assert.equal(x.draftWrites.length,0);assert.equal(x.views.length,0);
 });
 await check('producer-current-manager-keeps-original-send-receipt-and-composer-contract',async()=>{
  const x=fixture({action:'producer-send',actualApi:true});await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);
  const posts=x.calls.filter(call=>call.path.endsWith('/message'));assert.equal(posts.length,1);assert.equal(x.uuids(),1);
  assert.equal(JSON.parse(posts[0].options.body).client_message_id,x.saved.id);assert.equal(JSON.parse(posts[0].options.body).body,x.saved.body);
  assert.deepEqual(x.writes,[['set',x.key],['remove',x.key]]);assert.equal(x.values.has(x.key),false);
  assert.equal(x.scope.draftsRef.current[x.draftKey],'');assert.equal(x.draftWrites.length,1);assert.equal(x.scope.savingDrafts.current.size,0);
  assert(x.views.some(([name,text])=>name==='notice'&&text==='Sent.'));
  const y=fixture({action:'producer-compose'});await y.open();y.scope.invoke('<p>new original draft</p>','new original draft');
  assert.equal(y.scope.draftsRef.current[y.draftKey],'<p>new original draft</p>');assert.equal(y.draftWrites.length,1);assert.equal(y.calls.length,0);retained(y);
 });
 await check('producer-pause-withdrawal-expiry-method-principal-and-epoch-deny-before-ID',async()=>{
  for(const kind of ['missing','expired','readonly','permission','principal','method','runtime','epoch','ABA']){
   const x=fixture({action:'producer-send',onPause:(x,n)=>{if(n!==1)return;
    if(kind==='missing')x.setSession(null);if(kind==='expired')x.session.expires_at=new Date(0).toISOString();
    if(kind==='readonly')x.session.read_only=true;if(kind==='permission')x.session.permissions.read=false;
    if(kind==='principal')x.session.manager_id=OTHER;if(kind==='method')x.auth.readSession=()=>x.session;
    if(kind==='runtime')x.window.MemphisAuth={...x.auth};if(kind==='epoch')x.scope.accessEpoch.current++;
    if(kind==='ABA'){x.setSession({...x.session,token:'SYNTHETIC_OTHER'});x.scope.accessEpoch.current++;x.setSession(x.session);}
   }});await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);retained(x);
   assert.equal(x.uuids(),0);assert.equal(x.draftWrites.length,0);assert.equal(x.views.length,0);assert.equal(x.calls.length,0);assert.equal(x.scope.savingDrafts.current.size,0);
  }
 });
 await check('producer-admission-and-save-settlement-loss-preserve-draft-and-original',async()=>{
  const deferred=fixture({action:'producer-send',onMutation:(x,n)=>{if(n===1)x.setSession(null);}});await deferred.open();
  await deferred.scope.invoke(deferred.originalDraft,deferred.saved.body);retained(deferred);assert.equal(deferred.draftWrites.length,0);assert.equal(deferred.views.length,0);
  let raw;
  const settled=fixture({action:'producer-send',onSettlement:(x,n)=>{if(n===1){raw=x.values.get(x.key);x.setSession(null);}}});await settled.open();
  await settled.scope.invoke(settled.originalDraft,settled.saved.body);assert.deepEqual(settled.writes,[['set',settled.key]]);
  assert.equal(settled.values.get(settled.key),raw);assert.equal(settled.scope.draftsRef.current[settled.draftKey],settled.originalDraft);
  assert.equal(settled.draftWrites.length,0);assert.equal(settled.views.length,0);assert.equal(settled.calls.length,0);assert.equal(settled.scope.savingDrafts.current.size,0);
  const thread=fixture({action:'producer-send',onMutation:(x,n)=>{if(n===1)x.scope.threadsRef.current[0].id=OTHER;}});await thread.open();
  await thread.scope.invoke(thread.originalDraft,thread.saved.body);retained(thread);assert.equal(thread.draftWrites.length,0);assert.equal(thread.calls.length,0);
 });
 await check('producer-original-row-occupancy-and-readback-never-overwrite-or-remint',async()=>{
  for(const at of ['before','admission','readback']){
   const x=fixture({action:'producer-send',onMutation:(x,n)=>{if(at==='admission'&&n===1)x.values.set(x.key,x.raw);},
    onSet:(x,key)=>{if(at==='readback'&&key===x.key)x.values.set(key,'SYNTHETIC_FOREIGN_REPLACEMENT');}});await x.open();
   if(at==='before')x.values.set(x.key,x.raw);
   await x.scope.invoke(x.originalDraft,x.saved.body);assert.equal(x.values.get(x.key),at==='readback'?'SYNTHETIC_FOREIGN_REPLACEMENT':x.raw);
   assert.equal(x.writes.length,at==='readback'?1:0);assert.equal(x.uuids(),1);assert.equal(x.calls.length,0);
   assert.equal(x.scope.draftsRef.current[x.draftKey],x.originalDraft);assert.equal(x.draftWrites.length,0);
   assert.equal(x.views.filter(([name])=>name==='messages').length,0);assert(!x.views.some(([name,text])=>name==='notice'&&text.includes('Try again')));
  }
 });
 await check('producer-delivery-FIFO-withdrawal-cannot-send-or-run-stale-UI-updaters',async()=>{
  let release;const x=fixture({action:'producer-send',onQueue:()=>new Promise(resolve=>{release=resolve;})});await x.open();
  const pending=x.scope.invoke(x.originalDraft,x.saved.body);await new Promise(resolve=>setImmediate(resolve));
  const raw=x.values.get(x.key),views=x.views.length;x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR',manager_id:OTHER});release();await pending;
  assert.equal(x.values.get(x.key),raw);assert.equal(x.calls.length,0);assert.equal(x.views.length,views);assert.deepEqual(x.writes,[['set',x.key]]);
  const rows=[{id:OTHER}];for(const [name,update] of x.views)if(name==='messages'&&typeof update==='function')assert.equal(update(rows),rows);
 });
 await check('producer-accepted-or-lost-reply-withdrawal-retains-exact-saved-body',async()=>{
  for(const failed of [false,true]){
   let raw,views;
   const x=fixture({action:'producer-send',error:failed?Error('SYNTHETIC_LOST_SEND_REPLY'):null,onApi:x=>{raw=x.values.get(x.key);views=x.views.length;x.setSession(null);}});await x.open();
   await x.scope.invoke(x.originalDraft,x.saved.body);assert.equal(x.calls.length,1);assert.equal(x.values.get(x.key),raw);assert.equal(x.views.length,views);
   assert.deepEqual(x.writes,[['set',x.key]]);assert.equal(x.uuids(),1);
  }
 });
 await check('producer-newer-draft-during-pause-is-not-adopted-or-cleared',async()=>{
  const newer='<p>newer draft stays</p>';let originalBody;
  const x=fixture({action:'producer-send',onPause:(x,n)=>{if(n===1)x.scope.draftsRef.current[x.draftKey]=newer;},onApi:x=>{if(x.values.has(x.key))originalBody=JSON.parse(x.values.get(x.key)).body;}});await x.open();
  await x.scope.invoke(x.originalDraft,x.saved.body);assert.equal(originalBody,x.saved.body);assert.equal(x.scope.draftsRef.current[x.draftKey],newer);
  assert.equal(x.draftWrites.length,0);assert.equal(x.calls.filter(call=>call.path.endsWith('/message')).length,1);assert.equal(x.uuids(),1);
 });
 await check('producer-unknown-outcome-keeps-one-ID-and-truthful-pending-UI',async()=>{
  const x=fixture({action:'producer-send',error:Error('SYNTHETIC_UNCERTAIN_OUTCOME')});await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);
  const saved=JSON.parse(x.values.get(x.key));assert.equal(saved.id,x.saved.id);assert.equal(saved.body,x.saved.body);assert.equal(x.uuids(),1);assert.equal(x.calls.length,1);
  assert(!x.writes.some(([kind])=>kind==='remove'));assert(x.views.some(([name,text])=>name==='notice'&&text==='Your message is saved. Server confirmation is still pending.'));
  assert(!x.views.some(([name,text])=>name==='notice'&&text==='Sent.'));
 });
 await check('producer-missing-row-with-unknown-reply-cannot-publish-Sent',async()=>{
  const x=fixture({action:'producer-send',error:Error('SYNTHETIC_UNCERTAIN_OUTCOME'),onApi:x=>{
   if(x.calls.at(-1).path.endsWith('/message'))x.values.delete(x.key);
  }});await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);
  assert.equal(x.values.has(x.key),false);assert.equal(x.uuids(),1);
  assert.equal(x.calls.filter(call=>call.path.endsWith('/message')).length,1);
  assert(!x.views.some(([name,text])=>name==='notice'&&text==='Sent.'),'Absent local bytes are not an accepted send receipt');
  assert(x.views.some(([name,text])=>name==='notice'&&text==='Server confirmation is still pending.'));
  assert.deepEqual(x.writes,[['set',x.key]],'Never recreate or blindly resend a missing original');
  let bubbles=[];for(const [name,update] of x.views)if(name==='messages')bubbles=typeof update==='function'?update(bubbles):update;
  const bubble=bubbles.find(row=>row.id===x.saved.id);assert(bubble);assert.equal(bubble.confirmationPending,true);
  assert.equal(bubble.failed,false,'Missing local bytes cannot claim a saved-on-device bubble');
  const footerStart=source.indexOf('<Message.Footer>{'),footerEnd=source.indexOf('}</Message.Footer>',footerStart);
  assert.ok(footerStart>0&&footerEnd>footerStart);
  const footer=new Function('row','navigator','return '+source.slice(footerStart+'<Message.Footer>{'.length,footerEnd));
  assert.equal(footer(bubble,{onLine:true}),'Server confirmation pending');

 });
 await check('producer-missing-or-foreign-flush-result-never-borrows-local-absence',async()=>{
  for(const missing of [undefined,null,{}, {delivered:new Set(['msg:'+OTHER])}]){
   const x=fixture({action:'producer-send'});await x.open();const normal=x.scope.serializeDelivery;
   x.scope.serializeDelivery=async operation=>{await normal(operation);return missing;};
   await x.scope.invoke(x.originalDraft,x.saved.body);assert.equal(x.values.has(x.key),false);
   assert.equal(x.calls.filter(call=>call.path.endsWith('/message')).length,1);assert.equal(x.uuids(),1);
   assert(!x.views.some(([name,text])=>name==='notice'&&text==='Sent.'));
   assert(x.views.some(([name,text])=>name==='notice'&&text==='Server confirmation is still pending.'));
  }
 });
 await check('producer-post-delivery-read-withdrawal-cannot-publish-Sent',async()=>{
  const x=fixture({action:'producer-send',onApi:x=>{if(x.calls.at(-1).path.startsWith('/threads?'))x.setSession(null);}});await x.open();
  await x.scope.invoke(x.originalDraft,x.saved.body);assert.equal(x.calls.filter(call=>call.path.endsWith('/message')).length,1);
  assert(!x.views.some(([name,text])=>name==='notice'&&text==='Sent.'));assert.deepEqual(x.writes,[['set',x.key],['remove',x.key]]);
  const rows=[{id:OTHER}];for(const [name,update] of x.views)if(name==='messages'&&typeof update==='function')assert.equal(update(rows),rows);
 });
 await check('producer-readonly-withdrawn-or-successor-entry-cannot-write-draft-or-send',async()=>{
  for(const action of ['producer-send','producer-compose'])for(const kind of ['missing','readonly','expired','successor']){
   const x=fixture({action});await x.open();if(kind==='missing')x.setSession(null);if(kind==='readonly'){x.session.read_only=true;x.session.access_level='read_only';}
   if(kind==='expired')x.session.expires_at=new Date(0).toISOString();if(kind==='successor')x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});
   await x.scope.invoke(x.originalDraft,x.saved.body);retained(x);assert.equal(x.draftWrites.length,0);assert.equal(x.views.length,0);
   assert.equal(x.uuids(),0);assert.equal(x.calls.length,0);assert.equal(x.pauses(),0);
  }
 });
 await check('producer-deferred-draft-publication-requires-original-manager',async()=>{
  for(const action of ['producer-send','producer-compose']){
   const x=fixture({action,error:action==='producer-send'?Error('SYNTHETIC_UNCERTAIN_SEND'):null});await x.open();await x.scope.invoke(x.originalDraft,x.saved.body);
   assert.equal(x.draftWrites.length,1);const publish=x.draftWrites[0];
   const previous={other:'previous UI draft'};const settle=()=>typeof publish==='function'?publish(previous):publish;
   assert.equal(settle()[x.draftKey],action==='producer-send'?'':x.originalDraft);
   x.setSession(null);assert.equal(settle(),previous);
   for(const [name,update] of x.views)if(name==='too-long')assert.equal(update(true),true);
  }
 });
 await check('live-thread-poll-session-switch-cannot-advance-original-cursor',async()=>{
  const x=fixture({action:'reader-live-threads',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR',manager_id:OTHER})});
  await x.open();x.start();try{await x.tick();assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.pollCalls.length,1);assert.equal(x.retryTimers.length,0);retained(x);}finally{await x.finish();}
 });
 await check('live-message-poll-session-switch-cannot-advance-original-cursor',async()=>{
  const x=fixture({action:'reader-live-messages',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR',manager_id:OTHER})});
  await x.open();x.start();try{await x.tick();assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.pollCalls.length,1);assert.equal(x.retryTimers.length,0);retained(x);}finally{await x.finish();}
 });
 await check('live-current-full-access-and-readonly-keep-original-poll-and-row-loading',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages'])for(const readonly of [false,true]){
   const x=fixture({action,onApi:x=>{x.pollData=[{id:M}];}});
   if(readonly){x.session.read_only=true;x.session.access_level='read_only';x.session.credential_id='';}
   await x.open();x.start();try{
    await x.tick();assert.equal(x.pollCalls.length,2);assert.equal(x.retryTimers.length,0);assert.equal(x.rowReads.length,1);
    assert.deepEqual({...x.cursor()},{after:'next-original-time',id:M});assert(x.views.some(([name])=>name===(action==='reader-live-threads'?'threads':'messages')));
    assert.equal(typeof x.pollCalls[0].options.assertCurrent,'function');assert.equal(x.scope.accessEpoch.current,1);retained(x);
    if(readonly)assert.equal(x.autoReads.length,0);
   }finally{await x.finish();}assert.equal(x.pollCalls[1].options.signal.aborted,true);
  }
 });
 await check('live-withdrawn-reader-epoch-cannot-retry-or-adopt-restored-session',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages'])for(const kind of ['missing','expired','permission','readonly','method','runtime','principal','epoch','ABA'])for(const failed of [false,true]){
   const x=fixture({action,error:failed?Error('SYNTHETIC_LOST_POLL_REPLY'):null,onApi:x=>{
    if(kind==='missing')x.setSession(null);if(kind==='expired')x.session.expires_at=new Date(0).toISOString();
    if(kind==='permission')x.session.permissions.read=false;if(kind==='readonly')x.session.read_only=true;
    if(kind==='method')x.auth.readSession=()=>x.session;if(kind==='runtime')x.window.MemphisAuth={...x.auth};
    if(kind==='principal')x.session.manager_id=OTHER;if(kind==='epoch')x.scope.accessEpoch.current++;
    if(kind==='ABA'){x.setSession({...x.session,token:'SYNTHETIC_OTHER'});x.scope.accessEpoch.current++;x.setSession(x.session);}
   }});await x.open();x.start();try{
    await x.tick();assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.pollCalls.length,1);assert.equal(x.retryTimers.length,0);
    assert.equal(x.rowReads.length,0);assert.equal(x.scope.accessEpoch.current,2);retained(x);
    x.setSession(x.session);x.window.MemphisAuth=x.auth;
    const cursor=x.cursor();assert.equal(x.restart(),undefined);await x.tick();
    assert.equal(x.cursor(),cursor);assert.equal(x.pollCalls.length,1);
   }finally{await x.finish();}
  }
 });
 await check('live-actual-api-auth-await-and-response-use-reader-currentness',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages'])for(const at of ['auth','reply']){
   const x=fixture({action,actualApi:true,onAuth:at==='auth'?x=>{if(x.isArmed())x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});}:undefined,
    onApi:at==='reply'?x=>x.setSession(null):undefined});
   await x.open();x.start();try{
    await x.tick();assert.equal(x.pollCalls.length,at==='auth'?0:1);assert.equal(x.retryTimers.length,0);
    assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.views.length,0);retained(x);
   }finally{await x.finish();}
  }
 });
 await check('live-quiet-backoff-rechecks-original-before-another-request',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages']){
   const x=fixture({action,error:Error('SYNTHETIC_OFFLINE_OR_OUTAGE')});await x.open();x.start();try{
    await x.tick();assert.equal(x.pollCalls.length,1);assert.equal(x.retryTimers.length,1);
    assert.equal(x.retryTimers[0].ms,action==='reader-live-threads'?1500:1200);
    x.setSession(null);x.retryTimers.shift().fn();await x.tick();assert.equal(x.pollCalls.length,1);assert.equal(x.retryTimers.length,0);
    assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.views.length,0);retained(x);
   }finally{await x.finish();}
  }
 });
 await check('live-cleanup-and-selection-change-refuse-late-poll-results',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages']){
   let release;const x=fixture({action,onApi:()=>new Promise(resolve=>{release=resolve;})});await x.open();x.start();
   try{await x.tick();x.cleanup();release();await x.tick();assert.equal(x.pollCalls.length,1);
    assert.deepEqual({...x.cursor()},x.originalCursor);assert.equal(x.rowReads.length,0);assert.equal(x.retryTimers.length,0);
    assert.equal(x.scope.accessEpoch.current,1);retained(x);
   }finally{await x.finish();}
  }
  let release;const x=fixture({action:'reader-live-messages',onApi:()=>new Promise(resolve=>{release=resolve;})});await x.open();x.start();
  try{await x.tick();x.scope.selectedRef.current=OTHER;release();await x.tick();assert.deepEqual({...x.cursor()},x.originalCursor);
   assert.equal(x.pollCalls.length,1);assert.equal(x.rowReads.length,0);assert.equal(x.scope.accessEpoch.current,1);retained(x);
  }finally{await x.finish();}
 });
 await check('live-row-refresh-withdrawal-stops-epoch-without-cursor-compensation',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages']){
   const x=fixture({action,onApi:x=>{x.pollData=[{id:M}];},onRows:x=>x.setSession(null)});await x.open();x.start();try{
    await x.tick();assert.equal(x.pollCalls.length,1);assert.equal(x.rowReads.length,1);assert.equal(x.views.length,0);assert.equal(x.retryTimers.length,0);
    assert.deepEqual({...x.cursor()},{after:'next-original-time',id:M});assert.equal(x.scope.accessEpoch.current,2);retained(x);
   }finally{await x.finish();}
  }
 });
 await check('live-invalid-original-profile-refuses-before-message-cursor-reset',async()=>{
  for(const action of ['reader-live-threads','reader-live-messages']){
   const x=fixture({action});await x.open();const original={...x.cursor()};x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});x.start();
   try{await x.tick();assert.equal(x.pollCalls.length,0);assert.equal(x.cleanup,undefined);assert.deepEqual({...x.cursor()},original);assert.equal(x.views.length,0);retained(x);
    x.setSession(x.session);assert.equal(x.restart(),undefined);await x.tick();assert.equal(x.pollCalls.length,0);assert.deepEqual({...x.cursor()},original);
    // Only the actual normal identity loader may rebind a new server profile.
    await x.scope.openIdentity();x.reset();x.scope.identity=x.scope.identityRef.current;
    x.cleanup=x.restart();await x.tick();assert.equal(x.pollCalls.length,2);assert.deepEqual({...x.cursor()},{after:'next-original-time',id:M});
   }finally{await x.finish();}
  }
 });
 await check('destructive-dialog-session-switch-denies-original-deletion',async()=>{
  const x=fixture({action:'destructive-delete',onConfirm:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR',manager_id:OTHER})});
  await x.scope.invoke(T);retained(x);assert.equal(x.calls.length,0);assert.equal(x.uuids(),0);assert.equal(x.views.length,0);
 });
 await check('destructive-discard-delayed-withdrawal-retains-exact-original',async()=>{
  for(const action of ['destructive-discard-message','destructive-discard-delete']){
   const x=fixture({action,onMutation:x=>x.setSession(null)});await x.scope.invoke(x.recovery);retained(x);assert.equal(x.views.length,0);
  }
 });
 await check('destructive-current-manager-keeps-one-original-and-exact-retirement',async()=>{
  const x=fixture({action:'destructive-delete',actualApi:true});await x.scope.invoke(T);
  assert.equal(x.calls.length,1);assert.equal(x.uuids(),1);assert.equal(x.dialogs(),1);
  assert.equal(x.values.has(x.key),false);assert.deepEqual(x.writes,[['set',x.key],['remove',x.key]]);
  assert.equal(x.calls[0].options.method,'POST');assert.equal(JSON.parse(x.calls[0].options.body).operation_id,M);
  assert.equal(x.values.get('unrecognized-original'),x.before.get('unrecognized-original'));assert(x.sessionReads.length>0);
  for(const action of ['destructive-discard-message','destructive-discard-delete']){
   const y=fixture({action});await y.scope.invoke(y.recovery);assert.equal(y.values.has(y.key),false);
   assert.deepEqual(y.writes,[['remove',y.key]]);assert.equal(y.calls.length,0);assert.equal(y.uuids(),0);
   const rows=[{...y.recovery},{key:'different',raw:'untouched'}];const result=y.recoveries()(rows);assert.equal(result.length,1);
  }
 });
 await check('destructive-delayed-save-or-retirement-cannot-adopt-successor',async()=>{
  for(const at of [1,2]){
   const x=fixture({action:'destructive-delete',onMutation:(x,n)=>{if(n===at)x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});}});
   await x.scope.invoke(T);assert.equal(x.calls.length,at===1?0:1);
   if(at===1){retained(x);assert.equal(x.views.length,0);}else{
    assert.equal(x.writes.length,1);assert.equal(x.writes[0][0],'set');assert.equal(JSON.parse(x.values.get(x.key)).id,M);
   }
  }
  const settled=fixture({action:'destructive-delete',onSettlement:(x,n)=>{if(n===1)x.setSession(null);}});
  await settled.scope.invoke(T);assert.equal(settled.calls.length,0);assert.equal(settled.writes.length,1);assert.equal(settled.views.length,0);
 });
 await check('destructive-accepted-or-failed-reply-withdrawal-retains-saved-operation',async()=>{
  for(const kind of ['session','expiry','permission','readonly','method','runtime','epoch','ABA'])for(const failed of [false,true]){
   let original,viewCount;
   const x=fixture({action:'destructive-delete',error:failed?Object.assign(Error('SYNTHETIC_DENIED_OR_UNCERTAIN'),{status:403}):null,onApi:x=>{
    original=x.values.get(x.key);viewCount=x.views.length;
    if(kind==='session')x.setSession(null);if(kind==='expiry')x.session.expires_at=new Date(0).toISOString();
    if(kind==='permission')x.session.permissions.read=false;if(kind==='readonly')x.session.read_only=true;
    if(kind==='method')x.auth.readSession=()=>x.session;if(kind==='runtime')x.window.MemphisAuth={...x.auth};
    if(kind==='epoch')x.scope.accessEpoch.current++;
    if(kind==='ABA'){x.setSession({...x.session,token:'SYNTHETIC_OTHER'});x.scope.accessEpoch.current++;x.setSession(x.session);}
   }});await x.scope.invoke(T);assert.equal(x.calls.length,1);assert.equal(x.values.get(x.key),original);
   assert.deepEqual(x.writes,[['set',x.key]]);assert.equal(x.views.length,viewCount);assert.equal(x.uuids(),1);
  }
 });
 await check('destructive-auth-await-and-failure-classification-remain-original',async()=>{
  const auth=fixture({action:'destructive-delete',actualApi:true,onAuth:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'})});
  await auth.scope.invoke(T);assert.equal(auth.calls.length,0);assert.deepEqual(auth.writes,[['set',auth.key]]);
  const valid=fixture({action:'destructive-delete',error:Object.assign(Error('SYNTHETIC_PERMANENT'),{status:403})});
  await valid.scope.invoke(T);assert.equal(valid.calls.length,1);assert.equal(valid.writes.length,2);assert.equal(valid.values.has(valid.key),true);
  let original,views;
  const lost=fixture({action:'destructive-delete',error:Object.assign(Error('SYNTHETIC_PERMANENT'),{status:403}),onMutation:(x,n)=>{
   if(n===2){original=x.values.get(x.key);views=x.views.length;x.setSession(null);}
  }});await lost.scope.invoke(T);assert.equal(lost.values.get(lost.key),original);assert.equal(lost.writes.length,1);assert.equal(lost.views.length,views);
 });
 await check('destructive-uncertain-original-never-mints-replacement-or-resends',async()=>{
  const x=fixture({action:'destructive-delete',error:Error('SYNTHETIC_LOST_REPLY')});await x.scope.invoke(T);
  const original=x.values.get(x.key);assert.equal(x.calls.length,1);assert.equal(x.uuids(),1);
  x.scope.threadsRef.current=[{id:T,title:'SYNTHETIC THREAD'}];await x.scope.invoke(T);
  assert.equal(x.calls.length,1);assert.equal(x.uuids(),1);assert.equal(x.values.get(x.key),original);
  x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});await x.scope.invoke(T);
  assert.equal(x.calls.length,1);assert.equal(x.uuids(),1);assert.equal(x.values.get(x.key),original);
 });
 await check('destructive-discard-confirmation-CAS-and-input-snapshot-remain-original',async()=>{
  const dialog=fixture({action:'destructive-discard-delete',onConfirm:x=>x.setSession(null)});
  await dialog.scope.invoke(dialog.recovery);retained(dialog);assert.equal(dialog.mutations(),0);assert.equal(dialog.views.length,0);
  for(const action of ['destructive-discard-message','destructive-discard-delete']){
   const snapshot=fixture({action,onMutation:x=>{x.recovery.key='unrecognized-original';x.recovery.raw=x.values.get('unrecognized-original');}});
   await snapshot.scope.invoke(snapshot.recovery);assert.equal(snapshot.values.has(snapshot.key),false);
   assert.equal(snapshot.values.get('unrecognized-original'),snapshot.before.get('unrecognized-original'));assert.deepEqual(snapshot.writes,[['remove',snapshot.key]]);
   const cas=fixture({action,onMutation:x=>x.values.set(x.key,'SYNTHETIC_NEWER_ORIGINAL')});
   await cas.scope.invoke(cas.recovery);assert.equal(cas.values.get(cas.key),'SYNTHETIC_NEWER_ORIGINAL');assert.equal(cas.writes.length,0);
  }
 });
 await check('destructive-discard-settlement-and-delayed-UI-do-not-compensate-or-adopt',async()=>{
  for(const action of ['destructive-discard-message','destructive-discard-delete']){
   const lost=fixture({action,onSettlement:x=>x.setSession(null)});await lost.scope.invoke(lost.recovery);
   assert.deepEqual(lost.writes,[['remove',lost.key]]);assert.equal(lost.values.has(lost.key),false);assert.equal(lost.views.length,0);
   const late=fixture({action});await late.scope.invoke(late.recovery);late.setSession(null);
   const rows=[late.recovery];assert.equal(late.recoveries()(rows),rows);
   const broken=fixture({action,onRemove:()=>{throw Error('SYNTHETIC_STORAGE_FAILURE');}});
   await broken.scope.invoke(broken.recovery);retained(broken);assert.equal(broken.calls.length,0);
  }
 });
 await check('destructive-entry-withdrawal-readonly-and-mutated-thread-deny-before-effects',async()=>{
  for(const action of ['destructive-delete','destructive-discard-message','destructive-discard-delete'])for(const kind of ['missing','readonly','expired']){
   const x=fixture({action});if(kind==='missing')x.setSession(null);if(kind==='readonly')x.session.read_only=true;if(kind==='expired')x.session.expires_at=new Date(0).toISOString();
   await x.scope.invoke(action==='destructive-delete'?T:x.recovery);retained(x);assert.equal(x.dialogs(),0);assert.equal(x.uuids(),0);assert.equal(x.views.length,0);
  }
  const changed=fixture({action:'destructive-delete',onMutation:x=>{x.scope.threadsRef.current[0].id=OTHER;}});
  await changed.scope.invoke(T);retained(changed);assert.equal(changed.calls.length,0);assert.equal(changed.views.length,0);
 });
 await check('send-session-switch-after-accepted-reply-retains-original',async()=>{
  const x=fixture({onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B_TOKEN',manager_id:OTHER,read_only:true})});
  const result=await x.scope.invoke();assert.equal(x.calls.length,1);assert.equal(result.delivered.size,0);assert.equal(result.permanentIds.size,0);retained(x);
 });
 await check('deletion-session-switch-after-accepted-reply-retains-original',async()=>{
  const x=fixture({action:'delete',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B_TOKEN',manager_id:OTHER,read_only:true})});
  await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);
 });
 await check('unchanged-manager-keeps-exact-send-and-deletion-receipt-contract',async()=>{
  for(const action of ['send','delete']){const x=fixture({action});const result=await x.scope.invoke();assert.equal(x.calls.length,1);assert.equal(x.values.get(x.key),undefined);
   if(action==='send')assert.equal(result.delivered.has(x.saved.id),true);assert(x.sessionReads.length>0);assert.deepEqual(x.writes,[['remove',x.key]]);}
 });
 await check('withdrawn-expired-or-mutated-manager-cannot-retire-or-classify-failure',async()=>{
  for(const action of ['send','delete'])for(const kind of ['absent','expired','read-only','permission','token','credential','auth-method','auth-runtime','event-epoch'])for(const failed of [false,true]){
   const x=fixture({action,error:failed?Object.assign(Error('SYNTHETIC_UNCERTAIN_DENIAL'),{status:403}):null,onApi:x=>{
    if(kind==='absent')x.setSession(null);if(kind==='expired')x.session.expires_at=new Date(Date.now()-1).toISOString();
    if(kind==='read-only')x.session.read_only=true;if(kind==='permission')x.session.permissions.read=false;
    if(kind==='token')x.session.token='SYNTHETIC_SUCCESSOR';if(kind==='credential')x.session.credential_id=U;
    if(kind==='auth-method')x.auth.readSession=()=>x.session;if(kind==='auth-runtime')x.window.MemphisAuth={...x.auth};
    if(kind==='event-epoch')x.scope.accessEpoch.current++;
   }});await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);
  }
 });
 await check('delayed-admission-and-failure-bookkeeping-cannot-adopt-manager',async()=>{
  for(const action of ['send','delete'])for(const at of [1,2]){
   const x=fixture({action,onMutation:(x,n)=>{if(n===at)x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'});}});
   await x.scope.invoke();assert.equal(x.calls.length,at===1?0:1);retained(x);
  }
  for(const permanent of [false,true]){
   const x=fixture({error:Object.assign(Error('SYNTHETIC_OUTCOME_UNKNOWN'),{status:permanent?403:503}),onMutation:(x,n)=>{if(n===2)x.setSession(null);}});
   await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);
  }
 });
 await check('current-api-auth-await-and-fetch-reply-use-original-session-fence',async()=>{
  const pre=fixture({actualApi:true,onAuth:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR'})});
  await pre.scope.invoke();assert.equal(pre.calls.length,0);retained(pre);
  const post=fixture({actualApi:true,onApi:x=>{x.scope.accessEpoch.current++;}});
  const result=await post.scope.invoke();assert.equal(post.calls.length,1);assert.equal(result.delivered.size,0);retained(post);
  const valid=fixture({actualApi:true});assert.equal((await valid.scope.invoke()).delivered.has(valid.saved.id),true);assert.equal(valid.calls.length,1);
 });
 await check('ABA-with-withdrawal-epoch-and-invalid-entry-session-are-held',async()=>{
  const x=fixture({onApi:x=>{x.setSession({...x.session,token:'SYNTHETIC_OTHER'});x.scope.accessEpoch.current++;x.setSession(x.session);}});
  await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);
  for(const action of ['send','delete'])for(const kind of ['missing','read-only','expired']){
   const y=fixture({action});if(kind==='missing')y.setSession(null);if(kind==='read-only')y.session.read_only=true;if(kind==='expired')y.session.expires_at=new Date(0).toISOString();
   await y.scope.invoke();assert.equal(y.calls.length,0);retained(y);
  }
 });
 await check('queued-deletion-and-successor-retry-cannot-adopt-stale-mapping',async()=>{
  let release;const queued=fixture({action:'delete',onQueue:()=>new Promise(resolve=>{release=resolve;})});
  const pending=queued.scope.invoke();queued.setSession({...queued.session,token:'SYNTHETIC_OTHER'});release();await pending;
  assert.equal(queued.calls.length,0);retained(queued);
  for(const action of ['send','delete']){
   const x=fixture({action,onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_SUCCESSOR_FULL_ACCESS',manager_id:OTHER})});
   await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);
   await x.scope.invoke();assert.equal(x.calls.length,1,'successor must not resend an original under the old mapped identity');retained(x);
  }
 });
 await check('read-producer-FIFO-session-withdrawal-keeps-original-horizon',async()=>{
  let release;const x=fixture({action:'read-producer',onQueue:()=>new Promise(resolve=>{release=resolve;})});
  const pending=x.scope.invoke(x.thread,x.through);x.setSession({...x.session,token:'SYNTHETIC_OTHER_MANAGER',manager_id:OTHER,read_only:true});
  release();await pending;retained(x);assert.equal(x.calls.length,0);assert.equal(x.heldReadChanges.length,0);
 });
 await check('read-flush-session-switch-after-reply-does-not-retire-original',async()=>{
  const x=fixture({action:'read-flush',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_OTHER_MANAGER',manager_id:OTHER,read_only:true})});
  await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);assert.equal(x.heldReadChanges.length,0);
 });
 await check('read-current-manager-keeps-producer-and-retirement-contract',async()=>{
  for(const action of ['read-producer','read-flush']){
   const x=fixture({action});await x.scope.invoke(x.thread,x.through);assert.equal(x.calls.length,1);assert.equal(x.values.has(x.key),false);
   assert.equal(x.calls[0].options.body.through_message_id,action==='read-producer'?x.through.id:x.saved.through_message_id);
   assert.deepEqual(x.writes.map(value=>value[0]),action==='read-producer'?['set','remove']:['remove']);assert.deepEqual(x.heldReadChanges,[false]);
  }
 });
 await check('read-mutation-withdrawal-cannot-write-or-retire-after-delay',async()=>{
  for(const action of ['read-producer','read-flush']){
   const x=fixture({action,onMutation:(x,n)=>{if(n===1)x.setSession(null);}});
   await x.scope.invoke(x.thread,x.through);assert.equal(x.calls.length,action==='read-producer'?0:1);retained(x);assert.equal(x.heldReadChanges.length,0);
  }
 });
 await check('read-invalid-owner-error-and-event-epoch-never-publish-recovery',async()=>{
  for(const kind of ['absent','expired','permission','method','epoch','ABA'])for(const failed of [false,true]){
   const x=fixture({action:'read-flush',error:failed?Error('SYNTHETIC_LOST_READ_REPLY'):null,onApi:x=>{
    if(kind==='absent')x.setSession(null);if(kind==='expired')x.session.expires_at=new Date(0).toISOString();
    if(kind==='permission')x.session.permissions.read=false;if(kind==='method')x.auth.readSession=()=>x.session;
    if(kind==='epoch')x.scope.accessEpoch.current++;if(kind==='ABA'){x.setSession({...x.session,token:'SYNTHETIC_OTHER'});x.scope.accessEpoch.current++;x.setSession(x.session);}
   }});await x.scope.invoke();assert.equal(x.calls.length,1);retained(x);assert.equal(x.heldReadChanges.length,0);
  }
 });
 await check('read-producer-and-retirement-CAS-preserve-foreign-newer-bytes',async()=>{
  let release;const x=fixture({action:'read-producer',onQueue:()=>new Promise(resolve=>{release=resolve;})});
  const pending=x.scope.invoke(x.thread,x.through);const replacement=' '+JSON.stringify({...x.saved,created_at:2})+'\n';
  x.values.set(x.key,replacement);release();await pending;assert.equal(x.values.get(x.key),replacement);assert.equal(x.writes.length,0);assert.equal(x.calls.length,0);
  const y=fixture({action:'read-flush',onApi:x=>x.values.set(x.key,replacement)});await y.scope.invoke();assert.equal(y.calls.length,1);assert.equal(y.values.get(y.key),replacement);assert.equal(y.writes.length,0);
 });
 await check('read-current-api-guards-auth-await-and-lost-reply-without-resend',async()=>{
  const pre=fixture({action:'read-flush',actualApi:true,onAuth:x=>x.setSession({...x.session,token:'SYNTHETIC_OTHER'})});
  await pre.scope.invoke();assert.equal(pre.calls.length,0);retained(pre);
  const post=fixture({action:'read-flush',actualApi:true,onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_OTHER'})});
  await post.scope.invoke();assert.equal(post.calls.length,1);retained(post);await post.scope.invoke();assert.equal(post.calls.length,1);retained(post);
 });
 await check('read-queued-caller-horizon-is-detached-and-current-errors-stay-unknown',async()=>{
  let release;const x=fixture({action:'read-producer',error:Error('SYNTHETIC_OUTCOME_UNKNOWN'),onQueue:()=>new Promise(resolve=>{release=resolve;})});
  const originalId=x.through.id;const pending=x.scope.invoke(x.thread,x.through);x.through.id=M;x.through.sent_at='2099-01-01T00:00:00Z';release();await pending;
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].options.body.through_message_id,originalId);assert.equal(JSON.parse(x.values.get(x.key)).through_message_id,originalId);
  assert.equal(x.writes.length,1);assert.equal(x.writes[0][0],'set');
  const y=fixture({action:'read-flush',error:Error('SYNTHETIC_OUTCOME_UNKNOWN')});await y.scope.invoke();assert.equal(y.calls.length,1);retained(y);
 });
 await check('reader-messages-session-switch-cannot-publish-or-auto-mark-read',async()=>{
  const x=fixture({action:'reader-messages',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B',manager_id:OTHER})});
  await x.open();await x.scope.invoke(T).catch(()=>{});assert.equal(x.calls.length,1);assert.equal(x.views.length,0);assert.equal(x.autoReads.length,0);retained(x);
 });
 await check('reader-identity-session-switch-cannot-publish-profile-or-cache',async()=>{
  const x=fixture({action:'reader-identity',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B',manager_id:OTHER})});
  await x.scope.invoke().catch(()=>{});assert.equal(x.calls.length,1);assert.equal(x.views.length,0);assert.equal(x.scope.identityRef.current,x.mapped);retained(x);
 });
 await check('reader-threads-session-switch-cannot-publish-selection',async()=>{
  const x=fixture({action:'reader-threads',onApi:x=>x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B',manager_id:OTHER})});
  await x.open();await x.scope.invoke().catch(()=>{});assert.equal(x.calls.length,1);assert.equal(x.views.length,0);retained(x);
 });
 await check('reader-readonly-session-keeps-view-access-but-never-writer-authority',async()=>{
  for(const action of ['reader-messages','reader-threads']){
   const x=fixture({action});x.session.read_only=true;x.session.access_level='read_only';await x.open();await x.scope.invoke(action==='reader-messages'?T:undefined);
   assert.equal(x.calls.length,1);assert(x.views.some(([name])=>name===(action==='reader-messages'?'messages':'threads')));assert.equal(x.autoReads.length,0);
   assert.throws(()=>x.scope.captureWriter());retained(x);
  }
 });
 await check('reader-bound-profile-cannot-be-first-adopted-by-successor-writer',async()=>{
  const x=fixture({action:'reader-messages'});await x.open();x.setSession({...x.session,token:'SYNTHETIC_MANAGER_B',manager_id:OTHER});
  await x.scope.invoke(T).catch(()=>{});assert.equal(x.calls.length,0);assert.equal(x.views.length,0);assert.throws(()=>x.scope.captureWriter());retained(x);
 });
 await check('reader-withdrawal-expiry-method-permissions-and-epoch-deny-effects',async()=>{
  for(const action of ['reader-messages','reader-threads'])for(const kind of ['missing','expiry','method','runtime','permission','readonly-change','epoch']){
   const x=fixture({action,onApi:x=>{
    if(kind==='missing')x.setSession(null);if(kind==='expiry')x.session.expires_at=new Date(0).toISOString();
    if(kind==='method')x.auth.readSession=()=>x.session;if(kind==='runtime')x.window.MemphisAuth={...x.auth};
    if(kind==='permission')x.session.permissions.read=false;if(kind==='readonly-change'){x.session.read_only=true;x.session.access_level='read_only';}
    if(kind==='epoch')x.scope.accessEpoch.current++;
   }});await x.open();await x.scope.invoke(action==='reader-messages'?T:undefined).catch(()=>{});assert.equal(x.calls.length,1);assert.equal(x.views.length,0);assert.equal(x.autoReads.length,0);retained(x);
  }
 });
 await check('reader-current-api-auth-await-and-error-settlement-stay-original',async()=>{
  const x=fixture({action:'reader-messages',actualApi:true,onAuth:x=>{if(x.isArmed())x.setSession({...x.session,token:'SYNTHETIC_OTHER'});}});
  // Prepare a real Source identity under A; arm auth replacement only for GET.
  await x.open();await x.scope.invoke(T,{showLoading:false}).catch(()=>{});assert.equal(x.calls.length,0);assert.equal(x.views.length,0);retained(x);
  const spinning=fixture({action:'reader-messages',onApi:x=>x.setSession(null)});await spinning.open();
  await spinning.scope.invoke(T,{showLoading:true}).catch(()=>{});assert.deepEqual(spinning.views,[['loading',true]]);assert.equal(spinning.autoReads.length,0);retained(spinning);
  for(const action of ['reader-messages','reader-threads']){
   const y=fixture({action,error:Error('SYNTHETIC_LOST_REPLY'),onApi:x=>x.setSession(null)});await y.open();await y.scope.invoke(action==='reader-messages'?T:undefined).catch(()=>{});
   assert.equal(y.calls.length,1);assert.equal(y.views.length,0);assert.equal(y.autoReads.length,0);retained(y);
  }
 });
 await check('reader-current-full-access-and-cold-auth-bootstrap-keep-normal-access',async()=>{
  for(const action of ['reader-messages','reader-threads']){
   const x=fixture({action});await x.open();await x.scope.invoke(action==='reader-messages'?T:undefined);
   assert.equal(x.calls.length,1);assert(x.views.some(([name])=>name===(action==='reader-messages'?'messages':'threads')));retained(x);
   assert.equal(x.autoReads.length,action==='reader-messages'?1:0);
  }
  for(const readonly of [false,true]){
   const x=fixture({action:'reader-identity',onAuth:x=>x.setSession(x.session)});
   if(readonly){x.session.read_only=true;x.session.access_level='read_only';x.session.credential_id='';}
   x.setSession(null);await x.scope.invoke();assert.equal(x.calls.length,1);assert.equal(x.scope.identityRef.current.read_only,readonly);
   assert.equal(x.views.filter(([name])=>name==='identity').length,1);assert.equal(x.writes.length,1);assert.equal(x.writes[0][1],'mz_messenger_user_id');
   if(readonly)assert.throws(()=>x.scope.captureWriter());
  }
  const changed=fixture({action:'reader-identity',onAuth:x=>{x.setSession(x.session);x.auth.readSession=()=>x.session;}});
  changed.setSession(null);await changed.scope.invoke().catch(()=>{});assert.equal(changed.calls.length,0);assert.equal(changed.views.length,0);retained(changed);
 });
 assert.ok(completed.length>0,'Unknown manager outbox session selector');
 console.log(JSON.stringify({status:readerOnly?'MANAGER_READER_SESSION_SOURCE_VM_PASS':readOnly?'MANAGER_READ_SESSION_SOURCE_VM_PASS':'MANAGER_OUTBOX_SESSION_SOURCE_VM_PASS',groups:completed.length,cases:completed,
  actual_shipping_callbacks:true,session_storage_and_API_synthetic:true,old_groups_run:0,genuine_manager_auth:false,network:false,browser:false,SQL:false}));
}

async function chatscopeOriginalWriterCases(){
 const guards=source.slice(source.indexOf('function outboxKey(id)'),source.indexOf('function custodialEmployeeMessage()'));
 const writer=source.slice(source.indexOf('async function mutateCustodialWork('),source.indexOf('async function retainOutboxFailure('));
 assert.ok(guards.includes('function originalCustodialIdentityGuard(')&&writer.includes('async function mutateCustodialWork('));
 const requested=process.argv.find(arg=>arg.startsWith('--original-writer-case='))?.slice('--original-writer-case='.length),completed=[];
 const held=error=>error?.code==='custodial_security_state_unavailable';
 function fixture({beforeAdmit,beforeSettle,contextFault,web=false}={}){
  const principal={schema_version:'custodial-protected-principal.v2',device_id:'KIOSK_08',
   employee_id:'10000000-0000-4000-8000-000000000001',credential_id:'20000000-0000-4000-8000-000000000001',assignment_epoch:4,
   activation_operation_id:'30000000-0000-4000-8000-000000000001',activation_receipt_sha256:'a'.repeat(64),
   legacy_binding_id:'40000000-0000-4000-8000-000000000001',legacy_binding_kind:'confirmed_enrollment_operation',
   installation_binding_sha256:'b'.repeat(64),installation_seal:'source-only-installation-seal',enrolled_at:'2026-10-14T00:00:00.000Z'};
  const status={ready:true,available:true,quarantined:false,generation:7,deviceId:'KIOSK_08',principal};
  const calls=[],values=new Map([['mz_chatscope_outbox:original','{ "original": "unknown" }'],['mz_messenger_user_id','original sender']]);
  const original=new Map(values);let checks=0,closedChecks=0,operations=0;
  const mobile={edition:'custodial',principalIdentity:()=>JSON.stringify(status.principal)};
  const security={native:true,getStatus:()=>status,mutateProtectedWork:async function(operation,options){
   assert.equal(this,security);calls.push(options);if(beforeAdmit)await beforeAdmit();
   let active=true;const context={generation:status.generation,deviceId:status.deviceId,assertCurrent(){
    checks++;if(!active){closedChecks++;throw Error('closed_context_must_not_be_called');}
    if(context.generation!==status.generation||context.deviceId!==status.deviceId)throw Object.assign(Error('source generation changed'),{code:'custodial_security_generation_changed'});
   }};
   if(contextFault)contextFault(context);
   let result;try{result=await operation(context);}finally{active=false;}
   if(beforeSettle)await beforeSettle();return result;
  }};
  const window=web?{}:{MemphisCustodialSecurity:security,MemphisMobile:mobile};
  const scope=vm.createContext({window});
  vm.runInContext(guards+'\n'+writer+'\nthis.mutate=mutateCustodialWork;',scope,{timeout:1000});
  return {status,principal,security,mobile,window,scope,calls,values,original,checks:()=>checks,closedChecks:()=>closedChecks,
   operation:()=>{operations++;values.set('mz_chatscope_outbox:original','must not run for successor');},operations:()=>operations};
 }
 const unchanged=x=>{assert.deepEqual(x.values,x.original);assert.equal(x.operations(),0);assert.equal(x.closedChecks(),0);};
 async function check(name,body){if(requested&&requested!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_ORIGINAL_WRITER_SOURCE_VM_ONLY'}));}
 await check('queued-generation-device-principal-and-method-drift-deny-before-callback',async()=>{
  for(const kind of ['generation','device','principal','runtime','mobile','status-method','principal-method','mutate-method']){
   let release;const x=fixture({beforeAdmit:()=>new Promise(resolve=>{release=resolve;})});
   const pending=x.scope.mutate(x.operation);
   if(kind==='generation')x.status.generation++;
   if(kind==='device')x.status.deviceId='KIOSK_09';
   if(kind==='principal')x.principal.employee_id='50000000-0000-4000-8000-000000000001';
   if(kind==='runtime')x.window.MemphisCustodialSecurity={...x.security};
   if(kind==='mobile')x.window.MemphisMobile={...x.mobile};
   if(kind==='status-method')x.security.getStatus=()=>x.status;
   if(kind==='principal-method')x.mobile.principalIdentity=()=>JSON.stringify(x.status.principal);
   if(kind==='mutate-method')x.security.mutateProtectedWork=async()=>{};
   release();await assert.rejects(()=>pending,held,kind);assert.equal(x.calls.length,1);unchanged(x);
  }
 });
 await check('every-original-principal-field-remains-bound-even-with-stable-identity-string',async()=>{
  const fields=Object.keys(fixture().principal);
  for(const field of fields){let release;const x=fixture({beforeAdmit:()=>new Promise(resolve=>{release=resolve;})});
   const identity=x.mobile.principalIdentity();x.mobile.principalIdentity=()=>identity;
   const pending=x.scope.mutate(x.operation);x.principal[field]=typeof x.principal[field]==='number'?99:'source changed '+field;
   release();await assert.rejects(()=>pending,held,field);unchanged(x);
  }
 });
 await check('default-options-pin-generation-and-closed-context-is-never-reused',async()=>{
  for(const options of [undefined,{}, {expectedGeneration:null}, {expectedGeneration:7,requireEnrollment:false}]){
   const x=fixture(),result={source:'result'};let supplied;
   const received=await x.scope.mutate(context=>{supplied=context;return result;},options);
   assert.equal(received,result);assert.equal(supplied.generation,7);assert.equal(supplied.deviceId,'KIOSK_08');
   assert.equal(x.calls.length,1);assert.equal(x.calls[0].expectedGeneration,7);assert.equal(x.calls[0].requireEnrollment,true);
   assert(Object.isFrozen(x.calls[0]));assert(x.checks()>=2);unchanged(x);
  }
  for(const expectedGeneration of [8,0,'7',NaN]){const x=fixture();await assert.rejects(()=>x.scope.mutate(x.operation,{expectedGeneration}),held);assert.equal(x.calls.length,0);unchanged(x);}
  let release;const x=fixture({beforeAdmit:()=>new Promise(resolve=>{release=resolve;})}),options={expectedGeneration:7};
  const pending=x.scope.mutate(()=> 'source result',options);options.expectedGeneration=8;release();assert.equal(await pending,'source result');assert.equal(x.calls[0].expectedGeneration,7);unchanged(x);
 });
 await check('missing-or-foreign-admission-checkpoint-refuses-before-operation',async()=>{
  for(const fault of [context=>{delete context.assertCurrent;},context=>{context.assertCurrent=null;},context=>{context.assertCurrent=true;},
   context=>{context.generation=8;},context=>{context.deviceId='KIOSK_09';}]){
   const x=fixture({contextFault:fault});await assert.rejects(()=>x.scope.mutate(x.operation),held);unchanged(x);
  }
 });
 await check('loss-during-operation-retains-attempted-original-and-refuses-success',async()=>{
  let release,entered;const started=new Promise(resolve=>{entered=resolve;}),x=fixture();
  const pending=x.scope.mutate(async context=>{context.assertCurrent();x.values.set('mz_chatscope_outbox:original','retained attempted original');
   entered();await new Promise(resolve=>{release=resolve;});return 'must not report success';});
  await started;x.status.generation++;release();await assert.rejects(()=>pending,held);
  assert.equal(x.values.get('mz_chatscope_outbox:original'),'retained attempted original');assert.equal(x.closedChecks(),0);
  const y=fixture();let finish,called;const began=new Promise(resolve=>{called=resolve;});
  const failed=y.scope.mutate(async()=>{called();await new Promise(resolve=>{finish=resolve;});throw Error('original operation failed');});
  await began;y.principal.installation_seal='source changed seal';finish();await assert.rejects(()=>failed,held);unchanged(y);
 });
 await check('owner-loss-after-closed-callback-before-runtime-settlement-refuses',async()=>{
  let release,settled;const reached=new Promise(resolve=>{settled=resolve;}),x=fixture({beforeSettle:()=>{settled();return new Promise(resolve=>{release=resolve;});}});
  const pending=x.scope.mutate(()=> 'not a final success');await reached;x.principal.assignment_epoch++;release();
  await assert.rejects(()=>pending,held);unchanged(x);
 });
 await check('unknown-principal-unready-and-unreadable-original-refuse-before-admission',async()=>{
  for(const fault of [x=>{x.status.principal=null;},x=>{x.status.ready=false;},x=>{x.status.available=false;},x=>{x.status.quarantined=true;},
   x=>{x.status.generation=0;},x=>{x.mobile.principalIdentity=()=>'';},x=>{x.security.getStatus=()=>{throw Error('unreadable original');};}]){
   const x=fixture();fault(x);await assert.rejects(()=>x.scope.mutate(x.operation),held);assert.equal(x.calls.length,0);unchanged(x);
  }
 });
 await check('ordinary-unmarked-manager-web-callback-contract-remains-unchanged',async()=>{
  const x=fixture({web:true}),result={web:true};let calls=0;
  assert.equal(await x.scope.mutate(context=>{assert.equal(context,undefined);calls++;return result;}),result);assert.equal(calls,1);unchanged(x);
  const failure=Error('original web error');await assert.rejects(()=>x.scope.mutate(()=>{throw failure;}),error=>error===failure);unchanged(x);
  const n=fixture(),nativeFailure=Error('original native error');
  await assert.rejects(()=>n.scope.mutate(()=>{throw nativeFailure;}),error=>error===nativeFailure);unchanged(n);
 });
 assert.ok(completed.length>0,'Unknown/empty original writer selector');
 console.log(JSON.stringify({status:'CHATSCOPE_ORIGINAL_WRITER_SOURCE_VM_PASS',groups:completed.length,cases:completed,
  actual_shipping_callback:true,synthetic_native_ports_and_storage:true,old_cases_executed:0,real_native_auth:false,browser:false,SQL:false,phone:false}));
}

async function chatscopeNativeBootstrapCases(){
 const begin=source.indexOf('function isNativeCustodialAuthority()'),end=source.indexOf('// Employee Messenger authenticates',begin);
 const guards=source.slice(source.indexOf('function outboxKey(id)'),source.indexOf('function custodialEmployeeMessage()'));
 const work=source.slice(source.indexOf('async function custodialSecurityPaused()'),source.indexOf('async function retainOutboxFailure('));
 const load=source.slice(source.indexOf('  const loadIdentity = useCallback('),source.indexOf('\n  const loadThreads =',source.indexOf('  const loadIdentity = useCallback(')));
 const fallback=source.slice(source.indexOf('if (EMPLOYEE_CONTEXT &&'),source.indexOf('\nfunction resolveBackUrl()'));
 assert.ok(begin>0&&end>begin&&guards.includes('function custodialWorkSecurity()')&&load.includes('const loadIdentity'));
 const requested=process.argv.find(arg=>arg.startsWith('--chatscope-bootstrap-case='))?.slice('--chatscope-bootstrap-case='.length),completed=[];
 const marked=[()=>({MemphisMobile:{edition:'custodial'}}),()=>({MemphisMobileBuildIdentity:{edition:'custodial'}}),
  ()=>({Capacitor:{isNativePlatform:()=>true}}),()=>({Capacitor:{getPlatform:()=> 'android'}}),()=>({Capacitor:{getPlatform:()=> 'ios'}})];
 function fixture(window={},onApi=async()=>{},employee=false){
  const original={msg_user_id:'original-sender'},reply={msg_user_id:'replacement-sender',display_name:'Source sender'};
  const values=new Map([['mz_messenger_user_id','original-sender'],['mz_scan_device_id','original-device'],
   ['mz_chatscope_outbox:original','{ "exact original": "unknown" }'],['mz_chatscope_group_create:original','original group'],
   ['mz_chatscope_read_outbox:original','original read'],['unrecognized-protected-row','original unknown']]);
  const before=new Map(values),writes=[],calls=[];let rendered=original;
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value:String(value)});values.set(key,String(value));},removeItem(){throw Error('no original retirement');}};
  const scope=vm.createContext({window,localStorage:storage,URL,PAGE_URL:new URL('https://source.invalid/messages.html?device=KIOSK_09'),
   EMPLOYEE_CONTEXT:employee,useCallback:fn=>fn,currentDeviceId:'KIOSK_08',accessEpoch:{current:1},mounted:{current:true},identityRef:{current:original},
   setIdentity:value=>{rendered=value;},api:async path=>{calls.push(path);await onApi(window,scope);return {ok:true,data:reply};}});
  vm.runInContext(source.slice(begin,end)+'\n'+guards+'\n'+work+'\n'+fallback+'\n'+load
   +'\nthis.mutate=mutateCustodialWork;this.load=loadIdentity;this.device=employeeDeviceId;this.wait=waitForEmployeeDeviceAuthority;this.paused=custodialSecurityPaused;this.native=isNativeCustodialAuthority;',scope,{timeout:1000});
  return {scope,window,storage,values,before,writes,calls,original,reply,rendered:()=>rendered};
 }
 function native(){
  const status={ready:true,available:true,quarantined:false,generation:7,deviceId:'KIOSK_08'};
  const mobile={edition:'custodial',ready:Promise.resolve(),principalIdentity:()=> 'source-principal'};
  const context={generation:7,deviceId:'KIOSK_08',assertCurrent(){}};
  const security={native:true,getStatus:()=>status,mutateProtectedWork:async operation=>operation(context)};
  return {status,mobile,security,context,window:{MemphisMobile:mobile,MemphisCustodialSecurity:security}};
 }
 const held=error=>error?.code==='custodial_security_state_unavailable';
 const preserved=x=>{assert.deepEqual(x.values,x.before);assert.equal(x.writes.length,0);assert.equal(x.scope.identityRef.current,x.original);assert.equal(x.rendered(),x.original);};
 async function check(name,body){if(requested&&requested!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_CHATSCOPE_SOURCE_VM_ONLY'}));}
 await check('recognized-preboot-blocks-work-device-and-sender',async()=>{
  for(const make of marked)for(const security of [undefined,null,{},'malformed',{native:false},{native:true},{native:true,mutateProtectedWork:1}]){
   const x=fixture({...make(),MemphisCustodialSecurity:security});let operations=0;
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;x.storage.setItem('mz_chatscope_outbox:original','changed');}),held);
   await assert.rejects(()=>x.scope.load(),held);assert.throws(()=>x.scope.device(),held);assert.equal(await x.scope.paused(),true);
   assert.equal(operations,0);assert.equal(x.calls.length,0);preserved(x);
  }
 });
 await check('native-delegation-and-admission-drift',async()=>{
  const n=native(),x=fixture(n.window),options={requireEnrollment:true,expectedGeneration:7};let calls=0,operations=0;
  n.security.mutateProtectedWork=async function(operation,supplied){calls++;assert.equal(this,n.security);assert.equal(supplied,options);return operation(n.context);};
  assert.equal(await x.scope.mutate(context=>{assert.equal(context,n.context);operations++;return 'source result';},options),'source result');
  assert.equal(calls,1);assert.equal(operations,1);preserved(x);
  let admit;const pendingNative=native(),pending=fixture(pendingNative.window);
  pendingNative.security.mutateProtectedWork=async operation=>{await new Promise(resolve=>{admit=resolve;});return operation(pendingNative.context);};
  let stale=0;const operation=pending.scope.mutate(()=>{stale++;});delete pending.window.MemphisCustodialSecurity;admit();
  await assert.rejects(()=>operation,held);assert.equal(stale,0);preserved(pending);
 });
 await check('native-hints-and-getter-loss-never-reopen-web',async()=>{
  for(const make of marked){const x=fixture(make());assert.equal(x.scope.native(),true);
   delete x.window.MemphisMobile;delete x.window.MemphisMobileBuildIdentity;delete x.window.Capacitor;
   await assert.rejects(()=>x.scope.mutate(()=>x.storage.setItem('mz_chatscope_outbox:original','changed')),held);
   await assert.rejects(()=>x.scope.load(),held);assert.throws(()=>x.scope.device(),held);preserved(x);
  }
  for(const field of ['MemphisCustodialSecurity','MemphisMobile','MemphisMobileBuildIdentity','Capacitor']){
   const window={};Object.defineProperty(window,field,{configurable:true,get(){throw Error('source unreadable runtime');}});
   const x=fixture(window);await assert.rejects(()=>x.scope.mutate(()=>{}),held);delete window[field];
   await assert.rejects(()=>x.scope.load(),held);assert.equal(x.scope.native(),true);preserved(x);
  }
 });
 await check('identity-await-does-not-adopt-bootstrap-or-successor',async()=>{
  const arriving=fixture({},async window=>{window.MemphisMobileBuildIdentity={edition:'custodial'};});
  await assert.rejects(()=>arriving.scope.load(),held);assert.equal(arriving.calls.length,1);preserved(arriving);
  for(const kind of ['security','mobile','device','generation','principal','getStatus','unreadable']){
   const n=native(),x=fixture(n.window,async window=>{
    if(kind==='security')window.MemphisCustodialSecurity={...n.security};
    if(kind==='mobile')window.MemphisMobile={...n.mobile};
    if(kind==='device')n.status.deviceId='KIOSK_09';if(kind==='generation')n.status.generation++;
    if(kind==='principal')n.mobile.principalIdentity=()=> 'source successor';
    if(kind==='getStatus')n.security.getStatus=()=>n.status;
    if(kind==='unreadable')Object.defineProperty(window,'MemphisCustodialSecurity',{get(){throw Error('unreadable after await');}});
   });
   await assert.rejects(()=>x.scope.load(),held,kind);assert.equal(x.calls.length,1);preserved(x);
  }
 });
 await check('current-native-read-never-raw-writes-sender',async()=>{
  const n=native(),x=fixture(n.window);const mapped=await x.scope.load();
  assert.equal(mapped.msg_user_id,x.reply.msg_user_id);assert.equal(x.scope.identityRef.current,mapped);assert.equal(x.rendered(),mapped);
  assert.equal(x.calls.length,1);assert.deepEqual(x.values,x.before);assert.equal(x.writes.length,0);assert.equal(x.scope.device(),'KIOSK_08');
 });
 await check('stale-device-prop-cannot-borrow-current-native-mapping',async()=>{
  const n=native(),x=fixture(n.window);x.scope.currentDeviceId='KIOSK_09';
  await assert.rejects(()=>x.scope.load(),held);assert.equal(x.calls.length,0);preserved(x);
 });
 await check('unmarked-manager-web-preserves-normal-compatibility',async()=>{
  for(const window of [{},{MemphisCustodialSecurity:{native:false}},{Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'},MemphisAuth:{isReadOnlySession:()=>true}}]){
   const x=fixture(window);assert.equal(await x.scope.mutate(()=> 'ordinary web'),'ordinary web');const mapped=await x.scope.load();
   assert.equal(x.writes.length,1);assert.equal(x.writes[0].key,'mz_messenger_user_id');assert.equal(mapped.read_only,window.MemphisAuth?true:false);
   for(const [key,value]of x.before)if(key!=='mz_messenger_user_id')assert.equal(x.values.get(key),value);
  }
 });
 await check('native-employee-bootstrap-does-not-install-web-ready-bridge',async()=>{
  const x=fixture({MemphisMobileBuildIdentity:{edition:'custodial'}},undefined,true);
  assert.equal(x.window.MemphisMobile,undefined);await assert.rejects(()=>x.scope.wait(),held);preserved(x);
  let release;const n=native();n.mobile.ready=new Promise(resolve=>{release=resolve;});
  const y=fixture(n.window),pending=y.scope.wait();y.window.MemphisMobile={...n.mobile};release();
  await assert.rejects(()=>pending,held);preserved(y);
 });
 assert.ok(completed.length>0,'Unknown/empty ChatScope bootstrap selector');
 console.log(JSON.stringify({status:'CHATSCOPE_NATIVE_BOOTSTRAP_SOURCE_VM_PASS',groups:completed.length,cases:completed,
  actual_shipping_callbacks:true,ports_and_storage_synthetic:true,old_cases_executed:0,real_native_auth:false,browser:false,SQL:false,phone:false}));
}

async function nativeMessengerBootstrapWriterGateCases(){
 const legacy=readFileSync(join(root,'messages-app.js'),'utf8');
 const helpers=legacy.slice(legacy.indexOf('  async function custodialSecurityPaused()'),legacy.indexOf('  function escapeHtml('));
 const device=legacy.slice(legacy.indexOf('  function resolveDeviceId()'),legacy.indexOf('  function roleTitle('));
 const role=legacy.slice(legacy.indexOf('  function roleTitle('),legacy.indexOf('  async function managerHeaders('));
 const employee=legacy.slice(legacy.indexOf('  function custodialEmployeeMessage()'),legacy.indexOf('  function isUuid('));
 const identity=legacy.slice(legacy.indexOf('  async function loadIdentity()'),legacy.indexOf('  async function loadThreads('));
 assert.ok(helpers.includes('async function mutateCustodialWork(')&&device.includes('function resolveDeviceId(')&&identity.includes('async function loadIdentity('));
 const requested=process.argv.find(arg=>arg.startsWith('--native-bootstrap-case='))?.slice('--native-bootstrap-case='.length),completed=[];
 const marked=[
  ['mobile',()=>({MemphisMobile:{edition:'custodial'}})],
  ['build',()=>({MemphisMobileBuildIdentity:{edition:'custodial'}})],
  ['native-platform',()=>({Capacitor:{isNativePlatform:()=>true}})],
  ['android-platform',()=>({Capacitor:{getPlatform:()=> 'android'}})],
  ['ios-platform',()=>({Capacitor:{getPlatform:()=> 'ios'}})],
  ['unreadable-platform',()=>({Capacitor:{isNativePlatform:()=>{throw Error('SYNTHETIC_UNREADABLE_PLATFORM');}}})],
 ];
 const unavailable=[undefined,null,{native:false},{native:'true',mutateProtectedWork:()=>{throw Error('not admitted');}},
  {native:true},{native:true,mutateProtectedWork:1}];
 function fixture(window={},onApi=async()=>{}){
  const originalIdentity={msg_user_id:'original-sender'},reply={msg_user_id:'replacement-sender',display_name:'Synthetic source identity',role:'manager'};
  const values=new Map([['mz_messenger_user_id','original-sender'],['memphisAssignedDeviceId','original-device'],
   ['mz_scan_device_id','original-device'],['mz_messenger_v2_outbox:original','{ "original": "unknown outcome" }'],
   ['mz_messenger_v2_draft:original','original draft'],['unrecognized-protected-row','original unknown']]);
  const original=new Map(values),writes=[],apiCalls=[];
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value:String(value)});values.set(key,String(value));},removeItem:key=>{writes.push({key,remove:true});values.delete(key);}};
  const scope=vm.createContext({window,localStorage:storage,URL,location:{href:'https://source.invalid/messages.html?hub=manager&device=changed-device'},
   Error,Object,String,Array,JSON,Number,state:{hub:'manager',deviceId:'original-device',identity:originalIdentity},els:{identity:{textContent:'original label'}},
   api:async(path,options)=>{apiCalls.push({path,options});await onApi(window);return {ok:true,data:reply};}});
  vm.runInContext(helpers+'\n'+device+'\n'+role+'\n'+identity+'\n'+employee+'\nthis.mutate=mutateCustodialWork;this.resolveDevice=resolveDeviceId;this.load=loadIdentity;this.pauseError=securityPauseError;this.paused=custodialSecurityPaused;this.employee=custodialEmployeeMessage;',scope);
  return {scope,storage,values,original,writes,apiCalls,originalIdentity,reply};
 }
 const held=error=>error?.code==='custodial_security_state_unavailable';
 async function check(name,body){if(requested&&requested!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));}
 await check('recognized-bootstrap-refuses-raw-work',async()=>{
  for(const [marker,make]of marked)for(const security of unavailable){
   const x=fixture({...make(),MemphisCustodialSecurity:security});let operations=0,rejection;
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;x.storage.setItem('mz_messenger_v2_outbox:original','must not run');}),error=>{rejection=error;return held(error);},marker);
   assert.equal(operations,0);assert.equal(x.scope.pauseError(rejection),true);assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
  }
 });
 await check('native-writer-is-the-only-callback-route',async()=>{
  for(const reject of [false,true]){
   let calls=0,operations=0,originalOperation,originalOptions;const refusal=Object.assign(Error('SYNTHETIC_RUNTIME_DENIAL'),{code:'custodial_device_not_enrolled'}),context={source_only:true};
   const security={native:true,mutateProtectedWork:async function(operation,options){assert.equal(this,security);calls++;assert.equal(operation,originalOperation);assert.equal(options,originalOptions);if(reject)throw refusal;return operation(context);}};
   const x=fixture({MemphisMobile:{edition:'custodial'},MemphisCustodialSecurity:security});
   originalOptions={requireEnrollment:true,expectedGeneration:7};originalOperation=arg=>{assert.equal(arg,context);operations++;return 'source callback result';};
   if(reject)await assert.rejects(()=>x.scope.mutate(originalOperation,originalOptions),error=>error===refusal);
   else assert.equal(await x.scope.mutate(originalOperation,originalOptions),'source callback result');
   assert.equal(calls,1);assert.equal(operations,reject?0:1);assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
  }
 });
 await check('recognized-bootstrap-preserves-sender-and-device-bindings',async()=>{
  for(const [,make]of marked)for(const security of unavailable){
   const x=fixture({...make(),MemphisCustodialSecurity:security});
   assert.throws(()=>x.scope.resolveDevice(),held);assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
   await assert.rejects(()=>x.scope.load(),held);assert.equal(x.apiCalls.length,1);
   assert.equal(x.scope.state.identity,x.originalIdentity);assert.equal(x.scope.els.identity.textContent,'original label');
   assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
  }
 });
 await check('bootstrap-appearing-during-identity-await-cannot-write',async()=>{
  const x=fixture({},async window=>{await Promise.resolve();window.MemphisMobileBuildIdentity={edition:'custodial'};});
  await assert.rejects(()=>x.scope.load(),held);assert.equal(x.apiCalls.length,1);assert.equal(x.scope.state.identity,x.originalIdentity);
  assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
  let writerCalls=0;const native=fixture({MemphisMobile:{edition:'custodial'},MemphisCustodialSecurity:{native:true,mutateProtectedWork:async()=>{writerCalls++;},getStatus:()=>({ready:true,available:true,deviceId:'native-device'})}});
  assert.equal(native.scope.resolveDevice(),'native-device');assert.equal(await native.scope.load(),native.reply);
  assert.equal(native.scope.state.identity,native.reply);assert.equal(writerCalls,0);assert.deepEqual(native.values,native.original);assert.equal(native.writes.length,0);
 });
 await check('native-required-evidence-never-thaws',async()=>{
  for(const [name,make]of marked){
   const window={},x=fixture(window);let operations=0;
   assert.equal(await x.scope.mutate(()=> 'ordinary before evidence'),'ordinary before evidence');
   Object.assign(window,make());
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;}),held,name+' arrival');
   delete window.MemphisMobile;delete window.MemphisMobileBuildIdentity;delete window.Capacitor;
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;x.storage.setItem('mz_messenger_v2_outbox:original','must not run after evidence loss');}),held,name+' removal');
   assert.throws(()=>x.scope.resolveDevice(),held,name+' device after removal');
   await assert.rejects(()=>x.scope.load(),held,name+' sender after removal');
   assert.equal(operations,0);assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);assert.equal(x.scope.state.identity,x.originalIdentity);
  }
  for(const evidence of ['valid-native-writer','malformed-native-writer','unreadable-runtime']){
   let writerCalls=0,operations=0;const window={},x=fixture(window);
   if(evidence==='unreadable-runtime')Object.defineProperty(window,'MemphisCustodialSecurity',{configurable:true,get(){throw Error('SYNTHETIC_UNREADABLE_RUNTIME');}});
   else window.MemphisCustodialSecurity={native:true,...(evidence==='valid-native-writer'?{mutateProtectedWork:async operation=>{writerCalls++;return operation();}}:{})};
   if(evidence==='valid-native-writer')assert.equal(await x.scope.mutate(()=> 'native observation'),'native observation');
   else await assert.rejects(()=>x.scope.mutate(()=>{operations++;}),held);
   delete window.MemphisCustodialSecurity;
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;x.storage.setItem('mz_messenger_v2_outbox:original','must not run after writer loss');}),held,evidence);
   assert.throws(()=>x.scope.resolveDevice(),held);await assert.rejects(()=>x.scope.load(),held);
   assert.equal(writerCalls,evidence==='valid-native-writer'?1:0);assert.equal(operations,0);
   assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);assert.equal(x.scope.state.identity,x.originalIdentity);
  }
  for(const observer of ['status','employee-classification']){
   const window={},x=fixture(window);let operations=0;
   if(observer==='status'){
    window.MemphisCustodialSecurity={native:true,getStatus:()=>({ready:true,available:true})};
    assert.equal(await x.scope.paused(),false);delete window.MemphisCustodialSecurity;
   }else{
    window.MemphisMobileBuildIdentity={edition:'custodial'};x.scope.state.hub='employee';
    assert.equal(x.scope.employee(),true);delete window.MemphisMobileBuildIdentity;x.scope.state.hub='manager';
   }
   await assert.rejects(()=>x.scope.mutate(()=>{operations++;}),held,observer+' loss');
   assert.throws(()=>x.scope.resolveDevice(),held);await assert.rejects(()=>x.scope.load(),held);
   assert.equal(await x.scope.paused(),true);assert.equal(operations,0);assert.deepEqual(x.values,x.original);assert.equal(x.writes.length,0);
  }
 });
 await check('ordinary-unmarked-manager-web-remains-compatible',async()=>{
  for(const window of [{},{MemphisMobile:{edition:'manager'},Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}},{MemphisCustodialSecurity:{native:false}}]){
   const x=fixture(window);let operations=0;
   assert.equal(await x.scope.mutate(()=>{operations++;return 'ordinary web';}),'ordinary web');assert.equal(operations,1);
   assert.equal(x.scope.resolveDevice(),'changed-device');assert.equal(await x.scope.load(),x.reply);
   assert.deepEqual(x.writes.map(write=>write.key),['memphisAssignedDeviceId','mz_scan_device_id','mz_messenger_user_id']);
   assert.equal(x.values.get('mz_messenger_user_id'),'replacement-sender');
   for(const [key,value]of x.original)if(!x.writes.some(write=>write.key===key))assert.equal(x.values.get(key),value);
  }
 });
 assert.ok(completed.length>0,'Unknown/empty bootstrap case selector');
 console.log(JSON.stringify({status:'NATIVE_MESSENGER_BOOTSTRAP_WRITER_GATE_SOURCE_VM_PASS',groups:completed.length,cases:completed,
  actual_messages_app_functions:true,storage_API_runtime_platform_markers_synthetic:true,real_native_auth:false,SQL:false,browser:false,phone:false}));
}

async function originalReadResponseParityCases(){
 const receiptPath='/home/eric/Documents/Codex/2026-09-13/i-x20/work/autonomous-repair-20260923/overnight-readiness-20261006/lean-held-correction-integration-20261011/messenger-original-http-268-normal-store-eJVRGJnV/PRODUCT_RESULT.json';
 const receiptBytes=readFileSync(receiptPath),receiptSha=createHash('sha256').update(receiptBytes).digest('hex');
 assert.equal(receiptSha,'7e1d185c45cd93bd40b4046479594cc0cadc43732af368d6c7a370308cac4f14');
 const recorded=JSON.parse(receiptBytes);
 const outcome=recorded.outcomes.find(o=>o.original_command==='employee_message_original_read').outcome_json;
 const message=recorded.outcomes.find(o=>o.original_command==='employee_message_original_send').outcome_json.result;
 assert.equal(outcome.result.marked,1);
 assert.equal(message.id,outcome.result.through_message_id);
 // Recorded SQL/HTTP original facts, projected into the owning response shape.
 // Local principal/admission/storage/transport are synthetic, not live authority.
 const clone=value=>JSON.parse(JSON.stringify(value));
 const {principalIdentity,profileMatchesPrincipal}=await import('../mobile/src/custodial/protected-principal.js');
 const legacy=readFileSync(join(root,'messages-app.js'),'utf8'),actor=outcome.original_actor,request=outcome.original_request;
 const fixtures=[
  ['recorded exact result',e=>e,true],
  ['same result reordered',e=>({...e,data:Object.fromEntries(Object.entries(e.data).reverse())}),true],
  ['count only',e=>({...e,data:1}),false],
  ['null data',e=>({...e,data:null}),false],
  ['missing data',e=>{delete e.data;return e;},false],
  ['marked zero contradicts original one',e=>({...e,data:{...e.data,marked:0}}),false],
  ['foreign user',e=>({...e,data:{...e.data,user_id:actor.employee_id}}),false],
  ['foreign horizon',e=>({...e,data:{...e.data,through_message_id:request.thread_id}}),false],
  ['foreign thread',e=>({...e,data:{...e.data,thread_id:actor.employee_id}}),false],
  ['extra field',e=>({...e,data:{...e.data,accepted:true}}),false],
  ['incomplete count object',e=>({...e,data:{marked:1}}),false]
 ];
 const observations=[];
 for(const kind of ['chat','legacy'])for(const [name,change,accepted]of fixtures){
  const row={schema_version:'chatscope-read-outbox.v2',id:request.user_id+':'+request.thread_id,
   thread_id:request.thread_id,user_id:request.user_id,device_id:request.device_id,
   through_message_id:request.through_message_id,through_at:message.sent_at,created_at:1,
   expected_employee_id:request.expected_employee_id,expected_credential_id:request.expected_credential_id,
   expected_assignment_epoch:request.expected_assignment_epoch,security_generation:1,delivery_attempted:true};
  const key='mz_chatscope_read_outbox:'+row.id,raw=JSON.stringify(row),values=new Map([[key,raw]]),calls=[];
  const principal={schema_version:'custodial-protected-principal.v1',device_id:actor.device_id,
   employee_id:actor.employee_id,credential_id:actor.credential_id,assignment_epoch:Number(actor.assignment_epoch),
   credential_operation_id:request.thread_id,installation_seal:'synthetic-installation-seal',enrolled_at:outcome.recorded_at};
  const status={ready:true,available:true,quarantined:false,generation:1,deviceId:actor.device_id,principal};
  let mapped={msg_user_id:actor.user_id,authenticated:true,employee_id:actor.employee_id,
   credential_id:actor.credential_id,assignment_epoch:principal.assignment_epoch,canonical_device_id:actor.device_id};
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  const security={native:true,getStatus:()=>status,mutateProtectedWork:async(op,options)=>{
   assert.equal(options.requireEnrollment,true);assert.equal(options.expectedGeneration,1);
   let active=true;
   const context={generation:1,deviceId:actor.device_id,assertCurrent:()=>{
    if(!active||status.generation!==1||status.quarantined)throw Error('original admission withdrawn');
   }};
   try{return await op(context);}finally{active=false;}
  }};
  const scope=vm.createContext({localStorage:storage,window:{MemphisCustodialSecurity:security,MemphisMobile:{
   edition:'custodial',principalIdentity:()=>principalIdentity(status.principal),
   profileMatchesPrincipal:p=>profileMatchesPrincipal(p,status.principal)}},
   Date,JSON,Object,Array,Number,String,Error,EMPLOYEE_CONTEXT:true,
   state:{hub:'employee',identity:mapped,deviceId:actor.device_id},api:async(path,options)=>{
    calls.push({path,options});return change({ok:true,data:clone(outcome.result),meta:{original_outcome:clone(outcome)}});
   }});
  if(kind==='chat'){
   const start=source.indexOf('function isNativeCustodialAuthority()'),end=source.indexOf('\nfunction employeeDeviceId()',start);
   assert.ok(start>0&&end>start);
   vm.runInContext(source.slice(start,end)+'\n'+source.slice(from,to)+'\nthis.read=attemptOriginalEmployeeRead;this.owner=originalEmployeeMessageOwner;',scope);
  }else{
   const start=legacy.indexOf('  async function attemptOriginalEmployeeRead('),end=legacy.indexOf('  async function saveOriginalEmployeeRead(',start);
   assert.ok(start>0&&end>start);
   vm.runInContext(legacy.slice(legacy.indexOf('  async function custodialSecurityPaused()'),legacy.indexOf('  function escapeHtml('))+'\n'
    +legacy.slice(legacy.indexOf('  function custodialEmployeeMessage()'),legacy.indexOf('  async function api('))+'\n'
    +legacy.slice(start,end)+'\nthis.read=attemptOriginalEmployeeRead;this.owner=originalEmployeeMessageOwner;',scope);
  }
  if(kind==='chat')mapped=await openChatProfileForSourceFixture(scope,mapped);
  else mapped=await openLegacyProfileForSourceFixture(scope,mapped);
  const owner=scope.owner(mapped,actor.device_id);let held=false;
  try{await scope.read(key,row,raw,owner,kind==='chat'?()=>mapped:mapped,actor.device_id);}catch(error){
   assert.equal(error.code,'messenger_original_owner_held');held=true;
  }
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/thread/'+request.thread_id+'/read/original-outcome');
  assert.equal(calls[0].options.expectedGeneration,1);assert.equal(calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body)),Object.fromEntries(Object.entries(request).filter(([k])=>k!=='thread_id')));
  const retained=storage.getItem(key);
  assert.ok(retained===raw||retained===null,'no rewrite/adoption/retry metadata');
  observations.push({kind,name,expected_retired:accepted,retired:retained===null,original_bytes_retained:retained===raw,held});
 }
 console.log(JSON.stringify({phase:'ORIGINAL_READ_RESPONSE_PARITY',receipt_sha256:receiptSha,observations,
  actual_source_callbacks:true,recorded_original_SQL_HTTP_facts:true,storage_transport_principal_admission_synthetic:true,
  live_SQL:false,live_HTTP:false,native:false,browser:false,phone:false}));
 for(const o of observations){assert.equal(o.retired,o.expected_retired,o.kind+' '+o.name);assert.equal(o.held,!o.expected_retired);}
 console.log(JSON.stringify({status:'ORIGINAL_READ_RESPONSE_PARITY_SOURCE_PASS',cases:observations.length,
  preserved_negative_original_bytes:observations.filter(o=>!o.expected_retired).length,
  same_original_query_only:true,receipt_sha256:receiptSha,live_authority:false}));
}
const root=resolve(new URL('..',import.meta.url).pathname),nativeBootstrapOnly=process.argv.includes('--native-messenger-bootstrap-writer-gate-only'),chatBootstrapOnly=process.argv.includes('--chatscope-native-bootstrap-only'),originalWriterOnly=process.argv.includes('--chatscope-original-writer-only');
const source=nativeBootstrapOnly?'':readFileSync(join(root,'mobile/src/chatscope/app.jsx'),'utf8');
const from=source.indexOf('function outboxKey(id)'),to=source.indexOf('async function resolveAuthHeaders()',from);
const flushStart=source.indexOf('  const flushMessageOutbox = useCallback(async () => {'),flushEnd=source.indexOf('\n  const handleComposerChange',flushStart);
if(!nativeBootstrapOnly)assert.ok(from>0&&to>from&&flushStart>0&&flushEnd>flushStart);
const U='10000000-0000-4000-8000-000000000001',T='20000000-0000-4000-8000-000000000001',M='30000000-0000-4000-8000-000000000001',OTHER='40000000-0000-4000-8000-000000000001';
const entry={schema_version:'chatscope-message-outbox.v2',id:'msg:50000000-0000-4000-8000-000000000001',thread_id:T,user_id:U,device_id:'SYNTHETIC_DEVICE',body:'Synthetic saved message',memphis:false,created_at:1,security_generation:1};
const correct={id:M,thread_id:T,sender_user_id:U,body:entry.body,client_message_id:entry.id,message_type:'text',sent_at:'2026-10-07T23:00:00Z'};
async function genericManagerScope(storage,request,extra={}){
 // These generic receipt cases use the actual named-web-manager identity
 // callback. Native employee ownership has its separate current fixtures.
 const mapped={msg_user_id:U,canonical_device_id:entry.device_id,read_only:false};
 const session={token:'SYNTHETIC_GENERIC_MANAGER_TOKEN',manager_id:M,credential_id:OTHER,device_id:entry.device_id,
  expires_at:new Date(Date.now()+60000).toISOString(),role:'ops_manager',roles:['CUSTODIAL_MANAGER'],
  access_level:'full_access',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true}};
 let current=null,admissions=0,identityReads=0;
 const auth={readSession:()=>current,getDeviceId:()=>entry.device_id,isReadOnlySession:()=>current?.read_only===true,
  async requireOpsManagerSession(){admissions++;current=session;return current;}};
 const scope=vm.createContext({localStorage:storage,navigator:{onLine:true},window:{MemphisAuth:auth},
  EMPLOYEE_CONTEXT:false,Date,Set,Map,JSON,Number,String,Object,Array,Error,
  MAX_MESSAGE_LENGTH:2000,MESSAGE_OUTBOX_SCHEMA:'chatscope-message-outbox.v2',DELETE_OUTBOX_SCHEMA:'chatscope-delete-outbox.v2',
  useCallback:fn=>fn,currentDeviceId:entry.device_id,identityRef:{current:null},accessEpoch:{current:1},mounted:{current:true},
  setIdentity:()=>{},safe:e=>e?.message||String(e),...extra,
  api:async(path,options)=>{
   if(path==='/me/by-device'){
    identityReads++;assert.equal(typeof options?.assertCurrent,'function');options.assertCurrent();
    return {ok:true,data:{...mapped}};
   }
   return request(path,options);
  }});
 const nativeStart=source.indexOf('function isNativeCustodialAuthority()'),nativeEnd=source.indexOf('\nfunction employeeDeviceId()',nativeStart);
 const identityStart=source.indexOf('  const loadIdentity = useCallback('),identityEnd=source.indexOf('\n  const loadThreads =',identityStart);
 assert.ok(nativeStart>0&&nativeEnd>nativeStart&&identityStart>0&&identityEnd>identityStart);
 vm.runInContext(source.slice(nativeStart,nativeEnd)+'\n'+source.slice(from,to)+'\n'+source.slice(identityStart,identityEnd)+'\nthis.openIdentity=loadIdentity;',scope);
 await scope.openIdentity();
 assert.equal(admissions,1,'fresh existing manager-session bootstrap');assert.equal(identityReads,1,'actual current manager profile callback');
 assert.equal(scope.identityRef.current.msg_user_id,U);assert.equal(current,session);
 return scope;
}
async function run(name,envelope,memphis=false,{replaceDuringSend=false,sendError=null,changeIdentityDuringSend=false}={}){
 const saved={...entry,memphis},values=new Map([['mz_chatscope_outbox:'+saved.id,JSON.stringify(saved)]]),calls=[];let recoveries=[];
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const scope=await genericManagerScope(storage,async(path,options)=>{calls.push({path,body:options.body});if(replaceDuringSend)storage.setItem('mz_chatscope_outbox:'+saved.id,JSON.stringify({...saved,body:'Newer protected saved text'}));if(changeIdentityDuringSend)scope.identityRef.current={msg_user_id:OTHER};if(sendError)throw sendError;return envelope;},{setMessageRecoveries:x=>{recoveries=x;}});
 vm.runInContext(source.slice(flushStart,flushEnd)+'\nthis.flush=flushMessageOutbox;',scope);
 const result=await scope.flush();
 const row=storage.getItem('mz_chatscope_outbox:'+saved.id);
 return{name,calls,result:{delivered:[...result.delivered],permanentIds:[...result.permanentIds]},row:row?JSON.parse(row):null,recoveries:recoveries.length};
}
const fixtures=[
 ['missing-row',{ok:true,data:null},false,false],
 ['wrong-thread',{ok:true,data:{...correct,thread_id:OTHER}},false,false],
 ['wrong-sender',{ok:true,data:{...correct,sender_user_id:OTHER}},false,false],
 ['wrong-client-id',{ok:true,data:{...correct,client_message_id:'msg:'+OTHER}},false,false],
 ['wrong-body',{ok:true,data:{...correct,body:'Different saved message'}},false,false],
 ['wrong-message-type',{ok:true,data:{...correct,message_type:'notification'}},false,false],
 ['wrong-server-id',{ok:true,data:{...correct,id:'not-a-server-id'}},false,false],
 ['missing-memphis-user-receipt',{ok:true,data:{bot_pending:true,bot_message:correct}},true,false],
 ['ordinary-exact',{ok:true,data:correct},false,true],
 ['memphis-human-accepted-bot-pending',{ok:true,data:{user_message:correct,bot_pending:true}},true,true],
];
if(process.argv.includes('--manager-send-producer-only')||process.argv.includes('--manager-live-session-only')||process.argv.includes('--manager-destructive-session-only')||process.argv.includes('--manager-outbox-session-only')||process.argv.includes('--manager-read-session-only')||process.argv.includes('--manager-reader-session-only')){
  await managerOutboxSessionCases();
}else if(originalWriterOnly){
  await chatscopeOriginalWriterCases();
}else if(chatBootstrapOnly){
  await chatscopeNativeBootstrapCases();
}else if(process.argv.includes('--native-messenger-bootstrap-writer-gate-only')){
  await nativeMessengerBootstrapWriterGateCases();
}else if(process.argv.includes('--original-read-response-parity-only')){
  await originalReadResponseParityCases();
}else if(process.argv.includes('--original-send-delete-outcome-only')){
  await mutationOwnerCases();
}else if(process.argv.includes('--original-read-outcome-only')){
  await mutationOwnerCases();
}else if(process.argv.includes('--mutation-owner-only')){
  await mutationOwnerCases();
}else if(process.argv.includes('--original-owner-only')){
 await originalOwnerCases();
}else{
if(!process.argv.includes('--affected-only')){
const observations=[];for(const [name,envelope,memphis,accepted]of fixtures)observations.push({...await run(name,envelope,memphis),expectedAccepted:accepted});
console.log(JSON.stringify({schema:'custodial.message-outbox-retirement-observations.v1',at_utc:new Date().toISOString(),observations,actual_source_callback:true,storage_and_api_synthetic:true,real_messages:false,browser:false,phone:false}));
let checks=0;
for(const row of observations){assert.equal(row.row===null,row.expectedAccepted,row.name+' durable outbox retirement');checks++;assert.equal(row.result.delivered.length,row.expectedAccepted?1:0,row.name+' sender acceptance');checks++;assert.equal(row.calls.length,1);checks++;
 if(!row.expectedAccepted){assert.equal(row.row.id,entry.id);assert.equal(row.row.body,entry.body);assert.equal(row.result.permanentIds.length,0);checks+=3;}}
console.log(JSON.stringify({status:'MESSAGE_SEND_RETIREMENT_SOURCE_PASS',checks,original_request_identity_and_text_preserved:true,real_messages:false,browser:false,phone:false,independent_review:false}));
}
const changed=await run('same-ID-pending-text-changed-during-send',{ok:true,data:correct},false,{replaceDuringSend:true});
assert.equal(changed.row?.body,'Newer protected saved text','old accepted receipt must preserve newer pending bytes');
assert.equal(changed.result.delivered.length,0,'newer pending message is not the accepted original');
assert.equal(changed.calls.length,1);
console.log('MESSAGE_PENDING_BYTE_REPLACEMENT_PASS');
for(const status of [403,500]){
 const changed=await run('newer-bytes-during-error',null,false,{replaceDuringSend:true,sendError:Object.assign(new Error('synthetic rejection'),{status})});
 assert.equal(changed.row.body,'Newer protected saved text');assert.equal(changed.row.recovery_state,undefined);
 assert.equal(changed.result.permanentIds.length,0);assert.equal(changed.recoveries,0);assert.equal(changed.calls.length,1);
}
console.log('MESSAGE_STALE_FAILURE_PRESERVATION_PASS');
const changedIdentity=await run('identity-changed-during-rejection',null,false,{changeIdentityDuringSend:true,sendError:Object.assign(Error('synthetic denial'),{status:403})});
assert.equal(changedIdentity.row.body,entry.body);assert.equal(changedIdentity.row.recovery_state,undefined);assert.equal(changedIdentity.result.permanentIds.length,0);assert.equal(changedIdentity.calls.length,1);
console.log('MESSAGE_CHANGED_IDENTITY_FAILURE_PRESERVATION_PASS');
const bootstrapStart=source.indexOf('(async () => {\n      try {\n        await loadIdentity();');
const bootstrapEnd=source.indexOf('})();',bootstrapStart)+5;
assert.ok(bootstrapStart>0&&bootstrapEnd>bootstrapStart);
const helpCalls=[];
const helpScope=vm.createContext({selectedRef:{current:''},loadIdentity:async()=>helpCalls.push('identity'),loadThreads:async()=>helpCalls.push('threads'),resolveHomeAssistant:async()=>helpCalls.push('help'),retryOutbox:async()=>{throw Error('unrelated saved outbox refresh failed');},setNotice:()=>{},safe:e=>e.message,console:{error:()=>{}}});
vm.runInContext('this.bootstrap='+source.slice(bootstrapStart,bootstrapEnd),helpScope);
await helpScope.bootstrap;
assert.deepEqual(helpCalls,['identity','threads','help'],'explicit Ask Memphis entry precedes unrelated outbox failure');
const resumeStart=source.indexOf('    const online = () => {'),resumeEnd=source.indexOf("    window.addEventListener('online', online);",resumeStart);
assert.ok(resumeStart>0&&resumeEnd>resumeStart);
vm.runInContext(source.slice(resumeStart,resumeEnd)+'\nthis.online=online;this.resume=resumeMessenger;',helpScope);
helpScope.document={visibilityState:'visible'};helpCalls.length=0;
helpScope.online();helpScope.resume();await Promise.resolve();
assert.equal(helpCalls.filter(x=>x==='help').length,2,'online and resume help do not depend on an unrelated failed retry');
console.log('EXPLICIT_HELP_OUTBOX_INDEPENDENCE_PASS');
const retryStart=source.indexOf('  const retryOutbox = useCallback(() => {'),retryEnd=source.indexOf('\n  const discardMessageRecovery',retryStart);
assert.ok(retryStart>0&&retryEnd>retryStart);
const deletion={schema_version:'chatscope-delete-outbox.v2',id:M,thread_id:T,user_id:U,device_id:entry.device_id,created_at:1,security_generation:1};
const exactDeletion={ok:true,data:{ok:true,deleted:true,thread_id:T,user_id:U,operation_id:M,deletion_scope:'user',deleted_at:'2026-10-11T12:00:00Z',deleted_through:'2026-10-11T12:00:00Z'}};
for(const name of ['exact','wrong-thread','provider-only','changed-bytes','changed-identity','changed-bytes-rejection']){
 const key='mz_chatscope_delete_outbox:'+M,values=new Map([[key,JSON.stringify(deletion)]]);let calls=0;
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const scope=await genericManagerScope(storage,async()=>{
   calls++;if(name.startsWith('changed-bytes'))storage.setItem(key,JSON.stringify({...deletion,thread_id:OTHER}));
   if(name==='changed-identity')scope.identityRef.current={msg_user_id:OTHER};
   if(name==='changed-bytes-rejection')throw Object.assign(Error('synthetic denial'),{status:403});
   if(name==='provider-only')return {ok:true,accepted:true};
   return name==='wrong-thread'?{...exactDeletion,data:{...exactDeletion.data,thread_id:OTHER}}:exactDeletion;
 },{outboxRetryInFlight:{current:null},selectedRef:{current:''},serializeDelivery:fn=>fn(),setDeleteRecoveries:()=>{},flushReadOutbox:async()=>{},flushMessageOutbox:async()=>({foreignCount:0}),loadThreads:async()=>{},loadMessages:async()=>{},setNotice:()=>{}});
 vm.runInContext(source.slice(retryStart,retryEnd)+'\nthis.retry=retryOutbox;',scope);
 await scope.retry();assert.equal(calls,1);
 const saved=storage.getItem(key);
 assert.equal(saved===null,name==='exact',name+' only exact current original deletion may retire');
 if(name.startsWith('changed-bytes')){assert.equal(JSON.parse(saved).thread_id,OTHER);assert.equal(JSON.parse(saved).recovery_state,undefined);}
}
console.log(JSON.stringify({status:'MESSAGE_AND_DELETION_AFFECTED_CASES_PASS',at_utc:new Date().toISOString(),deletion_cases:6,message_replacement_and_failure_cases:4,help_cases:3,storage_and_api_synthetic:true,real_messages:false,browser:false,phone:false}));
}

async function originalOwnerCases(){
 const {principalIdentity,profileMatchesPrincipal}=await import('../mobile/src/custodial/protected-principal.js');
 const legacy=readFileSync(join(root,'messages-app.js'),'utf8');
 const P={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_02',employee_id:OTHER,credential_id:M,credential_operation_id:T,assignment_epoch:7,installation_seal:'synthetic-installation-seal',enrolled_at:'2026-10-12T00:00:00Z'};
 const profile=()=>({msg_user_id:U,employee_id:P.employee_id,credential_id:P.credential_id,assignment_epoch:P.assignment_epoch,canonical_device_id:P.device_id,authenticated:true});
 const rows=[];
 async function exercise(kind,options={}){
  const mapped=profile(),status={ready:true,available:true,quarantined:false,generation:options.generation??1,deviceId:P.device_id,principal:{...P}};
  if(options.missingMapping)delete mapped.credential_id;
  const saved={...entry,device_id:P.device_id,memphis:Boolean(options.memphis),...(options.pinned?{expected_employee_id:P.employee_id,expected_credential_id:P.credential_id,expected_assignment_epoch:'7'}:{}),...(options.savedChanges||{})};
  const prefix=kind==='chat'?'mz_chatscope_outbox:':'mz_messenger_v2_outbox:',key=prefix+saved.id,original=JSON.stringify(saved),values=new Map(options.producer?[]:[[key,original]]),calls=[],mutations=[],notices=[];
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(!options.failedSave)values.set(k,String(v));},removeItem:k=>values.delete(k)};
  const scope=vm.createContext({localStorage:storage,sessionStorage:storage,navigator:{onLine:true},window:{MemphisCustodialSecurity:{native:!options.nonCustodial,getStatus:()=>status,waitForStableState:async()=>{if(options.changeAtReady)status.generation++;},mutateProtectedWork:async(op,opts)=>{
   mutations.push(opts);if(options.changeAtMutation)status.generation++;
   if(opts?.expectedGeneration!=null&&opts.expectedGeneration!==status.generation)throw Object.assign(Error('changed generation'),{code:'custodial_security_generation_changed'});
   const gen=status.generation;let live=true;
   const ctx={generation:gen,deviceId:status.deviceId,...(options.missingAssert?{}:{assertCurrent:()=>{if(!live||gen!==status.generation||status.quarantined)throw Error('synthetic currentness denied');}})};
   try{return await op(ctx);}finally{live=false;}
  }},MemphisMobile:{edition:options.nonCustodial?'guest':'custodial',principalIdentity:()=>principalIdentity(status.principal),profileMatchesPrincipal:p=>profileMatchesPrincipal(p,status.principal)}},Date,Set,Map,JSON,Number,String,Object,Array,Error,MAX_MESSAGE_LENGTH:2000,MESSAGE_OUTBOX_SCHEMA:'chatscope-message-outbox.v2',DELETE_OUTBOX_SCHEMA:'chatscope-delete-outbox.v2',EMPLOYEE_CONTEXT:options.manager?false:true,useCallback:fn=>fn,currentDeviceId:P.device_id,identityRef:{current:mapped},safe:e=>e?.message||String(e),setMessageRecoveries:()=>{},crypto:{randomUUID:()=>saved.id.slice(4)},api:async(path,opts)=>{
   calls.push({path,options:opts});if(options.changeAfterSend)status.generation++;
   if(options.reassignAfterSend)status.principal={...P,employee_id:T,assignment_epoch:8};
   if(options.credentialAfterSend)status.principal={...P,credential_id:T};
   if(options.holdAfterSend)status.quarantined=true;
   if(options.profileAfterSend)mapped.msg_user_id=T;
   if(options.replaceAfterSend)storage.setItem(key,JSON.stringify({...saved,body:'Newer original'}));
   if(options.error)throw Object.assign(Error('ambiguous reply'),{status:503});
   const reply={...correct,body:saved.body,...(options.malformed?{client_message_id:'msg:'+OTHER}:{})};
   return {ok:true,data:options.memphis?{user_message:reply}:reply};
  }});
  scope.accessEpoch={current:1};scope.mounted={current:true};
  scope.state={hub:options.manager?'manager':'employee',identity:mapped,deviceId:P.device_id,busy:false,selectedId:T,threads:[{id:T,type:options.memphis?'bot':'direct',canSend:true}],messages:[]};
  scope.OUTBOX_PREFIX=prefix;scope.DRAFT_PREFIX='mz_messenger_v2_draft:';scope.els={input:{value:saved.body,focus:()=>{}},send:{disabled:false}};
  scope.showToast=(s)=>notices.push(s);scope.renderMessages=()=>{};scope.loadMessages=async()=>{};scope.loadThreads=async()=>{};scope.isMemphis=t=>t.type==='bot';
  scope.selectedRef={current:T};scope.threadsRef={current:scope.state.threads};scope.savingDrafts={current:new Set()};scope.draftsRef={current:{[U+':'+T]:saved.body}};scope.setNotice=s=>notices.push(s);scope.updateDraft=(k,v)=>{scope.draftsRef.current[k]=v;};scope.setComposerTooLong=()=>{};scope.setMessages=()=>{};scope.serializeDelivery=async()=>({permanentIds:new Set()});
  if(kind==='chat'){
   const producerStart=source.indexOf('  const sendMessage = useCallback(async (...args) => {'),producerEnd=source.indexOf('\n  const retryOutbox = useCallback',producerStart);
   const nativeStart=source.indexOf('function isNativeCustodialAuthority()'),nativeEnd=source.indexOf('\nfunction employeeDeviceId()',nativeStart);
   vm.runInContext(source.slice(nativeStart,nativeEnd)+'\n'+source.slice(source.indexOf('function clientMessageId()'),to)+'\n'+source.slice(flushStart,flushEnd)+'\n'+source.slice(producerStart,producerEnd)+'\nthis.flush=flushMessageOutbox;this.produce=sendMessage;',scope);
  }else{
   const helpers=legacy.slice(legacy.indexOf('  async function custodialSecurityPaused()'),legacy.indexOf('  function escapeHtml('));
   const ownStart=legacy.indexOf('  function custodialEmployeeMessage()');
   const own=ownStart<0?'':legacy.slice(ownStart,legacy.indexOf('  async function api(',ownStart));
   const start=legacy.indexOf('  function clientMessageId()'),end=legacy.indexOf('  async function openMemphis()',start);
   vm.runInContext(helpers+'\n'+own+'\n'+legacy.slice(start,end)+'\nthis.flush=retryOutbox;this.produce=sendCurrentMessage;',scope);
  }
  if(options.producer)await scope.produce(...(kind==='chat'?[saved.body,saved.body,saved.body]:[{preventDefault:()=>{}}]));else await scope.flush();
  return{calls,mutations,original,row:storage.getItem(key),values,draft:kind==='chat'?scope.draftsRef.current[U+':'+T]:scope.els.input.value,notices};
 }
 if(!process.argv.includes('--original-owner-context-only')){
 for(const kind of ['chat','legacy']){
  const r=await exercise(kind,{generation:2});
  assert.equal(r.calls.length,0,kind+' historical unpinned original must not send as successor');assert.equal(r.row,r.original,kind+' historical original bytes retained');rows.push(kind+' unpinned preserved');
  for(const [label,opts]of [
   ['original generation mismatch',{generation:2}],
   ['missing sender relationship',{missingMapping:true}],
   ['foreign original employee',{savedChanges:{expected_employee_id:T}}],
   ['numeric native epoch is not original decimal text',{savedChanges:{expected_assignment_epoch:7}}],
   ['missing operation-lifetime assertion',{missingAssert:true}],
  ]){
   const r=await exercise(kind,{pinned:true,...opts});assert.equal(r.calls.length,0,kind+' '+label+' no send');assert.equal(r.row,r.original,kind+' '+label+' preserve exact row');rows.push(kind+' '+label);
  }
  for(const [label,opts]of [
   ['successor generation during response',{changeAfterSend:true}],
   ['employee reassignment during response',{reassignAfterSend:true}],
   ['credential replacement during response',{credentialAfterSend:true}],
   ['profile sender changed during response',{profileAfterSend:true}],
   ['preservation hold during response',{holdAfterSend:true}],
   ['malformed original receipt',{malformed:true}],
   ['ambiguous response',{error:true}],
  ]){
   const r=await exercise(kind,{pinned:true,...opts});assert.equal(r.calls.length,1,kind+' '+label+' original request only');assert.equal(r.row,r.original,kind+' '+label+' byte-identical pending');rows.push(kind+' '+label);
  }
  const replacement=await exercise(kind,{pinned:true,replaceAfterSend:true});assert.equal(JSON.parse(replacement.row).body,'Newer original');rows.push(kind+' newer bytes retained');
  for(const memphis of [false,true]){
   const r=await exercise(kind,{pinned:true,memphis});assert.equal(r.calls.length,1);assert.equal(r.row,null);
   const {options}=r.calls[0];assert.equal(options.expectedGeneration,1);assert.equal(options.body.expected_employee_id,P.employee_id);assert.equal(options.body.expected_credential_id,P.credential_id);assert.equal(options.body.expected_assignment_epoch,'7');assert.equal(options.body.client_message_id,entry.id);assert.equal(options.body.body,entry.body);assert.equal(options.body.device_id,P.device_id);assert.equal(options.body[memphis?'user_id':'sender_user_id'],U);
   rows.push(kind+' '+(memphis?'Memphis':'ordinary')+' exact original typed receipt');
  }
  for(const [label,opts]of [
   ['mapping unavailable',{missingMapping:true}],['generation changes while readiness awaits',{changeAtReady:true}],
   ['generation changes at protected save',{changeAtMutation:true}],['save not durable',{failedSave:true}],
  ]){
   const r=await exercise(kind,{producer:true,...opts});assert.equal(r.calls.length,0,kind+' '+label+' no request');assert.equal(r.row,null);assert.equal(r.draft,entry.body,kind+' '+label+' draft retained');rows.push(kind+' '+label+' producer held');
  }
  const saved=await exercise(kind,{producer:true,malformed:true});
  const row=JSON.parse(saved.row);assert.equal(row.user_id,U);assert.equal(row.device_id,P.device_id);assert.equal(row.expected_employee_id,P.employee_id);assert.equal(row.expected_credential_id,P.credential_id);assert.equal(row.expected_assignment_epoch,'7');assert.equal(row.security_generation,1);assert.equal(row.body,entry.body);assert.equal(row.id,entry.id);assert.equal(row.identity,undefined);assert.equal(row.principal,undefined);assert.equal(row.installation_seal,undefined);
  rows.push(kind+' producer original pins no private principal storage');
  const manager=await exercise(kind,{manager:true});assert.equal(manager.calls.length,1);assert.equal(manager.row,null);assert.equal(manager.calls[0].options.body.expected_employee_id,undefined);rows.push(kind+' unaffected manager message');
 }
 // Execute each actual API wrapper, not a replacement forwarding callback.
 for(const kind of ['chat','legacy']){
  const target=kind==='chat'?source:legacy,start=target.indexOf(kind==='chat'?'async function api(':'  async function api('),end=target.indexOf(kind==='chat'?'\nfunction NewConversation(':'  function query(',start);
  const calls=[],scope=vm.createContext({window:{MemphisMobile:{requestEnvelope:async(path,opts)=>{calls.push({path,opts});return{ok:true,data:null};}}},AbortController,DOMException,setTimeout,clearTimeout,activeMessengerRequests:new Set(),custodialEmployeeMessage:()=>true,originalMessageHeld:()=>Error('original held')});
  vm.runInContext(target.slice(start,end)+'\nthis.call=api;',scope);
  await scope.call('/thread/'+T+'/message',{method:'POST',body:{client_message_id:entry.id},expectedGeneration:17});assert.equal(calls[0].opts.expectedGeneration,17);assert.equal(calls[0].path,'/messaging-api/thread/'+T+'/message');
  await scope.call('/me/by-device');assert.equal(Object.hasOwn(calls[1].opts,'expectedGeneration'),false);
  delete scope.window.MemphisMobile.requestEnvelope;
  await assert.rejects(scope.call('/thread/'+T+'/message',{method:'POST',expectedGeneration:17}),/original held/);
  rows.push(kind+' actual normal dispatch expectedGeneration and no employee raw fallback');
 }
 const noticeStart=source.indexOf('  const setNotice = useCallback((text, kind ='),noticeEnd=source.indexOf('\n  const serializeDelivery =',noticeStart),display=[];
 const noticeScope=vm.createContext({EMPLOYEE_CONTEXT:true,useCallback:fn=>fn,setStatus:text=>display.push(text),setStatusKind:()=>{},setTimeout,mounted:{current:true}});
 vm.runInContext(source.slice(noticeStart,noticeEnd)+'\nthis.notice=setNotice;',noticeScope);
 for(const text of ['Original employee identity is unavailable. Your draft has not been sent.','Message save could not be confirmed. Your draft remains.','Your message is saved. Server confirmation is still pending.']){noticeScope.notice(text,'error');assert.equal(display.at(-1),text);}
 noticeScope.notice('untrusted provider or private exception text','error');assert.equal(display.at(-1),'Something went wrong. Try again.');
 rows.push('chat actual employee notice preserves only fixed original pending/draft wording');
 }
 for(const kind of ['chat','legacy']){
  for(const manager of [false,true]){
   const r=await exercise(kind,{nonCustodial:true,manager});assert.equal(r.calls.length,1);assert.equal(r.row,null);assert.equal(r.calls[0].options.body.expected_employee_id,undefined);rows.push(kind+' non-Custodial '+(manager?'guest/manager':'employee')+' existing request');
  }
  const partial=await exercise(kind,{manager:true,savedChanges:{expected_credential_id:P.credential_id}});assert.equal(partial.calls.length,0);assert.equal(partial.row,partial.original);rows.push(kind+' partial employee pins not adopted by manager');
 }
 console.log(JSON.stringify({status:'ORIGINAL_MESSENGER_OWNER_SOURCE_PASS',cases:rows,actual_product_callbacks:true,principal_utility_actual:true,storage_transport_synthetic:true,real_messages:false,browser:false,native:false}));
}

async function mutationOwnerCases(){
 const {principalIdentity,profileMatchesPrincipal}=await import('../mobile/src/custodial/protected-principal.js');
 const legacy=readFileSync(join(root,'messages-app.js'),'utf8');
 const P={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_02',employee_id:OTHER,credential_id:M,credential_operation_id:T,assignment_epoch:7,installation_seal:'synthetic-installation-seal',enrolled_at:'2026-10-12T00:00:00Z'};
 const observations=[];
 if(process.argv.includes('--mutation-owner-controls-only')){
  const menuStart=source.indexOf('deleteRecoveries.filter(recovery => !recovery.originalOwnerHeld)'),menuExpression=source.slice(menuStart,menuStart+'deleteRecoveries.filter(recovery => !recovery.originalOwnerHeld)'.length);
  const menuScope=vm.createContext({deleteRecoveries:[{key:'held',originalOwnerHeld:true},{key:'approved-manager'}]});
  const visible=vm.runInContext(menuExpression,menuScope);assert.equal(visible.length,1);assert.equal(visible[0].key,'approved-manager');
  const start=source.indexOf('  const discardDeleteRecovery = useCallback'),end=source.indexOf('\n  const deleteThread =',start),saved=new Map([['mz_chatscope_delete_outbox:'+M,'original']]);let effects=0;
  const scope=vm.createContext({EMPLOYEE_CONTEXT:false,useCallback:fn=>fn,currentDeviceId:P.device_id,identityRef:{current:null},accessEpoch:{current:1},mounted:{current:true},window:{MemphisCustodialSecurity:{native:true,mutateProtectedWork:async fn=>{effects++;return fn();}}},confirm:()=>{effects++;return true;},localStorage:{getItem:k=>saved.get(k),removeItem:k=>saved.delete(k)},setDeleteRecoveries:()=>{},setNotice:()=>{}});
  const nativeStart=source.indexOf('function isNativeCustodialAuthority()'),nativeEnd=source.indexOf('\nfunction employeeDeviceId()',nativeStart);
  vm.runInContext(source.slice(nativeStart,nativeEnd)+'\n'+source.slice(from,to)+'\n'+source.slice(start,end)+'\nthis.discard=discardDeleteRecovery;',scope);
  await scope.discard({key:'mz_chatscope_delete_outbox:'+M,raw:JSON.stringify({expected_employee_id:OTHER})});assert.equal(effects,0);assert.equal(saved.size,1);
  const noticeStart=source.indexOf('  const setNotice = useCallback'),noticeEnd=source.indexOf('\n  const serializeDelivery',noticeStart),messages=[];
  const notices=vm.createContext({EMPLOYEE_CONTEXT:true,useCallback:fn=>fn,setStatus:t=>messages.push(t),setStatusKind:()=>{},setTimeout,mounted:{current:true}});
  vm.runInContext(source.slice(noticeStart,noticeEnd)+'\nthis.notice=setNotice;',notices);
  for(const text of ['Server confirmation is still pending.','Conversation removal is saved. Server confirmation is still pending.','Original employee identity is unavailable. Conversation removal has not been sent.','Conversation removal save could not be confirmed. Original requests remain protected.']){notices.notice(text,'error');assert.equal(messages.at(-1),text);}
  console.log(JSON.stringify({status:'MUTATION_ORIGINAL_CONTROLS_SOURCE_PASS',cases:6,scope:'actual changed recovery-menu expression, discard callback and notice callback; synthetic UI inputs',native:false,browser:false}));return;
 }
 async function exercise(kind,action,opts={}){
  const current=opts.successor?{...P,credential_id:T,assignment_epoch:8}:{...P};
  const status={ready:true,available:true,quarantined:false,generation:opts.successor?2:1,deviceId:P.device_id,principal:current};
  let mapped={msg_user_id:U,authenticated:true,employee_id:current.employee_id,credential_id:current.credential_id,assignment_epoch:current.assignment_epoch,canonical_device_id:P.device_id};
  if(opts.missingMapping)delete mapped.credential_id;
  const readKey='mz_chatscope_read_outbox:'+U+':'+T,deleteKey='mz_chatscope_delete_outbox:'+M,sendId='msg:'+M,sendKey=(kind==='chat'?'mz_chatscope_outbox:':'mz_messenger_v2_outbox:')+sendId,key=action==='read'?readKey:action==='send'?sendKey:deleteKey;
  const saved={schema_version:action==='read'?'chatscope-read-outbox.v2':action==='send'?(opts.oldSend?'chatscope-message-outbox.v2':'chatscope-message-outbox.v3'):(opts.newDelete?'chatscope-delete-outbox.v3':'chatscope-delete-outbox.v2'),id:action==='read'?U+':'+T:action==='send'?sendId:M,thread_id:T,user_id:U,device_id:P.device_id,security_generation:1,created_at:1,...(action==='read'?{through_message_id:M,through_at:'2026-10-12T01:00:00Z'}:action==='send'?{body:'Original synthetic text',memphis:Boolean(opts.memphis),message_type:'text',metadata_json:{}}:{}),...(opts.pinned?{expected_employee_id:P.employee_id,expected_credential_id:P.credential_id,expected_assignment_epoch:'7'}:{}),...(opts.savedChanges||{})};
  const original=JSON.stringify(saved),values=new Map(opts.producer?[]:[[key,opts.malformedStored?'not-json-original':original]]),calls=[],mutations=[],notices=[];
  if(opts.existing)values.set(key,opts.existing==='malformed'?'original-malformed':original);
  const heldKey=(kind==='chat'?'mz_chatscope_outbox:':'mz_messenger_v2_outbox:')+'msg:'+OTHER;
  const heldOriginal=JSON.stringify({...saved,schema_version:'chatscope-message-outbox.v2',id:'msg:'+OTHER,body:'Older untracked original',created_at:0});
  if(opts.heldOlderSend)values.set(heldKey,heldOriginal);
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(!opts.failedSave)values.set(k,String(v));},removeItem:k=>{if(!opts.failedRemoval)values.delete(k);}};
  const security={native:!opts.nonCustodial,getStatus:()=>status,waitForStableState:async()=>{},mutateProtectedWork:async(op,options)=>{
   mutations.push(options);
   if(opts.deleteArrivesAtAdmission&&mutations.length===1)values.set('mz_chatscope_delete_outbox:'+OTHER,
     JSON.stringify({...saved,id:OTHER,thread_id:opts.foreignArrivingDeletion?OTHER:saved.thread_id,delivery_attempted:true}));
   if(opts.changeAtMutation || (opts.changeAtRetirement && mutations.length===2))status.generation++;
   if(options?.expectedGeneration!=null&&options.expectedGeneration!==status.generation)throw Error('original generation changed');
   const captured=status.generation;let live=true;
   const ctx={generation:captured,deviceId:status.deviceId,assertCurrent:()=>{if(!live||captured!==status.generation||status.quarantined)throw Error('original admission held');}};
   try{return await op(ctx);}finally{live=false;}
  }};
  const scope=vm.createContext({localStorage:storage,sessionStorage:storage,navigator:{onLine:true},window:{MemphisCustodialSecurity:security,MemphisMobile:{edition:opts.nonCustodial?'guest':'custodial',principalIdentity:()=>principalIdentity(status.principal),profileMatchesPrincipal:p=>profileMatchesPrincipal(p,status.principal)}},Date,Set,Map,JSON,Number,String,Object,Array,Error,crypto:{randomUUID:()=>M},MAX_MESSAGE_LENGTH:2000,MESSAGE_OUTBOX_SCHEMA:'chatscope-message-outbox.v2',DELETE_OUTBOX_SCHEMA:'chatscope-delete-outbox.v2',EMPLOYEE_CONTEXT:!opts.manager,useCallback:fn=>fn,currentDeviceId:P.device_id,identityRef:{current:mapped},accessEpoch:{current:1},mounted:{current:true},setHeldReadOriginals:()=>{},threadsRef:{current:[{id:T,title:'Synthetic thread',canSend:true}]},selectedRef:{current:''},mobileThreadRef:{current:false},outboxRetryInFlight:{current:null},serializeDelivery:op=>op(),setMessageRecoveries:()=>{},setDeleteRecoveries:()=>{},setNotice:t=>notices.push(t),setThreads:()=>{},setSelectedId:()=>{},setMessages:()=>{},setMobileThread:()=>{},loadThreads:async()=>{},loadMessages:async()=>{},flushMessageOutbox:async()=>({foreignCount:0}),safe:e=>e?.message||String(e),confirm:()=>true,api:async(path,options)=>{
   if(opts.producer&&action==='send'&&options?.method!=='POST'){
    if(opts.refreshFailure){if(opts.refreshOwnerLoss)status.generation++;throw Error('SYNTHETIC_POST_RECEIPT_REFRESH_FAILURE');}
    return {ok:true,data:[]};
   }
   calls.push({path,options});
   if(opts.changeAfterSend)status.generation++;
   if(opts.credentialAfterSend)status.principal={...P,credential_id:T,assignment_epoch:8};
   if(opts.profileAfterSend)mapped.msg_user_id=T;
   if(opts.holdAfterSend)status.quarantined=true;
   if(opts.replaceAfterSend)storage.setItem(key,JSON.stringify({...saved,created_at:999}));
   if(opts.removeAfterSend)values.delete(key);
   if(opts.error)throw Object.assign(Error('uncertain response'),{status:503});
   if(opts.outcomeEnvelope)return opts.outcomeEnvelope(opts.producer?JSON.parse(storage.getItem(key)):saved,path,options,JSON.parse(storage.getItem(key)),calls.length);
   if(action==='read')return opts.readEnvelope ? opts.readEnvelope(opts.producer?JSON.parse(storage.getItem(key)):saved,path,calls.length) : {ok:true,data:opts.readData??0};
   return {ok:true,data:{ok:true,deleted:true,thread_id:T,user_id:U,operation_id:M,deletion_scope:'user',deleted_at:'2026-10-12T02:00:00Z',deleted_through:'2026-10-12T02:00:00Z',...(opts.wrongReceipt?{operation_id:OTHER}:{})}};
  }});
  scope.state={hub:opts.manager?'manager':'employee',identity:mapped,deviceId:P.device_id,threads:[{id:T,title:'Synthetic thread',canSend:true}],selectedId:T,messages:[]};
  scope.OUTBOX_PREFIX='mz_messenger_v2_outbox:';scope.DRAFT_PREFIX='mz_messenger_v2_draft:';scope.isMemphis=()=>false;scope.isRetiredSystemThread=()=>false;scope.showToast=t=>notices.push(t);scope.closeThread=()=>{scope.state.selectedId='';};scope.renderMessages=()=>{};scope.query=(p)=>p;
  scope.els={input:{value:'Original synthetic text',focus:()=>{}},send:{disabled:false}};
  scope.savingDrafts={current:new Set()};scope.draftsRef={current:{[U+':'+T]:'Original synthetic text'}};
  scope.updateDraft=(k,v)=>{scope.draftsRef.current[k]=v;};scope.setComposerTooLong=()=>{};
  const messageUpdates=[],threadUpdates=[],selectionUpdates=[],mobileUpdates=[],deletionRecoveryUpdates=[],refreshCalls=[];
  scope.setMessages=update=>messageUpdates.push(update);scope.setThreads=update=>threadUpdates.push(update);
  scope.setSelectedId=update=>selectionUpdates.push(update);scope.setMobileThread=update=>mobileUpdates.push(update);
  scope.setDeleteRecoveries=update=>deletionRecoveryUpdates.push(update);
  const withdraw=(loss='generation')=>{
   if(loss==='epoch')scope.accessEpoch.current++;
   else if(loss==='unmount')scope.mounted.current=false;
   else if(loss==='credential')status.principal={...status.principal,credential_id:T};
   else if(loss==='mapping')scope.identityRef.current={...mapped};
   else status.generation++;
  };
  if(opts.postDeliveryOwnerLoss)scope.loadThreads=async()=>{refreshCalls.push('threads');withdraw(opts.postDeliveryOwnerLoss);};
  if(opts.deleteRefreshOwnerLoss) {
   scope.selectedRef.current=T;
   scope.loadMessages=async()=>{refreshCalls.push('messages');if(opts.deleteRefreshOwnerLoss.at==='messages')withdraw(opts.deleteRefreshOwnerLoss.loss);};
   scope.loadThreads=async()=>{refreshCalls.push('threads');if(opts.deleteRefreshOwnerLoss.at==='threads')withdraw(opts.deleteRefreshOwnerLoss.loss);};
  }
  if(opts.captureDeleteUI)scope.selectedRef.current=T;
  if(opts.foreignSavedSender)values.set('mz_chatscope_outbox:msg:'+OTHER,JSON.stringify({...entry,id:'msg:'+OTHER,user_id:OTHER,device_id:P.device_id}));
  if(opts.producer&&action==='send')scope.selectedRef.current=T;
  if(kind==='chat'){
   const nativeStart=source.indexOf('function isNativeCustodialAuthority()'),nativeEnd=source.indexOf('\nfunction employeeDeviceId()',nativeStart);
   const readsStart=source.indexOf('  const flushReadOutbox = useCallback'),readsEnd=source.indexOf('\n  const loadMessages =',readsStart);
   const retryStart=source.indexOf('  const retryOutbox = useCallback'),retryEnd=source.indexOf('\n  const discardMessageRecovery',retryStart);
   const deleteStart=source.indexOf('  const deleteThread = useCallback'),deleteEnd=source.indexOf('\n  useEffect',deleteStart);
   const producerStart=source.indexOf('  const sendMessage = useCallback'),producerEnd=source.indexOf('\n  const retryOutbox =',producerStart);
   vm.runInContext(source.slice(nativeStart,nativeEnd)+'\n'+source.slice(source.indexOf('function clientMessageId()'),to)+'\n'+source.slice(readsStart,readsEnd)+'\n'+source.slice(flushStart,flushEnd)+'\n'+(action==='send'?source.slice(producerStart,producerEnd):'')+'\n'+source.slice(retryStart,retryEnd)+'\n'+source.slice(deleteStart,deleteEnd)+'\nthis.flush=retryOutbox;this.read=flushReadOutbox;this.produceRead=markRead;this.produceDelete=deleteThread;'+(action==='send'?'this.produceSend=sendMessage;':''),scope);
   mapped=await openChatProfileForSourceFixture(scope,mapped);
   if(opts.producer){if(action==='read')await scope.produceRead({id:T},{id:M,thread_id:opts.foreignThrough?OTHER:T,sent_at:'2026-10-12T01:00:00Z'});else if(action==='send')await scope.produceSend('Original synthetic text','Original synthetic text','Original synthetic text');else await scope.produceDelete(T);}else if(action==='read')await scope.read();else await scope.flush();
   if(opts.repeat){if(action==='read')await scope.read();else await scope.produceDelete(T);}
   if(opts.repeatFlush)await scope.flush();
  }else{
   const helpers=legacy.slice(legacy.indexOf('  async function custodialSecurityPaused()'),legacy.indexOf('  function escapeHtml('));
   const owner=legacy.slice(legacy.indexOf('  function custodialEmployeeMessage()'),legacy.indexOf('  async function api('));
   const start=legacy.indexOf('  function clientMessageId()'),end=legacy.indexOf('  async function openMemphis()',start);
   const loadStart=legacy.indexOf('  async function loadMessages('),loadEnd=legacy.indexOf('  function renderMessages()',loadStart);
   const deleteStart=legacy.indexOf('  async function deleteCurrentThread()'),deleteEnd=legacy.indexOf('  async function refresh()',deleteStart);
   vm.runInContext(helpers+'\n'+owner+'\n'+legacy.slice(start,end)+'\n'+legacy.slice(loadStart,loadEnd)+'\n'+legacy.slice(deleteStart,deleteEnd)+'\nthis.flush=retryOutbox;this.produceDelete=deleteCurrentThread;this.produceRead=loadMessages;',scope);
   mapped=await openLegacyProfileForSourceFixture(scope,mapped);
   if(opts.producer&&action==='read'){
    const transport=scope.api;scope.api=async(path,options)=>path.includes('/messages')?{ok:true,data:[{id:M,sent_at:'2026-10-12T01:00:00Z',thread_id:T}]}:transport(path,options);
    await scope.produceRead(T);
   }else if(opts.producer&&action==='send')await scope.sendCurrentMessage({preventDefault:()=>{}});else if(opts.producer)await scope.produceDelete();else await scope.flush();
   if(opts.repeat){if(action==='read')await scope.flush();else await scope.produceDelete();}
   if(opts.repeatFlush)await scope.flush();
  }
  return{calls,mutations,row:storage.getItem(key),values,original,notices,heldOriginal,heldRow:storage.getItem(heldKey),messageUpdates,threadUpdates,selectionUpdates,mobileUpdates,deletionRecoveryUpdates,refreshCalls,withdraw};
 }
 if(process.argv.includes('--original-send-delete-outcome-only')){
  const exact=(row,kind)=>{
   const request={device_id:row.device_id,expected_employee_id:row.expected_employee_id,expected_credential_id:row.expected_credential_id,
    expected_assignment_epoch:row.expected_assignment_epoch,user_id:row.user_id,thread_id:row.thread_id,
    ...(kind==='send'?{body:row.body,message_type:'text',metadata_json:{},client_message_id:row.id}:{operation_id:row.id})};
   const result=kind==='send'?{id:OTHER,thread_id:row.thread_id,sender_user_id:row.user_id,message_type:'text',body:row.body.replace(/^ +| +$/g,''),
    metadata_json:{client_message_id:row.id},sent_at:'2026-10-12T02:00:00.000001+00:00',created_at:'2026-10-12T02:00:00Z',updated_at:'2026-10-12T02:00:00Z',
    is_deleted:false,client_message_id:row.id,deleted_at:null,deleted_by_user_id:null,purge_after:null}
    :{ok:true,deleted:true,thread_id:row.thread_id,operation_id:row.id,deletion_scope:'user',deleted_at:'2026-10-12T02:00:00.000001+00:00',
      deleted_through:'2026-10-12T02:00:00.000002+00:00',replayed:false,memphis_generation_ended:false};
   return {ok:true,data:result,meta:{original_outcome:{schema:'custodial.employee-original-message-outcome.v1',state:'ORIGINAL_TRANSACTION_OUTCOME_RECORDED',
    original_command:'employee_message_original_'+kind,request_fingerprint:'a'.repeat(64),original_actor:{device_pk:OTHER,device_id:row.device_id,
     employee_id:row.expected_employee_id,credential_id:row.expected_credential_id,assignment_epoch:row.expected_assignment_epoch,user_id:row.user_id},
    original_outcome_recorded:true,original_request:request,result,recorded_at:'2026-10-12T01:59:59.000001+00:00',inventory_acknowledged:false,finalizer_allowed:false,key_removal:false}}};
  };
  const unknown=()=>({ok:true,data:null,meta:{original_outcome:{schema:'custodial.employee-original-message-outcome.v1',
   state:'ORIGINAL_OUTCOME_NOT_FOUND_UNKNOWN',original_outcome_recorded:false,resend_allowed:false}}});
  const cases=[];
  if(process.argv.includes('--original-send-held-coexistence-only')){
   for(const kind of ['chat','legacy']){
    const r=await exercise(kind,'send',{pinned:true,heldOlderSend:true,outcomeEnvelope:row=>exact(row,'send')});
    assert.equal(r.row,null);assert.equal(r.calls.length,1);assert.equal(r.calls[0].options.body.client_message_id,'msg:'+M);assert.equal(r.heldRow,r.heldOriginal);
    cases.push(kind+' held original unchanged while tracked fresh send settles');
   }
   console.log(JSON.stringify({status:'ORIGINAL_SEND_HELD_COEXISTENCE_SOURCE_PASS',case_count:cases.length,cases,storage_transport_admission_synthetic:true}));return;
  }
  if(process.argv.includes('--original-send-delete-additional-only')){
   for(const kind of ['chat','legacy'])for(const action of ['send','delete']){
    for(const [name,reply]of [
     ['zero reply',()=>({ok:true,data:0})],['boolean reply',()=>({ok:true,data:true})],['missing metadata',row=>{const e=exact(row,action);delete e.meta;return e;}],
     ['mismatched projected data',row=>{const e=exact(row,action);e.data={accepted:true};return e;}],
     ['missing result field',row=>{const e=exact(row,action);delete e.data[action==='send'?'deleted_at':'replayed'];return e;}],
     ['result attribution',row=>{const e=exact(row,action);if(action==='send')e.data.sender_user_id=T;else e.data.user_id=T;return e;}],
     ['coerced result boolean',row=>{const e=exact(row,action);if(action==='send')e.data.is_deleted='false';else e.data.replayed='false';return e;}]
    ]){
     const r=await exercise(kind,action,{pinned:true,newDelete:true,savedChanges:{delivery_attempted:true},outcomeEnvelope:reply});assert.equal(r.row,r.original);assert.equal(r.calls.length,1);assert.ok(r.calls[0].path.endsWith('/original-outcome'));cases.push(kind+' '+action+' '+name+' pending');
    }
    for(const savedChanges of [{delivery_attempted:false},{delivery_attempted:'true'},{extra:'untracked'},...(action==='send'?[{message_type:'notification'},{metadata_json:{source:'foreign'}}]:[])]){
     const r=await exercise(kind,action,{pinned:true,newDelete:true,savedChanges,outcomeEnvelope:row=>exact(row,action)});assert.equal(r.calls.length,0);assert.equal(r.row,r.original);cases.push(kind+' '+action+' malformed saved row '+JSON.stringify(savedChanges));
    }
   }
   const human={id:OTHER,thread_id:T,sender_user_id:U,body:'Original synthetic text',client_message_id:'msg:'+M,message_type:'text'};
   for(const kind of ['chat','legacy']){
    const memphis=await exercise(kind,'send',{pinned:true,oldSend:true,memphis:true,outcomeEnvelope:()=>({ok:true,data:{user_message:human,bot_pending:true}})});
    assert.equal(memphis.row,null);assert.equal(memphis.calls.length,1);assert.equal(memphis.calls[0].path,'/memphis/message');cases.push(kind+' existing protected Memphis route, no ordinary ledger');
    for(const action of ['send','delete']){
     const manager=await exercise(kind,action,{manager:true,oldSend:true,outcomeEnvelope:row=>({ok:true,data:action==='send'?human:{...exact(row,action).data,user_id:U}})});
     if(kind==='chat'){assert.equal(manager.row,null);assert.equal(manager.calls.length,1);assert.equal(manager.calls[0].options.body.expected_employee_id,undefined);}
     else if(action==='send'){assert.equal(manager.row,null);assert.equal(manager.calls.length,1);assert.equal(manager.calls[0].options.body.expected_employee_id,undefined);}else{assert.equal(manager.row,manager.original);assert.equal(manager.calls.length,0);}
     cases.push(kind+' '+action+' manager original behavior');
    }
   }
   console.log(JSON.stringify({status:'ORIGINAL_SEND_DELETE_ADDITIONAL_SOURCE_PASS',case_count:cases.length,cases,actual_source_callbacks:true,storage_transport_admission_synthetic:true,native:false,sql:false,browser:false}));return;
  }
  const observations=[];
  for(const kind of ['chat','legacy'])for(const action of ['send','delete']){
   const r=await exercise(kind,action,{pinned:true,oldSend:true,error:true,repeatFlush:true});
   observations.push({kind,action,effect_posts:r.calls.filter(c=>!c.path.endsWith('/original-outcome')).length,lookup_posts:r.calls.filter(c=>c.path.endsWith('/original-outcome')).length,original_retained:r.row===r.original});
  }
  console.log(JSON.stringify({phase:'SEND_DELETE_UNCERTAIN_REPLAY_OBSERVATIONS',observations}));
  for(const o of observations)assert.equal(o.effect_posts,0,o.kind+' '+o.action+' pre-existing uncertain row cannot repeat effect');
  for(const kind of ['chat','legacy'])for(const action of ['send','delete']){
   const options={pinned:true,newDelete:true};
   const fresh=await exercise(kind,action,{...options,outcomeEnvelope:(row,path,opts,live)=>{
    assert.equal(live.delivery_attempted,true,'durable attempt must precede effect');assert.equal(opts.expectedGeneration,1);
    return exact(row,action);
   }});assert.equal(fresh.row,null);assert.equal(fresh.calls.length,1);assert.equal(fresh.calls[0].path,'/thread/'+T+'/'+(action==='send'?'message':'delete'));
   assert.equal(fresh.calls[0].options.body.original_command,undefined);assert.equal(fresh.calls[0].options.body.credential_token_hash,undefined);
   if(action==='send'){assert.equal(fresh.calls[0].options.body.message_type,'text');assert.deepEqual(Object.keys(fresh.calls[0].options.body.metadata_json),[]);}
   cases.push(kind+' '+action+' attempt-before-effect and exact outcome');
   const recovered=await exercise(kind,action,{...options,savedChanges:{delivery_attempted:true},outcomeEnvelope:row=>exact(row,action)});
   assert.equal(recovered.row,null);assert.equal(recovered.calls.length,1);assert.ok(recovered.calls[0].path.endsWith('/original-outcome'));cases.push(kind+' '+action+' restart lookup-only exact original');
   const ambiguity=await exercise(kind,action,{...options,repeatFlush:true,outcomeEnvelope:(row,path)=>path.endsWith('/original-outcome')?exact(row,action):unknown()});
   assert.equal(ambiguity.row,null);assert.deepEqual(ambiguity.calls.map(c=>c.path),['/thread/'+T+'/'+(action==='send'?'message':'delete'),'/thread/'+T+'/'+(action==='send'?'message':'delete')+'/original-outcome']);
   assert.equal(JSON.stringify(ambiguity.calls[0].options.body),JSON.stringify(ambiguity.calls[1].options.body));cases.push(kind+' '+action+' ambiguity never resends and same original wire');
   const persisted=await exercise(kind,action,{...options,repeatFlush:true,outcomeEnvelope:unknown});assert.equal(JSON.parse(persisted.row).delivery_attempted,true);
   assert.equal(persisted.calls.filter(c=>!c.path.endsWith('/original-outcome')).length,1);cases.push(kind+' '+action+' unknown remains pending');
   const produced=await exercise(kind,action,{...options,producer:true,outcomeEnvelope:(row,path,opts,live)=>{assert.equal(live.delivery_attempted,true);return unknown();}});
   assert.equal(produced.calls.length,1);const producedRow=JSON.parse(produced.row);assert.equal(producedRow.schema_version,'chatscope-'+(action==='send'?'message':'delete')+'-outbox.v3');assert.equal(producedRow.delivery_attempted,true);
   cases.push(kind+' '+action+' actual producer persists v3 complete wire');
   for(const [name,change]of [
    ['foreign employee',o=>o.original_actor.employee_id=T],['foreign credential',o=>o.original_actor.credential_id=T],
    ['numeric epoch',o=>o.original_actor.assignment_epoch=7],['wrong user',o=>o.original_actor.user_id=T],
    ['wrong device',o=>o.original_request.device_id='KIOSK_99'],['wrong request operation',o=>{if(action==='send')o.original_request.client_message_id='msg:'+T;else o.original_request.operation_id=T;}],
    ['wrong request body',o=>{if(action==='send')o.original_request.body='Other original';else o.original_request.thread_id=OTHER;}],
    ['client selector injection',o=>o.original_request.original_command=o.original_command],['private hash injection',o=>o.original_request.credential_token_hash='b'.repeat(64)],
    ['extra outcome',o=>o.authenticated=true],['inventory ACK',o=>o.inventory_acknowledged=true],['finalizer grant',o=>o.finalizer_allowed=true],['key removal grant',o=>o.key_removal=true],
    ['wrong result target',o=>o.result.thread_id=OTHER],['extra result',o=>o.result.accepted=true],['invalid civil timestamp',o=>o.recorded_at='2026-10-12T24:00:00Z'],
    ['invalid calendar timestamp',o=>o.recorded_at='2026-02-31T12:00:00Z'],['oversized fraction',o=>o.recorded_at='2026-10-12T12:00:00.1234567Z'],
    ['boolean recorded',o=>o.original_outcome_recorded='true'],['wrong command',o=>o.original_command='employee_message_original_read']
   ]){
    const r=await exercise(kind,action,{...options,savedChanges:{delivery_attempted:true},outcomeEnvelope:row=>{const e=exact(row,action);change(e.meta.original_outcome);return e;}});
    assert.equal(r.row,r.original,name+' preserves original');assert.equal(r.calls.length,1);assert.ok(r.calls[0].path.endsWith('/original-outcome'));cases.push(kind+' '+action+' '+name+' denied');
   }
   for(const [name,more]of [['generation withdrawal',{changeAfterSend:true}],['credential withdrawal',{credentialAfterSend:true}],['mapped sender withdrawal',{profileAfterSend:true}],['hold withdrawal',{holdAfterSend:true}],['same-key replacement',{replaceAfterSend:true}],['failed cleanup',{failedRemoval:true}]]){
    const r=await exercise(kind,action,{...options,savedChanges:{delivery_attempted:true},outcomeEnvelope:row=>exact(row,action),...more});
    assert.notEqual(r.row,null);if(!more.replaceAfterSend)assert.equal(r.row,r.original);else assert.equal(JSON.parse(r.row).created_at,999);cases.push(kind+' '+action+' '+name+' preserves pending');
   }
  }
  for(const kind of ['chat','legacy']){
   const historical=await exercise(kind,'delete',{pinned:true,outcomeEnvelope:row=>exact(row,'delete')});assert.equal(historical.row,null);assert.ok(historical.calls[0].path.endsWith('/original-outcome'));cases.push(kind+' historical v2 deletion lookup only');
  }
  const confirmedProducer=await exercise('chat','send',{pinned:true,producer:true,outcomeEnvelope:row=>exact(row,'send')});
  assert.equal(confirmedProducer.row,null);assert.equal(confirmedProducer.calls.length,1);assert(confirmedProducer.notices.includes('Sent.'));
  cases.push('chat actual employee producer requires its accepted original receipt for Sent');
  const absentProducer=await exercise('chat','send',{pinned:true,producer:true,error:true,removeAfterSend:true});
  assert.equal(absentProducer.row,null);assert.equal(absentProducer.calls.length,1);
  assert(!absentProducer.notices.includes('Sent.'));assert(absentProducer.notices.includes('Server confirmation is still pending.'));
  cases.push('chat unknown response plus missing row never implies Sent or resends');
  const legacyRefresh=await exercise('legacy','send',{pinned:true,producer:true,refreshFailure:true,outcomeEnvelope:row=>exact(row,'send')});
  assert.equal(legacyRefresh.row,null);assert.equal(legacyRefresh.calls.length,1);
  assert(legacyRefresh.notices.includes('Message sent. Conversation refresh is pending.'),'A post-receipt read failure cannot erase accepted delivery');
  assert(!legacyRefresh.notices.some(text=>text.includes('original message is saved')));
  cases.push('legacy accepted original receipt remains accepted after conversation refresh failure');
  const legacyUnknown=await exercise('legacy','send',{pinned:true,producer:true,refreshFailure:true,outcomeEnvelope:unknown});
  assert.equal(JSON.parse(legacyUnknown.row).delivery_attempted,true);assert.equal(legacyUnknown.calls.length,1);
  assert(!legacyUnknown.notices.includes('Message sent. Conversation refresh is pending.'));
  cases.push('legacy unknown original receipt stays saved without accepted-refresh claim');
  const legacyWithdrawn=await exercise('legacy','send',{pinned:true,producer:true,refreshFailure:true,refreshOwnerLoss:true,outcomeEnvelope:row=>exact(row,'send')});
  assert.equal(legacyWithdrawn.row,null);assert.equal(legacyWithdrawn.calls.length,1);assert.equal(legacyWithdrawn.notices.length,0);
  cases.push('legacy accepted receipt cannot publish into a withdrawn original owner');

  for(const loss of ['generation','credential','epoch','unmount','mapping']){
   const chatWithdrawn=await exercise('chat','send',{pinned:true,producer:true,postDeliveryOwnerLoss:loss,outcomeEnvelope:row=>exact(row,'send')});
   assert.equal(chatWithdrawn.row,null);assert.equal(chatWithdrawn.calls.length,1);
   assert(!chatWithdrawn.notices.includes('Sent.'),'Native '+loss+' loss during final refresh must refuse stale Sent');
   cases.push('chat native '+loss+' loss after accepted delivery cannot publish stale Sent');
  }
  const deferredChat=await exercise('chat','send',{pinned:true,producer:true,outcomeEnvelope:row=>exact(row,'send')});
  assert(deferredChat.notices.includes('Sent.'));assert(deferredChat.messageUpdates.length>=2);deferredChat.withdraw();
  const successorRows=[{id:'successor-ui',body:'Current owner conversation'}];
  for(const update of deferredChat.messageUpdates)if(typeof update==='function')assert.equal(update(successorRows),successorRows,'Deferred old-owner publication must preserve successor UI');
  cases.push('chat deferred message UI updaters require the same native owner at use');
  const lateDeletion=await exercise('chat','delete',{pinned:true,producer:true,newDelete:true,deleteArrivesAtAdmission:true,outcomeEnvelope:row=>exact(row,'delete')});
  assert.equal(lateDeletion.row,null,'Late uncertain original must refuse a fresh retained deletion');
  assert.equal(lateDeletion.calls.length,0,'Late uncertain original must refuse another deletion effect');
  assert.equal(lateDeletion.values.get('mz_chatscope_delete_outbox:'+OTHER),JSON.stringify({...JSON.parse(lateDeletion.original),id:OTHER,delivery_attempted:true}));
  assert.equal(lateDeletion.mutations.length,1);
  cases.push('chat native delete admission rechecks late same-thread original before saving or dispatching a fresh operation');
  const foreignDeletion=await exercise('chat','delete',{pinned:true,producer:true,newDelete:true,deleteArrivesAtAdmission:true,foreignArrivingDeletion:true,outcomeEnvelope:row=>exact(row,'delete')});
  assert.equal(foreignDeletion.row,null);assert.equal(foreignDeletion.calls.length,1);
  assert.equal(JSON.parse(foreignDeletion.values.get('mz_chatscope_delete_outbox:'+OTHER)).thread_id,OTHER);
  cases.push('chat native delete admission preserves another thread original while current operation settles');
  for(const loss of ['generation','credential','epoch','unmount','mapping']){
   const deleted=await exercise('chat','delete',{pinned:true,producer:true,newDelete:true,captureDeleteUI:true,outcomeEnvelope:row=>exact(row,'delete')});
   assert.equal(deleted.row,null);assert(deleted.notices.includes('Conversation removed from your Messenger.'));
   assert(deleted.threadUpdates.length>0&&deleted.messageUpdates.length>0&&deleted.selectionUpdates.length>0&&deleted.mobileUpdates.length>0);
   for(const update of [...deleted.threadUpdates,...deleted.messageUpdates])assert.equal((typeof update==='function'?update([{id:T}]):update).length,0,'Current original deletion still removes its UI');
   for(const update of deleted.selectionUpdates)assert.equal(typeof update==='function'?update(T):update,'');
   for(const update of deleted.mobileUpdates)assert.equal(typeof update==='function'?update(true):update,false);
   deleted.withdraw(loss);
   const successorThreads=[{id:OTHER,title:'Successor thread'}],successorMessages=[{id:OTHER,body:'Successor message'}];
   for(const update of deleted.threadUpdates)assert.equal(typeof update==='function'?update(successorThreads):update,successorThreads,'Deferred deletion thread publication must preserve '+loss+' successor UI');
   for(const update of deleted.messageUpdates)assert.equal(typeof update==='function'?update(successorMessages):update,successorMessages,'Deferred deletion message publication must preserve '+loss+' successor UI');
   for(const update of deleted.selectionUpdates)assert.equal(typeof update==='function'?update(OTHER):update,OTHER,'Deferred deletion selection must preserve '+loss+' successor UI');
   for(const update of deleted.mobileUpdates)assert.equal(typeof update==='function'?update(true):update,true,'Deferred deletion mobile state must preserve '+loss+' successor UI');
   cases.push('chat deferred native delete UI publication preserves '+loss+' successor');
   for(const at of ['messages','threads']){
    const retried=await exercise('chat','delete',{pinned:true,newDelete:true,foreignSavedSender:true,deleteRefreshOwnerLoss:{at,loss},outcomeEnvelope:row=>exact(row,'delete')});
    assert.equal(retried.row,null);assert.equal(retried.calls.length,1);assert.equal(retried.values.has('mz_chatscope_outbox:msg:'+OTHER),true);
    assert.deepEqual(retried.refreshCalls,at==='messages'?['messages']:['messages','threads']);
    assert(!retried.notices.some(text=>text.includes('another signed-in user')),'Withdrawn delete retry must not publish into '+loss+' successor');
    const successorRecovery=[{key:'successor-recovery'}];retried.withdraw();
    for(const update of retried.deletionRecoveryUpdates)assert.equal(typeof update==='function'?update(successorRecovery):update,successorRecovery,'Deferred deletion recovery publication must preserve successor UI');
    cases.push('chat native delete retry '+at+' refresh '+loss+' withdrawal stops further publication');
   }
  }
  const currentDeleteRetry=await exercise('chat','delete',{pinned:true,newDelete:true,foreignSavedSender:true,deleteRefreshOwnerLoss:{at:'none'},outcomeEnvelope:row=>exact(row,'delete')});
  assert.equal(currentDeleteRetry.row,null);assert.equal(currentDeleteRetry.calls.length,1);
  assert.deepEqual(currentDeleteRetry.refreshCalls,['messages','threads']);
  assert(currentDeleteRetry.notices.some(text=>text.includes('another signed-in user')));
  for(const update of currentDeleteRetry.deletionRecoveryUpdates)assert.equal((typeof update==='function'?update([{key:'old'}]):update).length,0);
  cases.push('chat current native delete retry retains its exact accepted outcome and normal refresh notice');
  console.log(JSON.stringify({status:'ORIGINAL_SEND_DELETE_OUTCOME_SOURCE_PASS',case_count:cases.length,cases,actual_source_callbacks:true,storage_transport_and_admission_synthetic:true,sql:false,native:false,server_http:false,browser:false}));return;
 }
 if(process.argv.includes('--original-read-outcome-only')){
  const cases=[];
  const exact=(row,marked=0)=>({ok:true,data:{marked,thread_id:row.thread_id,user_id:row.user_id,through_message_id:row.through_message_id},meta:{original_outcome:{
   schema:'custodial.employee-original-message-outcome.v1',state:'ORIGINAL_TRANSACTION_OUTCOME_RECORDED',
   request_fingerprint:'a'.repeat(64),original_command:'employee_message_original_read',
   original_actor:{device_pk:OTHER,device_id:row.device_id,employee_id:row.expected_employee_id,
    credential_id:row.expected_credential_id,assignment_epoch:row.expected_assignment_epoch,user_id:row.user_id},
   original_outcome_recorded:true,original_request:{device_id:row.device_id,expected_employee_id:row.expected_employee_id,
    expected_credential_id:row.expected_credential_id,expected_assignment_epoch:row.expected_assignment_epoch,
    user_id:row.user_id,thread_id:row.thread_id,through_message_id:row.through_message_id},
   result:{marked,thread_id:row.thread_id,user_id:row.user_id,through_message_id:row.through_message_id},
   recorded_at:'2026-10-12T02:00:00.000001+00:00',inventory_acknowledged:false,finalizer_allowed:false,key_removal:false
  }}});
  const unknown=()=>({ok:true,data:null,meta:{original_outcome:{
   schema:'custodial.employee-original-message-outcome.v1',state:'ORIGINAL_OUTCOME_NOT_FOUND_UNKNOWN',
   original_outcome_recorded:false,resend_allowed:false
  }}});
  const bodyKeys=['device_id','expected_assignment_epoch','expected_credential_id','expected_employee_id','through_message_id','user_id'];
  for(const kind of ['chat','legacy']){
   for(const marked of [0,2]){
    const r=await exercise(kind,'read',{pinned:true,readEnvelope:row=>exact(row,marked)});
    assert.equal(r.row,null);assert.equal(r.calls.length,1);
    assert.equal(r.calls[0].path,'/thread/'+T+'/read');assert.equal(r.calls[0].options.method,'POST');
    assert.equal(r.calls[0].options.expectedGeneration,1);
    assert.deepEqual(Object.keys(r.calls[0].options.body).sort(),bodyKeys);
    cases.push(kind+' original transaction receipt retires marked='+marked);
   }
   const recovered=await exercise(kind,'read',{pinned:true,savedChanges:{delivery_attempted:true},readEnvelope:row=>exact(row)});
   assert.equal(recovered.row,null);assert.equal(recovered.calls.length,1);
   assert.equal(recovered.calls[0].path,'/thread/'+T+'/read/original-outcome');
   assert.equal(recovered.calls[0].options.expectedGeneration,1);
   assert.deepEqual(Object.keys(recovered.calls[0].options.body).sort(),bodyKeys);
   cases.push(kind+' saved attempted read queries original outcome only');
   const resumed=await exercise(kind,'read',{pinned:true,repeat:true,readEnvelope:(row,path)=>path.endsWith('/original-outcome')?exact(row):unknown()});
   assert.equal(resumed.row,null);assert.equal(resumed.calls.length,2);
   assert.deepEqual(resumed.calls.map(call=>call.path),['/thread/'+T+'/read','/thread/'+T+'/read/original-outcome']);
   assert.equal(JSON.stringify(resumed.calls[0].options.body),JSON.stringify(resumed.calls[1].options.body));
   cases.push(kind+' uncertain action followed by same-body original-only query');
   const produced=await exercise(kind,'read',{producer:true,readEnvelope:row=>exact(row)});
   assert.equal(produced.row,null);assert.equal(produced.calls.length,1);cases.push(kind+' actual read producer retires typed original receipt');
   const rejected=[
    ['integer reply',()=>({ok:true,data:0})],
    ['current read status',row=>({ok:true,data:{user_id:row.user_id,thread_id:row.thread_id,through_message_id:row.through_message_id,marked:true}})],
    ['caller confirmation boolean',()=>({ok:true,original_outcome_recorded:true})],
    ['unknown original',unknown],
    ['wrong envelope',row=>({...exact(row),ok:false})],
    ...[
     ['schema',o=>o.schema='other'],['state',o=>o.state='CURRENT_READ_COMPLETE'],
     ['command',o=>o.original_command='employee_message_original_send'],
     ['coerced recorded boolean',o=>o.original_outcome_recorded='true'],
     ['fingerprint',o=>o.request_fingerprint='bad'],['recorded date',o=>o.recorded_at='tomorrow'],
     ['inventory authority',o=>o.inventory_acknowledged=true],['finalizer authority',o=>o.finalizer_allowed=true],
     ['key removal authority',o=>o.key_removal=true],['outcome extra key',o=>o.resend_allowed=true],
     ...['device_id','employee_id','credential_id','assignment_epoch','user_id'].map(key=>['actor '+key,o=>o.original_actor[key]=key==='assignment_epoch'?7:'foreign']),
     ['actor extra key',o=>o.original_actor.credential_token_hash='b'.repeat(64)],
     ['actor missing key',o=>delete o.original_actor.device_pk],
     ...['device_id','expected_employee_id','expected_credential_id','expected_assignment_epoch','user_id','thread_id','through_message_id'].map(key=>['request '+key,o=>o.original_request[key]=key==='expected_assignment_epoch'?7:'foreign']),
     ['request extra key',o=>o.original_request.credential_token_hash='b'.repeat(64)],
     ['request missing key',o=>delete o.original_request.through_message_id],
     ...['thread_id','user_id','through_message_id'].map(key=>['result '+key,o=>o.result[key]=OTHER]),
     ['coerced count',o=>o.result.marked='0'],['negative count',o=>o.result.marked=-1],
     ['result extra key',o=>o.result.current_read_status=true],['result missing key',o=>delete o.result.user_id]
    ].map(([name,change])=>[name,row=>{const envelope=exact(row);change(envelope.meta.original_outcome);return envelope;}])
   ];
   for(const [name,readEnvelope]of rejected){
    const r=await exercise(kind,'read',{pinned:true,savedChanges:{delivery_attempted:true},readEnvelope});
    assert.equal(r.row,r.original,kind+' '+name+' exact attempted bytes retained');
    assert.equal(r.calls.length,1);assert.equal(r.calls[0].path,'/thread/'+T+'/read/original-outcome');
    cases.push(kind+' rejects '+name);
   }
   for(const [name,savedChanges]of [
    ['missing created_at',{created_at:undefined}],['coerced created_at',{created_at:'1'}],
    ['missing horizon',{through_message_id:undefined}],['unbounded horizon',{through_at:''}],
    ['coerced attempted',{delivery_attempted:'true'}],['false attempted',{delivery_attempted:false}],
    ['unknown saved field',{credential_token_hash:'b'.repeat(64)}],['legacy schema',{schema_version:'chatscope-read-outbox.v1'}]
   ]){
    const r=await exercise(kind,'read',{pinned:true,savedChanges,readEnvelope:row=>exact(row)});
    assert.equal(r.row,r.original);assert.equal(r.calls.length,0);cases.push(kind+' preserves '+name);
   }
   for(const [name,options]of [
    ['successor',{successor:true}],['missing mapping',{missingMapping:true}],
    ['generation changed after query',{changeAfterSend:true}],['credential changed after query',{credentialAfterSend:true}],
    ['sender changed after query',{profileAfterSend:true}],['quarantine after query',{holdAfterSend:true}],
    ['generation changed at retirement',{changeAtRetirement:true}],['uncertain query error',{error:true}],
    ['cleanup unconfirmed',{failedRemoval:true}]
   ]){
    const r=await exercise(kind,'read',{pinned:true,savedChanges:{delivery_attempted:true},readEnvelope:row=>exact(row),...options});
    assert.equal(r.row,r.original);assert.equal(r.calls.length,name==='successor'||name==='missing mapping'?0:1);
    cases.push(kind+' preserves '+name);
   }
   const replaced=await exercise(kind,'read',{pinned:true,savedChanges:{delivery_attempted:true},readEnvelope:row=>exact(row),replaceAfterSend:true});
   assert.equal(JSON.parse(replaced.row).created_at,999);cases.push(kind+' changed saved bytes survive original receipt');
  }
  console.log(JSON.stringify({status:'ORIGINAL_READ_OUTCOME_SOURCE_PASS',case_count:cases.length,cases,
   actual_source_callbacks:true,storage_transport_admission_synthetic:true,synthetic_fixture_only:true,
   real_network:false,sql:false,native:false,browser:false,phone:false,independent_review:false}));
  return;
 }
 if(process.argv.includes('--mutation-owner-shape-only')){
  const cases=[];
  for(const kind of ['chat','legacy'])for(const action of ['delete','read']){
   for(const [name,savedChanges]of [['missing created_at',{created_at:undefined}],['coerced created_at',{created_at:'1'}],[action==='read'?'missing original horizon':'zero created_at',{...(action==='read'?{through_at:undefined}:{created_at:0})}]]){
    const r=await exercise(kind,action,{pinned:true,savedChanges});assert.equal(r.calls.length,0);assert.equal(r.row,r.original);cases.push(kind+' '+action+' '+name+' preserved');
   }
   const r=await exercise(kind,action,{pinned:true});assert.equal(r.calls.length,1);if(action==='delete')assert.equal(r.row,null);else assert.equal(JSON.parse(r.row).delivery_attempted,true);cases.push(kind+' '+action+' valid original');
  }
  console.log(JSON.stringify({status:'MUTATION_ORIGINAL_SHAPE_SOURCE_PASS',case_count:cases.length,cases,actual_source_callbacks:true,storage_transport_admission_synthetic:true,native:false,sql:false}));return;
 }
 for(const action of ['delete','read']){
  const r=await exercise('chat',action,{successor:true});observations.push({action,calls:r.calls.length,original_retained:r.row===r.original});
 }
 console.log(JSON.stringify({phase:'MUTATION_ORIGINAL_SUCCESSOR_OBSERVATION',observations,storage_and_transport_synthetic:true}));
 for(const r of observations){assert.equal(r.calls,0,r.action+' original successor may not adopt pending operation');assert.equal(r.original_retained,true,r.action+' exact original retained');}
 const cases=[];
 for(const kind of ['chat','legacy'])for(const action of ['delete','read']){
  for(const [label,options]of [
   ['legacy same-user successor',{successor:true}],
   ['pinned prior credential/epoch',{successor:true,pinned:true}],
   ['current mapping absent',{pinned:true,missingMapping:true}],
   ['foreign pinned credential',{pinned:true,savedChanges:{expected_credential_id:T}}],
   ['whole malformed original',{malformedStored:true}],
  ]){
   const r=await exercise(kind,action,options);assert.equal(r.calls.length,0,kind+' '+action+' '+label);assert.equal(r.row,options.malformedStored?'not-json-original':r.original);cases.push(kind+' '+action+' '+label);
  }
  for(const [label,options]of [
   ['generation changed after response',{changeAfterSend:true}],
   ['credential/epoch changed after response',{credentialAfterSend:true}],
   ['mapped sender changed after response',{profileAfterSend:true}],
   ['hold after response',{holdAfterSend:true}],
   ['ambiguous response',{error:true}],
  ]){
   const r=await exercise(kind,action,{pinned:true,...options});assert.equal(r.calls.length,1);
   const expected=action==='read'?JSON.stringify({...JSON.parse(r.original),delivery_attempted:true}):r.original;
   assert.equal(r.row,expected,kind+' '+action+' '+label+' exact request retained');cases.push(kind+' '+action+' '+label);
  }
  const replaced=await exercise(kind,action,{pinned:true,replaceAfterSend:true});assert.equal(JSON.parse(replaced.row).created_at,999);cases.push(kind+' '+action+' replacement bytes preserved');
  const r=await exercise(kind,action,{pinned:true,repeat:action==='read'});
  assert.equal(r.calls.length,action==='read'?2:1);assert.equal(r.calls[0].options.expectedGeneration,1);
  if(action==='read')assert.equal(r.calls[1].path,'/thread/'+T+'/read/original-outcome');
  assert.equal(r.calls[0].options.body.user_id,U);assert.equal(r.calls[0].options.body.device_id,P.device_id);
  assert.equal(r.calls[0].options.body.expected_employee_id,P.employee_id);assert.equal(r.calls[0].options.body.expected_credential_id,P.credential_id);assert.equal(r.calls[0].options.body.expected_assignment_epoch,'7');
  if(action==='delete'){assert.equal(r.row,null);assert.equal(r.calls[0].options.body.operation_id,M);}
  else{assert.equal(r.calls[0].options.body.through_message_id,M);assert.equal(r.row,JSON.stringify({...JSON.parse(r.original),delivery_attempted:true}));}
  cases.push(kind+' '+action+' exact original request '+(action==='read'?'count response pending/original-only query':'typed receipt retirement'));
  for(const [label,options]of [
   ['missing current mapping',{missingMapping:true}],['currentness changed at save',{changeAtMutation:true}],['non-durable save',{failedSave:true}],
  ]){
   const r=await exercise(kind,action,{producer:true,...options});assert.equal(r.calls.length,0,kind+' '+action+' '+label+' no dispatch');assert.equal(r.row,null);cases.push(kind+' '+action+' '+label+' producer held');
  }
  const produced=await exercise(kind,action,{producer:true,error:true,repeat:true});assert.equal(produced.calls.length,action==='read'?2:1);
  if(action==='read')assert.equal(produced.calls[1].path,'/thread/'+T+'/read/original-outcome');
  const saved=JSON.parse(produced.row);assert.equal(saved.expected_employee_id,P.employee_id);assert.equal(saved.expected_credential_id,P.credential_id);assert.equal(saved.expected_assignment_epoch,'7');assert.equal(saved.security_generation,1);assert.equal(saved.user_id,U);assert.equal(saved.device_id,P.device_id);assert.equal(saved.thread_id,T);assert.equal(saved.principal,undefined);assert.equal(saved.identity,undefined);assert.equal(saved.installation_seal,undefined);
  cases.push(kind+' '+action+' actual producer exact pins/no fresh uncertain operation');
  const old=await exercise(kind,action,{producer:true,existing:'malformed'});assert.equal(old.calls.length,0);assert.equal(old.row,'original-malformed');cases.push(kind+' '+action+' producer preserves malformed pre-existing original');
  const manager=await exercise(kind,action,{manager:true});
  if(kind==='chat'){assert.equal(manager.calls.length,1);assert.equal(manager.row,null);assert.equal(manager.calls[0].options.body.expected_employee_id,undefined);}
  else{assert.equal(manager.calls.length,0);assert.equal(manager.row,manager.original);} // Legacy page never owned ChatScope manager recovery.
  cases.push(kind+' '+action+' manager existing scope');
 }
 for(const kind of ['chat','legacy']){
  const bad=await exercise(kind,'delete',{pinned:true,wrongReceipt:true});assert.equal(bad.row,bad.original);cases.push(kind+' wrong deletion receipt remains pending');
  for(const readData of [0,1,{marked:true,user_id:U,through_message_id:M}]){
   const r=await exercise(kind,'read',{pinned:true,repeat:true,readData});assert.equal(r.calls.length,2);assert.equal(r.calls[1].path,'/thread/'+T+'/read/original-outcome');assert.equal(JSON.parse(r.row).delivery_attempted,true);cases.push(kind+' read reply '+JSON.stringify(readData)+' is not a typed original receipt');
  }
 }
 const foreign=await exercise('chat','read',{producer:true,foreignThrough:true});assert.equal(foreign.calls.length,0);assert.equal(foreign.row,null);cases.push('chat foreign through-message source refuses producer');
 console.log(JSON.stringify({status:'MUTATION_ORIGINAL_OWNER_SOURCE_PASS',cases,case_count:cases.length,actual_source_callbacks:true,principal_utility_actual:true,storage_transport_and_admission_synthetic:true,integer_read_reply_not_original_receipt:true,server_epoch_fence_unqualified:true,real_network:false,native:false,sql:false,browser:false}));
}
