from pathlib import Path
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


app_path = Path('mobile/src/chatscope/app.jsx')
app = app_path.read_text()
app = replace_once(
    app,
    "function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }\n",
    "function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }\nfunction employeeSafeError(error, { sending = false } = {}) {\n  if (!EMPLOYEE_CONTEXT) return safe(error);\n  if (securityPauseError(error)) return 'This phone needs a manager.';\n  if (sending || navigator.onLine === false) return 'No connection. Your message is saved.';\n  return 'Could not update messages. Try again.';\n}\n",
    'employee-safe Messenger errors',
)

new_start = app.index('function NewConversation(')
new_end = app.index('\nfunction MessengerApp()', new_start)
new_conversation = r'''function NewConversation({ currentUserId, currentDeviceId, onClose, onCreated }) {
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
      .catch((error) => active && setStatus(employeeSafeError(error)));
    return () => { active = false; };
  }, [currentUserId, currentDeviceId]);

  async function openDirectRecipient(user) {
    if (busy) return;
    setBusy(true);
    setStatus(`Opening ${user.display_name || 'messages'}…`);
    try {
      const thread = (await api('/thread/direct', { method: 'POST', body: {
        created_by_user_id: currentUserId,
        other_user_id: String(user.id),
        device_id: currentDeviceId,
      } })).data;
      const id = String(thread?.id || thread?.thread_id || '');
      if (!id) throw new Error('conversation_unavailable');
      onCreated(id);
    } catch (error) {
      setStatus(employeeSafeError(error));
      setBusy(false);
    }
  }

  function toggle(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createManagerConversation() {
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

  if (EMPLOYEE_CONTEXT) {
    return <div className="mz-chat-new-overlay" role="dialog" aria-modal="true" aria-label="New message">
      <section className="mz-chat-new-card employee-picker">
        <header className="mz-chat-new-head">
          <h2>New Message</h2>
          <p>Tap a person to open their messages.</p>
        </header>
        <div className="mz-chat-new-list">
          {users.map((user) => <button
            className="mz-chat-user mz-chat-user-button"
            type="button"
            key={user.id}
            disabled={busy}
            onClick={() => openDirectRecipient(user)}
          >
            {messengerAvatar(user.display_name || 'User')}
            <span className="mz-chat-user-copy"><strong>{user.display_name}</strong></span>
          </button>)}
          {!users.length && !status && <div className="mz-chat-empty">No people are available.</div>}
        </div>
        {status && <div className={`mz-chat-status ${status.includes('Loading') || status.includes('Opening') ? '' : 'error'}`}>{status}</div>}
        <footer className="mz-chat-new-actions">
          <button className="mz-button" type="button" onClick={onClose} disabled={busy}>Back</button>
        </footer>
      </section>
    </div>;
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
        <button className="mz-button primary" type="button" onClick={createManagerConversation} disabled={busy || !selected.size}>Create</button>
      </footer>
    </section>
  </div>;
}

function EmployeeConversationRow({ thread, active, onOpen, onDelete }) {
  const [revealed, setRevealed] = useState(false);
  const touchStartX = useRef(null);
  const finishTouch = (event) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const delta = end - start;
    if (delta <= -42) setRevealed(true);
    else if (delta >= 42) setRevealed(false);
  };
  return <div className={`mz-chat-swipe-row${revealed ? ' revealed' : ''}`}>
    <button
      className="mz-chat-row-delete"
      type="button"
      aria-label={`Delete conversation with ${thread.title}`}
      onClick={(event) => {
        event.stopPropagation();
        setRevealed(false);
        onDelete(thread.id);
      }}
    >Delete</button>
    <div
      className="mz-chat-swipe-content"
      onTouchStart={(event) => { touchStartX.current = event.touches?.[0]?.clientX ?? null; }}
      onTouchEnd={finishTouch}
      onClick={() => {
        if (revealed) setRevealed(false);
        else onOpen(thread.id);
      }}
    >
      <Conversation
        name={thread.title}
        info={thread.last_message_body || 'No messages yet'}
        lastSenderName={thread.last_sender_name || ''}
        lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
        unreadCnt={thread.unread || undefined}
        active={active}
      >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>
    </div>
  </div>;
}
'''
app = app[:new_start] + new_conversation + app[new_end:]

