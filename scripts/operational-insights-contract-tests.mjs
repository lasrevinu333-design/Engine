import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(path, 'utf8');
const page = read('operational-insights.html');
const css = read('operational-insights.css');
const client = read('operational-insights.js');
const nativeAuth = read('operational-insights-native-auth.js');
const hub = read('start_page1.html');
const scanPage = read('index.html');
const hubClient = read('ops-hub.js');
const managerPage = read('mobile/src/manager/index.html');
const managerClient = read('mobile/src/manager/app.js');
const custodialPage = read('mobile/src/custodial/index.html');
const custodialClient = read('mobile/src/custodial/app.js');
const custodialBridge = read('mobile/src/custodial/bridge.js');
const custodialScanTarget = read('mobile/src/custodial/scan-target.ts');
const mobileBuild = read('mobile/scripts/build.mjs');

if (process.argv.includes('--product-only')) {
  const fixture = async (data, {withdrawDuringRead=false}={}) => {
    const nodes=new Map(),options=[],requests=[];
    const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,listeners:new Map(),classList:{remove(){},toggle(){}},addEventListener(type,fn){this.listeners.set(type,fn);},focus(){}});return nodes.get(id);};
    let current={role:'ops_manager',token:'synthetic-read-token',device_id:'fixture-device',expires_at:'2099-01-01T00:00:00Z',read_only:true,permissions:{owner:false}};
    let readEnvelope;
    const window={MemphisAuth:{requireOpsManagerSession:async opts=>{options.push(opts);return current;},readSession:()=>current,isOpsManager:s=>s?.role==='ops_manager'&&Boolean(s.token),getDeviceId:()=>current?.device_id},MemphisCompletionEvidence:{create:opts=>{readEnvelope=opts.readEnvelope;return {clear(){}};},canReadRow:()=>false},addEventListener(){}};
    const fetch=async (url,opts)=>{requests.push({url,opts});const path=new URL(url).pathname;return {ok:true,json:async()=>{const value={ok:true,data:data[path]??null};if(withdrawDuringRead)current=null;return value;}};};
    vm.runInNewContext(client,{window,document:{getElementById:node,querySelectorAll:()=>[]},fetch,URL,console,Date});
    await new Promise(resolve=>setImmediate(resolve));
    return {nodes,options,requests,readEnvelope,withdraw:()=>{current=null;}};
  };
  const nullRow={employee_name:'<script>bad()</script>',location_name:'Fixture',cleaning_count:null,inspection_count:null,maintenance_ticket_count:null,average_duration_minutes:null,median_duration_minutes:null,duration_delta_from_location_minutes:null,average_inspection_score:' ',latest_cleaning_at:null};
  const f=await fixture({'/analytics-api/cleaning-performance':[nullRow],'/analytics-api/session-facts':[{session_id:'fixture',duration_minutes:null,started_at:null,ended_at:null,inspection_count:null,latest_inspection_score:null,open_maintenance_ticket_count:null}],'/analytics-api/ticket-trends':[{total_ticket_count:null,open_ticket_count:null,first_reported_at:null,latest_reported_at:null}],'/analytics-api/inspections':[{passed:null,overall_score:null,inspected_at:null}]});
  assert.ok(f.options.length===5&&f.options.every(opts=>opts.accessLevel==='read_only'));
  assert.ok(f.requests.every(({opts})=>opts.method==='GET'&&opts.headers.Authorization==='Bearer synthetic-read-token'));
  assert.equal(f.nodes.get('summary-cleanings').textContent,'—');assert.equal(f.nodes.get('summary-score').textContent,'—');
  const shown=['performance-list','cleanings-list','tickets-list','inspections-list'].map(id=>f.nodes.get(id).innerHTML).join('\n');
  assert.doesNotMatch(shown,/Jan 1|1970|0 min|0 total cleanings|0 inspections|0 total|0 open|<script>/);
  assert.match(shown,/&lt;script&gt;bad/);assert.match(shown,/Inspection score unavailable/);assert.match(shown,/Outcome unavailable/);
  const z=await fixture({'/analytics-api/cleaning-performance':[{cleaning_count:0,inspection_count:0}],'/analytics-api/session-facts':[{inspection_count:0,duration_minutes:0,started_at:'2026-10-11T01:00:00Z',ended_at:'2026-10-11T01:00:00Z',open_maintenance_ticket_count:0}],'/analytics-api/ticket-trends':[],'/analytics-api/inspections':[]});
  assert.equal(z.nodes.get('summary-cleanings').textContent,'0');assert.equal(z.nodes.get('summary-score').textContent,'Not yet');assert.equal(z.nodes.get('summary-hotspots').textContent,'0');
  assert.match(z.nodes.get('cleanings-list').innerHTML,/0 min/);assert.match(z.nodes.get('cleanings-list').innerHTML,/Oct 10/);
  const absent=await fixture({});assert.equal(absent.nodes.get('summary-cleanings').textContent,'—');assert.equal(absent.nodes.get('summary-hotspots').textContent,'—');assert.match(absent.nodes.get('performance-list').innerHTML,/unavailable/);assert.doesNotMatch(absent.nodes.get('performance-list').innerHTML,/No employee/);
  const withdrawn=await fixture({'/analytics-api/cleaning-performance':[{...nullRow,employee_name:'LATE_PRIVATE_ROW'}]}, {withdrawDuringRead:true});assert.doesNotMatch(withdrawn.nodes.get('performance-list').innerHTML,/LATE_PRIVATE_ROW/);assert.match(withdrawn.nodes.get('global-status').textContent,/session changed/);
  f.withdraw();await assert.rejects(f.readEnvelope('/analytics-api/session-facts/exact'),/access is required/);
  console.log(JSON.stringify({suite:'operational-insights actual script product cases',passed:5,failed:0,old_contract_replayed:false,cases:['read-only signed request + nullable rendering','genuine zero + Central dates','unavailable feed is not empty zero','late changed session denies data','withdrawn exact-record read denied']}));
} else {
assert.equal((page.match(/data-mz-back(?:\s|=|>)/g) || []).length, 1, 'Insights must have one canonical Back control');
assert.match(page, /class="uxButton canonicalBack" data-mz-back[^>]*>Back</);
assert.match(css, /\.canonicalBack\{width:116px;min-width:116px;height:52px;min-height:52px/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /native-system-guard/);
assert.match(css, /prefers-reduced-motion/);
for (const tab of ['performance', 'cleanings', 'tickets', 'inspections']) assert.match(page, new RegExp(`data-tab="${tab}"`));
for (const endpoint of ['/analytics-api/cleaning-performance', '/analytics-api/session-facts', '/analytics-api/ticket-trends', '/analytics-api/inspections']) assert.match(client, new RegExp(endpoint.replaceAll('/', '\\/')));
assert.doesNotMatch(client, /Idempotency-Key|mz_inspection_draft:|inspectionPayload|inspectionEligibilityState/);
assert.doesNotMatch(client, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|localStorage\.(?:setItem|removeItem|clear)/);
assert.match(page, /retired/i);
assert.match(client, /failed to fetch\|network\|load failed\|internet/i);
assert.match(client, /sessions sampled · no quota/);
assert.doesNotMatch(client, /operating target|below the .*%/i);
assert.doesNotMatch(page, /device[_ -]?id/i, 'Insights must not expose device identifiers in the visible UI');
assert.match(nativeAuth, /startsWith\('\/analytics-api\/'\)/);
assert.match(nativeAuth, /mobile\.authHeaders/);
assert.match(nativeAuth, /401 \|\| response\.status === 403/);

assert.equal((hub.match(/href="\.\/messages\.html/g) || []).length, 2, 'Hub body and fixed nav should point to one Messenger client');
assert.doesNotMatch(hub, /ChatScope Messenger|messages-chatscope\.html|chatscope-link/i);
assert.match(hub, /insights/i);
assert.match(hub, /Phone Assignments/);
assert.match(hub, /Notifications/);
assert.doesNotMatch(hubClient, /isAnnieOrigin|preserveAnnieOrigin|ANNIE_RETURN_URL/);
assert.match(hubClient, /hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hubClient, /Named manager enrollment required/);

assert.match(managerPage, /id="insights-tile"/);
assert.match(managerPage, /Correct record/);
assert.match(managerClient, /insights:\s*document\.getElementById\('insights-tile'\)/);
assert.match(managerClient, /els\.insights\.hidden = !custodialAdmin/);

assert.match(custodialPage, /Memphis Zoo Custodial/);
for (const label of ['My Schedule', 'Memphis Messenger', 'Upcoming Events', 'Program Feedback']) assert.match(custodialPage, new RegExp(`>${label}<`));
assert.doesNotMatch(custodialPage, /Assigned Areas|bottomNav|navLabel/);
assert.doesNotMatch(custodialPage, />\s*Scanner\s*</i);
assert.doesNotMatch(custodialClient, /CapacitorBarcodeScanner|manual-qr-fallback/);
assert.match(custodialBridge, /App\.addListener\('appUrlOpen'/);
assert.match(custodialBridge, /attestNativeCustodialScanIntent\(url\)[\s\S]*nativeScanTargetFromAttestation\(attestation, id\)/);
assert.match(custodialBridge, /function nativeScanTargetFromAttestation\(attestation, id\)[\s\S]*resolveCustodialScanTarget\([\s\S]*attestation\?\.url,[\s\S]*attestation\?\.entry_id/);
assert.match(custodialBridge, /App\.getLaunchUrl\(\)[\s\S]*handleNativeScanUrl\(launch\.url\)/);
assert.doesNotMatch(custodialClient, /scanTarget\(scanned|scanTarget\(launch\.url/);
assert.match(custodialBridge, /await bridgeReady/);
assert.match(custodialBridge, /status\.state !== 'enrolled'/);
assert.match(custodialScanTarget, /memphiszoo-custodial:/);
assert.match(custodialScanTarget, /entrySource: 'native-nfc'/);
assert.match(custodialScanTarget, /target\.searchParams\.set\('source', entrySource\)/);
assert.match(scanPage, /entry_source:entrySource/);
assert.match(mobileBuild, /injectNativeScripts\('memphis-custodial-bridge\.js'\)/);
assert.doesNotMatch(custodialClient, /current assignment|next assignment/i);

console.log('OPERATIONAL_INSIGHTS_AND_V17_INTENT_CONTRACT_PASS');
}
