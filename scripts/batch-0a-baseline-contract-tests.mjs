import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = resolve(root, "quality/fixtures/batch-0a");
const EXPECTED_FRONTEND_COMMIT = "1bbdcb059e3fdf260f6ae76a6ab024502d9d26e5";
const EXPECTED_BACKEND_COMMIT = "ac70f68c78cfcaff11cf9834620e0b2775a339dd";

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

function isExactVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(value || ""));
}

function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b)));
}

function collectPropertyNames(value, names = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyNames(item, names);
    return names;
  }
  if (!value || typeof value !== "object") return names;
  for (const [key, item] of Object.entries(value)) {
    names.push(key);
    collectPropertyNames(item, names);
  }
  return names;
}

async function validateArchitectureBaseline() {
  const architecture = await readJson("docs/architecture-version-baseline.json");
  assert.equal(architecture.decision_id, "MZ-ADR-0001");
  assert.equal(architecture.status, "accepted");
  assert.equal(architecture.baseline, "batch-0a");
  assert.equal(
    architecture.target_stack_runtime_change_in_this_batch,
    false,
    "Batch 0A must not install or activate the future application stack",
  );
  assert.deepEqual(architecture.compatibility_repairs, [
    "Add a browser-safe notifications.html destination for the Manager Hub link that was already shipped but unresolved.",
  ]);
  assert.match(architecture.policy?.dependency_ranges || "", /Exact versions only/i);
  assert.match(architecture.policy?.migration || "", /temporary compatibility dependencies/i);
  assert.match(architecture.policy?.migration || "", /React 19 shell migration begins after/i);

  assert.deepEqual(
    { node: architecture.toolchain?.node, npm: architecture.toolchain?.npm },
    { node: "22.23.1", npm: "11.17.0" },
    "Node and npm must remain pinned to the approved Batch 0A toolchain",
  );
  assert.deepEqual(
    {
      xcode: architecture.toolchain?.xcode,
      java: architecture.toolchain?.java,
      gradle: architecture.toolchain?.gradle,
      native_release_version: architecture.toolchain?.native_release_version,
    },
    { xcode: "26.4.0", java: "21.0.0", gradle: "8.14.3", native_release_version: "1.0.0" },
    "native release toolchain and user-facing version must remain pinned",
  );

  for (const sectionName of [
    "toolchain",
    "native_runtime",
    "target_shell",
    "target_modules",
    "temporary_compatibility_dependencies",
  ]) {
    const section = architecture[sectionName];
    assert.ok(section && typeof section === "object", `${sectionName} is required`);
    for (const [name, version] of Object.entries(section)) {
      assert.ok(
        isExactVersion(version),
        `${sectionName}.${name} must use an exact version, received ${JSON.stringify(version)}`,
      );
      assert.doesNotMatch(String(version), /(?:\^|~|\*|latest|next|https?:)/i);
    }
  }

  assert.equal(architecture.target_shell.react, "19.2.8");
  assert.equal(architecture.target_shell["react-dom"], "19.2.8");
  assert.deepEqual(architecture.temporary_compatibility_dependencies, {
    react: "18.3.1",
    "react-dom": "18.3.1",
    "@chatscope/chat-ui-kit-react": "2.1.1",
    "@chatscope/chat-ui-kit-styles": "1.4.0",
  });
  assert.ok(
    architecture.explicitly_rejected.includes("ChatScope as the target Messenger foundation"),
    "ChatScope must be recorded as temporary rather than the target Messenger architecture",
  );

  const packageJson = await readJson("package.json");
  const mobilePackage = await readJson("mobile/package.json");
  assert.equal(packageJson.packageManager, "npm@11.17.0");
  assert.deepEqual(packageJson.engines, { node: "22.23.1", npm: "11.17.0" });
  assert.deepEqual(packageJson.allowScripts, {
    "@firebase/util@1.15.1": true,
    "esbuild@0.25.12": true,
    "fsevents@2.3.2": false,
    "fsevents@2.3.3": false,
    "protobufjs@7.6.5": true,
  });
  assert.equal(packageJson.devDependencies?.["@playwright/test"], architecture.toolchain.playwright);
  assert.equal(packageJson.devDependencies?.["@axe-core/playwright"], architecture.toolchain.axe_core_playwright);
  assert.equal(mobilePackage.dependencies?.react, architecture.temporary_compatibility_dependencies.react);
  assert.equal(mobilePackage.dependencies?.["react-dom"], architecture.temporary_compatibility_dependencies["react-dom"]);
  assert.equal(mobilePackage.dependencies?.["@chatscope/chat-ui-kit-react"], undefined);
  assert.equal(mobilePackage.dependencies?.["@chatscope/chat-ui-kit-styles"], undefined);

  const [nodeVersion, nvmVersion, npmrc] = await Promise.all([
    readFile(resolve(root, ".node-version"), "utf8"),
    readFile(resolve(root, ".nvmrc"), "utf8"),
    readFile(resolve(root, ".npmrc"), "utf8"),
  ]);
  assert.equal(nodeVersion.trim(), architecture.toolchain.node);
  assert.equal(nvmVersion.trim(), architecture.toolchain.node);
  assert.match(npmrc, /^engine-strict=true$/m);
  assert.match(npmrc, /^strict-allow-scripts=true$/m);

  return architecture;
}

