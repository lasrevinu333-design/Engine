import assert from 'node:assert/strict';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {withoutRemovalTransport} from './native-removal-source-boundary.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';

// Exact owned sections for changed-input comparisons, not a runtime safety proof.
// NFC methods, keys, observer authority and all other journal mutations
// remain byte-compared to their previously frozen baseline.
function omit(source, start, end) {
  const at = typeof start === 'string' ? source.indexOf(start) : source.search(start);
  assert.ok(at >= 0, 'owned provider boundary start exists');
  const until = source.indexOf(end, at);
  assert.ok(until > at, 'owned provider boundary end exists');
  return source.slice(0, at) + '    /* OWNED_PROVIDER_CLOCK_SECTION */\n' + source.slice(until);
}
export const withoutProviderRegistration = source => omit(withoutRemovalTransport(withoutReadinessObservation('VaultEngine.java',withoutProviderInterval('VaultEngine.java',source))),
  /    NativeProvider(?:Journal\.Prepared|ClockExchange\.Settlement) registerNativeProvider\(/, '    int sendNativeProviderEvents(');
export function withoutProviderStatusJournal(source) {
  return omit(omit(source, '    /** Native-only immutable typed request.', '    /** Original native observation.'),
    '    Prepared confirmRegistration(', '    private static boolean sameCommittedReceipt(');
}
