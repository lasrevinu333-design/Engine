# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4 Internal Audit

**Status:** Internal adversarial audit of `custodial-unified-whole-system-architecture-v4-draft.md`  
**Prepared:** 2026-08-04  
**Verdict:** REPLAN REQUIRED; do not send draft.1 as final independent-audit candidate

---

## 1. Audit standard

The draft was attacked against:

- current explicit operating decisions;
- Final Report v17 capabilities and images;
- actual frontend/native/backend capability;
- SELECT-only production findings;
- the capability canon and authority register;
- independent GPT-5.3 Spark, GPT-5.5 Pro and GPT-5.5 Instant findings;
- historical GPT-5.6 employee-app failure modes;
- foundation-first/no-bandage doctrine.

The question was not whether the draft is broad. The question was whether a designer could begin isolated schema/component design without silently inventing cross-domain policy, authority or lifecycle behavior.

---

## 2. Verdict

The draft is materially stronger than ownership v3.1 as a top-level architecture. It provides a coherent home for the major program domains and makes several correct architecture choices:

- one permanent employee runtime owner;
- common fact/event envelope;
- explicit product boundaries;
- canonical status/readiness domain;
- event information separated from operational approval;
- notification state machines separated from work truth;
- retention, migration, release and physical acceptance as architecture.

It is not yet ready for independent external audit as the proposed final architecture. Several cross-domain contracts remain ambiguous enough that schema/component designers could create incompatible interpretations.

Replan is required before independent audit.

---

## 3. BLOCKER findings

### BLOCKER-1 — No single operational authority-set manifest is defined

**Symptom**

The draft defines one ownership pointer and describes other truth domains, but it does not define one published operational authority set binding compatible versions of:

- identity/workforce;
- static schedule and operating policy;
- ownership revision;
- workload/route model;
- service taxonomy/frequency;
- status/readiness policy;
- event projection;
- notification contract;
- API/schema/release compatibility.

**Failure mechanism**

Ownership could cut to canonical revision A while Dashboard status, notification planner, AI or employee UI still use incompatible domain versions. A collection of domain pointers recreates split authority unless their compatibility and atomic activation are explicit.

**Why patching is inadequate**

Per-endpoint feature flags or a release-note checklist cannot prove a coherent authority set.

**Required replan**

Define a protected `operational authority set` manifest with:

- stable set ID;
- domain version references and compatibility hashes;
- state: draft/validated/published/retired/rolled_back;
- exact API/schema/release requirements;
- activation transaction/pointer;
- rollback target;
- health evidence.

All production consumers resolve the active set before reading canonical domains. Ownership publication remains frequent within the compatible set, but domain-model cutover is atomic at the set boundary.

---

### BLOCKER-2 — Location identity and lifecycle are absent

**Symptom**

The draft defines tags, group snapshots, workload and operating windows but does not establish a canonical location entity lifecycle.

**Missing cases**

- rename without historical rewrite;
- merge/split of operational locations;
- restroom/exhibit form-type change;
- temporary closure versus retirement;
- multiple NFC tags per location;
- tag movement to a replacement location;
- public versus staff-only classification;
- location eligibility for Dashboard, schedule, events, guest QR and Read Only.

**Failure mechanism**

Different domains may key the same physical place differently or rewrite history after a rename/split.

**Required replan**

Add a location registry and effective-dated location-policy/classification history. Stable location identity survives display-name, group, tag and operating-policy changes. Split/merge creates new identities and explicit lineage rather than rewriting old sessions.

---

### BLOCKER-3 — Operational status model lacks episode creation and next-cycle rules

**Symptom**

The draft defines state dimensions but not precisely how a new service episode is created after accepted completion, policy change, closure/reopen or multiple required service frequencies.

**Failure mechanism**

Designers may treat a status episode as a rolling timer, one episode per day, one per requirement interval or one per completion. Due/overdue, notification dedupe and inspection readiness would diverge.

**Required replan**

Define:

- requirement occurrence/episode identity;
- policy/frequency revision used;
- opening/activation point;
- accepted completion that satisfies the occurrence;
- creation of the next occurrence;
- closure/not-required/cancellation;
- reopen and correction;
- multi-frequency and split-window behavior;
- event/guest/manual urgent episodes and priority relationship.

A due-soon→overdue lifecycle retains one stable episode ID.

---

### BLOCKER-4 — Issue, ticket and work-order lifecycle conflicts with current operating doctrine

**Symptom**

The draft describes ticket closure after work-order submission, while current operational doctrine states ticket status is `OPEN` or `W.O. Submitted`, with `W.O. Submitted` as the current custodial end state.

**Failure mechanism**

A new architecture could invent maintenance completion authority the custodial manager does not possess, or erase the distinction between custodial handoff and Facilities closure.

**Required replan**

Separate:

