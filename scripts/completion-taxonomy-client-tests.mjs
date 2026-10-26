import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Synthetic exact-session identity cases for the existing read-only helper.
// No HTTP, SQL, manager role, native receipt or physical authority is produced.
async function opaqueCompletionSessionIdentityCases() {
  const context={AbortController};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../memphis-completion-evidence.js',import.meta.url),'utf8'),context);
  const evidence=context.MemphisCompletionEvidence,id='98000000-0000-4000-8000-000000000001';
  const base={session_id:id,employee_id:id,device_id:id,location_id:id};
  let cases=0;
  const valid=[['ASCII129','a'.repeat(129)],['ASCII200','a'.repeat(200)],['period','session.123'],
    ['Unicode200','é'.repeat(199)+'🦁'],['astral200','🦁'.repeat(200)],
    ['opaque-encoded-path','session/part?#%:ü🦁'],['dot-only','.'],['dot-dot-only','..'],
    ['slash-only','/'],['percent-only','%'],['question-only','?'],['hash-only','#'],['ASCII-tab-preserved','\tsession\t'],['NBSP-preserved','\u00a0session\u00a0']];
  for(const [label,session_uuid] of valid){
    const chosen={...base,session_uuid},before=JSON.stringify(chosen);
    assert.equal(evidence.canReadRow(chosen),true,label);
    assert.equal(evidence.selection(chosen).session_uuid,session_uuid,label+' remains exact');
    const requestPath=evidence.readPath(chosen);
    assert.equal(requestPath,`/admin-api/custodial/cleaning-sessions/completion-evidence?session_uuid=${encodeURIComponent(session_uuid)}`,label+' encoded once');
    // Parse the real URL, including dot-only, delimiters, tabs and non-ASCII.
    // Identity stays in one query value, never a normalizable path segment.
    const parsed=new URL(requestPath,'https://exact-session-fixture.invalid/');
    assert.equal(parsed.pathname,'/admin-api/custodial/cleaning-sessions/completion-evidence');
    assert.deepEqual([...parsed.searchParams.keys()],['session_uuid']);
    assert.deepEqual(parsed.searchParams.getAll('session_uuid'),[session_uuid],label+' exact decoded query');
    assert.equal(parsed.hash,'');
    const data={...chosen,completion_recorded:false,classification:'no_completion_record',session_status:'pending_submit',inspection_evaluation:'not_performed_by_this_reader'};
    assert.equal(evidence.validateEnvelope({ok:true,contract_version:'completion-evidence.v1',data},chosen).session_uuid,session_uuid);
    assert.throws(()=>evidence.validateEnvelope({ok:true,contract_version:'completion-evidence.v1',data:{...data,session_uuid:session_uuid+'x'}},chosen),/Selected session identity changed/);
    assert.equal(JSON.stringify(chosen),before,label+' selected row unchanged');cases++;
  }
  const invalid=[['empty',''],['ASCII201','a'.repeat(201)],['Unicode201','é'.repeat(200)+'🦁'],
    ['astral201','🦁'.repeat(201)],['leading-ASCII-space',' session'],['trailing-ASCII-space','session '],
    ['NUL','session\0part'],['lone-high-surrogate','session\ud800'],['lone-low-surrogate','session\udfff'],['not-string',129]];
  for(const [label,session_uuid] of invalid){
    const chosen={...base,session_uuid};
    assert.equal(evidence.canReadRow(chosen),false,label);
    assert.throws(()=>evidence.selection(chosen),/Exact session identity is unavailable/,label);
    assert.throws(()=>evidence.readPath(chosen),/Exact session identity is unavailable/,label);cases++;
  }
  for(const code of [401,403,500]){
    const panel={hidden:true},status={textContent:''},content={textContent:'',innerHTML:''};
    const chosen={...base,session_uuid:'session.123'},before=JSON.stringify(chosen);let observed=null;
    const view=evidence.create({panel,status,content,readEnvelope:async(path)=>{observed=path;throw {status:code};}});
    assert.equal(await view.open(chosen),false);assert.equal(observed,evidence.readPath(chosen));
    assert.equal(content.textContent,'');assert.match(status.textContent,code===500?/unavailable or selection changed/:/Named-manager read access is required/);
    assert.match(status.textContent,/No record was changed/);assert.equal(JSON.stringify(chosen),before);cases++;
  }
  console.log(JSON.stringify({scope:'opaque200 exact-session helper synthetic Source cases',passed:cases,failed:0,
    HTTP_SQL_manager_or_physical_authority:false}));
}
await opaqueCompletionSessionIdentityCases();

