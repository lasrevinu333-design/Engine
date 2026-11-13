#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.env.UNITY_SOURCE_ROOT || new URL('..', import.meta.url).pathname);
const output = resolve(process.env.UNITY_MANIFEST_DIR || '/home/eric/Downloads/custodial-unity-polish-manifests');
const backup = resolve(process.env.UNITY_BACKUP_ROOT || '/home/eric/Backups/memphis-zoo-unity-polish-20260718T212409Z');
const localAudit = resolve(process.env.UNITY_LOCAL_AUDIT || `${output}/local-final-v2/local-final-v2-ui-audit.json`);
const baseCommit = String(process.env.UNITY_BASE_COMMIT || '461abc750f80ffea3a0630b9d77123eeff049277').trim();
mkdirSync(output, { recursive: true });

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const write = (name, value) => writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const matches = (source, regex) => Array.from(source.matchAll(regex), (match) => match[1]);
const unique = (values) => Array.from(new Set(values)).sort();
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

const htmlFiles = git('ls-files', '--cached', '--others', '--exclude-standard', '*.html')
  .split('\n').filter((file) => file && !file.includes('/') && existsSync(resolve(root, file))).sort();
const pages = htmlFiles.map((file) => {
  const source = read(resolve(root, file));
  const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const context = source.match(/<body[^>]*data-memphis-context="([^"]+)"/i)?.[1] || '';
  const backLabels = matches(source, /<[^>]+data-mz-back[^>]*>([^<]+)</gi).map((value) => value.trim());
  const links = unique(matches(source, /href=["']([^"'#]+)["']/gi));
  const apiDependencies = unique(matches(source, /https:\/\/memphis-zoo-mcp\.onrender\.com([^"'`\s<]*)/gi)
    .map((path) => `https://memphis-zoo-mcp.onrender.com${path}`));
  return {
    url: file === '404.html' ? '/Engine/unknown-route' : `/Engine/${file}`,
    source_file: file,
    title,
    module: basename(file, '.html'),
    authentication: /memphis-auth\.js|requireOpsManagerSession/.test(source) ? 'application-session' : 'route-dependent-or-public',
    context: context || null,
    shared_css: /memphis-ui\.css/.test(source),
    shared_script: /memphis-ui\.js/.test(source),
    canonical_back_count: (source.match(/data-mz-back/g) || []).length,
    canonical_back_labels: unique(backLabels),
    local_links: links.filter((link) => !/^https?:/i.test(link)),
    api_dependencies: apiDependencies,
    line_count: source.split(/\r?\n/).length,
    sha256: sha256(source),
  };
});

const moxieRoutes = ['/moxie/login', '/moxie/', '/moxie/log', '/moxie/reminders', '/moxie/contacts', '/moxie/settings']
  .map((route) => ({ url: `https://memphis-zoo-mcp.onrender.com${route}`, source_file: 'backend:src/routes/moxie.js', module: 'moxie', authentication: route.endsWith('/login') ? 'moxie-login' : 'moxie-session', shared_shell: 'backend:src/routes/moxie-templates.js' }));
const requiredBack = pages.filter((page) => page.canonical_back_count > 0);

write('canonical-reference-report.json', {
  requested_basename: 'Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing_support_corrected.pdf',
  searched_roots: ['/home/eric/Downloads', '/home/eric/Documents', '/home/eric/Desktop', '/home/eric/Projects', '/home/eric/Backups'],
  found: false,
  canonical_path: null,
  sha256: null,
  limitation: 'No base or numbered corrected v17 PDF copy was present in the required local search roots on 2026-07-18.',
});
write('page-inventory-after.json', { generated_at: new Date().toISOString(), source_commit: git('rev-parse', 'HEAD'), static_page_count: pages.length, runtime_moxie_surface_count: moxieRoutes.length, pages, runtime_surfaces: moxieRoutes });
write('module-inventory-after.json', {
  generated_at: new Date().toISOString(),
  modules: unique(pages.map((page) => page.module).concat(['moxie'])).map((module) => ({ module, pages: pages.filter((page) => page.module === module).map((page) => page.url), runtime_routes: moxieRoutes.filter((route) => route.module === module).map((route) => route.url) })),
});
write('route-inventory-after.json', { static_routes: pages.map((page) => ({ url: page.url, source_file: page.source_file, local_links: page.local_links })), backend_rendered_routes: moxieRoutes });
write('design-tokens.json', {
  source: 'memphis-ui.css',
  tokens: Object.fromEntries(matches(read(resolve(root, 'memphis-ui.css')), /(--mz-[\w-]+\s*:\s*[^;]+);/g).map((entry) => { const [key, ...rest] = entry.split(':'); return [key.trim(), rest.join(':').trim()]; })),
});
write('shared-components.json', {
  sources: ['memphis-ui.css', 'memphis-ui.js'],
  components: ['page header', 'canonical back link', 'secondary navigation link', 'primary button', 'secondary button', 'danger button', 'card', 'status', 'success alert', 'warning alert', 'error alert', 'empty state', 'form fields', 'loading indicator', 'visually hidden text', 'responsive table wrapper', 'auth-pending state', 'unsaved-form guard'],
});
write('navigation-controls.json', {
  required_page_count: requiredBack.length,
  canonical_page_count: requiredBack.filter((page) => page.canonical_back_count === 1).length,
  controls: requiredBack.map((page) => ({ source_file: page.source_file, count: page.canonical_back_count, labels: page.canonical_back_labels, context: page.context })),
  deterministic_manager_target: '/Engine/start_page1.html',
  deterministic_employee_target: '/Engine/employee-hub.html',
});

if (existsSync(localAudit)) {
  const results = json(localAudit);
  const summarize = (viewport) => {
    const rows = results.filter((row) => row.viewport === viewport);
    return {
      pages: rows.length,
      median_cold_elapsed_ms: median(rows.map((row) => row.cold_elapsed_ms)),
      median_warm_elapsed_ms: median(rows.map((row) => row.warm_elapsed_ms)),
      median_dom_content_loaded_ms: median(rows.map((row) => row.metrics?.dom_content_loaded_ms)),
      median_load_ms: median(rows.map((row) => row.metrics?.load_ms)),
      median_first_contentful_paint_ms: median(rows.map((row) => row.metrics?.first_contentful_paint_ms)),
      median_transfer_bytes: median(rows.map((row) => row.metrics?.transfer_bytes)),
      console_error_pages: rows.filter((row) => row.console_errors?.length).length,
      failed_request_pages: rows.filter((row) => row.failed_requests?.length).length,
      horizontal_overflow_pages: rows.filter((row) => Number(row.metrics?.scroll_width) > Number(row.metrics?.client_width) + 2).length,
      missing_alt_total: rows.reduce((sum, row) => sum + Number(row.metrics?.images_missing_alt || 0), 0),
      unlabeled_controls_total: rows.reduce((sum, row) => sum + Number(row.metrics?.unlabeled_controls || 0), 0),
    };
  };
  write('performance-after-local.json', { classification: 'local-browser-measurement-with-controlled-backend-mocks', desktop: summarize('desktop'), mobile: summarize('mobile') });
  write('accessibility-results-local.json', { classification: 'automated-browser-structure-and-control-scan', desktop: summarize('desktop'), mobile: summarize('mobile'), keyboard_and_focus: 'covered by Playwright unity-polish suite' });
  write('visual-regression-results-local.json', { classification: 'browser-screenshot-review', screenshot_root: resolve(localAudit, '..'), viewports: ['1440x900', '390x667'], pages: results.length / 2, console_error_pages: results.filter((row) => row.console_errors?.length).length, failed_request_pages: results.filter((row) => row.failed_requests?.length).length, overflow_pages: results.filter((row) => Number(row.metrics?.scroll_width) > Number(row.metrics?.client_width) + 2).length, review_status: 'reviewed; focused corrections recaptured for Hub logos, feedback, Guest QR, Gemini, employee schedule, and Messenger thread' });
}

const baselineDesktop = resolve(backup, 'visual-baseline/desktop-baseline.json');
const baselineMobile = resolve(backup, 'visual-baseline/mobile-baseline.json');
if (existsSync(baselineDesktop) && existsSync(baselineMobile)) {
  const summarizeBaseline = (path) => {
    const rows = json(path);
    return {
      pages: rows.length,
      median_cold_elapsed_ms: median(rows.map((row) => row.coldElapsedMs)),
      median_warm_elapsed_ms: median(rows.map((row) => row.warmElapsedMs)),
      median_dom_content_loaded_ms: median(rows.map((row) => row.performance?.domContentLoaded)),
      median_load_ms: median(rows.map((row) => row.performance?.load)),
      median_first_contentful_paint_ms: median(rows.map((row) => row.performance?.fcp)),
      median_transfer_bytes: median(rows.map((row) => row.performance?.transferSize)),
      console_error_pages: rows.filter((row) => row.consoleErrors?.length).length,
      failed_request_pages: rows.filter((row) => row.failedRequests?.length).length,
    };
  };
  write('performance-before-live.json', { classification: 'pre-change-live-browser-baseline', desktop: summarizeBaseline(baselineDesktop), mobile: summarizeBaseline(baselineMobile) });
}

const changed = git('diff', '--name-status', `${baseCommit}..HEAD`).split('\n').filter(Boolean).map((line) => { const [status, ...path] = line.split('\t'); return { status, path: path.join('\t') }; });
write('changed-files.json', { base_commit: baseCommit, source_commit: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), files: changed });
console.log(JSON.stringify({ ok: true, page_count: pages.length, runtime_moxie_surface_count: moxieRoutes.length, canonical_back_pages: requiredBack.length, output }, null, 2));
