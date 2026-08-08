#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "../../../..");
const BACKEND = process.env.CUSTODIAL_V43_BACKEND_REPO || path.resolve(REPO, "../memphis-zoo-mcp");
const EXPECTED_FILES = [
  "README.md",
  "artifact-dag-blocker.json",
  "backend-provenance-normalization.json",
  "legacy-gate-lineage.json",
  "package-manifest.json",
  "validate-record-registry-prerequisite.mjs",
];
const FOUNDATION = Object.freeze({
  commit: "24c2f877fb86ee027e8acdab27316f1dba05bfe2",
  tree: "d80787f826ee570da825baf10829c1785e0311e2",
  content_manifest_sha256: "d66bcc4b2d0a8a21067d9eb235c33f53b091ac733a3b60c6ebc1d4b4f5d36e58",
});
const CURRENT_EVIDENCE = Object.freeze({
  commit: "f6e0d3845b94a62cc518e801d9cb25812e48f1e0",
  tree: "8e6cd3b0224f58f02ecd542a2e4bdec15ac421ba",
});
const CONTENT_MANIFEST_PATH = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json";
const DAG_PATH = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-artifact-generation-contract.json";
const DAG_SHA256 = "21e9feac02c4b4526c4aeb0ad4c7ceaecb25a7cc43ba4b6ba02fe27a80ea1eeb";
const RECORD_REGISTRY_PATH = "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-record-type-registry-v1.md";
const CURRENT_JOINED_TRACE_PATH = "docs/audits/custodial-unified-v4-3-architecture/current-joined-trace";
const LATER_GENERATORS = Object.freeze([
  "tools/generate-v43-object-registry.mjs",
  "tools/generate-v43-trace.mjs",
  "tools/generate-v43-reverse-registry.mjs",
]);
const PROTECTED_LATER_NODES = Object.freeze([
  Object.freeze({ artifact_id: "V43-OBJECT-REGISTRY", planned_order: 13, status: "BLOCKED_NOT_MATERIALIZED" }),
  Object.freeze({ artifact_id: "V43-TRACE", planned_order: 14, status: "BLOCKED_NOT_MATERIALIZED" }),
  Object.freeze({ artifact_id: "V43-REVERSE-REGISTRY", planned_order: 15, status: "BLOCKED_NOT_MATERIALIZED" }),
]);
const BLOCKER_INVARIANT = "A valid evidence package may describe the blocker but cannot substitute Phase-2 record types or candidate mappings for V43-RECORD-REGISTRY, materialize later canonical nodes, authorize activation, or imply closure.";

const LEGACY_SOURCE = Object.freeze({
  path: "docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-capability-trace-v2.md",
  sha256: "7dd089d68a9a107e971f37263cf9eb244c378fbee810c6d96571c071d050b318",
  git_blob_sha1: "43e9612f8e5d40512441d17d3a9a22cd3851e75e",
});
const LEGACY_IDS = Object.freeze([
  "G-AI-WRITE",
  "G-ESCALATION",
  "G-GUEST",
  "G-HOURS",
  "G-INSPECTION",
  "G-LUNCH",
  "G-MGR-TIERS",
  "G-MOXIE",
  "G-MSG-POLICY",
  "G-NOTIF-P0",
  "G-OPEN",
  "G-POSITION",
  "G-PRIV-ACCOMMODATION",
  "G-RETENTION",
  "G-RETIRE-001",
  "G-SCHED-SOURCE",
  "G-SEPT14",
  "G-SLO",
  "G-WEATHER",
]);
const REJECTED_ALIASES = Object.freeze([
  "G-AI-WRITE-001",
  "G-GUEST-001",
  "G-INSPECTION-001",
  "G-PRIV-ACCOM",
  "G-SCHED-SOURCE-001",
]);

