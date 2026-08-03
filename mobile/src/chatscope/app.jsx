import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  Sidebar,
  Search,
  ConversationList,
  Conversation,
  Avatar,
  ChatContainer,
  ConversationHeader,
  MessageList,
  Message,
  MessageInput,
  Loader,
} from '@chatscope/chat-ui-kit-react';
import './theme.css';
import './avatar.css';

const API = 'https://memphis-zoo-mcp.onrender.com/messaging-api';
const MEMPHIS_AVATAR = './memphis_avatar_ui.webp';
const ZOO_LOGO = './Zoo_Logo_ui.webp';
const ZERO_TIME = '1970-01-01T00:00:00.000Z';
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const RETIRED_KEY = 'ops_manager_shared_chat_v1';
const RETIRED_TITLE = /operations leadership(?: chat)?(?: \(retired\))?|ops manager chat/i;
const ANNIE_RETURN_URL = 'https://memphis-zoo-mcp.onrender.com/moxie/';
const ANNIE_ORIGIN_SESSION_KEY = 'mz_annie_origin_session';
const PAGE_URL = new URL(window.location.href);
const EMPLOYEE_CONTEXT = String(PAGE_URL.searchParams.get('hub') || '').trim().toLowerCase() === 'employee';

function isNativeCustodialAuthority() {
  return window.MemphisCustodialSecurity?.native === true
    || window.MemphisMobile?.edition === 'custodial'
    || window.MemphisMobileBuildIdentity?.edition === 'custodial';
}

function employeeDeviceId() {
  if (isNativeCustodialAuthority()) {
    const status = window.MemphisCustodialSecurity?.getStatus?.();
    return status?.ready === true && status?.available === true ? String(status.deviceId || '').trim() : '';
  }
  return String(
    PAGE_URL.searchParams.get('device')
    || PAGE_URL.searchParams.get('deviceId')
    || window.MemphisAuth?.getDeviceId?.()
    || localStorage.getItem('mz_scan_device_id')
    || localStorage.getItem('mz_employee_hub_device_id')
    || localStorage.getItem('memphisAssignedDeviceId')
    || '',
  ).trim();
}

async function waitForEmployeeDeviceAuthority() {
  if (!isNativeCustodialAuthority()) return employeeDeviceId();
  const pending = window.MemphisMobile?.ready || window.MemphisCustodialSecurity?.ready;
  if (pending && typeof pending.then === 'function') await pending;
  if (typeof window.MemphisMobile?.authoritativeDeviceId === 'function') {
    return window.MemphisMobile.authoritativeDeviceId();
  }
  return employeeDeviceId();
}

// Employee Messenger authenticates with the assigned device credential. The
// manager application supplies its own named bearer-session implementation.
if (EMPLOYEE_CONTEXT && !window.MemphisMobile) {
  window.MemphisMobile = {
    ready: Promise.resolve(),
    deviceId: employeeDeviceId,
    authoritativeDeviceId: async () => employeeDeviceId(),
    employeeDeviceAuthority: true,
  };
}

function isAnnieOrigin(url = new URL(window.location.href)) {
  const marker = String(url.searchParams.get('origin') || '').trim().toLowerCase() === 'annie';
  const fromAnnie = String(document.referrer || '').startsWith(ANNIE_RETURN_URL);
  if (marker || fromAnnie) {
    try { sessionStorage.setItem(ANNIE_ORIGIN_SESSION_KEY, '1'); } catch {}
    return true;
  }
  try { return sessionStorage.getItem(ANNIE_ORIGIN_SESSION_KEY) === '1'; } catch { return false; }
}

function resolveBackUrl() {
  if (isAnnieOrigin()) return ANNIE_RETURN_URL;
  const nativeApp = document.documentElement.classList.contains('mz-native-app');
  const target = new URL(EMPLOYEE_CONTEXT ? './employee-hub.html' : (nativeApp ? './index.html' : './start_page1.html'), window.location.href);
  if (EMPLOYEE_CONTEXT) {
    target.searchParams.set('hub', 'employee');
    const device = employeeDeviceId();
    if (device) target.searchParams.set('device', device);
  }
  return target.toString();
}

