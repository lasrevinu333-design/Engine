# Memphis Zoo City Work Order Queue

Public application:

`https://lasrevinu333-design.github.io/Engine/city-work-orders/`

The application is isolated from the existing custodial interface. It uses:

- GitHub Pages for the self-contained public frontend.
- Separate `city_wo_*` tables in the Memphis Zoo Supabase project.
- A private Supabase Storage bucket named `city-work-order-photos`.
- A dedicated Supabase Edge Function named `city-work-orders-api`.
- An optional Google Apps Script under a dedicated Gmail account for creating drafts with attached photographs.

## Roles

### Operations staff

Operations managers and Annie use the shared staff access code and enter their own name. They can paste or batch-import Spiceworks tickets, correct parsed fields, add photographs or PDFs, save drafts, and place complete requests in Jennifer's queue.

### Jennifer / director

Jennifer uses the separate director access code. She can review urgent and normal requests, combine selected tickets into one City email, create individual urgent emails, open Gmail compose, create Gmail drafts with attachments after integration, mark submissions sent, view history, and change settings or access codes.

Access codes are deliberately not stored in this public repository.

## First-use configuration

1. Jennifer logs in with director access.
2. Open **Settings**.
3. Enter the City maintenance manager's recipient email.
4. Add any CC addresses and Jennifer's contact telephone number.
5. Save.

The Gmail compose workflow works immediately after the recipient email is saved. Until the optional Gmail connector is configured, photographs appear as secure links valid for 30 days.

## Dedicated Gmail draft connector

This optional step creates a Gmail draft with photographs attached, leaving Jennifer only to review it and press **Send**.

1. Create or sign into the dedicated Gmail account.
2. Open Google Apps Script and create a blank project.
3. Replace the default script with `google-apps-script.gs` from this directory.
4. Open **Project Settings → Script Properties**.
5. Add `CITY_WO_SECRET` with a long random value of at least 24 characters.
6. Select **Deploy → New deployment → Web app**.
7. Set **Execute as:** Me.
8. Set access to **Anyone**. The endpoint still rejects requests without the secret.
9. Authorize Gmail and URL Fetch access.
10. Copy the Web App `/exec` URL.
11. In the City Work Order Queue, open **Settings**.
12. Paste the Web App URL and the same secret, then save.
13. Prepare a test request and use **Create Gmail Draft**.

## Security and separation

- The frontend contains no Supabase service key.
- Database and storage access passes through the custom-authenticated Edge Function.
- Row Level Security is enabled and there are no public browser table policies.
- The photograph bucket is private.
- Sessions expire after 12 hours.
- Duplicate active Spiceworks ticket numbers are rejected.
- Actions are recorded in `city_wo_audit_log`.
- The Gmail connector secret is never returned to the browser.

## Files

- `index.html` — self-contained responsive application, parser, queue, and Gmail workflow.
- `google-apps-script.gs` — optional Gmail draft connector.
- `README.md` — deployment and operating instructions.
