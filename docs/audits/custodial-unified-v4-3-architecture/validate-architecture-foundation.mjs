#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = 'docs/audits/custodial-unified-v4-3-architecture';
const P = (name) => name.startsWith('.github/') ? name : ROOT + '/' + name;
const read = (name) => {
  const path = P(name);
  if (!existsSync(path)) fail('AF_MEMBER_MISSING', path);
  return readFileSync(path);
};
const text = (name) => read(name).toString('utf8');
const json = (name) => {
  try { return JSON.parse(text(name)); }
  catch (error) { fail('AF_JSON_INVALID', name + ': ' + error.message); }
};
const clone = (value) => structuredClone(value);
const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};
const unique = (values, code) => {
  if (new Set(values).size !== values.length) fail(code, 'duplicate: ' + values.join(','));
};
const set = (items, key = 'id') => new Set(items.map((item) => item[key]));
const exact = (actual, expected, code) => {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) fail(code, 'set mismatch');
};
const sha256 = (name) => createHash('sha256').update(read(name)).digest('hex');

const contract = json('architecture-foundation-build-contract.json');
const buildSchema = json('architecture-foundation-build-contract.schema.json');
const schemas = json('foundation-artifact-schemas.json');
const registry = json('phase1-foundation-registry.json');
const dag = json('artifact-generation-dag.json');
const manifest = json('architecture-foundation-manifest.json');
const stage = json('phase1-stage-decision.json');
const coverage = json('schema-coverage-ledger.json');
const proofs = json('proof-obligation-catalog.json');
const fixtureDoc = json('fixtures/negative-fixtures.json');
const workflow = text('.github/workflows/custodial-v43-architecture-foundation.yml');

function validateSchema(value, schema, path) {
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) fail('AF_SCHEMA_INVALID', path + ' const');
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) fail('AF_SCHEMA_INVALID', path + ' enum');
  if (Array.isArray(schema.type)) {
    const ok = schema.type.some((type) => type === 'null' ? value === null : type === 'string' ? typeof value === 'string' : false);
    if (!ok) fail('AF_SCHEMA_INVALID', path + ' union type');
  } else if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('AF_SCHEMA_INVALID', path + ' object');
    for (const field of schema.required || []) if (!(field in value)) fail('AF_SCHEMA_INVALID', path + ' required ' + field);
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const field of Object.keys(value)) if (!allowed.has(field)) fail('AF_SCHEMA_INVALID', path + ' extra ' + field);
    }
    for (const [field, child] of Object.entries(schema.properties || {})) if (field in value) validateSchema(value[field], child, path + '/' + field);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('AF_SCHEMA_INVALID', path + ' array');
    if (schema.minItems !== undefined && value.length < schema.minItems) fail('AF_SCHEMA_INVALID', path + ' minItems');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail('AF_SCHEMA_INVALID', path + ' maxItems');
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) fail('AF_SCHEMA_INVALID', path + ' uniqueItems');
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, path + '/' + index));
  } else if (schema.type === 'string' && typeof value !== 'string') fail('AF_SCHEMA_INVALID', path + ' string');
  else if (schema.type === 'integer' && !Number.isInteger(value)) fail('AF_SCHEMA_INVALID', path + ' integer');
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail('AF_SCHEMA_INVALID', path + ' minLength');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail('AF_SCHEMA_INVALID', path + ' maxLength');
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) fail('AF_SCHEMA_INVALID', path + ' pattern');
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) fail('AF_SCHEMA_INVALID', path + ' date-time');
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) fail('AF_SCHEMA_INVALID', path + ' minimum');
}

const schemaClassMap = {
  architecture_objects:'architecture_object', records:'record_type_version', principals:'principal',
  credentials:'credential', sessions:'session', grants:'grant',
  authorization_decisions:'authorization_decision', service_principals:'service_principal',
  tools:'executable_tool', authority_sets:'authority_set',
  retirement_control_surfaces:'retirement_control_surface', gates_research:'gate_research_decision'
};

function assertAcyclic(items, idKey, depsKey, code) {
  const ids = set(items, idKey);
  const visiting = new Set(), done = new Set();
  const byId = new Map(items.map((item) => [item[idKey], item]));
  function visit(id) {
    if (visiting.has(id)) fail(code, id);
    if (done.has(id)) return;
    if (!ids.has(id)) fail('AF_ORPHAN_REFERENCE', id);
    visiting.add(id);
    for (const dep of byId.get(id)[depsKey] || []) visit(dep);
    visiting.delete(id); done.add(id);
  }
  for (const id of ids) visit(id);
}