const BACKEND_REPOSITORY = "https://github.com/lasrevinu333-design/memphis-zoo-mcp.git";
const BACKEND_SOURCE_REPOSITORY = "lasrevinu333-design/memphis-zoo-mcp";
const BACKEND_COMMIT = "0fff8c2cadea132902df22c99593f1ce348411a7";
const BACKEND_TREE = "3ab057f09b685ed9b1ab259e17dc2652f5574b38";
const BACKEND_INVENTORY_PATH = "docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/phase2-backend-authority-surface-inventory.json";
const BACKEND_INVENTORY_SHA256 = "132f590e35b9d33056c0aadfcf2e57cdde7f1662f5166ce0ec1808c6a164444c";
const UPSTREAM_INVENTORY_BLOB = "99cb56b519fa72c9a5353f2f0f94d6a6422070dc";
const UPSTREAM_INVENTORY_SHA256 = "13348736f565a6b0af730187f16f0dde18159b1b9e584d21fcd6a549fc8d63da";
const NORMALIZATION_RULE = "Python universal-newline semantics: decode strict UTF-8, translate CRLF to LF, then remaining CR to LF, then SHA-256 the UTF-8 bytes";
const SPECIAL_RAW_SHA256 = "b713c07ba76928af0aad6e35465cd647c3450b27c473453046cb89b569aa55eb";
const SPECIAL_NORMALIZED_SHA256 = "eab04bd0a3b28d49fbf000d5be8e11e7a3966364ea2343abdec31413a58fb218";
const CHILD_TIMEOUT_MS = 30_000;
const CHILD_MAX_BUFFER = 64 * 1024 * 1024;
const MEMBERSHIP_MUTATION_PATH = path.join(ROOT, ".membership-extra-directory");

const mode = process.argv[2];
if (process.argv.length !== 3 || mode !== "--check") throw new Error("USAGE: node validate-record-registry-prerequisite.mjs --check");

const decoder = new TextDecoder("utf-8", { fatal: true });
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const gitBlob = (bytes) => crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex");
const read = (name) => fs.readFileSync(path.join(ROOT, name));
const json = (name) => JSON.parse(decoder.decode(read(name)));
const clone = (value) => structuredClone(value);
const ensure = (condition, code) => {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
};
const exact = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const strictObject = (value, keys, code) => ensure(value !== null && typeof value === "object" && !Array.isArray(value) && exact(Object.keys(value).sort(), [...keys].sort()), code);
const gitText = (cwd, args) => execFileSync("git", args, {
  cwd,
  encoding: "utf8",
  timeout: CHILD_TIMEOUT_MS,
  maxBuffer: CHILD_MAX_BUFFER,
}).trim();
const gitBytes = (cwd, args) => execFileSync("git", args, {
  cwd,
  timeout: CHILD_TIMEOUT_MS,
  maxBuffer: CHILD_MAX_BUFFER,
});
const gitIsAncestor = (ancestor) => {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: CHILD_MAX_BUFFER,
  });
  return !result.error && result.status === 0;
};
const assertNoSymlinkComponents = (target, code) => {
  const relative = path.relative(REPO, target);
  ensure(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative), code);
  let cursor = REPO;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    ensure(!fs.lstatSync(cursor).isSymbolicLink(), code);
  }
};

function validateCanonicalFiles() {
  assertNoSymlinkComponents(ROOT, "E-PACKAGE-SYMLINK");
  const entries = fs.readdirSync(ROOT).sort();
  ensure(exact(entries, EXPECTED_FILES), "E-PACKAGE-MEMBERSHIP");
  for (const name of entries) {
    const target = path.join(ROOT, name);
    assertNoSymlinkComponents(target, "E-PACKAGE-SYMLINK");
    ensure(fs.lstatSync(target).isFile(), "E-PACKAGE-MEMBERSHIP");
    const bytes = read(name);
    const text = decoder.decode(bytes);
    ensure(text.normalize("NFC") === text && !text.includes("\r") && text.endsWith("\n"), "E-CANONICAL-TEXT");
  }
}

function validateManifest(manifest) {
  strictObject(manifest, ["protocol", "status", "self_digest_excluded", "members"], "E-MANIFEST-SHAPE");
  ensure(manifest.protocol === "CUSTODIAL_V43_RECORD_REGISTRY_PREREQUISITE_PACKAGE_MANIFEST_V1" && manifest.status === "BLOCKED_NON_ACTIVATABLE" && manifest.self_digest_excluded === true, "E-MANIFEST-PROTOCOL");
  strictObject(manifest.members, EXPECTED_FILES.filter((name) => name !== "package-manifest.json"), "E-MANIFEST-MEMBERS");
  for (const name of EXPECTED_FILES.filter((entry) => entry !== "package-manifest.json")) ensure(manifest.members[name] === sha256(read(name)), "E-MANIFEST-DIGEST");
}

