import assert from 'node:assert/strict';

// Test-only native admission adapter. It models an open, generation-bound
// callback; it does not establish real native storage or device acceptance.
export function createSyntheticScheduleSecurity(principal, {before = () => {}, after = () => {}} = {}) {
  const deviceId = 'KIOSK_08', generation = 1;
  const security = {
    native: true,
    getStatus: () => ({deviceId, generation, principal, ready: true, available: true, quarantined: false}),
    async mutateProtectedWork(operation, options) {
      assert.equal(options?.requireEnrollment, true);
      assert.equal(options?.expectedGeneration, generation);
      before();
      const status = security.getStatus(), original = JSON.stringify(status);
      let open = true;
      const context = Object.freeze({deviceId, generation, assertCurrent() {
        assert.equal(open, true, 'protected callback must still be open');
        assert.equal(JSON.stringify(security.getStatus()), original, 'same original native authority');
      }});
      try { context.assertCurrent(); return await operation(context); }
      finally { open = false; after(); }
    },
  };
  return security;
}
