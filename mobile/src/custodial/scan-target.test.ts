import { describe, expect, it } from 'vitest';
import { resolveCustodialScanTarget } from './scan-target';

const current = 'https://localhost/events.html?hub=employee';

describe('Custodial native scan targets', () => {
  it('normalizes WebView custom-scheme URLs from every compatibility module', () => {
    expect(resolveCustodialScanTarget(
      'memphiszoo://scan?code=RESTROOM_TRACE',
      current,
      'kiosk_08',
      'native-nfc',
    )?.toString()).toBe(
      'https://localhost/scan.html?code=RESTROOM_TRACE&device=KIOSK_08&source=native-nfc',
    );
    expect(resolveCustodialScanTarget(
      'memphiszoo://scan?code=RESTROOM_TRACE&entry_id=caller-controlled',
      current,
      'KIOSK_08',
      'native-nfc',
      '00000000-0000-4000-8000-000000000431',
    )?.toString()).toBe(
      'https://localhost/scan.html?code=RESTROOM_TRACE&device=KIOSK_08&source=native-nfc&entry_id=00000000-0000-4000-8000-000000000431',
    );
    expect(resolveCustodialScanTarget(
      'memphiszoo-custodial://scan/AQUARIUM?code=QUERY_WILL_NOT_WIN&action=start&token=secret',
      current,
      'KIOSK_08',
      'native-nfc',
    )?.toString()).toBe(
      'https://localhost/scan.html?code=AQUARIUM&action=start&device=KIOSK_08&source=native-nfc',
    );
  });

  it('rejects the retired QR source and untrusted web locations', () => {
    expect(resolveCustodialScanTarget(
      'https://lasrevinu333-design.github.io/Engine/scan.html?location=Cat%20House&token=secret',
      current,
      'KIOSK_08',
      'manual-qr-fallback' as never,
    )).toBeNull();
    expect(resolveCustodialScanTarget(
      'https://attacker.example/Engine/scan.html?code=PANDA',
      current,
      'KIOSK_08',
      'native-nfc',
    )).toBeNull();
  });

  it('fails closed when an untrusted caller supplies an unknown entry source', () => {
    expect(resolveCustodialScanTarget(
      'memphiszoo-custodial://scan/AQUARIUM',
      current,
      'KIOSK_08',
      'legacy-or-unknown' as never,
    )).toBeNull();
  });
});
