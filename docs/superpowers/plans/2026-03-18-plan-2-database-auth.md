# Plan 2: Database + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js web app with Railway PostgreSQL (via Prisma), define the user/profile/guest-session schema, and wire NextAuth.js for email+password and Google OAuth authentication.

**Architecture:** `apps/web` is a Next.js 14 App Router app deployed standalone to Railway. All business logic lives in testable `src/lib/*.ts` files — route handlers are thin wrappers. NextAuth.js uses JWT sessions (cookie-based) with PrismaAdapter for OAuth account storage. Guest sessions are stored in PostgreSQL with an HttpOnly cookie tracking the `guestId` UUID.

**Tech Stack:** Next.js 14, TypeScript 5, Prisma 5, NextAuth.js v4, `@next-auth/prisma-adapter`, bcryptjs, Vitest

---

## File Map

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── .env.example
├── prisma/
│   └── schema.prisma             # DB schema: users, profiles, guest_sessions, NextAuth tables
└── src/
    ├── types/
    │   └── next-auth.d.ts        # Augment session.user with id field
    ├── lib/
    │   ├── prisma.ts             # Prisma client singleton (global to avoid hot-reload leaks)
    │   ├── password.ts           # hashPassword, verifyPassword, validateEmail/Password/Username
    │   ├── password.test.ts
    │   ├── authorize.ts          # authorizeCredentials — credential login logic (testable)
    │   ├── authorize.test.ts
    │   ├── auth.ts               # NextAuth authOptions (imports authorize.ts)
    │   ├── register.ts           # registerUser — user+profile creation logic (testable)
    │   ├── register.test.ts
    │   ├── guest-session.ts      # Pure helpers: generateGuestId, hashIp, expiry math
    │   └── guest-session.test.ts
    └── app/
        ├── layout.tsx            # Root layout (minimal placeholder)
        ├── page.tsx              # Homepage placeholder
        └── api/
            ├── auth/
            │   ├── [...nextauth]/
            │   │   └── route.ts  # NextAuth handler
            │   └── register/
            │       └── route.ts  # POST /api/auth/register
            └── guest-session/
                └── route.ts      # GET + POST /api/guest-session
```

**Boundary contract:** `lib/` contains all testable business logic. `app/api/` route handlers only parse the request, call lib functions, and format the response. Never put logic directly in route handlers.

---

## Task 1: Next.js App Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`

- [ ] **Step 1.1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-auth": "^4.24.0",
    "@next-auth/prisma-adapter": "^1.0.7",
    "@prisma/client": "^5.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/bcryptjs": "^2.4.6",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 1.2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Note: `moduleResolution: "bundler"` is what Next.js uses (not NodeNext). This means imports do NOT need `.js` extensions — you can import `'./prisma'` without the extension. This is different from `apps/game-server` which uses NodeNext.

- [ ] **Step 1.3: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Railway Docker deployment
};

export default nextConfig;
```

- [ ] **Step 1.4: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 1.5: Create `apps/web/.env.example`**

```
# Database (Railway PostgreSQL — copy from Railway dashboard)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Google OAuth (get from console.cloud.google.com)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Game Server URL (for client-side Socket.io connection)
NEXT_PUBLIC_GAME_SERVER_URL="http://localhost:4000"
```

Copy to `apps/web/.env.local` and fill in values before running.

- [ ] **Step 1.6: Create `apps/web/src/app/layout.tsx`**

```tsx
export const metadata = {
  title: 'TacticToe',
  description: 'Competitive Tic-Tac-Toe and its deeper variants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 1.7: Create `apps/web/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main>
      <h1>TacticToe</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 1.8: Install dependencies**

Run from repo root: `pnpm install`
Expected: `apps/web` dependencies installed

- [ ] **Step 1.9: Verify TypeScript compiles**

Run from `apps/web`: `pnpm typecheck`
Expected: no errors (you may need `pnpm db:generate` first — if so, skip this step and come back after Task 3)

- [ ] **Step 1.10: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add Next.js 14 app scaffold with TypeScript and Vitest"
```

---

## Task 2: Prisma Schema

**Files:**
- Create: `apps/web/prisma/schema.prisma`

- [ ] **Step 2.1: Create `apps/web/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── NextAuth.js required tables ──────────────────────────────────────────────
// Required by PrismaAdapter even when using JWT sessions.
// Account stores OAuth tokens; Session/VerificationToken are used by OAuth flow.

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Users ────────────────────────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  passwordHash  String?   // null for OAuth-only users (Google sign-in)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile  Profile?
  accounts Account[]
  sessions Session[]

  @@map("users")
}

