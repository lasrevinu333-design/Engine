# Memphis Zoo Custodial Program — Production Truth Addendum v2

**Status:** Additional SELECT-only production reconstruction; no implementation authorization  
**Prepared:** 2026-08-04  
**Companion:** `custodial-unified-whole-system-production-truth-research-v1.md`

---

## 1. Safety and scope

This addendum records additional production scheduler, cron, retention, GPS-status and notification-job behavior found through SELECT-only inspection.

No cron job, function, worker, row, setting or policy was changed or invoked for side effects.

---

## 2. Active scheduled writers and maintenance jobs

Production `pg_cron` currently contains the following architecture-relevant jobs:

| Job | Schedule | Active | Behavior |
|---|---|---:|---|
| Legacy free-tier retention | daily | no | Disabled call to legacy retention wrapper |
| Stale session expiration | hourly at :05 | yes | Cancels stale active/pending sessions without fabricating completion |
| Rolling schedule-window readiness | every 30 minutes | yes | Ensures/generates 14 days of mutable legacy schedules and audits the result |
| Messenger deleted-content purge | hourly at :18 | yes | Physically deletes eligible deleted messages/threads and associated receipts/audit rows |
| Event purge | hourly at :37 | yes | Physically deletes events beyond the configured retention window |
| Guest contact redaction | daily | yes | Removes guest reporter/contact/network metadata after the privacy period |
| Public rate-limit cleanup | hourly | yes | Removes stale public-submission rate-limit records |
| Availability warm bridge | every 10 minutes | no | Previously called backend health endpoint; currently disabled |
| Enrollment-operation expiration | every 5 minutes | yes | Expires stale employee enrollment operations |

### Architecture consequence

The complete writer graph includes scheduled database automation, not only API routes and triggers. Migration cannot disable legacy application writers while leaving cron-based schedule generation active.

Every scheduled writer must receive:

- canonical target replacement or retirement;
- actor/capability identity;
- idempotency and lease/concurrency contract;
- migration cutover dependency;
- monitoring and rollback behavior.

---

## 3. Rolling schedule-window generation is a hidden schedule writer

`sch_ensure_schedule_window` runs every 30 minutes for a 14-day range. For each date it calls `sch_ensure_daily_schedule`, audits the result and upserts automation-run status.

The deployed overload `sch_ensure_daily_schedule(date,text)`:

- inspects roster and assignment counts;
- calls `sch_generate_daily_schedule` when either is missing;
- writes schedule automation-run state;
- raises failure when the generated day is still incomplete.

This is not inherently a read-side mutation because the cron job is an explicit writer. It remains a competing legacy writer because it materializes mutable daily schedules from current employee-bound templates and legacy generation logic.

### Target disposition

- Retire the legacy rolling writer at canonical cutover.
- If advance generation remains operationally useful, replace it with a canonical create-if-absent baseline/compilation service operating under the active authority set.
- Reads never call it.
- Shadow generation writes only isolated/shadow authority and is never presented as production truth.

---

## 4. Stale session expiration contains a valid safety principle

`expire_stale_open_sessions` runs hourly and:

- finds stale `active` or `pending_submit` sessions;
- marks them `cancelled` rather than `closed`;
- records a session event and warning log;
- does not create a completion.

This is a valid distinction worth preserving:

> Timeout may cancel stale work state; it must not fabricate that cleaning was completed.

The unified session architecture must nevertheless refine:

- employee/manager notification;
- protected local reconciliation;
- whether a recoverable draft exists;
- timeout policy by session state;
- incident/hold handling;
- authority-set and release version;
- effect on service occurrence/status/readiness.

---

## 5. Messenger retention physically removes audit and receipt evidence

`msg_purge_deleted_content` runs hourly. When a deleted message reaches `purge_after`, the function:

- nulls event/scan-alert foreign references to the message;
- deletes message-audit rows;
- deletes per-user message deletion records;
- deletes receipts;
- deletes the message;
- recalculates thread last-message time;
- later deletes empty expired threads and associated participants/visibility/context records.

### Architecture consequence

