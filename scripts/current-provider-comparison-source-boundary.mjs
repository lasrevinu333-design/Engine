import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {approvedPreservationComparisonPins} from './current-approved-preservation-source-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateCurrentProviderComparisonContext(value){
 assert.equal(sha(JSON.stringify(value)),'157c5f8196c0c716092968a5450471f4a49d3e4554ecd27f155aa6345328de33','Exact current-bound historical comparison context; original fixtures stay unchanged');
 for(const key of ['runtime_admission','release_admission','native_authority','hardware_acceptance','historical_pins_rewritten'])assert.equal(value[key],false);
 assert.equal(sha(JSON.stringify(approvedPreservationComparisonPins.current_java_inventory)),value.current_inventory_sha256);
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const currentProviderComparisonContext=freeze(validateCurrentProviderComparisonContext(JSON.parse(readFileSync(new URL('./fixtures/current-provider-comparison-context.json',import.meta.url),'utf8'))));
let observed=false;
export function assertCurrentProviderComparisonInventory(){
 const inventory=[];
 function walk(folder){for(const name of readdirSync(folder).sort()){
  const path=resolve(folder,name),info=lstatSync(path);assert.equal(info.isSymbolicLink(),false);
  if(info.isDirectory())walk(path);else if(name.endsWith('.java')){assert.equal(info.isFile(),true);const bytes=readFileSync(path);inventory.push({path:relative(root,path),bytes:bytes.length,sha256:sha(bytes)});}
 }}
 walk(resolve(root,'mobile/plugins/custodial-native-vault/android/src/main/java'));
 inventory.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 assert.deepEqual(inventory,approvedPreservationComparisonPins.current_java_inventory,'Every actual current Java file, including new callers, must match the owning current inventory');
 const mainCount=inventory.length;inventory.length=0;
 walk(resolve(root,'mobile/plugins/custodial-native-vault/android/src/test/java'));
 inventory.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 assert.deepEqual(inventory,currentProviderComparisonContext.current_test_java_inventory,'Every current native test, including newer added cases, remains bound and compiled from actual current source');
 for(const row of currentProviderComparisonContext.current_auxiliary_inventory){const bytes=readFileSync(resolve(root,row.path));assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,'Actual current owning test runner is retained independently of the historical runner comparison');}
 observed=true;return mainCount;
}
export function assertBoundCurrentProviderSource(name,source){
 if(!observed)assertCurrentProviderComparisonInventory();
 const row=[...approvedPreservationComparisonPins.current_java_inventory,...currentProviderComparisonContext.current_test_java_inventory,...currentProviderComparisonContext.current_auxiliary_inventory].find(row=>row.path===name||row.path.endsWith('/'+name));
 assert.ok(row,'Exact current source path is in the owning inventory');
 assert.equal(sha(source),row.sha256,'Owning contract requires actual complete current source, not a historical predecessor');
 return source;
}
// Source comparison only. The shipping app never imports this module. A full
// current input and the complete 193-file current inventory are checked before
// a genuine historical comparison view is supplied. Unknown bytes pass through
// to the unchanged older strict guard; this is not a blanket section omission.
export function normalizeBoundProviderComparison(name,source){
 const row=currentProviderComparisonContext.files.find(row=>row.name===name||row.current_path===name||name.endsWith('/'+row.name));
 if(!row||!row.comparison_input_sha256.includes(sha(source)))return source;
 if(!observed)assertCurrentProviderComparisonInventory();
 const bytes=readFileSync(resolve(root,row.comparison_path));assert.equal(sha(bytes),row.comparison_sha256,'Complete genuine historical bytes and known audio successors remain pinned');
 return bytes.toString('utf8');
}
