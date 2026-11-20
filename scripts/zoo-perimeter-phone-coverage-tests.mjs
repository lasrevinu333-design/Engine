import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url),P=require('../memphis-zoo-perimeter.js'),MAP=require('../dashboard-map-staging.js'),FIT=require('../custodial-gps-approved-overall-fit.js'),PATH=require('../custodial-gps-path-model.js');
const anchors=await MAP.parseApprovedAnchors(new Uint8Array(readFileSync(new URL('../dashboard-map-assets/approved-map-47-placement-anchors.json',import.meta.url))),{subtle:webcrypto.subtle});
const registration=FIT.admit({anchors:FIT.transformAnchors(anchors)}),now=Date.parse('2026-11-19T17:00:00Z');let checks=0;
assert.equal(P.record.type,'Feature');assert.equal(P.record.geometry.type,'Polygon');assert.equal(P.record.properties.source.relation,11810360);checks+=3;
const ring=P.record.geometry.coordinates[0];assert.equal(ring.length,56);assert.deepEqual(ring[0],ring.at(-1));checks+=2;
const phone=(longitude,latitude,n=1)=>({deviceIdentifier:`KIOSK_${String(n).padStart(2,'0')}`,employeeId:`synthetic-employee-${n}`,employeeName:`Synthetic employee ${n}`,assignmentEpoch:1,
 position:{sampleId:`synthetic-sample-${n}`,observedAt:new Date(now-1000).toISOString(),receivedAt:new Date(now-500).toISOString(),latitude,longitude,accuracyM:10}});
let beyondOriginalArtwork=0;
for(const [longitude,latitude] of ring){
 assert.equal(P.contains(latitude,longitude),true,'boundary edge is included');
 const result=PATH.phone({registration,phone:phone(longitude,latitude),now});assert.equal(result.state,'live');assert.ok(result.position?.canvas);checks+=3;
 if(!registration.project(latitude,longitude,1).ok)beyondOriginalArtwork++;
}
assert.ok(beyondOriginalArtwork>0,'test actually covers zoo grounds beyond the old artwork crop');checks++;
const center=[-89.9935,35.1505];assert.equal(P.contains(center[1],center[0]),true);checks++;
for(let n=2;n<=10;n++){
 const result=PATH.phone({registration,phone:phone(...center,n),now});assert.equal(result.state,'live');assert.equal(result.deviceIdentifier,`KIOSK_${String(n).padStart(2,'0')}`);checks+=2;
}
for(const point of [[-89.999,35.15],[-89.992,35.146],[-89.9874406,35.1483611]]){
 assert.equal(P.contains(point[1],point[0]),false);assert.equal(PATH.phone({registration,phone:phone(...point),now}).position,null);checks+=2;
}
for(const bad of [[NaN,35],[-89,Infinity],['-89.99',35],[-89.99,null]]){assert.equal(P.contains(bad[1],bad[0]),false);checks++;}
const stale=phone(...center);stale.position.observedAt=new Date(now-120001).toISOString();assert.equal(PATH.phone({registration,phone:stale,now}).state,'stale');checks++;
const future=phone(...center);future.position.observedAt=new Date(now+1).toISOString();assert.equal(PATH.phone({registration,phone:future,now}).position,null);checks++;
const uncertain=phone(...center);uncertain.position.accuracyM=1000;const result=PATH.phone({registration,phone:uncertain,now});assert.equal(result.position.reportedAccuracyM,1000);assert.equal(result.position.absoluteUncertaintyUnknown,true);checks+=2;
assert.equal(Object.isFrozen(P.record.geometry.coordinates[0]),true);assert.throws(()=>P.record.geometry.coordinates[0].push([0,0]));checks+=2;
console.log(JSON.stringify({status:'ZOO_PERIMETER_PHONE_COVERAGE_PASS',checks,boundaryVertices:ring.length,beyondOriginalArtwork,allAssignedPhoneIdentifiers:9,source:'OpenStreetMap relation 11810360',releaseAdmission:false,device:false}));
