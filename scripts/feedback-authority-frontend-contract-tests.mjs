#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../system-feedback.html', import.meta.url), 'utf8');
const submit = source.slice(source.indexOf('async function submit(event)'), source.indexOf("els.form.addEventListener('submit'"));

assert.match(submit, /isNativeCustodialAuthority\(\) && state\.hub === 'employee' && !state\.deviceId/);
assert.match(submit, /const identityHeaders = state\.hub === 'manager' \? await managerHeaders\(\) : \{\}/);
assert.match(submit, /credentials: 'include'/);
assert.match(submit, /\.\.\.identityHeaders/);
assert.match(submit, /hub_context: state\.hub/);
assert.match(submit, /device_id: state\.deviceId/);

const bridge = readFileSync(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8');
assert.match(bridge, /window\.fetch = bridgeFetch/);
assert.match(bridge, /dispatchAuthorizedTransport/);
assert.doesNotMatch(bridge, /publicUnauthenticatedRoute[\s\S]{0,500}feedback-api/,
  'Custodial feedback must continue through native enrolled-device transport');

const viewerHtml = readFileSync(new URL('../ops-viewer.html', import.meta.url), 'utf8');
const viewerScript = readFileSync(new URL('../ops-viewer.js', import.meta.url), 'utf8');
const releaseManifest = JSON.parse(readFileSync(new URL('../frontend-release-manifest.json', import.meta.url), 'utf8'));
assert.equal(releaseManifest.api_contract_versions.feedback, 'feedback.v3.enrolled-authority');
assert.deepEqual(
  [...viewerHtml.matchAll(/data-panel="([^"]+)"/g)].map((match) => match[1]),
  ['dashboard', 'events'],
  'Read Only Viewer must expose exactly Dashboard and Events',
);
assert.doesNotMatch(viewerHtml, /Feedback|<form|<textarea|<select|type=["']submit["']/i);
assert.doesNotMatch(viewerScript, /feedback-api\/submit|method\s*:\s*["']POST["']/i);

console.log('FEEDBACK_AUTHORITY_FRONTEND_CONTRACT_PASS');
