import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function cleanDisplay('),html.indexOf('function renderTicketsTable('));
assert.ok(source.startsWith('function cleanDisplay(')&&source.includes('function renderLocationTable('));
const now=Date.parse('2026-09-25T18:00:00Z');
class Clock extends Date{static now(){return now;}}
const context={Date:Clock,Intl,dashboardState:{workAlerts:[{session_uuid:'verified-session',location_code:'AQUARIUM',device_identifier:'KIOSK_08',session_status:'active',result:'near',payload_json:{observed_at:'2026-09-25T17:59:30Z',authoritative:true,authority_scope:'surveyed_location_radius'}}]},normalizeStatus:row=>row.status_code,formatStatus:code=>code,formatServices:services=>Array.isArray(services)?services.join(', '):'—',escapeHtml:value=>String(value),escapeAttr:value=>String(value)};
vm.createContext(context);vm.runInContext(html.slice(html.indexOf('function normalizeStatus('),html.indexOf('function statusRank(')),context);vm.runInContext(source,context);
const target={innerHTML:''};
const active={location_code:'AQUARIUM',location_name:'Aquarium Restrooms',status_code:'overdue',open_session_status:'active',open_session_uuid:'verified-session',open_session_device_identifier:'KIOSK_08',open_session_employee_name:'Karen Robinson',latest_employee_name:'Prior Cleaner',latest_completed_at_display:'Yesterday 9:00 AM Central',latest_checked_at:'2026-09-24T15:00:00Z',services_performed:['Full cleaning services']};
context.renderLocationTable(target,[active]);
assert.match(target.innerHTML,/status-overdue/,'overdue reminder remains truthful while work is active');
assert.match(target.innerHTML,/Cleaning in progress/);
assert.match(target.innerHTML,/Karen Robinson/);
assert.match(target.innerHTML,/Cleaning now: Karen Robinson/);
assert.match(target.innerHTML,/Finished by: Prior Cleaner/,'prior completion actor remains explicitly separate');
assert.match(target.innerHTML,/workSignal-near/,'exact same-session GPS survives an overdue reminder');
const filterSource=html.slice(html.indexOf('function rowMatchesFilter('),html.indexOf('function filteredRows('));
assert.ok(filterSource.startsWith('function rowMatchesFilter('));
vm.runInContext(filterSource,context);
assert.equal(context.rowMatchesFilter(active,'in_progress'),true,'Being Cleaned filter includes active work even while reminder remains overdue');
context.renderLocationTable(target,[{...active,open_session_status:null,open_session_uuid:null,latest_verified_check_at:'2026-09-25T17:45:00Z',latest_verified_checker_name:'Tammy Miller',latest_verified_check_session_uuid:'check-only-session',latest_verified_check_completion_id:'check-only-completion'}]);
assert.doesNotMatch(target.innerHTML,/Cleaning in progress|workSignal-near|Karen Robinson/);
assert.match(target.innerHTML,/Check-only:/);
assert.match(target.innerHTML,/Tammy Miller/);
assert.doesNotMatch(target.innerHTML,/check-only-session|check-only-completion/,'internal receipt identities are not user labels');
assert.match(target.innerHTML,/status-overdue/,'check-only readback must not turn overdue work into a clean');
const verified={...active,open_session_status:null,open_session_uuid:null,latest_verified_check_at:'2026-09-25T17:45:00Z',latest_verified_checker_name:'Tammy Miller',latest_verified_check_session_uuid:'check-only-session',latest_verified_check_completion_id:'check-only-completion'};
for(const patch of [{latest_verified_check_at:'invalid'},{latest_verified_checker_name:''},{latest_verified_check_session_uuid:null},{latest_verified_check_completion_id:null}]){
 context.renderLocationTable(target,[{...verified,...patch}]);assert.doesNotMatch(target.innerHTML,/Check-only:/);
}
context.renderLocationTable(target,[{...verified,status_code:'not_cleaned'}]);
assert.match(target.innerHTML,/<td data-label="Location">[^]*Check-only:[^]*?<\/td><td data-label="Status">/,'check-only stays in the visible location cell for compact not-cleaned rows');
assert.match(target.innerHTML,/status-not_cleaned/);
for(const patch of [{open_session_status:'pending_submit'},{open_session_uuid:null},{open_session_status:null}]){
 const row={...active,...patch};context.renderLocationTable(target,[row]);assert.doesNotMatch(target.innerHTML,/Cleaning now:|Cleaning in progress|workSignal-near/);assert.equal(context.rowMatchesFilter(row,'in_progress'),false);
}
const countSource=html.slice(html.indexOf('function countBy('),html.indexOf('function formatIsoTime('));vm.runInContext(countSource,context);
assert.equal(context.countBy([active],'in_progress'),1);assert.equal(context.countBy([active],'overdue'),1);
const pending={...active,status_code:'in_progress',open_session_status:'pending_submit'};
assert.equal(context.normalizeStatus(pending),'pending_submit');assert.equal(context.rowMatchesFilter(pending,'in_progress'),false);assert.equal(context.countBy([pending],'in_progress'),0);
for(const row of [{},{status_code:'unsupported'},{status_color:'unsupported'}])assert.equal(context.normalizeStatus(row),'unknown');
vm.runInContext(html.slice(html.indexOf('function formatStatus('),html.indexOf('function safe(')),context);
context.renderLocationTable(target,[pending]);assert.match(target.innerHTML,/Completion pending/);assert.doesNotMatch(target.innerHTML,/CLEANING IN PROGRESS|Cleaning now:/);
context.renderLocationTable(target,[{...pending,status_code:'overdue'}]);assert.match(target.innerHTML,/status-overdue/);assert.match(target.innerHTML,/Completion pending/);
context.renderLocationTable(target,[{}]);assert.match(target.innerHTML,/Status unavailable/);assert.doesNotMatch(target.innerHTML,/NOT CLEANED|OKAY/);
// Run the shipping escaping functions for untrusted actor/location/check text.
vm.runInContext(html.slice(html.indexOf('function escapeHtml('),html.indexOf('  </script>',html.indexOf('function escapeHtml('))),context);
context.renderLocationTable(target,[{...verified,location_name:'<img src=x onerror=bad>',latest_verified_checker_name:'<script>bad</script>',latest_employee_name:'<b>prior</b>'}]);
assert.doesNotMatch(target.innerHTML,/<img|<script|<b>/);assert.match(target.innerHTML,/&lt;script&gt;/);
context.ticketActions={status:()=>null};
vm.runInContext(html.slice(html.indexOf('function renderTicketsTable('),html.indexOf('function handleFilterClick(')),context);
context.renderTicketsTable(target,[{ticket_id:'synthetic-note',location_name:'Fixture',maintenance_issue:'Other issue: <script>untrusted saved note</script>'}]);
assert.doesNotMatch(target.innerHTML,/<script>/);assert.match(target.innerHTML,/Other issue: &lt;script&gt;untrusted saved note/);
console.log('dashboard verified scan readback tests passed: active+overdue actor/filter/count, separate verified check, absent/malformed evidence, escaped saved issue notes');
