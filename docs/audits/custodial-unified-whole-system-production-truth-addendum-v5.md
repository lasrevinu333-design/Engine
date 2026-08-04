# Memphis Zoo Custodial Program — Production Truth Addendum v5

**Status:** SELECT-only Messenger and employee-notification reconstruction  
**Prepared:** 2026-08-04

---

## 1. Scope and safety

This addendum records deployed Messenger delete/hide/send/receipt behavior and employee notification enqueue/acknowledgement behavior. No message, receipt, acknowledgement, notification or device record was changed.

No private message body, contact information or unnecessary employee/device telemetry is reproduced here.

---

## 2. Messenger contains several strong mechanisms worth preserving

### 2.1 Stable client-message idempotency

`msg_send_message` supports `client_message_id` and returns the existing message on replay. It:

- requires the sender to be an active thread participant;
- validates bounded non-empty body;
- creates recipient receipts;
- updates the thread's last-message time;
- handles unique-race replay.

Notification-generated messages also support a stable notification instance key and advisory lock.

**Preserve:** stable client operation IDs, participant authorization, idempotent replay and recipient receipt creation.

### 2.2 Named manager attribution

`msg_send_message_as_ops_manager` resolves an active named manager, ensures the manager's Messenger user, strips client-supplied manager identity and writes the canonical manager ID into message metadata/audit.

**Preserve:** backend-derived named manager identity rather than a display string.

### 2.3 Per-user thread deletion is idempotent and non-global

`msg_delete_thread`:

- requires thread, authenticated user and operation UUID;
- advisory-locks the operation ID;
- safely replays the same operation;
- rejects operation-ID reuse for another target;
- prevents deletion of the retired shared Ops Manager thread;
- requires participant or manager authority;
- writes a user-specific `hidden_before` visibility boundary;
- does not delete other participants' history;
- for a Memphis bot thread, ends that user's current participation/generation;
- writes a deletion-operation audit record.

This is a valid foundation for immediate employee conversation removal.

### 2.4 New activity can reappear after older content is hidden

Thread message reads exclude messages at or before the user's `hidden_before` boundary. Thread/device lists may show the thread again when a later message arrives after a device hide.

The final product contract must distinguish:

- delete old conversation history for this user;
- hide on one device;
- leave/stop Memphis generation;
- reappearance on new incoming message;
- permanent administrative tombstone.

Employee UI must use one clear mental model and server operation. Obsolete archive/hide APIs should not remain competing product actions.

---

## 3. Messenger receipt states are not interchangeable

Production tracks delivered, displayed, read and acknowledged fields. Some helper functions intentionally advance several fields together:

- `msg_acknowledge_message` sets delivered, displayed, read and acknowledged;
- displayed/delivered helpers update device and attempt metadata.

### Architecture consequence

The unified architecture must define semantics by message/notification class:

- provider delivered;
- device received;
- list/thread displayed;
- user opened/read;
- explicit acknowledgement where required.

An employee opening a conversation can reasonably mark an ordinary message read. It must not be reused as acknowledgement of operational work or manager escalation.

---

## 4. Device notification acknowledgement lacks assignment epoch as a first-class key

`device_notification_acknowledgements` is unique by device identifier and notification key. It stores displayed, dismissed, opened and acknowledged timestamps plus metadata.

`ack_device_notification`:

- resolves canonical active device from primary ID or alias;
- upserts idempotently by device/key;
- preserves first occurrence of each action;
- automatically sets `acknowledged_at` when action is dismissed or opened.

### Risk

The row does not have first-class employee ID, credential ID or assignment epoch columns. After a phone is reassigned, a prior device-level acknowledgement could suppress a logically reused notification key for the new employee unless every key is globally unique across assignment epochs.

### Target requirement

Presentation identity includes:

- intent/event ID;
- device ID;
- assignment epoch;
- intended actor/employee where applicable;
- authority-set and ownership revision;
- notification type/version.

A dismissal/open acknowledgement remains presentation evidence only. It never resolves work.

---

## 5. Current employee location-push enqueue has strong device revalidation but wrong ownership/status authority

`mz_enqueue_employee_location_pushes` contains meaningful security protections:

- joins active push registration to current device assignment and assignment epoch;
- requires active device and employee;
- requires confirmed, unrevoked, unexpired device credential;
- includes credential/device/employee/epoch in the durable job payload;
- avoids enqueue when the same device/key is already acknowledged;
- marks pending/leased jobs dead when assignment/credential is superseded.

These mechanisms should be preserved behind the canonical notification planner.

### Authority defects

The function currently:

- reads `sch_get_daily_schedule_with_purpose` rather than current effective location ownership at the notification time;
- expands group membership and can inherit mixed-group authority problems;
- does not filter by the current ownership interval in the enqueue query;
- reads `v_location_dashboard_status` timer state rather than a canonical service occurrence/status episode;
- omits ownership revision and authority-set identity from the notification key;
- creates employee wording containing `on your assigned route`;
- routes to the employee Schedule highlight page rather than one canonical current-area/episode contract.

A phone can therefore be securely enrolled and still receive an operationally wrong or stale notification. Transport security does not cure source-of-truth defects.

---

## 6. Current notification key encodes status and latest completion, not the operational episode

The legacy location key is based on:

- service date;
- location;
- status code;
- latest completion time.

Due-soon and overdue generally receive different keys. A new completion changes the key basis.

Missing:

- stable service occurrence/episode ID;
- current owner/ownership revision;
- assignment epoch in the row key;
- status-policy revision;
- authority set;
- explicit supersession/reopen lineage.

### Target requirement

One service occurrence has one stable episode ID through due-soon and overdue. Recipient intents are versioned/superseded children of that episode and current ownership revision. Presentation keys include epoch/recipient. Accepted completion resolves the episode and cancels all active recipient intents/escalations transactionally.

---

## 7. Presentation acknowledgements are common and must remain separate from operations

At the time of inspection, device acknowledgement rows existed for event and location-status notifications. Most were displayed/acknowledged; several location notices were dismissed and a small number opened.

This confirms the presentation lifecycle is an actual used capability rather than theoretical schema.

It also reinforces the separation:

- displayed/opened/dismissed proves presentation/user action;
- it does not prove the location was serviced;
- it may suppress duplicate presentation for the same intent;
- it cannot cancel manager escalation except under an explicit non-work informational policy.

---

## 8. Current retention can remove Messenger audit and receipt evidence

As documented in addendum v2, the hourly purge can delete message audit rows and receipts along with eligible message content.

The architecture must decide what minimal communication-delivery/action evidence survives content purge and what is subject to short retention or incident hold. Operational status and ownership history cannot depend on a purgeable Messenger record.

---

## 9. Target migration disposition

### Retain/rebuild

- stable client message IDs and replay;
- named manager attribution;
- direct/group/broadcast authorization;
- per-user delete/hide semantics;
- recipient receipts;
- push registration tied to device credential/epoch;
- durable notification jobs and stale-job invalidation;
- device presentation acknowledgements.

### Retire or consolidate

- competing archive/hide/delete operations exposed to product;
- daily group schedule as notification recipient authority;
- timer Dashboard view as root operational episode;
- route wording;
- device/key acknowledgement without epoch/recipient contract;
- Messenger message as the sole durable record of an operational alert;
- any scan/presentation action that resolves work.

### Required target flow

```text
canonical service occurrence/status event
→ current effective owner/revision
→ recipient intent
→ current device credential/assignment epoch
→ durable transport job
→ native presentation
→ durable presentation acknowledgement
→ independent escalation
→ authoritative completion/correction resolution
```

No production state was changed by this research.