model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  username    String   @unique
  displayName String
  avatarUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

// ─── Guest sessions ───────────────────────────────────────────────────────────
// One row per guest browser session. guestId is stored in an HttpOnly cookie.
// migratedToUserId is set when the guest creates an account.

model GuestSession {
  id               String   @id @default(cuid())
  guestId          String   @unique  // UUID value stored in cookie
  displayName      String             // "Guest#XXXX"
  ipHash           String             // SHA-256 of IP, first 16 hex chars
  expiresAt        DateTime           // 30 minutes from last renewal
  migratedToUserId String?            // set on account conversion
  createdAt        DateTime @default(now())

  @@map("guest_sessions")
}
```

- [ ] **Step 2.2: Validate the schema**

Run from `apps/web`: `pnpm exec prisma validate`
Expected: "The schema at `prisma/schema.prisma` is valid"

- [ ] **Step 2.3: Commit schema**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat(web): add Prisma schema — users, profiles, guest_sessions, NextAuth tables"
```

---

## Task 3: Prisma Client + Migration

**Files:**
- Create: `apps/web/src/lib/prisma.ts`

- [ ] **Step 3.1: Create `apps/web/src/lib/prisma.ts`**

The global variable trick prevents creating multiple Prisma client instances during Next.js hot-reloads in development.

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 3.2: Generate Prisma client**

Run from `apps/web`: `pnpm db:generate`
Expected: Prisma client generated into `node_modules/@prisma/client`

- [ ] **Step 3.3: Set up local database**

You need a local PostgreSQL instance OR use your Railway database directly.

**Option A — Railway dev database (simplest):**
Copy `DATABASE_URL` from Railway dashboard into `apps/web/.env.local`.

**Option B — Local PostgreSQL:**
```bash
# If you have PostgreSQL installed:
createdb tactictoe_dev
# Then set: DATABASE_URL="postgresql://localhost:5432/tactictoe_dev"
```

- [ ] **Step 3.4: Run first migration**

Run from `apps/web`: `pnpm db:migrate`
When prompted for migration name, enter: `init_users_auth`
Expected: Migration created and applied, all tables created in the database.

- [ ] **Step 3.5: Verify typecheck passes now**

Run from `apps/web`: `pnpm typecheck`
Expected: no errors (Prisma types are now generated)

- [ ] **Step 3.6: Commit**

```bash
git add apps/web/src/lib/prisma.ts apps/web/prisma/migrations/
git commit -m "feat(web): add Prisma client singleton and run initial migration"
```

---

## Task 4: Password + Validation Utilities

**Files:**
- Create: `apps/web/src/lib/password.ts`
- Create: `apps/web/src/lib/password.test.ts`

These are pure functions with no database dependency — easy to test.

- [ ] **Step 4.1: Write failing tests**

Create `apps/web/src/lib/password.test.ts`:

```typescript
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
```

- [ ] **Step 4.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./password` module not found

- [ ] **Step 4.3: Implement `apps/web/src/lib/password.ts`**

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 100) return 'Password must be at most 100 characters';
  return null;
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email address';
  return null;
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be at most 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}
```

- [ ] **Step 4.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: 12 tests pass

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/lib/password.ts apps/web/src/lib/password.test.ts
git commit -m "feat(web): add password hashing and validation utilities with tests"
```

---

## Task 5: Credentials Authorize Function

**Files:**
- Create: `apps/web/src/lib/authorize.ts`
- Create: `apps/web/src/lib/authorize.test.ts`

Extracting the authorize function from NextAuth makes it unit-testable without spinning up the full auth system.

- [ ] **Step 5.1: Write failing tests**

Create `apps/web/src/lib/authorize.test.ts`:

```typescript
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

  it('returns null if profile exists but displayName is missing gracefully', async () => {
    const hash = await hashPassword('correct-password');
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hash,
      profile: null, // no profile
    });
    const result = await authorizeCredentials({ email: 'user@example.com', password: 'correct-password' });
    expect(result).not.toBeNull();
    expect(result!.name).toBeNull();
  });
});
```

- [ ] **Step 5.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./authorize` module not found

- [ ] **Step 5.3: Implement `apps/web/src/lib/authorize.ts`**