async function navigateBack() {
  await waitForEmployeeDeviceAuthority();
  window.location.href = resolveBackUrl();
}

window.MemphisMessengerRoute = {
  isAnnieOrigin,
  resolveBackUrl,
  navigateBack,
  ANNIE_RETURN_URL,
  ANNIE_ORIGIN_SESSION_KEY,
  employeeContext: EMPLOYEE_CONTEXT,
  employeeDeviceId,
  ready: waitForEmployeeDeviceAuthority,
};
isAnnieOrigin();

function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }
function roleTitle(user = {}) {
  const explicit = String(user.role_title || user.job_title || '').trim();
  if (explicit) return explicit;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'manager' ? 'Operations Leadership' : (role === 'bot' ? 'Memphis' : 'Employee');
}
function isMemphisRow(row = {}) {
  return String(row.thread_type || row.type || '').toLowerCase() === 'bot'
    || /^memphis(?: ai)?$/i.test(String(row.thread_title || row.title || '').trim());
}
function isRetiredThread(row = {}) {
  return row.system_key === RETIRED_KEY
    || row.is_ops_manager_shared === true
    || RETIRED_TITLE.test(String(row.thread_title || row.title || ''));
}
function normalizedThread(row = {}) {
  const memphis = isMemphisRow(row);
  return {
    ...row,
    id: String(row.id || row.thread_id || ''),
    title: memphis ? 'Memphis AI' : String(row.thread_title || row.title || 'Conversation'),
    type: String(row.thread_type || 'direct').toLowerCase(),
    participantNames: String(row.participant_names || ''),
    canSend: row.viewer_can_send !== false,
    shared: row.is_ops_manager_shared === true || row.system_key === 'ops_manager_shared_chat_v1',
    unread: Number(row.unread_count || 0),
  };
}
function isMemphis(thread) { return isMemphisRow(thread); }
function compareThreads(left, right) {
  const pin = Number(isMemphis(right)) - Number(isMemphis(left));
  if (pin) return pin;
  const unread = Number(right.unread || right.unread_count || 0) - Number(left.unread || left.unread_count || 0);
  if (unread) return unread;
  return Date.parse(right.last_message_at || right.updated_at || 0) - Date.parse(left.last_message_at || left.updated_at || 0);
}
function initials(value) {
  return String(value || 'M').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'M';
}
function MessengerAvatarVisual({ name, src = '' }) {
  const safeName = String(name || 'User').trim() || 'User';
  const safeSrc = typeof src === 'string' ? src.trim() : '';
  const [imageState, setImageState] = useState(safeSrc ? 'loading' : 'fallback');

  useEffect(() => {
    setImageState(safeSrc ? 'loading' : 'fallback');
  }, [safeSrc]);

  return <span className="mz-avatar-visual" data-avatar-state={imageState}>
    <span className="mz-avatar-initials" aria-hidden="true">{initials(safeName)}</span>
    {safeSrc && imageState !== 'failed' && <img
      className="mz-avatar-image"
      src={safeSrc}
      alt=""
      onLoad={() => setImageState('loaded')}
      onError={() => setImageState('failed')}
    />}
  </span>;
}

