# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.3

**Status:** standalone architecture; auditable but not implementation authorization.  
**Priority:** Custodial production first. **Canary target:** one phone only after all design, release, and physical gates—not from today.

## 1. Authority and bounds

V4.3 replaces v4.2 as the top-level architecture. It retains valid doctrine, not existing hybrid implementation: a permanent named employee identity; scoped manager and Read Only products; contractor and disabled guest boundaries; native NFC; approved schedule/version discipline; Event notice distinct from operational impact; provider-reconciled notifications; GPS only in an active cleaning session; immutable evidence plus correction; and a complete rollback/physical admission requirement.

It authorizes architecture research, fixture design, and independent audit only. It blocks product/backend/native work, schema/DDL, migrations, builds, APKs, phones, deployment, canary, fleet, and production. A current source behavior is evidence, never an automatic compatibility obligation.

## 2. System invariants

1. Every mutation has an admitted named principal or service principal, canonical command, authorization decision, authority set, idempotency key, and immutable record.
2. The authoritative answer to “who did what, when, where, and under what policy” derives from preserved original facts, never present-day identity or location.
3. A resolver has one canonical authority-set-pinned input graph. A projection may not silently calculate competing ownership/status.
4. Unknown, missing, stale, cross-set, revoked, or incompatible work fails closed: it is refused, quarantined, or shown truthfully as UNKNOWN/OPEN; it is not reassigned or guessed.
5. User interface is a projection, never authority. Historical v17 UI is evidence, never the current product design.
6. A correction appends a corrected interpretation linked to immutable original evidence; it never edits the original.
7. An external provider receipt is delivery evidence, not a database transaction or user acknowledgement.
8. A release, rollback, restore, and physical proof are valid only against one exact release tuple.

## 3. Evidence and gates

The evidence manifest and gate registry are sole control planes. Their vocabulary has no “closed means authorized” ambiguity: an architecture artifact may be READY_FOR_AUDIT; any unpassed dependent stage remains blocked. Changed identity, policy, generation, tuple, fixture, or hash invalidates dependent evidence.

## 4. Canonical objects and records

The object registry defines every normative aggregate, command family, resolver, projection, worker, adapter, assertion, physical family, and legacy object. The record registry gives every target record class a stable type/version, owner, ordering, compatibility, replay, retention, adapter, retirement, failure behavior, and fixture. No generic application SQL boundary exists: application and workers invoke only admitted commands. A separately approved, time-bounded migration operator may execute only a signed migration manifest.

## 5. Principals, grants, and tool plane

The principal registry is normative. Human actor, device, credential, session, delegated tool, worker, and high-risk operator are distinct. Every request is evaluated against exact resource, command, temporal scope, actor/device/assignment/credential snapshots, grant revision, and authority set. Anonymous full MCP writer mode is retired. MCP, AI, repair, and diagnostic tooling uses a named authenticated principal with server-enforced allowlists; AI is read-only by default and general AI write is disabled. Shared service-role fallbacks are prohibited target architecture.

## 6. Authority-set protocol

An immutable authority set binds the dependency graph: record schemas; command/projection/worker versions; policy and approved-source bundle; location/tag/workload/ownership/occurrence definitions; grant registry; retention; migration and release manifests. The Authority Set Registry defines generations, fences, compatibility, activation, drain, quarantine, rollback, and evidence. Consumers reject a mismatched generation. No queue, lease, session, offline envelope, provider intent, or release assertion is unpinned.

## 7. Employee identity, device, offline operation

Employee identity is permanent and never reconstructed from a current device assignment. Enrollment creates a named identity, device credential, assignment epoch, and recovery state. Reassignment is a fenced transaction: discover protected pending work; either finish under the original envelope while compatible and authorized, or seal and quarantine it for manager recovery. It never changes original actor. Revocation/quarantine blocks local key use and all new upload; recoverable encrypted evidence is retained under policy.

An offline local operation captures original actor, credential, device, assignment epoch, session, occurrence, ownership revision, location lifecycle version, authority set, trusted-time/boot generation, scan/form evidence, nonce and idempotency key. Synchronization verifies all snapshots. Clock/reboot uncertainty is represented and bounded; it never becomes fabricated server-time activity.

## 8. Location and NFC lifecycle

Location is an effective-time immutable lifecycle: create, rename/alias, tag bind/unbind, split, merge, retire, restore. A transition names effective time, predecessor/successor map, tag disposition, approval, and in-flight rule. New work resolves only a location valid at operation time; a split/merge/retire cannot silently reinterpret an open session. NFC is native ambient intake, not QR/barcode UI. A tag mismatch, unreadable tag, unknown tag, or unavailable NFC cannot create completion; it follows the manager-supported manual recovery contract.

## 9. Product and projection boundaries

Employee product is a bounded native Custodial runtime: current assignment/occurrence, start/complete, native NFC, a minimal issue/help path, and admitted non-audio alert presentation. It excludes Weather, attendance, scanner/QR, admin, diagnostics, generic AI, legacy Today/Report routes, and alternate identity/queue owners. Manager, Read Only, contractor, guest/Marketing projections have independently registered fields/routes/assets/API allowlists. Read Only has no command grant. Guest and Marketing remain disabled. The product registry is a required later design artifact; this architecture establishes the negative boundary.

## 10. Approved schedule, ownership, and service occurrence

