import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {locationCueWordingPins,normalizeCurrentLocationCueWording} from './location-cue-wording-source-boundary.mjs';

const source=fs.readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const oldText='`${lead}${locationName} needs attention now.`';
const newText='`${lead}${locationName} is overdue and needs attention now.`';
// Exact integrated Root source context. This synthetic wording inverse keeps
// current authority/audio changes intact; it is not the historical c86f002 file.
const baseline=source.replace(newText,oldText);
const digest=text=>createHash('sha256').update(text).digest('hex');
assert.equal(digest(baseline),'8d03a64050172fe6747d136c6077718cb352d500e9e3cb7cb8778a35e08b0155');
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
test('Wording inverse leaves all current dispatch/authority/audio/replay/lifecycle bytes intact',()=>{
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
  assert.equal(digest(source),'9046b9ee1857247c5427602dcd779bb5c37ead5290344d10d42353a55aca3313');
  assert.equal(locationCueWordingPins.current_sha256,'c6afb4ca9e14d8fe223b271319041b4af0e064adf3632098ba9cf69d74972d08','Historical normalizer authority remains unchanged');
  assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',source),source);
  assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',baseline),baseline);
  for(const hostile of [source+'\n// unknown',source.slice(1),source.replace('is overdue and','is late and')])
    assert.equal(normalizeCurrentLocationCueWording('memphis-device-reminders.js',hostile),hostile);
  assert.equal(normalizeCurrentLocationCueWording('unrelated.js',source),source);
});
