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

const ns=docs.dag.nodes,nodeIds=new Set(ns.map(n=>n.artifact_id)),patterns=docs.dag.field_owners.map(n=>n.field_pattern);
add(nodeIds.size===ns.length,"DAG-NODE-UNIQUE","unique artifact nodes");
add(new Set(patterns).size===patterns.length,"DAG-ONE-OWNER","one canonical field owner");
add(docs.dag.field_owners.every(f=>nodeIds.has(f.canonical_owner)),"DAG-FIELD-OWNER-RESOLVE","all field owners resolve");
add(ns.every(n=>n.inputs.every(x=>nodeIds.has(x))&&n.consumers.every(x=>nodeIds.has(x))),"DAG-REFERENCE-RESOLUTION","all inputs and consumers resolve");
add(ns.every(n=>!n.inputs.includes(n.artifact_id)),"DAG-NO-SELF-INPUT","self inputs rejected");
add(ns.every(n=>n.source?n.inputs.length===0:n.inputs.length>0),"DAG-SOURCE-INPUTS","only external evidence has empty inputs");
const graph=new Map(ns.map(n=>[n.artifact_id,n.consumers]));
const active=new Set(),done=new Set();let cycle=false;
function visit(n){if(active.has(n)){cycle=true;return}if(done.has(n))return;active.add(n);for(const x of graph.get(n)||[])visit(x);active.delete(n);done.add(n)}
for(const n of graph.keys())visit(n);
add(!cycle,"DAG-ACYCLIC","topological sort succeeds");
const order=new Map(ns.map(n=>[n.artifact_id,n.order]));
add(ns.every(n=>n.inputs.every(x=>order.get(x)<n.order)),"DAG-ORDER","declared order is topological");
const inverse=new Map(ns.map(n=>[n.artifact_id,[]]));
for(const n of ns)for(const input of n.inputs)inverse.get(input).push(n.artifact_id);
add(ns.every(n=>JSON.stringify([...n.consumers].sort())===JSON.stringify(inverse.get(n.artifact_id).sort())),"DAG-CONSUMER-INVERSE","consumers exactly invert inputs");
add(ns.every(n=>!n.generator.includes("validate-custodial")||["generated_projection","generated_evidence"].includes(n.kind)),"DAG-GENERATOR-ROLE","validator generates only projections/evidence");
const reached=new Set();function invalidate(n){for(const x of graph.get(n)||[])if(!reached.has(x)){reached.add(x);invalidate(x)}}
invalidate("V43-SECURITY-AUTHORITY");
add(reached.has("V43-CONTENT-MANIFEST")&&reached.has("V43-VALIDATION-REPORT"),"DAG-TRANSITIVE-INVALIDATION","security change invalidates package and validation");
add(docs.dag.rules.generated_outputs_are_read_only&&docs.dag.rules.all_inputs_and_consumers_must_resolve&&docs.dag.rules.self_input_forbidden,"DAG-RULES","determinism/reference rules active");

const sec=JSON.stringify(docs.security),pub=docs.security.planes.find(x=>x.id==="public-read"),priv=docs.security.planes.find(x=>x.id==="privileged-automation");
add(sec.includes("WRONG_TOKEN_NO_DOWNGRADE")&&sec.includes("EXPIRED_DENY")&&sec.includes("REVOKED_DENY"),"SECURITY-FAIL-CLOSED","wrong/expired/revoked deny");
add(pub&&priv&&pub.wrong_token==="DENY"&&priv.wrong_token==="DENY","SECURITY-PLANES","public/privileged explicit");
add(["writer","migration","arbitrary SQL","repair","admin","privileged alias"].every(x=>pub.forbidden.includes(x)),"SECURITY-PUBLIC-NO-PRIVILEGE","public forbidden surface");
add(docs.security.credential_types.every(c=>c.wrong_presented_credential_behavior==="DENY_NO_DOWNGRADE"),"SECURITY-CREDENTIAL-NO-DOWNGRADE","every credential class denies wrong presentation");
add(docs.security.credential_types.filter(c=>c.id!=="public-none").every(c=>c.expiry_required===true&&c.revocation_required===true),"SECURITY-CREDENTIAL-LIFECYCLE","all non-public credentials expire and revoke");
add(docs.security.service_principal_schema?.default_deny===true&&docs.security.service_principals?.length>=5&&docs.security.service_principals.every(s=>s.independently_revocable),"SECURITY-SERVICE-PRINCIPALS","complete independently revocable service principals");
add(docs.security.failure_matrix.every(x=>x.outcome!=="PUBLIC_READ_SESSION"||x.credential_case==="no credential"),"SECURITY-FAILURE-MATRIX","only absent credential on public endpoint admits public");
const transitionCommands=new Set(docs.stage.transitions.map(t=>t.command));
add([...transitionCommands].every(c=>docs.stage.authorization_capabilities[c]),"STAGE-COMMAND-CAPABILITY","every transition command has capability");

