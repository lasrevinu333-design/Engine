const PREFIX='mz_employee_feedback_outbox:';
const BACKUP_PREFIX='mz_employee_feedback_retirement_backup:';
const ORIGINAL_LIMIT=3500000;
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
const privateEpoch=value=>{
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>=1?value:null;
  if(typeof value!=='string'||!/^[1-9][0-9]*$/.test(value))return null;
  const epoch=Number(value);
  return Number.isSafeInteger(epoch)&&epoch>=1&&String(epoch)===value?epoch:null;
};
const binding=value=>{
  const assignmentEpoch=privateEpoch(value?.assignmentEpoch);
  return typeof value?.deviceId==='string'&&value.deviceId&&uuid(value.employeeId)&&uuid(value.credentialId)&&assignmentEpoch!==null
    ? Object.freeze({deviceId:value.deviceId,employeeId:value.employeeId.toLowerCase(),credentialId:value.credentialId.toLowerCase(),assignmentEpoch}):null;
};
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
function originalRow(encoded,key,current){
  if(typeof encoded!=='string'||encoded.length>ORIGINAL_LIMIT)return null;
  let row;try{row=JSON.parse(encoded);}catch{return null;}
  const body=row?.body;
  return row&&Object.keys(row).sort().join('|')==='body|created_at|schema_version'
    &&row.schema_version==='employee-feedback-outbox.v2'&&typeof row.created_at==='string'&&row.created_at
    &&body&&typeof body==='object'&&!Array.isArray(body)&&body.hub_context==='employee'
    &&uuid(body.operation_id)&&key===PREFIX+current.deviceId+':'+body.operation_id
    &&body.device_id===current.deviceId&&body.expected_employee_id===current.employeeId
    &&body.expected_credential_id===current.credentialId&&body.expected_assignment_epoch===String(current.assignmentEpoch)?row:null;
}
function backupRow(encoded,key,current){
  if(typeof encoded!=='string')return null;
  let backup;try{backup=JSON.parse(encoded);}catch{return null;}
  if(!backup||Object.keys(backup).sort().join('|')!=='original_encoded|original_key|schema_version'
    ||backup.schema_version!=='employee-feedback-retirement-backup.v1')return null;
  const row=originalRow(backup.original_encoded,backup.original_key,current);
  return row&&key===BACKUP_PREFIX+current.deviceId+':'+row.body.operation_id?{backup,row}:null;
}

