import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expectedCoverage, validateAgainstSchema, GENERATOR_VERSION } from "./generate-architecture-projections.mjs";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_PHASE1_VALIDATOR_V3";
const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ROOT, "../../..");
const P = (name) => resolve(name.startsWith(".github/") || name.startsWith("tools/") ? REPO : ROOT, name);
const read = (name) => readFileSync(P(name), "utf8");
const json = (name) => JSON.parse(read(name));
const clone = (value) => structuredClone(value);
const sorted = (items) => [...items].sort();
const sameSet = (a,b) => JSON.stringify(sorted(new Set(a))) === JSON.stringify(sorted(new Set(b)));
function fail(code, detail) { const error = new Error(code + ": " + detail); error.code = code; throw error; }
function unique(items, code) { if (new Set(items).size !== items.length) fail(code, "duplicate"); }
function sha256Bytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

const contract = json("architecture-foundation-build-contract.json");
const buildSchema = json("architecture-foundation-build-contract.schema.json");
const schemas = json("foundation-artifact-schemas.json");
const registry = json("phase1-foundation-registry.json");
const dag = json("artifact-generation-dag.json");
const manifest = json("architecture-foundation-manifest.json");
const proofs = json("proof-obligation-catalog.json");
const fixtures = json("fixtures/negative-fixtures.json");
const coverage = json("schema-coverage-ledger.json");
const stage = json("phase1-stage-decision.json");
const workflow = read(".github/workflows/custodial-v43-architecture-foundation.yml");
const inheritedValidator = read("tools/validate-custodial-v43-replan.mjs");
const humanTexts = [read("README.md"), read("phase1-foundation-contract.md"), read("architecture-foundation-rollback.md")];

function validateSchemas() {
  validateAgainstSchema(contract, buildSchema, buildSchema, "build_contract");
  validateAgainstSchema(registry, schemas.$defs.foundation_registry, schemas, "artifact_classes#/$defs/foundation_registry");
  for (const node of dag.nodes) validateAgainstSchema(node, schemas.$defs.artifact_node, schemas, "artifact_classes#/$defs/artifact_node");
  for (const member of manifest.members) validateAgainstSchema(member, schemas.$defs.content_manifest_member, schemas, "artifact_classes#/$defs/content_manifest_member");
  for (const proof of proofs.proofs) validateAgainstSchema(proof, schemas.$defs.proof_obligation, schemas, "artifact_classes#/$defs/proof_obligation");
  validateAgainstSchema(stage, schemas.$defs.stage_decision, schemas, "artifact_classes#/$defs/stage_decision");
  function strict(node, path="#") {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes("object") && node.additionalProperties !== false) fail("AF_SCHEMA_OBJECT_NOT_STRICT", path);
    for (const [key,value] of Object.entries(node)) strict(value, path + "/" + key);
  }
  strict(buildSchema, "build");
  strict(schemas, "artifacts");
}

function grantFor(principal, record, mode, r) {
  return r.grants.filter((g) => g.principal === principal && g[mode + "_records"].includes(record));
}
function toolFor(grant, record, r) {
  return r.tools.filter((t) => t.grant === grant.id && t.principal_class === grant.principal && t.allowed_records.includes(record));
}

const allowedGateClasses = new Set(["value-only","component-structural","schema-structural","migration-structural","release-structural","physical-only"]);
const requiredSurfaces = new Set(["anonymous_full_mcp","generic_application_sql","generic_migration_sql","schedule_writers_resolvers","pto_absence_synchronization","rolling_schedule_cron","messenger_triggered_schedule_generation","scan_alert_clearing","retention_purge_workers","event_mutation_paths","repair_rollback_writers","frontend_native_compatibility_routes","unknown_writers"]);
const expectedValidatorInputs = ["N-BUILD-CONTRACT","N-BUILD-SCHEMA","N-REGISTRY","N-ARTIFACT-SCHEMAS","N-PROOF-CATALOG","N-FOUNDATION-CONTRACT","N-NEGATIVE-FIXTURES","N-GENERATOR","N-SCHEMA-COVERAGE","N-DAG","N-MANIFEST","N-WORKFLOW","N-INHERITED-VALIDATOR","N-README","N-ROLLBACK","N-STAGE-DECISION"];

