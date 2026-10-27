import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';

// Actual shared UI source in a deliberately small DOM seam. These are not
// rendered-browser, named-manager, print-download, or physical keyboard proofs.
const root=resolve(new URL('..',import.meta.url).pathname);
const read=file=>readFileSync(resolve(root,file),'utf8');
const html=read('coverall-print.html'),shared=read('memphis-ui.js');
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

function harness({dirty=false,confirm=true,native=false,pending=null,framed=false}={}){
  const documentEvents=new Map(),windowEvents=new Map(),assignments=[],confirmations=[];
  class Element {
    constructor(){this.dataset={};this.attributes={};this.classes=new Set();this.classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value)};}
    setAttribute(name,value){this.attributes[name]=value;}
    addEventListener(){}
  }
  class Anchor extends Element {closest(selector){return selector==='[data-mz-back]'?this:null;}}
  class Form extends Element {}
  const back=new Anchor(),form=new Form();back.href='./start_page1.html';back.textContent='Back';
  const document={readyState:'loading',body:{dataset:{memphisContext:'manager'}},documentElement:new Element(),
    querySelectorAll:selector=>selector==='[data-mz-back]'?[back]:selector==="form[data-mz-protect-unsaved='true']"?(dirty?[form]:[]):[],
    addEventListener:(name,handler,options)=>documentEvents.set(name,{handler,options})};
  const window={location:{href:'https://fixture.invalid/coverall-print.html?date=2026-10-12&hub=employee&device=KIOSK_08',assign:value=>assignments.push(value)},
    addEventListener:(name,handler)=>windowEvents.set(name,handler),confirm:message=>{confirmations.push(message);return confirm;}};
  window.self=window;window.top=framed?{location:{replace:()=>{throw Error('fixture frame navigation denied');}}}:window;
  if(native){window.MemphisCustodialSecurity={native:true,getStatus:()=>({ready:true,available:true,deviceId:'KIOSK_08'})};window.MemphisMobile={edition:'custodial',ready:pending};}
  const storage={getItem:()=>null};
  vm.runInNewContext(shared,{window,document,navigator:{userAgent:'source-fixture'},localStorage:storage,sessionStorage:storage,
    URL,Element,HTMLAnchorElement:Anchor,HTMLFormElement:Form,console:{error:message=>{throw Error(message);}}},{filename:'memphis-ui.js'});
  documentEvents.get('DOMContentLoaded').handler();
  if(dirty)form.dataset.mzDirty='true';
  const click=(target=back,detail=1)=>{const event={target,detail,prevented:false,stopped:false,
    preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    documentEvents.get('click').handler(event);return event;};
  return {window,document,documentEvents,windowEvents,back,form,assignments,confirmations,click};
}

