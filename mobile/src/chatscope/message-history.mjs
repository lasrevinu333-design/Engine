// Retained message pages and change-feed observations for one admitted thread.
// React owns the actor/thread generation. This object is discarded on a switch.
function instant(value) {
  const text = String(value || ''), ms = Date.parse(text);
  if (!Number.isFinite(ms)) return 0n;
  const fraction = text.match(/\.(\d+)(?:Z|[+-]\d\d:?\d\d)$/)?.[1] || '';
  return BigInt(ms) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6) || '0');
}
function position(row) { return { time: instant(row?.sent_at || row?.created_at), id: String(row?.id || '') }; }
function comparePosition(a, b) {
  const x = position(a), y = position(b);
  return x.time < y.time ? -1 : x.time > y.time ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}
const cursorOf = row => row ? { before: row.sent_at || row.created_at, before_id: row.id } : null;
export function createMessageHistory(limit = 200) {
  const observed = new Map(), visible = new Set();
  let initialized = false, oldest = null, recentFloor = null, hasOlder = false;
  function observe(row) {
    if (!row?.id) return;
    const old = observed.get(row.id);
    const nextVersion = instant(row.updated_at || row.sent_at || row.created_at);
    const oldVersion = instant(old?.updated_at || old?.sent_at || old?.created_at);
    if (!old || nextVersion > oldVersion || (nextVersion === oldVersion && row.is_deleted === true)) observed.set(row.id, row);
  }
  function rows() { return [...visible].map(id => observed.get(id)).filter(row => row && row.is_deleted !== true).sort(comparePosition); }
  function latest(page) {
    const sorted = [...page].sort(comparePosition);
    for (const row of sorted) { observe(row); visible.add(row.id); }
    if (!initialized) {
      initialized = true; oldest = sorted[0] || null; recentFloor = oldest;
      hasOlder = sorted.length >= limit;
    }
    return rows();
  }
  function updates(changes) {
    for (const row of changes) {
      observe(row);
      // Historical changes must not create a gap between pages. Keep their
      // versions for a page already in flight, including deletion tombstones.
      if (initialized && (!recentFloor || comparePosition(row, recentFloor) >= 0)) visible.add(row.id);
    }
    return rows();
  }
  function older(page, expectedCursor) {
    const cursor = cursorOf(oldest);
    if (!cursor || !expectedCursor || cursor.before !== expectedCursor.before || cursor.before_id !== expectedCursor.before_id) return rows();
    const sorted = [...page].sort(comparePosition);
    for (const row of sorted) { observe(row); visible.add(row.id); }
    const next = sorted[0];
    hasOlder = sorted.length >= limit && Boolean(next) && comparePosition(next, oldest) < 0;
    if (next && comparePosition(next, oldest) < 0) oldest = next;
    return rows();
  }
  return { latest, older, updates, rows, cursor: () => cursorOf(oldest), hasOlder: () => hasOlder };
}