function descendants(id, by, seen=new Set()) {
  for (const child of by.get(id).consumers) if (!seen.has(child)) { seen.add(child); descendants(child, by, seen); }
  return sorted(seen);
}

function validateSemantic(s) {
  const { contract:c, registry:r, dag:d, manifest:m, proofs:p, stage:st, synthetic_git:git, detached_attestation:att, placeholder_scan } = s;
  if (c.source_tuple.accepted_governance.commit !== "569dc25c11723801a212de489dced7da776d5be7") fail("AF_SOURCE_TUPLE_STALE","governance");
  if (c.source_tuple.phase1_base.commit !== "f8235b88ef178da50681789a5ebff0dbcf4df5f2") fail("AF_SOURCE_TUPLE_STALE","base");
  if (!git.ancestry) fail("AF_GIT_ANCESTRY_INVALID","synthetic ancestry");
  if (git.changed_paths.some((path) => !path.startsWith("docs/audits/custodial-unified-v4-3-architecture/") && path !== ".github/workflows/custodial-v43-architecture-foundation.yml")) fail("AF_CHANGED_PATH_OUT_OF_SCOPE","synthetic path");
  if (/\b(?:TBD|TODO|PLACEHOLDER|AS-BASE|write_authorized_records|CRED-OIDC|CRED-MTLS|CRED-HARDWARE-MFA|validated_content_head)\b/.test(placeholder_scan)) fail("AF_PLACEHOLDER_CONTENT","forbidden marker");

  if (r.forbidden_authority.public_guest_enabled) fail("AF_PUBLIC_GUEST_ACTIVE","public guest");
  if (r.authority_set_template.activatable || r.authority_set_template.state !== "PLANNED_NON_ACTIVATABLE") fail("AF_AUTHSET_ACTIVATABLE","template");
  if (r.grants.some((g) => g.capabilities.some((x) => /generic|write_authorized_records/i.test(x)))) fail("AF_GENERIC_WRITE_CAPABILITY","grant");
  const employee = r.principals.find((x) => x.id === "P-EMPLOYEE");
  const manager = r.principals.find((x) => x.id === "P-MANAGER");
  if (employee.credential !== "CRED-EMPLOYEE-NATIVE-VAULT" || r.credentials.find((x) => x.id === employee.credential)?.class !== "enrolled_device_native_vault_key_plus_assignment_epoch") fail("AF_EMPLOYEE_CREDENTIAL_DOCTRINE","employee");
  if (manager.credential !== "CRED-MANAGER-TRUSTED-DEVICE" || !r.credentials.find((x) => x.id === manager.credential)?.class.includes("trusted_manager_device")) fail("AF_MANAGER_CREDENTIAL_DOCTRINE","manager");

  const architecture = new Set(["P-ARCHITECTURE-OWNER","P-ARCHITECTURE-VALIDATOR","P-INDEPENDENT-STAGE-AUTHORITY","P-REVIEW-READER"]);
  for (const principal of r.principals) if (architecture.has(principal.id) !== (principal.plane === "architecture_control")) fail("AF_AUTHORITY_PLANE_CONFLATION",principal.id);
  const operational = new Set(r.principals.filter((x) => x.plane === "operational_future").map((x) => x.id));
  for (const principal of r.principals) {
    if (operational.has(principal.id) && (principal.state !== "PLANNED_DENY_ALL" || principal.activatable)) fail("AF_AUTHORITY_PLANE_CONFLATION",principal.id);
  }
  const stageRecord = r.records.find((x) => x.id === "stage_decision");
  if (stageRecord.producer !== "P-INDEPENDENT-STAGE-AUTHORITY" || st.authority_principal !== "P-INDEPENDENT-STAGE-AUTHORITY") fail("AF_STAGE_AUTHORITY_VIOLATION","stage producer");
  if (r.grants.some((g) => g.principal === "P-ARCHITECTURE-VALIDATOR" && g.write_records.includes("stage_decision"))) fail("AF_VALIDATOR_SELF_GRANT","validator stage grant");
  if (r.grants.some((g) => g.principal === "P-READ-ONLY" && g.write_records.length)) fail("AF_READ_ONLY_WRITER","Read Only");
  if (r.grants.some((g) => g.principal === "P-MCP-READ-ONLY" && g.write_records.length)) fail("AF_MCP_READ_ONLY_WRITER","MCP read-only");
  if (r.tools.some((t) => operational.has(t.principal_class) && /migrat|restore|release|database|device-security|manager-admin/i.test(t.endpoint + " " + t.side_effect_class))) fail("AF_RUNTIME_PRIVILEGED_TOOL","operational tool");
  if (r.grants.some((g) => operational.has(g.principal)) || r.tools.some((t) => operational.has(t.principal_class))) fail("AF_AUTHORITY_PLANE_CONFLATION","operational grant/tool active");

  const recordIds = new Set(r.records.map((x) => x.id));
  unique([...recordIds],"AF_RECORD_DUPLICATE");
  const semanticTuples = r.records.map((x) => [x.resolver,x.aggregate_order,x.retention,x.migration,x.retirement,x.authorization_rule,x.transaction_boundary,x.failure_outcome].join("|"));
  unique(semanticTuples,"AF_RECORD_TEMPLATE_DUPLICATE");
  for (const g of r.grants) {
    for (const id of [...g.read_records,...g.write_records]) if (!recordIds.has(id)) fail("AF_GRANT_TOOL_MISMATCH",g.id + ":" + id);
    const tool = r.tools.find((t) => t.grant === g.id);
    if (!tool || !sameSet(tool.allowed_records,[...g.read_records,...g.write_records])) fail("AF_GRANT_TOOL_MISMATCH",g.id);
  }
  for (const t of r.tools) {
    const g = r.grants.find((x) => x.id === t.grant);
    if (!g || g.principal !== t.principal_class || !sameSet(t.allowed_records,[...g.read_records,...g.write_records])) fail("AF_GRANT_TOOL_MISMATCH",t.id);
  }
  for (const rec of r.records) {
    const writes = grantFor(rec.producer,rec.id,"write",r).filter((g) => toolFor(g,rec.id,r).length === 1);
    if (writes.length !== 1) fail("AF_UNAUTHORIZED_PRODUCER",rec.id);
    for (const consumer of rec.consumers) {
      const reads = grantFor(consumer,rec.id,"read",r).filter((g) => toolFor(g,rec.id,r).length === 1);
      if (reads.length !== 1) fail("AF_UNAUTHORIZED_CONSUMER",rec.id + ":" + consumer);
    }
  }

  for (const gate of r.gates_research) {
    if (!allowedGateClasses.has(gate.classification)) fail("AF_GATE_CLASS_INVALID",gate.id);
    if (!gate.earliest_blocked_stage || gate.failure_behavior !== "fail_closed" || gate.resolved) fail("AF_GATE_NOT_BLOCKING",gate.id);
  }
  const surfaceClasses = new Set(r.retirement_control_surfaces.map((x) => x.class));
  for (const required of requiredSurfaces) if (!surfaceClasses.has(required)) fail("AF_RETIREMENT_INCOMPLETE",required);
  const unknown = r.retirement_control_surfaces.find((x) => x.class === "unknown_writers");
  if (!unknown || unknown.status !== "research_blocked" || unknown.failure_behavior !== "block_earliest_stage") fail("AF_UNKNOWN_WRITER_NOT_BLOCKED","unknown writer");

  const proofIds = new Set(p.proofs.map((x) => x.id));
  const gateIds = new Set(r.gates_research.map((x) => x.id));
  for (const object of r.architecture_objects) {
    for (const id of object.proof_ids) if (!proofIds.has(id)) fail("AF_PROOF_MISSING",object.id + ":" + id);
    for (const id of object.gate_ids) if (!gateIds.has(id)) fail("AF_GATE_REFERENCE_MISSING",object.id + ":" + id);
    if (typeof object.physical_proof.required !== "boolean" || !object.physical_proof.reason) fail("AF_PHYSICAL_PROOF_FAKE",object.id);
  }
  for (const proof of p.proofs) if (!gateIds.has(proof.gate)) fail("AF_GATE_REFERENCE_MISSING",proof.id);

  const by = new Map(d.nodes.map((x) => [x.id,x]));
  unique([...by.keys()],"AF_ARTIFACT_NODE_DUPLICATE");
  const paths = d.nodes.map((x) => x.path);
  unique(paths,"AF_ARTIFACT_PATH_DUPLICATE");
  for (const node of d.nodes) {
    for (const input of node.inputs) if (!by.has(input)) fail("AF_ARTIFACT_REFERENCE_MISSING",node.id + ":" + input);
    const inverse = d.nodes.filter((x) => x.inputs.includes(node.id)).map((x) => x.id);
    if (!sameSet(node.consumers,inverse)) fail("AF_ARTIFACT_INVERSE_MISMATCH",node.id);
    if (!sameSet(node.invalidates,descendants(node.id,by))) fail("AF_ARTIFACT_INVALIDATION_MISMATCH",node.id);
    if (node.invalidates.includes(node.id)) fail("AF_ARTIFACT_CYCLE",node.id);
    if (node.kind === "generated_projection") {
      if (!node.generator.registered || !node.generator.path || !node.generator.version || !node.generator.command) fail("AF_GENERATOR_MISSING",node.id);
      const generatorNode = d.nodes.find((x) => x.path === node.generator.path);
      const actualInputs = node.inputs.filter((id) => id !== generatorNode?.id).map((id) => by.get(id).path);
      if (!sameSet(node.generator.input_paths,actualInputs) || node.generator.output_path !== node.path) fail("AF_GENERATOR_INPUT_MISMATCH",node.id);
    } else if (node.generator.registered || [node.generator.path,node.generator.version,node.generator.command,node.generator.output_path,node.generator.byte_reproduction].some((x) => x !== null) || node.generator.input_paths.length) fail("AF_FALSE_GENERATED_CLAIM",node.id);
  }
  if (!sameSet(by.get("N-VALIDATOR").inputs,expectedValidatorInputs)) fail("AF_VALIDATOR_DEPENDENCY_INCOMPLETE","validator inputs");
  const memberPaths = m.members.map((x) => x.path);
  unique(memberPaths,"AF_MANIFEST_MEMBER_DUPLICATE");
  if (memberPaths.includes("architecture-foundation-manifest.json") || memberPaths.includes("phase1-stage-decision.json") || memberPaths.includes("validation-result.json")) fail("AF_MANIFEST_SELF_REFERENCE","manifest");
  for (const member of m.members) {
    const node = d.nodes.find((x) => x.path === member.path);
    if (!node || node.kind !== member.kind || !existsSync(P(member.path))) fail("AF_MANIFEST_MEMBER_INVALID",member.path);
  }
  if (att.content_digest !== att.expected_digest) fail("AF_DETACHED_ATTESTATION_STALE","digest");
}

