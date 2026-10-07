import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const sourceSha256 = source => createHash('sha256').update(source).digest('hex');
// Origin commit/path and raw bytes hash are retained as provenance. CI consumes
// these tracked hashes, never unpublished worker objects or a full Git history.
const baselines = JSON.parse(readFileSync(new URL('./fixtures/native-source-baselines.json', import.meta.url),'utf8'));
export function assertNativeBaseline(origin, path, source, normalization = 'raw') {
  const row = baselines.find(row => row.origin === origin && row.path === path && row.normalization === normalization);
  assert.ok(row, 'explicit tracked native baseline: ' + origin + ':' + path + ':' + normalization);
  assert.equal(sourceSha256(source), row.normalized_sha256, 'exact native baseline ' + path + ' (' + normalization + ')');
}
