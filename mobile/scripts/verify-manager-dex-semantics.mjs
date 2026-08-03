import { createHash } from 'node:crypto';
import {
  CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_CALL_DESCRIPTOR,
  CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_SUPER_DESCRIPTOR,
  DexSemanticReader,
} from './verify-custodial-dex-semantics.mjs';

const ACC_PUBLIC = 0x0001;
const ACC_PRIVATE = 0x0002;
const ACC_PROTECTED = 0x0004;
const ACC_STATIC = 0x0008;
const ACC_FINAL = 0x0010;
const ACC_NATIVE = 0x0100;
const ACC_INTERFACE = 0x0200;
const ACC_ABSTRACT = 0x0400;
const VISIBILITY_RUNTIME = 1;

export const MANAGER_DEX_SEMANTIC_VERIFIER_VERSION = '1.1.0';
export const MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR =
  'Lorg/memphiszoo/manager/vault/ManagerNativeVaultPlugin;';
export const MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR =
  'Lorg/memphiszoo/manager/vault/PlayIntegrityAttestation;';
export const MANAGER_OLD_SECURE_STORAGE_DESCRIPTOR =
  'Lcom/aparajita/capacitor/securestorage/SecureStorage;';
export const PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR =
  'Lcom/google/android/play/core/integrity/StandardIntegrityManager;';
export const PLAY_INTEGRITY_PREPARE_METHOD =
  'prepareIntegrityToken(Lcom/google/android/play/core/integrity/StandardIntegrityManager$PrepareIntegrityTokenRequest;)Lcom/google/android/gms/tasks/Task;';

export const MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS = Object.freeze([
  MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
  'Lorg/memphiszoo/manager/vault/VaultEngine;',
  'Lorg/memphiszoo/manager/vault/SharedPreferencesVaultPersistence;',
  'Lorg/memphiszoo/manager/vault/AndroidKeystoreCipher;',
  'Lorg/memphiszoo/manager/vault/HttpsEnrollmentTransport;',
  'Lorg/memphiszoo/manager/vault/ManagerV2WireContract;',
  'Lorg/memphiszoo/manager/vault/ManagerV2KeyCoordinator;',
  'Lorg/memphiszoo/manager/vault/ManagerKeySecurityPolicy;',
  MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR,
  'Lorg/memphiszoo/manager/vault/SharedPreferencesAuthorizedSessionOperationJournal;',
  PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR,
]);

