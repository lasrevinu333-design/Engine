import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const map=require('../dashboard-map-staging.js');
// Verify the exact shipped copies, not another task's locally available files.
const ASSET_ROOT=new URL('../dashboard-map-assets/',import.meta.url);
const ANCHORS=new URL('approved-map-47-placement-anchors.json',ASSET_ROOT);
const bytes=readFileSync(ANCHORS),sha=buffer=>createHash('sha256').update(buffer).digest('hex');
assert.equal(sha(bytes),map.ANCHOR_SHA);
const png=readFileSync(new URL('Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png',ASSET_ROOT));
assert.equal(sha(png),'73d4d6116819d34b0c5e6d35bf0d3c8397d582445fb92bf734fc6448fbb3a57a');
assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1282,550]);
for(const [file,digest] of [['custodial-men-icon.svg','e3a52bca2f014ff456265dd78af3f894cd1a8e6672c9e0b72a077c435db4bb36'],
 ['custodial-women-icon.svg','59da42531add77498eec1a57f01c55907ad687d636eae5fcdc9f0d7f8053839c'],
 ['custodial-building-icon.svg','494cc8bc0010e9c14baa50419d7afe2292e9297266af455c1dbfa390f9837c53']])
 assert.equal(sha(readFileSync(new URL(file,ASSET_ROOT))),digest);
const anchors=await map.parseApprovedAnchors(bytes,{subtle:webcrypto.subtle});
const first=anchors.locations[0],second=anchors.locations[1];
let checks=0;const pass=(name,fn)=>{fn();checks++;console.log('PASS',name);};
pass('exact saved 47 stable positions, 34 owner adjustments, full pretransformed PNG domain',()=>{
 assert.equal(anchors.locations.length,47);assert.deepEqual([anchors.width,anchors.height],[1282,550]);
 assert.deepEqual(anchors.locations.map(x=>x.locationId).length,new Set(anchors.locations.map(x=>x.locationId)).size);
 const raw=JSON.parse(bytes);assert.equal(raw.locations.filter(x=>x.ownerSelectedDisplayOffset.dx||x.ownerSelectedDisplayOffset.dy).length,34);
 assert.deepEqual(first.canvasPoint,raw.locations[0].approvedOverlayCanvasPoint);
});
const row=(marker,status,statusColor,extras={})=>({location_id:marker.locationId,location_code:marker.entityCode,
 location_name:'Untrusted alternate name',status_code:status,status_color:statusColor,
 latest_completed_at:'2026-10-04T14:00:00.000Z',open_session_status:null,...extras});
const envelope=rows=>({meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-04T15:00:00.000Z'},
 restrooms:rows,exhibits:[],open_tickets:[{location_id:first.locationId,status_color:'red'}]});
const current='CURRENT_AUTHENTICATED_RESPONSE';
const project=(rows,transport=current)=>map.project({anchors,summary:envelope(rows),transport});
pass('live authenticated ID join only; no name, ticket or demo-color match',()=>{
 const markers=project([row(second,'overdue','red')]);
 assert.equal(markers[0].status,'unknown');assert.equal(markers[1].status,'overdue');
 assert.equal(markers[1].name,second.name);assert.deepEqual(markers[1].canvasPoint,second.canvasPoint);
});
pass('no implicit currentness, offline/error and malformed envelope never black',()=>{
 assert.ok(map.project({anchors,summary:envelope([row(first,'not_cleaned','black')])}).every(x=>x.status==='unknown'));
 assert.ok(map.project({anchors,summary:envelope([row(first,'not_cleaned','black')]),transport:'STALE'}).every(x=>x.status==='unknown'));
 assert.ok(map.project({anchors,summary:null,transport:current}).every(x=>x.status==='unknown'));
 assert.ok(map.project({anchors,summary:{...envelope([]),meta:{contracts:{dashboard:'old'},generated_at:'bad'}},transport:current})
  .every(x=>x.status==='unknown'));
});
pass('exact five current status/color pairs',()=>{
 const cases=[['not_cleaned','black',{}],['in_progress','blue',{open_session_status:'active',open_session_uuid:'exact-active'}],
  ['okay','green',{}],['due_soon','yellow',{}],['overdue','red',{}]];
 for(const [status,color,extra] of cases)assert.equal(project([row(first,status,color,extra)])[0].status,status);
});
pass('old completion does not falsify authoritative new-day not-cleaned',()=>{
 assert.equal(project([row(first,'not_cleaned','black',{latest_completed_at:'2026-10-03T10:00:00.000Z'})])[0].status,'not_cleaned');
});
pass('pending/offline/unverified and mismatched code/color never infer completion or Start',()=>{
 for(const open of ['pending_submit','offline-provisional','closed'])
  assert.equal(project([row(first,'in_progress','blue',{open_session_status:open})])[0].status,'unconfirmed');
 assert.equal(project([row(first,'in_progress','blue',{open_session_status:'active',open_session_uuid:null})])[0].status,'unconfirmed');
 assert.equal(project([row(first,'okay','green',{latest_completed_at:null})])[0].status,'unconfirmed');
 assert.equal(project([row(first,'overdue','green')])[0].status,'unknown');
 assert.equal(project([row(first,'unexpected','black')])[0].status,'unknown');
});
pass('server due/red may coexist with active work; never recolor to blue or hide red',()=>{
 for(const [status,color] of [['due_soon','yellow'],['overdue','red']]){
  const marker=project([row(first,status,color,{open_session_status:'active',open_session_uuid:'exact-active'})])[0];
  assert.equal(marker.status,status);
  assert.equal(marker.activeWork,'Dashboard reports active cleaning');
  assert.equal(map.presentation(marker).sizePx,42);
  const incomplete=project([row(first,status,color,{open_session_status:'active',open_session_uuid:null})])[0];
  assert.equal(incomplete.status,status);
  assert.equal(incomplete.activeWork,'Active work identity incomplete');
 }
});
pass('due/red retain server status even without local completion field; green requires one',()=>{
 assert.equal(project([row(first,'overdue','red',{latest_completed_at:null})])[0].status,'overdue');
 assert.equal(project([row(first,'due_soon','yellow',{latest_completed_at:null})])[0].status,'due_soon');
 assert.equal(project([row(first,'okay','green',{latest_completed_at:null})])[0].status,'unconfirmed');
});
pass('duplicate exact ID is ambiguous, never choose first or last',()=>{
 assert.equal(project([row(first,'okay','green'),row(first,'overdue','red')])[0].status,'unknown');
});
let state=map.initialInteraction();const ids=new Set(anchors.locations.map(x=>x.locationId));
const marker=status=>project([row(first,status,{not_cleaned:'black',in_progress:'blue',okay:'green',due_soon:'yellow',overdue:'red'}[status],
  status==='in_progress'?{open_session_status:'active',open_session_uuid:'exact-active'}:{})])[0];
