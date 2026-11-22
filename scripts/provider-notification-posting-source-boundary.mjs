import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeNotificationPresentationForComparison} from './current-gps-qualification-source-boundary.mjs';
export const notificationPostingPins=JSON.parse(readFileSync(new URL('./fixtures/provider-notification-posting-byte-deltas.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
// Legacy contracts still compare their entire original source. Only this exact
// independently testable repair is reversed; no hash or historical pin changes.
// This comparison does not grant a clock/audio profile or release admission.
export function withoutNotificationPostingRepair(name,source){
 source=normalizeNotificationPresentationForComparison(name,source);
 const row=notificationPostingPins.files.find(row=>row.name===name||row.path===name);
 if(!row||sha(source)===row.before_sha256)return source;
 if(sha(source)!==row.after_sha256){
  assert.ok(!source.includes(row.marker),'unregistered notification posting source: '+name);
  return source; // Existing downstream whole-source pins still refuse unknown bytes.
 }
 const lines=source.split('\n');
 for(const hunk of [...row.hunks].reverse()){
  assert.deepEqual(lines.slice(hunk.start,hunk.start+hunk.after.length),hunk.after);
  lines.splice(hunk.start,hunk.after.length,...hunk.before);
 }
 const before=lines.join('\n');assert.equal(sha(before),row.before_sha256,'entire original source outside posting repair');return before;
}
