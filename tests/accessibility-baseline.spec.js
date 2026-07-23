const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const baseline = require("../quality/baselines/accessibility-serious-critical-2026-07-23.json");

const CAPTURE = /^(1|true|yes)$/i.test(String(process.env.MZ_A11Y_CAPTURE_BASELINE || ""));
const SERIOUS_IMPACTS = new Set(["serious", "critical"]);

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

async function installDeterministicRuntime(context, entry) {
  await context.addInitScript(() => {
    localStorage.setItem("mz_scan_device_id", "KIOSK_04");
    localStorage.setItem("memphisAssignedDeviceId", "KIOSK_04");
    localStorage.setItem("mz_employee_hub_device_id", "KIOSK_04");
  });
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
    const url = new URL(route.request().url());
    let data = { ok: true, data: {}, meta: { contract_versions: baseline.contract_versions } };
    if (url.pathname === "/auth-api/session") {
      if (entry.surface === "ops-manager-hub") {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "No synthetic trusted session for enrollment surface." }),
        });
      }
      data = managerSessionPayload();
    } else if (url.pathname === "/version") {
      data = { ok: true, version: "batch-0a-baseline", contracts: baseline.contract_versions };
    } else if (url.pathname === "/scan-api/rpc") {
      const request = route.request().postDataJSON?.() || {};
      if (request.fn === "tool_get_system_settings") {
        data = { ok: true, data: { system_enabled: true } };
      } else if (request.fn === "tool_get_location_scan_state") {
        data = {
          ok: true,
          data: {
            location_code: "TETM",
            location_name: "Teton Men's Restroom",
            location_type: "restroom",
            form_type: "restroom",
            canonical_device_id: "KIOSK_04",
            assigned_device_employee_name: "Synthetic Employee",
            suggested_action: "start_session",
          },
        };
      }
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
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
      await page.goto(entry.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      expect(
        new URL(page.url()).pathname,
        `${entry.surface} redirected away from the surface the accessibility baseline claims to cover`,
      ).toBe(new URL(entry.path, "http://127.0.0.1:4173").pathname);
      await expect(page.locator("body")).toBeVisible();

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
