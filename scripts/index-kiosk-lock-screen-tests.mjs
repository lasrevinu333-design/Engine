#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../index.html');
const html = fs.readFileSync(file, 'utf8');

const mustContain = [
  'id="kiosk-lock-screen" class="kioskLock unlocked"',
  'function initKioskLockScreen()',
  'function resolveDeviceId()',
  'function shouldUseKioskLockScreen(options={})',
  'function relockKioskScreen(options={})',
  'window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||""));return',
  "window.fully.bind('screenOn','handleKioskWakeRelock();');",
  'function buildEmployeeHubUrl(deviceId)',
  '.kioskLock{position:fixed;inset:0;z-index:9998;display:flex;',
  'opacity:0;pointer-events:none;visibility:hidden',
  '.kiosk-locked .kioskLock:not(.unlocked){opacity:1;pointer-events:auto;visibility:visible',
  '.kioskLock.unlocked{opacity:0;pointer-events:none;visibility:hidden',
  'kioskScreenOffResetPending=false',
  'function hasScanIntentUrl(url=new URL(window.location.href))',
  'function shouldResetScanWorkflowToEmployeeHub()',
  'function resetScanWorkflowToEmployeeHub()',
  'const shouldBindPrewarm=shouldStartLocked||shouldResetScanWorkflowToEmployeeHub();',
  'function handleKioskScreenOffPrewarm(){kioskScreenOffResetPending=true;if(window.MemphisUI?.markPhoneScreenOff?.())return;',
  'if(hasScanIntentUrl())window.MemphisUI?.markPhoneUnlocked?.();',
  'bindFullyKioskWakeEvents();',
  'function handleKioskWakeRelock(event){const force=event?Boolean(event.persisted)||kioskScreenOffResetPending:true;if(window.MemphisUI?.handlePhoneWake?.({force}))return;',
  'async function resumeOpenSessionFromWake(sessionUuid,locationCode,deviceId)',
  'const action=decodeParam(params.get("action")||"").toLowerCase();',
  'if(action==="resume"&&sessionUuid&&await resumeOpenSessionFromWake(sessionUuid,locationCode,deviceId)){updateSyncBadge();return}',
  'if(hasScanIntentUrl(url))return false'
];

const missing = mustContain.filter((needle) => !html.includes(needle));
if (missing.length) {
  console.error('Missing expected scan-page kiosk behavior strings:');
  for (const needle of missing) console.error(`- ${needle}`);
  process.exit(1);
}

const prohibited = [
  "document.addEventListener('visibilitychange',handleKioskVisibilityChange);",
  "function handleKioskVisibilityChange(){if(document.visibilityState==='visible'",
];
const present = prohibited.filter((needle) => html.includes(needle));
if (present.length) {
  console.error('Unsafe page-visibility lock triggers remain on scan page:');
  for (const needle of present) console.error(`- ${needle}`);
  process.exit(1);
}

console.log('index kiosk lock-screen regression: OK');
