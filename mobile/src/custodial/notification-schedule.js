// Durable ownership of each local OS side effect. Keep cancelled rows as ID
// reservations/history; never cancel by guessing a key-derived numeric hash.
export function createPrincipalNotificationScheduler({identity,mutate,storage,prefix,plugin}) {
  const unconfirmedPrefix=prefix+'unconfirmed:';
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
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
        ||row.notification.extra?.native_presentation_id!==String(row.id))throw Error('Invalid owned notification schedule journal.');
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
    storage.setItem(key,value);
    if(storage.getItem(key)!==value)throw Error('Notification schedule confirmation guard readback failed.');
  }
  async function cancel(row){
    await plugin.cancel({notifications:[{id:row.id}]});
    save({...row,state:'cancelled'});
  }
  async function reconcileUnlocked(){
    for(const row of records())if(row.state!=='cancelled'&&(row.scope!==identity()||row.state==='intent'||unconfirmed(row)))await cancel(row);
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
      return Boolean(row&&!unconfirmed(row)&&equal(row.notification,notification));
    },
    present(notification,scope){return mutate(async()=>{
      await reconcileUnlocked();
      if(!scope||scope!==identity())return false;
      const rows=records(),data=notification.extra||{};
      const prior=rows.find(r=>r.scope===scope&&r.state==='scheduled'
        &&equal({...r.notification,id:undefined,extra:{...r.notification.extra,native_presentation_principal:undefined,native_presentation_id:undefined}},
          {...notification,id:undefined}));
      if(prior)return true;
      const pending=await plugin.getPending(),delivered=await plugin.getDeliveredNotifications();
      if(!Array.isArray(pending?.notifications)||!Array.isArray(delivered?.notifications))throw Error('Notification ID inventory unavailable.');
      if(scope!==identity())return false;
      const used=new Set([...rows,...pending.notifications,...delivered.notifications].map(r=>r.id));
      let id=1;while(used.has(id))id++;
      if(id>2147483647)throw Error('Notification ID space exhausted.');
      const owned={...notification,id,extra:{...data,native_presentation_principal:scope,native_presentation_id:String(id)}};
      const row={schema_version:'native-notification-schedule.v1',id,scope,notification:owned,state:'intent'};
      save(row); // Intent/readback precede the plugin side effect, including crash/restart.
      // A separate durable barrier survives a committed final write whose
      // readback fails. Never delete it until that exact write is confirmed.
      // Cancellation failure or later storage failure leaves the barrier intact
      // across process death; reconciliation cancels only this reserved ID.
      beginConfirmation(row);
      try{await plugin.schedule({notifications:[owned]});}
      catch(error){await cancel(row);return false;}
      if(scope!==identity()){await cancel(row);return false;}
      try{
        save({...row,state:'scheduled'});
        storage.removeItem(unconfirmedPrefix+row.id);
        if(unconfirmed(row))throw Error('Notification schedule confirmation guard retirement failed.');
      }catch(error){await cancel(row);throw error;}
      return true;
    });},
  });
}
