import { describe, expect, it } from 'vitest';
import { resolveCustodialScanTarget } from './scan-target';

const current = 'https://localhost/events.html?hub=employee';

describe('Custodial native scan targets', () => {
  it('normalizes WebView custom-scheme URLs from every compatibility module', () => {
    expect(resolveCustodialScanTarget(
      'memphiszoo://scan?code=RESTROOM_TRACE',
      current,
      'kiosk_08',
    )?.toString()).toBe(
      'https://localhost/scan.html?code=RESTROOM_TRACE&device=KIOSK_08&source=native-nfc',
    );
    expect(resolveCustodialScanTarget(
      'memphiszoo-custodial://scan/AQUARIUM?code=QUERY_WILL_NOT_WIN&action=start&token=secret',
      current,
      'KIOSK_08',
    )?.toString()).toBe(
      'https://localhost/scan.html?code=AQUARIUM&action=start&device=KIOSK_08&source=native-nfc',
    );
  });

  it('accepts only the deployed web scan boundary and strips unknown fields', () => {
    expect(resolveCustodialScanTarget(
      'https://lasrevinu333-design.github.io/Engine/scan.html?location=Cat%20House&token=secret',
      current,
      'KIOSK_08',
    )?.toString()).toBe(
      'https://localhost/scan.html?location=Cat+House&device=KIOSK_08&source=native-nfc',
    );
    expect(resolveCustodialScanTarget(
      'https://attacker.example/Engine/scan.html?code=PANDA',
      current,
      'KIOSK_08',
    )).toBeNull();
  });
});
