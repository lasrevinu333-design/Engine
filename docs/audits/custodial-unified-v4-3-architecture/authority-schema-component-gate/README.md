# Custodial v4.3 authority schema/component gate

This directory is the deterministic, non-phone activation package for the
`AUTHORITY_SET`, `PRINCIPAL`, `CREDENTIAL`, `GRANT`, and `MANAGER_SESSION`
aggregates. It is derived from the exact Phase-2 registries at Engine commit
`26a996fddf70aabff6ab2a526a16425526137e3b`.

The package is deliberately non-activatable. The canonical gate chain begins
with `G-EVIDENCE-001`, which remains `OPEN`; therefore this package cannot close
or supersede `G-EVIDENCE-001`, `G-TRACE-001`, `G-TRACE-LINT`, `G-RECORD-001`,
`G-PRINCIPAL-001`, `G-TOOL-REGISTRY`, or `G-AUTHSET-001`. It contains schemas,
component boundaries, a validation-only reference component, failure/recovery
fixtures, and explicit blockers. It contains no credential material and makes
no production, migration, release, deployment, APK, phone, or merge change.

The source of truth is:

- `phase2-command-record-state-machine-registry.json`
- `phase2-command-and-transition-coverage-ledger.json`
- `phase2-principal-grant-tool-authorization-contract.json`
- the exact Engine and MCP source inventories joined by surface ID

`phase2-authority-set-activation-fencing-rollback-contract.json` is checked for
parity only because it declares itself `SUPERSEDED_BY_EXACT_REGISTRIES`.

Run:

```sh
node generate-authority-schema-component.mjs --check
node validate-authority-schema-component.mjs --check
```

Use `--write` on the generator after changing a controlling input. The
validator's `--write` mode refreshes only `validation-result.json` after all
checks pass.
