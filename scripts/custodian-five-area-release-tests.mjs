import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import vm from 'node:vm';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('frontend-release-manifest.json'));
assert.match(manifest.schema_fingerprint,/^[a-f0-9]{64}$/);
for(const name of ['index.html','memphis-scan-sync.js']){
 const matches=[...read(name).matchAll(/REQUIRED_BACKEND_SCHEMA_FINGERPRINT\s*:\s*['"]([a-f0-9]{64})['"]/g)];
 assert.equal(matches.length,1,name);assert.equal(matches[0][1],manifest.schema_fingerprint,name+' must bind the exact selected schema rather than an obsolete release');
}
const build=read('mobile/scripts/build.mjs');
const compatibilityBlock=build.match(/const custodialCompatibilityFiles = new Set\(\[([\s\S]*?)\]\);/);
const prohibitedBlock=build.match(/const custodialProhibitedFiles = \[([\s\S]*?)\];/);
assert.ok(compatibilityBlock && prohibitedBlock, 'actual packaging boundaries must remain explicit');
const compatibility=vm.runInNewContext('new Set(['+compatibilityBlock[1]+'])',{}, {timeout:1000});
const prohibited=vm.runInNewContext('['+prohibitedBlock[1]+']',{}, {timeout:1000});
for(const path of ['employee-events.html','events-admin.html','Event_Icon_Pink_ui.webp'])
 assert.equal(compatibility.has(path),false,path+' must stay outside the Custodial selected graph');
assert.ok(prohibited.includes('events-admin.html'),'manager events page must remain prohibited');
assert.match(build,/edition === 'custodial'\s*\? runtimeFiles\.filter\(\(runtimePath\) => custodialCompatibilityFiles\.has\(runtimePath\)\)/);
const selected=discoverRuntimeFiles(fileURLToPath(new URL('..',import.meta.url))).filter(path=>compatibility.has(path));
assert.equal(selected.length,compatibility.size,'all selected compatibility assets must exist in the maintained graph');
for(const path of ['employee-events.html','events-admin.html','Event_Icon_Pink_ui.webp'])
 assert.equal(selected.includes(path),false,path+' must not enter final Custodial copied assets');
assert.match(build,/entry\.name === 'events\.html'/);
assert.match(build,/html = html\.replace\(`<script src="\.\/\$\{bridgeFile\}"><\/script>`/);
assert.match(read('events.html'),/events-view\.js/);
assert.match(read('mobile/src/custodial/index.html'),/href="\.\/events\.html\?hub=employee"/);
assert.doesNotMatch(build,/cp\(join\(dist, 'employee-events\.html'/);
console.log('CUSTODIAN_FIVE_AREA_RELEASE_SOURCE_PASS');
