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
  'Lorg/memphiszoo/custodial/vault/WebViewInputPolicy;',
  'Lorg/memphiszoo/custodial/vault/CancellationCoordinator;',
  'Lorg/memphiszoo/custodial/vault/RemovalCoordinator;',
]);

export const CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS = Object.freeze([
  'authorizedRequest',
  'cancelEnrollment',
  'completeLegacyBinding',
  'completeLocalBinding',
  'confirmEnrollment',
  'enroll',
  'finalizeRemoval',
  'getState',
  'removeEnrollment',
  'resumeEnrollment',
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
  constructor(input, label, product = 'Custodial') {
    this.bytes = Buffer.from(input || []);
    this.label = String(label || 'classes.dex');
    this.product = String(product || 'Android');
    this.stringCache = new Map();
    this.typeCache = new Map();
    this.protoCache = new Map();
    this.classCache = null;
    this.verifyHeader();
  }

  fail(message) {
    throw new Error(`Compiled ${this.product} DEX ${this.label} ${message}`);
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
