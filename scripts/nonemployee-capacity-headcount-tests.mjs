// Actual current staffing owner functions, synthetic data only. No API or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ownerURL=new URL('../schedule-weekly.js',import.meta.url);
const source=readFileSync(ownerURL,'utf8');
const names=['rosterForDate','effectiveStaffing','availabilityForDate','effectiveExceptions','activeExceptionSlots'];
function fullOwner(name){
 const marker=`function ${name}(`,start=source.indexOf(marker);
 assert.ok(start>=0&&source.indexOf(marker,start+marker.length)<0,`one complete ${name} owner`);
 const end=source.indexOf('\nfunction ',start+marker.length);
 assert.ok(end>start,`complete ${name} Source boundary`);
 return source.slice(start,end);
}
// These FIVE complete functions are their entire current relative-call closure.
// No guessed app/global authority or reimplemented counting algorithm is supplied.
const ownerText=names.map(fullOwner).join('\n');
function readOwner(text=ownerText){
 const scope=vm.createContext({Date,Set,Array,Number,String});
 new vm.Script(text+'\nglobalThis.readCounts=effectiveStaffing;',{filename:ownerURL.pathname+':complete-staffing-owner-closure'}).runInContext(scope,{timeout:1000});
 return snapshot=>JSON.parse(JSON.stringify(scope.readCounts(snapshot,'2026-10-25')));
}
const date='2026-10-25',counts=readOwner();let cases=0;
const employee=(slot,person,availability='working')=>({slot_id:slot,contractor_capacity:false,incumbencies:[{person_id:person,person_name:person,effective_start:'2020-01-01'}],week_staffing:[{service_date:date,person_id:person,person_name:person,availability_state:availability}]});
const capacity=slot=>({slot_id:slot,contractor_capacity:true,incumbencies:[],week_staffing:[]});
const exception=(id,type,slot,serviceDate=date)=>({id,type,serviceDate,payload:{availability:{slotId:slot}}});
function check(snapshot,expected,label,read=counts){assert.deepEqual(read(snapshot),expected,label);cases++;}
check({roster:[employee('a','person1'),employee('b','person2'),employee('c','person1')]},{working:2,absent:0,partial:0,vacant:0,contractors:0},'one named employee counts once across slots');
const contractorScenario={roster:[employee('a','person1'),capacity('capacity1'),capacity('capacity2'),{...employee('spoof','not-an-employee'),contractor_capacity:true}],exceptions:[exception('c1','cover_all','capacity1'),exception('c2','cover_all','capacity2'),exception('c3','cover_all','capacity1')]};
check(contractorScenario,{working:1,absent:0,partial:0,vacant:0,contractors:2},'nonemployee capacity never inflates employee headcount, duplicate capacity admission counts once');
check({roster:[employee('a','p1'),employee('b','p2'),employee('c','p3','departed_named_absent'),employee('d','p4')],exceptions:[exception('a1','daily_absence','a'),exception('b1','pto','b'),exception('d1','partial_absence','d')]},{working:1,absent:3,partial:1,vacant:0,contractors:0},'absence/PTO/departed named employee separate from working partial employee');
check({roster:[employee('a','p1')],exceptions:[exception('a1','daily_absence','a'),{id:'rev',type:'reverse',reversesExceptionId:'a1'},exception('otherday','pto','a','2026-10-24')]},{working:1,absent:0,partial:0,vacant:0,contractors:0},'reversed or foreign-day absences cannot change selected-day employee count');
check({roster:[capacity('capacity1')],exceptions:[exception('c1','cover_all','capacity1'),{id:'rev',type:'reverse',reverses_exception_id:'c1'}]},{working:0,absent:0,partial:0,vacant:0,contractors:0},'reversed contractor overlay is not active employee or contractor capacity');
const ambiguous=employee('ambiguous','p1');ambiguous.incumbencies.push({person_id:'p2',effective_start:'2020-01-01'});
check({roster:[{slot_id:'empty',contractor_capacity:false,incumbencies:[]},ambiguous,capacity('capacity1')]},{working:0,absent:0,partial:0,vacant:2,contractors:0},'vacant/ambiguous named positions are never invented employees; capacity is not vacancy');
const duplicateDated=employee('a','p1');duplicateDated.week_staffing.push({...duplicateDated.week_staffing[0],person_id:'foreign'});
check({roster:[duplicateDated]},{working:0,absent:0,partial:0,vacant:1,contractors:0},'two dated identities cannot manufacture one current employee');
check({roster:[employee('a','p1'),employee('b','p1')],exceptions:[exception('p1','partial_absence','a'),exception('p2','partial_absence','b')]},{working:1,absent:0,partial:1,vacant:0,contractors:0},'partial count is a unique employee subset, never a slot or capacity total');
// A concrete incorrect-owner counterpart must be caught by the same behavior case.
const mutation='if(row.contractor_capacity||!row.person_id||!row.staffing_identity_valid)continue;';
assert.equal(ownerText.split(mutation).length,2,'one current contractor exclusion seam');
const wrong=readOwner(ownerText.replace(mutation,'if(!row.person_id||!row.staffing_identity_valid)continue;'));
assert.throws(()=>check(contractorScenario,{working:1,absent:0,partial:0,vacant:0,contractors:2},'counterfactual contractor counted as employee',wrong),assert.AssertionError);
console.log(JSON.stringify({status:'NONEMPLOYEE_CAPACITY_HEADCOUNT_OWNER_CONTRACT_PASS',cases,complete_current_owner_functions:names,synthetic_snapshot_only:true,API:false,SQL:false,native:false,employee_or_private_state_proof:false}));
