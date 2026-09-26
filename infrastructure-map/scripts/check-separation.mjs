import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'android', 'ios', 'coverage']);
const scannedExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.sql', '.html', '.css', '.yml', '.yaml']);
const ignoredFiles = new Set(['scripts/check-separation.mjs']);

const forbidden = [
  { label: 'Custodial source import', pattern: /mobile[\\/]src[\\/]custodial/i },
  { label: 'Custodial backend coupling', pattern: /memphis-zoo-mcp/i },
  { label: 'Custodial scan API coupling', pattern: /\/scan-api\//i },
  { label: 'Custodial storage namespace', pattern: /\bmz_scan_[a-z0-9_:-]*/i },
  { label: 'Custodial schedule table', pattern: /\bdaily_schedule_assignments\b/i },
  { label: 'Custodial scan table', pattern: /\bscan_events\b/i },
  { label: 'Custodial shift table', pattern: /\bemployee_shift_templates\b/i },
  { label: 'Custodial device identity field', pattern: /\bmessenger_user_id\b/i }
];

async function walk(directory, files = []) {
  for (const entry of await readdir(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path, files);
    else if (info.isFile() && scannedExtensions.has(extname(entry))) files.push(path);
  }
  return files;
}

const violations = [];
for (const file of await walk(projectRoot)) {
  const localPath = relative(projectRoot, file).replaceAll('\\', '/');
  if (ignoredFiles.has(localPath)) continue;
  const content = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    const match = content.match(rule.pattern);
    if (match) violations.push({ file: localPath, rule: rule.label, match: match[0] });
  }
}

if (violations.length) {
  console.error('Infrastructure-map separation boundary failed.');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.rule} (${JSON.stringify(violation.match)})`);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  boundary: 'standalone-infrastructure-map',
  files_scanned: (await walk(projectRoot)).length
}, null, 2));
