import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Source predicate/recording fixture only. The optional Java member compiles
// the EXACT shipping DATA accessor with synthetic local graph nodes; it never
// constructs a production hold, credential, currentness verdict or journal.
// Actual after-IO Source/key mutation still needs a fresh owning native fixture.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = 'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const engine = readFileSync(path.join(root, main, 'VaultEngine.java'), 'utf8');
const epoch = readFileSync(path.join(root, main, 'NativePrivateMutationEpochStore.java'), 'utf8');
const fixture = readFileSync(path.join(root, 'mobile/plugins/custodial-native-vault/android/src/androidTest/java/org/memphiszoo/custodial/vault/OriginalInventoryAckAndroidRuntimeTest.java'), 'utf8');

function block(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0 && source.indexOf(marker, start + 1) < 0, `Unique source marker: ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0, state = 'code';
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (state === 'line') { if (c === '\n') state = 'code'; continue; }
    if (state === 'comment') { if (c === '*' && n === '/') { state = 'code'; i++; } continue; }
    if (state === 'string' || state === 'char') {
      if (c === '\\') { i++; continue; }
      if (c === (state === 'string' ? '"' : "'")) state = 'code';
      continue;
    }
    if (c === '/' && n === '/') { state = 'line'; i++; continue; }
    if (c === '/' && n === '*') { state = 'comment'; i++; continue; }
    if (c === '"') { state = 'string'; continue; }
    if (c === "'") { state = 'char'; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed fixed source block');
}
const getter = block(engine, 'OriginalMetadata originalMetadataDataForFixedEpoch()');
// Guard against synthetic-field drift: every prepared.field referenced by the
// EXACT shipping getter must be a real declared field in its owning class.
// Prepared close() has no closed Boolean: it retires actual owned references.
const preparedClass = block(engine, 'static final class NativeSameOriginalRecoveryPreparedRequest implements AutoCloseable');
const preparedFields = new Set([...preparedClass.matchAll(/^        private(?: final)? [A-Za-z0-9_.$<>]+ ([A-Za-z0-9_,]+);$/gm)]
  .flatMap(match => match[1].split(',')));
for (const match of getter.matchAll(/\bprepared\.([A-Za-z0-9_]+)/g)) assert(preparedFields.has(match[1]), 'Actual prepared field required: ' + match[1]);
assert(!preparedFields.has('closed'));
assert(preparedClass.includes('currentManagerRead=null;stored=null;intent=null;'));

const oldGetter = block(engine, 'OriginalMetadata originalMetadataForFixedEpoch()');
const metadata = block(engine, 'static final class OriginalMetadata {');
const writer = block(epoch, 'Current holdOriginalWriters(Current expected,VaultEngine.NativeOriginalDurableWriterHold token)');
assert.match(oldGetter, /requireCurrent\(\);return new OriginalMetadata\(this\);/);
assert(!getter.includes('requireCurrent()'));
assert(!getter.includes('cipher.') && !getter.includes('Files.') && !getter.includes('System.nanoTime'));
assert.match(getter, /Thread\.holdsLock\(owner\)/);
assert.match(getter, /nativeSet\.requireBothManagerMetadataAfterSamePreparedValidation\(\)/);
assert.equal((getter.match(/control\.check\(\)/g) || []).length, 2);
assert.equal((epoch.match(/\.originalMetadataDataForFixedEpoch\(\)/g) || []).length, 1);
assert.equal((fixture.match(/\.originalMetadataDataForFixedEpoch\(\)/g) || []).length, 1);
assert(!epoch.includes('.originalMetadataForFixedEpoch()'));
assert(!fixture.includes('.originalMetadataForFixedEpoch()'));

// These are real writer source boundaries, not a substitute simulated writer.
// Removing any fresh guard from its exact owning location must fail this gate.
const boundaries = [
  'if(token==null)throw invalid();token.requireCurrent();',
  'originalHoldReadLoan=loan;token.requireCurrent();loan.require(expected);',
  'token.requireCurrent();loan.require(expected);\n                        // Same forced pending/current protocol',
  'if(loan!=null&&io==normalIo){token.requireCurrent();loan.require(loan.original);}',
  'if(loan!=null){token.requireCurrent();loan.require(loan.original);}'
];
function preservedGuards(source) {
  const hold = block(source, 'Current holdOriginalWriters(Current expected,VaultEngine.NativeOriginalDurableWriterHold token)');
  const promotion = block(source, 'private Current commitPreparedUnderLock(');
  for (const [i, guard] of boundaries.entries()) assert((i < 3 ? hold : promotion).includes(guard), 'Original epoch guard: ' + guard);
}
preservedGuards(epoch);
for (const guard of boundaries) {
  const local = boundaries.indexOf(guard) < 3 ? writer : block(epoch, 'private Current commitPreparedUnderLock(');
  const mutated = local.replace(guard, guard.replace('token.requireCurrent();', ''));
  assert.throws(() => preservedGuards(epoch.replace(local, mutated)));
}
assert(writer.indexOf('token.requireCurrent();loan.require(expected);') < writer.indexOf('FileChannel.open(pending,'));
assert(writer.indexOf('token.requireCurrent();loan.require(expected);\n                        // Same forced') > writer.indexOf('candidate=read(pending)'));

// Compile just the exact DATA predicate and tuple. Every graph below is
// explicitly synthetic; no real VaultEngine or authority is manufactured.
const java = `public final class NativeOriginalHoldMetadataDataPredicateTest {
  static final class VaultFailure extends Exception {}
  static VaultFailure retainedFailure(){return new VaultFailure();}
  static final class Control { boolean allowed=true; int checks; void check()throws VaultFailure{checks++;if(!allowed)throw retainedFailure();} }
  static final class Read { Object owner; boolean closed,refused; Control control; }
  static final class Observation { Read read; }
  static final class Intent { Observation observation; Object stored; }
  static final class Manager { Prepared prepared; Read read; }
  static final class Prepared {
    final Object owner; boolean originalAncestryRefused; Intent intent; Object stored;
    final Intent originalIntent; final Observation originalObservation; final Read originalRead;
    final Object originalIntentStored,originalRequestStored;
    NativeSet completionDispositions; BrowserSet browserDispositions; Manager currentManagerRead;
    Prepared(Object owner,Read read){this.owner=owner;originalRead=read;intent=new Intent();intent.observation=new Observation();intent.observation.read=read;
      intent.stored=new Object();stored=new Object();originalIntent=intent;originalObservation=intent.observation;originalIntentStored=intent.stored;originalRequestStored=stored;}
    // SAME relevant retirement behavior as actual prepared.close(): no invented flag.
    void close(){browserDispositions=null;completionDispositions=null;currentManagerRead=null;stored=null;intent=null;}
  }
  static final class NativeSet { boolean closed,clockAllowed=true; int clockChecks; Prepared prepared; Read originalRead;
    void requireBothManagerMetadataAfterSamePreparedValidation()throws VaultFailure {clockChecks++;if(!clockAllowed)throw retainedFailure();} }
  static final class BrowserSet { Prepared prepared; Read read; NativeSet nativeSet; }
  static final class NativeOriginalDurableWriterHold {
    Object owner=new Object(); Read read=new Read(); Prepared prepared=new Prepared(owner,read); NativeSet nativeSet=new NativeSet(); BrowserSet browserSet=new BrowserSet(); Control control=new Control();
    boolean closed,refused; long counter=7;
    String valuesSha="values",generationId="generation",operationId="operation",planSha="plan",browserFrameSha="frame",browserPartSetSha="parts";
    NativeOriginalDurableWriterHold(){
      read.owner=owner;read.control=control;
      prepared.completionDispositions=nativeSet;prepared.browserDispositions=browserSet;prepared.currentManagerRead=new Manager();prepared.currentManagerRead.prepared=prepared;prepared.currentManagerRead.read=read;
      nativeSet.prepared=prepared;nativeSet.originalRead=read;browserSet.prepared=prepared;browserSet.read=read;browserSet.nativeSet=nativeSet;
    }
    ${metadata}
    ${getter}
  }
  interface Mutation {void apply(NativeOriginalDurableWriterHold h);}
  static int cases;
  static void denied(Mutation mutation)throws Exception {
    var h=new NativeOriginalDurableWriterHold();mutation.apply(h);
    synchronized(h.owner){try{h.originalMetadataDataForFixedEpoch();throw new AssertionError("Invalid synthetic local graph returned DATA");}catch(VaultFailure expected){cases++;}}
  }
  public static void main(String[] args)throws Exception {
    if(args.length!=0)throw new IllegalArgumentException("No authority or fixture input");
    var h=new NativeOriginalDurableWriterHold();
    synchronized(h.owner){var a=h.originalMetadataDataForFixedEpoch();var b=h.originalMetadataDataForFixedEpoch();
      if(a==b||a.counter!=7||!a.valuesSha256.equals("values")||!a.generationId.equals("generation")||!a.operationId.equals("operation")||!a.planSha256.equals("plan")||!a.browserFrameSha256.equals("frame")||!a.browserPartSetSha256.equals("parts"))throw new AssertionError("Tuple mismatch");
      if(h.control.checks!=4||h.nativeSet.clockChecks!=2)throw new AssertionError("Original control/clock checks omitted");cases++;
    }
    try{h.originalMetadataDataForFixedEpoch();throw new AssertionError("Missing owner monitor");}catch(VaultFailure expected){cases++;}
    denied(x->x.closed=true);denied(x->x.refused=true);denied(x->x.control.allowed=false);
    denied(x->x.prepared=new Prepared(new Object(),x.read));denied(x->x.read.owner=new Object());denied(x->x.prepared.close());
    denied(x->x.prepared.originalAncestryRefused=true);denied(x->x.read.closed=true);denied(x->x.read.refused=true);
    denied(x->x.read.control=new Control());denied(x->x.prepared.intent.observation.read=new Read());
    denied(x->x.prepared.completionDispositions=new NativeSet());denied(x->x.prepared.browserDispositions=new BrowserSet());
    denied(x->x.prepared.currentManagerRead.prepared=new Prepared(new Object(),new Read()));denied(x->x.prepared.currentManagerRead.read=new Read());
    denied(x->x.nativeSet.closed=true);denied(x->x.nativeSet.prepared=new Prepared(new Object(),new Read()));denied(x->x.nativeSet.originalRead=new Read());
    denied(x->x.browserSet.prepared=new Prepared(new Object(),new Read()));denied(x->x.browserSet.read=new Read());denied(x->x.browserSet.nativeSet=new NativeSet());
    denied(x->x.nativeSet.clockAllowed=false);
    denied(x->x.prepared.intent=null);denied(x->x.prepared.stored=null);
    denied(x->x.prepared.stored=new Object());denied(x->x.prepared.intent.stored=null);
    denied(x->x.prepared.intent.stored=new Object());denied(x->x.prepared.intent=new Intent());
    denied(x->x.prepared.intent.observation=new Observation());
    // An earlier tuple is deliberately powerless: a subsequent invalidation
    // still refuses a NEW copy. No state is reset and no effect is attempted.
    var changed=new NativeOriginalDurableWriterHold();synchronized(changed.owner){var data=changed.originalMetadataDataForFixedEpoch();changed.prepared.originalAncestryRefused=true;
      try{changed.originalMetadataDataForFixedEpoch();throw new AssertionError("Earlier DATA became authority");}catch(VaultFailure expected){if(data.counter!=7)throw new AssertionError();cases++;}}
    System.out.println("PASS exact shipping DATA predicate synthetic local-graph cases="+cases+"; no production token, epoch IO or effect authority");
  }
}
`;
if (process.argv.length === 2) {
  console.log('PASS hold DATA source boundaries; five removed-guard mutants refused; Java predicate prepared, NOT_EXECUTED');
} else {
  assert.equal(process.argv.length, 6);
  assert.equal(process.argv[2], '--compile-source-predicate-only');
  const [out, javac, javaBin] = process.argv.slice(3);
  assert(path.isAbsolute(out) && path.isAbsolute(javac) && path.isAbsolute(javaBin));
  mkdirSync(out, { mode: 0o700 });
  const input = path.join(out, 'NativeOriginalHoldMetadataDataPredicateTest.java');
  writeFileSync(input, java, { flag: 'wx', mode: 0o600 });
  function run(command, args, label) {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
    writeFileSync(path.join(out, label + '.stdout'), result.stdout || '', { flag: 'wx', mode: 0o600 });
    writeFileSync(path.join(out, label + '.stderr'), result.stderr || '', { flag: 'wx', mode: 0o600 });
    assert(!result.error, String(result.error));assert.equal(result.status, 0, label);
    process.stdout.write(result.stdout);
  }
  run(javac, ['-J-Xmx128m', '-encoding', 'UTF-8', '-d', out, input], 'javac');
  run(javaBin, ['-Xmx128m', '-cp', out, 'NativeOriginalHoldMetadataDataPredicateTest'], 'predicate');
}
