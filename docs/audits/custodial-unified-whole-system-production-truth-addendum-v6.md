# Memphis Zoo Custodial Program — Production Truth Addendum v6

**Status:** SELECT-only Events, guest-report and feedback reconstruction  
**Prepared:** 2026-08-04

---

## 1. Scope and safety

This addendum records architecture-relevant production structure and aggregate state for Events, employee event notifications, guest reporting and system feedback.

No event, guest report, feedback item, notification instance, employee, device, schedule, setting or production row was changed. No private event source text, feedback message, guest data or employee/device telemetry is reproduced.

---

## 2. Event data contains valuable revision and source concepts

The deployed event entity already contains substantial legitimate capability:

- stable event ID;
- operation ID;
- revision number;
- status/cancel/archive fields;
- event date, start/end and timezone;
- scope and venue fields;
- coverage and staffing location arrays;
- source text/format/location;
- parser confidence, review requirement/reason and manual override;
- audience scope and specific employee IDs;
- event history containing previous/new records;
- revision-bound employee push instances.

At inspection time production contained 24 scheduled events and five event-history rows. Event push instances were currently empty.

### Preserve

- source/import provenance;
- parser candidate/review distinction;
- operation ID and revision;
- scope/venue/coverage separation;
- explicit cancel/archive state;
- audience projection fields;
- revision/epoch-bound push-instance concept.

### Rebuild

- immutable publication rather than one mutable current event row as final history;
- canonical named actor identity instead of text fields such as `created_by`, `overridden_by` and `cancelled_by`;
- durable event-impact evidence independent from short-lived event UI retention;
- current-owner/requirement-aware employee relevance.

---

## 3. All current events use `assigned_location` audience but assignment authority is legacy

At inspection time all 24 events used `audience_scope = assigned_location`. Only two contained explicit coverage-location rows and two contained staffing-area rows; none required parser review.

`mz_enqueue_employee_event_pushes` resolves an `assigned_location` audience through `daily_group_assignments`, not canonical current location-level ownership. It also joins the event-date work roster and current device credential/assignment epoch.

### Consequences

- event recipients inherit group-level and mutable daily-assignment authority;
- mixed restroom/exhibit group problems remain possible;
- a future or same-day ownership change after event-push instance creation may leave the original recipient targeted;
- the cancellation query revalidates event revision and device/employee assignment epoch, but does not re-resolve event ownership/audience against a new schedule publication;
- a notification can remain secure for the phone but operationally stale for the work.

### Target requirement

Employee event notice planning uses an approved event projection and canonical relevance resolver at the reminder time. For an ownership-based audience it binds:

- event revision;
- relevant location/service context;
- effective owner and ownership revision;
- device assignment epoch;
- authority-set ID;
- notification intent version.

Before delivery it revalidates the event, relevance/owner and epoch. Ownership change supersedes/reroutes the intent without changing the event itself.

---

## 4. Event push instances contain strong device-reassignment protections

The event push instance records:

- event/revision/service date;
- employee/device/credential;
- assignment epoch;
- notification kind and scheduled time;
- pending/sent/opened/cancelled/error state.

The enqueue and delivery path:

- requires a current employee/device/credential/push registration;
- includes assignment epoch in the unique notification key;
- cancels pending instances/jobs when the event revision or employee/device credential assignment is superseded;
- re-resolves authorized credential delivery before provider send.

These are valuable patterns to preserve in the canonical notification pipeline. They do not cure the legacy group-assignment source used to decide who should receive the event.

---

## 5. Current event audience and operational impact are still too close

The event table contains `coverage_location_ids` and `staffing_area_ids`, but there is no independent canonical lifecycle in production for:

```text
published event notice
→ custodial impact proposal
→ named-manager approval/rejection
→ approved service-requirement input
→ separate ownership compilation/publication
```

A coverage/staffing array on an event row can be treated by downstream code as operational truth without a separate approval object.

The target must preserve the data while separating authority. Event parsing, save, edit, cancel and notice publication never mutate schedule or ownership.

---

## 6. Event actors are not yet canonical named-manager actors

Event actor fields and event history currently use text for creator/override/cancellation actor. Text may preserve a label but does not prove:

