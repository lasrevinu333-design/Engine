# Memphis Zoo Custodial Program — Production Truth Addendum v4

**Status:** SELECT-only SCH2 architecture reconstruction; no implementation authorization  
**Prepared:** 2026-08-04

---

## 1. Scope and safety

This addendum records the deployed SCH2 preview/publish/rollback path. No preview, publish, rollback or schedule mutation was invoked.

---

## 2. SCH2 is an alternative scheduler, not the canonical target

SCH2 provides substantial engineering mechanisms:

- input hashing and preview-run reuse;
- separate generation runs, work items, candidate scores and solution assignments;
- audit and current-versus-preview diff;
- service-role confirmation for publish/rollback;
- transaction/advisory locking;
- stale-preview input check;
- pre-delete snapshot for rollback;
- row-count verification;
- explicit `OPEN` when no candidate exists;
- publish-audit history.

These are useful patterns. They do not make SCH2 the correct foundation.

---

## 3. SCH2 still uses group-level work items

`sch2_build_work_items` creates work items from:

- existing mutable `daily_schedule_assignments`; or
- mutable `coverage_templates` when a day has no daily rows.

The authoritative unit remains `location_group_id`, segment, time and purpose. It does not expand to individual location responsibility before solving.

Consequences:

- mixed restroom/non-restroom groups remain indivisible;
- one group move can alter unrelated locations;
- group membership remains current/mutable rather than snapshotted;
- historical replay can change after membership edits;
- `OPEN` remains group-level rather than exact-location/interval truth.

The canonical target must use location-level service occurrences and ownership intervals.

---

## 4. SCH2 re-optimizes required work rather than enforcing static-first minimal change

The preview:

- computes candidate route and dynamic workload scores;
- targets average required load and required group count;
- iterates required work items by load/restroom/time/bundle;
- selects the highest balanced candidate;
- treats original owner as a late tie-breaker after balance and route metrics.

This means valid static ownership can move to produce a better aggregate score. That conflicts with the current doctrine:

1. preserve unaffected static ownership;
2. move only work made invalid by a real exception;
3. optimize geography/workload among the necessary moved locations.

The SCH2 scoring/preview implementation therefore cannot be imported unchanged.

---

## 5. SCH2 contains hard-coded policy and person-specific behavior

Examples in deployed SCH2:

- employee code `EMP002` is hard-rejected from opening or non-restroom work outside a specific 9:45–18:00 restroom/late-coverage window;
- route zones are hard-coded by group code;
- Bonobos/Splash Pad/Event Center grouping is hard-coded;
- Primate Canyon and Cat Country are hard-coded as response-only/may-be-open;
- gift-shop reminder rules are hard-coded;
- Herpetarium Wednesday tags are hard-coded;
- required/scan-required behavior is inferred from group codes and purpose strings.

These rules may encode valid operational knowledge, obsolete assumptions or test/demo repairs. They are not an approved versioned policy source.

Target disposition:

- research each rule;
- classify as location/service policy, static schedule rule, restriction/accommodation, event bundle, optional response-only work or obsolete artifact;
- migrate accepted rules to generic versioned data;
- retire person-code and group-code policy inside solver SQL.

---

## 6. SCH2 input hash is incomplete and non-canonical

`sch2_input_hash` hashes an MD5 of JSON text built from:

- mutable daily assignments;
- mutable roster;
- absences;
- manual locks.

It does not include the complete logical input set required by the target architecture:

- static source/version/membership snapshot;
- location registry/classification;
- operating-policy and service-frequency revisions;
- workload/route/restriction revisions;
- contractor engagement/acceptance;
- event/after-hours approved requirement;
- manager/emergency inputs;
- compiler version and canonical serialization contract;
- identity/position occupancy revision;
- authority-set compatibility.

MD5 over PostgreSQL JSON text is also not the target `canonical-json.v1` + SHA-256 contract.

A reused SCH2 preview may therefore be stable relative to an incomplete/mutable input view while relevant policy changed elsewhere.

---

## 7. SCH2 publish is transactionally stronger than legacy force generation but still destructive legacy publication

`sch2_publish_solution` has useful protections:

- service-role guard for confirmed publish;
- advisory lock;
- stale-preview hash check;
- audit/hard-violation/open-required/count checks;
- snapshot of previous rows;
- transactional delete/insert;
- expected/actual row-count verification;
- published-row audit.

It still:

- deletes all daily assignments for the service date;
- writes group-level mutable daily rows;
- blocks publish when required work remains `OPEN`, even though the target architecture requires explicit manager-visible `OPEN` when no eligible owner exists;
- records `current_user` rather than a canonical named-manager actor/approval chain;
- does not atomically publish canonical location ownership, service occurrences, transition events, notification intents and one authority pointer;
- does not bind to an operational authority set.

The transaction/snapshot/fault-check patterns should inform the canonical publication design. The legacy target table and all-day replacement semantics should not.

---

## 8. SCH2 rollback restores bytes, not a complete authority set

`sch2_rollback_publish`:

- service-role guards and locks;
- deletes current daily rows for the date;
- restores JSON-snapshotted prior rows;
- marks audit/run rolled back.

It does not roll back:

- notifications already sent/presented/acknowledged;
- employee/manager projections and caches;
- AI answers or analytics facts;
- ownership/status events outside the daily table;
- contractor/event implications;
- client offline snapshots;
- schema/model version compatibility.

The target rollback must restore a complete compatible authority set/publication and preserve post-publication evidence for reconciliation.

---

## 9. SCH2 `OPEN` policy conflicts with target explicit coverage truth

The preview correctly creates `OPEN` when no eligible candidate exists. Confirmed publish refuses any required `OPEN` row.

The target architecture requires `OPEN` to be publishable when truthful:

- coverage is required;
- no eligible employee/accepted contractor exists;
- manager must see/escalate the gap;
- inventing an owner is prohibited.

Publication should block unexplained conflicts and missing rows, not a legitimate explicit `OPEN` result. Policy may require manager acknowledgement or escalation before/with publication.

---

## 10. Migration disposition

### Retain as patterns

- preview separate from publication;
- input fingerprint/reuse concept after complete canonical inputs;
- exact diff and audit;
- advisory/transactional locking;
- stale preview rejection;
- snapshot and rollback evidence;
- row-count/completeness validation;
- candidate explanation;
- explicit no-candidate `OPEN`.

### Rebuild

- work item unit;
- input snapshot/hash;
- static preservation objective;
- workload/route policy source;
- actor/approval;
- publication tables/events/outbox/pointer;
- `OPEN` handling;
- complete rollback.

### Retire after cutover

- SCH2 group-level preview/publish/rollback as production schedule authority;
- person-code/group-code hard policy;
- all-day daily-row replacement.

---

## 11. Architecture consequence

Unified Architecture v4.1 already specifies the target differences:

- location-level authority;
- complete versioned input/authority set;
- static-first minimal movement;
- structured restrictions and person-bound rules;
- explicit publishable `OPEN`;
- canonical serialization/SHA-256;
- named actor and exact diff;
- atomic ownership/transition/notification publication;
- complete authority rollback.

Independent auditors should use SCH2 as a false-confidence attack case:

> A preview/publish system can be transactionally careful and still optimize the wrong unit, use incomplete inputs and preserve the wrong operating model.

No production state was changed by this research.