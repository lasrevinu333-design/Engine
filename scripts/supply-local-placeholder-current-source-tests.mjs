import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {custodialInitialReleaseHome} from '../mobile/scripts/custodial-initial-release-pages.mjs';
import {assertCustodialNavigationAssets} from '../mobile/scripts/custodial-navigation-assets.mjs';
import {discoverRuntimeFiles,verifyFrontendReleaseManifest} from './refresh-frontend-release-manifest.mjs';

// Maintained CURRENT Source-only Supplies contract. The original 8-group,
// explicit-BASE historical contract stays byte-literal in
// supply-local-placeholder-source-tests.mjs; no preimage is fabricated here.
// No app, device, native, private data, supplier or production authority.
assert.deepEqual(process.argv.slice(2),[],'Current Supplies entry takes no arguments; historical BASE uses the original entry');
const F=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const read=file=>fs.readFileSync(path.join(F,file),'utf8');
const sha=body=>createHash('sha256').update(body).digest('hex');
const policyPath='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNavigationPolicy.java';
const unchangedControls={
  "mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNavigationPolicy.java": "02104be6417bd08218031ebbb0e9694f5d536ebe5c200d3f55a7711c77e64ca2",
  "mobile/src/custodial/bridge.js": "d629e4f9405e2d16a8693c059903c35918a4087838f755a846d90f33cfa76c2e",
  "memphis-ui.js": "cf29ef7e8be9bc4c42b98cff5bbc0556b96264f07cbf204397ae9105c12af5ca",
  "mobile/scripts/custodial-navigation-assets.mjs": "6b3775b72585ce726d855750e32f3d0e3d08e99ce9f8ba25b6fbd17c95741af2"
};
const compatibilityFiles=[
  "assets/supply_request_icon.svg",
  "Background1_optimized.webp",
  "Event_Icon_ui.webp",
  "Header_ui.webp",
  "Zoo_Logo_ui.webp",
  "chatscope-messenger.css",
  "chatscope-messenger.js",
  "chatscope-mobile-overrides.css",
  "dashboard-bg_optimized.webp",
  "dashboard_tiger_icon.svg",
  "employee-feedback.html",
  "employee-hub.html",
  "employee-schedule.html",
  "events.html",
  "events-view.js",
  "events-view.css",
  "operations-dashboard-data.js",
  "operations-dashboard.css",
  "manager-ux.css",
  "memphis-alert-tone.wav",
  "memphis-completion-taxonomy.js",
  "memphis-recurring-schedule-target.js",
  "memphis-device-identity.js",
  "memphis-device-reminders.js",
  "memphis-gps.js",
  "memphis-scan-sync.js",
  "memphis-ui.css",
  "memphis-ui.js",
  "memphis_avatar_ui.webp",
  "messages-chatscope.html",
  "messages.html",
  "scheduler_icon_ui.webp",
  "supply-coming-soon.html",
  "system-feedback.html",
  "thread.html"
];
const html=read('supply-coming-soon.html'),icon=read('assets/supply_request_icon.svg'),home=read('mobile/src/custodial/index.html');
const beforeControls=new Map(Object.keys(unchangedControls).map(file=>[file,sha(fs.readFileSync(path.join(F,file)))]));
let groups=0;
const check=(name,body)=>{body();groups++;console.log('PASS '+name);};
check('CURRENT_LOCAL_PLACEHOLDER_HAS_NO_REQUEST_AUTH_STORAGE_OR_NETWORK_WORKFLOW',()=>{
 assert.match(html,/<h1>Supplies are coming soon<\/h1>/);assert.match(html,/destination has not been connected/);
 assert.match(html,/does not submit requests, place orders, change inventory, or contact a vendor/);
 assert.doesNotMatch(html,/<(?:script|form|iframe|object|embed|input|textarea|select)\b|\bon[a-z]+\s*=|\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket)\b/i);
 assert.match(html,/connect-src 'none'; form-action 'none'/);assert.match(html,/base-uri 'none'/);
 assert.deepEqual([...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(v=>v[1]),['./assets/supply_request_icon.svg','./assets/supply_request_icon.svg','./index.html']);
 assert.match(html,/url\('\.\/Zoo_Logo_ui.webp'\)/);assert.doesNotMatch(html,/\b(?:https?:|mailto:|intent:|javascript:|\/\/)/i);
});
check('CURRENT_ICON_PAGE_AND_HOME_RETURN_STAY_LOCAL_TEXT_ONLY',()=>{
 assert.match(icon,/<svg[^>]*viewBox="0 0 128 128"/);assert.doesNotMatch(icon,/<(?:script|foreignObject|image|use)\b|\b(?:href|on\w+)\s*=/i);
 assert.match(html,/<a class="back" href="\.\/index\.html" aria-label="Back to Custodial Home">Back to Home<\/a>/);
 assert.match(html,/body data-memphis-context="employee"/);assert.match(html,/min-height:48px/);
 assert.doesNotMatch(html,/Back to supply request draft|supply-request-core|supply-request-ui|supply-catalog|manager-supply-requests/);
});
check('CURRENT_HOME_HAS_EXACT_FIVE_ENTRIES_AND_FAILS_CLOSED_ON_NAVIGATION_REPLACEMENT',()=>{
 const entries=[...home.matchAll(/<a class="homeButton" href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(entries,['./messages.html?hub=employee','./employee-schedule.html?hub=employee','./events.html?hub=employee','./employee-feedback.html?hub=employee','./supply-coming-soon.html']);
 assert.equal(custodialInitialReleaseHome(home),home);
 for(const href of entries)assert.throws(()=>custodialInitialReleaseHome(home.replace(`href="${href}"`,'href="https://elsewhere.invalid/"')));
 assert.throws(()=>custodialInitialReleaseHome(home.replace('class="memphisHome"','class="not-direct-Memphis"')));
 const tile=home.match(/^[^\n]*<a class="homeButton" href="\.\/supply-coming-soon\.html"[^\n]*\n/m)?.[0];assert(tile);
 // Negative current fixtures are not asserted to be historical before-images.
 assert.throws(()=>custodialInitialReleaseHome(home.replace(tile,'')),/four operational entries and local Supplies placeholder/);
 assert.throws(()=>custodialInitialReleaseHome(home.replace(tile,tile+tile)));
});
check('CURRENT_BUILD_SELECTS_EXACT35_COMPATIBILITY_FILES_AND_NO_SUPPLY_WORKFLOW',()=>{
 const build=read('mobile/scripts/build.mjs'),block=build.slice(build.indexOf('const custodialCompatibilityFiles'),build.indexOf('const custodialProhibitedFiles'));
 const files=[...block.matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.deepEqual(files,compatibilityFiles);assert.equal(new Set(files).size,35);
 assert.match(build,/runtimeFiles\.filter\(\(runtimePath\) => custodialCompatibilityFiles\.has\(runtimePath\)\)/);
 for(const file of files)assert(fs.lstatSync(path.join(F,file)).isFile(),file+' selected Source file exists');
 for(const file of ['supply-request-ui.mjs','supply-request-core.mjs','supply-catalog.mjs','manager-supply-requests.mjs'])assert.equal(files.includes(file),false);
});
check('CURRENT_NATIVE_LOCAL_PAGE_AND_ALIAS_POLICY_RETAINS_ALL_ORIGINAL_FENCES',()=>{
 const policy=read(policyPath),match=policy.match(/PAGES\s*=\s*new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/);assert(match);
 const pages=[...match[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);assert.equal(pages.filter(p=>p==='/supply-coming-soon.html').length,1);
 // Source-level expected packaged aliases use the selected employee Source,
 // not a fabricated APK inventory or real navigation/authority observation.
 const aliases={'app-shell.html':'mobile/app-shell.html','scan.html':'index.html','index.html':'mobile/src/custodial/index.html','start_page1.html':'mobile/src/custodial/index.html','employee-hub.html':'mobile/src/custodial/index.html','system-feedback.html':'employee-feedback.html'};
 const hashes=new Map(pages.map(p=>{const file=p==='/'?'index.html':p.slice(1);return[file,sha(fs.readFileSync(path.join(F,aliases[file]||file)))];}));
 assertCustodialNavigationAssets(hashes,policy);hashes.delete('supply-coming-soon.html');assert.throws(()=>assertCustodialNavigationAssets(hashes,policy),/absent/);
 for(const file of ['manager-access.html','schedule-weekly.html','events-admin.html','employee-events.html','ops-manager-hub.html'])assert.equal(pages.includes('/'+file),false);
});
check('CURRENT119_ASSET_MANIFEST_RETAINS_REAL_GIT_TREE_AND_LOCAL_SUPPLY_DIGESTS',()=>{
 // Unchanged maintained verifier requires the real exact Git runtime tree.
 // No executeGit stub, requireExactRuntimeTree:false, or historical100 rebind.
 const result=verifyFrontendReleaseManifest(F);assert.equal(result.ok,true);assert.equal(Object.keys(result.asset_hashes_sha256).length,119);
 assert.equal(result.asset_hashes_sha256['assets/supply_request_icon.svg'],sha(Buffer.from(icon)));
 assert.equal(result.asset_hashes_sha256['supply-coming-soon.html'],sha(Buffer.from(html)));
});
check('CURRENT_MISSING_ICON_OR_LOGO_REFUSES_LOCAL_GRAPH_DISCOVERY',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'custodial-current-supply-graph-')),identity=fs.lstatSync(dir);
 try{
  fs.mkdirSync(path.join(dir,'assets'));fs.writeFileSync(path.join(dir,'supply-coming-soon.html'),html);
  fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><title>Synthetic local Home</title>');
  assert.throws(()=>discoverRuntimeFiles(dir),/Missing local runtime reference/);
  fs.writeFileSync(path.join(dir,'assets/supply_request_icon.svg'),icon);assert.throws(()=>discoverRuntimeFiles(dir),/Zoo_Logo_ui.webp/);
  fs.copyFileSync(path.join(F,'Zoo_Logo_ui.webp'),path.join(dir,'Zoo_Logo_ui.webp'));
  assert.deepEqual(discoverRuntimeFiles(dir),['Zoo_Logo_ui.webp','assets/supply_request_icon.svg','index.html','supply-coming-soon.html'].sort());
 }finally{const actual=fs.lstatSync(dir);assert.ok(!actual.isSymbolicLink()&&actual.ino===identity.ino&&actual.dev===identity.dev);fs.rmSync(dir,{recursive:true});}
});
check('CURRENT_NAVIGATION_AND_ORIGINAL_DATA_OWNERS_ARE_UNCHANGED_SOURCE_ONLY',()=>{
 for(const[file,expected]of Object.entries(unchangedControls)){
  assert.equal(beforeControls.get(file),expected,file+' selected original Source body');
  assert.equal(sha(fs.readFileSync(path.join(F,file))),expected,file+' no Source mutation');
 }
 // These checks read Source files only; no stored actor/work/key bytes are read,
 // changed, synthesized, or claimed healthy by this placeholder contract.
});
assert.equal(groups,8);
console.log(JSON.stringify({status:'CURRENT_SUPPLIES_SOURCE_CONTRACT_PASS',groups,
 historical_original8groups:'retained byte-literal explicit-fixture-only; not replayed by this current entry',
 scope:'Current local page/Home/35selector/119manifest/native navigation Source only; no browser/native APK/install/privatehealth/device/SQL/external destination proof'}));
