import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const map=require('../dashboard-map-staging.js');
const renderer=require('../dashboard-map-renderer.js');
const page=require('../dashboard-map-page.js');
const root=new URL('..',import.meta.url);
const bytes=readFileSync(new URL('dashboard-map-assets/approved-map-47-placement-anchors.json',root));
const raw=JSON.parse(bytes);
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const read=path=>readFileSync(new URL(path,root),'utf8');

await test('whole-image fit has no scale floor at desktop, landscape and portrait sizes',()=>{
  // Available map boxes, not measured browser/CSS viewport dimensions.
  for(const [width,height] of [[1760,780],[1360,590],[980,480],[820,230],[620,155],[344,490],[260,90]]){
    const fit=map.fitViewport({width,height});
    assert.ok(fit.width<=width+1e-9&&fit.height<=height+1e-9);
    assert.ok(Math.abs(fit.width/fit.height-1282/550)<1e-12);
    for(const location of raw.locations){
      const point=map.screenPoint(location.approvedOverlayCanvasPoint,{fitScale:fit.fitScale,zoom:1});
      assert.equal(point.x,location.approvedOverlayCanvasPoint.x*fit.fitScale);
      assert.equal(point.y,location.approvedOverlayCanvasPoint.y*fit.fitScale);
      assert.ok(point.x>=0&&point.y>=0&&point.x<=fit.width&&point.y<=fit.height);
    }
  }
  assert.ok(map.fitViewport({width:620,height:155}).fitScale<.45);
  for(const invalid of [0,-1,NaN,Infinity,'600',undefined]){
    assert.throws(()=>map.fitViewport({width:invalid,height:300}));
    assert.throws(()=>map.fitViewport({width:600,height:invalid}));
  }
});