function validateSnapshot(s) {
  const c=s.contract, r=s.registry, d=s.dag, m=s.manifest, p=s.proofs;
  if (c.status !== 'DRAFT_REMOTE_PHASE_1' || r.status !== 'DRAFT_REMOTE_PHASE_1') fail('AF_STATUS_INVALID', 'draft status');
  if (c.source_tuple.phase1_commit !== 'f8235b88ef178da50681789a5ebff0dbcf4df5f2' ||
      c.source_tuple.bootstrap_commit !== '58159ef9e5440d9f654f381c4eee2a875d298ee6' ||
      c.source_tuple.correction_branch !== 'agent/custodial-v43-remote-foundation-phase1-correction-20260806') fail('AF_SOURCE_TUPLE_STALE', 'source tuple');
  for (const [key,value] of Object.entries(c.authority)) {
    if (key === 'phase1_draft') { if (value !== true) fail('AF_AUTHORITY_INVALID', key); }
    else if (value !== false) fail('AF_AUTHORITY_INVALID', key);
  }

  unique(r.architecture_objects.map((x) => x.id), 'AF_DUPLICATE_OBJECT_ID');
  const objectIds = set(r.architecture_objects);
  const gateIds = set(r.gates_research);
  for (const object of r.architecture_objects) if (!gateIds.has(object.gate)) fail('AF_ORPHAN_REFERENCE', object.gate);
  for (const record of r.records) if (record.version !== 1 || record.unknown_version !== 'reject') fail('AF_UNKNOWN_RECORD_VERSION', record.id);
  const principalIds = set(r.principals);
  const serviceIds = set(r.service_principals);
  const producerIds = new Set([...principalIds, ...serviceIds]);
  for (const record of r.records) {
    for (const id of [...record.producers,...record.consumers]) {
      if (id === 'P-PUBLIC-READ' && record.producers.includes(id)) fail('AF_ANONYMOUS_WRITER', record.id);
      if (!producerIds.has(id)) fail('AF_ORPHAN_REFERENCE', id);
    }
  }

  const credentialIds = set(r.credentials);
  for (const credential of r.credentials) if (!credential.revocation) fail('AF_CREDENTIAL_REVOCATION_MISSING', credential.id);
  for (const principal of r.principals) if (!credentialIds.has(principal.credential)) fail('AF_ORPHAN_REFERENCE', principal.credential);
  for (const session of r.sessions) {
    if (!principalIds.has(session.principal) || !credentialIds.has(session.credential)) fail('AF_ORPHAN_REFERENCE', session.id);
  }
  const recordIds = set(r.records);
  const grantIds = set(r.grants);
  for (const grant of r.grants) {
    if (!principalIds.has(grant.principal)) fail('AF_ORPHAN_REFERENCE', grant.principal);
    for (const record of grant.allowed_records) if (!recordIds.has(record)) fail('AF_ORPHAN_REFERENCE', record);
  }
  const publicGrant = r.grants.find((x) => x.principal === 'P-PUBLIC-READ');
  if (!publicGrant || publicGrant.capabilities.some((x) => /write|migrat|release|admin|owner|privileg/i.test(x))) fail('AF_PUBLIC_PRIVILEGE_LEAK', 'public grant');
  const ordinary = new Set(['P-EMPLOYEE-RUNTIME','P-MANAGER-RUNTIME','P-READ-ONLY','P-MESSENGER-WORKER','P-EVENT-WORKER','P-NOTIFICATION-WORKER','P-EVIDENCE-VALIDATOR','P-MCP-READ-ONLY','P-MCP-PRIVILEGED']);
  for (const grant of r.grants) if (ordinary.has(grant.principal) && grant.capabilities.some((x) => /migrat|release|database|device.security|manager.admin/i.test(x))) fail('AF_RUNTIME_MIGRATION_AUTHORITY', grant.id);

  const generationIds=set(r.authority_sets,'generation');
  for (const decision of r.authorization_decisions) {
    if (!principalIds.has(decision.principal) || !grantIds.has(decision.grant) || !generationIds.has(decision.generation)) fail('AF_ORPHAN_REFERENCE', decision.id);
  }
  for (const sp of r.service_principals) if (!credentialIds.has(sp.credential) || !grantIds.has(sp.grant)) fail('AF_ORPHAN_REFERENCE', sp.id);
  for (const tool of r.tools) {
    if (!principalIds.has(tool.principal_class) || !credentialIds.has(tool.credential_class) || !grantIds.has(tool.grant)) fail('AF_ORPHAN_REFERENCE', tool.id);
    for (const record of tool.allowed_records) if (!recordIds.has(record)) fail('AF_ORPHAN_REFERENCE', record);
    if (tool.principal_class === 'P-PUBLIC-READ' && tool.allowed_records.some((x) => x !== 'package_manifest')) fail('AF_PUBLIC_PRIVILEGE_LEAK', tool.id);
  }
  assertAcyclic(r.authority_sets,'generation','dependencies','AF_AUTHORITY_SET_CYCLE');
  for (const a of r.authority_sets) if (a.fallback !== 'none' || a.stale_client !== 'reject' || a.mixed_generation !== 'quarantine') fail('AF_AUTHORITY_SET_FALLBACK', a.generation);

  unique(d.nodes.map((x)=>x.id),'AF_ARTIFACT_DAG_DUPLICATE');
  assertAcyclic(d.nodes,'id','inputs','AF_ARTIFACT_DAG_CYCLE');
  const outputs=d.nodes.flatMap((x)=>x.outputs);
  unique(outputs,'AF_DUPLICATE_FIELD_OWNER');
  for (const node of d.nodes) {
    if (node.generation !== 'deterministic' || node.outputs.includes(node.id)) fail('AF_ARTIFACT_OWNS_IDENTITY', node.id);
    for (const target of [...node.consumers,...node.invalidates]) if (!d.nodes.some((x)=>x.id===target)) fail('AF_ORPHAN_REFERENCE', target);
  }

  const memberPaths=m.members.map((x)=>x.path);
  unique(memberPaths,'AF_MANIFEST_MEMBER_DUPLICATE');
  if (memberPaths.includes('architecture-foundation-manifest.json')) fail('AF_MANIFEST_SELF_REFERENCE','manifest');
  if (memberPaths.includes('phase1-stage-decision.json') || memberPaths.includes('validation-result.json') || memberPaths.includes('phase1-correction-execution-manifest.json')) fail('AF_MUTABLE_STAGE_IN_CONTENT','manifest');
  for (const member of m.members) if (member.normative !== true || !member.identity_owner || !existsSync(P(member.path))) fail('AF_MEMBER_MISSING',member.path);
  if (m.stage_authority_external !== true) fail('AF_MUTABLE_STAGE_IN_CONTENT','external stage');

  const proofIds=set(p.proofs);
  for (const surface of r.retirement_control_surfaces) {
    if (surface.class === 'unknown_writer' && surface.status !== 'research_blocked') fail('AF_UNREGISTERED_WRITER',surface.id);
    if (!proofIds.has(surface.proof)) fail('AF_PROOF_OBLIGATION_MISSING',surface.proof);
  }
  for (const item of r.gates_research) if (!item.resolved && (item.failure_behavior !== 'fail_closed' || item.earliest_blocked_stage !== 'PHASE_2')) fail('AF_UNRESOLVED_GATE_NOT_BLOCKING',item.id);
  for (const proof of p.proofs) if (!gateIds.has(proof.gate)) fail('AF_ORPHAN_REFERENCE',proof.gate);

  validateSchema(c,buildSchema,'build_contract');
  for (const [collection,definition] of Object.entries(schemaClassMap)) for (const item of r[collection]) validateSchema(item,schemas.$defs[definition],collection);
  for (const item of d.nodes) validateSchema(item,schemas.$defs.artifact_dag_node,'dag');
  for (const item of m.members) validateSchema(item,schemas.$defs.content_manifest_member,'manifest');
  for (const item of p.proofs) validateSchema(item,schemas.$defs.proof_obligation,'proofs');
  validateSchema(stage,schemas.$defs.stage_decision,'stage');
}

