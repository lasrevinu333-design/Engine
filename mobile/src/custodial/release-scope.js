// October2 complete-system UI inclusion is not provider/runtime admission.
// Never enable a feature from a URL,
// localStorage, remote payload or an unreviewed environment override.
export const CUSTODIAL_RELEASE_CAPABILITIES=Object.freeze({
  cleaning:true,schedule:true,messenger:true,events:true,feedback:true,
});
const routes=Object.freeze({
  'messages.html':'messenger','messages-chatscope.html':'messenger','thread.html':'messenger',
  'employee-events.html':'events','events.html':'events',
  'employee-feedback.html':'feedback','system-feedback.html':'feedback',
});
export function deferredCustodialFeature(path){
  const feature=routes[path];return feature&&CUSTODIAL_RELEASE_CAPABILITIES[feature]!==true?feature:null;
}
export function custodialNotificationEnabled(data){
  if(!data||typeof data!=='object'||Array.isArray(data))return false;
  // Provider admission is separate from UI scope. Unqualified Event/Message
  // protocols remain blocked here until their exact authority is integrated.
  // Only exact established protocols may create a side effect. Missing/malformed
  // kind is not a new protocol, and conflicting aliases cannot smuggle an
  // excluded feature through an otherwise valid schedule notification.
  const types={employee_lunch_coverage:'lunch_coverage',employee_location_status:'location_status'};
  if(!Object.hasOwn(types,data.kind))return false;
  const type=types[data.kind];
  if(['type','notification_type'].some(key=>data[key]!==undefined&&data[key]!==type))return false;
  if(data.route!==undefined&&(typeof data.route!=='string'||!/^employee-schedule\.html(?:\?[^#]*)?$/.test(data.route)))return false;
  return CUSTODIAL_RELEASE_CAPABILITIES.schedule===true;
}
