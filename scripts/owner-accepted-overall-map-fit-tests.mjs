// Owner-accepted exact source/renderer qualification only. All observations,
// principals and DOM are synthetic; no browser, phone or ground accuracy proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {discoverRuntimeFiles} from './refresh-frontend-release-manifest.mjs';
const require=createRequire(import.meta.url),root=new URL('..',import.meta.url);
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const MAP=require('../dashboard-map-staging.js');
const FIT=require('../custodial-gps-approved-overall-fit.js');
const PATH=require('../custodial-gps-path-model.js');
const raw=read('dashboard-map-assets/approved-map-47-placement-anchors.json');
const originals=JSON.parse(raw),sealBytes=read('docs/owner-accepted-overall-map-fit-20261010.json');
const seal=JSON.parse(sealBytes),placementBytes=read('docs/owner-accepted-overall-map-fit-initial-placements-20261010.json');
const placements=JSON.parse(placementBytes);
const original=await MAP.parseApprovedAnchors(new Uint8Array(raw),{subtle:crypto.webcrypto.subtle});
const transformed=FIT.transformAnchors(original),registration=FIT.admit({anchors:transformed});
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('sealed overall identity and exact copied artwork, not local stretch',()=>{
 assert.equal(sha(sealBytes),FIT.SEAL_SHA);assert.equal(sha(placementBytes),'fa3457d9aae858d36368e27f00cdd91f8e0bcc5e3a771f6d6c932c2c5e77f7af');
 assert.equal(sha(read('dashboard-map-assets/Memphis-Zoo-Approved-Overall-Fit-Art-Only-20261010.png')),FIT.ARTWORK_SHA);
 assert.match(seal.userApproval.scope,/OVERALL affine/);assert.deepEqual(seal.acceptedArtRaster.pixels,[2040,890]);
});
check('original artwork and exact 47 anchors including 34 offsets remain byte-identical',()=>{
 assert.equal(sha(raw),FIT.ANCHOR_SHA);
 assert.equal(sha(read(FIT.ORIGINAL_ARTWORK.slice(2))),seal.acceptedArtRaster.sourceApprovedRasterSha256);
 assert.equal(originals.ownerAdjustedLocationCount,34);
 assert.equal(originals.locations.filter(p=>p.ownerSelectedDisplayOffset.dx||p.ownerSelectedDisplayOffset.dy).length,34);
});
check('all 47 IDs and approved display points undergo exactly the same accepted artwork affine',()=>{
 assert.equal(transformed.locations.length,47);assert.equal(transformed.width,2040);assert.equal(transformed.height,890);
 for(const p of transformed.locations){
  const saved=placements.locations.find(x=>x.locationId===p.locationId);assert(saved);
  assert.deepEqual(p.originalCanvasPoint,saved.originalApprovedCanvasPoint);
  assert(Math.abs(p.canvasPoint.x-saved.sameArtworkWarpInitialDisplayPoint.x)<1e-9);
  assert(Math.abs(p.canvasPoint.y-saved.sameArtworkWarpInitialDisplayPoint.y)<1e-9);
 }
});
check('wrong original source identity, canvas, duplicate IDs and nonfinite point refuse',()=>{
 for(const x of [{...original,digest:'0'.repeat(64)},{...original,width:2040},
  {...original,locations:[original.locations[0],...original.locations.slice(0,46)]},
  {...original,locations:[{...original.locations[0],canvasPoint:{x:NaN,y:1}},...original.locations.slice(1)]}])
  assert.throws(()=>FIT.transformAnchors(x),/exact unchanged|original approved/);
});
check('caller-authored projected JSON cannot replace the fixed approved reference',()=>{
 assert.throws(()=>FIT.admit({anchors:{...transformed}}),/own exact accepted/);
 assert(Object.isFrozen(FIT));assert(Object.isFrozen(FIT.quality));
});
check('matrix and inverse reproduce sealed native-canvas source points',()=>{
 for(const p of transformed.locations){const inverse=FIT.rasterToNative(p.canvasPoint);
  assert(Math.hypot(inverse.x-p.originalCanvasPoint.x,inverse.y-p.originalCanvasPoint.y)<1e-9);}
 const C=seal.transforms.nativeCanvasToFullRasterRowMatrix3x2,p={x:500,y:250};
 assert.deepEqual(FIT.nativeToRaster(p),{x:p.x*C[0][0]+p.y*C[1][0]+C[2][0],y:p.x*C[0][1]+p.y*C[1][1]+C[2][1]});
});
check('fixed accepted EPSG3857 inverse roundtrips raster points without a new fit',()=>{
 for(const p of [{x:500,y:300},{x:1000,y:450},{x:1600,y:600}]){
  const g=FIT.rasterToWgs84(p),result=registration.project(g.latitude,g.longitude,3);
  assert.equal(result.ok,true);assert(Math.hypot(result.canvas.x-p.x,result.canvas.y-p.y)<1e-7);
 }
});
check('reported device accuracy is distinct from UNKNOWN total map uncertainty and domain',()=>{
 const g=FIT.rasterToWgs84({x:1000,y:450}),p=registration.project(g.latitude,g.longitude,5);
 assert.equal(p.reportedAccuracyM,5);assert.equal(p.uncertaintyM,null);assert.equal(p.absoluteUncertaintyUnknown,true);
 assert(p.uncertaintyCanvasPx>0);assert.equal(registration.quality.absoluteGroundAccuracyVerified,false);
 assert.equal(registration.quality.walkingDomainVerified,false);assert.equal(registration.quality.geographicAcceptanceTolerance,null);
});
check('invalid/missing accuracy or impossible coordinates cannot yield a mapped reading',()=>{
 for(const args of [[35,-90,0],[35,-90,null],[35,-90,'3'],[NaN,-90,3],[90,-90,3],[35,181,3]])
  assert.equal(registration.project(...args).ok,false);
});
check('display extent and reported-accuracy clipping are explicit rejections, not a validated walking domain',()=>{
 assert.equal(registration.project(0,0,3).reason,'outside_accepted_raster_extent');
 const g=FIT.rasterToWgs84({x:1,y:1});
 assert.equal(registration.project(g.latitude,g.longitude,5).reason,'reported_accuracy_outside_accepted_raster_extent');
});
const now=Date.now(),session={uuid:'synthetic-work',clientSessionId:'synthetic-work',employeeId:'synthetic-worker',
 locationCode:'synthetic-location',deviceIdentifier:'synthetic-device',status:'active',startedAt:new Date(now-60000).toISOString()};
