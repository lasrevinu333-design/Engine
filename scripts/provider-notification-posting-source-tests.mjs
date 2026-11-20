import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {notificationPostingPins,withoutNotificationPostingRepair} from './provider-notification-posting-source-boundary.mjs';
import {withoutProviderMirror} from './provider-mirror-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');let checks=0;
assert.equal(notificationPostingPins.schema,'custodial.notification-posting-byte-deltas.v1');
assert.deepEqual(notificationPostingPins.files.map(row=>row.name),['NativeProviderDisplayDriver.java','NativeProviderRuntimeOwner.java']);checks+=2;
for(const row of notificationPostingPins.files){
 const current=readFileSync(row.path,'utf8'),before=withoutNotificationPostingRepair(row.path,current);
 assert.equal(sha(current),row.after_sha256);assert.equal(sha(before),row.before_sha256);checks+=2;
 assert.equal(withoutNotificationPostingRepair(row.name,before),before);checks++;
 assert.throws(()=>withoutNotificationPostingRepair(row.name,current+'\n// unregistered change'));checks++;
 for(const hunk of row.hunks){
  if(!hunk.after.length)continue;
  const start=current.indexOf(hunk.after.join('\n'));assert.ok(start>=0);
  const mutant=current.slice(0,start)+current.slice(start).replace(hunk.after.join('\n'),hunk.after.join('\n')+'\n// altered repair');
  assert.throws(()=>withoutNotificationPostingRepair(row.name,mutant));checks++;
 }
 // Removing the marker cannot sneak altered code past the original mirror pin.
 if(row.name==='NativeProviderRuntimeOwner.java'){
  assert.throws(()=>withoutProviderMirror(row.path,current.replace(row.marker,row.marker.replace('unconfirmedDisplayLocked','changedDisplayLocked'))));checks++;
 }
}
console.log(JSON.stringify({status:'NOTIFICATION_POSTING_EXACT_INVERSE_PASS',checks,scope:'source comparison only; original source/release pins retained',releaseAdmission:false,hardware:false}));
