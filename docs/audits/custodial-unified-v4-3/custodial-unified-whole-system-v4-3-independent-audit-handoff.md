# V4.3 Independent Audit Handoff

Audit this directory as standalone authority. Do not treat v4.2 addenda or code existence as controlling. The v4.2 duplicate-CAP claim is explicitly rejected by E-PREFLIGHT-001; recheck the v4.3 MAIN trace independently.

Required checks:

1. Trace has CAP-001–CAP-252 exactly once, with all 18 required inspectable columns.
2. Every object in the architecture and registries has an object-registry row and CAP/user/purpose/evidence/failure/proof/gate map; no orphan/unstated legacy compatibility.
3. Gate vocabulary is singular; audit authorization is distinct from design/release authorization.
4. Evidence identity, hashes/pins, status, supersession, and invalidation resolve.
5. Record registry covers commands, facts, events, corrections, evidence, intents, attempts, decisions, migration, and release assertions.
6. Authority-set graph/fencing, compatibility, pinning, drain/quarantine, partial deployment, activation, and rollback are executable.
7. Principal boundaries retire anonymous MCP/full writer and generic application SQL; test deny-by-default.
8. Offline original actor/device/location, occurrence, NFC recovery, GPS, notification, Messenger, Event, immutable evidence, retirement, and DR contracts fail closed.
9. Every open policy/research/physical item is a named gate—not fabricated architecture—and canary/design remain blocked accordingly.
10. V17 and workbook are correctly treated as evidence only.

Report confirmed facts, inferences, and unobserved claims separately. Do not claim a live deployment exposure, physical failure, or incident without appropriate evidence. Architecture audit may mark artifacts PASSED or FAILED; it cannot authorize DDL, implementation, build, device, or production.

