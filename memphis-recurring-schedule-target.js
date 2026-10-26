(function installRecurringScheduleTarget(root) {
  'use strict';
  // Pure validation only. The caller must still persist/read back the exact
  // cache, render it and authenticate the ACK. This module does not touch any
  // cleaning clock, draft, queue, native journal, notification or storage.
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const DIGEST=/^[0-9a-f]{64}$/;
  const uuid=value=>typeof value==='string'&&UUID.test(value);
  const hash=value=>typeof value==='string'&&DIGEST.test(value);
  const BASE=['schema','targetType','operationId','publicationId','serviceDate','authorityRevision','employeeId','deviceId','credentialId','assignmentEpoch'];
  const SCHEDULE=[...BASE,'projectionId','lunchDocumentIdentity','viewDigest'];
  const TERMINAL=[...BASE,'invalidationId','reasonCode'];
  const CACHE_SCHEMA='memphis-zoo.recurring-schedule-cache.v1';
  const fail=code=>Object.assign(new Error(code),{code});
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  function exactKeys(value,keys){if(!object(value)||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw fail('schedule_target_shape');}
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw fail('schedule_target_date');
    const parsed=new Date(value+'T12:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw fail('schedule_target_date');return value;}
  function principal(value){if(!object(value)||!['deviceId','credentialId','employeeId'].every(k=>typeof value[k]==='string'&&UUID.test(value[k]))
    ||!Number.isSafeInteger(value.assignmentEpoch)||value.assignmentEpoch<1)throw fail('schedule_target_principal');
    return {deviceId:value.deviceId,credentialId:value.credentialId,employeeId:value.employeeId,assignmentEpoch:value.assignmentEpoch};}
  function sameEpoch(a,b){return a.deviceId===b.deviceId&&a.employeeId===b.employeeId&&a.assignmentEpoch===b.assignmentEpoch;}
  function assertTarget(value,expected){
    const blocked=value?.targetType==='BLOCKED_RECURRING_AUTHORITY';
    exactKeys(value,blocked?TERMINAL:SCHEDULE);
    if(value.schema!==(blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1')
      ||(!blocked&&value.targetType!=='SCHEDULE')||!uuid(value.operationId)||!uuid(value.publicationId)
      ||!Number.isSafeInteger(value.authorityRevision)||value.authorityRevision<1)throw fail('schedule_target_identity');
    date(value.serviceDate);const bound=principal(value);
    if(!sameEpoch(bound,expected)||bound.credentialId!==expected.credentialId)throw fail('schedule_target_principal');
    if(blocked){if(!uuid(value.invalidationId)||!['ROSTER_DEPENDENCY_CHANGED','SOURCE_RETIRED','RESTRICTION_DEPENDENCY_CHANGED'].includes(value.reasonCode))throw fail('schedule_target_terminal');}
    else if(!uuid(value.projectionId)||!hash(value.lunchDocumentIdentity)||!hash(value.viewDigest))throw fail('schedule_target_identity');
    return blocked;
  }
  // Targets are exact flat ASCII schemas with safe integer values. Match
  // PostgreSQL jsonb text (byte-length/key order and spaces) for THIS shape,
  // not an advertised general-purpose JSONB canonicalizer.
  function targetText(target){return '{'+Object.keys(target).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0))
    .map(k=>JSON.stringify(k)+': '+JSON.stringify(target[k])).join(', ')+'}';}
  async function digest(text){const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
  // Synchronous cache admission must verify the bytes before a revision can
  // influence high-water or a storage event can render. SHA-256 here is an
  // integrity check, NOT authentication against a writer that can rehash data.
  const SHA256_K=new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function sha256Text(text){
    if(typeof text!=='string'||text.length>4*1024*1024)throw fail('schedule_digest_input_invalid');
    const bytes=new TextEncoder().encode(text),padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);
    padded.set(bytes);padded[bytes.length]=0x80;const input=new DataView(padded.buffer);
    input.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000),false);input.setUint32(padded.length-4,bytes.length*8,false);
    const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
    const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let offset=0;offset<padded.length;offset+=64){
      for(let i=0;i<16;i++)w[i]=input.getUint32(offset+i*4,false);
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;}
      let [a,b,c,d,e,f,g,last]=h;
      for(let i=0;i<64;i++){
        const t1=(last+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+SHA256_K[i]+w[i])>>>0;
        const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
        last=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      const values=[a,b,c,d,e,f,g,last];for(let i=0;i<8;i++)h[i]=(h[i]+values[i])>>>0;
    }
    return [...h].map(value=>value.toString(16).padStart(8,'0')).join('');
  }
  function comparableTarget(target){const copy=clone(target);copy.credentialId=null;return targetText(copy);}
  function assertMonotonic(previous,next){
    if(previous==null)return;
    if(previous.schema!==CACHE_SCHEMA||!object(previous.target)||!object(previous.principal))throw fail('schedule_cached_state_invalid');
    const prior=principal(previous.principal);
    assertTarget(previous.target,prior);
    if(!sameEpoch(prior,next.principal)||previous.serviceDate!==next.serviceDate)throw fail('schedule_cached_scope_mismatch');
    const oldRevision=previous.target.authorityRevision,newRevision=next.target.authorityRevision;
    if(newRevision<oldRevision)throw fail('schedule_target_older_than_cache');
    if(newRevision===oldRevision&&comparableTarget(previous.target)!==comparableTarget(next.target))throw fail('schedule_target_same_revision_conflict');
    // Credential rotation may create a new exact intent for the same desired
    // state; it never inherits an ACK. Applied status is deliberately absent.
  }
  async function prepare({delivery,expectedPrincipal,serviceDate,previous=null}={}){
    const expected=principal(expectedPrincipal);date(serviceDate);
    if(!object(delivery)||!uuid(delivery.intentId)||!hash(delivery.targetDigest))throw fail('schedule_target_unavailable');
    // Snapshot before asynchronous hashing. A caller mutation while digest()
    // yields must never swap the bytes subsequently parsed or checked.
    delivery=clone(delivery);previous=previous===null?null:clone(previous);
    const blocked=assertTarget(delivery.target,expected),target=clone(delivery.target);
    if(target.serviceDate!==serviceDate)throw fail('schedule_target_date');
    const statuses=blocked?['PENDING','DEVICE_REPORTED_BLOCKED']:['PENDING','DEVICE_REPORTED_APPLIED'];
    if(!statuses.includes(delivery.applicationStatus))throw fail('schedule_target_unavailable');
    if(await digest(targetText(target))!==delivery.targetDigest)throw fail('schedule_target_digest');
    let view=null,viewJsonText=null;
    if(blocked){
      if(delivery.replacementCoverageReady!==false||delivery.view!=null||delivery.viewJsonText!=null)throw fail('schedule_terminal_contains_usable_view');
    }else{
      if(typeof delivery.viewJsonText!=='string'||delivery.viewJsonText.length>4*1024*1024
        ||delivery.viewDigest!==target.viewDigest||await digest(delivery.viewJsonText)!==target.viewDigest)throw fail('schedule_render_digest');
      try{view=JSON.parse(delivery.viewJsonText);}catch{throw fail('schedule_render_json');}
      exactKeys(view,['schema','service_date','employee_id','employee_name','publication_id','projection_id','projection_status','full_day','shift','raw_items']);
      if(view.schema!=='static-weekly.recurring-render-view.v1'||view.service_date!==serviceDate||view.employee_id!==expected.employeeId
        ||view.publication_id!==target.publicationId||view.projection_id!==target.projectionId||view.projection_status!=='current'
        ||view.full_day!==true||typeof view.employee_name!=='string'||!Array.isArray(view.raw_items)
        ||(view.shift!==null&&!object(view.shift)))throw fail('schedule_render_identity');
      viewJsonText=delivery.viewJsonText;
    }
    const result={schema:CACHE_SCHEMA,principal:expected,serviceDate,intentId:delivery.intentId,target,
      targetDigest:delivery.targetDigest,viewJsonText,view,blocked};
    assertMonotonic(previous,result);
    return result;
  }
  function deliveryMode(data){
    const mode=data?.schedule_delivery_mode;
    // Retained pre-typed snapshots legitimately have no mode. Explicit future
    // modes are never inferred from a prefix or treated as legacy authority.
    if(mode==null)return 'LEGACY_REGISTERED';
    if(!['LEGACY_REGISTERED','RECURRING_SCHEDULE','RECURRING_TERMINAL','UNAVAILABLE'].includes(mode))throw fail('schedule_target_mode_mismatch');
    return mode;
  }
  function revision(row){
    const value=row?.recurring_target?.target?.authorityRevision??row?.data?.schedule_application?.authority_revision??row?.data?.projection_authority_revision;
    if(value==null)return null;
    if(!Number.isSafeInteger(value)||value<1)throw fail('schedule_cached_revision_invalid');
    return value;
  }
  const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)
    ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  function assertSnapshot(row){
    if(!object(row)||row.schema_version!=='employee-schedule-snapshot.v2'||!object(row.data)||typeof row.principal!=='string'||!row.principal)throw fail('schedule_cached_state_invalid');
    const data=row.data,mode=deliveryMode(data),prepared=row.recurring_target;
    date(data.service_date);revision(row);
    if(mode==='UNAVAILABLE')throw fail('schedule_cached_state_invalid');
    if(mode==='LEGACY_REGISTERED'){
      if(data.stale!==undefined&&typeof data.stale!=='boolean')throw fail('schedule_cached_stale_invalid');
      if(Object.prototype.hasOwnProperty.call(row,'recurring_target')||data.recurring_delivery!=null)throw fail('schedule_target_mode_mismatch');
      if(data.full_day===true?!Array.isArray(data.raw_items):data.current_items!=null&&!Array.isArray(data.current_items))throw fail('schedule_cached_items_invalid');
      const receipt=data.schedule_application;
      if(receipt!=null&&(!object(receipt)||!['PENDING','DEVICE_REPORTED_APPLIED'].includes(receipt.application_status)))throw fail('schedule_cached_receipt_invalid');
      for(const k of ['publication_id','projection_id','lunch_document_identity'])
        if(receipt?.[k]!=null&&data[k]!=null&&receipt[k]!==data[k])throw fail('schedule_cached_scope_mismatch');
      return row;
    }
    if(!object(prepared)||prepared.schema!==CACHE_SCHEMA)throw fail('schedule_cached_state_invalid');
    const expected=principal(prepared.principal),blocked=assertTarget(prepared.target,expected),delivery=data.recurring_delivery;
    if(prepared.blocked!==blocked||blocked!==(mode==='RECURRING_TERMINAL')||prepared.serviceDate!==data.service_date
      ||prepared.target.serviceDate!==data.service_date||expected.employeeId!==data.employee_id
      ||expected.deviceId!==data.canonical_device_pk||expected.credentialId!==data.credential_id||expected.assignmentEpoch!==data.assignment_epoch
      ||!uuid(prepared.intentId)||!hash(prepared.targetDigest)||!object(delivery)||delivery.intentId!==prepared.intentId
      ||delivery.targetDigest!==prepared.targetDigest||!same(delivery.target,prepared.target)
      ||!(blocked?['PENDING','DEVICE_REPORTED_BLOCKED']:['PENDING','DEVICE_REPORTED_APPLIED']).includes(delivery.applicationStatus))throw fail('schedule_cached_scope_mismatch');
    if(sha256Text(targetText(prepared.target))!==prepared.targetDigest)throw fail('schedule_cached_target_digest');
    if(blocked){
      if(prepared.view!==null||prepared.viewJsonText!==null||delivery.replacementCoverageReady!==false||delivery.view!=null||delivery.viewJsonText!=null
        ||data.projection_status!=='blocked_recurring_authority'||data.full_day!==true||data.shift!==null||!Array.isArray(data.raw_items)||data.raw_items.length
        ||data.current_items!=null&&(!Array.isArray(data.current_items)||data.current_items.length))throw fail('schedule_terminal_contains_usable_view');
    }else{
      if(typeof prepared.viewJsonText!=='string'||prepared.viewJsonText.length>4*1024*1024||delivery.viewJsonText!==prepared.viewJsonText
        ||delivery.viewDigest!==prepared.target.viewDigest)throw fail('schedule_render_identity');
      if(sha256Text(prepared.viewJsonText)!==prepared.target.viewDigest)throw fail('schedule_cached_view_digest');
      let view;try{view=JSON.parse(prepared.viewJsonText);}catch{throw fail('schedule_render_json');}
      exactKeys(view,['schema','service_date','employee_id','employee_name','publication_id','projection_id','projection_status','full_day','shift','raw_items']);
      if(!same(view,prepared.view)||view.schema!=='static-weekly.recurring-render-view.v1'||view.service_date!==data.service_date||view.employee_id!==expected.employeeId
        ||view.publication_id!==prepared.target.publicationId||view.projection_id!==prepared.target.projectionId||view.projection_status!=='current'
        ||view.full_day!==true||typeof view.employee_name!=='string'||!Array.isArray(view.raw_items)||(view.shift!==null&&!object(view.shift))
        ||Object.keys(view).some(k=>!same(view[k],data[k])))throw fail('schedule_render_identity');
    }
    return row;
  }
  function legacyBinding(row){
    const data=row.data,t=data.schedule_application||{};
    return JSON.stringify(canonical({serviceDate:data.service_date,employeeId:data.employee_id??null,
      intentId:t.intent_id??null,publicationId:t.publication_id??data.publication_id??null,
      projectionId:t.projection_id??data.projection_id??null,lunchIdentity:t.lunch_document_identity??data.lunch_document_identity??null,
      employeeName:data.employee_name??null,fallbackEmployeeName:data.employee?.display_name??null,
      notice:data.notice??null,scheduleStatus:data.schedule_status??null,projectionStatus:data.projection_status??null,stale:data.stale===true,
      shift:data.shift??null,fullDay:data.full_day===true,items:data.full_day===true?data.raw_items??[]:data.current_items??[]}));
  }
  function assertSnapshotProgress(previous,next){
    assertSnapshot(next);if(previous)assertSnapshot(previous);
    const newer=revision(next);
    if(!previous)return;
    if(previous.data?.service_date!==next.data?.service_date||previous.principal!==next.principal)throw fail('schedule_cached_scope_mismatch');
    if(previous.recurring_target){
      if(!next.recurring_target)throw fail('schedule_target_unverified_transition');
      assertMonotonic(previous.recurring_target,next.recurring_target);
    }
    const older=revision(previous);
    if(older!==null&&(newer===null||newer<older))throw fail('schedule_target_older_than_cache');
    if(older!==null&&newer===older){
      if(Boolean(previous.recurring_target)!==Boolean(next.recurring_target))throw fail('schedule_target_same_revision_conflict');
      if(!next.recurring_target&&legacyBinding(previous)!==legacyBinding(next))throw fail('schedule_target_same_revision_conflict');
      if(!next.recurring_target){
        const before=previous.data.schedule_application,after=next.data.schedule_application;
        if(before?.application_status==='DEVICE_REPORTED_APPLIED'&&after?.application_status!=='DEVICE_REPORTED_APPLIED'
          ||before?.received_at!=null&&before.received_at!==after?.received_at)throw fail('schedule_receipt_regression');
      }
    }
  }
  function newestSnapshot(disk,live){
    for(const row of [disk,live])if(row!=null)assertSnapshot(row);
    if(!disk)return live;if(!live)return disk;
    // A typed terminal cannot be downgraded by an untyped row at any revision.
    if(disk.recurring_target&&!live.recurring_target){assertSnapshotProgress(live,disk);return disk;}
    if(live.recurring_target&&!disk.recurring_target){assertSnapshotProgress(disk,live);return live;}
    const a=revision(disk),b=revision(live);
    if(a===b&&!disk.recurring_target&&!live.recurring_target){
      const receiptRank=row=>row.data.schedule_application?.application_status==='DEVICE_REPORTED_APPLIED'?2+(row.data.schedule_application.received_at!=null?1:0):0;
      if(receiptRank(disk)>receiptRank(live)){assertSnapshotProgress(live,disk);return disk;}
    }
    const [older,newer]=a!==null&&(b===null||a>b)?[live,disk]:[disk,live];
    assertSnapshotProgress(older,newer);return newer;
  }
  function confirmedSnapshot(disk,live){
    const selected=newestSnapshot(disk,live);if(!selected)return null;
    const persisted=row=>{const value={...row};delete value.cache_unconfirmed;return value;};
    // The existence of SOME disk row is not evidence that the live winner was
    // saved. Ignore only our derived confirmation flag, never data/receipts.
    return {...selected,cache_unconfirmed:!disk||disk.cache_unconfirmed===true||!same(persisted(disk),persisted(selected))};
  }
  // Separate durable availability fence: preserve the last snapshot/high-water
  // as evidence, but never render it after current authenticated UNAVAILABLE.
  // The opaque stamp prevents an older in-flight response clearing a newer
  // page's fence. AVAILABLE is retained (not deleted), preventing ABA.
  // Keep it within the existing protected schedule namespace so native
  // storage fencing and approved cache cleanup already cover this record.
  const AVAILABILITY_PREFIX='mz_employee_schedule_snapshot:availability:';
  let availabilitySequence=0;
  // One origin-wide browser lock covers BOTH snapshot and fence writes. The
  // native mutation barrier still runs inside this lock; its per-instance FIFO
  // alone cannot serialize Home and Schedule documents. No unsafe fallback.
  async function withScheduleLock(scope,operation){
    availabilityKey(scope);
    let locks,request,entered=false;
    try{locks=root.navigator?.locks;request=locks?.request;}catch{throw fail('schedule_atomic_storage_unavailable');}
    if(typeof request!=='function')throw fail('schedule_atomic_storage_unavailable');
    try{return await request.call(locks,'memphis-schedule-authority:'+encodeURIComponent(scope),{mode:'exclusive'},()=>{entered=true;return operation();});}
    catch(error){if(!entered)throw fail('schedule_atomic_storage_unavailable');throw error;}
  }
  function availabilityKey(scope){if(typeof scope!=='string'||!scope)throw fail('schedule_target_principal');return AVAILABILITY_PREFIX+encodeURIComponent(scope);}
  function availability(storage,scope,serviceDate){
    date(serviceDate);const raw=storage.getItem(availabilityKey(scope));if(raw===null)return null;
    let value;try{value=JSON.parse(raw);}catch{throw fail('schedule_availability_invalid');}
    exactKeys(value,['schema','principal','serviceDate','state','stamp',...(value.state==='READING'?['priorState']:[])]);date(value.serviceDate);
    if(value.schema!=='employee-schedule-availability.v1'||value.principal!==scope
      ||!['AVAILABLE','UNAVAILABLE','READING'].includes(value.state)||typeof value.stamp!=='string'||!value.stamp
      ||value.state==='READING'&&!['AVAILABLE','UNAVAILABLE'].includes(value.priorState))throw fail('schedule_availability_invalid');
    return value.serviceDate===serviceDate?value:null;
  }
  function assertAvailability(storage,scope,serviceDate,expected){
    const actual=availability(storage,scope,serviceDate);
    if((actual?.stamp??null)!==(expected?.stamp??null))throw fail('schedule_request_invalidated');
    return actual;
  }
  function writeAvailability(storage,scope,serviceDate,state,expected){
    assertAvailability(storage,scope,serviceDate,expected);
    if(!['AVAILABLE','UNAVAILABLE','READING'].includes(state))throw fail('schedule_availability_invalid');
    const value={schema:'employee-schedule-availability.v1',principal:scope,serviceDate,state,
      stamp:root.crypto?.randomUUID?.()??`${Date.now()}:${++availabilitySequence}:${Math.random()}`,
      // A pre-existing unfinished read may have received UNAVAILABLE before
      // dying. A successor cannot turn that uncertainty into cached success.
      ...(state==='READING'?{priorState:expected?.state==='READING'?'UNAVAILABLE':expected?.state??'AVAILABLE'}:{})};
    const encoded=JSON.stringify(value);storage.setItem(availabilityKey(scope),encoded);
    if(storage.getItem(availabilityKey(scope))!==encoded)throw fail('schedule_availability_write_failed');
    return value;
  }
  const api=Object.freeze({prepare,sha256Text,assertMonotonic,deliveryMode,assertSnapshot,assertSnapshotProgress,newestSnapshot,confirmedSnapshot,
    withScheduleLock,availability,assertAvailability,writeAvailability,availabilityKey,AVAILABILITY_PREFIX,CACHE_SCHEMA});
  root.MemphisRecurringScheduleTarget=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
