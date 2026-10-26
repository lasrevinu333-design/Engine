import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {custodialInitialReleaseHome} from '../mobile/scripts/custodial-initial-release-pages.mjs';
import {assertCustodialNavigationAssets} from '../mobile/scripts/custodial-navigation-assets.mjs';
import {discoverRuntimeFiles,verifyFrontendReleaseManifest} from './refresh-frontend-release-manifest.mjs';
const F=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,''),BASE=process.argv[2];
assert.ok(BASE&&path.isAbsolute(BASE),'Explicit frozen source base required; no network/runtime fallback.');
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
const M='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNavigationPolicy.java';
const pendingOnly=process.argv[3]==='--remaining-after-five';
assert.ok(process.argv[3]===undefined||pendingOnly,'Unknown source qualification scope');
let groups=0,seen=0;const check=(name,body)=>{seen++;if(pendingOnly&&seen<=5)return;body();groups++;console.log('PASS '+name);};
const html=read(F,'supply-coming-soon.html'),icon=read(F,'assets/supply_request_icon.svg'),home=read(F,'mobile/src/custodial/index.html');
const tile='      <a class="homeButton" href="./supply-coming-soon.html" aria-label="Supplies — coming soon"><span class="homeIcon supplyIcon"><img src="./assets/supply_request_icon.svg" alt=""></span><span class="homeLabel">Supplies</span></a>\n';
check('NEW_OWNER_NARROWED_PLACEHOLDER_HAS_NO_REQUEST_AUTH_STORAGE_OR_NETWORK_WORKFLOW',()=>{
 assert.match(html,/<h1>Supplies are coming soon<\/h1>/);assert.match(html,/destination has not been connected/);
 assert.match(html,/does not submit requests, place orders, change inventory, or contact a vendor/);
 assert.doesNotMatch(html,/<(?:script|form|iframe|object|embed|input|textarea|select)\b|\bon[a-z]+\s*=|\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket)\b/i);
 assert.match(html,/connect-src 'none'; form-action 'none'/);assert.match(html,/base-uri 'none'/);
 const references=[...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(v=>v[1]);
 assert.deepEqual(references,['./assets/supply_request_icon.svg','./assets/supply_request_icon.svg','./index.html']);
 assert.match(html,/url\('\.\/Zoo_Logo_ui.webp'\)/);assert.doesNotMatch(html,/\b(?:https?:|mailto:|intent:|javascript:|\/\/)/i);
});
check('NEW_ICON_AND_PAGE_ARE_ONLY_LOCAL_DEPS_AND_SAFE_HOME_RETURN',()=>{
 assert.match(icon,/<svg[^>]*viewBox="0 0 128 128"/);assert.doesNotMatch(icon,/<(?:script|foreignObject|image|use)\b|\b(?:href|on\w+)\s*=/i);
 assert.match(html,/<a class="back" href="\.\/index\.html" aria-label="Back to Custodial Home">Back to Home<\/a>/);
 assert.match(html,/body data-memphis-context="employee"/);assert.match(html,/min-height:48px/);
 assert.doesNotMatch(html,/Back to supply request draft|supply-request-core|supply-request-ui|supply-catalog|manager-supply-requests/);
});
check('AFFECTED_HOME_PRESERVES_ALL_PRIOR_BYTES_AND_EXACT_FOUR_PLUS_ONE_GUARD',()=>{
 assert.equal(home.split(tile).length,2);assert.equal(home.replace(tile,''),read(BASE,'mobile/src/custodial/index.html'));
 assert.equal(custodialInitialReleaseHome(home),home);assert.equal((home.match(/class="homeButton"/g)||[]).length,5);
 assert.throws(()=>custodialInitialReleaseHome(home.replace(tile,'')),/four operational entries and local Supplies placeholder/);
 assert.throws(()=>custodialInitialReleaseHome(home.replace(tile,tile+tile)));
 assert.throws(()=>custodialInitialReleaseHome(home.replace('href="./supply-coming-soon.html"','href="https://elsewhere.invalid/"')));
 for(const href of['employee-schedule.html','messages.html','events.html','employee-feedback.html']){
  assert.throws(()=>custodialInitialReleaseHome(home.replace(`href="./${href}?hub=employee"`,`href="./not-approved.html"`)));
 }
 assert.throws(()=>custodialInitialReleaseHome(home.replace('class="memphisHome"','class="not-direct-Memphis"')));
});
const compatibility=s=>{const block=s.slice(s.indexOf('const custodialCompatibilityFiles'),s.indexOf('const custodialProhibitedFiles'));
 return new Set([...block.matchAll(/'([^']+)'/g)].map(v=>v[1]));};
check('AFFECTED_BUILD_SELECTOR_ADDS_EXACT_TWO_ASSETS_WITHOUT_BUILD_OR_OTHER_CHANGES',()=>{
 const build=read(F,'mobile/scripts/build.mjs'),old=read(BASE,'mobile/scripts/build.mjs'),added=[...compatibility(build)].filter(v=>!compatibility(old).has(v)).sort();
 assert.deepEqual(added,['assets/supply_request_icon.svg','supply-coming-soon.html']);
 assert.equal(build.replace("  'assets/supply_request_icon.svg',\n",'').replace("  'supply-coming-soon.html',\n",''),old);
 assert.match(build,/runtimeFiles\.filter\(\(runtimePath\) => custodialCompatibilityFiles\.has\(runtimePath\)\)/);
 for(const forbidden of['supply-request-ui.mjs','supply-request-core.mjs','supply-catalog.mjs','manager-supply-requests.mjs'])assert.equal(compatibility(build).has(forbidden),false);
});
const pages=s=>[...s.match(/PAGES\s*=\s*new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/)[1].matchAll(/"([^"]+)"/g)].map(v=>v[1]);
check('AFFECTED_NATIVE_POLICY_HAS_ONE_EXACT_LOCAL_PAGE_NO_ORIGIN_SCHEME_WILDCARD_CHANGE',()=>{
 const policy=read(F,M),old=read(BASE,M);assert.deepEqual(pages(policy).filter(p=>!pages(old).includes(p)),['/supply-coming-soon.html']);
 assert.equal(policy.replace(',\n        "/supply-coming-soon.html"',''),old);
 const map=new Map(pages(policy).map(p=>[p==='/'?'index.html':p.slice(1),'synthetic-final-hash:'+p]));
 for(const [a,b]of[['start_page1.html','index.html'],['employee-hub.html','index.html'],['system-feedback.html','employee-feedback.html']])map.set(a,map.get(b));
 assertCustodialNavigationAssets(map,policy);map.delete('supply-coming-soon.html');assert.throws(()=>assertCustodialNavigationAssets(map,policy),/absent/);
 assert.equal(read(F,'mobile/src/custodial/bridge.js'),read(BASE,'mobile/src/custodial/bridge.js'),'notification route filter is not expanded to supplies');
});
check('NEW_EXACT_FRONTEND_ASSET_MANIFEST_ADMITS_TWO_LOCAL_ASSETS_ONLY',()=>{
 const current=verifyFrontendReleaseManifest(F);assert.equal(current.ok,true);const previous=JSON.parse(read(BASE,'frontend-release-manifest.json'));
 const added=Object.keys(current.asset_hashes_sha256).filter(v=>!Object.hasOwn(previous.asset_hashes_sha256,v)).sort();
 assert.deepEqual(added,['assets/supply_request_icon.svg','supply-coming-soon.html']);assert.equal(Object.keys(current.asset_hashes_sha256).length,100);
 for(const [file,digest]of Object.entries(previous.asset_hashes_sha256))assert.equal(current.asset_hashes_sha256[file],digest,file+' prior runtime byte unchanged');
 assert.equal(read(F,'frontend-deployment-manifest.json'),read(BASE,'frontend-deployment-manifest.json'));
 assert.equal(current.asset_hashes_sha256['assets/supply_request_icon.svg'],sha(Buffer.from(icon)));
 assert.equal(current.asset_hashes_sha256['supply-coming-soon.html'],sha(Buffer.from(html)));
 const oldRest={...previous};delete oldRest.asset_hashes_sha256;const rest={...current.manifest};delete rest.asset_hashes_sha256;assert.deepEqual(rest,oldRest);
});
check('NEW_MISSING_ICON_OR_LOGO_FAILS_DISCOVERY_NOT_SILENT_PACKAGING',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'custodial-supply-graph-')),identity=fs.lstatSync(dir);
 try{
  fs.mkdirSync(path.join(dir,'assets'));fs.writeFileSync(path.join(dir,'supply-coming-soon.html'),html);
  fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><title>Synthetic local Home</title>');
  assert.throws(()=>discoverRuntimeFiles(dir),/Missing local runtime reference/);
  fs.writeFileSync(path.join(dir,'assets/supply_request_icon.svg'),icon);assert.throws(()=>discoverRuntimeFiles(dir),/Zoo_Logo_ui.webp/);
  fs.copyFileSync(path.join(F,'Zoo_Logo_ui.webp'),path.join(dir,'Zoo_Logo_ui.webp'));
  assert.deepEqual(discoverRuntimeFiles(dir),['Zoo_Logo_ui.webp','assets/supply_request_icon.svg','index.html','supply-coming-soon.html'].sort());
 }finally{const actual=fs.lstatSync(dir);assert.ok(!actual.isSymbolicLink()&&actual.ino===identity.ino&&actual.dev===identity.dev);fs.rmSync(dir,{recursive:true});}
});
check('NARROW_EXISTING_SOURCE_EXPECTATION_REBOUND_ONLY_NO_OLD_GROUP_REPLAY',()=>{
 const file='scripts/custodial-initial-release-scope-tests.mjs',old=read(BASE,file),updated=read(F,file);
 assert.equal(updated,old.replace("check((home.match(/<a class=\"homeButton\"/g)||[]).length,4,'four enabled source navigation entries');",
  "check((home.match(/<a class=\"homeButton\"/g)||[]).length,5,'four operational entries and one local Supplies placeholder');"));
 // Other old scope assertions are not executed or claimed newly qualified.
 assert.equal(read(F,'memphis-ui.js'),read(BASE,'memphis-ui.js'));
 assert.equal(read(F,'mobile/scripts/custodial-navigation-assets.mjs'),read(BASE,'mobile/scripts/custodial-navigation-assets.mjs'));
});
console.log(JSON.stringify({status:'SUPPLY_LOCAL_PLACEHOLDER_NEW_SOURCE_INTEGRATION_PASS',groups,
 scope:'NEW8/AFFECTED source contracts and negative graph checks, NOT actual browser/native APK/install/runtime/phone or external destination proof',
 supply_workflow_storage_API_external_URL_and_separate_app_implementation:false,old_core_SDK_SQL_email_proofs_not_replayed:true}));
