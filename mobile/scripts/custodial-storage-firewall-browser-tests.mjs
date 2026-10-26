#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

if(process.argv.includes('--original-realm-only')||process.argv.includes('--original-realm-existing-worker-only')||process.argv.includes('--original-realm-lifecycle-only')){
  const lifecycleOnly=process.argv.includes('--original-realm-lifecycle-only');
  const existingWorkerOnly=process.argv.includes('--original-realm-existing-worker-only');
  const sourcePath=process.argv.find(arg=>arg.startsWith('--realm-source='))?.slice('--realm-source='.length);
  assert(sourcePath,'Exact emitted Java fixture source path is required');
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(sourcePath,'utf8');
  const browser=await chromium.launch({headless:true}),checks=[];
  let contexts=0,closed=false;
  const policy="frame-src 'none'; worker-src 'none'; object-src 'none'";
  const portFixture=String.raw`
    const portEvents=new EventTarget(),messages=[],violations=[];
    const port=Object.freeze({postMessage:raw=>messages.push(JSON.parse(raw)),
      addEventListener:portEvents.addEventListener.bind(portEvents),
      removeEventListener:portEvents.removeEventListener.bind(portEvents)});
    Object.defineProperty(globalThis,'custodialOriginalBrowserPreparation',{value:port});
    globalThis.realmFixture={messages,violations,emit(phase,command='REALM_FENCE',grant='a'.repeat(64)){
      const request={schema:'custodial.native-original-browser-capture-request.v1',command,
        grant_token:grant,request_nonce:'c'.repeat(64),phase_nonce:phase,
        operation_id:'11111111-1111-4111-8111-111111111111',frame_sha256:'e'.repeat(64),
        original_generation_id:'22222222-2222-4222-8222-222222222222',native_mutation_stamp:'SYNTHETIC_REPRESENTATION_ONLY'};
      portEvents.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(request)}));
    }};
    addEventListener('securitypolicyviolation',event=>violations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
  `;
  async function pageFor(withPolicy,existingContext=null){
    const context=existingContext||await browser.newContext({serviceWorkers:'allow'});if(!existingContext)contexts++;
    const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(6000);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='https://localhost')return route.abort();
      if(url.pathname==='/realm-fixture.html')return route.fulfill({contentType:'text/html',body:
        '<!doctype html><html><head><meta charset="utf-8">'+(withPolicy?'<meta http-equiv="Content-Security-Policy" content="'+policy+'">':'')+
        '<script src="/ordinary.js"></script></head><body>Owned realm fixture</body></html>'});
      if(url.pathname==='/ordinary.js')return route.fulfill({contentType:'application/javascript',body:'globalThis.ordinaryScriptRan=true;'});
      return route.fulfill({status:404,body:'Owned fixture only'});
    });
    await page.addInitScript({content:portFixture+'\n'+source});
    await page.goto('https://localhost/realm-fixture.html');
    assert.equal(await page.evaluate(()=>globalThis.ordinaryScriptRan),true,'ordinary application script remains usable');
    return {page,context};
  }
  async function reply(page,phase){
    await page.evaluate(value=>realmFixture.emit(value),phase);
    await page.waitForFunction(value=>realmFixture.messages.some(message=>message.phase_nonce===value),phase);
    return page.evaluate(value=>realmFixture.messages.find(message=>message.phase_nonce===value),phase);
  }
  try{
    if(lifecycleOnly){
      const good=await pageFor(true);
      try{
        const initial=await reply(good.page,'1'.repeat(64));
        assert.equal(initial.state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
        await good.page.evaluate(()=>realmFixture.emit('0'.repeat(64),'CLOSE','f'.repeat(64)));
        assert.equal(await good.page.evaluate(()=>realmFixture.messages.filter(message=>message.schema.includes('retired')||message.schema.includes('withdrawal')).length),0,
          'A foreign grant cannot retire this original document');
        assert.equal((await reply(good.page,'a'.repeat(64))).state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
        // Dispatch the real platform registration query, then CLOSE in the
        // same JS stack before any Promise continuation can publish.
        await good.page.evaluate(()=>{realmFixture.emit('b'.repeat(64));realmFixture.emit('2'.repeat(64),'CLOSE');});
        await good.page.waitForFunction(()=>realmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-document-retired.v1'));
        let notices=await good.page.evaluate(()=>realmFixture.messages.filter(message=>message.schema.includes('retired')||message.schema.includes('withdrawal')));
        assert.deepEqual(notices,[{schema:'custodial.native-original-browser-document-retired.v1',reply_token:'b'.repeat(64)}]);
        assert.equal((await reply(good.page,'3'.repeat(64))).state,'UNRESOLVED_RETAINED',
          'Normal CLOSE consumes this closure; no same-document ready/current observation');
        await good.page.evaluate(()=>realmFixture.emit('4'.repeat(64),'CLOSE'));
        notices=await good.page.evaluate(()=>realmFixture.messages.filter(message=>message.schema.includes('retired')||message.schema.includes('withdrawal')));
        assert.equal(notices.length,1,'Repeated CLOSE cannot manufacture another retirement or revive the consumed document');
        await good.page.evaluate(async()=>{await navigator.serviceWorker.getRegistrations();await new Promise(resolve=>setTimeout(resolve,50));});
        assert.equal(await good.page.evaluate(()=>realmFixture.messages.some(message=>message.phase_nonce==='b'.repeat(64))),false,
          'A request pending before CLOSE cannot publish a late observation or restore its busy state');
        checks.push('actual normal CLOSE emits only one authenticated document-retired notice and same document stays consumed');
        // A new platform document-start execution is required. Reusing the
        // old closure or calling a ready/reset helper never creates a successor.
        await good.page.reload();
        assert.equal(await good.page.evaluate(()=>realmFixture.messages.length),0,'New page owns an independent private closure');
        assert.equal((await reply(good.page,'5'.repeat(64))).state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
        checks.push('only actual next document navigation reexecutes sidecar and permits fresh realm DATA; not native authority');
      }finally{await good.context.close();contexts--;}
      const invalid=await pageFor(true);
      try{
        assert.equal((await reply(invalid.page,'6'.repeat(64))).state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
        const refused=await invalid.page.evaluate(()=>{
          try{document.createElement('iframe');return false;}
          catch(error){return error.message==='custodial_original_browser_realm_creation_refused';}
        });assert.equal(refused,true);
        await invalid.page.waitForFunction(()=>realmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-realm-withdrawal.v1'));
        await invalid.page.evaluate(()=>realmFixture.emit('7'.repeat(64),'CLOSE'));
        assert.equal((await reply(invalid.page,'8'.repeat(64))).state,'UNRESOLVED_RETAINED');
        const notices=await invalid.page.evaluate(()=>realmFixture.messages.filter(message=>message.schema.includes('retired')||message.schema.includes('withdrawal')));
        assert.deepEqual(notices,[{schema:'custodial.native-original-browser-realm-withdrawal.v1',reply_token:'b'.repeat(64)}],
          'Actual realm violation remains permanent withdrawal; later CLOSE cannot relabel it as recoverable retirement');
        assert.equal(await invalid.page.locator('iframe,frame,object,embed').count(),0);
        checks.push('forbidden realm still emits permanent withdrawal; later CLOSE/current request cannot convert or revive it');
      }finally{await invalid.context.close();contexts--;}
      for(const retirement of ['CLOSE','pagehide-event'])for(const fault of ['forbidden-iframe','controllerchange-event']){
        const afterClose=await pageFor(true);
        try{
          assert.equal((await reply(afterClose.page,'9'.repeat(64))).state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
          await afterClose.page.evaluate(kind=>{
            if(kind==='CLOSE')realmFixture.emit('a'.repeat(64),'CLOSE');
            else dispatchEvent(new Event('pagehide')); // denial-only event delivery, no navigation claim
          },retirement);
          assert.equal((await reply(afterClose.page,'c'.repeat(64))).state,'UNRESOLVED_RETAINED');
          const denied=await afterClose.page.evaluate(kind=>{
            if(kind==='controllerchange-event'){
              // Denial-only delivery of the existing platform event hook;
              // this is not a fabricated service-worker observation.
              navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));return true;
            }
            try{document.createElement('iframe');return false;}
            catch(error){return error.message==='custodial_original_browser_realm_creation_refused';}
          },fault);assert.equal(denied,true);
          await afterClose.page.waitForFunction(()=>realmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-realm-withdrawal.v1'));
          await afterClose.page.evaluate(()=>realmFixture.emit('d'.repeat(64),'CLOSE'));
          assert.equal((await reply(afterClose.page,'e'.repeat(64))).state,'UNRESOLVED_RETAINED');
          const notices=await afterClose.page.evaluate(()=>realmFixture.messages.filter(message=>message.schema.includes('retired')||message.schema.includes('withdrawal')));
          assert.deepEqual(notices,[
            {schema:'custodial.native-original-browser-document-retired.v1',reply_token:'b'.repeat(64)},
            {schema:'custodial.native-original-browser-realm-withdrawal.v1',reply_token:'b'.repeat(64)},
          ],'Real denial after document retirement escalates once; later CLOSE cannot demote or revive the realm');
          checks.push('after '+retirement+' '+fault+' permanently escalates once to whole-realm withdrawal');
        }finally{await afterClose.context.close();contexts--;}
      }
    }else if(existingWorkerOnly){
      // Real Chromium registration in an isolated, nonpersistent owned
      // context. No fake getRegistrations/controller result or production
      // profile. If the normal route cannot fetch the worker script, this
      // prerequisite remains NOT_RUN; do not replace it with synthetic DATA.
      const context=await browser.newContext({serviceWorkers:'allow'});contexts++;
      try{
        await context.route('**/*',route=>{
          const url=new URL(route.request().url());
          if(url.origin!=='https://localhost')return route.abort();
          if(url.pathname==='/seed-worker.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body>Owned worker seed</body></html>'});
          if(url.pathname==='/fixture-worker.js')return route.fulfill({contentType:'application/javascript',body:
            "self.addEventListener('install',()=>self.skipWaiting());"});
          return route.fulfill({status:404,body:'Owned worker fixture only'});
        });
        const seed=await context.newPage();seed.setDefaultTimeout(6000);seed.setDefaultNavigationTimeout(6000);
        await seed.goto('https://localhost/seed-worker.html');
        let registration;
        try{registration=await seed.evaluate(async()=>{
          const result=await navigator.serviceWorker.register('/fixture-worker.js',{scope:'/fixture-worker-scope/'});
          const worker=result.installing||result.waiting||result.active;
          if(!worker)throw Error('actual registered worker is absent');
          if(worker.state!=='activated')await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(Error('actual worker activation unavailable')),5000);
            worker.addEventListener('statechange',()=>{
              if(worker.state==='activated'){clearTimeout(timeout);resolve();}
              if(worker.state==='redundant'){clearTimeout(timeout);reject(Error('actual worker became redundant'));}
            });
          });
          return {scope:result.scope,count:(await navigator.serviceWorker.getRegistrations()).length};
        });}catch(error){
          console.error(JSON.stringify({case:'EXISTING_WORKER_PREREQUISITE_NOT_RUN',error:error.message,
            reason:'Normal owned registration route unavailable; no synthetic registry or alternate security route.'}));throw error;
        }
        assert.deepEqual(registration,{scope:'https://localhost/fixture-worker-scope/',count:1});
        await seed.close();
        const observed=await pageFor(true,context);
        assert.equal(await observed.page.evaluate(()=>navigator.serviceWorker.controller),null,
          'Different real worker scope must isolate the registration check from controller refusal');
        assert.equal(await observed.page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),1);
        const denied=await reply(observed.page,'9'.repeat(64));assert.equal(denied.state,'UNRESOLVED_RETAINED');
        assert(await observed.page.evaluate(()=>realmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-realm-withdrawal.v1')));
        assert.equal(await observed.page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),1,
          'Refusal must not unregister/purge an existing worker');
        checks.push('actual pre-existing registration outside current controller scope retires reader without deleting registration');
      }finally{await context.close();contexts--;}
    }else{
    const good=await pageFor(true);
    try{
      const observed=await reply(good.page,'d'.repeat(64));
      assert.equal(observed.state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
      assert.equal((await good.page.evaluate(()=>navigator.serviceWorker.getRegistrations())).length,0);
      checks.push('actual empty Chromium service-worker container + early policy + same document yields DATA only');
      const blocked=await good.page.evaluate(()=>{
        const denied=[];
        const expect=(name,operation)=>{
          try{operation();throw Error('Unsupported realm was created: '+name);}
          catch(error){if(error.message!=='custodial_original_browser_realm_creation_refused')throw error;denied.push(name);}
        };
        const inert=()=>new DOMParser().parseFromString('<iframe srcdoc="<p>inert original</p>"></iframe>','text/html').querySelector('iframe');
        const ordinary=document.createElement('div');document.body.appendChild(ordinary);
        let coercions=0;ordinary.innerHTML={toString(){coercions++;return '<b>ordinary</b><!-- <iframe> text only -->';}};
        if(coercions!==1||ordinary.querySelector('b').textContent!=='ordinary')throw Error('ordinary HTML/conversion changed');
        ordinary.innerHTML=null;if(ordinary.innerHTML!=='')throw Error('ordinary null setter changed');
        const style=document.createElement('style');style.innerHTML='/* <iframe> raw CSS DATA */';ordinary.append(style);
        expect('createElement',()=>document.createElement('iframe'));
        expect('createElementNS',()=>document.createElementNS('http://www.w3.org/1999/xhtml','iframe'));
        expect('appendChild of inert parser node',()=>document.body.appendChild(inert()));
        expect('append fragment',()=>{const fragment=document.createDocumentFragment();const node=inert();
          // Fragment insertion is guarded too; the unsupported node never reaches the live document.
          fragment.append(node);document.body.append(fragment);});
        expect('innerHTML',()=>{ordinary.innerHTML='<iframe srcdoc="<p>unknown</p>"></iframe>';});
        expect('outerHTML',()=>{ordinary.outerHTML='<iframe></iframe>';});
        expect('insertAdjacentHTML',()=>ordinary.insertAdjacentHTML('beforeend','<iframe></iframe>'));
        expect('nested template HTML',()=>{ordinary.innerHTML='<template shadowrootmode="closed"><iframe></iframe></template>';});
        const range=document.createRange();range.selectNodeContents(ordinary);range.collapse(false);
        expect('Range.insertNode',()=>range.insertNode(inert()));
        const host=document.createElement('div');ordinary.append(host);const shadow=host.attachShadow({mode:'closed'});
        expect('closed shadow HTML',()=>{shadow.innerHTML='<iframe></iframe>';});
        expect('document.write',()=>document.write('<p>replacement document</p>'));
        expect('window.open',()=>window.open('about:blank'));
        const pin=Object.getOwnPropertyDescriptor(Document.prototype,'createElement');
        if(pin.writable!==false||pin.configurable!==false)throw Error('realm hook is replaceable');
        let immutable=false;try{Object.defineProperty(Document.prototype,'createElement',{value:()=>null});}catch{immutable=true;}
        if(!immutable)throw Error('realm hook replacement succeeded');
        ordinary.append('ordinary text');if(!ordinary.textContent.includes('ordinary text'))throw Error('ordinary text append disabled');
        return {denied,child_count:document.querySelectorAll('iframe,frame,object,embed').length};
      });
      assert.equal(blocked.child_count,0);assert.equal(blocked.denied.length,12);
      checks.push('actual document-start hooks refuse twelve child-realm/document-rewrite routes before a live child appears; ordinary HTML/text/raw CSS preserved');
      const refused=await reply(good.page,'f'.repeat(64));assert.equal(refused.state,'UNRESOLVED_RETAINED');
      const reverted=await reply(good.page,'9'.repeat(64));assert.equal(reverted.state,'UNRESOLVED_RETAINED');
      assert(await good.page.evaluate(()=>realmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-realm-withdrawal.v1')));
      checks.push('refused child-realm attempt retires this private reader; later clean DOM cannot revive it');
    }catch(error){
      console.error(JSON.stringify({first_failed_realm_stage:error.message,checks_completed:checks,
        actual:await good.page.evaluate(()=>({violations:realmFixture.violations,child_script_ran:globalThis.realmChildRan,
          worker_script_ran:globalThis.realmWorkerRan,source_messages:realmFixture.messages.map(({schema,state,phase_nonce})=>({schema,state,phase_nonce})),
          child_count:document.querySelectorAll('iframe').length})).catch(()=>({visibility:'unavailable'}))},null,2));
      throw error;
    }finally{await good.context.close();contexts--;}
    const absent=await pageFor(false);
    try{const denied=await reply(absent.page,'8'.repeat(64));assert.equal(denied.state,'UNRESOLVED_RETAINED');
      checks.push('missing policy is unavailable, never an empty/successful realm proof');}
    finally{await absent.context.close();contexts--;}
    }
  }finally{
    for(const context of browser.contexts())await context.close();
    contexts=browser.contexts().length;await browser.close();closed=!browser.isConnected();
  }
  assert.equal(contexts,0);assert.equal(closed,true);
  console.log(JSON.stringify({case:lifecycleOnly?'BROWSER_REALM_CLOSE_LIFECYCLE_NEW':existingWorkerOnly?'BROWSER_REALM_EXISTING_WORKER_NEW':'BROWSER_REALM_SOURCE_NEW',checks,contexts_remaining:contexts,browser_closed:closed,
    proof:'Actual emitted native Java sidecar Source + Chromium DOM/CSP/service-worker API; synthetic native port/tokens and owned HTML only.',
    not_run:[...(existingWorkerOnly?[]:['existing registered worker on an owned normal TLS worker route']),'Android WebView/native callback integration','complete all-writer/ACK/finalizer authority'],
    authenticated_manager:false,phone:false,inventory_ack:false},null,2));
  process.exit(0);
}

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureSource = String.raw`
  import {
    CUSTODIAL_DEVICE_KEYS,
    CUSTODIAL_INSTALLATION_MARKER_KEY,
    CUSTODIAL_INSTALLATION_RECORD_KEY,
  } from '../src/custodial/credential-store.js';
  import { getCustodialBridgeSecurityRuntime } from '../src/custodial/security-runtime.js';
  import { installCustodialStorageFirewall } from '../src/custodial/storage-firewall.js';

  const deviceId = 'KIOSK_08';
  const secret = 'browser-private-device-credential';
  const seal = 'browser-private-installation-seal';
  let rawStorage;
  let runtime;
  let installation;

  globalThis.firewallFixture = Object.freeze({
    async start() {
      rawStorage = globalThis.localStorage;
      rawStorage.clear();
      for (const key of CUSTODIAL_DEVICE_KEYS) rawStorage.setItem(key, deviceId);
      rawStorage.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, seal);
      const protectedValues = new Map([[
        CUSTODIAL_INSTALLATION_RECORD_KEY,
        JSON.stringify({
          schema_version: 1,
          credential: secret,
          device_id: deviceId,
          installation_seal: seal,
          enrolled_at: '2026-08-01T00:00:00.000Z',
          migrated_from_credential_only_state: false,
        }),
      ]]);
      const secureStorage = {
        async get(key) { return protectedValues.get(String(key)) ?? null; },
        async set(key, value) { protectedValues.set(String(key), String(value)); },
        async remove(key) { protectedValues.delete(String(key)); },
      };
      runtime = getCustodialBridgeSecurityRuntime({
        secureStorage,
        storage: rawStorage,
        cryptoApi: globalThis.crypto,
        indexedDb: globalThis.indexedDB,
      });
      installation = installCustodialStorageFirewall({
        storage: rawStorage,
        getSecurityStatus: runtime.security.getStatus,
      });
      await runtime.security.ready;
      return this.snapshot();
    },
    snapshot() {
      const status = runtime.security.getStatus();
      return {
        status,
        cacheDeviceId: rawStorage.getItem('memphisAssignedDeviceId'),
        crossContextTampered: installation.crossContextTampered(),
        firewallBlocked: installation.blocked(),
        publicCredentialExposed: JSON.stringify(globalThis.MemphisCustodialSecurity).includes(secret),
      };
    },
    async attemptAuthorizedTransport() {
      let callbackCalled = false;
      let error = null;
      try {
        await runtime.credentialStore.dispatchAuthorizedTransport(() => {
          callbackCalled = true;
          throw new Error('credential callback must not run after cache tamper');
        });
      } catch (caught) {
        error = { name: caught?.name || '', code: caught?.code || '', message: caught?.message || '' };
      }
      return { callbackCalled, error, status: runtime.security.getStatus() };
    },
    async revalidate() {
      let error = null;
      try { await runtime.security.ensureSecurityState(); }
      catch (caught) {
        error = { name: caught?.name || '', code: caught?.code || '', message: caught?.message || '' };
      }
      return { error, status: runtime.security.getStatus() };
    },
  });
`;

const bundle = await build({
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
  stdin: {
    contents: fixtureSource,
    loader: 'js',
    resolveDir: scriptsDirectory,
    sourcefile: 'custodial-storage-firewall-browser-fixture.js',
  },
});
const fixtureJavaScript = bundle.outputFiles[0].text;
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    response.end(fixtureJavaScript);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(request.url === '/frame'
    ? '<!doctype html><title>same-origin frame</title>'
    : '<!doctype html><title>firewall fixture</title><script src="/fixture.js"></script>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const mutation of ['write', 'delete']) {
    const page = await browser.newPage();
    await page.goto(origin);
    const initial = await page.evaluate(() => globalThis.firewallFixture.start());
    assert.equal(initial.status.state, 'enrolled');
    assert.equal(initial.status.deviceId, 'KIOSK_08');
    assert.equal(initial.publicCredentialExposed, false);

    const mainRealm = await page.evaluate(() => {
      const attempts = {};
      for (const [name, operation] of Object.entries({
        namedWrite: () => { localStorage.memphisAssignedDeviceId = 'KIOSK_02'; },
        namedDelete: () => { delete localStorage.memphisAssignedDeviceId; },
        defineProperty: () => Object.defineProperty(localStorage, 'memphisAssignedDeviceId', { value: 'KIOSK_02' }),
        replaceSetItem: () => Object.defineProperty(Storage.prototype, 'setItem', { value() {} }),
      })) {
        try { operation(); attempts[name] = 'allowed'; }
        catch (error) { attempts[name] = error.name; }
      }
      localStorage.ordinary_cache_key = 'ordinary-value';
      localStorage['session:ready-work'] = 'preserved-session';
      return {
        attempts,
        deviceId: localStorage.getItem('memphisAssignedDeviceId'),
        ordinary: localStorage.getItem('ordinary_cache_key'),
        protectedWork: localStorage.getItem('session:ready-work'),
        setItemDescriptor: Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem'),
        localStorageDescriptor: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
      };
    });
    assert.deepEqual(mainRealm.attempts, {
      namedWrite: 'CustodialProtectedStateMutationError',
      namedDelete: 'CustodialProtectedStateMutationError',
      defineProperty: 'CustodialProtectedStateMutationError',
      replaceSetItem: 'TypeError',
    });
    assert.equal(mainRealm.deviceId, 'KIOSK_08');
    assert.equal(mainRealm.ordinary, 'ordinary-value');
    assert.equal(mainRealm.protectedWork, 'preserved-session');
    assert.equal(mainRealm.setItemDescriptor.configurable, false);
    assert.equal(mainRealm.setItemDescriptor.writable, false);
    assert.equal(mainRealm.localStorageDescriptor.configurable, false);
    assert.equal(mainRealm.localStorageDescriptor.writable, false);

    await page.evaluate(async (kind) => {
      const changed = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('cross-context storage event timed out')), 3000);
        const listener = (event) => {
          if (event.key !== 'memphisAssignedDeviceId') return;
          clearTimeout(timeout);
          globalThis.removeEventListener('storage', listener);
          resolve();
        };
        globalThis.addEventListener('storage', listener);
      });
      const frame = document.createElement('iframe');
      frame.src = '/frame';
      document.body.append(frame);
      await new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', reject, { once: true });
      });
      if (kind === 'write') frame.contentWindow.localStorage.memphisAssignedDeviceId = 'KIOSK_02';
      else delete frame.contentWindow.localStorage.memphisAssignedDeviceId;
      await changed;
    }, mutation);

    const tampered = await page.evaluate(() => globalThis.firewallFixture.snapshot());
    assert.equal(tampered.cacheDeviceId, mutation === 'write' ? 'KIOSK_02' : null);
    assert.equal(tampered.crossContextTampered, true);
    assert.equal(tampered.firewallBlocked, true);
    assert.equal(tampered.status.state, 'enrolled', 'untrusted cache must not directly rewrite active authority');
    assert.equal(tampered.status.deviceId, 'KIOSK_08');
    assert.equal(tampered.publicCredentialExposed, false);

    const transport = await page.evaluate(() => globalThis.firewallFixture.attemptAuthorizedTransport());
    assert.equal(transport.callbackCalled, false, 'tampered cache must fail before credential handoff');
    assert.ok(transport.error, 'tampered cache must reject authorized transport');
    assert.equal(transport.status.ready, false);
    assert.equal(transport.status.deviceId, '');

    const revalidated = await page.evaluate(() => globalThis.firewallFixture.revalidate());
    assert.ok(revalidated.error, 'explicit revalidation must reject the tampered binding');
    assert.equal(revalidated.status.quarantined, true);
    assert.equal(revalidated.status.deviceId, '');
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log('CUSTODIAL_STORAGE_FIREWALL_BROWSER_PASS');
