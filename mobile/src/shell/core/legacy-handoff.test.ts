import { describe, expect, it } from 'vitest';
import { buildLegacyHandoffUrl, resolveHardwareBackAction } from './legacy-handoff';

describe('legacy compatibility handoff', () => {
  it('preserves the legacy target and supplies the canonical custodial device', () => {
    expect(buildLegacyHandoffUrl(
      'https://lasrevinu333-design.github.io/Engine/app-shell.html',
      './messages.html?hub=employee',
      'custodial',
      'KIOSK_04',
    )).toBe('https://lasrevinu333-design.github.io/Engine/messages.html?hub=employee&device=KIOSK_04');
  });

  it('rejects cross-origin and non-page targets', () => {
    expect(() => buildLegacyHandoffUrl(
      'https://lasrevinu333-design.github.io/Engine/app-shell.html',
      'https://evil.example/messages.html',
      'manager',
      '',
    )).toThrow();
  });

  it('uses home behavior only at the edition home route', () => {
    expect(resolveHardwareBackAction('custodial.today', 'custodial.today')).toBe('home');
    expect(resolveHardwareBackAction('custodial.messages', 'custodial.today')).toBe('pop');
  });
});
