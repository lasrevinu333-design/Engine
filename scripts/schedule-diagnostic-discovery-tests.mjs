import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {currentGpsQualification as p,assertCurrentGpsInventory} from './current-gps-qualification-source-boundary.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=mkdtempSync(join(tmpdir(),'custodial-diagnostic-inputs-'));
try{
 const paths=new Set([...p.main_java,...p.test_java,...p.auxiliary,...p.legacy_proofs,...p.core_sources,...p.presentation_sources].map(x=>x.path));
 for(const path of ['scripts/fixtures/current-basecamp-assignment-r32-source-qualification.json','scripts/fixtures/current-basecamp-display-r31-source-qualification.json','scripts/fixtures/current-basecamp-cache-r30-source-qualification.json','scripts/fixtures/current-basecamp-hub-r29-source-qualification.json','scripts/fixtures/current-program-startup-messenger-r22-source-qualification.json','scripts/fixtures/current-program-startup-messenger-r21-source-qualification.json','scripts/fixtures/current-program-startup-messenger-source-qualification.json','scripts/fixtures/current-web-readiness-source-qualification.json','scripts/fixtures/current-reminder-timing-source-qualification.json','scripts/fixtures/current-terracotta-departure-source-qualification.json','scripts/fixtures/current-v80-presentation-source-qualification.json','package.json','scripts/current-gps-qualification-source-boundary.mjs','scripts/fixtures/current-gps-source-qualification.json','scripts/fixtures/current-schedule-diagnostic-source-qualification.json'])paths.add(path);
 for(const path of paths){const dest=join(temp,path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(root,path),dest);}
 const folder=join(temp,'scripts/schedule-diagnostic'),extra=join(folder,'test-aaa-unpinned.mjs'),marker=join(temp,'UNPINNED_EXECUTED');
 const run=()=>spawnSync(process.execPath,['scripts/schedule-diagnostic-qualification-tests.mjs'],{cwd:temp,encoding:'utf8',timeout:30000});
 const refused=(label,pattern)=>{const r=run();assert.notEqual(r.status,0,label);assert.match(r.stderr,pattern);assert.equal(r.stdout,'','No child can start before rejection');assert.equal(existsSync(marker),false);};
 const probe=`import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(marker)},'bad');`;
 writeFileSync(extra,probe);refused('extra matching script',/Diagnostic executable set differs/);rmSync(extra);
 const external=join(temp,'probe.mjs');writeFileSync(external,probe);symlinkSync(external,extra);refused('extra matching symlink',/Diagnostic executable set differs/);rmSync(extra);
 const selected=join(folder,'test-http.mjs'),original=readFileSync(selected);rmSync(selected);symlinkSync(external,selected);refused('selected symlink',/Diagnostic executable must be a regular non-symlink/);rmSync(selected);writeFileSync(selected,original);
 writeFileSync(selected,Buffer.concat([original,Buffer.from('\n')]));refused('changed selected bytes',/AssertionError/);writeFileSync(selected,original);
 const okay=run();assert.equal(okay.status,0,okay.stdout+okay.stderr);assert.match(okay.stdout,/PASS exact candidate diagnostic/);
 console.log('PASS diagnostic input closure: extra file, extra symlink, selected symlink, byte mutation rejected before any child; exact set passes');
}finally{rmSync(temp,{recursive:true,force:false});}
assertCurrentGpsInventory();
