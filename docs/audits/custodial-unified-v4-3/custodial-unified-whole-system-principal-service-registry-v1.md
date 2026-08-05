# Principal and Service-Principal Registry v1

**Default:** deny by default. A human identity, device, session, workload actor, and service principal are separate objects. Each authorization decision snapshots all applicable identities, grant revision, authority set, scope, and expiry.

| Principal | Credential/session | Minimum grants/scopes | Revocation and controls |
|---|---|---|---|
| Employee human | named managed-device credential; short session | own assigned occurrence/session, native NFC intake, own non-sensitive projection | employment/device/credential/assignment epoch revocation; no manager fallback |
| Manager human | named trusted-device credential; short session | tiered operational commands, scoped site/shift data | dual approval for impact, correction, retention, break-glass; all use audited |
| Read Only human | named credential; read session | fixed approved projection fields only | no write endpoints/tokens; immediate grant revocation |
| Marketing human | named credential | guest-review data only | disabled until G-GUEST; no operational authority |
| Contractor human / vendor slot | issued expiring link or named credential | offered assignment only; accept/reject/substitute protocol | link expiry/revocation; cannot become employee |
| Guest | anonymous/public session | public form only | disabled; rate/privacy boundary; no data browsing |
| Device | hardware-backed managed credential | proves device and assignment epoch, not human authority | quarantine, rotate, unassign; loses access to protected queue |
| Operational worker | purpose-specific service credential | exact named aggregate/work queue | lease/authority-set fence; no generic SQL |
| Notification worker | purpose-specific service credential | intent, provider receipt/reconciliation only | cannot alter ownership or grants |
| MCP/tool principal | individually named, authenticated, revocable | exact allowlisted read or approved command tool | anonymous full mode retired; tool invocation carries actor/delegation |
| AI/repair principal | separate nonhuman identity | read analysis by default; no direct write | write disabled pending G-AI-WRITE and required approvals |
| Database migration operator | separate break-glass credential | admitted migration manifest only | dual approval, time box, immutable assertion; no application runtime use |
| Backup operator | separate service credential | backup creation/verification only | cannot restore or alter source data |
| Restore operator | separate service credential | approved restore run only | dual approval; no backup deletion |
| Release operator | separate service credential | tuple admission/rollback action only | cannot create data migration or business command |
| Device Security/access administrator | separate named admin credential | enrollment, quarantine, Device Security policy | cannot impersonate employee operations |
| Synthetic test principal | isolated non-production credential | fixture namespace only | production deny and release checks |

Break-glass is a named, time-limited, reasoned, dual-approved grant whose authorization decision is immutably evidenced and reviewed. It is not a shared secret. Service credentials are purpose-specific, scoped, rotated, and never placed in client bundles. Sessions cannot silently survive actor, device, credential, assignment-epoch, grant, or authority-set revocation.

