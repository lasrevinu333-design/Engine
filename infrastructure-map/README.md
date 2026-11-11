# Memphis Zoo Infrastructure Map

Standalone infrastructure and equipment mapping project for Memphis Zoo emergency management and daily operations.

## Boundary

This project is **not part of the Custodial program**. It must remain independently buildable, independently deployable, and independently stored.

- Native app ID: `org.memphiszoo.infrastructure`
- Browser storage namespace: `memphis-zoo-infrastructure-map-v1`
- Preferred future repository: `lasrevinu333-design/memphis-zoo-infrastructure-map`
- Do not import runtime modules, data, migrations, APIs, or storage keys from the Custodial system.
- A future Custodial map will be a different project with its own map ID, data, categories, and releases.

The automated separation check in `scripts/check-separation.mjs` enforces this boundary for source and configuration files.

## Initial category colors

- **Generator** — red `#D32F2F`
- **Water Quality Pump** — blue `#1976D2`

Colors belong to equipment/infrastructure categories. Pins inherit the category color and also retain the resolved color in published data so an approved publication does not silently change when a category is edited later.

## Coordinate calibration

The map uses the original 2048 × 1536 zoo site plan and three exact control points:

- Aquarium — `35.152207355862316, -89.99729435770122`
- Zambezi Rondavel — `35.15005935639266, -89.99286580488196`
- Teton Trek Lodge — `35.149555596431, -89.98875243030255`

The affine transform and anchor tests are in `src/config/calibration.js` and `tests/calibration.test.mjs`.

## Current scaffold

This first isolated scaffold provides:

- Category registry and category-color rules
- Legacy JSON normalization contract
- Exact map calibration contract
- Capacitor identity and native container configuration
- Separation-boundary tests

Issue tracking and complete acceptance criteria: Engine issue **#177**.

## Commands

```bash
cd infrastructure-map
npm test
```

The application UI, map asset import, offline publication cache, browser tests, and native Android/iOS build workflows are the next implementation phase.
