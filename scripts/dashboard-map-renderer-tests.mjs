import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';
const require=createRequire(import.meta.url);
const map=require('../dashboard-map-staging.js');
const renderer=require('../dashboard-map-renderer.js');
const anchors=readFileSync(new URL('../dashboard-map-assets/approved-map-47-placement-anchors.json',import.meta.url));
const html=readFileSync(new URL('../dashboard-map.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../dashboard-map-staging.css',import.meta.url),'utf8');
let checks=0;const pass=(label,fn)=>{fn();checks++;console.log('PASS',label);};
const mapAssetDigests=Object.freeze({
 'Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png':'73d4d6116819d34b0c5e6d35bf0d3c8397d582445fb92bf734fc6448fbb3a57a',
 'approved-map-47-placement-anchors.json':'3bf0761cb42f1e5f9b435ae3774ea3c018c749daf261de44357880ae3841ebef',
 'custodial-building-icon.svg':'494cc8bc0010e9c14baa50419d7afe2292e9297266af455c1dbfa390f9837c53',
 'custodial-men-icon.svg':'e3a52bca2f014ff456265dd78af3f894cd1a8e6672c9e0b72a077c435db4bb36',
 'custodial-women-icon.svg':'59da42531add77498eec1a57f01c55907ad687d636eae5fcdc9f0d7f8053839c'
});
pass('existing runtime graph includes exactly five current approved map assets with immutable bytes',()=>{
 const root=new URL('..',import.meta.url).pathname;
 const paths=discoverRuntimeFiles(root).filter(path=>path.startsWith('dashboard-map-assets/'));
 assert.deepEqual(paths,Object.keys(mapAssetDigests).map(name=>`dashboard-map-assets/${name}`).sort());
 for(const [name,digest] of Object.entries(mapAssetDigests))
  assert.equal(createHash('sha256').update(readFileSync(new URL(`../dashboard-map-assets/${name}`,import.meta.url))).digest('hex'),digest);
});
let principal={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
const events=[],gate=renderer.createRefreshGate({readSession:()=>principal,onState:(...args)=>events.push(args)});
const old=gate.begin(),next=gate.begin();
pass('new request invalidates old result before status projection',()=>{
 assert.equal(gate.commit(old,{}),false);assert.equal(events.at(-1)[0],'loading');
 assert.equal(gate.commit(next,{exact:true}),true);assert.equal(events.at(-1)[0],'current');
});
pass('post-commit logout or expiry erases current status and refuses new tickets',()=>{
 principal=null;
 assert.equal(gate.checkSession(),false);assert.equal(events.at(-1)[0],'principal_changed');
 assert.equal(gate.begin(),null);assert.equal(events.at(-1)[0],'principal_changed');
 principal={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
});
pass('credential, manager and token replacement reject late success',()=>{
 for(const change of [{credential_id:'other'},{manager_id:'other'},{token:'other'}]){
  principal={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
  const ticket=gate.begin();principal={...principal,...change};
  assert.equal(gate.commit(ticket,{exact:true}),false);assert.equal(events.at(-1)[0],'principal_changed');
 }
});
pass('only current failure invalidates; page close blocks late response',()=>{
 principal={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
 const prior=gate.begin(),ticket=gate.begin();assert.equal(gate.fail(prior),false);
 assert.equal(gate.fail(ticket),true);assert.equal(events.at(-1)[0],'unknown');
 const after=gate.begin();gate.close();assert.equal(gate.commit(after,{}),false);
});
pass('late old-principal reply cannot upgrade status after a changed session',()=>{
 const localEvents=[];let current={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
 const local=renderer.createRefreshGate({readSession:()=>current,onState:(...args)=>localEvents.push(args)});
 const ticket=local.begin();current={...current,credential_id:'credential-b'};
 assert.equal(local.checkSession(),false);assert.equal(local.commit(ticket,{exact:true}),false);
 assert.equal(localEvents.at(-1)[0],'principal_changed');assert.equal(local.begin(),null);
});
pass('persisted suspension invalidates old tickets and reopens only the same principal',()=>{
 let current={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
 const observed=[];const local=renderer.createRefreshGate({readSession:()=>current,onState:(...args)=>observed.push(args)});
 const stale=local.begin();assert.equal(local.suspend(),true);
 assert.equal(local.commit(stale,{stale:true}),false);assert.equal(local.begin(),null);
 assert.equal(observed.at(-1)[0],'unknown');
 assert.equal(local.resume(),true);
 const fresh=local.begin();assert.equal(local.commit(fresh,{fresh:true}),true);
 current={...current,token:'other'};assert.equal(local.suspend(),true);
 assert.equal(local.resume(),false);assert.equal(local.begin(),null);
 assert.equal(observed.at(-1)[0],'principal_changed');
 local.close();assert.equal(local.resume(),false);
});
class Element{
 constructor(){this.children=[];this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.attributes={};this.listeners={};this.clientWidth=600;this.clientHeight=400;this.textContent='';}
 append(...children){for(const child of children)child.parent=this;this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(event,fn){this.listeners[event]=fn;}
 removeEventListener(event,fn){if(this.listeners[event]===fn)delete this.listeners[event];}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelector(selector){if(selector==='[data-map-callout]')return this.children.find(child=>child.dataset?.mapCallout!==undefined);return null;}
}
const selectors=['viewport','surface','artwork','layer','status','alerts','selection','locations','alert-count'];
const elements=Object.fromEntries(selectors.map(key=>[key,new Element()]));
const section={querySelector:selector=>elements[selector.match(/^\[data-map-(.*)\]$/)?.[1]]};
const document={createElement:()=>new Element(),createTextNode:text=>({textContent:text})};
const rendererWindowListeners=new Map();
const window={crypto:webcrypto,matchMedia:()=>({matches:false}),
 addEventListener(name,fn){rendererWindowListeners.set(name,fn);},
 removeEventListener(name,fn){if(rendererWindowListeners.get(name)===fn)rendererWindowListeners.delete(name);}};
let fetches=0;const fetchImpl=async url=>{fetches++;assert.equal(url,'./dashboard-map-assets/approved-map-47-placement-anchors.json');
 return {ok:true,arrayBuffer:async()=>Uint8Array.from(anchors).buffer};};
const controller=renderer.create({section,auth:{readSession:()=>principal},fetchImpl,document,window});
await controller.init();
pass('local approved bytes create exactly 47 unmoved buttons and no status',()=>{
 assert.equal(fetches,1);assert.equal(elements.layer.children.length,47);
 assert.equal(elements.layer.children[0].dataset.status,'unknown');
 assert.equal(elements.artwork.src,'./dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png');
 assert.equal(elements.surface.style.width,`${1282*(600/1282)}px`);
});
const raw=JSON.parse(anchors),first=raw.locations[0],second=raw.locations[1];
const row=(location,status,color,extra={})=>({location_id:location.locationId,status_code:status,status_color:color,
 latest_completed_at:'2026-10-04T14:00:00Z',open_session_status:null,...extra});
const summary=rows=>({meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-04T15:00:00Z'},
 restrooms:rows,exhibits:[],open_tickets:[{location_id:first.locationId,status_code:'overdue'}]});
const ticket=controller.beginRefresh();controller.accept(ticket,summary([row(first,'overdue','red'),row(second,'okay','green')]));
pass('rendered red auto42/list and green24 from ID-only authenticated rows',()=>{
 assert.equal(elements.layer.children[0].style.width,'42px');
 assert.equal(elements.layer.children[0].dataset.status,'overdue');
 assert.equal(elements.layer.children[1].style.width,'24px');
 assert.equal(elements.alerts.children.length,1);
 assert.equal(elements.alerts.children[0].children[0].textContent,first.name);
});
const stale=controller.beginRefresh();
pass('refresh start immediately erases trusted color, retains urgent42 with unknown label',()=>{
 assert.equal(elements.layer.children[0].dataset.status,'unknown');
 assert.equal(elements.layer.children[0].style.width,'42px');
 assert.match(elements.alerts.children[0].children[1].textContent,/Status unavailable/);
});
controller.accept(stale,summary([row(first,'in_progress','blue',{open_session_status:'active',open_session_uuid:'active-session'})]));
pass('authoritative active blue releases persistent42 without camera/focus action',()=>{
 assert.equal(elements.layer.children[0].dataset.status,'in_progress');
 assert.equal(elements.layer.children[0].style.width,'24px');
 assert.equal(elements.alerts.children.length,0);
});
const failed=controller.beginRefresh();controller.fail(failed);
pass('network failure leaves unknown and no false green/black',()=>assert.equal(elements.layer.children[0].dataset.status,'unknown'));
pass('rendered post-commit principal change immediately clears even without another fetch',()=>{
 const current=controller.beginRefresh();controller.accept(current,summary([row(first,'okay','green')]));
 assert.equal(elements.layer.children[0].dataset.status,'okay');
 principal=null;assert.equal(controller.checkSession(),false);
 assert.equal(elements.layer.children[0].dataset.status,'unknown');
 assert.equal(elements.alerts.children.length,0,'old principal urgency is not retained');
 principal={manager_id:'manager-a',credential_id:'credential-a',token:'private-a',device_id:'device-a'};
});
const beforeSuspend=elements.layer.children.length;
const beforeSuspensionTicket=controller.beginRefresh();
assert.equal(controller.suspend(),true);
assert.equal(await controller.resume(),true);
pass('renderer BFCache suspend/resume retains exactly 47 approved pins without stale acceptance',()=>{
 assert.equal(beforeSuspend,47);
 assert.equal(controller.accept(beforeSuspensionTicket,summary([row(first,'okay','green')])),false);
 assert.equal(elements.layer.children.length,47);
 assert.equal(fetches,1,'approved anchors not refetched after persisted restoration');
 const fresh=controller.beginRefresh();
 assert.equal(controller.accept(fresh,summary([row(first,'overdue','red')])),true);
 assert.equal(elements.layer.children[0].dataset.status,'overdue');
});
const preDispose=controller.beginRefresh();controller.stop();
pass('final renderer disposal removes only owned pins and resize listener; late ticket cannot revive',()=>{
 assert.equal(elements.layer.children.length,0);
 assert.equal(rendererWindowListeners.size,0);
 assert.equal(controller.accept(preDispose,summary([row(first,'okay','green')])),false);
 assert.equal(controller.beginRefresh(),null);
});
const retryElements=Object.fromEntries(selectors.map(key=>[key,new Element()]));
const retrySection={querySelector:selector=>retryElements[selector.match(/^\[data-map-(.*)\]$/)?.[1]]};
const retryListeners=new Map();
const retryWindow={crypto:webcrypto,matchMedia:()=>({matches:false}),
 addEventListener(name,fn){retryListeners.set(name,fn);},
 removeEventListener(name,fn){if(retryListeners.get(name)===fn)retryListeners.delete(name);}};
let anchorCalls=0;
let resolveFirstAnchor;
const resumedRenderer=renderer.create({section:retrySection,auth:{readSession:()=>principal},document,window:retryWindow,
 fetchImpl:async()=>{
  anchorCalls++;
  if(anchorCalls===1)return new Promise(resolve=>{resolveFirstAnchor=resolve;});
  if(anchorCalls===2)throw Error('synthetic transient anchor refusal');
  return {ok:true,arrayBuffer:async()=>Uint8Array.from(anchors).buffer};
 }});
const originalInit=resumedRenderer.init();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(resumedRenderer.suspend(),true);
await assert.rejects(resumedRenderer.resume(),/transient anchor refusal/);
resolveFirstAnchor({ok:true,arrayBuffer:async()=>Uint8Array.from(anchors).buffer});
assert.equal(await originalInit,false);
pass('renderer failure rolls gate and renderer back without deleting accepted pins',()=>{
 assert.equal(resumedRenderer.beginRefresh(),null);
 assert.equal(retryElements.layer.children.length,0);
 assert.equal(retryListeners.size,0);
});
assert.equal(await resumedRenderer.resume(),true);
pass('renderer retries after transient rejection with one pin set and no duplicate resize listener',()=>{
 assert.equal(anchorCalls,3,'failed restoration retries the exact approved anchor resource');
 assert.equal(retryElements.layer.children.length,47);assert.equal(retryListeners.size,1);
 const fresh=resumedRenderer.beginRefresh();assert.ok(fresh);
 assert.equal(resumedRenderer.accept(fresh,summary([row(first,'okay','green')])),true);
});
resumedRenderer.stop();assert.equal(retryListeners.size,0);
const raceElements=Object.fromEntries(selectors.map(key=>[key,new Element()]));
const raceSection={querySelector:selector=>raceElements[selector.match(/^\[data-map-(.*)\]$/)?.[1]]};
const raceListeners=new Map();
const raceWindow={crypto:webcrypto,matchMedia:()=>({matches:false}),
 addEventListener(name,fn){raceListeners.set(name,fn);},
 removeEventListener(name,fn){if(raceListeners.get(name)===fn)raceListeners.delete(name);}};
let raceCalls=0,rejectInitial,rejectOld;
const racing=renderer.create({section:raceSection,auth:{readSession:()=>principal},document,window:raceWindow,
 fetchImpl:async()=>{
  raceCalls++;
  if(raceCalls===1)return new Promise((_,reject)=>{rejectInitial=reject;});
  if(raceCalls===2)return new Promise((_,reject)=>{rejectOld=reject;});
  return {ok:true,arrayBuffer:async()=>Uint8Array.from(anchors).buffer};
 }});
const staleInitial=racing.init();await new Promise(resolve=>setImmediate(resolve));racing.suspend();
const staleRestore=racing.resume();await new Promise(resolve=>setImmediate(resolve));racing.suspend();
assert.equal(await racing.resume(),true);
rejectOld(Error('old interrupted restoration'));await assert.rejects(staleRestore,/old interrupted restoration/);
rejectInitial(Error('old first anchor request rejected'));await assert.rejects(staleInitial,/old first anchor request rejected/);
pass('obsolete first-request and restoration rejections cannot roll back a newer renderer generation',()=>{
 assert.equal(raceCalls,3);assert.equal(raceElements.layer.children.length,47);
 assert.equal(raceListeners.size,1);const ticket=racing.beginRefresh();assert.ok(ticket);
 assert.equal(racing.accept(ticket,summary([row(first,'okay','green')])),true);
});
racing.stop();assert.equal(raceListeners.size,0);
pass('standalone page uses gated controller, no local opt-in bypass and preserves pulse/reduced motion',()=>{
 assert.match(html,/id="dashboard-map"[^>]+hidden/);
 assert.match(html,/src="\.\/dashboard-map-page\.js"/);
 assert.doesNotMatch(html,/staging_map|localhost|127\.0\.0\.1|data-map-zoom/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 for(const duration of ['4.8s','3.3s','2.4s'])assert.ok(css.includes(duration));
});
console.log('PASS standalone map renderer nonbrowser contract',checks,'NO_BROWSER_NO_BACKEND_NO_GPS_WRITE');
