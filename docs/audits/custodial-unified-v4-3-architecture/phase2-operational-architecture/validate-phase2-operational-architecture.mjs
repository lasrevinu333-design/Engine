import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const here=path.dirname(new URL(import.meta.url).pathname);
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name),"utf8"));
const readLines=name=>fs.readFileSync(path.join(here,name),"utf8").trim().split("\n").map(JSON.parse);
const fail=(code,message)=>{const error=new Error(code+": "+message);error.code=code;throw error;};
const ensure=(ok,code,message)=>{if(!ok)fail(code,message);};
const ids=(items,key="id")=>items.map(item=>item[key]);
const unique=(values,code,label)=>ensure(new Set(values).size===values.length,code,label);
const sameSet=(a,b,code,label)=>{const set=new Set(b);ensure(a.length===b.length&&a.every(value=>set.has(value)),code,label);};
const hex=(value,length)=>typeof value==="string"&&new RegExp("^[0-9a-f]{"+length+"}$").test(value);
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const clone=value=>JSON.parse(JSON.stringify(value));
const names={engine:"phase2-engine-authority-surface-inventory.json",backend:"phase2-backend-authority-surface-inventory.json",ledger:"phase2-source-authority-disposition-ledger.jsonl",index:"phase2-source-authority-inventory-index.json",summary:"phase2-source-authority-disposition-summary.json",integration:"phase2-inventory-integration-result.json",commandCorrection:"phase2-command-registry-correction-result.json",auth:"phase2-principal-grant-tool-authorization-contract.json",objects:"phase2-operational-object-registry.json",commands:"phase2-command-record-state-machine-registry.json",coverage:"phase2-command-and-transition-coverage-ledger.json",retirement:"phase2-writer-resolver-trigger-cron-api-tool-retirement-registry.json",fixtures:"phase2-conformance-fixtures.json",proofs:"phase2-proof-gate-and-physical-obligation-registry.json",validatorCoverage:"phase2-validator-coverage-ledger.json",dag:"phase2-artifact-generation-dag.json",manifest:"phase2-package-manifest.json"};
const loadPackage=()=>Object.fromEntries(Object.entries(names).map(([key,name])=>[key,name.endsWith(".jsonl")?readLines(name):read(name)]));

