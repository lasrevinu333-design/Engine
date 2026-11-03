import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const alias=process.argv[2];assert.ok(['schedule.html','schedule-simple.html'].includes(alias));assert.equal(process.argv.length,3);
const source=readFileSync(new URL('../'+alias,import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);
assert.doesNotMatch(source,/generate-day|absence-override|fetch\(|XMLHttpRequest|\.submit\(/,'Retired scheduler cannot regenerate or mutate an approved normal schedule');
const cases=[['',''],['?date=2026-10-12','2026-10-12'],['?service_date=2026-10-13','2026-10-13'],['?date=2026-02-30&week_start=2026-10-12',''],['?week_start=2026-10-14',''],['?date=invalid&device=KIOSK_08&token=secret&hub=employee','']];
for(const [search,date]of cases){
 const current=new URL('https://fixture.invalid/Engine/'+alias+search+'#untrusted-fragment'),calls=[];
 const context={URL,Date,window:{location:{href:current.href,replace:value=>calls.push(String(value))}}};
 vm.runInNewContext(scripts[0][1],context,{timeout:1000});assert.equal(calls.length,1);
 const target=new URL(calls[0]);assert.equal(target.origin,current.origin);assert.equal(target.pathname,'/Engine/schedule-weekly.html');assert.equal(target.hash,alias==='schedule-simple.html'?'#absence':'');assert.equal(target.searchParams.get('hub'),'manager');
 assert.equal(target.searchParams.get('date')||'',date);assert.ok([...target.searchParams.keys()].every(k=>['date','week_start','device','hub'].includes(k)));
 if(search.includes('week_start='))assert.equal(target.searchParams.get('week_start'),new URLSearchParams(search).get('week_start'));
 assert.equal(target.searchParams.has('token'),false);
}
console.log(JSON.stringify({status:'PASS_CURRENT_RETIRED_SCHEDULER_ALIAS',alias,cases:cases.length,normalScheduleRegeneration:false,sourceOnly:true}));
