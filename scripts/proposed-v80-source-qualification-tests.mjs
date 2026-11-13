// Proposed negative tests; do not add to release/owning gates before review.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,symlinkSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const profile=JSON.parse(readFileSync(join(root,'scripts/fixtures/proposed-v80-presentation-source-qualification.json')));
const temp=mkdtempSync(join(tmpdir(),'custodial-v80-proposed-negatives-'));
try{
 const paths=new Set(profile.sources.map(r=>r.path));
 for(const p of ['scripts/fixtures/proposed-v80-presentation-source-qualification.json','scripts/proposed-v80-source-qualification.mjs','scripts/current-gps-qualification-source-boundary.mjs','scripts/fixtures/current-gps-source-qualification.json','scripts/fixtures/current-schedule-diagnostic-source-qualification.json'])paths.add(p);
 for(const p of paths){mkdirSync(dirname(join(temp,p)),{recursive:true});writeFileSync(join(temp,p),readFileSync(join(root,p)));}
 const {inspectProposedV80Identity:inspect}=await import(pathToFileURL(join(temp,'scripts/proposed-v80-source-qualification.mjs')));
 assert.equal(inspect().reviewed,false);assert.equal(inspect().release_admission,false);
 for(const row of [profile.sources[0],...profile.deltas.map(d=>profile.sources.find(r=>r.path===d.path)),profile.sources.find(r=>r.path.startsWith('scripts/v80-correction-tests/'))]){
  const p=join(temp,row.path),original=readFileSync(p);writeFileSync(p,Buffer.concat([original,Buffer.from('\n')]));assert.throws(inspect);writeFileSync(p,original);assert.equal(inspect().reviewed,false);
 }
 const extra=join(temp,dirname(profile.main_java[0].path),'Unreviewed.java');writeFileSync(extra,'class Unreviewed {}');assert.throws(inspect);rmSync(extra);
 const exec=join(temp,'scripts/v80-correction-tests/unlisted.mjs');writeFileSync(exec,'');assert.throws(inspect);rmSync(exec);
 const p=join(temp,profile.main_java[0].path),b=readFileSync(p),target=p+'.saved';writeFileSync(target,b);rmSync(p);symlinkSync(target,p);assert.throws(inspect);rmSync(p);writeFileSync(p,b);rmSync(target);
 const pin=join(temp,'scripts/fixtures/current-gps-source-qualification.json'),old=readFileSync(pin);writeFileSync(pin,Buffer.concat([old,Buffer.from('\n')]));assert.throws(inspect);writeFileSync(pin,old);
 assert.equal(inspect().status,'PROPOSED_IDENTITY_MATCH_ONLY');
 console.log('PASS proposed identity negatives; not review, runtime or release admission');
}finally{rmSync(temp,{recursive:true,force:false});}
