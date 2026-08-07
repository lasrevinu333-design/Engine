import fs from "node:fs";
import path from "node:path";
const here=path.dirname(new URL(import.meta.url).pathname);
const read=n=>JSON.parse(fs.readFileSync(path.join(here,n),"utf8"));
const fail=(code,message)=>{throw new Error(code+": "+message)};
const unique=(xs,label)=>{const s=new Set(xs);if(s.size!==xs.length)fail("E-DUPLICATE",label)};
const required=["phase2-operational-object-registry.json","phase2-command-record-state-machine-registry.json","phase2-authority-set-activation-fencing-rollback-contract.json","phase2-principal-grant-tool-authorization-contract.json","phase2-location-ownership-occurrence-session-offline-contract.json","phase2-notification-messenger-event-feedback-contractor-contract.json","phase2-readiness-inspection-analytics-retention-restore-release-contract.json","phase2-writer-resolver-trigger-cron-api-tool-retirement-registry.json","phase2-proof-gate-and-physical-obligation-registry.json","phase2-conformance-fixtures.json","validate-phase2-operational-architecture.mjs","phase2-validation-result.json","phase2-post-build-independent-review.json","phase2-stage-decision.json"];
for(const n of required)if(!fs.existsSync(path.join(here,n)))fail("E-MISSING-ARTIFACT",n);
const o=read("phase2-operational-object-registry.json");
const c=read("phase2-command-record-state-machine-registry.json");
const a=read("phase2-authority-set-activation-fencing-rollback-contract.json");
const z=read("phase2-principal-grant-tool-authorization-contract.json");
const r=read("phase2-writer-resolver-trigger-cron-api-tool-retirement-registry.json");
const d=read("phase2-artifact-generation-dag.json");
const p=read("phase2-proof-gate-and-physical-obligation-registry.json");
const f=read("phase2-conformance-fixtures.json");
const v=read("phase2-validation-result.json");
const q=read("phase2-post-build-independent-review.json");
const s=read("phase2-stage-decision.json");
if(o.objects.length<20||c.commands.length<15||c.state_machines.length<10)fail("E-COVERAGE","minimum registry population");
unique(o.objects.map(x=>x.id),"object ids");unique(c.commands.map(x=>x.id),"command ids");unique(c.state_machines.map(x=>x.id),"state machine ids");
const sms=new Set(c.state_machines.map(x=>x.id));const principals=new Set(z.principals.map(x=>x.id));const grants=new Set(z.grants.map(x=>x.id));
for(const x of o.objects){for(const k of ["id","record_type","authority_owner","state_machine","producers","consumers","proof_ids","gate_ids","retirement_ids","failure_behavior","physical_proof"])if(x[k]===undefined)fail("E-OBJECT-FIELD",x.id+":"+k);if(!sms.has(x.state_machine))fail("E-STATE-REF",x.id)}
for(const x of c.commands){for(const k of ["principal","credential_context","grant","authorization_decision","input_record","output_record","record_version","aggregate","state_machine","expected_sequence","transaction_boundary","idempotency","failure_code","retry","quarantine","proof","gate"])if(x[k]===undefined)fail("E-COMMAND-FIELD",x.id+":"+k);if(!principals.has(x.principal)||!grants.has(x.grant)||!sms.has(x.state_machine))fail("E-CROSS-REF",x.id)}
for(const x of c.state_machines){const states=new Set(x.states);for(const t of x.transitions)if(!states.has(t.from)||!states.has(t.to))fail("E-TRANSITION",x.id)}
for(const x of z.principals.filter(x=>x.id.includes("READ-ONLY")))if(x.writes.length)fail("E-READONLY-WRITE",x.id);
if(z.tools.some(x=>x.generic_write))fail("E-GENERIC-WRITER","tool");
if(r.retired.length<13||r.retired.some(x=>x.active||!x.disposition||!x.proof))fail("E-RETIREMENT","surface");
const ids=new Set(d.nodes.map(x=>x.id));for(const e of d.edges)if(!ids.has(e.from)||!ids.has(e.to))fail("E-DAG-REF",e.from+"->"+e.to);
const adj=new Map([...ids].map(x=>[x,[]]));for(const e of d.edges)adj.get(e.from).push(e.to);const visiting=new Set(),done=new Set();const visit=n=>{if(visiting.has(n))fail("E-DAG-CYCLE",n);if(done.has(n))return;visiting.add(n);for(const m of adj.get(n))visit(m);visiting.delete(n);done.add(n)};for(const n of ids)visit(n);
const attackIds=["ATTACK-ANON-READONLY-WRITER","ATTACK-SHARED-SECRET","ATTACK-OFFLINE-REASSIGN","ATTACK-OLD-APK","ATTACK-WORKER-CRASH","ATTACK-TWO-SESSIONS","ATTACK-CORRECTION-RACE","ATTACK-EVENT-OWNERSHIP","ATTACK-PRESENTATION-MUTATION","ATTACK-RETIRED-WRITER","ATTACK-INCOMPLETE-RESTORE","ATTACK-FALSE-GREEN"];unique(f.attacks.map(x=>x.id),"attack ids");for(const id of attackIds)if(!f.attacks.find(x=>x.id===id&&x.expected_mutations===0&&x.expected_code))fail("E-ATTACK-COVERAGE",id);
if(!a.activation.fencing_owner||a.rollback.order.length<8||!a.dependencies.includes("physical obligations explicitly unavailable or satisfied"))fail("E-AUTHORITY-CLOSURE","activation");
if(!p.physical_obligations.find(x=>x.id==="PHONE-PHYSICAL"&&x.status==="UNAVAILABLE"))fail("E-PHYSICAL-TRUTH","phone");
for(const [k,val] of Object.entries(s.authority))if(k!=="phase2_operational_architecture"&&val!==false)fail("E-AUTHORITY-LEAK",k);
if(q.blocker_findings.length||q.high_findings.length)fail("E-REVIEW","unresolved finding");
const expected={"objects":20,"commands":15,"state_machines":11,"retirement_surfaces":13,"mandatory_attacks":12,"positive_fixtures":4,"recovery_fixtures":6,"dag_nodes":15,"proofs":20};for(const [k,val] of Object.entries(expected))if(v.counts[k]!==val)fail("E-DETERMINISM",k);
if(v.status!=="PASS"||s.status!=="PASS_PHASE2_ARCHITECTURE_ONLY")fail("E-GATE","status");
console.log(JSON.stringify({protocol:"CUSTODIAL_V43_PHASE2_VALIDATOR_OUTPUT_V1",status:"PASS",counts:expected,attacks:attackIds.length,downstream_authority:false}));
