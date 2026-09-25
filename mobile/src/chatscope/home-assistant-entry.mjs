// A Home tap is an explicit request for the authenticated employee's assistant.
// Ordinary Messenger navigation never creates/restores an assistant thread.
// Network failures retain the intent for existing online/resume events, not a
// polling loop. Leaving/selecting another conversation cancels late responses.
export function createHomeAssistantEntry(enabled) {
  let pending = enabled === true;
  let generation = 0;
  let inFlight = null;
  const cancel = () => { pending = false; generation += 1; };
  function run({ resolveIdentity, deviceId, isCurrent, hasPendingDeletion, request, readThreads, select }) {
    if (!pending) return Promise.resolve(false);
    if (inFlight) return inFlight;
    const ticket = generation;
    const task = (async () => {
      const identity = await resolveIdentity();
      const current = () => {
        if (!pending || generation !== ticket) return false;
        if (!isCurrent(identity)) { cancel(); return false; }
        return true;
      };
      if (!current()) return false;
      const userId = String(identity?.msg_user_id || '').trim();
      if (!userId || !deviceId) throw new Error('Messenger could not open for this employee.');
      // Never race an offline deletion with the explicit get-or-create route.
      if (hasPendingDeletion(identity)) throw new Error('Could not open Memphis while a saved conversation deletion is waiting to finish.');
      const envelope = await request('/memphis/thread', { method: 'POST', body: { user_id: userId, device_id: deviceId } });
      if (!current()) return false;
      const thread = envelope?.data;
      const id = String(thread?.id || '');
      if (!envelope?.ok || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
        || thread?.thread_type !== 'bot' || thread?.is_active === false) {
        throw new Error('Could not verify your Memphis conversation.');
      }
      const rows = await readThreads();
      if (!current()) return false;
      const verified = rows.find((row) => row.id === id && row.type === 'bot' && row.is_active !== false);
      if (!verified) throw new Error('Could not load your Memphis conversation. Try again from Home.');
      pending = false;
      select(id);
      return true;
    })();
    const tracked = task.finally(() => { if (inFlight === tracked) inFlight = null; });
    inFlight = tracked;
    return tracked;
  }
  return { run, cancel };
}
