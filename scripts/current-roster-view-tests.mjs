import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),ctx={};vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('memphis-scheduler-actions.js',root),'utf8'),ctx);
const A=ctx.MemphisSchedulerActions,id=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const slots=Array.from({length:9},(_,i)=>({slot_id:id(i+10),slot_label:`Current position ${i+1}`,contractor_capacity:false,
 incumbencies:i===8?[]:[{person_id:id(i+100),person_name:`Current person ${i+1}`,effective_start:'2026-11-09',effective_end:null}],week_staffing:[]}));
const history=Array.from({length:4},(_,i)=>({slot_id:id(i+30),slot_label:'Historical position',contractor_capacity:false,
 incumbencies:[{person_id:id(i+130),person_name:`Former person ${i+1}`,effective_start:'2020-01-01',effective_end:null}],week_staffing:[]}));
const snapshot={week_start:'2026-11-09',week_end:'2026-11-15',current_publication:{publication_id:id(1),version_id:id(2)},roster:[...history,...slots],
 approved_manual_period:{schema:'custodial.approved-manual-period-window.v1',normalSourceLocked:true,publicationId:id(1),versionId:id(2),frameStart:'2026-11-09',frameEnd:'2026-11-15',rosterSlotIds:slots.map(s=>s.slot_id)}};
const before=JSON.stringify(snapshot);assert.equal(A.currentRoster(snapshot).length,9);assert.equal(A.currentRoster(snapshot)[8].incumbencies.length,0);assert.equal(JSON.stringify(snapshot),before);
const source=readFileSync(new URL('schedule-weekly.js',root),'utf8');
const fn=source.slice(source.indexOf('function rosterForDate('),source.indexOf('function activeRoster('));
const page={window:{MemphisSchedulerActions:A},availabilityForDate:()=>[]};vm.createContext(page);vm.runInContext(fn,page);
const rows=page.rosterForDate(snapshot,'2026-11-10');assert.equal(rows.length,9);assert.equal(rows.some(r=>r.person_name?.startsWith('Former')),false);assert.equal(rows[8].person_id,undefined);
for(const mutate of [s=>s.approved_manual_period.publicationId=id(88),s=>s.approved_manual_period.versionId=id(88),s=>s.approved_manual_period.frameStart='2026-11-02',s=>s.approved_manual_period.rosterSlotIds.push(id(10)),s=>s.approved_manual_period.rosterSlotIds.push(id(99)),s=>s.approved_manual_period.rosterSlotIds=[]]){
 const bad=structuredClone(snapshot);mutate(bad);assert.throws(()=>A.currentRoster(bad),/roster/);
}
const legacy=structuredClone(snapshot);delete legacy.approved_manual_period;assert.equal(A.currentRoster(legacy).length,13);
assert.equal(JSON.stringify(snapshot),before);console.log('PASS: current published roster excludes historical positions, retains all nine current positions and vacancy, binds publication/version/window, preserves history and legacy snapshots.');
