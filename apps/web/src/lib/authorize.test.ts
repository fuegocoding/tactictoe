import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from './password';

// Mock prisma BEFORE importing authorize — vi.mock is hoisted but explicit ordering helps readability
const mockFindUnique = vi.fn();

vi.mock('./prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

// Import after mock is set up
const { authorizeCredentials } = await import('./authorize');

describe('authorizeCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-existent email', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await authorizeCredentials({ email: 'nobody@example.com', password: 'password123' });
    expect(result).toBeNull();
  });

  it('returns null for an OAuth-only user (passwordHash is null)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'oauth@example.com',
      passwordHash: null,
      profile: null,
    });
    const result = await authorizeCredentials({ email: 'oauth@example.com', password: 'password123' });
    expect(result).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    const hash = await hashPassword('correct-password');
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      profile: { displayName: 'Alice', avatarUrl: null },
    });
    const result = await authorizeCredentials({ email: 'user@example.com', password: 'wrong-password' });
    expect(result).toBeNull();
  });

  it('returns user data for correct credentials', async () => {
    const hash = await hashPassword('correct-password');
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      profile: { displayName: 'Alice', avatarUrl: 'https://example.com/avatar.png' },
    });
    const result = await authorizeCredentials({ email: 'user@example.com', password: 'correct-password' });
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-1');
    expect(result!.email).toBe('user@example.com');
    expect(result!.name).toBe('Alice');
    expect(result!.image).toBe('https://example.com/avatar.png');
  });

  it('normalizes email to lowercase before lookup', async () => {
    mockFindUnique.mockResolvedValue(null);
    await authorizeCredentials({ email: 'USER@EXAMPLE.COM', password: 'password' });
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user@example.com' } })
    );
  });

  it('returns user with null name when profile is missing', async () => {
    const hash = await hashPassword('correct-password');
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      profile: null,
    });
    const result = await authorizeCredentials({ email: 'user@example.com', password: 'correct-password' });
    expect(result).not.toBeNull();
    expect(result!.name).toBeNull();
  });
});