async function validateProductionMetadataBaseline() {
  const baseline = await readJson("quality/baselines/production-schema-api-2026-07-23.json");
  assert.equal(baseline.snapshot_version, "batch-0a.production-contract-baseline.v1");
  assert.match(baseline.purpose || "", /metadata only/i);
  assert.match(baseline.purpose || "", /no production row data or secrets/i);
  assert.equal(baseline.source?.frontend_commit, EXPECTED_FRONTEND_COMMIT);
  assert.equal(baseline.source?.backend_commit, EXPECTED_BACKEND_COMMIT);
  assert.deepEqual(baseline.dependency_health, {
    production_environment: true,
    github_configured: true,
    supabase_configured: true,
    gemini_configured: true,
    strict_environment_errors: [],
    strict_environment_warnings: [],
  });
  assert.deepEqual(baseline.api_contract_versions, {
    scan: "scan.v2",
    dashboard: "dashboard.v1",
    messaging: "messaging.v5",
    schedule: "schedule.v2",
    operational_analytics: "operational-analytics.v1",
    ops_manager_auth: "ops-manager-auth.v5.named-leadership",
    gemini_console: "gemini-console.v2",
  });
  assert.deepEqual(baseline.queue_compatibility_versions?.scan, [
    "legacy-local-storage",
    "indexeddb-v1",
    "indexeddb-v2",
    "indexeddb-v3",
    "indexeddb-v4",
  ]);
  assert.deepEqual(baseline.queue_compatibility_versions?.messaging, ["local-storage-outbox-v1"]);

  const toolNames = baseline.mcp_tools.map((tool) => tool.name);
  assert.equal(toolNames.length, 17);
  assert.equal(new Set(toolNames).size, toolNames.length, "MCP tool names must be unique");
  for (const required of ["ping", "server_deep_health", "github_read_file", "github_write_file", "supabase_sql_read", "supabase_migration_apply"]) {
    assert.ok(toolNames.includes(required), `Production metadata baseline is missing ${required}`);
  }

  const fingerprint = baseline.database?.full_schema_fingerprint;
  for (const key of ["schema_sha256", "columns_sha256", "constraints_sha256", "indexes_sha256", "policies_sha256"]) {
    assert.ok(isSha256(fingerprint?.[key]), `${key} must be a SHA-256 digest`);
  }
  assert.ok(fingerprint.table_count >= 100);
  assert.ok(fingerprint.column_count >= 1000);
  assert.ok(fingerprint.constraint_count >= 400);
  assert.ok(fingerprint.index_count >= 300);
  for (const table of [
    "devices",
    "employees",
    "events_app_events",
    "events_app_notification_log",
    "msg_messages",
    "operational_notification_jobs",
    "scan_events",
    "sessions",
  ]) {
    assert.ok(baseline.database.selected_tables.includes(table), `Selected production metadata must include ${table}`);
  }
  for (const capture of Object.values(baseline.capture_limits || {})) {
    assert.equal(capture.truncated, false, "Committed production metadata captures must not be truncated");
    assert.ok(Number(capture.row_count) > 0);
  }

  const forbiddenProperties = new Set(["password", "password_hash", "secret", "access_token", "refresh_token", "service_role_key"]);
  const properties = collectPropertyNames(baseline);
  assert.deepEqual(
    sorted([...new Set(properties.filter((name) => forbiddenProperties.has(name.toLowerCase())))]),
    [],
    "Production metadata baseline must not contain secret-bearing properties",
  );
  return baseline;
}

