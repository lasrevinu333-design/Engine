# Legacy Authority Retirement Manifest v1

**Status:** normative retirement protocol; inventory completeness is OPEN_RESEARCH under G-RETIRE-001. This is not a claim that every live authority has been observed.

## Target prohibitions

- Anonymous or malformed-client full MCP access: RETIRED target behavior.
- Application-runtime arbitrary SQL/migration capability: RETIRED target behavior.
- Shared service-role fallback for manager/device/tool work: RETIRED target behavior.
- Current-state reconstruction of original offline actor/device/location: RETIRED target behavior.
- Competing ownership/status resolvers and read-side mutation: RETIRED target behavior.
- Legacy employee shell/routes, QR/barcode scanning, Weather/attendance/admin/diagnostic exposure: RETIRED target behavior.
- Unreachable Event schedule writer: RETIRED target behavior.
- General unrestricted evidence update/delete authority: RETIRED target behavior.

## Inventory and retirement contract

| Family | Known evidence | Target disposition | Required closure evidence | Fail-closed / gate |
|---|---|---|---|---|
| MCP/server/tool writers | backend auth and MCP server source | RETIRE/REBUILD | endpoint, tool, caller, grant, config attestation, negative client inventory | deny unregistered tool; G-PRINCIPAL-001, G-RETIRE-001 |
| SQL/RPC/functions/triggers | frozen migrations and production truth selected samples | RESEARCH then RETIRE/REBUILD | definition, owner, search path, grants, callers, digest, replacement | fence/deny legacy caller; G-RETIRE-001 |
| cron/queue/worker | selected schedule, purge, Messenger/alert evidence | RESEARCH then RETIRE/REBUILD | schedule, lease, queue, service principal, set pin, replacement | stop without compatible worker; G-RETIRE-001 |
| APIs/routes/projections | frozen frontend/backend route evidence | RETIRE/REBUILD | route, method, field, product, caller, replacement | deny route/asset; G-PRODUCT-001 |
| legacy resolver/publication | v4.2 ownership/history evidence | RETIRE/REBUILD | input/output/side effect and canonical resolver comparison | no fallback; G-OCC-001 |
| generated SQL/data artifacts | candidate/generated seed evidence | QUARANTINED | immutable artifact inventory and admission disposition | never execute; G-RETIRE-001 |
| Build 22 / old APK | rollback baseline | RETAINED_ROLLBACK | exact scope, compatibility, expiry, physical downgrade/recovery proof | cannot receive target writes; G-BUILD22 |

Each manifest entry needs stable RET ID, owner, source identity/digest, affected object/CAPs, caller graph, replacement, authority-set fence, retirement step, rollback treatment, expiry, automated negative test, physical test where relevant, and acceptance evidence. “No known callers” is not retirement proof.

Retirement sequence: inventory → install target reader/command → fence new legacy admission → drain or quarantine pinned work → prove old clients/paths fail safely → remove or disable authority → keep only approved rollback artifact → retire rollback artifact after successor proof. Any unexpected writer, resolver, trigger, cron, API, or tool discovered after activation invalidates release admission.

