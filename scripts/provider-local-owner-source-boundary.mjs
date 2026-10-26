import assert from 'node:assert/strict';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {withoutProviderComposition} from './provider-composition-source-boundary.mjs';

// Exact approved lifecycle delta only; the remaining entire plugin is still
// byte-compared to its original accepted cleaning/NFC source. No broad omission.
export function withoutLocalProviderLifecycle(source) {
  source = withoutReadinessObservation('CustodialNativeVaultPlugin.java',source);
  if (!source.includes('    private CustodialNativeRuntime applicationRuntime;')) return source;
  const edits = [
    ['    private CustodialNativeRuntime applicationRuntime;\n    private NativeProviderRemovalCoordinator providerRemoval;\n', ''],
    [/        \/\/ Explicit managed-emulator injected-engine seam[^]*?        this\.providerRemoval = new NativeProviderRemovalCoordinator\(engine, removal, \(\) -> \{\}\);\n/, ''],
    ['        applicationRuntime = runtime;\n', ''],
    [/        providerRemoval = runtime\.providerRemoval\(removal\);\n        try \{ runtime\.attachProviderLocal\(this\); \}\n        catch \(VaultFailure \| RuntimeException unavailable\) \{\n(?:            \/\/[^\n]*\n)+            android\.util\.Log\.w\("CustodialNativeVault", "provider_local_recovery_pending"\);\n        \}\n/, ''],
    [/    @Override\n    protected void handleOnResume\(\) \{\n        if \(applicationRuntime != null\) \{\n            try \{ applicationRuntime\.attachProviderLocal\(this\); \}\n            catch \(VaultFailure \| RuntimeException unavailable\) \{\n                android\.util\.Log\.w\("CustodialNativeVault", "provider_local_recovery_pending"\);\n            \}\n        \}\n    \}\n\n    @Override\n    protected void handleOnPause\(\) \{\n        if \(applicationRuntime != null\) applicationRuntime\.detachProviderLocal\(this\);\n    \}\n\n/, ''],
    ['        if (applicationRuntime != null) applicationRuntime.detachProviderLocal(this);\n', ''],
    ['success(requireProviderRemoval().remove(', 'success(removal.remove('],
    ['requireProviderRemoval().finalizeRemoval(call.getString("operation_id"))', 'engine.finalizeRemoval(call.getString("operation_id"))'],
    ['    private NativeProviderRemovalCoordinator requireProviderRemoval() throws VaultFailure {\n        if (providerRemoval == null) throw new VaultFailure("custodial_provider_removal_owner_required");\n        return providerRemoval;\n    }\n\n', ''],
  ];
  for (const [from, to] of edits) {
    const next = source.replace(from, to);
    assert.notEqual(next, source, 'exact approved provider lifecycle source delta exists: ' + from);
    source = next;
  }
  return source;
}

export function assertLocalProviderBoundary(runtime) {
  runtime = withoutProviderComposition('CustodialNativeRuntime.java',runtime);
  const constructor = runtime.slice(runtime.indexOf('    private CustodialNativeRuntime('), runtime.indexOf('    NativeProviderPrincipal readProviderPrincipal('));
  assert.doesNotMatch(constructor, /new AndroidProviderStore|new NativeProviderJournal|AndroidProviderCipher/,
    'constructing the cleaning runtime never creates provider preferences or key');
  assert.match(runtime, /if \(localProviderOwner == null && AndroidProviderStore\.hasRetainedState\(application\)\) \{\s*AndroidProviderStore store = new AndroidProviderStore\(application\);/,
    'local preservation owner only opens an already retained namespace');
  assert.match(runtime, /new NativeProviderRuntimeOwner\(engine, principalJournal, legacyJournal, journal,\s*providerCoordinator, new AndroidProviderNotifications\(application\)\)/);
  assert.match(runtime, /owner\.reconcile\(\);[^]*?try \{ owner\.reconcileLocalEffects\(\); \}/,
    'durable fence is never swallowed with the separately bounded cancellation exception');
  assert.doesNotMatch(runtime, /new NativeProviderRegistrationCoordinator|\.display\(|\.recordArrival\(|\.captureToken\(|\.providerObservation\(|\.cancelAll\(/);
}
