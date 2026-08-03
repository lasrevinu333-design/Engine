from pathlib import Path
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


path = Path('employee-schedule.html')
html = path.read_text()
html = replace_once(
    html,
    ".statusPill{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;min-height:42px;padding:10px 16px;font-weight:800;border:1px solid var(--line);color:var(--text);background:rgba(255,255,255,.08);width:max-content;max-width:100%}",
    ".statusPill{display:inline-flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;border-radius:18px;min-height:46px;padding:10px 14px;font-weight:800;border:1px solid var(--line);color:var(--text);background:rgba(255,255,255,.08);width:max-content;max-width:100%}.retryButton{min-height:42px;border:0;border-radius:14px;padding:8px 15px;background:#f8fafc;color:#111827;font-size:.9rem;font-weight:900}.retryButton[hidden]{display:none}.sectionTime{margin:-1px 0 10px;color:#d9f99d;font-size:.9rem;font-weight:900}",
    'Schedule status and retry styles',
)
html = replace_once(
    html,
    '      <div id="status-pill" class="statusPill" hidden></div>',
    '      <div id="status-pill" class="statusPill" hidden><span id="status-text"></span><button id="retry-btn" class="retryButton" type="button" hidden>Try Again</button></div>',
    'Schedule retry control',
)

start = html.index('    const CONFIG = {')
end = html.index('    function isNativeCustodialAuthority() {', start)
bootstrap = '''    const CONFIG = {
      API_BASE: 'https://memphis-zoo-mcp.onrender.com/schedule-api',
      REFRESH_MS: 60000,
      DEVICE_STORAGE_KEY: 'mz_scan_device_id',
      SNAPSHOT_PREFIX: 'mz_current_ownership_v23:'
    };
    const ANNIE_RETURN_URL='https://memphis-zoo-mcp.onrender.com/moxie/';
    const ANNIE_ORIGIN_SESSION_KEY='mz_annie_origin_session';

    const state = {
      currentDeviceId: '',
      employeeName: '',
      refreshTimer: 0,
      scheduleBoundaryTimer: 0,
      loading: false,
    };
    const els = {
      backBtn: document.getElementById('back-btn'),
      statusPill: document.getElementById('status-pill'),
      statusText: document.getElementById('status-text'),
      retryBtn: document.getElementById('retry-btn'),
      employeeName: document.getElementById('employee-name'),
      serviceDate: document.getElementById('service-date'),
      deviceName: document.getElementById('device-name'),
      assignmentGrid: document.getElementById('assignment-grid')
    };

    void init();

    async function init() {
      if (els.backBtn) els.backBtn.addEventListener('click', navigateBack);
      if (els.retryBtn) els.retryBtn.addEventListener('click', () => void safeRefresh('retry'));
      const identity = await resolveIdentity();
      state.currentDeviceId = identity.deviceId;
      state.employeeName = identity.employeeName;
      await safeRefresh('launch');
      state.refreshTimer = setInterval(() => { void safeRefresh('poll'); }, CONFIG.REFRESH_MS);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void safeRefresh('foreground');
      });
      window.addEventListener('online', () => { void safeRefresh('online'); });
      window.addEventListener('memphis:native-notification-received', () => { void safeRefresh('notification'); });
      window.addEventListener('memphis:schedule-refresh', () => { void safeRefresh('event'); });
      window.addEventListener('memphis:custodial-security-state', (event) => {
        const status = event.detail || {};
        if (status.ready === true && status.available === true && !status.quarantined) {
          void safeRefresh('security-ready');
          return;
        }
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.scheduleBoundaryTimer) clearTimeout(state.scheduleBoundaryTimer);
        state.refreshTimer = 0;
        state.scheduleBoundaryTimer = 0;
      });
    }

    async function safeRefresh(reason) {
      try {
        await loadSchedule({ reason });
      } catch (_error) {
        setStatus('Could not update.', true);
      }
    }

'''
html = html[:start] + bootstrap + html[end:]

html = replace_once(
    html,
    "      if (!response.ok || !payload || !payload.ok) {\n        throw new Error((payload && payload.error) || `HTTP ${response.status}`);\n      }",
    "      if (!response.ok || !payload || !payload.ok) {\n        throw new Error('schedule_update_failed');\n      }",
    'employee-safe Schedule API error',
)

