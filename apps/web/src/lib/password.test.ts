import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateEmail,
  validateUsername,
} from './password';

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('wrong-horse', hash)).toBe(false);
  });

  it('produces different hashes for the same password (salted)', async () => {
    const h1 = await hashPassword('password');
    const h2 = await hashPassword('password');
    expect(h1).not.toBe(h2);
  });
});

describe('validatePassword', () => {
  it('accepts a valid password (8+ chars)', () => {
    expect(validatePassword('validpw1')).toBeNull();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('short')).toMatch(/8 characters/);
  });

  it('rejects passwords longer than 100 characters', () => {
    expect(validatePassword('a'.repeat(101))).toMatch(/100 characters/);
  });
});

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('rejects an email without @', () => {
    expect(validateEmail('not-an-email')).not.toBeNull();
  });

  it('rejects an email without domain', () => {
    expect(validateEmail('user@')).not.toBeNull();
  });
});

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('Alice_42')).toBeNull();
  });

  it('rejects usernames shorter than 3 characters', () => {
    expect(validateUsername('ab')).not.toBeNull();
  });

  it('rejects usernames longer than 20 characters', () => {
    expect(validateUsername('a'.repeat(21))).not.toBeNull();
  });

  it('rejects usernames with special characters', () => {
    expect(validateUsername('user@name')).not.toBeNull();
  });

  it('allows underscores in usernames', () => {
    expect(validateUsername('user_name')).toBeNull();
  });
});
