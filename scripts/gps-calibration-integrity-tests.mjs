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
