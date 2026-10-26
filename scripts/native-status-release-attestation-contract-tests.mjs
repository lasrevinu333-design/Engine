import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyReleaseAttestation } from './verify-native-status-release-attestation.mjs';

const workflow=readFileSync('.github/workflows/android-test-apks.yml','utf8');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const sha=(value)=>String(value).repeat(40).slice(0,40);
const digest=(value)=>String(value).repeat(64).slice(0,64);
const attestation={
  artifact:'memphis-zoo-integrated-release-attestation.v2',
  backend_commit_sha:sha('a'),backend_evidence_blob_sha:sha('b'),backend_evidence_sha256:digest('c'),
  backend_tree_sha:sha('d'),frontend_commit_sha:sha('e'),release_id:'release-build52-test',
  schema_fingerprint:digest('f'),signature:{algorithm:'ed25519',key_id:'custodial-build52-20260915-v1',value_base64:''},
};
const signedKeys=['artifact','backend_commit_sha','backend_evidence_blob_sha','backend_evidence_sha256','backend_tree_sha','frontend_commit_sha','release_id','schema_fingerprint'];
const payload=(value=attestation)=>Object.fromEntries(signedKeys.map((key)=>[key,value[key]]));
attestation.signature.value_base64=sign(null,Buffer.from(`${JSON.stringify(payload())}\n`),privateKey).toString('base64');
const env={
  RELEASE_ATTESTATION_JSON:JSON.stringify(attestation),
  RELEASE_ATTESTATION_PUBLIC_KEY:publicKey.export({type:'spki',format:'pem'}),
  RELEASE_ATTESTATION_KEY_ID:'custodial-build52-20260915-v1',
  GITHUB_SHA:attestation.frontend_commit_sha,
};
const trustRoot={
  keyId:attestation.signature.key_id,
  publicKeySpkiSha256:createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex'),
};

