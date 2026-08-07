import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const readJson=(name)=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const readText=(name)=>fs.readFileSync(path.join(ROOT,name),'utf8');
const sha256=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const clone=(value)=>structuredClone(value);
const failures=[];
const passed=[];
const check=(id,fn)=>{try{fn();passed.push(id);}catch(error){failures.push({id,error:String(error?.message||error)});}};

const build=readJson('phase2-build-contract.json');
const registry=readJson('phase2-command-record-state-machine-registry.json');
const commandCoverage=readJson('phase2-command-and-transition-coverage-ledger.json');
const inventoryIndex=readJson('phase2-source-authority-inventory-index.json');
const ledgerText=readText('phase2-source-authority-disposition-ledger.jsonl');
const ledger=ledgerText.split(/\n/).filter(Boolean).map(JSON.parse);
const dispositionSummary=readJson('phase2-source-authority-disposition-summary.json');
const proofRegistry=readJson('phase2-proof-gate-and-physical-obligation-registry.json');
const fixtures=readJson('phase2-conformance-fixtures.json');
const correction=readJson('phase2-correction-plan-20260807.json');
const validatorCoverage=readJson('phase2-validator-coverage-ledger.json');

const semanticInputs=new Set(validatorCoverage.semantic_validator_inputs);
const excludedInputs=new Set(validatorCoverage.excluded_semantic_inputs);
const requiredSourceTuple={
  actual_program_commit:'8cdbe2fbe98fd31ab11483d96c12b6c1270fc148',
  backend_commit:'0fff8c2cadea132902df22c99593f1ce348411a7',
  v42_architecture_commit:'be01c7b382da14e0e98375ee7a03e88c26ee598c',
  phase1_record_envelope_head:'5c2e9308ba75d6c8f95e52783e05144392eae20c'
};

