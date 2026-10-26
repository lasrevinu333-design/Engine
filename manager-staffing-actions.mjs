// Manager staffing presentation/domain only. Normal signed authority, the
// original saved-request helper, and authenticated readers are main-owned.
// No storage, direct writer fetch, legacy departure/replacement, or phone action.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const copy = v => JSON.parse(JSON.stringify(v));
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v;
const text = (v, min=1, max=160) => typeof v === 'string' && v.trim().length >= min && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const problem = (code, message) => Object.assign(new Error(message), {code});
const uncertain = s => ['CONFIRM_PENDING','OUTCOME_UNKNOWN','STATUS_PENDING'].includes(s);
export const staffingWeek = value => {
  if (!date(value)) throw problem('invalid_date','Choose a valid service date.');
  const d = new Date(`${value}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7); return d.toISOString().slice(0,10);
};
const paths = (kind, slot) => ({vacate:`/static-weekly/roster/${slot}/vacate`,fill:`/static-weekly/roster/vacant-slots/${slot}/fill`,restore:'/static-weekly/employees/restores'})[kind];
const operations = {vacate:'vacate_roster_slot',fill:'fill_vacant_slot',restore:'restore_existing_employee'};
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));

// Fixed normal-service readers only. Retry belongs to the existing owning
// helper: its staffing branch is a GET and privately promotes the saved record.
export function staffingReaders({api,savedRequests,authority}={}) {
  return {
    readSourceDetails:typeof api==='function'?((input,options)=>api('/static-weekly/staffing/source-details?'+new URLSearchParams(input),{...options,method:'GET'})):null,
    readOriginalOutcome:typeof savedRequests?.retry==='function'&&typeof authority?.staffingOperation==='function'?(async(record)=>{
      const current=savedRequests.pending();
      if(!object(current)||current.managerId!==record.managerId||current.path!==record.path||current.encoded!==record.encoded
        ||JSON.stringify(current.body)!==record.encoded||!authority.staffingOperation(current.path))throw problem('original_request_changed','Original saved staffing request changed. Nothing was resent.');
      return savedRequests.retry();
    }):null
  };
}

export function createStaffingActions({auth, authority, api, savedRequests=null, readSourceDetails=null,
  readOriginalOutcome=null, makeKey=()=>globalThis.crypto.randomUUID(), now=()=>Date.now(), onView=()=>{}}={}) {
  if (!auth || !authority || typeof api !== 'function') throw problem('staffing_dependencies_missing','Normal staffing service integration is unavailable.');
  let owner=null, snapshot=null, source=null, serviceDate=null, preview=null, original=null, separation=null,
    state='IDLE', message='', generation=0, busy=false, separationSequence=0;
  const requests = new Set();
  function current() {
    const session=auth.readSession?.(), p=authority.principal?.(auth), permissions=authority.permissions?.(auth);
    if (!p || permissions?.read !== true || session?.role !== 'ops_manager' || !UUID.test(session.manager_id||'')
      || !text(session.credential_id,1,200) || !text(session.device_id,1,96) || !text(session.token,1,8192)
      || !(Date.parse(session.expires_at)>now())) throw problem('AUTH_WITHDRAWN','Current named-manager access is required. Saved requests are preserved.');
    return {managerId:session.manager_id,credentialId:session.credential_id,deviceId:session.device_id,
      token:session.token,expiresAt:session.expires_at,canWrite:permissions.owner === true && session.read_only === false};
  }
  const same = (a,b) => a && b && Object.keys(a).every(key=>a[key]===b[key]);
  function guard(write=false) {
    let actor;try{actor=current();}catch(error){withdraw();throw error;}
    if (!same(owner,actor) || write && !actor.canWrite) { withdraw(); throw problem('AUTH_WITHDRAWN','Manager access changed. Saved requests are preserved.'); }
    return actor;
  }
  function set(next, note='') { state=next; message=note; onView(view()); }
  function withdraw() {
    generation++; for (const abort of requests) abort.abort(); requests.clear(); busy=false; preview=null;
    snapshot=source=separation=null; set('DENIED','Manager access changed. Original saved staffing work remains preserved.');
  }
  async function read(path, write=false) {
    guard(write); const mine=generation, abort=new AbortController(); requests.add(abort);
    try { const result=await api(path,{method:'GET',signal:abort.signal,expectedManagerId:owner.managerId});
      guard(write); if (mine!==generation || abort.signal.aborted) throw problem('stale_read','The staffing read was withdrawn.'); return result;
    } catch (error) { if ([401,403].includes(error?.status) || error?.code==='AUTH_WITHDRAWN') withdraw(); throw error; }
    finally { requests.delete(abort); }
  }
  function normalize(value, selected) {
    const week=staffingWeek(selected), end=new Date(`${week}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+6);
    if (!object(value) || value.schema!=='memphis-zoo.static-weekly-manager-snapshot.v1'
      || value.week_start!==week || value.week_end!==end.toISOString().slice(0,10) || !integer(value.authority_revision)
      || !Array.isArray(value.roster) || value.roster.length>200 || !Array.isArray(value.sources)) throw problem('snapshot_invalid','The current roster snapshot could not be verified.');
    const ids=new Set();
    for (const slot of value.roster) {
      if (!object(slot) || !UUID.test(slot.slot_id||'') || ids.has(slot.slot_id) || !text(slot.slot_label)
        || typeof slot.contractor_capacity!=='boolean' || !Array.isArray(slot.incumbencies) || !Array.isArray(slot.week_staffing)) throw problem('snapshot_invalid','Stable roster identity is unavailable.');
      ids.add(slot.slot_id);
      for (const i of slot.incumbencies) if (!object(i) || !UUID.test(i.person_id||'') || !text(i.person_name)
        || !date(i.effective_start) || !(i.effective_end===null || date(i.effective_end)&&i.effective_end>i.effective_start)) throw problem('snapshot_invalid','Roster history identity is unavailable.');
    }
    return copy(value);
  }
  function row(slot, selected=serviceDate) {
    const incumbents=slot.incumbencies.filter(i=>i.effective_start<=selected && (i.effective_end===null || selected<i.effective_end));
    const dated=slot.week_staffing.filter(i=>i.service_date===selected);
    const fact=dated.length===1?dated[0]:null, person=incumbents.length===1?incumbents[0]:null;
    const valid=incumbents.length<=1 && dated.length<=1 && (!fact || (fact.person_id??null)===(person?.person_id??null));
    return {slot_id:slot.slot_id,slot_label:slot.slot_label,contractor:slot.contractor_capacity,
      person_id:valid?person?.person_id??null:null,person_name:valid?person?.person_name??null:null,
      state:valid && typeof fact?.availability_state==='string'?fact.availability_state:'UNKNOWN',
      employee_active:valid?fact?.employee_active:null,valid,
      effective_start:person?.effective_start??null,future_incumbency:slot.incumbencies.some(i=>i.effective_start>selected)};
  }
  function sourceId() { const id=snapshot?.current_publication?.authority_source_id; return UUID.test(id||'')?id:null; }
  function sourceMetadata() { const id=sourceId(), matches=snapshot?.sources?.filter(s=>s.source_id===id)||[]; return matches.length===1&&SHA.test(matches[0].source_digest||'')?matches[0]:null; }
  async function sourceFor(selected) {
    const metadata=sourceMetadata();
    if (!metadata || typeof readSourceDetails!=='function') return null;
    guard(true); const mine=generation, abort=new AbortController(); requests.add(abort);
    try {
      const result=await readSourceDetails({source_id:metadata.source_id,effective_start:selected,expected_revision:snapshot.authority_revision}, {signal:abort.signal,expectedManagerId:owner.managerId});
      guard(true); if (mine!==generation || abort.signal.aborted) throw problem('stale_source','Source details changed.');
      if (!exactKeys(result,['schema','manager_id','source_id','effective_start','week_start','authority_revision','current_source_digest','registered_source_digest','compiler_input','registered_compiler_input','current_roster','publication_id','phone_released'])
        ||result.schema!=='custodial.roster-source-details.v1'||result.manager_id!==owner.managerId||result.source_id!==metadata.source_id
        ||result.effective_start!==selected||result.week_start!==staffingWeek(selected)||result.authority_revision!==snapshot.authority_revision
        ||result.registered_source_digest!==metadata.source_digest||!SHA.test(result.current_source_digest||'')||result.phone_released!==false
        ||result.publication_id!==snapshot.current_publication.publication_id||JSON.stringify(result.current_roster)!==JSON.stringify(snapshot.roster)
        ||![result.compiler_input,result.registered_compiler_input].every(input=>object(input)&&Array.isArray(input.slots)&&object(input.version))) throw problem('source_binding_missing','Exact registered/current staffing source details are unavailable.');
      return copy(result);
    } catch(error) { if ([401,403].includes(error?.status) || error?.code==='AUTH_WITHDRAWN') withdraw(); throw error; }
    finally { requests.delete(abort); }
  }
  function restoreChoices(slotId) {
    // Registered history is not a current active employee / readiness mapping.
    // V1 does not supply that authoritative selector; never resurrect a person
    // from an immutable or hydrated source alone.
    void slotId;return [];
  }
  function savedPreview(record) {
    if (!object(record) || record.managerId!==owner.managerId || typeof record.encoded!=='string'
      || record.encoded!==JSON.stringify(record.body) || !object(record.body)) throw problem('saved_request_invalid','Original saved request identity is unavailable. Nothing was resent.');
    const b=record.body, vacancy=/^\/static-weekly\/roster\/([a-f0-9-]+)\/vacate$/.exec(record.path||''), fill=/^\/static-weekly\/roster\/vacant-slots\/([a-f0-9-]+)\/fill$/.exec(record.path||'');
    const kind=vacancy?'vacate':fill?'fill':record.path==='/static-weekly/employees/restores'?'restore':null;
    const slot=vacancy?.[1]||fill?.[1]||b.slot_id, fields=['source_id','effective_start','reason','expected_revision','idempotency_key',...(kind==='fill'?['new_employee_name']:['employee_id']),...(kind==='restore'?['slot_id']:[])];
    if (!kind || !UUID.test(slot||'') || !UUID.test(b.source_id||'') || !date(b.effective_start) || !text(b.reason,1,500)
      || !integer(b.expected_revision) || !text(b.idempotency_key,1,200) || Object.keys(b).length!==fields.length || fields.some(k=>!Object.hasOwn(b,k))
      || (kind==='fill'?!text(b.new_employee_name,2,160):!UUID.test(b.employee_id||''))) throw problem('saved_request_invalid','This saved request cannot be rebound to a staffing action. Preserve it for its owning page.');
    return {kind,path:record.path,body:copy(b),slot_id:slot,slot_label:'Original saved stable position',employee_name:null,source_digest:null,publication_id:null,can_confirm:false,blocked_reason:'Original request only; confirmation cannot be resent.'};
  }
  function capabilities(slotId) {
    const r=snapshot?.roster.find(s=>s.slot_id===slotId), fact=r?row(r):null;
    if (!owner?.canWrite) return {vacate:false,fill:false,restore:false,reason:'Read-only manager view. Staffing changes and protected separation reads are owner-only.'};
    if (!fact?.valid || fact.contractor) return {vacate:false,fill:false,restore:false,reason:'An exact stable employee position is required.'};
    if (!source) return {vacate:false,fill:false,restore:false,reason:'Exact registered source details are unavailable. Changes are disabled.'};
    const slots=source.registered_compiler_input.slots.filter(s=>s.id===slotId), v=source.registered_compiler_input.version;
    if (slots.length!==1 || slots[0].contractorCapacity===true) return {vacate:false,fill:false,restore:false,reason:'This position is not bound to the current registered employee source.'};
    const vacant=!fact.person_id && !fact.future_incumbency && fact.state==='vacant_unfilled';
    const capable=Array.isArray(v.vacancyCapableSlotIds) && v.vacancyCapableSlotIds.includes(slotId);
    const today=auth.getCSTDateString?.(new Date(now()));
    return {vacate:capable && serviceDate===today && fact.person_id!==null && fact.employee_active===true && fact.effective_start<serviceDate && !fact.future_incumbency,
      fill:capable && vacant && staffingWeek(serviceDate)===serviceDate && serviceDate>=staffingWeek(today),
      restore:vacant && serviceDate>=today && restoreChoices(slotId).length===1,
      reason:'Existing-person reactivation is not position-pattern restoration. Review the current approved pattern through Schedule; registered history is not eligibility.'};
  }
  function view() {
    return Object.freeze({state,message,busy,service_date:serviceDate,manager_name:owner?auth.readSession?.()?.manager_display_name||'Named manager':null,
      read_only:!owner?.canWrite,source_id:sourceId(),source_digest:sourceMetadata()?.source_digest??null,
      current_source_digest:source?.current_source_digest??null,
      revision:snapshot?.authority_revision??null,rows:snapshot?snapshot.roster.map(s=>({...row(s),capabilities:capabilities(s.slot_id),restore_choices:restoreChoices(s.slot_id)})):[],
      preview:preview?copy(preview):null,separation:separation?copy(separation):null,
      pending:!!original,can_check_outcome:!!original && !busy && typeof readOriginalOutcome==='function' && state==='OUTCOME_UNKNOWN'});
  }
  async function load(selected) {
    if (busy || uncertain(state) || original && state!=='ACCEPTED') throw problem('original_request_pending','Resolve the original saved staffing outcome before changing the roster view.');
    if (original && selected!==original.body.effective_start) throw problem('original_request_pending','Read back the original accepted service date before changing the roster view.');
    let actor;try{actor=owner?guard():current();}catch(error){if(state!=='DENIED')withdraw();throw error;}
    owner=actor; busy=true; serviceDate=selected; if(!original)preview=null; source=separation=null; const mine=++generation;
    set('LOADING','Reading the current roster…');
    try {
      const received=await read(`/static-weekly/manager-snapshot?week_start=${staffingWeek(selected)}`);
      if (mine!==generation) return;
      const fresh=normalize(received,selected);
      if(original){
        if(typeof savedRequests?.acknowledge!=='function' || savedRequests.acknowledge(fresh)!==true || savedRequests.pending()!==null){
          set('ACCEPTED','Original acceptance remains saved until the owning helper verifies current readback. No new action is enabled.');return;
        }
        original=null;preview=null;
      }
      snapshot=fresh;
      if (owner.canWrite) {
        if (typeof savedRequests?.pending==='function') {
          const record=savedRequests.pending();
          if (record) { original=copy(record); preview=savedPreview(record);
            set(record.state==='REJECTED'?'HELD':'OUTCOME_UNKNOWN',record.state==='REJECTED'?'The original request was explicitly rejected. Saved request preserved for owning-helper resolution; no new action is enabled.':'An original saved request is unresolved. Do not resend or replace it.'); return; }
        }
        try { source=await sourceFor(selected); } catch (error) { if (error.code==='AUTH_WITHDRAWN' || state==='DENIED') throw error; source=null; }
      }
      if (mine!==generation) return;
      set(owner.canWrite?'READY':'READ_ONLY',owner.canWrite?'Review a stable position. Nothing changes until an explicit confirmation.':'Read-only roster. Staffing changes are not authorized for this session.');
    } catch (error) { if (mine===generation && state!=='DENIED') { snapshot=source=null; set('UNAVAILABLE','Current roster/source read unavailable. No staffing action was sent.'); } throw error; }
    finally { if (mine===generation) {busy=false; onView(view());} }
  }
  function prepare(kind, input) {
    guard(true);
    if (busy || original || uncertain(state)) throw problem('original_request_pending','Resolve the original staffing outcome first.');
    if (!object(input) || !Object.hasOwn(operations,kind) || !UUID.test(input.slot_id||'') || input.effective_start!==serviceDate
      || !text(input.reason,1,500)) throw problem('choice_invalid','Choose a bound position, service date, and reason.');
    const cap=capabilities(input.slot_id); if (!cap[kind]) throw problem('action_unavailable',cap.reason||'The source/person/date does not authorize this action.');
    const target=row(snapshot.roster.find(s=>s.slot_id===input.slot_id));
    const body={source_id:sourceId(),effective_start:serviceDate,reason:input.reason.trim(),expected_revision:snapshot.authority_revision};
    if (kind==='vacate') body.employee_id=target.person_id;
    if (kind==='fill') { const name=typeof input.new_employee_name==='string'&&!/[\x00-\x1f\x7f]/.test(input.new_employee_name)?input.new_employee_name.trim().replace(/\s+/g,' '):null;
      if (!text(name,2,160)) throw problem('choice_invalid','Enter the new employee’s name.'); body.new_employee_name=name; }
    if (kind==='restore') { const choices=restoreChoices(input.slot_id);
      if (choices.length!==1 || input.employee_id!==choices[0].employee_id) throw problem('choice_invalid','Choose the exact current-source eligible existing employee.');
      body.slot_id=input.slot_id; body.employee_id=input.employee_id;
    }
    const key=makeKey(); if (!text(key,1,160)) throw problem('key_unavailable','Original request identity is unavailable.'); body.idempotency_key=`staffing-${kind}-${key}`;
    const path=paths(kind,input.slot_id), supported=authority.authorized?.(auth,path,body)===true;
    const ready=supported && typeof authority.acceptedStaffing==='function' && typeof savedRequests?.run==='function' && typeof savedRequests?.pending==='function' && typeof readOriginalOutcome==='function';
    preview={kind,path,body,slot_id:target.slot_id,slot_label:target.slot_label,employee_name:kind==='restore'?restoreChoices(input.slot_id)[0].employee_name:target.person_name,
      source_digest:sourceMetadata().source_digest,current_source_digest:source.current_source_digest,publication_id:snapshot.current_publication.publication_id,
      can_confirm:ready,blocked_reason:ready?'':'Owning saved-request path/receipt and exact original-outcome readback are not mounted. Confirmation is disabled.'};
    set('PREVIEW','Review the factual intended action. This is a local preview, not a server acceptance.'); return copy(preview);
  }
  function matchesRecord(record) {
    return object(record) && record.managerId===owner.managerId && record.path===original?.path && record.encoded===original?.encoded
      && typeof record.encoded==='string' && record.encoded===JSON.stringify(record.body);
  }
  function accepted(receipt, chosen) {
    const m=receipt?.data?.mutation || receipt?.data, b=chosen.body;
    if (!object(receipt) || !integer(receipt.revision) || receipt.revision<=b.expected_revision
      || !SHA.test(receipt.request_digest||'') || !SHA.test(receipt.content_digest||'') || !SHA.test(receipt.output_digest||'')
      || !object(m) || m.slot_id!==chosen.slot_id || m.source_id!==b.source_id || !SHA.test(m.source_digest||'')
      || chosen.source_digest!==null && m.source_digest!==chosen.source_digest || m.effective_start!==b.effective_start) return false;
    if (chosen.kind==='vacate' && (m.former_employee_id!==b.employee_id || m.replacement_employee_id!==null || m.history_preserved!==true)) return false;
    if (chosen.kind==='fill' && (m.new_employee_name!==b.new_employee_name || !UUID.test(m.new_employee_id||'') || m.phone_assignment!==null)) return false;
    if (chosen.kind==='restore' && (m.employee_id!==b.employee_id || m.history_preserved!==true || m.phone_assignment!==null)) return false;
    if (m.completion_mode==='mutation_only') return chosen.publication_id===null && m.original_publication_id===null && receipt.operation===operations[chosen.kind];
    const p=receipt.data.current_projection;
    return m.completion_mode==='projection_required' && UUID.test(m.original_publication_id||'')
      && (chosen.publication_id===null || m.original_publication_id===chosen.publication_id)
      && receipt.operation==='materialize_projection' && UUID.test(p?.projection_id||'')
      && p.publication_id===m.original_publication_id && p.week_start===staffingWeek(b.effective_start);
  }
  function acceptedOutcome(result,chosen) {
    if(!exactKeys(result,['schema','state','manager_id','operation','idempotency_key','command_id','original_request','original_request_digest','receipt','retry_safe','phone_released'])
      ||result.schema!=='custodial.original-staffing-outcome.v1'||result.state!=='ACCEPTED_ORIGINAL'
      ||result.manager_id!==owner.managerId||result.operation!==operations[chosen.kind]||result.idempotency_key!==chosen.body.idempotency_key
      ||!UUID.test(result.command_id||'')||!SHA.test(result.original_request_digest||'')||result.retry_safe!==false||result.phone_released!==false)return false;
    const expected={operation:operations[chosen.kind],source_id:chosen.body.source_id,slot_id:chosen.slot_id,effective_start:chosen.body.effective_start,
      reason:chosen.body.reason,expected_revision:chosen.body.expected_revision,actor_manager_id:owner.managerId};
    if(chosen.kind==='fill')expected.new_employee_name=chosen.body.new_employee_name;else expected.employee_id=chosen.body.employee_id;
    return exactKeys(result.original_request,Object.keys(expected))&&Object.entries(expected).every(([k,v])=>result.original_request[k]===v)
      &&authority.acceptedStaffing?.(result,original)===true&&accepted(result.receipt,chosen);
  }
  async function confirm() {
    guard(true); if (busy || original || state!=='PREVIEW' || !preview?.can_confirm) throw problem('confirm_not_allowed','This preview cannot be confirmed.');
    const chosen=copy(preview), mine=++generation; busy=true; set('CONFIRM_PENDING','Checking current source/revision before one confirmation…');
    let sent=false;
    try {
      const fresh=normalize(await read(`/static-weekly/manager-snapshot?week_start=${staffingWeek(serviceDate)}`),serviceDate);
      guard(true);
      if (fresh.authority_revision!==chosen.body.expected_revision || fresh.current_publication?.publication_id!==chosen.publication_id
        || JSON.stringify(fresh.roster)!==JSON.stringify(snapshot.roster) || fresh.sources.find(s=>s.source_id===chosen.body.source_id)?.source_digest!==chosen.source_digest) throw problem('stale_preview','Source, roster or revision changed. Load a current preview before confirming.');
      const freshSource=await sourceFor(serviceDate);
      if (!freshSource || JSON.stringify(freshSource)!==JSON.stringify(source)) throw problem('stale_preview','Current source details changed.');
      guard(true); if (mine!==generation) return;
      if (savedRequests.pending()) throw problem('original_request_pending','Another original saved request must be resolved first.');
      original={managerId:owner.managerId,path:chosen.path,body:copy(chosen.body),encoded:JSON.stringify(chosen.body)};
      sent=true; const result=await savedRequests.run(chosen.path,copy(chosen.body));
      guard(true); if (mine!==generation) return;
      const saved=savedRequests.pending();
      if (!matchesRecord(saved) || saved.state!=='ACCEPTED' || JSON.stringify(saved.receipt)!==JSON.stringify(result) || !acceptedOutcome(result,chosen)) throw problem('outcome_unconfirmed','Original staffing acceptance could not be verified.');
      const fence=result.receipt.data?.mutation?.employee_status||result.receipt.data?.employee_status;
      if(chosen.kind==='vacate'){
        preview.accepted_command_id=result.command_id;
        if(UUID.test(fence?.separation_id||''))preview.accepted_separation_id=fence.separation_id;
      }
      set('ACCEPTED',chosen.kind==='vacate'?'Roster vacancy accepted. Protected separation is still Pending until its exact readback proves completion.':'Roster change accepted. No phone assignment or protected-work clearance is inferred.');
    } catch (error) {
      if ([401,403].includes(error?.status) || error?.code==='AUTH_WITHDRAWN') withdraw();
      if (mine===generation && state!=='DENIED') {
        if (sent) {
          let rejected=false;try{const saved=savedRequests.pending();rejected=matchesRecord(saved)&&saved.state==='REJECTED';}catch{}
          set(rejected?'HELD':'OUTCOME_UNKNOWN',rejected?'The original staffing request was explicitly rejected. It remains saved for owning-helper resolution; no acceptance or new action is implied.':'Original staffing outcome is unknown. Do not resend, replace the request, or change its person/source/date.');
        }
        else {preview=null;set('HELD','The preview was held before submission. Refresh current source/revision. No staffing change was sent.');}
      }
      throw error;
    } finally { if (mine===generation) {busy=false;onView(view());} }
  }
  async function checkOutcome() {
    guard(true); if (busy || !original || state!=='OUTCOME_UNKNOWN' || typeof readOriginalOutcome!=='function') throw problem('outcome_reader_missing','Exact original-outcome readback is unavailable. Preserve the request; do not resend.');
    const mine=++generation,abort=new AbortController();requests.add(abort); busy=true; set('STATUS_PENDING','Reading only the original saved staffing outcome…');
    try {
      const result=await readOriginalOutcome(copy(original),{signal:abort.signal,expectedManagerId:owner.managerId}); guard(true); if (mine!==generation || abort.signal.aborted) return;
      const saved=savedRequests?.pending?.();
      if(!matchesRecord(saved)||saved.state!=='ACCEPTED'||JSON.stringify(saved.receipt)!==JSON.stringify(result)||!preview||!acceptedOutcome(result,preview)){
        set('OUTCOME_UNKNOWN','No matching complete canonical original receipt is available. Still Pending; do not resend.');return;
      }
      const fence=result.receipt.data?.mutation?.employee_status||result.receipt.data?.employee_status;
      const mutation=result.receipt.data?.mutation||result.receipt.data;
      preview.source_digest=mutation.source_digest;preview.publication_id=mutation.original_publication_id;
      if(preview.kind==='vacate'){
        preview.accepted_command_id=result.command_id;
        if(UUID.test(fence?.separation_id||''))preview.accepted_separation_id=fence.separation_id;
      }
      set('ACCEPTED',preview.kind==='vacate'?'Original vacancy accepted; protected separation remains Pending.':'Original roster change accepted; no phone or historical identity was replaced.');
    } catch (error) { if ([401,403].includes(error?.status) || error?.code==='AUTH_WITHDRAWN') withdraw(); if (mine===generation && state!=='DENIED') set('OUTCOME_UNKNOWN','Original outcome readback unavailable. The original request remains preserved.'); throw error; }
    finally {requests.delete(abort); if (mine===generation) {busy=false;onView(view());} }
  }
  async function readSeparation(slotId) {
    guard(true); if (!UUID.test(slotId||'') || !snapshot?.roster.some(s=>s.slot_id===slotId)) throw problem('slot_missing','Choose an existing stable position.');
    const seq=++separationSequence,mine=generation;
    separation={slot_id:slotId,state:'Pending',note:'Reading the exact authenticated separation record. Previous readback is not current proof.'};onView(view());
    const result=await read(`/static-weekly/roster/${slotId}/separation`,true); guard(true);
    if(seq!==separationSequence || mine!==generation)throw problem('stale_separation','This separation read was superseded.');
    const originalEmployee=preview?.kind==='vacate'&&preview.slot_id===slotId?preview.body.employee_id:null;
    if (!object(result) || result.slot_id!==slotId || result.state!=='NONE' && originalEmployee && (result.employee_id!==originalEmployee
      ||preview.accepted_separation_id&&result.separation_id!==preview.accepted_separation_id
      ||preview.accepted_command_id&&result.command_id!==preview.accepted_command_id)) throw problem('separation_mismatch','The separation readback does not match this original employee/position.');
    if (result.state==='NONE') separation={slot_id:slotId,state:'Pending',note:'No matching separation record. Completion has not been established.'};
    else {
      if (!UUID.test(result.employee_id||'') || !UUID.test(result.separation_id||'') || !UUID.test(result.command_id||'')
        || !integer(result.authority_revision) || typeof result.separated_at!=='string' || !Number.isFinite(Date.parse(result.separated_at))
        || !['PENDING_RECONCILIATION','RETAINED_UNRESOLVED','FINALIZED'].includes(result.state)
        || !['UNKNOWN','VERIFIED_EMPTY','PROTECTED_PENDING','RECONCILED'].includes(result.native_inventory_state)
        || !integer(result.database_active_sessions) || !integer(result.database_activated_offline_contexts)
        || !Array.isArray(result.assigned_devices_retained) || result.phone_released!==false) throw problem('separation_invalid','Exact authenticated separation readback is unavailable.');
      const complete=result.state==='FINALIZED' && ['VERIFIED_EMPTY','RECONCILED'].includes(result.native_inventory_state)
        && result.database_active_sessions===0 && result.database_activated_offline_contexts===0;
      separation={slot_id:slotId,employee_id:result.employee_id,separation_id:result.separation_id,command_id:result.command_id,
        revision:result.authority_revision,separated_at:result.separated_at,state:complete?'Complete':'Pending',native_state:result.native_inventory_state,
        active_sessions:result.database_active_sessions,offline_contexts:result.database_activated_offline_contexts,retained_devices:result.assigned_devices_retained.length,
        note:complete?'This exact authenticated separation record says finalized. No phone release or reassignment is inferred.':'Protected work remains Pending. Empty database counts or a roster/projection receipt do not prove native reconciliation.'};
    }
    onView(view()); return copy(separation);
  }
  return Object.freeze({load,prepare,confirm,checkOutcome,readSeparation,view,withdraw,
    invalidate(){try{guard(true);}catch{return;}generation++;for(const abort of requests)abort.abort();requests.clear();busy=false;if(original)set(state==='HELD'?'HELD':'OUTCOME_UNKNOWN',state==='HELD'?'Explicitly rejected original remains saved for owning-helper resolution.':'Original saved staffing identity preserved. Do not resend.');else{preview=null;set('HELD','Current source/revision must be reread.');}},
    checkCurrent(){try{guard();return true;}catch{return false;}}});
}
