#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const admin = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");

assert.match(admin, /href="\.\/dashboard\.html#tickets-section"/);
assert.doesNotMatch(admin, /apiFetch\("\/close-ticket"/);
assert.match(dashboard, /'tickets-section':'tickets'/);

const dashboardClose = dashboard.match(/async function closeTicket\(ticketId,button\)\{[\s\S]*?\}\s*function wireCloseButtons/)?.[0] || "";
assert.match(dashboardClose, /actions\.close\(ticketId,choice\)/);
assert.match(dashboardClose, /chooseTicketOutcome\(\)/);
const ticketActions = await readFile(new URL("../memphis-ticket-actions.js", import.meta.url), "utf8");
assert.match(ticketActions, /\/dashboard-api\/close-ticket/);
assert.match(ticketActions, /dispatch\(id,\{ticket_id:id,outcome,external_work_order_reference:orderReference\|\|null,close_notes:/);
assert.doesNotMatch(ticketActions, /JSON\.stringify\(\{[^}]*closed_by/);
assert.doesNotMatch(dashboardClose, /closed_by/, "the dashboard must not assign the maintenance-ticket actor");

console.log("MANAGER_TICKET_ACTOR_FRONTEND_CONTRACT_PASS");
