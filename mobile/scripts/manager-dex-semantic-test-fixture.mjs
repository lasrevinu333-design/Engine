import { createHash } from 'node:crypto';
import {
  CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_CALL_DESCRIPTOR,
  CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_SUPER_DESCRIPTOR,
} from './verify-custodial-dex-semantics.mjs';
import {
  MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
  MANAGER_NATIVE_VAULT_PLUGIN_METHODS,
  MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR,
  PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR,
} from './verify-manager-dex-semantics.mjs';

const OBJECT_DESCRIPTOR = 'Ljava/lang/Object;';
const VOID_DESCRIPTOR = 'V';
const TASK_DESCRIPTOR = 'Lcom/google/android/gms/tasks/Task;';
const PREPARE_REQUEST_DESCRIPTOR =
  'Lcom/google/android/play/core/integrity/StandardIntegrityManager$PrepareIntegrityTokenRequest;';

function uleb128(value) {
  const bytes = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return Buffer.from(bytes);
}

function adler32(bytes) {
  const modulus = 65521;
  let first = 1;
  let second = 0;
  for (const byte of bytes) {
    first = (first + byte) % modulus;
    second = (second + first) % modulus;
  }
  return ((second << 16) | first) >>> 0;
}

function align(value, width = 4) {
  return Math.ceil(value / width) * width;
}

function encodedStringValue(index) {
  let value = index;
  const bytes = [];
  do {
    bytes.push(value & 0xff);
    value >>>= 8;
  } while (value);
  return Buffer.from([0x17 | ((bytes.length - 1) << 5), ...bytes]);
}

