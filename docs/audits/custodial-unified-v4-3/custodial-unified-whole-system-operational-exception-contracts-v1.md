# Operational Exception Contracts v1

**Status:** bounded exception behavior. Exceptions do not revive prohibited normal UI or alternate authority.

| Contract | Normal authority | Exception and required record | Fail-closed behavior |
|---|---|---|---|
| NFC/tag failure | native scan bound to active session/location | manager-supported ManualRecoveryCommand records reason, tag/device state, witness/manager, session/occurrence, authority set; completion still requires authorized evidence | no QR/barcode/generic scanner fallback; no unproven completion |
| Communication classification | canonical communication command | ordinary message, Event notice, broadcast, operational alert, escalation, emergency instruction each records class, sender authority, audience, urgency, ack/escalation and retention | unknown class cannot send; operational impact requires Event/ownership approval |
| Operational alert accessibility | notification intent/presentation | visual persistent accessible text, vibration where device/user policy permits, acknowledgement and manager escalation; audio is optional and never default-preemptive | no audio-only alert; stale intent is cancelled/replaced |
| Contractor rejection/partial/abandonment/substitution/link loss | engagement/offer/acceptance aggregate | exact offered scope, accepted subset, accountable slot/named worker, expiry, link state, substitute approval, OPEN consequence | no accepted coverage means OPEN/unchanged under policy; never pseudo-employee attribution |
| Messenger hide/delete/reappearance | visibility/deletion/hold aggregate | viewer scope, transition reason, participant state, hold, delivery state, restore/redaction decision | ambiguity hides from presentation and blocks purge if held |
| Restore purge/redaction/hold | retention/restore ledger | object identity, source/restore point, hold, purge/redaction result, approver, evidence digest | no silent reappearance; incomplete ledger blocks restore admission |
| Manager interruption/cancel/takeover | session/occurrence command | taxonomy: assistance, pause, cancel-before-work, cancel-after-evidence, takeover, reassignment, emergency override; captures authority, reason, effective time and original actor | no overwrite of original evidence/actor; unauthorized takeover is refused |
| Offline conflict | original local envelope | sync result: accepted, duplicate, conflict, quarantined, manually recovered; preserves original envelope | current device/employee/location never rewrites original operation |

Manager recovery is deliberately a distinct audited command path; it is not an employee-facing normal control. Emergency instruction semantics require management policy and do not authorize a new emergency operating policy here.

