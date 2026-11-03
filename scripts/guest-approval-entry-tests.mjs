import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
let passed = 0, failed = 0;
for (const page of ['guest-report.html', 'guest-qr.html']) {
  const html = readFileSync(new URL(page, root), 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.includes('async function loadFeatureStatus'))[0];
  assert.ok(source, 'actual guest controller must be present');
  for (const gate of ['off', 'unavailable', 'malformed', 'on']) {
    for (const demo of [false, true]) {
      const elements = new Map(); const requests = [];
      const document = {getElementById(id) {
        if (!elements.has(id)) elements.set(id, {hidden:false, style:{}, value:'', addEventListener(){}, reset(){}});
        return elements.get(id);
      }};
      const context = {document, URL, Date, console, window:{location:{href:`https://fixture.invalid/${page}?code=TETM${demo?'&demo=1':''}`}},
        fetch:async (url, options={})=>{
          requests.push({url, method:options.method||'GET'});
          assert.equal(options.method||'GET','GET','startup cannot submit a report');
          if(url.endsWith('/status')) {
            if(gate==='unavailable') throw new Error('offline');
            return {ok:true,json:async()=>gate==='malformed'?null:{ok:true,data:{enabled:gate==='on'}}};
          }
          return {ok:true,json:async()=>({ok:true,data:url.includes('/issues')?[]:{location_code:'TETM',location_name:'Fixture restroom'}})};
        }};
      vm.createContext(context);
      try {
        vm.runInContext(source.replace('init();','globalThis.boot = init();'),context);
        await context.boot;
        assert.equal(requests[0]?.url.endsWith('/guest-api/status'),true,'every entry checks the real approval status');
        if(gate==='on') {
          assert.equal(requests.length,3);
          assert.equal(elements.get('report-card').hidden,false);
          assert.equal(elements.get('location-pill').textContent,'Fixture restroom (TETM)');
        } else {
          assert.equal(requests.length,1,'disabled/unavailable approval cannot read reports or location');
          assert.equal(elements.get('report-card').hidden,true);
          assert.equal(elements.get('issues-card').hidden,true);
          assert.equal(elements.get('location-pill').textContent,'Awaiting Memphis Zoo approval');
        }
        passed++;
      } catch(e) { failed++; console.error(`${page} gate=${gate} demo=${demo}: ${e.message}`); }
    }
  }
}
console.log(JSON.stringify({passed,failed,scope:'actual page startup in synthetic VM; no HTTP, report, approval or notification action'}));
process.exitCode=failed?1:0;