const sample=(id,time,p={x:1000,y:450})=>{const g=FIT.rasterToWgs84(p);return{id,event_type:'work_position_check',session_uuid:session.uuid,
 employee_id:session.employeeId,location_code:session.locationCode,device_identifier:session.deviceIdentifier,
 payload_json:{session_uuid:session.uuid,client_session_id:session.clientSessionId,observed_at:new Date(now+time).toISOString(),
 client_latitude:g.latitude,client_longitude:g.longitude,accuracy_m:3}};};
check('existing path model keeps measured active-work identity, rejection gaps and stale current behavior',()=>{
 const a=sample('a',-30000),b=sample('b',-20000),bad={...sample('bad',-25000),employee_id:'other'};
 const result=PATH.path({registration,observations:[a,bad,b],session,now});
 assert.equal(result.rejected.length,1);assert.deepEqual(result.segments.map(s=>s.length),[1,1]);
 assert.equal(result.current.eventId,'b');
 assert.equal(PATH.path({registration,observations:[a,b],session,now:now+180000}).current,null);
});
check('unknown chronology withholds path/current; completed or cross-work records never expand collection',()=>{
 const bad=sample('bad',-25000);bad.payload_json.observed_at=null;
 const result=PATH.path({registration,observations:[sample('a',-30000),bad,sample('b',-20000)],session,now});
 assert.equal(result.chronologyUnknown,true);assert.equal(result.current,null);assert.equal(result.segments.length,0);
 assert.throws(()=>PATH.path({registration,observations:[],session:{...session,status:'complete'},now}),/active session identity/);
});
class Element{
 constructor(){this.children=[];this.dataset={};this.attributes={};this.style={setProperty(k,v){this[k]=v;}};this.clientWidth=600;this.clientHeight=400;}
 append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}
 addEventListener(){}removeEventListener(){}remove(){}
 setAttribute(k,v){this.attributes[k]=v;}
 querySelector(){return this.children.find(x=>x.dataset?.mapCallout!==undefined);}
}
const elements=Object.fromEntries(['viewport','surface','artwork','layer','status','alerts','selection','locations','alert-count','gps-layer','gps-status'].map(k=>[k,new Element()]));
const document={createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:text=>({textContent:text})};
const section={querySelector:s=>elements[s.match(/^\[data-map-(.*)\]$/)?.[1]]};
let principal={manager_id:'synthetic-manager',credential_id:'synthetic-credential',token:'synthetic-token'};
const context={MemphisDashboardMapStaging:MAP,MemphisCustodialGpsApprovedOverallFit:FIT,MemphisCustodialGpsPathModel:PATH,
 crypto:crypto.webcrypto,Uint8Array,document,Date,fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(raw).buffer}),
 matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){}};
