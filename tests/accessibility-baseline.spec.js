const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const baseline = require("../quality/baselines/accessibility-serious-critical-2026-07-23.json");

const CAPTURE = /^(1|true|yes)$/i.test(String(process.env.MZ_A11Y_CAPTURE_BASELINE || ""));
const SERIOUS_IMPACTS = new Set(["serious", "critical"]);
const SYNTHETIC_EMPLOYEE_ID = "00000000-0000-4000-8000-000000000903";
const SYNTHETIC_MESSAGE_USER_ID = "00000000-0000-4000-8000-000000000904";
const SYNTHETIC_THREAD_ID = "00000000-0000-4000-8000-000000000905";
const SYNTHETIC_MESSAGE_ID = "00000000-0000-4000-8000-000000000906";
const SYNTHETIC_LOCATION_ID = "00000000-0000-4000-8000-000000000907";
const SYNTHETIC_SESSION_ID = "00000000-0000-4000-8000-000000000908";
const SYNTHETIC_NFC_ENTRY_ID = "00000000-0000-4000-8000-000000000911";
const REQUIRED_SCHEMA_FINGERPRINT = "084cfd11b468999e4968900bb223e93b27253fb7caaf1af07e8b989bb7098bf4";

function violationKey(item) {
  return JSON.stringify({
    rule: item.rule,
    impact: item.impact,
    target: item.target,
  });
}

function normalizeViolations(result) {
  return result.violations
    .filter((violation) => SERIOUS_IMPACTS.has(violation.impact))
    .flatMap((violation) => violation.nodes.map((node) => ({
      rule: violation.id,
      impact: violation.impact,
      target: node.target,
    })))
    .sort((a, b) => violationKey(a).localeCompare(violationKey(b)));
}

function managerSessionPayload() {
  return {
    ok: true,
    data: {
      session: {
        token: "batch-0a-accessibility-session",
        role: "ops_manager",
        roles: ["CUSTODIAL_MANAGER", "SECURITY_ADMIN"],
        manager_id: "00000000-0000-4000-8000-000000000901",
        manager_display_name: "Synthetic Manager",
        manager_job_title: "Custodial Manager",
        device_id: "KIOSK_04",
        credential_id: "00000000-0000-4000-8000-000000000902",
        access_level: "full_access",
        read_only: false,
        expires_at: "2036-07-23T00:00:00.000Z",
      },
      trusted_device: {
        credential_id: "00000000-0000-4000-8000-000000000902",
        device_id: "KIOSK_04",
      },
    },
  };
}

function jsonEnvelope(data, meta = {}) {
  return { ok: true, data, meta };
}

function deviceCredentialPayload() {
  return jsonEnvelope({
    authenticated: true,
    enrollment_required: false,
    policy_mode: "enforce",
    canonical_device_id: "KIOSK_04",
    employee_id: SYNTHETIC_EMPLOYEE_ID,
    employee_name: "Synthetic Employee",
  });
}

function messengerIdentityPayload() {
  return {
    msg_user_id: SYNTHETIC_MESSAGE_USER_ID,
    user_id: SYNTHETIC_MESSAGE_USER_ID,
    display_name: "Synthetic Manager",
    role: "manager",
    role_title: "Custodial Manager",
    job_title: "Custodial Manager",
    identity_source: "synthetic_accessibility_fixture",
    canonical_device_id: "KIOSK_04",
  };
}

function messengerThreadPayload() {
  return {
    thread_id: SYNTHETIC_THREAD_ID,
    thread_type: "direct",
    thread_title: "Synthetic Employee",
    unread_count: 1,
    last_message_id: SYNTHETIC_MESSAGE_ID,
    last_message_body: "Synthetic accessibility message.",
    last_message_at: "2026-07-23T14:00:00.000Z",
    updated_at: "2026-07-23T14:00:00.000Z",
    participant_names: "Synthetic Employee",
    viewer_can_send: true,
  };
}

