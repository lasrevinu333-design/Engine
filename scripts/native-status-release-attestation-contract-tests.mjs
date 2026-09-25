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
assert.match(workflow,/RELEASE_ATTESTATION_KEY_ID: 'custodial-build52-20260915-v1'/);
assert.match(workflow,/verify-native-status-release-attestation\.mjs --resolve/);
assert.match(workflow,/verify-native-status-release-attestation\.mjs --verify-checkout/);

console.log('NATIVE_STATUS_RELEASE_ATTESTATION_CONTRACT_PASS');
