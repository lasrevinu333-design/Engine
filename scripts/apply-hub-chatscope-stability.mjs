import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, oldText, newText) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: expected source block not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: replacement did not change file`);
  await writeFile(path, next);
}

await replaceExact(
  'mobile/src/shared/mobile-bridge.js',
  `  async function requestJson(path, options = {}, retry = true) {
    const headers = {
      ...(await authHeaders({ force: options.forceRefresh === true })),
      ...(options.headers || {}),
    };
    if (options.body !== undefined && options.body !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await rawFetch(\`${API}\${path}\`, {
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
      const error = new Error(payload?.error || \`HTTP \${response.status}\`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload.data;
  }
`,
  `  function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
  function isAbort(error) { return error?.name === 'Abort'}${'${String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`}'}\`;
    const headers = new Headers(options.headers || {});
    const response = await bridgeFetch(url, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: options.signal,
      headers,
      body: encodedBody(options.body, headers),
    }, true);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || \`HTTP ${'${response.status}'}\`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }
  async function requestJson(path, options = {}) {
    return (await requestEnvelope(path, options)).data;
  }
`,
);

await replaceExact(
  'mobile/src/shared/mobile-bridge.js',
  `    } catch (error) {
      if (!retry) throw error;
      await refresh({ force: true }).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return bridgeFetch(input, init, false);
    }
`,
  `    } catch (error) {
      if (isAbort(error) || !retry || !isNetworkFailure(error)) throw error;
      await refresh({ force: true }).catch(() => null);
      await wait(400);
      return bridgeFetch(input, init, false);
    }
`,
);

await replaceExact(
  'mobile/src/shared/mobile-bridge.js',
  `    authHeaders,
    requestJson,
    fetch: bridgeFetch,`,
  `    authHeaders,
    requestEnvelope,
    requestJson,
    fetch: bridgeFetch,`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `async function api(path, { method = 'GET', body, signal } = {}) {
  const auth = await resolveAuthHeaders();
  const response = await fetch(\`${'${API}'}${'${path}'}\`, {
    method,
    cache: 'no-store',
    signal,
    headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || \`HTTP ${'${response.status}'}\`);
  return payload;
}
`,
  `async function api(path, { method = 'GET', body, signal } = {}) {
  if (window.MemphisMobile?.requestEnvelope) {
    return window.MemphisMobile.requestEnvelope(\`/messaging-api${'${path}'}\`, { method, body, signal });
  }
  const auth = await resolveAuthHeaders();
  const response = await fetch(\`${'${API}'}${'${path}'}\`, {
    method,
    cache: 'no-store',
    signal,
    headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || \`HTTP ${'${response.status}'}\`);
  return payload;
}
`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });`,
  `  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadsRef = useRef([]);
  const bootstrapStarted = useRef(false);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  const loadIdentity = useCallback(async () => {
    await resolveAuthHeaders();
    const envelope = await api('/me/by-device');`,
  `  const loadIdentity = useCallback(async () => {
    const envelope = await api('/me/by-device');`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `    const rows = (envelope.data || []).map(normalizedThread);
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
    setNotice('');`,
  `    const rows = (envelope.data || []).map(normalizedThread);
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
    setNotice('');`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `      const thread = threads.find((item) => item.id === threadId);
      void markRead(thread);
      return rows;
    } finally {
      if (mounted.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead, threads]);`,
  `      const thread = threadsRef.current.find((item) => item.id === threadId);
      void markRead(thread).catch(() => {});
      return rows;
    } finally {
      if (mounted.current) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead]);`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `      const existing = threads.find(isMemphis);`,
  `      const existing = threadsRef.current.find(isMemphis);`,
);
await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice, threads]);`,
  `  }, [currentDeviceId, loadIdentity, loadThreads, selectThread, setNotice]);`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `    const thread = threads.find((item) => item.id === selectedRef.current);`,
  `    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);`,
);
await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  }, [currentDeviceId, loadMessages, loadThreads, setNotice, threads]);`,
  `  }, [currentDeviceId, loadMessages, loadThreads, setNotice]);`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {`,
  `    if (!entries.length) return;
    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  const deleteThread = useCallback(async () => {
    const thread = threads.find((item) => item.id === selectedRef.current);`,
  `  const deleteThread = useCallback(async () => {
    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);`,
);
await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  }, [currentDeviceId, loadThreads, setNotice, threads]);`,
  `  }, [currentDeviceId, loadThreads, setNotice]);`,
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `  useEffect(() => {
    mounted.current = true;
    (async () => {`,
  `  useEffect(() => {
    if (bootstrapStarted.current) return undefined;
    bootstrapStarted.current = true;
    mounted.current = true;
    (async () => {`,
);

console.log('Applied hub and ChatScope stability repair.');
