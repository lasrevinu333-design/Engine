import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GENERATOR_VERSION = "CUSTODIAL_V43_ARCHITECTURE_GENERATOR_V1";
const ROOT = dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(resolve(ROOT, name), "utf8"));
const clone = (value) => structuredClone(value);
const keywords = ["type","additionalProperties","const","enum","pattern","minLength","maxLength","minimum","minItems","maxItems","uniqueItems","format"];
const escapePointer = (value) => value.replaceAll("~","~0").replaceAll("/","~1");

export function stableError(schemaName, constraintPath) {
  return "AF_SCHEMA_" + createHash("sha256").update(schemaName + "|" + constraintPath).digest("hex").slice(0, 12).toUpperCase();
}

function typeMatches(value, expected) {
  const kinds = Array.isArray(expected) ? expected : [expected];
  return kinds.some((kind) => kind === "null" ? value === null :
    kind === "array" ? Array.isArray(value) :
    kind === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) :
    kind === "integer" ? Number.isInteger(value) :
    kind === "number" ? typeof value === "number" && Number.isFinite(value) :
    typeof value === kind);
}

function dereference(schema, root) {
  if (!schema?.$ref) return schema;
  const prefix = "#/$defs/";
  if (!schema.$ref.startsWith(prefix)) throw new Error("AF_SCHEMA_REF_UNSUPPORTED");
  const value = root.$defs[schema.$ref.slice(prefix.length)];
  if (!value) throw new Error("AF_SCHEMA_REF_MISSING");
  return value;
}

export function validateAgainstSchema(value, schema, root, schemaName, schemaPath = "#") {
  schema = dereference(schema, root);
  const fail = (keyword, suffix = "") => {
    const constraintPath = schemaPath + "/" + keyword + suffix;
    const error = new Error(stableError(schemaName, constraintPath));
    error.code = stableError(schemaName, constraintPath);
    throw error;
  };
  if ("type" in schema && !typeMatches(value, schema.type)) fail("type");
  if (Array.isArray(schema.required)) for (const field of schema.required) {
    if (!Object.hasOwn(value, field)) fail("required", ":" + field);
  }
  if (schema.additionalProperties === false && value && typeof value === "object" && !Array.isArray(value)) {
    const allowed = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) if (!allowed.has(key)) fail("additionalProperties");
  }
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) fail("const");
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) fail("enum");
  if (typeof schema.pattern === "string" && (typeof value !== "string" || !(new RegExp(schema.pattern)).test(value))) fail("pattern");
  if (typeof schema.minLength === "number" && value.length < schema.minLength) fail("minLength");
  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) fail("maxLength");
  if (typeof schema.minimum === "number" && value < schema.minimum) fail("minimum");
  if (typeof schema.minItems === "number" && value.length < schema.minItems) fail("minItems");
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) fail("maxItems");
  if (schema.uniqueItems === true) {
    const seen = new Set(value.map((item) => JSON.stringify(item)));
    if (seen.size !== value.length) fail("uniqueItems");
  }
  if (schema.format === "date-time" && (typeof value !== "string" || Number.isNaN(Date.parse(value)) || !value.endsWith("Z"))) fail("format");
  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    for (const [field, child] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, field)) validateAgainstSchema(value[field], child, root, schemaName, schemaPath + "/properties/" + escapePointer(field));
    }
  }
  if (schema.items && Array.isArray(value)) for (const item of value) {
    validateAgainstSchema(item, schema.items, root, schemaName, schemaPath + "/items");
  }
}

export function collectConstraints(schema, schemaPath = "#", dataPath = [], out = []) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || schema.$ref) return out;
  if (Array.isArray(schema.required)) for (const field of schema.required) {
    out.push({ constraintPath: schemaPath + "/required:" + field, dataPath, keyword: "required", field });
  }
  for (const keyword of keywords) if (Object.hasOwn(schema, keyword) && !(keyword === "additionalProperties" && schema[keyword] !== false)) {
    out.push({ constraintPath: schemaPath + "/" + keyword, dataPath, keyword });
  }
  for (const [field, child] of Object.entries(schema.properties ?? {})) {
    collectConstraints(child, schemaPath + "/properties/" + escapePointer(field), [...dataPath, field], out);
  }
  if (schema.items) collectConstraints(schema.items, schemaPath + "/items", [...dataPath, 0], out);
  return out;
}

function targetAt(root, path) {
  let parent = null, key = null, value = root;
  for (const part of path) { parent = value; key = part; value = value[part]; }
  return { parent, key, value };
}

export function mutateConstraint(sample, schema, constraint) {
  const value = clone(sample);
  let { parent, key, value: target } = targetAt(value, constraint.dataPath);
  const set = (next) => { if (parent === null) return next; parent[key] = next; return value; };
  const schemaAt = constraint.dataPath.reduce((node, part) => {
    node = dereference(node, schema);
    return typeof part === "number" ? node.items : node.properties[part];
  }, schema);
  const node = dereference(schemaAt, schema);
  switch (constraint.keyword) {
    case "required": delete target[constraint.field]; return value;
    case "additionalProperties": target.__unexpected_constraint_field__ = true; return value;
    case "type": {
      const expected = Array.isArray(node.type) ? node.type : [node.type];
      const candidates = [null, {}, [], "wrong", 3.5, true];
      return set(candidates.find((candidate) => !typeMatches(candidate, expected)));
    }
    case "const": return set(typeof node.const === "string" ? node.const + "_MUTATED" : typeof node.const === "number" ? node.const + 1 : typeof node.const === "boolean" ? !node.const : "NOT_NULL");
    case "enum": return set("__INVALID_ENUM_VALUE__");
    case "pattern": return set("__invalid_pattern_value__");
    case "minLength": return set("");
    case "maxLength": return set("X".repeat(node.maxLength + 1));
    case "minimum": return set(node.minimum - 1);
    case "minItems": return set([]);
    case "maxItems": return set([...target, "__EXTRA__"]);
    case "uniqueItems": return set([...target, clone(target[0])]);
    case "format": return set("not-a-date-time");
    default: throw new Error("AF_SCHEMA_MUTATION_UNSUPPORTED");
  }
}

