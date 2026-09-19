import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const dist=resolve(root,'build/batch-0b-shell-browser/custodial');
const read=(path)=>readFileSync(resolve(dist,path),'utf8');
const bridge=read('memphis-custodial-bridge.js');
for(const token of [
  'memphis:active-gps-state',
  'evaluate_location_proximity_v2',
  'network_reconnected',
  'app_resume',
  'gps_unavailable',
]) assert.ok(bridge.includes(token),`compiled bridge missing active GPS contract: ${token}`);

const pages=['index.html','employee-schedule.html','messages.html','employee-events.html','employee-feedback.html'];
for(const page of pages){
  const html=read(page);
  assert.ok(html.includes('memphis-custodial-bridge.js'),`${page} lacks shared Custodial bridge`);
  assert.ok(html.includes('memphis-scan-sync.js'),`${page} lacks durable sync worker`);
}
const scan=readFileSync(resolve(root,'index.html'),'utf8');
assert.match(scan,/activeGpsLifecycle===true/);
assert.match(scan,/reconcileActiveGps\?\.\('scan_timer'\)/);
assert.match(scan,/reconcileActiveGps\?\.\('finish_captured'\)/);
console.log(JSON.stringify({scope:'Generated browser-test Custodial pages and bridge; not signed APK or physical GPS',pages_checked:pages.length,passed:true},null,2));
