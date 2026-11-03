const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
// Separately identified current-date successor; the historical October19 case is unchanged.
if (process.env.CUSTODIAL_CURRENT_SCHEDULER_BROWSER_FIXTURE) {
  test.use({ trace: 'off', video: 'off', screenshot: 'off' });
}
test.describe('current-date owned scheduler SQL integration', () => {
  test.skip(!process.env.CUSTODIAL_CURRENT_SCHEDULER_BROWSER_FIXTURE,
    'NOT_RUN: explicitly owned current-date SQL fixture required.');

  test('current-date prepared original survives actual committed cancel reply loss', async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(120000);
    const requireInput = (ok, message) => { if (!ok) throw new Error(message); };
    const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
    let input, endpoint, frontend;
    try {
      input = JSON.parse(process.env.CUSTODIAL_CURRENT_SCHEDULER_BROWSER_FIXTURE);
      endpoint = new URL(input.endpoint); frontend = new URL(baseURL);
    } catch { throw new Error('The closed owning fixture JSON/loopback URLs are unavailable; no session data is logged.'); }
    const keys = ['endpoint', 'week', 'session', 'employeeId', 'slotId', 'publicationId', 'versionId', 'revision', 'bootstrapCookies'];
    const loopback = url => url.protocol === 'https:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && !url.username && !url.password;
    requireInput(Object.keys(input).sort().join(',') === keys.sort().join(',')
      && loopback(endpoint) && endpoint.port && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash
      && loopback(frontend), 'Only the exact current owned fixture and loopback endpoints are admitted.');
    requireInput(/^\d{4}-\d{2}-\d{2}$/.test(input.week) && new Date(input.week+'T12:00:00Z').getUTCDay() === 1, 'The successor uses a real current/future Monday.');
    const today = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    requireInput(today.year + '-' + today.month + '-' + today.day <= input.week,
      'The successor date elapsed; never replace the real clock.');
    requireInput(uuid(input.employeeId) && uuid(input.slotId) && uuid(input.publicationId) && uuid(input.versionId)
      && Number.isSafeInteger(input.revision) && input.revision >= 0,
      'Actual accepted current pattern identities/revision are required.');
    const session = input.session;
    requireInput(session && session.role === 'ops_manager' && typeof session.token === 'string' && session.token.length > 0
      && uuid(session.manager_id) && typeof session.device_id === 'string' && session.device_id.length > 0
      && typeof session.credential_id === 'string' && session.credential_id.length > 0
      && Number.isFinite(Date.parse(session.expires_at)) && Date.parse(session.expires_at) > Date.now()
      && session.auth_mode === 'custodial_leadership_pin' && session.owner === false
      && session.permissions?.schema === 'custodial.manager-permissions.v1'
      && session.permissions.read === true && session.permissions.manage_absences === true,
    'The owned normal runtime must issue a current SQL-backed manager session with absence permission.');

    const base = '/static-weekly/staffing-commands';
    const report = process.env.CUSTODIAL_CURRENT_SCHEDULER_BROWSER_RESULT;
    const diagnosticFile = process.env.CUSTODIAL_CURRENT_SCHEDULER_BROWSER_DIAGNOSTIC;
    requireInput(path.isAbsolute(report||'') && path.isAbsolute(diagnosticFile||'') && report!==diagnosticFile,
      'Distinct explicit owned success and sanitized diagnostic paths required.');
    const preparedMessage = 'Private staffing preview ready. Review the dated people, duties and constraints before one confirmation.';
    const key = 'mz_scheduler_dated_operation_v1:' + encodeURIComponent(endpoint.origin) + ':' + session.manager_id;
    const traffic = [], blocked = [], issues = [], readFailures = [], reads = [], counts = { begin: 0, prepare: 0, cancel: 0 };
    let operationId = null, routedOperationId = null, semanticDigest = null, reloaded = false, lostReply = false, completed = false, page;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', ignoreHTTPSErrors:true });
    requireInput(Array.isArray(input.bootstrapCookies) && input.bootstrapCookies.length===2
      && input.bootstrapCookies.every(c=>c.name.startsWith('__Host-custodial_leadership_') && typeof c.value==='string' && c.value.length>0 && c.secure===true && c.httpOnly===true && c.sameSite==='None'), 'Actual opaque normal enrollment cookies required.');
    await context.addCookies(input.bootstrapCookies.map(c=>({...c,url:'https://memphis-zoo-mcp.onrender.com/'})));
    const opaqueValues=[session.token,...input.bootstrapCookies.map(cookie=>cookie.value)];
    const clean = value => {
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
        .filter(([name]) => !/token|secret|password|authorization|cookie|session|credential|csrf|pepper|verifier|^pin$/i.test(name))
        .map(([name, child]) => [name, clean(child)]));
      return typeof value === 'string' ? opaqueValues.reduce((text,opaque)=>text.split(opaque).join('[REDACTED]'),value)
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED]') : value;
    };
    const record = async response => {
      const request = response.request(), url = new URL(request.url());
      if (url.origin !== endpoint.origin || !url.pathname.startsWith('/static-weekly/')
        || url.pathname.endsWith('/cancel')) return;
      const method=request.method(), status=response.status(), afterReload=reloaded;
      const originalPath=url.pathname===base || url.pathname.startsWith(base+'/');
      if (!originalPath && status===200) return;
      const exactOriginalRead=method==='GET' && /^\/static-weekly\/staffing-commands\/[0-9a-f-]{36}$/i.test(url.pathname);
      const limit=exactOriginalRead ? 5*1048576 : 1048576;
      let stage='response_body', actualBytes=null;
      try {
        if (method==='OPTIONS') {
          requireInput([200,204].includes(status),'Original CORS preflight failed.');
          traffic.push({method,path:url.pathname,status,request_body:null,response_body:null,
            after_reload:afterReload,body_kind:'BODYLESS_PREFLIGHT'}); return;
        }
        const text=await response.text(); actualBytes=Buffer.byteLength(text,'utf8'); stage='utf8_bound';
        requireInput(actualBytes<=limit,'Original response exceeds its path-specific evidence bound.');
        stage='json';const body=text ? JSON.parse(text) : null;let recordedBody=body, omitted=null;
        if (exactOriginalRead && body?.ok===true && body?.data?.state==='PREPARED') {
          // SQL bounds each preview week at4MiB. This case has exactly one week;
          // add the unchanged1MiB metadata allowance. No browser body is altered.
          stage='one_week_prepared_preview';const preview=body.data.preview;
          requireInput(preview?.schema==='memphis-zoo.staffing-command-preview.v1'
            && Array.isArray(preview.weeks) && preview.weeks.length===1
            && preview.weeks[0].week_start===input.week,'Prepared evidence is not the exact one-week original.');
          const week=preview.weeks[0], weekBytes=Buffer.byteLength(JSON.stringify(week),'utf8');
          requireInput(weekBytes<=4*1048576,'Prepared week exceeds the existing SQL preview bound.');
          const metadata={...body,data:{...body.data,preview:null}};
          requireInput(Buffer.byteLength(JSON.stringify(metadata),'utf8')<=1048576,'Original metadata exceeds its unchanged bound.');
          omitted={field:'data.preview',explicitly_omitted_from_evidence:true,schema:preview.schema,
            utf8_bytes:Buffer.byteLength(JSON.stringify(preview),'utf8'),sha256:createHash('sha256').update(JSON.stringify(preview)).digest('hex'),
            weeks:[{week_start:week.week_start,publicationId:week.publicationId,versionId:week.versionId,
              database_projection_identity:week.database_projection_identity,replayDigest:week.replayDigest,
              sourceDigest:week.sourceDigest,geographyDigest:week.geographyDigest,
              assignment_count:week.assignments?.length,lunch_responsibility_count:week.lunch_responsibilities?.length,lunch_loan_count:week.lunch_loans?.length}]};
          recordedBody=metadata;
        } else requireInput(actualBytes<=1048576,'Compact original response exceeds its unchanged bound.');
        stage='request_json';
        traffic.push({method,path:url.pathname,status,request_body:request.postData()?clean(JSON.parse(request.postData())):null,
          response_body:clean(recordedBody),response_body_omission:clean(omitted),raw_response_utf8_bytes:actualBytes,
          raw_response_sha256:createHash('sha256').update(text).digest('hex'),after_reload:afterReload});
      } catch(error) {
        readFailures.push(clean({method,path:url.pathname,status,after_reload:afterReload,stage,actual_bytes:actualBytes,
          limit_bytes:limit,code:error.code??error.name,message:String(error.message).slice(0,400)}));
        issues.push('Original operation response unavailable as bounded JSON.');
      }
    };
    const savedRaw = () => page.evaluate(storageKey => localStorage.getItem(storageKey), key); // READ ONLY
    const commandPath = suffix => base + '/' + operationId + suffix;
    try {
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === 'https://memphis-zoo-mcp.onrender.com' && request.method() === 'GET'
          && ['/custodial-leadership-api/session','/scheduler-runtime-config'].includes(url.pathname)) {
          // Endpoint relocation only. Authentication and configuration bodies are
          // produced by the owned normal auth/runtime, never fabricated in this case.
          const response = await route.fetch({url: endpoint.origin+url.pathname,
            headers:await request.allHeaders(),
            maxRedirects:0,maxRetries:0});
          requireInput(response.status()===200, 'Owned normal bootstrap refused.');
          return route.fulfill({response});
        }
        if (url.origin === endpoint.origin && url.pathname.startsWith('/static-weekly/')) {
          // Preserve the actual browser Origin/headers/body and actual CORS.
          if (['GET', 'OPTIONS'].includes(request.method())) return route.continue();
          const match = url.pathname.match(/^\/static-weekly\/staffing-commands\/([0-9a-f-]{36})\/(prepare|cancel)$/i);
          const kind = url.pathname === base ? 'begin' : match && uuid(match[1]) ? match[2] : null;
          if (request.method() !== 'POST' || reloaded || !kind
            || match && operationId && match[1] !== operationId) {
            let body = null;
            try { body = request.postData() ? clean(JSON.parse(request.postData())) : null; }
            catch { body = '[unparseable request body omitted]'; }
            traffic.push({ method: request.method(), path: url.pathname, status: null,
              request_body: body, response_body: null, after_reload: reloaded, blocked: true });
            issues.push('Unexpected scheduler mutation refused.'); return route.abort('blockedbyclient');
          }
          counts[kind]++;
          if (counts[kind] !== 1) {
            issues.push('Repeated original mutation refused; no retry sent.'); return route.abort('blockedbyclient');
          }
          if (kind === 'prepare') {
            routedOperationId = match[1]; // actual request DATA, not an invented operation
            return route.continue();
          }
          if (kind === 'begin') return route.continue();
          // One real cancel request, without a header/body override or retry.
          // Drop ONLY its successful reply after the actual endpoint responds.
          try {
            const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
            const text = await response.text();
            requireInput(text.length <= 1048576, 'Original cancel response exceeds the bounded case limit.');
            const body = JSON.parse(text), value = body?.data;
            const entry = { method: 'POST', path: url.pathname, status: response.status(),
              request_body: clean(JSON.parse(request.postData())), response_body: clean(body),
              after_reload: false, client_reply_lost: false };
            traffic.push(entry);
            if (response.status() === 200 && body?.ok === true && value?.cancelled === true
              && value.operation_id === operationId && value.state === 'CANCELLED') {
              entry.client_reply_lost = lostReply = true;
              return route.abort('failed');
            }
            return route.fulfill({ response }); // real refusal unchanged, never fake committed success
          } catch {
            issues.push('Original cancel transport failed before a successful reply was observed.');
            return route.abort('failed');
          }
        }
        if (url.origin === frontend.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
        blocked.push({ method: request.method(), origin: url.origin, path: url.pathname });
        return route.abort('blockedbyclient'); // external Lucide is optional; never substitute code
      });
      page = await context.newPage();
      page.on('response', response => { reads.push(record(response)); });
      const snapshotResponse = response => {
        const url = new URL(response.url());
        return url.origin === endpoint.origin && url.pathname === '/static-weekly/manager-snapshot'
          && response.request().method() === 'GET' && response.status() === 200;
      };
      const firstRead = page.waitForResponse(snapshotResponse);
      await page.goto('/schedule-weekly.html?date=' + input.week + '&week_start=' + input.week,
        { waitUntil: 'domcontentloaded' });
      const initial = (await (await firstRead).json()).data;
      requireInput(initial?.week_start === input.week && /^\d{4}-\d{2}-\d{2}$/.test(initial.current_service_date)
        && initial.current_service_date <= input.week && initial.authority_revision === input.revision
        && initial.current_publication?.publication_id === input.publicationId
        && initial.current_publication?.version_id === input.versionId
        && initial.roster?.some(row => row.slot_id === input.slotId
          && row.incumbencies?.some(person => person.person_id === input.employeeId)),
      'The actual current read does not match the accepted current pattern basis.');
      const end = new Date(Date.parse(input.week+'T12:00:00Z')+6*86400000).toISOString().slice(0,10);
      const loaded = 'Loaded '+input.week+' through '+end+'.';
      await expect(page.locator('#status')).toHaveText(loaded);
      await expect(page.locator('#revision-count')).toHaveText(String(input.revision));
      expect(await savedRaw() === null, 'No pending original may be seeded.').toBe(true);
      await page.locator('#absence-type').selectOption('daily_absence');
      await page.locator('#absence-end-date').fill(input.week);
      await page.locator('[data-callout-slot="' + input.slotId + '"]').check();
      const beginRead = page.waitForResponse(response => new URL(response.url()).origin === endpoint.origin
        && new URL(response.url()).pathname === base && response.request().method() === 'POST');
      await page.locator('#apply-day-btn').click(); // real UI creates original body/key; no private function call
      const begun = await (await beginRead).json();
      requireInput(begun?.ok === true && uuid(begun.data?.operation_id), 'Normal BEGIN lacks its original operation.');
      operationId = begun.data.operation_id;
      await expect(page.locator('#status')).toHaveText(preparedMessage, {timeout:60000});
      await expect(page.locator('#staffing-confirm-btn')).toBeEnabled();
      await expect(page.locator('#scheduler-cancel-preparation')).toBeEnabled();
      await Promise.all(reads);
      const prepared = traffic.find(row => row.path === commandPath('/prepare') && row.method === 'POST');
      requireInput(routedOperationId === operationId && prepared?.status === 200
        && prepared.response_body?.ok === true && prepared.response_body?.data?.state === 'PREPARED'
        && prepared.response_body?.data?.operation_id === operationId,
      'Actual normal preparation must prepare the same original without accepting it.');
      const original = JSON.parse(await savedRaw());
      requireInput(original.state === 'PENDING' && original.command.phase === 'PREPARED'
        && original.command.operationId === operationId && original.body.employee_id === input.employeeId
        && original.body.start_date === input.week && original.body.end_date === input.week
        && original.body.expected_revision === input.revision && original.receipt === null
        && original.command.confirmationAttempted === false && original.command.confirmationKey === null,
      'The actual page did not retain its exact unaccepted original.');
      requireInput(typeof original.command.semanticDigest==='string' && /^[a-f0-9]{64}$/.test(original.command.semanticDigest),
        'The actual prepared original must retain its exact semantic digest.');
      semanticDigest=original.command.semanticDigest;

      await page.locator('#scheduler-cancel-preparation').click();
      const dialog = page.locator('#action-confirm-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText('Cancel unpublished preparation');
      await dialog.getByRole('button', { name: 'Cancel Unpublished Preparation', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('#scheduler-pending-text')).toContainText('An original unpublished cancellation was attempted.');
      await expect(page.locator('#scheduler-retry')).toBeEnabled();
      requireInput(lostReply && counts.cancel === 1, 'One actual successful cancel reply was not observed and lost.');
      const attemptedRaw = await savedRaw(), attempted = JSON.parse(attemptedRaw);
      requireInput(attempted.encoded === original.encoded && JSON.stringify(attempted.body) === JSON.stringify(original.body)
        && attempted.command.operationId === operationId
        && attempted.command.semanticDigest === original.command.semanticDigest
        && attempted.command.cancellationAttempt?.operationId === operationId
        && attempted.command.confirmationAttempted === false && attempted.command.confirmationKey === null
        && attempted.receipt === null && attempted.state === 'PENDING',
      'Lost reply changed/retired the original before independent cancellation readback.');
      for (const field of ['base', 'managerId', 'principal', 'path', 'weekStart', 'publicationId', 'versionId', 'weekBindings']) {
        expect(JSON.stringify(attempted[field]) === JSON.stringify(original[field]),
          'The original ' + field + ' binding changed during the cancellation attempt.').toBe(true);
      }
      await Promise.all(reads);

      reloaded = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#status')).toHaveText(loaded);
      await expect(page.locator('#scheduler-pending-text')).toContainText('An original unpublished cancellation was attempted.');
      expect(await savedRaw() === attemptedRaw, 'Reload must retain the same complete saved original attempt.').toBe(true);
      const originalRead = page.waitForResponse(response => new URL(response.url()).origin === endpoint.origin
        && new URL(response.url()).pathname === commandPath('')
        && response.request().method() === 'GET' && response.status() === 200);
      await page.getByRole('button', { name: 'Read original cancellation outcome', exact: true }).click();
      const cancelled = (await (await originalRead).json()).data;
      requireInput(cancelled?.operation_id === operationId && cancelled.state === 'CANCELLED'
        && cancelled.semantic_digest === original.command.semanticDigest && cancelled.accepted_receipt === null,
      'Actual original GET did not independently confirm CANCELLED.');
      await expect(page.locator('#scheduler-pending-panel')).toBeHidden();
      await expect(page.locator('#status')).toContainText('The exact original reads CANCELLED.');
      expect(await savedRaw() === null, 'Only matching original CANCELLED may retire the local control.').toBe(true);
      const lastRead = page.waitForResponse(snapshotResponse);
      await page.locator('#refresh-btn').click();
      const final = (await (await lastRead).json()).data;
      for (const field of ['authority_revision', 'current_publication', 'assignments', 'availability',
        'exceptions', 'latest_projection', 'canonical_staffing_absences']) {
        expect(JSON.stringify(final?.[field]) === JSON.stringify(initial[field]),
          'The actual current ' + field + ' changed after unpublished cancellation.').toBe(true);
      }
      await expect(page.locator('#status')).toHaveText(loaded);
      await Promise.all(reads);
      expect(counts).toEqual({ begin: 1, prepare: 1, cancel: 1 });
      expect(traffic.filter(row => row.after_reload && row.method !== 'OPTIONS').every(row => row.method === 'GET')).toBe(true);
      expect(traffic.some(row => row.after_reload && row.path === commandPath(''))).toBe(true);
      expect(issues).toEqual([]);
      expect(blocked.every(row => row.method === 'GET' && row.origin === 'https://unpkg.com'
        && row.path === '/lucide@0.468.0/dist/umd/lucide.min.js')).toBe(true);
      completed = true; // Parent independently checks the actual retained SQL original and unchanged publication.
      fs.writeFileSync(report,JSON.stringify(clean({schema:'custodial.current-date-browser-lost-cancel.v1',passed:true,operation_id:operationId,semantic_digest:semanticDigest,request_counts:counts,lost_successful_reply:lostReply,traffic,issues,read_failures:readFailures,blocked,production:false,release_admission:false}))+'\n',{flag:'wx',mode:0o600});
    } finally {
      await Promise.allSettled(reads);
      try {
        const diagnostic=JSON.stringify(clean({schema:'custodial.current-date-browser-sanitized-diagnostic.v1',
          completed,operation_id:operationId,semantic_digest:semanticDigest,traffic,blocked,issues,read_failures:readFailures,
          request_counts:counts,client_lost_one_cancel_reply:lostReply,production:false,release_admission:false}),null,2);
        fs.writeFileSync(diagnosticFile,diagnostic+'\n',{flag:'wx',mode:0o600});
        await testInfo.attach('current-date-pending-original-sanitized-http', {
          contentType: 'application/json',
          body: diagnostic,
        });
      } finally { await context.close(); }
    }
  });
});