test('one accessible canonical Hub control and the actual shared owner are shipped before print',()=>{
  assert.equal((html.match(/data-mz-back(?:\s|=|>)/g)||[]).length,1);
  assert.match(html,/id="back"[^>]*data-mz-back[^>]*href="\.\/start_page1\.html"[^>]*aria-label="Back"[^>]*>Back</);
  const paths=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(([,value])=>new URL(value,'https://fixture.invalid/'));
  for(const file of ['memphis-ui.js','coverall-print.js'])assert.equal(paths.filter(url=>url.origin==='https://fixture.invalid'&&url.pathname==='/'+file).length,1);
  assert.ok(paths.findIndex(url=>url.pathname==='/memphis-ui.js')<paths.findIndex(url=>url.pathname==='/coverall-print.js'));
});
test('actual shared source respects explicit manager context rather than employee URL hints',()=>{
  const h=harness();assert.equal(h.window.MemphisUI.resolvedContext(),'manager');
  assert.equal(h.back.href,'https://fixture.invalid/start_page1.html');assert.equal(h.back.attributes['aria-label'],'Back');
});
test('captured click still returns to Hub after the untouched print controller changes href',async()=>{
  const h=harness();h.back.href='./schedule-weekly.html?date=2026-10-12';
  const event=h.click();await settle();assert.equal(event.prevented,true);assert.equal(event.stopped,true);
  assert.deepEqual(h.assignments,['https://fixture.invalid/start_page1.html']);assert.equal(h.documentEvents.get('click').options,true);
});
test('keyboard-equivalent click(detail 0) uses the same actual shared handler, not real keyboard proof',async()=>{
  const h=harness();h.back.href='./schedule-weekly.html?date=2026-10-12';h.click(h.back,0);await settle();
  assert.deepEqual(h.assignments,['https://fixture.invalid/start_page1.html']);
});
test('nested click target resolves its canonical control',async()=>{
  const h=harness();h.click({closest:selector=>selector==='[data-mz-back]'?h.back:null});await settle();
  assert.deepEqual(h.assignments,['https://fixture.invalid/start_page1.html']);
});
test('unrelated clicks retain their own default and propagation',async()=>{
  const h=harness(),event=h.click({closest:()=>null});await settle();
  assert.equal(event.prevented,false);assert.equal(event.stopped,false);assert.deepEqual(h.assignments,[]);
});
test('existing unsaved-work refusal blocks canonical navigation',async()=>{
  const h=harness({dirty:true,confirm:false}),event=h.click();await settle();
  assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(h.confirmations.length,1);assert.deepEqual(h.assignments,[]);
});
test('existing unsaved-work acceptance permits only canonical Hub navigation',async()=>{
  const h=harness({dirty:true});h.click();await settle();assert.equal(h.confirmations.length,1);
  assert.deepEqual(h.assignments,['https://fixture.invalid/start_page1.html']);
});
test('existing native authority readiness is awaited without substituting credentials or device identity',async()=>{
  let ready;const pending=new Promise(resolveReady=>{ready=resolveReady;}),h=harness({native:true,pending});
  h.click();await settle();assert.deepEqual(h.assignments,[]);ready();await settle();
  assert.deepEqual(h.assignments,['https://fixture.invalid/start_page1.html']);
});
test('existing denied framed navigation hides content rather than weakening the top-level guard',()=>{
  const h=harness({framed:true});assert.equal(h.document.documentElement.hidden,true);
});