app = replace_once(
    app,
    "  const [status, setStatus] = useState('Resolving named manager identity…');",
    "  const [status, setStatus] = useState(EMPLOYEE_CONTEXT ? 'Loading messages…' : 'Resolving named manager identity…');",
    'employee Messenger startup copy',
)
app = replace_once(
    app,
    "  const messageLoadSequence = useRef(0);\n  const mounted = useRef(true);",
    "  const messageLoadSequence = useRef(0);\n  const messageLoadController = useRef(null);\n  const mounted = useRef(true);",
    'message request abort controller',
)
app = replace_once(
    app,
    "      setNotice(safe(error), 'error');\n    });\n    window.addEventListener('memphis:mobile-ready', update);",
    "      setNotice(employeeSafeError(error), 'error');\n    });\n    window.addEventListener('memphis:mobile-ready', update);",
    'employee identity readiness error',
)
app = replace_once(
    app,
    "    if (!mapped?.msg_user_id) throw new Error('Messenger identity could not be resolved for this leadership account.');",
    "    if (!mapped?.msg_user_id) throw new Error(EMPLOYEE_CONTEXT ? 'employee_identity_unavailable' : 'Messenger identity could not be resolved for this leadership account.');",
    'employee identity error',
)

old_load_start = app.index('  const loadMessages = useCallback(async (threadId = selectedRef.current) => {')
old_load_end = app.index('\n\n  const selectThread = useCallback', old_load_start)
new_load = r'''  const loadMessages = useCallback(async (threadId = selectedRef.current) => {
    const mapped = identityRef.current || await loadIdentity();
    if (!threadId) return [];
    messageLoadController.current?.abort();
    const controller = new AbortController();
    messageLoadController.current = controller;
    const requestSequence = ++messageLoadSequence.current;
    setLoadingMessages(true);
    try {
      const envelope = await api(`/thread/${encodeURIComponent(threadId)}/messages?user_id=${encodeURIComponent(mapped.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&limit=200`, { signal: controller.signal });
      const rows = (envelope.data || []).filter((row) => row.is_deleted !== true);
      if (!mounted.current || controller.signal.aborted || selectedRef.current !== threadId || requestSequence !== messageLoadSequence.current) return rows;
      setMessages(rows);
      const thread = threadsRef.current.find((item) => item.id === threadId);
      void markRead(thread).catch(() => {});
      return rows;
    } catch (error) {
      if (controller.signal.aborted) return [];
      throw error;
    } finally {
      if (messageLoadController.current === controller) messageLoadController.current = null;
      if (mounted.current && !controller.signal.aborted && requestSequence === messageLoadSequence.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead]);
'''
app = app[:old_load_start] + new_load + app[old_load_end:]
app = replace_once(
    app,
    "    selectedRef.current = id;\n    messageLoadSequence.current += 1;",
    "    selectedRef.current = id;\n    messageLoadController.current?.abort();\n    messageLoadSequence.current += 1;",
    'abort prior thread on selection',
)
app = replace_once(
    app,
    "    } catch (error) { setNotice(safe(error), 'error'); }\n  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice]);",
    "    } catch (error) { setNotice(employeeSafeError(error), 'error'); }\n  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice]);",
    'employee Memphis open error',
)
app = replace_once(
    app,
    "      setNotice('Protected phone recovery must finish before messages can be sent.', 'error');",
    "      setNotice('This phone needs a manager.', 'error');",
    'employee protected-state copy',
)
app = replace_once(
    app,
    "      setNotice(`Message queued for retry: ${safe(error)}`, 'error');",
    "      setNotice(employeeSafeError(error, { sending: true }), 'error');",
    'employee offline-send copy',
)

