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
  const policy=source.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i)?.[1];
  assert.ok(policy, file+' must supply a parseable CSP');
  const directives=new Map();for(const part of policy.split(';')){const [name,...values]=part.trim().split(/\s+/);if(name&&!directives.has(name))directives.set(name,values);}
  assert.deepEqual(directives.get('object-src')||directives.get('default-src'),["'none'"],file+' must deny plugin objects, including default-src fallback');
  for(const name of ['base-uri','form-action'])assert.ok(
    [JSON.stringify(["'self'"]),JSON.stringify(["'none'"])].includes(JSON.stringify(directives.get(name))),
    file+' must restrict '+name+' to self or none');
  assert.match(source, /<meta name="referrer" content="no-referrer">/i, `${file} is missing its referrer policy`);
}

console.log(`static browser security contracts passed for ${htmlFiles.length} entrypoints`);
