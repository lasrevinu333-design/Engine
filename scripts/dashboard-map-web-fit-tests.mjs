import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const map=require('../dashboard-map-staging.js');
const approvedFit=require('../custodial-gps-approved-overall-fit.js');
const renderer=require('../dashboard-map-renderer.js');
const page=require('../dashboard-map-page.js');
const root=new URL('..',import.meta.url);
const bytes=readFileSync(new URL('dashboard-map-assets/approved-map-47-placement-anchors.json',root));
const raw=JSON.parse(bytes);
const acceptedAnchors=approvedFit.transformAnchors(await map.parseApprovedAnchors(Uint8Array.from(bytes),{subtle:webcrypto.subtle}));
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const read=path=>readFileSync(new URL(path,root),'utf8');

await test('whole-image fit has no scale floor at desktop, landscape and portrait sizes',()=>{
  // Available map boxes, not measured browser/CSS viewport dimensions.
  for(const [width,height] of [[1760,780],[1360,590],[980,480],[820,230],[620,155],[344,490],[260,90]]){
    const fit=map.fitViewport({width,height,canvasWidth:acceptedAnchors.width,canvasHeight:acceptedAnchors.height});
    assert.ok(fit.width<=width+1e-9&&fit.height<=height+1e-9);
    assert.ok(Math.abs(fit.width/fit.height-acceptedAnchors.width/acceptedAnchors.height)<1e-12);
    for(const location of acceptedAnchors.locations){
      const point=map.screenPoint(location.canvasPoint,{fitScale:fit.fitScale,zoom:1});
      assert.equal(point.x,location.canvasPoint.x*fit.fitScale);
      assert.equal(point.y,location.canvasPoint.y*fit.fitScale);
      assert.ok(point.x>=0&&point.y>=0&&point.x<=fit.width&&point.y<=fit.height);
    }
  }
  assert.ok(map.fitViewport({width:620,height:155,canvasWidth:acceptedAnchors.width,canvasHeight:acceptedAnchors.height}).fitScale<.45);
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
const principal={role:'ops_manager',manager_id:'map-manager',credential_id:'map-credential',device_id:'map-device',token:'fixture-only',permissions:{schema:'custodial.manager-permissions.v1',read:true}};
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
  const auth={hasPermission:(name,session)=>name==='read'&&session?.permissions?.schema==='custodial.manager-permissions.v1'&&session.permissions.read===true,readSession:()=>current,async requireOpsManagerSession(options){validations++;assert.deepEqual(options,{interactive:false,redirect:true});return current;},
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
  const fit=map.fitViewport({width:620,height:155,canvasWidth:acceptedAnchors.width,canvasHeight:acceptedAnchors.height});
  assert.equal(f.elements.surface.style.width,`${fit.width}px`);assert.equal(f.elements.surface.style.height,'155px');
  for(const [index,pin] of f.elements.layer.children.entries()){
    assert.equal(pin.dataset.locationId,raw.locations[index].locationId);
    assert.equal(pin.style.left,`${acceptedAnchors.locations[index].canvasPoint.x*fit.fitScale}px`);
    assert.equal(pin.style.top,`${acceptedAnchors.locations[index].canvasPoint.y*fit.fitScale}px`);
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
await test('map tile inherits sibling components with the established Trail map illustration',()=>{
  const html=read('start_page1.html'),tile=html.match(/<a id="dashboard-map-link"[\s\S]*?<\/a>/)?.[0];
  assert.ok(tile);assert.match(tile,/class="hubTile primary"/);assert.match(tile,/class="tileIcon hubIllustratedIcon"/);
  assert.match(tile,/src="\.\/assets\/trail-v1\/map-320\.webp"/);assert.match(tile,/<svg viewBox="0 0 24 24"/);
  // Current contextual pages include the integrated leadership/weather fixes.
  // Pin their exact existing bytes rather than applying an obsolete map-only
  // ancestor to this complete candidate or requiring hidden local Git history.
  const pinBytes=readFileSync(new URL('scripts/fixtures/dashboard-map-current-context-pins-v3.json',root));
  assert.equal(createHash('sha256').update(pinBytes).digest('hex'),'c5d46a5b45dcdecee5e09df27b4fb27843ddb977aa0b09bd94cf35b106a26913');
  const pins=JSON.parse(pinBytes);
  assert.equal(pins.schema,'custodial.dashboard-map-current-context-pins.v3');
  assert.equal(Object.keys(pins.files).length,8);
  for(const [name,digest]of Object.entries(pins.files))
    assert.equal(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex'),digest,'exact frozen current map context: '+name);
});
await test('actual Hub link builder gives map the same manager/device/origin context without unrelated changes',()=>{
  const source=read('ops-hub.js');
  const body=source.slice(source.indexOf('  function updateLinks(){'),source.indexOf('  function applyRoleVisibility('));
  const els=new Proxy({}, {get:(target,key)=>target[key]??=( {href:''})});
  const session={...principal,device_id:'manager-device'};
  const auth={readSession:()=>session,isOpsManager:value=>value===session&&value.role==='ops_manager'};
  const state={currentDeviceId:'manager-device',generation:7,retired:false,session,auth,sessionBinding:JSON.stringify(session)};
  const currentSource=source.slice(source.indexOf('  function current(generation){'),source.indexOf('  function every(',source.indexOf('  function current(generation){')));
  const context={URL,window:{location:{href:'https://example.org/Engine/start_page1.html'},MemphisAuth:auth},state,els,
    managerLinks:[],coverageLink:null,coverageHref:'',resolveDeviceId:()=> 'manager-device',
    sessionBinding:value=>JSON.stringify(value),retire:()=>{state.retired=true;}};
  vm.runInNewContext(`${currentSource}\n${body}\nupdateLinks();`,context);
  const mapUrl=new URL(els.dashboardMapLink.href),dashboardUrl=new URL(els.dashboardLink.href);
  assert.equal(mapUrl.pathname,'/Engine/operations-dashboard.html');assert.equal(mapUrl.search,dashboardUrl.search);
  assert.equal(mapUrl.searchParams.get('hub'),'manager');assert.equal(mapUrl.searchParams.get('device'),'manager-device');
  assert.equal(mapUrl.searchParams.get('origin'),null,'retired assistant origin is not restored into current hub links');
  state.retired=true;els.dashboardMapLink.href='';vm.runInNewContext(`${currentSource}\n${body}\nupdateLinks();`,context);
  assert.equal(els.dashboardMapLink.href,'','retired actual hub guard cannot rewrite navigation');
});
await test('layout uses matching Hub background, fit-only map, upright constant-size pins and browser zoom fallback',()=>{
  const html=read('dashboard-map.html'),css=read('dashboard-map.css');
  assert.match(html,/href="\.\/ops-hub\.css"/);assert.match(html,/href="\.\/manager-ux\.css"/);
  assert.doesNotMatch(html,/maximum-scale|user-scalable|data-map-zoom/);
  assert.match(css,/height:100dvh/);assert.match(css,/orientation:landscape/);assert.match(css,/orientation:portrait/);
  assert.match(css,/\.mzMapViewport\{[^}]*overflow:hidden/);
  assert.doesNotMatch(read('dashboard-map-renderer.js'),/Math\.max\(\.45|data-map-zoom/);
  const staging=read('dashboard-map-staging.css');
  // The established leader line points to an offset pin. Artwork and pin
  // containers must stay upright; only that line may rotate.
  assert.match(staging,/\.mzMapLeader\{[^}]*transform:rotate\(var\(--map-leader-angle\)\)/);
  assert.doesNotMatch(css+staging.replace(/\.mzMapLeader\{[^}]*\}/g,''),/rotate\(|matrix\(/);
});
console.log('PASS Dashboard Map web fit/source/combined VM',checks,'NO_BROWSER_NO_BACKEND_NO_LIVE_VISUAL_CLAIM');