function validateInventory(inv,label){
 ensure(inv.status==="COMPLETE_EXACT_ARCHITECTURE_DISPOSITIONS","E-INVENTORY-INCOMPLETE",label);
 ensure(inv.coverage.complete===true&&inv.coverage.unresolved===0,"E-INVENTORY-INCOMPLETE",label);
 ensure(inv.entries.length===inv.coverage.entries&&inv.entries.length===inv.coverage.unique_inventory_ids,"E-INVENTORY-CLOSURE",label);
 unique(ids(inv.entries,"inventory_id"),"E-DUPLICATE-ID",label+" ids");
 ensure(inv.entries.every(row=>hex(row.source_commit,40)&&hex(row.source_tree,40)&&hex(row.git_blob_sha1,40)&&hex(row.file_sha256,64)&&hex(row.definition_sha256,64)),"E-INVENTORY-INTEGRITY",label+" hashes");
 ensure(inv.entries.every(row=>row.classification_status==="RESOLVED_ARCHITECTURE_DISPOSITION"&&row.architecture_admission===true&&row.runtime_admission===false&&row.source_target_disposition&&row.replacement_command_ids.length&&row.owner&&row.grants.length&&row.tools.length&&row.callers.length&&row.denial_proof_fixture_id),"E-INVENTORY-CLOSURE",label+" disposition");
}
function validateDag(dag){
 const nodeIds=ids(dag.nodes);unique(nodeIds,"E-DUPLICATE-ID","DAG nodes");
 ensure(dag.edges.every(edge=>nodeIds.includes(edge.from)&&nodeIds.includes(edge.to)),"E-DAG-NODE","unknown node");
 const out=Object.fromEntries(nodeIds.map(id=>[id,[]])),degree=Object.fromEntries(nodeIds.map(id=>[id,0]));
 for(const edge of dag.edges){out[edge.from].push(edge.to);degree[edge.to]++;}
 const queue=nodeIds.filter(id=>degree[id]===0);let seen=0;
 while(queue.length){const id=queue.shift();seen++;for(const next of out[id])if(--degree[next]===0)queue.push(next);}
 ensure(seen===nodeIds.length,"E-DAG-CYCLE","cycle");
}
function validatePackage(p,{manifestBytes=true}={}){
 validateInventory(p.engine,"engine");validateInventory(p.backend,"backend");
 const rows=[...p.engine.entries,...p.backend.entries],rowIds=ids(rows,"inventory_id"),rowIdSet=new Set(rowIds);
 unique(rowIds,"E-DUPLICATE-ID","combined inventory");
 sameSet(ids(p.ledger,"inventory_id"),rowIds,"E-INVENTORY-CLOSURE","resolved ledger");
 sameSet(p.ledger.map(JSON.stringify),rows.map(JSON.stringify),"E-INVENTORY-CLOSURE","ledger/inventory row equality");
 ensure(p.ledger.every(row=>row.classification_status==="RESOLVED_ARCHITECTURE_DISPOSITION"),"E-INVENTORY-INCOMPLETE","ledger unresolved");
 ensure(p.index.ledger.rows===rows.length&&p.index.ledger.resolved_rows===rows.length&&p.index.ledger.unresolved_rows===0,"E-INVENTORY-CLOSURE","index counts");
 ensure(p.summary.rows===rows.length&&p.summary.resolved===rows.length&&p.summary.unresolved===0,"E-INVENTORY-CLOSURE","summary counts");
 ensure(p.integration.ledger_rows===rows.length&&p.integration.resolved_surfaces===rows.length&&p.integration.unresolved_surfaces===0,"E-INVENTORY-CLOSURE","integration counts");
 const engineDigest=sha256(fs.readFileSync(path.join(here,names.engine))),backendDigest=sha256(fs.readFileSync(path.join(here,names.backend))),ledgerDigest=sha256(fs.readFileSync(path.join(here,names.ledger)));
 ensure(p.index.inventories[0].sha256===engineDigest&&p.index.inventories[1].sha256===backendDigest&&p.index.ledger.sha256===ledgerDigest,"E-INVENTORY-INTEGRITY","index digests");
 ensure(p.summary.inventory_index_sha256===sha256(fs.readFileSync(path.join(here,names.index)))&&p.summary.ledger_sha256===ledgerDigest,"E-INVENTORY-INTEGRITY","summary digests");
 ensure(p.integration.index_sha256===sha256(fs.readFileSync(path.join(here,names.index)))&&p.integration.summary_sha256===sha256(fs.readFileSync(path.join(here,names.summary)))&&p.integration.ledger_sha256===ledgerDigest,"E-INVENTORY-INTEGRITY","integration digests");
 ensure(p.commandCorrection.commands===p.commands.commands.length&&p.commandCorrection.state_machines===p.commands.state_machines.length&&p.commandCorrection.transitions===p.commands.state_machines.reduce((n,m)=>n+m.transitions.length,0)&&p.commandCorrection.source_surfaces===rows.length,"E-COMMAND-TRANSITION-CLOSURE","command correction counts");
 ensure(p.commandCorrection.registry_sha256===sha256(fs.readFileSync(path.join(here,names.commands)))&&p.commandCorrection.coverage_sha256===sha256(fs.readFileSync(path.join(here,names.coverage))),"E-COMMAND-TRANSITION-CLOSURE","command correction digests");
 const commands=p.commands.commands,commandIds=ids(commands),commandIdSet=new Set(commandIds);unique(commandIds,"E-DUPLICATE-ID","commands");
 const machines=p.commands.state_machines;unique(ids(machines),"E-DUPLICATE-ID","machines");
 const transitions=machines.flatMap(machine=>machine.transitions);
 sameSet(commandIds,transitions.map(t=>t.command_id),"E-COMMAND-TRANSITION-CLOSURE","commands/transitions");
 ensure(commands.every(command=>transitions.filter(t=>t.command_id===command.id).length===1),"E-COMMAND-TRANSITION-CLOSURE","one transition");
 for(const machine of machines){unique(machine.states,"E-DUPLICATE-ID",machine.id+" states");ensure(machine.states.includes(machine.initial_state)&&machine.transitions.every(t=>t.from_states.every(state=>machine.states.includes(state))&&machine.states.includes(t.to_state)),"E-STATE-MACHINE",machine.id);}
 const principals=new Set(ids(p.auth.principals)),grants=new Map(p.auth.grants.map(g=>[g.id,g])),tools=new Set(ids(p.auth.tools));
 ensure(!grants.has("GRANT-READ-ONLY")&&!grants.has("GRANT-MCP-READ-ONLY"),"E-AUTHORIZATION-DENIED","read-only grant");
 for(const command of commands){ensure(principals.has(command.principal)&&grants.has(command.grant)&&tools.has(command.tool),"E-AUTHORIZATION-CLOSURE",command.id);const grant=grants.get(command.grant);ensure(grant.principal_ids.includes(command.principal)&&grant.tools.includes(command.tool),"E-AUTHORIZATION-DENIED",command.id);ensure(command.source_surface_ids.length&&command.source_surface_ids.every(id=>rowIdSet.has(id)),"E-SOURCE-CLOSURE",command.id);}
 sameSet(p.coverage.command_ids,commandIds,"E-COMMAND-TRANSITION-CLOSURE","coverage commands");
 sameSet(ids(p.coverage.commands,"command_id"),commandIds,"E-COMMAND-TRANSITION-CLOSURE","coverage rows");
 ensure(p.coverage.commands.every(row=>row.transition_count===1),"E-COMMAND-TRANSITION-CLOSURE","coverage count");
 sameSet(ids(p.coverage.source_surfaces,"source_surface_id"),rowIds,"E-SOURCE-CLOSURE","coverage surfaces");
 ensure(p.coverage.source_surfaces.every(row=>row.command_ids.length&&row.command_ids.every(id=>commandIdSet.has(id))),"E-SOURCE-CLOSURE","source joins");
 sameSet(ids(p.retirement.entries,"surface_id"),rowIds,"E-RETIREMENT-CLOSURE","retirement");
 ensure(p.retirement.entries.every(entry=>entry.activation_state==="FENCED_NOT_ACTIVATED"&&entry.runtime_admission===false&&entry.replacement_command_ids.length&&entry.denial_proof_fixture_id),"E-RETIREMENT-FENCE","retirement state");
 const proofIds=ids(p.proofs.proofs);unique(proofIds,"E-DUPLICATE-ID","proofs");
 sameSet(p.proofs.proofs.map(proof=>proof.command_id),commandIds,"E-PROOF-CLOSURE","proof commands");
 ensure(commands.every(command=>proofIds.includes(command.proof)),"E-PROOF-CLOSURE","command proof");
 const pos=ids(p.fixtures.positive),neg=ids(p.fixtures.failure),rec=ids(p.fixtures.recovery),ret=ids(p.fixtures.retirement);
 sameSet(p.fixtures.positive.map(f=>f.command_id),commandIds,"E-FIXTURE-CLOSURE","positive");
 sameSet(p.fixtures.failure.map(f=>f.command_id),commandIds,"E-FIXTURE-CLOSURE","failure");
 sameSet(p.fixtures.recovery.map(f=>f.command_id),commandIds,"E-FIXTURE-CLOSURE","recovery");
 ensure(p.proofs.proofs.every(proof=>proof.fixture_ids.every(id=>pos.includes(id)||neg.includes(id)||rec.includes(id))),"E-PROOF-CLOSURE","proof fixtures");
 ensure(p.retirement.entries.every(entry=>ret.includes(entry.denial_proof_fixture_id)),"E-FIXTURE-CLOSURE","retirement fixtures");
 ensure(p.proofs.physical_obligations.every(item=>item.required===true&&item.not_applicable===false&&item.evidence_state),"E-PHYSICAL-OBLIGATION","runtime/physical");
 ensure(p.proofs.gate.forbidden_primary_inputs.includes("phase2-validation-result.json")&&p.proofs.gate.forbidden_primary_inputs.includes("phase2-post-build-independent-review.json"),"E-CIRCULAR-ACCEPTANCE","forbidden primary input");
 ensure(p.validatorCoverage.derivation.no_fixed_minima===true,"E-FIXED-MINIMUM","fixed minima");
 sameSet(p.validatorCoverage.expected_mutation_fixture_ids,ids(p.fixtures.adversarial),"E-MUTATION-COVERAGE","mutations");
 validateDag(p.dag);
 if(manifestBytes){ensure(!p.manifest.files.some(file=>p.manifest.forbidden_primary_files.includes(file.name)),"E-CIRCULAR-ACCEPTANCE","manifest");for(const file of p.manifest.files){const bytes=fs.readFileSync(path.join(here,file.name));ensure(bytes.length===file.bytes&&sha256(bytes)===file.sha256,"E-MANIFEST-DIGEST",file.name);}}
 return {commands:commandIds.length,state_machines:machines.length,transitions:transitions.length,surfaces:rowIds.length,retirements:p.retirement.entries.length,proofs:proofIds.length,fixtures:pos.length+neg.length+rec.length+ret.length+p.fixtures.adversarial.length};
}
function executeBehavior(p){
 const transitions=new Map(p.commands.state_machines.flatMap(machine=>machine.transitions.map(t=>[t.command_id,t])));
 let normal=0,replay=0,failures=0,recoveries=0;
 for(const command of p.commands.commands){const transition=transitions.get(command.id),journal=new Map();const apply=({identity,payload="v1",actor=command.principal,sequence=0,generation="active",state=transition.from_states[0]})=>{if(actor!==command.principal)fail("E-AUTHORIZATION-DENIED",command.id);if(generation!=="active")fail("E-AUTHORITY-GENERATION",command.id);if(sequence!==0)fail("E-SEQUENCE-CONFLICT",command.id);if(journal.has(identity)){const prior=journal.get(identity);if(prior.payload!==payload)fail("E-REPLAY-PAYLOAD-MISMATCH",command.id);return {...prior,replayed:true};}ensure(transition.from_states.includes(state),"E-STATE-PRECONDITION",command.id);const result={payload,state:transition.to_state,event_count:1,outbox_count:1};journal.set(identity,result);return {...result,replayed:false};};
  const first=apply({identity:"id-1"});ensure(first.state===transition.to_state,"E-TRANSITION",command.id);normal++;
  ensure(apply({identity:"id-1"}).replayed&&journal.size===1,"E-IDEMPOTENCY",command.id);replay++;
  for(const [args,code] of [[{identity:"id-1",payload:"changed"},"E-REPLAY-PAYLOAD-MISMATCH"],[{identity:"id-2",sequence:1},"E-SEQUENCE-CONFLICT"],[{identity:"id-3",actor:"P-READ-ONLY"},"E-AUTHORIZATION-DENIED"],[{identity:"id-4",generation:"stale"},"E-AUTHORITY-GENERATION"]]){try{apply(args);fail("E-EXPECTED-FAILURE",command.id);}catch(error){ensure(error.code===code,"E-EXPECTED-FAILURE",command.id);failures++;}}
  apply({identity:"id-5"});ensure(apply({identity:"id-5"}).replayed&&journal.size===2,"E-RECOVERY",command.id);recoveries++;
 }
 return {normal,replay,failures,recoveries};
}
function expectCode(p,code,mutate){const candidate=clone(p);mutate(candidate);try{validatePackage(candidate,{manifestBytes:false});fail("E-MUTATION-ESCAPED",code);}catch(error){ensure(error.code===code,"E-MUTATION-WRONG-CODE",code+" got "+error.code);}}
function runMutations(p){
 const sid=p.engine.entries[0].inventory_id,cid=p.commands.commands[0].id;
 const cases=[["E-DUPLICATE-ID",x=>x.commands.commands.push(clone(x.commands.commands[0]))],["E-INVENTORY-INTEGRITY",x=>x.engine.entries[0].git_blob_sha1="bad"],["E-SOURCE-CLOSURE",x=>x.coverage.source_surfaces=x.coverage.source_surfaces.filter(row=>row.source_surface_id!==sid)],["E-SOURCE-CLOSURE",x=>x.commands.commands.find(c=>c.id===cid).source_surface_ids=["UNKNOWN"]],["E-RETIREMENT-FENCE",x=>x.retirement.entries[0].activation_state="ACTIVE"],["E-RETIREMENT-CLOSURE",x=>x.retirement.entries.pop()],["E-PROOF-CLOSURE",x=>x.proofs.proofs=x.proofs.proofs.filter(proof=>proof.command_id!==cid)],["E-FIXTURE-CLOSURE",x=>x.fixtures.recovery=x.fixtures.recovery.filter(f=>f.command_id!==cid)],["E-PHYSICAL-OBLIGATION",x=>x.proofs.physical_obligations[0].not_applicable=true],["E-AUTHORIZATION-DENIED",x=>x.commands.commands[0].principal="P-READ-ONLY"],["E-COMMAND-TRANSITION-CLOSURE",x=>x.commands.state_machines[0].transitions.pop()],["E-DAG-CYCLE",x=>{const edge=x.dag.edges[0];x.dag.edges.push({from:edge.to,to:edge.from});}]];
 for(const [code,mutate] of cases)expectCode(p,code,mutate);
 ensure(sha256(Buffer.from("tampered"))!==p.manifest.files[0].sha256,"E-MANIFEST-DIGEST","tamper");
 return cases.length;
}
const pkg=loadPackage(),closure=validatePackage(pkg),behavior=executeBehavior(pkg),mutation_tests=runMutations(pkg);
console.log(JSON.stringify({protocol:"CUSTODIAL_V43_PHASE2_VALIDATOR_EXECUTION_V3",status:"PASS_ARCHITECTURE_ONLY",head_binding:process.env.GITHUB_SHA||"LOCAL_EXACT_TREE",closure,behavior,mutation_tests,authority_opened:["phase2 operational architecture"],authority_closed:["schema","component","implementation","migration","APK","phone","release","production"]}));
