import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, isAbsolute } from 'node:path';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));
function localPath(root, relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative === '.' || (!isAbsolute(relative) && relative.length > 0
    && relative.split('/').every(part => part && part !== '.' && part !== '..')),
  `Repository-relative prerequisite required: ${relative}`);
  let current = root;
  for (const part of relative === '.' ? [] : relative.split('/')) {
    current = resolve(current, part);
    assert.ok(!lstatSync(current).isSymbolicLink(), `Symlink prerequisite refused: ${relative}`);
  }
  return current;
}

// A classification is an invocation contract: its actual entrypoint, argv,
// working directory and prerequisites are checked before any test is started.
export function frontendContractPlan(root = defaultRoot) {
  root = resolve(root);
  const inventory = JSON.parse(readFileSync(resolve(root, 'scripts/frontend-contract-inventory.json')));
  assert.equal(inventory.schema_version, 2);
  const rows = inventory.scripts;
  assert.ok(Array.isArray(rows) && rows.length > 0);
  const paths = rows.map(row => row.path);
  assert.equal(new Set(paths).size, paths.length, 'Duplicate script classification');
  assert.deepEqual(paths, [...paths].sort(), 'Script inventory must be sorted');
  const actual = readdirSync(resolve(root, 'scripts')).filter(name => name.endsWith('.mjs'))
    .map(name => 'scripts/' + name).sort();
  assert.deepEqual(paths, actual, 'Every top-level script must have an explicit current role');
  const allowed = new Set(['standalone-contract', 'superseded-contract', 'explicit-tool-or-fixture', 'imported-support', 'inventory-cli']);
  const commands = [];
  for (const row of rows) {
    assert.match(row.path, /^scripts\/[a-z0-9-]+\.mjs$/);
    assert.ok(allowed.has(row.role) && typeof row.reason === 'string' && row.reason.length > 0);
    assert.ok(lstatSync(localPath(root, row.path)).isFile(), row.path);
    if (row.role !== 'standalone-contract') {
      assert.ok(row.invocations === undefined, `Non-contract has execution metadata: ${row.path}`);
      continue;
    }
    assert.ok(row.path.endsWith('-tests.mjs'));
    assert.ok(Array.isArray(row.invocations) && row.invocations.length > 0, `Missing invocation: ${row.path}`);
    for (const invocation of row.invocations) {
      assert.deepEqual(Object.keys(invocation).sort(), ['args', 'cwd', 'entry', 'requires']);
      assert.ok(lstatSync(localPath(root, invocation.entry)).isFile(), invocation.entry);
      assert.ok(lstatSync(localPath(root, invocation.cwd)).isDirectory(), invocation.cwd);
      assert.ok(Array.isArray(invocation.args) && invocation.args.every(arg => typeof arg === 'string'
        && !arg.includes('\0') && !isAbsolute(arg)), `Invalid argv: ${row.path}`);
      assert.ok(Array.isArray(invocation.requires));
      for (const prerequisite of invocation.requires) {
        assert.ok(lstatSync(localPath(root, prerequisite)).isFile(), `Missing prerequisite: ${prerequisite}`);
      }
      commands.push({ contract: row.path, ...invocation });
    }
  }
  assert.ok(paths.includes('scripts/moxie-decommission-tests.mjs'));
  assert.ok(commands.some(command => command.contract === 'scripts/moxie-decommission-tests.mjs'));
  assert.ok(commands.some(command => command.contract === 'scripts/runtime-sanitation-source-tests.mjs'));
  assert.ok(Array.isArray(inventory.fixture_inputs) && inventory.fixture_inputs.length > 0,
    'Pinned CI source-context inventory is required');
  const fixturePaths = new Set();
  for (const input of inventory.fixture_inputs) {
    assert.deepEqual(Object.keys(input).sort(), ['bytes', 'path', 'purpose', 'sha256']);
    assert.ok(!fixturePaths.has(input.path), `Duplicate fixture input: ${input.path}`);
    fixturePaths.add(input.path);
    assert.match(input.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(input.bytes) && input.bytes >= 0 && input.bytes <= 32 * 1024 * 1024);
    assert.ok(typeof input.purpose === 'string' && input.purpose.length > 0);
    const path = localPath(root, input.path), stat = lstatSync(path);
    assert.ok(stat.isFile() && stat.size === input.bytes, `Wrong prerequisite size: ${input.path}`);
    const body = readFileSync(path);
    assert.equal(createHash('sha256').update(body).digest('hex'), input.sha256,
      `Wrong prerequisite content: ${input.path}`);
  }
  assert.ok(Array.isArray(inventory.generated_inputs));
  for (const prerequisite of inventory.generated_inputs) {
    assert.ok(lstatSync(localPath(root, prerequisite)).isFile(),
      `Generate the declared CI prerequisite first: ${prerequisite}`);
  }
  assert.ok(Array.isArray(inventory.external_packages));
  for (const dependency of inventory.external_packages) {
    assert.deepEqual(Object.keys(dependency).sort(), ['from', 'name']);
    assert.match(dependency.name, /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/);
    const from = localPath(root, dependency.from);
    assert.ok(lstatSync(from).isFile(), `Missing package context: ${dependency.from}`);
    createRequire(pathToFileURL(from)).resolve(dependency.name);
  }
  return { root, commands, fixture_inputs: inventory.fixture_inputs,
    generated_inputs: inventory.generated_inputs, external_packages: inventory.external_packages };
}

