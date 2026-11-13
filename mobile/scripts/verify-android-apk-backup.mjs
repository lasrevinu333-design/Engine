#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
export const ANDROID_BACKUP_VERIFIER_VERSION = '2.0.1';
const ANDROID_RESOURCE_NAMESPACE = 'http://schemas.android.com/apk/res/android';
const requiredDomains = Object.freeze([
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
]);

function executable(path) {
  return Boolean(path && existsSync(path));
}

function pathExecutable(name) {
  for (const directory of String(process.env.PATH || '').split(delimiter)) {
    const candidate = join(directory, name);
    if (executable(candidate)) return candidate;
  }
  return null;
}

function sdkAapt2() {
  const sdkRoot = String(process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '').trim();
  const buildTools = join(sdkRoot, 'build-tools');
  if (!sdkRoot || !existsSync(buildTools)) return null;
  const versions = readdirSync(buildTools, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  for (const version of versions.reverse()) {
    const candidate = join(buildTools, version, 'aapt2');
    if (executable(candidate)) return candidate;
  }
  return null;
}

export function resolveAapt2() {
  const override = String(process.env.MZ_AAPT2 || '').trim();
  if (override) {
    if (!executable(override)) throw new Error(`MZ_AAPT2 does not exist: ${override}`);
    return override;
  }
  const resolved = pathExecutable('aapt2') || sdkAapt2();
  if (!resolved) throw new Error('Unable to locate aapt2 for compiled APK verification');
  return resolved;
}

export function compiledXmlResources(resourcesDump) {
  const resources = new Map();
  let current = null;
  for (const line of String(resourcesDump || '').split(/\r?\n/)) {
    const resource = line.match(/^\s*resource\s+(0x[0-9a-f]+)\s+([^/\s]+)\/([^\s]+)\s*$/i);
    if (resource) {
      current = null;
      if (resource[2].toLowerCase() !== 'xml') continue;
      current = { id: resource[1].toLowerCase(), name: resource[3], files: [] };
      if (resources.has(current.name)) throw new Error(`Compiled APK declares duplicate xml/${current.name}`);
      resources.set(current.name, current);
      continue;
    }
    const file = current && line.match(/^\s*\(([^)]*)\)\s+\(file\)\s+(\S+)\s+type=XML(?:\s|$)/);
    if (file) current.files.push({ configuration: file[1] || 'default', path: file[2] });
  }
  return resources;
}

function requiredResource(resources, name, expectedId) {
  const resource = resources.get(name);
  if (!resource) throw new Error(`Compiled APK does not define xml/${name}`);
  if (resource.id !== expectedId) {
    throw new Error(`android manifest ${name} reference ${expectedId} does not bind to ${resource.id}`);
  }
  if (resource.files.length !== 1) {
    throw new Error(`Compiled xml/${name} must have exactly one default file; found ${resource.files.length}`);
  }
  if (resource.files[0].configuration !== 'default') {
    throw new Error(`Compiled xml/${name} must provide an unqualified default resource`);
  }
  return resource;
}

function decodeAaptAttributeValue(encoded) {
  const value = String(encoded || '').trim();
  const raw = value.match(/\(Raw:\s+"([^"]*)"\)\s*$/)?.[1];
  if (raw !== undefined) return raw;
  const quoted = value.match(/^"([^"]*)"/)?.[1];
  if (quoted !== undefined) return quoted;
  const integer = value.match(/^\(type 0x10\)0x([0-9a-f]+)$/i)?.[1];
  if (integer !== undefined) return String(Number.parseInt(integer, 16));
  const boolean = value.match(/^\(type 0x12\)0x([0-9a-f]+)$/i)?.[1];
  if (boolean !== undefined) return Number.parseInt(boolean, 16) === 0 ? 'false' : 'true';
  return value.split(/\s+/)[0];
}

export function parseAaptXmlTree(dump) {
  const roots = [];
  const stack = [];
  for (const line of String(dump || '').split(/\r?\n/)) {
    const indent = line.match(/^\s*/)[0].length;
    const content = line.trim();
    const element = content.match(/^E:\s+([^\s(]+)/);
    if (element) {
      const node = { name: element[1], attributes: {}, children: [], text: [] };
      while (stack.length && stack.at(-1).indent >= indent) stack.pop();
      if (stack.length) stack.at(-1).node.children.push(node);
      else roots.push(node);
      stack.push({ indent, node });
      continue;
    }
    if (content.startsWith('T:') && stack.length) {
      stack.at(-1).node.text.push(content.slice(2).trim());
      continue;
    }
    if (!content.startsWith('A:') || !stack.length) continue;
    const equals = content.indexOf('=');
    if (equals < 0) throw new Error(`Malformed aapt2 attribute line: ${content}`);
    const rawName = content.slice(2, equals).trim().replace(/\([^)]*\)$/, '');
    const name = rawName.startsWith(`${ANDROID_RESOURCE_NAMESPACE}:`)
      ? `android:${rawName.slice(ANDROID_RESOURCE_NAMESPACE.length + 1)}`
      : rawName;
    const encoded = content.slice(equals + 1);
    if (Object.hasOwn(stack.at(-1).node.attributes, name)) {
      throw new Error(`Compiled XML element ${stack.at(-1).node.name} repeats attribute ${name}`);
    }
    stack.at(-1).node.attributes[name] = decodeAaptAttributeValue(encoded);
  }
  if (roots.length !== 1) throw new Error(`Compiled XML must contain exactly one root element; found ${roots.length}`);
  return roots[0];
}