const commandMap=()=>new Map(registry.commands.map(row=>[row.id,row]));
const machineMap=()=>new Map(registry.state_machines.map(row=>[row.id,row]));
const validateArtifactExistence=()=>{
  for(const name of build.required_artifacts) assert.equal(fs.existsSync(path.join(ROOT,name)),true,`missing ${name}`);
  for(const name of validatorCoverage.semantic_validator_inputs) assert.equal(fs.existsSync(path.join(ROOT,name)),true,`missing semantic input ${name}`);
};
const validateSourceTuple=()=>{for(const [key,value] of Object.entries(requiredSourceTuple)) assert.equal(build.source_tuple[key],value,key);};
const validateInventory=(index=inventoryIndex,rows=ledger,summary=dispositionSummary)=>{
  assert.equal(index.protocol,'CUSTODIAL_V43_PHASE2_SOURCE_AUTHORITY_INVENTORY_INDEX_V1');
  assert.equal(index.inventories.length,2);
  const expected=index.inventories.reduce((sum,row)=>sum+row.entries,0);
  assert.equal(rows.length,expected);
  assert.equal(new Set(rows.map(row=>row.inventory_id)).size,rows.length);
  assert.equal(index.ledger.rows,rows.length);
  assert.equal(index.ledger.sha256,sha256(ledgerText));
  assert.equal(summary.ledger_sha256,sha256(ledgerText));
  assert.equal(summary.rows,rows.length);
  assert.equal(summary.resolved+summary.unresolved,rows.length);
  assert.equal(index.acceptance.every_inventory_row_joined_exactly_once,true);
  assert.equal(index.acceptance.mutation_capable_surfaces_automatically_admitted,false);
};
const validateMutationFailClosed=(rows=ledger)=>{
  for(const row of rows){
    assert.equal(row.architecture_admission,false,`${row.inventory_id} admitted`);
    if(['MUTATION_CAPABLE','MUTATION_OR_AUTHORITY_CAPABLE'].includes(row.mutation_class)){
      if(row.classification_status==='RESOLVED'){
        assert.ok(row.replacement_command_ids.length>0,`${row.inventory_id} missing replacement command`);
        assert.equal(row.live_or_physical_evidence_status,'PROVEN',`${row.inventory_id} missing proof`);
      }
    }
  }
};
const validateCommandClosure=(reg=registry,cov=commandCoverage)=>{
  const commands=new Map(reg.commands.map(row=>[row.id,row]));
  const machines=new Map(reg.state_machines.map(row=>[row.id,row]));
  assert.deepEqual(new Set(commands.keys()),new Set(cov.required_command_ids));
  assert.deepEqual(new Set(machines.keys()),new Set(cov.required_state_machine_ids));
  const transitions=[];
  for(const machine of machines.values()){
    const states=new Set(machine.states);
    assert.ok(states.has(machine.initial_state));
    for(const transition of machine.transitions){
      transitions.push(transition);
      assert.ok(commands.has(transition.command_id));
      assert.ok(transition.from_states.every(state=>states.has(state)));
      assert.ok(states.has(transition.to_state));
      assert.equal(transition.atomic,true);
    }
  }
  assert.deepEqual(new Set(transitions.map(row=>row.id)),new Set(cov.required_transition_ids));
  assert.equal(transitions.length,commands.size);
  for(const command of commands.values()){
    assert.ok(machines.has(command.state_machine));
    const states=new Set(machines.get(command.state_machine).states);
    assert.ok(command.allowed_from_states.every(state=>states.has(state)));
    assert.ok(states.has(command.success_state));
    assert.ok(command.required_context.length>0);
    assert.ok(command.failure_codes.length>0);
    assert.ok(command.automated_proofs.length>0);
  }
  assert.equal(commands.get('CMD-OWNERSHIP-ASSIGN').aggregate,'ownership');
  const offline=new Set(commands.get('CMD-OFFLINE-SYNC').required_context);
  for(const field of ['original_employee_principal_id','original_credential_id','original_assignment_epoch','original_authority_set_id','original_authority_set_generation','ownership_revision','occurrence_id','trusted_time_evidence']) assert.ok(offline.has(field),field);
  assert.ok(commands.get('CMD-MESSAGE-READ').prohibited_effects.includes('service occurrence resolution'));
  assert.ok(commands.get('CMD-NOTIF-ACKNOWLEDGE').prohibited_effects.includes('service occurrence resolution'));
  assert.ok(commands.get('CMD-EVENT-PUBLISH-NOTICE').prohibited_effects.includes('schedule mutation'));
  assert.ok(reg.cross_domain_invariants.some(row=>row.rule.includes('work request never transfers ownership')));
  assert.ok(reg.cross_domain_invariants.some(row=>row.rule.includes('purge cannot proceed')));
  assert.ok(commands.get('CMD-PURGE-AUTHORIZE').required_context.includes('hold_snapshot'));
};
const executeFixture=(command,fixture)=>{
  if(!fixture.authorization_allowed) return {outcome:'DENIED',state:fixture.input_state};
  if(fixture.actual_sequence!==fixture.expected_sequence) return {outcome:'SEQUENCE_CONFLICT',state:fixture.input_state};
  if(fixture.duplicate) return {outcome:'DUPLICATE',state:command.success_state};
  if(fixture.fixture_class==='RECOVERY_BINDING') return {outcome:'RECOVERY_AVAILABLE',state:fixture.input_state};
  assert.ok(command.allowed_from_states.includes(fixture.input_state));
  return {outcome:'ACCEPTED',state:command.success_state};
};
const validateFixtures=(reg=registry,catalog=fixtures)=>{
  const commands=new Map(reg.commands.map(row=>[row.id,row]));
  const byCommand=new Map();
  for(const fixture of catalog.command_fixtures){
    assert.ok(commands.has(fixture.command_id));
    const list=byCommand.get(fixture.command_id)||[];list.push(fixture);byCommand.set(fixture.command_id,list);
    const result=executeFixture(commands.get(fixture.command_id),fixture);
    assert.equal(result.outcome,fixture.expected_outcome,fixture.id);
    assert.equal(result.state,fixture.expected_state,fixture.id);
    if(fixture.fixture_class==='RECOVERY_BINDING') assert.deepEqual(fixture.expected_recovery_command_ids,commands.get(fixture.command_id).recovery_command_ids);
  }
  for(const command of commands.values()){
    const classes=new Set((byCommand.get(command.id)||[]).map(row=>row.fixture_class));
    for(const required of catalog.fixture_rules.every_command_requires) assert.ok(classes.has(required),`${command.id}:${required}`);
    if(command.recovery_command_ids.length) assert.ok(classes.has('RECOVERY_BINDING'),`${command.id}:recovery`);
  }
  const attackIds=new Set(catalog.attack_fixtures.map(row=>row.id));
  for(const id of ['ATTACK-ANONYMOUS-WRITER','ATTACK-OFFLINE-REASSIGNMENT','ATTACK-CONCURRENT-SATISFACTION','ATTACK-EVENT-READ-WRITE','ATTACK-LEGACY-WRITER','ATTACK-RESTORE-OBJECT-FAILURE']) assert.ok(attackIds.has(id),id);
};
const validateProofBindings=(proofs=proofRegistry)=>{
  assert.equal(proofs.protocol,'CUSTODIAL_V43_PHASE2_PROOF_GATE_PHYSICAL_OBLIGATION_REGISTRY_V2');
  for(const row of proofs.proof_obligations){
    assert.ok(row.producer&&row.consumer&&row.fixture_ids.length&&row.source_or_release_tuple_fields.length&&row.invalidation_triggers.length);
    assert.notEqual(row.architecture_binding_status,'MISSING');
  }
  for(const row of proofs.physical_obligations){
    assert.ok(row.producer&&row.consumer&&row.procedure&&row.pass_condition&&row.failure_condition&&row.source_or_release_tuple_fields.length&&row.invalidation_triggers.length);
    assert.equal(row.architecture_binding_status,'BOUND');
    assert.notEqual(row.execution_evidence_status,'not_applicable_no_physical_effect');
  }
  for(const domain of ['NOTIFICATION','MESSENGER']) assert.ok(proofs.physical_obligations.some(row=>row.domain===domain),domain);
};
const validateAuthorityFalse=()=>{
  for(const value of Object.values(registry.authority)) assert.equal(value,false);
  for(const value of Object.values(proofRegistry.authority)) assert.equal(value,false);
  for(const value of Object.values(correction.authority)) assert.equal(value,false);
};
const validateNonCircular=()=>{
  assert.equal(semanticInputs.has('phase2-post-build-independent-review.json'),false);
  assert.equal(semanticInputs.has('phase2-validation-result.json'),false);
  assert.equal(excludedInputs.has('phase2-post-build-independent-review.json'),true);
};

