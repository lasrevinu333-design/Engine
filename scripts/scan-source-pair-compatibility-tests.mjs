import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const root = new URL('../',import.meta.url);
const sourceDirectory = process.argv.find(x=>x.startsWith('--source-directory='))?.slice('--source-directory='.length);
const read = name=>readFileSync(sourceDirectory?resolve(sourceDirectory,name):new URL(name,root),'utf8');
const binding=JSON.parse(readFileSync(new URL('scripts/fixtures/current303-schema-source-binding.json',root),'utf8'));
const good={version:'release-2026.07.19.custodial-v3.12',contracts:{scan:'scan.v4.snapshot-bound-authority'},release_manifest:{schema:{fingerprint:binding.schema_fingerprint}}};
const cases=[['current',good,true],['prior302',{...good,release_manifest:{schema:{fingerprint:'04e4c3d7abaa71cdf36a164a483ee1fa5efef77ab1711b07a201f515b85248d6'}}},false],['prior298',{...good,release_manifest:{schema:{fingerprint:'432052a95830b4a8550cd6478d766bacc2bbbb4b2dd21d44544b238c70c5f001'}}},false],['missing',{},false],['unknown',{...good,release_manifest:{schema:{fingerprint:'0'.repeat(64)}}},false],['wrong-contract',{...good,contracts:{scan:'unsupported'}},false],['http-failure',good,false],['offline',good,false]];
let passed=0,failed=0;
for(const [name,file,fn] of [['page','index.html','verifyBackendCompatibility'],['worker','memphis-scan-sync.js','verifyWorkerBackendCompatibility']]) {
 const source=read(file);
 const config=name==='page'?source.match(/const CONFIG=(\{[^\n]+?\});/)[1]:source.match(/const CONFIG = (\{[\s\S]*?\n  \});/)[1];
 const body=name==='page'?source.split('\n').find(x=>x.includes(`async function ${fn}(`)):source.slice(source.indexOf(`  async function ${fn}(`),source.indexOf('  function resolveDeviceId('));
 assert.ok(body&&config);
 for(const [id,payload,expected] of cases) {
  const changes=[],messages=[];
  const storage={getItem:()=>null,setItem:(k,v)=>changes.push({k,v})};
  const c={URL,Date,console,navigator:{onLine:id!=='offline'},window:{location:{href:'https://fixture.invalid/index.html?backend_version='+good.version,replace:()=>{throw Error('unexpected navigation');}}},localStorage:storage,sessionStorage:storage,
   SCAN_CONTRACT_CACHE_KEY:'fixture-contract',BACKEND_REFRESH_KEY:'fixture-refresh',
   fetch:async()=>{if(id==='offline')throw Error('offline');return {ok:id!=='http-failure',json:async()=>payload};},
   setBuildStamp(){},renderMessageCard:(...args)=>messages.push(args),dispatchStatus:status=>messages.push(status),
   safeText:v=>String(v??'').trim(),backendMeetsMinimum:v=>v===good.version,mutateCustodialWork:async task=>task()};
  vm.createContext(c);
  try {
   vm.runInContext(`const CONFIG=${config};\n${body}`,c);
   const result=await c[fn]();
   assert.equal(name==='page'?!result:result,expected,`${name} ${id} acceptance`);
   if(!expected) assert.equal(changes.length,0,'refusal cannot save a compatible cache');
   passed++;
  } catch(e){failed++;console.error(e.message);}
 }
}
console.log(JSON.stringify({passed,failed,scope:'actual page/worker compatibility functions and config with synthetic version responses; no backend/storage/HTTP/device acceptance'}));
process.exitCode=failed?1:0;