load_start = html.index('    async function loadSchedule() {')
load_end = html.index('    function renderSchedule(data) {', load_start)
load_code = '''    async function loadSchedule({ reason = 'refresh' } = {}) {
      if (state.loading) return;
      state.loading = true;
      try {
        const identity = await resolveIdentity();
        state.currentDeviceId = identity.deviceId;
        state.employeeName = identity.employeeName;
        if (!state.currentDeviceId && !state.employeeName) {
          setStatus('This phone needs a manager.', true);
          els.assignmentGrid.innerHTML = '<div class="emptyState">This phone is not ready.</div>';
          return;
        }
        if (reason === 'launch') setStatus('Loading…');
        const query = state.employeeName
          ? `/my-day-summary?employee_name=${encodeURIComponent(state.employeeName)}`
          : `/my-day-summary?device_id=${encodeURIComponent(state.currentDeviceId)}`;
        const data = await api(query);
        const previous = readStoredScheduleSnapshot();
        const next = scheduleSnapshot(data);
        renderSchedule(data);
        scheduleNextBoundary(data);
        writeStoredScheduleSnapshot(next);
        const change = scheduleChangeNotification(previous, next);
        if (change && window.MemphisMobile?.enqueueEmployeeNotification) {
          void window.MemphisMobile.enqueueEmployeeNotification({
            title: 'Schedule changed',
            body: 'Your current areas have changed.',
            data: change,
          }).catch(() => {});
        }
        setStatus('');
      } finally {
        state.loading = false;
      }
    }

'''
html = html[:load_start] + load_code + html[load_end:]

section_start = html.index('    const DISPLAY_SECTION_TITLES = {')
section_end = html.index('    function toMinutes(value) {', section_start)
section_code = '''    const DISPLAY_SECTION_ORDER = ['current', 'lunch', 'added', 'reminder'];

    function displaySectionKey(item = {}) {
      const explicit = String(item.section_key || '').trim().toLowerCase();
      const purpose = normalizePurpose(item?.coverage_purpose || item?.purpose || item?.kind);
      if (explicit === 'lunch' || purpose === 'lunch_coverage') return 'lunch';
      if (['late', 'special', 'added', 'inherited'].includes(explicit) || ['late_coverage', 'inherited_coverage', 'additional_coverage'].includes(purpose)) return 'added';
      if (explicit === 'reminder' || purpose === 'reminder') return 'reminder';
      return 'current';
    }

    function uniqueText(values = []) {
      const seen = new Set();
      return values.map((value) => String(value || '').trim()).filter((value) => {
        const key = value.toLowerCase();
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function consolidateDisplayItems(items = []) {
      const buckets = new Map();
      for (const item of items) {
        const sectionKey = displaySectionKey(item);
        const identity = String(item.location_group_id || item.group_code || itemDisplayName(item)).trim().toLowerCase();
        const key = `${sectionKey}|${identity}`;
        const existing = buckets.get(key) || { ...item, section_key: sectionKey, included_locations: [], time_labels: [], source_rows: 0 };
        existing.source_rows += Number(item.source_rows || 1);
        existing.is_current = existing.is_current || item.is_current === true;
        existing.included_locations.push(...(Array.isArray(item.included_locations) ? item.included_locations : []));
        if (item.time_label) existing.time_labels.push(item.time_label);
        else if (item.coverage_start || item.coverage_end) existing.time_labels.push([item.coverage_start, item.coverage_end].filter(Boolean).join(' – '));
        if (!existing.coverage_end && item.coverage_end) existing.coverage_end = item.coverage_end;
        buckets.set(key, existing);
      }
      return Array.from(buckets.values()).map((item) => ({
        ...item,
        included_locations: uniqueText(item.included_locations),
        time_label: uniqueText(item.time_labels).join(', '),
      }));
    }

    function sourceScheduleItems(data = {}) {
      const backendSections = Array.isArray(data.display_sections) ? data.display_sections : [];
      if (backendSections.length) {
        return backendSections.flatMap((section) => (Array.isArray(section?.items) ? section.items : []).map((item) => ({
          ...item,
          section_key: item.section_key || section.key,
        })));
      }
      return Array.isArray(data.items) ? data.items : [];
    }

    function latestCoverageEnd(items = []) {
      const values = items.map((item) => String(item.coverage_end || '').trim()).filter(Boolean);
      if (!values.length) return '';
      return values.sort((left, right) => toMinutes(left) - toMinutes(right)).at(-1) || '';
    }

    function buildCurrentOwnershipSections(data, items = sourceScheduleItems(data)) {
      const consolidated = consolidateDisplayItems(items);
      const buckets = new Map(DISPLAY_SECTION_ORDER.map((key) => [key, []]));
      for (const item of consolidated) buckets.get(displaySectionKey(item)).push(item);
      return DISPLAY_SECTION_ORDER.map((key) => {
        const sectionItems = sortScheduleItems(buckets.get(key) || []);
        if (!sectionItems.length) return null;
        if (key === 'lunch') {
          const end = latestCoverageEnd(sectionItems);
          return { key, title: end ? `Lunch coverage until ${end}` : 'Lunch coverage', items: sectionItems };
        }
        if (key === 'added') return { key, title: 'Added areas', items: sectionItems };
        if (key === 'reminder') return { key, title: 'Reminder', items: sectionItems };
        return { key, title: 'Your areas now', items: sectionItems };
      }).filter(Boolean);
    }

'''
html = html[:section_start] + section_code + html[section_end:]

