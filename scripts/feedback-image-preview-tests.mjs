import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../system-feedback.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
}
function matches(label, pattern) {
  assert.match(html, pattern, label);
}

// September24 owner explicitly deferred ALL new feedback photo/screenshots.
// Keep this script name for existing CI callers, and protect historical reads.
for (const page of ['employee-feedback.html','system-feedback.html']) {
  const source = readFileSync(new URL('../'+page, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<input\b[^>]*type=["']file["']/i, page+' has no external picker');
  assert.doesNotMatch(source, /getUserMedia|getDisplayMedia|MediaProjection|FileReader|createImageBitmap/,
    page+' cannot initiate photo/screenshot acquisition');
  assert.doesNotMatch(source, /id=["'](?:add-photo|choose-image|photo|image-input|image-preview)["']/i,
    page+' offers no new image controls');
  assert.doesNotMatch(source, /body\.image_attachment\s*=/,page+' creates no new attachment');
}
contains('historical image metadata retained', 'row.metadata_json?.image_attachment');
contains('historical authenticated image reader retained', '/feedback-api/image/');
contains('JSON request content type', "'Content-Type': 'application/json'");
contains('native request ceiling', 'MAX_AUTHORIZED_REQUEST_BYTES = 4 * 1024 * 1024');
contains('request safety margin', 'MAX_FEEDBACK_REQUEST_BYTES = MAX_AUTHORIZED_REQUEST_BYTES - REQUEST_SAFETY_BYTES');
contains('serialized body enforcement', 'serializedBodyFits(serializedBody)');
assert.doesNotMatch(html, /new FormData|multipart\/form-data/i);
contains('manager feedback inbox', 'id="feedback-inbox"');
contains('manager feedback list endpoint', '/dashboard-api/system-feedback');
contains('manager feedback status action', '/status`');
contains('send button copy stays present', 'Send Feedback');
contains('device details remain hidden diagnostic metadata', 'device_id: state.deviceId');
assert.doesNotMatch(html, /context-pill|Resolving context|Ops manager\s*•\s*ops-app-/i);

console.log('text-only feedback and historical image preservation contract tests passed');
