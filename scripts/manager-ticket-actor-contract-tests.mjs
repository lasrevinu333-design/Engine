#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const admin = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");

const adminClose = admin.match(/if \(action\.type === 'close-ticket'\) \{[\s\S]*?return;\s*\}/)?.[0] || "";
assert.match(adminClose, /apiFetch\("\/close-ticket"/);
assert.match(adminClose, /ticket_id: action\.id/);
assert.match(adminClose, /close_notes: notes \|\| null/);
assert.doesNotMatch(adminClose, /closed_by/, "the browser must not assign the maintenance-ticket actor");

const dashboardClose = dashboard.match(/async function closeTicket\(ticketId,button\)\{[\s\S]*?\}\s*function wireCloseButtons/)?.[0] || "";
assert.match(dashboardClose, /CLOSE_TICKET_URL/);
assert.match(dashboardClose, /JSON\.stringify\(\{ticket_id:ticketId\}\)/);
assert.doesNotMatch(dashboardClose, /closed_by/, "the dashboard must not assign the maintenance-ticket actor");

console.log("MANAGER_TICKET_ACTOR_FRONTEND_CONTRACT_PASS");
