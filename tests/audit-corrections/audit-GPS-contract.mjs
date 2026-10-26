import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=process.argv[2],now=Date.parse('2026-09-18T18:00:00.000Z');
const context={window:{},Date};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/memphis-gps.js','utf8'),context);
const gps=context.window.MemphisGps,position={latitude:35.15,longitude:-90.05,accuracy_m:5,timestamp:now};
const configured={campus_latitude:35.15,campus_longitude:-90.05,campus_radius_meters:900,location_latitude:35.15,location_longitude:-90.05,location_radius_meters:100,location_configured:true,now_ms:now};
const tests=[];function test(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
const ABSENT=Symbol('absent');const invalidRadii=[['absent',ABSENT],['null',null],['blank',' '],['zero',0],['negative',-1],['nonfinite',Infinity],['excessive',5000.01]];
for(const [name,value] of invalidRadii){
 test('campus radius '+name+' cannot report authoritative proximity',()=>{const candidate={...configured};if(value===ABSENT)delete candidate.campus_radius_meters;else candidate.campus_radius_meters=value;const result=gps.evaluate(position,candidate);assert.equal(result.result,'gps_unconfigured');assert.equal(result.authoritative,false);assert.equal(result.campus_radius_m,null);});
 test('exact radius '+name+' cannot report authoritative proximity',()=>{const candidate={...configured};if(value===ABSENT)delete candidate.location_radius_meters;else candidate.location_radius_meters=value;const result=gps.evaluate(position,candidate);assert.equal(result.result,'onsite_location_unverified');assert.equal(result.authoritative,false);assert.equal(result.location_radius_m,null);assert.equal(result.location_geofence_configured,false);});
}
for(const value of [null,undefined,'',' ',false,[],{},Infinity])test('missing/invalid campus coordinates '+String(value),()=>{
 const result=gps.evaluate(position,{...configured,campus_latitude:value,campus_longitude:value});
 assert.equal(result.authoritative,false);assert.equal(result.campus_distance_m,null);
});
for(const [latitude,longitude] of [[91,0],[-91,0],[0,181],[0,-181]])test('invalid coordinate range '+latitude+'/'+longitude,()=>{
 assert.equal(gps.distanceMeters({latitude,longitude},{latitude:0,longitude:0}),null);
});
test('real numeric zero is not missing',()=>assert.equal(gps.distanceMeters({latitude:0,longitude:0},{latitude:0,longitude:0}),0));
test('valid configured area still classifies near',()=>assert.equal(gps.evaluate(position,configured).result,'inside_scanned_location'));
test('radius contract has bounded versioned source-safety limits',()=>{assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.contract_version,'gps-radius-input-policy.v1');assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.campus.maximum_meters,5000);assert.equal(gps.GPS_RADIUS_INPUT_POLICY_V1.location.maximum_meters,5000);});
const scan=fs.readFileSync(root+'/index.html','utf8');
const fallbackSource=scan.slice(scan.indexOf('function gpsEvaluatorUnavailable('),scan.indexOf('async function reportWorkPosition('));
test('scan evaluator-unavailable fallback cannot invent radius authority',()=>{assert.ok(fallbackSource);const sandbox={};vm.createContext(sandbox);vm.runInContext(fallbackSource,sandbox);const result=sandbox.gpsEvaluatorUnavailable();assert.equal(result.authoritative,false);assert.equal(result.campus_radius_m,null);assert.equal(result.location_radius_m,null);assert.equal(result.location_geofence_configured,false);});
test('scan evidence preserves explicit zero radius instead of truthy substitution',()=>{const report=scan.slice(scan.indexOf('async function reportWorkPosition('),scan.indexOf('function sampleWorkPosition('));assert.match(report,/allowed_radius_m\)\?\?/);assert.doesNotMatch(report,/campus_radius_meters\|\|900|location_radius_meters\|\|120/);});
const html=fs.readFileSync(root+'/dashboard.html','utf8');const source=html.slice(html.indexOf('function workSignalForRow('),html.indexOf('function workSignalMarkup('));
class Clock extends Date{static now(){return now;}}
for(const result of ['near','away','inside_scanned_location','outside_scanned_location'])test('backend/local explicit GPS vocabulary '+result,()=>{
 const c={Date:Clock,normalizeStatus:()=> 'in_progress',dashboardState:{workAlerts:[{session_uuid:'s1',location_code:'NOCX',device_identifier:'KIOSK_08',session_status:'active',result,payload_json:{observed_at:'2026-09-18T18:00:00Z'}}]}};
 vm.createContext(c);vm.runInContext(source,c);const actual=c.workSignalForRow({open_session_uuid:'s1',location_code:'NOCX',open_session_device_identifier:'KIOSK_08'});
 assert.equal(actual.kind,['near','inside_scanned_location'].includes(result)?'near':'away');
});
console.log(JSON.stringify({scope:'Actual evaluator and dashboard functions, synthetic location fixtures; no real movement',passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,tests},null,2));process.exitCode=tests.some(t=>!t.passed)?1:0;
