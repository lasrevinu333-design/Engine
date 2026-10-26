// Native injects this fixed CJS asset with private stamps before page scripts.
// It owns normal application birth, not an OS settlement or receipt factory.
// No public global registration, callback API or supplied factory is accepted.
export function installNativeRecurringApplication({ grantToken, replyToken } = {}) {
  const root = globalThis, doc = root.document;
  const apply = Reflect.apply, own = Object.getOwnPropertyDescriptor;
  const define = Object.defineProperty, freeze = Object.freeze, stringify = JSON.stringify, parse = JSON.parse;
  const ownKeys=Reflect.ownKeys,prototype=Object.getPrototypeOf,create=Object.create,setPrototype=Object.setPrototypeOf;
  const isArray=Array.isArray,objectPrototype=Object.prototype,arrayPrototype=Array.prototype;
  const safeInteger=Number.isSafeInteger,finite=Number.isFinite;
  const phases=new Set(),phaseHas=Set.prototype.has,phaseAdd=Set.prototype.add;
  const nativePromise=Promise,promisePrototype=Promise.prototype,promiseThen=Promise.prototype.then;
  const promiseSpecies=Symbol.species,promiseSpeciesGetter=own(nativePromise,promiseSpecies)?.get;
  const setDelete=Set.prototype.delete,setClear=Set.prototype.clear;
  const activeWriters=new Set(),writerFailures=setPrototype([],null),arrayPush=Array.prototype.push;
  let writerEpoch=0,writerUnknown=false,writerHold=null,ordinaryDiagnosticCount=0,heldRefusalDiagnosticCount=0,lastHeldRefusalOperation='NONE',lastHeldRefusalSite='UNCLASSIFIED';
  // This fixed native object grants only synchronous retirement. Captured
  // before page scripts; no caller callback/eligibility or effect API exists.
  const originalWriterAbort=root.custodialRecurringOriginalWriterAbort;
  const abortOriginalWriter=typeof originalWriterAbort?.abort==='function'?originalWriterAbort.abort:null;
  // Capture actual platform getters at native document-start, before ordinary
  // page code. Later own-property getters cannot replace DOM observation.
  const textGetter=own(root.Node?.prototype??{},'textContent')?.get;
  const htmlGetter=own(root.Element?.prototype??{},'innerHTML')?.get;
  const hiddenGetter=own(root.HTMLElement?.prototype??{},'hidden')?.get;
  const port = root.custodialRecurringScheduleApplication;
  const marker = 'custodialNativeNormalApplicationOwner';
  let page; try { page = new URL(root.location.href); } catch { return; }
  if (page.origin !== 'https://localhost' || page.pathname !== '/employee-schedule.html') return;
  if (!doc || root.top !== root || !port || typeof port.postMessage !== 'function' || typeof port.addEventListener !== 'function'
    || typeof grantToken !== 'string' || typeof replyToken !== 'string'
    || !/^[a-f0-9]{64}$/.test(grantToken) || !/^[a-f0-9]{64}$/.test(replyToken)
    || grantToken === replyToken || own(root, marker)) return;
  const post = port.postMessage, listen = port.addEventListener;
  const add = root.addEventListener, addDocument = doc.addEventListener;
  if (typeof add !== 'function' || typeof addDocument !== 'function') return;
  let ordinaryRenderPending=false;
  let closed = false, started = false, notificationOwners = null, employeeOwner = null, reminderOwner = null, rendererConnected = false, reminderMountAttempted = false;
  const notice = state => {
    if (closed) return;
    try {
      apply(post, port, [stringify({ __proto__:null,schema: 'custodial.native-recurring-normal-birth.v1',
        reply_token: replyToken, state })]);
    } catch { close(); }
  };
  const close = () => {
    // Lifecycle/parse/post/phase retirement must cross the SAME native barrier
    // too. Otherwise pagehide could clear writerHold before later ordinary
    // listeners enter and accidentally skip the original-writer abort.
    if(writerHold!==null&&apply(abortOriginalWriter,originalWriterAbort,[grantToken,replyToken])!==true)
      throw Error('Native original-writer retirement channel invalid');
    closed = true;ordinaryRenderPending=false;writerUnknown=true;writerHold=null;apply(setClear,activeWriters,[]);
    notificationOwners = null; employeeOwner = null; reminderOwner = null; };
  // Denial-only: this contains no sink, callbacks, private stamps or evidence.
  // An ordinary page that forges it can suppress its own app, never enroll a
  // producer in the native-owned source or enable generic receipt dispatch.
  define(root, marker, { value: freeze({ schema: 'custodial.native-normal-application-owner.v1' }),
    enumerable: false, writable: false, configurable: false });
  apply(add, root, ['pagehide', close]);
  apply(listen, port, ['message', event => {
    if (closed) return;
    let data; try { data = parse(event.data); } catch { return; }
    if(data?.grant_token!==grantToken)return;
    if(data?.command==='CLOSE'){close();return;}
    if(data?.schema!=='custodial.native-recurring-document-command.v1'
      ||(data.command!=='OBSERVE_RAW_DATA'&&data.command!=='HOLD_CALLBACK_WRITERS'
        &&data.command!=='OBSERVE_HELD_CALLBACK_WRITERS'&&data.command!=='RELEASE_CALLBACK_WRITERS'
        &&data.command!=='OBSERVE_CALLBACK_WRITERS'&&data.command!=='HOLD_ORDINARY_DELIVERY_WRITERS'
        &&data.command!=='OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS'&&data.command!=='RELEASE_ORDINARY_DELIVERY_WRITERS')
      ||typeof data.phase!=='string'||!/^[a-f0-9]{64}$/.test(data.phase)
      ||ownKeys(data).length!==(data.command==='OBSERVE_HELD_CALLBACK_WRITERS'||data.command==='OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS'||data.command==='RELEASE_CALLBACK_WRITERS'||data.command==='RELEASE_ORDINARY_DELIVERY_WRITERS'?5:4)
      ||apply(phaseHas,phases,[data.phase]))return;
    // One attempt for each native nonce. No JS request chooses the target or
    // manufactures currentness/OS authority; failure is unresolved DATA.
    if(phases.size>=64){close();return;}
    apply(phaseAdd,phases,[data.phase]);
    try {
      if(data.command==='OBSERVE_RAW_DATA')observeDocumentData(data.phase);
      else if(data.command==='OBSERVE_CALLBACK_WRITERS')observeCallbackWriters(data.phase);
      else if(data.command==='HOLD_ORDINARY_DELIVERY_WRITERS') {
        if(abortOriginalWriter===null){refuseCallbackRead(data.phase,data.phase,'WRITER_UNKNOWN');return;}
        if(writerHold||writerUnknown||activeWriters.size!==0){
          refuseCallbackRead(data.phase,data.phase,writerHold?'HOLD_ALREADY_ACTIVE':writerUnknown?'WRITER_UNKNOWN':'WRITERS_ACTIVE');return;
        }
        requireDocument();
        const held={phase:data.phase,epoch:writerEpoch,attempted:false,ordinary:true};writerHold=held;
        observeOrdinaryHeldCallbackWriters(data.phase,held);
      }
      else if(data.command==='HOLD_CALLBACK_WRITERS') {
        if(abortOriginalWriter===null){refuseCallbackRead(data.phase,data.phase,'WRITER_UNKNOWN');return;}
        if(writerHold||writerUnknown||activeWriters.size!==0){
          refuseCallbackRead(data.phase,data.phase,writerHold?'HOLD_ALREADY_ACTIVE':writerUnknown?'WRITER_UNKNOWN':'WRITERS_ACTIVE');return;
        }
        requireDocument();
        const held={phase:data.phase,epoch:writerEpoch,attempted:false};writerHold=held;
        // Actual SAME owner callbacks run only after entry exclusion starts.
        // Failed/unknown observations retain the hold until native release or
        // document retirement; they never replay/cancel an original callback.
        observeHeldCallbackWriters(data.phase,held);
      } else {
        const held=writerHold;
        if(!held||data.hold_phase!==held.phase)return;
        if(data.command==='OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS'){
          if(held.ordinary!==true)throw Error('Original ordinary hold required');
          observeOrdinaryHeldCallbackWriters(data.phase,held);
        }
        else if(data.command==='OBSERVE_HELD_CALLBACK_WRITERS'){
          if(held.ordinary===true)throw Error('Original raw hold required');
          observeHeldCallbackWriters(data.phase,held);
        }
        else if(data.command==='RELEASE_ORDINARY_DELIVERY_WRITERS'){
          if(held.ordinary!==true)throw Error('Original ordinary hold required');
          requireDocument();writerHold=null;
          // The actual private command handler has processed this release.
          // This reply is NOT current-effect or receipt authority.
          const raw=stringify({__proto__:null,schema:'custodial.native-recurring-ordinary-release-processed.v1',
            reply_token:replyToken,phase:data.phase,hold_phase:held.phase,hold_active:false,
            writer_epoch:writerEpoch,held_attempted:held.attempted,writer_unknown:writerUnknown,
            active_writer_count:activeWriters.size,receipt_eligible:false});
          requireDocument();apply(post,port,[raw]);
        }
        else writerHold=null; // No queued retry, callback replay or state reset.
      }
    }catch {
      // A fixed negative terminal for this SAME authenticated one-use phase.
      // No exception text, private payload, callback replay or reset is sent.
      if(data.command==='HOLD_CALLBACK_WRITERS'||data.command==='OBSERVE_HELD_CALLBACK_WRITERS'
        ||data.command==='HOLD_ORDINARY_DELIVERY_WRITERS'||data.command==='OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS')
        refuseCallbackRead(data.phase,data.command==='HOLD_CALLBACK_WRITERS'||data.command==='HOLD_ORDINARY_DELIVERY_WRITERS'?data.phase:data.hold_phase,'OBSERVATION_FAILED');
    }
  }]);
  // A strictly passive copy. Accessors, functions, opaque objects, symbols,
  // unsafe numbers and over-bound values are never invoked/coerced into proof.
  const requireDocument=()=>{if(closed||root.document!==doc||root.top!==root)throw Error('Native document retired');};
  function copyData(value,budget={nodes:0,chars:0},depth=0) {
    requireDocument();
    if(++budget.nodes>16384||depth>24)throw Error('Native document DATA bound');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='string'){if((budget.chars+=value.length)>196608)throw Error('Native document DATA bound');return value;}
    if(typeof value==='number'&&finite(value)&&safeInteger(value))return value;
    if(typeof value!=='object')return {__proto__:null,unknown_type:typeof value};
    const proto=prototype(value),array=isArray(value);
    if(proto!==null&&proto!==(array?arrayPrototype:objectPrototype))return {__proto__:null,unknown_type:'opaque_object'};
    const keys=ownKeys(value);if(keys.length>2048)throw Error('Native document DATA bound');
    if(array){const length=own(value,'length')?.value;
      if(!safeInteger(length)||length<0||length>2048||keys.length!==length+1)throw Error('Native document sparse DATA');}
    const out=array?setPrototype([],null):create(null);
    for(const key of keys) {
      if(array&&key==='length')continue;
      if(typeof key!=='string'||array&&!/^(0|[1-9][0-9]*)$/.test(key))throw Error('Native document DATA keys');
      if((budget.chars+=key.length)>196608)throw Error('Native document DATA bound');
      const descriptor=own(value,key);requireDocument();
      if(!descriptor||!('value' in descriptor))throw Error('Native document DATA accessor');
      define(out,key,{value:copyData(descriptor.value,budget,depth+1),enumerable:true,writable:false,configurable:false});
    }
    return out;
  }
  function readActualElement(node) {
    requireDocument();if(node===null)return null;
    if(typeof textGetter!=='function'||typeof htmlGetter!=='function'||typeof hiddenGetter!=='function')
      throw Error('Native platform DOM DATA unavailable');
    const text=apply(textGetter,node,[]);requireDocument();
    const html=apply(htmlGetter,node,[]);requireDocument();
    const hidden=apply(hiddenGetter,node,[]);requireDocument();
    return {__proto__:null,text,html,hidden};
  }
  function captureDocumentData(checkpoint=requireDocument) {
    checkpoint();
    const notifications=notificationOwners,employee=employeeOwner,reminder=reminderOwner;
    if(!notifications||!employee||!reminder||!rendererConnected)throw Error('Normal native owners incomplete');
    const read=operation=>{checkpoint();const value=operation();checkpoint();const copied=copyData(value);checkpoint();return copied;};
    const frame={__proto__:null,schema:'custodial.native-recurring-document-raw-data.v1',receipt_eligible:false,
      employee:read(()=>employee.observeNativeSourceData(readActualElement)),
      presenter:read(()=>notifications.presenter.observeNativeSourceData()),
      scheduler:read(()=>notifications.scheduler.observeNativeSourceData()),
      reminder:read(()=>reminder.snapshot())};
    // Last native-channel publication follows all actual owner callbacks.
    checkpoint();
    if(notifications!==notificationOwners||employee!==employeeOwner||reminder!==reminderOwner)throw Error('Native owners replaced');
    return frame;
  }
  function observeDocumentData(phase) {
    const frame=captureDocumentData();
    const raw=stringify({__proto__:null,schema:'custodial.native-recurring-document-reply.v1',
      reply_token:replyToken,phase,data:frame});
    requireDocument();if(raw.length>262144)throw Error('Native document DATA bound');
    apply(post,port,[raw]);
  }
  function observeCallbackWriters(phase) {
    requireDocument();
    const raw=stringify({__proto__:null,schema:'custodial.native-recurring-writer-state-data.v1',reply_token:replyToken,phase,
      writer_epoch:writerEpoch,active_writer_count:activeWriters.size,writer_unknown:writerUnknown,hold_active:writerHold!==null,
      snapshot_owners_ready:!!(notificationOwners&&employeeOwner&&reminderOwner&&rendererConnected),receipt_eligible:false});
    requireDocument();apply(post,port,[raw]);
  }
  function refuseCallbackRead(phase,holdPhase,kind) {
    try{requireDocument();
      const raw=stringify({__proto__:null,schema:'custodial.native-recurring-callback-refused-data.v1',reply_token:replyToken,
        phase,hold_phase:holdPhase,kind,writer_epoch:writerEpoch,active_writer_count:activeWriters.size,
        writer_unknown:writerUnknown,receipt_eligible:false});
      requireDocument();apply(post,port,[raw]);
    }catch{/* A retired/foreign document still cannot publish a terminal. */}
  }
  function observeHeldCallbackWriters(phase,held) {
    const current=()=>{
      requireDocument();
      if(writerHold!==held||held.attempted||writerUnknown||activeWriters.size!==0||writerEpoch!==held.epoch)
        throw Error('Original native callback hold is unavailable');
    };
    current();const frame=captureDocumentData(current);current();
    const raw=stringify({__proto__:null,schema:'custodial.native-recurring-callback-held-data.v1',
      reply_token:replyToken,phase,hold_phase:held.phase,writer_epoch:held.epoch,
      receipt_eligible:false,failed_callback_terminals:copyData(writerFailures),data:frame});
    current();if(raw.length>262144)throw Error('Native callback held DATA bound');
    apply(post,port,[raw]);
  }
  function observeOrdinaryHeldCallbackWriters(phase,held){
    let stage='ENTRY',guard='NONE';
    const current=()=>{
      guard='DOCUMENT';requireDocument();
      guard='HOLD';
      if(writerHold!==held||held.ordinary!==true||held.attempted||writerUnknown||activeWriters.size!==0||writerEpoch!==held.epoch)
        throw Error('Original ordinary callback hold unavailable');
    };
    try{
    current();stage='OWNERS';const notifications=notificationOwners,employee=employeeOwner,reminder=reminderOwner;
    if(!notifications||!employee||!reminder||!rendererConnected)throw Error('Actual ordinary owners incomplete');
    const read=(operation,label)=>{stage=label+'_BEFORE';current();stage=label+'_CALL';const value=operation();stage=label+'_AFTER';current();stage=label+'_COPY';const copied=copyData(value);stage=label+'_COPIED';current();return copied;};
    const employeeData=read(()=>employee.observeNativeSourceData(readActualElement),'EMPLOYEE');
    stage='RENDER_KEYS';const rendered=employeeData.original_typed_render,delivery=rendered?.original_source?.recurring_delivery;
    if(typeof rendered?.principal_identity!=='string'||typeof rendered?.service_date!=='string'
      ||typeof delivery?.intentId!=='string'||typeof delivery?.targetDigest!=='string')throw Error('Original typed render unavailable');
    stage='SELECTOR_COPY';const selector=copyData({principal:rendered.principal_identity,service_date:rendered.service_date,
      intent_id:delivery.intentId,target_digest:delivery.targetDigest});
    const frame={__proto__:null,schema:'custodial.native-recurring-ordinary-document-data.v1',receipt_eligible:false,selector,
      employee:employeeData,presenter:read(()=>notifications.presenter.observeOrdinaryDeliveryData(selector),'PRESENTER'),
      scheduler:read(()=>notifications.scheduler.observeOrdinaryDeliveryData(selector),'SCHEDULER'),reminder:read(()=>reminder.ordinarySnapshot(selector),'REMINDER')};
    stage='OWNER_IDENTITY';current();if(notifications!==notificationOwners||employee!==employeeOwner||reminder!==reminderOwner)throw Error('Original ordinary owners replaced');
    stage='SERIALIZE';const raw=stringify({__proto__:null,schema:'custodial.native-recurring-ordinary-held-data.v1',reply_token:replyToken,
      phase,hold_phase:held.phase,writer_epoch:held.epoch,receipt_eligible:false,
      failed_callback_terminals:writerFailures,data:frame});
    stage='PUBLICATION';current();if(raw.length>262144)throw Error('Ordinary native DATA bound');apply(post,port,[raw]);
    }catch(error){
      // Fixed bounded scalar diagnostics only; original refusal and throw survive.
      if(ordinaryDiagnosticCount<16){ordinaryDiagnosticCount++;
        try{root.console.log('CUSTODIAL_ORDINARY_OBSERVATION_DIAGNOSTIC phase='+(phase===held.phase?'INITIAL':'TERMINAL')
          +' stage='+stage+' guard='+guard+' ordinal='+ordinaryDiagnosticCount+' heldAttempted='+(held.attempted===true)
          +' writerEpoch='+writerEpoch+' heldEpoch='+held.epoch+' activeWriters='+activeWriters.size+' writerUnknown='+writerUnknown);}catch{}
        // Diagnostic DATA uses the same authenticated pending read. It neither
        // settles that read nor alters the original refusal/throw below.
        try{requireDocument();apply(post,port,[stringify({__proto__:null,
          schema:'custodial.native-recurring-ordinary-observation-diagnostic.v1',reply_token:replyToken,
          phase,hold_phase:held.phase,stage,guard,operation:lastHeldRefusalOperation,site:held.attempted===true?lastHeldRefusalSite:'UNCLASSIFIED',
          ordinal:ordinaryDiagnosticCount,held_attempted:held.attempted===true,
          writer_epoch:writerEpoch,held_epoch:held.epoch,active_writer_count:activeWriters.size,
          writer_unknown:writerUnknown,receipt_eligible:false})]);}catch{}

      }
      throw error;
    }
  }
  function flushOrdinaryRenderWake(){
    if(closed||!ordinaryRenderPending||!employeeOwner||!notificationOwners||!reminderOwner||!rendererConnected
      ||writerUnknown||writerHold!==null||activeWriters.size!==0)return;
    ordinaryRenderPending=false; // Consume scheduling notice before post; no retry.
    try{requireDocument();
      const raw=stringify({__proto__:null,schema:'custodial.native-recurring-ordinary-render-wake.v1',reply_token:replyToken});
      requireDocument();apply(post,port,[raw]);
    }catch{/* Wake failure never changes ordinary render behavior. */}
  }
  const bound = () => {
    if (!closed && notificationOwners && employeeOwner && reminderOwner && rendererConnected) notice('NORMAL_PRODUCERS_BOUND_NOT_SETTLEMENT');
    flushOrdinaryRenderWake();
  };
  const connectRenderer = () => {
    if(closed||rendererConnected||!notificationOwners||!reminderOwner)return;
    rendererConnected=true; // A partial registration is never retried/adopted.
    try {
      notificationOwners.presenter.registerBrowser(reminderOwner.present);
      notificationOwners.providerMirror?.setRenderer(reminderOwner.provider);
    } catch { close(); }
  };
  // Capture original normal render DATA without JSON.stringify/getter/toJSON
  // adoption. This is a private lexical sink, not a caller registry or receipt
  // factory. Unsupported/over-bound values leave the observation pending.
  function copyOriginalTypedRenderData(value) {
    requireDocument();if(!employeeOwner)throw Error('Actual employee owner absent');
    const result=copyData(value);
    const exact=node=>{
      if(node===null||typeof node!=='object')return;
      for(const key of ownKeys(node)) {
        if(key==='unknown_type')throw Error('Opaque original typed render DATA');
        if(key!=='length')exact(own(node,key).value);
      }
      freeze(node);
    };
    exact(result);requireDocument();return result;
  }
  // SAME actual normal callback entry/terminal ownership, including unresolved
  // original Promises. This private native-command hold excludes newly entering
  // participating callbacks only; raw WORK/OS/principal/current-target joins
  // are still mandatory. It is never receipt/effect settlement authority.
  function recordFailedCallback(kind) {
    // Preserve bounded fixed classification/epoch DATA, never error text.
    // Overflow is UNKNOWN rather than erasing old failure history.
    if(writerFailures.length>=128){writerUnknown=true;return;}
    apply(arrayPush,writerFailures,[freeze({__proto__:null,epoch:writerEpoch,kind})]);
  }
  function wrapNativeWriter(operation,asyncResult=false,diagnosticSite='UNCLASSIFIED') {
    if(typeof operation!=='function'||typeof asyncResult!=='boolean')throw Error('Native writer callback unavailable');
    let fixedDiagnosticSite='UNCLASSIFIED';
    switch(diagnosticSite){
      case 'BRIDGE_RECONCILE':
      case 'EMPLOYEE_341':
      case 'EMPLOYEE_419':
      case 'EMPLOYEE_420':
      case 'EMPLOYEE_421':
      case 'EMPLOYEE_422':
      case 'EMPLOYEE_423':
      case 'EMPLOYEE_424':
      case 'EMPLOYEE_425':
      case 'EMPLOYEE_426':
      case 'EMPLOYEE_427':
      case 'EMPLOYEE_428':
      case 'EMPLOYEE_429':
      case 'EMPLOYEE_430':
      case 'EMPLOYEE_431':
      case 'EMPLOYEE_432':
      case 'EMPLOYEE_433':
      case 'EMPLOYEE_434':
      case 'EMPLOYEE_435':
      case 'EMPLOYEE_448':
      case 'EMPLOYEE_457':
      case 'EMPLOYEE_467':
      case 'EMPLOYEE_469':
      case 'PRESENTER_109':
      case 'PRESENTER_123':
      case 'PRESENTER_126':
      case 'PRESENTER_134':
      case 'PRESENTER_139':
      case 'PRESENTER_141':
      case 'PRESENTER_163':
      case 'PRESENTER_189':
      case 'PRESENTER_236':
      case 'PRESENTER_257':
      case 'PRESENTER_262':
      case 'PRESENTER_269':
      case 'PRESENTER_280':
      case 'PRESENTER_50':
      case 'PRESENTER_90':
      case 'REMINDER_1018':
      case 'REMINDER_1094':
      case 'REMINDER_1198':
      case 'REMINDER_1245':
      case 'REMINDER_1280':
      case 'REMINDER_1289':
      case 'REMINDER_1292':
      case 'REMINDER_1299':
      case 'REMINDER_1464':
      case 'REMINDER_1569':
      case 'REMINDER_1573':
      case 'REMINDER_1580':
      case 'REMINDER_1597':
      case 'REMINDER_1598':
      case 'REMINDER_1599':
      case 'REMINDER_1600':
      case 'REMINDER_1601':
      case 'REMINDER_1602':
      case 'REMINDER_1603':
      case 'REMINDER_1604':
      case 'REMINDER_1605':
      case 'REMINDER_1606':
      case 'REMINDER_1607':
      case 'REMINDER_1608':
      case 'REMINDER_1609':
      case 'REMINDER_1610':
      case 'REMINDER_1611':
      case 'REMINDER_1612':
      case 'REMINDER_1613':
      case 'REMINDER_1614':
      case 'REMINDER_1615':
      case 'REMINDER_1616':
      case 'REMINDER_1617':
      case 'REMINDER_1618':
      case 'REMINDER_1619':
      case 'REMINDER_1620':
      case 'REMINDER_1621':
      case 'REMINDER_1622':
      case 'REMINDER_1623':
      case 'REMINDER_1624':
      case 'REMINDER_1625':
      case 'REMINDER_1626':
      case 'REMINDER_1627':
      case 'REMINDER_1628':
      case 'REMINDER_1629':
      case 'REMINDER_1630':
      case 'REMINDER_1631':
      case 'REMINDER_1632':
      case 'REMINDER_1633':
      case 'REMINDER_1634':
      case 'REMINDER_1635':
      case 'REMINDER_1636':
      case 'REMINDER_1637':
      case 'REMINDER_1638':
      case 'REMINDER_1639':
      case 'REMINDER_1640':
      case 'REMINDER_1641':
      case 'REMINDER_580':
      case 'REMINDER_586':
      case 'REMINDER_590':
      case 'REMINDER_605':
      case 'REMINDER_616':
      case 'REMINDER_674':
      case 'REMINDER_701':
      case 'REMINDER_945':
      case 'SCHEDULER_OWNED':
        fixedDiagnosticSite=diagnosticSite;break;
    }
    // Read only a native function's own data descriptor, never invoke/coerce it.
    let diagnosticOperation='OTHER';
    try{const descriptor=own(operation,'name'),name=descriptor&&'value' in descriptor?descriptor.value:null;
      if(name==='poll')diagnosticOperation='POLL';else if(name==='load')diagnosticOperation='LOAD';
      else if(name==='reconcileScheduleAuthority'||name==='reconcileAlerts'||name==='reconcileUnlocked')diagnosticOperation='RECONCILE';
    }catch{}
    return function(...args) {
      // Source retirement never replaces/turns off the ordinary application.
      // A retired Source cannot later use these observations as evidence.
      if(closed)return apply(operation,this,args);
      if(writerHold){
        writerHold.attempted=true;
        lastHeldRefusalOperation=diagnosticOperation;
        lastHeldRefusalSite=fixedDiagnosticSite;
        if(safeInteger(writerEpoch+1))writerEpoch++;else writerUnknown=true;
        recordFailedCallback('HELD_PRE_EFFECT_REFUSAL');
        if(heldRefusalDiagnosticCount<16){heldRefusalDiagnosticCount++;
          try{root.console.log('CUSTODIAL_ORDINARY_HELD_REFUSAL_DIAGNOSTIC operation='+diagnosticOperation
            +' ordinal='+heldRefusalDiagnosticCount+' writerEpoch='+writerEpoch+' activeWriters='+activeWriters.size);}catch{}
        }
        // A genuine original invocation is never queued, rejected or replayed.
        // Synchronous Java bridge return is a retirement barrier, not a READY
        // message: actual Engine then Source authority is gone before return.
        // The fixed native method authenticates this Source's immutable tokens
        // and also acknowledges an already-retired Source. It never waits on
        // renderer/UI work, reconstructs a frame or grants an effect.
        close(); // Includes the same synchronous native barrier on every close path.
        return apply(operation,this,args);
      }
      try{requireDocument();if(!safeInteger(writerEpoch+1))throw Error('Native writer epoch exhausted');}
      catch{close();return apply(operation,this,args);}
      const ticket=create(null);apply(phaseAdd,activeWriters,[ticket]);writerEpoch++;
      let terminal=false;
      const finish=failed=>{
        if(terminal)return;terminal=true;
        apply(setDelete,activeWriters,[ticket]);
        if(safeInteger(writerEpoch+1))writerEpoch++;else close();
        if(failed)recordFailedCallback(failed);
        // Completion of an actual tracked invocation may deliver the ONE
        // already-committed scheduling notice. No new notice, timer, retry,
        // callback replay, held epoch reset or admission verdict is created.
        flushOrdinaryRenderWake();
        // A rejected/throwing invocation terminated; its EFFECTS did not
        // become known, rolled back or successful. Native/WORK/OS UNKNOWN
        // remains independently blocking in the later actual journal join.
      };
      try {
        const result=apply(operation,this,args);
        if(asyncResult) {
          // Observe the actual Promise without replacing it or adopting a
          // caller thenable/toJSON/ready flag. Identity and rejection returned
          // to the ordinary caller remain exactly the original operation's.
          try{
            // A changed constructor/species must not run page callbacks just
            // to observe completion. Unsupported results stay UNKNOWN/active.
            const resultPrototype=prototype(result),resultConstructor=own(result,'constructor');
            const constructor=own(promisePrototype,'constructor'),species=own(nativePromise,promiseSpecies);
            if(resultPrototype!==promisePrototype||resultConstructor!==undefined
              ||!constructor||constructor.value!==nativePromise||!('value' in constructor)
              ||!species||species.get!==promiseSpeciesGetter||species.set!==undefined
              ||typeof promiseSpeciesGetter!=='function')throw Error('Native writer Promise observation unavailable');
            apply(promiseThen,result,[()=>finish(false),()=>finish('PROMISE_REJECTED')]);
          }catch{writerUnknown=true;/* Leave the unresolved ticket active. */}
        } else finish(false);
        return result;
      } catch(error){finish('SYNC_THROW');throw error;}
    };
  }
  const sink = freeze({
    wrapNativeWriter,
    copyOriginalTypedRenderData,
    ordinaryRenderCommitted(){
      try{requireDocument();ordinaryRenderPending=true;flushOrdinaryRenderWake();}
      catch{/* Retirement never changes ordinary render behavior. */}
    },
    // Passive opaque markers retained for ordinary owner DATA only.
    copyOrdinaryOwnerData(value){requireDocument();const copied=copyData(value);requireDocument();return copied;},
    readOrdinaryExpectedPlan(selector){
      requireDocument();const owners=notificationOwners;
      if(!owners||typeof owners.authority?.observeOrdinaryExpectedPlan!=='function')throw Error('Normal expected plan owner unavailable');
      const plan=apply(owners.authority.observeOrdinaryExpectedPlan,owners.authority,[selector]);
      const copied=copyOriginalTypedRenderData(plan);
      requireDocument();if(owners!==notificationOwners)throw Error('Normal expected plan owner changed');
      return copied;
    },
    requireReminderBirth() {
      if(closed||!reminderMountAttempted||root.document!==doc)throw new Error('Native reminder source is retired');
    },
    mountReminderOwner() {
      if(closed||reminderMountAttempted||root.document!==doc)return;
      reminderMountAttempted=true;
      void import('./device-reminders-runtime.js').then(normal=>{
        if(closed||root.document!==doc)return;
        return normal.installDeviceReminders({nativeApplicationSource:sink});
      }).catch(close);
    },
    bindNotificationOwners(value) {
      if (closed) return;
      if (notificationOwners || !value || !value.presenter || !value.scheduler || !value.security
        || typeof value.principal !== 'function') { close(); return; }
      notificationOwners = value;
      connectRenderer();bound();
    },
    bindReminderOwner(value) {
      if(closed)return;
      if(reminderOwner||!value||typeof value.present!=='function'||typeof value.snapshot!=='function'
        ||!value.provider||value.provider.show!==value.present||typeof value.provider.stopAndReadback!=='function') {close();return;}
      reminderOwner=value;connectRenderer();bound();
    },
    bindEmployeeOwner(value) {
      if (closed) return;
      if (employeeOwner || !value || typeof value.current !== 'function' || typeof value.snapshot !== 'function') {
        close(); return;
      }
      employeeOwner = value;
      bound();
    },
  });
  const start = async () => {
    if (closed || started) return;
    started = true;
    try {
      // Lazy import is intentional: Capacitor and the ordinary page assets
      // must initialize before their normal module factories are evaluated.
      const normal = await import('./bridge.js');
      if (closed || root.document !== doc) return;
      normal.installCustodialBridge({ nativeApplicationSource: sink });
    } catch {
      // Never repair/restart partially born app/notification owners.
      close();
    }
  };
  if (doc.readyState === 'loading') apply(addDocument, doc, ['DOMContentLoaded', start, { once: true }]);
  else void start();
}