function validateBlocker(blocker) {
  strictObject(blocker, ["protocol", "status", "deterministic_package_valid", "closure_ready", "activation_authorized", "foundation_binding", "current_evidence_binding", "artifact_generation_contract", "earliest_unmet_prerequisite", "protected_later_nodes", "current_joined_trace_directory", "gates", "invariant"], "E-BLOCKER-SHAPE");
  ensure(blocker.protocol === "CUSTODIAL_V43_RECORD_REGISTRY_PREREQUISITE_BLOCKER_V1", "E-BLOCKER-PROTOCOL");
  ensure(blocker.status === "BLOCKED_NON_ACTIVATABLE" && blocker.deterministic_package_valid === true && blocker.closure_ready === false && blocker.activation_authorized === false, "E-BLOCKER-OUTCOMES");

  strictObject(blocker.foundation_binding, ["commit", "tree", "content_manifest_sha256"], "E-BLOCKER-FOUNDATION-SHAPE");
  ensure(exact(blocker.foundation_binding, FOUNDATION), "E-BLOCKER-FOUNDATION");
  ensure(gitText(REPO, ["rev-parse", `${FOUNDATION.commit}^{tree}`]) === FOUNDATION.tree && gitIsAncestor(FOUNDATION.commit), "E-BLOCKER-FOUNDATION-ANCESTRY");
  const foundationManifest = gitBytes(REPO, ["show", `${FOUNDATION.commit}:${CONTENT_MANIFEST_PATH}`]);
  ensure(sha256(foundationManifest) === FOUNDATION.content_manifest_sha256 && sha256(fs.readFileSync(path.join(REPO, CONTENT_MANIFEST_PATH))) === FOUNDATION.content_manifest_sha256, "E-BLOCKER-FOUNDATION-MANIFEST");

  strictObject(blocker.current_evidence_binding, ["commit", "tree"], "E-BLOCKER-EVIDENCE-BINDING-SHAPE");
  ensure(exact(blocker.current_evidence_binding, CURRENT_EVIDENCE), "E-BLOCKER-EVIDENCE-BINDING");
  ensure(gitText(REPO, ["rev-parse", `${CURRENT_EVIDENCE.commit}^{tree}`]) === CURRENT_EVIDENCE.tree && gitIsAncestor(CURRENT_EVIDENCE.commit), "E-BLOCKER-EVIDENCE-ANCESTRY");

  strictObject(blocker.artifact_generation_contract, ["path", "sha256"], "E-BLOCKER-DAG-SHAPE");
  ensure(blocker.artifact_generation_contract.path === DAG_PATH && blocker.artifact_generation_contract.sha256 === DAG_SHA256, "E-BLOCKER-DAG-BINDING");
  const dagBytes = fs.readFileSync(path.join(REPO, DAG_PATH));
  ensure(sha256(dagBytes) === DAG_SHA256, "E-BLOCKER-DAG-HASH");
  const dag = JSON.parse(decoder.decode(dagBytes));
  const dagExpected = [
    ["V43-RECORD-REGISTRY", 6],
    ["V43-OBJECT-REGISTRY", 13],
    ["V43-TRACE", 14],
    ["V43-REVERSE-REGISTRY", 15],
  ];
  for (const [artifactId, order] of dagExpected) ensure(dag.nodes.find((node) => node.artifact_id === artifactId)?.order === order, "E-BLOCKER-DAG-ORDER");
  const recordNode = dag.nodes.find((node) => node.artifact_id === "V43-RECORD-REGISTRY");
  ensure(recordNode.kind === "planned_canonical_contract" && exact(recordNode.inputs, ["EVIDENCE-V42", "EVIDENCE-SOL-REPLAN-AUDIT"]), "E-BLOCKER-DAG-RECORD-NODE");

  strictObject(blocker.earliest_unmet_prerequisite, ["artifact_id", "planned_order", "kind", "status", "inputs", "disposition"], "E-BLOCKER-EARLIEST-SHAPE");
  ensure(exact(blocker.earliest_unmet_prerequisite, {
    artifact_id: "V43-RECORD-REGISTRY",
    planned_order: 6,
    kind: "planned_canonical_contract",
    status: "ABSENT_NO_ADMITTED_CANONICAL_INSTANCE",
    inputs: ["EVIDENCE-V42", "EVIDENCE-SOL-REPLAN-AUDIT"],
    disposition: "MISSING_AUTHORIZED_RECORD_REGISTRY",
  }), "E-BLOCKER-EARLIEST");
  ensure(Array.isArray(blocker.protected_later_nodes) && blocker.protected_later_nodes.length === PROTECTED_LATER_NODES.length, "E-BLOCKER-LATER-NODES");
  for (let index = 0; index < PROTECTED_LATER_NODES.length; index += 1) {
    strictObject(blocker.protected_later_nodes[index], ["artifact_id", "planned_order", "status"], "E-BLOCKER-LATER-NODES");
    ensure(exact(blocker.protected_later_nodes[index], PROTECTED_LATER_NODES[index]), "E-BLOCKER-LATER-NODES");
  }
  ensure(blocker.current_joined_trace_directory === "ABSENT_BY_DAG_DISCIPLINE", "E-BLOCKER-JOINED-TRACE-DISPOSITION");
  ensure(blocker.invariant === BLOCKER_INVARIANT, "E-BLOCKER-INVARIANT");

  ensure(!fs.existsSync(path.join(REPO, RECORD_REGISTRY_PATH)), "E-BLOCKER-RECORD-REGISTRY-PRESENT");
  ensure(!fs.existsSync(path.join(REPO, CURRENT_JOINED_TRACE_PATH)), "E-BLOCKER-JOINED-TRACE-PRESENT");
  for (const generator of LATER_GENERATORS) ensure(!fs.existsSync(path.join(REPO, generator)), "E-BLOCKER-LATER-GENERATOR-PRESENT");

  strictObject(blocker.gates, ["open_count", "g_evidence_001", "g_trace_001", "g_trace_lint"], "E-BLOCKER-GATES-SHAPE");
  ensure(exact(blocker.gates, { open_count: 39, g_evidence_001: "OPEN", g_trace_001: "OPEN", g_trace_lint: "OPEN" }), "E-BLOCKER-GATES");
  const registry = JSON.parse(decoder.decode(fs.readFileSync(path.join(REPO, "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json"))));
  ensure(registry.gates.length === 39 && registry.gates.every((gate) => gate.status === "OPEN"), "E-BLOCKER-CANONICAL-GATES");
  for (const gateId of ["G-EVIDENCE-001", "G-TRACE-001", "G-TRACE-LINT"]) ensure(registry.gates.find((gate) => gate.gate_id === gateId)?.status === "OPEN", "E-BLOCKER-CANONICAL-GATES");
}