assert.equal(verifyReleaseAttestation(env,trustRoot).backend_commit_sha,attestation.backend_commit_sha);
for(const mutate of [
  (value)=>{delete value.signature;},
  (value)=>{value.signature.value_base64=Buffer.alloc(64).toString('base64');},
  (value)=>{value.backend_commit_sha=sha('9');},
  (value)=>{value.signature.key_id='wrong-key';},
]){
  const hostile=structuredClone(attestation); mutate(hostile);
  assert.throws(()=>verifyReleaseAttestation({...env,RELEASE_ATTESTATION_JSON:JSON.stringify(hostile)},trustRoot));
}
assert.throws(()=>verifyReleaseAttestation({...env,GITHUB_SHA:sha('1')},trustRoot),/exact frontend commit/);
assert.throws(()=>verifyReleaseAttestation({...env,RELEASE_ATTESTATION_PUBLIC_KEY:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'})},trustRoot),/source-pinned trust root/);
const {privateKey:ecPrivateKey,publicKey:ecPublicKey}=generateKeyPairSync('ec',{namedCurve:'secp224r1'});
const ecTrustRoot={keyId:attestation.signature.key_id,
  publicKeySpkiSha256:createHash('sha256').update(ecPublicKey.export({type:'spki',format:'der'})).digest('hex')};
const hostileEc=structuredClone(attestation);
for(let attempt=0;attempt<512;attempt+=1){
  const candidate=sign(null,Buffer.from(`${JSON.stringify(payload(hostileEc))}\n`),ecPrivateKey);
  if(candidate.length===64){ hostileEc.signature.value_base64=candidate.toString('base64'); break; }
}
assert.equal(Buffer.from(hostileEc.signature.value_base64,'base64').length,64,'reviewer EC reproduction must produce a 64-byte DER signature');
assert.throws(()=>verifyReleaseAttestation({...env,RELEASE_ATTESTATION_JSON:JSON.stringify(hostileEc),
  RELEASE_ATTESTATION_PUBLIC_KEY:ecPublicKey.export({type:'spki',format:'pem'})},ecTrustRoot),/must be an Ed25519 public key/);

assert.match(workflow,/MEMPHIS_RELEASE_ATTESTATION_PUBLIC_KEY/);
assert.match(workflow,/RELEASE_ATTESTATION_KEY_ID: 'memphis-zoo-release-2026-08-13'/);
assert.match(workflow,/verify-native-status-release-attestation\.mjs --resolve/);
assert.match(workflow,/verify-native-status-release-attestation\.mjs --verify-checkout/);
const statusMatrix=workflow.indexOf('- name: Generate exact backend status matrix');
const statusCheckoutCleanup=workflow.indexOf('- name: Remove task-owned backend status checkout before exact build');
const exactBuild=workflow.indexOf('- name: Build Custodial web application');
assert.ok(statusMatrix>=0&&statusMatrix<statusCheckoutCleanup&&statusCheckoutCleanup<exactBuild,
  'the task-owned backend checkout must be removed after matrix generation and before exact source build');
assert.match(workflow,/node scripts\/native-actual-sql-fixtures[.]mjs --cleanup-backend/);

console.log('NATIVE_STATUS_RELEASE_ATTESTATION_CONTRACT_PASS');


// Genuine historical application-release signatures; no private key/signing.
const genuineReleaseTrustFixtures = {"old":{"attestation":{"artifact":"memphis-zoo-integrated-release-attestation.v2","release_id":"release-2026.07.19.custodial-v3.12","backend_commit_sha":"24af9e4c0e30edab9a3d6b0ea4b3785c8e0bc7c8","backend_tree_sha":"37d2e89ae98d33ba4b0dae94a99f4ff58fa43d19","backend_evidence_blob_sha":"5c5c7bfd8d92cb6a1433ff4dff3adb001878e41d","backend_evidence_sha256":"bf8c5a506b56309beb841b9179652cf618117e53eda71392482db2195515e0ba","frontend_commit_sha":"6fae503111ef21c40a309913965c3b963043aa01","schema_fingerprint":"750e7f040519f6d4555836cbd4d172a22f98911d5bab9918fa370238fff3f822","signature":{"algorithm":"ed25519","key_id":"custodial-build52-20260915-v1","value_base64":"YbPXrrdAuYWcU8vOj9PXjsRr9hz853m8zBaCcsfJayzJ47ZCcHOf35fQZowC1u2m5FyK5IbHX4WCdPJ2lst7DA=="}},"publicKeyPem":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAt7kIjFyJfyDY4l/TdMKBJgFSfe4IzjGmV+fHXRlKekc=\n-----END PUBLIC KEY-----\n"},"recovery":{"attestation":{"artifact":"memphis-zoo-integrated-release-attestation.v2","release_id":"release-2026.07.19.custodial-v3.12","backend_commit_sha":"fc2b989d19246ffd447c4c7cfb2590ac19bbcd27","backend_tree_sha":"31014fa5b629d2fbe225aed2b45b7af9044a3a01","backend_evidence_blob_sha":"7bf447cb12c3d93b4162649d82a816c008d91ec3","backend_evidence_sha256":"cef93332f9cdc182cb47ac6eca1bfb55ec93539cb81b7af73dbd8b074ee23757","frontend_commit_sha":"6fae503111ef21c40a309913965c3b963043aa01","schema_fingerprint":"750e7f040519f6d4555836cbd4d172a22f98911d5bab9918fa370238fff3f822","signature":{"algorithm":"ed25519","key_id":"memphis-release-recovery-20260928-v1","value_base64":"B8NMl2f17D1pBdIB+OxvYOWYJsBt/Te892Jv8NorooI+JJ13iwkAVN8k6qYuIP16Vz3l4+88QRXAYbkKogMAAg=="}},"publicKeyPem":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAJtYkcvTMKQiFULIcSFzyD/mybD5GY9YYm9UKthIbGDQ=\n-----END PUBLIC KEY-----\n"},"august":{"attestation":{"artifact":"memphis-zoo-integrated-release-attestation.v2","release_id":"release-2026.07.19.custodial-v3.12","backend_commit_sha":"2e0e64b98ea4fe5c4a6081dd996138680608d08b","backend_tree_sha":"20b644596f00970701d9377b6ef15a0dae2d3d7f","backend_evidence_blob_sha":"b0591456d7293881fdeb2ff2e6a28ae5aaea1848","backend_evidence_sha256":"5e3c6a39b5382a9835f396e81db43fb11210b08151be8fb34f6b99fbec216bf8","frontend_commit_sha":"57032deeed5b2e396fd79cf10453e33210b54b9b","schema_fingerprint":"5b123634dd48e0d9bbf88cd572d2d52bafb8b1aaf96c9f9c2811d6f749f30ac6","signature":{"algorithm":"ed25519","key_id":"memphis-zoo-release-2026-08-13","value_base64":"p+YTxrITTSmVGyoxIe0h7prH3qFTWD50x6Kid3GlsHXPmKNzibNi3L7tKpxYqm9UTVtJWdOvnHMnSDgHm354AA=="}},"publicKeyPem":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQA3iBTQLSlp+QJU55P7VTGLP/dDFB9yd4zh6BD4gM0g=\n-----END PUBLIC KEY-----\n"}};
const genuineEnv=row=>({RELEASE_ATTESTATION_JSON:JSON.stringify(row.attestation),RELEASE_ATTESTATION_PUBLIC_KEY:row.publicKeyPem,RELEASE_ATTESTATION_KEY_ID:row.attestation.signature.key_id,GITHUB_SHA:row.attestation.frontend_commit_sha});
for(const name of ['recovery','august']){
 const row=genuineReleaseTrustFixtures[name];
 assert.equal(verifyReleaseAttestation(genuineEnv(row)).signature.key_id,row.attestation.signature.key_id);
 assert.throws(()=>verifyReleaseAttestation({...genuineEnv(row),RELEASE_ATTESTATION_JSON:JSON.stringify({...row.attestation,backend_tree_sha:'f'.repeat(40)})}));
}
assert.throws(()=>verifyReleaseAttestation({...genuineEnv(genuineReleaseTrustFixtures.august),RELEASE_ATTESTATION_PUBLIC_KEY:genuineReleaseTrustFixtures.recovery.publicKeyPem}));
assert.throws(()=>verifyReleaseAttestation({...genuineEnv(genuineReleaseTrustFixtures.august),RELEASE_ATTESTATION_KEY_ID:'unknown-release-key'}));
assert.throws(()=>verifyReleaseAttestation(genuineEnv(genuineReleaseTrustFixtures.old)));

