import { describe, expect, it } from 'vitest';
import { custodialDefinition } from '../roles/custodial/routes';
import { managerDefinition } from '../roles/manager/routes';
import { viewerDefinition } from '../roles/viewer/routes';
import {
  normalizeExternalRoute,
  normalizeShellPath,
} from './route-normalization';

describe('route normalization', () => {
  it('maps only the selected edition route registry', () => {
    expect(normalizeExternalRoute('memphiszoo://route/messages', managerDefinition)).toEqual({
      kind: 'shell',
      routeId: 'manager.messages',
      path: '/messages',
    });
    expect(normalizeExternalRoute('memphiszoo://route/phone-assignments', custodialDefinition)).toBeNull();
  });

  it('normalizes a custom-scheme custodial scan and strips sensitive or unknown fields', () => {
    const route = normalizeExternalRoute(
      'memphiszoo://scan/AQUARIUM?code=QUERY_WILL_NOT_WIN&action=start&device=KIOSK_09&token=secret&location=Cat%20House',
      custodialDefinition,
    );
    expect(route).toEqual({
      kind: 'legacy',
      routeId: 'custodial.cleaning',
      target: './scan.html?code=AQUARIUM&location=Cat+House&action=start',
    });
  });

  it('accepts approved project App Links and rejects other hosts', () => {
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/index.html?code=PANDA&session_uuid=00000000-0000-4000-8000-000000000123',
      custodialDefinition,
    )).toEqual({
      kind: 'legacy',
      routeId: 'custodial.cleaning',
      target: './scan.html?code=PANDA&session_uuid=00000000-0000-4000-8000-000000000123',
    });
    expect(normalizeExternalRoute(
      'https://attacker.example/Engine/index.html?code=PANDA',
      custodialDefinition,
    )).toBeNull();
    expect(normalizeExternalRoute(
      'http://lasrevinu333-design.github.io/Engine/index.html?code=PANDA',
      custodialDefinition,
    )).toBeNull();
  });

  it('accepts the canonical deployed root NFC link', () => {
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/?code=TETM',
      custodialDefinition,
    )).toEqual({
      kind: 'legacy',
      routeId: 'custodial.cleaning',
      target: './scan.html?code=TETM',
    });
  });

  it('rejects invalid or ambiguous scan parameters', () => {
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/?code=TETM&action=delete',
      custodialDefinition,
    )).toBeNull();
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/?session_uuid=123&action=resume',
      custodialDefinition,
    )).toBeNull();
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/?location=AQUARIUM&loc=TETM',
      custodialDefinition,
    )).toBeNull();
  });

  it('does not route private event links into Viewer', () => {
    expect(normalizeExternalRoute('memphiszoo://event/42', viewerDefinition)).toBeNull();
    expect(normalizeExternalRoute('memphiszoo://event/42', managerDefinition)).toEqual({
      kind: 'legacy',
      routeId: 'manager.events',
      target: './events.html?hub=manager&event_id=42',
    });
  });

  it('preserves safe local compatibility pages without allowing traversal', () => {
    expect(normalizeExternalRoute(
      'https://localhost/guest-issues.html?filter=open&device=KIOSK_09&token=secret&unknown=value',
      managerDefinition,
    )).toEqual({
      kind: 'legacy',
      routeId: 'manager.guestIssues',
      target: './guest-issues.html?filter=open',
    });
    expect(normalizeExternalRoute(
      'https://localhost/%2e%2e/private.json',
      managerDefinition,
    )).toBeNull();
  });

  it('rejects safe-looking pages outside the selected role registry', () => {
    expect(normalizeExternalRoute(
      'https://localhost/manager-access.html',
      custodialDefinition,
    )).toBeNull();
  });

  it('uses the canonical registered target for ambiguous legacy pages', () => {
    expect(normalizeExternalRoute(
      'https://lasrevinu333-design.github.io/Engine/index.html#more',
      managerDefinition,
    )).toEqual({
      kind: 'legacy',
      routeId: 'manager.more',
      target: './index.html#more',
    });
  });

  it('rejects malformed encoded route data without throwing', () => {
    expect(normalizeExternalRoute(
      'memphiszoo://route/%E0%A4%A',
      managerDefinition,
    )).toBeNull();
    expect(normalizeExternalRoute(
      `memphiszoo://event/${'a'.repeat(129)}`,
      managerDefinition,
    )).toBeNull();
  });

  it('falls back to the edition home for unknown internal paths', () => {
    expect(normalizeShellPath('/unknown', managerDefinition)).toBe('/today');
    expect(normalizeShellPath('events', viewerDefinition)).toBe('/events');
  });
});