old_delete_start = app.index('  const deleteThread = useCallback(async () => {')
old_delete_end = app.index('\n\n  useEffect(() => {', old_delete_start)
new_delete = r'''  const deleteThread = useCallback(async (threadId = selectedRef.current) => {
    const thread = threadsRef.current.find((item) => item.id === threadId);
    if (!thread || thread.shared) return;
    const previousThreads = threadsRef.current;
    const previousMessages = messages;
    const wasSelected = selectedRef.current === thread.id;
    const optimisticThreads = previousThreads.filter((item) => item.id !== thread.id);
    threadsRef.current = optimisticThreads;
    setThreads(optimisticThreads);
    if (wasSelected) {
      messageLoadController.current?.abort();
      selectedRef.current = '';
      setSelectedId('');
      setMessages([]);
      setMobileThread(false);
    }
    try {
      await api(`/thread/${encodeURIComponent(thread.id)}/delete`, { method: 'POST', body: {
        device_id: currentDeviceId,
        operation_id: operationId('delete-thread'),
      } });
      setNotice('Deleted.', 'ok');
      void loadThreads().catch(() => {});
    } catch (error) {
      threadsRef.current = previousThreads;
      setThreads(previousThreads);
      if (wasSelected) {
        selectedRef.current = thread.id;
        setSelectedId(thread.id);
        setMessages(previousMessages);
        setMobileThread(true);
      }
      setNotice(employeeSafeError(error), 'error');
    }
  }, [currentDeviceId, loadThreads, messages, setNotice]);
'''
app = app[:old_delete_start] + new_delete + app[old_delete_end:]

app = app.replace("setNotice(safe(error), 'error')", "setNotice(employeeSafeError(error), 'error')")
app = replace_once(
    app,
    "message: row.failed ? `${row.body}  [queued]` : String(row.body || ''),",
    "message: row.failed ? `${row.body}  · Saved` : String(row.body || ''),",
    'employee-safe queued message label',
)
app = replace_once(
    app,
    "  const appClass = `mz-chat-shell${mobileThread ? ' mobile-thread' : ''}`;",
    "  const appClass = `mz-chat-shell${mobileThread ? ' mobile-thread' : ''}${EMPLOYEE_CONTEXT ? ' employee-context' : ''}`;",
    'employee Messenger class',
)
app = replace_once(
    app,
    "      <button className=\"mz-button\" type=\"button\" aria-label={mobileThread ? 'Back to conversations' : 'Back'} title={mobileThread ? 'Back to conversations' : (EMPLOYEE_CONTEXT ? 'Back to assigned areas' : 'Back to Operations home')} data-mz-global-back={!mobileThread || undefined} onClick={() => { if (mobileThread) setMobileThread(false); else void navigateBack(); }}>{mobileThread ? 'Chats' : 'Back'}</button>",
    "      <button className=\"mz-button mz-chat-back\" type=\"button\" aria-label={mobileThread ? 'Back to conversations' : 'Back'} title={mobileThread ? 'Back to conversations' : (EMPLOYEE_CONTEXT ? 'Back to Home' : 'Back to Operations home')} data-mz-global-back={!mobileThread || undefined} onClick={() => { if (mobileThread) setMobileThread(false); else void navigateBack(); }}>{mobileThread ? 'Chats' : 'Back'}</button>",
    'Messenger Back copy and class',
)
app = replace_once(
    app,
    "<span>{identity?.display_name ? `${identity.display_name} · ${roleTitle(identity)}` : 'Secure Zoo messaging'}</span>",
    "<span>{EMPLOYEE_CONTEXT ? (identity?.display_name || 'Employee') : (identity?.display_name ? `${identity.display_name} · ${roleTitle(identity)}` : 'Secure Zoo messaging')}</span>",
    'employee Messenger identity subtitle',
)
app = replace_once(
    app,
    "      <button className=\"mz-button\" type=\"button\" onClick={openMemphis}>Memphis</button>\n      <button className=\"mz-button primary\" type=\"button\" onClick={() => setNewConversation(true)}>New</button>",
    "      {!EMPLOYEE_CONTEXT && <button className=\"mz-button mz-chat-memphis\" type=\"button\" onClick={openMemphis}>Memphis</button>}\n      <button className=\"mz-button primary mz-chat-new\" type=\"button\" onClick={() => setNewConversation(true)}>New</button>",
    'employee toolbar simplification',
)
app = replace_once(
    app,
    "          <Search placeholder=\"Search conversations\" value={search} onChange={setSearch} />",
    "          {!EMPLOYEE_CONTEXT && <Search placeholder=\"Search conversations\" value={search} onChange={setSearch} />}",
    'employee search removal',
)