class Element{
  constructor(){this.children=[];this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.listeners=new Map();this.attributes={};this.textContent='';this.value='';}
  append(...nodes){for(const node of nodes)node.parent=this;this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);if(!this.listeners.get(name)?.size)this.listeners.delete(name);}
  fire(name,event={}){for(const fn of [...this.listeners.get(name)||[]])fn(event);}
  setAttribute(name,value){this.attributes[name]=value;}
  querySelector(selector){return selector==='[data-map-callout]'?this.children.find(child=>child.dataset?.mapCallout!==undefined):null;}
}
const principal={role:'ops_manager',manager_id:'map-manager',credential_id:'map-credential',device_id:'map-device',token:'fixture-only'};
const fixture=({session=principal}={})=>{
  const keys=['viewport','surface','artwork','layer','status','selection','alerts','locations','alert-count'];
  const elements=Object.fromEntries(keys.map(key=>[key,new Element()]));
  const section={hidden:true,querySelector:selector=>elements[selector.match(/^\[data-map-(.*)\]$/)?.[1]]};
  let width=1360,height=590,current=session,statusCode='overdue',anchorReads=0,summaryReads=0,validations=0,creates=0;
  Object.defineProperties(elements.viewport,{clientWidth:{get:()=>section.hidden?0:width},clientHeight:{get:()=>section.hidden?0:height}});
  const document=new Element();document.hidden=false;document.createElement=()=>new Element();document.createTextNode=text=>({textContent:text});
  const observers=[];
  class ResizeObserver{
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
    observe(target){assert.equal(target,elements.viewport);}
    disconnect(){this.disconnected=true;}
  }
  const window=Object.assign(new Element(),{document,crypto:webcrypto,ResizeObserver,matchMedia:()=>({matches:false})});
  window.addEventListener('unrelated',()=>{});
  const auth={readSession:()=>current,async requireOpsManagerSession(options){validations++;assert.deepEqual(options,{interactive:false,redirect:true});return current;},
    async opsManagerAuthHeaders(options){assert.deepEqual(options,{expectedManagerId:principal.manager_id});return {Authorization:'Bearer fixture-only','X-Device-Id':principal.device_id};}};
  const fetchImpl=async(url,options)=>{
    assert.equal(options.cache,'no-store');
    if(url==='./dashboard-map-assets/approved-map-47-placement-anchors.json'){
      anchorReads++;return {ok:true,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
    }
    assert.equal(url,'https://memphis-zoo-mcp.onrender.com/dashboard-api/summary');
    assert.deepEqual(options.headers,{Authorization:'Bearer fixture-only','X-Device-Id':principal.device_id});
    summaryReads++;
    return {ok:true,json:async()=>({ok:true,data:{meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-04T17:00:00Z'},restrooms:[],exhibits:[{
      location_id:raw.locations[0].locationId,status_code:statusCode,status_color:statusCode==='overdue'?'red':'green',
      latest_completed_at:'2026-10-04T16:59:00Z',open_session_status:null}]}})};
  };
  const timers=new Map();let timerSequence=0;
  const controller=page.create({auth,renderer:{create:options=>{creates++;return renderer.create({...options,document,window,fetchImpl});}},section,status:new Element(),window,fetchImpl,
    setIntervalImpl:(fn,ms)=>{const id=++timerSequence;timers.set(id,{fn,ms});return id;},clearIntervalImpl:id=>timers.delete(id)});
  return {controller,elements,section,window,document,observers,timers,
    resize:(w,h)=>{width=w;height=h;for(const observer of observers)if(!observer.disconnected)observer.callback();},
    session:value=>{current=value;},status:value=>{statusCode=value;},
    counts:()=>({anchorReads,summaryReads,validations,creates})};
};
const f=fixture();
await test('real page and renderer initialize from hidden layout with exactly47 pins and two timers',async()=>{
  assert.equal(await f.controller.init(),true);await flush();
  assert.equal(f.section.hidden,false);assert.equal(f.elements.layer.children.length,47);
  assert.equal(f.elements.locations.children.length,47);assert.equal(f.timers.size,2);
  assert.deepEqual([...f.timers.values()].map(value=>value.ms).sort((a,b)=>a-b),[1000,30000]);
  assert.deepEqual(f.counts(),{anchorReads:1,summaryReads:1,validations:1,creates:1});
  assert.equal(f.observers.length,1);
});
await test('resize observer fits unchanged pin centers to short landscape; no pan or zoom is needed in geometry',()=>{
  f.resize(620,155);
  const fit=map.fitViewport({width:620,height:155});
  assert.equal(f.elements.surface.style.width,`${fit.width}px`);assert.equal(f.elements.surface.style.height,'155px');
  for(const [index,pin] of f.elements.layer.children.entries()){
    assert.equal(pin.dataset.locationId,raw.locations[index].locationId);
    assert.equal(pin.style.left,`${raw.locations[index].approvedOverlayCanvasPoint.x*fit.fitScale}px`);
    assert.equal(pin.style.top,`${raw.locations[index].approvedOverlayCanvasPoint.y*fit.fitScale}px`);
    assert.equal(pin.style.width,index===0?'42px':'24px');
    assert.ok(parseFloat(pin.style['--map-label-width'])>0);
  }
});
await test('location picker selects an exact approved pin without another request or changed coordinates',()=>{
  const pin=f.elements.layer.children[20],point=[pin.style.left,pin.style.top],before=f.counts();
  f.elements.locations.value=pin.dataset.locationId;f.elements.locations.fire('change');
  assert.equal(pin.style.width,'42px');assert.equal(pin.attributes['aria-pressed'],'true');
  assert.deepEqual([pin.style.left,pin.style.top],point);assert.deepEqual(f.counts(),before);
  assert.ok(f.elements.selection.textContent.startsWith(raw.locations[20].name));
  f.elements.locations.value='';f.elements.locations.fire('change');assert.equal(pin.style.width,'24px');
});
await test('offline clears authority but retains urgent size; authoritative green alone clears it',async()=>{
  f.window.fire('offline');assert.equal(f.elements.layer.children[0].dataset.status,'unknown');
  assert.equal(f.elements.layer.children[0].style.width,'42px');assert.equal(f.elements['alert-count'].textContent,'1');
  f.status('okay');assert.equal(await f.controller.refresh(),true);
  assert.equal(f.elements.layer.children[0].dataset.status,'okay');assert.equal(f.elements.layer.children[0].style.width,'24px');
  assert.equal(f.elements['alert-count'].textContent,'0');
});
await test('synthetic persisted lifecycle validates principal and gets one new summary per restore',async()=>{
  const before=f.counts(),listeners=f.window.listeners.size;
  for(let cycle=1;cycle<=3;cycle++){
    f.window.fire('pagehide',{persisted:true});assert.equal(f.timers.size,0);assert.equal(f.section.hidden,true);
    f.window.fire('pageshow',{persisted:true});await flush();
    assert.equal(f.section.hidden,false);assert.equal(f.timers.size,2);assert.equal(f.elements.layer.children.length,47);
    assert.equal(f.counts().summaryReads,before.summaryReads+cycle);
    assert.equal(f.counts().validations,before.validations+cycle);
    f.window.fire('pageshow',{persisted:true});await flush();
    assert.equal(f.counts().summaryReads,before.summaryReads+cycle);
    assert.equal(f.window.listeners.size,listeners);
  }
  assert.equal(f.observers.length,1);assert.equal(f.counts().creates,1);assert.equal(f.counts().anchorReads,1);
});
await test('changed credential on restore stays hidden without fetching or retaining another principal status',async()=>{
  const before=f.counts();f.window.fire('pagehide',{persisted:true});f.session({...principal,credential_id:'changed'});
  f.window.fire('pageshow',{persisted:true});await flush();
  assert.equal(f.section.hidden,true);assert.equal(f.timers.size,0);assert.equal(f.counts().summaryReads,before.summaryReads);
  assert.equal(f.elements.layer.children.length,0);assert.equal(f.elements.locations.children.length,0);
  assert.equal(f.observers[0].disconnected,true);
});
await test('final close releases only map-owned observers, controls, timers and listeners',()=>{
  f.controller.stop();assert.equal(f.timers.size,0);assert.equal(f.document.listeners.size,0);
  assert.deepEqual([...f.window.listeners.keys()],['unrelated']);assert.equal(f.elements.locations.listeners.size,0);
});
await test('unauthorized route never constructs artwork, renderer or dashboard requests',async()=>{
  for(const session of [null,{...principal,role:'employee'},{...principal,credential_id:''}]){
    const denied=fixture({session});assert.equal(await denied.controller.init(),false);
    assert.deepEqual(denied.counts(),{anchorReads:0,summaryReads:0,validations:1,creates:0});
    assert.equal(denied.section.hidden,true);denied.controller.stop();
  }
});
await test('map tile inherits sibling components with existing Memphis art and map imagery',()=>{
  const html=read('start_page1.html'),tile=html.match(/<a id="dashboard-map-link"[\s\S]*?<\/a>/)?.[0];
  assert.ok(tile);assert.match(tile,/class="hubTile primary"/);assert.match(tile,/class="tileIcon dashboardMapIcon"/);
  assert.match(tile,/src="\.\/memphis_avatar_ui\.webp"/);assert.match(tile,/<svg viewBox="0 0 32 28"/);
  const baseline=execFileSync('git',['show','6fae503111ef21c40a309913965c3b963043aa01:start_page1.html'],{cwd:root,encoding:'utf8'});
  assert.equal(html.replace('  <link rel="stylesheet" href="./dashboard-map-hub.css">\n','').replace(`        ${tile}\n`,''),baseline);
  for(const path of ['ops-hub.css','manager-ux.css','memphis-auth.js','dashboard.html','employee-hub.html','mobile/capacitor.config.ts','mobile/scripts/build.mjs']){
    assert.deepEqual(readFileSync(new URL(path,root)),execFileSync('git',['show',`6fae503111ef21c40a309913965c3b963043aa01:${path}`],{cwd:root}));
  }
});
await test('actual Hub link builder gives map the same manager/device/origin context without unrelated changes',()=>{
  const source=read('ops-hub.js');
  const body=source.slice(source.indexOf('  function updateLinks(){'),source.indexOf('  function applyRoleVisibility('));
  const els=new Proxy({}, {get:(target,key)=>target[key]??=( {href:''})});
  const context={URL,window:{location:{href:'https://example.org/Engine/start_page1.html'}},state:{currentDeviceId:'manager-device'},els,
    ANNIE_RETURN_URL:'https://memphis-zoo-mcp.onrender.com/moxie/',preserveAnnieOrigin:url=>{url.searchParams.set('origin','annie');return url;}};
  vm.runInNewContext(`${body}\nupdateLinks();`,context);
  const mapUrl=new URL(els.dashboardMapLink.href),dashboardUrl=new URL(els.dashboardLink.href);
  assert.equal(mapUrl.pathname,'/Engine/operations-dashboard.html');assert.equal(mapUrl.search,dashboardUrl.search);
  assert.equal(mapUrl.searchParams.get('hub'),'manager');assert.equal(mapUrl.searchParams.get('device'),'manager-device');
  assert.equal(mapUrl.searchParams.get('origin'),'annie');
});
await test('layout uses matching Hub background, fit-only map, upright constant-size pins and browser zoom fallback',()=>{
  const html=read('dashboard-map.html'),css=read('dashboard-map.css');
  assert.match(html,/href="\.\/ops-hub\.css"/);assert.match(html,/href="\.\/manager-ux\.css"/);
  assert.doesNotMatch(html,/maximum-scale|user-scalable|data-map-zoom/);
  assert.match(css,/height:100dvh/);assert.match(css,/orientation:landscape/);assert.match(css,/orientation:portrait/);
  assert.match(css,/\.mzMapViewport\{[^}]*overflow:hidden/);
  assert.doesNotMatch(read('dashboard-map-renderer.js'),/Math\.max\(\.45|data-map-zoom/);
  assert.doesNotMatch(css+read('dashboard-map-staging.css'),/rotate\(|matrix\(/);
});
console.log('PASS Dashboard Map web fit/source/combined VM',checks,'NO_BROWSER_NO_BACKEND_NO_LIVE_VISUAL_CLAIM');
