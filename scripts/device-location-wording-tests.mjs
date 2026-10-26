import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {locationCueWordingPins,normalizeCurrentLocationCueWording} from './location-cue-wording-source-boundary.mjs';

const source=fs.readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const oldText='`${lead}${locationName} needs attention now.`';
const newText='`${lead}${locationName} is overdue and needs attention now.`';
// Hash-bound c86f002 baseline; no dependency on historical Git objects in a
// fresh/shallow CI checkout. The reversed one-phrase delta must reproduce the
// complete exact original script before any comparison is accepted.
const baseline=source.replace(newText,oldText);
const digest=text=>createHash('sha256').update(text).digest('hex');
assert.equal(digest(baseline),'31429725ea97d9e4628c3dc0f28f9c2ff06fbae7c3b1531a548af2cdab367918');
function harness(text,native=false){
  const noop=()=>{},scope={employee:'synthetic-staff',epoch:7};
  const context={URL,console,window:{location:{href:'https://example.test/employee-hub.html?device=KIOSK_10'},addEventListener:noop,
    MemphisCustodialSecurity:{native},MemphisMobile:{principalIdentity:()=>scope,isScheduleReminderCurrent:(row,identity)=>identity===scope&&row.notification_key==='synthetic-overdue'},
    setTimeout:noop,setInterval:noop,clearTimeout:noop},document:{readyState:'loading',addEventListener:noop},
    localStorage:{getItem:()=>null,setItem:noop,removeItem:noop,length:0,key:()=>null},sessionStorage:{getItem:()=>null,setItem:noop,removeItem:noop},
    navigator:{vibrate:noop},Audio:class{},SpeechSynthesisUtterance:class{}};
  const injected=text.replace(/\n\}\)\(\);\s*$/,'\n window.__wording={locationStatusAlert,threadAlert,normalizePersonalizedSpeechText};\n})();\n');
  assert.notEqual(injected,text,'Test must use the real complete production script');
  vm.runInNewContext(injected,context,{timeout:1000});
  return context.window.__wording;
}
const current=harness(source),frozen=harness(baseline);
const row={status_code:'overdue',notification_key:'synthetic-overdue',service_date:'2026-10-08',location_code:'SYNTHETIC_LOCATION',
  location_name:'Synthetic Aviary',group_name:'Synthetic Bird Area',employee_name:'Synthetic Employee'};
const plain=x=>JSON.parse(JSON.stringify(x));

test('REV4.1-NOT-010: overdue speech names staff/location and explicitly says overdue and attention now',()=>{
  assert.equal(current.locationStatusAlert(row).speechText,'Hey Synthetic, Synthetic Aviary is overdue and needs attention now.');
});
test('Formatting is the only production change: all dispatch/authority/audio/replay/lifecycle source remains byte-identical',()=>{
  assert.equal(baseline.split(oldText).length,2);
  assert.equal(digest(source),digest(baseline.replace(oldText,newText)));
});
for(const [name,input] of [
  ['overdue',row],['due soon',{...row,status_code:'due_soon'}],['mixed-case overdue',{...row,status_code:'OVERDUE'}],
  ['location fallback',{...row,location_name:''}],['unknown employee',{...row,employee_name:''}],
  ['same group/location',{...row,group_name:row.location_name}],['missing notification key',{...row,notification_key:''}]
])test(`${name}: identity, body, route, Dismiss and logical episode unchanged`,()=>{
  const before=plain(frozen.locationStatusAlert(input)),after=plain(current.locationStatusAlert(input));
  const expected=before.speechText;
  delete before.speechText;delete after.speechText;
  assert.deepEqual(after,before);
  assert.equal(current.locationStatusAlert(input).speechText,input.status_code.toLowerCase()==='overdue'
    ?expected.replace(' needs attention now.',' is overdue and needs attention now.'):expected);
});
test('Native current-authority predicate remains principal/row-bound and unchanged',()=>{
  const a=harness(source,true).locationStatusAlert(row),b=harness(baseline,true).locationStatusAlert(row);
  assert.equal(a.currentAuthority(),true);assert.equal(b.currentAuthority(),true);
  assert.equal(harness(source,true).locationStatusAlert({...row,notification_key:'wrong'}).currentAuthority(),false);
  assert.equal(a.currentAuthority.toString(),b.currentAuthority.toString());
});
test('Presentation metadata uses the same explicit overdue wording without turning genuine messages into operational notices',()=>{
  const msg={thread_id:'synthetic-thread',thread_type:'direct',unread_count:1,last_message_id:'synthetic-message',last_sender_name:'Synthetic Manager',
    last_message_body:'Synthetic plain message',last_message_metadata_json:{presentation_demo:true,demo_alert_kind:'location_status',...row}};
  assert.equal(current.threadAlert(msg).speechText,'Hey Synthetic, Synthetic Aviary is overdue and needs attention now.');
  const genuine={...msg,last_message_metadata_json:{}};
  assert.deepEqual(plain(current.threadAlert(genuine)),plain(frozen.threadAlert(genuine)));
});
test('Name de-duplication retains the complete overdue message',()=>{
  assert.equal(current.normalizePersonalizedSpeechText('Hey Synthetic, Synthetic Employee, Aviary is overdue and needs attention now.','Synthetic Employee'),
    'Hey Synthetic, Aviary is overdue and needs attention now.');
});
test('Historical source comparisons accept only the exact one-phrase successor, never unknown edits',()=>{
  assert.equal(digest(source),locationCueWordingPins.current_sha256);
  assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',source),baseline);
  assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',baseline),baseline);
  for(const hostile of [source+'\n// unknown',source.slice(1),source.replace('is overdue and','is late and')])
    assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',hostile),hostile);
  assert.equal(normalizeCurrentLocationCueWording('unrelated.js',source),source);
});
