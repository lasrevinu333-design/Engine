import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCustodialNavigationAssets} from '../mobile/scripts/custodial-navigation-assets.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const policy=read('mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNavigationPolicy.java');
const pages=[...policy.match(/PAGES\s*=\s*new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
const aliases=[['start_page1.html','index.html'],['employee-hub.html','index.html'],['events.html','employee-events.html'],['system-feedback.html','employee-feedback.html']];
const fixture=()=>{const map=new Map(pages.map(p=>[p==='/'?'index.html':p.slice(1),'synthetic-hash-'+p]));for(const[a,b]of aliases)map.set(a,map.get(b));return map;};
let checks=0;
assertCustodialNavigationAssets(fixture(),policy);checks++;
for(const [a,b]of aliases){
 const changed=fixture();changed.set(a,'manager-or-stale-bytes');assert.throws(()=>assertCustodialNavigationAssets(changed,policy),/alias differs/);checks++;
 const missing=fixture();missing.delete(b);assert.throws(()=>assertCustodialNavigationAssets(missing,policy));checks++;
}
for(const manager of ['manager-access.html','schedule-weekly.html','events-admin.html','ops-manager-hub.html','moxie-mobile.html']){
 const map=fixture();map.set(manager,'unexpected');assert.throws(()=>assertCustodialNavigationAssets(map,policy),/Manager page/);checks++;
 const extraPolicy=policy.replace('"/app-shell.html"',`"/app-shell.html", "/${manager}"`);assert.throws(()=>assertCustodialNavigationAssets(map,extraPolicy),/Manager page/);checks++;
}
for(const page of pages){const map=fixture();map.delete(page==='/'?'index.html':page.slice(1));assert.throws(()=>assertCustodialNavigationAssets(map,policy),/absent/);checks++;}
const build=read('mobile/scripts/build.mjs'),custodial=build.slice(build.indexOf("} else if (edition === 'custodial')"),build.indexOf('await writeFile(join(dist, \'memphis-build-identity.js\')'));
assert.match(custodial,/cp\(join\(source, 'index.html'\), join\(dist, 'start_page1.html'\)\)/);checks++;
assert.match(custodial,/cp\(join\(dist, 'index.html'\), join\(dist, 'employee-hub.html'\)\)/);checks++;
assert.match(custodial,/cp\(join\(dist, 'employee-feedback.html'\), join\(dist, 'system-feedback.html'\)\)/);checks++;
assert.match(build,/const after = await distributionHashes\(dist\);[\s\S]*if \(edition === 'custodial'\) \{\s*assertCustodialNavigationAssets\(after,/);checks++;
const gate=read('mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialWebViewClient.java');
assert.match(gate,/public final class CustodialWebViewClient extends BridgeWebViewClient/);checks++;
assert.match(gate,/return CustodialNavigationPolicy\.shouldBlock\(url\) \|\| allowedLocalDelegate\.getAsBoolean\(\)/);checks++;
assert.equal((gate.match(/return guardedDecision\(/g)||[]).length,2);checks++;
console.log(JSON.stringify({status:'PASS_CUSTODIAL_NAVIGATION_ASSET_CONTRACT',checks,
  scope:'actual validator against synthetic final asset hashes and source binding; not an APK/WebView/phone PASS'}));
