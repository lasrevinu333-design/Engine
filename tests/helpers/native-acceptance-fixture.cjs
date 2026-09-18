// Test-only native acceptance model. Only the Node route handler can capture receipts.
// Browser localStorage is never an authority input. This does not replace Android journal tests.
const assert = require('node:assert/strict');
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function identity(p) { return [p.p_device_id,p.p_client_session_id,p.p_client_completion_id].join('|'); }
function binding(p) {
  const answers={...(p.p_response_json||{})};delete answers.__custodial_offline_reconciliation_v1;
  return JSON.stringify(canonical({device:p.p_device_id,session:p.p_client_session_id,completion:p.p_client_completion_id,
    location:p.p_location_code,start:p.p_client_started_at,end:p.p_client_ended_at,finish:p.p_native_finish_scan_entry_id,
    answers,evidence:p.p_scan_evidence}));
}
async function installNativeAcceptanceFixture(context) {
  const records=new Map();const stats={captures:0,recoveries:0};
  await context.exposeFunction('__testReadAuthenticatedCompletion', input => {
    const p=input.completionPayload||{};const record=records.get(identity(p));
    if(!record)return {found:false};
    assert.equal(input.deviceId,p.p_device_id);
    assert.equal(binding(p),record.binding,'Frozen cleanup payload must match authenticated acceptance');
    stats.recoveries++;return {found:true,result:structuredClone(record.result)};
  });
  return {stats,capture(payload,result) {
    assert.equal(result.status,'closed');assert.equal(result.client_session_id,payload.p_client_session_id);
    assert.equal(result.client_completion_id,payload.p_client_completion_id);
    const key=identity(payload),value={binding:binding(payload),result:structuredClone(result)};
    if(records.has(key))assert.equal(records.get(key).binding,value.binding);else records.set(key,value);
    stats.captures++;
  }};
}
module.exports={installNativeAcceptanceFixture};
