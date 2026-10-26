// Finite native capability facade. No payload/principal/time/received/sent setter.
import {custodialProviderNotificationEnabled} from './release-scope.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const failure=()=>Object.assign(new Error('The native notification attachment is unavailable.'),{code:'custodial_provider_mirror_response_invalid'});
const actions=new Set(['displayed','opened','acknowledged','dismissed','audio_started','audio_completed','audio_stopped','navigation_completed']);
const common=['schema','generation_id','principal_digest','token_digest','receipt_job_id','receipt_credential_id',
  'receipt_employee_id','receipt_device_id','receipt_assignment_epoch','notification_key','reservation_at','valid_until',
  'content_sha256','kind','notification_type','title','body','channel_id','route','service_date'];
const wireUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const positive=value=>typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value)&&Number.isSafeInteger(Number(value));
function requiredKindPayload(value){
  const event=value.kind==='employee_event';
  if(!event&&value.kind!=='employee_message')return true; // Existing exact native protocols stay unchanged.
  const fields=event?['event_id','instance_id','event_revision','notification_kind','source_revision','recipient_device_uuid']
    :['message_id','thread_id','recipient_user_id','source_revision'];
  if(!exact(value,[...common,...fields])||!['generation_id','receipt_job_id','receipt_credential_id','receipt_employee_id'].every(k=>wireUuid(value[k]))
    ||!['principal_digest','token_digest','content_sha256','source_revision'].every(k=>digest(value[k]))
    ||!positive(value.receipt_assignment_epoch)||!/^KIOSK_(?:0[2-9]|10)$/.test(value.receipt_device_id)
    ||!/^\d{4}-\d{2}-\d{2}$/.test(value.service_date)
    ||!['reservation_at','valid_until'].every(k=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value[k])))return false;
  // Java/SQL own calendar, digest, original-principal and interval authority.
  // This is a closed shape/cross-field projection, never another time owner.
  if(event)return ['event_id','instance_id','recipient_device_uuid'].every(k=>wireUuid(value[k]))&&positive(value.event_revision)
    &&['three_days_before','two_days_before','shift_plus_15'].includes(value.notification_kind)
    &&value.channel_id==='employee-events'&&value.route===`events.html?hub=employee&event_id=${value.event_id}`
    &&value.notification_key===`event:${value.event_id}:${value.event_revision}:${value.service_date}:${value.receipt_employee_id}:${value.recipient_device_uuid}:${value.receipt_assignment_epoch}:${value.notification_kind}`;
  return ['message_id','thread_id','recipient_user_id'].every(k=>wireUuid(value[k]))&&value.channel_id==='employee-messages'
    &&value.route===`messages.html?hub=employee&thread_id=${value.thread_id}`&&value.notification_key===`message:${value.message_id}`;
}
function includedPayload(value){
  if(value.kind==='employee_schedule_ownership')return custodialProviderNotificationEnabled(value)&&schedulePayload(value);
  if(value.kind==='employee_event'||value.kind==='employee_message')return custodialProviderNotificationEnabled(value)&&requiredKindPayload(value);
  return ['custodial.native-provider-payload.v1','custodial.native-location-payload.v2'].includes(value.schema)
    &&['employee_lunch_coverage','employee_location_status'].includes(value.kind);
}
function schedulePayload(value){
  const fields=['boundary_local','source_reservation_id','source_operation_id','source_window_sha256','server_source_sha256','source_revision',
    'projection_id','publication_id','version_id','assignment_occurrence_id','source_valid_from','source_valid_until'];
  return exact(value,[...common,...fields])
    &&['generation_id','receipt_job_id','receipt_credential_id','receipt_employee_id','source_reservation_id','source_operation_id','projection_id','publication_id','version_id','assignment_occurrence_id'].every(k=>wireUuid(value[k]))
    &&['principal_digest','token_digest','content_sha256','source_window_sha256','server_source_sha256'].every(k=>digest(value[k]))
    &&positive(value.receipt_assignment_epoch)&&positive(value.source_revision)&&/^KIOSK_(?:0[2-9]|10)$/.test(value.receipt_device_id)
    &&value.boundary_local==='09:45'&&value.channel_id==='employee-schedule-ownership'&&value.route==='employee-schedule.html?hub=employee'
    &&value.notification_key===`schedule-ownership:${value.service_date}:${value.receipt_employee_id}:09:45`
    &&/^\d{4}-\d{2}-\d{2}$/.test(value.service_date)
    &&['reservation_at','valid_until','source_valid_from','source_valid_until'].every(k=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value[k]));
  // Native Java owns calendar/digest/principal/interval and fresh claim checks.
  // This WebView projection must not become another clock or ingress owner.
}
export function createNativeProviderMirrorBridge(plugin){
  const attachment=value=>{if(!uuid(value))throw failure();return value;};
  const claim=value=>{if(!uuid(value))throw failure();return value;};
  const requireResult=(value,key)=>{if(!exact(value,[key])||value[key]!==true)throw failure();return true;};
  return Object.freeze({
    async subscribe(listener){
      if(typeof listener!=='function')throw failure();
      // Hints never authorize or select a record. Unknown/late/duplicate hints
      // only request a pull; no revision comparison can revive a claim.
      const handle=await plugin.addListener('providerPresentationAvailable',()=>listener());
      if(typeof handle?.remove!=='function')throw failure();return handle;
    },
    async attach(){
      const value=await plugin.providerMirrorAttach();
      if(!exact(value,['schema','attachment_id','runtime_incarnation','revision','state','audio_ready'])
        ||value.schema!=='custodial.provider-mirror-attachment.v1'||!uuid(value.attachment_id)||!uuid(value.runtime_incarnation)
        ||typeof value.revision!=='string'||!/^\d{1,19}$/.test(value.revision)||!['ATTACHED','SUSPENDED'].includes(value.state)||value.audio_ready!==false)throw failure();
      return Object.freeze({...value});
    },
    async stopped(id){return requireResult(await plugin.providerMirrorStopped({attachment_id:attachment(id)}),'stopped');},
    async next(id){
      const response=await plugin.providerClaimNext({attachment_id:attachment(id)});
      if(!exact(response,['claim']))throw failure();if(response.claim===null)return null;
      const value=response.claim;
      if(!exact(value,['claim_id','payload','play_audio','navigation_pending','historical'])||!uuid(value.claim_id)
        ||!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload)
        ||Object.keys(value.payload).length>42||new TextEncoder().encode(JSON.stringify(value.payload)).byteLength>3500
        ||Object.values(value.payload).some(item=>typeof item!=='string')
        ||!includedPayload(value.payload)
        ||typeof value.play_audio!=='boolean'||typeof value.navigation_pending!=='boolean'||typeof value.historical!=='boolean'
        ||(value.historical&&value.play_audio))throw failure();
      return Object.freeze({...value,payload:Object.freeze({...value.payload})});
    },
    async state(id,key){
      const value=await plugin.providerClaimState({attachment_id:attachment(id),claim_id:claim(key)});
      if(!exact(value,['current','freshness','retire_visual','stop_audio','navigation_pending'])
        ||!['CURRENT','HISTORICAL_EXPIRED','FRESHNESS_UNAVAILABLE','RETIRED'].includes(value.freshness)
        ||['current','retire_visual','stop_audio','navigation_pending'].some(field=>typeof value[field]!=='boolean')
        ||(value.freshness==='RETIRED'?value.current||!value.retire_visual||!value.stop_audio||value.navigation_pending:!value.current))throw failure();return Object.freeze({...value});
    },
    async apply(id,key,action){if(!actions.has(action))throw failure();return requireResult(await plugin.providerApplyAction({attachment_id:attachment(id),claim_id:claim(key),action}),'applied');},
    async retire(id,key){return requireResult(await plugin.providerRetireClaim({attachment_id:attachment(id),claim_id:claim(key)}),'retired');},
    async detach(id){return requireResult(await plugin.providerMirrorDetach({attachment_id:attachment(id)}),'detached');},
  });
}