- custodial observation/issue;
- custodial ticket state (`OPEN` → `W.O. Submitted` as current terminal responsibility state);
- optional external work-order reference/status when integration exists;
- manager correction/duplicate/cancelled-not-an-issue;
- readiness/follow-up policy independent of external completion.

Do not call external maintenance complete unless an authoritative Facilities source is integrated later.

---

### BLOCKER-5 — Employee access to operational reporting is not resolved within the four-button Home

**Symptom**

The draft correctly separates app feedback, maintenance, supply, guest follow-up, work request and emergency, but does not specify how an employee reaches those actions without adding prohibited Home destinations or turning Feedback into the same junk drawer.

**Required replan**

Define access paths:

- maintenance/supply/out-of-order: primarily inside location completion workflow;
- direct manager assistance/emergency: Messages/radio policy, not a new Home tile;
- app/phone/NFC problem: Feedback, with plain categories;
- guest cleanliness follow-up: notification/message-linked action if guest feature is enabled;
- one-time work request: manager creates; employee receives through Messages/notification/current-work context.

No additional Home button is introduced.

---

### BLOCKER-6 — Notification behavior during active cleaning is incomplete

**Symptom**

The draft defines one overlay and Open/Dismiss but not how opening a message/schedule/event behaves while an active cleaning timer or unfinished form exists.

**Failure mechanism**

Open could navigate away and lose context, or the overlay could indefinitely block finishing work. Dismiss may hide urgent ownership change without a persistent current-area update.

**Required replan**

- active cleaning/draft remains protected and recoverable through any alert action;
- Open routes through a session-safe modal or saves/restores exact context;
- urgent location/ownership alert may show action without cancelling session;
- schedule changes update canonical current-area state regardless of presentation choice;
- overlay may be temporarily minimized only through an explicit safe action if required;
- message body is never spoken; only approved sender/type wording;
- alert priority and queue preemption rules are explicit.

---

### BLOCKER-7 — Offline authority and backend outage behavior are not complete

**Symptom**

The draft defines offline provisional starts but not the entire operational behavior during prolonged backend outage, expired snapshot, app update, device clock drift or conflicting server policy.

**Required replan**

Define:

- snapshot issuance cadence and bounded age;
- trusted time/clock-skew handling;
- which operations are allowed offline;
- which reads use last-known data and how staleness is shown;
- queue quotas and storage exhaustion;
- app/schema upgrade of protected local state;
- transient versus terminal error taxonomy;
- prolonged outage manager procedure;
- export/recovery of unreconciled work;
- safe rollback with pending work.

No employee work is silently dropped because the backend or Render is unavailable.

---

### BLOCKER-8 — Migration reconstruction and confidence for historical data are under-defined

**Symptom**

The draft provides shadow/cutover but not how conflicting legacy ownership, mutable daily schedules, Sunday rows and read-side inheritance are migrated without pretending uncertain history is exact.

**Required replan**

Define historical migration classes:

- source-proven exact;
- deterministically reconstructed;
- inferred with confidence/reason;
- conflicting/unresolved;
- intentionally not reconstructed.

Historical analytics and disciplinary use must exclude low-confidence reconstructed responsibility unless separately reviewed. Legacy source rows remain preserved with mapping evidence.

---

### BLOCKER-9 — Availability/SLA and hosting behavior are missing

**Symptom**

The draft covers health and recovery but not service-level targets or hosted dependency behavior. Final Report v17 historical `$0/month` claims and later production evidence about free Render wake/paid always-on requirements create a material operational decision.

**Required replan**

Define:

- availability and response-initiation targets;
- dependency timeout/circuit-breaker behavior;
- backend cold-start prohibition/allowance for production;
- Wi-Fi/offline assumptions;
- monitoring and alert thresholds;
- paid/free infrastructure decision as an operational budget gate, not architecture truth;
- graceful degradation per product.

---

### BLOCKER-10 — No explicit test-data/fixture governance

**Symptom**

The draft requires tests but does not distinguish production identities, sanitized fixtures, synthetic employees and historical named examples.

**Failure mechanism**

Michael/Daniel may remain operationally active to satisfy tests, or tests may mutate production-like rows and encode obsolete policy.

**Required replan**

Define:

- production data never used as mutable test fixture;
- sanitized frozen fixtures with provenance;
- synthetic identities clearly separated from employment/schedule eligibility;
- no production writes from test workflows;
- fixture version tied to policy/route/workload revisions;
- physical test accounts/phones and cleanup rules.

---

## 4. HIGH findings

### HIGH-1 — Common event envelope needs canonical serialization rules

The draft requires hashes but not:

- canonical JSON/number/string/time normalization;
- hash algorithm/version;
- timezone conversion;
- null/empty distinctions;
- stable ordering;
- binary/source artifact handling.