function mutate(snapshot, name) {
  const s = clone(snapshot), r=s.registry;
  const addOperationalTool = (cap) => r.tools.push({id:"TOOL-BAD-"+cap.toUpperCase(),principal_class:"P-APP-WORKER",credential_class:"CRED-OPERATIONAL-UNRESOLVED",grant:"G-BAD",mode:"write",allowed_records:["stage_decision"],endpoint:"custodial://"+cap,side_effect_class:cap,failure_behavior:"deny",activatable:true});
  if (name === "unauthorized_producer") r.records[0].producer="P-REVIEW-READER";
  else if (name === "unauthorized_consumer") r.records[0].consumers.push("P-EMPLOYEE");
  else if (name === "read_only_writer") r.grants.push({id:"G-BAD-RO",principal:"P-READ-ONLY",state:"ACTIVE_DRAFT",read_records:[],write_records:["stage_decision"],capabilities:["write"],resource_scope:"bad",confirmation:"none",revocation:"bad",activatable:true});
  else if (name === "mcp_read_only_writer") r.grants.push({id:"G-BAD-MCP",principal:"P-MCP-READ-ONLY",state:"ACTIVE_DRAFT",read_records:[],write_records:["stage_decision"],capabilities:["write"],resource_scope:"bad",confirmation:"none",revocation:"bad",activatable:true});
  else if (name === "wrong_employee_credential") r.principals.find((x)=>x.id==="P-EMPLOYEE").credential="CRED-OPERATIONAL-UNRESOLVED";
  else if (name === "stage_decision_by_validator") r.records.find((x)=>x.id==="stage_decision").producer="P-ARCHITECTURE-VALIDATOR";
  else if (name === "stage_decision_by_runtime") r.records.find((x)=>x.id==="stage_decision").producer="P-APP-WORKER";
  else if (name === "runtime_migration_tool") addOperationalTool("migration");
  else if (name === "runtime_restore_tool") addOperationalTool("restore");
  else if (name === "runtime_release_tool") addOperationalTool("release");
  else if (name === "wrong_governance_commit") s.contract.source_tuple.accepted_governance.commit="0000000000000000000000000000000000000000";
  else if (name === "wrong_base_commit") s.contract.source_tuple.phase1_base.commit="0000000000000000000000000000000000000000";
  else if (name === "broken_ancestry") s.synthetic_git.ancestry=false;
  else if (name === "changed_path_outside_scope") s.synthetic_git.changed_paths.push("src/runtime-forbidden.js");
  else if (name === "unclassified_gate") r.gates_research[0].classification="structural";
  else if (name === "placeholder_content") s.placeholder_scan += "\nTBD";
  else if (name === "artifact_inverse_mismatch") s.dag.nodes.find((x)=>x.consumers.length).consumers.pop();
  else if (name === "claimed_generated_without_generator") { const n=s.dag.nodes.find((x)=>x.kind==="generated_projection"); n.generator.registered=false; n.generator.path=null; }
  else if (name === "stale_detached_attestation") s.detached_attestation.content_digest="stale";
  else if (name === "grant_tool_record_mismatch") r.tools[0].allowed_records.pop();
  else if (name === "architecture_operational_conflation") { const p=r.principals.find((x)=>x.id==="P-EMPLOYEE"); p.plane="architecture_control"; p.activatable=true; }
  else if (name === "authority_template_activatable") r.authority_set_template.activatable=true;
  else if (name === "generic_write_capability") r.grants[0].capabilities.push("write_authorized_records");
  else if (name === "unknown_writer_not_blocked") r.retirement_control_surfaces.find((x)=>x.class==="unknown_writers").status="active";
  else if (name === "validator_stage_grant") r.grants.find((x)=>x.principal==="P-ARCHITECTURE-VALIDATOR").write_records.push("stage_decision");
  else if (name === "public_guest_active") r.forbidden_authority.public_guest_enabled=true;
  else fail("AF_FIXTURE_MUTATION_UNKNOWN",name);
  return s;
}

