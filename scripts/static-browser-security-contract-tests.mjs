import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = (await readdir(repoRoot)).filter((name) => name.endsWith('.html')).sort();

assert.ok(htmlFiles.length > 0, 'expected root HTML entrypoints');
for (const file of htmlFiles) {
  const source = await readFile(path.join(repoRoot, file), 'utf8');
  assert.match(source, /http-equiv="Content-Security-Policy"/i, `${file} is missing a CSP meta policy`);
  assert.match(source, /object-src 'none'/i, `${file} must block plugin objects`);
  assert.match(source, /base-uri 'self'/i, `${file} must restrict base URL changes`);
  assert.match(source, /form-action 'self'/i, `${file} must restrict form submissions`);
  assert.match(source, /<meta name="referrer" content="no-referrer">/i, `${file} is missing its referrer policy`);
}

console.log(`static browser security contracts passed for ${htmlFiles.length} entrypoints`);
