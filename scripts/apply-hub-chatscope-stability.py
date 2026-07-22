from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'{path}: expected source block not found')
    updated = source.replace(old, new, 1)
    if updated == source:
        raise RuntimeError(f'{path}: replacement did not change file')
    file_path.write_text(updated, encoding='utf-8')


replace_exact(
    'mobile/src/shared/mobile-bridge.js',
    r'''  async function requestJson(path, options = {}, retry = true) {
    const headers = {
      ...(await authHeaders({ force: options.forceRefresh === true })),
      ...(options.headers || {}),
    };
    if (options.body !== undefined && options.body !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await rawFetch(`${API}${path}`, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers,
      body: options.body === undefined || options.body === null
        ? undefined
        : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)),
    });
    if (retry && (response.status === 401 || response.status === 403)) {
      await refresh({ force: true });
      return requestJson(path, { ...options, forceRefresh: false }, false);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload.data;
  }
''',
    r'''  function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
  function isAbort(error) { return error?.name === 'AbortError' || /aborted/i.test(String(error?.message || '')); }
  function isNetworkFailure(error) {
    return error instanceof TypeError || /failed to fetch|network|connection|load failed|internet/i.test(String(error?.message || ''));
  }
  function encodedBody(body, headers) {
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) return body;
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return JSON.stringify(body);
  }
  async function requestEnvelope(path, options = {}) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const headers = new Headers(options.headers || {});
    const response = await bridgeFetch(`${API}${normalizedPath}`, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: options.signal,
      headers,
      body: encodedBody(options.body, headers),
    }, true);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }
  async function requestJson(path, options = {}) {
    return (await requestEnvelope(path, options)).data;
  }
''',
)

replace_exact(
    'mobile/src/shared/mobile-bridge.js',
    r'''    } catch (error) {
      if (!retry) throw error;
      await refresh({ force: true }).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return bridgeFetch(input, init, false);
    }
''',
    r'''    } catch (error) {
      if (isAbort(error) || !retry || !isNetworkFailure(error)) throw error;
      await refresh({ force: true }).catch(() => null);
      await wait(400);
      return bridgeFetch(input, init, false);
    }
''',
)

replace_exact(
    'mobile/src/shared/mobile-bridge.js',
    r'''    authHeaders,
    requestJson,
    fetch: brideFetch,''',
    r'''    authHeaders,
    requestEnvelope,
    requestJson,
    fetch: brideFetch,''',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''async function api(path, { method = 'GET', body, signal } = {}) {
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
''',
    r'''async function api(path, { method = 'GET', body, signal } = {}) {
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
''',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });'',
    r'''  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadsRef = useRef([]);
  const bootstrapStarted = useRef(false);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });''',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''  const loadIdentity = useCallback(async () => {
    await resolveAuthHeaders();
    const envelope = await api('/me/by-device');''',
    r'''  const loadIdentity = useCallback(async () => {
    const envelope = await api('/me/by-device');''',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''    const rows = (envelope.data || []).map(normalizedThread);
    if (!mounted.current) return rows;
    setThreads(rows);
    const desired = preferId || selectedRef.current || new URL(location.href).searchParams.get('thread_id') || '';
    const next = rows.find((thread) => thread.id === desired)
      || rows.find((thread) => thread.shared)
      || rows[0]
      || null;
    if (next && !selectedRef.current) {
      selectedRef.current = next.id;
      setSelectedId(next.id);
    }
    setNotice('');'',
    r'''    const rows = (envelope.data || []).map(normalizedThread);
    if (!mounted.current) return rows;
    threadsRef.current = rows;
    setThreads(rows);
    const desired = preferId || selectedRef.current || new URL(location.href).searchParams.get('thread_id') || '';
    const next = rows.find((thread) => thread.id === desired)
      || rows.find((thread) => thread.shared)
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
    setNotice('');'',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''      const thread = threads.find((item) => item.id === threadId);
      void markRead(thread);
      return rows;
    } finally {
      if (mounted.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead, threads]);''',
    r'''      const thread = threadsRef.current.find((item) => item.id === threadId);
      void markRead(thread).catch(() => {});
      return rows;
    } finally {
      if (mounted.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead]);''',
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    "      const existing = threads.find(isMemphis);",
    "      const existing = threadsRef.current.find(isMemphis);",
)
replace_exact(
    'mobile/src/chatscope/app.jsx',
    "  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice, threads]);",
    "  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice]);",
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    "    const thread = threads.find((item) => item.id === selectedRef.current);",
    "    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);",
)
replace_exact(
    'mobile/src/chatscope/app.jsx',
    "  }, [currentDeviceId, loadMessages, loadThreads, setNotice, threads]);",
    "  }, [currentDeviceId, loadMessages, loadThreads, setNotice]);",
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    "    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {",
    "    if (!entries.length) return;\n    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {",
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''  const deleteThread = useCallback(async () => {
    const thread = threads.find((item) => item.id === selectedRef.current);'',
    r'''  const deleteThread = useCallback(async () => {
    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);''',
)
replace_exact(
    'mobile/src/chatscope/app.jsx',
    "  }, [currentDeviceId, loadThreads, setNotice, threads]);",
    "  }, [currentDeviceId, loadThreads, setNotice]);",
)

replace_exact(
    'mobile/src/chatscope/app.jsx',
    r'''  useEffect(() => {
    mounted.current = true;
    (async () => {''',
    r'''  useEffect(() => {
    if (bootstrapStarted.current) return undefined;
    bootstrapStarted.current = true;
    mounted.current = true;
    (async () => {''',
)

print('Applied hub and ChatScope stability repair.')