async function validateProductionMigrationBaseline(production) {
  const baseline = await readJson("quality/baselines/production-migrations-2026-07-23.json");
  assert.equal(baseline.snapshot_version, "batch-0a.production-migration-baseline.v1");
  assert.equal(baseline.frontend_commit, production.source.frontend_commit);
  assert.equal(baseline.backend_commit, production.source.backend_commit);
  assert.equal(baseline.supabase_schema_migrations.length, 133);
  assert.equal(baseline.mcp_rpc_migration_log.length, 4);
  assert.deepEqual(baseline.capture, {
    supabase_schema_migration_count: 133,
    mcp_rpc_migration_count: 4,
    truncated: false,
    excluded_fields: [
      "statements",
      "rollback",
      "created_by",
      "sql_text",
      "applied_by",
      "notes",
    ],
  });
  assert.ok(baseline.supabase_schema_migrations.every((row) => /^\d{14}$/.test(String(row.version || ""))));
  assert.equal(
    new Set(baseline.supabase_schema_migrations.map((row) => row.version)).size,
    baseline.supabase_schema_migrations.length,
    "Supabase production migration identifiers must be unique",
  );
  assert.equal(
    new Set(baseline.mcp_rpc_migration_log.map((row) => row.migration_name)).size,
    baseline.mcp_rpc_migration_log.length,
    "MCP migration ledger identifiers must be unique",
  );
  const forbiddenPayloadFields = new Set(["statements", "rollback", "sql_text", "created_by", "applied_by"]);
  const presentForbidden = [...new Set(collectPropertyNames({
    supabase_schema_migrations: baseline.supabase_schema_migrations,
    mcp_rpc_migration_log: baseline.mcp_rpc_migration_log,
  }).filter((name) => forbiddenPayloadFields.has(name.toLowerCase())))];
  assert.deepEqual(presentForbidden, [], "Migration baseline must contain identifiers only, never migration payloads or actor fields");
  return baseline;
}

