import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const box={module:{exports:{}},Date,Math,Number};vm.createContext(box);
vm.runInContext(fs.readFileSync(new URL('../memphis-gps.js',import.meta.url),'utf8'),box);
const gps=box.module.exports,now=Date.now();
// Fictional deterministic geometry, not surveyed zoo coordinates.
const position={latitude:35,longitude:-90,accuracy_m:5,timestamp:now};
const fence={campus_latitude:35,campus_longitude:-90,campus_radius_meters:900,location_latitude:35,location_longitude:-90,location_configured:true,location_radius_meters:120,now_ms:now};
const results=[];
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
check('configured current geometry is near',()=>assert.equal(gps.evaluate(position,fence).result,'inside_scanned_location'));
const ABSENT=Symbol('absent');
const invalidRadii=[
  ['absent',ABSENT],['null',null],['blank',' '],['zero',0],['negative',-1],
  ['positive infinity',Infinity],['negative infinity',-Infinity],['NaN',NaN],['excessive',5000.01],
];
for(const [name,value] of invalidRadii){
  check(`campus radius ${name} stays uncalibrated and non-authoritative`,()=>{
    const candidate={...fence};if(value===ABSENT)delete candidate.campus_radius_meters;else candidate.campus_radius_meters=value;
    const actual=gps.evaluate(position,candidate);
    assert.equal(actual.result,'gps_unconfigured');assert.equal(actual.authoritative,false);
    assert.equal(actual.campus_radius_m,null);assert.equal(actual.badgeKind,'warn');
  });
  check(`exact-location radius ${name} stays uncalibrated and non-authoritative`,()=>{
    const candidate={...fence};if(value===ABSENT)delete candidate.location_radius_meters;else candidate.location_radius_meters=value;
    const actual=gps.evaluate(position,candidate);
    assert.equal(actual.result,'onsite_location_unverified');assert.equal(actual.authoritative,false);
    assert.equal(actual.location_radius_m,null);assert.equal(actual.location_geofence_configured,false);
    assert.equal(actual.badgeKind,'warn');
  });
}
check('radius source-safety policy is explicit and versioned',()=>{
  assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.contract_version,'gps-radius-input-policy.v1');
  assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.campus.minimum_meters,100);
  assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.campus.maximum_meters,5000);
  assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.location.minimum_meters,25);
  assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.location.maximum_meters,5000);
});
for(const [name,campusRadius,locationRadius] of [['minimum',100,25],['maximum',5000,5000]]){
  check(`valid explicit ${name} radii retain configured classification`,()=>{
    const actual=gps.evaluate(position,{...fence,campus_radius_meters:campusRadius,location_radius_meters:locationRadius});
    assert.equal(actual.result,'inside_scanned_location');assert.equal(actual.authoritative,true);
  });
}
for(const [name,patch] of [['latitude outside legal range',{location_latitude:999}],['longitude outside legal range',{location_longitude:-999}],['missing exact latitude',{location_latitude:null}],['blank exact longitude',{location_longitude:' '}]]){
  check(name+' cannot report authoritative proximity',()=>assert.equal(gps.evaluate(position,{...fence,...patch}).authoritative,false));
}
for(const timestamp of [undefined,null,'','not-a-time','   ']){
  check(`missing/invalid capture timestamp ${String(timestamp)} cannot become now`,()=>{
    const value=gps.evaluate({...position,timestamp},fence);assert.equal(value.authoritative,false);
    assert.equal(value.observed_at,null,'Unknown capture time must remain unknown');
  });
}
check('actual epoch zero remains stale, not current',()=>{const value=gps.evaluate({...position,timestamp:0},fence);assert.equal(value.result,'gps_stale');assert.equal(value.authoritative,false);});
check('explicit valid ISO capture works',()=>assert.equal(gps.evaluate({...position,timestamp:new Date(now).toISOString()},fence).result,'inside_scanned_location'));
check('missing campus configuration cannot produce OFFSITE',()=>assert.equal(gps.evaluate(position,{}).authoritative,false));
console.log(JSON.stringify({scope:'Exact GPS evaluator with synthetic positions; no real GPS or surveyed calibration',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));process.exitCode=results.some(r=>!r.passed)?1:0;
