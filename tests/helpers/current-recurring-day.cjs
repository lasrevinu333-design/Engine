// Synthetic current recurring delivery DATA. Not device-applied or SQL authority.
const {createHash}=require('node:crypto');const sha=x=>createHash('sha256').update(x).digest('hex');
const id=n=>'43000000-0000-4000-8000-'+String(n).padStart(12,'0');
function currentRecurringDay({deviceId,employeeId,credentialId,assignmentEpoch,employeeName}){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const date=['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:date,employee_id:employeeId,employee_name:employeeName,publication_id:id(1),projection_id:id(2),projection_status:'current',full_day:true,shift:{start:'08:00',end:'17:00'},raw_items:[{name:'Teton Restroom',location_name:'Teton Restroom',coverage_start:'08:00',coverage_end:'17:00'}]};
 const viewJsonText=JSON.stringify(view),target={schema:'static-weekly.recurring-application-target.v1',targetType:'SCHEDULE',operationId:id(3),publicationId:id(1),serviceDate:date,authorityRevision:1,deviceId:id(4),employeeId,credentialId,assignmentEpoch,projectionId:id(2),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(viewJsonText)};
 const targetText='{'+Object.keys(target).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(target[k])).join(', ')+'}';
 return {...view,device_id:deviceId,canonical_device_id:deviceId,canonical_device_pk:id(4),credential_id:credentialId,assignment_epoch:assignmentEpoch,schedule_delivery_mode:'RECURRING_SCHEDULE',recurring_delivery:{intentId:id(5),target,targetDigest:sha(targetText),applicationStatus:'DEVICE_REPORTED_APPLIED',view,viewJsonText,viewDigest:target.viewDigest},home_facts:{service_date:date,employee_id:employeeId,publication_id:id(1),projection_id:id(2),projection_status:'current',shift:view.shift,lunch:{start:'13:00',end:'14:00'}}};
}
module.exports={currentRecurringDay};
