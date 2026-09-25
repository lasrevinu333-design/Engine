import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
const html=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const inline=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];new Script(inline);
const block=inline.slice(inline.indexOf('function blockCompetingDayChange()'),inline.indexOf('function setControls()'))+
 inline.slice(inline.indexOf('function clearCoverAllPdfs()'),inline.indexOf('function needSnapshot()'));
let checks=0;const check=(name,a,b)=>{assert.deepEqual(a,b,name);checks++;};
function fixture(){
 const bytes=Buffer.from('%PDF-synthetic transport test'),sha=createHash('sha256').update(bytes).digest('hex');
 const pair={schema:'custodial.coverall-pdf-pair.v1',document:{projectionId:'projection-7',authorityRevision:7,serviceDate:'2026-09-28'},files:['en','es'].map(language=>({language,filename:`CoverAll_2026-09-28_r7_${language}.pdf`,base64:bytes.toString('base64'),sha256:sha}))};
 const revoked=[],links=[],state={snapshot:{week_start:'2026-09-28',authority_revision:7,latest_projection:{projection_id:'projection-7'}},printUrls:['old-blob'],printSequence:0};
 const context={state,els:{coverall_pdfs:{replaceChildren(){links.length=0},append(node){links.push(node)}}},URLSearchParams,Uint8Array,Blob,crypto:webcrypto,atob,
  URL:{revokeObjectURL(url){revoked.push(url)},createObjectURL(){return 'blob-'+links.length}},document:{createElement:tag=>({tag})},
  needSnapshot:()=>state.snapshot,selectedServiceDate:()=> '2026-09-28',projectionNeedsRebuild:()=>false,api:async()=>pair,setStatus(){},};
 runInNewContext(block,context);return{context,pair,links,revoked};
}
const good=fixture();await good.context.prepareCoverAllPdfs();check('two separately downloadable language PDFs',good.links.filter(l=>l.tag==='a').map(l=>l.textContent),['Download English PDF','Descargar PDF en español']);check('old download URLs revoked',good.revoked,['old-blob']);good.context.clearCoverAllPdfs();check('new URLs revoked on refresh',good.revoked.length,3);check('no stale links',good.links.length,0);
for(const mutate of [f=>f.pair.document.authorityRevision=8,f=>f.pair.document.projectionId='old',f=>f.pair.document.serviceDate='2026-09-29',f=>f.pair.files.pop(),f=>f.pair.files[1].language='en',f=>f.pair.files[0].sha256='wrong',f=>f.pair.files[0].filename='../../bad.pdf',f=>{f.context.api=async()=>{f.context.state.printSequence++;return f.pair}}]){
 const f=fixture();mutate(f);await assert.rejects(()=>f.context.prepareCoverAllPdfs());checks++;check('invalid/racing bundle exposes no download',f.links.length,0);
}
assert.match(inline,/if\(request\.hasContractors\)\{try\{if\(selectedServiceDate\(\)!==request\.date\)throw new Error\([^;]+;await prepareCoverAllPdfs\(\)/);checks++;
assert.match(inline,/Schedule changes saved\. PDFs need attention/);checks++;
assert.match(readFileSync(new URL('../coverall-print.html',import.meta.url),'utf8'),/schedule-weekly\.html/);checks++;
const operationsContext={};
runInNewContext(inline.slice(inline.indexOf('function manualContractorOperations('),inline.indexOf('async function refreshSnapshot()')),operationsContext);
const contractorInput=(start='11:00',end='12:00')=>({dataset:{contractorSlot:'contractor'},closest:()=>({querySelector:selector=>({value:{'[data-shift-start]':'07:00','[data-shift-end]':'15:00','[data-lunch-start]':start,'[data-lunch-end]':end}[selector]})})});
const operations=JSON.parse(JSON.stringify(operationsContext.manualContractorOperations(contractorInput())));
check('capacity and actual lunch are submitted together',operations.map(o=>o.operation),['cover_all','exception']);
check('dated lunch is exact and owner-bound',operations[1],{operation:'exception',exception_type:'lunch',starts_at:'11:00',ends_at:'12:00',payload:{slotId:'contractor'},reason:'Manager recorded actual CoverAll lunch'});
for(const [start,end] of [['',''],['11:00','11:30'],['14:30','15:30'],['12:00','11:00'],['junk','12:00']]){
 assert.throws(()=>operationsContext.manualContractorOperations(contractorInput(start,end)),/actual CoverAll shift/);checks++;
}
assert.match(inline,/contractors\.flatMap\(manualContractorOperations\)/);checks++;
assert.match(inline,/data-lunch-start type="time" value=""/);checks++;
console.log(JSON.stringify({checks,failed:0,scope:'actual browser handler with synthetic DOM/transport; not rendered-browser or production proof'}));
