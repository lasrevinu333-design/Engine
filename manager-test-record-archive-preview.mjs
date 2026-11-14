// Read-only preparation. This packet is not an archive command or authority.
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const instant=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const fields=['session_id','session_uuid','status','correction_id','current_employee_name','current_location_name',...['original_','current_'].flatMap(prefix=>['employee_id','location_id','device_id','started_at','ended_at'].map(key=>prefix+key))];
function snapshot(value,selection){
 if(!value||value.session_id!==selection.session_id||value.session_uuid!==selection.session_uuid||value.status!=='completed'
  ||!instant(value.current_started_at)||!instant(value.current_ended_at)||Date.parse(value.current_ended_at)<Date.parse(value.current_started_at)
  ||value.correction_id!=null&&!uuid(value.correction_id))throw Error('Exact completed record could not be verified.');
 for(const key of fields){const v=value[key];if(v!=null&&((key.endsWith('_id')&&!uuid(v))||(key.endsWith('_name')&&(typeof v!=='string'||v.length>300))||(key.endsWith('_at')&&!instant(v))))throw Error('Exact record facts are unavailable.');}
 return Object.freeze(Object.fromEntries(fields.map(key=>[key,value[key]??null])));
}
export async function prepareTestRecordArchivePreview({selections,reason,readTruth,assertCurrent,now=()=>new Date().toISOString()}){
 if(!Array.isArray(selections)||!selections.length||selections.length>20||typeof reason!=='string'||!reason.trim()||reason.trim().length>1000
  ||typeof readTruth!=='function'||typeof assertCurrent!=='function')throw Error('Select up to 20 exact test records and give a reason.');
 const selected=selections.map(s=>{if(!s||Object.keys(s).sort().join(',')!=='session_id,session_uuid'||!uuid(s.session_id)||typeof s.session_uuid!=='string'||!s.session_uuid||s.session_uuid.length>200)throw Error('Exact test record selection is required.');return Object.freeze({...s});});
 if(new Set(selected.map(s=>s.session_id.toLowerCase())).size!==selected.length)throw Error('Duplicate test record selection.');
 const originalReason=reason.trim(),records=[];
 for(const selection of selected){assertCurrent();const truth=await readTruth(selection.session_id);assertCurrent();records.push(snapshot(truth,selection));}
 for(let i=0;i<selected.length;i++){assertCurrent();const fresh=await readTruth(selected[i].session_id);assertCurrent();if(JSON.stringify(snapshot(fresh,selected[i]))!==JSON.stringify(records[i]))throw Error('A selected record changed. Refresh and prepare another preview.');}
 assertCurrent();
 return Object.freeze({schema:'custodial.selected-test-record-archive-preview.v1',state:'PREVIEW_ONLY',archive_ready:false,created_at:now(),reason:originalReason,
  records:Object.freeze(records),preservation_required:Object.freeze(['original sessions','completion records','inspection history','linked tickets','attachments','correction history','native history and queued work'])});
}