export function frontendContracts(root = defaultRoot) {
  return [...new Set(frontendContractPlan(root).commands.map(command => command.contract))];
}

function groupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
function signalGroup(pid, signal) {
  try { process.kill(-pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
async function runCommand(root, command) {
  assert.equal(process.platform, 'linux', 'The declared CI runner requires Linux process-group custody');
  const child = spawn(process.execPath, [localPath(root, command.entry), ...command.args], {
    cwd: localPath(root, command.cwd), stdio: 'inherit', detached: true, shell: false,
  });
  let timedOut = false, escalation;
  const timer = setTimeout(() => {
    timedOut = true;
    signalGroup(child.pid, 'SIGTERM');
    escalation = setTimeout(() => signalGroup(child.pid, 'SIGKILL'), 5000);
  }, 120000);
  let observed;
  try {
    observed = await new Promise((accept, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => accept({ code, signal }));
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(escalation);
  }
  const descendantRemaining = groupExists(child.pid);
  if (descendantRemaining) {
    signalGroup(child.pid, 'SIGTERM');
    const cleanupDeadline = Date.now() + 5000;
    while (groupExists(child.pid) && Date.now() < cleanupDeadline) {
      await new Promise(accept => setTimeout(accept, 25));
    }
    if (groupExists(child.pid)) {
      signalGroup(child.pid, 'SIGKILL');
      const killDeadline = Date.now() + 1000;
      while (groupExists(child.pid) && Date.now() < killDeadline) {
        await new Promise(accept => setTimeout(accept, 25));
      }
    }
    assert.ok(!groupExists(child.pid), `Owned process group did not settle: ${command.contract}`);
  }
  console.log(JSON.stringify({ contract: command.contract, entry: command.entry,
    args: command.args, cwd: command.cwd, ...observed, timedOut,
    descendantRemainingAtParentExit: descendantRemaining, processGroupAbsent: true }));
  return observed.code === 0 && !observed.signal && !timedOut && !descendantRemaining;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(process.argv.length <= 3, 'No subset, filter or skip arguments are supported');
  const mode = process.argv[2] ?? '--list';
  assert.ok(['--list', '--plan', '--run', '--diagnostics'].includes(mode), 'Unknown inventory mode');
  const plan = frontendContractPlan(); // Complete preflight before the first child.
  if (mode === '--plan') process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
  else if (mode === '--list') process.stdout.write([...new Set(plan.commands.map(command => command.contract))].join('\n') + '\n');
  else {
    let failures = 0;
    for (const command of plan.commands) {
      console.log(`=== ${command.contract} ${JSON.stringify(command.args)} ===`);
      if (!await runCommand(plan.root, command)) {
        failures++;
        if (mode === '--run') break;
      }
    }
    if (failures) process.exitCode = 1;
  }
}
