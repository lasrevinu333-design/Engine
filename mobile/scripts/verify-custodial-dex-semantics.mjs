import { createHash } from 'node:crypto';

const DEX_HEADER_SIZE = 112;
const DEX_ENDIAN_CONSTANT = 0x12345678;
const NO_INDEX = 0xffffffff;
const MAX_DEX_STRING_BYTES = 4 * 1024 * 1024;

const ACC_PUBLIC = 0x0001;
const ACC_PRIVATE = 0x0002;
const ACC_PROTECTED = 0x0004;
const ACC_STATIC = 0x0008;
const ACC_FINAL = 0x0010;
const ACC_NATIVE = 0x0100;
const ACC_INTERFACE = 0x0200;
const ACC_ABSTRACT = 0x0400;

const VISIBILITY_RUNTIME = 1;
const VALUE_BYTE = 0x00;
const VALUE_SHORT = 0x02;
const VALUE_CHAR = 0x03;
const VALUE_INT = 0x04;
const VALUE_LONG = 0x06;
const VALUE_FLOAT = 0x10;
const VALUE_DOUBLE = 0x11;
const VALUE_METHOD_TYPE = 0x15;
const VALUE_METHOD_HANDLE = 0x16;
const VALUE_STRING = 0x17;
const VALUE_TYPE = 0x18;
const VALUE_FIELD = 0x19;
const VALUE_METHOD = 0x1a;
const VALUE_ENUM = 0x1b;
const VALUE_ARRAY = 0x1c;
const VALUE_ANNOTATION = 0x1d;
const VALUE_NULL = 0x1e;
const VALUE_BOOLEAN = 0x1f;

export const CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION = '1.0.0';

export const CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR =
  'Lorg/memphiszoo/custodial/vault/CustodialNativeVaultPlugin;';
export const CAPACITOR_PLUGIN_SUPER_DESCRIPTOR = 'Lcom/getcapacitor/Plugin;';
export const CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR =
  'Lcom/getcapacitor/annotation/CapacitorPlugin;';
export const CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR = 'Lcom/getcapacitor/PluginMethod;';
export const CAPACITOR_PLUGIN_CALL_DESCRIPTOR = 'Lcom/getcapacitor/PluginCall;';

export const CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS = Object.freeze([
  CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR,
  'Lorg/memphiszoo/custodial/vault/VaultEngine;',
  'Lorg/memphiszoo/custodial/vault/SharedPreferencesVaultPersistence;',
  'Lorg/memphiszoo/custodial/vault/AndroidKeystoreCipher;',
  'Lorg/memphiszoo/custodial/vault/HttpsEnrollmentTransport;',
  'Lorg/memphiszoo/custodial/vault/NativeAttestation;',
  'Lorg/memphiszoo/custodial/vault/OfflineAuthorityTime;',
  'Lorg/memphiszoo/custodial/vault/AndroidOfflineAuthorityTimeStore;',
  'Lorg/memphiszoo/custodial/vault/AndroidProtectedWorkPreferences;',
  'Lorg/memphiszoo/custodial/vault/AndroidReadOnlyPreferences;',
  'Lorg/memphiszoo/custodial/vault/NativeReadinessObservation;',
  'Lorg/memphiszoo/custodial/vault/WebViewInputPolicy;',
  'Lorg/memphiszoo/custodial/vault/CancellationCoordinator;',
  'Lorg/memphiszoo/custodial/vault/RemovalCoordinator;',
]);