Determinism and release fingerprints require one canonical serialization specification.

### HIGH-2 — Static schedule publication separation of duties is incomplete

The draft allows named-manager validation/publication but does not state whether the importer, validator and publisher may be the same actor. High-risk static policy and retroactive correction should have explicit approval rules.

### HIGH-3 — Read Only default fields remain too broad

The draft leaves approved aggregate/current location status ambiguous. The default should be fail-closed. Employee names, owner reasons and detailed issues should be excluded unless specifically approved.

### HIGH-4 — Inspection rubric versioning and correction are incomplete

The taxonomy/rubric version used by an inspection must be stored. Reinspection, correction, voiding and critical-failure policy require explicit events and actor rules.

### HIGH-5 — Completion correction versus immutable evidence is incomplete

The draft says accepted completion is immutable but does not define how a mistaken form is corrected. Required pattern: original accepted evidence remains; named manager adds a correction/void annotation and resulting status events.

### HIGH-6 — Notification priority and coalescing are incomplete

Schedule changes may affect many locations. The draft needs grouped human-readable notifications, priority classes, coalescing/supersession and limits so Karen is not read twenty individual location alerts.

### HIGH-7 — Manager escalation role selection is unresolved

The current production function selects one manager by display/device ordering. The architecture must use capability/shift/on-call policy and explicit fallback, not one hard-coded “Ops Manager.”

### HIGH-8 — Contractor work acceptance and actual cleaner remain policy-sensitive

The draft supports both named worker and slot but must mark what can be asserted in history when only a slot is known. Analytics cannot display a fabricated individual.

### HIGH-9 — Export/reporting authority is missing

Managers may need schedule, inspection, ticket, staffing and audit exports. Exports require field redaction, purpose, date range, actor, watermark/audit and retention rules.

### HIGH-10 — Upgrade/rollback with pending local work is incomplete

The build chapter requires rollback but not protected local-state schema migration, downgrade compatibility or recovery when Build 23+ has pending work and Build 22 does not understand it.

---

## 5. MEDIUM findings

1. Location aliases and display names need language/localization support.
2. Contractor English/Spanish content requires versioned translation approval.
3. Employee speech/text must support pronunciation overrides for names/locations.
4. Accessibility must include non-audio equivalents for hearing limitations and non-swipe alternatives.
5. Weather/attendance manager data requires explicit stale/unavailable presentation.
6. Event cancellation notifications need supersession rules.
7. Guest report abuse/duplicate handling needs a manager-visible but privacy-safe process.
8. Feedback attachment malware/content validation is named but not technically bounded.
9. Device push-token rotation and provider migration need lifecycle rules.
10. Decommissioned locations/tags need public QR/NFC signage removal evidence.
11. Maintenance/supply taxonomy must not drift from completion forms and analytics.
12. Audit export and backup restore need clock/source consistency checks.

---

## 6. LOW findings

1. Chapter numbering can be consolidated after replan.
2. Cost claims should be separated into a current budget appendix, not architecture invariants.
3. Historical product names such as Ops Manager/Operations Leadership need one final naming glossary.
4. Decorative UI/theme decisions belong in product design specifications after architecture GO.

---

## 7. Confirmed strengths to preserve in replan

- architecture v3.1 imported as ownership subsystem, not discarded;
- one native employee lifecycle owner;
- four-button Home and ambient NFC;
- source/command/compiled/event/projection separation;
- explicit actor/product boundaries;
- session/owner/cleaner separation;
- protected offline snapshots and terminal reconciliation;
- canonical status/readiness domain;
- event notice/proposal/approval separation;
- notification state-machine separation and exact cadence;
- guest feature dormant by default;
- contractor assignment/acceptance separation;
- AI tool registry and default read/propose posture;
- complete retention/migration/release/physical chapters;
- Build 22 rollback.

---

## 8. Required replan sequence

1. Add location identity/lifecycle.
2. Add operational authority-set manifest and atomic domain compatibility.
3. Complete service occurrence/status/readiness episode semantics.
4. Correct ticket/work-order doctrine.
5. Resolve employee reporting paths within four-button Home.
6. Complete active-session notification behavior.
7. Complete prolonged-offline/outage/local-state upgrade behavior.
8. Add historical migration confidence model.
9. Add availability/SLA/dependency architecture.
10. Add fixture/test-data governance.
11. Add serialization, approvals, inspection/completion corrections, notification grouping, escalation roles, exports and rollback-local-state rules.
12. Produce a complete v4.1 architecture rather than an addendum.
13. Reaudit v4.1 internally before external independent audit.

---

## 9. Authorization

- v4 draft.1: **NO-GO as final independent-audit candidate**.
- Research and replan: **GO**.
- Schema/component design: **NO-GO**.
- Implementation/migration/APK/phone/release: **NO-GO**.