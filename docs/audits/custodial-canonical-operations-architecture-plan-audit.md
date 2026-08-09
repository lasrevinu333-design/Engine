# Memphis Zoo Custodial System — Canonical Operations Architecture Plan Audit

**Status:** Internal adversarial plan audit, pass 1  
**Prepared:** 2026-08-03  
**Plan audited:** `docs/audits/custodial-canonical-operations-architecture-plan.md` at commit `c5690afdb81f29158b199405fae4c8a719ee2901`  
**Audit mode:** read-only source/database research; documentation changes only  
**Implementation authorization:** none

---

## 1. Pass-1 verdict

### **NO-GO FOR IMPLEMENTATION**

### **ACCEPTED DIRECTION, REPLAN REQUIRED**

The plan correctly rejects the current split ownership model and establishes the right primary foundation:

- versioned static schedule as normal authority;
- exception-only dynamic change;
- individual-location responsibility;
- immutable baseline;
- explicit transitions;
- one canonical resolver;
- one notification intent architecture;
- native NFC and active-session GPS ownership;
- durable audit history;
- no patch-based migration.

However, the first plan leaves several collision, correction and recovery rules insufficiently explicit. Implementing it as written would still force developers or database functions to invent behavior at edge cases. That would recreate consumer-specific precedence under a cleaner name.

The required repairs below must be incorporated before independent architecture audit.

---

## 2. Audit method

The plan was challenged against:

- the approved static-schedule operating model;
- current group and Sunday location templates;
- mixed exhibit/restroom groups;
- lunch and shift-end behavior;
- absence and CoverAll flows;
- employee/device lifecycle;
- NFC and offline cleaning states;
- active-session GPS requirements;
- due/overdue resolution and manager escalation;
- event and Messenger delivery;
- retention and historical accountability;
- rollback and release requirements;
- low-technology employee usability.

For each case, the audit asked:

1. Is there one unambiguous authority?
2. Is the transition deterministic?
3. Can it be replayed historically?
4. Can it recover after network/process failure?
5. Does it preserve the true operating purpose?
6. Does it avoid requiring employee interpretation?
7. Does it fail closed instead of guessing?

---

## 3. Pass-1 findings

## BLOCKER 1 — Simultaneous transition ordering is not fully specified

The plan lists hard constraints and several event types but does not fully specify how simultaneous or overlapping events are ordered.

Examples:

- lunch starts at the same instant an employee’s shift ends;
- a manager override begins exactly at 9:45;
- an absence is published after the daily baseline but before the 9:45 phase;
- a CoverAll slot is removed while it owns active intervals;
- operating hours close while a session remains active;
- employee eligibility ends while a manager override names that employee;
- two manager corrections target the same location and effective time.

Without one ordering rule, separate components can still choose different winners.

**Required replan:** define event ordering using effective time, authority rank, publication sequence and stable event ID. Define collision rejection where two events of equal authority cannot both be valid.

---

## BLOCKER 2 — Correction history needs bitemporal semantics

The plan preserves published history, but it does not distinguish clearly between:

- when a responsibility was operationally effective; and
- when the system learned, published or corrected that fact.

A manager may correct yesterday’s responsibility today. Historical reports must be able to answer both:

- “What did the system believe yesterday?”
- “What is the corrected operational truth for yesterday?”

Simple superseded rows are insufficient for reliable audit and dispute reconstruction.

**Required replan:** add effective-time and recorded-time/version semantics. Corrections append a new assertion and never erase the prior assertion.

---

## BLOCKER 3 — Active session versus ownership transition is not resolved

The plan separates owner from cleaner but does not fully define what occurs when ownership changes during an active cleaning session.

Examples:

- employee starts cleaning before lunch and lunch begins;
- employee’s shift ends while the session remains open;
- manager transfers the location during the session;
- device is reassigned while offline work is pending;
- session begins offline under an ownership version that is superseded before reconnection.

The system must not terminate valid cleaning work, transfer historical responsibility silently, or let an obsolete session authorize future actions.

**Required replan:** define session binding to start-time owner/assignment epoch, transition behavior, manager exception state, completion acceptance and post-completion ownership restoration.

---

## BLOCKER 4 — Offline ownership reconciliation is underspecified

The plan defines offline provisional sessions and a canonical resolver but does not define how an offline phone proves the ownership version it used or how the server handles a stale version.

A phone may start work offline after:

- the employee’s responsibility was transferred;
- the device assignment epoch changed;
- a manager override took effect;
- the location became not required;
- another employee already started a session.

**Required replan:** include locally cached signed/current ownership snapshot identity, server reconciliation outcomes, non-destructive conflict handling and manager review rules. Offline work evidence may be accepted without retroactively declaring the employee the owner.

---

## HIGH 1 — Location operational windows are not modeled deeply enough

A general public open/close policy is insufficient for locations that may have:

- exhibit-specific hours;
- splash-pad split hours;
- event closures;
- staff-only coverage windows;
- maintenance shutdown;
- seasonal closure;
- temporary public inaccessibility.

**Required replan:** define versioned location operational-window rules and precedence over general zoo hours.

---

## HIGH 2 — CoverAll link lifecycle is incomplete

The plan correctly treats CoverAll as a contractor, but it does not specify what happens when assignments change after a secure link was issued.

Required behavior includes:

- assignment revision identity;
- automatic supersession/revocation of old links;
- link view showing only current published assignment revision;
- manager proof of link issuance and view access where appropriate;
- no employee push assumptions;
- explicit OPEN if the contractor cannot be reached.