const snap=docs.occurrence.offline_original_authorization.required_snapshot;
add(["authorization_decision_id","grant_id","expected_aggregate_sequence"].every(x=>snap.includes(x)),"OFFLINE-ORIGINAL-AUTH","authorization independent from identity");
add(docs.authority.authority_set.commit_boundary.includes("no partial service activation"),"AUTHORITY-NO-PARTIAL","durable commit boundary");
add(docs.authority.restore_bundle.day11.includes("rehearsal")&&docs.authority.restore_bundle.final_admission.includes("Day 12"),"RESTORE-RELEASE-BOUND","Day11 rehearsal/post-Day12 proof");
const occCommands=new Set(docs.occurrence.occurrence.transitions.map(t=>t.command));
const requiredOcc=["CREATE_REQUIREMENT_OCCURRENCE","ATTACH_SESSION","START_URGENT_OVERLAP","ACCEPT_COMPLETION","REJECT_COMPLETION","VOID_COMPLETION","REOPEN","CREATE_CORRECTIVE_OCCURRENCE","CREATE_EXACTLY_ONE_NEXT_OCCURRENCE","SUPERSEDE_NOTIFICATION","EMIT_READINESS_CONSEQUENCE"];
add(requiredOcc.every(x=>occCommands.has(x)),"OCCURRENCE-COMMAND-COMPLETE","all required occurrence commands explicit");
const locCommands=new Set(docs.occurrence.location.transitions.map(t=>t.command));
add(["RENAME","TEMPORARY_CLOSE","REOPEN","REPLACE_TAG","REVOKE_TAG","BEGIN_SPLIT","COMMIT_SPLIT","BEGIN_MERGE","COMMIT_MERGE"].every(x=>locCommands.has(x)),"LOCATION-COMMAND-COMPLETE","rename/close/reopen/tag/split/merge explicit");

add(["notification","gps","messenger","events","readiness","products"].every(k=>docs.domains[k]),"DOMAIN-NORMATIVE-CONTRACTS","all dedicated domains");
add(docs.domains.products.some(p=>p.id==="EMPLOYEE_ANDROID"&&p.forbidden.includes("normal Scanner/QR")),"PRODUCT-DOCTRINE","employee doctrine");
add(docs.domains.products.some(p=>p.id==="READ_ONLY_PRIVATE"&&p.forbidden.includes("write APIs")),"PRODUCT-READONLY","Read Only boundary");

