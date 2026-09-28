// Durable ownership of each local OS side effect. Keep cancelled rows as ID
// reservations/history; never cancel by guessing a key-derived numeric hash.
export function createPrincipalNotificationScheduler({identity,mutate,storage,prefix,plugin,isCurrent=()=>true}) {
  const unconfirmedPrefix=prefix+'unconfirmed:';
  const validGroup=value=>typeof value==='string'&&/^mz-custodial-owned:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
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
  function save(row){
    const key=prefix+row.id,value=JSON.stringify(row);storage.setItem(key,value);
    if(storage.getItem(key)!==value)throw Error('Notification schedule journal readback failed.');
  }
  const unconfirmed=row=>storage.getItem(unconfirmedPrefix+row.id)!==null;
  function beginConfirmation(row){
    const key=unconfirmedPrefix+row.id,value=JSON.stringify({schema_version:'native-notification-schedule-guard.v1',id:row.id,scope:row.scope});
    // A verified existing guard already closes action admission. Reuse it so
    // later storage-write failure cannot prevent compensating OS cancellation.
    const prior=storage.getItem(key);
    if(prior===value)return;
    if(prior!==null)throw Error('Notification schedule confirmation guard ownership conflict.');
    storage.setItem(key,value);
    if(storage.getItem(key)!==value)throw Error('Notification schedule confirmation guard readback failed.');
  }
  async function cancel(row){
    // Close action admission durably before either OS side effect. A resolved
    // cancel() promise does not prove an already-delivered notification gone.
    beginConfirmation(row);
    const pending=await plugin.getPending(),delivered=await plugin.getDeliveredNotifications();
    if(!Array.isArray(pending?.notifications)||!Array.isArray(delivered?.notifications))throw Error('Notification cancellation inventory unavailable.');
    const owned=delivered.notifications.filter(item=>item.id===row.id);
    if(pending.notifications.filter(item=>item.id===row.id).some(item=>item.extra?.native_presentation_principal!==row.scope
      ||item.extra?.native_presentation_id!==String(row.id)))throw Error('Notification cancellation ownership conflict.');
    // Android delivered inventory exposes group, not the scheduled JS extra.
    // A random per-intent marker is journaled before dispatch and returned by
    // the actual vendor API. Never substitute guessed numeric ID ownership.
    if(owned.some(item=>!validGroup(row.delivery_ownership_group)||item.group!==row.delivery_ownership_group||item.tag!=null))
      throw Error('Notification cancellation ownership conflict.');
    await plugin.cancel({notifications:[{id:row.id}]});
    if(owned.length)await plugin.removeDeliveredNotifications({notifications:owned});
    const remainingPending=await plugin.getPending(),remainingDelivered=await plugin.getDeliveredNotifications();
    if(!Array.isArray(remainingPending?.notifications)||!Array.isArray(remainingDelivered?.notifications))
      throw Error('Notification cancellation inventory unavailable.');
    if([...remainingPending.notifications,...remainingDelivered.notifications].some(item=>item.id===row.id))
      throw Error('Notification cancellation unconfirmed.');
    save({...row,state:'cancelled'});
  }
  async function reconcileUnlocked(){
    const failures=[];
    for(const row of records())if(row.state!=='cancelled'&&(row.state==='intent'||unconfirmed(row)||!current(row.notification,row.scope))){
      try{await cancel(row);}catch(error){failures.push(error);}
    }
    // One unresolved historical/conflicting row must not prevent retirement
    // of independent provably owned rows. Preserve each failed row and guard.
    if(failures.length)throw new AggregateError(failures,'Notification reconciliation incomplete: '+failures.map(e=>e.message).join('; '));
  }
  return Object.freeze({
    reconcile:()=>mutate(reconcileUnlocked),
    ownsAction(notification){
      const data=notification?.extra;
      const scope=data?.native_presentation_principal,id=Number(data?.native_presentation_id);
      if(!scope||scope!==identity()||!Number.isInteger(id)||notification.id!==id)return false;
      const row=records().find(r=>r.id===id&&r.scope===scope&&r.state==='scheduled');
      // Android returns the original scheduled JSON from its PendingIntent.
      // Bind that entire payload and numeric outer ID, not a reduced data bag.
      return Boolean(row&&!unconfirmed(row)&&equal(row.notification,notification)&&current(row.notification,scope));
    },
    present(notification,scope){return mutate(async()=>{
      await reconcileUnlocked();
      if(!scope||!current(notification,scope))return false;
      const rows=records(),data=notification.extra||{};
      const prior=rows.find(r=>r.scope===scope&&r.state==='scheduled'
        &&equal({...r.notification,id:undefined,group:undefined,extra:{...r.notification.extra,native_presentation_principal:undefined,native_presentation_id:undefined}},
          {...notification,id:undefined,group:undefined}));
      if(prior)return true;
      const pending=await plugin.getPending(),delivered=await plugin.getDeliveredNotifications();
      if(!Array.isArray(pending?.notifications)||!Array.isArray(delivered?.notifications))throw Error('Notification ID inventory unavailable.');
      if(!current(notification,scope))return false;
      const used=new Set([...rows,...pending.notifications,...delivered.notifications].map(r=>r.id));
      let id=1;while(used.has(id))id++;
      if(id>2147483647)throw Error('Notification ID space exhausted.');
      if(typeof globalThis.crypto?.randomUUID!=='function')throw Error('Notification ownership marker unavailable.');
      const group='mz-custodial-owned:'+globalThis.crypto.randomUUID();
      const owned={...notification,id,group,extra:{...data,native_presentation_principal:scope,native_presentation_id:String(id)}};
      const row={schema_version:'native-notification-schedule.v1',id,scope,notification:owned,delivery_ownership_group:group,state:'intent'};
      save(row); // Intent/readback precede the plugin side effect, including crash/restart.
      // A separate durable barrier survives a committed final write whose
      // readback fails. Never delete it until that exact write is confirmed.
      // Cancellation failure or later storage failure leaves the barrier intact
      // across process death; reconciliation cancels only this reserved ID.
      beginConfirmation(row);
      try{await plugin.schedule({notifications:[owned]});}
      catch(error){await cancel(row);return false;}
      if(!current(owned,scope)){await cancel(row);return false;}
      try{
        save({...row,state:'scheduled'});
        storage.removeItem(unconfirmedPrefix+row.id);
        if(unconfirmed(row))throw Error('Notification schedule confirmation guard retirement failed.');
      }catch(error){await cancel(row);throw error;}
      return true;
    });},
  });
}
