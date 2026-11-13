import {assertCurrentGpsInventory,assertBoundCurrentGpsSource,assertGpsHistoricalInventoryProjection,normalizeCurrentGpsForHistoricalComparison} from './current-gps-qualification-source-boundary.mjs';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {approvedPreservationComparisonPins} from './current-approved-preservation-source-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateCurrentProviderComparisonContext(value){
 assert.equal(sha(JSON.stringify(value)),'ba94b8913b6849c086ca4b61c1f3af5117339f04d3d18ea7522e5fc66600ce15','Exact current-bound historical comparison context; original fixtures stay unchanged');
 for(const key of ['runtime_admission','release_admission','native_authority','hardware_acceptance','historical_pins_rewritten'])assert.equal(value[key],false);
 assert.equal(sha(JSON.stringify(approvedPreservationComparisonPins.current_java_inventory)),value.current_inventory_sha256);
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const currentProviderComparisonContext=freeze(validateCurrentProviderComparisonContext(JSON.parse(readFileSync(new URL('./fixtures/current-provider-comparison-context.json',import.meta.url),'utf8'))));
export function assertCurrentProviderComparisonInventory(){
 const proof=assertGpsHistoricalInventoryProjection(approvedPreservationComparisonPins.current_java_inventory,
  currentProviderComparisonContext.current_test_java_inventory,currentProviderComparisonContext.current_auxiliary_inventory);
 return proof.actual_main; // 194 actual current types; never report the 193-type historical projection as current.
}
export function assertBoundCurrentProviderSource(name,source){
 return assertBoundCurrentGpsSource(name,source);
}
// Source comparison only. The shipping app never imports this module. A full
// current input and the complete 194-file actual inventory are checked before
// a distinct 193-file historical comparison is supplied. Unknown bytes pass through
// to the unchanged older strict guard; this is not a blanket section omission.
export function normalizeBoundProviderComparison(name,source){
 source=normalizeCurrentGpsForHistoricalComparison(name,source);
 const row=currentProviderComparisonContext.files.find(row=>row.name===name||row.current_path===name||name.endsWith('/'+row.name));
 if(!row||!row.comparison_input_sha256.includes(sha(source)))return source;
 assertCurrentProviderComparisonInventory();
 const bytes=readFileSync(resolve(root,row.comparison_path));assert.equal(sha(bytes),row.comparison_sha256,'Complete genuine historical bytes and known audio successors remain pinned');
 return bytes.toString('utf8');
}
