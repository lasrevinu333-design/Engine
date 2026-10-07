// Finite native capability facade. No payload/principal/time/received/sent setter.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const failure=()=>Object.assign(new Error('The native notification attachment is unavailable.'),{code:'custodial_provider_mirror_response_invalid'});
const actions=new Set(['displayed','opened','acknowledged','dismissed','audio_started','audio_completed','audio_stopped','navigation_completed']);
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
        ||!['custodial.native-provider-payload.v1','custodial.native-location-payload.v2'].includes(value.payload.schema)
        ||!['employee_lunch_coverage','employee_location_status'].includes(value.payload.kind)
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