function runSemanticFixtures(base) {
  const observed={};
  validateSemantic(base);
  for (const fixture of fixtures.fixtures) {
    let code=null;
    try { validateSemantic(mutate(base,fixture.mutation)); } catch (error) { code=error.code; }
    if (code !== fixture.expected.error_code) fail("AF_SEMANTIC_FIXTURE_MISMATCH",fixture.id + ":" + code);
    observed[fixture.id]=code;
  }
  return observed;
}

function verifyWorkflow() {
  if (!/runs-on:\s*ubuntu-24\.04/.test(workflow) || !workflow.includes("22.23.1")) fail("AF_WORKFLOW_RUNTIME","pin");
  if (!/permissions:\s*\n\s*contents:\s*read/.test(workflow) || /contents:\s*write|pull_request_target|upload-artifact|persist-credentials:\s*true/.test(workflow)) fail("AF_WORKFLOW_BOUNDARY","permissions");
  if (!workflow.includes("fetch-depth: 0") || !workflow.includes("persist-credentials: false")) fail("AF_WORKFLOW_SOURCE_DEPTH","checkout");
  for (const command of ["tools/validate-custodial-v43-replan.mjs --check","generate-architecture-projections.mjs --check","validate-architecture-foundation.mjs --check"]) if (!workflow.includes(command)) fail("AF_WORKFLOW_COMMAND_MISSING",command);
  const refs=[...workflow.matchAll(/uses:\s*[^@\s]+@([^\s]+)/g)].map((x)=>x[1]);
  if (refs.some((x)=>!/^[0-9a-f]{40}$/.test(x))) fail("AF_WORKFLOW_ACTION_NOT_PINNED","action");
  if (!inheritedValidator.includes("G-EXACT-RELEASE-RESTORE") || !inheritedValidator.includes("H05")) fail("AF_INHERITED_VALIDATOR_STALE","v4.3.2");
}