export const CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS = Object.freeze([
  'acknowledgeOfflineCompletion',
  'anchorOfflineAuthoritySnapshot',
  'attestOfflineCompletion',
  'attestOfflineStart',
  'attestScanIntent',
  'authorizeOfflineNewWork',
  'authorizedRequest',
  'beginRollbackFence',
  'bindScanEntry',
  'cancelEnrollment',
  'captureOfflineCompletionTime',
  'checkRemovalAdmission',
  'clearRollbackFence',
  'completeLegacyBinding',
  'completeLocalBinding',
  'confirmEnrollment',
  'consumeScanEntry',
  'enroll',
  'finalizeRemoval',
  'getAuthenticatedCompletion',
  'getCustodialReadinessObservation',
  'getOfflineAuthorityState',
  'getState',
  'loadOfflineAuthoritySnapshot',
  'providerApplyAction',
  'providerClaimNext',
  'providerClaimState',
  'providerMirrorAttach',
  'providerMirrorDetach',
  'providerMirrorStopped',
  'providerRetireClaim',
  'recoverPendingScanIntent',
  'removeEnrollment',
  'reportRecoveryDiagnostic',
  'resumeEnrollment',
  'retireAuthenticatedCompletion',
  'verifyScanEntry',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function adler32(bytes) {
  const modulus = 65521;
  let first = 1;
  let second = 0;
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    const end = Math.min(offset + 4096, bytes.length);
    for (let index = offset; index < end; index += 1) {
      first += bytes[index];
      second += first;
    }
    first %= modulus;
    second %= modulus;
  }
  return ((second << 16) | first) >>> 0;
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class DexSemanticReader {
  constructor(input, label) {
    this.bytes = Buffer.from(input || []);
    this.label = String(label || 'classes.dex');
    this.stringCache = new Map();
    this.typeCache = new Map();
    this.protoCache = new Map();
    this.classCache = null;
    this.verifyHeader();
  }

  fail(message) {
    throw new Error(`Compiled Custodial DEX ${this.label} ${message}`);
  }

  requireRegion(offset, size, label) {
    if (
      !Number.isSafeInteger(offset)
      || !Number.isSafeInteger(size)
      || offset < 0
      || size < 0
      || offset + size > this.bytes.length
    ) this.fail(`${label} is out of bounds`);
  }

  u1(offset, label = 'byte') {
    this.requireRegion(offset, 1, label);
    return this.bytes[offset];
  }

  u2(offset, label = 'short') {
    this.requireRegion(offset, 2, label);
    return this.bytes.readUInt16LE(offset);
  }

  u4(offset, label = 'integer') {
    this.requireRegion(offset, 4, label);
    return this.bytes.readUInt32LE(offset);
  }

  table(offset, count, width, label) {
    if (!Number.isSafeInteger(count) || count < 0) this.fail(`${label} count is malformed`);
    const size = count * width;
    if (!Number.isSafeInteger(size)) this.fail(`${label} size is malformed`);
    this.requireRegion(offset, size, label);
  }

  boundedVariableCount(count, offset, minimumWidth, label) {
    if (
      !Number.isSafeInteger(count)
      || count < 0
      || count > Math.floor((this.bytes.length - offset) / minimumWidth)
    ) this.fail(`${label} count exceeds the remaining DEX data`);
  }

  verifyHeader() {
    if (
      this.bytes.length < DEX_HEADER_SIZE
      || !/^dex\n(?:035|037|038|039|040|041)\0$/.test(this.bytes.subarray(0, 8).toString('latin1'))
      || this.u4(32, 'file size') !== this.bytes.length
      || this.u4(36, 'header size') !== DEX_HEADER_SIZE
      || this.u4(40, 'endian tag') !== DEX_ENDIAN_CONSTANT
    ) this.fail('header is malformed');

    const expectedSignature = this.bytes.subarray(12, 32).toString('hex');
    const actualSignature = createHash('sha1').update(this.bytes.subarray(32)).digest('hex');
    if (actualSignature !== expectedSignature) this.fail('SHA-1 header signature is invalid');
    if (adler32(this.bytes.subarray(12)) !== this.u4(8, 'Adler-32 checksum')) {
      this.fail('Adler-32 header checksum is invalid');
    }

    this.stringCount = this.u4(56, 'string count');
    this.stringOffset = this.u4(60, 'string offset');
    this.typeCount = this.u4(64, 'type count');
    this.typeOffset = this.u4(68, 'type offset');
    this.protoCount = this.u4(72, 'proto count');
    this.protoOffset = this.u4(76, 'proto offset');
    this.methodCount = this.u4(88, 'method count');
    this.methodOffset = this.u4(92, 'method offset');
    this.classCount = this.u4(96, 'class count');
    this.classOffset = this.u4(100, 'class offset');
    this.table(this.stringOffset, this.stringCount, 4, 'string IDs');
    this.table(this.typeOffset, this.typeCount, 4, 'type IDs');
    this.table(this.protoOffset, this.protoCount, 12, 'proto IDs');
    this.table(this.methodOffset, this.methodCount, 8, 'method IDs');
    this.table(this.classOffset, this.classCount, 32, 'class definitions');
  }

  uleb(offset, label = 'ULEB128') {
    let value = 0;
    let shift = 0;
    let cursor = offset;
    for (let count = 0; count < 5; count += 1) {
      const byte = this.u1(cursor, label);
      cursor += 1;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return { value: value >>> 0, next: cursor };
      shift += 7;
    }
    this.fail(`${label} is malformed`);
  }

  string(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.stringCount) {
      this.fail('string index is out of bounds');
    }
    if (this.stringCache.has(index)) return this.stringCache.get(index);
    const offset = this.u4(this.stringOffset + (index * 4), 'string data offset');
    const length = this.uleb(offset, 'string UTF-16 length');
    const endLimit = Math.min(this.bytes.length, length.next + MAX_DEX_STRING_BYTES + 1);
    const end = this.bytes.indexOf(0, length.next);
    if (end < 0 || end >= endLimit) this.fail('string data is unterminated or unreasonably large');
    const value = this.bytes.subarray(length.next, end).toString('utf8');
    this.stringCache.set(index, value);
    return value;
  }

  type(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.typeCount) {
      this.fail('type index is out of bounds');
    }
    if (this.typeCache.has(index)) return this.typeCache.get(index);
    const descriptor = this.string(this.u4(this.typeOffset + (index * 4), 'type descriptor index'));
    this.typeCache.set(index, descriptor);
    return descriptor;
  }

  proto(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.protoCount) {
      this.fail('proto index is out of bounds');
    }
    if (this.protoCache.has(index)) return this.protoCache.get(index);
    const offset = this.protoOffset + (index * 12);
    const returnType = this.type(this.u4(offset + 4, 'proto return type'));
    const parametersOffset = this.u4(offset + 8, 'proto parameters offset');
    const parameters = [];
    if (parametersOffset !== 0) {
      const count = this.u4(parametersOffset, 'proto parameter count');
      this.table(parametersOffset + 4, count, 2, 'proto parameters');
      for (let position = 0; position < count; position += 1) {
        parameters.push(this.type(this.u2(parametersOffset + 4 + (position * 2), 'proto parameter type')));
      }
    }
    const descriptor = `(${parameters.join('')})${returnType}`;
    this.protoCache.set(index, descriptor);
    return descriptor;
  }

  method(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.methodCount) {
      this.fail('method index is out of bounds');
    }
    const offset = this.methodOffset + (index * 8);
    return {
      index,
      classIndex: this.u2(offset, 'method class index'),
      protoIndex: this.u2(offset + 2, 'method proto index'),
      name: this.string(this.u4(offset + 4, 'method name index')),
      descriptor: this.proto(this.u2(offset + 2, 'method proto index')),
    };
  }

  encodedValue(offset, depth = 0) {
    if (depth > 32) this.fail('encoded annotation value nesting is too deep');
    const header = this.u1(offset, 'encoded value header');
    const type = header & 0x1f;
    const argument = header >>> 5;
    let cursor = offset + 1;
    const scalar = () => {
      const width = argument + 1;
      if (width > 8) this.fail('encoded scalar width is malformed');
      this.requireRegion(cursor, width, 'encoded scalar');
      let value = 0n;
      for (let index = 0; index < width; index += 1) {
        value |= BigInt(this.bytes[cursor + index]) << BigInt(index * 8);
      }
      cursor += width;
      return value;
    };

    if ([
      VALUE_BYTE,
      VALUE_SHORT,
      VALUE_CHAR,
      VALUE_INT,
      VALUE_LONG,
      VALUE_FLOAT,
      VALUE_DOUBLE,
      VALUE_METHOD_TYPE,
      VALUE_METHOD_HANDLE,
      VALUE_TYPE,
      VALUE_FIELD,
      VALUE_METHOD,
      VALUE_ENUM,
    ].includes(type)) {
      return { value: { kind: 'scalar', type, value: scalar() }, next: cursor };
    }
    if (type === VALUE_STRING) {
      const index = Number(scalar());
      if (!Number.isSafeInteger(index)) this.fail('encoded string index is malformed');
      return { value: { kind: 'string', value: this.string(index) }, next: cursor };
    }
    if (type === VALUE_ARRAY) {
      if (argument !== 0) this.fail('encoded array value argument is malformed');
      const size = this.uleb(cursor, 'encoded array size');
      cursor = size.next;
      this.boundedVariableCount(size.value, cursor, 1, 'encoded array');
      const values = [];
      for (let index = 0; index < size.value; index += 1) {
        const parsed = this.encodedValue(cursor, depth + 1);
        values.push(parsed.value);
        cursor = parsed.next;
      }
      return { value: { kind: 'array', values }, next: cursor };
    }
    if (type === VALUE_ANNOTATION) {
      if (argument !== 0) this.fail('encoded annotation value argument is malformed');
      const parsed = this.encodedAnnotation(cursor, depth + 1);
      return { value: { kind: 'annotation', annotation: parsed.annotation }, next: parsed.next };
    }
    if (type === VALUE_NULL) {
      if (argument !== 0) this.fail('encoded null value argument is malformed');
      return { value: { kind: 'null', value: null }, next: cursor };
    }
    if (type === VALUE_BOOLEAN) {
      if (argument > 1) this.fail('encoded boolean value argument is malformed');
      return { value: { kind: 'boolean', value: argument === 1 }, next: cursor };
    }
    this.fail(`encoded value type 0x${type.toString(16)} is unsupported`);
  }

  encodedAnnotation(offset, depth = 0) {
    if (depth > 32) this.fail('encoded annotation nesting is too deep');
    const typeIndex = this.uleb(offset, 'annotation type index');
    const size = this.uleb(typeIndex.next, 'annotation element count');
    let cursor = size.next;
    this.boundedVariableCount(size.value, cursor, 2, 'annotation element');
    const elements = {};
    let previousNameIndex = -1;
    for (let index = 0; index < size.value; index += 1) {
      const nameIndex = this.uleb(cursor, 'annotation element name');
      cursor = nameIndex.next;
      if (nameIndex.value <= previousNameIndex) this.fail('annotation element names are not strictly ordered');
      previousNameIndex = nameIndex.value;
      const name = this.string(nameIndex.value);
      if (Object.hasOwn(elements, name)) this.fail(`annotation element repeats: ${name}`);
      const parsed = this.encodedValue(cursor, depth + 1);
      elements[name] = parsed.value;
      cursor = parsed.next;
    }
    return {
      annotation: { type: this.type(typeIndex.value), elements },
      next: cursor,
    };
  }

  annotationSet(offset) {
    if (offset === 0) return [];
    const count = this.u4(offset, 'annotation set count');
    this.table(offset + 4, count, 4, 'annotation set entries');
    const annotations = [];
    const seenOffsets = new Set();
    for (let index = 0; index < count; index += 1) {
      const annotationOffset = this.u4(offset + 4 + (index * 4), 'annotation item offset');
      if (seenOffsets.has(annotationOffset)) this.fail('annotation set repeats an item offset');
      seenOffsets.add(annotationOffset);
      const visibility = this.u1(annotationOffset, 'annotation visibility');
      if (visibility > 2) this.fail('annotation visibility is malformed');
      const parsed = this.encodedAnnotation(annotationOffset + 1);
      annotations.push({ visibility, ...parsed.annotation });
    }
    return annotations;
  }

  classData(offset) {
    if (offset === 0) return new Map();
    let cursor = offset;
    const sizes = [];
    for (const label of ['static field', 'instance field', 'direct method', 'virtual method']) {
      const size = this.uleb(cursor, `${label} count`);
      sizes.push(size.value);
      cursor = size.next;
    }
    for (const count of sizes.slice(0, 2)) {
      this.boundedVariableCount(count, cursor, 2, 'encoded field');
      let fieldIndex = 0;
      for (let index = 0; index < count; index += 1) {
        const delta = this.uleb(cursor, 'field index delta');
        cursor = delta.next;
        fieldIndex += delta.value;
        const access = this.uleb(cursor, 'field access flags');
        cursor = access.next;
      }
    }
    const methods = new Map();
    for (const count of sizes.slice(2)) {
      this.boundedVariableCount(count, cursor, 3, 'encoded method');
      let methodIndex = 0;
      for (let index = 0; index < count; index += 1) {
        const delta = this.uleb(cursor, 'method index delta');
        cursor = delta.next;
        methodIndex += delta.value;
        if (methodIndex >= this.methodCount) this.fail('class method index is out of bounds');
        const access = this.uleb(cursor, 'method access flags');
        cursor = access.next;
        const code = this.uleb(cursor, 'method code offset');
        cursor = code.next;
        if (methods.has(methodIndex)) this.fail('class data repeats a method index');
        methods.set(methodIndex, { accessFlags: access.value, codeOffset: code.value });
      }
    }
    return methods;
  }

  methodCode(offset) {
    this.requireRegion(offset, 16, 'method code header');
    const registers = this.u2(offset, 'method register count');
    const incoming = this.u2(offset + 2, 'method incoming register count');
    const instructionCount = this.u4(offset + 12, 'method instruction count');
    if (instructionCount < 1) this.fail('method contains no instructions');
    this.table(offset + 16, instructionCount, 2, 'method instructions');
    return { registers, incoming, instructionCount };
  }

  classAnnotations(offset) {
    if (offset === 0) return { classAnnotations: [], methodAnnotations: new Map() };
    const classAnnotationsOffset = this.u4(offset, 'class annotation set offset');
    const fieldCount = this.u4(offset + 4, 'annotated field count');
    const methodCount = this.u4(offset + 8, 'annotated method count');
    const parameterCount = this.u4(offset + 12, 'annotated parameter count');
    const total = fieldCount + methodCount + parameterCount;
    if (!Number.isSafeInteger(total)) this.fail('annotation directory size is malformed');
    this.table(offset + 16, total, 8, 'annotation directory entries');
    let cursor = offset + 16 + (fieldCount * 8);
    const methodAnnotations = new Map();
    let previousMethodIndex = -1;
    for (let index = 0; index < methodCount; index += 1) {
      const methodIndex = this.u4(cursor, 'annotated method index');
      const setOffset = this.u4(cursor + 4, 'method annotation set offset');
      cursor += 8;
      if (methodIndex <= previousMethodIndex || methodIndex >= this.methodCount) {
        this.fail('annotated method indices are malformed or not strictly ordered');
      }
      previousMethodIndex = methodIndex;
      methodAnnotations.set(methodIndex, this.annotationSet(setOffset));
    }
    return {
      classAnnotations: this.annotationSet(classAnnotationsOffset),
      methodAnnotations,
    };
  }

  classes() {
    if (this.classCache) return this.classCache;
    const classes = new Map();
    for (let index = 0; index < this.classCount; index += 1) {
      const offset = this.classOffset + (index * 32);
      const classIndex = this.u4(offset, 'class type index');
      const descriptor = this.type(classIndex);
      if (classes.has(descriptor)) this.fail(`defines class more than once: ${descriptor}`);
      const superclassIndex = this.u4(offset + 8, 'superclass type index');
      const classDataOffset = this.u4(offset + 24, 'class data offset');
      const annotationsOffset = this.u4(offset + 20, 'class annotations offset');
      classes.set(descriptor, {
        descriptor,
        classIndex,
        accessFlags: this.u4(offset + 4, 'class access flags'),
        superclass: superclassIndex === NO_INDEX ? null : this.type(superclassIndex),
        methods: this.classData(classDataOffset),
        annotations: this.classAnnotations(annotationsOffset),
      });
    }
    this.classCache = classes;
    return classes;
  }
}

