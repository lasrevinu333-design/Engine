import { describe, expect, it } from 'vitest';
import {
  buildLegacyHandoffUrl,
  resolveHardwareBackAction,
} from './legacy-handoff';
import { measureViewport } from './viewport';

describe('shell foundation contracts', () => {
  it('keeps compatibility handoffs on origin and injects enrolled Custodial identity', () => {
    expect(buildLegacyHandoffUrl(
      'https://localhost/app-shell.html?shell=proof#/today',
      './messages.html?hub=employee',
      'custodial',
      'kiosk-4',
    )).toBe('https://localhost/messages.html?hub=employee&device=KIOSK_04');
    expect(() => buildLegacyHandoffUrl(
      'https://localhost/app-shell.html',
      'https://attacker.example/private.html',
      'manager',
      'ops-app-1234567890123456',
    )).toThrow(/Unsafe compatibility target/);
    expect(buildLegacyHandoffUrl(
      'https://localhost/app-shell.html',
      './messages.html?hub=employee',
      'custodial',
      'manager-device',
    )).toBe('https://localhost/messages.html?hub=employee');
  });

  it('defines deterministic hardware Back behavior', () => {
    expect(resolveHardwareBackAction('manager.messages', 'manager.today')).toBe('pop');
    expect(resolveHardwareBackAction('manager.today', 'manager.today')).toBe('home');
  });

  it('derives keyboard occlusion from the visual viewport without guessed insets', () => {
    expect(measureViewport(915, 560, 0, 1)).toEqual({
      viewportHeight: 560,
      viewportOffsetTop: 0,
      keyboardHeight: 355,
      keyboardOpen: true,
      scale: 1,
    });
    expect(measureViewport(800, 800, 0, 2)).toEqual({
      viewportHeight: 800,
      viewportOffsetTop: 0,
      keyboardHeight: 0,
      keyboardOpen: false,
      scale: 2,
    });
  });
});
