import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1]
 .replace(/^init\(\)\.catch\([^\n]+$/m,'');
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,
 classList:{toggle(){}},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);}
let commands=0;
const context=vm.createContext({console,URLSearchParams,Date,Set,Map,JSON,Promise,
 crypto:{randomUUID:()=>`synthetic-${++commands}`},document:{getElementById:node,querySelectorAll:()=>[]},
 window:{MemphisAuth:{getCSTDateString:()=> '2026-09-23'},lucide:{createIcons(){}}}});
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
run(`globalThis.calls=[];globalThis.failOnce=false;globalThis.refreshes=0;
 api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});if(failOnce){failOnce=false;throw new Error('synthetic lost response');}return {};};
 refreshSnapshot=async()=>{refreshes++;};
 state.snapshot={week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:7,
  current_publication:{publication_id:'pub',authority_source_id:'source-A'},sources:[{source_id:'source-B'},{source_id:'source-A'}],
  roster:[{slot_id:'slot-empty',slot_label:'Option 1',incumbencies:[],contractor_capacity:false}],
  availability:[{slot_id:'slot-empty',day_of_week:3,availability_state:'vacant_unfilled'}]};
 els.service_date.value='2026-09-23';renderRoster(state.snapshot,activeRoster(state.snapshot));`);
assert.match(node('roster-list').innerHTML,/Vacant — Option 1/);assert.match(node('roster-list').innerHTML,/data-turnover-mode="fill"/);
assert.doesNotMatch(node('roster-list').innerHTML,/Mark gone|No phone/);
run(`openTurnoverDialog({target:{closest:()=>({dataset:{turnoverSlot:'slot-empty',turnoverMode:'fill'}})}});`);
assert.equal(node('turnover-effective-date').value,'2026-09-21');assert.equal(node('turnover-dialog').open,true);
assert.equal(node('turnover-effective-label').textContent,'Effective week (Monday)');
node('replacement-name').value='Synthetic New Custodian';node('turnover-reason').value='Synthetic hire';
run('failOnce=true');await run('submitTurnover({preventDefault(){}})');
assert.equal(node('turnover-dialog').open,true,'unknown response retains retry dialog');
assert.equal(node('replacement-name').disabled,true,'retry cannot silently change original semantic request');
assert.equal(node('turnover-submit-label').textContent,'Retry Same Change');
await run('submitTurnover({preventDefault(){}})');
const calls=JSON.parse(run('JSON.stringify(calls)'));
assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1],'same key/body on same-operation retry');
assert.equal(calls[0].path,'/static-weekly/roster/vacant-slots/slot-empty/fill');
assert.equal(calls[0].body.source_id,'source-A','exact publication source, not first list entry');
assert.equal(calls[0].body.effective_start,'2026-09-21');assert.equal(calls[0].body.expected_revision,7);
assert.equal(calls[0].body.new_employee_name,'Synthetic New Custodian');
assert.equal(node('turnover-dialog').open,false);assert.equal(run('refreshes'),1);
assert.throws(()=>run(`turnoverSourceId({current_publication:{publication_id:'pub'},sources:[{source_id:'A'}]})`),/published schedule source/);
assert.throws(()=>run(`turnoverSourceId({sources:[{source_id:'A'},{source_id:'B'}]})`),/exact approved/);
assert.equal(run(`turnoverSourceId({sources:[{source_id:'A'}]})`),'A');
console.log(JSON.stringify({status:'PASS',actualPageHandlers:true,visualBrowserProof:false,production:false}));
