#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('/home/eric/Projects/memphis-zoo/Engine/index.html');
const html = fs.readFileSync(file, 'utf8');

const mustContain = [
  'id="kiosk-lock-screen"',
  'function initKioskLockScreen()',
  'function shouldUseKioskLockScreen()',
  'function relockKioskScreen()',
  'window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||""));return;',
  "window.fully.bind('screenOn','handleKioskWakeRelock();');",
  'document.addEventListener(\'visibilitychange\',handleKioskVisibilityChange);',
  'function buildEmployeeHubUrl(deviceId)'
];

const missing = mustContain.filter((needle) => !html.includes(needle));
if (missing.length) {
  console.error('Missing expected scan-page kiosk behavior strings:');
  for (const needle of missing) console.error(`- ${needle}`);
  process.exit(1);
}

console.log('index kiosk lock-screen regression: OK');