const expectedSchemaClasses=['architecture_object','joined_cap_row','record_type_version','principal','credential','session','grant','authorization_decision','service_principal','executable_tool','authority_set','retirement_control_surface','gate_research_decision','proof_obligation','artifact_dag_node','content_manifest_member','detached_attestation','stage_decision'];
exact(Object.keys(schemas.$defs),expectedSchemaClasses,'AF_SCHEMA_CLASS_SET');
for (const [name,definition] of Object.entries(schemas.$defs)) {
  if (definition.type !== 'object' || definition.additionalProperties !== false || !Array.isArray(definition.required)) fail('AF_SCHEMA_NOT_STRICT',name);
}
validateSnapshot({contract,registry,dag,manifest,proofs});

const keywordSet=new Set(['type','additionalProperties','required','const','pattern','enum','minLength','maxLength','minimum','minItems','maxItems','uniqueItems','format']);
function constraintPaths(value,path='#',out=[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key,child] of Object.entries(value)) {
    const next=path+'/'+key;
    if (keywordSet.has(key)) {
      if (key==='required' && Array.isArray(child)) for (const field of child) out.push(next+':'+field);
      else out.push(next);
    }
    if (child && typeof child==='object') constraintPaths(child,next,out);
  }
  return out;
}
const expectedCoverage=[
  ...constraintPaths(buildSchema).map((constraint_path)=>'build_contract|'+constraint_path),
  ...constraintPaths(schemas).map((constraint_path)=>'artifact_classes|'+constraint_path)
].sort();
const actualCoverage=coverage.entries.map((x)=>x.schema+'|'+x.constraint_path).sort();
if (JSON.stringify(actualCoverage)!==JSON.stringify(expectedCoverage)) fail('AF_SCHEMA_COVERAGE_GAP','coverage');
const fixtureIds=set(fixtureDoc.fixtures);
for (const entry of coverage.entries) {
  if (entry.validator_check!=='AF_SCHEMA_EXECUTABLE' || entry.positive_fixture!=='BASELINE-VALID' || !fixtureIds.has(entry.negative_fixture)) fail('AF_SCHEMA_COVERAGE_UNEXECUTABLE',entry.constraint_path);
}

