const PREFIX='mz_employee_feedback_outbox:';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const receiptFields=new Set(['id','operation_id','status','notification_status','email_delivery','created_at','newly_inserted','binding']);
const bindingFields=new Set(['schema','device_id','employee_id','content_sha256']);
async function contentDigest(body){
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  const image=body.image_attachment||body.image;let imageSha=null;
  if(image){const match=String(image.data_url||image.dataUrl||'').trim().match(/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,([a-z0-9+/=\s]+)$/i);if(!match)throw Error('Original feedback attachment cannot be matched.');imageSha=await digest(Uint8Array.from(atob(match[1].replace(/\s/g,'')),v=>v.charCodeAt(0)));}
  return digest(new TextEncoder().encode(JSON.stringify([String(body.category??'other').trim().toLowerCase(),String(body.priority??'normal').trim().toLowerCase(),String(body.message??body.body??'').trim(),String(body.page_url??body.url??'').trim()||null,imageSha])));
}
const binding=value=>typeof value?.deviceId==='string'&&value.deviceId&&uuid(value.employeeId)&&uuid(value.credentialId)
  && Number.isSafeInteger(value.assignmentEpoch)&&value.assignmentEpoch>=1
  ? Object.freeze({deviceId:value.deviceId,employeeId:value.employeeId.toLowerCase(),credentialId:value.credentialId.toLowerCase(),assignmentEpoch:value.assignmentEpoch}):null;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};