function exactStringAnnotation(annotation, descriptor, name, value, label) {
  if (annotation.visibility !== VISIBILITY_RUNTIME || annotation.type !== descriptor) {
    throw new Error(`Compiled Custodial native vault ${label} annotation is not runtime-visible`);
  }
  const keys = Object.keys(annotation.elements);
  const element = annotation.elements[name];
  if (!sameArray(keys, [name]) || element?.kind !== 'string' || element.value !== value) {
    throw new Error(`Compiled Custodial native vault ${label} annotation payload is malformed`);
  }
}

export function inspectCustodialNativeVaultDexSemantics(
  dexEntries,
  { oldSecureStorageDescriptor = null } = {},
) {
  if (!Array.isArray(dexEntries) || !dexEntries.length) {
    throw new Error('Compiled Custodial APK contains no DEX entries');
  }
  const names = dexEntries.map((entry) => String(entry?.name || ''));
  if (
    !sameArray(names, [...names].sort())
    || new Set(names).size !== names.length
    || names.some((name) => !/^classes(?:\d+)?\.dex$/.test(name))
  ) throw new Error('Compiled Custodial DEX entry set is malformed or unsorted');

  const definitions = new Map();
  const dexSha256 = {};
  for (const entry of dexEntries) {
    const bytes = Buffer.from(entry?.bytes || []);
    if (!bytes.length) throw new Error(`Compiled Custodial DEX entry is empty: ${entry.name}`);
    dexSha256[entry.name] = sha256(bytes);
    const reader = new DexSemanticReader(bytes, entry.name);
    for (const [descriptor, definition] of reader.classes()) {
      if (
        CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.includes(descriptor)
        || descriptor === oldSecureStorageDescriptor
      ) {
        if (definitions.has(descriptor)) {
          throw new Error(`Compiled Custodial DEX defines security class more than once: ${descriptor}`);
        }
        definitions.set(descriptor, { reader, definition, dexName: entry.name });
      }
    }
  }

  if (oldSecureStorageDescriptor && definitions.has(oldSecureStorageDescriptor)) {
    throw new Error('Compiled Custodial DEX still contains the old SecureStorage plugin class');
  }
  const missing = CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS
    .filter((descriptor) => !definitions.has(descriptor));
  if (missing.length) {
    throw new Error(`Compiled Custodial DEX is missing native vault class closure: ${missing.join(', ')}`);
  }

  const pluginRecord = definitions.get(CUSTODIAL_NATIVE_VAULT_PLUGIN_DESCRIPTOR);
  const { reader, definition: plugin } = pluginRecord;
  if (plugin.superclass !== CAPACITOR_PLUGIN_SUPER_DESCRIPTOR) {
    throw new Error('Compiled Custodial native vault plugin does not directly extend Capacitor Plugin');
  }
  if (
    (plugin.accessFlags & ACC_PUBLIC) === 0
    || (plugin.accessFlags & ACC_FINAL) === 0
    || (plugin.accessFlags & (ACC_INTERFACE | ACC_ABSTRACT)) !== 0
  ) throw new Error('Compiled Custodial native vault plugin class must be public, final, and concrete');

  const capacitorPluginAnnotations = plugin.annotations.classAnnotations.filter(
    (annotation) => annotation.type === CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
  );
  if (capacitorPluginAnnotations.length !== 1) {
    throw new Error(
      `Compiled Custodial native vault must have exactly one @CapacitorPlugin annotation; found ${capacitorPluginAnnotations.length}`,
    );
  }
  exactStringAnnotation(
    capacitorPluginAnnotations[0],
    CAPACITOR_PLUGIN_ANNOTATION_DESCRIPTOR,
    'name',
    'CustodialNativeVault',
    '@CapacitorPlugin',
  );

  const exposed = [];
  for (const [methodIndex, annotations] of plugin.annotations.methodAnnotations) {
    const pluginMethodAnnotations = annotations.filter(
      (annotation) => annotation.type === CAPACITOR_PLUGIN_METHOD_ANNOTATION_DESCRIPTOR,
    );
    if (pluginMethodAnnotations.length > 1) {
      throw new Error('Compiled Custodial native vault method repeats @PluginMethod');
    }
    if (pluginMethodAnnotations.length === 0) continue;
    const annotation = pluginMethodAnnotations[0];
    if (annotation.visibility !== VISIBILITY_RUNTIME || Object.keys(annotation.elements).length !== 0) {
      throw new Error('Compiled Custodial native vault @PluginMethod annotation is malformed');
    }
    const method = reader.method(methodIndex);
    if (method.classIndex !== plugin.classIndex || !plugin.methods.has(methodIndex)) {
      throw new Error('Compiled Custodial native vault annotation targets a method outside the plugin class');
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
      throw new Error(`Compiled Custodial native vault method has an unsafe signature: ${method.name}`);
    }
    exposed.push(method.name);
  }
  exposed.sort();
  if (!sameArray(exposed, CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS)) {
    const expected = new Set(CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS);
    const actual = new Set(exposed);
    const missingMethods = CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS.filter((name) => !actual.has(name));
    const extraMethods = exposed.filter((name) => !expected.has(name));
    throw new Error(
      `Compiled Custodial native vault WebView API differs from policy (missing: ${missingMethods.join(', ') || 'none'}; unexpected: ${extraMethods.join(', ') || 'none'})`,
    );
  }

  const classLocations = Object.fromEntries(
    CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.map((descriptor) => [descriptor, definitions.get(descriptor).dexName]),
  );
  return {
    dex_semantic_verifier_version: CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
    native_class_present: true,
    native_class_closure_verified: true,
    plugin_extends_capacitor_plugin: true,
    plugin_annotation_verified: true,
    plugin_methods_verified: true,
    plugin_method_names: [...exposed],
    required_class_locations: classLocations,
    dex_sha256: dexSha256,
  };
}

