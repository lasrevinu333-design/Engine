#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION = '1.0.0';

export const CUSTODIAL_CAPACITOR_PLUGIN_PAIRS = deepFreeze([
  {
    pkg: '@memphis-zoo/custodial-native-vault',
    classpath: 'org.memphiszoo.custodial.vault.CustodialNativeVaultPlugin',
  },
  {
    pkg: '@capacitor-firebase/messaging',
    classpath: 'io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin',
  },
  {
    pkg: '@capacitor/app',
    classpath: 'com.capacitorjs.plugins.app.AppPlugin',
  },
  {
    pkg: '@capacitor/barcode-scanner',
    classpath: 'com.capacitorjs.barcodescanner.CapacitorBarcodeScannerPlugin',
  },
  {
    pkg: '@capacitor/local-notifications',
    classpath: 'com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin',
  },
  {
    pkg: '@capacitor/network',
    classpath: 'com.capacitorjs.plugins.network.NetworkPlugin',
  },
  {
    pkg: '@capacitor/status-bar',
    classpath: 'com.capacitorjs.plugins.statusbar.StatusBarPlugin',
  },
]);

export const CUSTODIAL_NATIVE_VAULT_PACKAGE = CUSTODIAL_CAPACITOR_PLUGIN_PAIRS[0].pkg;
export const CUSTODIAL_NATIVE_VAULT_CLASS = CUSTODIAL_CAPACITOR_PLUGIN_PAIRS[0].classpath;

function expectedCustodialConfig() {
  return {
    appId: 'org.memphiszoo.custodial',
    appName: 'Memphis Zoo Custodial',
    webDir: 'mobile-dist',
    backgroundColor: '#04181e',
    loggingBehavior: 'debug',
    includePlugins: CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.map(({ pkg }) => pkg),
    server: {
      hostname: 'localhost',
      androidScheme: 'https',
      cleartext: false,
      appStartPath: '/app-shell.html',
    },
    android: {
      backgroundColor: '#04181e',
      zoomEnabled: true,
      allowMixedContent: false,
      useLegacyBridge: false,
      resolveServiceWorkerRequests: true,
      webContentsDebuggingEnabled: false,
    },
    plugins: {
      StatusBar: {
        style: 'DARK',
        backgroundColor: '#04181e',
        overlaysWebView: false,
      },
      SystemBars: {
        insetsHandling: 'css',
        style: 'DARK',
        hidden: false,
        animation: 'NONE',
      },
      FirebaseMessaging: {
        presentationOptions: ['alert', 'badge', 'sound'],
      },
    },
  };
}

export const CUSTODIAL_CAPACITOR_CONFIG = deepFreeze(expectedCustodialConfig());
export const CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256 = sha256(
  JSON.stringify(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS),
);
export const CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256 = sha256(
  JSON.stringify(CUSTODIAL_CAPACITOR_CONFIG),
);