function operationalPerformancePayload() {
  return [{
    employee_id: SYNTHETIC_EMPLOYEE_ID,
    employee_code: "EMP900",
    employee_name: "Synthetic Employee",
    location_id: SYNTHETIC_LOCATION_ID,
    location_code: "TETM",
    location_name: "Teton Men's Restroom",
    cleaning_count: 3,
    cleanings_last_30_days: 3,
    average_duration_minutes: 24,
    median_duration_minutes: 23,
    duration_delta_from_location_minutes: -2,
    inspection_count: 2,
    average_inspection_score: 94,
    inspection_pass_rate_pct: 100,
    maintenance_ticket_count: 1,
    latest_cleaning_at: "2026-07-23T13:30:00.000Z",
  }];
}

function operationalSessionPayload() {
  return [{
    session_id: SYNTHETIC_SESSION_ID,
    status: "closed",
    employee_id: SYNTHETIC_EMPLOYEE_ID,
    employee_code: "EMP900",
    employee_name: "Synthetic Employee",
    location_id: SYNTHETIC_LOCATION_ID,
    location_code: "TETM",
    location_name: "Teton Men's Restroom",
    started_at: "2026-07-23T13:00:00.000Z",
    ended_at: "2026-07-23T13:24:00.000Z",
    duration_minutes: 24,
    services_performed: ["Floors", "Trash"],
    maintenance_ticket_count: 1,
    open_maintenance_ticket_count: 0,
    inspection_count: 2,
    latest_inspection_score: 94,
    cleaning_note: "Synthetic accessibility fixture.",
  }];
}

function operationalTicketPayload() {
  return [{
    location_id: SYNTHETIC_LOCATION_ID,
    location_code: "TETM",
    location_name: "Teton Men's Restroom",
    issue_category: "Plumbing",
    issue_category_key: "plumbing",
    fixture_type: "Sink",
    fixture_identifier: "Sink 1",
    ticket_count_last_7_days: 2,
    ticket_count_last_30_days: 2,
    ticket_count_last_90_days: 2,
    total_ticket_count: 2,
    open_ticket_count: 0,
    recurrence_status: "recurring",
    average_resolution_hours: 2.5,
    first_reported_at: "2026-07-20T14:00:00.000Z",
    latest_reported_at: "2026-07-22T14:00:00.000Z",
    issue_signature: "synthetic-plumbing-sink",
  }];
}

function operationalInspectionPayload() {
  return [{
    id: "00000000-0000-4000-8000-000000000909",
    session_id: SYNTHETIC_SESSION_ID,
    inspection_type: "manager_spot_check",
    location_name_snapshot: "Teton Men's Restroom",
    employee_name_snapshot: "Synthetic Employee",
    inspector_name_snapshot: "Synthetic Manager",
    session_duration_minutes: 24,
    overall_score: 94,
    appearance_score: 95,
    sanitation_score: 95,
    detail_score: 90,
    passed: true,
    critical_failure: false,
    follow_up_required: false,
    inspected_at: "2026-07-23T13:30:00.000Z",
    notes: "Synthetic accessibility fixture.",
  }];
}

function schedulePayload(url) {
  if (url.pathname === "/schedule-api/settings/close-time") return { closing_time: "18:00:00" };
  if (url.pathname === "/schedule-api/employees") return [];
  if (url.pathname === "/schedule-api/day") {
    return {
      service_date: url.searchParams.get("service_date") || "2026-07-23",
      groups: [],
    };
  }
  if (url.pathname === "/schedule-api/generation-window") {
    return {
      days: 7,
      ready_days: 0,
      window: [],
      auto_generation: { running: false, generated_days: 0 },
    };
  }
  if (url.pathname === "/schedule-api/locations/workload-settings") return [];
  if (url.pathname === "/schedule-api/pto") return { rows: [] };
  return {};
}

