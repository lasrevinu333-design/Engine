import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createManagerHeldReviewPage, MANAGER_HELD_REVIEW_URL} from '../manager-held-review-page.mjs';
import {validateHeldReviewPage} from '../manager-held-review-display.mjs';
import {removeManagerHeldReviewSurface} from '../mobile/scripts/manager-held-review-edition-boundary.mjs';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';

// Pure source/DOM facades and the exact owning backend handler, not a real
// browser, current protected manager registry, Supabase runtime or email test.
export async function runManagerHeldReviewPageTests(backend) {
  const NOW = Date.parse('2026-10-10T14:30:00.000Z'), hash = 'b'.repeat(64);
  const session = () => ({role:'ops_manager',manager_id:'98000000-0000-4000-8000-000000000011',credential_id:'FIXTURE_ONLY',
    device_id:'FIXTURE_BROWSER',token:'SYNTHETIC_NOT_A_CREDENTIAL',expires_at:new Date(NOW+3600000).toISOString(),auth_mode:'fixture_only'});
  const source = id => ({id:`98000000-0000-4000-8000-${String(id).padStart(12,'0')}`,event_id:null,received_at:'2026-10-10T13:00:00.000Z',payload_hash:hash,sync_status:'NEEDS_REVIEW'});
  const row = {ledger_id:source(1).id,event_id:null,revision:null,status:'NEEDS_REVIEW',source:'events_app_outlook_sync',source_provenance_digest:hash,
    received_at:source(1).received_at,review_reason_code:'UNCLASSIFIED_SOURCE_REVIEW',missing_fields:{end_time:'UNKNOWN',venue_reference:'UNKNOWN'},
    published:false,coverage_assigned:false,reminder_eligible:false};
  const one = {schema:'custodial.manager-held-review.v2',source:'events_app_outlook_sync',generated_at:'2026-10-10T14:30:00.000Z',coverage:'held_review_only',
    snapshot_sha256:hash,rows:[row],page_start:0,returned_count:1,consumed_count:1,total_count:1,next_cursor:null};
  const response = (data=one,status=200) => ({status,ok:status===200,text:async()=>JSON.stringify({ok:true,data})});
  const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
  class Target {listeners=new Map(); addEventListener(k,f){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f);}
    removeEventListener(k,f){this.listeners.get(k)?.delete(f);} fire(k,e={}){for(const f of [...(this.listeners.get(k)||[])])f(e);}
    count(){return [...this.listeners.values()].reduce((n,s)=>n+s.size,0);}}
  class Element extends Target {hidden=true;disabled=false;textContent='';innerHTML=''; replaceChildren(){this.innerHTML='';this.textContent='';}}
  function fixture({fetchImpl=async()=>response(),native=false,authImpl}={}) {
    const w=new Target(),d=new Target(),ids=['panel','content','range','refresh','next'],els=Object.fromEntries(ids.map(k=>[k,new Element()]));
    d.hidden=false; d.getElementById=id=>els[id.replace('manager-held-review-','')]||null;w.document=d;
    const timers=new Map(),intervals=new Map();let key=0,authCalls=[],fetches=[],s=session(),time=NOW;
    w.setTimeout=fn=>{const n=++key;timers.set(n,fn);return n;};w.clearTimeout=n=>timers.delete(n);
    w.setInterval=fn=>{const n=++key;intervals.set(n,fn);return n;};w.clearInterval=n=>intervals.delete(n);
    w.MemphisCustodialSecurity={native};w.MemphisAuth={readSession:()=>s,requireOpsManagerSession:async options=>{authCalls.push(options);return authImpl?authImpl(options):s;}};
    const p=createManagerHeldReviewPage({window:w,document:d,fetchImpl:async(...a)=>{fetches.push(a);return fetchImpl(...a);},now:()=>time});
    return {w,d,els,p,authCalls,fetches,timers,intervals,change:v=>{s=v;},session:()=>s,time:v=>time=v,
      guard:()=>{for(const f of [...intervals.values()])f();},expire:()=>{for(const f of [...timers.values()])f();},
      close(){p.stop();assert.equal(timers.size,0);assert.equal(intervals.size,0);assert.equal(w.count()+d.count()+els.refresh.count()+els.next.count(),0);assert.equal(els.content.innerHTML,'');}};
  }
  const cases=[],test=async(name,fn)=>{await fn();cases.push(name);console.log('ok - '+name);};
  await test('PAGE1 manager uses fixed GET and original private binding; terminal controls',async()=>{
    const f=fixture();try{await f.p.init();assert.match(f.els.content.innerHTML,/NEEDS_REVIEW/);assert.equal(f.els.panel.hidden,false);
      assert.equal(f.els.next.disabled,true);assert.match(f.els.range.textContent,/1–1 of 1/);assert.equal(f.fetches.length,1);
      const [raw,options]=f.fetches[0],url=new URL(raw);assert.equal(url.origin+url.pathname,MANAGER_HELD_REVIEW_URL);assert.equal(url.search,'?limit=100');
      assert.deepEqual([options.method,options.cache,options.credentials,options.redirect],['GET','no-store','omit','error']);
      assert.equal(options.headers.Authorization,'Bearer '+f.session().token);assert.equal(options.headers['X-Device-Id'],f.session().device_id);
      assert.equal(f.authCalls[0].forceRefresh,true);assert.equal(f.authCalls[0].interactive,false);assert.equal(f.authCalls[0].redirect,false);
    }finally{f.close();}
  });
  await test('PAGE2 employee/native makes zero auth or reader calls and no listeners/timers',async()=>{
    const f=fixture({native:true});try{await f.p.init();await f.p.next();assert.equal(f.authCalls.length,0);assert.equal(f.fetches.length,0);
      assert.equal(f.els.panel.hidden,true);assert.equal(f.w.count()+f.d.count(),0);assert.equal(f.timers.size+f.intervals.size,0);}finally{f.close();}
  });
  await test('PAGE3 missing manager, expired session and missing device fail before GET',async()=>{
    for(const s of[null,{...session(),role:'employee'},{...session(),device_id:''},{...session(),expires_at:new Date(NOW).toISOString()}]){
      const f=fixture();try{f.change(s);await f.p.init();assert.equal(f.fetches.length,0);assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);}finally{f.close();}}
  });
  await test('PAGE4 original manager change during fetch suppresses returned rows',async()=>{
    const wait=deferred(),f=fixture({fetchImpl:()=>wait.promise});try{const run=f.p.init();await Promise.resolve();await Promise.resolve();await Promise.resolve();
      f.change({...session(),manager_id:'98000000-0000-4000-8000-000000000012'});wait.resolve(response());await run;
      assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);assert.equal(f.els.next.disabled,true);}finally{f.close();}
  });
  await test('PAGE5 same manager but changed token, credential, expiry or device withdraws guard',async()=>{
    for(const change of[{token:'OTHER_SYNTHETIC'},{credential_id:'OTHER'},{expires_at:new Date(NOW+7200000).toISOString()},{device_id:'OTHER_DEVICE'}]){
      const f=fixture();try{await f.p.init();f.change({...session(),...change});f.guard();assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);await f.p.next();assert.equal(f.fetches.length,1);}finally{f.close();}}
  });
  await test('PAGE6 401/403 stays latched without automatic retry; manual normal check permits new instance',async()=>{
    for(const status of[401,403]){let code=status;const f=fixture({fetchImpl:async()=>response(one,code)});try{
      await f.p.init();await f.p.next();f.guard();assert.equal(f.fetches.length,1);assert.match(f.els.content.innerHTML,/authwithdrawn/);
      code=200;await f.p.init();assert.equal(f.fetches.length,2);assert.equal(f.authCalls.filter(v=>v.forceRefresh).length,2);assert.match(f.els.content.innerHTML,/NEEDS_REVIEW/);
    }finally{f.close();}}
  });
  await test('PAGE7 full v2 continuation cursor and changed snapshot 409 never restart first page',async()=>{
    const first={...one,total_count:2,next_cursor:`hr2:1:${hash}`};let n=0;const f=fixture({fetchImpl:async()=>++n===1?response(first):response(one,409)});
    try{await f.p.init();assert.equal(f.els.next.disabled,false);await f.p.next();assert.equal(new URL(f.fetches[1][0]).searchParams.get('cursor'),first.next_cursor);
      assert.match(f.els.content.innerHTML,/unavailable/);assert.equal(f.els.next.disabled,true);await f.p.next();assert.equal(f.fetches.length,2);}finally{f.close();}
  });
  await test('PAGE8 private/foreign envelope, malformed JSON and oversized body never display',async()=>{
    for(const text of[JSON.stringify({ok:true,data:one,meta:{raw:'PRIVATE'}}),'{bad', 'X'.repeat(262145)]){
      const f=fixture({fetchImpl:async()=>({status:200,ok:true,text:async()=>text})});try{await f.p.init();assert.match(f.els.content.innerHTML,/unavailable/);assert.doesNotMatch(f.els.content.innerHTML,/PRIVATE|NEEDS_REVIEW/);}finally{f.close();}}
  });
  await test('PAGE9 auth and reader deadline release bounded wait even if facade ignores abort',async()=>{
    for(const kind of['auth','reader']){const wait=deferred(),f=fixture(kind==='auth'?{authImpl:()=>wait.promise}:{fetchImpl:()=>wait.promise});
      try{const run=f.p.init();for(let i=0;i<12;i++)await Promise.resolve();f.expire();await run;assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);
        assert.equal(f.timers.size,0);wait.resolve(kind==='auth'?session():response());await Promise.resolve();}finally{f.close();}}
  });
  await test('PAGE10 hidden/offline clears data and visible does not auto-fetch',async()=>{
    const f=fixture();try{await f.p.init();f.d.hidden=true;f.d.fire('visibilitychange');assert.equal(f.els.content.innerHTML,'');assert.equal(f.els.panel.hidden,true);
      f.d.hidden=false;f.d.fire('visibilitychange');assert.equal(f.els.panel.hidden,false);assert.equal(f.fetches.length,1);assert.equal(f.intervals.size,0);
      await f.p.init();f.w.fire('offline');assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);assert.equal(f.fetches.length,2);}finally{f.close();}
  });
  await test('PAGE11 lifecycle stop aborts pending response and removes all owned resources',async()=>{
    const wait=deferred(),f=fixture({fetchImpl:()=>wait.promise});const run=f.p.init();for(let i=0;i<12;i++)await Promise.resolve();f.w.fire('pagehide',{persisted:false});
    await run;wait.resolve(response());assert.equal(f.els.panel.hidden,true);f.close();assert.equal(f.els.content.innerHTML,'');
  });
  await test('PAGE12 runtime employee transition purges manager rows without another request',async()=>{
    const f=fixture();try{await f.p.init();f.w.MemphisMobile={edition:'custodial'};f.w.fire('memphis:custodial-security-state');await f.p.init();assert.equal(f.els.panel.hidden,true);
      assert.equal(f.els.content.innerHTML,'');assert.equal(f.fetches.length,1);}finally{f.close();}
  });
  await test('PAGE13 expiry without a request hides rows and disables continuation',async()=>{
    const f=fixture();try{await f.p.init();f.time(NOW+3600000);f.guard();assert.doesNotMatch(f.els.content.innerHTML,/NEEDS_REVIEW/);assert.equal(f.fetches.length,1);}finally{f.close();}
  });
  await test('PAGE14 fresh bfcache restoration checks normal auth instead of reusing old rows',async()=>{
    const f=fixture();try{await f.p.init();f.w.fire('pagehide',{persisted:true});assert.equal(f.els.content.innerHTML,'');assert.equal(f.intervals.size,0);
      f.w.fire('pageshow',{persisted:true});for(let i=0;i<30;i++)await Promise.resolve();assert.equal(f.authCalls.filter(v=>v.forceRefresh).length,2);
      assert.equal(f.fetches.length,2);assert.match(f.els.content.innerHTML,/NEEDS_REVIEW/);}finally{f.close();}
  });
  const rows=Array.from({length:101},(_,i)=>source(i+1));let selects=0;
  const client={from(table){assert.equal(table,'events_app_outlook_sync');selects++;const q={select(cols,opts){assert.equal(cols,'id,event_id,received_at,payload_hash,sync_status');assert.deepEqual(opts,{count:'exact'});return q;},
    like(){return q;},eq(){return q;},order(){return q;},range(){return q;},abortSignal(){return q;},retry(value){assert.equal(value,false);return q;},
    then(resolve,reject){return Promise.resolve({data:rows,count:rows.length,error:null}).then(resolve,reject);}};return q;}};
  // Date.now is real in backend's guard; this fixture uses a current synthetic
  // expiry for that existing check, not a fabricated operational manager.
  const backendExpiry=new Date(Date.now()+3600000).toISOString();
  const backendSession=()=>({...session(),expires_at:backendExpiry});
  const handler=backend.makeBoundManagerHeldReviewHandler({client,requireOpsManagerAuth:async(req,res,next)=>{if(!req.accepted)return res.status(403).json({private:'OMITTED'});req.memphisAuth=backendSession();next();},now:()=>new Date(NOW)});
  async function read(url,options,accepted=true){const req={accepted,query:Object.fromEntries(new URL(url).searchParams),headers:options.headers};
    const res={headersSent:false,writableEnded:false,status(n){this.code=n;return this;},setHeader(){},json(body){this.body=body;this.headersSent=true;this.writableEnded=true;return this;}};
    await handler(req,res);return{status:res.code,ok:res.code===200,text:async()=>JSON.stringify(res.body)};}
  await test('AFFECTED1 exact current bound handler v2 output composes with owning page and continuation',async()=>{
    const f=fixture({fetchImpl:read});try{await f.p.init();assert.match(f.els.content.innerHTML,/NEEDS_REVIEW/);assert.equal(f.els.next.disabled,false);
      assert.match(f.els.range.textContent,/1–100 of 101/);await f.p.next();assert.match(f.els.range.textContent,/101–101 of 101/);assert.equal(f.els.next.disabled,true);
      assert.equal(selects,2);assert.doesNotMatch(f.els.content.innerHTML,/FIXTURE_BROWSER|FIXTURE_ONLY|SYNTHETIC_NOT|98000000/);}finally{f.close();}
  });
  await test('AFFECTED2 exact bound handler changed snapshot rejects continuation without replacing rows',async()=>{
    const f=fixture({fetchImpl:read});try{await f.p.init();rows.push(source(102));await f.p.next();assert.match(f.els.content.innerHTML,/unavailable/);assert.equal(f.fetches.length,2);rows.pop();}finally{f.close();}
  });
  await test('AFFECTED3 exact bound handler denied caller performs zero SELECT and page hides',async()=>{
    const before=selects,f=fixture({fetchImpl:(u,o)=>read(u,o,false)});try{await f.p.init();assert.equal(selects,before);assert.match(f.els.content.innerHTML,/authwithdrawn/);}finally{f.close();}
  });
  await test('GRAPH1 required static import, bare import and re-export mjs dependencies are discovered',async()=>{
    const root=mkdtempSync(resolve(tmpdir(),'custodial-held-graph-'));try{writeFileSync(root+'/index.html','<script type="module" src="./page.mjs"></script>');
      writeFileSync(root+'/page.mjs',"import {x} from './display.mjs';\nimport './bare.mjs';\nexport {y} from './exported.mjs';");
      for(const name of['display','bare','exported'])writeFileSync(root+'/'+name+'.mjs','export const x=1,y=2;');
      assert.deepEqual(discoverRuntimeFiles(root),['bare.mjs','display.mjs','exported.mjs','index.html','page.mjs']);
      rmSync(root+'/display.mjs');assert.throws(()=>discoverRuntimeFiles(root),/Missing local runtime reference/);
    }finally{rmSync(root,{recursive:true});}
  });
  await test('GRAPH2 employee edition removes exactly manager-only additions preserving original Events',async()=>{
    const html=readFileSync(new URL('../events.html',import.meta.url),'utf8'),staff=removeManagerHeldReviewSurface(html),old=readFileSync(process.env.HELD_REVIEW_BASE_FRONTEND+'/events.html','utf8');
    assert.equal(staff,old);assert.doesNotMatch(staff,/manager-held-review/);assert.match(staff,/events-view\.js/);
    assert.throws(()=>removeManagerHeldReviewSurface(staff),/boundary_mismatch/);
    assert.throws(()=>removeManagerHeldReviewSurface(html.replace('id="events-content"','id="events-content" data-manager-held-review="foreign"')),/surface_remaining/);
  });
  await test('GRAPH3 actual mounted source graph includes exactly 3 new manager assets; staff allowlist excludes them',async()=>{
    const root=new URL('..',import.meta.url).pathname,files=discoverRuntimeFiles(root),expected=['manager-held-review-display.mjs','manager-held-review-page.mjs','manager-held-review.css'];
    for(const path of expected)assert.ok(files.includes(path));const build=readFileSync(root+'/mobile/scripts/build.mjs','utf8');
    const block=build.match(/const custodialCompatibilityFiles = new Set\(\[([\s\S]*?)\]\);/)[1];
    for(const path of expected)assert.ok(!block.includes(path));assert.match(build,/html = removeManagerHeldReviewSurface\(html\)/);
  });
  await test('GRAPH4 fixed page has no intake action, cache, credential value output, caller URL or new browser auth',async()=>{
    const src=readFileSync(new URL('../manager-held-review-page.mjs',import.meta.url),'utf8');
    assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB|console\.|method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]|getDeviceId|source_event_key|service_role/);
    assert.equal((src.match(/https:\/\/memphis-zoo-mcp\.onrender\.com/g)||[]).length,1);
    const html=readFileSync(new URL('../events.html',import.meta.url),'utf8');assert.equal((html.match(/src="\.\/manager-held-review-page.mjs"/g)||[]).length,1);
    assert.match(html,/<section id="manager-held-review-panel" hidden/);assert.match(html,/script-src 'self'/);
  });
  return {status:'NEW_MANAGER_PAGE14_AFFECTED_BOUND_READER3_ESM_EDITION_GRAPH4_SOURCE_PASS',cases,
    new_page:14,affected_owning_backend_source_compositions:3,new_graph_edition:4,scopes_not_summed_with_prior_tests:true,
    all_synthetic_DOM_listeners_timers_promises_closed:true,no_actual_browser_SQL_manager_registry_auth_email_phone_build_or_final_audit:true};
}
