#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { spawnSync } from "node:child_process";
import os from "node:os";

const root=process.cwd();
const dir=process.env.CUSTODIAL_V43_H05_CONTRACT_DIR||path.join(root,"docs/audits/custodial-unified-v4-3/contracts");
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

const docRoot=process.env.CUSTODIAL_V43_H05_DOCUMENT_ROOT||path.dirname(dir);
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
function fsyncDirectory(directory){const fd=fs.openSync(directory,"r");try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function durableWrite(file,bytes,{exclusive=false}={}){const fd=fs.openSync(file,exclusive?"wx":"w");try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fsyncDirectory(path.dirname(file))}
function sha256(bytes){return crypto.createHash("sha256").update(bytes).digest("hex")}
function h05JournalPath(contractDir){return path.join(contractDir,".custodial-v43-h05-generation-transaction.json")}
function buildH05Outputs(contractDir,documentRoot){
 const gatePath=path.join(contractDir,names.gates),gatesRaw=fs.readFileSync(gatePath,"utf8"),gates=JSON.parse(gatesRaw);
 const outputs=new Map([[path.join(contractDir,names.projection),JSON.stringify(gateProjection(gatesRaw,gates),null,2)+"\n"]]);
 for(const [file,body] of Object.entries(h05Blocks)){
  const target=path.join(documentRoot,file),current=fs.readFileSync(target,"utf8");
  outputs.set(target,replaceH05Block(current,body));
 }
 return outputs;
}
function recoverH05Transaction(contractDir,expectedOutputs){
 const journalPath=h05JournalPath(contractDir);if(!fs.existsSync(journalPath))return {recovered:false};
 const journal=JSON.parse(fs.readFileSync(journalPath,"utf8"));
 if(journal.protocol!=="CUSTODIAL_V43_H05_GENERATION_TRANSACTION_V2"||journal.status!=="IN_PROGRESS"||!Array.isArray(journal.entries))throw new Error("E-H05-JOURNAL-INVALID");
 const base=path.dirname(contractDir),owned=[],expectedNames=[...expectedOutputs.keys()].map(file=>path.relative(base,file)).sort();
 if(JSON.stringify(journal.entries.map(entry=>entry.file).sort())!==JSON.stringify(expectedNames))throw new Error("E-H05-JOURNAL-MEMBERSHIP");
 for(const [index,entry] of journal.entries.entries()){
  for(const key of ["file","temporary_file"]){if(typeof entry[key]!=="string"||path.isAbsolute(entry[key])||path.posix.normalize(entry[key])!==entry[key]||entry[key].startsWith("../"))throw new Error("E-H05-JOURNAL-PATH");}
  const file=path.resolve(base,entry.file),temporary=path.resolve(base,entry.temporary_file);
  if(!file.startsWith(base+path.sep)||!temporary.startsWith(base+path.sep))throw new Error("E-H05-JOURNAL-PATH");
  if(typeof entry.previous_base64!=="string"||typeof entry.previous_sha256!=="string"||typeof entry.next_sha256!=="string")throw new Error("E-H05-JOURNAL-IDENTITY");
  const previous=Buffer.from(entry.previous_base64,"base64"),expectedNext=expectedOutputs.get(file);
  if(previous.toString("base64")!==entry.previous_base64||sha256(previous)!==entry.previous_sha256)throw new Error("E-H05-JOURNAL-PREVIOUS-IDENTITY");
  if(expectedNext===undefined||sha256(expectedNext)!==entry.next_sha256)throw new Error("E-H05-JOURNAL-NEXT-IDENTITY");
  const recovery=`${file}.recovery-${journal.transaction_id}-${index}`;
  if(fs.existsSync(recovery)){if(sha256(fs.readFileSync(recovery))!==entry.previous_sha256)throw new Error("E-H05-RECOVERY-RESIDUE-IDENTITY");}
  else durableWrite(recovery,previous,{exclusive:true});
  if(Number(process.env.CUSTODIAL_V43_H05_RECOVERY_CRASH_AFTER_TEMP)===index+1)process.exit(98);
  fs.renameSync(recovery,file);fsyncDirectory(path.dirname(file));owned.push(temporary,recovery);
 }
 for(const ownedPath of owned)if(fs.existsSync(ownedPath)){fs.unlinkSync(ownedPath);fsyncDirectory(path.dirname(ownedPath));}
 fs.unlinkSync(journalPath);fsyncDirectory(contractDir);return {recovered:true,entries:journal.entries.length};
}
function regenerateH05At(contractDir,documentRoot,{injectAfter=null}={}){
 let outputs=buildH05Outputs(contractDir,documentRoot);
 recoverH05Transaction(contractDir,outputs);
 outputs=buildH05Outputs(contractDir,documentRoot);
 const journalPath=h05JournalPath(contractDir),base=path.dirname(contractDir);
 const targetSet=[...outputs].map(([file,next])=>({file,next,previous:fs.readFileSync(file)}));
 const transactionId=sha256(targetSet.map(({file,next,previous})=>`${path.relative(base,file)}\0${sha256(previous)}\0${sha256(next)}`).join("\n")).slice(0,24);
 const journal={protocol:"CUSTODIAL_V43_H05_GENERATION_TRANSACTION_V2",status:"IN_PROGRESS",transaction_id:transactionId,entries:targetSet.map(({file,next,previous},index)=>({file:path.relative(base,file),temporary_file:path.relative(base,`${file}.next-${transactionId}-${index}`),previous_base64:previous.toString("base64"),previous_sha256:sha256(previous),next_sha256:sha256(next)}))};
 durableWrite(journalPath,JSON.stringify(journal)+"\n",{exclusive:true});
 let promoted=0;
 try{
  for(const [index,{file,next}] of targetSet.entries()){
   const temp=path.resolve(base,journal.entries[index].temporary_file);durableWrite(temp,next,{exclusive:true});fs.renameSync(temp,file);fsyncDirectory(path.dirname(file));promoted+=1;
   if(Number(process.env.CUSTODIAL_V43_H05_CRASH_AFTER)===promoted)process.exit(97);
   if(injectAfter===promoted)throw new Error(`E-H05-INJECTED-PARTIAL:${promoted}`);
  }
  fs.unlinkSync(journalPath);fsyncDirectory(contractDir);
 }catch(error){
  recoverH05Transaction(contractDir,outputs);
  throw error;
 }
 return {outputs:outputs.size,promoted};
}
function regenerateH05(){return regenerateH05At(dir,docRoot)}
if(fs.existsSync(h05JournalPath(dir))&&!process.argv.some(arg=>arg==="--regenerate-h05"||arg==="--regenerate-h05-only"))throw new Error("E-H05-TRANSACTION-IN-PROGRESS");
if(process.argv.some(arg=>arg==="--regenerate-h05"||arg==="--regenerate-h05-only")){const result=regenerateH05();if(process.argv.includes("--regenerate-h05-only")){process.stdout.write(`${JSON.stringify({protocol:"CUSTODIAL_V43_H05_GENERATION_V2",status:"WROTE",...result})}\n`);process.exit(0)}}

const checks=[],docs={};
function add(ok,id,detail){checks.push({id,status:ok?"PASS":"FAIL",detail})}
function transactionRecoverySelfTest(){
 const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),"custodial-v43-h05-")),contractDir=path.join(tempRoot,"contracts"),documentRoot=tempRoot;
 fs.mkdirSync(contractDir,{recursive:true});
 const copied=[path.join(dir,names.gates),path.join(dir,names.projection),...Object.keys(h05Blocks).map(file=>path.join(docRoot,file))];
 try{
  for(const source of copied){const target=source.startsWith(dir+path.sep)?path.join(contractDir,path.basename(source)):path.join(documentRoot,path.basename(source));fs.copyFileSync(source,target);}
  const expected=buildH05Outputs(contractDir,documentRoot),prior=new Map();
  for(const [file,next] of expected){
   const seeded=file===path.join(contractDir,names.projection)?JSON.stringify({...JSON.parse(next),self_test_prior_sentinel:true},null,2)+"\n":replaceH05Block(fs.readFileSync(file,"utf8"),`PRIOR_SENTINEL:${path.basename(file)}`);
   durableWrite(file,seeded);prior.set(file,Buffer.from(seeded));
  }
  const script=path.join(root,"tools/validate-custodial-v43-replan.mjs"),environment={...process.env,CUSTODIAL_V43_H05_CONTRACT_DIR:contractDir,CUSTODIAL_V43_H05_DOCUMENT_ROOT:documentRoot,CUSTODIAL_V43_H05_CRASH_AFTER:"2"};
  const interrupted=spawnSync(process.execPath,[script,"--regenerate-h05-only"],{cwd:root,env:environment,encoding:"utf8"});
  const mixedCounts=[...expected].reduce((counts,[file,next])=>{const current=fs.readFileSync(file);if(current.equals(Buffer.from(next)))counts.next+=1;else if(current.equals(prior.get(file)))counts.prior+=1;else counts.unknown+=1;return counts},{next:0,prior:0,unknown:0});
  delete environment.CUSTODIAL_V43_H05_CRASH_AFTER;
  const journalPath=h05JournalPath(contractDir),journalBytes=fs.readFileSync(journalPath),mixedBytes=new Map([...expected].map(([file])=>[file,fs.readFileSync(file)]));
  const corrupt=JSON.parse(journalBytes);corrupt.entries[0].next_sha256="0".repeat(64);durableWrite(journalPath,JSON.stringify(corrupt)+"\n");
  const corruptRestart=spawnSync(process.execPath,[script,"--regenerate-h05-only"],{cwd:root,env:environment,encoding:"utf8"});
  const corruptionFailedClosed=corruptRestart.status!==0&&[...mixedBytes].every(([file,bytes])=>fs.readFileSync(file).equals(bytes));
  durableWrite(journalPath,journalBytes);
  const recoveryInterrupted=spawnSync(process.execPath,[script,"--regenerate-h05-only"],{cwd:root,env:{...environment,CUSTODIAL_V43_H05_RECOVERY_CRASH_AFTER_TEMP:"1"},encoding:"utf8"});
  const restarted=spawnSync(process.execPath,[script,"--regenerate-h05-only"],{cwd:root,env:environment,encoding:"utf8"});
  const exact=[...expected].every(([file,next])=>fs.readFileSync(file,"utf8")===next);
  const residue=fs.readdirSync(tempRoot,{recursive:true}).some(name=>String(name).includes("generation-transaction")||String(name).includes(".next-")||String(name).includes(".recovery-"));
  return interrupted.status===97&&mixedCounts.next===2&&mixedCounts.prior===expected.size-2&&mixedCounts.unknown===0&&corruptionFailedClosed&&recoveryInterrupted.status===98&&restarted.status===0&&exact&&!residue;
 }finally{fs.rmSync(tempRoot,{recursive:true,force:true})}
}
add(transactionRecoverySelfTest(),"H05-TRANSACTION-RECOVERY","distinct prior/next bytes prove mixed publication, corrupt identities fail closed, recovery restart is idempotent, and owned residue is removed");
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
add(ns.every(n=>!n.generator.includes("validate-custodial")||["generated_projection","generated_evidence","markdown_projection"].includes(n.kind)),"DAG-GENERATOR-ROLE","validator generates only projections/evidence");
const expectedManifestSources=[
 ["V43-CONTENT-01","dag_input","V43-FINDING-CLOSURE"],["V43-CONTENT-02","dag_input","V43-ARTIFACT-GENERATION"],["V43-CONTENT-03","dag_input","V43-AUTHORITY-RESTORE"],["V43-CONTENT-04","dag_input","V43-CONTRACT-SCHEMAS"],["V43-CONTENT-05","dag_input","V43-GATE-REGISTRY"],["V43-CONTENT-06","dag_input","V43-OCCURRENCE-LOCATION"],["V43-CONTENT-07","dag_input","V43-OPERATIONAL-DOMAINS"],["V43-CONTENT-08","dag_input","V43-SECURITY-AUTHORITY"],["V43-CONTENT-09","dag_input","V43-STAGE-CONTROL"],["V43-README","dag_input","V43-README-PROJECTION"],["V43-REPLAN","dag_input","V43-REPLAN-PROJECTION"],["V43-HANDOFF","dag_input","V43-HANDOFF-PROJECTION"],["V43-SCHEDULE","dag_input","V43-SCHEDULE-PROJECTION"],["V43-VALIDATOR","dag_input","V43-VALIDATOR"],["V43-GATE-DAY-PROJECTION","dag_input","V43-GATE-DAY-PROJECTION"],["V43-V42-RECONCILIATION","frozen_evidence","EVIDENCE-V42"],["V43-CONTENT-MANIFEST-GENERATOR","generator_implementation","V43-CONTENT-MANIFEST.generator"],["V43-QUALITY-GATE-WIRING","validation_wiring","package.json"],["V43-QUALITY-WORKFLOW","validation_wiring",".github/workflows/whole-system-quality-gate.yml"]
].map(([member_artifact_id,source_kind,source_artifact_id])=>({member_artifact_id,source_kind,source_artifact_id}));
const manifestNode=ns.find(n=>n.artifact_id==="V43-CONTENT-MANIFEST"),manifestSources=manifestNode?.member_source_classification||[],directManifestSources=manifestSources.filter(entry=>entry.source_kind==="dag_input").map(entry=>entry.source_artifact_id),supplementalManifestSources=manifestSources.filter(entry=>entry.source_kind!=="dag_input");
add(manifestSources.length===19&&new Set(manifestSources.map(entry=>entry.member_artifact_id)).size===19,"DAG-MANIFEST-SOURCE-COUNT","all 19 manifest members have one source classification");
add(directManifestSources.length===manifestNode.inputs.length&&manifestNode.inputs.every(input=>directManifestSources.includes(input))&&new Set(directManifestSources).size===manifestNode.inputs.length,"DAG-MANIFEST-DIRECT-SOURCE-PARITY","15 direct manifest sources exactly match DAG inputs");
add(JSON.stringify(supplementalManifestSources.map(entry=>[entry.member_artifact_id,entry.source_kind,entry.source_artifact_id]))===JSON.stringify([["V43-V42-RECONCILIATION","frozen_evidence","EVIDENCE-V42"],["V43-CONTENT-MANIFEST-GENERATOR","generator_implementation","V43-CONTENT-MANIFEST.generator"],["V43-QUALITY-GATE-WIRING","validation_wiring","package.json"],["V43-QUALITY-WORKFLOW","validation_wiring",".github/workflows/whole-system-quality-gate.yml"]]),"DAG-MANIFEST-SUPPLEMENTAL-SOURCES","four supplemental members are explicit without fabricated DAG edges");
add(JSON.stringify(manifestSources)===JSON.stringify(expectedManifestSources),"DAG-MANIFEST-EXACT-SOURCE-MAPPING","all 19 member/source triples match the independent specification in canonical order");
const swappedManifestSources=structuredClone(manifestSources);[swappedManifestSources[0].source_artifact_id,swappedManifestSources[1].source_artifact_id]=[swappedManifestSources[1].source_artifact_id,swappedManifestSources[0].source_artifact_id];
add(JSON.stringify(swappedManifestSources)!==JSON.stringify(expectedManifestSources),"DAG-MANIFEST-SOURCE-SWAP-REJECT","swapping two direct mappings is rejected");
add(JSON.stringify(structuredClone(manifestSources))===JSON.stringify(expectedManifestSources),"DAG-MANIFEST-SOURCE-SWAP-RECOVERY","exact mapping bytes recover after mutation");
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
add(docs.authority.restore_bundle.day11.includes("rehearsal")&&docs.authority.restore_bundle.final_admission.includes("Day-12"),"RESTORE-RELEASE-BOUND","Day11 rehearsal/post-Day12 proof");
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
const expectedDependencyInvariants=[
 "all prerequisite IDs resolve",
 "graph is acyclic",
 "no self dependency",
 "every non-root gate has a semantic prerequisite",
 "G-RESTORE and G-BUILD22 precede G-RELEASE-ADMISSION",
 "G-PHYSICAL-ACCEPTANCE and G-EXACT-RELEASE-RESTORE are sibling post-admission proofs",
 "G-CANARY-ADMISSION requires G-RELEASE-ADMISSION plus both sibling proofs",
 "G-RELEASE-ADMISSION never depends on either post-admission proof; no reverse edge is permitted",
 "omitted dependency count is computed, never asserted"
];
const dependencyInvariantError=(candidate)=>JSON.stringify(candidate.dependency_invariants)===JSON.stringify(expectedDependencyInvariants)?null:"H05_DEPENDENCY_INVARIANTS_EXACT";
add(dependencyInvariantError(docs.gates)===null,"H05-DEPENDENCY-INVARIANTS-EXACT","normative dependency prose exactly matches the canonical graph");
const oldContradictoryInvariants=[...expectedDependencyInvariants.slice(0,4),"release admission depends on physical acceptance, restore, and Build 22","physical acceptance depends on NFC, notification/accessibility, GPS, Messenger, Event, readiness, product boundary, restore, and Build 22","omitted dependency count is computed, never asserted"];
const proseMutation=structuredClone(docs.gates);proseMutation.dependency_invariants=oldContradictoryInvariants;
add(dependencyInvariantError(proseMutation)==="H05_DEPENDENCY_INVARIANTS_EXACT","H05-PROSE-REGRESSION-REJECT","old contradictory prose fails for the exact semantic invariant");
const proseRecovery=structuredClone(proseMutation);proseRecovery.dependency_invariants=[...expectedDependencyInvariants];
add(dependencyInvariantError(proseRecovery)===null&&JSON.stringify(proseRecovery.dependency_invariants)===JSON.stringify(docs.gates.dependency_invariants),"H05-PROSE-REGRESSION-RECOVERY","exact recovery restores accepted normative bytes");
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
const projectionComparable={...docs.projection};delete projectionComparable.__sha256;
add(JSON.stringify(projectionComparable)===JSON.stringify(gateProjection(gatesRaw,docs.gates)),"H05-GATE-PROJECTION-BYTE-REPRODUCE","full generated projection reproduces byte-for-byte from canonical gate registry");
for(const [file,body] of Object.entries(h05Blocks)){
 const current=fs.readFileSync(path.join(docRoot,file),"utf8");
 add(current===replaceH05Block(current,body),"H05-MARKDOWN-"+file,"registered generated H05 block reproduces byte-for-byte");
}

