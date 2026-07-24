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
const gradleDistributionUrl = 'https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip';
const gradleDistributionSha256 = 'ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c';
const gradleWrapperJarSha256 = '7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172';

const editions = {
  manager: {
    appIdentifier: 'org.memphiszoo.ops',
    androidVerificationMetadataSha256: 'd3baef5ec8e1985c43f38643c75a85ca600f03e6dc83c63d884f902fe3028518',
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
    androidVerificationMetadataSha256: 'd3baef5ec8e1985c43f38643c75a85ca600f03e6dc83c63d884f902fe3028518',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.2', '9b9fb0af76b2b653f6e9b999f658adc132b9ab4c'],
      'keychain-swift': ['21.0.0', '265806607b45687a3d646e4c9837c31c90f202e8'],
    },
  },
  viewer: {
    appIdentifier: 'org.memphiszoo.viewer',
    androidVerificationMetadataSha256: '91303b463ce4537bfa0c8185013a86cf805e2eb9e559b396e61172131c616b93',
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

function parseXmlAttributes(source, label) {
  const attributes = {};
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    const [, name, value] = match;
    if (Object.hasOwn(attributes, name)) {
      throw new Error(`${label} repeats the "${name}" attribute`);
    }
    attributes[name] = value;
  }
  if (source.replace(pattern, '').trim()) {
    throw new Error(`${label} contains malformed or unsupported attributes`);
  }
  return attributes;
}

