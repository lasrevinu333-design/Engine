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

const docRoot=path.dirname(dir);
const h05MarkerBegin="<!-- BEGIN GENERATED H05 V4.3.2 -->",h05MarkerEnd="<!-- END GENERATED H05 V4.3.2 -->";
const h05Blocks={
  "custodial-unified-whole-system-v4-3-foundational-replan.md": "### 17.2.1 Generated H05 v4.3.2 gate-order contract\n\n`G-RESTORE` is the Day-11 pre-release restore-contract and rehearsal gate. `G-RELEASE-ADMISSION` then admits the exact signed Day-12 release tuple. After admission, `G-PHYSICAL-ACCEPTANCE` and `G-EXACT-RELEASE-RESTORE` proceed as sibling proof gates. `G-CANARY-ADMISSION` requires release admission and both siblings; no reverse edge is permitted.\n\nThe exact tuple binds source commit, schema/migration set, authority set, backend/workers/configuration, APK hash/version/signing identity, Fully Kiosk/device-policy identity, and relevant provider state. A material tuple change reopens physical acceptance, exact-release rollback/restore, and canary admission. Build 22 possession proves artifact/signer/baseline readiness only and is never final rollback acceptance.\n\nThis contract changes documentation and control validation only. Schema, component design, implementation, migration, APK, phone, canary execution, fleet, release, and production authority remain closed.",
  "custodial-unified-whole-system-v4-3-replan-audit-and-build-handoff.md": "Day 11 closes only the pre-release `G-RESTORE` contract and rehearsal proof. Day 12 `G-RELEASE-ADMISSION` admits the exact signed release tuple without depending on physical acceptance or any post-release proof. `G-PHYSICAL-ACCEPTANCE` and `G-EXACT-RELEASE-RESTORE` then close as sibling gates against that same tuple; Day-11 rehearsal evidence and Build 22 possession cannot close the exact-release gate. `G-CANARY-ADMISSION` requires release admission and both siblings.\n\nEvery tuple receipt binds source, schema/migrations, authority, backend/workers/configuration, APK hash/version/signing identity, Fully Kiosk/device policy, and provider state. A material tuple change deterministically reopens both proof siblings and canary admission. “Fourteen implementation days after Day-0 authorization, with pre-Day-1 closure outside that clock” remains the only schedule term.\n\nStage B and this handoff authorize documentation, validation, remote evidence publication, and audit only. All schema design, component design, product implementation, production, migration, APK, phone, canary execution, fleet, and release authority remains closed.",
  "custodial-unified-whole-system-v4-3-two-week-canary-acceleration-plan.md": "### Day 11 — Pre-release restore contract and rehearsal (not final release proof)\n\nEvidence gate `G-RESTORE`:\n\n- candidate restore bundle, interruption/retry, rollback ordering, and no-partial-activation rehearsal pass;\n- rehearsal receipts are labeled pre-release and cannot satisfy `G-EXACT-RELEASE-RESTORE`;\n- Build 22 artifact/signer/baseline readiness is recorded separately and is not final rollback acceptance.\n\n### Day 12 — Exact signed release-tuple admission\n\nEvidence gate `G-RELEASE-ADMISSION`:\n\n- admit source, schema/migration set, authority set, backend/workers/configuration, APK hash/version/signing identity, Fully Kiosk/device policy, and provider state as one exact signed tuple;\n- the gate depends on `G-RESTORE` and `G-BUILD22`, never on physical acceptance or evidence that can exist only after admission;\n- material tuple change invalidates every downstream physical, rollback/restore, and canary receipt.\n\n### Day 13 — Post-release sibling proofs and one-phone canary admission\n\nEvidence gates `G-PHYSICAL-ACCEPTANCE` and `G-EXACT-RELEASE-RESTORE` proceed as siblings after release admission:\n\n- the bound Moto G/Fully Kiosk/NFC/audio/GPS/Karen matrix passes against the admitted tuple;\n- exact-release downgrade, rollback, and restore execute against that tuple; Day-11 rehearsal-only evidence is rejected;\n- neither sibling depends on the other;\n- `G-CANARY-ADMISSION` closes only after `G-RELEASE-ADMISSION` and both siblings close; only then may the controlled one-phone canary start.\n\n### Day 14 — Canary evidence review\n\n- archive the exact admitted and observed canary tuple;\n- verify accepted-work evidence and manager inspection;\n- classify every defect by root cause and gate;\n- continue, correct-and-repeat, or begin separate fleet-release evidence; fleet rollout is never automatic."
};
function renderH05Block(body){return h05MarkerBegin+"\n"+body+"\n"+h05MarkerEnd}
function replaceH05Block(raw,body){
 const start=raw.indexOf(h05MarkerBegin),finish=raw.indexOf(h05MarkerEnd);
 if(start<0||finish<start)throw new Error("missing generated H05 markers");
 return raw.slice(0,start)+renderH05Block(body)+raw.slice(finish+h05MarkerEnd.length);
}
function gateProjection(gatesRaw,gates){
 const edges=[];
 for(const g of gates.gates)for(const workstream of g.blocks_workstreams)for(const implementation_day of g.blocks_days)edges.push({gate_id:g.gate_id,prerequisite_gate_ids:g.prerequisite_gate_ids,workstream,implementation_day,design_impact:g.design_impact,admission:"gate must be CLOSED, CLOSED_DISABLED, or have explicit structurally-invariant proof"});
 edges.sort((a,b)=>a.implementation_day-b.implementation_day||a.gate_id.localeCompare(b.gate_id)||a.workstream.localeCompare(b.workstream));
 const header=Buffer.from("blob "+Buffer.byteLength(gatesRaw)+"\0");
 const gateBlob=crypto.createHash("sha1").update(header).update(gatesRaw).digest("hex");
 return {schema_version:"v4.3.1",revision:"v4.3.2",artifact_id:"V43-GATE-DAY-PROJECTION",authority:"generated",generated_from:{artifact_id:gates.artifact_id,git_blob_sha1:gateBlob},generator:{id:"tools/validate-custodial-v43-replan.mjs",version:"2"},schedule_term:gates.generated_projection.schedule_term,day11:gates.generated_projection.day11,post_day12:gates.generated_projection.post_day12,omitted_dependency_count:0,edges,completeness_basis:"all gate references resolve; graph is acyclic; release admission precedes exact-tuple proof siblings and canary admission; H05 negative assertions pass"};
}
function regenerateH05(){
 const gatePath=path.join(dir,names.gates),gatesRaw=fs.readFileSync(gatePath,"utf8"),gates=JSON.parse(gatesRaw);
 fs.writeFileSync(path.join(dir,names.projection),JSON.stringify(gateProjection(gatesRaw,gates),null,2)+"\n");
 for(const [file,body] of Object.entries(h05Blocks)){
  const p=path.join(docRoot,file),current=fs.readFileSync(p,"utf8");
  fs.writeFileSync(p,replaceH05Block(current,body));
 }
}
if(process.argv.includes("--regenerate-h05"))regenerateH05();

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
add(docs.authority.restore_bundle.day11.includes("never final")&&docs.authority.restore_bundle.exact_release_gate?.gate_id==="G-EXACT-RELEASE-RESTORE","H05-RESTORE-SCOPE","Day-11 rehearsal is distinct from exact-release proof");
add(docs.authority.restore_bundle.release_tuple_required_fields?.length===9&&docs.authority.restore_bundle.build22_scope.includes("not final"),"H05-RESTORE-TUPLE","authority contract binds exact tuple and separates Build 22 readiness");
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
const tupleFields=["source_commit","schema_migration_set","authority_set","backend_workers_configuration","apk_sha256","apk_version","apk_signing_identity","fully_kiosk_device_policy_identity","provider_state"];
const gate=(id)=>docs.gates.gates.find(g=>g.gate_id===id);
add(exactPrereqs("G-RELEASE-ADMISSION",["G-RESTORE","G-BUILD22"]),"H05-RELEASE-DEPENDENCIES","release admission requires only pre-release restore and Build 22 readiness");
add(!gate("G-RELEASE-ADMISSION").prerequisite_gate_ids.includes("G-PHYSICAL-ACCEPTANCE"),"H05-RELEASE-NO-PHYSICAL","release admission has no reverse physical edge");
add(exactPrereqs("G-PHYSICAL-ACCEPTANCE",["G-NFC-RECOVERY","G-NOTIFICATION","G-ACCESSIBILITY","G-GPS","G-MESSENGER","G-EVENT","G-READINESS","G-PRODUCT-BOUNDARY","G-RELEASE-ADMISSION"]),"H05-PHYSICAL-AFTER-RELEASE","physical proof follows release admission and retains domain prerequisites");
add(exactPrereqs("G-EXACT-RELEASE-RESTORE",["G-RELEASE-ADMISSION"]),"H05-EXACT-RESTORE-AFTER-RELEASE","exact restore is a sibling proof after release");
add(exactPrereqs("G-CANARY-ADMISSION",["G-RELEASE-ADMISSION","G-PHYSICAL-ACCEPTANCE","G-EXACT-RELEASE-RESTORE"]),"H05-CANARY-DEPENDENCIES","canary admission requires release and both proof siblings");
add(!gate("G-PHYSICAL-ACCEPTANCE").prerequisite_gate_ids.includes("G-EXACT-RELEASE-RESTORE")&&!gate("G-EXACT-RELEASE-RESTORE").prerequisite_gate_ids.includes("G-PHYSICAL-ACCEPTANCE"),"H05-PROOF-SIBLINGS","physical and exact restore do not depend on each other");
add(tupleFields.every(x=>gate("G-RELEASE-ADMISSION").release_tuple_required_fields.includes(x)&&gate("G-PHYSICAL-ACCEPTANCE").release_tuple_required_fields.includes(x)&&gate("G-EXACT-RELEASE-RESTORE").release_tuple_required_fields.includes(x)),"H05-EXACT-TUPLE-BINDING","release and final receipts bind the complete exact tuple");
add(gate("G-EXACT-RELEASE-RESTORE").rejected_evidence.some(x=>x.includes("Day-11"))&&gate("G-BUILD22").not_final_rollback_acceptance===true,"H05-REHEARSAL-NOT-FINAL","Day-11 rehearsal and Build 22 possession cannot close final proof");
add([11,12,13,13].every((x,i)=>x===[Math.min(...gate("G-RESTORE").blocks_days),Math.min(...gate("G-RELEASE-ADMISSION").blocks_days),Math.min(...gate("G-PHYSICAL-ACCEPTANCE").blocks_days),Math.min(...gate("G-EXACT-RELEASE-RESTORE").blocks_days)][i]),"H05-DAY-MONOTONIC","rehearsal -> release -> sibling proofs is day-monotonic");
add(docs.gates.h05_release_order.downstream_invalidation_on_material_tuple_change.length===3&&["G-PHYSICAL-ACCEPTANCE","G-EXACT-RELEASE-RESTORE","G-CANARY-ADMISSION"].every(x=>docs.gates.h05_release_order.downstream_invalidation_on_material_tuple_change.includes(x)),"H05-TUPLE-INVALIDATION","material tuple changes invalidate all downstream evidence");
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
const gatesRaw=fs.readFileSync(path.join(dir,names.gates),"utf8");
add(JSON.stringify(docs.projection)===JSON.stringify(gateProjection(gatesRaw,docs.gates)),"H05-GATE-PROJECTION-BYTE-REPRODUCE","full generated projection reproduces byte-for-byte from canonical gate registry");
for(const [file,body] of Object.entries(h05Blocks)){
 const current=fs.readFileSync(path.join(docRoot,file),"utf8");
 add(current===replaceH05Block(current,body),"H05-MARKDOWN-"+file,"registered generated H05 block reproduces byte-for-byte");
}

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
 const report={protocol:"CUSTODIAL_V432_H05_VALIDATION_V2",generated_at_utc:new Date().toISOString(),status:failed.length?"FAIL":"PASS",checks_total:checks.length,checks_passed:checks.length-failed.length,checks_failed:failed.length,content_sha256:Object.fromEntries(Object.entries(docs).filter(([,v])=>v?.__sha256).map(([k,v])=>[k,v.__sha256])),checks};
 const i=process.argv.indexOf("--write");if(i>=0&&process.argv[i+1])fs.writeFileSync(process.argv[i+1],JSON.stringify(report,null,2)+"\n");
 process.stdout.write(JSON.stringify(report,null,2)+"\n");process.exitCode=failed.length?1:0;
}
finish();
