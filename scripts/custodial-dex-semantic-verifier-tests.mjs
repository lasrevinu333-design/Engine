import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_CALL_DESCRIPTOR,
  CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
  CAPACITOR_PLUGIN_SUPER_DESCRIPTOR,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  inspectCustodialNativeVaultDexSemantics,
} from '../mobile/scripts/verify-custodial-dex-semantics.mjs';

const OBJECT_DESCRIPTOR = 'Ljava/lang/Object;';
const VOID_DESCRIPTOR = 'V';

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

function dexSemanticFixture({
  requiredClasses = CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  pluginName = 'CustodialNativeVault',
  pluginSuperclass = CAPACITOR_PLUGIN_SUPER_DESCRIPTOR,
  pluginMethods = CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  pluginParameter = CAPACITOR_PLUGIN_CALL_DESCRIPTOR,
  pluginAccessFlags = 0x11,
  extraClasses = [],
} = {}) {
  const classDescriptors = [...new Set([...requiredClasses, ...extraClasses])];
  const typeDescriptors = [...new Set([
    ...classDescriptors,
    pluginSuperclass,
    OBJECT_DESCRIPTOR,
    CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
    CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
    pluginParameter,
    VOID_DESCRIPTOR,
  ])];
  const methodNames = [...pluginMethods].sort();
  const strings = [...new Set([
    ...typeDescriptors,
    ...methodNames,
    'name',
    pluginName,
    'VL',
  ])];
  const stringIndex = new Map(strings.map((value, index) => [value, index]));
  const typeIndex = new Map(typeDescriptors.map((value, index) => [value, index]));

  const headerSize = 112;
  const stringIdsOffset = headerSize;
  const typeIdsOffset = stringIdsOffset + (strings.length * 4);
  const protoIdsOffset = typeIdsOffset + (typeDescriptors.length * 4);
  const methodIdsOffset = protoIdsOffset + 12;
  const classDefsOffset = methodIdsOffset + (methodNames.length * 8);
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

  const parameterList = Buffer.alloc(8);
  parameterList.writeUInt32LE(1, 0);
  parameterList.writeUInt16LE(typeIndex.get(pluginParameter), 4);
  const parameterListOffset = allocate(parameterList, 4);

  const stringOffsets = [];
  for (const value of strings) {
    const bytes = Buffer.from(value, 'utf8');
    stringOffsets.push(allocate(Buffer.concat([uleb128(value.length), bytes, Buffer.from([0])])));
  }

  const methodCode = Buffer.alloc(18);
  methodCode.writeUInt16LE(2, 0);
  methodCode.writeUInt16LE(2, 2);
  methodCode.writeUInt32LE(1, 12);
  methodCode.writeUInt16LE(0x000e, 16);
  const methodCodeOffset = allocate(methodCode, 4);

  const classData = [uleb128(0), uleb128(0), uleb128(0), uleb128(methodNames.length)];
  let previousMethodIndex = 0;
  for (let index = 0; index < methodNames.length; index += 1) {
    classData.push(uleb128(index === 0 ? 0 : index - previousMethodIndex));
    classData.push(uleb128(0x1));
    classData.push(uleb128(methodCodeOffset));
    previousMethodIndex = index;
  }
  const classDataOffset = allocate(Buffer.concat(classData));

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

  const annotationDirectory = Buffer.alloc(16 + (methodNames.length * 8));
  annotationDirectory.writeUInt32LE(classAnnotationSetOffset, 0);
  annotationDirectory.writeUInt32LE(methodNames.length, 8);
  for (let index = 0; index < methodNames.length; index += 1) {
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
  dex.writeUInt32LE(1, 72);
  dex.writeUInt32LE(protoIdsOffset, 76);
  dex.writeUInt32LE(methodNames.length, 88);
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
  dex.writeUInt32LE(parameterListOffset, protoIdsOffset + 8);

  for (let index = 0; index < methodNames.length; index += 1) {
    const offset = methodIdsOffset + (index * 8);
    dex.writeUInt16LE(typeIndex.get(CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR), offset);
    dex.writeUInt16LE(0, offset + 2);
    dex.writeUInt32LE(stringIndex.get(methodNames[index]), offset + 4);
  }
  for (let index = 0; index < classDescriptors.length; index += 1) {
    const descriptor = classDescriptors[index];
    const offset = classDefsOffset + (index * 32);
    dex.writeUInt32LE(typeIndex.get(descriptor), offset);
    dex.writeUInt32LE(descriptor === CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR ? pluginAccessFlags : 0x10, offset + 4);
    dex.writeUInt32LE(
      typeIndex.get(descriptor === CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR ? pluginSuperclass : OBJECT_DESCRIPTOR),
      offset + 8,
    );
    dex.writeUInt32LE(0xffffffff, offset + 16);
    if (descriptor === CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR) {
      dex.writeUInt32LE(annotationDirectoryOffset, offset + 20);
      dex.writeUInt32LE(classDataOffset, offset + 24);
    }
  }
  for (const chunk of chunks) chunk.bytes.copy(dex, chunk.offset);
  createHash('sha1').update(dex.subarray(32)).digest().copy(dex, 12);
  dex.writeUInt32LE(adler32(dex.subarray(12)), 8);
  return dex;
}

const oldDescriptor = 'Lcom/aparajita/capacitor/securestorage/SecureStorage;';
const validDex = dexSemanticFixture();
const validProof = inspectCustodialNativeVaultDexSemantics(
  [{ name: 'classes.dex', bytes: validDex }],
  { oldSecureStorageDescriptor: oldDescriptor },
);
assert.equal(validProof.native_class_closure_verified, true);
assert.equal(validProof.plugin_extends_capacitor_plugin, true);
assert.equal(validProof.plugin_annotation_verified, true);
assert.equal(validProof.plugin_methods_verified, true);
assert.deepEqual(validProof.plugin_method_names, CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS);
assert.match(validProof.dex_sha256['classes.dex'], /^[a-f0-9]{64}$/);

assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ requiredClasses: CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.slice(0, -1) }),
  }]),
  /missing native vault class closure/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ pluginSuperclass: OBJECT_DESCRIPTOR }),
  }]),
  /does not directly extend Capacitor Plugin/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ pluginName: 'CredentialExporter' }),
  }]),
  /@CapacitorPlugin annotation payload is malformed/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({
      pluginMethods: CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS.filter(
        (method) => method !== 'authorizedRequest',
      ),
    }),
  }]),
  /WebView API differs from policy.*missing: authorizedRequest/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ pluginMethods: [...CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS, 'readCredential'] }),
  }]),
  /WebView API differs from policy.*unexpected: readCredential/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ pluginParameter: OBJECT_DESCRIPTOR }),
  }]),
  /method has an unsafe signature/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ pluginAccessFlags: 0x1 }),
  }]),
  /must be public, final, and concrete/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([
    { name: 'classes.dex', bytes: validDex },
    { name: 'classes2.dex', bytes: validDex },
  ]),
  /defines security class more than once/,
);
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{
    name: 'classes.dex',
    bytes: dexSemanticFixture({ extraClasses: [oldDescriptor] }),
  }], { oldSecureStorageDescriptor: oldDescriptor }),
  /old SecureStorage plugin class/,
);
const corruptedDex = Buffer.from(validDex);
corruptedDex[corruptedDex.length - 1] ^= 0xff;
assert.throws(
  () => inspectCustodialNativeVaultDexSemantics([{ name: 'classes.dex', bytes: corruptedDex }]),
  /SHA-1 header signature is invalid/,
);

console.log('Custodial DEX semantic verifier tests passed.');
