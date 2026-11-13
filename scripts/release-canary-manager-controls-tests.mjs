#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const admin = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const managerIndex = await readFile(new URL("../mobile/src/manager/index.html", import.meta.url), "utf8");
const managerHub = await readFile(new URL("../start_page1.html", import.meta.url), "utf8");
const managerHubController = await readFile(new URL("../ops-hub.js", import.meta.url), "utf8");

assert.match(
  admin,
  /id="release-canary-controls"[^>]*aria-labelledby="release-canary-title"[^>]*hidden/,
  "release controls must fail closed and stay hidden until the manager session is authorized",
);
assert.match(admin, /data-action="pause-release-canary"[^>]*>Pause Canary</);
assert.match(admin, /data-action="resume-release-canary"[^>]*>Resume Canary</);
assert.doesNotMatch(admin, /data-action="restore-authority"|>Restore Authority</i);
assert.match(
  managerIndex,
  /href="\.\/admin\.html#release-canary-controls"[^>]*><span>Release \/ canary<\/span>/,
  "the manager app release tile must land on the actual controls instead of the generic metrics section",
);
assert.match(managerHub, /id="release-canary-link"[^>]*href="\.\/admin\.html#release-canary-controls"[^>]*hidden/);
assert.match(managerHubController, /hasRole\('DIRECTOR',session\)/);
assert.match(managerHubController, /hasRole\('SECURITY_ADMIN',session\)/);
assert.match(managerHubController, /releaseCanaryLink\.hidden=!\(director\|\|security\)/);

const authorityGuard = admin.match(/function hasReleaseCanaryAuthority[\s\S]*?\n    \}/)?.[0] || "";
assert.match(authorityGuard, /canMutateOpsManagerSurface/);
assert.match(authorityGuard, /state\.managerSessionVerified/);
assert.match(authorityGuard, /hasRole\?\.\("DIRECTOR", session\)/);
assert.match(authorityGuard, /hasRole\?\.\("SECURITY_ADMIN", session\)/);

const releaseConfirmation = admin.match(/if \(action\.type === 'release-canary'\) \{[\s\S]*?\n          return;\n        \}/)?.[0] || "";
assert.match(releaseConfirmation, /if \(!notes\)/, "a written reason must be required before the request");
assert.match(releaseConfirmation, /apiFetch\("\/release-canary-rollback"/);
assert.match(releaseConfirmation, /headers: \{ "Idempotency-Key": action\.operationId \}/);
assert.match(releaseConfirmation, /action: action\.releaseAction/);
assert.match(releaseConfirmation, /reason: notes/);
assert.match(releaseConfirmation, /operation_id: action\.operationId/);
assert.match(releaseConfirmation, /hasReleaseCanaryAuthority\(\)/, "the role must be rechecked at confirmation time");

assert.match(admin, /function createOperationId\(\)/);
assert.match(admin, /cryptoApi\?\.randomUUID/);
assert.match(admin, /cryptoApi\?\.getRandomValues/);
assert.match(admin, /window\.MemphisAuth\.opsManagerAuthHeaders\(\)/);
assert.doesNotMatch(admin, /state\.managerSession\.token|session\.token|localStorage\.[gs]etItem\([^)]*(?:token|bearer)/i);

const inlineScripts = [...admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());
assert.ok(inlineScripts.length > 0, "admin page must contain its controller script");
assert.doesNotThrow(() => new vm.Script(inlineScripts.at(-1), { filename: "admin-inline.js" }));

console.log("RELEASE_CANARY_MANAGER_CONTROLS_PASS");
