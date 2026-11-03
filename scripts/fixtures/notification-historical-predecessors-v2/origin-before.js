import '../../../memphis-recurring-schedule-target.js';
import {profileMatchesPrincipal} from './protected-principal.js';
import {zooServiceDate} from './home-facts.js';

// Presentation eligibility only: no cleaning authority, device ACK or native
// provider receipt is granted here. The mounted closed-process provider still
// needs its own application boundary before a complete phone ACK is enabled.
export function createScheduleNotificationAuthority({identity,principal,status,storage,mutate=operation=>operation(),now=()=>Date.now()}) {
  const api=globalThis.MemphisRecurringScheduleTarget||globalThis.window?.MemphisRecurringScheduleTarget;
  const prefix='mz_employee_schedule_snapshot:',states=new Map();
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)
    ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
  const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
  let securityGeneration=0,quarantined=false;
  const activeSessions=new Map();
  const acceptedReads=new WeakMap(),acceptedReadSequences=new Map();
  const trip=()=>{securityGeneration++;quarantined=true;};
  function guarded(read){try{return read();}catch(error){trip();throw error;}}
  const readIdentity=()=>guarded(identity);
  const readPrincipal=()=>guarded(()=>copy(principal()));
  const healthy=value=>value?.ready===true&&value?.available===true&&value?.quarantined!==true;
  function usable(scope){
    try{const good=guarded(()=>healthy(status()));
      if(!good){trip();return false;}
      return Boolean(scope&&scope===readIdentity()&&!quarantined);
    }catch{return false;}}
  function assertRow(row,scope){
    if(!object(row)||row.schema_version!=='employee-schedule-snapshot.v2'||row.principal!==scope
      ||row.device_id!==readPrincipal()?.device_id||!object(row.data)||!profileMatchesPrincipal(row.data,readPrincipal()))
      throw Error('Notification schedule principal unavailable.');
    api.newestSnapshot(row,null);
    return row;
  }
  function disk(scope,day){const raw=storage.getItem(prefix+encodeURIComponent(scope));
    if(raw===null)return null;
    const row=assertRow(JSON.parse(raw),scope);
    return row.data.service_date===day?row:null;
  }
  function state(scope,day){const prior=states.get(scope);
    if(prior?.day===day)return prior;
    const fresh={day,row:null,unavailable:false,responseSequence:0};states.set(scope,fresh);return fresh;}
  function winner(scope,day){return api.newestSnapshot(disk(scope,day),state(scope,day).row);}
  const atomic=(scope,operation)=>api.withScheduleLock(scope,()=>mutate(operation));
  function ticket(scope){const day=zooServiceDate(now()),known=state(scope,day);
    return {scope,day,sequence:++known.responseSequence,generation:securityGeneration,fence:api.availability(storage,scope,day)};}
  function ticketCurrent(t){return Boolean(t&&t.generation===securityGeneration&&t.day===zooServiceDate(now())
    &&state(t.scope,t.day).responseSequence===t.sequence&&usable(t.scope));}
  function ticketFenceCurrent(t){if(!ticketCurrent(t))return false;
    try{api.assertAvailability(storage,t.scope,t.day,t.fence);return true;}catch{return false;}}
  const locationKey=(scope,day,location)=>JSON.stringify([scope,day,location]);
  function instant(value){
    if(typeof value!=='string')return null;
    const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|\+00:00)$/.exec(value);
    if(!m)return null;
    const millis=m[1]+'.'+(m[2]||'').padEnd(6,'0').slice(0,3)+'Z',time=Date.parse(millis);
    if(!Number.isFinite(time)||new Date(time).toISOString()!==millis)return null;
    return BigInt(time)*1000n+BigInt((m[2]||'').padEnd(6,'0').slice(3));
  }
  const dateValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&instant(value+'T00:00:00Z')!==null;
  const activeSessionFields=['service_date','location_id','projection_id','open_session_uuid',
    'open_session_status','open_session_started_at','open_session_device_identifier'];
  const reminderKey=value=>{
    if(typeof value!=='string')return null;
    const match=/^location-visit:(\d{4}-\d{2}-\d{2}):([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}):(due_soon|overdue):(\d{20}):(0|[1-9]\d{0,18}):projection:([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/.exec(value);
    if(!match||!dateValid(match[1])||BigInt(match[5])>9223372036854775807n
      ||match[3]==='due_soon'&&match[5]!=='0')return null;
    const stamp=match[4],time=instant(`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(8,10)}:${stamp.slice(10,12)}:${stamp.slice(12,14)}.${stamp.slice(14)}Z`);
    return time!==null?{service_date:match[1],location_id:match[2],status_code:match[3],cycle_base_at:time,projection_id:match[6]}:null;
  };
  function acceptedReadCurrent(token,scope){
    try{
      const t=acceptedReads.get(token),health=guarded(status);
      if(!t||t.scope!==scope||!usable(scope)||!Number.isSafeInteger(health?.generation)
        ||health.generation!==t.generation||securityGeneration!==t.securityGeneration
        ||t.day!==zooServiceDate(now())||acceptedReadSequences.get(scope)!==t.sequence
        ||!same(readPrincipal(),t.principal))return false;
      const known=state(scope,t.day),row=winner(scope,t.day);
      api.assertAvailability(storage,scope,t.day,t.fence);
      return known.responseSequence===t.scheduleSequence&&!known.unavailable&&same(known.row,t.row)&&same(row,t.row);
    }catch{return false;}
  }
  function beginAcceptedLocationSessionRead(scope=readIdentity()){
    try{
      if(!usable(scope))return null;
      const health=guarded(status),p=readPrincipal(),day=zooServiceDate(now()),known=state(scope,day),row=winner(scope,day);
      if(!Number.isSafeInteger(health?.generation)||health.generation<0||!row||!same(row,known.row))return null;
      const target=row.recurring_target?.target,projection=target?.projectionId??row.data.projection_id;
      if(!authority.isCurrent({kind:'employee_location_status',service_date:day,projection_id:projection,
        receipt_employee_id:p.employee_id,receipt_credential_id:p.credential_id,
        receipt_device_id:p.device_id,receipt_assignment_epoch:String(p.assignment_epoch)},scope))return null;
      const sequence=(acceptedReadSequences.get(scope)||0)+1;acceptedReadSequences.set(scope,sequence);
      const token=Object.freeze({});acceptedReads.set(token,{scope,principal:p,day,row:copy(row),sequence,
        generation:health.generation,securityGeneration,scheduleSequence:known.responseSequence,fence:api.availability(storage,scope,day)});
      return acceptedReadCurrent(token,scope)?token:null;
    }catch{return null;}
  }
  function observeAcceptedLocationSession(data,scope=readIdentity(),readToken=null){
    try{
      if(!acceptedReadCurrent(readToken,scope)||!usable(scope)||!object(data)||scope!==readIdentity())return false;
      const read=acceptedReads.get(readToken);
      const day=zooServiceDate(now()),p=readPrincipal(),started=instant(data.open_session_started_at);
      if(data.service_date!==day||data.employee_id!==p.employee_id||data.device_id!==p.device_id
        ||data.credential_id!==p.credential_id
        ||String(data.assignment_epoch)!==String(p.assignment_epoch)||!uuid(data.location_id)||!uuid(data.projection_id)
        ||!uuid(data.open_session_uuid)||!['active','pending_submit'].includes(data.open_session_status)
        ||started===null||zooServiceDate(Number(started/1000n))!==day||started>BigInt(now())*1000n
        ||data.open_session_device_identifier!==data.device_id
        ||activeSessionFields.some(key=>!Object.hasOwn(data,key)))return false;
      // Reuse the mounted schedule/principal fences; session evidence cannot
      // seed retirement under a foreign projection or unavailable schedule.
      if(!authority.isCurrent({kind:'employee_location_status',service_date:day,projection_id:data.projection_id,
        ...(data.schedule_authority_revision===undefined?{}:{schedule_authority_revision:data.schedule_authority_revision}),
        receipt_employee_id:p.employee_id,receipt_credential_id:p.credential_id,
        receipt_device_id:p.device_id,receipt_assignment_epoch:String(p.assignment_epoch)},scope))return false;
      const row=state(scope,day).row,revision=row.recurring_target?.target?.authorityRevision
        ??row.data.schedule_application?.authority_revision??row.data.projection_authority_revision;
      // This is the CURRENT projection observation and authenticated READ
      // owner, not an assertion of the START's originating credential/revision.
      if(!['string','number'].includes(typeof data.schedule_authority_revision)
        ||! /^[1-9][0-9]{0,18}$/.test(String(data.schedule_authority_revision))
        ||BigInt(String(data.schedule_authority_revision))>9223372036854775807n
        ||typeof data.schedule_authority_revision==='number'&&!Number.isSafeInteger(data.schedule_authority_revision)
        ||String(data.schedule_authority_revision)!==String(revision))return false;
      const key=locationKey(scope,day,data.location_id),prior=activeSessions.get(key);
      if(prior?.projection_id===data.projection_id&&prior.revision===revision
        &&(started<prior.started||started===prior.started&&prior.open_session_uuid!==data.open_session_uuid))return false;
      const observed=Object.freeze({...Object.fromEntries(activeSessionFields.map(key=>[key,data[key]])),started,revision,
        generation:read.generation,securityGeneration:read.securityGeneration});
      if(!acceptedReadCurrent(readToken,scope))return false;
      activeSessions.set(key,observed);
      return true;
    }catch{return false;}
  }
  function retiredByStart(data,scope,day,revision){
    const observed=activeSessions.get(locationKey(scope,day,data.location_id)),parsed=reminderKey(data.notification_key);
    return Boolean(observed&&parsed&&parsed.service_date===day&&parsed.location_id===data.location_id
      &&observed.generation===guarded(status)?.generation&&observed.securityGeneration===securityGeneration
      &&parsed.projection_id===data.projection_id&&parsed.projection_id===observed.projection_id
      &&observed.revision===revision&&parsed.cycle_base_at<=observed.started);
  }
  function civilClock(time){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time));
    const get=key=>parts.find(part=>part.type===key).value;
    return {day:`${get('year')}-${get('month')}-${get('day')}`,seconds:Number(get('hour'))*3600+Number(get('minute'))*60+Number(get('second'))};
  }
  function civilSeconds(value){
    if(typeof value!=='string')return null;
    const m=/^([01][0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/.exec(value);
    return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]||0):null;
  }
  function lunchCurrent(data,row,p,day){
    if(!digest(data.loan_id)||!['start','end'].includes(data.event))return false;
    const at=now(),clock=civilClock(at),scheduled=instant(data.scheduled_at),scheduledTime=civilSeconds(data.scheduled_time);
    if(scheduled===null||scheduledTime===null||scheduled>BigInt(at)*1000n)return false;
    const scheduledClock=civilClock(Number(scheduled/1000n));
    if(clock.day!==day||scheduledClock.day!==day||scheduledClock.seconds!==scheduledTime)return false;
    const items=row.data.full_day===true?row.data.raw_items:row.data.current_items;
    if(!Array.isArray(items))return false;
    // These are accepted responsibility SEGMENTS in the hashed current view,
    // not a reconstructed full loan/document or a caller's claimed duration.
    const matching=items.filter(item=>object(item)&&item.loan_id===data.loan_id
      &&(item.coverage_purpose??item.purpose)==='lunch_coverage');
    if(!matching.length||matching.some(item=>item.coverer_person_id!==p.employee_id
      ||item.service_date!==day||item.projection_id!==data.projection_id))return false;
    const windows=matching.map(item=>({start:civilSeconds(item.coverage_start),end:civilSeconds(item.coverage_end)}));
    if(windows.some(w=>w.start===null||w.end===null||w.start>=w.end))return false;
    // Native supplies an original finite cutoff; never replace it with an
    // inferred hour. Legacy START is bounded by accepted responsibility time.
    if(data.valid_until!==undefined){const until=instant(data.valid_until);
      if(until===null||until<=scheduled||BigInt(at)*1000n>=until)return false;}
    if(data.event==='end')return data.valid_until!==undefined
      &&windows.every(w=>scheduledTime>=w.end)&&clock.seconds>=scheduledTime;
    return windows.every(w=>scheduledTime<=w.start)
      &&windows.some(w=>w.start<=clock.seconds&&clock.seconds<w.end);
  }
  async function beginResponse(scope=readIdentity()){
    if(!usable(scope))throw Error('Notification schedule principal unavailable.');
    const t=ticket(scope);
    try{await atomic(scope,()=>{
      if(!ticketCurrent(t))throw Error('Notification schedule read superseded.');
      const observed=api.availability(storage,scope,t.day);
      // Home/Schedule may already own this exact read-ahead. Join its stamp,
      // never replace it and invalidate the caller's eventual commit ticket.
      t.fence=observed?.state==='READING'?observed:api.writeAvailability(storage,scope,t.day,'READING',observed);
    });}catch(error){if(ticketCurrent(t))state(scope,t.day).unavailable=true;throw error;}
    return t;
  }
  async function unavailable(scope=readIdentity(),t=null){
    if(!scope||!usable(scope))return false;
    if(!t)t=ticket(scope);
    if(t.scope!==scope||!ticketFenceCurrent(t))return false;
    const known=state(scope,t.day);known.unavailable=true;
    // Invalidate older responses synchronously, before any lock/storage await.
    t={...t,sequence:++known.responseSequence};
    try{await atomic(scope,()=>{
      if(!ticketFenceCurrent(t))return;
      api.writeAvailability(storage,scope,t.day,'UNAVAILABLE',t.fence);
    });return true;}catch{return false;}
  }
  async function validate(row,scope,day){
    row=copy(assertRow(row,scope));
    if(row.data.service_date!==day||day!==zooServiceDate(now()))throw Error('Notification schedule date unavailable.');
    const mode=api.deliveryMode(row.data),p=readPrincipal();
    if(mode==='UNAVAILABLE')throw Error('Notification schedule unavailable.');
    if(mode!=='LEGACY_REGISTERED'){
      const prepared=await api.prepare({delivery:row.data.recurring_delivery,serviceDate:row.data.service_date,
        expectedPrincipal:{deviceId:row.data.canonical_device_pk,employeeId:p.employee_id,
          credentialId:p.credential_id,assignmentEpoch:p.assignment_epoch}});
      if(prepared.blocked!==(mode==='RECURRING_TERMINAL'))throw Error('Notification schedule mode conflict.');
      if(row.recurring_target&&!same(row.recurring_target,prepared))throw Error('Notification schedule target conflict.');
      row.recurring_target=prepared;
      if(!prepared.blocked){for(const key of Object.keys(prepared.view))
        if(key!=='schema'&&!same(row.data[key],prepared.view[key]))throw Error('Notification schedule render conflict.');}
    }else{
      if(row.recurring_target||row.data.projection_status!=='current'
        ||!uuid(row.data.projection_id)||!uuid(row.data.publication_id))throw Error('Notification legacy schedule unavailable.');
    }
    return row;
  }
  async function commit(row,scope,generation,day,t=null){
    row=await validate(row,scope,day);
    if(generation!==securityGeneration||!usable(scope)||row.data.service_date!==day||day!==zooServiceDate(now())||t&&!ticketFenceCurrent(t))return false;
    const previous=winner(scope,day);
    api.assertSnapshotProgress(previous,row);
    const next=api.newestSnapshot(previous,row);
    // If another page wins while hashing, do not bless its unvalidated bytes.
    if(!same(next,row))return false;
    if(generation!==securityGeneration||day!==zooServiceDate(now())||t&&!ticketFenceCurrent(t))return false;
    state(scope,day).row=row;return true;
  }
  const authority=Object.freeze({
    beginResponse,
    // Only the authenticated transport calls observe. A DOM event never carries
    // replacement schedule authority or clears an unavailable response.
    async observe(data,scope=readIdentity(),responseTicket=null){
      if(!usable(scope))return false;
      const t=responseTicket??ticket(scope);if(t.scope!==scope||!ticketFenceCurrent(t))return false;
      const generation=securityGeneration,capturedDay=zooServiceDate(now()),day=copy(data),p=readPrincipal();
      if(!object(day)||!profileMatchesPrincipal(day,p)||day.service_date!==capturedDay)return false;
      const mode=api.deliveryMode(day);
      if(mode==='UNAVAILABLE'){await unavailable(scope,t);return false;}
      const row={schema_version:'employee-schedule-snapshot.v2',principal:scope,device_id:p.device_id,data:day};
      if(mode!=='LEGACY_REGISTERED'){
        const prepared=await api.prepare({delivery:day.recurring_delivery,serviceDate:day.service_date,
          expectedPrincipal:{deviceId:day.canonical_device_pk,employeeId:p.employee_id,credentialId:p.credential_id,assignmentEpoch:p.assignment_epoch}});
        row.recurring_target=prepared;
        row.data={...day,...(prepared.blocked?{projection_status:'blocked_recurring_authority',raw_items:[],current_items:[],full_day:true,shift:null}:prepared.view)};
      }
      if(await commit(row,scope,generation,capturedDay,t)){state(scope,capturedDay).unavailable=false;return true;}
      return false;
    },
    async refresh(){const scope=readIdentity(),generation=securityGeneration,day=zooServiceDate(now());
      if(!usable(scope))return false;
      const fence=api.availability(storage,scope,day);if(fence&&fence.state!=='AVAILABLE')return false;
      const row=winner(scope,day);if(!row)return false;
      return commit(row,scope,generation,day);
    },
    securityChanged(value){const generation=++securityGeneration;quarantined=true;
      try{const corroborated=guarded(()=>healthy(value)&&healthy(status())&&Boolean(readIdentity())&&Boolean(readPrincipal()));
        if(corroborated&&generation===securityGeneration)quarantined=false;
      }catch{quarantined=true;}
    },
    unavailable,
    beginAcceptedLocationSessionRead,
    acceptedLocationSessionReadCurrent:acceptedReadCurrent,
    finishAcceptedLocationSessionRead:token=>acceptedReads.delete(token),
    observeAcceptedLocationSession,
    isLocationReminderRetired(data,scope){
      try{
        if(data?.kind!=='employee_location_status'||!authority.isCurrent({...data,location_id:undefined,notification_key:undefined},scope))return false;
        const day=zooServiceDate(now()),row=state(scope,day).row,revision=row.recurring_target?.target?.authorityRevision
          ??row.data.schedule_application?.authority_revision??row.data.projection_authority_revision;
        return retiredByStart(data,scope,day,revision);
      }catch{return false;}
    },
    isStorageKey:key=>typeof key==='string'&&key.startsWith(prefix),
    isCurrent(data,scope){
      try{
        if(!usable(scope))return false;
        if(!['employee_lunch_coverage','employee_location_status'].includes(data?.kind))return true;
        const day=zooServiceDate(now()),known=state(scope,day),before=api.availability(storage,scope,day),row=winner(scope,day);
        const fence=api.assertAvailability(storage,scope,day,before);
        // An existing validated in-process owner may remain current while its
        // ordinary poll is pending; a restart cannot re-authorize old cache
        // through an unfinished read, nor recover an unavailable prior state.
        if(fence?.state==='UNAVAILABLE'||fence?.state==='READING'&&fence.priorState!=='AVAILABLE'||known.unavailable||!known.row||!row||!same(row,known.row)||row.recurring_target?.blocked
          ||api.deliveryMode(row.data)==='UNAVAILABLE'||row.data.projection_status!=='current')return false;
        if(row.data.service_date!==day||known.day!==day)return false;
        const p=readPrincipal();
        if(data.receipt_employee_id!==p.employee_id||data.receipt_credential_id!==p.credential_id
          ||data.receipt_device_id!==p.device_id||String(data.receipt_assignment_epoch)!==String(p.assignment_epoch)
          ||data.service_date!==known.day)return false;
        const target=row.recurring_target?.target,projection=target?.projectionId??row.data.projection_id;
        if(!uuid(data.projection_id)||data.projection_id!==projection)return false;
        const revision=target?.authorityRevision??row.data.schedule_application?.authority_revision??row.data.projection_authority_revision;
        if(data.schedule_authority_revision!==undefined&&String(data.schedule_authority_revision)!==String(revision))return false;
        if(data.kind==='employee_lunch_coverage'){
          const lunch=target?.lunchDocumentIdentity??row.data.schedule_application?.lunch_document_identity??row.data.lunch_document_identity;
          if(!digest(lunch)||data.document_identity!==lunch||!lunchCurrent(data,row,p,day))return false;
        }
        if(data.kind==='employee_location_status'){
          // A server-accepted active session retires only its old canonical
          // cycle. A later cycle remains eligible, while malformed or legacy
          // keys retain the schedule-only contract.
          if(retiredByStart(data,scope,day,revision))return false;
        }
        return day===zooServiceDate(now())&&!quarantined;
      }catch{return false;}
    },
  });
  return authority;
}
