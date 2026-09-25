import assert from "node:assert/strict";
import fs from "node:fs";

const printPage = fs.readFileSync("coverall-print.html", "utf8");
const weeklySchedule = fs.readFileSync("schedule-weekly.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("frontend-release-manifest.json", "utf8"));

assert.match(printPage, /schedule-weekly\.html[\s\S]*#coverage/);
assert.doesNotMatch(printPage, /\/coverall\/links(?:\/revoke)?|dashboard-api\/coverall-printable/);

assert.match(weeklySchedule, /requireOpsManagerSession\(\{interactive:false,redirect:true,throwOnFailure:true\}\)/);
assert.match(weeklySchedule, /\/static-weekly\/coverall-print\?/);
assert.match(weeklySchedule, /custodial\.coverall-pdf-pair\.v1/);
assert.match(weeklySchedule, /pair\.document\?\.projectionId!==projection\.projection_id/);
assert.match(weeklySchedule, /pair\.document\?\.authorityRevision!==snapshot\.authority_revision/);
assert.match(weeklySchedule, /pair\.document\?\.serviceDate!==date/);
assert.match(weeklySchedule, /file\.language==='en'\?'Download English PDF':'Descargar PDF en español'/);
assert.match(weeklySchedule, /URL\.revokeObjectURL/);
assert.doesNotMatch(weeklySchedule, /\/coverall\/links(?:\/revoke)?|assignment_url_en|\/coverall\/assignment\?service_date=/);
assert.match(weeklySchedule, /operation:'cover_all'/);
assert.match(weeklySchedule, /reason:'Manager added CoverAll contractor capacity'/);
assert.doesNotMatch(weeklySchedule, /3\+ absences/);
assert.equal(manifest.schema_fingerprint, "3ded1de715a3d114f3098a2818904b3c5b0d0cdde17dcbef77cc7af76c3b7deb");
assert.equal(manifest.api_contract_versions.schedule, "schedule.v2");

console.log(JSON.stringify({ ok: true, audit6_coverall_frontend_security_contract: "passed" }, null, 2));