function mutate(snapshot, mutation) {
  const s=clone(snapshot);
  if (mutation==='duplicate_object_id') s.registry.architecture_objects.push(clone(s.registry.architecture_objects[0]));
  else if (mutation==='orphan_object_reference') s.registry.architecture_objects[0].gate='G-NOT-REGISTERED';
  else if (mutation==='unknown_record_type_version') s.registry.records[0].version=999;
  else if (mutation==='anonymous_writer') s.registry.records[0].producers=['P-PUBLIC-READ'];
  else if (mutation==='public_privileged_grant') s.registry.grants.find((x)=>x.principal==='P-PUBLIC-READ').capabilities.push('migrate_registered_records');
  else if (mutation==='ordinary_runtime_migration') s.registry.grants.find((x)=>x.principal==='P-EMPLOYEE-RUNTIME').capabilities.push('migrate_registered_records');
  else if (mutation==='missing_credential_revocation') s.registry.credentials[0].revocation='';
  else if (mutation==='authority_set_cycle') s.registry.authority_sets[0].dependencies=['AS-PHASE1-DRAFT'];
  else if (mutation==='artifact_dag_cycle') s.dag.nodes[0].inputs=['N-STAGE'];
  else if (mutation==='duplicate_field_owner') s.dag.nodes[1].outputs.push(s.dag.nodes[0].outputs[0]);
  else if (mutation==='self_referential_manifest') s.manifest.members.push({path:'architecture-foundation-manifest.json',role:'self',normative:true,identity_owner:'FO-CONTENT-MEMBERSHIP'});
  else if (mutation==='mutable_stage_in_content') s.manifest.members.push({path:'phase1-stage-decision.json',role:'stage',normative:true,identity_owner:'FO-STAGE-AUTHORITY'});
  else if (mutation==='stale_source_tuple') s.contract.source_tuple.phase1_commit='0000000000000000000000000000000000000000';
  else if (mutation==='unregistered_writer_surface') s.registry.retirement_control_surfaces.push({id:'CS-UNREGISTERED',class:'unknown_writer',owner:'none',writer:'anonymous',status:'active',replacement:'none',proof:'PO-WRITER-CLOSURE',failure_behavior:'block_earliest_stage'});
  else if (mutation==='unresolved_gate_without_block') s.registry.gates_research.find((x)=>!x.resolved).failure_behavior='allow';
  else if (mutation==='missing_proof_obligation') s.proofs.proofs=s.proofs.proofs.filter((x)=>x.id!=='PO-WRITER-CLOSURE');
  else fail('AF_FIXTURE_MUTATION_UNKNOWN',mutation);
  return s;
}
const baseline={contract,registry,dag,manifest,proofs};
const observed={};
for (const fixture of fixtureDoc.fixtures) {
  let code=null;
  try { validateSnapshot(mutate(baseline,fixture.mutation)); }
  catch (error) { code=error.code; }
  if (code!==fixture.expected.error_code) fail('AF_NEGATIVE_FIXTURE_MISMATCH',fixture.id+': '+code);
  observed[fixture.id]=code;
}

