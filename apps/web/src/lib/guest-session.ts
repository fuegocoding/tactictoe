import { createHash } from 'crypto';

export function generateGuestId(): string {
  return crypto.randomUUID();
}

export function generateDisplayName(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
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