/** One shared delivery owner in every employee document; no guest-report dependency. */
export function createFeedbackOutbox({storage,mutate,identity,request,online=()=>navigator.onLine!==false,lock=null,onStatus=()=>{}}) {
  let flight=null,savedRevision=0;
  // Ephemeral exact server receipts, never persisted as acceptance authority.
  // A restart must read the original again; retained backup bytes never vanish.
  const confirmedBackups=new Map();
  const confirmationMatches=(key,encoded,current,generation)=>{
    const receipt=confirmedBackups.get(key);
    return receipt?.encoded===encoded&&receipt.generation===generation&&receipt.principal===canonical(current);
  };
  async function requireBinding(expected,context=null,generation=null){
    context?.assertCurrent?.();
    const current=binding(await identity({purpose:'deliver'}));
    context?.assertCurrent?.();
    if(!current||current.deviceId!==expected.deviceId||current.employeeId!==expected.employeeId
      ||current.credentialId!==expected.credentialId||current.assignmentEpoch!==expected.assignmentEpoch
      ||(context?.deviceId!==undefined&&context.deviceId!==expected.deviceId)
      ||(generation!==null&&context?.generation!==generation))throw Error('Original feedback delivery authority changed.');
  }
  function requireReceipt(response,payload,current,expectedContent){
        const acknowledged=response?.data?.item;
        const receipt=acknowledged?.binding;
        if(response?.ok!==true||response?.meta?.contract_version!=='feedback.v3.enrolled-authority'
          ||!acknowledged||typeof acknowledged!=='object'||Array.isArray(acknowledged)
          ||Object.keys(acknowledged).some(key=>!receiptFields.has(key))||!uuid(acknowledged?.id)||!uuid(acknowledged?.operation_id)
          ||acknowledged.operation_id.toLowerCase()!==payload.operation_id.toLowerCase()
          ||!receipt||typeof receipt!=='object'||Array.isArray(receipt)||Object.keys(receipt).length!==4
          ||Object.keys(receipt).some(key=>!bindingFields.has(key))||receipt.schema!=='employee-feedback-receipt.v1'
          ||receipt.device_id!==current.deviceId||!uuid(receipt.employee_id)||receipt.employee_id.toLowerCase()!==current.employeeId
          ||receipt.content_sha256!==expectedContent)throw Error('This exact feedback operation was not acknowledged.');
  }
  async function reconcileBackups(current){
    const accepted=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(!key?.startsWith(BACKUP_PREFIX+current.deviceId+':'))continue;
      const encoded=storage.getItem(key),retained=backupRow(encoded,key,current);
      if(!retained){onStatus({state:'unreadable_feedback_preserved'});continue;}
      if(storage.getItem(retained.backup.original_key)!==null)continue;
      let generation=null;
      try{
        await mutate(async context=>{
          await requireBinding(current,context);
          if(storage.getItem(key)!==encoded||!Number.isSafeInteger(context?.generation)||context.generation<1)throw Error('Original feedback backup changed.');
          generation=context.generation;
        });
        if(confirmationMatches(key,encoded,current,generation))continue;
        const payload=freeze(JSON.parse(JSON.stringify(retained.row.body))),expectedContent=await contentDigest(payload);
        await requireBinding(current);
        const response=await request('/feedback-api/original-receipt',{method:'POST',body:payload,expectedGeneration:generation});
        requireReceipt(response,payload,current,expectedContent);
        await mutate(async context=>{
          await requireBinding(current,context,generation);
          if(storage.getItem(key)!==encoded||storage.getItem(retained.backup.original_key)!==null)throw Error('Original feedback backup changed.');
        });
        await requireBinding(current);
        confirmedBackups.set(key,{encoded,generation,principal:canonical(current)});
        accepted.push(payload.operation_id);onStatus({state:'uploaded',operationId:payload.operation_id});
      }catch{
        confirmedBackups.delete(key);
        onStatus({state:'saved_pending_delivery',operationId:retained.row.body.operation_id});
      }
    }
    return accepted;
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
    if(encoded.length>ORIGINAL_LIMIT) throw Error('Feedback photo is too large.');
    await mutate(async context=>{
      await requireBinding(current,context);
      const prior=storage.getItem(key);
      const backupKey=BACKUP_PREFIX+current.deviceId+':'+original.operation_id;
      const backupEncoded=storage.getItem(backupKey);
      const retained=backupEncoded===null?null:backupRow(backupEncoded,backupKey,current);
      if(backupEncoded!==null&&(!retained||canonical(retained.row.body)!==canonical(payload)
        ||(prior!==null&&prior!==retained.backup.original_encoded)))throw Error('Original feedback retirement backup needs protected recovery.');
      if(prior!==null){
        let existing;try{existing=JSON.parse(prior);}catch{throw Error('Saved feedback identity needs protected recovery.');}
        if(existing?.schema_version!=='employee-feedback-outbox.v2'||canonical(existing.body)!==canonical(payload))throw Error('Feedback operation identity was already used.');
        return; // Same body keeps original created_at and exact persisted bytes.
      }
      // A retirement backup is an original whose submission may already have
      // committed. Reconcile it read-only; never recreate a purged server row.
      if(retained)return;
      const originalEncoded=encoded;
      context?.assertCurrent?.();
      storage.setItem(key,originalEncoded);
      if(storage.getItem(key)!==originalEncoded) throw Error('Feedback could not be saved.');
    });
    savedRevision+=1;
    return {saved:true,operationId:original.operation_id};
  }
  async function readPending(){
    const current=binding(await identity({purpose:'deliver'}));
    if(!current)return Object.freeze({state:'unavailable'});
    return mutate(async context=>{
      await requireBinding(current,context);
      const originals=new Map(),observed=[];
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i),isBackup=key?.startsWith(BACKUP_PREFIX+current.deviceId+':');
        if(!isBackup&&!key?.startsWith(PREFIX+current.deviceId+':'))continue;
        const encoded=storage.getItem(key),retained=isBackup?backupRow(encoded,key,current):null;
        const row=isBackup?retained?.row:originalRow(encoded,key,current);
        if(!row)return Object.freeze({state:'held'});
        observed.push({key,encoded});
        if(isBackup&&confirmationMatches(key,encoded,current,context?.generation))continue;
        const originalEncoded=isBackup?retained.backup.original_encoded:encoded;
        const prior=originals.get(row.body.operation_id);
        if(prior&&prior.encoded!==originalEncoded)return Object.freeze({state:'held'});
        originals.set(row.body.operation_id,{encoded:originalEncoded,row});
      }
      context?.assertCurrent?.();
      if(observed.some(original=>storage.getItem(original.key)!==original.encoded))throw Error('Feedback changed during pending recovery.');
      const ordered=[...originals.values()].sort((a,b)=>String(a.row.created_at).localeCompare(String(b.row.created_at)));
      // Read-only local recovery, never a receipt or server acceptance claim.
      return ordered.length?freeze({state:'pending',body:JSON.parse(JSON.stringify(ordered[0].row.body)),
        originals:ordered.map(original=>JSON.parse(JSON.stringify(original.row.body)))}):Object.freeze({state:'clear'});
    });
  }
  async function deliver() {
    if(!online()) return [];
    const current=binding(await identity({purpose:'deliver'}));
    if(!current) return [];
    const accepted=await reconcileBackups(current);
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
        requireReceipt(response,payload,current,expectedContent);
        await requireBinding(current);
        await mutate(async context=>{
          await requireBinding(current,context,generation);
          if(storage.getItem(key)!==encoded)throw Error('Feedback changed during delivery.');
          if(!originalRow(encoded,key,current))throw Error('Original feedback retirement needs protected recovery.');
          const backupKey=BACKUP_PREFIX+current.deviceId+':'+row.body.operation_id;
          const priorBackup=storage.getItem(backupKey);
          if(priorBackup!==null){
            const retained=backupRow(priorBackup,backupKey,current);
            if(!retained||retained.backup.original_key!==key||retained.backup.original_encoded!==encoded)throw Error('Original feedback retirement backup conflicts.');
          }else{
            const backupEncoded=JSON.stringify({schema_version:'employee-feedback-retirement-backup.v1',original_key:key,original_encoded:encoded});
            context?.assertCurrent?.();
            try{
              storage.setItem(backupKey,backupEncoded);
              if(storage.getItem(backupKey)!==backupEncoded)throw Error('Backup readback failed.');
            }catch(error){
              throw Object.assign(Error('Original feedback backup could not be retained. Active feedback remains pending.'),
                {feedbackRetentionReason:error?.name==='QuotaExceededError'?'retirement_backup_capacity':'retirement_backup_unavailable'});
            }
          }
          context?.assertCurrent?.();
          storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Feedback cleanup failed.');
        });
        const backupKey=BACKUP_PREFIX+current.deviceId+':'+row.body.operation_id;
        const backupEncoded=storage.getItem(backupKey);
        if(backupRow(backupEncoded,backupKey,current)?.backup.original_encoded===encoded)
          confirmedBackups.set(backupKey,{encoded:backupEncoded,generation,principal:canonical(current)});
        accepted.push(row.body.operation_id);onStatus({state:'uploaded',operationId:row.body.operation_id});
      }catch(error){
        onStatus({state:'saved_pending_delivery',operationId:row.body.operation_id,...(error?.feedbackRetentionReason?{reason:error.feedbackRetentionReason}:{})});
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
