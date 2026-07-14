# Memphis Zoo City Work Order Queue

Public application path:

`https://lasrevinu333-design.github.io/Engine/city-work-orders/`

The application is isolated from the main custodial interface. It uses:

- GitHub Pages for the public frontend.
- A separate set of `city_wo_*` tables in the existing Memphis Zoo Supabase project.
- A private Supabase Storage bucket named `city-work-order-photos`.
- A dedicated Supabase Edge Function named `city-work-orders-api`.
- Optional Google Apps Script under a dedicated Gmail account for one-click Gmail draft creation with attached photographs.

## Roles

### Operations staff

Operations managers and Annie use the shared staff access code and enter their own name. They can:

- Paste and parse one Spiceworks ticket.
- Parse and import multiple tickets.
- Review and correct extracted fields.
- Add photographs or PDFs.
- Save unfinished tickets as drafts.
- Submit complete tickets to Jennifer's queue.
- Review the shared open queue to prevent duplicates.
- Edit or cancel requests before Jennifer prepares them.

### Jennifer / director

Jennifer uses the separate director access code. She can:

- See all ready and urgent requests.
- Select one urgent ticket or group multiple tickets into one email.
- Preview the exact City maintenance email.
- Open a prefilled Gmail compose window.
- Create a Gmail draft with attached photographs after the connector is configured.
- Mark the batch sent.
- Review sent history and the audit trail.
- Configure City recipient/CC addresses, contact information, default access notes, Gmail connector, and access codes.

## Initial temporary access codes

Change both from **Director Settings** after first login.

- Operations staff: `ZooOps-4726`
- Jennifer/director: `CityDesk-8194`

Do not place these codes in public signs, emails, or the repository after changing them. Only salted hashes are stored in Supabase.

## Required first-use configuration

1. Jennifer logs in with director access.
2. Open **Director Settings**.
3. Enter the City maintenance manager's recipient email.
4. Add any CC addresses and Jennifer's contact telephone number.
5. Save.

The Gmail compose fallback works immediately after the recipient email is saved.

## Dedicated Gmail draft connector

This step makes the final Jennifer workflow: open the queue, create the draft, open Gmail Drafts, and press **Send**. Photos become real Gmail attachments rather than links.

1. Create or sign into the dedicated Gmail account.
2. Open Google Apps Script and create a blank project.
3. Replace the default script with `google-apps-script.gs`.
4. Open **Project Settings → Script Properties**.
5. Add a property named `CITY_WO_SECRET` with a long random secret, at least 24 characters.
6. Select **Deploy → New deployment → Web app**.
7. Set **Execute as:** Me.
8. Set access to **Anyone**. The connector rejects requests without the secret, and the secret is only sent server-to-server from Supabase.
9. Authorize Gmail and URL Fetch access.
10. Copy the Web App `/exec` URL.
11. In the City Work Order Queue, open **Director Settings**.
12. Paste the Web App URL and the same secret, then save.
13. Prepare a test request and use **Create Gmail Draft with Attachments**.

If Google changes the deployment URL, update the URL in Director Settings.

## Email behavior

- One selected ticket produces an individual request email.
- Multiple selected tickets produce a consolidated email with a summary followed by full details.
- Emergency and High-priority tickets sort first.
- Requests then sort by trade and Zoo location.
- When the Gmail connector is unavailable, photographs are represented by private signed links valid for 30 days.
- When the Gmail connector is active, it downloads those signed files server-to-server and attaches them to the Gmail draft.

## Data separation and security

- The frontend contains no Supabase service key.
- All database and storage access passes through the custom-authenticated Edge Function.
- Database tables have Row Level Security enabled with no public browser policies.
- The photo bucket is private.
- Staff and director sessions expire after 12 hours.
- Duplicate active Spiceworks ticket numbers are rejected.
- Actions are recorded in `city_wo_audit_log`.
- The Gmail connector secret is stored only in the protected settings table and is never returned to the browser.

## Files

- `index.html` — application shell.
- `styles.css` — responsive interface.
- `app.js` — parser, shared queue, email preparation, Gmail workflow.
- `google-apps-script.gs` — optional Gmail draft connector.
- `README.md` — deployment and operating instructions.