export function inspectGradleVerificationMetadata(bytes, edition) {
  if (!editions[edition]) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const source = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  if (!source.includes('https://schema.gradle.org/dependency-verification/dependency-verification-1.3.xsd')) {
    throw new Error(`${edition} Gradle verification metadata does not use the reviewed 1.3 schema`);
  }

  const artifacts = new Map();
  const componentKeys = new Set();
  const componentPattern = /<component\s+([^>]+)>([\s\S]*?)<\/component>/g;
  const components = [...source.matchAll(componentPattern)];
  if (components.length === 0 || components.length !== countMatches(source, /<component\b/g)) {
    throw new Error(`${edition} Gradle verification metadata contains a malformed component graph`);
  }

  for (const [, rawComponentAttributes, body] of components) {
    const component = parseXmlAttributes(rawComponentAttributes, `${edition} Gradle component`);
    const componentAttributeNames = Object.keys(component).sort();
    if (
      JSON.stringify(componentAttributeNames) !== JSON.stringify(['group', 'name', 'version'])
      || !component.group
      || !component.name
      || !component.version
    ) {
      throw new Error(`${edition} Gradle component must declare exactly group, name, and version`);
    }
    const componentKey = `${component.group}:${component.name}:${component.version}`;
    if (componentKeys.has(componentKey)) {
      throw new Error(`${edition} Gradle verification metadata repeats component ${componentKey}`);
    }
    componentKeys.add(componentKey);

    const artifactPattern = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/g;
    const componentArtifacts = [...body.matchAll(artifactPattern)];
    if (
      componentArtifacts.length === 0
      || componentArtifacts.length !== countMatches(body, /<artifact\b/g)
      || body.replace(artifactPattern, '').trim()
    ) {
      throw new Error(`${edition} Gradle component ${componentKey} contains malformed artifact metadata`);
    }

    for (const [, rawArtifactAttributes, artifactBody] of componentArtifacts) {
      const artifact = parseXmlAttributes(
        rawArtifactAttributes,
        `${edition} Gradle artifact in ${componentKey}`,
      );
      if (Object.keys(artifact).length !== 1 || !artifact.name) {
        throw new Error(`${edition} Gradle artifact in ${componentKey} must declare exactly one name`);
      }
      const artifactKey = `${componentKey}/${artifact.name}`;
      if (artifacts.has(artifactKey)) {
        throw new Error(`${edition} Gradle verification metadata repeats artifact ${artifactKey}`);
      }
      const checksumPattern = /<sha256\s+([^>]+)\/>/g;
      const checksums = [...artifactBody.matchAll(checksumPattern)];
      if (checksums.length !== 1 || artifactBody.replace(checksumPattern, '').trim()) {
        throw new Error(`${edition} Gradle artifact ${artifactKey} must have exactly one SHA-256`);
      }
      const checksum = parseXmlAttributes(
        checksums[0][1],
        `${edition} Gradle checksum for ${artifactKey}`,
      );
      if (
        Object.keys(checksum).sort().join(',') !== 'origin,value'
        || !/^[a-f0-9]{64}$/.test(checksum.value || '')
        || checksum.origin !== 'Generated by Gradle'
      ) {
        throw new Error(`${edition} Gradle artifact ${artifactKey} has an invalid SHA-256 record`);
      }
      artifacts.set(artifactKey, checksum.value);
    }
  }

  for (const required of [
    'com.google.guava:guava-parent:33.3.1-jre/guava-parent-33.3.1-jre.pom',
    'org.junit:junit-bom:5.10.2/junit-bom-5.10.2.module',
    'org.junit:junit-bom:5.10.2/junit-bom-5.10.2.pom',
  ]) {
    if (!artifacts.has(required)) {
      throw new Error(`${edition} Gradle verification metadata is missing required artifact ${required}`);
    }
  }

  return {
    componentCount: componentKeys.size,
    artifactCount: artifacts.size,
    artifacts,
  };
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

export function configureGradleWrapperSource(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  requireExactCount(
    normalized,
    /^distributionUrl=.*$/gm,
    1,
    'Gradle wrapper distribution URL',
  );
  requireExactCount(
    normalized,
    new RegExp(`^distributionUrl=${gradleDistributionUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm'),
    1,
    'approved Gradle wrapper distribution URL',
  );
  const checksumLines = normalized.match(/^distributionSha256Sum=.*$/gm) || [];
  if (checksumLines.length > 1) {
    throw new Error(`Gradle wrapper distribution checksum must occur at most once; found ${checksumLines.length}`);
  }
  if (
    checksumLines.length === 1
    && checksumLines[0] !== `distributionSha256Sum=${gradleDistributionSha256}`
  ) {
    throw new Error('Gradle wrapper distribution checksum does not match the approved Gradle 8.14.3 all-distribution');
  }
  const configured = checksumLines.length === 1
    ? normalized
    : normalized.replace(
      /^distributionUrl=.*$/m,
      `distributionSha256Sum=${gradleDistributionSha256}\n$&`,
    );
  requireExactCount(
    configured,
    new RegExp(`^distributionSha256Sum=${gradleDistributionSha256}$`, 'gm'),
    1,
    'approved Gradle wrapper distribution checksum',
  );
  return configured;
}

export function validateGradleWrapperJar(bytes) {
  const actual = sha256(bytes);
  if (actual !== gradleWrapperJarSha256) {
    throw new Error(`Gradle wrapper JAR does not match the approved Gradle 8.14.3 wrapper (${actual})`);
  }
  return actual;
}

export function validateGradleVerificationMetadata(bytes, edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const source = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  const actual = sha256(bytes);
  if (actual !== definition.androidVerificationMetadataSha256) {
    throw new Error(`${edition} Gradle verification metadata does not match the reviewed dependency graph (${actual})`);
  }
  requireExactCount(source, /<verify-metadata>true<\/verify-metadata>/g, 1, 'Gradle metadata verification policy');
  requireExactCount(source, /<verify-signatures>false<\/verify-signatures>/g, 1, 'Gradle signature verification policy');
  if (!/<components>[\s\S]*<component [^>]+>[\s\S]*<sha256 value="[a-f0-9]{64}"/.test(source)) {
    throw new Error(`${edition} Gradle verification metadata does not contain a checksum-locked component graph`);
  }
  if (/<(?:trusted-artifacts|ignored-keys|sha1|md5)\b/.test(source)) {
    throw new Error(`${edition} Gradle verification metadata contains an unapproved trust bypass or weak digest`);
  }
  inspectGradleVerificationMetadata(bytes, edition);
  return actual;
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

async function configureAndroidWrapper(edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const wrapperPath = join(
    mobileRoot,
    'android',
    'gradle',
    'wrapper',
    'gradle-wrapper.properties',
  );
  const wrapperJarPath = join(
    mobileRoot,
    'android',
    'gradle',
    'wrapper',
    'gradle-wrapper.jar',
  );
  const source = await readFile(wrapperPath, 'utf8');
  const wrapperJar = await readFile(wrapperJarPath);
  const wrapperJarDigest = validateGradleWrapperJar(wrapperJar);
  const configured = configureGradleWrapperSource(source);
  await writeFile(wrapperPath, configured);
  const verificationLockPath = join(
    mobileRoot,
    'native-locks',
    'android',
    edition,
    'verification-metadata.xml',
  );
  const verificationBytes = await readFile(verificationLockPath);
  const verificationDigest = validateGradleVerificationMetadata(verificationBytes, edition);
  const verificationPath = join(mobileRoot, 'android', 'gradle', 'verification-metadata.xml');
  await mkdir(dirname(verificationPath), { recursive: true });
  await writeFile(verificationPath, verificationBytes);
  return {
    path: wrapperPath,
    bytes: configured,
    jarPath: wrapperJarPath,
    jarDigest: wrapperJarDigest,
    verificationPath,
    verificationLockPath,
    verificationBytes,
    verificationDigest,
  };
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
  const wrapper = await configureAndroidWrapper(edition);
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
    gradle_wrapper_properties_sha256: sha256(wrapper.bytes),
    gradle_wrapper_jar_sha256: wrapper.jarDigest,
    gradle_distribution_sha256: gradleDistributionSha256,
    gradle_verification_metadata_sha256: wrapper.verificationDigest,
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
  if (!['android', 'android-wrapper', 'ios'].includes(platform)) {
    throw new Error('Usage: node scripts/configure-native-release.mjs <android|android-wrapper|ios>');
  }
  const edition = String(process.env.MZ_APP_EDITION || '').trim().toLowerCase();
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  if (platform === 'android-wrapper') {
    const wrapper = await configureAndroidWrapper(edition);
    console.log(`Pinned ${edition} Gradle wrapper and dependency graph (${wrapper.verificationDigest}).`);
    return;
  }
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
