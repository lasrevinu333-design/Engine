import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
