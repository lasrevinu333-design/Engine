# Operations Dashboard candidate — not deployed

The manager Hub's Dashboard Map tile opens `operations-dashboard.html`. It uses
the existing named-manager session, current summary, map renderer and assets.
The prior standalone map is preserved. No phone, native package or public demo
is changed. The backend candidate is based on current219 commit 6128d1a6, not a
claim that it is the live deployed source.

## Data and lifecycle

- Existing summary `open_tickets` is the sole scan-ticket source; close/delete
  stays on the existing Dashboard. A fresh summary replaces, not merges, rows.
- New authenticated GET `/dashboard-api/operations` projects existing Events
  fields, including approved custodial notes. Raw mail, generic private notes,
  recipients and scan GPS payloads are excluded. No mutation route was added.
- Each ticker opens one viewport-sized board. Native fullscreen is optional;
  refusal keeps the viewport board. Close, Escape, Back, focus restoration,
  pause/speed and reduced motion are handled by the same owned controller.
- There is one existing page refresh lifecycle. Opening a board never starts
  polling. Requests are aborted on replacement, suspension, sign-out or the
  ten-second feed deadline. No session data is persisted by the new controller.
- All 47 anchors, 34 saved offsets, map artwork, upright glyphs and the existing
  cleaning/urgency state contract remain unchanged. Crowded pins open a chooser
  without moving any pin. Staff GPS is explicitly unavailable, not simulated.
- Attendance uses the existing source freshness flag/time; missing freshness is
  unknown. Weather uses the existing Open-Meteo location, Fahrenheit units and
  the next provided forecast hour (not invented interpolation). Weather older
  than 45 minutes is visibly stale. Its decorative animation is not a live sky
  observation. All genuine due/overdue locations remain visible; no demo cap.

## Mail producer boundary — still required

No supported unattended Outlook collector or authenticated persisted
school/Spiceworks projection was found in this source. The actual endpoint says
those feeds are **unavailable**, never zero/live. The new pure
`operations-mail-contract.js` is a tested preparation adapter, not authentication,
an ingestion API, a timer, connector access, a database or runtime activation.

An admitted existing collector must bind Eric's mailbox, actual sender, message
and attachment IDs, source timestamps/hashes and the current unquoted change
block. Sender-string checks alone do not authenticate mail. It must persist
reconciliation state under existing access/recovery controls and publish only
qualified fresh projections. No hidden tokens or app-to-ChatGPT API is assumed.

Spiceworks uses exact structured transitions, per-field newer evidence, dedup
and conflicting-replay rejection. Ordinary prose containing "closed" cannot
close a ticket. Reopen/category/assignment changes are reconciled; this board
never writes to Spiceworks. School attachment lines group by order/date and
retain unknown/unclassified values. A collector may supersede/cancel via omission
only after establishing a complete replacement list for explicit covered dates.
Partial lists must not acquire that authority from a filename or subject.

School departure is 13:00 America/Chicago on each visit date, explicitly the
owner's policy. Active rows disappear at that local cutoff; daily expected totals
and clearly separate history remain. Missing or contradictory arrivals are
review gaps, never overnight visits. Events retain their own supplied end times;
cancelled/superseded/scheduled-ended events move to separate history. Neither
scheduled cutoff proves a physical departure.

## Remaining acceptance and release gates

Local source/VM checks are not pixels, live principal issuance/revocation,
deployed SQL, imported-mail acceptance, physical GPS or independent review.
The existing V2 browser guard remains unresolved and has not been retried.
Actual desktop/landscape Hub → Operations → Back, refresh/history/auth/status,
fullscreen/focus/motion and the requested fresh WEB review remain required.
No source-only substitute audit, public fictional-demo update, release approval,
production migration, backend deploy or web publication is claimed. Preserve the
normal exact frontend/backend source, authentication and release controls.
