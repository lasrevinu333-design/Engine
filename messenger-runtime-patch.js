(() => {
  'use strict';
  const RETIRED_KEY = 'ops_manager_shared_chat_v1';
  const ANNIE_RETURN_URL = 'https://memphis-zoo-mcp.onrender.com/moxie/';
  const ANNIE_ORIGIN_SESSION_KEY = 'mz_annie_origin_session';
  const retiredTitle = /operations leadership(?: chat)?(?: \(retired\))?|ops manager chat/i;
  const originalFetch = window.fetch.bind(window);

  function isAnnieOrigin(url = new URL(window.location.href)) {
    const marker = String(url.searchParams.get('origin') || '').trim().toLowerCase() === 'annie';
    const fromAnnie = String(document.referrer || '').startsWith(ANNIE_RETURN_URL);
    if (marker || fromAnnie) {
      try { sessionStorage.setItem(ANNIE_ORIGIN_SESSION_KEY, '1'); } catch {}
      return true;
    }
    try { return sessionStorage.getItem(ANNIE_ORIGIN_SESSION_KEY) === '1'; } catch { return false; }
  }

  function navigateBack() {
    window.location.href = isAnnieOrigin() ? ANNIE_RETURN_URL : './start_page1.html';
  }

  const isThreadList = (url) => {
    try {
      const parsed = new URL(typeof url === 'string' ? url : url.url, location.href);
      return parsed.pathname === '/messaging-api/threads' || parsed.pathname.endsWith('/messaging-api/threads');
    } catch { return false; }
  };
  const isRetired = (row = {}) => row.system_key === RETIRED_KEY || row.is_ops_manager_shared === true || retiredTitle.test(String(row.thread_title || row.title || ''));
  const isMemphis = (row = {}) => String(row.thread_type || '').toLowerCase() === 'bot' || /^memphis(?: ai)?$/i.test(String(row.thread_title || row.title || '').trim());
  const normalize = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((row) => !isRetired(row))
    .map((row) => isMemphis(row) ? { ...row, thread_title: 'Memphis AI', title: 'Memphis AI' } : row)
    .sort((left, right) => {
      const pin = Number(isMemphis(right)) - Number(isMemphis(left));
      if (pin) return pin;
      const unread = Number(right.unread_count || 0) - Number(left.unread_count || 0);
      if (unread) return unread;
      return Date.parse(right.last_message_at || right.updated_at || 0) - Date.parse(left.last_message_at || left.updated_at || 0);
    });

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (!response.ok || !isThreadList(input)) return response;
    try {
      const payload = await response.clone().json();
      if (!payload || !Array.isArray(payload.data)) return response;
      const next = { ...payload, data: normalize(payload.data) };
      return new Response(JSON.stringify(next), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch { return response; }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.mz-chat-toolbar > .mz-button:first-child');
    if (!button || !/^back$/i.test(String(button.textContent || '').trim()) || !isAnnieOrigin()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigateBack();
  }, true);

  const wakeMessenger = () => {
    if (document.visibilityState !== 'visible') return;
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new CustomEvent('memphis:messenger-resume'));
  };
  document.addEventListener('visibilitychange', wakeMessenger);
  window.addEventListener('pageshow', wakeMessenger);
  window.MemphisMessengerRoute = { isAnnieOrigin, navigateBack, ANNIE_RETURN_URL, ANNIE_ORIGIN_SESSION_KEY };
  isAnnieOrigin();
})();