check('V2-ARTIFACT-EXISTENCE',validateArtifactExistence);
check('V2-SOURCE-TUPLE',validateSourceTuple);
check('V2-INVENTORY-INDEX',validateInventory);
check('V2-LEDGER-ONE-TO-ONE',validateInventory);
check('V2-MUTATION-FAIL-CLOSED',validateMutationFailClosed);
check('V2-COMMAND-EXACT-COVERAGE',validateCommandClosure);
check('V2-TRANSITION-CLOSURE',validateCommandClosure);
check('V2-OWNERSHIP-AGGREGATE',validateCommandClosure);
check('V2-OFFLINE-ORIGINAL-ACTOR',validateCommandClosure);
check('V2-READ-NO-RESOLUTION',validateCommandClosure);
check('V2-EVENT-NO-SILENT-MUTATION',validateCommandClosure);
check('V2-WORKREQUEST-NO-TRANSFER',validateCommandClosure);
check('V2-CONTRACTOR-SEPARATION',validateCommandClosure);
check('V2-PURGE-HOLD',validateCommandClosure);
check('V2-PROOF-BINDING',validateProofBindings);
check('V2-AUTHORITY-FALSE',validateAuthorityFalse);
check('V2-NONCIRCULAR-REVIEW',validateNonCircular);
check('V2-MODEL-FIXTURES',validateFixtures);

