# Memphis Zoo mobile app packaging

This directory contains two separate native wrappers around the existing Memphis Zoo web app:

- `ops-manager/` for the full Ops Manager app
- `read-only/` for the restricted dashboard/events app

Both wrappers point at the generated `mobile-build/` web bundles at the repository root.

Build the bundles first:

```bash
node scripts/build-mobile-bundles.mjs
```

Then sync the native wrappers:

```bash
cd mobile/ops-manager && npx cap sync
cd ../read-only && npx cap sync
```

The generated native projects are intended for Android Studio and Xcode packaging.