function git(...args) {
  const out=spawnSync("git",args,{cwd:REPO,encoding:"utf8"});
  if (out.status !== 0) fail("AF_GIT_COMMAND_FAILED",args.join(" "));
  return out.stdout.trim();
}
function verifyGitBoundary() {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const expectedBranch=contract.source_tuple.correction.branch;
  if (process.env.GITHUB_REF_NAME !== expectedBranch) fail("AF_GIT_BRANCH_INVALID",process.env.GITHUB_REF_NAME);
  const head=git("rev-parse","HEAD");
  if (process.env.GITHUB_SHA !== head) fail("AF_GIT_HEAD_INVALID",head);
  const review=contract.source_tuple.correction.immutable_review_head, base=contract.source_tuple.phase1_base.commit;
  for (const commit of [review,base,contract.source_tuple.accepted_governance.commit]) git("cat-file","-e",commit+"^{commit}");
  if (spawnSync("git",["merge-base","--is-ancestor",base,review],{cwd:REPO}).status!==0 || spawnSync("git",["merge-base","--is-ancestor",review,head],{cwd:REPO}).status!==0) fail("AF_GIT_ANCESTRY_INVALID",head);
  const baseRef="refs/remotes/origin/"+contract.source_tuple.phase1_base.branch;
  if (git("rev-parse",baseRef)!==base) fail("AF_GIT_BASE_REF_INVALID",baseRef);
  const paths=git("diff","--name-only",review+".."+head).split("\n").filter(Boolean);
  for (const path of paths) if (!path.startsWith("docs/audits/custodial-unified-v4-3-architecture/") && path!==".github/workflows/custodial-v43-architecture-foundation.yml") fail("AF_CHANGED_PATH_OUT_OF_SCOPE",path);
}

