import { createHash, randomUUID, randomInt } from 'crypto';

export function generateGuestId(): string {
  // Replace insecure Math.random() with a secure UUIDv4 generator
  const secureId = randomUUID();
  return secureId;
}

export function generateDisplayName(): string {
  // Use cryptographically secure randomInt to avoid modulo bias
  const num = randomInt(1000, 10000);
  return `Guest#${num}`;
}

/**
 * One-way hash of client IP — stored for spam rate-limiting, never reversible.
 * Returns the first 16 hex characters of SHA-256 (64-bit truncation).
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/** Returns a Date 30 minutes from now — the expiry for a new/renewed guest session. */
export function getGuestSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 30);
  return expiry;
}

export function isGuestSessionExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime();
}
