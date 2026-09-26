import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const functions=slice('function workPlainPosition(', 'function gpsEvaluatorUnavailable(');
let rpcCalls=0,queueCalls=0;
const sandbox={Date,Number,crypto:{randomUUID:()=> 'test-uuid'},currentDeviceId:'KIOSK_08',workPositionSession:{client_session_id:'session-1',location_code:'NOCX',device_id:'KIOSK_08'},rpcOne:async()=>{rpcCalls++;return {result:'near'};},enqueueAction:async()=>{queueCalls++;},refreshDebugQueueCounts:async()=>{}};
vm.createContext(sandbox);vm.runInContext(functions,sandbox);
const absent=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5}});
assert.equal(absent.timestamp,null,'missing capture time stays missing');
const zero=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5},timestamp:0});
assert.equal(zero.timestamp,null,'zero timestamp cannot become arrival time');
const valid=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5},timestamp:Date.parse('2026-09-25T18:00:00Z')});
assert.equal(valid.timestamp,'2026-09-25T18:00:00.000Z');
const missingResult=await sandbox.evaluateWorkPositionMaybeQueued(absent,'initial','session-1');
assert.equal(missingResult.result,'gps_timestamp_unavailable');
assert.equal(missingResult.authoritative,false);
assert.equal(rpcCalls,0,'no RPC with invented capture time');
assert.equal(queueCalls,0,'no replay queue with invented capture time');
for(const status of ['near','away']){
 const unproven=sandbox.workPositionServerPresentation({result:status,authoritative:true,coordinate_source:'group_center'},null);
 assert.equal(unproven.result,'location_uncalibrated');
 assert.equal(unproven.badgeKind,'warn');
 const exact=sandbox.workPositionServerPresentation({result:status,authoritative:true,authority_scope:'surveyed_location_radius'},null);
 assert.equal(exact.result,status);
 assert.equal(exact.badgeKind,status==='near'?'ok':'alert');
}
assert.equal(sandbox.workPositionServerPresentation(null,{result:'inside_scanned_location',authoritative:true}).badgeKind,'warn','local fallback is never server verification');
await sandbox.evaluateWorkPositionMaybeQueued(valid,'initial','session-1');
assert.equal(rpcCalls,1,'valid capture time reaches RPC');
console.log('work position capture-time and exact authority boundary passed');