old_list = '''            {visibleThreads.map((thread) => <Conversation
              key={thread.id}
              name={thread.title}
              info={thread.last_message_body || 'No messages yet'}
              lastSenderName={thread.last_sender_name || ''}
              lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
              unreadCnt={thread.unread || undefined}
              active={thread.id === selectedId}
              onClick={() => selectThread(thread.id)}
            >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>)}'''
new_list = '''            {visibleThreads.map((thread) => EMPLOYEE_CONTEXT
              ? <EmployeeConversationRow
                  key={thread.id}
                  thread={thread}
                  active={thread.id === selectedId}
                  onOpen={selectThread}
                  onDelete={deleteThread}
                />
              : <Conversation
                  key={thread.id}
                  name={thread.title}
                  info={thread.last_message_body || 'No messages yet'}
                  lastSenderName={thread.last_sender_name || ''}
                  lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
                  unreadCnt={thread.unread || undefined}
                  active={thread.id === selectedId}
                  onClick={() => selectThread(thread.id)}
                >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>)}'''
app = replace_once(app, old_list, new_list, 'employee swipe conversation rows')
app = replace_once(
    app,
    "<ConversationHeader.Content userName={selectedThread.title} info={selectedThread.shared ? 'Operations Leadership Chat' : selectedThread.participantNames || selectedThread.type} />",
    "<ConversationHeader.Content userName={selectedThread.title} info={EMPLOYEE_CONTEXT ? '' : (selectedThread.shared ? 'Operations Leadership Chat' : selectedThread.participantNames || selectedThread.type)} />",
    'employee thread header simplification',
)
app = replace_once(
    app,
    "{!selectedThread.shared && <button className=\"mz-button danger\" type=\"button\" onClick={deleteThread}>Delete</button>}",
    "{!selectedThread.shared && <button className=\"mz-button danger\" type=\"button\" onClick={() => deleteThread(selectedThread.id)}>Delete</button>}",
    'accessible thread Delete action',
)
app = replace_once(
    app,
    "<div><strong>Choose a conversation</strong>Select a thread or start a new Memphis Zoo message.</div>",
    "<div><strong>{EMPLOYEE_CONTEXT ? 'Choose a person' : 'Choose a conversation'}</strong>{EMPLOYEE_CONTEXT ? 'Tap a name or start a new message.' : 'Select a thread or start a new Memphis Zoo message.'}</div>",
    'employee empty-state copy',
)
app_path.write_text(app)


theme_path = Path('mobile/src/chatscope/theme.css')
theme = theme_path.read_text()
insert_before = '.cs-main-container{'
swipe_css = ".mz-chat-user-button{width:100%;color:var(--mz-text);font:inherit;text-align:left;cursor:pointer}.mz-chat-user-button:disabled{opacity:.58}.mz-chat-swipe-row{position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.06)}.mz-chat-row-delete{position:absolute;inset:0 0 0 auto;width:92px;border:0;background:#b91c1c;color:#fff;font-size:.95rem;font-weight:900;cursor:pointer}.mz-chat-swipe-content{position:relative;z-index:1;background:rgba(12,22,34,.98);transition:transform .18s ease;touch-action:pan-y}.mz-chat-swipe-row.revealed .mz-chat-swipe-content{transform:translateX(-92px)}.mz-chat-swipe-row .cs-conversation{border-bottom:0!important}.mz-chat-row-delete:focus-visible{outline:4px solid #fff;outline-offset:-5px}.employee-context .mz-chat-brand span{display:block}.employee-context .mz-chat-new-card.employee-picker{max-height:min(78vh,700px)}"
theme = replace_once(theme, insert_before, swipe_css + insert_before, 'Messenger swipe and picker styles')
theme += "\n@media(max-width:480px){.mz-chat-shell.employee-context .mz-chat-toolbar{height:68px;display:flex;gap:8px;padding:calc(env(safe-area-inset-top) + 8px) 10px 8px}.mz-chat-shell.employee-context .mz-chat-stage{height:calc(100% - 68px)}.mz-chat-shell.employee-context .mz-chat-brand span{display:none}}\n"
theme_path.write_text(theme)

subprocess.run(['node', 'scripts/custodial-employee-messenger-v23-contract-tests.mjs'], check=True)
subprocess.run(['npm', '--prefix', 'mobile', 'run', 'build:chatscope'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Installed the employee-simple Messenger flow and recipient-isolation repairs.')
