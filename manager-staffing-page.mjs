import {createStaffingActions,staffingReaders} from './manager-staffing-actions.mjs';

// Main mounts normal auth, approved service API and saved-request adapters.
// This page never discovers an arbitrary endpoint or creates an auth/storage fallback.
const native = w => w.MemphisCustodialSecurity?.native===true || w.MemphisMobile?.edition==='custodial'
  || w.MemphisMobileBuildIdentity?.edition==='custodial' || w.Capacitor?.isNativePlatform?.()===true;
const unresolved = s => ['CONFIRM_PENDING','STATUS_PENDING','OUTCOME_UNKNOWN','ACCEPTED'].includes(s);
export function mountStaffingPage({w=window,d=document,auth=w.MemphisAuth,authority=w.MemphisSchedulerActions,
  api,savedRequests,readSourceDetails,readOriginalOutcome,makeKey,now=()=>Date.now()}={}) {
  const el=id=>d.getElementById(id), root=el('staffing-workspace'), list=el('staffing-roster'),
    status=el('staffing-status'), binding=el('staffing-binding'), date=el('staffing-date'), refresh=el('staffing-refresh'),
    action=el('staffing-action'), form=el('staffing-form'), slot=el('staffing-slot'), kind=el('staffing-kind'),
    name=el('staffing-new-name'), employee=el('staffing-existing-employee'), reason=el('staffing-reason'),
    previewBox=el('staffing-preview'), previewText=el('staffing-preview-text'), confirm=el('staffing-confirm'),
    outcome=el('staffing-check-outcome'), separation=el('staffing-separation'), separationText=el('staffing-separation-text'),
    separationButton=el('staffing-read-separation');
  if (![root,list,status,binding,date,refresh,action,form,slot,kind,name,employee,reason,previewBox,previewText,confirm,outcome,separation,separationText,separationButton].every(Boolean)) throw Error('Staffing page elements are missing.');
  let controller=null, stopped=false, currentView=null, timer=null, readingSeparation=false, initialized=false;
  const listeners=[];
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push([target,type,fn]);};
  const node=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const option=(value,label)=>{const n=node('option',label);n.value=value;return n;};
  function closePrivate() {
    list.replaceChildren(); binding.textContent=''; previewText.textContent=''; previewBox.hidden=true;
    action.hidden=true; form.hidden=true; separation.hidden=true; separationText.textContent='';outcome.hidden=true;
  }
  function error(cause) {
    const v=controller?.view(),notes={choice_invalid:'Choose the exact position/date and supply a bounded reason and required employee name.',
      action_unavailable:'This action is unavailable for the current source/person/date. Nothing was sent.',invalid_date:'Choose a valid service date.'};
    status.textContent=!v?.pending&&!v?.busy&&v?.state!=='DENIED'&&notes[cause?.code]||v?.message||'Staffing unavailable. No changes were sent.';
  }
  function fieldState() {
    const v=currentView,r=v?.rows.find(row=>row.slot_id===slot.value), locked=!v || v.read_only || v.busy || v.pending || unresolved(v.state) || v.state==='DENIED';
    const modes=[['vacate','Vacate this stable position'],['fill','Fill with a new employee'],['restore','Restore the eligible existing employee']];
    const previous=kind.value;
    kind.replaceChildren(option('','Choose an available action'));
    for(const [value,label] of modes)if(r?.capabilities[value])kind.appendChild(option(value,label));
    if(modes.some(([value])=>value===previous&&r?.capabilities[value]))kind.value=previous;
    kind.disabled=locked||!r||!modes.some(([value])=>r.capabilities[value]);
    const priorEmployee=employee.value;employee.replaceChildren(option('','Choose current-source existing employee'));
    for(const person of r?.restore_choices||[])employee.appendChild(option(person.employee_id,`${person.employee_name} · ${person.employee_id}`));
    if(r?.restore_choices.some(person=>person.employee_id===priorEmployee))employee.value=priorEmployee;
    el('staffing-new-name-field').hidden=kind.value!=='fill';el('staffing-existing-employee-field').hidden=kind.value!=='restore';
    for(const field of [slot,name,employee,reason])field.disabled=locked;
    el('staffing-preview-button').disabled=locked||!kind.value;
    separationButton.disabled=!v||v.read_only||v.busy||v.state==='DENIED'||readingSeparation||!r;
    el('staffing-action-note').textContent=r?.capabilities.reason||(!kind.value?'No eligible action for this source/person/date.':'Preview the factual intended action. The server revalidates it.');
  }
  function render(v) {
    if(stopped)return;currentView=v;status.textContent=v.message;
    const patternLink=el('staffing-pattern-link');
    if(patternLink&&v.service_date)patternLink.href='./schedule-weekly.html?hub=manager&date='+encodeURIComponent(v.service_date);
    date.disabled=v.busy||v.pending||unresolved(v.state);refresh.disabled=v.busy||v.pending&&v.state!=='ACCEPTED'||['CONFIRM_PENDING','STATUS_PENDING','OUTCOME_UNKNOWN'].includes(v.state)||v.state==='DENIED';
    if(v.state==='DENIED'){closePrivate();return;}
    binding.textContent=`Service date ${v.service_date||'unavailable'} · Source ${v.source_id||'unavailable'} · Registered source digest ${v.source_digest||'unavailable'} · Current hydrated digest ${v.current_source_digest||'unavailable'} · Revision ${v.revision??'unavailable'}`;
    list.replaceChildren();
    for(const r of v.rows){const card=node('article');card.className='staffing-card';card.appendChild(node('h3',r.slot_label));
      card.appendChild(node('p',`Stable position ${r.slot_id}`));
      card.appendChild(node('p',r.person_id?`${r.person_name} · Existing employee ${r.person_id}`:'No current employee identity.'));
      card.appendChild(node('p',`${r.valid?r.state:'Identity unavailable'} · effective ${r.effective_start||'unavailable'}`));list.appendChild(card);}
    action.hidden=v.read_only||!v.rows.length;form.hidden=v.read_only;
    const priorSlot=slot.value;slot.replaceChildren(option('','Choose a stable employee position'));
    for(const r of v.rows.filter(r=>!r.contractor))slot.appendChild(option(r.slot_id,`${r.slot_label} · ${r.person_name||'unfilled'}`));
    if(v.rows.some(r=>r.slot_id===priorSlot))slot.value=priorSlot;
    previewBox.hidden=!v.preview||v.read_only;
    if(v.preview){const p=v.preview,b=p.body;
      previewText.textContent=[({vacate:'Vacate position; no replacement employee is created.',fill:'Fill vacant position with a new employee; this is not restoration.',restore:'Restore the exact existing employee; do not erase prior history.'})[p.kind],
        `Position: ${p.slot_label} (${p.slot_id})`,`Current/eligible employee: ${p.employee_name||'Name unavailable; use original identity'}`,
        b.employee_id?`Existing employee identity: ${b.employee_id}`:`New employee name: ${b.new_employee_name}`,
        `Source: ${b.source_id}`,`Registered source digest: ${p.source_digest||'Original authenticated outcome must verify its digest'}`,
        `Current hydrated source digest: ${p.current_source_digest||'Unavailable for historical saved request'}`,
        `Effective date: ${b.effective_start}`,`Expected revision: ${b.expected_revision}`,`Reason: ${b.reason}`,
        'No phone release, reassignment, or protected-work completion is promised.',p.blocked_reason].filter(Boolean).join('\n');}
    else previewText.textContent='';
    confirm.disabled=v.read_only||v.busy||v.state!=='PREVIEW'||v.preview?.can_confirm!==true;
    outcome.hidden=!v.pending||v.read_only;outcome.disabled=!v.can_check_outcome;
    separation.hidden=!v.separation||v.read_only;
    if(v.separation){const s=v.separation;separationText.textContent=[`${s.state}: ${s.note}`,`Position: ${s.slot_id}`,
      s.employee_id?`Former employee: ${s.employee_id}`:null,s.separation_id?`Separation: ${s.separation_id} · command ${s.command_id} · revision ${s.revision}`:null,
      s.separated_at?`Recorded cutoff: ${s.separated_at}`:null,s.native_state?`Native inventory: ${s.native_state}; active database sessions ${s.active_sessions}; activated offline contexts ${s.offline_contexts}; retained devices ${s.retained_devices}.`:null].filter(Boolean).join('\n');}
    fieldState();
  }
  async function init() {
    if(stopped || initialized || native(w)){root.hidden=native(w);closePrivate();return false;}
    initialized=true;
    if(!auth || !authority || typeof api!=='function'){status.textContent='Normal staffing service integration is not mounted. No staffing request was sent.';closePrivate();return false;}
    try{
      await auth.requireOpsManagerSession({accessLevel:'read_only',interactive:false,redirect:false,throwOnFailure:true});
      if(stopped || native(w))return false;
      const fixed=staffingReaders({api,savedRequests,authority});
      controller=createStaffingActions({auth,authority,api,savedRequests,readSourceDetails:readSourceDetails||fixed.readSourceDetails,
        readOriginalOutcome:readOriginalOutcome||fixed.readOriginalOutcome,makeKey,now,onView:render});
      date.value=auth.getCSTDateString(new Date(now()));
      listen(refresh,'click',()=>void controller.load(date.value).catch(error));
      listen(date,'change',()=>void controller.load(date.value).catch(error));
      await controller.load(date.value);
      // Read-only managers get only roster navigation, no mutation/separation
      // listeners, saved-helper access, or input form. Server gates remain authoritative.
      if(!controller.view().read_only){
        listen(slot,'change',()=>{controller.invalidate();fieldState();});
        listen(kind,'change',()=>{controller.invalidate();fieldState();});
        for(const input of [name,employee,reason])listen(input,'input',()=>{controller.invalidate();fieldState();});
        listen(form,'submit',event=>{event.preventDefault();try{controller.prepare(kind.value,{slot_id:slot.value,effective_start:date.value,reason:reason.value,new_employee_name:name.value,employee_id:employee.value});}catch(cause){error(cause);}});
        listen(confirm,'click',()=>void controller.confirm().catch(error));
        listen(outcome,'click',()=>void controller.checkOutcome().catch(error));
        listen(separationButton,'click',async()=>{if(readingSeparation)return;readingSeparation=true;fieldState();try{await controller.readSeparation(slot.value);}catch{status.textContent='Separation readback unavailable or mismatched. Protected work remains Pending.';}finally{readingSeparation=false;fieldState();}});
      }
      timer=w.setInterval(()=>controller.checkCurrent(),1000);
      listen(w,'pagehide',stop);listen(w,'memphis:custodial-security-state',()=>controller.checkCurrent());
      listen(d,'visibilitychange',()=>{if(d.hidden)controller.withdraw();});return true;
    }catch{closePrivate();status.textContent='The current staffing view is unavailable. Saved requests remain preserved; return to Schedule for recovery, or use normal sign-in if access is requested. No change was sent.';return false;}
  }
  function stop(){if(stopped)return;stopped=true;controller?.withdraw();if(timer!==null)w.clearInterval(timer);
    for(const [target,type,fn] of listeners)target.removeEventListener(type,fn);listeners.length=0;closePrivate();}
  if(native(w)){root.hidden=true;closePrivate();}
  return Object.freeze({init,stop,view:()=>controller?.view()??null});
}