// ChatScope accepts only a direct Avatar element in conversations and headers.
// This helper keeps that component identity while centralizing safe rendering.
function messengerAvatar(name, src = '') {
  const safeName = String(name || 'User').trim() || 'User';
  return <Avatar
    className="mz-avatar"
    role="img"
    aria-label={`${safeName} avatar`}
  >
    <MessengerAvatarVisual name={safeName} src={src} />
  </Avatar>;
}
function formatTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function clientMessageId() { return `msg:${crypto.randomUUID()}`; }
function operationId(prefix = 'op') { return `${prefix}:${crypto.randomUUID()}`; }
function outboxKey(id) { return `mz_chatscope_outbox:${id}`; }
async function custodialSecurityPaused() {
  const security = window.MemphisCustodialSecurity;
  if (!security) return false;
  try {
    if (typeof security.waitForStableState === 'function') await security.waitForStableState({ requireEnrollment: true });
    const status = typeof security.getStatus === 'function' ? security.getStatus() : null;
    return status?.ready !== true || status?.quarantined === true || status?.available === false;
  } catch { return true; }
}
function securityPauseError(error) {
  return ['custodial_restore_quarantine', 'custodial_secure_storage_unavailable', 'custodial_security_state_unavailable', 'custodial_security_generation_changed', 'custodial_device_not_enrolled', 'custodial_enrollment_confirmation_pending', 'custodial_enrollment_removal_pending'].includes(String(error?.code || ''));
}
async function mutateCustodialWork(operation, options = { requireEnrollment: true }) {
  const security = window.MemphisCustodialSecurity;
  if (security?.native === true) return security.mutateProtectedWork(operation, options);
  return operation();
}
async function retainOutboxFailure(entry, error) {
  if (securityPauseError(error)) return;
  await mutateCustodialWork(() => localStorage.setItem(outboxKey(entry.id), JSON.stringify({
    ...entry,
    retry_count: Number(entry.retry_count || 0) + 1,
    last_attempt_at: Date.now(),
    last_error: safe(error).slice(0, 500),
  })));
}