```typescript
import { prisma } from './prisma';
import { verifyPassword } from './password';

export interface AuthorizeInput {
  email: string;
  password: string;
}

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export async function authorizeCredentials(
  input: AuthorizeInput
): Promise<AuthorizedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    include: { profile: true },
  });

  if (!user || !user.passwordHash) return null;

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.profile?.displayName ?? null,
    image: user.profile?.avatarUrl ?? null,
  };
}
```

- [ ] **Step 5.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: all tests pass (password tests + authorize tests)

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/lib/authorize.ts apps/web/src/lib/authorize.test.ts
git commit -m "feat(web): add credential authorize function with unit tests"
```

---

## Task 6: NextAuth.js Configuration + Route Handler

**Files:**
- Create: `apps/web/src/types/next-auth.d.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

No separate test file for this task — the authorize function (Task 5) covers the testable logic. The NextAuth config wires everything together.

- [ ] **Step 6.1: Create `apps/web/src/types/next-auth.d.ts`**

This augments the NextAuth session type to include `user.id` (which we add in the JWT callback).

```typescript
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
    };
  }
}
```

- [ ] **Step 6.2: Create `apps/web/src/lib/auth.ts`**

```typescript
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { authorizeCredentials } from './authorize';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        return authorizeCredentials({
          email: credentials.email,
          password: credentials.password,
        });
      },
    }),
  ],
  // JWT strategy — sessions are stored in signed cookies, not the database.
  // PrismaAdapter is still used for OAuth account/user creation.
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      // Attach user ID to the JWT on initial sign-in
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      // Expose user ID in the session object available to client components
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login', // redirect here when auth is required (page to build in Plan 4)
  },
};
```

- [ ] **Step 6.3: Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 6.4: Verify TypeScript**

Run from `apps/web`: `pnpm typecheck`
Expected: no errors

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/src/types/ apps/web/src/lib/auth.ts apps/web/src/app/api/auth/
git commit -m "feat(web): configure NextAuth.js with credentials and Google OAuth"
```

---

## Task 7: User Registration Logic + API Route

**Files:**
- Create: `apps/web/src/lib/register.ts`
- Create: `apps/web/src/lib/register.test.ts`
- Create: `apps/web/src/app/api/auth/register/route.ts`

- [ ] **Step 7.1: Write failing tests**

Create `apps/web/src/lib/register.test.ts`:

```typescript
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
    // Simulate $transaction calling the callback with prisma
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
    // The findUnique call should use lowercase email
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user@example.com' } })
    );
  });
});
```

- [ ] **Step 7.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./register` module not found

- [ ] **Step 7.3: Implement `apps/web/src/lib/register.ts`**

```typescript
import { prisma } from './prisma';
import { hashPassword, validateEmail, validatePassword, validateUsername } from './password';

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const emailErr = validateEmail(input.email);
  if (emailErr) return { ok: false, error: emailErr };

  const passwordErr = validatePassword(input.password);
  if (passwordErr) return { ok: false, error: passwordErr };

  const usernameErr = validateUsername(input.username);
  if (usernameErr) return { ok: false, error: usernameErr };

  const email = input.email.toLowerCase().trim();
  const username = input.username.trim();

  // Check both uniqueness constraints in parallel
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.profile.findUnique({ where: { username } }),
  ]);

  if (existingEmail) return { ok: false, error: 'Email already in use' };
  if (existingUsername) return { ok: false, error: 'Username already taken' };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { email, passwordHash },
    });
    await tx.profile.create({
      data: {
        userId: newUser.id,
        username,
        displayName: username, // default display name = username; user can change it later
      },
    });
    return newUser;
  });

  return { ok: true, userId: user.id };
}
```

- [ ] **Step 7.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: all tests pass

- [ ] **Step 7.5: Create `apps/web/src/app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/register';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const { email, password, username } = body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string' || typeof username !== 'string') {
    return NextResponse.json(
      { error: 'email, password, and username are required strings' },
      { status: 400 }
    );
  }

  const result = await registerUser({ email, password, username });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ userId: result.userId }, { status: 201 });
}
```

- [ ] **Step 7.6: Commit**

```bash
git add apps/web/src/lib/register.ts apps/web/src/lib/register.test.ts apps/web/src/app/api/auth/register/
git commit -m "feat(web): implement user registration with email uniqueness and bcrypt hashing"
```

---

## Task 8: Guest Session Utilities + API Route

