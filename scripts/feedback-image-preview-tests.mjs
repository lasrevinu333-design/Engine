import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../system-feedback.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
}

contains('image preview container', 'id="image-preview"');
contains('image preview thumbnail', 'id="image-preview-img"');
contains('image preview filename', 'id="image-preview-name"');
contains('preview hidden by default', 'imagePreview hidden');
contains('preview element refs', 'imagePreview:document.getElementById(\'image-preview\')');
contains('preview image ref', 'imagePreviewImg:document.getElementById(\'image-preview-img\')');
contains('preview name ref', 'imagePreviewName:document.getElementById(\'image-preview-name\')');
contains('selected image populates preview src', 'els.imagePreviewImg.src=dataUrl');
contains('selected image shows preview', 'els.imagePreview.classList.remove(\'hidden\')');
contains('remove image clears preview src', 'els.imagePreviewImg.removeAttribute(\'src\')');
contains('remove image hides preview', 'els.imagePreview.classList.add(\'hidden\')');
contains('send button copy stays present', 'Send Feedback');

console.log('feedback image preview contract tests passed');