function jsonInputText(input, label) {
  if (typeof input === 'string') return input;
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    throw new Error(`${label} must be supplied as exact UTF-8 bytes`);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

// JSON.parse accepts duplicate object keys and silently keeps the last value. These files are
// security inputs, so use a small complete JSON parser that rejects duplicates before validation.
export function parseDeterministicJson(input, label = 'JSON input') {
  const source = jsonInputText(input, label);
  let offset = 0;

  const fail = (message) => {
    throw new Error(`${label} ${message} at byte ${Buffer.byteLength(source.slice(0, offset), 'utf8')}`);
  };
  const whitespace = () => {
    while (/\s/.test(source[offset] || '') && /[\u0009\u000a\u000d\u0020]/.test(source[offset])) offset += 1;
  };
  const stringValue = () => {
    if (source[offset] !== '"') fail('must contain a JSON string');
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      const code = source.charCodeAt(offset);
      if (source[offset] === '"') {
        offset += 1;
        try {
          return JSON.parse(source.slice(start, offset));
        } catch {
          fail('contains an invalid JSON string');
        }
      }
      if (code < 0x20) fail('contains an unescaped control character');
      if (source[offset] === '\\') {
        offset += 1;
        if (offset >= source.length || !/["\\/bfnrtu]/.test(source[offset])) {
          fail('contains an invalid JSON escape');
        }
        if (source[offset] === 'u') {
          const escape = source.slice(offset + 1, offset + 5);
          if (!/^[a-fA-F0-9]{4}$/.test(escape)) fail('contains an invalid Unicode escape');
          offset += 4;
        }
      }
      offset += 1;
    }
    fail('contains an unterminated JSON string');
  };
  const numberValue = () => {
    const match = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail('contains an invalid JSON number');
    offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      fail('contains a non-deterministic JSON number');
    }
    return value;
  };
  const value = () => {
    whitespace();
    if (source[offset] === '"') return stringValue();
    if (source[offset] === '[') {
      offset += 1;
      whitespace();
      const result = [];
      if (source[offset] === ']') {
        offset += 1;
        return result;
      }
      while (true) {
        result.push(value());
        whitespace();
        if (source[offset] === ']') {
          offset += 1;
          return result;
        }
        if (source[offset] !== ',') fail('must separate array values with one comma');
        offset += 1;
      }
    }
    if (source[offset] === '{') {
      offset += 1;
      whitespace();
      const result = Object.create(null);
      if (source[offset] === '}') {
        offset += 1;
        return result;
      }
      while (true) {
        whitespace();
        const key = stringValue();
        if (Object.hasOwn(result, key)) fail(`repeats the JSON key ${JSON.stringify(key)}`);
        whitespace();
        if (source[offset] !== ':') fail('must separate an object key and value with one colon');
        offset += 1;
        result[key] = value();
        whitespace();
        if (source[offset] === '}') {
          offset += 1;
          return result;
        }
        if (source[offset] !== ',') fail('must separate object members with one comma');
        offset += 1;
      }
    }
    for (const [literal, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, offset)) {
        offset += literal.length;
        return parsed;
      }
    }
    if (source[offset] === '-' || /\d/.test(source[offset] || '')) return numberValue();
    fail('contains an unsupported JSON value');
  };

  whitespace();
  if (offset === source.length) fail('must not be empty');
  const result = value();
  whitespace();
  if (offset !== source.length) fail('contains trailing data');
  return result;
}

function assertExactValue(actual, expected, label) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) throw new Error(`${label} must be an array`);
    if (actual.length !== expected.length) {
      throw new Error(`${label} must contain exactly ${expected.length} entries; found ${actual.length}`);
    }
    for (let index = 0; index < expected.length; index += 1) {
      assertExactValue(actual[index], expected[index], `${label}[${index}]`);
    }
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`${label} must be an object`);
    }
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(
        `${label} keys must be exactly ${expectedKeys.join(', ')} in that order; found ${actualKeys.join(', ') || 'none'}`,
      );
    }
    for (const key of expectedKeys) assertExactValue(actual[key], expected[key], `${label}.${key}`);
    return;
  }
  if (!Object.is(actual, expected)) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}; found ${JSON.stringify(actual)}`);
  }
}

export function inspectCustodialCapacitorRuntime({
  pluginManifestBytes,
  capacitorConfigBytes,
}) {
  const pluginManifest = parseDeterministicJson(
    pluginManifestBytes,
    'Custodial assets/capacitor.plugins.json',
  );
  const config = parseDeterministicJson(
    capacitorConfigBytes,
    'Custodial assets/capacitor.config.json',
  );
  assertExactValue(
    pluginManifest,
    CUSTODIAL_CAPACITOR_PLUGIN_PAIRS,
    'Custodial Capacitor plugin manifest',
  );

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Custodial Capacitor config must contain one object');
  }
  const includePlugins = config.includePlugins;
  if (!Array.isArray(includePlugins)) {
    throw new Error('Custodial Capacitor config includePlugins must be an array');
  }
  const manifestPackages = pluginManifest.map(({ pkg }) => pkg);
  if (JSON.stringify(includePlugins) !== JSON.stringify(manifestPackages)) {
    throw new Error('Custodial Capacitor includePlugins does not match the compiled plugin manifest 1:1 in order');
  }

  const policy = CUSTODIAL_CAPACITOR_CONFIG;
  assertExactValue(config, policy, 'Custodial Capacitor config');
  const policySha256 = sha256(JSON.stringify(policy));
  return {
    plugin_count: CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.length,
    plugin_graph_sha256: CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
    plugin_manifest_sha256: sha256(pluginManifestBytes),
    capacitor_config_sha256: sha256(capacitorConfigBytes),
    capacitor_config_policy_sha256: policySha256,
    include_plugins_match_manifest: true,
  };
}