render_start = html.index('    function renderSummaryItems(data) {')
render_end = html.index('    function formatDate(value) {', render_start)
render_code = '''    function renderSummaryItems(data) {
      const sections = buildCurrentOwnershipSections(data);
      if (!sections.length) {
        const fallback = data?.schedule_status === 'off'
          ? 'You are not scheduled today.'
          : 'No areas are assigned right now. Tell a manager.';
        els.assignmentGrid.innerHTML = `<div class="emptyState">${escapeHtml(data?.notice || fallback)}</div>`;
        return;
      }
      const notice = data?.notice
        ? `<div class="emptyState scheduleNotice">${escapeHtml(data.notice)}</div>`
        : '';
      els.assignmentGrid.innerHTML = notice + sections.map(renderLocationSection).join('');
    }

    function scheduleItemMeta(item = {}) {
      const locations = uniqueText(Array.isArray(item.included_locations) ? item.included_locations : []);
      return locations.join(', ');
    }

    function renderLocationSection(section) {
      return `
        <section class="assignmentSection" data-section="${escapeHtml(section.key)}">
          <h3 class="sectionTitle">${escapeHtml(section.title)}</h3>
          <ul class="locationList">
            ${section.items.map((item) => `
              <li>
                <div class="scheduleRowTop">
                  <div class="scheduleRowName">${escapeHtml(itemDisplayName(item))}</div>
                </div>
                ${scheduleItemMeta(item) ? `<div class="scheduleRowMeta">${escapeHtml(scheduleItemMeta(item))}</div>` : ''}
              </li>`).join('')}
          </ul>
        </section>`;
    }

    function snapshotIdentity(item = {}) {
      return String(item.location_group_id || item.group_code || itemDisplayName(item)).trim().toLowerCase();
    }

    function stableList(values = []) {
      return uniqueText(values).map((value) => value.toLowerCase()).sort();
    }

    function scheduleFingerprint(snapshot = {}) {
      const seed = JSON.stringify([
        snapshot.serviceDate,
        snapshot.version,
        snapshot.current,
        snapshot.lunch,
        snapshot.added,
        snapshot.rebalance,
      ]);
      let hash = 2166136261;
      for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    }

    function scheduleSnapshot(data = {}) {
      const items = consolidateDisplayItems(sourceScheduleItems(data));
      const result = {
        serviceDate: String(data.service_date || ''),
        version: String(data.schedule_version || data.version || data.generated_at || ''),
        current: stableList(items.filter((item) => displaySectionKey(item) === 'current').map(snapshotIdentity)),
        lunch: stableList(items.filter((item) => displaySectionKey(item) === 'lunch').map(snapshotIdentity)),
        added: stableList(items.filter((item) => displaySectionKey(item) === 'added').map(snapshotIdentity)),
        rebalance: stableList(items.filter((item) => normalizePurpose(item.coverage_purpose) === 'restroom_upkeep').map(snapshotIdentity)),
      };
      result.fingerprint = scheduleFingerprint(result);
      if (!result.version) result.version = result.fingerprint;
      return result;
    }

    function listChanged(left = [], right = []) {
      return JSON.stringify(left) !== JSON.stringify(right);
    }

    function listAdded(left = [], right = []) {
      const previous = new Set(left);
      return right.some((value) => !previous.has(value));
    }

    function listRemoved(left = [], right = []) {
      const next = new Set(right);
      return left.some((value) => !next.has(value));
    }

    function scheduleChangeNotification(previous, next) {
      if (!previous || !next || !previous.serviceDate || previous.serviceDate !== next.serviceDate) return null;
      if (previous.fingerprint === next.fingerprint) return null;
      let kind = 'employee_schedule_change';
      if (!previous.lunch.length && next.lunch.length) kind = 'employee_lunch_coverage_start';
      else if (previous.lunch.length && !next.lunch.length) kind = 'employee_lunch_coverage_end';
      else if (listChanged(previous.rebalance, next.rebalance)) kind = 'employee_restroom_rebalance';
      else if (listAdded(previous.added, next.added) || listAdded(previous.current, next.current)) kind = 'employee_areas_inherited';
      else if (listRemoved(previous.added, next.added) || listRemoved(previous.current, next.current)) kind = 'employee_areas_transferred';
      return {
        kind,
        notification_type: kind,
        notification_key: `schedule:${next.serviceDate}:${next.version}:${kind}`,
        schedule_version: next.version,
        effective_at: new Date().toISOString(),
        route: './employee-schedule.html?hub=employee',
      };
    }

    function snapshotStorageKey() {
      const identity = state.currentDeviceId || state.employeeName || 'employee';
      return `${CONFIG.SNAPSHOT_PREFIX}${identity}`;
    }

    function readStoredScheduleSnapshot() {
      try { return JSON.parse(localStorage.getItem(snapshotStorageKey()) || 'null'); }
      catch (_error) { return null; }
    }

    function writeStoredScheduleSnapshot(snapshot) {
      try { localStorage.setItem(snapshotStorageKey(), JSON.stringify(snapshot)); }
      catch (_error) {}
    }

    function boundaryDate(serviceDate, timeValue) {
      const minutes = toMinutes(timeValue);
      if (!serviceDate || minutes < 0) return null;
      const date = new Date(`${serviceDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return date;
    }

    function nextBoundaryAt(data = {}, now = new Date()) {
      const candidates = [];
      for (const item of sourceScheduleItems(data)) {
        for (const value of [item.coverage_start, item.coverage_end, item.start_time, item.end_time]) {
          const date = boundaryDate(data.service_date, value);
          if (date && date.getTime() > now.getTime() + 500) candidates.push(date);
        }
      }
      const explicit = new Date(data.next_transition_at || data.next_transition || '');
      if (!Number.isNaN(explicit.getTime()) && explicit.getTime() > now.getTime() + 500) candidates.push(explicit);
      return candidates.sort((left, right) => left - right)[0] || null;
    }

    function scheduleNextBoundary(data) {
      if (state.scheduleBoundaryTimer) clearTimeout(state.scheduleBoundaryTimer);
      state.scheduleBoundaryTimer = 0;
      const boundary = nextBoundaryAt(data);
      if (!boundary) return;
      const delay = Math.max(1000, Math.min(2147483000, boundary.getTime() - Date.now() + 1200));
      state.scheduleBoundaryTimer = setTimeout(() => {
        state.scheduleBoundaryTimer = 0;
        void safeRefresh('boundary');
      }, delay);
    }

'''
html = html[:render_start] + render_code + html[render_end:]

old_status_start = html.index('    function setStatus(text, isError = false) {')
old_status_end = html.index('    function safe(error) {', old_status_start)
new_status = '''    function setStatus(value, isError = false) {
      if (!els.statusPill || !els.statusText || !els.retryBtn) return;
      const message = String(value || '').trim();
      if (!message) {
        els.statusPill.hidden = true;
        els.statusText.textContent = '';
        els.retryBtn.hidden = true;
        return;
      }
      els.statusPill.hidden = false;
      els.statusText.textContent = message;
      els.retryBtn.hidden = !isError;
      els.statusPill.style.background = isError ? 'rgba(239,68,68,.18)' : 'rgba(255,255,255,.08)';
      els.statusPill.style.color = isError ? '#fecaca' : '#f8fafc';
    }

'''
html = html[:old_status_start] + new_status + html[old_status_end:]
path.write_text(html)

subprocess.run(['node', 'scripts/employee-schedule-section-tests.mjs'], check=True)
subprocess.run(['node', 'scripts/custodial-native-notification-coordinator-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Installed current-ownership Schedule behavior and transition alerts.')