function compiledManifestTree(manifestDump) {
  const root = parseAaptXmlTree(manifestDump);
  if (root.name !== 'manifest') throw new Error('Compiled Android manifest has the wrong root element');
  const applications = root.children.filter((child) => child.name === 'application');
  if (applications.length !== 1) {
    throw new Error(`Compiled Android manifest must contain exactly one application element; found ${applications.length}`);
  }
  return { root, application: applications[0] };
}

function resourceReference(application, attribute) {
  const value = application.attributes[`android:${attribute}`];
  const match = String(value || '').match(/^@(0x[0-9a-f]+)$/i);
  if (!match) throw new Error(`Compiled application must reference android:${attribute} with one resource ID`);
  return match[1].toLowerCase();
}

function requiredBoolean(attributes, name, fallback = false) {
  const attribute = `android:${name}`;
  if (!Object.hasOwn(attributes, attribute)) return fallback;
  const value = attributes[attribute];
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Compiled Android boolean ${name} has unsupported value ${value}`);
  }
  return value === 'true';
}

export function parseCompiledAndroidManifestMetadata(manifestDump) {
  const { root, application } = compiledManifestTree(manifestDump);
  const versionCode = Number(root.attributes['android:versionCode']);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
    throw new Error('Compiled Android manifest has an invalid versionCode');
  }
  const packageName = String(root.attributes.package || '').trim();
  const versionName = String(root.attributes['android:versionName'] || '').trim();
  if (!packageName) throw new Error('Compiled Android manifest is missing its package name');
  if (!versionName) throw new Error('Compiled Android manifest is missing its versionName');
  const usesSdk = root.children.filter((child) => child.name === 'uses-sdk');
  if (usesSdk.length !== 1) {
    throw new Error(`Compiled Android manifest must contain exactly one uses-sdk element; found ${usesSdk.length}`);
  }
  const minSdkVersion = Number(usesSdk[0].attributes['android:minSdkVersion']);
  const targetSdkVersion = Number(usesSdk[0].attributes['android:targetSdkVersion']);
  if (!Number.isSafeInteger(minSdkVersion) || minSdkVersion < 1) {
    throw new Error('Compiled Android manifest has an invalid minSdkVersion');
  }
  if (!Number.isSafeInteger(targetSdkVersion) || targetSdkVersion < minSdkVersion) {
    throw new Error('Compiled Android manifest has an invalid targetSdkVersion');
  }
  return {
    package_name: packageName,
    version_code: versionCode,
    version_name: versionName,
    min_sdk_version: minSdkVersion,
    target_sdk_version: targetSdkVersion,
    debuggable: requiredBoolean(application.attributes, 'debuggable'),
    test_only: requiredBoolean(application.attributes, 'testOnly'),
  };
}

function assertNoAttributes(node) {
  const names = Object.keys(node.attributes);
  if (names.length) throw new Error(`Compiled ${node.name} must not declare attributes: ${names.join(', ')}`);
  if (node.text.length) throw new Error(`Compiled ${node.name} must not contain text`);
}

function assertDenyAllExclusions(node, context) {
  assertNoAttributes(node);
  if (node.children.length !== requiredDomains.length) {
    throw new Error(`${context} must contain exactly ${requiredDomains.length} exclusions; found ${node.children.length}`);
  }
  const domains = [];
  for (const child of node.children) {
    if (child.name !== 'exclude' || child.children.length || child.text.length) throw new Error(`${context} may contain only empty exclude elements`);
    const names = Object.keys(child.attributes).sort();
    if (JSON.stringify(names) !== JSON.stringify(['domain', 'path'])) {
      throw new Error(`${context} exclusions must declare only domain and path`);
    }
    if (child.attributes.path !== '.') throw new Error(`${context} exclusion ${child.attributes.domain} must use path="."`);
    domains.push(child.attributes.domain);
  }
  const actual = [...new Set(domains)].sort();
  const expected = [...requiredDomains].sort();
  if (domains.length !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${context} domains differ from the immutable deny-all policy`);
  }
}

