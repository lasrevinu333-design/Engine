#!/usr/bin/env node
// Fixed source/synthetic regression lane. This is not release or phone admission.
import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
const scriptPath = fileURLToPath(import.meta.url);
export const CORE_ROOT = resolve(dirname(scriptPath), '..');
export const CORE_SUITES = Object.freeze([
  'scan-device-employee-default-tests',
  'oc24-completion-form-tests',
  'verified-check-completion-tests',
  'custodial-scan-recovery-classification-tests',
  'custodial-completion-draft-recovery-tests',
  'scan-outage-retry-tests',
  'scan-outage-storage-fence-tests',
  'scan-retry-after-tests',
  'scan-retry-migration-tests',
  'dashboard-verified-scan-readback-tests',
  'active-gps-lifecycle-tests',
  'active-gps-build-contract-tests',
  'gps-calibration-integrity-tests',
  'custodial-initial-release-scope-tests',
  'custodial-navigation-assets-tests',
  'custodial-original-home-dom-tests',
  'custodial-home-facts-tests',
  'recurring-schedule-target-tests',
  'employee-schedule-recurring-delivery-tests',
  'employee-schedule-application-receipt-tests',
  'employee-schedule-cache-resilience-tests',
  'employee-schedule-section-tests',
  'home-schedule-v8-regression-tests',
  'home-schedule-v9-regression-tests',
  'home-schedule-v10-regression-tests',
  'home-schedule-v11-regression-tests',
  'home-schedule-v12-regression-tests',
  'home-schedule-v13-regression-tests',
  'home-schedule-v14-regression-tests',
  'home-schedule-v15-regression-tests',
  'home-schedule-v16-regression-tests',
  'home-schedule-v17-regression-tests',
  'home-schedule-v18-regression-tests',
  'notification-page-error-fence-tests',
  'notification-integration-v2-regression-tests',
  'notification-integration-v3-regression-tests',
  'notification-schedule-authority-tests',
  'notification-schedule-cache-authority-tests',
  'notification-response-fence-tests',
  'notification-browser-authority-tests',
  'notification-reentrant-security-tests',
  'native-notification-arrival-boundary-tests',
  'notification-ownership-principal-settlement-tests',
  'notification-schedule-ownership-tests',
].map(name => `scripts/${name}.mjs`));
export const CORE_SUITE_TIMEOUT_MS = 45_000;
export const CORE_TOTAL_TIMEOUT_MS = 600_000;
export function coreChildEnvironment(environment = process.env) {
  // Do not inherit baseline, optional database, npm, or Node preload overrides.
  return {
    PATH: `${dirname(process.execPath)}${delimiter}/usr/bin:/bin`,
    ...(environment.HOME ? { HOME: environment.HOME } : {}),
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'America/Chicago',
  };
}
export function runCoreReleaseGate({ execute = spawnSync, log = console.log,
  clock = () => performance.now(), inspect = lstatSync } = {}) {
  // Validate the complete inventory before executing any suite; never skip one.
  for (const suite of CORE_SUITES) {
    const metadata = inspect(resolve(CORE_ROOT, suite));
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Core suite is not a regular source file: ${suite}`);
    }
  }
  const started = clock();
  for (const [index, suite] of CORE_SUITES.entries()) {
    const remaining = CORE_TOTAL_TIMEOUT_MS - (clock() - started);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      throw new Error(`Core regression time budget exhausted before ${suite}`);
    }
    log(`CORE_SUITE ${index + 1}/${CORE_SUITES.length} ${suite}`);
    let result;
    try {
      result = execute(process.execPath, [resolve(CORE_ROOT, suite)], {
        cwd: CORE_ROOT, shell: false, encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'], env: coreChildEnvironment(),
        timeout: Math.min(CORE_SUITE_TIMEOUT_MS, Math.ceil(remaining)),
        killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
      });
    } catch (error) {
      throw new Error(`Core suite launch failed: ${suite}`, { cause: error });
    }
    if (result?.stdout) log(String(result.stdout).trimEnd());
    if (result?.stderr) log(String(result.stderr).trimEnd());
    if (!result || result.error || result.signal || result.status !== 0) {
      throw new Error(`Core suite failed: ${suite}; exit=${result?.status ?? 'unknown'}; `
        + `signal=${result?.signal || 'none'}; error=${result?.error?.message || 'none'}`);
    }
    const elapsed = clock() - started;
    if (!Number.isFinite(elapsed) || elapsed >= CORE_TOTAL_TIMEOUT_MS) {
      throw new Error(`Core regression time budget exhausted after ${suite}`);
    }
  }
  const summary = Object.freeze({ ok: true, suites: CORE_SUITES.length,
    scope: 'source and synthetic regression only', independent_acceptance: false,
    build_authorized: false, physical_proof: false });
  log(JSON.stringify(summary));
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    if (process.argv.length !== 2) throw new Error('Core release gate accepts no subset or skip arguments.');
    runCoreReleaseGate();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
