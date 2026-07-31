# Memphis Zoo mobile publishing notes

There are now two separate app targets:

- `mobile/ops-manager/` for the full Ops Manager app
- `mobile/read-only/` for the limited dashboard/events app

Both app wrappers are generated from the same web repository, but they point at different bundle outputs.

What remains for store release:

- sign into Google Play Console with the intended Google account;
- create the Android app listings for both bundle IDs;
- sign into Apple Developer / App Store Connect later and create the iOS listings;
- replace the default signing identities and store metadata with production credentials;
- provide final screenshots, privacy policy URLs, and review notes.

The repository side of the split is prepared. Store submission still requires the platform accounts and signing credentials.