function samples(registry) {
  return {
    source_reference: registry.source_references[0],
    physical_proof: registry.architecture_objects[0].physical_proof,
    architecture_object: registry.architecture_objects[0],
    record_envelope: registry.record_envelope,
    record_contract: registry.records[0],
    principal: registry.principals[0],
    credential: registry.credentials[0],
    session: registry.sessions[0],
    grant: registry.grants[0],
    authorization_decision: registry.authorization_decisions[0],
    service_principal: registry.service_principals[0],
    executable_tool: registry.tools[0],
    stale_client_matrix: registry.authority_set_template.stale_client_matrix,
    authority_set_template: registry.authority_set_template,
    gate_research: registry.gates_research[0],
    retirement_surface: registry.retirement_control_surfaces[0],
    forbidden_authority: registry.forbidden_authority,
    foundation_registry: registry,
    generator_contract: { registered:false, path:null, version:null, command:null, input_paths:[], output_path:null, byte_reproduction:null },
    artifact_node: { id:"N-SAMPLE", kind:"authored", path:"sample.json", field_owner:"FO-SAMPLE", inputs:[], consumers:[], invalidates:[], generator:{ registered:false, path:null, version:null, command:null, input_paths:[], output_path:null, byte_reproduction:null } },
    content_manifest_member: { path:"sample.json", role:"sample", kind:"authored", normative:true, identity_owner:"FO-SAMPLE" },
    proof_obligation: { id:"PO-SAMPLE", subject:"sample", owner:"owner", automated_evidence:"check", physical_proof:{required:false,reason:"not physical",fixture_gate:null}, pass_rule:"pass", failure_behavior:"block", gate:"G-SAMPLE" },
    stage_decision: { id:"SD-SAMPLE", sequence:1, stage:"DRAFT_REMOTE_PHASE_1", decision:"hold", authority_principal:"P-INDEPENDENT-STAGE-AUTHORITY", authority_credential:"CRED-INDEPENDENT-REVIEW", evidence:["sample"], occurred_at:"2026-08-06T08:00:00Z", previous:null },
    coverage_entry: { id:"SC-SAMPLE", schema:"sample", constraint_path:"#/type", mutation:"direct", expected_error:"AF_SCHEMA_SAMPLE", observed_error:"AF_SCHEMA_SAMPLE", direct:true }
  };
}

function coverSchema(schemaName, schema, root, sample) {
  validateAgainstSchema(sample, schema, root, schemaName);
  return collectConstraints(schema).map((constraint, index) => {
    const expected = stableError(schemaName, constraint.constraintPath);
    let observed = null;
    try { validateAgainstSchema(mutateConstraint(sample, root, constraint), schema, root, schemaName); }
    catch (error) { observed = error.code ?? error.message; }
    if (observed !== expected) throw new Error("AF_SCHEMA_DIRECT_MUTATION_MISMATCH:" + schemaName + ":" + constraint.constraintPath + ":" + observed);
    return { id:"SC-" + createHash("sha256").update(schemaName + "|" + constraint.constraintPath).digest("hex").slice(0,16), schema:schemaName, constraint_path:constraint.constraintPath, mutation:"direct:" + constraint.keyword + ":" + index, expected_error:expected, observed_error:observed, direct:true };
  });
}

export function buildCoverage(buildSchema, artifactSchemas, buildContract, registry) {
  const entries = [...coverSchema("build_contract", buildSchema, buildSchema, buildContract)];
  const sampleMap = samples(registry);
  for (const name of Object.keys(artifactSchemas.$defs).sort()) {
    if (!Object.hasOwn(sampleMap, name)) throw new Error("AF_SCHEMA_SAMPLE_MISSING:" + name);
    entries.push(...coverSchema("artifact_classes#/$defs/" + name, artifactSchemas.$defs[name], artifactSchemas, sampleMap[name]));
  }
  entries.sort((a,b) => a.schema.localeCompare(b.schema) || a.constraint_path.localeCompare(b.constraint_path));
  return { protocol:"CUSTODIAL_V43_DIRECT_SCHEMA_COVERAGE_V2", generator:GENERATOR_VERSION, status:"PASS", direct_mutation_count:entries.length, entries };
}

export function expectedCoverage() {
  return buildCoverage(readJson("architecture-foundation-build-contract.schema.json"), readJson("foundation-artifact-schemas.json"), readJson("architecture-foundation-build-contract.json"), readJson("phase1-foundation-registry.json"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? "--check";
  const expected = JSON.stringify(expectedCoverage(), null, 2) + "\n";
  const path = resolve(ROOT, "schema-coverage-ledger.json");
  if (mode === "--write") writeFileSync(path, expected);
  else if (mode === "--check") {
    if (readFileSync(path, "utf8") !== expected) throw new Error("AF_SCHEMA_COVERAGE_PROJECTION_STALE");
  } else throw new Error("AF_GENERATOR_ARGUMENT");
  console.log(JSON.stringify({status:"PASS",generator:GENERATOR_VERSION,entries:JSON.parse(expected).entries.length}));
}
