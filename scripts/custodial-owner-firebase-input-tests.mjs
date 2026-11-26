import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const codemagic=readFileSync(new URL('../codemagic.yaml',import.meta.url),'utf8');
const owner=codemagic.split(/^  custodial-first-test:\s*$/m)[1];
assert.doesNotMatch(owner,/firebase_client_config/);
assert.match(owner,/curl --fail --silent --show-error --proto '=https' --max-time 30 --max-filesize 1048576/);
assert.match(owner,/https:\/\/memphis-zoo-mcp\.onrender\.com\/manager-notifications-api\/client-config\/android\?app_identifier=org\.memphiszoo\.custodial/);
assert.ok(owner.indexOf('configure-firebase.mjs android --verify-only') < owner.indexOf('>> "$CM_ENV"'));
assert.ok(owner.indexOf('>> "$CM_ENV"') < owner.indexOf('node mobile/scripts/build-custodial-first-test.mjs'));
assert.match(owner,/MZ_REQUIRE_PINNED_FIREBASE_CONFIG: '1'/);
const wrapper=readFileSync(new URL('../mobile/scripts/build-custodial-first-test.mjs',import.meta.url),'utf8');
assert.ok(wrapper.indexOf("'android','--verify-only'")<wrapper.indexOf("node('build.mjs')"));
assert.match(wrapper,/MZ_REQUIRE_PINNED_FIREBASE_CONFIG:'1'/);
const scratch=mkdtempSync(join(tmpdir(),'custodial-firebase-input-'));
try{
 const script=join(scratch,'mobile/scripts/configure-firebase.mjs');
 const lock=join(scratch,'mobile/native-locks/firebase');
 mkdirSync(join(scratch,'mobile/scripts'),{recursive:true});mkdirSync(lock,{recursive:true});
 writeFileSync(script,readFileSync(new URL('../mobile/scripts/configure-firebase.mjs',import.meta.url)));
 const preload=join(scratch,'no-network.mjs');
 writeFileSync(preload,"globalThis.fetch=()=>{throw Error('UNEXPECTED_NETWORK');};\n");
 const exact=JSON.stringify({client:[{client_info:{android_client_info:{package_name:'org.memphiszoo.custodial'}}}]})+'\n';
 const expected=createHash('sha256').update(exact).digest('hex');
 writeFileSync(join(lock,'custodial-android.sha256'),expected+'  google-services.json\n');
 const run=raw=>spawnSync(process.execPath,['--import',preload,script,'android','--verify-only'],{
  encoding:'utf8',env:{MZ_APP_EDITION:'custodial',MZ_REQUIRE_PINNED_FIREBASE_CONFIG:'1',
    ...(raw===undefined?{}:{GOOGLE_SERVICES_JSON:raw})}});
 for(const [raw,pattern] of [[undefined,/environment-supplied/],[exact+' ',/digest mismatch/]]){
  const failed=run(raw);assert.notEqual(failed.status,0);assert.match(failed.stderr,pattern);
  assert.doesNotMatch(failed.stderr,/UNEXPECTED_NETWORK/);
 }
 const passed=run(exact);assert.equal(passed.status,0,passed.stderr);
 assert.equal(existsSync(join(scratch,'mobile/android')),false);
 assert.equal(existsSync(join(scratch,'build')),false);
}finally{rmSync(scratch,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true,scope:'exact owner Firebase pre-build source and strict no-network fixture'}));