function backendPayload(request, entry) {
  const url = new URL(request.url());
  const { pathname } = url;
  if (pathname === "/device-auth/status") return deviceCredentialPayload();
  if (pathname === "/version") {
    return {
      ok: true,
      version: "release-2026.07.19.custodial-v3.12",
      contracts: {
        ...baseline.contract_versions,
        scan: "scan.v4.snapshot-bound-authority",
      },
      release_manifest: {
        schema: { fingerprint: REQUIRED_SCHEMA_FINGERPRINT },
      },
    };
  }
  if (pathname === "/dashboard-api/current-attendance") {
    return jsonEnvelope({
      attendance: 1234,
      planned: 1200,
      last_year: 1100,
      yesterday_plan: 1180,
    });
  }
  if (pathname === "/dashboard-api/summary") {
    return jsonEnvelope({
      meta: { contracts: { dashboard: "dashboard.v1" } },
      restrooms: [],
      exhibits: [],
      open_tickets: [],
    });
  }
  if (pathname === "/dashboard-api/work-session-alerts") return jsonEnvelope([]);
  if (pathname === "/dashboard-api/events") {
    return jsonEnvelope([{
      event_id: "00000000-0000-4000-8000-000000000910",
      event_name: "Synthetic Conservation Briefing",
      display_location: "Teton Trek",
      event_date: "2030-07-24",
      end_date: "2030-07-24",
      start_time: "09:00:00",
      end_time: "10:00:00",
      attendee_count: 12,
      notes: "Synthetic accessibility fixture.",
    }]);
  }
  if (pathname === "/schedule-api/my-day-summary") {
    return jsonEnvelope({
      employee_id: SYNTHETIC_EMPLOYEE_ID,
      employee_name: "Synthetic Employee",
      employee_code: "EMP900",
      device_id: "KIOSK_04",
      device_name: "Synthetic Employee Phone",
      service_date: "2026-07-23",
      assignments: [],
    });
  }
  if (pathname === "/messaging-api/me/by-device") return jsonEnvelope(messengerIdentityPayload());
  if (pathname === "/messaging-api/users") {
    return jsonEnvelope([
      {
        id: SYNTHETIC_MESSAGE_USER_ID,
        display_name: "Synthetic Manager",
        role: "manager",
        role_title: "Custodial Manager",
        is_active: true,
      },
      {
        id: SYNTHETIC_EMPLOYEE_ID,
        display_name: "Synthetic Employee",
        role: "employee",
        role_title: "Employee",
        is_active: true,
      },
    ]);
  }
  if (pathname === "/messaging-api/threads/updates") {
    return jsonEnvelope([], {
      next_cursor: {
        after: "2026-07-23T14:00:00.000Z",
        after_id: SYNTHETIC_THREAD_ID,
      },
    });
  }
  if (pathname === "/messaging-api/threads") return jsonEnvelope([messengerThreadPayload()]);
  if (pathname === `/messaging-api/thread/${SYNTHETIC_THREAD_ID}/messages`) {
    return jsonEnvelope([{
      id: SYNTHETIC_MESSAGE_ID,
      thread_id: SYNTHETIC_THREAD_ID,
      sender_user_id: SYNTHETIC_EMPLOYEE_ID,
      sender_display_name: "Synthetic Employee",
      message_type: "text",
      body: "Synthetic accessibility message.",
      sent_at: "2026-07-23T14:00:00.000Z",
      created_at: "2026-07-23T14:00:00.000Z",
      updated_at: "2026-07-23T14:00:00.000Z",
      is_deleted: false,
    }]);
  }
  if (pathname === `/messaging-api/thread/${SYNTHETIC_THREAD_ID}/updates`) {
    return jsonEnvelope([], {
      next_cursor: {
        after: "2026-07-23T14:00:00.000Z",
        after_id: SYNTHETIC_MESSAGE_ID,
      },
    });
  }
  if (pathname === `/messaging-api/thread/${SYNTHETIC_THREAD_ID}/read`) return jsonEnvelope(1);
  if (pathname === "/analytics-api/cleaning-performance") return jsonEnvelope(operationalPerformancePayload());
  if (pathname === "/analytics-api/session-facts") return jsonEnvelope(operationalSessionPayload());
  if (pathname === "/analytics-api/ticket-trends") return jsonEnvelope(operationalTicketPayload());
  if (pathname === "/analytics-api/inspections" && request.method() === "GET") {
    return jsonEnvelope(operationalInspectionPayload());
  }
  if (pathname === "/leadership-api/phone-assignments") {
    return jsonEnvelope({
      employees: [{
        id: SYNTHETIC_EMPLOYEE_ID,
        employee_code: "EMP900",
        display_name: "Synthetic Employee",
        is_active: true,
        assigned_device_id: "KIOSK_04",
      }],
      devices: [{
        device_id: "KIOSK_04",
        device_name: "Synthetic Employee Phone",
        assigned_employee_id: SYNTHETIC_EMPLOYEE_ID,
        employee_code: "EMP900",
        employee_name: "Synthetic Employee",
        last_seen_at: "2026-07-23T14:00:00.000Z",
        assignment_epoch: 4,
        pending_work_count: 2,
        pending_work_status: "current",
        pending_work_oldest_at: "2026-07-23T13:00:00.000Z",
        pending_work_reported_at: "2026-07-23T14:00:00.000Z",
        offline_authority_employee_id: SYNTHETIC_EMPLOYEE_ID,
        offline_authority_assignment_epoch: 4,
        offline_authority_expires_at: "2099-07-24T14:00:00.000Z",
      }],
    });
  }
  if (pathname.startsWith("/schedule-api/")) return jsonEnvelope(schedulePayload(url));
  if (pathname === "/scan-api/rpc") {
    const rpc = request.postDataJSON?.() || {};
    if (rpc.fn === "tool_get_system_settings") return jsonEnvelope({ system_enabled: true });
    if (rpc.fn === "tool_get_location_scan_state") {
      return jsonEnvelope({
        location_code: "TETM",
        location_name: "Teton Men's Restroom",
        location_type: "restroom",
        form_type: "restroom",
        canonical_device_id: "KIOSK_04",
        assigned_device_employee_name: "Synthetic Employee",
        suggested_action: "start_session",
      });
    }
    return jsonEnvelope({});
  }
  return jsonEnvelope({}, { contract_versions: baseline.contract_versions });
}