if (!/runs-on:\s*ubuntu-24\.04/.test(workflow) ||
    !workflow.includes('22.23.1') ||
    !/permissions:\s*\n\s*contents:\s*read/.test(workflow) ||
    /contents:\s*write|pull_request_target|upload-artifact|persist-credentials:\s*true/.test(workflow) ||
    !workflow.includes('persist-credentials: false') ||
    !workflow.includes('validate-architecture-foundation.mjs --check')) fail('AF_WORKFLOW_BOUNDARY','workflow');
const actionRefs=[...workflow.matchAll(/uses:\s*[^@\s]+@([^\s]+)/g)].map((x)=>x[1]);
if (actionRefs.some((ref)=>!/^[0-9a-f]{40}$/.test(ref))) fail('AF_WORKFLOW_ACTION_NOT_PINNED','action ref');
if (workflow.includes('BOOTSTRAP_ONLY') || workflow.includes('FOUNDATION_READY')) fail('AF_STALE_MARKER','workflow');
for (const name of ['README.md','architecture-foundation-build-contract.json','architecture-foundation-build-contract.schema.json','architecture-foundation-manifest.json','phase1-correction-execution-manifest.json','phase1-foundation-contract.md']) {
  const value=text(name);
  if (value.includes('BOOTSTRAP_ONLY') || value.includes('FOUNDATION_READY')) fail('AF_STALE_MARKER',name);
}

const checks=[
'exact_source_tuple','draft_authority_boundary','strict_schema_classes','schema_runtime_validation',
'architecture_object_closure','record_type_version_closure','principal_credential_session_closure',
'grant_authorization_closure','service_principal_tool_closure','default_deny_authority',
'public_privilege_separation','runtime_migration_separation','authority_set_acyclic',
'authority_set_fencing_and_no_fallback','artifact_dag_acyclic','one_field_owner',
'deterministic_generation','content_manifest_no_self_reference','content_stage_separation',
'gate_research_fail_closed','proof_obligation_closure','retirement_control_surface_closure',
'schema_coverage_closure','negative_fixture_exact_codes','source_status_marker_scan',
'read_only_pinned_workflow','committed_receipt_reproducibility'
];
const memberPaths=[...new Set(manifest.members.map((x)=>x.path))].sort();
const expectedReceipt={
  protocol:'CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_VALIDATION_RESULT_V2',
  status:'PASS',
  package_status:'DRAFT_REMOTE_PHASE_1',
  source_phase1_commit:'f8235b88ef178da50681789a5ebff0dbcf4df5f2',
  correction_branch:'agent/custodial-v43-remote-foundation-phase1-correction-20260806',
  counts:{
    checks:checks.length,
    schema_classes:Object.keys(schemas.$defs).length,
    schema_constraints:coverage.entries.length,
    architecture_objects:registry.architecture_objects.length,
    record_types:registry.records.length,
    principals:registry.principals.length,
    executable_tools:registry.tools.length,
    negative_fixtures:fixtureDoc.fixtures.length
  },
  checks,
  negative_fixture_results:observed,
  member_sha256:Object.fromEntries(memberPaths.map((name)=>[name,sha256(name)]))
};
const actualReceipt=json('validation-result.json');
if (JSON.stringify(actualReceipt)!==JSON.stringify(expectedReceipt)) fail('AF_VALIDATION_RESULT_STALE','committed receipt');
console.log(JSON.stringify({status:'PASS',package_status:'DRAFT_REMOTE_PHASE_1',counts:expectedReceipt.counts}));
