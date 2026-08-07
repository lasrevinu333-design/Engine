import fs from "node:fs";
import path from "node:path";
const here=path.dirname(new URL(import.meta.url).pathname);
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name),"utf8"));
const ensure=(ok,code)=>{if(!ok)throw new Error(code);};
const result=read("phase2-validation-result.json");
const review=read("phase2-post-build-independent-review.json");
const stage=read("phase2-stage-decision.json");
const commands=read("phase2-command-record-state-machine-registry.json");
const engine=read("phase2-engine-authority-surface-inventory.json");
const backend=read("phase2-backend-authority-surface-inventory.json");
const retirement=read("phase2-writer-resolver-trigger-cron-api-tool-retirement-registry.json");
const fixtures=read("phase2-conformance-fixtures.json");
const proofs=read("phase2-proof-gate-and-physical-obligation-registry.json");
const commandCount=commands.commands.length;
const expected={
 commands:commandCount,
 state_machines:commands.state_machines.length,
 transitions:commands.state_machines.reduce((count,machine)=>count+machine.transitions.length,0),
 surfaces:engine.entries.length+backend.entries.length,
 retirements:retirement.entries.length,
 proofs:proofs.proofs.length,
 fixtures:Object.values(fixtures).filter(Array.isArray).reduce((count,array)=>count+array.length,0),
 normal:commandCount,replay:commandCount,failures:commandCount*4,recoveries:commandCount,
 mutation_tests:fixtures.adversarial.length
};
ensure(result.status==="PASS_ARCHITECTURE_ONLY","E-RESULT-STATUS");
for(const [key,value] of Object.entries(expected))ensure(result.counts[key]===value,"E-RESULT-COUNT-"+key);
ensure(review.status==="ACCEPT_ARCHITECTURE_ONLY","E-REVIEW-STATUS");
ensure(review.audit.severity_counts.blocker===0&&review.audit.severity_counts.high===0&&review.audit.findings.length===0,"E-REVIEW-FINDINGS");
ensure(stage.status==="PASS_ARCHITECTURE_ONLY","E-STAGE-STATUS");
ensure(stage.authority_opened.length===1&&stage.authority_opened[0]==="phase2 operational architecture","E-STAGE-AUTHORITY");
ensure(["schema","component","implementation","migration","APK","phone","release","production"].every(value=>stage.authority_closed.includes(value)),"E-DOWNSTREAM-AUTHORITY");
ensure(proofs.physical_obligations.every(item=>item.required&&!item.not_applicable),"E-PHYSICAL-OBLIGATION");
console.log(JSON.stringify({protocol:"CUSTODIAL_V43_PHASE2_REVIEW_VALIDATION_V1",status:"PASS_ARCHITECTURE_ONLY",head_binding:process.env.GITHUB_SHA||"LOCAL_EXACT_TREE",expected}));
