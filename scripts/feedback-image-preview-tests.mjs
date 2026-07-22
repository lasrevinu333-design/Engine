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
matches('selected image populates preview src', /els\.previewImage\.src\s*=\s*dataUrl/);
matches('selected image shows preview', /els\.preview\.classList\.remove\(['"]hidden['"]\)/);
matches('remove image clears preview src', /els\.previewImage\.removeAttribute\(['"]src['"]\)/);
matches('remove image hides preview', /els\.preview\.classList\.add\(['"]hidden['"]\)/);
contains('send button copy stays present', 'Send Feedback');
contains('device details remain hidden diagnostic metadata', 'device_id: state.deviceId');
assert.doesNotMatch(html, /context-pill|Resolving context|Ops manager\s*•\s*ops-app-/i);

console.log('feedback image preview contract tests passed');
