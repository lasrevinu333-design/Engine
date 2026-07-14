# Memphis Zoo City Work Order Queue

Public application:

`https://lasrevinu333-design.github.io/Engine/city-work-orders/`

## Access

There is no password, account, access code, or sign-in screen. Opening the link goes directly to the shared queue.

The optional **Your name** field is only an audit label. Leaving it blank uses `Operations Team`, while email-preparation actions default to `Jennifer`.

## Workflow

Operations managers and Annie can:

- Paste and parse one Spiceworks ticket.
- Batch-import tickets separated by a line containing `---`.
- Correct the parsed fields.
- Select the appropriate City trade.
- Add photographs or PDFs.
- Save drafts or place completed requests in the ready queue.
- Review existing requests to avoid duplicates.

Jennifer can use the same page to:

- Review urgent and normal requests.
- Prepare one urgent email or combine several requests into a daily email.
- Preview and open the prepared message in Gmail.
- Create Gmail drafts with attachments after the optional connector is configured.
- Mark batches sent and review history.
- Configure the City recipient, CC addresses, Zoo contact information, and Gmail connector.

## First-use configuration

Open **Settings** and enter:

1. The City maintenance manager's email address.
2. Any CC addresses.
3. Jennifer's contact telephone number, if desired.
4. Any standard access or coordination instructions.

The normal Gmail compose workflow works immediately after the recipient email is saved. Until the optional Gmail connector is configured, photographs are included as private links valid for 30 days.

## Dedicated Gmail draft connector

The optional `google-apps-script.gs` connector creates a Gmail draft with photographs attached, leaving Jennifer only to review it and press **Send**.

1. Create or sign into the dedicated Gmail account.
2. Open Google Apps Script and create a blank project.
3. Replace the default script with `google-apps-script.gs` from this directory.
4. Open **Project Settings → Script Properties**.
5. Add `CITY_WO_SECRET` with a long random value of at least 24 characters.
6. Select **Deploy → New deployment → Web app**.
7. Set **Execute as:** Me.
8. Set access to **Anyone**. The connector still rejects calls without the server-side secret.
9. Authorize Gmail and URL Fetch access.
10. Copy the Web App `/exec` URL.
11. Open **Settings** in the City Work Order Queue.
12. Paste the Web App URL and matching secret, then save.

## Separation

- The public GitHub Pages address redirects to the open queue interface.
- Queue data uses separate `city_wo_*` tables.
- Photographs use the private `city-work-order-photos` bucket.
- Browser requests use the dedicated `city-work-orders-open` Edge Function.
- Duplicate active Spiceworks ticket numbers are rejected.
- Queue actions are recorded in `city_wo_audit_log`.
- The Gmail connector secret is never returned to the browser.

## Files

- `index.html` — redirects the public GitHub Pages URL to the open interface.
- `google-apps-script.gs` — optional Gmail draft connector.
- `README.md` — deployment and operating instructions.
