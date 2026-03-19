import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before any imports that use it
const mockUserFindUnique = vi.fn();
const mockProfileFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockUserCreate = vi.fn();
const mockProfileCreate = vi.fn();

vi.mock('./prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    profile: {
      findUnique: mockProfileFindUnique,
      create: mockProfileCreate,
    },
    $transaction: mockTransaction,
  },
}));

const { registerUser } = await import('./register');

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an invalid email', async () => {
    const result = await registerUser({ email: 'not-an-email', password: 'password123', username: 'Alice' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const result = await registerUser({ email: 'user@example.com', password: 'short', username: 'Alice' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/password/i);
  });

  it('rejects a username shorter than 3 characters', async () => {
    const result = await registerUser({ email: 'user@example.com', password: 'password123', username: 'ab' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/username/i);
  });

  it('rejects a duplicate email', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'existing-user' });
    mockProfileFindUnique.mockResolvedValue(null);
    const result = await registerUser({ email: 'taken@example.com', password: 'password123', username: 'Alice' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects a duplicate username', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockProfileFindUnique.mockResolvedValue({ id: 'existing-profile' });
    const result = await registerUser({ email: 'new@example.com', password: 'password123', username: 'TakenUser' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/username/i);
  });

  it('creates a user and profile and returns the user ID on success', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockProfileFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      mockUserCreate.mockResolvedValue({ id: 'new-user-id' });
      return fn({
        user: { create: mockUserCreate },
        profile: { create: mockProfileCreate },
      });
    });

    const result = await registerUser({ email: 'new@example.com', password: 'password123', username: 'NewUser' });
    expect(result.ok).toBe(true);
    expect(result.userId).toBe('new-user-id');
  });

  it('normalizes email to lowercase', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockProfileFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      mockUserCreate.mockResolvedValue({ id: 'uid' });
      return fn({ user: { create: mockUserCreate }, profile: { create: mockProfileCreate } });
    });

    await registerUser({ email: 'USER@EXAMPLE.COM', password: 'password123', username: 'Alice' });
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user@example.com' } })
    );
  });
});
