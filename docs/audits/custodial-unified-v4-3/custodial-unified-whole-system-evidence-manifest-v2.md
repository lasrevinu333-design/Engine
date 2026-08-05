# Evidence Manifest v2

**Status:** controlling evidence identity, precedence, supersession, and invalidation register.  
**Rule:** no decision may use evidence absent from this register.

## Precedence and state

Precedence: explicit current Zoo/management decision; approved operating policy; accepted v4.3 decision record; valid v17 outcome; frozen source/read-only evidence; correctly scoped test; bound physical evidence. Lower evidence may reveal a defect but cannot silently override higher authority.

| ID | Identity | Digest / pin | Status | Allowed use | Supersession / invalidation |
|---|---|---|---|---|---|
| E-V42-FREEZE | Engine v4.2 | `be01c7b382da14e0e98375ee7a03e88c26ee598c` | RETAINED_EVIDENCE | doctrine/current-source discovery | superseded as architecture by this directory |
| E-BACKEND-FREEZE | backend | `0fff8c2cadea132902df22c99593f1ce348411a7` | RETAINED_EVIDENCE | route, worker, SQL and security discovery | never target authority by existence |
| E-REC-001 | six-report reconciliation | result `01_v42_six_report_reconciliation.txt` | ACCEPTED | finding disposition | invalidated only by newer immutable reconciliation |
| E-PREFLIGHT-001 | mechanical preflight | evidence `02_v42_mechanical_preflight.txt` | ACCEPTED | CAP uniqueness and reference resolution | re-run on every trace edit |
| E-MAP-001 | two-week map | evidence `03_v42_two_week_delivery_map.txt` | PLANNING_ONLY | bounded canary sequencing | invalidated by scope/foundation change |
| E-AUD-01..04 | four v4.2 audits | evidence `01,04,05,06_*Audit.txt` | ACCEPTED_FINDINGS | defect evidence | reconciled by E-REC-001 |
| E-V17-001 | v17 PDF | SHA-256 `45301cf19ff6155181ce80cea6b8334cbf716be5cda87ee8433a1109bc1dd6df` | HISTORICAL_EVIDENCE | outcomes and screenshot disposition | never current UI authority |
| E-SCHED-001 | candidate workbook | SHA-256 `f9eba54e274cd1b792545770de6fb17e9e25fee989aca18f65250d433f599e40` | CANDIDATE_ONLY | research questions | cannot seed, publish, or close a policy gate |

## Evidence protocol

An evidence item records immutable identity, acquisition time, sensitivity class, owner, validator, exact status, hash/pin, dependent gates, and superseded-by identity. A changed artifact hash, source pin, schema/authority-set generation, app/backend build, device/OS/Fully-Kiosk/tag fixture, policy value, or test harness version invalidates every dependent PASSED or READY_FOR_AUDIT assertion. The assertion changes to OPEN_TECH (mechanism), OPEN_RESEARCH (fact), OPEN_POLICY (decision), or NOT_STARTED as applicable; it never remains silently green.

Sensitive credentials and secret values are not evidence and must never be included. Research into deployed configuration uses a non-secret attestation and an untrusted-client negative result only.

## Release tuple binding

A physical or release claim is valid only against `(authority_set, app build digest, backend digest, schema/migration manifest digest, policy bundle digest, release manifest digest, device model, OS, Device Security/Fully Kiosk configuration digest, NFC tag revision, fixture version)`. A mismatch invalidates the claim.