export function managerDexSemanticFixture({
  requiredClasses = MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  pluginName = 'ManagerNativeVault',
  pluginSuperclass = CAPACITOR_PLUGIN_SUPER_DESCRIPTOR,
  pluginMethods = MANAGER_NATIVE_VAULT_PLUGIN_METHODS,
  pluginParameter = CAPACITOR_PLUGIN_CALL_DESCRIPTOR,
  pluginAccessFlags = 0x11,
  includePlayIntegrityReference = true,
  invokePlayIntegrityReference = true,
  extraClasses = [],
  extraTypeDescriptors = [],
  extraStrings = [],
} = {}) {
  const classDescriptors = [...new Set([...requiredClasses, ...extraClasses])];
  const typeDescriptors = [...new Set([
    ...classDescriptors,
    ...extraTypeDescriptors,
    MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
    MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR,
    PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR,
    pluginSuperclass,
    OBJECT_DESCRIPTOR,
    CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
    CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
    pluginParameter,
    PREPARE_REQUEST_DESCRIPTOR,
    TASK_DESCRIPTOR,
    VOID_DESCRIPTOR,
  ])];
  const pluginMethodNames = [...pluginMethods].sort();
  const attestationMethodName = 'prepareIntegrityTokenForFixture';
  const referencedMethods = includePlayIntegrityReference ? [{
    owner: PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR,
    name: 'prepareIntegrityToken',
    parameter: PREPARE_REQUEST_DESCRIPTOR,
    result: TASK_DESCRIPTOR,
  }] : [];
  const methodRecords = [
    ...pluginMethodNames.map((name) => ({
      owner: MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
      name,
      proto: 0,
    })),
    {
      owner: MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR,
      name: attestationMethodName,
      proto: 2,
    },
    ...referencedMethods.map((method) => ({ ...method, proto: 1 })),
  ];
  const attestationMethodIndex = pluginMethodNames.length;
  const playIntegrityMethodIndex = includePlayIntegrityReference
    ? attestationMethodIndex + 1
    : null;
  const strings = [...new Set([
    ...typeDescriptors,
    ...methodRecords.map((method) => method.name),
    ...extraStrings,
    'name',
    pluginName,
    'VL',
    'LL',
    'VLL',
  ])];
  const stringIndex = new Map(strings.map((value, index) => [value, index]));
  const typeIndex = new Map(typeDescriptors.map((value, index) => [value, index]));

  const headerSize = 112;
  const stringIdsOffset = headerSize;
  const typeIdsOffset = stringIdsOffset + (strings.length * 4);
  const protoIdsOffset = typeIdsOffset + (typeDescriptors.length * 4);
  const protoCount = 3;
  const methodIdsOffset = protoIdsOffset + (protoCount * 12);
  const classDefsOffset = methodIdsOffset + (methodRecords.length * 8);
  const dataOffset = align(classDefsOffset + (classDescriptors.length * 32));

  const chunks = [];
  let cursor = dataOffset;
  const allocate = (bytes, alignment = 1) => {
    const aligned = align(cursor, alignment);
    if (aligned > cursor) chunks.push({ offset: cursor, bytes: Buffer.alloc(aligned - cursor) });
    cursor = aligned;
    const offset = cursor;
    chunks.push({ offset, bytes });
    cursor += bytes.length;
    return offset;
  };

  const pluginParameters = Buffer.alloc(8);
  pluginParameters.writeUInt32LE(1, 0);
  pluginParameters.writeUInt16LE(typeIndex.get(pluginParameter), 4);
  const pluginParametersOffset = allocate(pluginParameters, 4);
  const integrityParameters = Buffer.alloc(8);
  integrityParameters.writeUInt32LE(1, 0);
  integrityParameters.writeUInt16LE(typeIndex.get(PREPARE_REQUEST_DESCRIPTOR), 4);
  const integrityParametersOffset = allocate(integrityParameters, 4);
  const attestationParameters = Buffer.alloc(8);
  attestationParameters.writeUInt32LE(2, 0);
  attestationParameters.writeUInt16LE(typeIndex.get(PLAY_INTEGRITY_STANDARD_MANAGER_DESCRIPTOR), 4);
  attestationParameters.writeUInt16LE(typeIndex.get(PREPARE_REQUEST_DESCRIPTOR), 6);
  const attestationParametersOffset = allocate(attestationParameters, 4);

  const stringOffsets = [];
  for (const value of strings) {
    const bytes = Buffer.from(value, 'utf8');
    stringOffsets.push(allocate(Buffer.concat([uleb128(value.length), bytes, Buffer.from([0])])));
  }

  const pluginMethodCode = Buffer.alloc(18);
  pluginMethodCode.writeUInt16LE(2, 0);
  pluginMethodCode.writeUInt16LE(2, 2);
  pluginMethodCode.writeUInt32LE(1, 12);
  pluginMethodCode.writeUInt16LE(0x000e, 16);
  const pluginMethodCodeOffset = allocate(pluginMethodCode, 4);

  const attestationInstructions = includePlayIntegrityReference && invokePlayIntegrityReference
    ? [0x2072, playIntegrityMethodIndex, 0x0021, 0x000e]
    : [0x000e];
  const attestationMethodCode = Buffer.alloc(16 + (attestationInstructions.length * 2));
  attestationMethodCode.writeUInt16LE(3, 0);
  attestationMethodCode.writeUInt16LE(3, 2);
  attestationMethodCode.writeUInt16LE(attestationInstructions.length > 1 ? 2 : 0, 4);
  attestationMethodCode.writeUInt32LE(attestationInstructions.length, 12);
  for (let index = 0; index < attestationInstructions.length; index += 1) {
    attestationMethodCode.writeUInt16LE(attestationInstructions[index], 16 + (index * 2));
  }
  const attestationMethodCodeOffset = allocate(attestationMethodCode, 4);

  const classData = [uleb128(0), uleb128(0), uleb128(0), uleb128(pluginMethodNames.length)];
  let previousMethodIndex = 0;
  for (let index = 0; index < pluginMethodNames.length; index += 1) {
    classData.push(uleb128(index === 0 ? 0 : index - previousMethodIndex));
    classData.push(uleb128(0x1));
    classData.push(uleb128(pluginMethodCodeOffset));
    previousMethodIndex = index;
  }
  const classDataOffset = allocate(Buffer.concat(classData));
  const attestationClassDataOffset = allocate(Buffer.concat([
    uleb128(0),
    uleb128(0),
    uleb128(0),
    uleb128(1),
    uleb128(attestationMethodIndex),
    uleb128(0x1),
    uleb128(attestationMethodCodeOffset),
  ]));

  const classAnnotation = Buffer.concat([
    Buffer.from([1]),
    uleb128(typeIndex.get(CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR)),
    uleb128(1),
    uleb128(stringIndex.get('name')),
    encodedStringValue(stringIndex.get(pluginName)),
  ]);
  const classAnnotationOffset = allocate(classAnnotation);
  const methodAnnotationOffset = allocate(Buffer.concat([
    Buffer.from([1]),
    uleb128(typeIndex.get(CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR)),
    uleb128(0),
  ]));

  const classAnnotationSet = Buffer.alloc(8);
  classAnnotationSet.writeUInt32LE(1, 0);
  classAnnotationSet.writeUInt32LE(classAnnotationOffset, 4);
  const classAnnotationSetOffset = allocate(classAnnotationSet, 4);
  const methodAnnotationSet = Buffer.alloc(8);
  methodAnnotationSet.writeUInt32LE(1, 0);
  methodAnnotationSet.writeUInt32LE(methodAnnotationOffset, 4);
  const methodAnnotationSetOffset = allocate(methodAnnotationSet, 4);

  const annotationDirectory = Buffer.alloc(16 + (pluginMethodNames.length * 8));
  annotationDirectory.writeUInt32LE(classAnnotationSetOffset, 0);
  annotationDirectory.writeUInt32LE(pluginMethodNames.length, 8);
  for (let index = 0; index < pluginMethodNames.length; index += 1) {
    annotationDirectory.writeUInt32LE(index, 16 + (index * 8));
    annotationDirectory.writeUInt32LE(methodAnnotationSetOffset, 20 + (index * 8));
  }
  const annotationDirectoryOffset = allocate(annotationDirectory, 4);

  const dex = Buffer.alloc(cursor);
  dex.write('dex\n035\0', 0, 'latin1');
  dex.writeUInt32LE(dex.length, 32);
  dex.writeUInt32LE(headerSize, 36);
  dex.writeUInt32LE(0x12345678, 40);
  dex.writeUInt32LE(strings.length, 56);
  dex.writeUInt32LE(stringIdsOffset, 60);
  dex.writeUInt32LE(typeDescriptors.length, 64);
  dex.writeUInt32LE(typeIdsOffset, 68);
  dex.writeUInt32LE(protoCount, 72);
  dex.writeUInt32LE(protoIdsOffset, 76);
  dex.writeUInt32LE(methodRecords.length, 88);
  dex.writeUInt32LE(methodIdsOffset, 92);
  dex.writeUInt32LE(classDescriptors.length, 96);
  dex.writeUInt32LE(classDefsOffset, 100);
  dex.writeUInt32LE(dex.length - dataOffset, 104);
  dex.writeUInt32LE(dataOffset, 108);

  for (let index = 0; index < strings.length; index += 1) {
    dex.writeUInt32LE(stringOffsets[index], stringIdsOffset + (index * 4));
  }
  for (let index = 0; index < typeDescriptors.length; index += 1) {
    dex.writeUInt32LE(stringIndex.get(typeDescriptors[index]), typeIdsOffset + (index * 4));
  }
  dex.writeUInt32LE(stringIndex.get('VL'), protoIdsOffset);
  dex.writeUInt32LE(typeIndex.get(VOID_DESCRIPTOR), protoIdsOffset + 4);
  dex.writeUInt32LE(pluginParametersOffset, protoIdsOffset + 8);
  dex.writeUInt32LE(stringIndex.get('LL'), protoIdsOffset + 12);
  dex.writeUInt32LE(typeIndex.get(TASK_DESCRIPTOR), protoIdsOffset + 16);
  dex.writeUInt32LE(integrityParametersOffset, protoIdsOffset + 20);
  dex.writeUInt32LE(stringIndex.get('VLL'), protoIdsOffset + 24);
  dex.writeUInt32LE(typeIndex.get(VOID_DESCRIPTOR), protoIdsOffset + 28);
  dex.writeUInt32LE(attestationParametersOffset, protoIdsOffset + 32);

  for (let index = 0; index < methodRecords.length; index += 1) {
    const method = methodRecords[index];
    const offset = methodIdsOffset + (index * 8);
    dex.writeUInt16LE(typeIndex.get(method.owner), offset);
    dex.writeUInt16LE(method.proto, offset + 2);
    dex.writeUInt32LE(stringIndex.get(method.name), offset + 4);
  }
  for (let index = 0; index < classDescriptors.length; index += 1) {
    const descriptor = classDescriptors[index];
    const offset = classDefsOffset + (index * 32);
    dex.writeUInt32LE(typeIndex.get(descriptor), offset);
    dex.writeUInt32LE(descriptor === MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR ? pluginAccessFlags : 0x10, offset + 4);
    dex.writeUInt32LE(
      typeIndex.get(descriptor === MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR ? pluginSuperclass : OBJECT_DESCRIPTOR),
      offset + 8,
    );
    dex.writeUInt32LE(0xffffffff, offset + 16);
    if (descriptor === MANAGER_NATIVE_VAULT_PLUGIN_DESCRIPTOR) {
      dex.writeUInt32LE(annotationDirectoryOffset, offset + 20);
      dex.writeUInt32LE(classDataOffset, offset + 24);
    } else if (descriptor === MANAGER_PLAY_INTEGRITY_ATTESTATION_DESCRIPTOR) {
      dex.writeUInt32LE(attestationClassDataOffset, offset + 24);
    }
  }
  for (const chunk of chunks) chunk.bytes.copy(dex, chunk.offset);
  createHash('sha1').update(dex.subarray(32)).digest().copy(dex, 12);
  dex.writeUInt32LE(adler32(dex.subarray(12)), 8);
  return dex;
}
