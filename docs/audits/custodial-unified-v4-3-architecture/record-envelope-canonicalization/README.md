# Custodial v4.3 Phase-1 Record Envelope and Canonicalization

**Status:** `DRAFT_REMOTE_PHASE_1`  
**Authority:** architecture candidate only  
**Downstream design, implementation, migration, APK, phone, canary, release, and production:** **CLOSED**

This package completes the remaining Phase-1 common-record-envelope and `canonical-json.v1` foundation defect identified during Programmer 1 review. It is not a prose addendum and it does not authorize Phase 2.

## Controlling rule

`record-envelope-contract.json` replaces the record-envelope semantics formerly summarized in:

- `../phase1-foundation-registry.json#/record_envelope`
- `../phase1-foundation-registry.json#/records/*/canonical_serialization`

Those old values remain immutable evidence of the reviewed base. They are not a second authority. Any later schema, component, API, migration, local-store, replay, projection, offline, or release design that consumes the superseded summary instead of this contract fails closed.

## What is now exact

The contract defines:

- all mandatory and conditional cross-domain record semantics;
- original actor and original authorization binding, including delayed/offline work;
- authority-set, domain, aggregate, valid-time, recorded-time, occurrence-time, operation, source, lineage, classification, digest, producer, replay, projection, and unknown-version behavior;
- the complete `canonical-json.v1` byte contract;
- Unicode NFC, Unicode-scalar key ordering, duplicate-key rejection, NFC-key-collision rejection, registered semantic array ordering, fixed UTC timestamps, America/Chicago service-date/day-offset and DST rules, canonical decimal strings, distinct null/missing/empty semantics, and non-self-referential SHA-256 identities;
- per-record strengthening rules that prohibit field removal, type widening, condition weakening, current-state substitution, unknown-version coercion, and alternate canonicalization;
- direct schema mutation and adversarial semantic attacks.

## Files

- `record-envelope-contract.json` — controlling machine-readable semantics.
- `record-envelope-contract.schema.json` — strict schema.
- `record-type-strengthening-map.json` — exact current Phase-1 record-profile coverage.
- `conformance-fixtures.json` — positive and negative byte/semantic fixtures.
- `validate-record-envelope-canonicalization.mjs` — deterministic validator and result generator.
- `validation-result.json` — generated receipt; evidence only.
- `research-plan-audit-replan.md` — source research, initial plan, attack, and corrected plan.
- `stage-decision.json` — append-only hold; it grants no downstream authority.
- `package-manifest.json` — exact package membership and hashes.

## Deterministic verification

```bash
node docs/audits/custodial-unified-v4-3-architecture/generate-architecture-projections.mjs --check
node docs/audits/custodial-unified-v4-3-architecture/validate-architecture-foundation.mjs --check
node docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/validate-record-envelope-canonicalization.mjs --check
```

The dedicated GitHub workflow also runs inherited v4.3.2 governance before these validators.

## Exit gate

This package remains on **HOLD** until the exact applied commit:

1. passes inherited governance, the existing Phase-1 validator, and this validator;
2. has all matching GitHub Actions and Gmail failure notices reconciled;
3. receives a fresh post-apply review with zero unresolved BLOCKER or HIGH findings.

No later stage may infer approval from a green receipt.
