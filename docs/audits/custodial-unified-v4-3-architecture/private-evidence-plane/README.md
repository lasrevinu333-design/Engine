# Custodial v4.3 private evidence-plane binding

**Status:** `UNREGISTERED_NON_ACTIVATABLE`

**Activation:** **DENIED**

This bounded control-plane package defines what future private evidence-plane
material must prove before it can be admitted. It creates no private
repository, service, credential, attestation, evidence set, authorization
decision, stage decision, gate decision, or gate closure.

## Boundary

The canonical v4.3 content manifest requires detached package attestation and
append-only authority outside immutable content. The current controlling
evidence ledger proves that the registered private-plane locator, admissible
attestation, evidence-set identity, authorization chain, and decision history
are absent. This package makes that absence explicit and deterministic rather
than treating a schema-valid placeholder as evidence.

`G-EVIDENCE-001` remains `OPEN`. It cannot close until every prerequisite in
`decision-status-matrix.json` has a registered, privacy-safe, externally
verifiable record and an admissible append-only decision sequence.

## Files

- `private-evidence-plane-contract.json` — controlling non-activatable model.
- `private-evidence-plane-contract.schema.json` — strict contract shape.
- `decision-status-matrix.json` — ready, candidate-only, missing-authority,
  and closure-prerequisite disposition.
- `conformance-fixtures.json` — one explicitly historical attestation fixture
  bound to commit `ea22af22685d466b66334000c6bd931fb4beca6d` and its old
  content manifest, plus an exact ID list classifying all 84 negative cases as
  current test fixtures. The base historical record is invalidated and
  superseded inside the fixture; its successor remains historical-only. None
  can be presented as current evidence or authority. The validator proves the
  historical manifest differs from the current manifest and rejects any
  classification that marks the fixture current.
- `validate-private-evidence-plane.mjs` — deterministic validator and
  false-green mutation/recovery suite.
- `package-manifest.json` — exact package membership and SHA-256 bindings.

## Deterministic verification

```sh
node docs/audits/custodial-unified-v4-3-architecture/private-evidence-plane/validate-private-evidence-plane.mjs --check
```

The validator checks a closed local Draft 2020-12 subset, canonical UTF-8/NFC
bytes (including unpaired-surrogate rejection) and scalar key ordering,
immutable manifest/blob/tree/repository bindings, authorization-chain
bindings, exact abstract-to-concrete record-field parity, strict UTC causal ordering, and transitive invalidation and
supersession. Its recovery checks prove that a successor can be structurally
fresh while activation and gate closure remain denied.

The validator performs no network, credential, service, browser, phone,
production, or filesystem action beyond reading this package and controlling
repository contracts.
