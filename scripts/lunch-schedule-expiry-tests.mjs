import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
let now=Date.parse('2026-09-21T17:00:00Z'); // Noon in Memphis, not a real staff lunch.
const employee='ad000000-0000-4000-8000-000000000001',projection='ad000000-0000-4000-8000-000000000002';
const item=(name,start,end,purpose='area_owner')=>({name,coverage_start:start,coverage_end:end,coverage_purpose:purpose,
  ...(purpose==='lunch_coverage'?{loan_id:'c'.repeat(64),coverer_person_id:employee,service_date:'2026-09-21',projection_id:projection}:{})});
const fixtures=[item('Regular restroom','09:45','14:00'),item('Lunch A','11:00','12:00','lunch_coverage'),item('Lunch B','11:30','12:30','lunch_coverage')];
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,dataset:{},addEventListener(){}});return elements.get(id);};
const context={Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},Intl,URL,console,AbortController,
  document:{getElementById:element,addEventListener(){}},window:{MemphisMobile:{deviceId:()=> 'KIOSK_08'},addEventListener(){}},
  localStorage:{getItem:()=>null},fetch:async()=>{throw Error('isolated');},setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
vm.createContext(context);
vm.runInContext(inline.replace("els.retry.addEventListener",'globalThis.scheduleTest={currentItems,details};els.retry.addEventListener'),context);
const names=data=>Array.from(context.scheduleTest.currentItems(data),row=>row.name);
const day={service_date:'2026-09-21',employee_id:employee,projection_id:projection,current_items:fixtures};
const checks=[];
function check(name,fn){if(process.argv.includes('--lunch-recipient-only')&&!name.startsWith('RECIPIENT '))return;if(process.argv.includes('--lunch-detail-only')&&!name.startsWith('DETAIL '))return;try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}}
check('At noon expire Lunch A only; keep regular work and overlapping Lunch B',()=>assert.deepEqual(names(day),['Regular restroom','Lunch B']));
check('Previous-day snapshot is not active work today',()=>assert.deepEqual(names({...day,service_date:'2026-09-20'}),[]));
check('Future-day snapshot is not active work today',()=>assert.deepEqual(names({...day,service_date:'2026-09-22'}),[]));
check('Do not activate a lunch before its scheduled start',()=>assert.deepEqual(names({...day,current_items:[item('Future','12:15','13:15','lunch_coverage')]}),[]));
check('Parse civil times correctly rather than treating 1 PM as 1 AM',()=>assert.deepEqual(names({...day,current_items:[item('Civil','11:30 AM','12:30 PM','lunch_coverage')]}),['Civil']));
check('Invalid lunch boundaries cannot create indefinite responsibility',()=>assert.deepEqual(names({...day,current_items:[item('Invalid','bad','bad','lunch_coverage')]}),[]));
check('Use cached full-day published windows to activate the next known assignment',()=>assert.deepEqual(names({...day,full_day:true,raw_items:[item('Next','12:00','13:00','lunch_coverage')]}),['Next']));
check('Filtering does not erase the saved records or change check deadlines',()=>{const saved=JSON.stringify(day);names(day);assert.equal(JSON.stringify(day),saved);});
const lunch=(extra={})=>({...item('Accepted temporary responsibility','11:30','12:15','lunch_coverage'),loan_id:'c'.repeat(64),coverer_person_id:employee,service_date:day.service_date,projection_id:projection,...extra});
const accepted=rows=>({...day,employee_id:employee,projection_id:projection,full_day:true,raw_items:[item('Regular duty','09:00','14:00'),...rows]});
check('RECIPIENT foreign lunch recipient is not current while regular duty remains',()=>assert.deepEqual(names(accepted([lunch({coverer_person_id:'ad000000-0000-4000-8000-000000000009'})])),['Regular duty']));
check('RECIPIENT missing/foreign loan projection/service-day recipient cannot borrow duty',()=>{
 for(const change of [{coverer_person_id:undefined},{loan_id:undefined},{service_date:'2026-09-20'},{projection_id:'ad000000-0000-4000-8000-000000000009'}])assert.deepEqual(names(accepted([lunch(change)])),['Regular duty']);
});
check('RECIPIENT actual 45-minute lunch ends exclusively without erasing overlapping duty',()=>{
 const saved=accepted([lunch(),lunch({name:'Other coverage',loan_id:'e'.repeat(64),coverage_start:'12:00',coverage_end:'13:00'})]);const before=JSON.stringify(saved);
 now=Date.parse('2026-09-21T17:15:00Z');assert.deepEqual(names(saved),['Other coverage','Regular duty']);assert.equal(JSON.stringify(saved),before);now=Date.parse('2026-09-21T17:00:00Z');
});
check('DETAIL on-call labels retain actual published bounds, not a default hour or whole-loan inference',()=>{
 const label=context.scheduleTest.details(lunch());assert.match(label,/11:30 AM/);assert.match(label,/12:15 PM/);assert.match(label,/On call:/);assert.doesNotMatch(label,/60 minutes|one.hour|full lunch/i);
 const partial=context.scheduleTest.details(lunch({coverage_start:'11:45',coverage_end:'12:00'}));assert.match(partial,/11:45 AM/);assert.match(partial,/12:00 PM/);assert.match(partial,/On call:/);
});
console.log(JSON.stringify({scope:'Isolated actual schedule-page logic; no live assignments or physical phone',checks},null,2));
process.exitCode=checks.some(row=>!row.passed)?1:0;