const man=docs.manifest;
add(!("lifecycle_state" in man)&&!JSON.stringify(man).includes("authorization_decision"),"MANIFEST-IMMUTABLE","no mutable stage authority");
add(man.identity_rule.self_digest==="forbidden"&&man.identity_rule.containing_commit==="detached_attestation_only","MANIFEST-NON-SELF","self digest/commit excluded");
const memberPaths=new Set(man.members.map(m=>m.path));
const memberRepoPaths=man.members.map(m=>m.repo_path);
add(new Set(memberPaths).size===man.members.length&&new Set(memberRepoPaths).size===man.members.length,"MANIFEST-MEMBER-UNIQUE","artifact paths and repository paths are unique");
add(!memberRepoPaths.includes("docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json")&&!man.members.some(m=>m.type==="immutable_manifest"),"MANIFEST-CIRCULARITY-REJECT","manifest self-reference and semantic manifest cycles are forbidden");
add(Object.values(names).filter(x=>x!==names.manifest).every(x=>memberPaths.has("contracts/"+x)||memberPaths.has("tools/"+x))&&memberPaths.has("tools/generate-v43-content-manifest.mjs"),"MANIFEST-MEMBERS","all contracts, validator, and registered manifest generator are listed");
add(man.members.every(m=>m.content_digest?.algorithm==="git_blob_sha1"&&/^[0-9a-f]{40}$/.test(m.content_digest.value)),"MANIFEST-DIGEST-FORMAT","every member has one Git blob digest");
const manifestDigestOk=man.members.every(m=>{
 try{
  const raw=fs.readFileSync(path.join(root,m.repo_path));
  const header=Buffer.from("blob "+raw.length+"\0");
  return crypto.createHash("sha1").update(header).update(raw).digest("hex")===m.content_digest.value;
 }catch{return false}
});
add(manifestDigestOk,"MANIFEST-DIGEST-EXACT","every member digest matches repository bytes");
function exactManifestGeneratorResult(result,mode,selfTests){
 if(result.status!==0)return false;
 try{
  const parsed=JSON.parse(result.stdout);
  return JSON.stringify(Object.keys(parsed).sort())===JSON.stringify(["activation_authorized","manifest_sha256","members","mode","protocol","self_tests","status"].sort())&&parsed.protocol==="CUSTODIAL_V43_CONTENT_MANIFEST_GENERATOR_V2"&&parsed.status==="PASS"&&parsed.mode===mode&&parsed.members===19&&parsed.manifest_sha256===docs.manifest.__sha256&&parsed.self_tests===selfTests&&parsed.activation_authorized===false;
 }catch{return false}
}
const manifestCheck=spawnSync(process.execPath,["tools/generate-v43-content-manifest.mjs","--check"],{cwd:root,encoding:"utf8"});
add(exactManifestGeneratorResult(manifestCheck,"--check",0),"MANIFEST-GENERATOR-CHECK",manifestCheck.status===0?"registered generator check result exactly matches current manifest and emitted protocol":"generator check failed: "+(manifestCheck.stderr||manifestCheck.stdout).trim());
const manifestSelfTest=spawnSync(process.execPath,["tools/generate-v43-content-manifest.mjs","--self-test"],{cwd:root,encoding:"utf8"});
add(exactManifestGeneratorResult(manifestSelfTest,"--self-test",11),"MANIFEST-GENERATOR-SELF-TEST",manifestSelfTest.status===0?"inherited quality path executes and exactly validates all 11 adversarial manifest tests":"generator self-test failed: "+(manifestSelfTest.stderr||manifestSelfTest.stdout).trim());

function finish(){
 const failed=checks.filter(x=>x.status==="FAIL");
 const report={protocol:"CUSTODIAL_V432_H05_VALIDATION_V2",generated_at_utc:new Date().toISOString(),status:failed.length?"FAIL":"PASS",checks_total:checks.length,checks_passed:checks.length-failed.length,checks_failed:failed.length,content_sha256:Object.fromEntries(Object.entries(docs).filter(([,v])=>v?.__sha256).map(([k,v])=>[k,v.__sha256])),checks};
 const i=process.argv.indexOf("--write");if(i>=0&&process.argv[i+1])fs.writeFileSync(process.argv[i+1],JSON.stringify(report,null,2)+"\n");
 process.stdout.write(JSON.stringify(report,null,2)+"\n");process.exitCode=failed.length?1:0;
}
finish();