function executeOwningContract(file,overrides){
  const source=read(file).replace(/^import .*;\n/gm,'').replace(/const root =?[^\n]*;\n/,'');
  // These two owners have different declarations; replace only the source read
  // binding. All actual assertions, including strict dependency checks, execute.
  const body=source.replace(/const root=resolve\(new URL\('\.\.',import\.meta\.url\)\.pathname\),read=file=>readFileSync\(resolve\(root,file\),'utf8'\);/,
    'const read=fixtureRead;').replace(/const read = \(file\) => readFileSync\(resolve\(root, file\), 'utf8'\);/,'const read=fixtureRead;');
  vm.runInNewContext(body,{assert,fixtureRead:file=>overrides[file]??read(file),root,
    URL,vm,resolve,existsSync:file=>{try{readFileSync(file);return true;}catch{return false;}},
    statSync:file=>({size:readFileSync(file).length}),console:{log:()=>{}}},{filename:file});
}
test('actual scheduler owner rejects reordered helper, external substitute and duplicate dependency',()=>{
  const page=read('schedule-weekly.html'),tags=[...page.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
  const helper=tags.find(match=>new URL(match[1],'https://source-contract.invalid').pathname==='/memphis-approved-schedule.js')[0];
  const controller=tags.find(match=>new URL(match[1],'https://source-contract.invalid').pathname==='/schedule-weekly.js')[0];
  assert.throws(()=>executeOwningContract('scripts/schedule-weekly-contract-tests.mjs',{'schedule-weekly.html':page.replace(helper,'').replace(controller,controller+helper)}),/helper must load before/);
  assert.throws(()=>executeOwningContract('scripts/schedule-weekly-contract-tests.mjs',{'schedule-weekly.html':page.replace(helper,helper.replace('./memphis-approved-schedule.js','https://external.invalid/memphis-approved-schedule.js'))}),/one shipped local page dependency/);
  assert.throws(()=>executeOwningContract('scripts/schedule-weekly-contract-tests.mjs',{'schedule-weekly.html':page.replace(helper,helper+helper)}),/one shipped local page dependency/);
});
test('actual Unity owner rejects disconnected shared print owner, duplicate Back and obsolete mutable print route',()=>{
  assert.throws(()=>executeOwningContract('scripts/unity-polish-contract-tests.mjs',{'coverall-print.html':html.replace(/<script src="\.\/memphis-ui\.js[^>]*><\/script>/,'')}),/shared interaction owner/);
  assert.throws(()=>executeOwningContract('scripts/unity-polish-contract-tests.mjs',{'coverall-print.html':html.replace('id="back"','data-mz-back id="back"')}),/exactly one canonical/);
  assert.throws(()=>executeOwningContract('scripts/unity-polish-contract-tests.mjs',{'coverall-print.js':read('coverall-print.js')+"\nconst obsolete='/dashboard-api/coverall-printable';"}),/retired dashboard print route/);
});

// Whole print controller + actual scheduler principal/permission helpers.
// DOM, manager session, files and transport are synthetic; no request escapes VM.
const printTurn=()=>new Promise(resolveTurn=>setImmediate(resolveTurn));
async function printUntil(predicate){
  for(let i=0;i<500;i++){if(predicate())return;await printTurn();}
  assert.fail('Print lifetime fixture did not reach the selected boundary');
}
function printLifetime({pause=null,storage=new Map()}={}){
  const trace=[],requests=[],intervals=new Map(),timers=new Map(),windowEvents=new Map(),created=[],revoked=[],hits=[];
  let nextTimer=0,headers=0,snapshots=0,digests=0,release,releaseError,linkMode='success',nonce=0;
  const pending=new Promise((resolvePending,rejectPending)=>{release=resolvePending;releaseError=rejectPending;});
  let pausedValue;
  async function boundary(stage,value){hits.push(stage);if(stage===pause){pausedValue=value;return pending;}return value;}
  class Element{
    constructor(id){this.id=id;this.listeners=new Map();this.children=[];this.disabled=id==='prepare';this.hidden=['downloads','copy-section'].includes(id);this.value='';this.textContent=id==='status'?'Verifying manager access…':'';return new Proxy(this,{set(target,key,value){trace.push(['set',id,key]);target[key]=value;return true;}});}
    addEventListener(name,callback){trace.push(['listen',this.id,name]);this.listeners.set(name,callback);}
    removeEventListener(name,callback){if(this.listeners.get(name)===callback)this.listeners.delete(name);}
    replaceChildren(){trace.push(['clear',this.id]);this.children=[];}
    append(value){trace.push(['append',this.id]);this.children.push(value);}
  }
  const ids=['prepare','date','back','status','downloads','copy-section','copy-text','link-controls','capacity-select','link-hours','create-link','revoke-link','link-status','secure-links'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  elements['link-hours'].value='24';
  const session={role:'ops_manager',manager_id:'98000000-0000-4000-8000-000000000009',
    credential_id:'synthetic-credential',device_id:'synthetic-device',token:'synthetic-not-a-credential',
    expires_at:'2099-01-01T00:00:00.000Z',read_only:false,
    permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}};
  const snapshot={week_start:'2026-10-12',projection_status:'current',authority_revision:7,
    current_publication:{publication_id:'98000000-0000-4000-8000-000000000002'},
    latest_projection:{projection_id:'98000000-0000-4000-8000-000000000003',replay_digest:'b'.repeat(64)}};
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const texts='Synthetic English / Español retained route text';
  const pair={schema:'custodial.coverall-pdf-pair.v1',document:{serviceDate:'2026-10-12',authorityRevision:7,
    projectionId:snapshot.latest_projection.projection_id,publicationId:snapshot.current_publication.publication_id,
    replayDigest:snapshot.latest_projection.replay_digest,managerContact:{managerId:session.manager_id},
    documentDigest:'a'.repeat(64),contractors:[{slotId:'98000000-0000-4000-8000-000000000010',name:'Synthetic route'}]},
    files:['en','es'].map(language=>{const bytes=Buffer.from('%PDF synthetic '+language);return{language,filename:'CoverAll_2026-10-12_r7_'+language+'.pdf',sha256:hash(bytes),base64:bytes.toString('base64')};}),
    texts:[{language:'en-es',documentDigest:'a'.repeat(64),text:texts,sha256:hash(texts)}]};
  const both=Buffer.from('%PDF synthetic en-es');pair.bilingualFile={language:'en-es',filename:'CoverAll_2026-10-12_r7_en-es.pdf',sha256:hash(both),base64:both.toString('base64')};
  class FixtureURL extends URL{
    static createObjectURL(blob){const url='blob:synthetic-'+(created.length+1);created.push({url,blob});return url;}
    static revokeObjectURL(url){revoked.push(url);}
  }
  const context=vm.createContext({
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)},
    location:{search:'?date=2026-10-12&expected_revision=7&projection_id='+snapshot.latest_projection.projection_id},
    MemphisAuth:{readSession:()=>session,requireOpsManagerSession:()=>boundary('auth',undefined),
      opsManagerAuthHeaders:()=>boundary('headers-'+(++headers),{'x-synthetic-auth':'fixture-only'}),
      getCSTDateString:()=>'2026-10-12'},
    fetch:async(url,options)=>{
      requests.push({url,options});
      let value,stage;
      if(url==='https://memphis-zoo-mcp.onrender.com/scheduler-runtime-config'){
        value={ok:true,data:{public_url:'https://synthetic-service.onrender.com'}};stage='config';
      }else if(url.startsWith('https://synthetic-service.onrender.com/static-weekly/manager-snapshot?')){
        value={ok:true,data:snapshot};stage='snapshot-'+(++snapshots);
      }else if(url.startsWith('https://synthetic-service.onrender.com/static-weekly/coverall-print?')){
        value={ok:true,data:pair};stage='files';
      }else if(url==='https://synthetic-service.onrender.com/static-weekly/coverall-links'){
        const body=JSON.parse(options.body);if(linkMode==='lost')throw Error('Synthetic original link response lost');
        value={ok:true,data:{schema:'custodial.coverall-canonical-link.v1',link_id:body.request_id,
          capacity_id:linkMode==='stale'?'98000000-0000-4000-8000-000000000099':body.capacity_id,
          service_date:body.service_date,authority_revision:body.expected_revision,projection_id:body.projection_id,
          expires_at:new Date(Date.now()+body.ttl_hours*3600000-1000).toISOString(),
          assignment_path:'/static-weekly/coverall-links/assignment?lang=both#access_token='+('A'.repeat(43))}};stage='link-create';
      }else if(url==='https://synthetic-service.onrender.com/static-weekly/coverall-links/revoke'){
        const body=JSON.parse(options.body);value={ok:true,data:{link_id:linkMode==='wrong-revoke'?'98000000-0000-4000-8000-000000000099':body.link_id,revoked:true}};stage='link-revoke';
      }else throw Error('Unexpected fixture URL: '+url);
      return boundary(stage,{ok:true,status:200,json:()=>boundary(stage+'-json',value)});
    },
    crypto:{randomUUID:()=> '98000000-0000-4000-8000-'+String(30+(++nonce)).padStart(12,'0'),subtle:{digest:async(algorithm,bytes)=>boundary('digest-'+(++digests),await webcrypto.subtle.digest(algorithm,bytes))}},
    atob:value=>Buffer.from(value,'base64').toString('binary'),URL:FixtureURL,URLSearchParams,TextEncoder,Uint8Array,Blob,AbortSignal,AbortController,
    setInterval:callback=>{const id=++nextTimer;trace.push(['interval',id]);intervals.set(id,callback);return id;},
    clearInterval:id=>intervals.delete(id),
    setTimeout:callback=>{const id=++nextTimer;trace.push(['timeout',id]);timers.set(id,callback);return id;},
    clearTimeout:id=>timers.delete(id),
    addEventListener:(name,callback)=>windowEvents.set(name,callback)
  });
  vm.runInContext(read('memphis-scheduler-actions.js'),context,{filename:'memphis-scheduler-actions.js'});
  vm.runInContext(read('coverall-print.js'),context,{filename:'coverall-print.js'});
  return{trace,requests,intervals,timers,elements,created,revoked,hits,session,pair,snapshot,storage,
    setLinkMode:value=>{linkMode=value;},context,
    resume:()=>release(pausedValue),reject:()=>releaseError(Error('Synthetic late authentication failure')),
    retire:()=>{windowEvents.get('pagehide')();windowEvents.delete('pagehide');},
    click:()=>elements.prepare.listeners.get('click')?.(),
    ready:()=>printUntil(()=>elements.prepare.disabled===false),
    paused:()=>printUntil(()=>hits.includes(pause))};
}

test('NEW print lifetime closes pending auth without config fetch or late failure rendering',async()=>{
  for(const reject of [false,true]){
    const h=printLifetime({pause:'auth'});await h.paused();h.retire();const retired=h.trace.length,status=h.elements.status.textContent;
    if(reject)h.reject();else h.resume();
    for(let i=0;i<20;i++)await printTurn();
    assert.equal(h.requests.length,0);assert.equal(h.intervals.size,0);assert.equal(h.timers.size,0);
    assert.equal(h.elements.prepare.disabled,true);assert.equal(h.elements.prepare.listeners.size,0);
    assert.equal(h.trace.length,retired);assert.equal(h.elements.status.textContent,status);assert.equal(h.created.length,0);
  }
});
test('NEW print lifetime closes config fetch and JSON before enabling or installing callbacks',async()=>{
  for(const pause of ['config','config-json']){
    const h=printLifetime({pause});await h.paused();h.retire();const retired=h.trace.length;
    h.resume();for(let i=0;i<20;i++)await printTurn();
    assert.equal(h.requests.length,1);assert.equal(h.requests[0].options.signal.aborted,true);
    assert.equal(h.trace.length,retired);assert.equal(h.intervals.size,0);assert.equal(h.timers.size,0);
    assert.equal(h.elements.prepare.disabled,true);assert.equal(h.elements.prepare.listeners.size,0);
    if(pause==='config')assert.equal(h.hits.includes('config-json'),false);
  }
});
test('NEW print lifetime retires headers, JSON and digest continuations without later reads or links',async t=>{
  for(const pause of ['headers-1','snapshot-1','snapshot-1-json','files-json','digest-1','digest-4','headers-3','snapshot-2-json']){
    await t.test(pause,async()=>{
      const h=printLifetime({pause});await h.ready();
      const queuedClick=h.elements.prepare.listeners.get('click'),queuedDate=h.elements.date.listeners.get('change');
      const queuedGuard=[...h.intervals.values()][0];
      h.click();await h.paused();const requests=h.requests.length,digests=h.hits.filter(x=>x.startsWith('digest-')).length;
      h.retire();const retired=h.trace.length;
      h.resume();queuedClick();queuedDate();queuedGuard();for(let i=0;i<30;i++)await printTurn();
      assert.equal(h.requests.length,requests);assert.equal(h.hits.filter(x=>x.startsWith('digest-')).length,digests);
      assert.equal(h.trace.length,retired);assert.equal(h.created.length,0);assert.equal(h.intervals.size,0);assert.equal(h.timers.size,0);
      assert.equal(h.elements.prepare.disabled,true);assert.equal(h.elements.prepare.listeners.size,0);assert.equal(h.elements.date.listeners.size,0);
      assert.equal(h.elements.downloads.children.length,0);
      if(['snapshot-1','snapshot-1-json','files-json','snapshot-2-json'].includes(pause))
        assert.equal(h.requests.at(-1).options.signal.aborted,true);
      if(pause==='snapshot-1')assert.equal(h.hits.includes('snapshot-1-json'),false);
      for(const request of h.requests.slice(1))assert.equal(request.options.method,'GET');
    });
  }
});
test('NEW print lifetime healthy current owner verifies EN ES bilingual bytes and late owner change refuses',async()=>{
  const h=printLifetime();await h.ready();h.click();
  await printUntil(()=>h.elements.status.textContent.startsWith('Verified '));
  assert.equal(h.requests.length,4);assert.equal(h.hits.filter(x=>x.startsWith('digest-')).length,4);
  assert.deepEqual(h.elements.downloads.children.map(x=>x.download),['CoverAll_2026-10-12_r7_en.pdf','CoverAll_2026-10-12_r7_es.pdf','CoverAll_2026-10-12_r7_en-es.pdf']);
  assert.equal(h.created.length,3);assert.equal(h.elements['copy-text'].textContent,h.pair.texts[0].text);
  for(let i=0;i<3;i++)assert.deepEqual(Buffer.from(await h.created[i].blob.arrayBuffer()),Buffer.from([...h.pair.files,h.pair.bilingualFile][i].base64,'base64'));
  h.retire();assert.equal(h.revoked.length,3);assert.equal(h.intervals.size,0);assert.equal(h.timers.size,0);
  const changed=printLifetime({pause:'headers-1'});await changed.ready();changed.click();await changed.paused();
  changed.session.credential_id='different-synthetic-credential';changed.resume();
  await printUntil(()=>changed.elements.status.textContent.startsWith('Manager access changed'));
  assert.equal(changed.requests.length,1);assert.equal(changed.created.length,0);assert.equal(changed.elements.prepare.disabled,true);changed.retire();
});

// New canonical capability uses only the accepted document's explicit slot UUID.
const linkRequests=h=>h.requests.filter(r=>r.url.endsWith('/static-weekly/coverall-links'));
const revokeRequests=h=>h.requests.filter(r=>r.url.endsWith('/static-weekly/coverall-links/revoke'));
async function preparedCapacity(h){await h.ready();h.click();await printUntil(()=>h.elements.downloads.hidden===false);h.elements['capacity-select'].value=h.pair.document.contractors[0].slotId;h.elements['capacity-select'].listeners.get('change')();}
test('canonical selected-capacity link issues once, binds exact body, keeps token out of recovery storage and preserves PDFs',async()=>{
 const h=printLifetime();await preparedCapacity(h);assert.equal(h.created.length,3);
 h.elements['create-link'].listeners.get('click')();await printUntil(()=>h.elements['secure-links'].children.length===3);
 assert.equal(linkRequests(h).length,1);const body=JSON.parse(linkRequests(h)[0].options.body);
 assert.deepEqual(Object.keys(body).sort(),['request_id','week_start','service_date','expected_revision','projection_id','capacity_id','ttl_hours'].sort());
 assert.equal(body.capacity_id,h.pair.document.contractors[0].slotId);assert.equal(body.expected_revision,7);assert.equal(body.ttl_hours,24);
 assert.equal(body.capacity_id.includes('COVERALL_'),false);assert.equal(h.created.length,3);
 for(const a of h.elements['secure-links'].children){const u=new URL(a.href);assert.equal(u.origin,'https://synthetic-service.onrender.com');assert.equal(u.pathname,'/static-weekly/coverall-links/assignment');assert.deepEqual([...u.searchParams.keys()],['lang']);assert.match(u.hash,/^#access_token=/);assert.equal(a.rel,'noreferrer noopener');}
 assert.equal([...h.storage.values()].some(value=>value.includes('access_token')||value.includes('A'.repeat(43))),false);
 h.elements['create-link'].listeners.get('click')();await printTurn();assert.equal(linkRequests(h).length,1,'saved request is never blindly reminted');
 h.elements['revoke-link'].listeners.get('click')();await printUntil(()=>h.storage.size===0);assert.deepEqual(JSON.parse(revokeRequests(h)[0].options.body),{link_id:body.request_id});assert.equal(h.elements['secure-links'].children.length,0);h.retire();
});
test('unknown link response persists original request, reload never recreates token, exact revoke permits a fresh explicit identity',async()=>{
 const h=printLifetime();await preparedCapacity(h);h.setLinkMode('lost');h.elements['create-link'].listeners.get('click')();await printUntil(()=>h.elements['revoke-link'].disabled===false);
 const body=JSON.parse(linkRequests(h)[0].options.body);assert.equal(h.storage.size,1);assert.equal(h.elements['secure-links'].children.length,0);
 h.elements['create-link'].listeners.get('click')();await printTurn();assert.equal(linkRequests(h).length,1);h.retire();
 const resumed=printLifetime({storage:h.storage});await resumed.ready();assert.equal(linkRequests(resumed).length,0);assert.equal(resumed.elements['revoke-link'].disabled,false);
 resumed.elements['revoke-link'].listeners.get('click')();await printUntil(()=>resumed.storage.size===0);assert.equal(JSON.parse(revokeRequests(resumed)[0].options.body).link_id,body.request_id);resumed.retire();
});
test('missing/legacy/unaccepted capacity never invokes issuance',async()=>{
 for(const capacity of ['', 'COVERALL_01','98000000-0000-4000-8000-000000000099']){
  const h=printLifetime();await preparedCapacity(h);h.elements['capacity-select'].value=capacity;h.elements['create-link'].listeners.get('click')();await printTurn();await printTurn();assert.equal(linkRequests(h).length,0);assert.equal(h.storage.size,0);h.retire();
 }
});
test('mismatched capacity response is never displayed and wrong revoke ACK cannot erase original request',async()=>{
 const h=printLifetime();await preparedCapacity(h);h.setLinkMode('stale');h.elements['create-link'].listeners.get('click')();await printUntil(()=>h.elements['revoke-link'].disabled===false);
 assert.equal(h.elements['secure-links'].children.length,0);assert.equal(h.storage.size,1);h.setLinkMode('wrong-revoke');h.elements['revoke-link'].listeners.get('click')();await printUntil(()=>h.elements['revoke-link'].disabled===false);assert.equal(h.storage.size,1);h.retire();
});
test('pure link validator rejects unaccepted identities, expiry, foreign URL and query token',()=>{
 const ctx={module:{exports:{}},URL,Date};vm.runInNewContext(read('coverall-print.js'),ctx);const api=ctx.module.exports;
 assert.throws(()=>api.acceptedCapacities({contractors:[{slotId:'COVERALL_01',name:'Legacy'}]}));
 const capacity='98000000-0000-4000-8000-000000000010',request='98000000-0000-4000-8000-000000000030',projection='98000000-0000-4000-8000-000000000003';
 const expected={date:'2026-10-12',revision:7,projectionId:projection},options={expected,capacityId:capacity,requestId:request,base:'https://synthetic-service.onrender.com',ttlHours:24};
 const good={schema:'custodial.coverall-canonical-link.v1',link_id:request,capacity_id:capacity,service_date:expected.date,authority_revision:7,projection_id:projection,expires_at:new Date(Date.now()+3600000).toISOString(),assignment_path:'/static-weekly/coverall-links/assignment?lang=both#access_token='+('A'.repeat(43))};
 assert.equal(api.validateCanonicalLink(good,options).length,3);
 for(const patch of [{capacity_id:request},{link_id:capacity},{authority_revision:8},{projection_id:request},{expires_at:new Date(Date.now()-1).toISOString()},{assignment_path:'https://foreign.invalid/?lang=both#access_token='+('A'.repeat(43))},{assignment_path:'/static-weekly/coverall-links/assignment?lang=both&access_token='+('A'.repeat(43))},{assignment_path:'/static-weekly/coverall-links/assignment?lang=both#access_token=short'}])assert.throws(()=>api.validateCanonicalLink({...good,...patch},options));
});
