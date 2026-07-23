#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');
const androidOverlayLine = "apply from: rootProject.file('../scripts/codemagic-release.gradle')";

const editions = {
  manager: {
    appIdentifier: 'org.memphiszoo.ops',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.2', '9b9fb0af76b2b653f6e9b999f658adc132b9ab4c'],
      'firebase-ios-sdk': ['12.7.0', '45210bd1ea695779e6de016ab00fea8c0b7eb2ef'],
      googledatatransport: ['10.1.0', '617af071af9aa1d6a091d59a202910ac482128f9'],
      googleutilities: ['8.1.0', '60da361632d0de02786f709bdc0c4df340f7613e'],
      'keychain-swift': ['21.0.0', '265806607b45687a3d646e4c9837c31c90f202e8'],
      nanopb: ['2.30910.0', 'b7e1104502eca3a213b46303391ca4d3bc8ddec1'],
      promises: ['2.4.0', '540318ecedd63d883069ae7f1ed811a2df00b6ac'],
    },
  },
  custodial: {
    appIdentifier: 'org.memphiszoo.custodial',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.2', '9b9fb0af76b2b653f6e9b999f658adc132b9ab4c'],
      'keychain-swift': ['21.0.0', '265806607b45687a3d646e4c9837c31c90f202e8'],
    },
  },
  viewer: {
    appIdentifier: 'org.memphiszoo.viewer',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.2', '9b9fb0af76b2b653f6e9b999f658adc132b9ab4c'],
    },
  },
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function requireExactCount(source, pattern, expected, label) {
  const count = countMatches(source, pattern);
  if (count !== expected) {
    throw new Error(`${label} must occur exactly ${expected} time(s); found ${count}`);
  }
}

function insertBefore(source, marker, insertion, label) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`${label} marker must occur exactly once`);
  }
  return `${source.slice(0, first)}${insertion}${source.slice(first)}`;
}

function insertAfter(source, marker, insertion, label) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`${label} marker must occur exactly once`);
  }
  const offset = first + marker.length;
  return `${source.slice(0, offset)}${insertion}${source.slice(offset)}`;
}

export function resolveBuildNumber(environment = process.env) {
  const candidates = [
    ['PROJECT_BUILD_NUMBER', environment.PROJECT_BUILD_NUMBER],
    ['BUILD_NUMBER', environment.BUILD_NUMBER],
    ['MZ_BUILD_NUMBER', environment.MZ_BUILD_NUMBER],
  ];
  const [source, raw] = candidates.find(([, value]) => String(value || '').trim()) || [];
  const value = String(raw || '').trim();
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('PROJECT_BUILD_NUMBER, BUILD_NUMBER, or MZ_BUILD_NUMBER must provide a positive integer');
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric > 2_100_000_000) {
    throw new Error('Native build number must be a safe integer no greater than 2100000000');
  }
  return { value, numeric, source };
}

export function resolveReleaseVersion(environment = process.env) {
  const value = String(environment.MZ_RELEASE_VERSION || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error('MZ_RELEASE_VERSION must contain three numeric components');
  }
  return value;
}

export function injectAndroidOverlay(source) {
  const escaped = androidOverlayLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = countMatches(source, new RegExp(`^${escaped}$`, 'gm'));
  if (count > 1) throw new Error('Codemagic Android release overlay is applied more than once');
  return count === 1 ? source : `${source.trimEnd()}\n\n${androidOverlayLine}\n`;
}

