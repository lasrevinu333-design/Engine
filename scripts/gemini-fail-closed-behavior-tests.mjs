import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('gemini-admin.html', 'utf8');
const blockStart = source.indexOf('    function lockConsole(error)');
const blockEnd = source.indexOf('    async function resolveIdentity', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'Gemini fail-closed functions must exist');
const behaviorSource = source.slice(blockStart, blockEnd);

const button = () => ({ disabled: false });
const sandbox = {
  safe: (value) => String(value?.message || value || ''),
  els: {
    consoleApp: { hidden: false },
    authGate: { hidden: true },
    authGateStatus: { textContent: '' },
    auditBtn: button(),
    runBtn: button(),
    diagnoseBtn: button(),
    refreshRuntimeBtn: button(),
    refreshIdentityBtn: button(),
    resetThreadBtn: button(),
    clearBtn: button(),
  },
};
vm.createContext(sandbox);
vm.runInContext(`${behaviorSource}\nlockConsole(new Error('Gemini password required.'));`, sandbox);

assert.equal(sandbox.els.consoleApp.hidden, true, 'cancelled/failed login must keep the console hidden');
assert.equal(sandbox.els.authGate.hidden, false, 'cancelled/failed login must show the lock gate');
assert.equal(sandbox.els.authGateStatus.textContent, 'Gemini password required.');
for (const key of ['auditBtn','runBtn','diagnoseBtn','refreshRuntimeBtn','refreshIdentityBtn','resetThreadBtn','clearBtn']) {
  assert.equal(sandbox.els[key].disabled, true, `${key} must be disabled while locked`);
}

vm.runInContext('unlockConsole();', sandbox);
assert.equal(sandbox.els.authGate.hidden, true, 'successful authentication may hide the lock gate');
assert.equal(sandbox.els.consoleApp.hidden, false, 'successful authentication may reveal the console');

assert.match(source, /requireOpsManagerSession\(\{[\s\S]*accessLevel: 'full_access'[\s\S]*interactive: false/);
assert.match(source, /requireGeminiAdminSession\(\{ interactive: true \}\)/);
assert.match(source, /init\(\)\.catch\(\(error\) => \{[\s\S]*lockConsole\(error\)/);
assert.match(source, /if \(!state\.session\?\.token\) throw new Error\('Gemini password authentication was not completed\.'\)/);
assert.doesNotMatch(source, /state\.hub === 'employee'/);

console.log('GEMINI_FAIL_CLOSED_BEHAVIOR_PASS');
