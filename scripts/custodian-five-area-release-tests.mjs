import assert from 'node:assert/strict';
import {readFileSync,existsSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('frontend-release-manifest.json'));
assert.match(manifest.schema_fingerprint,/^[a-f0-9]{64}$/);
for(const name of ['index.html','memphis-scan-sync.js']){
 const matches=[...read(name).matchAll(/REQUIRED_BACKEND_SCHEMA_FINGERPRINT\s*:\s*['"]([a-f0-9]{64})['"]/g)];
 assert.equal(matches.length,1,name);assert.equal(matches[0][1],manifest.schema_fingerprint,name+' must bind the exact selected schema rather than an obsolete release');
}
assert.equal(existsSync(new URL('../employee-events.html',import.meta.url)),false);
assert.equal(existsSync(new URL('../events-admin.html',import.meta.url)),false);
const build=read('mobile/scripts/build.mjs');
assert.match(build,/entry\.name === 'events\.html'/);
assert.match(build,/html = html\.replace\(`<script src="\.\/\$\{bridgeFile\}"><\/script>`/);
assert.match(read('events.html'),/events-view\.js/);
assert.match(read('mobile/src/custodial/index.html'),/href="\.\/events\.html\?hub=employee"/);
assert.doesNotMatch(build,/cp\(join\(dist, 'employee-events\.html'/);
console.log('CUSTODIAN_FIVE_AREA_RELEASE_SOURCE_PASS');
