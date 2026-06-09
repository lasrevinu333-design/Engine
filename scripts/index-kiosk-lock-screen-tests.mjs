#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('/home/eric/Projects/memphis-zoo/Engine/index.html');
const html = fs.readFileSync(file, 'utf8');

const mustContain = [
  'id="kiosk-lock-screen" class="kioskLock unlocked"',
  'function initKioskLockScreen()',
  'function resolveDeviceId()',
  'function shouldUseKioskLockScreen(options={})',
  'function relockKioskScreen(options={})',
  'window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||""));return;',
  "window.fully.bind('screenOn','handleKioskWakeRelock();');",
  'document.addEventListener(\'visibilitychange\',handleKioskVisibilityChange);',
  'function buildEmployeeHubUrl(deviceId)',
  '.kioskLock{position:fixed;inset:0;z-index:9998;display:flex;',
  'opacity:0;pointer-events:none;visibility:hidden',
  '.kiosk-locked .kioskLock:not(.unlocked){opacity:1;pointer-events:auto;visibility:visible',
  '.kioskLock.unlocked{opacity:0;pointer-events:none;visibility:hidden',
  'const shouldBindPrewarm=shouldStartLocked;',
  'function handleKioskScreenOffPrewarm(){relockKioskScreen();}',
  'if(hasScanIntent)return false'
];

const missing = mustContain.filter((needle) => !html.includes(needle));
if (missing.length) {
  console.error('Missing expected scan-page kiosk behavior strings:');
  for (const needle of missing) console.error(`- ${needle}`);
  process.exit(1);
}

console.log('index kiosk lock-screen regression: OK');