async function validateBackendHttpApiBaseline(production) {
  const baseline = await readJson("quality/baselines/backend-http-api-2026-07-23.json");
  assert.equal(baseline.snapshot_version, "batch-0a.backend-http-api-baseline.v1");
  assert.equal(baseline.source?.repository, "lasrevinu333-design/memphis-zoo-mcp");
  assert.equal(baseline.source?.commit, production.source.backend_commit);
  assert.equal(baseline.documented_routes.length, 80);
  assert.equal(baseline.source_route_declarations.length, 182);
  assert.equal(Object.keys(baseline.contract_versions).length, 9);
  assert.deepEqual(baseline.contract_versions, {
    scan: "scan.v2",
    dashboard: "dashboard.v1",
    messaging: "messaging.v5",
    schedule: "schedule.v2",
    operational_analytics: "operational-analytics.v1",
    guest_reports: "guest-reports.v1",
    feedback: "feedback.v1",
    ops_manager_auth: "ops-manager-auth.v5.named-leadership",
    gemini_console: "gemini-console.v2",
  });
  for (const route of baseline.documented_routes) {
    assert.match(route.method, /^(DELETE|GET|PATCH|POST|PUT)$/);
    assert.match(route.path, /^\//);
  }
  for (const declaration of baseline.source_route_declarations) {
    assert.match(declaration.file, /^src\/.+\.js$/);
    assert.match(declaration.method, /^(DELETE|GET|OPTIONS|PATCH|POST|PUT)$/);
    assert.match(declaration.declared_path, /^\//);
  }
  const documentedKeys = baseline.documented_routes.map((route) => `${route.method} ${route.path}`);
  assert.equal(new Set(documentedKeys).size, documentedKeys.length, "Documented backend routes must be unique");
  const forbiddenPayloadFields = new Set(["statements", "rollback", "sql_text", "created_by", "applied_by"]);
  const presentForbidden = [...new Set(collectPropertyNames(baseline).filter((name) => forbiddenPayloadFields.has(name.toLowerCase())))];
  assert.deepEqual(presentForbidden, [], "HTTP API baseline must contain route metadata only");
  return baseline;
}

async function validateFixtures() {
  const manifest = await readJson("quality/fixtures/batch-0a/fixture-manifest.json");
  assert.equal(manifest.fixture_set, "memphis-zoo.batch-0a.contracts.v1");
  assert.equal(manifest.contains_production_data, false);
  assert.equal(manifest.timezone, "America/Chicago");
  const diskFiles = (await readdir(fixtureDir)).filter((name) => name.endsWith(".json") && name !== "fixture-manifest.json");
  assert.deepEqual(sorted(diskFiles), sorted(manifest.fixtures), "Every Batch 0A fixture must be declared exactly once");

  const events = await readJson("quality/fixtures/batch-0a/events-two-reminders.json");
  assert.equal(events.timezone, "America/Chicago");
  assert.equal(events.event.event_revision, 4);
  assert.deepEqual(events.expected_notifications.map((item) => item.notification_kind), ["day_before", "shift_plus_15"]);
  assert.deepEqual(events.expected_notifications.map((item) => item.scheduled_for_local), [
    "2026-11-01T08:00:00-06:00",
    "2026-11-02T07:15:00-06:00",
  ]);
  assert.ok(events.expected_notifications.every((item) => item.delivery === "native_phone_notification" && item.dismissible_by_recipient === true));
  assert.deepEqual(events.uniqueness_key_fields, [
    "event_id",
    "event_revision",
    "service_date",
    "employee_id",
    "device_id",
    "assignment_epoch",
    "notification_kind",
  ]);
  assert.deepEqual(events.expected_side_effects, {
    native_notification_jobs: 2,
    messenger_threads_created: 0,
    messenger_messages_created: 0,
    event_generated_chat_content: false,
  });

  const reassignment = await readJson("quality/fixtures/batch-0a/phone-reassignment-epoch.json");
  assert.ok(isUuid(reassignment.request.operation_id));
  assert.equal(reassignment.after.assignment_epoch, reassignment.before.assignment_epoch + 1);
  assert.equal(reassignment.after.previous_device_credential_valid, false);
  assert.equal(reassignment.after.previous_push_registration_valid, false);
  assert.equal(reassignment.after.previous_session_authorized_for_new_writes, false);
  assert.deepEqual(reassignment.after.pending_workflow_ids_preserved, reassignment.before.pending_workflow_ids);
  assert.equal(reassignment.after.pending_work_requires_authoritative_reconciliation, true);

  const messaging = await readJson("quality/fixtures/batch-0a/messenger-direct-group-memphis.json");
  assert.equal(messaging.direct_thread.request.path, "/messaging-api/thread/direct");
  assert.equal(messaging.group_thread.request.path, "/messaging-api/thread/group");
  assert.equal(messaging.memphis_thread.thread_request.path, "/messaging-api/memphis/thread");
  assert.equal(messaging.memphis_thread.message_request.path, "/messaging-api/memphis/message");
  assert.equal(messaging.direct_thread.retry_returns_same_thread, true);
  assert.equal(messaging.group_thread.retry_returns_same_thread, true);
  assert.equal(messaging.memphis_thread.singleton_per_user, true);
  assert.equal(messaging.memphis_thread.replayed_client_message_user_rows, 1);
  assert.equal(messaging.memphis_thread.replayed_client_message_bot_rows, 1);
  assert.deepEqual(messaging.deletion.visibility_after_delete, { requesting_user: false, other_participants: true });
  assert.deepEqual(messaging.event_integration, { event_generated_threads: 0, event_generated_messages: 0 });

  const nfc = await readJson("quality/fixtures/batch-0a/nfc-cleaning-session.json");
  assert.equal(nfc.scan.source, "ambient-nfc");
  assert.equal(nfc.scan.canonical_device_id, "KIOSK_04");
  assert.deepEqual(nfc.operations.map((item) => item.type), [
    "record_scan_event",
    "start_session",
    "finish_session",
    "commit_workflow",
  ]);
  assert.equal(new Set(nfc.operations.map((item) => item.operation_id)).size, nfc.operations.length);
  assert.equal(nfc.expected.session_rows, 1);
  assert.equal(nfc.expected.completion_rows, 1);
  assert.equal(nfc.expected.duplicate_scan_does_not_create_second_session, true);

  const offline = await readJson("quality/fixtures/batch-0a/offline-idempotency-duplicates.json");
  assert.deepEqual(offline.cases.map((item) => item.name), [
    "same-operation-same-payload",
    "same-operation-different-payload",
    "two-tabs-same-logical-operation",
    "response-received-before-local-delete-crash",
    "permanent-client-error",
    "rate-limited-retry",
  ]);
  assert.ok(offline.cases.every((item) => isUuid(item.operation_id)));
  assert.deepEqual(offline.ordering, ["created_at", "id"]);
  assert.equal(offline.never_silently_discard_unresolved_work, true);

  const retention = await readJson("quality/fixtures/batch-0a/retention-14-chicago-days.json");
  assert.equal(retention.timezone, "America/Chicago");
  assert.equal(retention.clock.crosses_dst_fall_back, true);
  assert.deepEqual(retention.event_cases.map((item) => [item.full_calendar_days_elapsed, item.expected]), [[14, "purge"], [13, "retain"]]);
  assert.deepEqual(retention.messenger_cases.map((item) => item.expected), ["purge", "retain", "retain"]);
  assert.ok(Object.values(retention.durable_domains).every((value) => value === "preserve"));
  assert.equal(retention.purge_rules.timezone_math_uses_calendar_dates, true);

  const queue = await readJson("quality/fixtures/batch-0a/mz-scan-queue-v4.json");
  assert.deepEqual(queue.database, { name: "mz_scan_queue", version: 4 });
  assert.deepEqual(queue.store, {
    name: "actions",
    key_path: "id",
    auto_increment: true,
    indexes: [
      { name: "logical_key", key_path: "logical_key", unique: false },
      { name: "state", key_path: "state", unique: false },
      { name: "next_attempt_at", key_path: "next_attempt_at", unique: false },
    ],
  });
  assert.deepEqual(queue.legacy_snapshots.map((item) => item.database_version), [1, 2, 3]);
  const requiredQueueFields = [
    "id", "schema_version", "type", "client_id", "operation_id", "logical_identity",
    "logical_key", "payload", "created_at", "retry_count", "last_error",
    "last_attempt_at", "next_attempt_at", "dead_letter", "state", "lease_owner",
    "lease_token", "lease_until",
  ];
  for (const row of queue.v4_records) {
    assert.deepEqual(sorted(Object.keys(row)), sorted(requiredQueueFields), `Unexpected v4 queue shape for row ${row.id}`);
    assert.equal(row.schema_version, 4);
    assert.ok(isUuid(row.operation_id));
  }
  assert.equal(queue.migration_expectations.next_auto_increment_id, Math.max(...queue.v4_records.map((row) => row.id)) + 1);
  assert.equal(queue.migration_expectations.preserve_unresolved_work, true);

  const storage = await readJson("quality/fixtures/batch-0a/local-storage-migration.json");
  const keys = storage.entries.map((entry) => entry.key);
  for (const prefix of ["session:", "mz_scan_completion_draft:", "mz_chatscope_outbox:", "mz_phone_scan_resume:", "mz_work_position_evidence:"]) {
    assert.ok(keys.some((key) => key.startsWith(prefix)), `Legacy storage fixture must contain ${prefix}`);
  }
  assert.equal(storage.migration_expectations.delete_source_only_after_transactional_import, true);
  assert.equal(storage.migration_expectations.reimport_is_idempotent, true);
  assert.equal(storage.migration_expectations.malformed_rows_are_quarantined_not_deleted, true);
  assert.equal(storage.migration_expectations.age_alone_never_discards_unresolved_work, true);
  const serializedStorage = JSON.stringify(storage.entries).toLowerCase();
  for (const field of storage.forbidden_persisted_fields) {
    assert.equal(serializedStorage.includes(`"${field.toLowerCase()}"`), false, `${field} must not be persisted in migration fixtures`);
  }

  return manifest;
}

const [architecture, production, fixtures] = await Promise.all([
  validateArchitectureBaseline(),
  validateProductionMetadataBaseline(),
  validateFixtures(),
]);
const [migrations, httpApi] = await Promise.all([
  validateProductionMigrationBaseline(production),
  validateBackendHttpApiBaseline(production),
]);

console.log(JSON.stringify({
  ok: true,
  baseline: architecture.baseline,
  target_stack_runtime_change_in_this_batch: architecture.target_stack_runtime_change_in_this_batch,
  production_snapshot: production.snapshot_version,
  production_migration_snapshot: migrations.snapshot_version,
  backend_http_api_snapshot: httpApi.snapshot_version,
  documented_http_routes: httpApi.documented_routes.length,
  fixture_set: fixtures.fixture_set,
  fixture_count: fixtures.fixtures.length,
}, null, 2));