Only an approved source artifact with digest, provenance, effective date, and decision record may publish a static baseline. The candidate workbook is not authority. Policy/source gaps (hours, Sunday, lunch, OPEN, split/cross-midnight, positions, workload, frequency, route, and taxonomy) remain gates. Their affected values are not inferred.

The canonical ownership compiler deterministically publishes immutable, effective-time ownership facts from the admitted baseline/policy/exception set. Individual location is the final assignment unit. OPEN and not_required are explicit states, not blank ownership. A single authority-set-pinned resolver returns owner, reason, revision, and status inputs; all projections consume it.

A service occurrence is the canonical root for requirement, window, ownership snapshot, session, completion/satisfaction, correction, reopening, inspection, notification, and readiness. Expected version/concurrency prevents duplicate satisfaction. Next-cycle occurrence creation is serialized against satisfaction/correction. The system distinguishes not reached, incomplete/poorly cleaned, blocked, awaiting inspection, not required, and unknown only when an approved truth table exists; otherwise it fails truthful/unknown.

## 11. Sessions, completion, evidence, and issue work

A session binds a person/device to one occurrence and location version. Completion validates active session, compatible authority set, expected occurrence revision, evidence, and authorization. Evidence is immutable and content-addressed. A manager correction references prior evidence and has reason, authority, and dual approval where policy requires. One-time work requests and issues may create follow-up; they do not mutate published normal ownership without a distinct admitted ownership command.

## 12. GPS

Raw GPS acquisition is permitted only after an active session is admitted, while session/device/authority/location remain valid, and only for the purpose/policy scope. It stops at completion, cancellation, device/credential revocation, session end, or uncertainty. Out-of-session input is rejected. Raw retention, summary, holds, calibration, dispute, and battery thresholds remain G-GPS/G-RETENTION decisions. No collection occurs before those gates and physical proof.

## 13. Notification and communications

Notification uses separate immutable child intents, recipient/device eligibility snapshots, presentation groups, provider receipts, device presentation state, acknowledgement, cancellation, escalation, and worker attempts. Provider send and database commit are reconciled rather than called exactly-once. Reconciliation handles crash-after-provider, duplicates, stale owner/device/epoch, group-child divergence, and visible cancellation. Audio never preempts by default; approved operational alerts require a non-audio equivalent (visual, vibration where enabled, persistent accessible text, and acknowledgement path).

Communications are classified as ordinary message, Event notice, broadcast, operational alert, escalation, or emergency instruction. A classification controls audience, authority, persistence, acknowledgement, and interruption semantics; it does not infer emergency policy.

## 14. Messenger and Event

Messenger separates thread membership, message fact, user visibility, deletion/tombstone, external delivery, hold, purge, restore, and presentation. Hide is viewer-scoped; delete/reappearance/restore are explicit policy-gated transitions with participant and hold checks. A hold blocks purge across primary store, attachments, object storage, backups, exports, and restore ledger. A restored item is redacted or withheld according to current hold/policy and cannot silently reappear.

An Event revision command requires expected revision. An Event notice is informational unless a separately proposed operational impact names occurrence/ownership effect, candidate diff, approver, approval expiry, and reversal plan. Cancellation creates compensating reversals and cancellation notices; it never silently mutates the day.

## 15. Contractors and exceptions

Contractors are neither pseudo-employees nor generic managers. An engagement may offer a named worker or accountable vendor slot; acceptance, partial acceptance, rejection, abandonment, substitution, expiry, and link loss are first-class facts. Until an accepted compatible assignment exists, affected responsibility is explicit OPEN (or unchanged if policy says so); it is never fabricated coverage. NFC manual recovery, communication, manager interruption/cancel/takeover, and restore/redaction exceptions are governed by the operational exception contracts.

## 16. Retention, analytics, and DR

An information class governs primary records, attachments, object storage, provider identifiers, local stores, exports, backups, restored copies, holds, purge, redaction, and access. Immutable evidence has a separate writer boundary; corrections append. Analytics are confidence-qualified, purpose-limited, and exclude prohibited employee ranking/comparison absent approved policy. Restore is a controlled, evidenced operation that reconciles object storage, backup coverage, holds, purge/redaction ledger, authority sets, pending local work, notification provider state, and release admission.

## 17. Legacy retirement and release

Legacy writers, resolvers, triggers, crons, APIs, tools, shells, and generated artifacts are not compatibility architecture. The retirement manifest inventories them before a target can activate; selected unconfirmed inventory is OPEN_RESEARCH, so no claim of completeness is made. Legacy-only paths may be RETAINED_ROLLBACK only with scope, fence, expiry, owner, negative test, and retirement gate.

A release tuple binds all artifacts. Build 22 remains retained rollback until a successor has compatible data/authority-set rollback, object-store restore, and pending-local-work proof. Rollback ordering is defined in the DR contract; an app downgrade alone is not rollback proof.

## 18. One-phone canary path

The short path closes shared foundations once, not 252 independent projects: (1) evidence/trace/object lint; (2) principal/MCP/record/authority-set controls; (3) occurrence/ownership/offline/location; (4) product isolation/notification/retention/rollback; (5) only canary-slice operating policy and physical fixtures. Structure-changing policy gates remain blockers for the affected canary scope. No calendar promise is authorized until those gates have passed.

