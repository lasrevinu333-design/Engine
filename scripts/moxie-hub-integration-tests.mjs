import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const hub = readFileSync("start_page1.html", "utf8");
assert.match(hub, /id="moxie-link"[^>]+href="https:\/\/memphis-zoo-mcp\.onrender\.com\/moxie\/"/);
assert.match(hub, /id="moxie-app-icon"[^>]+src="\.\/Moxie_Owl_Icon_ui\.webp\?v=release-2026\.07\.18\.custodial-v3\.9"/);
assert.match(hub, /data-fallback-for="moxie-app-icon">🦉/);
const tile = hub.slice(hub.indexOf('id="moxie-link"'), hub.indexOf('id="moxie-link"') + 600);
assert.doesNotMatch(tile, /frog-on-log|🐸|taildaacbb/);

const asset = statSync("Moxie_Owl_Icon.jpg");
assert.ok(asset.size > 10_000 && asset.size < 250_000, `unexpected owl asset size ${asset.size}`);
const bytes = readFileSync("Moxie_Owl_Icon.jpg");
assert.equal(bytes[0], 0xff);
assert.equal(bytes[1], 0xd8);
assert.equal(bytes[bytes.length - 2], 0xff);
assert.equal(bytes[bytes.length - 1], 0xd9);

const pages = [
  "dashboard.html", "employee-hub.html", "employee-schedule.html", "events.html",
  "guest-issues.html", "messages.html", "index.html", "start_page1.html",
  "system-feedback.html", "thread.html",
];
for (const page of pages) {
  const source = readFileSync(page, "utf8");
  assert.doesNotMatch(source, /eric-precision-tower-3620\.taildaacbb\.ts\.net\/annie/);
  if (source.includes("ANNIE_RETURN_URL")) {
    assert.match(source, /https:\/\/memphis-zoo-mcp\.onrender\.com\/moxie\//);
  }
}

console.log("MOXIE_HUB_INTEGRATION_TESTS_PASS");
