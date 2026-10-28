import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../system-feedback.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
}
function matches(label, pattern) {
  assert.match(html, pattern, label);
}

// New capture is excluded by owner direction; historical image DATA remains readable.
assert.doesNotMatch(html, /<input[^>]+type=["']file|capture=|FileReader|jpegDataUrl/);
assert.match(html, /metadata_json\?\.image_attachment/);
assert.match(html, /'Content-Type':\s*'application\/json'/);
contains('native request ceiling', 'MAX_AUTHORIZED_REQUEST_BYTES = 4 * 1024 * 1024');
contains('request safety margin', 'MAX_FEEDBACK_REQUEST_BYTES = MAX_AUTHORIZED_REQUEST_BYTES - REQUEST_SAFETY_BYTES');
contains('serialized body enforcement', 'serializedBodyFits(JSON.stringify(draft))');
assert.doesNotMatch(html, /new FormData|multipart\/form-data/i);
contains('manager feedback inbox', 'id="feedback-inbox"');
contains('manager feedback list endpoint', '/dashboard-api/system-feedback');
contains('manager feedback status action', '/status`');
contains('send button copy stays present', 'Send Feedback');
assert.match(readFileSync(new URL('../manager-feedback-submit.mjs', import.meta.url),'utf8'), /device_id:owner.device_id/);
assert.doesNotMatch(html, /context-pill|Resolving context|Ops manager\s*•\s*ops-app-/i);

console.log('feedback image preview contract tests passed');