**Files:**
- Create: `apps/web/src/lib/guest-session.ts`
- Create: `apps/web/src/lib/guest-session.test.ts`
- Create: `apps/web/src/app/api/guest-session/route.ts`

- [ ] **Step 8.1: Write failing tests**

Create `apps/web/src/lib/guest-session.test.ts`:

```typescript
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
```

- [ ] **Step 8.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./guest-session` module not found

- [ ] **Step 8.3: Implement `apps/web/src/lib/guest-session.ts`**

```typescript
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
```

- [ ] **Step 8.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: all tests pass

- [ ] **Step 8.5: Create `apps/web/src/app/api/guest-session/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateGuestId,
  generateDisplayName,
  hashIp,
  getGuestSessionExpiry,
  isGuestSessionExpired,
} from '@/lib/guest-session';

const COOKIE_NAME = 'guestId';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // 30 minutes in seconds — matches the DB expiry
  maxAge: 30 * 60,
  secure: process.env.NODE_ENV === 'production',
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
  );
}

/**
 * GET /api/guest-session
 * Returns the current guest session, or { guest: null } if none exists / expired.
 */
export async function GET(request: NextRequest) {
  const guestId = request.cookies.get(COOKIE_NAME)?.value;
  if (!guestId) {
    return NextResponse.json({ guest: null });
  }

  const session = await prisma.guestSession.findUnique({ where: { guestId } });
  if (!session || isGuestSessionExpired(session.expiresAt)) {
    return NextResponse.json({ guest: null });
  }

  return NextResponse.json({
    guest: { guestId: session.guestId, displayName: session.displayName },
  });
}

/**
 * POST /api/guest-session
 * Creates a new guest session, or renews an existing one.
 * Always sets/refreshes the HttpOnly cookie.
 */
export async function POST(request: NextRequest) {
  const existingGuestId = request.cookies.get(COOKIE_NAME)?.value;

  if (existingGuestId) {
    const existing = await prisma.guestSession.findUnique({
      where: { guestId: existingGuestId },
    });

    if (existing && !isGuestSessionExpired(existing.expiresAt)) {
      // Renew the session expiry
      const newExpiry = getGuestSessionExpiry();
      await prisma.guestSession.update({
        where: { id: existing.id },
        data: { expiresAt: newExpiry },
      });

      const response = NextResponse.json({
        guest: { guestId: existing.guestId, displayName: existing.displayName },
      });
      response.cookies.set(COOKIE_NAME, existing.guestId, COOKIE_OPTIONS);
      return response;
    }
  }

  // Create a fresh guest session
  const guestId = generateGuestId();
  const displayName = generateDisplayName();
  const ipHash = hashIp(getClientIp(request));
  const expiresAt = getGuestSessionExpiry();

  await prisma.guestSession.create({
    data: { guestId, displayName, ipHash, expiresAt },
  });

  const response = NextResponse.json(
    { guest: { guestId, displayName } },
    { status: 201 }
  );
  response.cookies.set(COOKIE_NAME, guestId, COOKIE_OPTIONS);
  return response;
}
```

- [ ] **Step 8.6: Run all tests**

Run from `apps/web`: `pnpm test`
Expected: all tests pass

Run from repo root: `pnpm test`
Expected: all tests pass (game-engine: 55, game-server: 27, web: ~30)

- [ ] **Step 8.7: Commit**

```bash
git add apps/web/src/lib/guest-session.ts apps/web/src/lib/guest-session.test.ts apps/web/src/app/api/guest-session/
git commit -m "feat(web): implement guest session API with HttpOnly cookie — create, renew, and lookup"
```

---

## Task 9: Final Verification

- [ ] **Step 9.1: Run all tests across the monorepo**

Run from repo root: `pnpm test`
Expected: all tests pass (game-engine + game-server + web)

- [ ] **Step 9.2: Typecheck the web app**

Run from `apps/web`: `pnpm typecheck`
Expected: no TypeScript errors

- [ ] **Step 9.3: Start dev server and verify it loads**

Run from `apps/web`: `pnpm dev`
Open `http://localhost:3000` — should show the "TacticToe / Coming soon." placeholder page.
Open `http://localhost:3000/api/guest-session` — should return `{"guest":null}` (GET with no cookie).

- [ ] **Step 9.4: Final commit**

```bash
git commit --allow-empty -m "chore: plan-2 database+auth complete — Prisma schema, NextAuth, registration, guest sessions"
```
