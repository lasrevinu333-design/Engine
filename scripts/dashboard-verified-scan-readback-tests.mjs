import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function cleanDisplay('),html.indexOf('function renderTicketsTable('));
assert.ok(source.startsWith('function cleanDisplay(')&&source.includes('function renderLocationTable('));
const now=Date.parse('2026-09-25T18:00:00Z');
class Clock extends Date{static now(){return now;}}
const context={Date:Clock,Intl,dashboardState:{workAlerts:[{session_uuid:'verified-session',location_code:'AQUARIUM',device_identifier:'KIOSK_08',session_status:'active',result:'near',payload_json:{observed_at:'2026-09-25T17:59:30Z',authoritative:true,authority_scope:'surveyed_location_radius'}}]},normalizeStatus:row=>row.status_code,formatStatus:code=>code,formatServices:services=>Array.isArray(services)?services.join(', '):'—',escapeHtml:value=>String(value),escapeAttr:value=>String(value)};
vm.createContext(context);vm.runInContext(source,context);
const target={innerHTML:''};
const active={location_code:'AQUARIUM',location_name:'Aquarium Restrooms',status_code:'overdue',open_session_status:'active',open_session_uuid:'verified-session',open_session_device_identifier:'KIOSK_08',open_session_employee_name:'Karen Robinson',latest_employee_name:'Prior Cleaner',latest_completed_at_display:'Yesterday 9:00 AM Central',latest_checked_at:'2026-09-24T15:00:00Z',services_performed:['Full cleaning services']};
context.renderLocationTable(target,[active]);
assert.match(target.innerHTML,/status-overdue/,'overdue reminder remains truthful while work is active');
assert.match(target.innerHTML,/Cleaning in progress/);
assert.match(target.innerHTML,/Karen Robinson/);
assert.doesNotMatch(target.innerHTML,/Prior Cleaner/);
assert.match(target.innerHTML,/workSignal-near/,'exact same-session GPS survives an overdue reminder');
const filterSource=html.slice(html.indexOf('function rowMatchesFilter('),html.indexOf('function filteredRows('));
assert.ok(filterSource.startsWith('function rowMatchesFilter('));
vm.runInContext(filterSource,context);
assert.equal(context.rowMatchesFilter(active,'in_progress'),true,'Being Cleaned filter includes active work even while reminder remains overdue');
context.renderLocationTable(target,[{...active,open_session_status:null,open_session_uuid:null,latest_verified_check_at:'2026-09-25T17:45:00Z',latest_verified_checker_name:'Tammy Miller',latest_verified_check_session_uuid:'check-only-session'}]);
assert.doesNotMatch(target.innerHTML,/Cleaning in progress|workSignal-near|Karen Robinson/);
assert.match(target.innerHTML,/Check-only:/);
assert.match(target.innerHTML,/Tammy Miller/);
assert.match(target.innerHTML,/check-only-session/);
console.log('dashboard verified scan readback tests passed');
