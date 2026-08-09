import { describe, expect, it } from 'vitest';
import { parseUrlWithHierarchicalCustomSchemes } from './custom-scheme-url';

const schemes = new Set(['memphiszoo:', 'memphiszoo-custodial:']);

describe('hierarchical custom-scheme URL parsing', () => {
  it('parses host and path independently of WebView opaque-path behavior', () => {
    const queryOnly = parseUrlWithHierarchicalCustomSchemes(
      'memphiszoo://scan?code=RESTROOM_TRACE',
      schemes,
    );
    expect(queryOnly?.protocol).toBe('memphiszoo:');
    expect(queryOnly?.input.hostname).toBe('scan');
    expect(queryOnly?.input.pathname).toBe('/');
    expect(queryOnly?.input.searchParams.get('code')).toBe('RESTROOM_TRACE');

    const pathCode = parseUrlWithHierarchicalCustomSchemes(
      'memphiszoo-custodial://scan/AQUARIUM?action=start',
      schemes,
    );
    expect(pathCode?.input.hostname).toBe('scan');
    expect(pathCode?.input.pathname).toBe('/AQUARIUM');
  });

  it('rejects ambiguous custom-scheme authority and malformed input', () => {
    expect(parseUrlWithHierarchicalCustomSchemes(
      'memphiszoo://user@scan?code=RESTROOM_TRACE',
      schemes,
    )).toBeNull();
    expect(parseUrlWithHierarchicalCustomSchemes('memphiszoo:scan', schemes)).toBeNull();
    expect(parseUrlWithHierarchicalCustomSchemes('http://[', schemes)).toBeNull();
  });

  it('preserves ordinary trusted-web URL parsing', () => {
    const parsed = parseUrlWithHierarchicalCustomSchemes(
      'https://lasrevinu333-design.github.io/Engine/?code=PANDA',
      schemes,
    );
    expect(parsed?.protocol).toBe('https:');
    expect(parsed?.input.hostname).toBe('lasrevinu333-design.github.io');
  });
});
