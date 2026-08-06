#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

const root=process.cwd();
const dir=path.join(root,"docs/audits/custodial-unified-v4-3/contracts");
const names={
 stage:"custodial-unified-v4-3-stage-control-model.json",
 dag:"custodial-unified-v4-3-artifact-generation-contract.json",
 closure:"custodial-unified-v4-3-accepted-finding-closure-registry.json",
 security:"custodial-unified-v4-3-security-authority-contract.json",
 authority:"custodial-unified-v4-3-authority-restore-transition-contract.json",
 occurrence:"custodial-unified-v4-3-occurrence-location-contract.json",
 domains:"custodial-unified-v4-3-operational-domain-contracts.json",
 gates:"custodial-unified-v4-3-gate-registry.json",
 projection:"custodial-unified-v4-3-gate-workstream-day-projection.json",
 schemas:"custodial-unified-v4-3-contract-schemas.json",
 manifest:"custodial-unified-v4-3-content-manifest.json"
};
const checks=[],docs={};
function add(ok,id,detail){checks.push({id,status:ok?"PASS":"FAIL",detail})}
for(const [key,file] of Object.entries(names)){
 const p=path.join(dir,file);
 try{const raw=fs.readFileSync(p,"utf8");docs[key]=JSON.parse(raw);docs[key].__sha256=crypto.createHash("sha256").update(raw).digest("hex");add(true,"JSON-"+key,"parsed")}
 catch(e){add(false,"JSON-"+key,String(e))}
}
if(checks.some(x=>x.status==="FAIL"))finish();

const expected=[];
for(let i=1;i<=7;i++)expected.push("V43-B0"+i);
for(let i=1;i<=15;i++)expected.push("V43-H"+String(i).padStart(2,"0"));
const rows=docs.closure.rows.filter(r=>r.active),ids=rows.map(r=>r.finding_id);
add(rows.length===22,"FINDING-COUNT","active="+rows.length);
add(new Set(ids).size===22&&expected.every(x=>ids.includes(x)),"FINDING-EXACT-COVERAGE","B01-B07 and H01-H15 exactly once");
add(rows.every(r=>r.canonical_closure_artifacts?.length&&r.automated_proof_ids?.length&&r.physical_proof_ids?.length&&r.gate_id),"FINDING-REFERENCES","artifacts/proofs/gates populated");
for(const [key,doc] of Object.entries(docs))if(key!=="schemas"&&key!=="projection")add(doc.schema_version==="v4.3.1"&&doc.artifact_id&&doc.authority==="canonical","SCHEMA-"+key,"canonical envelope");

function transitions(id,states,trs){
 const keys=trs.map(t=>t.prior+"|"+t.command+"|"+t.next);
 add(new Set(keys).size===keys.length,id+"-UNIQUE","unique transitions");
 add(trs.every(t=>states.includes(t.prior)&&states.includes(t.next)&&t.command),id+"-RESOLVE","states/commands resolve");
}
transitions("STAGE",docs.stage.states,docs.stage.transitions);
transitions("AUTHSET",docs.authority.authority_set.states,docs.authority.authority_set.transitions);
transitions("RESTORE",docs.authority.restore_bundle.states,docs.authority.restore_bundle.transitions);
transitions("OCCURRENCE",docs.occurrence.occurrence.states,docs.occurrence.occurrence.transitions);
transitions("LOCATION",docs.occurrence.location.states,docs.occurrence.location.transitions);
transitions("GATE",docs.gates.statuses,docs.gates.transitions);
const st=JSON.stringify(docs.stage);
add(["stale","duplicate","contradictory","invalidation","supersession"].every(k=>st.toLowerCase().includes(k)),"STAGE-FAIL-CLOSED","stale/duplicate/contradictory/invalidation/supersession");

const ns=docs.dag.nodes,patterns=ns.map(n=>n.field_pattern);
add(new Set(patterns).size===patterns.length,"DAG-ONE-OWNER","one canonical field owner");
const owners=new Set(ns.map(n=>n.canonical_owner)),graph=new Map([...owners].map(x=>[x,[]]));
for(const n of ns)for(const c of n.consumers||[])if(owners.has(c))graph.get(n.canonical_owner).push(c);
const active=new Set(),done=new Set();let cycle=false;
function visit(n){if(active.has(n)){cycle=true;return}if(done.has(n))return;active.add(n);for(const x of graph.get(n)||[])visit(x);active.delete(n);done.add(n)}
for(const n of graph.keys())visit(n);
add(!cycle,"DAG-ACYCLIC","topological sort succeeds");
add(docs.dag.rules.generated_outputs_are_read_only&&docs.dag.rules.duplicate_active_field_owner_forbidden&&docs.dag.rules.graph_must_be_acyclic,"DAG-RULES","determinism rules active");

