const PREFIX='mz_employee_feedback_outbox:';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

/** One shared delivery owner in every employee document; no guest-report dependency. */
export function createFeedbackOutbox({storage,mutate,identity,request,online=()=>navigator.onLine!==false,lock=null,onStatus=()=>{}}) {
  let flight=null,savedRevision=0;
  async function save(body) {
    const current=await identity({purpose:'save'});
    if(!current?.deviceId||!uuid(current.employeeId)||!uuid(body?.operation_id)) throw Error('Feedback needs a verified saved employee identity.');
    const payload={...body,device_id:current.deviceId,hub_context:'employee',expected_employee_id:current.employeeId};
    const row={schema_version:'employee-feedback-outbox.v2',created_at:new Date().toISOString(),body:payload};
    const encoded=JSON.stringify(row),key=PREFIX+current.deviceId+':'+body.operation_id;
    if(encoded.length>3500000) throw Error('Feedback photo is too large.');
    await mutate(()=>{
      const prior=storage.getItem(key);
      if(prior!==null){
        let existing;try{existing=JSON.parse(prior);}catch{throw Error('Saved feedback identity needs protected recovery.');}
        if(existing?.schema_version!=='employee-feedback-outbox.v2'||canonical(existing.body)!==canonical(payload))throw Error('Feedback operation identity was already used.');
        return; // Same body keeps original created_at and exact persisted bytes.
      }
      storage.setItem(key,encoded);
      if(storage.getItem(key)!==encoded) throw Error('Feedback could not be saved.');
    });
    savedRevision+=1;
    return {saved:true,operationId:body.operation_id};
  }
  async function deliver() {
    if(!online()) return [];
    const current=await identity({purpose:'deliver'});
    if(!current?.deviceId) return [];
    const rows=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);if(!key?.startsWith(PREFIX+current.deviceId+':'))continue;
      const encoded=storage.getItem(key);let row;
      try{row=JSON.parse(encoded);}catch{onStatus({state:'unreadable_feedback_preserved'});continue;}
      if(row?.schema_version!=='employee-feedback-outbox.v2'||!uuid(row.body?.expected_employee_id)){
        onStatus({state:'legacy_feedback_identity_review'});continue;
      }
      if(row.body.device_id!==current.deviceId || !uuid(row.body.operation_id)
        || key!==PREFIX+current.deviceId+':'+row.body.operation_id){onStatus({state:'feedback_binding_mismatch'});continue;}
      rows.push({key,row,encoded});
    }
    rows.sort((a,b)=>String(a.row.created_at).localeCompare(String(b.row.created_at)));
    const accepted=[];
    for(const {key,row,encoded} of rows){
      if(!online())break;
      try{
        // The server compares expected_employee_id against current authenticated identity.
        const response=await request('/feedback-api/submit',{method:'POST',headers:{'Idempotency-Key':row.body.operation_id},body:row.body});
        const acknowledged=response?.data?.item;
        if(response?.ok!==true||!uuid(acknowledged?.id)||!uuid(acknowledged?.operation_id)
          ||acknowledged.operation_id.toLowerCase()!==row.body.operation_id.toLowerCase())throw Error('This exact feedback operation was not acknowledged.');
        await mutate(()=>{
          if(storage.getItem(key)!==encoded)throw Error('Feedback changed during delivery.');
          storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Feedback cleanup failed.');
        });
        accepted.push(row.body.operation_id);onStatus({state:'uploaded',operationId:row.body.operation_id});
      }catch(error){
        onStatus({state:'saved_pending_delivery',operationId:row.body.operation_id});
        if(![409,422].includes(Number(error?.status||error?.httpStatus)))break;
      }
    }
    return accepted;
  }
  function flush(){
    if(!flight)flight=Promise.resolve().then(async()=>{
      const accepted=[];let observed;
      do{
        observed=savedRevision;
        accepted.push(...(await (lock?lock(deliver):deliver())));
      }while(online()&&observed!==savedRevision);
      return [...new Set(accepted)];
    }).finally(()=>{flight=null;});
    return flight;
  }
  return Object.freeze({save,flush});
}
