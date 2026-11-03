import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compiledScopeSource, readCustodialBuildScope } from './custodial-new-producer-scope-policy.mjs';

// The standalone native library needs the same immutable scope class as the
// normal app. Only the committed source profile selects it; never a CLI flag,
// environment variable, generated output, or fixture-specific replacement.
assert.equal(process.argv.length, 2, 'The native scope generator accepts no overrides');
const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
process.stdout.write(compiledScopeSource(
  'org.memphiszoo.custodial.vault', readCustodialBuildScope(mobileRoot),
));
