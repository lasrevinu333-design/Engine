import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8");
}

const readonlyHome = read("readonly-home.html");
const dashboard = read("dashboard.html");
const events = read("events.html");

assert.ok(existsSync(resolve(root, "readonly-home.html")), "readonly-home.html must exist");
assert.match(readonlyHome, /Dashboard/);
assert.match(readonlyHome, /Events/);
assert.match(readonlyHome, /hub=readonly/);
assert.doesNotMatch(readonlyHome, /messages\.html|schedule\.html|gemini-admin\.html|admin\.html|guest-issues\.html/i, "read-only launcher must not expose other hub modules");

assert.match(dashboard, /hub=readonly|read-only/i, "dashboard must recognize read-only hub mode");
assert.match(dashboard, /readonly-home\.html/, "dashboard back-navigation must target the read-only home");
assert.match(dashboard, /hubContext==='readonly'|hubContext!=="readonly"/, "dashboard must gate read-only behavior on hub context");
assert.match(dashboard, /allowClose:!isReadOnlyHub\(\)|dashboardState\.hubContext!=="readonly"/, "dashboard must disable close-ticket writes in read-only mode");

assert.match(events, /readonly-home\.html/, "events back-navigation must target the read-only home");
assert.match(events, /hub==='readonly'|read-only/, "events must recognize read-only hub mode");

console.log("MOBILE_SPLIT_CONTRACT_TESTS_PASS");
