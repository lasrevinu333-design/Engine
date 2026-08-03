from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Keep Android NFC/deep-link ownership alive on every employee page through the
# shared native bridge that is injected into the complete Custodial runtime.
bridge_path = Path("mobile/src/custodial/bridge.js")
bridge = bridge_path.read_text()
bridge = replace_once(
    bridge,
    "import { Capacitor } from '@capacitor/core';\n",
    "import { App } from '@capacitor/app';\nimport { Capacitor } from '@capacitor/core';\n",
    "bridge App import",
)

native_scan_runtime = r'''
  let lastNativeScanUrl = '';
  let lastNativeScanAt = 0;

  function nativeScanTarget(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
      const incoming = new URL(raw);
      const keys = ['code', 'location', 'loc', 'session_uuid', 'action'];
      const customScan = ['memphiszoo:', 'memphiszoo-custodial:'].includes(incoming.protocol)
        && incoming.hostname === 'scan';
      const webScan = incoming.protocol === 'https:'
        && incoming.hostname === 'lasrevinu333-design.github.io'
        && /^\/Engine\/(?:$|(?:index|scan)(?:\.html)?$)/.test(incoming.pathname);
      if (!customScan && !webScan) return null;
      if (!customScan && !keys.some((key) => incoming.searchParams.has(key))) return null;

      const target = new URL('./scan.html', location.href);
      for (const key of keys) {
        if (incoming.searchParams.has(key)) target.searchParams.set(key, incoming.searchParams.get(key));
      }
      const customCode = customScan ? incoming.pathname.replace(/^\//, '').trim() : '';
      if (customCode && !target.searchParams.has('code')) target.searchParams.set('code', customCode);
      const id = deviceId();
      if (id) target.searchParams.set('device', id);
      target.searchParams.set('source', 'native-nfc');
      return target;
    } catch {
      return null;
    }
  }

  function handleNativeScanUrl(value) {
    const target = nativeScanTarget(value);
    if (!target) return false;
    const normalized = target.toString();
    const now = Date.now();
    if (normalized === lastNativeScanUrl && now - lastNativeScanAt < 1500) return true;
    lastNativeScanUrl = normalized;
    lastNativeScanAt = now;
    window.dispatchEvent(new CustomEvent('memphis:native-nfc-open', {
      detail: { target: normalized },
    }));
    location.assign(normalized);
    return true;
  }

  async function installNativeScanRouting() {
    try {
      await App.addListener('appUrlOpen', ({ url }) => { handleNativeScanUrl(url); });
    } catch {}
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) handleNativeScanUrl(launch.url);
    } catch {}
  }
'''
bridge = replace_once(
    bridge,
    "  function safeNativeRoute(value) {\n",
    native_scan_runtime + "\n  function safeNativeRoute(value) {\n",
    "native scan runtime insertion",
)
bridge = replace_once(
    bridge,
    "const allowed = new Set(['events.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'index.html']);",
    "const allowed = new Set(['employee-hub.html', 'events.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'system-feedback.html', 'scan.html', 'index.html']);",
    "native safe route allowlist",
)
bridge = replace_once(
    bridge,
    "    .then(() => installNotificationRouting())\n",
    "    .then(() => installNativeScanRouting())\n    .then(() => installNotificationRouting())\n",
    "native scan installation",
)
bridge_path.write_text(bridge)


# The packaged cleaning runtime is scan.html. Never wake an active session into
# packaged index.html, which is now manager-assisted provisioning only.
ui_path = Path("memphis-ui.js")
ui = ui_path.read_text()
ui = replace_once(
    ui,
    '    if (session) {\n      const target = new URL("./index.html", window.location.href);',
    '    if (session) {\n      const target = new URL("./scan.html", window.location.href);',
    "wake scan destination",
)
ui = replace_once(
    ui,
    '    const nativeCustodialHome = context === "employee" && isNativeCustodialAuthority();\n    const target = new URL(\n      nativeCustodialHome ? "./index.html" : (context === "employee" ? EMPLOYEE_HUB : OPS_HUB),\n      window.location.href,',
    '    const target = new URL(\n      context === "employee" ? EMPLOYEE_HUB : OPS_HUB,\n      window.location.href,',
    "canonical employee back target",
)
ui_path.write_text(ui)


# Messenger must return to the canonical employee Home and must never render a
# previous recipient's messages under a newly selected header.
messenger_path = Path("mobile/src/chatscope/app.jsx")
messenger = messenger_path.read_text()
messenger = replace_once(
    messenger,
    "  const target = new URL(nativeApp ? './index.html' : (EMPLOYEE_CONTEXT ? './employee-hub.html' : './start_page1.html'), window.location.href);",
    "  const target = new URL(EMPLOYEE_CONTEXT ? './employee-hub.html' : (nativeApp ? './index.html' : './start_page1.html'), window.location.href);",
    "Messenger back target",
)
messenger = replace_once(
    messenger,
    "  const messageCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });\n  const mounted = useRef(true);",
    "  const messageCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });\n  const messageLoadSequence = useRef(0);\n  const mounted = useRef(true);",
    "Messenger request sequence ref",
)
messenger = replace_once(
    messenger,
    "    if (!threadId) return [];\n    setLoadingMessages(true);\n    try {",
    "    if (!threadId) return [];\n    const requestSequence = ++messageLoadSequence.current;\n    setLoadingMessages(true);\n    try {",
    "Messenger load sequence start",
)
messenger = replace_once(
    messenger,
    "      if (!mounted.current || selectedRef.current !== threadId) return rows;",
    "      if (!mounted.current || selectedRef.current !== threadId || requestSequence !== messageLoadSequence.current) return rows;",
    "Messenger stale response guard",
)
messenger = replace_once(
    messenger,
    "      if (mounted.current) setLoadingMessages(false);",
    "      if (mounted.current && requestSequence === messageLoadSequence.current) setLoadingMessages(false);",
    "Messenger loading guard",
)
messenger = replace_once(
    messenger,
    "  const selectThread = useCallback((id) => {\n    selectedRef.current = id;\n    messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };\n    setSelectedId(id);",
    "  const selectThread = useCallback((id) => {\n    selectedRef.current = id;\n    messageLoadSequence.current += 1;\n    messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };\n    setMessages([]);\n    setLoadingMessages(true);\n    setSelectedId(id);",
    "Messenger synchronous thread isolation",
)
messenger_path.write_text(messenger)

print('Applied Custodial v23 runtime graph, NFC, wake, Back, and Messenger isolation repairs.')
