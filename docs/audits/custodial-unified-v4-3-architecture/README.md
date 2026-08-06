# Custodial Unified v4.3 — Standalone Architecture Foundation

**Status:** Phase 1 foundation ready; architecture content is not yet approved  
**Revision:** v4.3.2  
**Source branch:** `agent/custodial-v432-h05-gate-order-correction-20260806`  
**Source commit:** `569dc25c11723801a212de489dced7da776d5be7`  
**Foundation branch:** `agent/custodial-v43-standalone-architecture-remote-20260806`  
**Implementation authorization:** NONE

## Purpose

This directory is the isolated build boundary for the standalone v4.3 architecture candidate. Phase 1 creates only the package contract, strict schema, foundation manifest, fail-closed validator, negative fixture, validation receipt, and rollback instructions. It does not turn planning prose into implementation authority.

## Earliest invariant

One immutable source identity and one explicit package contract must control every later architecture artifact. A report, workflow result, branch name, or mutable validation receipt cannot silently redefine package membership, stage authority, or implementation authorization.

The immutable package manifest designed in a later phase must not contain its own digest, its containing commit, or mutable lifecycle state. Exact freeze identity and member digests belong in a detached attestation.

## Required architecture outputs

The foundation contract requires later phases to provide all of these as independently lintable architecture artifacts:

1. content manifest and detached package attestation;
2. architecture-object registry;
3. joined CAP-001 through CAP-252 trace and generated reverse registry;
4. record-type and version registry;
5. principal, credential, grant, service-principal, and tool registry;
6. authority-set dependency, compatibility, activation, and rollback model;
7. original-actor offline-operation and completion-acceptance contract;
8. service-occurrence and location-transition command/state model;
9. writer, resolver, trigger, cron, API, and tool retirement manifest;
10. whole-system rollback and restore-bundle contract;
11. operational exception contracts;
12. gate-to-design-impact matrix;
13. validation and physical-proof catalog.

Missing or placeholder artifacts fail closed. Phase 1 does not fabricate these artifacts or mark their gates closed.

## Foundation members

- `architecture-foundation-build-contract.json`
- `architecture-foundation-build-contract.schema.json`
- `architecture-foundation-manifest.json`
- `architecture-foundation-rollback.md`
- `validate-architecture-foundation.mjs`
- `fixtures/invalid-missing-required-output.json`
- `validation-result.json`
- `.github/workflows/custodial-v43-architecture-foundation.yml`

## Validation

Run:

```bash
node docs/audits/custodial-unified-v4-3-architecture/validate-architecture-foundation.mjs --check
```

The validator uses only Node standard-library APIs. It checks exact protocols, branch/base identity, strict object keys, required member paths, complete required-output categories, duplicate identifiers, placeholder markers, the negative fixture, and the committed validation receipt. Any unknown, missing, malformed, duplicated, or stale input exits nonzero.

## Safety boundary

This branch is documentation-only. It changes no application source, database schema, migration, backend, native client, APK, phone, Fully Kiosk device, production service, release, or stage authority. It creates no PR and does not merge to `main`.

## Rollback

The branch is isolated and introduces no runtime state. Recovery is described in `architecture-foundation-rollback.md`; rollback is removal or abandonment of this branch after preserving any required review evidence.
