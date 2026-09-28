import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import { verifyReleaseAttestation } from './verify-native-status-release-attestation.mjs';

// Public historical release artifacts test the real default trust pin.
// They do not approve this working candidate or change the APK signing key.
const root = new URL('./fixtures/release-signing-recovery-20260928/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const current = JSON.parse(read('current-signed-release.json'));
const previous = JSON.parse(read('previous-signed-release.json'));
const environment = (attestation, publicKey) => ({
  RELEASE_ATTESTATION_JSON: JSON.stringify(attestation),
  RELEASE_ATTESTATION_PUBLIC_KEY: publicKey,
  RELEASE_ATTESTATION_KEY_ID: attestation.signature.key_id,
  GITHUB_SHA: attestation.frontend_commit_sha,
});
const env = environment(current, read('current-public-key.pem'));
const fingerprint = pem => createHash('sha256').update(
  createPublicKey(pem).export({ type: 'spki', format: 'der' }),
).digest('hex');
assert.equal(fingerprint(env.RELEASE_ATTESTATION_PUBLIC_KEY),
  'a0af17f2aabc006af0a5ea3d80e2ccbab0650c1689f7ed828ec7aeb1075c5190');
assert.equal(fingerprint(read('previous-public-key.pem')),
  '992a3be69b3340e65bae0b28b8d78ef568dfc30a0ed8120268794ea15e1b49a0');
assert.equal(verifyReleaseAttestation(env).backend_commit_sha,
  'fc2b989d19246ffd447c4c7cfb2590ac19bbcd27');
assert.equal(Object.isFrozen(verifyReleaseAttestation(env)), true);
assert.throws(() => verifyReleaseAttestation(
  environment(previous, read('previous-public-key.pem')),
), /source-pinned trust root/);
assert.throws(() => verifyReleaseAttestation({ ...env,
  RELEASE_ATTESTATION_KEY_ID: previous.signature.key_id,
}), /source-pinned trust root/);
assert.throws(() => verifyReleaseAttestation({ ...env,
  RELEASE_ATTESTATION_PUBLIC_KEY: read('previous-public-key.pem'),
}), /source-pinned trust root/);
assert.throws(() => verifyReleaseAttestation({ ...env,
  GITHUB_SHA: '0'.repeat(40),
}), /exact frontend commit/);
for (const field of ['backend_commit_sha', 'backend_tree_sha',
  'backend_evidence_blob_sha', 'backend_evidence_sha256',
  'frontend_commit_sha', 'schema_fingerprint', 'release_id']) {
  const altered = structuredClone(current);
  altered[field] = field === 'release_id' ? 'release-altered-test'
    : `${current[field][0] === 'a' ? 'b' : 'a'}${current[field].slice(1)}`;
  assert.throws(() => verifyReleaseAttestation(environment(altered,
    read('current-public-key.pem'))), /signature is invalid/);
}
const renamed = structuredClone(current);
renamed.signature.key_id = previous.signature.key_id;
assert.throws(() => verifyReleaseAttestation(environment(renamed,
  read('current-public-key.pem'))), /source-pinned trust root/);
console.log('RELEASE_SIGNING_RECOVERY_DEFAULT_PIN_PASS');
