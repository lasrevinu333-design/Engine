(function installMemphisStaffingCommand(root) {
  'use strict';
  const SCHEMA='memphis-zoo.staffing-command-browser-recovery.v3';
  const STORAGE_KEY_PREFIX='mz_static_weekly_staffing_command_v3:';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const DIGEST=/^[0-9a-f]{64}$/;
  const fail=(code)=>Object.assign(new Error(code),{code});
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  function exactCommand(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw fail('staffing_browser_command_required');
    const command={command_kind:value.command_kind,employee_id:value.employee_id,start_date:value.start_date,
      end_date:value.end_date,expected_revision:value.expected_revision};
    if(command.command_kind==='absence')command.absence_kind=value.absence_kind;
    else if(command.command_kind==='cancel_absence')command.target_absence_id=value.target_absence_id;
    else throw fail('staffing_browser_command_kind_invalid');
    if(!UUID.test(command.employee_id)||!/^\d{4}-\d{2}-\d{2}$/.test(command.start_date)
      ||!/^\d{4}-\d{2}-\d{2}$/.test(command.end_date)||!Number.isSafeInteger(command.expected_revision)
      ||command.expected_revision<0)throw fail('staffing_browser_command_invalid');
    if(command.command_kind==='absence'&&!['daily_absence','pto','unavailable'].includes(command.absence_kind))throw fail('staffing_browser_absence_kind_invalid');
    if(command.command_kind==='cancel_absence'&&!UUID.test(command.target_absence_id))throw fail('staffing_browser_target_absence_invalid');
    return command;
  }
  function createStaffingCommandCoordinator({api,managerId,storage=root.localStorage,uuid=()=>root.crypto.randomUUID(),onState=()=>{}}={}){
    if(typeof api!=='function'||!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')throw fail('staffing_browser_durable_storage_required');
    if(!UUID.test(managerId))throw fail('staffing_browser_manager_identity_required');
    const storageKey=`${STORAGE_KEY_PREFIX}${managerId}`;
    const emit=(record)=>onState(record?clone(record):null);
    function load(){
      const raw=storage.getItem(storageKey);if(!raw){emit(null);return null;}
      let record;try{record=JSON.parse(raw);}catch{throw fail('staffing_browser_recovery_record_invalid');}
      if(record?.schema!==SCHEMA||record.managerId!==managerId||!UUID.test(record.managerId)
        ||!UUID.test(record.clientPrepareKey)||!UUID.test(record.confirmationKey)
        ||(record.operationId!=null&&!UUID.test(record.operationId))
        ||typeof record.confirmationSubmitted!=='boolean')throw fail('staffing_browser_recovery_record_invalid');
      record.command=exactCommand(record.command);emit(record);return record;
    }
    function save(record){storage.setItem(storageKey,JSON.stringify(record));emit(record);}
    function clear(){storage.removeItem(storageKey);emit(null);}
    async function request(record,path,options={}){
      const method=String(options.method||'GET').toUpperCase();
      if(!['GET','HEAD'].includes(method)){
        const encoded=String(options.body??'');record.pendingWrite={path,method,encoded};save(record);
        const result=await api(path,{...options,method,body:encoded});delete record.pendingWrite;save(record);return result;
      }
      return api(path,options);
    }
    async function advance(record){
      if(!record.operationId){
        const body={...record.command,client_prepare_key:record.clientPrepareKey};
        const begun=await request(record,'/static-weekly/staffing-commands',{method:'POST',body:JSON.stringify(body)});
        if(!UUID.test(begun?.operation_id))throw fail('staffing_browser_begin_response_invalid');
        record.operationId=begun.operation_id;save(record);
      }
      const base=`/static-weekly/staffing-commands/${record.operationId}`;
      let status=await request(record,base);
      if(status?.state==='PREPARING'){
        await request(record,`${base}/prepare`,{method:'POST',body:'{}'});
        status=await request(record,base);
      }
      if(status?.state==='PREPARED'){
        if(!DIGEST.test(status.preview_digest))throw fail('staffing_browser_preview_digest_invalid');
        if(status.preview?.schema!=='memphis-zoo.staffing-command-preview.v1'||!Array.isArray(status.preview.weeks))throw fail('staffing_browser_preview_content_invalid');
        record.previewDigest=status.preview_digest;save(record);
        if(!record.confirmationSubmitted)return{phase:'PREPARED',command:status,preview:status.preview};
        await request(record,`${base}/confirm`,{method:'POST',body:JSON.stringify({preview_digest:record.previewDigest,confirmation_key:record.confirmationKey})});status=await request(record,base);
      }
      if(['CANCELLED','CANCELLED_BY_SUCCESSOR','REJECTED'].includes(status?.state)){
        const terminal=String(status.state).toLowerCase();clear();throw fail(`staffing_browser_command_${terminal}`);
      }
      if(status?.state!=='ACCEPTED')throw fail(`staffing_browser_command_not_accepted:${String(status?.state||'unavailable')}`);
      const delivery=await request(record,`${base}/delivery`);
      if(!delivery||!Array.isArray(delivery.targets))throw fail('staffing_browser_delivery_status_invalid');
      const result={command:status,delivery};clear();return result;
    }
    return Object.freeze({
      hasPending(){return Boolean(load());},
      recover(){const record=load();return record?advance(record):Promise.resolve(null);},
      prepare(value){
        const command=exactCommand(value);let record=load();
        if(record){if(JSON.stringify(record.command)!==JSON.stringify(command))throw fail('staffing_browser_different_command_pending');}
        else{record={schema:SCHEMA,managerId,command,clientPrepareKey:uuid(),confirmationKey:uuid(),confirmationSubmitted:false,operationId:null};
          if(!UUID.test(record.clientPrepareKey)||!UUID.test(record.confirmationKey))throw fail('staffing_browser_uuid_unavailable');save(record);}
        return advance(record);
      },
      confirm(){const record=load();if(!record||!record.operationId||!DIGEST.test(record.previewDigest))throw fail('staffing_browser_prepared_command_required');record.confirmationSubmitted=true;save(record);return advance(record);},
      async cancel(){const record=load();if(!record?.operationId)throw fail('staffing_browser_pending_command_required');const base=`/static-weekly/staffing-commands/${record.operationId}`;await request(record,`${base}/cancel`,{method:'POST',body:'{}'});const status=await request(record,base);if(!['CANCELLED','CANCELLED_BY_SUCCESSOR','REJECTED'].includes(status?.state))throw fail(`staffing_browser_command_not_cancelled:${String(status?.state||'unavailable')}`);clear();return{state:status.state};},
      storageKey,
    });
  }
  root.MemphisStaffingCommand=Object.freeze({SCHEMA,STORAGE_KEY_PREFIX,createStaffingCommandCoordinator});
})(globalThis);
