import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { bindPhoneUnlock, createPhonePresentation, installWorkPageClock } from '../mobile/src/custodial/phone-presentation.js';

test('awake Home can be re-created after Back and quiet caches cannot reset its clock', async () => {
  let current = { wake: 'first-wake', unlocked: false };
  let principal = 'assigned-principal';
  const bridge = async challenge => {
    if (challenge === current.wake) current.unlocked = true;
    return { ...current };
  };
  const makeHome = () => createPhonePresentation({ principal: () => principal, read: bridge });
  const home = makeHome();
  assert.equal(await home.refresh(), false);
  assert.equal(await home.unlock(), true);
  assert.equal(await home.refresh(), true);
  assert.equal(await makeHome().refresh(), true);
  home.reset();
  current = { wake: 'next-wake', unlocked: false };
  assert.equal(await home.refresh(), false);
  principal = 'reassigned-principal';
  assert.equal(home.unlocked(), false);
  assert.equal(await home.unlock(), false);
});

test('late clock bridge reply after a pause or principal change cannot hide the clock', async () => {
  for (const retirement of ['pause', 'reassignment']) {
    let principal = 'original';
    let respond;
    const clock = createPhonePresentation({
      principal: () => principal,
      read: () => new Promise(resolve => { respond = resolve; }),
    });
    const pending = clock.refresh();
    await Promise.resolve();
    if (retirement === 'pause') clock.reset();
    else principal = 'replacement';
    respond({ wake: 'retired', unlocked: true });
    assert.equal(await pending, false);
    assert.equal(clock.unlocked(), false);
  }
});

test('tap and a deliberate upward swipe call the same unlock handler', () => {
  const handlers = new Map();
  const surface = { addEventListener: (name, handler) => handlers.set(name, handler) };
  let count = 0;
  bindPhoneUnlock(surface, surface, () => { count++; }, () => 800);
  const point = (x, y) => ({ identifier: 1, clientX: x, clientY: y });
  const swipe = (x, y) => {
    handlers.get('touchstart')({ touches: [point(50, 500)] });
    handlers.get('touchend')({ touches: [], changedTouches: [point(x, y)] });
  };
  swipe(50, 440);
  swipe(430, 240);
  swipe(50, 740);
  assert.equal(count, 0);
  swipe(52, 240);
  handlers.get('click')();
  assert.equal(count, 2);
});

test('interactive work pages show the clock on wake without replacing the active document', async () => {
  for (const pathname of ['/messages.html', '/employee-schedule.html', '/events.html', '/employee-feedback.html']) {
    let locked = false;
    const callbacks = new Map(), events = new Map(), elements = new Map();
    const part = selector => elements.get(selector) ?? elements.set(selector, { textContent: '', addEventListener: (name, handler) => events.set(name, handler) }).get(selector);
    const dialog = {
      open: false, setAttribute() {}, addEventListener() {}, querySelector: part,
      close() { this.open = false; }, showModal() { this.open = true; },
    };
    const mobile = {
      ready: Promise.resolve(), principalIdentity: () => 'assigned',
      phonePresentation: async wake => {
        if (wake === 'wake') locked = false;
        return { wake: 'wake', unlocked: !locked };
      },
      readCustodialHomeCache: () => null,
    };
    const document = {
      readyState: 'complete', createElement: () => dialog,
      querySelector: () => true, body: { append: element => assert.equal(element, dialog) },
    };
    const window = {
      location: { pathname }, setInterval: () => 1, clearInterval() {}, addEventListener() {},
    };
    installWorkPageClock({ app: { addListener: (name, handler) => callbacks.set(name, handler) }, mobile, document, window });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dialog.open, false);
    locked = true;
    callbacks.get('pause')();
    await callbacks.get('resume')();
    assert.equal(dialog.open, true);
    await events.get('click')();
    assert.equal(dialog.open, false);
    assert.equal(window.location.pathname, pathname);
  }
});

test('native Activity owner clears its grant at pause and refuses a retired assignment or wake', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'custodial-clock-'));
  const fixture = join(scratch, 'PhonePresentationFixture.java');
  const owner = fileURLToPath(new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/PhonePresentation.java', import.meta.url));
  try {
    writeFileSync(fixture, `package org.memphiszoo.custodial.vault;
      public final class PhonePresentationFixture {
        static boolean unlocked(java.util.Map<String, Object> value) {
          return Boolean.TRUE.equals(value.get("unlocked"));
        }
        public static void main(String[] args) {
          PhonePresentation clock = new PhonePresentation();
          assert !unlocked(clock.observe(clock.captureWake(), "A", null));
          clock.resume();
          Object first = clock.captureWake();
          String challenge = (String)clock.observe(first, "A", null).get("wake");
          assert !unlocked(clock.observe(first, "A", null));
          assert unlocked(clock.observe(first, "A", challenge));
          assert unlocked(clock.observe(first, "A", null));
          assert !unlocked(clock.observe(first, "B", challenge));
          String reassigned = (String)clock.observe(first, "B", null).get("wake");
          assert unlocked(clock.observe(first, "B", reassigned));
          clock.pause();
          clock.resume();
          assert !unlocked(clock.observe(first, "B", reassigned));
          assert !unlocked(clock.observe(clock.captureWake(), "B", reassigned));
        }
      }`);
    execFileSync('javac', ['-d', scratch, owner, fixture]);
    execFileSync('java', ['-ea', '-cp', scratch, 'org.memphiszoo.custodial.vault.PhonePresentationFixture']);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
