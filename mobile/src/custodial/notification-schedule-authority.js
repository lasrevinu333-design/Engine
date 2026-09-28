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
  return Object.freeze({
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
          if(!digest(lunch)||data.document_identity!==lunch)return false;
        }
        return day===zooServiceDate(now())&&!quarantined;
      }catch{return false;}
    },
  });
}