validateSchemas();
const expectedCoverageDoc=expectedCoverage();
if (JSON.stringify(coverage)!==JSON.stringify(expectedCoverageDoc)) fail("AF_SCHEMA_COVERAGE_PROJECTION_STALE","coverage");
verifyWorkflow();
verifyGitBoundary();
const placeholderScan=[JSON.stringify(contract),JSON.stringify(registry),JSON.stringify(dag),JSON.stringify(manifest),JSON.stringify(proofs),...humanTexts].join("\n");
const base={contract,registry,dag,manifest,proofs,stage,synthetic_git:{ancestry:true,changed_paths:[]},detached_attestation:{content_digest:"CURRENT",expected_digest:"CURRENT"},placeholder_scan:placeholderScan};
const semanticResults=runSemanticFixtures(base);
const checks=["strict_schema_runtime","direct_schema_mutations","source_tuple_and_git_boundary","authority_plane_separation","credential_doctrine","stage_validator_separation","record_contract_distinctness","producer_consumer_grant_tool_closure","authority_set_non_activatable","gate_classification","retirement_surface_closure","artifact_inverse_and_generation","manifest_content_boundary","semantic_negative_matrix","inherited_v432_workflow"];
const expectedReceipt={protocol:"CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_VALIDATION_RESULT_V3",validator:VALIDATOR_VERSION,generator:GENERATOR_VERSION,status:"PASS",package_status:"DRAFT_REMOTE_PHASE_1",source_review_head:contract.source_tuple.correction.immutable_review_head,correction_branch:contract.source_tuple.correction.branch,counts:{checks:checks.length,direct_schema_mutations:coverage.entries.length,semantic_negative_fixtures:fixtures.fixtures.length,architecture_objects:registry.architecture_objects.length,record_contracts:registry.records.length,principals:registry.principals.length,grants:registry.grants.length,tools:registry.tools.length,gates_research:registry.gates_research.length,retirement_surfaces:registry.retirement_control_surfaces.length},checks,semantic_negative_results:semanticResults,authority:{architecture_approved:false,phase2_authorized:false,operational_generation_active:false,next_gate:"second independent Programmer 1 Phase-1 review"}};
const mode=process.argv[2]??"--check";
if(mode==="--write-receipt")writeFileSync(P("validation-result.json"),JSON.stringify(expectedReceipt,null,2)+"\n");
else if(mode==="--check"){if(JSON.stringify(json("validation-result.json"))!==JSON.stringify(expectedReceipt))fail("AF_VALIDATION_RESULT_STALE","receipt");}
else fail("AF_ARGUMENT_INVALID",mode);
console.log(JSON.stringify({status:"PASS",validator:VALIDATOR_VERSION,counts:expectedReceipt.counts}));
