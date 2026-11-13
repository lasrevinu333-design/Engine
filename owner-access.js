(async function(){
  'use strict';
  const form=document.getElementById('coverage-form'),end=document.getElementById('coverage-end');
  const status=document.getElementById('status'),stateLabel=document.getElementById('coverage-state');
  const enable=document.getElementById('enable'),disable=document.getElementById('disable');
  let current=null,busy=false;
  function show(data){
    current=data;
    stateLabel.textContent=data.enabled?'Absence coverage is enabled until '+new Date(data.ends_at).toLocaleString()+'.':'Absence coverage is off. Other managers remain read-only except for scan-ticket closure.';
    if(data.ends_at){const date=new Date(data.ends_at);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());end.value=date.toISOString().slice(0,16);}
  }
  async function save(enabled){
    if(busy||!current)return;
    if(!window.MemphisAuth.canMutateOpsManagerSurface()){status.textContent='Only Eric can change this setting.';return;}
    let endsAt=null;
    if(enabled){const date=new Date(end.value);if(!Number.isFinite(date.getTime())||date<=new Date()){status.textContent='Choose a future coverage end.';return;}endsAt=date.toISOString();}
    busy=true;enable.disabled=disable.disabled=true;status.textContent='Saving…';
    try{show(await window.MemphisAuth.ownerCoverage({enabled,ends_at:endsAt,reason:document.getElementById('coverage-reason').value,expected_revision:current.revision}));status.textContent='Saved. Your full owner access is unchanged.';}
    catch(error){status.textContent=error.message||'Not saved.';try{show(await window.MemphisAuth.ownerCoverage());}catch{}}
    finally{busy=false;enable.disabled=disable.disabled=false;}
  }
  try{
    await window.MemphisAuth.requireOpsManagerSession({redirect:true,interactive:false,throwOnFailure:true});
    form.hidden=!window.MemphisAuth.canMutateOpsManagerSurface();
    document.getElementById('timezone').textContent='Time zone: '+Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tomorrow=new Date(Date.now()+86400000);tomorrow.setMinutes(tomorrow.getMinutes()-tomorrow.getTimezoneOffset());end.value=tomorrow.toISOString().slice(0,16);
    show(await window.MemphisAuth.ownerCoverage());
    form.addEventListener('submit',event=>{event.preventDefault();void save(true);});
    disable.addEventListener('click',()=>void save(false));
  }catch(error){status.textContent=error.message||'Coverage settings are unavailable.';form.hidden=true;}
})();