export function configureIosProjectSource(source, {
  appIdentifier,
  buildNumber,
  releaseVersion,
  includeFirebase,
}) {
  const normalized = source.replace(/\n\s*VERSIONING_SYSTEM = apple-generic;/g, '');
  requireExactCount(
    normalized,
    new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${appIdentifier.replaceAll('.', '\\.')};`, 'g'),
    2,
    'iOS application identifier',
  );
  requireExactCount(normalized, /CURRENT_PROJECT_VERSION = [^;]+;/g, 2, 'iOS target build number');
  requireExactCount(normalized, /MARKETING_VERSION = [^;]+;/g, 2, 'iOS target release version');
  let configured = normalized
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};\n\t\t\t\tVERSIONING_SYSTEM = apple-generic;`,
    )
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${releaseVersion};`);

  if (includeFirebase) {
    if (!configured.includes('GoogleService-Info.plist')) {
      configured = insertBefore(
        configured,
        '/* End PBXBuildFile section */',
        '\t\t4D5A46424346470000000001 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = 4D5A46424346470000000002 /* GoogleService-Info.plist */; };\n',
        'PBXBuildFile end',
      );
      configured = insertBefore(
        configured,
        '/* End PBXFileReference section */',
        '\t\t4D5A46424346470000000002 /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };\n',
        'PBXFileReference end',
      );
      configured = insertAfter(
        configured,
        '\t\t504EC3061FED79650016851F /* App */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n',
        '\t\t\t\t4D5A46424346470000000002 /* GoogleService-Info.plist */,\n',
        'App PBXGroup children',
      );
      configured = insertAfter(
        configured,
        '\t\t504EC3021FED79650016851F /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n',
        '\t\t\t\t4D5A46424346470000000001 /* GoogleService-Info.plist in Resources */,\n',
        'App resources build phase',
      );
    }
    requireExactCount(configured, /GoogleService-Info\.plist in Resources/g, 2, 'Firebase iOS resource');
    requireExactCount(
      configured,
      /4D5A46424346470000000002 \/\* GoogleService-Info\.plist \*\//g,
      3,
      'Firebase iOS file reference',
    );
  } else if (configured.includes('GoogleService-Info.plist')) {
    throw new Error('Firebase iOS configuration leaked into a non-Manager edition');
  }

  requireExactCount(
    configured,
    new RegExp(`CURRENT_PROJECT_VERSION = ${buildNumber};`, 'g'),
    2,
    'configured iOS target build number',
  );
  requireExactCount(
    configured,
    new RegExp(`MARKETING_VERSION = ${releaseVersion.replaceAll('.', '\\.')};`, 'g'),
    2,
    'configured iOS target release version',
  );
  requireExactCount(configured, /VERSIONING_SYSTEM = apple-generic;/g, 2, 'iOS versioning system');
  return configured;
}

export function validateSwiftLock(lock, edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  if (lock.version !== 2 || !Array.isArray(lock.pins)) {
    throw new Error(`${edition} Swift package lock must use Package.resolved schema version 2`);
  }
  const actual = Object.fromEntries(lock.pins.map((pin) => [
    pin.identity,
    [pin?.state?.version, pin?.state?.revision],
  ]));
  if (JSON.stringify(actual) !== JSON.stringify(definition.swiftPins)) {
    throw new Error(`${edition} Swift package lock does not match the approved dependency graph`);
  }
}

async function writeProvenance(edition, platform, record) {
  const directory = join(repositoryRoot, 'build', 'provenance');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `${edition}-${platform}-configuration.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

async function configureAndroid({ edition, definition, build, releaseVersion, environment }) {
  for (const name of [
    'CM_KEYSTORE_PATH',
    'CM_KEYSTORE_PASSWORD',
    'CM_KEY_ALIAS',
    'CM_KEY_PASSWORD',
  ]) {
    if (!String(environment[name] || '').trim()) {
      throw new Error(`Missing required Android signing environment variable: ${name}`);
    }
  }
  await access(environment.CM_KEYSTORE_PATH);
  const buildGradlePath = join(mobileRoot, 'android', 'app', 'build.gradle');
  const source = await readFile(buildGradlePath, 'utf8');
  requireExactCount(
    source,
    new RegExp(`applicationId "${definition.appIdentifier.replaceAll('.', '\\.')}"`, 'g'),
    1,
    'Android application identifier',
  );
  const configured = injectAndroidOverlay(source);
  await writeFile(buildGradlePath, configured);
  const keystore = await readFile(environment.CM_KEYSTORE_PATH);
  await writeProvenance(edition, 'android', {
    schema_version: 1,
    edition,
    platform: 'android',
    app_identifier: definition.appIdentifier,
    release_version: releaseVersion,
    build_number: build.numeric,
    build_number_source: build.source,
    source_commit: environment.CM_COMMIT || environment.MZ_SOURCE_COMMIT || null,
    signing_configured: true,
    signing_keystore_sha256: sha256(keystore),
    generated_build_gradle_sha256: sha256(configured),
    release_overlay_sha256: sha256(await readFile(join(mobileRoot, 'scripts', 'codemagic-release.gradle'))),
  });
}

async function configureIos({ edition, definition, build, releaseVersion, environment }) {
  const projectPath = join(mobileRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  const firebasePath = join(mobileRoot, 'ios', 'App', 'App', 'GoogleService-Info.plist');
  if (edition === 'manager') await access(firebasePath);
  const source = await readFile(projectPath, 'utf8');
  const configured = configureIosProjectSource(source, {
    appIdentifier: definition.appIdentifier,
    buildNumber: build.value,
    releaseVersion,
    includeFirebase: edition === 'manager',
  });
  await writeFile(projectPath, configured);

  const lockPath = join(mobileRoot, 'native-locks', 'ios', edition, 'Package.resolved');
  const lockBytes = await readFile(lockPath);
  validateSwiftLock(JSON.parse(lockBytes), edition);
  const resolvedPath = join(
    mobileRoot,
    'ios',
    'App',
    'App.xcodeproj',
    'project.xcworkspace',
    'xcshareddata',
    'swiftpm',
    'Package.resolved',
  );
  await mkdir(dirname(resolvedPath), { recursive: true });
  await copyFile(lockPath, resolvedPath);
  await writeProvenance(edition, 'ios', {
    schema_version: 1,
    edition,
    platform: 'ios',
    app_identifier: definition.appIdentifier,
    release_version: releaseVersion,
    build_number: build.numeric,
    build_number_source: build.source,
    source_commit: environment.CM_COMMIT || environment.MZ_SOURCE_COMMIT || null,
    signing_configured: false,
    generated_project_sha256: sha256(configured),
    swift_package_lock_sha256: sha256(lockBytes),
  });
}

async function main() {
  const platform = String(process.argv[2] || '').trim().toLowerCase();
  if (!['android', 'ios'].includes(platform)) {
    throw new Error('Usage: node scripts/configure-native-release.mjs <android|ios>');
  }
  const edition = String(process.env.MZ_APP_EDITION || '').trim().toLowerCase();
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const build = resolveBuildNumber(process.env);
  const releaseVersion = resolveReleaseVersion(process.env);
  const options = { edition, definition, build, releaseVersion, environment: process.env };
  if (platform === 'android') await configureAndroid(options);
  else await configureIos(options);
  console.log(`Configured ${edition} ${platform} release ${releaseVersion} (${build.numeric}).`);
}

if (resolve(process.argv[1] || '') === scriptPath) {
  await main();
}
