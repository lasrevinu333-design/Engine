// Bounded source evidence only. No filesystem, environment, network or writes.
// This is not an absence-of-secrets proof or a generated-artifact validator.
import { createHash } from 'node:crypto';

const MAX_RECORDS = 4096;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const retiredPath = /(?:^|\/)(?:moxie(?:[-_.\/]|$)|annie-moxie-bootstrap\.|Moxie_Owl_Icon(?:[_.]|$))/i;
const privatePath = /(?:^|\/)(?:\.env(?:\.|$)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)|[^/]+\.(?:key|p12|pfx|jks|keystore)$|(?:service[-_]account|firebase[-_]adminsdk)(?:[-_.][^/]*)?\.json$)/i;
const fixturePath = /(?:^|\/)(?:tests?|fixtures?|__tests__|__mocks__|test-results|playwright-report)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|\.map$/i;
const privateMarker = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|-----BEGIN PGP PRIVATE KEY BLOCK-----/;

// Decode only bounded common literal forms; no eval, URL fetch, HTML parser or
// recursive interpretation. Computed/concatenated/encrypted values remain outside
// this checker. A public key/variable name alone is not credential material.
function literalForms(text) {
  let normalized = text;
  for (let pass = 0; pass < 2; pass += 1) {
    normalized = normalized.replace(/\\\//g, '/')
      .replace(/\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,
        (_match, wide, short) => String.fromCharCode(parseInt(wide || short, 16)))
      .replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));/gi, (match, hex, decimal) => {
        const value = parseInt(hex || decimal, hex ? 16 : 10);
        return value <= 0x7f ? String.fromCharCode(value) : match;
      })
      .replace(/%([0-9a-f]{2})/gi, (_match, value) => String.fromCharCode(parseInt(value, 16)));
  }
  return normalized;
}

function retiredSurface(text) {
  return /\/moxie(?:[\/?#\s"'`]|$)|\/moxie-mobile-api(?:[\/?#\s"'`]|$)|moxie-assets|moxie-mobile(?:[^a-z_]|$)|moxie-link|ANNIE_RETURN_URL|isAnnieOrigin|createMoxieRouter|installAnnieMoxieRoutes|MOXIE_MOUNT_PATH|Moxie_Owl_Icon/i.test(text);
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !/[\u0000-\u001f\u007f\\]/.test(value) && !value.startsWith('/')
    && !value.includes(':') && value.split('/').every(part => part && part !== '.' && part !== '..');
}

export function inspectSourceRuntimeRecords(records) {
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_RECORDS) {
    throw new Error('Source sanitation requires a bounded nonempty record inventory');
  }
  const findings = [];
  const paths = new Set();
  let totalBytes = 0;
  for (const record of records) {
    if (!record || !safePath(record.path)
      || !['runtime-source', 'source-owner'].includes(record.scope)
      || !(record.bytes instanceof Uint8Array)) {
      throw new Error('Source sanitation record shape/path/scope is invalid');
    }
    const bytes = Buffer.from(record.bytes);
    if (bytes.length > MAX_FILE_BYTES || (totalBytes += bytes.length) > MAX_TOTAL_BYTES) {
      throw new Error('Source sanitation byte bound exceeded');
    }
    const path = record.path;
    const digest = hash(bytes);
    const add = rule => findings.push(Object.freeze({ path, rule, sha256: digest }));
    const folded = path.normalize('NFC').toLowerCase();
    if (paths.has(folded)) add('duplicate-or-case-colliding-source-path');
    paths.add(folded);
    const normalizedPath = literalForms(path);
    if (!safePath(normalizedPath)) add('encoded-unsafe-source-path');
    if (retiredPath.test(normalizedPath)) add('retired-moxie-source-path');
    if (record.scope === 'runtime-source') {
      if (fixturePath.test(normalizedPath)) add('test-artifact-runtime-path');
      if (privatePath.test(normalizedPath)) add('private-material-runtime-path');
    }
    // Binary image/font/audio bytes are hashed and path-checked, not interpreted
    // as text. Embedded image metadata/binary secrets need their own output gate.
    if (/\.(?:html|js|mjs|cjs|jsx|ts|tsx|css|json|svg|xml|pem|key)$/i.test(normalizedPath)) {
      const source = literalForms(bytes.toString('utf8'));
      if (retiredSurface(source)) add('retired-moxie-source-surface');
      if (privateMarker.test(source)) add('literal-private-key-marker');
    }
  }
  return Object.freeze(findings.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule)));
}

export function assertSourceRuntimeSanitation(records) {
  const findings = inspectSourceRuntimeRecords(records);
  if (findings.length) throw new Error(JSON.stringify(findings));
  return Object.freeze({ records: records.length, scope: 'bounded source records only',
    absence_of_secrets_proven: false, generated_artifact_verified: false });
}