function deriveLegacy(sourceText) {
  const map = new Map(LEGACY_IDS.map((gateId) => [gateId, new Set()]));
  for (const line of sourceText.split("\n")) {
    const cap = line.match(/^\| (CAP-\d{3}) \|/);
    if (!cap) continue;
    for (const gateId of new Set(line.match(/G-[A-Z0-9-]+/g) || [])) if (map.has(gateId)) map.get(gateId).add(cap[1]);
  }
  return [...map].map(([gate_id, capIds]) => ({ gate_id, cap_ids: [...capIds].sort() }));
}

function validateLegacy(legacy) {
  strictObject(legacy, ["protocol", "status", "source", "counts", "rejected_non_source_aliases", "lineage", "candidate_evidence_rule"], "E-LEGACY-SHAPE");
  ensure(legacy.protocol === "CUSTODIAL_V43_LEGACY_GATE_LINEAGE_EVIDENCE_V1" && legacy.status === "MISSING_AUTHORIZED_LINEAGE", "E-LEGACY-PROTOCOL");
  strictObject(legacy.source, ["path", "sha256", "git_blob_sha1"], "E-LEGACY-SOURCE-SHAPE");
  ensure(exact(legacy.source, LEGACY_SOURCE), "E-LEGACY-SOURCE");
  const sourceBytes = fs.readFileSync(path.join(REPO, LEGACY_SOURCE.path));
  const sourceText = decoder.decode(sourceBytes);
  ensure(sha256(sourceBytes) === LEGACY_SOURCE.sha256 && gitBlob(sourceBytes) === LEGACY_SOURCE.git_blob_sha1, "E-LEGACY-SOURCE-IDENTITY");

  strictObject(legacy.counts, ["legacy_gate_ids", "affected_cap_rows", "gate_to_cap_links"], "E-LEGACY-COUNTS-SHAPE");
  ensure(exact(legacy.counts, { legacy_gate_ids: 19, affected_cap_rows: 22, gate_to_cap_links: 23 }), "E-LEGACY-COUNTS");
  ensure(exact(legacy.rejected_non_source_aliases, REJECTED_ALIASES), "E-LEGACY-ALIASES");
  const sourceGateTokens = new Set(sourceText.match(/G-[A-Z0-9-]+/g) || []);
  ensure(REJECTED_ALIASES.every((alias) => !sourceGateTokens.has(alias)), "E-LEGACY-ALIASES-PRESENT");

  ensure(Array.isArray(legacy.lineage) && legacy.lineage.length === LEGACY_IDS.length, "E-LEGACY-MAPPING");
  for (const row of legacy.lineage) strictObject(row, ["gate_id", "cap_ids"], "E-LEGACY-LINEAGE-ROW-SHAPE");
  const derived = deriveLegacy(sourceText);
  ensure(exact(legacy.lineage, derived), "E-LEGACY-MAPPING");
  ensure(exact(derived.map((row) => row.gate_id), LEGACY_IDS), "E-LEGACY-ID-SET");
  const affectedCaps = new Set(derived.flatMap((row) => row.cap_ids));
  const gateToCapLinks = derived.reduce((sum, row) => sum + row.cap_ids.length, 0);
  ensure(affectedCaps.size === 22 && gateToCapLinks === 23, "E-LEGACY-DERIVED-COUNTS");

  const rule = legacy.candidate_evidence_rule;
  strictObject(rule, ["source_backed_successor_gate_ids", "source_backed_split_gate_ids", "source_backed_merge_gate_ids", "source_backed_retirement_ids", "inference_promoted_to_authority", "disposition_for_every_row"], "E-LEGACY-RULE-SHAPE");
  ensure(exact(rule, {
    source_backed_successor_gate_ids: [],
    source_backed_split_gate_ids: [],
    source_backed_merge_gate_ids: [],
    source_backed_retirement_ids: [],
    inference_promoted_to_authority: false,
    disposition_for_every_row: "MISSING_AUTHORIZED_LINEAGE",
  }), "E-LEGACY-LINEAGE-LAUNDERING");
}