**Required replan:** bind links to contractor assignment revisions and define revision/revocation behavior.

---

## HIGH 3 — Notification dismissal and operational resolution need separate state machines

The plan says manager escalation is independent of employee dismissal, but the state model does not explicitly separate:

- presentation lifecycle;
- employee acknowledgement;
- operational work state;
- manager escalation state.

Dismiss must never mean the location is handled. Open must never mean work started. A cleaning completion must not erase proof that an alert was delivered late or never displayed.

**Required replan:** define four linked but independent state machines and their allowed transitions.

---

## HIGH 4 — GPS evidence retention and privacy boundaries are incomplete

The plan limits GPS to active sessions, which is correct, but it does not specify:

- raw observation retention;
- summarized excursion retention;
- who can view coordinates;
- whether employees can see history;
- export/audit access;
- deletion rules;
- handling of denied/revoked permission;
- whether location failure blocks session start or merely creates a manager exception.

**Required replan:** define minimum-data collection, role access, retention, health exception and fail-safe behavior.

---

## HIGH 5 — Manual override authority and separation of duties are not defined

The plan says manager override is authoritative but does not define:

- who may create it;
- whether Read Only can view but not write;
- required reason;
- maximum duration;
- emergency versus ordinary override;
- second approval for retroactive correction;
- rollback/expiration behavior.

**Required replan:** define role/permission and audit requirements.

---

## HIGH 6 — Migration rollback is too general

The plan requires rollback but does not define the cutover mechanism.

A failed cutover must not produce half of the consumers on canonical ownership and half on legacy ownership.

**Required replan:** define atomic consumer cutover, feature/read version pinning, shadow verification, no dual writes after acceptance, and rollback to a complete prior read model rather than selective endpoint reversal.

---

## MEDIUM 1 — Vacant positions need first-class identity

A future replacement should not inherit Michael or Daniel’s employee identity. The plan mentions vacant positions but does not define them as schedule-owned entities.

**Required replan:** add stable position IDs distinct from employees, with optional current occupant and unfilled/open state.

---

## MEDIUM 2 — Schedule-change notification grouping is not specified

One ownership compilation may change many locations. Sending one alert per location can overwhelm Karen; sending one generic alert can hide what changed.

**Required replan:** define one revision-level notification per employee with exact added, removed and temporary sections, while preserving location-level operational events for due/overdue state.

---

## MEDIUM 3 — Events need explicit interaction with ownership

An event may create operational instructions without transferring ownership, or it may temporarily add/replace responsibility.

**Required replan:** distinguish event notice, event workload exception and event ownership transition. An event record alone must not silently reschedule work.

---

## MEDIUM 4 — Device reassignment lifecycle requires transaction boundaries

Changing an employee phone affects:

- protected credential;
- assignment epoch;
- push registration;
- Messenger identity;
- active/pending sessions;
- notification intents;
- offline queue reconciliation.

**Required replan:** define one transaction/operation with preflight and completion proof.

---

## MEDIUM 5 — GPS direct-coordinate calibration lacks publication workflow

The plan requires direct coordinates but not how they become trusted.

**Required replan:** define field capture, repeated samples, accuracy threshold, manager review, radius selection, effective date and rollback.

---

## MEDIUM 6 — Employee-facing recovery language needs a centralized contract

The architecture identifies plain language but does not establish one mapping from technical states to employee states.

**Required replan:** define a small approved employee recovery vocabulary and require every subsystem to use it.

---

## 4. Requirements already passed by the plan

The following architecture decisions are accepted and should not be weakened during replan:

- static schedule remains normal authority;
- dynamic solver is exception-only;
- normal reads perform zero writes;
- mixed groups compile to individual locations;
- Sunday derivative templates retire as authority;
- lunch is exclusive temporary ownership;
- shift-end inheritance is published, location-specific and time-independent from 9:45;
- no `All Locations` substitution;
- CoverAll is a contractor owner type;
- actual cleaner remains separate from effective owner;
- any scan event cannot clear due/overdue state;
- only accepted completion or manager resolution closes operational work;
- one notification intent replaces duplicate Messenger/native/web alert paths;
- native Android owns NFC, alert presentation and active-session GPS;
- employee Home remains four-button/simple;
- employee app contains no QR or enrollment removal;
- audit workflows remain read-only;
- Build 22 remains rollback until full admission.

---

## 5. Required replan additions

The architecture plan must add explicit sections for:

1. deterministic event collision ordering;
2. bitemporal correction history;
3. active-session/ownership-transition rules;
4. offline ownership snapshot and reconciliation;
5. location-specific operational windows;
6. CoverAll assignment revision/link lifecycle;
7. separate notification, acknowledgement, operational and escalation state machines;
8. GPS privacy/retention/permission behavior;
9. override authorization and retroactive-correction controls;
10. atomic cutover and complete rollback;
11. first-class vacant positions;
12. grouped schedule-change notification contract;
13. event notice versus workload/ownership exception;
14. transactional device reassignment;
15. GPS calibration publication;
16. centralized employee recovery vocabulary.

---

## 6. Pass-1 disposition

The plan is not approved for implementation.

It is approved as the correct foundation direction and may be revised directly. After revision, a second internal adversarial audit must verify that no consumer is still required to invent behavior.

No product, database, build, APK or phone change is authorized by this audit.