async function assertSurfaceReady(page, entry) {
  const readyChecks = {
    "start-page": async () => {
      await expect(page.locator("#access-mode")).toContainText("Full-access Ops Manager · Synthetic Manager");
      await expect(page.locator(".hubGrid").first()).toBeVisible();
    },
    "ops-manager-hub": async () => {
      await expect(page.locator("#enroll-form")).toBeVisible();
      await expect(page.getByLabel("Personal enrollment code")).toBeVisible();
    },
    "employee-hub": async () => {
      await expect(page.locator("#employee-value")).toHaveText("Synthetic Employee");
      await expect(page.locator("#messages-link")).toBeVisible();
    },
    messenger: async () => {
      await expect(page.locator(".cs-main-container")).toBeVisible();
      await expect(page.getByText("Synthetic Employee", { exact: true }).first()).toBeVisible();
    },
    events: async () => {
      await expect(page.locator("#status-pill")).toHaveText("1 upcoming event loaded");
      await expect(page.locator(".eventRow")).toHaveCount(1);
    },
    dashboard: async () => {
      await expect(page.locator("#refresh-status")).toContainText("Last refresh:");
      await expect(page.locator("#tiles .tile")).toHaveCount(5);
    },
    scan: async () => {
      await expect(page.getByRole("heading", { name: "Pre-Scan" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start Cleaning" })).toBeVisible();
    },
    "operational-insights": async () => {
      await expect(page.locator("#global-status")).toContainText("Current through");
      await expect(page.locator("#performance-list .dataCard")).toHaveCount(1);
      await expect(page.getByText("Synthetic Employee · Teton Men's Restroom", { exact: true })).toBeVisible();
    },
    "phone-assignments": async () => {
      await expect(page.locator("#assignment-status")).toHaveText("1 kiosk phones ready.");
      await expect(page.locator("#phone-list .phoneRow")).toHaveCount(1);
      await expect(page.locator(".phoneOperationalWarning")).toContainText("2 pending phone items");
      await expect(page.locator(".phoneOperationalWarning")).toContainText("assignment 4");
    },
    schedule: async () => {
      await expect(page.locator("#service-date")).not.toHaveValue("");
      await expect(page.locator("#schedule-wrap")).toContainText("No groups match the current filter.");
    },
    notifications: async () => {
      await expect(page.getByRole("heading", { name: "Phone notifications" })).toBeVisible();
      await expect(page.getByText("This browser is not registered for native push.")).toBeVisible();
    },
  };
  await readyChecks[entry.surface]();
  await expect(page.locator(".mzDeviceEnrollOverlay:not([hidden])")).toHaveCount(0);
  await expect(page.locator(".mzDeviceEnrollBanner:not([hidden])")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /Messenger identity could not be resolved|is not iterable|Startup failed:|Refresh failed:/,
  );
}

async function installDeterministicRuntime(context, entry) {
  await context.addInitScript(({ scanEntryId }) => {
    localStorage.setItem("mz_scan_device_id", "KIOSK_04");
    localStorage.setItem("memphisAssignedDeviceId", "KIOSK_04");
    localStorage.setItem("mz_employee_hub_device_id", "KIOSK_04");
    if (scanEntryId) {
      window.MemphisMobile = {
        verifyScanEntryAttestation: async (entryId) => ({
          schema_version: "scan-entry-attestation.v1",
          entry_id: entryId,
          entry_source: "native-nfc",
          device_id: "KIOSK_04",
          location_code: "TETM",
          created_at: "2026-07-23T14:00:00.000Z",
          expires_at: "2036-07-23T14:15:00.000Z",
          client_session_id: null,
        }),
      };
    }
  }, { scanEntryId: entry.surface === "scan" ? SYNTHETIC_NFC_ENTRY_ID : "" });
  await context.route("https://api.open-meteo.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      current: { temperature_2m: 25, weather_code: 0, wind_speed_10m: 3 },
      daily: { temperature_2m_max: [28], temperature_2m_min: [20] },
      hourly: { time: [], precipitation_probability: [] },
    }),
  }));
  await context.route("https://memphis-zoo-mcp.onrender.com/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth-api/session") {
      if (entry.surface === "ops-manager-hub") {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "No synthetic trusted session for enrollment surface." }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(managerSessionPayload()),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(backendPayload(request, entry)),
    });
  });
}

