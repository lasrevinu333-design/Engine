import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {withoutProviderMirror} from './provider-mirror-source-boundary.mjs';

// Exact additive observation bytes, not broad permission to alter existing
// recovery/admission/NFC/store algorithms. Changed bytes require a new proof.
const bounds = {
  "VaultEngine.java": [
    "    /** Diagnostic only:",
    "    synchronized EnrollmentView enroll(",
    "23fef6873c5e0e503307bc81011a9761cb7a12a1aa76db346be3d2e6ceea1aad"
  ],
  "OfflineAuthorityTime.java": [
    "    /** Same existing CLEANING clock",
    "    synchronized RollbackFence beginRollbackFence(",
    "00d0568ce945c0bfb83ee192d87e061bcbf6e12a3a4f7e2ce50e4068e08ca516"
  ],
  "AndroidProtectedWorkPreferences.java": [
    "    static final class ReadOnlyObservation",
    "    /** Compare-and-freeze",
    "8b4cd0d7d5b56a0f067ec85e8564014f300a67bf4961cce647c2c371eba8760c"
  ],
  "AndroidOfflineAuthorityTimeStore.java": [
    "    /** Capture once under original storage locks",
    "    /** Native owner captures this",
    "98b6bb6a08670d6d7fe2c308d5fb913868020bc7bd262b50c4143b1450912f5e"
  ],
  "CustodialNativeVaultPlugin.java": [
    "    @PluginMethod\n    public void getCustodialReadinessObservation(",
    "    @PluginMethod\n    public void beginRollbackFence(",
    "bf6c2a09a5188c05576baa94dd21a81486c9ea0edf81efcfa0bbcdd9c06afa46"
  ]
};
export function withoutReadinessObservation(name, source) {
  if(name==='CustodialNativeVaultPlugin.java')source=withoutProviderMirror(name,source);
  const boundary = bounds[name];
  if (!boundary || !source.includes(boundary[0])) return source;
  const start = source.indexOf(boundary[0]), end = source.indexOf(boundary[1], start);
  assert.ok(end > start, 'exact read-only addition end exists: ' + name);
  assert.equal(createHash('sha256').update(source.slice(start,end)).digest('hex'), boundary[2], 'frozen read-only addition bytes: ' + name);
  return source.slice(0,start) + source.slice(end);
}
