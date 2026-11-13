import assert from 'node:assert/strict';
import {printFixture,A,typedCoverAllOptions,typedCoverAllDays} from './fixtures/helper-current-scheduler-contract-fixtures.mjs';
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const close=f=>f.events.get('pagehide')?.();
{
 const f=await printFixture({distinctLanguages:true});try{
  await f.prepare();check(f.nodes.get('downloads').children.slice(0,2).map(link=>link.textContent),['English PDF','Español PDF'],'separate verified language downloads');
  check(f.nodes.get('downloads').children.map(link=>link.download),['en','es','en-es'].map(language=>`CoverAll_2026-10-06_r43_${language}.pdf`),'each filename binds accepted date/revision/language');
  check(await Promise.all(f.blobs.map(blob=>blob.text())),['en','es','en-es'].map(language=>'%PDF synthetic '+language+' route fixture'),'distinct PDF language bytes');
  await f.prepare();check(f.revoked.length,3,'previous download URLs are revoked before regeneration');
  f.nodes.get('date').value='2026-10-07';f.nodes.get('date').listeners.get('change')();
  check(f.revoked.length,6,'all replacement URLs revoked on date change');check(f.nodes.get('downloads').children.length,0,'no stale download links');
  assert.match(f.nodes.get('back').href,/schedule-weekly\.html\?date=2026-10-06/);checks++;
 }finally{close(f);}
}
for(const [name,mutate] of [
 ['revision',v=>v.document.authorityRevision++],['projection',v=>v.document.projectionId='old'],['date',v=>v.document.serviceDate='2026-10-07'],
 ['missing language',v=>v.files.pop()],['duplicate language',v=>v.files[1].language='en'],['digest',v=>v.files[0].sha256='e'.repeat(64)],
 ['traversal filename',v=>v.files[0].filename='../../bad.pdf'],['encoded bytes',v=>v.files[0].base64='Y29ycnVwdA=='],
 ['publication',v=>v.document.publicationId='12000000-0000-4000-8000-000000000001'],['replay',v=>v.document.replayDigest='b'.repeat(64)],
 ['missing bilingual',v=>delete v.bilingualFile],['unbound text',v=>v.texts[0].documentDigest='b'.repeat(64)]]){
 const f=await printFixture();try{const fetch=f.context.fetch;f.context.fetch=async(...args)=>{const response=await fetch(...args);
   if(new URL(args[0]).pathname!=='/static-weekly/coverall-print')return response;
   const payload=await response.json();mutate(payload.data);return{...response,json:async()=>payload};};
  await f.prepare();check(f.created.length,0,name+' exposes no URL');check(f.nodes.get('downloads').hidden,true,name+' keeps downloads hidden');
 }finally{close(f);}
}
for(const options of [{entryRevision:44},{readbackRevision:44},{readbackPatch:{latest_projection:{projection_id:'13000000-0000-4000-8000-000000000001',replay_digest:'b'.repeat(64)}}}]){
 const f=await printFixture(options);try{await f.prepare();check(f.created.length,0,'changed accepted authority refuses links');assert.match(f.nodes.get('status').textContent,/schedule changed/i);checks++;}finally{close(f);}
}
{
 const f=await printFixture();try{const fetch=f.context.fetch;f.context.fetch=async(...args)=>{const response=await fetch(...args);if(new URL(args[0]).pathname==='/static-weekly/coverall-print'){
    f.nodes.get('date').value='2026-10-07';f.nodes.get('date').listeners.get('change')();}return response;};
  await f.prepare();check(f.created.length,0,'date/sequence race cannot issue former-date PDFs');
 }finally{close(f);}
}
{
 const f=await printFixture();await f.prepare();close(f);check(f.revoked.length,3,'page exit releases every owned blob URL');check(f.nodes.get('copy-text').textContent,'','page exit clears accepted text');
}
// Current typed third-absence capacity carries the exact actual shift/lunch
// and helper together. The retained generic compatibility batch has a separate
// endpoint-duration contract; it is not substituted for this full-hour rule.
{
 const options=typedCoverAllOptions(),days=typedCoverAllDays(),selected=A.validateCoverAllDays(options,days);
 check(selected,days,'actual capacity, shift, full-hour lunch and helper remain one exact dated selection');
 for(const [start,end] of [['',''],['11:00','11:30'],['14:30','15:30'],['12:00','11:00'],['junk','12:00']]){
  const bad=structuredClone(days);bad[0].lunch={start,end};assert.throws(()=>A.validateCoverAllDays(options,bad),/full-hour lunch/);checks++;
 }
 const unconfirmed=structuredClone(days);unconfirmed[0].actual_hours_confirmed=false;assert.throws(()=>A.validateCoverAllDays(options,unconfirmed),/Explicitly confirm/);checks++;
 const missingHelper=structuredClone(days);missingHelper[0].lunch_coverer_slot_id=days[0].capacity_id;assert.throws(()=>A.validateCoverAllDays(options,missingHelper),/different approved lunch helper/);checks++;
}
console.log(JSON.stringify({status:'PASS_CURRENT_COVERALL_DOWNLOAD',checks,scope:'Actual print controller/file hashing and current typed CoverAll validation; extracted existing synthetic DOM/transport fixtures. Explicit print preparation replaces the retired inline auto-download hook. No browser/SQL/phone proof.'}));