function semanticSha256(node) {
  return createHash('sha256').update(JSON.stringify(node)).digest('hex');
}

export function assertCompiledAndroidBackupSecurity({
  manifestDump,
  resourcesDump,
  legacyRulesDump,
  extractionRulesDump,
}) {
  const { application } = compiledManifestTree(manifestDump);
  if (application.attributes['android:allowBackup'] !== 'false') {
    throw new Error('Compiled APK does not set android:allowBackup=false');
  }
  const legacyId = resourceReference(application, 'fullBackupContent');
  const extractionId = resourceReference(application, 'dataExtractionRules');
  const resources = compiledXmlResources(resourcesDump);
  const legacyResource = requiredResource(resources, 'memphis_zoo_backup_rules', legacyId);
  const extractionResource = requiredResource(resources, 'memphis_zoo_data_extraction_rules', extractionId);

  const legacyRoot = parseAaptXmlTree(legacyRulesDump);
  if (legacyRoot.name !== 'full-backup-content') throw new Error('Legacy backup rules have the wrong root element');
  assertDenyAllExclusions(legacyRoot, 'Legacy backup policy');

  const extractionRoot = parseAaptXmlTree(extractionRulesDump);
  if (extractionRoot.name !== 'data-extraction-rules') throw new Error('Android 12+ rules have the wrong root element');
  assertNoAttributes(extractionRoot);
  if (extractionRoot.children.length !== 2
      || extractionRoot.children[0].name !== 'cloud-backup'
      || extractionRoot.children[1].name !== 'device-transfer') {
    throw new Error('Android 12+ rules must contain exactly cloud-backup then device-transfer');
  }
  assertDenyAllExclusions(extractionRoot.children[0], 'Cloud backup policy');
  assertDenyAllExclusions(extractionRoot.children[1], 'Device-transfer policy');

  return {
    verifier_version: ANDROID_BACKUP_VERIFIER_VERSION,
    policy: 'deny-cloud-backup-and-device-transfer',
    allow_backup: false,
    excluded_domains: [...requiredDomains],
    legacy_resource: {
      id: legacyResource.id,
      logical_name: 'xml/memphis_zoo_backup_rules',
      packaged_path: legacyResource.files[0].path,
      semantic_sha256: semanticSha256(legacyRoot),
    },
    data_extraction_resource: {
      id: extractionResource.id,
      logical_name: 'xml/memphis_zoo_data_extraction_rules',
      packaged_path: extractionResource.files[0].path,
      semantic_sha256: semanticSha256(extractionRoot),
    },
  };
}

export function verifyAndroidApkBackupSecurity(apkPath, { aapt2Path } = {}) {
  const apk = resolve(apkPath);
  if (!existsSync(apk)) throw new Error(`APK does not exist: ${apk}`);
  const aapt2 = aapt2Path ? resolve(aapt2Path) : resolveAapt2();
  if (!executable(aapt2)) throw new Error(`Unable to execute aapt2: ${aapt2}`);
  const command = (args, maxBuffer = 32 * 1024 * 1024) => execFileSync(
    aapt2,
    args,
    {
      encoding: 'utf8',
      env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
      maxBuffer,
      timeout: 120_000,
    },
  );
  const manifestDump = command(['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']);
  const resourcesDump = command(['dump', 'resources', apk], 64 * 1024 * 1024);
  const resources = compiledXmlResources(resourcesDump);
  const { application } = compiledManifestTree(manifestDump);
  const legacyId = resourceReference(application, 'fullBackupContent');
  const extractionId = resourceReference(application, 'dataExtractionRules');
  const legacyResource = requiredResource(resources, 'memphis_zoo_backup_rules', legacyId);
  const extractionResource = requiredResource(resources, 'memphis_zoo_data_extraction_rules', extractionId);
  const legacyRulesDump = command(['dump', 'xmltree', apk, '--file', legacyResource.files[0].path]);
  const extractionRulesDump = command(['dump', 'xmltree', apk, '--file', extractionResource.files[0].path]);
  const proof = assertCompiledAndroidBackupSecurity({
    manifestDump,
    resourcesDump,
    legacyRulesDump,
    extractionRulesDump,
  });
  return { apk, aapt2, ...proof };
}

async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error('Usage: node verify-android-apk-backup.mjs <apk> [apk...]');
  const results = paths.map(verifyAndroidApkBackupSecurity);
  console.log(JSON.stringify({ ok: true, policy: 'deny-cloud-backup-and-device-transfer', apks: results }, null, 2));
}

if (resolve(process.argv[1] || '') === scriptPath) await main();
