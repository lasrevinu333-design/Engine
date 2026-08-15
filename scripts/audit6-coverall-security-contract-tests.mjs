import assert from "node:assert/strict";
import fs from "node:fs";

const printPage = fs.readFileSync("coverall-print.html", "utf8");
const simpleSchedule = fs.readFileSync("schedule-simple.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("frontend-release-manifest.json", "utf8"));

assert.match(printPage, /requireOpsManagerSession/);
assert.match(printPage, /\/coverall\/links/);
assert.match(printPage, /\/coverall\/links\/revoke/);
assert.match(printPage, /ttl_hours/);
assert.match(printPage, /Create and Open Secure Link/);
assert.match(printPage, /Create and Copy Secure Link/);
assert.match(printPage, /Revoke Active Link/);
assert.doesNotMatch(printPage, /function assignmentUrl/);
assert.doesNotMatch(printPage, /schedule-api\/coverall\/assignment['"]/);

assert.match(simpleSchedule, /data-coverall-link-action="open"/);
assert.match(simpleSchedule, /data-coverall-link-action="copy"/);
assert.match(simpleSchedule, /api\('\/coverall\/links'/);
assert.match(simpleSchedule, /ttl_hours:24/);
assert.doesNotMatch(simpleSchedule, /assignment_url_en/);
assert.doesNotMatch(simpleSchedule, /\/coverall\/assignment\?service_date=/);
assert.doesNotMatch(simpleSchedule, /data-copy-link/);
assert.equal(manifest.schema_fingerprint, "1bc92d78a167c8b36b9d2a56de7963e002687562a41ff5e129404f5ef4230b98");
assert.equal(manifest.api_contract_versions.coverall_assignments, "coverall-assignments.v2.secure-links");

console.log(JSON.stringify({ ok: true, audit6_coverall_frontend_security_contract: "passed" }, null, 2));
