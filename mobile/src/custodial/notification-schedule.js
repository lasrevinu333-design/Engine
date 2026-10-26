import {protectedPrincipal,principalIdentity} from './protected-principal.js';
import {requireCustodialNewProducerAdmission} from './new-producer-scope.js';

// Durable ownership of each local OS side effect. Keep cancelled rows as ID
// reservations/history; never cancel by guessing a key-derived numeric hash.
export function createPrincipalNotificationScheduler({identity,mutate,storage,prefix,plugin,isCurrent=()=>true,nativeStatus,requireNativeOwner=false,nativeApplicationSource=null}) {
  if(typeof requireNativeOwner!=='boolean')throw new TypeError('Explicit native notification ownership mode required.');
  const unconfirmedPrefix=prefix+'unconfirmed:';
  const lastNativeSaves=new Map(); // Exact normal returned readbacks; DATA only.
  const validGroup=value=>typeof value==='string'&&/^mz-custodial-owned:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const unavailable=()=>Error('Original native notification owner unavailable.');
  function captureOwner(){
    if(typeof nativeStatus!=='function')throw unavailable();
    const scope=identity(),status=nativeStatus(),principal=protectedPrincipal(status?.principal);
    if(!principal||!scope||scope!==principalIdentity(principal)||identity()!==scope
      ||status.ready!==true||status.available!==true||status.quarantined!==false
      ||!Number.isSafeInteger(status.generation)||status.generation<=0||status.deviceId!==principal.device_id)throw unavailable();
    return Object.freeze({scope,generation:status.generation,deviceId:status.deviceId,principal});
  }
  function requireOwner(original){
    const current=captureOwner();
    if(current.scope!==original.scope||current.generation!==original.generation||current.deviceId!==original.deviceId
      ||!equal(current.principal,original.principal))throw unavailable();
  }
  async function sourceOwned(operation){
    // Compatibility is explicit and never inferred from an absent status port.
    if(!requireNativeOwner)return mutate(()=>operation(()=>{}));
    const original=captureOwner();
    const value=await mutate(async context=>{
      const assert=context?.assertCurrent;
      if(typeof assert!=='function'||context.generation!==original.generation||context.deviceId!==original.deviceId)throw unavailable();
      const checkpoint=()=>{requireOwner(original);assert.call(context);requireOwner(original);};
      checkpoint();const result=await operation(checkpoint);checkpoint();return result;
    },{requireEnrollment:true,expectedGeneration:original.generation});
    // No callback checkpoint survives native admission settlement.
    requireOwner(original);return value;
  }
  // All actual schedule/cancel/storage effects and their final owner checks
  // stay inside this original async invocation, including admission queuing.
  const owned=nativeApplicationSource
    ?nativeApplicationSource.wrapNativeWriter(sourceOwned,true,'SCHEDULER_OWNED'):sourceOwned;
  // The mounted owner must supply its authenticated schedule authority reader.
  // This predicate never derives authority from the notification itself and
  // never treats a read failure or a Promise as affirmative permission.
  const current=(notification,scope)=>scope===identity()&&isCurrent(notification,scope)===true;
  function records(){
    const rows=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);if(!key?.startsWith(prefix)||key.startsWith(unconfirmedPrefix))continue;
      const row=JSON.parse(storage.getItem(key));
      if(row?.schema_version!=='native-notification-schedule.v1'||!row.scope
        ||!Number.isInteger(row.id)||row.id<1||row.id>2147483647
        ||!['intent','scheduled','cancelled'].includes(row.state)
        ||key!==prefix+row.id||row.notification?.id!==row.id
        ||row.notification.extra?.native_presentation_principal!==row.scope
        ||row.notification.extra?.native_presentation_id!==String(row.id)
        ||row.delivery_ownership_group!==undefined&&(!validGroup(row.delivery_ownership_group)||row.notification.group!==row.delivery_ownership_group))throw Error('Invalid owned notification schedule journal.');
      rows.push(row);
    }
    return rows;
  }
  function save(row,checkpoint){
    checkpoint();
    const key=prefix+row.id,value=JSON.stringify(row);storage.setItem(key,value);checkpoint();
    if(storage.getItem(key)!==value)throw Error('Notification schedule journal readback failed.');
    checkpoint();
    if(nativeApplicationSource)try{if(lastNativeSaves.size<4096||lastNativeSaves.has(key))lastNativeSaves.set(key,value);}catch{/* DATA unavailable; ordinary save unchanged. */}
  }
  const unconfirmed=row=>storage.getItem(unconfirmedPrefix+row.id)!==null;
  function beginConfirmation(row,checkpoint){
    checkpoint();
    const key=unconfirmedPrefix+row.id,value=JSON.stringify({schema_version:'native-notification-schedule-guard.v1',id:row.id,scope:row.scope});
    // A verified existing guard already closes action admission. Reuse it so
    // later storage-write failure cannot prevent compensating OS cancellation.
    const prior=storage.getItem(key);
    checkpoint();
    if(prior===value)return;
    if(prior!==null)throw Error('Notification schedule confirmation guard ownership conflict.');
    checkpoint();storage.setItem(key,value);checkpoint();
    if(storage.getItem(key)!==value)throw Error('Notification schedule confirmation guard readback failed.');
    checkpoint();
  }
  async function cancel(row,checkpoint){
    // Close action admission durably before either OS side effect. A resolved
    // cancel() promise does not prove an already-delivered notification gone.
    beginConfirmation(row,checkpoint);
    checkpoint();const pending=await plugin.getPending();checkpoint();
    const delivered=await plugin.getDeliveredNotifications();checkpoint();
    if(!Array.isArray(pending?.notifications)||!Array.isArray(delivered?.notifications))throw Error('Notification cancellation inventory unavailable.');
    const owned=delivered.notifications.filter(item=>item.id===row.id);
    if(pending.notifications.filter(item=>item.id===row.id).some(item=>item.extra?.native_presentation_principal!==row.scope
      ||item.extra?.native_presentation_id!==String(row.id)))throw Error('Notification cancellation ownership conflict.');
    // Android delivered inventory exposes group, not the scheduled JS extra.
    // A random per-intent marker is journaled before dispatch and returned by
    // the actual vendor API. Never substitute guessed numeric ID ownership.
    if(owned.some(item=>!validGroup(row.delivery_ownership_group)||item.group!==row.delivery_ownership_group||item.tag!=null))
      throw Error('Notification cancellation ownership conflict.');
    checkpoint();await plugin.cancel({notifications:[{id:row.id}]});checkpoint();
    if(owned.length){checkpoint();await plugin.removeDeliveredNotifications({notifications:owned});checkpoint();}
    const remainingPending=await plugin.getPending();checkpoint();
    const remainingDelivered=await plugin.getDeliveredNotifications();checkpoint();
    if(!Array.isArray(remainingPending?.notifications)||!Array.isArray(remainingDelivered?.notifications))
      throw Error('Notification cancellation inventory unavailable.');
    if([...remainingPending.notifications,...remainingDelivered.notifications].some(item=>item.id===row.id))
      throw Error('Notification cancellation unconfirmed.');
    save({...row,state:'cancelled'},checkpoint);
  }
  async function reconcileUnlocked(checkpoint){
    checkpoint();
    const failures=[];
    for(const row of records())if(row.state!=='cancelled'&&(row.state==='intent'||unconfirmed(row)||!current(row.notification,row.scope))){
      checkpoint();
      try{await cancel(row,checkpoint);checkpoint();}catch(error){
        // Continue independent, provably owned retirements only while this
        // exact native invocation still owns its callback.
        try{checkpoint();}catch{throw error;}
        failures.push(error);
      }
    }
    // One unresolved historical/conflicting row must not prevent retirement
    // of independent provably owned rows. Preserve each failed row and guard.
    if(failures.length)throw new AggregateError(failures,'Notification reconciliation incomplete: '+failures.map(e=>e.message).join('; '));
    checkpoint();
  }
  return Object.freeze({
    // Exact raw journal strings, including malformed/unconfirmed rows. This
    // never calls reconcile/permission/plugin APIs or upgrades them to ACKs.
    observeNativeSourceData() {
      const raw=[];let size=0;const length=storage.length;
      if(!Number.isSafeInteger(length)||length<0||length>4096)throw Error('Native scheduler census DATA bound.');
      for(let i=0;i<length;i++) {
        const key=storage.key(i);if(typeof key!=='string'||!key.startsWith(prefix))continue;
        const value=storage.getItem(key);
        if(typeof value!=='string'||raw.length>=256||(size+=key.length+value.length)>131072)
          throw Error('Native scheduler raw DATA unavailable.');
        raw.push([key,value]);
      }
      return {schema:'custodial.native-scheduler-raw-data.v1',receipt_eligible:false,raw};
    },
    observeOrdinaryDeliveryData(selector) {
      if(!nativeApplicationSource||!selector||typeof selector.principal!=='string'||typeof selector.service_date!=='string')throw unavailable();
      const candidates=[],byId=new Map(),unrelated={rows:0};const length=storage.length;
      if(!Number.isSafeInteger(length)||length<0||length>4096)throw unavailable();
      for(let i=0;i<length;i++){
        const key=storage.key(i);if(typeof key!=='string'||!key.startsWith(prefix))continue;
        const value=storage.getItem(key);if(typeof value!=='string'||value.length>131072)throw unavailable();
        let parsed=null;try{parsed=JSON.parse(value);}catch{}
        const extra=parsed?.notification?.extra;
        const unrelatedRow=parsed&&typeof parsed.scope==='string'&&(parsed.scope!==selector.principal
          ||typeof extra?.kind==='string'&&!['employee_lunch_coverage','employee_location_status'].includes(extra.kind)
          ||typeof extra?.service_date==='string'&&extra.service_date!==selector.service_date);
        if(parsed?.schema_version==='native-notification-schedule.v1'&&Number.isSafeInteger(parsed.id)){
          const canonical=parsed.id>0&&parsed.id<=2147483647&&key===prefix+parsed.id
            &&parsed.notification?.id===parsed.id&&typeof parsed.scope==='string';
          // Never use last-wins/alias DATA to hide a related UNKNOWN guard.
          if(byId.has(parsed.id)||!canonical)byId.set(parsed.id,{unrelated:false,ambiguous:true});
          else byId.set(parsed.id,{unrelated:unrelatedRow,ambiguous:false});
        }
        candidates.push({key,value,parsed,unrelatedRow});
      }
      const raw=[],last_verified_saves=[];let size=0;
      for(const row of candidates){
        const unrelatedGuard=row.parsed?.schema_version==='native-notification-schedule-guard.v1'
          &&typeof row.parsed.scope==='string'&&(row.parsed.scope!==selector.principal||byId.get(row.parsed.id)?.unrelated===true);
        if(row.unrelatedRow||unrelatedGuard){unrelated.rows++;continue;}
        if(raw.length>=256||(size+=row.key.length+row.value.length)>131072)throw unavailable();
        raw.push([row.key,row.value]);last_verified_saves.push([row.key,lastNativeSaves.get(row.key)??null]);
      }
      return {schema:'custodial.native-scheduler-ordinary-target-data.v1',receipt_eligible:false,
        scope:'EXACT_NORMAL_RAW_ROWS_AND_GUARDS_NOT_OS_SETTLEMENT',selector,prefix,raw,last_verified_saves,unrelated};
    },
    reconcile:()=>owned(reconcileUnlocked),
    ownsAction(notification){
      let original;if(requireNativeOwner){try{original=captureOwner();}catch{return false;}}
      const data=notification?.extra;
      const scope=data?.native_presentation_principal,id=Number(data?.native_presentation_id);
      if(!scope||scope!==identity()||!Number.isInteger(id)||notification.id!==id)return false;
      const row=records().find(r=>r.id===id&&r.scope===scope&&r.state==='scheduled');
      // Android returns the original scheduled JSON from its PendingIntent.
      // Bind that entire payload and numeric outer ID, not a reduced data bag.
      const accepted=Boolean(row&&!unconfirmed(row)&&equal(row.notification,notification)&&current(row.notification,scope));
      if(requireNativeOwner){try{requireOwner(original);}catch{return false;}}
      return accepted;
    },
    present(notification,scope){return owned(async checkpoint=>{
      await reconcileUnlocked(checkpoint);checkpoint();
      if(!scope||!current(notification,scope))return false;
      const rows=records(),data=notification.extra||{};
      const prior=rows.find(r=>r.scope===scope&&r.state==='scheduled'
        &&equal({...r.notification,id:undefined,group:undefined,extra:{...r.notification.extra,native_presentation_principal:undefined,native_presentation_id:undefined}},
          {...notification,id:undefined,group:undefined}));
      if(prior)return true;
      requireCustodialNewProducerAdmission();
      checkpoint();const pending=await plugin.getPending();checkpoint();
      const delivered=await plugin.getDeliveredNotifications();checkpoint();
      if(!Array.isArray(pending?.notifications)||!Array.isArray(delivered?.notifications))throw Error('Notification ID inventory unavailable.');
      if(!current(notification,scope))return false;
      const used=new Set([...rows,...pending.notifications,...delivered.notifications].map(r=>r.id));
      let id=1;while(used.has(id))id++;
      if(id>2147483647)throw Error('Notification ID space exhausted.');
      if(typeof globalThis.crypto?.randomUUID!=='function')throw Error('Notification ownership marker unavailable.');
      checkpoint();const group='mz-custodial-owned:'+globalThis.crypto.randomUUID();checkpoint();
      const owned={...notification,id,group,extra:{...data,native_presentation_principal:scope,native_presentation_id:String(id)}};
      const row={schema_version:'native-notification-schedule.v1',id,scope,notification:owned,delivery_ownership_group:group,state:'intent'};
      save(row,checkpoint); // Intent/readback precede the plugin side effect, including crash/restart.
      // A separate durable barrier survives a committed final write whose
      // readback fails. Never delete it until that exact write is confirmed.
      // Cancellation failure or later storage failure leaves the barrier intact
      // across process death; reconciliation cancels only this reserved ID.
      beginConfirmation(row,checkpoint);
      try{checkpoint();await plugin.schedule({notifications:[owned]});}
      catch(error){checkpoint();await cancel(row,checkpoint);checkpoint();return false;}
      checkpoint();
      if(!current(owned,scope)){await cancel(row,checkpoint);checkpoint();return false;}
      try{
        save({...row,state:'scheduled'},checkpoint);
        checkpoint();storage.removeItem(unconfirmedPrefix+row.id);checkpoint();
        if(unconfirmed(row))throw Error('Notification schedule confirmation guard retirement failed.');
        checkpoint();
      }catch(error){checkpoint();await cancel(row,checkpoint);throw error;}
      return true;
    });},
  });
}
