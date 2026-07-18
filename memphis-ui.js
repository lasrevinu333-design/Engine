(function () {
  "use strict";

  const OPS_HUB = "./start_page1.html";
  const EMPLOYEE_HUB = "./employee-hub.html";
  const SAFE_CONTEXTS = new Set(["manager", "employee", "contextual"]);

  function enforceTopLevelNavigation() {
    if (window.top === window.self) return;
    try {
      window.top.location.replace(window.location.href);
    } catch {
      document.documentElement.hidden = true;
    }
  }

  enforceTopLevelNavigation();

  function explicitContext() {
    const value = String(document.body?.dataset?.memphisContext || "").trim().toLowerCase();
    return SAFE_CONTEXTS.has(value) ? value : "";
  }

  function resolvedContext() {
    const configured = explicitContext();
    if (configured !== "contextual") return configured || "manager";
    const requested = String(new URL(window.location.href).searchParams.get("hub") || "").trim().toLowerCase();
    return requested === "employee" ? "employee" : "manager";
  }

  function safeDeviceId() {
    const url = new URL(window.location.href);
    const raw = String(url.searchParams.get("device") || url.searchParams.get("deviceId") || "").trim();
    return /^[A-Za-z0-9_.:-]{1,96}$/.test(raw) ? raw : "";
  }

  function canonicalBackTarget(context = resolvedContext()) {
    const target = new URL(context === "employee" ? EMPLOYEE_HUB : OPS_HUB, window.location.href);
    const device = safeDeviceId();
    if (device && context === "employee") target.searchParams.set("device", device);
    if (context === "employee") target.searchParams.set("hub", "employee");
    return target;
  }

  function canonicalBackLabel(context = resolvedContext()) {
    return context === "employee" ? "Back to Custodial Hub" : "Back to Ops Hub";
  }

  function dirtyForms() {
    return Array.from(document.querySelectorAll("form[data-mz-protect-unsaved='true']"));
  }

  function isDirty() {
    return dirtyForms().some((form) => form.dataset.mzDirty === "true");
  }

  function markSaved(form) {
    if (form instanceof HTMLFormElement) form.dataset.mzDirty = "false";
  }

  function bindDirtyProtection() {
    dirtyForms().forEach((form) => {
      form.dataset.mzDirty = "false";
      form.addEventListener("input", () => { form.dataset.mzDirty = "true"; });
      form.addEventListener("change", () => { form.dataset.mzDirty = "true"; });
      form.addEventListener("reset", () => { form.dataset.mzDirty = "false"; });
      form.addEventListener("submit", () => {
        if (form.dataset.mzSaveOnSubmit === "true") form.dataset.mzDirty = "false";
      });
    });

    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-mz-back]");
      if (!control) return;
      if (isDirty() && !window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = control instanceof HTMLAnchorElement && control.href
        ? control.href
        : canonicalBackTarget().toString();
      window.location.assign(target);
    }, true);

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function configureBackControls() {
    const context = resolvedContext();
    const target = canonicalBackTarget(context);
    const label = canonicalBackLabel(context);
    const controls = Array.from(document.querySelectorAll("[data-mz-back]"));

    controls.forEach((control) => {
      control.classList.add("mz-back-link");
      control.setAttribute("aria-label", label);
      if (!control.dataset.mzBackLabelPreserved) control.textContent = label;
      if (control instanceof HTMLAnchorElement) {
        control.href = target.toString();
      } else {
        control.type = "button";
        control.addEventListener("click", () => { window.location.assign(target.toString()); });
      }
    });

    if (controls.length > 1) {
      console.error("Memphis UI configuration error: more than one canonical Hub control is present.");
    }

    const current = new URL(window.location.href);
    let fromAnnie = String(current.searchParams.get("origin") || "").trim().toLowerCase() === "annie";
    try {
      fromAnnie = fromAnnie || sessionStorage.getItem("mz_annie_origin_session") === "1";
    } catch {}
    document.querySelectorAll("[data-mz-annie-back]").forEach((control) => {
      control.hidden = !fromAnnie;
      if (fromAnnie && control instanceof HTMLAnchorElement) {
        control.href = "https://memphis-zoo-mcp.onrender.com/moxie/";
      }
    });
  }

  function announce(message, options = {}) {
    const region = options.region instanceof Element
      ? options.region
      : document.querySelector(options.selector || "[data-mz-status]");
    if (!region) return;
    region.textContent = String(message || "");
    region.setAttribute("role", options.error ? "alert" : "status");
    region.setAttribute("aria-live", options.error ? "assertive" : "polite");
  }

  function setBusy(control, busy, label = "") {
    if (!(control instanceof Element)) return;
    if (busy) {
      control.setAttribute("aria-busy", "true");
      control.setAttribute("aria-disabled", "true");
      if ("disabled" in control) control.disabled = true;
      if (label) {
        control.dataset.mzReadyLabel = control.textContent;
        control.textContent = label;
      }
      return;
    }
    control.removeAttribute("aria-busy");
    control.removeAttribute("aria-disabled");
    if ("disabled" in control) control.disabled = false;
    if (control.dataset.mzReadyLabel) {
      control.textContent = control.dataset.mzReadyLabel;
      delete control.dataset.mzReadyLabel;
    }
  }

  function authReady() {
    document.documentElement.classList.remove("mz-auth-pending");
    document.documentElement.classList.add("mz-auth-ready");
  }

  function init() {
    document.documentElement.classList.add("mz-ui-ready");
    configureBackControls();
    bindDirtyProtection();
  }

  window.MemphisUI = {
    announce,
    authReady,
    canonicalBackLabel,
    canonicalBackTarget,
    markSaved,
    resolvedContext,
    setBusy,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