- canonical manager identity;
- credential/session used;
- role/capability;
- approval chain;
- service/system actor versus human;
- second approval for a high-risk impact.

Target event commands and publications use canonical actor IDs and preserve a display snapshot for history.

---

## 7. Event retention conflicts with durable operational explanation

As documented in addendum v2, the hourly event purge deletes both old events and their event-history rows after the short retention window.

This is acceptable only for short-lived notice/presentation data. It is insufficient when an event caused:

- an approved service occurrence;
- an ownership exception;
- employee notification/escalation;
- contractor work;
- historical staffing or analytics context.

The target stores durable impact/publication evidence independently from purgeable event presentation while still respecting content/privacy retention.

---

## 8. Guest reporting is correctly dormant in production

At inspection time:

- guest reporting was disabled by system policy;
- Marketing review was required;
- no guest cleanliness reports existed.

The schema already anticipates:

- stable operation ID/request fingerprint;
- location and issue/severity;
- Marketing review state/actor/notes;
- operations dispatch and employee/manager notification evidence;
- resolution actor/time;
- metadata and contact-redaction lifecycle.

### Architecture consequence

This is a legitimate optional product seam, not an active employee feature. Keep it dormant until approved privacy, Marketing, abuse, signage, current-owner routing and physical-public acceptance gates close.

No employee QR/Scanner requirement follows from the guest schema.

### Actor correction

Marketing and resolution actor fields are currently text. Target commands use canonical reviewer/manager identities while retaining historical display snapshots.

---

## 9. Guest routing must not rely on a stored notified employee as continuing truth

The guest report table stores `notified_employee_user_id` and notification counters/status. This can document who was previously notified; it cannot define current responsibility.

After approval and before each dispatch/retry:

- resolve current effective owner/revision;
- validate employee/device epoch/authorization;
- supersede or reroute stale recipient intent;
- retain prior notification history;
- escalate `OPEN`/unreachable coverage to managers under policy.

A stored recipient is historical delivery evidence, not the owner.

---

## 10. System feedback has useful idempotency and triage fields but weak actor identity

Production system feedback supports:

- stable operation ID and request fingerprint;
- category/priority/message/context;
- device/page metadata;
- status and summary;
- manager acknowledgement and reminder fields;
- notification state;
- metadata and attachments in related capability.

At inspection time seven feedback items existed and were acknowledged.

### Preserve

- idempotent submission;
- context capture;
- manager acknowledgement/triage;
- optional private attachment;
- reminder/notification audit.

### Rebuild

- employee-safe categories limited to app/phone/NFC help;
- operational maintenance/supply/work requests routed to their own domains;
- canonical employee/manager actor IDs rather than only `submitted_by`/`acknowledged_by` text;
- product-specific employee submission and manager triage assets/APIs;
- attachment security and retention;
- no raw device/page diagnostics in ordinary employee presentation.

---

## 11. Required target event/guest/feedback flow

### Events

```text
source/import
→ parsed candidate
→ manager-reviewed immutable event revision
→ published notice
→ optional impact proposal
→ separate approval
→ service occurrence/ownership input
→ role projection and reroutable notification intent
```

### Guest

```text
disabled by default
→ approved public report
→ Marketing review
→ approved operations issue
→ canonical owner/OPEN dispatch
→ resolution and contact redaction
```

### Feedback

```text
employee app/phone help or manager program feedback
→ idempotent item
→ manager triage/acknowledge/resolve
```

Maintenance, supply, emergency and one-time work remain separate operational domains.

---

## 12. Migration disposition

### Retain/rebuild

- event revision/source/parser/review data;
- event history, audience and push-instance concepts;
- guest operation/fingerprint/Marketing/privacy fields;
- feedback operation/fingerprint/triage fields;
- device credential/epoch final-delivery checks.

### Retire/consolidate

- legacy `daily_group_assignments` as event audience authority;
- text-only privileged actor identity;
- event row arrays as automatic operational approval;
- stored guest notified employee as current-owner truth;
- shared feedback surface containing employee submission and manager triage;
- short event purge as the only history of a schedule/requirement impact.

No production state was changed by this research.