function computeBackend() {
  ensure(fs.existsSync(BACKEND) && fs.statSync(BACKEND).isDirectory(), "E-BACKEND-CHECKOUT");
  let remote;
  try {
    remote = gitText(BACKEND, ["remote", "get-url", "origin"]);
  } catch {
    ensure(false, "E-BACKEND-CHECKOUT");
  }
  ensure(remote === BACKEND_REPOSITORY, "E-BACKEND-REPOSITORY");
  ensure(gitText(BACKEND, ["cat-file", "-t", BACKEND_COMMIT]) === "commit" && gitText(BACKEND, ["rev-parse", `${BACKEND_COMMIT}^{tree}`]) === BACKEND_TREE, "E-BACKEND-COMMIT-TREE");

  const inventoryBytes = fs.readFileSync(path.join(REPO, BACKEND_INVENTORY_PATH));
  ensure(sha256(inventoryBytes) === BACKEND_INVENTORY_SHA256, "E-BACKEND-INVENTORY");
  const inventory = JSON.parse(decoder.decode(inventoryBytes));
  ensure(inventory.entries.length === 2768, "E-BACKEND-INVENTORY");
  strictObject(inventory.provenance, ["inventory_blob", "inventory_sha256"], "E-BACKEND-INVENTORY-PROVENANCE");
  ensure(exact(inventory.provenance, { inventory_blob: UPSTREAM_INVENTORY_BLOB, inventory_sha256: UPSTREAM_INVENTORY_SHA256 }), "E-BACKEND-INVENTORY-PROVENANCE");

  const paths = new Map();
  for (const row of inventory.entries) {
    ensure(row.source_commit === BACKEND_COMMIT && row.source_tree === BACKEND_TREE && row.source_repository === BACKEND_SOURCE_REPOSITORY, "E-BACKEND-ROW-SOURCE");
    if (paths.has(row.path)) ensure(paths.get(row.path) === row.git_blob_sha1, "E-BACKEND-PATH-COLLISION");
    else paths.set(row.path, row.git_blob_sha1);
  }

  const blobFacts = new Map();
  let pathBlobMismatches = 0;
  for (const [sourcePath, declaredBlob] of paths) {
    const actualBlob = gitText(BACKEND, ["rev-parse", `${BACKEND_COMMIT}:${sourcePath}`]);
    if (actualBlob !== declaredBlob) pathBlobMismatches += inventory.entries.filter((row) => row.path === sourcePath).length;
    if (blobFacts.has(declaredBlob)) continue;
    const bytes = gitBytes(BACKEND, ["cat-file", "blob", declaredBlob]);
    ensure(gitBlob(bytes) === declaredBlob, "E-BACKEND-BLOB-BYTES");
    let text;
    try {
      text = decoder.decode(bytes);
    } catch {
      ensure(false, "E-BACKEND-UTF8");
    }
    const normalizedBytes = Buffer.from(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
    blobFacts.set(declaredBlob, {
      raw_sha256: sha256(bytes),
      normalized_sha256: sha256(normalizedBytes),
      carriage_returns: (text.match(/\r/g) || []).length,
      replacement_characters: (text.match(/\uFFFD/g) || []).length,
    });
  }

  let normalizedDigestMismatches = 0;
  let rawDifferenceRows = 0;
  let replacementCharacters = 0;
  const rawGroups = new Map();
  for (const row of inventory.entries) {
    const facts = blobFacts.get(row.git_blob_sha1);
    if (facts.normalized_sha256 !== row.file_sha256) normalizedDigestMismatches += 1;
    if (facts.raw_sha256 !== row.file_sha256) {
      rawDifferenceRows += 1;
      rawGroups.set(facts.raw_sha256, (rawGroups.get(facts.raw_sha256) || 0) + 1);
    }
    replacementCharacters += facts.replacement_characters;
  }
  const specialFacts = [...blobFacts.values()].find((facts) => facts.raw_sha256 === SPECIAL_RAW_SHA256);
  ensure(specialFacts !== undefined, "E-BACKEND-SPECIAL-BLOB");
  return {
    inventory_sha256: sha256(inventoryBytes),
    upstream_inventory_blob: inventory.provenance.inventory_blob,
    upstream_inventory_sha256: inventory.provenance.inventory_sha256,
    rows: inventory.entries.length,
    unique_source_blobs: blobFacts.size,
    unique_source_paths: paths.size,
    path_blob_mismatches: pathBlobMismatches,
    normalized_digest_mismatches: normalizedDigestMismatches,
    utf8_replacement_characters: replacementCharacters,
    raw_difference_rows: rawDifferenceRows,
    raw_groups: Object.fromEntries(rawGroups),
    special_normalized_sha256: specialFacts.normalized_sha256,
    special_carriage_returns: specialFacts.carriage_returns,
  };
}

function validateBackend(candidate, actual) {
  strictObject(candidate, ["protocol", "status", "repository", "commit", "tree", "embedded_inventory", "normalization", "raw_digest_exception", "privacy"], "E-BACKEND-SHAPE");
  ensure(candidate.protocol === "CUSTODIAL_V43_BACKEND_PROVENANCE_NORMALIZATION_V1" && candidate.status === "VERIFIED_CANDIDATE_PROVENANCE" && candidate.repository === BACKEND_REPOSITORY && candidate.commit === BACKEND_COMMIT && candidate.tree === BACKEND_TREE, "E-BACKEND-BINDING");
  strictObject(candidate.embedded_inventory, ["path", "sha256", "declared_upstream_inventory_git_blob_sha1", "declared_upstream_inventory_sha256"], "E-BACKEND-INVENTORY-SHAPE");
  ensure(exact(candidate.embedded_inventory, {
    path: BACKEND_INVENTORY_PATH,
    sha256: BACKEND_INVENTORY_SHA256,
    declared_upstream_inventory_git_blob_sha1: UPSTREAM_INVENTORY_BLOB,
    declared_upstream_inventory_sha256: UPSTREAM_INVENTORY_SHA256,
  }) && actual.inventory_sha256 === BACKEND_INVENTORY_SHA256 && actual.upstream_inventory_blob === UPSTREAM_INVENTORY_BLOB && actual.upstream_inventory_sha256 === UPSTREAM_INVENTORY_SHA256, "E-BACKEND-INVENTORY-BINDING");

  strictObject(candidate.normalization, ["rule", "rows", "unique_source_blobs", "unique_source_paths", "path_blob_mismatches", "normalized_digest_mismatches", "utf8_replacement_characters"], "E-BACKEND-NORMALIZATION-SHAPE");
  ensure(exact(candidate.normalization, {
    rule: NORMALIZATION_RULE,
    rows: actual.rows,
    unique_source_blobs: actual.unique_source_blobs,
    unique_source_paths: actual.unique_source_paths,
    path_blob_mismatches: actual.path_blob_mismatches,
    normalized_digest_mismatches: actual.normalized_digest_mismatches,
    utf8_replacement_characters: actual.utf8_replacement_characters,
  }) && actual.rows === 2768 && actual.unique_source_blobs === 304 && actual.unique_source_paths === 304 && actual.path_blob_mismatches === 0 && actual.normalized_digest_mismatches === 0 && actual.utf8_replacement_characters === 0, "E-BACKEND-NORMALIZATION");

  strictObject(candidate.raw_digest_exception, ["affected_rows", "unique_raw_digest_groups", "carriage_returns", "raw_sha256", "normalized_sha256", "classification"], "E-BACKEND-RAW-EXCEPTION-SHAPE");
  ensure(exact(candidate.raw_digest_exception, {
    affected_rows: 709,
    unique_raw_digest_groups: 1,
    carriage_returns: 19,
    raw_sha256: SPECIAL_RAW_SHA256,
    normalized_sha256: SPECIAL_NORMALIZED_SHA256,
    classification: "VERIFIED_UNIVERSAL_NEWLINE_NORMALIZATION_NOT_STALE_PROVENANCE",
  }) && actual.raw_difference_rows === 709 && Object.keys(actual.raw_groups).length === 1 && actual.raw_groups[SPECIAL_RAW_SHA256] === 709 && actual.special_carriage_returns === 19 && actual.special_normalized_sha256 === SPECIAL_NORMALIZED_SHA256, "E-BACKEND-RAW-EXCEPTION");

  strictObject(candidate.privacy, ["persisted_local_paths", "credentials_or_secrets", "identities_are_repository_commit_tree_blob_and_sha256_only"], "E-BACKEND-PRIVACY-SHAPE");
  ensure(exact(candidate.privacy, { persisted_local_paths: false, credentials_or_secrets: false, identities_are_repository_commit_tree_blob_and_sha256_only: true }), "E-BACKEND-PRIVACY");
}

validateCanonicalFiles();
const blocker = json("artifact-dag-blocker.json");
const legacy = json("legacy-gate-lineage.json");
const backend = json("backend-provenance-normalization.json");
const manifest = json("package-manifest.json");
validateManifest(manifest);
validateBlocker(blocker);
validateLegacy(legacy);
const backendActual = computeBackend();
validateBackend(backend, backendActual);

const mutations = [
  ["manifest_omitted_member", "E-MANIFEST-MEMBERS", () => { const value = clone(manifest); delete value.members["README.md"]; validateManifest(value); }],
  ["package_extra_directory", "E-PACKAGE-MEMBERSHIP", () => {
    ensure(!fs.existsSync(MEMBERSHIP_MUTATION_PATH), "E-MUTATION-RESIDUE");
    fs.mkdirSync(MEMBERSHIP_MUTATION_PATH);
    try {
      validateCanonicalFiles();
    } finally {
      if (fs.existsSync(MEMBERSHIP_MUTATION_PATH)) fs.rmdirSync(MEMBERSHIP_MUTATION_PATH);
    }
  }],
  ["blocker_extra_field", "E-BLOCKER-SHAPE", () => { const value = clone(blocker); value.closure = false; validateBlocker(value); }],
  ["blocker_closure_escalated", "E-BLOCKER-OUTCOMES", () => { const value = clone(blocker); value.closure_ready = true; validateBlocker(value); }],
  ["blocker_activation_escalated", "E-BLOCKER-OUTCOMES", () => { const value = clone(blocker); value.activation_authorized = true; validateBlocker(value); }],
  ["blocker_protected_gate_closed", "E-BLOCKER-GATES", () => { const value = clone(blocker); value.gates.g_trace_001 = "CLOSED"; validateBlocker(value); }],
  ["blocker_open_gate_count_changed", "E-BLOCKER-GATES", () => { const value = clone(blocker); value.gates.open_count = 38; validateBlocker(value); }],
  ["blocker_protected_node_removed", "E-BLOCKER-LATER-NODES", () => { const value = clone(blocker); value.protected_later_nodes.pop(); validateBlocker(value); }],
  ["blocker_protected_nodes_swapped", "E-BLOCKER-LATER-NODES", () => { const value = clone(blocker); [value.protected_later_nodes[0], value.protected_later_nodes[1]] = [value.protected_later_nodes[1], value.protected_later_nodes[0]]; validateBlocker(value); }],
  ["blocker_current_evidence_binding_changed", "E-BLOCKER-EVIDENCE-BINDING", () => { const value = clone(blocker); value.current_evidence_binding.commit = FOUNDATION.commit; validateBlocker(value); }],
  ["blocker_dag_hash_changed", "E-BLOCKER-DAG-BINDING", () => { const value = clone(blocker); value.artifact_generation_contract.sha256 = "0".repeat(64); validateBlocker(value); }],
  ["legacy_gate_omitted", "E-LEGACY-MAPPING", () => { const value = clone(legacy); value.lineage.pop(); validateLegacy(value); }],
  ["legacy_gate_substituted_with_alias", "E-LEGACY-MAPPING", () => { const value = clone(legacy); value.lineage[0].gate_id = "G-AI-WRITE-001"; validateLegacy(value); }],
  ["legacy_material_field_added", "E-LEGACY-SHAPE", () => { const value = clone(legacy); value.authorized = true; validateLegacy(value); }],
  ["legacy_lineage_laundered", "E-LEGACY-LINEAGE-LAUNDERING", () => { const value = clone(legacy); value.candidate_evidence_rule.source_backed_successor_gate_ids.push("G-TOOL-REGISTRY"); validateLegacy(value); }],
  ["backend_repository_changed", "E-BACKEND-BINDING", () => { const value = clone(backend); value.repository = "https://example.invalid/repository.git"; validateBackend(value, backendActual); }],
  ["backend_inventory_path_changed", "E-BACKEND-INVENTORY-BINDING", () => { const value = clone(backend); value.embedded_inventory.path = "inventory.json"; validateBackend(value, backendActual); }],
  ["backend_inventory_identity_changed", "E-BACKEND-INVENTORY-BINDING", () => { const value = clone(backend); value.embedded_inventory.declared_upstream_inventory_sha256 = "0".repeat(64); validateBackend(value, backendActual); }],
  ["backend_normalized_sha_changed", "E-BACKEND-RAW-EXCEPTION", () => { const value = clone(backend); value.raw_digest_exception.normalized_sha256 = "0".repeat(64); validateBackend(value, backendActual); }],
  ["backend_privacy_third_field_changed", "E-BACKEND-PRIVACY", () => { const value = clone(backend); value.privacy.identities_are_repository_commit_tree_blob_and_sha256_only = false; validateBackend(value, backendActual); }],
  ["backend_normalization_extra_field", "E-BACKEND-NORMALIZATION-SHAPE", () => { const value = clone(backend); value.normalization.raw_matches = 2768; validateBackend(value, backendActual); }],
];

let recoveries = 0;
for (const [mutationId, expectedCode, mutate] of mutations) {
  let rejected = false;
  try {
    mutate();
  } catch (error) {
    ensure(error.code === expectedCode, `E-MUTATION-WRONG-FAILURE:${mutationId}:${error.code || "UNCLASSIFIED"}`);
    rejected = true;
  }
  ensure(rejected, `E-MUTATION-ESCAPED:${mutationId}`);
  ensure(!fs.existsSync(MEMBERSHIP_MUTATION_PATH), `E-MUTATION-RESIDUE:${mutationId}`);
  validateCanonicalFiles();
  validateManifest(clone(manifest));
  validateBlocker(clone(blocker));
  validateLegacy(clone(legacy));
  validateBackend(clone(backend), backendActual);
  recoveries += 1;
}

console.log(JSON.stringify({
  protocol: "CUSTODIAL_V43_RECORD_REGISTRY_PREREQUISITE_VALIDATION_V1",
  status: "PASS_BLOCKED_NON_ACTIVATABLE",
  deterministic_package_valid: true,
  closure_ready: false,
  package_members: EXPECTED_FILES.length,
  legacy_gate_ids: LEGACY_IDS.length,
  affected_cap_rows: 22,
  gate_to_cap_links: 23,
  backend_rows: backendActual.rows,
  backend_unique_blobs: backendActual.unique_source_blobs,
  backend_normalized_mismatches: backendActual.normalized_digest_mismatches,
  backend_utf8_replacement_characters: backendActual.utf8_replacement_characters,
  backend_raw_difference_rows: backendActual.raw_difference_rows,
  semantic_mutation_failures: mutations.length,
  semantic_mutation_ids: mutations.map(([mutationId]) => mutationId),
  recoveries,
  owned_test_residue: fs.existsSync(MEMBERSHIP_MUTATION_PATH) ? 1 : 0,
  activation_authorized: false,
  open_gates: 39,
  earliest_blocker: "V43-RECORD-REGISTRY",
}));
