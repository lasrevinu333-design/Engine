import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync,lstatSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {currentGpsQualification,assertCurrentGpsInventory} from './current-gps-qualification-source-boundary.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=new URL('./schedule-diagnostic/',import.meta.url);
const names=Object.freeze(['test-bad-status.mjs','test-changing-status.mjs','test-http.mjs','test-status.mjs','test-throwing-status.mjs','test-transport.mjs']);
// Close the complete discovered execution set BEFORE any child can run.
assert.deepEqual(readdirSync(folder).filter(x=>x.startsWith('test-')&&x.endsWith('.mjs')).sort(),names,'Diagnostic executable set differs');
for(const name of names){
 const path='scripts/schedule-diagnostic/'+name,rows=currentGpsQualification.auxiliary.filter(x=>x.path===path);
 assert.equal(rows.length,1,'Exactly one pinned diagnostic identity');
 const file=new URL(name,folder),stat=lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Diagnostic executable must be a regular non-symlink file');
 const bytes=readFileSync(file);assert.equal(bytes.length,rows[0].bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),rows[0].sha256);
}
assertCurrentGpsInventory();
for(const name of names){
 const r=spawnSync(process.execPath,['scripts/schedule-diagnostic/'+name,'--native-runtime'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);
}
console.log('PASS exact candidate diagnostic regressions; synthetic only');