const gateIds=new Set(docs.gates.gates.map(g=>g.gate_id));
add(gateIds.size===docs.gates.gates.length,"GATE-UNIQUE","unique gates");
add(docs.gates.gates.every(g=>Array.isArray(g.prerequisite_gate_ids)&&g.expected_prior_status&&g.decision_authority_capability&&g.supersession_rule&&g.reopen_rule&&g.design_impact?.length&&g.blocks_workstreams?.length&&g.blocks_days?.length),"GATE-COMPLETE","dependencies/authority/projection");
add(docs.gates.gates.every(g=>g.prerequisite_gate_ids.every(x=>gateIds.has(x)&&x!==g.gate_id)),"GATE-REFERENCE-RESOLUTION","all prerequisites resolve and no gate depends on itself");
add(docs.gates.gates.filter(g=>g.gate_id!=="G-EVIDENCE-001").every(g=>g.prerequisite_gate_ids.length>0),"GATE-NONROOT-PREREQUISITE","every non-root gate has a prerequisite");
const gateGraph=new Map(docs.gates.gates.map(g=>[g.gate_id,g.prerequisite_gate_ids]));
const gateActive=new Set(),gateDone=new Set();let gateCycle=false;
function visitGate(n){if(gateActive.has(n)){gateCycle=true;return}if(gateDone.has(n))return;gateActive.add(n);for(const x of gateGraph.get(n)||[])visitGate(x);gateActive.delete(n);gateDone.add(n)}
for(const n of gateGraph.keys())visitGate(n);
add(!gateCycle,"GATE-ACYCLIC","semantic prerequisite graph is acyclic");
const exactPrereqs=(id,required)=>{const actual=docs.gates.gates.find(g=>g.gate_id===id)?.prerequisite_gate_ids||[];return required.length===actual.length&&required.every(x=>actual.includes(x))};
add(exactPrereqs("G-PHYSICAL-ACCEPTANCE",["G-NFC-RECOVERY","G-NOTIFICATION","G-ACCESSIBILITY","G-GPS","G-MESSENGER","G-EVENT","G-READINESS","G-PRODUCT-BOUNDARY","G-RESTORE","G-BUILD22"]),"GATE-PHYSICAL-DEPENDENCIES","physical acceptance has the exact cross-domain proof dependencies");
add(exactPrereqs("G-RELEASE-ADMISSION",["G-PHYSICAL-ACCEPTANCE","G-RESTORE","G-BUILD22"]),"GATE-RELEASE-DEPENDENCIES","release admission requires physical, restore, and build proof");
const omitted=["G-LATE-INHERITANCE","G-ELEPHANT-TRUNK","G-REMINDER-GROUPS","G-WORKLOAD","G-FREQUENCY","G-ROUTE","G-RESTRICTIONS","G-TAXONOMY","G-RO-FIELDS","G-MGR-ATTENDANCE"];
add(omitted.every(x=>gateIds.has(x)),"GATE-OMITTED-ZERO","all Sol omitted gates registered");
add(docs.gates.generated_projection.schedule_term.startsWith("fourteen implementation days"),"SCHEDULE-ONE-TERM","canonical schedule term");
const expectedEdges=[];
for(const g of docs.gates.gates)for(const workstream of g.blocks_workstreams)for(const implementation_day of g.blocks_days)expectedEdges.push({gate_id:g.gate_id,prerequisite_gate_ids:g.prerequisite_gate_ids,workstream,implementation_day,design_impact:g.design_impact,admission:"gate must be CLOSED, CLOSED_DISABLED, or have explicit structurally-invariant proof"});
expectedEdges.sort((a,b)=>a.implementation_day-b.implementation_day||a.gate_id.localeCompare(b.gate_id)||a.workstream.localeCompare(b.workstream));
add(docs.projection.omitted_dependency_count===0&&docs.projection.edges.length>0,"GATE-PROJECTION","generated dependency projection present");
add(docs.projection.edges.every(e=>gateIds.has(e.gate_id)&&e.prerequisite_gate_ids.every(x=>gateIds.has(x))&&e.workstream&&Number.isInteger(e.implementation_day)),"GATE-PROJECTION-RESOLVE","all generated edges and prerequisites resolve");
add(JSON.stringify(docs.projection.edges)===JSON.stringify(expectedEdges),"GATE-PROJECTION-EXACT","projection byte-for-byte equals deterministic registry expansion");
add(docs.projection.generated_from?.artifact_id===docs.gates.artifact_id,"GATE-PROJECTION-SOURCE","projection identifies the canonical gate registry");

const man=docs.manifest;
add(!("lifecycle_state" in man)&&!JSON.stringify(man).includes("authorization_decision"),"MANIFEST-IMMUTABLE","no mutable stage authority");
add(man.identity_rule.self_digest==="forbidden"&&man.identity_rule.containing_commit==="detached_attestation_only","MANIFEST-NON-SELF","self digest/commit excluded");
const memberPaths=new Set(man.members.map(m=>m.path));
add(Object.values(names).filter(x=>x!==names.manifest).every(x=>memberPaths.has("contracts/"+x)||memberPaths.has("tools/"+x)),"MANIFEST-MEMBERS","all contract and validator files listed");
add(man.members.every(m=>m.content_digest?.algorithm==="git_blob_sha1"&&/^[0-9a-f]{40}$/.test(m.content_digest.value)),"MANIFEST-DIGEST-FORMAT","every member has one Git blob digest");
const manifestDigestOk=man.members.every(m=>{
 try{
  const raw=fs.readFileSync(path.join(root,m.repo_path));
  const header=Buffer.from("blob "+raw.length+"\0");
  return crypto.createHash("sha1").update(header).update(raw).digest("hex")===m.content_digest.value;
 }catch{return false}
});
add(manifestDigestOk,"MANIFEST-DIGEST-EXACT","every member digest matches repository bytes");

function finish(){
 const failed=checks.filter(x=>x.status==="FAIL");
 const report={protocol:"CUSTODIAL_V43_REPLAN_VALIDATION_V1",generated_at_utc:new Date().toISOString(),status:failed.length?"FAIL":"PASS",checks_total:checks.length,checks_passed:checks.length-failed.length,checks_failed:failed.length,content_sha256:Object.fromEntries(Object.entries(docs).filter(([,v])=>v?.__sha256).map(([k,v])=>[k,v.__sha256])),checks};
 const i=process.argv.indexOf("--write");if(i>=0&&process.argv[i+1])fs.writeFileSync(process.argv[i+1],JSON.stringify(report,null,2)+"\n");
 process.stdout.write(JSON.stringify(report,null,2)+"\n");process.exitCode=failed.length?1:0;
}
finish();