vm.createContext(context);vm.runInContext(read('dashboard-map-renderer.js').toString(),context);
const controller=context.MemphisDashboardMapRenderer.create({section,auth:{readSession:()=>principal},document,window:context});
await controller.init();
check('actual renderer uses accepted artwork, full extent and unchanged stable pin IDs',()=>{
 assert.equal(elements.artwork.src,'./dashboard-map-assets/Memphis-Zoo-Approved-Overall-Fit-Art-Only-20261010.png');
 assert.equal(elements.artwork.attributes.width,'2040');assert.equal(elements.artwork.attributes.height,'890');
 assert.equal(elements['gps-layer'].attributes.viewBox,'0 0 2040 890');assert.equal(elements.layer.children.length,47);
 const first=transformed.locations[0],pin=elements.layer.children[0];
 assert.equal(pin.dataset.locationId,original.locations[0].locationId);
 assert.equal(pin.style.left,String(first.canvasPoint.x*(600/2040))+'px');
 assert.equal(pin.style.top,String(first.canvasPoint.y*(600/2040))+'px');
});
const ticket=controller.beginRefresh();
check('renderer consumes active-work history without fabricated surveyed controls or numeric owner tolerance',()=>{
 assert.equal(controller.acceptGps(ticket,{controls:null,work:[{session,observations:[sample('a',-30000),sample('b',-20000)]}]}),true);
 assert.equal(elements['gps-layer'].children.filter(x=>x.attributes.points).length,1);
 assert.match(elements['gps-status'].textContent,/Advisory GPS on owner-accepted overall visual fit/);
 assert.match(elements['gps-status'].textContent,/device accuracy ONLY; map\/absolute error is unknown/);
 assert.doesNotMatch(elements['gps-status'].textContent,/Survey registered|accuracy PASS/);
});
check('new refresh and changed named-manager principal invalidate late advisory paths',()=>{
 controller.beginRefresh();assert.equal(controller.acceptGps(ticket,{work:[]}),false);
 const current=controller.beginRefresh();principal=null;
 assert.equal(controller.acceptGps(current,{work:[{session,observations:[sample('a',-30000)]}]}),false);
 assert.equal(elements['gps-layer'].children.length,0);
});
controller.stop();
check('both manager map entrypoints load the exact reference before renderer and no new collector',()=>{
 for(const name of ['dashboard-map.html','operations-dashboard.html']){const html=read(name).toString();
  assert(html.indexOf('custodial-gps-approved-overall-fit.js')<html.indexOf('dashboard-map-renderer.js'));
  assert.match(html,/width="2040" height="890"/);}
 const source=read('custodial-gps-approved-overall-fit.js').toString();
 assert.doesNotMatch(source,/watchPosition|setInterval|sendBeacon|fetch\(|localStorage|sessionStorage/);
});
check('closed runtime graph includes exact accepted raster/reference plus original rollback assets',()=>{
 const runtime=discoverRuntimeFiles(root.pathname);
 for(const name of ['custodial-gps-approved-overall-fit.js','dashboard-map-assets/Memphis-Zoo-Approved-Overall-Fit-Art-Only-20261010.png',
 'dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png'])assert(runtime.includes(name));
});
console.log(JSON.stringify({status:'PASS_OWNER_ACCEPTED_OVERALL_MAP_SOURCE_RENDERER_ONLY',cases:checks,
 actual_browser:false,absolute_ground_accuracy:false,phone_field:false,independent_audit:false}));
