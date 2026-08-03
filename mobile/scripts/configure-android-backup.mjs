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

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');

export const MANAGER_PLAY_INTEGRITY_METADATA_NAME =
  'org.memphiszoo.manager.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER';
export const MANAGER_PLAY_INTEGRITY_METADATA_PREFIX = 'play-integrity-cloud-project:';

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

export function canonicalManagerPlayIntegrityProjectNumber(value) {
  const projectNumber = String(value ?? '').trim();
  if (!/^[1-9]\d{5,18}$/.test(projectNumber)
      || BigInt(projectNumber) > 9_223_372_036_854_775_807n) {
    throw new Error('MZ_MANAGER_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER must be a 6-19 digit positive signed-64-bit Google Cloud project number');
  }
  return projectNumber;
}

function androidAttribute(tag, name) {
  const matches = [...String(tag).matchAll(attributePattern(name))];
  if (matches.length > 1) throw new Error(`Android element repeats android:${name}`);
  return matches[0]?.[0].match(/=\s*(["'])([^"']*)\1/)?.[2] ?? '';
}

function applicationBody(source) {
  const opening = applicationTag(source);
  const closingMatches = [...source.matchAll(/<\/application\s*>/g)];
  if (closingMatches.length !== 1 || closingMatches[0].index < opening.index) {
    throw new Error(`Android manifest must contain exactly one application closing element; found ${closingMatches.length}`);
  }
  return {
    opening,
    closing: closingMatches[0],
    bodyStart: opening.index + opening[0].length,
    bodyEnd: closingMatches[0].index,
  };
}

function managerPlayIntegrityMetadataTags(source) {
  return [...String(source).matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<meta-data\b[^>]*\/?\s*>/g)]
    .filter((match) => match[0].startsWith('<meta-data')
      && androidAttribute(match[0], 'name') === MANAGER_PLAY_INTEGRITY_METADATA_NAME);
}

function directApplicationChild(source, index, application) {
  if (index < application.bodyStart || index >= application.bodyEnd) return false;
  let depth = 0;
  const prefix = source.slice(application.bodyStart, index);
  for (const match of prefix.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith('<!--') || tag.startsWith('<?') || tag.startsWith('<![CDATA[')) continue;
    if (/^<\//.test(tag)) depth -= 1;
    else if (!/\/\s*>$/.test(tag)) depth += 1;
    if (depth < 0) throw new Error('Android application child structure is malformed');
  }
  return depth === 0;
}

export function configureManagerPlayIntegrityManifestSource(source, rawProjectNumber) {
  const projectNumber = canonicalManagerPlayIntegrityProjectNumber(rawProjectNumber);
  const application = applicationBody(source);
  const tags = managerPlayIntegrityMetadataTags(source);
  if (tags.length > 1) throw new Error('Manager Play Integrity metadata must occur exactly once');
  if (tags.length === 1 && !directApplicationChild(source, tags[0].index, application)) {
    throw new Error('Manager Play Integrity metadata must be a direct application child');
  }
  const canonical = `\n        <meta-data\n            android:name="${MANAGER_PLAY_INTEGRITY_METADATA_NAME}"\n            android:value="${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${projectNumber}" />`;
  if (tags.length === 1) {
    return `${source.slice(0, tags[0].index)}${canonical.trimStart()}${source.slice(tags[0].index + tags[0][0].length)}`;
  }
  return `${source.slice(0, application.bodyEnd)}${canonical}\n    ${source.slice(application.bodyEnd)}`;
}

export function assertManagerPlayIntegrityManifestSource(source, rawProjectNumber) {
  const projectNumber = canonicalManagerPlayIntegrityProjectNumber(rawProjectNumber);
  const application = applicationBody(source);
  const tags = managerPlayIntegrityMetadataTags(source);
  if (tags.length !== 1
      || !directApplicationChild(source, tags[0].index, application)
      || androidAttribute(tags[0][0], 'value')
        !== `${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${projectNumber}`) {
    throw new Error('Manager application must contain exactly one exact Play Integrity cloud-project metadata value');
  }
  return true;
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
  const xmlDirectory = join(mobileRoot, 'android/app/src/main/res/xml');
  const legacyPath = join(xmlDirectory, 'memphis_zoo_backup_rules.xml');
  const extractionPath = join(xmlDirectory, 'memphis_zoo_data_extraction_rules.xml');
  const source = await readFile(manifestPath, 'utf8');
  const backupManifest = configureAndroidBackupManifestSource(source);
  const managerProjectNumber = edition === 'manager'
    ? canonicalManagerPlayIntegrityProjectNumber(
      process.env.MZ_MANAGER_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
    )
    : null;
  const manifest = edition === 'custodial'
    ? configureCustodialAndroidManifestSecuritySource(backupManifest)
    : edition === 'manager'
      ? configureManagerPlayIntegrityManifestSource(backupManifest, managerProjectNumber)
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
  if (edition === 'manager') {
    assertManagerPlayIntegrityManifestSource(manifest, managerProjectNumber);
  }
  await mkdir(xmlDirectory, { recursive: true });
  await writeFile(manifestPath, manifest);
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
      ...(edition === 'manager' ? {
        play_integrity_metadata_name: MANAGER_PLAY_INTEGRITY_METADATA_NAME,
        play_integrity_cloud_project_number: managerProjectNumber,
      } : {}),
    }, null, 2)}\n`,
  );
  console.log(`Configured ${edition} Android backup and device-transfer denial.`);
}

if (resolve(process.argv[1] || '') === scriptPath) await main();