The current 14-day policy is a real physical content purge, not merely hiding old content from the employee UI.

The unified retention policy must decide separately:

- employee presentation period;
- message-content archive requirement, if any;
- operational event reference that must survive after content purge;
- minimal sender/recipient/time/action evidence;
- acknowledgement and notification evidence;
- legal/incident holds;
- privacy/redaction.

Operational responsibility and schedule history must never depend on a Messenger row that the retention job may delete.

---

## 6. Event retention deletes event and event-history rows

`events_app_purge_expired` runs hourly and deletes event rows after the configured event-retention period.

A `BEFORE DELETE` retention guard:

- blocks deletion of recent events;
- once outside the window, explicitly deletes `events_app_event_history` for the event;
- allows the event row to be deleted; related notification rows follow retention/cascade behavior.

### Architecture consequence

The current event history is short-lived presentation/operational data, not durable source provenance.

The target must separate:

- original event source artifact/import evidence;
- immutable event revision/publication history required for operational explanation;
- short-lived employee/manager event notice presentation;
- notification content/attempt history;
- approved event-impact/requirement/ownership inputs, which remain durable independently of event UI retention.

Deleting an old event notice must not erase why a historical schedule or service requirement changed.

---

## 7. Guest contact redaction is a valid privacy pattern

The daily guest-contact job removes reporter, IP and user-agent metadata after 30 days and records redaction metadata. Guest reporting remains disabled and Marketing review is required.

Preserve the pattern:

- contact/network identity is a separate sensitive class;
- operational report facts may remain after contact redaction;
- redaction is auditable;
- feature remains dormant until approved.

The final policy may change the exact duration/data fields only through an approved privacy revision.

---

## 8. GPS data currently behaves as latest mutable status, not durable observation history

Production contains `device_location_proximity_status`, which stores one current status keyed by device/location/session context with:

- result/badge;
- distance/radius/accuracy;
- client and target coordinates;
- coordinate source;
- evaluation/observation age and motion metadata.

At inspection time the table contained one status row for one device/location and result `away`.

### Architecture consequence

- Current production primarily preserves a mutable/latest GPS status, not a versioned raw-observation history suitable for complete historical reconstruction.
- The target must explicitly choose raw-observation storage, short retention, durable excursion/permission/summary events and incident holds.
- Current single-row data is insufficient to calibrate false exits, accuracy, battery use or disciplinary confidence.
- Raw coordinates are excluded from architecture reports and ordinary products.

---

## 9. Durable operational notification jobs show a useful worker pattern

`operational_notification_jobs` contains stable job keys, type, source, status, attempts/max attempts, availability, lease token/worker, completion, error, payload and timestamps.

At inspection time all recorded jobs were completed, including employee native push, Memphis bot reply and feedback image migration. Some completed jobs required multiple attempts.

### Architecture consequence

Preserve:

- durable unique job identity;
- available-at scheduling;
- lease/worker ownership;
- bounded attempts;
- completion/terminal evidence;
- correlation to source event.

Rebuild:

- domain-specific transient versus terminal classification;
- current-owner/status/epoch revalidation immediately before employee delivery;
- dead-letter/reconciliation visibility;
- retention and privacy of payload/error;
- authority-set compatibility.

Transport success remains separate from device presentation, acknowledgement and operational resolution.

---

## 10. Addendum conclusions

### Additional legacy writers to include in migration retirement

- rolling schedule-window cron;
- `sch_ensure_schedule_window`;
- both `sch_ensure_daily_schedule` overloads where they write legacy daily authority;
- any API/AI/read path that calls them.

### Valid mechanisms to preserve behind new contracts

- stale session cancellation without fabricated completion;
- durable leased notification jobs;
- guest contact redaction;
- bounded batch purge and advisory locking where appropriate;
- automation-run audit concept.

### Retention corrections required

- event source/impact history must survive UI event purge where needed;
- schedule/ownership history must not reference purgeable chat/event content as sole evidence;
- message/event presentation retention must be separated from durable operational audit;
- raw GPS versus durable summary must be designed explicitly.

No production state was changed by this addendum.