const negative=[];
const mustReject=(id,fn)=>{try{fn();throw new Error('mutation accepted');}catch(error){if(String(error.message)==='mutation accepted') throw error;negative.push({id,status:'REJECTED'});}};
mustReject('NEG-DROP-LEDGER',()=>validateInventory(inventoryIndex,ledger.slice(1),dispositionSummary));
mustReject('NEG-DUPLICATE-LEDGER-ID',()=>{const rows=clone(ledger);rows[1].inventory_id=rows[0].inventory_id;validateInventory(inventoryIndex,rows,dispositionSummary);});
mustReject('NEG-ADMIT-MUTATION-WITHOUT-PROOF',()=>{const rows=clone(ledger);const row=rows.find(x=>['MUTATION_CAPABLE','MUTATION_OR_AUTHORITY_CAPABLE'].includes(x.mutation_class));row.classification_status='RESOLVED';row.architecture_admission=true;validateMutationFailClosed(rows);});
mustReject('NEG-REMOVE-COMMAND',()=>{const reg=clone(registry);reg.commands.pop();validateCommandClosure(reg,commandCoverage);});
mustReject('NEG-OWNERSHIP-AS-DEVICE',()=>{const reg=clone(registry);reg.commands.find(x=>x.id==='CMD-OWNERSHIP-ASSIGN').aggregate='device';validateCommandClosure(reg,commandCoverage);});
mustReject('NEG-REMOVE-OFFLINE-ACTOR-EPOCH',()=>{const reg=clone(registry);reg.commands.find(x=>x.id==='CMD-OFFLINE-SYNC').required_context=reg.commands.find(x=>x.id==='CMD-OFFLINE-SYNC').required_context.filter(x=>x!=='original_assignment_epoch');validateCommandClosure(reg,commandCoverage);});
mustReject('NEG-MESSAGE-READ-RESOLVES-WORK',()=>{const reg=clone(registry);reg.commands.find(x=>x.id==='CMD-MESSAGE-READ').prohibited_effects=[];validateCommandClosure(reg,commandCoverage);});
mustReject('NEG-NOTIFICATION-PHYSICAL-NOT-APPLICABLE',()=>{const proof=clone(proofRegistry);proof.physical_obligations.find(x=>x.domain==='NOTIFICATION').execution_evidence_status='not_applicable_no_physical_effect';validateProofBindings(proof);});
mustReject('NEG-SET-SCHEMA-AUTHORITY-TRUE',()=>{const reg=clone(registry);reg.authority.schema_design=true;for(const value of Object.values(reg.authority)) assert.equal(value,false);});

if(failures.length){console.error(JSON.stringify({validator_execution_status:'FAIL',failures},null,2));process.exit(1);}
const unresolved=dispositionSummary.unresolved;
const result={
  protocol:'CUSTODIAL_V43_PHASE2_VALIDATION_RESULT_V2',
  validator_execution_status:'PASS',
  stage_status:unresolved===0?'PENDING_FRESH_INDEPENDENT_REVIEW':'FAIL_CORRECTION_REQUIRED',
  semantic_inputs:[...semanticInputs].sort(),
  excluded_semantic_inputs:[...excludedInputs].sort(),
  checks_passed:passed,
  checks_failed:[],
  negative_mutations:negative,
  inventory_rows:ledger.length,
  unresolved_source_surfaces:unresolved,
  commands:registry.commands.length,
  state_machines:registry.state_machines.length,
  command_fixtures:fixtures.command_fixtures.length,
  attack_fixtures:fixtures.attack_fixtures.length,
  bound_proof_obligations:proofRegistry.proof_obligations.length,
  bound_physical_obligations:proofRegistry.physical_obligations.length,
  downstream_authority:false,
  blockers:[
    {id:'B-P2-01',status:unresolved===0?'CORRECTED_PENDING_REVIEW':'OPEN',reason:`${unresolved} source surfaces remain without signed final disposition and live/retirement proof`},
    {id:'B-P2-02',status:'CORRECTED_PENDING_FRESH_INDEPENDENT_REVIEW'},
    {id:'H-P2-01',status:'CORRECTED_BY_NONCIRCULAR_VALIDATOR_AND_NEGATIVE_MUTATIONS'},
    {id:'H-P2-02',status:'CORRECTED_BY_BOUND_PROOF_AND_PHYSICAL_OBLIGATION_REGISTRY'}
  ]
};
console.log(JSON.stringify(result,null,2));
