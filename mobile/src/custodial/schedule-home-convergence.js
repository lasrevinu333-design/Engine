import '../../../memphis-recurring-schedule-target.js';
import {homeBinding,zooServiceDate} from './home-facts.js';

// Home is a read-only consumer of the SAME protected schedule snapshot as the
// Schedule page. This is not native notification application or a phone ACK.
export function createScheduleHomeConvergence({identity,storage,mutate,matches,now=()=>Date.now()}) {
  const api=globalThis.MemphisRecurringScheduleTarget||globalThis.window?.MemphisRecurringScheduleTarget;
  const prefix='mz_employee_schedule_snapshot:';
  const pending=new Map(),unavailableDays=new Map();
  const key=id=>prefix+encodeURIComponent(id.protectedBinding);
  const capture=id=>api.availability(storage,id.protectedBinding,zooServiceDate(now()));
  const assertAvailability=(id,observed)=>api.assertAvailability(storage,id.protectedBinding,zooServiceDate(now()),observed);
  const atomic=(id,operation)=>api.withScheduleLock(id.protectedBinding,()=>mutate(operation));
  const latch=(id,observed)=>unavailableDays.set(homeBinding(id),{date:zooServiceDate(now()),stamp:observed?.stamp??null});
  function locallyUnavailable(id,fence){
    const marker=unavailableDays.get(homeBinding(id));if(marker?.date!==zooServiceDate(now()))return false;
    if(fence?.state==='AVAILABLE'&&fence.stamp!==marker.stamp){unavailableDays.delete(homeBinding(id));return false;}
    return true;
  }
  async function begin(id,{signal}={}){
    let observed=capture(id),ticket;
    try{await atomic(id,()=>{if(signal?.aborted)throw failure('schedule_request_invalidated');if(!current(id))throw failure('schedule_target_principal');
      observed=capture(id);ticket=api.writeAvailability(storage,id.protectedBinding,zooServiceDate(now()),'READING',observed);});}
    catch(error){
      // A cacheless first read may still show fresh transport facts if optional
      // persistence is down. With ANY prior snapshot/fence, first durably fence
      // it or do not issue the request whose unavailable result could be lost.
      // Unknown presence must latch before a second storage read can throw.
      if(error?.code==='schedule_request_invalidated')throw error;
      latch(id,observed);
      if(error?.code==='schedule_atomic_storage_unavailable')throw error;
      if(observed!==null||storage.getItem(key(id))!==null)throw error;
      unavailableDays.delete(homeBinding(id));
      return null;
    }
    if(!ticket)throw failure('schedule_availability_write_failed');return ticket;
  }
  async function cancel(id,ticket){if(ticket?.state!=='READING')return;
    await atomic(id,()=>{if(!current(id))throw failure('schedule_target_principal');api.writeAvailability(storage,id.protectedBinding,zooServiceDate(now()),ticket.priorState,ticket);});}
  const current=id=>id?.protectedBinding&&homeBinding(identity())===homeBinding(id);
  const failure=code=>Object.assign(new Error(code),{code});
  function unavailable(id,blocked=false){return {service_date:zooServiceDate(now()),canonical_device_id:id.deviceId,
    employee_id:id.employeeId,employee_name:id.employeeName,projection_status:blocked?'blocked_recurring_authority':'unavailable',
    shift:null,lunch:null,stale:true};}
  function read(id){
    const raw=storage.getItem(key(id));if(raw===null)return null;
    let row;try{row=JSON.parse(raw);}catch{throw failure('schedule_cached_state_invalid');}
    if(row?.schema_version!=='employee-schedule-snapshot.v2'||row.device_id!==id.deviceId
      ||row.principal!==id.protectedBinding||!matches(row.data))throw failure('schedule_cached_scope_mismatch');
    api.assertSnapshot(row); // Malformed is not a valid expired day.
    if(row.data.service_date!==zooServiceDate(now()))return null;
    if(row.recurring_target){
      api.assertMonotonic(row.recurring_target,row.recurring_target);
      const t=row.recurring_target;
      if(t.serviceDate!==row.data.service_date||t.principal.employeeId!==id.employeeId
        ||t.principal.credentialId!==id.credentialId||t.principal.assignmentEpoch!==id.assignmentEpoch)
        throw failure('schedule_cached_scope_mismatch');
    }
    return row;
  }
  function highest(id){
    const disk=read(id),memory=pending.get(homeBinding(id));
    const live=memory?.data?.service_date===zooServiceDate(now())?memory:null;
    const winner=api.confirmedSnapshot(disk,live);
    if(winner)pending.set(homeBinding(id),winner);
    return winner;
  }
  function facts(row,id){
    const data=row.data,t=row.recurring_target;
    if(t?.blocked)return unavailable(id,true);
    const home=data.home_facts;
    // Supplemental clock facts are authenticated separately by the same SQL
    // projection. They may not borrow a different date/employee/projection.
    const publication=t?.target.publicationId??data.schedule_application?.publication_id??data.publication_id;
    const projection=t?.target.projectionId??data.schedule_application?.projection_id??data.projection_id;
    if((t||home)&&(!home||home.service_date!==data.service_date||home.employee_id!==id.employeeId
      ||!publication||!projection||home.projection_id!==projection||home.publication_id!==publication
      ||home.projection_status!=='current'))return unavailable(id);
    return {...(home||data),canonical_device_id:data.canonical_device_id,device_id:data.device_id,
      schedule_readback_at:row.saved_at,schedule_target_digest:t?.targetDigest,
      stale:row.cache_unconfirmed===true||(!t&&data.stale===true)||home?.stale===true};
  }
  function resolve(id,fallback){
    if(!current(id))return unavailable(id);
    try{const before=capture(id),row=highest(id),fence=assertAvailability(id,before);if(locallyUnavailable(id,fence)||fence&&fence.state!=='AVAILABLE')return unavailable(id);
      // Flattened Home caches have lost their owning target/provenance. They
      // cannot replace a missing shared row, including historical V4 bytes.
      if(!row)return unavailable(id);
      const result=facts(row,id);
      return {...result,stale:result.stale===true||fallback?.stale===true
        ||Boolean(row.recurring_target&&fallback?.schedule_target_digest!==row.recurring_target.targetDigest)};}
    catch{return unavailable(id);}
  }
  async function accept(day,id,{signal,observedAvailability=capture(id)}={}){
    if(signal?.aborted||!current(id)||!matches(day))throw failure('schedule_target_principal');
    day=JSON.parse(JSON.stringify(day)); // Caller-owned response cannot change across a protected-store await.
    if(day?.service_date!==zooServiceDate(now()))throw failure('schedule_target_date');
    const mode=api.deliveryMode(day);
    if(mode==='UNAVAILABLE'){
      try{await atomic(id,()=>{
        if(signal?.aborted||!current(id)||!matches(day))throw failure('schedule_target_principal');
        api.writeAvailability(storage,id.protectedBinding,day.service_date,'UNAVAILABLE',observedAvailability);
      });}catch(error){if(error?.code!=='schedule_request_invalidated')latch(id,observedAvailability);throw error;}
      unavailableDays.delete(homeBinding(id));return unavailable(id);
    }
    const previous=highest(id);
    if(mode==='LEGACY_REGISTERED'){
      const row={schema_version:'employee-schedule-snapshot.v2',device_id:id.deviceId,principal:id.protectedBinding,
        saved_at:new Date(now()).toISOString(),data:day};
      api.assertSnapshotProgress(previous,row);
      // Same protected authority path as typed delivery; it is not a phone ACK.
      try{await atomic(id,()=>{
        if(signal?.aborted||!current(id)||!matches(day))throw failure('schedule_target_principal');
        if(day.service_date!==zooServiceDate(now()))throw failure('schedule_target_date');
        assertAvailability(id,observedAvailability);
        api.assertSnapshotProgress(highest(id),row);
        const encoded=JSON.stringify(row);storage.setItem(key(id),encoded);
        if(storage.getItem(key(id))!==encoded)throw Error('schedule cache readback failed');
        if(observedAvailability)api.writeAvailability(storage,id.protectedBinding,day.service_date,'AVAILABLE',observedAvailability);
      });}catch(error){if(error?.code?.startsWith('schedule_'))throw error;
        if(signal?.aborted||!current(id))throw failure('schedule_target_principal');
        api.assertSnapshotProgress(highest(id),row);row.cache_unconfirmed=true;}
      if(signal?.aborted||!current(id))throw failure('schedule_target_principal');
      pending.set(homeBinding(id),api.newestSnapshot(highest(id),row));
      unavailableDays.delete(homeBinding(id));return resolve(id,facts(row,id));
    }
    const prepared=await api.prepare({delivery:day.recurring_delivery,serviceDate:day.service_date,
      expectedPrincipal:{deviceId:day.canonical_device_pk,employeeId:id.employeeId,credentialId:id.credentialId,assignmentEpoch:id.assignmentEpoch},
      previous:previous?.recurring_target??null});
    if(prepared.blocked!==(mode==='RECURRING_TERMINAL'))throw failure('schedule_target_mode_mismatch');
    const data={...day,...(prepared.blocked?{projection_status:'blocked_recurring_authority',raw_items:[],current_items:[],full_day:true,shift:null}:prepared.view)};
    const row={schema_version:'employee-schedule-snapshot.v2',device_id:id.deviceId,principal:id.protectedBinding,
      saved_at:new Date(now()).toISOString(),data,recurring_target:prepared};
    const assertCurrent=()=>{
      if(signal?.aborted||!current(id)||!matches(data))throw failure('schedule_target_principal');
      if(data.service_date!==zooServiceDate(now()))throw failure('schedule_target_date');
      assertAvailability(id,observedAvailability);
      const winner=highest(id);
      api.assertSnapshotProgress(winner,row);
      api.assertMonotonic(winner?.recurring_target??null,prepared);
      const revision=Number(winner?.data?.schedule_application?.authority_revision??winner?.data?.projection_authority_revision);
      if(Number.isSafeInteger(revision)&&revision>prepared.target.authorityRevision)throw failure('schedule_target_older_than_cache');
    };
    assertCurrent();
    try{await atomic(id,()=>{
      assertCurrent(); // Another page may win while hashing / awaiting the lock.
      const encoded=JSON.stringify(row);storage.setItem(key(id),encoded);
      if(storage.getItem(key(id))!==encoded)throw Error('schedule cache readback failed');
      if(observedAvailability)api.writeAvailability(storage,id.protectedBinding,day.service_date,'AVAILABLE',observedAvailability);
    });}catch(error){
      if(error?.code?.startsWith('schedule_'))throw error;
      // Keep a validated terminal in this live page even if storage fails.
      // It is explicitly unconfirmed, never an applied receipt.
      assertCurrent();row.cache_unconfirmed=true;
    }
    if(signal?.aborted||!current(id))throw failure('schedule_target_principal');
    pending.set(homeBinding(id),api.newestSnapshot(highest(id),row));
    unavailableDays.delete(homeBinding(id));
    return resolve(id,facts(row,id));
  }
  return {accept,resolve,capture,begin,cancel,isStorageKey:value=>typeof value==='string'&&(value.startsWith(prefix)||value.startsWith(api.AVAILABILITY_PREFIX))};
}
