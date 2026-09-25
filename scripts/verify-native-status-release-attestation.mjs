import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const COMMIT=/^[0-9a-f]{40}$/;
const DIGEST=/^[0-9a-f]{64}$/;
const ATTESTATION_KEYS=[
  'artifact','backend_commit_sha','backend_evidence_blob_sha','backend_evidence_sha256',
  'backend_tree_sha','frontend_commit_sha','release_id','schema_fingerprint','signature',
];
const SIGNED_KEYS=ATTESTATION_KEYS.filter((key)=>key!=='signature');
const RELEASE_ATTESTATION_TRUST_ROOT=Object.freeze({
  keyId:'custodial-build52-20260915-v1',
  publicKeySpkiSha256:'992a3be69b3340e65bae0b28b8d78ef568dfc30a0ed8120268794ea15e1b49a0',
});

function required(name,env=process.env){
  const value=String(env[name]||'').trim();
  assert.ok(value,`${name} is required`);
  return value;
}

function payload(attestation){
  return Object.fromEntries(SIGNED_KEYS.map((key)=>[key,attestation?.[key]]));
}

export function verifyReleaseAttestation(env=process.env,trustRoot=RELEASE_ATTESTATION_TRUST_ROOT){
  const attestation=JSON.parse(required('RELEASE_ATTESTATION_JSON',env));
  assert.ok(attestation&&typeof attestation==='object'&&!Array.isArray(attestation),'release attestation must be an object');
  assert.deepEqual(Object.keys(attestation).sort(),ATTESTATION_KEYS,'release attestation has an unexpected shape');
  assert.equal(attestation.artifact,'memphis-zoo-integrated-release-attestation.v2');
  assert.match(String(attestation.release_id||''),/^release-[a-z0-9.-]+$/);
  assert.match(String(attestation.backend_commit_sha||''),COMMIT);
  assert.match(String(attestation.backend_tree_sha||''),COMMIT);
  assert.match(String(attestation.backend_evidence_blob_sha||''),COMMIT);
  assert.match(String(attestation.backend_evidence_sha256||''),DIGEST);
  assert.match(String(attestation.frontend_commit_sha||''),COMMIT);
  assert.match(String(attestation.schema_fingerprint||''),DIGEST);
  assert.deepEqual(Object.keys(attestation.signature||{}).sort(),['algorithm','key_id','value_base64']);
  assert.equal(attestation.signature.algorithm,'ed25519');
  assert.equal(required('RELEASE_ATTESTATION_KEY_ID',env),trustRoot.keyId,'configured release attestation key identity is not the source-pinned trust root');
  assert.equal(attestation.signature.key_id,trustRoot.keyId,'release attestation signing key identity is wrong');
  assert.match(String(attestation.signature.value_base64||''),/^[A-Za-z0-9+/]+={0,2}$/);
  const signature=Buffer.from(attestation.signature.value_base64,'base64');
  assert.equal(signature.length,64,'release attestation signature must be one Ed25519 signature');
  assert.equal(signature.toString('base64'),attestation.signature.value_base64,'release attestation signature is not canonical base64');
  const publicKey=createPublicKey(required('RELEASE_ATTESTATION_PUBLIC_KEY',env).replaceAll('\\n','\n'));
  assert.equal(publicKey.asymmetricKeyType,'ed25519','release attestation trust root must be an Ed25519 public key');
  assert.equal(createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex'),
    trustRoot.publicKeySpkiSha256,'release attestation public key is not the source-pinned trust root');
  const signed=Buffer.from(`${JSON.stringify(payload(attestation))}\n`,'utf8');
  assert.equal(verify(null,signed,publicKey,signature),true,'release attestation signature is invalid');
  assert.equal(attestation.frontend_commit_sha,required('GITHUB_SHA',env),'signed release pair does not name this exact frontend commit');
  return Object.freeze(attestation);
}

function git(path,args){
  const result=spawnSync('git',['-C',path,...args],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(result.status,0,`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

export function verifyBackendCheckout(attestation,path){
  assert.equal(git(path,['rev-parse','HEAD']),attestation.backend_commit_sha,'checked-out backend commit is wrong');
  assert.equal(git(path,['rev-parse','HEAD^{tree}']),attestation.backend_tree_sha,'checked-out backend tree is wrong');
  const entry=git(path,['ls-tree','HEAD','release/integrated-backend-authority-evidence.json']).split(/\s+/);
  assert.equal(entry[0],'100644','signed backend evidence must be a regular tracked file');
  assert.equal(entry[1],'blob','signed backend evidence tree entry must be a blob');
  assert.equal(entry[2],attestation.backend_evidence_blob_sha,'signed backend evidence blob is wrong');
  const evidence=readFileSync(`${path}/release/integrated-backend-authority-evidence.json`);
  assert.equal(createHash('sha256').update(evidence).digest('hex'),attestation.backend_evidence_sha256,'signed backend evidence digest is wrong');
  return true;
}

export function main(args=process.argv.slice(2),env=process.env){
  const attestation=verifyReleaseAttestation(env);
  if(args[0]==='--resolve'){
    appendFileSync(required('GITHUB_OUTPUT',env),`commit=${attestation.backend_commit_sha}\n`);
    return;
  }
  if(args[0]==='--verify-checkout'){
    assert.ok(args[1],'backend checkout path is required');
    verifyBackendCheckout(attestation,args[1]);
    return;
  }
  throw new Error('Expected --resolve or --verify-checkout <path>.');
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href&&process.argv.length>2) main();
