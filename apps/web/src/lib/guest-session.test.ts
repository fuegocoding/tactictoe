import { describe, it, expect } from 'vitest';
import {
  generateGuestId,
  generateDisplayName,
  hashIp,
  getGuestSessionExpiry,
  isGuestSessionExpired,
} from './guest-session';

describe('generateGuestId', () => {
  it('generates a valid UUID v4', () => {
    const id = generateGuestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates unique IDs on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateGuestId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateDisplayName', () => {
  it('generates a name in Guest#XXXX format', () => {
    const name = generateDisplayName();
    expect(name).toMatch(/^Guest#\d{4}$/);
  });
});

describe('hashIp', () => {
  it('returns a 16-character hex string', () => {
    expect(hashIp('192.168.1.1')).toHaveLength(16);
  });

  it('produces the same hash for the same IP', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
  });

  it('produces different hashes for different IPs', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
  });

  it('handles IPv6 and the CGNAT sentinel "0.0.0.0" without throwing', () => {
    expect(() => hashIp('0.0.0.0')).not.toThrow();
    expect(() => hashIp('::1')).not.toThrow();
  });
});

describe('getGuestSessionExpiry', () => {
  it('returns a date approximately 30 minutes in the future', () => {
    const expiry = getGuestSessionExpiry();
    const diffMs = expiry.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(29 * 60 * 1000);
    expect(diffMs).toBeLessThan(31 * 60 * 1000);
  });
});

describe('isGuestSessionExpired', () => {
  it('returns true for a past date', () => {
    expect(isGuestSessionExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it('returns false for a future date', () => {
    expect(isGuestSessionExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});