async function resolveAuthHeaders() {
  if (EMPLOYEE_CONTEXT && !window.MemphisCustodialSecurity?.native) return { 'X-Device-Id': employeeDeviceId() };
  const session = await window.MemphisAuth?.requireOpsManagerSession?.({
    accessLevel: 'full_access', interactive: true, redirect: false, throwOnFailure: true,
  });
  if (!session?.token) throw new Error('Named Operations Leadership access is required.');
  return { Authorization: `Bearer ${session.token}`, 'X-Device-Id': session.device_id || window.MemphisAuth?.getDeviceId?.() || '' };
}
function deviceId() {
  if (EMPLOYEE_CONTEXT || isNativeCustodialAuthority()) return employeeDeviceId();
  return window.MemphisAuth?.getDeviceId?.()
    || localStorage.getItem('mz_scan_device_id')
    || localStorage.getItem('memphisAssignedDeviceId')
    || '';
}
async function api(path, { method = 'GET', body, signal } = {}) {
  if (window.MemphisMobile?.requestEnvelope) {
    return window.MemphisMobile.requestEnvelope(`/messaging-api${path}`, { method, body, signal });
  }
  const auth = await resolveAuthHeaders();
  const response = await fetch(`${API}${path}`, {
    method,
    cache: 'no-store',
    signal,
    headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}

function NewConversation({ currentUserId, currentDeviceId, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Loading people…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/users?user_id=${encodeURIComponent(currentUserId)}&device_id=${encodeURIComponent(currentDeviceId)}`)
      .then((envelope) => {
        if (!active) return;
        const rows = (envelope.data || []).filter((user) => user.is_active !== false && user.role !== 'bot' && String(user.id) !== currentUserId);
        setUsers(rows);
        setStatus('');
      })
      .catch((error) => active && setStatus(safe(error)));
    return () => { active = false; };
  }, [currentUserId, currentDeviceId]);

  function toggle(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  async function create() {
    const memberIds = [...selected];
    if (!memberIds.length) return setStatus('Select at least one person.');
    setBusy(true);
    setStatus('Creating conversation…');
    try {
      let thread;
      if (memberIds.length === 1) {
        thread = (await api('/thread/direct', { method: 'POST', body: {
          created_by_user_id: currentUserId,
          other_user_id: memberIds[0],
          device_id: currentDeviceId,
        } })).data;
      } else {
        thread = (await api('/thread/group', { method: 'POST', body: {
          created_by_user_id: currentUserId,
          member_user_ids: memberIds,
          title: title.trim() || null,
          device_id: currentDeviceId,
          client_thread_id: operationId('thread'),
        } })).data;
      }
      const id = String(thread?.id || thread?.thread_id || '');
      if (!id) throw new Error('The server did not return a conversation.');
      onCreated(id);
    } catch (error) {
      setStatus(safe(error));
      setBusy(false);
    }
  }

  return <div className="mz-chat-new-overlay" role="dialog" aria-modal="true" aria-label="Start conversation">
    <section className="mz-chat-new-card">
      <header className="mz-chat-new-head">
        <h2>Start Conversation</h2>
        <p>Choose one person for a direct message or several people for a Memphis Zoo group.</p>
        {selected.size > 1 && <input className="mz-chat-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Group name (optional)" />}
      </header>
      <div className="mz-chat-new-list">
        {users.map((user) => <label className="mz-chat-user" key={user.id}>
          <input type="checkbox" checked={selected.has(String(user.id))} onChange={() => toggle(String(user.id))} />
          {messengerAvatar(user.display_name || 'User')}
          <div className="mz-chat-user-copy"><strong>{user.display_name}</strong><span>{roleTitle(user)}</span></div>
        </label>)}
        {!users.length && !status && <div className="mz-chat-empty">No available recipients.</div>}
      </div>
      {status && <div className={`mz-chat-status ${status.includes('Loading') || status.includes('Creating') ? '' : 'error'}`}>{status}</div>}
      <footer className="mz-chat-new-actions">
        <button className="mz-button" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="mz-button primary" type="button" onClick={create} disabled={busy || !selected.size}>Create</button>
      </footer>
    </section>
  </div>;
}

function MessengerApp() {
  const [identity, setIdentity] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Resolving named manager identity…');
  const [statusKind, setStatusKind] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newConversation, setNewConversation] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadsRef = useRef([]);
  const bootstrapStarted = useRef(false);
  const outboxRetryInFlight = useRef(null);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });
  const messageCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });
  const messageLoadSequence = useRef(0);
  const mounted = useRef(true);

  const [deviceIdentity, setDeviceIdentity] = useState(() => {
    const nativeAuthority = isNativeCustodialAuthority();
    return { ready: !nativeAuthority, deviceId: nativeAuthority ? '' : deviceId() };
  });
  const currentDeviceId = deviceIdentity.deviceId;
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId]);
  const visibleThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => `${thread.title} ${thread.participantNames} ${thread.last_message_body || ''}`.toLowerCase().includes(needle));
  }, [threads, search]);

  const setNotice = useCallback((text, kind = '') => {
    setStatus(text || '');
    setStatusKind(kind);
    if (text && kind === 'ok') setTimeout(() => mounted.current && setStatus(''), 1600);
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      setDeviceIdentity({ ready: true, deviceId: deviceId() });
    };
    void waitForEmployeeDeviceAuthority().then(update).catch((error) => {
      if (!active) return;
      setDeviceIdentity({ ready: true, deviceId: '' });
      setNotice(safe(error), 'error');
    });
    window.addEventListener('memphis:mobile-ready', update);
    window.addEventListener('memphis:custodial-security-state', update);
    return () => {
      active = false;
      window.removeEventListener('memphis:mobile-ready', update);
      window.removeEventListener('memphis:custodial-security-state', update);
    };
  }, [setNotice]);

  const loadIdentity = useCallback(async () => {
    const identityPath = EMPLOYEE_CONTEXT && currentDeviceId
      ? `/me/by-device?device_id=${encodeURIComponent(currentDeviceId)}`
      : '/me/by-device';
    const envelope = await api(identityPath);
    const mapped = envelope.data;
    if (!mapped?.msg_user_id) throw new Error('Messenger identity could not be resolved for this leadership account.');
    identityRef.current = mapped;
    setIdentity(mapped);
    if (window.MemphisCustodialSecurity?.native !== true) localStorage.setItem('mz_messenger_user_id', String(mapped.msg_user_id));
    return mapped;
  }, [currentDeviceId]);

  const loadThreads = useCallback(async ({ preferId = '' } = {}) => {
    const mapped = identityRef.current || await loadIdentity();
    const userId = String(mapped.msg_user_id);
    const envelope = await api(`/threads?user_id=${encodeURIComponent(userId)}&device_id=${encodeURIComponent(currentDeviceId)}`);
    const rows = (envelope.data || [])
      .filter((row) => !isRetiredThread(row))
      .map(normalizedThread)
      .sort(compareThreads);
    if (!mounted.current) return rows;
    threadsRef.current = rows;
    setThreads(rows);
    const desired = preferId || selectedRef.current || new URL(location.href).searchParams.get('thread_id') || '';
    const next = rows.find((thread) => thread.id === desired)
      || rows[0]
      || null;
    if (next && next.id !== selectedRef.current) {
      selectedRef.current = next.id;
      setSelectedId(next.id);
    } else if (!next && selectedRef.current) {
      selectedRef.current = '';
      setSelectedId('');
      setMessages([]);
      setMobileThread(false);
    }
    setNotice('');
    return rows;
  }, [currentDeviceId, loadIdentity, setNotice]);

  const markRead = useCallback(async (thread) => {
    const mapped = identityRef.current;
    if (!thread?.id || !mapped?.msg_user_id || thread.canSend === false) return;
    await api(`/thread/${encodeURIComponent(thread.id)}/read`, { method: 'POST', body: {
      user_id: mapped.msg_user_id,
      device_id: currentDeviceId,
    } });
  }, [currentDeviceId]);

  const loadMessages = useCallback(async (threadId = selectedRef.current) => {
    const mapped = identityRef.current || await loadIdentity();
    if (!threadId) return [];
    const requestSequence = ++messageLoadSequence.current;
    setLoadingMessages(true);
    try {
      const envelope = await api(`/thread/${encodeURIComponent(threadId)}/messages?user_id=${encodeURIComponent(mapped.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&limit=200`);
      const rows = (envelope.data || []).filter((row) => row.is_deleted !== true);
      if (!mounted.current || selectedRef.current !== threadId || requestSequence !== messageLoadSequence.current) return rows;
      setMessages(rows);
      const thread = threadsRef.current.find((item) => item.id === threadId);
      void markRead(thread).catch(() => {});
      return rows;
    } finally {
      if (mounted.current && requestSequence === messageLoadSequence.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead]);

  const selectThread = useCallback((id) => {
    selectedRef.current = id;
    messageLoadSequence.current += 1;
    messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };
    setMessages([]);
    setLoadingMessages(true);
    setSelectedId(id);
    setMobileThread(true);
    const url = new URL(location.href);
    url.searchParams.set('thread_id', id);
    history.replaceState(null, '', url);
  }, []);

  const openMemphis = useCallback(async () => {
    try {
      const existing = threadsRef.current.find(isMemphis);
      if (existing) return selectThread(existing.id);
      const mapped = identityRef.current || await loadIdentity();
      const envelope = await api('/memphis/thread', { method: 'POST', body: { user_id: mapped.msg_user_id, device_id: currentDeviceId } });
      const id = String(envelope.data?.id || envelope.data?.thread_id || '');
      await loadThreads({ preferId: id });
      selectThread(id);
    } catch (error) { setNotice(safe(error), 'error'); }
  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice]);

  const sendMessage = useCallback(async (...args) => {
    const body = args.map((value) => typeof value === 'string' ? value : '').find((value) => value.replace(/<[^>]*>/g, '').trim())?.replace(/<[^>]*>/g, '').trim() || '';
    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);
    const mapped = identityRef.current;
    if (!body || !thread?.id || !mapped?.msg_user_id || thread.canSend === false) return;
    if (await custodialSecurityPaused()) {
      setNotice('Protected phone recovery must finish before messages can be sent.', 'error');
      return;
    }
    const id = clientMessageId();
    const optimistic = {
      id,
      sender_user_id: mapped.msg_user_id,
      sender_display_name: mapped.display_name,
      body,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((rows) => [...rows, optimistic]);
    const entry = { id, thread_id: thread.id, user_id: mapped.msg_user_id, device_id: currentDeviceId, body, memphis: isMemphis(thread), created_at: Date.now() };
    const writeContext = await mutateCustodialWork((context) => {
      localStorage.setItem(outboxKey(id), JSON.stringify(entry));
      return context;
    });
    try {
      if (entry.memphis) {
        await api('/memphis/message', { method: 'POST', body: {
          user_id: entry.user_id,
          body,
          device_id: entry.device_id,
          thread_id: entry.thread_id,
          client_message_id: id,
        } });
      } else {
        await api(`/thread/${encodeURIComponent(thread.id)}/message`, { method: 'POST', body: {
          sender_user_id: entry.user_id,
          body,
          device_id: entry.device_id,
          client_message_id: id,
        } });
      }
      await mutateCustodialWork(
        () => localStorage.removeItem(outboxKey(id)),
        { requireEnrollment: true, expectedGeneration: writeContext?.generation ?? null },
      );
      await Promise.all([loadMessages(thread.id), loadThreads({ preferId: thread.id })]);
      setNotice('Sent.', 'ok');
    } catch (error) {
      await retainOutboxFailure(entry, error).catch(() => {});
      setMessages((rows) => rows.map((row) => row.id === id ? { ...row, failed: true, optimistic: false } : row));
      setNotice(`Message queued for retry: ${safe(error)}`, 'error');
    }
  }, [currentDeviceId, loadMessages, loadThreads, setNotice]);

  const retryOutbox = useCallback(() => {
    if (outboxRetryInFlight.current) return outboxRetryInFlight.current;
    const retry = (async () => {
      if (await custodialSecurityPaused()) return;
      const entries = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('mz_chatscope_outbox:')) continue;
        try { entries.push(JSON.parse(localStorage.getItem(key))); } catch {}
      }
      if (!entries.length) return;
      for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {
        try {
          if (entry.memphis) {
            await api('/memphis/message', { method: 'POST', body: {
              user_id: entry.user_id, body: entry.body, device_id: entry.device_id,
              thread_id: entry.thread_id, client_message_id: entry.id,
            } });
          } else {
            await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, { method: 'POST', body: {
              sender_user_id: entry.user_id, body: entry.body, device_id: entry.device_id, client_message_id: entry.id,
            } });
          }
          await mutateCustodialWork(() => localStorage.removeItem(outboxKey(entry.id)));
        } catch (error) {
          await retainOutboxFailure(entry, error).catch(() => {});
        }
      }
      if (selectedRef.current) await loadMessages(selectedRef.current);
      await loadThreads({ preferId: selectedRef.current });
    })();
    const tracked = retry.finally(() => {
      if (outboxRetryInFlight.current === tracked) outboxRetryInFlight.current = null;
    });
    outboxRetryInFlight.current = tracked;
    return tracked;
  }, [loadMessages, loadThreads]);

  const deleteThread = useCallback(async () => {
    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);
    if (!thread || thread.shared) return;
    const prompt = isMemphis(thread)
      ? 'Delete this Memphis conversation from your Messenger? Your next Memphis message will start a clean conversation.'
      : `Delete “${thread.title}” from your Messenger? Other participants keep their copy.`;
    if (!confirm(prompt)) return;
    try {
      await api(`/thread/${encodeURIComponent(thread.id)}/delete`, { method: 'POST', body: {
        device_id: currentDeviceId,
        operation_id: operationId('delete-thread'),
      } });
      selectedRef.current = '';
      setSelectedId('');
      setMessages([]);
      setMobileThread(false);
      await loadThreads();
      setNotice('Conversation removed from your Messenger.', 'ok');
    } catch (error) { setNotice(safe(error), 'error'); }
  }, [currentDeviceId, loadThreads, setNotice]);

  useEffect(() => {
    if (!deviceIdentity.ready) return undefined;
    if (isNativeCustodialAuthority() && !currentDeviceId) {
      setNotice('Protected phone identity is not ready. Return to the Custodial app and finish recovery.', 'error');
      return undefined;
    }
    if (bootstrapStarted.current) return undefined;
    bootstrapStarted.current = true;
    mounted.current = true;
    (async () => {
      try {
        await loadIdentity();
        await loadThreads();
        await retryOutbox();
      } catch (error) { setNotice(safe(error), 'error'); }
    })();
    const online = () => void retryOutbox();
    const resumeMessenger = () => {
      if (document.visibilityState !== 'visible') return;
      void retryOutbox();
      void loadThreads({ preferId: selectedRef.current }).catch((error) => setNotice(safe(error), 'error'));
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', resumeMessenger);
    window.addEventListener('pageshow', resumeMessenger);
    window.addEventListener('memphis:messenger-resume', resumeMessenger);
    return () => {
      mounted.current = false;
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', resumeMessenger);
      window.removeEventListener('pageshow', resumeMessenger);
      window.removeEventListener('memphis:messenger-resume', resumeMessenger);
    };
  }, [currentDeviceId, deviceIdentity.ready, loadIdentity, loadThreads, retryOutbox, setNotice]);

  useEffect(() => {
    if (!selectedId) return;
    selectedRef.current = selectedId;
    void loadMessages(selectedId).catch((error) => setNotice(safe(error), 'error'));
  }, [selectedId, loadMessages, setNotice]);

  useEffect(() => {
    if (!identity?.msg_user_id) return undefined;
    let stopped = false;
    let controller = null;
    const loop = async () => {
      while (!stopped) {
        controller = new AbortController();
        const cursor = threadCursor.current;
        try {
          const envelope = await api(`/threads/updates?user_id=${encodeURIComponent(identity.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&after=${encodeURIComponent(cursor.after)}&after_id=${encodeURIComponent(cursor.id)}&wait_ms=20000&limit=100`, { signal: controller.signal });
          const next = envelope.meta?.next_cursor;
          if (next?.after && next?.after_id) threadCursor.current = { after: next.after, id: next.after_id };
          if (envelope.data?.length) await loadThreads({ preferId: selectedRef.current });
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          if (securityPauseError(error)) break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    };
    void loop();
    return () => { stopped = true; controller?.abort(); };
  }, [currentDeviceId, identity, loadThreads]);

  useEffect(() => {
    if (!identity?.msg_user_id || !selectedId) return undefined;
    let stopped = false;
    let controller = null;
    messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };
    const loop = async () => {
      while (!stopped && selectedRef.current === selectedId) {
        controller = new AbortController();
        const cursor = messageCursor.current;
        try {
          const envelope = await api(`/thread/${encodeURIComponent(selectedId)}/updates?user_id=${encodeURIComponent(identity.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&after=${encodeURIComponent(cursor.after)}&after_id=${encodeURIComponent(cursor.id)}&wait_ms=20000&limit=100`, { signal: controller.signal });
          const next = envelope.meta?.next_cursor;
          if (next?.after && next?.after_id) messageCursor.current = { after: next.after, id: next.after_id };
          if (envelope.data?.length) await loadMessages(selectedId);
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          if (securityPauseError(error)) break;
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    };
    void loop();
    return () => { stopped = true; controller?.abort(); };
  }, [currentDeviceId, identity, loadMessages, selectedId]);

  const renderedMessages = messages.map((row, index) => {
    const mine = String(row.sender_user_id) === String(identity?.msg_user_id);
    return <Message key={row.id || `${row.sent_at}-${index}`} model={{
      message: row.failed ? `${row.body}  [queued]` : String(row.body || ''),
      sentTime: formatTime(row.sent_at),
      sender: row.sender_display_name || 'Unknown',
      direction: mine ? 'outgoing' : 'incoming',
      position: 'single',
    }}><Message.Header sender={row.sender_display_name || 'Unknown'} sentTime={formatTime(row.sent_at)} /></Message>;
  });

  const appClass = `mz-chat-shell${mobileThread ? ' mobile-thread' : ''}`;
  return <div className={appClass}>
    <header className="mz-chat-toolbar">
      <button className="mz-button" type="button" aria-label={mobileThread ? 'Back to conversations' : 'Back'} title={mobileThread ? 'Back to conversations' : (EMPLOYEE_CONTEXT ? 'Back to assigned areas' : 'Back to Operations home')} data-mz-global-back={!mobileThread || undefined} onClick={() => { if (mobileThread) setMobileThread(false); else void navigateBack(); }}>{mobileThread ? 'Chats' : 'Back'}</button>
      <div className="mz-chat-brand"><img src={ZOO_LOGO} alt="Memphis Zoo" /><div className="mz-chat-brand-text"><strong>Memphis Messenger</strong><span>{identity?.display_name ? `${identity.display_name} · ${roleTitle(identity)}` : 'Secure Zoo messaging'}</span></div></div>
      <button className="mz-button" type="button" onClick={openMemphis}>Memphis</button>
      <button className="mz-button primary" type="button" onClick={() => setNewConversation(true)}>New</button>
    </header>
    <section className="mz-chat-stage">
      <MainContainer>
        <Sidebar position="left" scrollable>
          <Search placeholder="Search conversations" value={search} onChange={setSearch} />
          <ConversationList loading={false}>
            {visibleThreads.map((thread) => <Conversation
              key={thread.id}
              name={thread.title}
              info={thread.last_message_body || 'No messages yet'}
              lastSenderName={thread.last_sender_name || ''}
              lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
              unreadCnt={thread.unread || undefined}
              active={thread.id === selectedId}
              onClick={() => selectThread(thread.id)}
            >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>)}
          </ConversationList>
        </Sidebar>
        {selectedThread ? <ChatContainer>
          <ConversationHeader>
            <ConversationHeader.Back onClick={() => setMobileThread(false)} />
            {messengerAvatar(selectedThread.title, isMemphis(selectedThread) ? MEMPHIS_AVATAR : '')}
            <ConversationHeader.Content userName={selectedThread.title} info={selectedThread.shared ? 'Operations Leadership Chat' : selectedThread.participantNames || selectedThread.type} />
            <ConversationHeader.Actions><div className="mz-chat-thread-actions"><button className="mz-button mz-chat-mobile-back" type="button" onClick={() => setMobileThread(false)}>Chats</button>{!selectedThread.shared && <button className="mz-button danger" type="button" onClick={deleteThread}>Delete</button>}</div></ConversationHeader.Actions>
          </ConversationHeader>
          <MessageList loading={loadingMessages} loadingMore={false}>
            {loadingMessages && !messages.length ? <Loader /> : renderedMessages}
            {!loadingMessages && !messages.length && <Message model={{ message: 'No messages yet.', direction: 'incoming', position: 'single' }} />}
          </MessageList>
          <MessageInput placeholder={selectedThread.canSend ? 'Type a message' : 'Read-only conversation'} attachButton={false} disabled={!selectedThread.canSend} onSend={sendMessage} />
        </ChatContainer> : <div className="mz-chat-empty"><div><strong>Choose a conversation</strong>Select a thread or start a new Memphis Zoo message.</div></div>}
      </MainContainer>
    </section>
    {status && <div className={`mz-chat-status ${statusKind}`}>{status}</div>}
    {newConversation && identity?.msg_user_id && <NewConversation currentUserId={String(identity.msg_user_id)} currentDeviceId={currentDeviceId} onClose={() => setNewConversation(false)} onCreated={async (id) => { setNewConversation(false); await loadThreads({ preferId: id }); selectThread(id); }} />}
  </div>;
}

createRoot(document.getElementById('chatscope-root')).render(<MessengerApp />);
