import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Only the complete, exact old/new removal blocks are comparable as this
// changed input. Every other engine byte remains part of the baseline hash.
export function withoutRemovalTransport(source) {
  const modern = source.indexOf('    /** Removal-only capture/send/settle boundary.');
  const start = modern >= 0 ? modern : source.indexOf('    synchronized RemovalView removeEnrollment(');
  const end = source.indexOf('    synchronized Map<String, Object> finalizeRemoval(', start);
  assert.ok(start >= 0 && end > start, 'exact removal-only boundary');
  const expected = modern >= 0
    ? 'd1ad17f6b2dff83c107fcb272737a08bbd58d5f117372e53068f674bfe871b27'
    : 'cb301cde4f30da987b11b7e3d6aede9b87c88cccb269d5529dc5d4c817a65470';
  assert.equal(createHash('sha256').update(source.slice(start,end)).digest('hex'), expected, 'exact reviewed removal block');
  return source.slice(0,start) + '    /* EXACT_REMOVAL_TRANSPORT_DELTA */\n' + source.slice(end);
}
