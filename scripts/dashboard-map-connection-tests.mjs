import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const page=require('../dashboard-map-page.js');
const root=new URL('..',import.meta.url);
const html=readFileSync(new URL('dashboard-map.html',root),'utf8');
const authSource=readFileSync(new URL('memphis-auth.js',root),'utf8');
const base='https://lasrevinu333-design.github.io/Engine/';
const principal={role:'ops_manager',manager_id:'fixture-manager',credential_id:'fixture-credential',
  device_id:'KIOSK_08',token:'SYNTHETIC-NOT-A-CREDENTIAL',access_level:'full_access',
  expires_at:'2099-01-01T00:00:00.000Z'};
const summary={meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-04T18:00:00.000Z'},restrooms:[],exhibits:[]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};

function fixture({query='?hub=manager&device=kiosk_08&origin=annie',session=principal,authStatus=200,
  summaryStatus=200,storageBlocked=false,sessionOrigin=null}={}){
  const calls=[],listeners=new Map(),timers=new Set(),store=new Map();
  const section={hidden:true},status={textContent:''};
  const targets=['start_page1.html','dashboard.html'];
  const anchors=targets.map(file=>{
    const match=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].find(x=>x[1]===`./${file}`);
    assert.ok(match,`Static navigation fallback for ${file}`);
    return {href:new URL(match[1],base).href};
  });
  const elements={'map-hub-link':anchors[0],'map-dashboard-link':anchors[1]};
  const location={href:base+'dashboard-map.html'+query,replace(value){this.redirect=value;}};
  Object.defineProperties(location,{pathname:{get:()=>new URL(location.href).pathname},
    search:{get:()=>new URL(location.href).search},hash:{get:()=>new URL(location.href).hash}});
  const storage={getItem(key){if(storageBlocked)throw Error('Fixture storage unavailable');return store.get(key)||null;},
    setItem(key,value){if(storageBlocked)throw Error('Fixture storage unavailable');store.set(key,value);},
    removeItem(key){if(storageBlocked)throw Error('Fixture storage unavailable');store.delete(key);}};
  const window={location,sessionStorage:{getItem:()=>sessionOrigin},
    document:{hidden:false,getElementById:id=>elements[id]||null,
      addEventListener(name,fn){listeners.set('doc:'+name,fn);},removeEventListener(name){listeners.delete('doc:'+name);}},
    addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
  let creates=0,accepted=0,failures=0;
  const map={async init(){return true;},async resume(){return true;},stop(){},suspend(){},
    checkSession(){return true;},invalidate(){},beginRefresh(){return {};},
    accept(_ticket,data){assert.deepEqual(data,summary);accepted++;return true;},fail(){failures++;}};
  const fetchImpl=async(url,options)=>{
    calls.push({url:String(url),method:options.method,credentials:options.credentials,headers:{...options.headers}});
    const parsed=new URL(url);
    if(parsed.pathname==='/auth-api/session')return{ok:authStatus===200,status:authStatus,
      async json(){return authStatus===200?{ok:true,data:{session:{...session},trusted_device:{device_id:session.device_id}}}:{ok:false,error:'Fixture denied'};}};
    if(parsed.pathname==='/auth-api/ops/logout')return{ok:true,status:200};
    assert.equal(parsed.href,'https://memphis-zoo-mcp.onrender.com/dashboard-api/summary');
    return{ok:summaryStatus===200,status:summaryStatus,async json(){return {ok:summaryStatus===200,data:summary};}};
  };
  // Execute the exact published shared auth client. No real network, cookies,
  // credentials, browser or backend process is used by this VM contract.
  vm.runInNewContext(authSource,{window,localStorage:storage,navigator:{platform:'fixture'},
    URL,Date,fetch:fetchImpl,console});
  const auth=window.MemphisAuth;
  const controller=page.create({auth,renderer:{create(){creates++;return map;}},section,status,window,fetchImpl,
    setIntervalImpl(fn){timers.add(fn);return fn;},clearIntervalImpl(fn){timers.delete(fn);}});
  return{controller,auth,window,anchors,section,calls,timers,listeners,
    counts:()=>({creates,accepted,failures}),close(){controller.stop();assert.equal(timers.size,0);assert.equal(listeners.size,0);}};
}

await test('map outgoing links retain manager/device/Annie context even when storage is unavailable',async()=>{
  const f=fixture({storageBlocked:true});assert.equal(await f.controller.init(),true);await flush();
  for(const [i,file]of ['start_page1.html','dashboard.html'].entries()){
    const url=new URL(f.anchors[i].href);
    assert.equal(url.pathname,`/Engine/${file}`);assert.equal(url.origin,new URL(base).origin);
    assert.equal(url.searchParams.get('device'),'KIOSK_08');
    assert.equal(url.searchParams.get('hub'),'manager');assert.equal(url.searchParams.get('origin'),'annie');
  }
  assert.equal(f.counts().accepted,1);f.close();
});
await test('real shared auth obtains the trusted full manager session and sends its exact summary headers',async()=>{
  const f=fixture();assert.equal(await f.controller.init(),true);await flush();
  assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].url,'https://memphis-zoo-mcp.onrender.com/auth-api/session?access_level=full_access');
  assert.equal(f.calls[0].credentials,'include');assert.equal(f.calls[0].headers['X-Device-Id'],'KIOSK_08');
  assert.equal(f.calls[1].headers.Authorization,`Bearer ${principal.token}`);
  assert.equal(f.calls[1].headers['X-Device-Id'],principal.device_id);
  assert.equal(f.calls[1].method,'GET');assert.equal(f.counts().accepted,1);f.close();
});
await test('canonical authenticated device wins over stale query; non-context parameters never propagate',async()=>{
  const f=fixture({query:'?hub=employee&device=stale-device&origin=ANNIE&return=https://invalid.example&token=fixture'});
  assert.equal(await f.controller.init(),true);await flush();
  for(const anchor of f.anchors){const url=new URL(anchor.href);
    assert.equal(url.searchParams.get('device'),'KIOSK_08');assert.equal(url.searchParams.get('hub'),'manager');
    assert.equal(url.searchParams.get('origin'),'annie');assert.equal(url.searchParams.size,3);}
  f.close();
});
await test('existing Annie session context survives direct map load; arbitrary origins are not forwarded',async()=>{
  for(const [sessionOrigin,wanted]of [['1','annie'],[null,null]]){
    const f=fixture({query:'?device=KIOSK_08&origin=https://invalid.example',sessionOrigin});
    assert.equal(await f.controller.init(),true);await flush();
    for(const anchor of f.anchors)assert.equal(new URL(anchor.href).searchParams.get('origin'),wanted);f.close();
  }
});
await test('shared auth denial returns to existing enrollment with exact map return path and no map data',async()=>{
  const f=fixture({authStatus:401});assert.equal(await f.controller.init(),false);await flush();
  const url=new URL(f.window.location.redirect);assert.equal(url.pathname,'/Engine/ops-manager-hub.html');
  assert.equal(url.searchParams.get('return'),new URL(f.window.location.href).pathname+new URL(f.window.location.href).search);
  assert.equal(f.section.hidden,true);assert.equal(f.calls.length,1);assert.equal(f.counts().creates,0);f.close();
});
await test('non-manager authority does not construct map or request summary',async()=>{
  const f=fixture({session:{...principal,role:'employee'}});assert.equal(await f.controller.init(),false);await flush();
  assert.equal(f.calls.length,1);assert.equal(f.section.hidden,true);assert.equal(f.counts().creates,0);f.close();
});
await test('summary denial cannot become cleaning authority despite successful shared sign-in',async()=>{
  const f=fixture({summaryStatus:403});assert.equal(await f.controller.init(),true);await flush();
  assert.equal(f.counts().accepted,0);assert.equal(f.counts().failures,1);f.close();
});
await test('real shared-auth logout invalidates page and stops its owned listeners/timers',async()=>{
  const f=fixture();assert.equal(await f.controller.init(),true);await flush();
  await f.auth.clearSession();assert.equal(f.controller.checkPrincipal(),false);assert.equal(f.section.hidden,true);
  assert.equal(f.calls.at(-1).url,'https://memphis-zoo-mcp.onrender.com/auth-api/ops/logout');
  assert.equal(f.calls.at(-1).method,'POST');assert.equal(await f.controller.refresh(),false);f.close();
});
console.log('PASS Dashboard Map connection/shared-auth',checks,'SOURCE_VM_NO_BROWSER_NO_LIVE_AUTH');