test.describe("current serious and critical accessibility baseline", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    expect(baseline.baseline_version).toBe("batch-0a.accessibility-serious-critical.v1");
    expect(baseline.tool_versions).toEqual({
      playwright: "1.61.1",
      axe_core_playwright: "4.12.1",
      browser: "playwright-bundled-chromium",
    });
    const keys = baseline.entries.map((entry) => `${entry.surface}|${entry.viewport.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const entry of baseline.entries) {
    test(`${entry.surface} at ${entry.viewport.name} has no new serious or critical violations`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: {
          width: entry.viewport.width,
          height: entry.viewport.height,
        },
        reducedMotion: "reduce",
      });
      await installDeterministicRuntime(context, entry);
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(entry.path, { waitUntil: "domcontentloaded" });
      expect(
        new URL(page.url()).pathname,
        `${entry.surface} redirected away from the surface the accessibility baseline claims to cover`,
      ).toBe(new URL(entry.path, "http://127.0.0.1:4173").pathname);
      await expect(page.locator("body")).toBeVisible();
      await assertSurfaceReady(page, entry);
      expect(pageErrors, `${entry.surface} raised page errors before its accessibility scan`).toEqual([]);

      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const current = normalizeViolations(result);

      if (CAPTURE) {
        console.log(`A11Y_BASELINE_ENTRY ${JSON.stringify({
          surface: entry.surface,
          path: entry.path,
          viewport: entry.viewport,
          known_violations: current,
        })}`);
      } else {
        const known = new Set(entry.known_violations.map(violationKey));
        const newlyIntroduced = current.filter((violation) => !known.has(violationKey(violation)));
        expect(
          newlyIntroduced,
          `New serious/critical accessibility violations on ${entry.surface} at ${entry.viewport.name}`,
        ).toEqual([]);
      }
      await context.close();
    });
  }
});