/** One shared delivery owner in every employee document; no guest-report dependency. */
export function createFeedbackOutbox({storage,mutate,identity,request,online=()=>navigator.onLine!==false,lock=null,onStatus=()=>{}}) {
  let flight=null,savedRevision=0;
  async function requireBinding(expected,context=null,generation=null){
    context?.assertCurrent?.();
    const current=binding(await identity({purpose:'deliver'}));
    context?.assertCurrent?.();
    if(!current||current.deviceId!==expected.deviceId||current.employeeId!==expected.employeeId
      ||current.credentialId!==expected.credentialId||current.assignmentEpoch!==expected.assignmentEpoch
      ||(context?.deviceId!==undefined&&context.deviceId!==expected.deviceId)
      ||(generation!==null&&context?.generation!==generation))throw Error('Original feedback delivery authority changed.');
  }
  async function save(body) {
    const original=JSON.parse(JSON.stringify(body));
    const current=binding(await identity({purpose:'save'}));
    if(!current||!uuid(original?.operation_id)) throw Error('Feedback needs a verified saved employee identity.');
    if((original.device_id!==undefined&&original.device_id!==current.deviceId)
      ||(original.expected_employee_id!==undefined&&original.expected_employee_id!==current.employeeId)
      ||(original.expected_credential_id!==undefined&&original.expected_credential_id!==current.credentialId)
      ||(original.expected_assignment_epoch!==undefined&&original.expected_assignment_epoch!==String(current.assignmentEpoch))){
      throw Error('Original feedback save authority changed.');
    }
    const payload={...original,device_id:current.deviceId,hub_context:'employee',expected_employee_id:current.employeeId,
      expected_credential_id:current.credentialId,expected_assignment_epoch:String(current.assignmentEpoch)};
    const row={schema_version:'employee-feedback-outbox.v2',created_at:new Date().toISOString(),body:payload};
    const encoded=JSON.stringify(row),key=PREFIX+current.deviceId+':'+original.operation_id;
    if(encoded.length>3500000) throw Error('Feedback photo is too large.');
    await mutate(async context=>{
      await requireBinding(current,context);
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
    return {saved:true,operationId:original.operation_id};
  }
  async function readPending(){
    const current=binding(await identity({purpose:'deliver'}));
    if(!current)return Object.freeze({state:'unavailable'});
    return mutate(async context=>{
      await requireBinding(current,context);
      const originals=[];
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);if(!key?.startsWith(PREFIX+current.deviceId+':'))continue;
        const encoded=storage.getItem(key);let row;
        try{row=JSON.parse(encoded);}catch{return Object.freeze({state:'held'});}
        const body=row?.body;
        if(row?.schema_version!=='employee-feedback-outbox.v2'||!body||typeof body!=='object'||Array.isArray(body)
          ||!uuid(body.operation_id)||key!==PREFIX+current.deviceId+':'+body.operation_id
          ||body.device_id!==current.deviceId||body.expected_employee_id!==current.employeeId
          ||body.expected_credential_id!==current.credentialId||body.expected_assignment_epoch!==String(current.assignmentEpoch)){
          return Object.freeze({state:'held'});
        }
        originals.push({key,encoded,row});
      }
      context?.assertCurrent?.();
      if(originals.some(original=>storage.getItem(original.key)!==original.encoded))throw Error('Feedback changed during pending recovery.');
      originals.sort((a,b)=>String(a.row.created_at).localeCompare(String(b.row.created_at)));
      // Read-only local recovery, never a receipt or server acceptance claim.
      return originals.length?freeze({state:'pending',body:JSON.parse(JSON.stringify(originals[0].row.body))}):Object.freeze({state:'clear'});
    });
  }
  async function deliver() {
    if(!online()) return [];
    const current=binding(await identity({purpose:'deliver'}));
    if(!current) return [];
    const rows=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);if(!key?.startsWith(PREFIX+current.deviceId+':'))continue;
      const encoded=storage.getItem(key);let row;
      try{row=JSON.parse(encoded);}catch{onStatus({state:'unreadable_feedback_preserved'});continue;}
      if(row?.schema_version!=='employee-feedback-outbox.v2'||!uuid(row.body?.expected_employee_id)
        ||!uuid(row.body?.expected_credential_id)||typeof row.body?.expected_assignment_epoch!=='string'
        ||row.body.expected_assignment_epoch!==String(current.assignmentEpoch)){
        onStatus({state:'legacy_feedback_identity_review'});continue;
      }
      if(row.body.device_id!==current.deviceId || row.body.expected_employee_id.toLowerCase()!==current.employeeId || !uuid(row.body.operation_id)
        ||row.body.expected_credential_id.toLowerCase()!==current.credentialId
        || key!==PREFIX+current.deviceId+':'+row.body.operation_id){onStatus({state:'feedback_binding_mismatch'});continue;}
      rows.push({key,row,encoded});
    }
    rows.sort((a,b)=>String(a.row.created_at).localeCompare(String(b.row.created_at)));
    const accepted=[];
    for(const {key,row,encoded} of rows){
      if(!online())break;
      try{
        const payload=freeze(JSON.parse(JSON.stringify(row.body)));
        const expectedContent=await contentDigest(payload);
        let generation=null;
        await mutate(async context=>{
          await requireBinding(current,context);
          if(storage.getItem(key)!==encoded)throw Error('Feedback changed before delivery.');
          if(!Number.isSafeInteger(context?.generation)||context.generation<1)throw Error('Feedback delivery generation is unavailable.');
          generation=context.generation;
        });
        await requireBinding(current);
        // The server compares expected_employee_id against current authenticated identity.
        const response=await request('/feedback-api/submit',{method:'POST',headers:{'Idempotency-Key':row.body.operation_id},body:payload,expectedGeneration:generation});
        const acknowledged=response?.data?.item;
        const receipt=acknowledged?.binding;
        if(response?.ok!==true||response?.meta?.contract_version!=='feedback.v3.enrolled-authority'
          ||!acknowledged||typeof acknowledged!=='object'||Array.isArray(acknowledged)
          ||Object.keys(acknowledged).some(key=>!receiptFields.has(key))||!uuid(acknowledged?.id)||!uuid(acknowledged?.operation_id)
          ||acknowledged.operation_id.toLowerCase()!==row.body.operation_id.toLowerCase()
          ||!receipt||typeof receipt!=='object'||Array.isArray(receipt)||Object.keys(receipt).length!==4
          ||Object.keys(receipt).some(key=>!bindingFields.has(key))||receipt.schema!=='employee-feedback-receipt.v1'
          ||receipt.device_id!==current.deviceId||!uuid(receipt.employee_id)||receipt.employee_id.toLowerCase()!==current.employeeId
          ||receipt.content_sha256!==expectedContent)throw Error('This exact feedback operation was not acknowledged.');
        await requireBinding(current);
        await mutate(async context=>{
          await requireBinding(current,context,generation);
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
  return Object.freeze({save,flush,readPending});
}
