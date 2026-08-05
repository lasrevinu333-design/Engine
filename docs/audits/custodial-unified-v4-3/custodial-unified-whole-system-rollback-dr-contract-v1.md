# Rollback and Disaster-Recovery Contract v1

**Status:** architecture contract; no drill has been performed.

## Recovery unit and admission

Recovery is one compatible system transaction, not a database restore or APK downgrade. Its bundle includes authority-set graph and pointer; database facts/projections; object storage and attachment digests; immutable evidence; retention/hold/purge/redaction ledger; backup catalog; migration/release assertions; worker queues/leases/outbox; notification provider receipts and presentation reconciliation; enrolled device/credential/assignment status; and pending protected local-operation inventory.

Only restore and release principals with dual approval may run it. Backup operator cannot restore; restore operator cannot alter backup provenance. A restore emits immutable migration and release assertions.

## Ordered rollback / DR runbook

1. Declare incident; freeze release admission, new commands, migrations, and nonessential workers.
2. Capture exact release tuple, authority pointer, queue/lease/local-operation/provider reconciliation state and hashes.
3. Fence affected workers, tools, legacy paths, credentials, and device sessions; preserve holds.
4. Select a previously accepted compatible authority set and verified backup/object-store point. Reject an incomplete or mismatched bundle.
5. Restore database and object store together; verify evidence content digests, backup catalog, holds, redactions, and purge ledger.
6. Restore only compatible projections/adapters; replay immutable facts. Do not copy a current identity into an old operation.
7. Reconcile provider receipts, visible alerts, Messenger visibility, and external delivery; cancel or replace stale presentation.
8. Revalidate every pending local operation against its original snapshots. Accept compatible work once, otherwise quarantine with manager recovery.
9. Activate compatible backend/app tuple, move authority pointer, emit release assertion, and reopen gated work.
10. Preserve incident, reconciliation, and decision evidence; re-run dependent automated and physical proof.

## Build 22 retention

Build 22 is RETAINED_ROLLBACK only, not production architecture. Its retirement requires all of: admitted successor tuple; compatible authority-set rollback; old/new reader proof; schema/data/object-store restoration; pending local-work quarantine/recovery; notification/Messenger reconciliation; successful physical rollback matrix; dual release approval; explicit expiry/retirement decision. An Android downgrade by itself proves none of these.

## Required automated and physical proofs

Automated: failed migration before/after pointer movement; partial deployment; authority-set rollback; fact/evidence digest replay; object-storage loss/restore; hold/purge/redaction restoration; queued lease drain; crash-after-provider; device reassignment; old client and unknown record rejection; validation invalidation.

Physical: bound Moto G with admitted app/backend/schema tuple; offline queued work then rollback; process death/reboot; NFC session; stale alert replacement; no duplicate audio; device reassignment recovery; Build 22 fallback; manager recovery and Karen no-rescue path. Failure blocks canary, not merely a dashboard metric.

