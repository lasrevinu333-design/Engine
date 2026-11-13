#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCustodialAndroidManifestSecuritySource,
  assertCustodialAndroidSecurityResourcesSource,
  configureCustodialAndroidManifestSecuritySource,
  custodialFileProviderPaths,
  custodialNetworkSecurityConfig,
} from './custodial-android-manifest-security.mjs';
import { configureAndroidVariablesSource } from './configure-native-release.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');

export const androidBackupDomains = Object.freeze([
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

function exclusions(indent) {
  return androidBackupDomains
    .map((domain) => `${indent}<exclude domain="${domain}" path="." />`)
    .join('\n');
}

export const legacyBackupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${exclusions('  ')}
</full-backup-content>
`;

export const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${exclusions('    ')}
  </cloud-backup>
  <device-transfer>
${exclusions('    ')}
  </device-transfer>
</data-extraction-rules>
`;

const requiredApplicationAttributes = Object.freeze({
  allowBackup: 'false',
  fullBackupContent: '@xml/memphis_zoo_backup_rules',
  dataExtractionRules: '@xml/memphis_zoo_data_extraction_rules',
});

function applicationTag(source) {
  const matches = [...source.matchAll(/<application\b[^>]*>/g)];
  if (matches.length !== 1) {
    throw new Error(`Android manifest must contain exactly one application element; found ${matches.length}`);
  }
  if (matches[0][0].endsWith('/>')) throw new Error('Android application element must not be self-closing');
  return matches[0];
}

function attributePattern(name) {
  return new RegExp(`\\s+android:${name}\\s*=\\s*(["'])[^"']*\\1`, 'g');
}

function setApplicationAttribute(tag, name, value) {
  const pattern = attributePattern(name);
  const matches = [...tag.matchAll(pattern)];
  if (matches.length > 1) throw new Error(`Android application attribute android:${name} occurs more than once`);
  const replacement = `\n        android:${name}="${value}"`;
  if (matches.length === 1) return tag.replace(pattern, replacement);
  return tag.replace(/>$/, `${replacement}>`);
}

export function configureAndroidBackupManifestSource(source) {
  const match = applicationTag(source);
  let configured = match[0];
  for (const [name, value] of Object.entries(requiredApplicationAttributes)) {
    configured = setApplicationAttribute(configured, name, value);
  }
  return `${source.slice(0, match.index)}${configured}${source.slice(match.index + match[0].length)}`;
}

export function assertAndroidBackupManifestSecurity(source) {
  const tag = applicationTag(source)[0];
  for (const [name, expected] of Object.entries(requiredApplicationAttributes)) {
    const matches = [...tag.matchAll(attributePattern(name))];
    if (matches.length !== 1) throw new Error(`Android application must declare android:${name} exactly once`);
    const value = matches[0][0].match(/=\s*(["'])([^"']*)\1/)?.[2];
    if (value !== expected) {
      throw new Error(`Android application android:${name} must be ${expected}; received ${value || 'missing'}`);
    }
  }
  return true;
}

export function assertAndroidBackupRulesSecurity({ legacy, extraction }) {
  if (String(legacy).replaceAll('\r\n', '\n') !== legacyBackupRules) {
    throw new Error('Legacy Android backup exclusions differ from the deny-all policy');
  }
  if (String(extraction).replaceAll('\r\n', '\n') !== dataExtractionRules) {
    throw new Error('Android cloud/device-transfer exclusions differ from the deny-all policy');
  }
  return true;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const edition = String(process.env.MZ_APP_EDITION || '').trim().toLowerCase();
  if (!['manager', 'custodial', 'viewer'].includes(edition)) {
    throw new Error('MZ_APP_EDITION must be manager, custodial, or viewer');
  }

  const manifestPath = join(mobileRoot, 'android/app/src/main/AndroidManifest.xml');
  const variablesPath = join(mobileRoot, 'android/variables.gradle');
  const xmlDirectory = join(mobileRoot, 'android/app/src/main/res/xml');
  const legacyPath = join(xmlDirectory, 'memphis_zoo_backup_rules.xml');
  const extractionPath = join(xmlDirectory, 'memphis_zoo_data_extraction_rules.xml');
  const [source, variablesSource] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(variablesPath, 'utf8'),
  ]);
  const backupManifest = configureAndroidBackupManifestSource(source);
  const manifest = edition === 'custodial'
    ? configureCustodialAndroidManifestSecuritySource(backupManifest)
    : backupManifest;

  assertAndroidBackupManifestSecurity(manifest);
  assertAndroidBackupRulesSecurity({ legacy: legacyBackupRules, extraction: dataExtractionRules });
  if (edition === 'custodial') {
    assertCustodialAndroidManifestSecuritySource(manifest);
    assertCustodialAndroidSecurityResourcesSource({
      network: custodialNetworkSecurityConfig,
      fileProviderPaths: custodialFileProviderPaths,
    });
  }
  await mkdir(xmlDirectory, { recursive: true });
  await writeFile(manifestPath, manifest);
  if (edition === 'custodial') {
    await writeFile(variablesPath, configureAndroidVariablesSource(variablesSource, edition));
  }
  await writeFile(legacyPath, legacyBackupRules);
  await writeFile(extractionPath, dataExtractionRules);
  if (edition === 'custodial') {
    await writeFile(
      join(xmlDirectory, 'memphis_zoo_network_security_config.xml'),
      custodialNetworkSecurityConfig,
    );
    await writeFile(join(xmlDirectory, 'file_paths.xml'), custodialFileProviderPaths);
  }

  const provenanceDirectory = join(repositoryRoot, 'build/provenance');
  await mkdir(provenanceDirectory, { recursive: true });
  await writeFile(
    join(provenanceDirectory, `${edition}-android-backup-security.json`),
    `${JSON.stringify({
      schema_version: 1,
      edition,
      policy: 'deny-cloud-backup-and-device-transfer',
      allow_backup: false,
      full_backup_content: '@xml/memphis_zoo_backup_rules',
      data_extraction_rules: '@xml/memphis_zoo_data_extraction_rules',
      excluded_domains: androidBackupDomains,
      legacy_rules_sha256: sha256(legacyBackupRules),
      data_extraction_rules_sha256: sha256(dataExtractionRules),
      ...(edition === 'custodial' ? {
        uses_cleartext_traffic: false,
        required_compiled_extract_native_libs: false,
        network_security_config: '@xml/memphis_zoo_network_security_config',
        network_security_config_sha256: sha256(custodialNetworkSecurityConfig),
        file_provider_policy: 'app-external-files-pictures-only',
        file_provider_paths_sha256: sha256(custodialFileProviderPaths),
      } : {}),
    }, null, 2)}\n`,
  );
  console.log(`Configured ${edition} Android backup and device-transfer denial.`);
}

if (resolve(process.argv[1] || '') === scriptPath) await main();
