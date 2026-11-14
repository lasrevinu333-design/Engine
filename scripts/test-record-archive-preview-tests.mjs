import assert from 'node:assert/strict';
import {prepareTestRecordArchivePreview as preview}from'../manager-test-record-archive-preview.mjs';
const id=n=>`ba000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const selection={session_id:id(1),session_uuid:'synthetic-original'};
const truth={...selection,status:'completed',correction_id:null,current_started_at:'2026-11-14T12:00:00Z',current_ended_at:'2026-11-14T12:05:00Z',current_employee_id:id(2),current_location_id:id(3),current_device_id:id(4),current_employee_name:'Synthetic',current_location_name:'Fixture',raw_private_mail:'MUST_NOT_COPY'};
let checks=0;const run=async patch=>preview({selections:[selection],reason:'Explicit synthetic test record',readTruth:async()=>({...truth}),assertCurrent(){},...patch});
const packet=await run();assert.equal(packet.state,'PREVIEW_ONLY');assert.equal(packet.archive_ready,false);assert.equal(packet.records.length,1);assert.equal(packet.records[0].raw_private_mail,undefined);assert.ok(Object.isFrozen(packet)&&Object.isFrozen(packet.records[0]));assert.ok(packet.preservation_required.includes('native history and queued work'));checks++;
for(const selections of [[],[selection,selection],[{...selection,session_id:'not-id'}],[{...selection,extra:true}]]){await assert.rejects(run({selections}));checks++;}
for(const change of [{status:'active'},{session_uuid:'successor'},{current_employee_id:{}},{current_ended_at:'2026-11-14T11:00:00Z'},{correction_id:'invalid'}]){await assert.rejects(run({readTruth:async()=>({...truth,...change})}));checks++;}
let calls=0;await assert.rejects(run({readTruth:async()=>({...truth,correction_id:++calls===1?null:id(5)})}),/changed/);checks++;
let valid=true;await assert.rejects(run({assertCurrent(){if(!valid)throw Error('withdrawn');},readTruth:async()=>{valid=false;return truth;}}),/withdrawn/);checks++;
const mutable={...selection};const stable=await run({selections:[mutable],readTruth:async()=>{mutable.session_uuid='changed-by-caller';return truth;}});assert.equal(stable.records[0].session_uuid,selection.session_uuid);checks++;
await assert.rejects(run({reason:' '}));checks++;
console.log(JSON.stringify({status:'PASS',checks,actual_writes:0,real_records_selected:0,archive_execution:false,scope:'read-only exact-record preview contract with synthetic data'}));
