import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const page = readFileSync(new URL('../schedule-employee-day.html', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../memphis-scheduler-actions.js', import.meta.url), 'utf8');
const source = page.match(/<script>\s*(const CONFIG=[\s\S]+?)<\/script>/)?.[1];
assert.ok(source, 'Published daily schedule has the expected controller');

function deferred() {
  let resolve;
  const promise = new Promise(finish => { resolve = finish; });
  return {promise, resolve};
}

test('published employee day report binds displayed, printed and downloaded assignments to the current authorized service date', async () => {
  const elements = new Map();
  const downloads = [];
  const requests = [];
  let printed = 0;
  const session = {
    role:'ops_manager', manager_id:'10000000-0000-4000-8000-000000000001',
    credential_id:'credential', device_id:'browser', token:'test-session',
    expires_at:new Date(Date.now()+60000).toISOString(),
    permissions:{schema:'custodial.manager-permissions.v1', read:true},
  };
  const node = id => {
    if (!elements.has(id)) elements.set(id, {
      value:'', style:{}, events:{}, innerHTML:'', textContent:'',
      addEventListener(name, fn) { this.events[name] = fn; },
      querySelectorAll() { return []; },
    });
    return elements.get(id);
  };
  const location = new URL('https://fixture.invalid/schedule-employee-day.html?date=2026-11-29');
  const window = {
    location, events:{},
    print() { this.events.beforeprint(); printed++; },
    addEventListener(name,fn) { this.events[name] = fn; },
    MemphisAuth:{
      readSession:() => session,
      requireOpsManagerSession:async () => session,
      opsManagerAuthHeaders:async () => ({Authorization:'Bearer '+session.token}),
    },
  };
  const files = new Map();
  class TestURL extends URL {
    static createObjectURL(blob) {
      const url = 'blob:fixture-'+files.size;
      files.set(url,blob);
      return url;
    }
    static revokeObjectURL(url) { files.delete(url); }
  }
  const context = vm.createContext({
    document:{
      getElementById:node, body:{appendChild() {}}, addEventListener() {},
      createElement(){return {click(){downloads.push({name:this.download, blob:files.get(this.href)});}, remove(){}};},
    },
    window, location, URL:TestURL, URLSearchParams, Blob, AbortController,
    fetch:async (url, options) => {
      const request = deferred();
      requests.push({date:new URL(url).searchParams.get('service_date'), signal:options.signal, ...request});
      return request.promise;
    },
    setTimeout(callback) { callback(); },
  });
  vm.runInContext(actions,context);
  window.MemphisSchedulerActions = context.MemphisSchedulerActions;
  const onReady = source.replace(/^init\(\).+$/m,'globalThis.startup=init();');
  assert.notEqual(onReady,source);
  vm.runInContext(onReady,context);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const select = date => {
    const input = node('service-date');
    input.value = date;
    input.events.change();
  };
  const start = () => node('load-btn').events.click();
  const file = () => vm.runInContext("exportEmployeeDocx('employee')",context);
  const reply = (request, date, name) => request.resolve({
    ok:true, json:async () => ({
      ok:true, data:{service_date:date, groups:[
        {group_name:name, segments:[{status:'assigned',employee_id:'employee',assigned_employee_name:'Synthetic Worker',coverage_start:'08:00',coverage_end:'09:00'}]},
        {group_name:'OPEN_'+name, segments:[{status:'OPEN',coverage_start:'08:00',coverage_end:'09:00'}]},
      ]},
    }),
  });

  await tick();
  assert.equal(requests[0].date,'2026-11-29');
  select('2026-11-30');
  const monday = start();
  await tick();
  assert.equal(requests[0].signal.aborted,true);
  assert.equal(requests[1].date,'2026-11-30');
  reply(requests[1],'2026-11-30','MONDAY_ROUTE');
  await monday;
  reply(requests[0],'2026-11-29','SUNDAY_ROUTE');
  await context.startup;
  assert.match(node('employee-list').innerHTML,/MONDAY_ROUTE/);
  assert.doesNotMatch(node('employee-list').innerHTML,/SUNDAY_ROUTE/);
  assert.match(node('print-heading').textContent,/Monday/);

  await file();
  assert.equal(downloads[0].name,'Synthetic_Worker_2026-11-30_schedule.doc');
  assert.match(await downloads[0].blob.text(),/Monday[\s\S]*MONDAY_ROUTE/);
  assert.match(node('status').textContent,/download started/);

  let packing = deferred();
  window.docx = {
    Document:class {}, Paragraph:class {}, HeadingLevel:{},
    Packer:{toBlob:() => packing.promise},
  };
  let exporting = file();
  packing.resolve(new Blob(['docx']));
  await exporting;
  assert.equal(downloads[1].name,'Synthetic_Worker_2026-11-30_schedule.docx');

  const filter = node('filter');
  filter.value = 'open';
  filter.events.change();
  node('print-btn').events.click();
  assert.equal(printed,1);
  assert.match(node('open-list').innerHTML,/OPEN_MONDAY_ROUTE/);
  assert.equal(node('open-card').style.display,'block');
  assert.match(page,/@media print\{[^}]*#print-heading\{display:block/);
  assert.doesNotMatch(page,/@media print[^\n]*\.openCard\{[^}]*display:none/);

  filter.value = 'all';
  filter.events.change();
  packing = deferred();
  exporting = file();
  select('2026-12-01');
  packing.resolve(new Blob(['late docx']));
  await exporting;
  assert.equal(downloads.length,2);
  assert.equal(node('print-btn').disabled,true);
  node('print-btn').events.click();
  assert.equal(printed,1);

  const wrongDay = start();
  await tick();
  reply(requests[2],'2026-11-30','WRONG_DAY');
  await wrongDay;
  assert.doesNotMatch(node('employee-list').innerHTML,/WRONG_DAY|MONDAY_ROUTE/);
  assert.match(node('status').textContent,/unavailable/);

  const tuesday = start();
  await tick();
  reply(requests[3],'2026-12-01','TUESDAY_ROUTE');
  await tuesday;
  assert.match(node('employee-list').innerHTML,/TUESDAY_ROUTE/);
  packing = deferred();
  exporting = file();
  session.token = 'new-session';
  window.events.storage();
  packing.resolve(new Blob(['superseded docx']));
  await exporting;
  assert.equal(downloads.length,2);
  assert.equal(node('print-btn').disabled,true);
  assert.doesNotMatch(node('employee-list').innerHTML,/TUESDAY_ROUTE/);
});