const sec=JSON.stringify(docs.security),pub=docs.security.planes.find(x=>x.id==="public-read"),priv=docs.security.planes.find(x=>x.id==="privileged-automation");
add(sec.includes("WRONG_TOKEN_NO_DOWNGRADE")&&sec.includes("EXPIRED_DENY")&&sec.includes("REVOKED_DENY"),"SECURITY-FAIL-CLOSED","wrong/expired/revoked deny");
add(pub&&priv&&pub.wrong_token==="DENY"&&priv.wrong_token==="DENY","SECURITY-PLANES","public/privileged explicit");
add(["writer","migration","arbitrary SQL","repair","admin","privileged alias"].every(x=>pub.forbidden.includes(x)),"SECURITY-PUBLIC-NO-PRIVILEGE","public forbidden surface");

const snap=docs.occurrence.offline_original_authorization.required_snapshot;
add(["authorization_decision_id","grant_id","expected_aggregate_sequence"].every(x=>snap.includes(x)),"OFFLINE-ORIGINAL-AUTH","authorization independent from identity");
add(docs.authority.authority_set.commit_boundary.includes("no partial service activation"),"AUTHORITY-NO-PARTIAL","durable commit boundary");
add(docs.authority.restore_bundle.day11.includes("rehearsal")&&docs.authority.restore_bundle.final_admission.includes("Day 12"),"RESTORE-RELEASE-BOUND","Day11 rehearsal/post-Day12 proof");

add(["notification","gps","messenger","events","readiness","products"].every(k=>docs.domains[k]),"DOMAIN-NORMATIVE-CONTRACTS","all dedicated domains");
add(docs.domains.products.some(p=>p.id==="EMPLOYEE_ANDROID"&&p.forbidden.includes("normal Scanner/QR")),"PRODUCT-DOCTRINE","employee doctrine");
add(docs.domains.products.some(p=>p.id==="READ_ONLY_PRIVATE"&&p.forbidden.includes("write APIs")),"PRODUCT-READONLY","Read Only boundary");

const gateIds=new Set(docs.gates.gates.map(g=>g.gate_id));
add(gateIds.size===docs.gates.gates.length,"GATE-UNIQUE","unique gates");
add(docs.gates.gates.every(g=>Array.isArray(g.prerequisite_gate_ids)&&g.expected_prior_status&&g.decision_authority_capability&&g.supersession_rule&&g.reopen_rule&&g.design_impact?.length&&g.blocks_workstreams?.length&&g.blocks_days?.length),"GATE-COMPLETE","dependencies/authority/projection");
const omitted=["G-LATE-INHERITANCE","G-ELEPHANT-TRUNK","G-REMINDER-GROUPS","G-WORKLOAD","G-FREQUENCY","G-ROUTE","G-RESTRICTIONS","G-TAXONOMY","G-RO-FIELDS","G-MGR-ATTENDANCE"];
add(omitted.every(x=>gateIds.has(x)),"GATE-OMITTED-ZERO","all Sol omitted gates registered");
add(docs.gates.generated_projection.schedule_term.startsWith("fourteen implementation days"),"SCHEDULE-ONE-TERM","canonical schedule term");
add(docs.projection.omitted_dependency_count===0&&docs.projection.edges.length>0,"GATE-PROJECTION","generated dependency projection present");
add(docs.projection.edges.every(e=>gateIds.has(e.gate_id)&&e.workstream&&e.implementation_day),"GATE-PROJECTION-RESOLVE","all generated edges resolve");

const man=docs.manifest;
add(!("lifecycle_state" in man)&&!JSON.stringify(man).includes("authorization_decision"),"MANIFEST-IMMUTABLE","no mutable stage authority");
add(man.identity_rule.self_digest==="forbidden"&&man.identity_rule.containing_commit==="detached_attestation_only","MANIFEST-NON-SELF","self digest/commit excluded");
const memberPaths=new Set(man.members.map(m=>m.path));
add(Object.values(names).filter(x=>x!==names.manifest).every(x=>memberPaths.has("contracts/"+x)||memberPaths.has("tools/"+x)),"MANIFEST-MEMBERS","all contract and validator files listed");

function finish(){
 const failed=checks.filter(x=>x.status==="FAIL");
 const report={protocol:"CUSTODIAL_V43_REPLAN_VALIDATION_V1",generated_at_utc:new Date().toISOString(),status:failed.length?"FAIL":"PASS",checks_total:checks.length,checks_passed:checks.length-failed.length,checks_failed:failed.length,content_sha256:Object.fromEntries(Object.entries(docs).filter(([,v])=>v?.__sha256).map(([k,v])=>[k,v.__sha256])),checks};
 const i=process.argv.indexOf("--write");if(i>=0&&process.argv[i+1])fs.writeFileSync(process.argv[i+1],JSON.stringify(report,null,2)+"\n");
 process.stdout.write(JSON.stringify(report,null,2)+"\n");process.exitCode=failed.length?1:0;
}
finish();
