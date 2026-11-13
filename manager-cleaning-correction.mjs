import {zooLocalInstant,zooLocalInput} from './zoo-local-time.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const instant=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const fields=[['employee_id','Employee','employees','employee_name'],['location_id','Location','locations','location_name'],['device_id','Phone','devices','device_name'],['started_at','Started',null],['ended_at','Finished',null]];
const displayTime=value=>instant(value)?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'long'}):'Unavailable';
const viewKey=truth=>JSON.stringify([truth.session_id,truth.session_uuid,truth.status,truth.correction_id,...fields.map(([key])=>truth['current_'+key])]);
export function createCleaningCorrectionPanel({document,panel,status,content,api,binding,canWrite,uuid=()=>crypto.randomUUID()}) {
  let state='EMPTY',generation=0,owner=null,selected=null,truth=null,choices=null,pinned=null,inputs={},pending=false,retryAllowed=false;
  const unresolved=()=>pending||['SENDING','UNKNOWN','CHECKING'].includes(state);
  const current=()=>owner!==null&&owner===binding()&&canWrite();
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const setState=(next,text)=>{state=next;status.textContent=text;status.dataset.state=next.toLowerCase();};
  const deny=()=>{content.replaceChildren();setState('DENIED','Manager access changed. The original correction outcome is not confirmed. Return with the original manager access to reconcile it.');};
  const check=()=>{if(!current()){deny();throw new Error('Manager access changed.');}};
  function clear(){if(unresolved()){if(!current()){deny();return false;}status.textContent='Keep this original correction open and check its saved outcome before starting another.';return false;}generation++;state='EMPTY';owner=null;pinned=null;content.replaceChildren();panel.hidden=true;return true;}
  function validateTruth(value,row){
    if(!value||value.session_id!==row.session_id||value.session_uuid!==row.session_uuid||value.status!=='completed'||!instant(value.current_started_at)||!instant(value.current_ended_at)||Date.parse(value.current_ended_at)<Date.parse(value.current_started_at))throw new Error('Only a verified completed record can be corrected here. Interrupted or pending work requires its existing recovery process.');
    if(value.correction_id!==null&&value.correction_id!==undefined&&!UUID.test(value.correction_id))throw new Error('Current correction reference is unavailable.');
    return value;
  }
  function validateChoices(value){
    for(const kind of ['employees','locations','devices']){
      if(!Array.isArray(value?.[kind])||value[kind].length>2000)throw new Error('Correction choices unavailable.');
      const seen=new Set();for(const item of value[kind])if(!item||!UUID.test(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.length>300||seen.has(item.id))throw new Error('Correction choices unavailable.');else seen.add(item.id);
    }return value;
  }
  function label(prefix,key,labelKey){if(key.endsWith('_at'))return displayTime(truth[prefix+key]);return truth[prefix+labelKey]|| (key==='location_id'?truth[prefix+'location_code']:key==='device_id'?truth[prefix+'device_identifier']:null)||'Unavailable';}
  function originalAndCurrent(){
    const table=node('table'),head=node('tr');for(const value of ['Field','Original record — preserved','Current recorded value'])head.append(node('th',value));table.append(head);
    for(const [key,title,,labelKey] of fields){const row=node('tr');row.append(node('th',title),node('td',label('original_',key,labelKey)),node('td',label('current_',key,labelKey)));table.append(row);}content.append(table);
    if(truth.correction_id)content.append(node('p',`Previous correction: ${truth.corrected_by_manager_name_snapshot||'Manager name unavailable'} · ${displayTime(truth.corrected_at)} · ${truth.correction_reason||'Reason unavailable'}`));
  }
  const button=(label,action)=>{const b=node('button',label);b.type='button';b.className='uxButton compact';b.addEventListener('click',()=>void action());return b;};
  function edit(){
    check();pinned=null;inputs={};content.replaceChildren();originalAndCurrent();
    const form=node('form');form.addEventListener('submit',event=>event.preventDefault());
    for(const [key,title,kind,labelKey] of fields){const wrapper=node('label',title+(kind?'':' (Zoo local time)'));let input;
      if(kind){input=node('select');const options=[...choices[kind]];if(!options.some(v=>v.id===truth['current_'+key]))options.unshift({id:truth['current_'+key],label:label('current_',key,labelKey)+' (recorded value)'});
        for(const option of options){const e=node('option',option.label);e.value=option.id;input.append(e);}input.value=truth['current_'+key];
      }else{input=node('input');input.type='datetime-local';input.step='1';input.value=zooLocalInput(truth['current_'+key]);const occurrence=node('select');
        for(const [value,text] of [['','Choose if this time occurs twice'],['earlier','First occurrence (daylight time)'],['later','Second occurrence (standard time)']]){const option=node('option',text);option.value=value;occurrence.append(option);}occurrence.value='';
        occurrence.name=key+'_occurrence';inputs[key+'_occurrence']=occurrence;wrapper.append(input,node('span',' If clocks move back: '),occurrence);
      }
      input.name=key;if(kind)wrapper.append(input);form.append(wrapper);inputs[key]=input;
    }
    const reason=node('textarea');reason.name='reason';reason.maxLength=1000;reason.required=true;const reasonLabel=node('label','Reason for this correction');reasonLabel.append(reason);form.append(reasonLabel);inputs.reason=reason;
    form.append(button('Preview correction',preview),button('Cancel',()=>clear()));content.append(form);setState('EDITING','Review the preserved original and current values. Select only the facts to correct and enter the reason.');
  }
  async function open(row){
    if(unresolved()){if(!current()){deny();return false;}status.textContent='Check the original correction outcome before opening another record.';return false;}
    if(!canWrite()||!UUID.test(row?.session_id)||typeof row?.session_uuid!=='string')throw new Error('Current full manager access and an exact record are required.');
    const epoch=++generation;owner=binding();selected={session_id:row.session_id,session_uuid:row.session_uuid};pinned=null;panel.hidden=false;content.replaceChildren();setState('LOADING','Reading the original record and correction choices…');
    try{const [record,options]=await Promise.all([api.truth(selected.session_id),api.choices(selected.session_id)]);if(epoch!==generation)return false;check();truth=validateTruth(record,selected);choices=validateChoices(options);edit();return true;}
    catch(error){if(epoch!==generation)return false;if(!current()){deny();return false;}content.replaceChildren();setState('UNAVAILABLE',error.message||'Correction information unavailable.');return false;}
  }
  async function preview(){
    if(state!=='EDITING')return;try{check();const body={reason:inputs.reason.value.trim(),expected_correction_id:truth.correction_id||null,expected_session_uuid:selected.session_uuid},diff=[];if(!body.reason||body.reason.length>1000)throw new Error('Enter a reason of 1 to 1,000 characters.');
      for(const [key,title,kind,labelKey] of fields){let value=inputs[key].value;
        if(kind){if(value===truth['current_'+key])continue;if(!choices[kind].some(option=>option.id===value))throw new Error('Choose an available '+title.toLowerCase()+'.');}
        else {const occurrence=inputs[key+'_occurrence'].value;if(value===zooLocalInput(truth['current_'+key])&&!occurrence)continue;value=zooLocalInstant(value,occurrence);if(Date.parse(value)===Date.parse(truth['current_'+key]))continue;}
        body['corrected_'+key]=value;diff.push({field:title,before:label('current_',key,labelKey),after:kind?choices[kind].find(option=>option.id===value).label:displayTime(value)});
      }
      retryAllowed=false;
      if(!diff.length)throw new Error('Choose at least one changed fact before previewing.');
      if(Date.parse(body.corrected_ended_at||truth.current_ended_at)<Date.parse(body.corrected_started_at||truth.current_started_at))throw new Error('Finished time must be on or after started time.');
      pinned=Object.freeze({operationId:uuid(),body:Object.freeze(body),baseline:viewKey(truth),diff});if(!UUID.test(pinned.operationId))throw new Error('A correction operation could not be created.');
      content.replaceChildren();originalAndCurrent();const list=node('ul');for(const change of diff)list.append(node('li',`${change.field}: ${change.before} → ${change.after}`));content.append(node('h4','Preview — only these facts will change'),list,node('p','Reason: '+body.reason),node('p','The original record is retained. The server records the current manager’s attribution.'));
      content.append(button('Confirm this correction once',confirm),button('Back to edit',edit),button('Cancel',()=>clear()));setState('PREVIEW','No correction has been saved. Confirm exactly this preview or cancel.');
    }catch(error){status.textContent=error.message||'Correction choices unavailable.';}
  }
  function showUnknown(){content.replaceChildren();content.append(node('p','The correction may have been saved. Keep this original operation; do not create a replacement.'),node('p','Original operation: '+pinned.operationId),node('p','Reason: '+pinned.body.reason));
    const list=node('ul');for(const change of pinned.diff)list.append(node('li',`${change.field}: ${change.before} → ${change.after}`));content.append(list,button('Check saved outcome',checkSaved));
    if(retryAllowed)content.append(button('Retry this exact correction',retry));
    setState('UNKNOWN',retryAllowed?'No matching saved operation was found on the last check. Check again or explicitly retry this exact operation.':'Outcome unknown. Check this original operation’s saved outcome.');}
  function receipt(value){
    if(!value||value.session_id!==selected.session_id||value.operation_id!==pinned.operationId||!UUID.test(value.correction_id)||!instant(value.created_at)||!Array.isArray(value.changed_fields))throw new Error('Matching correction receipt unavailable.');
    const expected=Object.keys(pinned.body).filter(key=>key.startsWith('corrected_')).map(key=>key.slice(10).replace(/_id$/, '')).sort();
    if(JSON.stringify([...value.changed_fields].sort())!==JSON.stringify(expected))throw new Error('Correction fields do not match the original operation.');
    return value;
  }
  async function confirm(){
    if(state!=='PREVIEW')return;check();setState('SENDING','Confirming this correction once…');for(const b of content.querySelectorAll('button'))b.disabled=true;
    let sent=false;
    try{const fresh=validateTruth(await api.truth(selected.session_id),selected);check();if(viewKey(fresh)!==pinned.baseline){truth=fresh;edit();status.textContent='This record changed since preview. Review the current values and make a new preview.';return;}
      sent=true;pending=true;const value=await api.save(selected.session_id,pinned.operationId,pinned.body);check();receipt(value);await readSaved();
    }catch(error){if(!current()){deny();return;}if(sent && error.status===409){pending=false;setState('CONFLICT','This record changed. Reopen it to review current values.');content.replaceChildren();}else if(sent)showUnknown();else{state='PREVIEW';for(const b of content.querySelectorAll('button'))b.disabled=false;status.textContent=error.message||'Current record could not be rechecked. Nothing was sent.';}}
  }
  async function readSaved(){
    const value=await api.status(selected.session_id,pinned.operationId);check();
    if(value?.found===false&&value.session_id===selected.session_id&&value.operation_id===pinned.operationId){retryAllowed=true;throw new Error('Original operation not found.');}
    if(value?.found!==true)throw new Error('Original operation readback unavailable.');
    retryAllowed=false;const saved=receipt(value);
    if(!UUID.test(saved.actor_manager_id)||typeof saved.actor_name!=='string'||!saved.actor_name.trim()||saved.reason!==pinned.body.reason)throw new Error('Original correction attribution unavailable.');const currentTruth=validateTruth(await api.truth(selected.session_id),selected);check();
    truth=currentTruth;pending=false;content.replaceChildren();originalAndCurrent();content.append(node('p',`Saved correction: ${displayTime(saved.created_at)}. ${saved.actor_name}`),node('p','Reason: '+pinned.body.reason),button('Close correction',()=>clear()));setState('SAVED','This exact correction was confirmed by its saved operation receipt. The current recorded values are shown above.');
  }
  async function retry(){if(state!=='UNKNOWN'||!retryAllowed)return;try{check();setState('SENDING','Retrying the same pinned operation once…');receipt(await api.save(selected.session_id,pinned.operationId,pinned.body));check();await readSaved();}catch{if(current())showUnknown();else deny();}}
  async function checkSaved(){if(state!=='UNKNOWN')return;try{check();setState('CHECKING','Checking the original saved operation…');await readSaved();}catch{if(current())showUnknown();else deny();}}
  return {open,clear,preview,confirm,checkSaved,retry,getState:()=>state,hasUnresolved:unresolved,resume:()=>{if(pending&&current())showUnknown();else if(owner&&!current())deny();},revalidate:()=>{if(owner&&!current())deny();},retire:()=>{if(unresolved()){deny();}else clear();}};
}