// Closed compiler-output subset for immutable NEW-producer scope. This reads
// actual class definitions/code, never DEX strings alone or caller proof flags.
export function inspectCustodialNewProducerScopeDexSemantics(dexEntries,{profile,policySha256}) {
  if(!['full-system','cleaning-first-retained-continuity-v1'].includes(profile)||!/^[a-f0-9]{64}$/.test(policySha256))throw Error('Exact declared scope inputs required');
  const enabled=profile==='full-system'?1:0;
  const families=['org/memphiszoo/custodial/vault','com/capacitorjs/plugins/localnotifications','io/capawesome/capacitorjs/plugins/firebase/messaging'];
  const scopes=families.map(x=>'L'+x+'/CustodialNewProducerScope;');
  const plugins=['Lcom/capacitorjs/plugins/localnotifications/LocalNotificationsPlugin;','Lio/capawesome/capacitorjs/plugins/firebase/messaging/FirebaseMessagingPlugin;','Lorg/memphiszoo/custodial/vault/CustodialNativeVaultPlugin;'];
  const wanted=new Set([...scopes,...plugins]),defs=new Map(),names=new Set();
  for(const e of dexEntries){if(!/^classes(?:[2-9]|[1-9][0-9]+)?\.dex$/.test(e.name)||names.has(e.name))throw Error('Scope DEX identity');names.add(e.name);const reader=new DexSemanticReader(Buffer.from(e.bytes),e.name);for(const[d,definition]of reader.classes())if(wanted.has(d)){if(defs.has(d))throw Error('Duplicate compiled scope/plugin definition');defs.set(d,{reader,definition,dexName:e.name});}}
  if(names.size>16)throw Error('Unsupported scope DEX census');for(let i=1;i<=names.size;i++)if(!names.has(i===1?'classes.dex':`classes${i}.dex`))throw Error('Noncontiguous scope DEX census');
  if(defs.size!==wanted.size)throw Error('Incomplete compiled scope/plugin closure');
  function method(rec,name,descriptor){const found=[...rec.definition.methods].filter(([i])=>{const m=rec.reader.method(i);return m.name===name&&m.descriptor===descriptor;});if(found.length!==1)throw Error('Missing/duplicate scoped method '+name);const[i,c]=found[0];if(!c.codeOffset||(c.accessFlags&(ACC_NATIVE|ACC_ABSTRACT)))throw Error('Non-code scoped method');return {i,c,code:rec.reader.methodCode(c.codeOffset),base:c.codeOffset+16};}
  function unit(rec,m,i){if(i<0||i>=m.code.instructionCount)throw Error('Scope instruction boundary');return rec.reader.u2(m.base+i*2,'scope instruction');}
  function scalar(rec,name,desc,want){const m=method(rec,name,desc),u=unit(rec,m,0),op=u&255;if(rec.reader.u2(m.c.codeOffset+6)!==0)throw Error('Literal scope scalar cannot have exception handlers');let reg=u>>>8,n,value;
    if(op===0x12){reg=(u>>>8)&15;value=(u>>12)&15;if(value&8)value-=16;n=1;}
    else if(op===0x1a||op===0x1b){const ix=op===0x1a?unit(rec,m,1):rec.reader.u4(m.base+2,'scope jumbo string');value=rec.reader.string(ix);n=op===0x1a?2:3;}
    else throw Error('Unsupported compiled scope scalar');
    if(m.code.instructionCount!==n+1||unit(rec,m,n)!==((reg<<8)|(desc==='()Z'?0x0f:0x11))||value!==want)throw Error('Compiled scope scalar mismatch');
    if((m.c.accessFlags&ACC_STATIC)===0||m.code.incoming!==0)throw Error('Scoped scalar must be static');
  }
  for(const d of scopes){const r=defs.get(d);if(r.definition.superclass!=='Ljava/lang/Object;'||r.definition.accessFlags!==ACC_FINAL)throw Error('Scope class shape');
    const offsets=[];for(let j=0;j<r.reader.classCount;j++){const o=r.reader.classOffset+32*j;if(r.reader.u4(o)===r.definition.classIndex)offsets.push(o);}if(offsets.length!==1)throw Error('Scope class metadata identity');const o=offsets[0],interfaces=r.reader.u4(o+12),annotations=r.reader.u4(o+20),data=r.reader.u4(o+24);if((interfaces&&r.reader.u4(interfaces)!==0)||r.reader.u4(o+28)!==0||r.reader.string(r.reader.u4(o+16))!=='CustodialNewProducerScope.java')throw Error('Unexpected scope interfaces/static values/Source file');const sf=r.reader.uleb(data),f=r.reader.uleb(sf.next);if(sf.value||f.value)throw Error('Unexpected scope fields');if(annotations&&(r.reader.u4(annotations+4)||r.reader.u4(annotations+8)||r.reader.u4(annotations+12)))throw Error('Unexpected scope annotation directory');if(r.definition.annotations.classAnnotations.length)throw Error('Unexpected scope class annotations');
    const n=[...r.definition.methods].map(([i])=>r.reader.method(i).name).sort();if(JSON.stringify(n)!==JSON.stringify(['<init>','enabled','profile','sourcePolicySha256']))throw Error('Scope class has unexpected methods/static initializer');
    for(const [i,c]of r.definition.methods){const m=r.reader.method(i);if(c.accessFlags!==(m.name==='<init>'?0x10002:ACC_STATIC))throw Error('Scope method Source access');}
    const ctor=method(r,'<init>','()V'),first=unit(r,ctor,0),target=r.reader.method(unit(r,ctor,1));if(ctor.code.registers!==1||ctor.code.incoming!==1||ctor.code.instructionCount!==4||r.reader.u2(ctor.c.codeOffset+4)!==1||r.reader.u2(ctor.c.codeOffset+6)!==0||first!==0x1070||unit(r,ctor,2)!==0||unit(r,ctor,3)!==0x0e||r.reader.type(target.classIndex)!=='Ljava/lang/Object;'||target.name!=='<init>'||target.descriptor!=='()V')throw Error('Scope constructor differs from literal Source');
    scalar(r,'enabled','()Z',enabled);scalar(r,'profile','()Ljava/lang/String;',profile);scalar(r,'sourcePolicySha256','()Ljava/lang/String;',policySha256);
  }
  function called(rec,index){const m=rec.reader.method(index);return {...m,owner:rec.reader.type(m.classIndex)};}
  function invocation(rec,m,at){const u=unit(rec,m,at),op=u&255,index=unit(rec,m,at+1);let regs=[];
    if(op>=0x6e&&op<=0x72){const count=(u>>>12)&15,g=(u>>>8)&15,v=unit(rec,m,at+2);regs=[v&15,(v>>>4)&15,(v>>>8)&15,(v>>>12)&15,g].slice(0,count);}
    else if(op>=0x74&&op<=0x78){const count=u>>>8,start=unit(rec,m,at+2);regs=Array.from({length:count},(_,i)=>start+i);}
    else throw Error('Unsupported scoped invoke');return {op,method:called(rec,index),regs};
  }
  function proveHelper(rec,scopeDescriptor,name,withCall){const m=method(rec,name,withCall?'(Lcom/getcapacitor/PluginCall;)Z':'()Z'),regs=new Map();if(rec.reader.u2(m.c.codeOffset+6)!==0)throw Error('Literal new admission helper cannot have exception handlers');if(withCall)regs.set(m.code.registers-1,'ACTUAL_PLUGIN_CALL');let pc=0,last,steps=0,rejected=0;const visited=new Set();
    while(++steps<=64){if(visited.has(pc))throw Error('Scope helper loop');visited.add(pc);const u=unit(rec,m,pc),op=u&255,a=u>>>8;
      if([0x71,0x77].includes(op)){const c=invocation(rec,m,pc);if(c.method.owner!==scopeDescriptor||c.method.name!=='enabled'||c.method.descriptor!=='()Z'||c.regs.length!==0)throw Error('Unexpected scope helper call');last=enabled;pc+=3;}
      else if(op===0x0a){if(last!==enabled)throw Error('Scope result');regs.set(a,last);pc++;}
      else if(op===0x38||op===0x39){if(!regs.has(a))throw Error('Unknown scope branch');const delta=(unit(rec,m,pc+1)<<16)>>16;const zero=regs.get(a)===0;pc+=(op===0x38?zero:!zero)?delta:2;}
      else if(op===0x12){const r=(u>>>8)&15,v=(u>>12)&15;regs.set(r,v&8?v-16:v);pc++;}
      else if(op===0x1a||op===0x1b){regs.set(a,rec.reader.string(op===0x1a?unit(rec,m,pc+1):rec.reader.u4(m.base+(pc+1)*2,'scope string')));pc+=op===0x1a?2:3;}
      else if([0x07,0x01].includes(op)){const dst=(u>>>8)&15,src=(u>>>12)&15;if(!regs.has(src))throw Error('Unknown scope move');regs.set(dst,regs.get(src));pc++;}
      else if([0x08,0x02].includes(op)){const src=unit(rec,m,pc+1);if(!regs.has(src))throw Error('Unknown scope move');regs.set(a,regs.get(src));pc+=2;}
      else if([0x6e,0x74].includes(op)){const c=invocation(rec,m,pc);if(!withCall||c.method.owner!=='Lcom/getcapacitor/PluginCall;'||c.method.name!=='reject'||c.method.descriptor!=='(Ljava/lang/String;)V'||c.regs.length!==2||regs.get(c.regs[0])!=='ACTUAL_PLUGIN_CALL'||regs.get(c.regs[1])!=='custodial_new_producer_scope_deferred'||++rejected!==1)throw Error('Unexpected scoped refusal effect');pc+=3;}
      else if(op===0x0f){if(regs.get(a)!==enabled||rejected!==(withCall&&!enabled?1:0))throw Error('Scope helper differs from declared admission semantics');return;}
      else if(op===0x00&&u===0)pc++;else throw Error('Unsupported scope helper opcode '+op.toString(16));
    }throw Error('Unbounded scope helper');
  }
  // Literal Source prepends the NEW guard outside every retained body try.
  // Reject protected ranges or handler entry points that can add an exceptional
  // edge from/into that prefix. Retained body exception tables remain intact.
  function rejectPublicGuardExceptionEdges(rec,m){
    const count=rec.reader.u2(m.c.codeOffset+6);if(!count)return;
    const start=m.base+2*m.code.instructionCount+(m.code.instructionCount%2?2:0),handlersBase=start+8*count;
    rec.reader.table(start,count,8,'public method tries');const offsets=[];let previousEnd=7;
    for(let j=0;j<count;j++){const o=start+8*j,a=rec.reader.u4(o),n=rec.reader.u2(o+4);if(a<7||a<previousEnd||n===0||a+n>m.code.instructionCount)throw Error('NEW guard exception coverage differs from literal Source');previousEnd=a+n;offsets.push(rec.reader.u2(o+6));}
    const h=rec.reader.uleb(handlersBase);if(h.value<1||h.value>65535)throw Error('Public guard handler bound');let at=h.next;const seen=new Set();
    function signed(){let value=0n,shift=0n;for(let k=0;k<5;k++){const b=rec.reader.u1(at++);value|=BigInt(b&127)<<shift;shift+=7n;if(!(b&128)){if(b&64)value|=(-1n)<<shift;if(value< -2147483648n||value>2147483647n)throw Error('Public guard handler overflow');return Number(value);}}throw Error('Malformed public guard handler');}
    function address(){const q=rec.reader.uleb(at);at=q.next;if(q.value<7||q.value>=m.code.instructionCount)throw Error('Exception handler enters NEW guard prefix');}
    for(let j=0;j<h.value;j++){seen.add(at-handlersBase);const n=signed();if(Math.abs(n)>65535)throw Error('Public guard catch bound');rec.reader.table(at,Math.abs(n),2,'public catch pairs');for(let k=0;k<Math.abs(n);k++){const t=rec.reader.uleb(at);at=t.next;rec.reader.type(t.value);address();}if(n<=0)address();}
    for(const o of offsets)if(!seen.has(o))throw Error('Public try references unknown handler');
  }
  const targetLists=[['schedule','requestPermissions','changeExactNotificationSetting','createChannel','registerActionTypes'],['getToken','subscribeToTopic','requestPermissions','createChannel']];let guarded=0;
  for(let p=0;p<2;p++){const rec=defs.get(plugins[p]);proveHelper(rec,scopes[p+1],'admitNewProducerCall',true);
    for(const name of targetLists[p]){const m=method(rec,name,'(Lcom/getcapacitor/PluginCall;)V'),c=invocation(rec,m,0);if(![0x70,0x76].includes(c.op)||c.method.owner!==plugins[p]||c.method.name!=='admitNewProducerCall'||c.method.descriptor!=='(Lcom/getcapacitor/PluginCall;)Z'||JSON.stringify(c.regs)!==JSON.stringify([m.code.registers-2,m.code.registers-1]))throw Error('NEW producer missing first guard: '+name);const move=unit(rec,m,3),branch=unit(rec,m,4);if((move&255)!==0x0a||(branch&255)!==0x39||(move>>>8)!==(branch>>>8)||unit(rec,m,5)!==3||unit(rec,m,6)!==0x0e)throw Error('NEW producer can bypass scope refusal: '+name);rejectPublicGuardExceptionEdges(rec,m);guarded++;}
  }
  proveHelper(defs.get(plugins[2]),scopes[0],'newProducerAdmissionsEnabled',false);
  // A bounded instruction-boundary walk proves the sole NEW native attachment
  // is dominated by the same compiled profile predicate, including exception
  // handler and ordinary branch entry points. Existing callbacks are untouched.
  function instructions(rec,m){
    const rows=[];let at=0;
    while(at<m.code.instructionCount){const u=unit(rec,m,at),op=u&255;let n;
      if(op===0){if(u===0)n=1;else if(u===0x100)n=4+2*unit(rec,m,at+1);else if(u===0x200)n=2+4*unit(rec,m,at+1);else if(u===0x300)n=4+Math.ceil(unit(rec,m,at+1)*rec.reader.u4(m.base+(at+2)*2,'array payload')/2);else throw Error('Unknown DEX payload');}
      else if([1,4,7,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f,0x10,0x11,0x12,0x1d,0x1e,0x21,0x27,0x28].includes(op)||(op>=0x7b&&op<=0x8f)||(op>=0xb0&&op<=0xcf))n=1;
      else if([2,5,8,0x13,0x15,0x16,0x19,0x1a,0x1c,0x1f,0x20,0x22,0x23,0x29,0xfe,0xff].includes(op)||(op>=0x2d&&op<=0x3d)||(op>=0x44&&op<=0x6d)||(op>=0x90&&op<=0xaf)||(op>=0xd0&&op<=0xe2))n=2;
      else if([3,6,9,0x14,0x17,0x1b,0x24,0x25,0x26,0x2a,0x2b,0x2c,0xfc,0xfd].includes(op)||(op>=0x6e&&op<=0x72)||(op>=0x74&&op<=0x78))n=3;
      else if(op===0xfa||op===0xfb)n=4;else if(op===0x18)n=5;else throw Error('Unsupported native attachment opcode '+op.toString(16));
      if(!Number.isSafeInteger(n)||n<1||at+n>m.code.instructionCount)throw Error('Malformed native attachment instruction');rows.push({at,op,n});at+=n;
    }return rows;
  }
  const native=defs.get(plugins[2]);let attachments=0,predicates=0;
  for(const[i,c]of native.definition.methods){if(!c.codeOffset)continue;const m={i,c,code:native.reader.methodCode(c.codeOffset),base:c.codeOffset+16},rows=instructions(native,m),invokes=rows.filter(r=>(r.op>=0x6e&&r.op<=0x72)||(r.op>=0x74&&r.op<=0x78)).map(r=>({...r,call:invocation(native,m,r.at)}));
    const targets=invokes.filter(r=>r.call.method.owner==='Lorg/memphiszoo/custodial/vault/CustodialNativeRuntime;'&&r.call.method.name==='attachRecurringApplication');
    predicates+=invokes.filter(r=>r.call.method.owner===plugins[2]&&r.call.method.name==='newProducerAdmissionsEnabled').length;
    for(const call of targets){attachments++;const guards=invokes.filter(r=>r.at<call.at&&r.call.method.owner===plugins[2]&&r.call.method.name==='newProducerAdmissionsEnabled'&&r.call.method.descriptor==='()Z');if(guards.length!==1)throw Error('Native attachment predicate is missing/ambiguous');const g=guards[0],move=unit(native,m,g.at+3),branch=unit(native,m,g.at+4);if((move&255)!==0x0a||(branch&255)!==0x38||(move>>>8)!==(branch>>>8))throw Error('Native attachment missing false branch');const dest=g.at+4+((unit(native,m,g.at+5)<<16)>>16),lo=g.at+3,hi=call.at+3;if(dest<hi||!rows.some(r=>r.at===dest))throw Error('Native attachment false path does not skip call');
      for(const r of rows){if(r.at>=g.at+6&&r.at<call.at&&!((r.op>=1&&r.op<=9)||(r.op>=0x52&&r.op<=0x58)))throw Error('Unexpected effect between native scope and attachment');if(r.op===0x26||r.op===0x2b||r.op===0x2c)throw Error('Native attachment method has unsupported indirect branch');let target=null;if(r.op===0x28)target=r.at+((unit(native,m,r.at)>>8)<<24>>24);else if(r.op===0x29||r.op>=0x32&&r.op<=0x3d)target=r.at+((unit(native,m,r.at+1)<<16)>>16);else if(r.op===0x2a)target=r.at+(native.reader.u4(m.base+(r.at+1)*2,'native goto')|0);if(target!==null&&target>=lo&&target<hi)throw Error('Branch enters protected native attachment region');}
      const tries=native.reader.u2(c.codeOffset+6,'native try count');if(tries){let off=m.base+m.code.instructionCount*2+(m.code.instructionCount%2?2:0)+tries*8;const count=native.reader.uleb(off,'native handler count');off=count.next;function signed(){let v=0,b=0,shift=0;do{b=native.reader.u1(off++,'native signed LEB');v|=(b&127)<<shift;shift+=7;if(shift>35)throw Error('Native handler overflow');}while(b&128);return shift<32&&(b&64)?v|(-1<<shift):v;}
        for(let h=0;h<count.value;h++){const n=signed();for(let k=0;k<Math.abs(n);k++){const type=native.reader.uleb(off,'handler type');off=type.next;const address=native.reader.uleb(off,'handler address');off=address.next;if(address.value>=lo&&address.value<hi)throw Error('Exception enters native attachment region');}if(n<=0){const address=native.reader.uleb(off,'catch all address');off=address.next;if(address.value>=lo&&address.value<hi)throw Error('Catch-all enters native attachment region');}}
      }
    }
  }
  if(attachments!==1||predicates!==1)throw Error('Native NEW attachment callsite closure differs');
  return {scope_classes:3,guarded_public_new_methods:guarded,native_new_attachment_guard_verified:true,profile,policy_sha256:policySha256};
}