export const MANAGER_NATIVE_VAULT_PLUGIN_METHODS = Object.freeze([
  'authorizedRequest',
  'cancelEnrollment',
  'confirmEnrollment',
  'enroll',
  'getStatus',
  'remove',
  'resumeEnrollment',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireExactPluginAnnotation(annotation) {
  if (
    annotation.visibility !== VISIBILITY_RUNTIME
    || annotation.type !== CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR
  ) {
    throw new Error('Compiled Manager native vault @CapacitorPlugin annotation is not runtime-visible');
  }
  const keys = Object.keys(annotation.elements);
  const name = annotation.elements.name;
  if (!sameArray(keys, ['name']) || name?.kind !== 'string' || name.value !== 'ManagerNativeVault') {
    throw new Error('Compiled Manager native vault @CapacitorPlugin annotation payload is malformed');
  }
}

const ONE_CODE_UNIT_OPCODES = new Set([
  0x01, 0x04, 0x07,
  0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12,
  0x1d, 0x1e, 0x21, 0x27, 0x28,
  ...Array.from({ length: 0x8f - 0x7b + 1 }, (_, index) => 0x7b + index),
  ...Array.from({ length: 0xcf - 0xb0 + 1 }, (_, index) => 0xb0 + index),
]);
const TWO_CODE_UNIT_OPCODES = new Set([
  0x02, 0x05, 0x08,
  0x13, 0x15, 0x16, 0x19, 0x1a, 0x1c, 0x1f, 0x20, 0x22, 0x23, 0x29,
  ...Array.from({ length: 0x31 - 0x2d + 1 }, (_, index) => 0x2d + index),
  ...Array.from({ length: 0x3d - 0x32 + 1 }, (_, index) => 0x32 + index),
  ...Array.from({ length: 0x51 - 0x44 + 1 }, (_, index) => 0x44 + index),
  ...Array.from({ length: 0x5f - 0x52 + 1 }, (_, index) => 0x52 + index),
  ...Array.from({ length: 0x6d - 0x60 + 1 }, (_, index) => 0x60 + index),
  ...Array.from({ length: 0xaf - 0x90 + 1 }, (_, index) => 0x90 + index),
  ...Array.from({ length: 0xd7 - 0xd0 + 1 }, (_, index) => 0xd0 + index),
  ...Array.from({ length: 0xe2 - 0xd8 + 1 }, (_, index) => 0xd8 + index),
  0xfe, 0xff,
]);
const THREE_CODE_UNIT_OPCODES = new Set([
  0x03, 0x06, 0x09, 0x14, 0x17, 0x1b,
  0x24, 0x25, 0x26, 0x2a, 0x2b, 0x2c,
  ...Array.from({ length: 0x72 - 0x6e + 1 }, (_, index) => 0x6e + index),
  ...Array.from({ length: 0x78 - 0x74 + 1 }, (_, index) => 0x74 + index),
  0xfc, 0xfd,
]);
const FOUR_CODE_UNIT_OPCODES = new Set([0xfa, 0xfb]);
const METHOD_INVOKE_OPCODES = new Set([
  ...Array.from({ length: 0x72 - 0x6e + 1 }, (_, index) => 0x6e + index),
  ...Array.from({ length: 0x78 - 0x74 + 1 }, (_, index) => 0x74 + index),
  0xfa, 0xfb,
]);
const PLAY_INTEGRITY_INVOKE_OPCODES = new Set([0x72, 0x78]);

function payloadWidth(reader, byteOffset, instructionIndex, firstCodeUnit, remaining) {
  if ((instructionIndex & 1) !== 0) reader.fail('instruction payload is not 32-bit aligned');
  const payloadKind = firstCodeUnit >>> 8;
  if (payloadKind === 0x01) {
    if (remaining < 2) reader.fail('packed-switch payload header is truncated');
    return 4 + (reader.u2(byteOffset + 2, 'packed-switch payload size') * 2);
  }
  if (payloadKind === 0x02) {
    if (remaining < 2) reader.fail('sparse-switch payload header is truncated');
    return 2 + (reader.u2(byteOffset + 2, 'sparse-switch payload size') * 4);
  }
  if (payloadKind === 0x03) {
    if (remaining < 4) reader.fail('fill-array-data payload header is truncated');
    const elementWidth = reader.u2(byteOffset + 2, 'fill-array-data element width');
    const elementCount = reader.u4(byteOffset + 4, 'fill-array-data element count');
    if (elementWidth < 1) reader.fail('fill-array-data element width is malformed');
    return 4 + Math.ceil((elementWidth * elementCount) / 2);
  }
  reader.fail(`instruction opcode 0x${firstCodeUnit.toString(16).padStart(4, '0')} is unsupported`);
}

function instructionWidth(reader, instructionByteOffset, instructionIndex, instructionCount) {
  const firstCodeUnit = reader.u2(instructionByteOffset, 'method instruction');
  const opcode = firstCodeUnit & 0xff;
  let width;
  if (opcode === 0x00) {
    if (firstCodeUnit === 0x0000) width = 1;
    else {
      width = payloadWidth(
        reader,
        instructionByteOffset,
        instructionIndex,
        firstCodeUnit,
        instructionCount - instructionIndex,
      );
    }
  } else if (ONE_CODE_UNIT_OPCODES.has(opcode)) width = 1;
  else if (TWO_CODE_UNIT_OPCODES.has(opcode)) width = 2;
  else if (THREE_CODE_UNIT_OPCODES.has(opcode)) width = 3;
  else if (FOUR_CODE_UNIT_OPCODES.has(opcode)) width = 4;
  else if (opcode === 0x18) width = 5;
  else reader.fail(`instruction opcode 0x${opcode.toString(16).padStart(2, '0')} is unsupported`);
  if (!Number.isSafeInteger(width) || width < 1 || instructionIndex + width > instructionCount) {
    reader.fail('method instruction extends beyond its code_item');
  }
  return { firstCodeUnit, opcode, width };
}

function invokedMethods(reader, codeOffset) {
  const code = reader.methodCode(codeOffset);
  const instructionStart = codeOffset + 16;
  const invoked = [];
  for (let index = 0; index < code.instructionCount;) {
    const byteOffset = instructionStart + (index * 2);
    const instruction = instructionWidth(
      reader,
      byteOffset,
      index,
      code.instructionCount,
    );
    if (METHOD_INVOKE_OPCODES.has(instruction.opcode)) {
      const methodIndex = reader.u2(byteOffset + 2, 'invoked method index');
      if (methodIndex >= reader.methodCount) reader.fail('invoked method index is out of bounds');
      invoked.push({
        argumentWordCount: [0x74, 0x75, 0x76, 0x77, 0x78, 0xfb].includes(instruction.opcode)
          ? instruction.firstCodeUnit >>> 8
          : instruction.firstCodeUnit >>> 12,
        instructionIndex: index,
        methodIndex,
        opcode: instruction.opcode,
      });
    }
    index += instruction.width;
  }
  return invoked;
}

function isExactPlayIntegrityPrepareMethod(reader, methodIndex) {
  const method = reader.method(methodIndex);
  return reader.type(method.classIndex) === PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR
    && `${method.name}${method.descriptor}` === PLAY_INTEGRITY_PREPARE_METHOD;
}

/**
 * Parse the real DEX tables and class data that Android executes. String-pool
 * presence alone is deliberately insufficient evidence for every assertion in
 * this proof.
 */
export function inspectManagerNativeVaultDexSemantics(dexEntries) {
  if (!Array.isArray(dexEntries) || !dexEntries.length) {
    throw new Error('Compiled Manager APK contains no DEX entries');
  }
  const names = dexEntries.map((entry) => String(entry?.name || ''));
  if (
    !sameArray(names, [...names].sort())
    || new Set(names).size !== names.length
    || names.some((name) => !/^classes(?:\d+)?[.]dex$/.test(name))
  ) throw new Error('Compiled Manager DEX entry set is malformed or unsorted');

  const relevantDescriptors = new Set([
    ...MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
    MANAGER_OLD_SECURE_STORAGE_DESCRIPTOR,
  ]);
  const definitions = new Map();
  const dexSha256 = {};
  const readers = [];
  for (const entry of dexEntries) {
    const bytes = Buffer.from(entry?.bytes || []);
    if (!bytes.length) throw new Error(`Compiled Manager DEX entry is empty: ${entry.name}`);
    dexSha256[entry.name] = sha256(bytes);
    const reader = new DexSemanticReader(bytes, entry.name, 'Manager');
    readers.push(reader);
    for (const [descriptor, definition] of reader.classes()) {
      if (!relevantDescriptors.has(descriptor)) continue;
      if (definitions.has(descriptor)) {
        throw new Error(`Compiled Manager DEX defines security class more than once: ${descriptor}`);
      }
      definitions.set(descriptor, { reader, definition, dexName: entry.name });
    }
  }

  if (definitions.has(MANAGER_OLD_SECURE_STORAGE_DESCRIPTOR)) {
    throw new Error('Compiled Manager DEX still defines the old SecureStorage plugin class');
  }
  const missing = MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS
    .filter((descriptor) => !definitions.has(descriptor));
  if (missing.length) {
    throw new Error(`Compiled Manager DEX is missing native vault class closure: ${missing.join(', ')}`);
  }

  const pluginRecord = definitions.get(MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR);
  const { reader, definition: plugin } = pluginRecord;
  if (plugin.superclass !== CAPACITOR_PLUGIN_SUPER_DESCRIPTOR) {
    throw new Error('Compiled Manager native vault plugin does not directly extend Capacitor Plugin');
  }
  if (
    (plugin.accessFlags & ACC_PUBLIC) === 0
    || (plugin.accessFlags & ACC_FINAL) === 0
    || (plugin.accessFlags & (ACC_INTERFACE | ACC_ABSTRACT)) !== 0
  ) throw new Error('Compiled Manager native vault plugin class must be public, final, and concrete');

  const capacitorPluginAnnotations = plugin.annotations.classAnnotations.filter(
    (annotation) => annotation.type === CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
  );
  if (capacitorPluginAnnotations.length !== 1) {
    throw new Error(
      `Compiled Manager native vault must have exactly one @CapacitorPlugin annotation; found ${capacitorPluginAnnotations.length}`,
    );
  }
  requireExactPluginAnnotation(capacitorPluginAnnotations[0]);

  const exposed = [];
  for (const [methodIndex, annotations] of plugin.annotations.methodAnnotations) {
    const pluginMethodAnnotations = annotations.filter(
      (annotation) => annotation.type === CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
    );
    if (pluginMethodAnnotations.length > 1) {
      throw new Error('Compiled Manager native vault method repeats @PluginMethod');
    }
    if (pluginMethodAnnotations.length === 0) continue;
    const annotation = pluginMethodAnnotations[0];
    if (annotation.visibility !== VISIBILITY_RUNTIME || Object.keys(annotation.elements).length !== 0) {
      throw new Error('Compiled Manager native vault @PluginMethod annotation is malformed');
    }
    const method = reader.method(methodIndex);
    if (method.classIndex !== plugin.classIndex || !plugin.methods.has(methodIndex)) {
      throw new Error('Compiled Manager native vault annotation targets a method outside the plugin class');
    }
    const compiled = plugin.methods.get(methodIndex);
    const code = compiled.codeOffset === 0 ? null : reader.methodCode(compiled.codeOffset);
    if (
      (compiled.accessFlags & ACC_PUBLIC) === 0
      || (compiled.accessFlags & (ACC_PRIVATE | ACC_PROTECTED | ACC_STATIC | ACC_NATIVE | ACC_ABSTRACT)) !== 0
      || code?.incoming !== 2
      || code.registers < code.incoming
      || method.descriptor !== `(${CAPACITOR_PLUGIN_CALL_DESCRIPTOR})V`
    ) {
      throw new Error(`Compiled Manager native vault method has an unsafe signature: ${method.name}`);
    }
    exposed.push(method.name);
  }
  exposed.sort();
  if (!sameArray(exposed, MANAGER_NATIVE_VAULT_PLUGIN_METHODS)) {
    const expected = new Set(MANAGER_NATIVE_VAULT_PLUGIN_METHODS);
    const actual = new Set(exposed);
    const missingMethods = MANAGER_NATIVE_VAULT_PLUGIN_METHODS.filter((name) => !actual.has(name));
    const extraMethods = exposed.filter((name) => !expected.has(name));
    throw new Error(
      `Compiled Manager native vault WebView API differs from policy (missing: ${missingMethods.join(', ') || 'none'}; unexpected: ${extraMethods.join(', ') || 'none'})`,
    );
  }

  const playIntegrityReferences = [];
  for (const dexReader of readers) {
    for (let index = 0; index < dexReader.methodCount; index += 1) {
      const method = dexReader.method(index);
      if (dexReader.type(method.classIndex) === PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR) {
        playIntegrityReferences.push(`${method.name}${method.descriptor}`);
      }
    }
  }
  if (!playIntegrityReferences.includes(PLAY_INTEGRITY_PREPARE_METHOD)) {
    throw new Error('Compiled Manager DEX does not structurally reference StandardIntegrityManager.prepareIntegrityToken');
  }

  const attestationRecord = definitions.get(MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR);
  const attestationInvocations = [];
  for (const [callerMethodIndex, compiled] of attestationRecord.definition.methods) {
    const caller = attestationRecord.reader.method(callerMethodIndex);
    if (caller.classIndex !== attestationRecord.definition.classIndex) {
      throw new Error('Compiled Manager PlayIntegrityAttestation class data targets a foreign method');
    }
    if (compiled.codeOffset === 0) continue;
    for (const invocation of invokedMethods(attestationRecord.reader, compiled.codeOffset)) {
      if (
        PLAY_INTEGRITY_INVOKE_OPCODES.has(invocation.opcode)
        && invocation.argumentWordCount === 2
        && isExactPlayIntegrityPrepareMethod(attestationRecord.reader, invocation.methodIndex)
      ) {
        attestationInvocations.push({
          caller: caller.name,
          instructionIndex: invocation.instructionIndex,
          opcode: invocation.opcode,
        });
      }
    }
  }
  if (attestationInvocations.length === 0) {
    throw new Error(
      'Compiled Manager PlayIntegrityAttestation does not invoke StandardIntegrityManager.prepareIntegrityToken',
    );
  }

  return {
    dex_semantic_verifier_version: MANAGER_DEX_SEMANTIC_VERIFIER_VERSION,
    native_class_present: true,
    native_class_closure_verified: true,
    plugin_extends_capacitor_plugin: true,
    plugin_annotation_verified: true,
    plugin_methods_verified: true,
    plugin_method_names: [...exposed],
    play_integrity_class_defined: true,
    play_integrity_api_reference_verified: true,
    play_integrity_api_invocation_verified: true,
    required_class_locations: Object.fromEntries(
      MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS
        .map((descriptor) => [descriptor, definitions.get(descriptor).dexName]),
    ),
    dex_sha256: dexSha256,
  };
}
