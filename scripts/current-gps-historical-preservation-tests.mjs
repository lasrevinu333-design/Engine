import {coreChildEnvironment} from './custodial-core-release-gate.mjs';
// Run UNCHANGED prior owning proofs against an explicitly labelled genuine
// pre-GPS source projection. This never substitutes for current-source tests.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {currentGpsQualification as profile,assertCurrentGpsInventory,normalizeCurrentGpsForHistoricalComparison as normalize} from './current-gps-qualification-source-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');assertCurrentGpsInventory();
const temporary=mkdtempSync(join(tmpdir(),'custodial-pre-gps-historical-'));
try{
 cpSync(join(root,'scripts'),join(temporary,'scripts'),{recursive:true});writeFileSync(join(temporary,'package.json'),'{"type":"module"}\n');
 for(const row of [...profile.legacy_proofs,...profile.main_java,...profile.test_java,...profile.auxiliary]){
  if(profile.deltas.some(d=>d.path===row.path&&d.kind==='added'))continue;
  const target=join(temporary,row.path);mkdirSync(dirname(target),{recursive:true});const bytes=readFileSync(join(root,row.path));writeFileSync(target,profile.deltas.some(d=>d.path===row.path)?normalize(row.path,bytes.toString('utf8')):bytes);
 }
 for(const row of profile.legacy_execution_sources){const target=join(temporary,row.path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,readFileSync(join(root,row.archive_path)));}
 for(const script of ['current-approved-preservation-source-tests.mjs','current-provider-comparison-source-tests.mjs']){
  const result=spawnSync(process.execPath,['scripts/'+script],{cwd:temporary,encoding:'utf8',timeout:120000,env:{...coreChildEnvironment(),PATH:''}});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/PASS/);
  console.log('HISTORICAL_PRE_GPS_ONLY',script,result.stdout.trim());
 }
 assertCurrentGpsInventory();console.log(JSON.stringify({status:'PASS_UNCHANGED_HISTORICAL_PROOFS',actual_current_proof:false,historical_main:193,release_admission:false,physical_phone:false}));
}finally{rmSync(temporary,{recursive:true,force:false});}