pass('red/yellow auto42/details persist through unknown/black until authoritative blue/green',()=>{
 let red=marker('overdue');state=map.reconcileUrgency(state,[red]);
 assert.deepEqual([map.presentation(red,{interaction:state}).sizePx,map.presentation(red,{interaction:state}).detailsVisible],[42,true]);
 let unknown=project([])[0];state=map.reconcileUrgency(state,[unknown]);
 assert.equal(map.presentation(unknown,{interaction:state}).sizePx,42);
 assert.equal(map.presentation(unknown,{interaction:state}).statusLabel,'Status unavailable');
 let black=marker('not_cleaned');state=map.reconcileUrgency(state,[black]);
 assert.equal(map.presentation(black,{interaction:state}).sizePx,42);
 let blue=marker('in_progress');state=map.reconcileUrgency(state,[blue]);
 assert.equal(map.presentation(blue,{interaction:state}).sizePx,24);
 let yellow=marker('due_soon');state=map.reconcileUrgency(state,[yellow]);
 assert.equal(map.presentation(yellow,{interaction:state}).sizePx,42);
 let green=marker('okay');state=map.reconcileUrgency(state,[green]);
 assert.equal(map.presentation(green,{interaction:state}).sizePx,24);
});
pass('hover/tap/focus manual42 without moving selected point or stealing focus',()=>{
 const green=marker('okay');for(const type of ['hover','focus','tap']){
  let s=map.interact(map.initialInteraction(),{type,locationId:first.locationId},ids);
  assert.equal(map.presentation(green,{interaction:s}).sizePx,42);
  assert.deepEqual(map.presentation(green,{interaction:s}).canvasPoint,first.canvasPoint);
 }
 assert.equal(map.presentation(green,{interaction:map.initialInteraction()}).sizePx,24);
 assert.throws(()=>map.interact(map.initialInteraction(),{type:'tap',locationId:'foreign'},ids));
});
pass('black static, blue/green gentle, yellow urgent, red highest; reduced motion preserves size/details',()=>{
 for(const [status,pulse] of [['not_cleaned','none'],['in_progress','gentle'],['okay','gentle'],['due_soon','urgent'],['overdue','highest']]){
  const p=map.presentation(marker(status));assert.equal(p.pulse,pulse);
  const reduced=map.presentation(marker(status),{reducedMotion:true});assert.equal(reduced.pulse,'none');
  assert.equal(reduced.sizePx,p.sizePx);assert.equal(reduced.detailsVisible,p.detailsVisible);
 }
});
pass('one shared image/icon viewport transform; glyph size screen-constant, no second matrix',()=>{
 const viewport={originX:10,originY:20,panX:5,panY:-3,fitScale:.5,zoom:2};
 const point=map.screenPoint(first.canvasPoint,viewport);
 assert.equal(point.x,15+first.canvasPoint.x);assert.equal(point.y,17+first.canvasPoint.y);
 assert.throws(()=>map.screenPoint(first.canvasPoint,{...viewport,zoom:0}));
});
{
 const changed=Buffer.from(bytes);changed[changed.length-2]=changed[changed.length-2]===32?10:32;
 await assert.rejects(()=>map.parseApprovedAnchors(changed,{subtle:webcrypto.subtle}));
 checks++;console.log('PASS changed approved bytes rejected before any map construction');
}
console.log('PASS staging map pure source contract',checks,'NO_BROWSER_NO_BACKEND_NO_GPS_WRITE');
