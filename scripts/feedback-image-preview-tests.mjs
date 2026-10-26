import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../system-feedback.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
}
function matches(label, pattern) {
  assert.match(html, pattern, label);
}

contains('image preview container', 'id="image-preview"');
contains('image preview thumbnail', 'id="image-preview-img"');
contains('image preview filename', 'id="image-preview-name"');
contains('preview hidden by default', 'imagePreview hidden');
matches('preview element ref', /preview:\s*document\.getElementById\(['"]image-preview['"]\)/);
matches('preview image ref', /previewImage:\s*document\.getElementById\(['"]image-preview-img['"]\)/);
matches('preview name ref', /previewName:\s*document\.getElementById\(['"]image-preview-name['"]\)/);
matches('selected image populates preview src', /els\.previewImage\.src\s*=\s*prepared\.dataUrl/);
matches('selected image shows preview', /els\.preview\.classList\.remove\(['"]hidden['"]\)/);
matches('remove image clears preview src', /els\.previewImage\.removeAttribute\(['"]src['"]\)/);
matches('remove image hides preview', /els\.preview\.classList\.add\(['"]hidden['"]\)/);
contains('image attachment JSON field', 'image_attachment');
contains('image attachment data URL', 'data_url: state.image.dataUrl');
contains('JSON request content type', "'Content-Type': 'application/json'");
contains('native request ceiling', 'MAX_AUTHORIZED_REQUEST_BYTES = 4 * 1024 * 1024');
contains('request safety margin', 'MAX_FEEDBACK_REQUEST_BYTES = MAX_AUTHORIZED_REQUEST_BYTES - REQUEST_SAFETY_BYTES');
contains('oversized image compression', 'jpegDataUrl(image, width, height, quality)');
contains('serialized body enforcement', 'serializedBodyFits(serializedBody)');
assert.doesNotMatch(html, /new FormData|multipart\/form-data/i);
contains('manager feedback inbox', 'id="feedback-inbox"');
contains('manager feedback list endpoint', '/dashboard-api/system-feedback');
contains('manager feedback status action', '/status`');
contains('send button copy stays present', 'Send Feedback');
contains('device details remain hidden diagnostic metadata', 'device_id: state.deviceId');
assert.doesNotMatch(html, /context-pill|Resolving context|Ops manager\s*•\s*ops-app-/i);

console.log('feedback image preview contract tests passed');
