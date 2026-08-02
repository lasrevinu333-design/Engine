#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256,
  CUSTODIAL_CAPACITOR_CONFIG,
  CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_PAIRS,
  inspectCustodialCapacitorRuntime,
  parseDeterministicJson,
} from './custodial-capacitor-runtime-policy.mjs';

const bytes = (value) => Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
const clone = (value) => JSON.parse(JSON.stringify(value));
const validPlugins = () => clone(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS);
const validConfig = () => clone(CUSTODIAL_CAPACITOR_CONFIG);
const inspect = (plugins = validPlugins(), config = validConfig()) => (
  inspectCustodialCapacitorRuntime({
    pluginManifestBytes: Buffer.isBuffer(plugins) ? plugins : bytes(plugins),
    capacitorConfigBytes: Buffer.isBuffer(config) ? config : bytes(config),
  })
);

assert.equal(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.length, 7);
assert.equal(Object.isFrozen(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS), true);
assert.equal(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.every(Object.isFrozen), true);
assert.match(CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256, /^[a-f0-9]{64}$/);
assert.match(CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256, /^[a-f0-9]{64}$/);

const proof = inspect();
assert.equal(proof.plugin_count, 7);
assert.equal(proof.plugin_graph_sha256, CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256);
assert.equal(proof.capacitor_config_policy_sha256, CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256);
assert.equal(proof.include_plugins_match_manifest, true);
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.server.appStartPath, '/app-shell.html');
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.server.cleartext, false);
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.android.allowMixedContent, false);
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.android.useLegacyBridge, false);
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.android.resolveServiceWorkerRequests, true);
assert.equal(CUSTODIAL_CAPACITOR_CONFIG.android.webContentsDebuggingEnabled, false);
for (const omitted of ['ios', 'experimental', 'cordova']) {
  assert.equal(Object.hasOwn(CUSTODIAL_CAPACITOR_CONFIG, omitted), false);
}
assert.equal(Object.hasOwn(CUSTODIAL_CAPACITOR_CONFIG.server, 'iosScheme'), false);

{
  const plugins = validPlugins();
  plugins.push({ pkg: '@unreviewed/plugin', classpath: 'example.UnreviewedPlugin' });
  assert.throws(() => inspect(plugins), /must contain exactly 7 entries/);
}
{
  const plugins = validPlugins();
  plugins.push({ ...plugins[0] });
  assert.throws(() => inspect(plugins), /must contain exactly 7 entries/);
}
{
  const plugins = validPlugins();
  [plugins[0], plugins[1]] = [plugins[1], plugins[0]];
  assert.throws(() => inspect(plugins), /plugin manifest\[0\]\.pkg must equal/);
}
{
  const plugins = validPlugins();
  plugins[0].classpath = 'org.memphiszoo.custodial.vault.WrongPlugin';
  assert.throws(() => inspect(plugins), /plugin manifest\[0\]\.classpath must equal/);
}
{
  const [first, ...rest] = validPlugins();
  const reorderedKeys = Buffer.from(`${JSON.stringify([
    { classpath: first.classpath, pkg: first.pkg },
    ...rest,
  ], null, '\t')}\n`);
  assert.throws(() => inspect(reorderedKeys), /keys must be exactly pkg, classpath in that order/);
}
{
  const plugins = validPlugins();
  plugins[0].unexpected = true;
  assert.throws(() => inspect(plugins), /keys must be exactly pkg, classpath in that order/);
}
{
  const plugins = validPlugins();
  plugins.pop();
  assert.throws(() => inspect(plugins), /must contain exactly 7 entries/);
}
{
  const pair = CUSTODIAL_CAPACITOR_PLUGIN_PAIRS[0];
  const duplicateKey = Buffer.from(
    `[{"pkg":${JSON.stringify(pair.pkg)},"pkg":${JSON.stringify(pair.pkg)},"classpath":${JSON.stringify(pair.classpath)}}]`,
  );
  assert.throws(() => inspect(duplicateKey), /repeats the JSON key "pkg"/);
}

{
  const config = validConfig();
  config.server.url = 'https://unreviewed.example';
  assert.throws(() => inspect(validPlugins(), config), /server keys must be exactly/);
}
{
  const config = validConfig();
  config.server.allowNavigation = ['*'];
  assert.throws(() => inspect(validPlugins(), config), /server keys must be exactly/);
}
{
  const config = validConfig();
  config.loggingBehavior = 'production';
  assert.throws(() => inspect(validPlugins(), config), /loggingBehavior must equal "debug"/);
}
{
  const config = validConfig();
  config.android.webContentsDebuggingEnabled = true;
  assert.throws(() => inspect(validPlugins(), config), /webContentsDebuggingEnabled must equal false/);
}
{
  const config = validConfig();
  config.android.allowMixedContent = true;
  assert.throws(() => inspect(validPlugins(), config), /allowMixedContent must equal false/);
}
{
  const config = validConfig();
  config.android.useLegacyBridge = true;
  assert.throws(() => inspect(validPlugins(), config), /useLegacyBridge must equal false/);
}
{
  const config = validConfig();
  config.android.resolveServiceWorkerRequests = false;
  assert.throws(() => inspect(validPlugins(), config), /resolveServiceWorkerRequests must equal true/);
}
{
  const config = validConfig();
  config.server.cleartext = true;
  assert.throws(() => inspect(validPlugins(), config), /cleartext must equal false/);
}
{
  const config = validConfig();
  delete config.webDir;
  assert.throws(() => inspect(validPlugins(), config), /config keys must be exactly/);
}
{
  const config = validConfig();
  config.unknownTopLevelKey = true;
  assert.throws(() => inspect(validPlugins(), config), /config keys must be exactly/);
}
{
  const config = validConfig();
  config.includePlugins[0] = '@unreviewed/mismatched-plugin';
  assert.throws(() => inspect(validPlugins(), config), /does not match the compiled plugin manifest 1:1/);
}
{
  const config = validConfig();
  const { appId, appName, ...remaining } = config;
  const reorderedConfig = { appName, appId, ...remaining };
  assert.throws(() => inspect(validPlugins(), reorderedConfig), /config keys must be exactly/);
}
{
  const configText = JSON.stringify(validConfig());
  const duplicateKey = Buffer.from(configText.replace(
    '"appId":"org.memphiszoo.custodial"',
    '"appId":"org.memphiszoo.custodial","appId":"org.memphiszoo.custodial"',
  ));
  assert.throws(() => inspect(validPlugins(), duplicateKey), /repeats the JSON key "appId"/);
}

assert.throws(
  () => parseDeterministicJson(Buffer.from([0xff]), 'invalid fixture'),
  /not valid UTF-8/,
);
assert.throws(
  () => parseDeterministicJson('{"ok":true} trailing', 'trailing fixture'),
  /contains trailing data/,
);

console.log('Custodial compiled Capacitor plugin/config policy contracts passed.');
