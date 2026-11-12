import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of readdirSync(new URL('./schedule-diagnostic/',import.meta.url)).filter(x=>x.startsWith('test-')&&x.endsWith('.mjs')).sort()){
 const r=spawnSync(process.execPath,['scripts/schedule-diagnostic/'+name,'--native-runtime'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);
}
console.log('PASS exact candidate diagnostic regressions; synthetic only');
