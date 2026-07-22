#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const map = JSON.parse(readFileSync(resolve(root, 'quality/system-impact-map.json'), 'utf8'));
const args = process.argv.slice(2);
let filesPath = '';
let outPath = '';
let markdownPath = '';
let strict = false;
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value === '--files') filesPath = args[++index] || '';
  else if (value === '--out') outPath = args[++index] || '';
  else if (value === '--markdown') markdownPath = args[++index] || '';
  else if (value === '--strict') strict = true;
  else positional.push(value);
}

function normalizeFile(value) {
  return String(value || '').trim().replace(/^\.\//, '').replaceAll('\\', '/');
}

function globToRegex(glob) {
  let source = '^';
  const value = normalizeFile(glob);
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${source}$`);
}

function readChangedFiles() {
  if (filesPath) return readFileSync(resolve(process.cwd(), filesPath), 'utf8').split(/\r?\n/);
  if (positional.length) return positional;
  if (process.env.CHANGED_FILES) return process.env.CHANGED_FILES.split(/\r?\n/);
  try {
    return execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/);
  } catch {
    return [];
  }
}

const files = [...new Set(readChangedFiles().map(normalizeFile).filter(Boolean))].sort();
const compiled = map.components.map((component) => ({
  ...component,
  regexes: (component.patterns || []).map(globToRegex),
}));
const direct = new Set();
const fileMatches = {};
for (const file of files) {
  const matches = compiled.filter((component) => component.regexes.some((regex) => regex.test(file))).map((component) => component.id);
  fileMatches[file] = matches;
  for (const id of matches) direct.add(id);
}

const impacted = new Set(direct);
let changed = true;
while (changed) {
  changed = false;
  for (const component of compiled) {
    if (impacted.has(component.id)) continue;
    if ((component.depends_on || []).some((dependency) => impacted.has(dependency))) {
      impacted.add(component.id);
      changed = true;
    }
  }
}

const suites = new Set();
const invariants = new Set();
let highestRisk = 'medium';
const riskRank = { medium: 1, high: 2, critical: 3 };
for (const component of compiled.filter((row) => impacted.has(row.id))) {
  for (const suite of component.required_suites || []) suites.add(suite);
  for (const invariant of component.invariants || []) invariants.add(invariant);
  if (riskRank[component.risk] > riskRank[highestRisk]) highestRisk = component.risk;
}

const ignoredPrefixes = map.ignored_path_prefixes || [];
const productionExtensions = new Set(map.production_file_extensions || []);
const unmappedProductionFiles = files.filter((file) => {
  if (fileMatches[file]?.length) return false;
  if (ignoredPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  return productionExtensions.has(extname(file));
});

const report = {
  ok: !strict || unmappedProductionFiles.length === 0,
  generated_at: new Date().toISOString(),
  map_schema_version: map.schema_version,
  changed_files: files,
  direct_components: [...direct].sort(),
  impacted_components: [...impacted].sort(),
  highest_risk: impacted.size ? highestRisk : 'none',
  required_suites: [...suites].sort().map((id) => ({ id, ...map.suites[id] })),
  affected_invariants: [...invariants].sort(),
  unmapped_production_files: unmappedProductionFiles,
  file_matches: fileMatches,
};

const markdown = [
  '# Change-impact report',
  '',
  `Generated: ${report.generated_at}`,
  `Highest risk: **${report.highest_risk}**`,
  '',
  '## Direct components',
  ...(report.direct_components.length ? report.direct_components.map((value) => `- ${value}`) : ['- None detected']),
  '',
  '## Downstream impacted components',
  ...(report.impacted_components.length ? report.impacted_components.map((value) => `- ${value}`) : ['- None detected']),
  '',
  '## Required suites',
  ...(report.required_suites.length ? report.required_suites.map((suite) => `- ${suite.id} — ${suite.status}; ${suite.cadence}`) : ['- None detected']),
  '',
  '## Affected invariants',
  ...(report.affected_invariants.length ? report.affected_invariants.map((value) => `- ${value}`) : ['- None detected']),
  '',
  '## Unmapped production files',
  ...(report.unmapped_production_files.length ? report.unmapped_production_files.map((value) => `- ${value}`) : ['- None']),
  '',
].join('\n');

function write(path, content) {
  if (!path) return;
  const absolute = resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
write(outPath, `${JSON.stringify(report, null, 2)}\n`);
write(markdownPath, markdown);
console.log(JSON.stringify(report, null, 2));
if (strict && unmappedProductionFiles.length) process.exitCode = 2;
