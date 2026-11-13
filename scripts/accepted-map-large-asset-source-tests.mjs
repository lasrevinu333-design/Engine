// Regression for the reproduced normal source-verifier buffer failure only.
// No DB, manager identity, credentials, network, app build or phone.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GIT_BINARY_MAX_BUFFER_BYTES,verifyFrontendReleaseManifest} from './refresh-frontend-release-manifest.mjs';
const root=new URL('..',import.meta.url).pathname,path='dashboard-map-assets/Memphis-Zoo-Approved-Overall-Fit-Art-Only-20261010.png';
const id=execFileSync('git',['rev-parse','HEAD:'+path],{cwd:root,encoding:'utf8'}).trim();
assert.throws(()=>execFileSync('git',['cat-file','blob',id],{cwd:root,stdio:['ignore','pipe','pipe']}),e=>e.code==='ENOBUFS');
console.log('PASS exact accepted blob reproduces default 1 MiB source-verification refusal');
assert.equal(GIT_BINARY_MAX_BUFFER_BYTES,16*1024*1024);
const blob=execFileSync('git',['cat-file','blob',id],{cwd:root,maxBuffer:GIT_BINARY_MAX_BUFFER_BYTES});
assert.equal(blob.length,2192815);
assert(blob.equals(readFileSync(new URL('../'+path,import.meta.url))));
assert.equal(createHash('sha256').update(blob).digest('hex'),'7da4c536fc40b261a4466670c19d7e0e7af26ecc833d84c34f2c5b00474a9072');
console.log('PASS explicit finite binary cap reads original Git bytes without resize, substitution or unbounded buffering');
let binaryCalls=0;
const executeGit=(exe,args,opts)=>{
 if(!Object.hasOwn(opts,'encoding')){assert.equal(opts.maxBuffer,GIT_BINARY_MAX_BUFFER_BYTES);binaryCalls++;}
 return execFileSync(exe,args,opts);
};
const checked=verifyFrontendReleaseManifest(root,{executeGit});
assert(binaryCalls>0);assert(checked.runtime_files.includes(path));
assert.equal(checked.asset_hashes_sha256[path],'7da4c536fc40b261a4466670c19d7e0e7af26ecc833d84c34f2c5b00474a9072');
console.log('PASS normal source-tree verifier propagates cap and validates exact approved raster identity');
console.log(JSON.stringify({status:'PASS_NORMAL_SOURCE_BLOB_LIMIT_REGRESSION',cases:3,manifest_current:checked.ok,
 new_access:false,independent_audit:false,APK_or_release:false}));