if (process.argv.includes('--record-product-only')) {
  const context={}; vm.createContext(context); vm.runInContext(readFileSync(new URL('../memphis-completion-evidence.js',import.meta.url),'utf8'),context);
  const api=context.MemphisCompletionEvidence;
  const id='98000000-0000-4000-8000-000000000001';
  const chosen={session_id:id,session_uuid:'session:original',employee_id:id,device_id:id,location_id:id};
  const base={...chosen,completion_recorded:true,completion_response_id:id,inspection_evaluation:'not_performed_by_this_reader',native_exact_receipt_admitted:true,taxonomy_status:'unversioned_historical_or_protected_draft',follow_up:'required_or_unresolved'};
  let passed=0;
  for(const [work,services,label,classification] of [['full',['Full cleaning services'],'Full cleaning reported','cleaned_follow_up_required'],['details',['Mopped'],'Selected cleaning services reported','cleaned_follow_up_required'],['checked_no_cleaning_needed',[],'Check only — no cleaning reported','checked_only']]) {
    const data={...base,classification,original_response:{work_result:work,services_performed:services,maintenance_issues_found:['Sink leaking'],note:'<script>not executable</script>',attention_needed:true}};
    const verified=api.validateEnvelope({ok:true,contract_version:'completion-evidence.v1',data},chosen),html=api.renderEvidence(verified,chosen);
    assert.ok(html.includes(label)); assert.match(html,/Follow-up required or unresolved/); assert.match(html,/Sink leaking/); assert.doesNotMatch(html,/<script>/); assert.match(html,/No inspection or quality PASS/); passed++;
  }
  const pending={...chosen,completion_recorded:false,classification:'no_completion_record',session_status:'pending_submit',inspection_evaluation:'not_performed_by_this_reader'};
  assert.match(api.renderEvidence(api.validateEnvelope({ok:true,contract_version:'completion-evidence.v1',data:pending},chosen),chosen),/waiting for its completion record.*No completion record exists/); passed++;
  assert.throws(()=>api.validateEnvelope({ok:true,contract_version:'completion-evidence.v1',data:{...base,classification:'checked_only',original_response:{work_result:'checked_no_cleaning_needed',services_performed:['Mopped']}}},chosen));passed++;
  console.log(JSON.stringify({scope:'completion record product presentation',passed,failed:0,old_taxonomy_suite_replayed:false}));
} else {
const context={};vm.createContext(context);vm.runInContext(readFileSync(new URL('../memphis-completion-taxonomy.js',import.meta.url),'utf8'),context);
const api=context.MemphisCompletionTaxonomy,catalog=api.catalog();let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;};
check(createHash('sha256').update(JSON.stringify(catalog)).digest('hex')===api.digest,'exact full catalog bytes bind new response metadata');
check(api.digest==='855b2adc17cb77263ffe6e467059e3a7c0e11084d267604bc0a3166a5bd3f3b3','exact owning backend catalog version');
check(catalog.historical_reference.selectable===false,'historical labels are evidence only');
for(const kind of ['restroom','exhibit']){
 const area=catalog.areas[kind],ids=new Set([...area.services,...area.issues].map(row=>row.id));
 check(ids.size===area.services.length+area.issues.length,'all current IDs unique for '+kind);
 check(!api.services(kind).some(row=>/inspection/i.test(row.title)),'no new inspection selectors '+kind);
 check(api.services(kind)[0].title==='Full cleaning services','one full selection remains first '+kind);
 check(!/Includes All/i.test(api.services(kind)[0].description),'full cleaning never implies every specialty service '+kind);
 for(const historical of [...catalog.historical_reference.areas[kind].services,...catalog.historical_reference.areas[kind].issues]){
  check(historical.maps_to.every(id=>ids.has(id)),'every historical mapping resolves to current stable ID or explicit supersession');
 }
 for(const work of ['full','details','checked_no_cleaning_needed']){
  const response={work_result:work,services_performed:work==='full'?[area.services[0].label]:work==='details'?[area.services.at(-1).label]:[],maintenance_issues_found:[area.issues.at(-1).label],note:'Exact original note'};
  const before=JSON.stringify(response),meta=api.metadata(kind,response);
  check(JSON.stringify(response)===before,'raw response immutable');
  check(meta.version===api.version&&meta.digest===api.digest,'full/check/select metadata exactversion');
  check(JSON.stringify(meta.services.map(row=>row.label))===JSON.stringify(response.services_performed),'raw service order preserved');
  check(meta.issues[0].label===response.maintenance_issues_found[0],'issue label preserved independently');
 }
 const old={services_performed:['Unknown protected old service'],maintenance_issues_found:[]};
 check(api.metadata(kind,old)===null,'unknown historical meaning not invented');
 const raw={services_performed:['Cleaned unusual display'],maintenance_issues_found:[]};
 check(api.metadata(kind,raw,{otherService:raw.services_performed[0]}).services[0].id==='OTHER','explicit truthful free service retained');
 check(api.metadata(kind,{services_performed:[area.services[1].label],maintenance_issues_found:[]},{otherService:area.services[1].label}).services[0].id===area.services[1].id,'known service cannot be mislabeled OTHER');
}
for(const id of ['toilet_tissue_restocked','paper_towels_restocked','soap_restocked','dispensers_cleaned'])
 check(catalog.areas.restroom.services.some(row=>row.id==='restroom.service.'+id),'distinct restock/clean category '+id);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),build=readFileSync(new URL('../mobile/scripts/build.mjs',import.meta.url),'utf8');
check(html.includes('src="./memphis-completion-taxonomy.js"'),'form loads exact source taxonomy');
check(build.includes("'memphis-completion-taxonomy.js'"),'custodial offline asset explicitly included');
check(html.includes('window.MemphisCompletionTaxonomy.metadata(')&&html.includes('if(taxonomy)responseJson.taxonomy=taxonomy;'),'only new form attaches confidently mapped metadata');
const copy=api.catalog();copy.areas.restroom.services[0].label='mutated';check(api.services('restroom')[0].title==='Full cleaning services','callers cannot rewrite catalog');
console.log(JSON.stringify({scope:'exact frontend catalog, corrected-v17 crosswalk and new-form metadata source; no historical rewrite/SQL/phone claim',passed,failed:0},null,2));
}
