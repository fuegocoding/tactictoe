# Plan 9: Profiles, Match History & Leaderboards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public user profiles, match result pages, and a filterable leaderboard; update the sidebar with a Leaderboard nav item and a clickable profile link; persist move history on every game.

**Architecture:** RSC pages query Prisma directly for instant render with no spinners. Move history is added to the game-server → web-server result-reporting payload. A single `'use client'` island handles leaderboard filter controls via URL search params. Username is cached in the JWT at sign-in time (one DB query per login, not per request).

**Spec:** `docs/superpowers/specs/2026-03-20-plan7-profiles-leaderboards-design.md`

**Prerequisites:** Plans 1–6 complete. Run `pnpm install` from the repo root before starting.

---

## File Map

```
# Game server
apps/game-server/src/types.ts              MODIFY — add moveHistory to RoomState
apps/game-server/src/game-session.ts       MODIFY — accumulate moves, send in reportResult

# Web — data layer
apps/web/prisma/schema.prisma              MODIFY — add moveHistory Json? to Match
apps/web/src/lib/auth.ts                   MODIFY — jwt callback stores username; session reads it
apps/web/src/types/next-auth.d.ts         MODIFY — add username to Session + JWT augmentation
apps/web/src/lib/ratings.ts               MODIFY — add moveHistory to GameResultPayload + match.create
apps/web/src/app/api/ratings/update/route.ts  MODIFY — forward moveHistory to processGameResult

# Web — components
apps/web/src/components/Avatar.tsx         NEW
apps/web/src/components/MatchCard.tsx      NEW
apps/web/src/components/LeaderboardFilters.tsx  NEW  ('use client')
apps/web/src/components/Sidebar.tsx        MODIFY — Trophy nav item + clickable user block
apps/web/src/components/Sidebar.module.css MODIFY — add .profileLink

# Web — pages
apps/web/src/app/profile/[username]/page.tsx        NEW (RSC)
apps/web/src/app/profile/[username]/page.module.css NEW
apps/web/src/app/profile/[username]/loading.tsx     NEW (skeleton)
apps/web/src/app/match/[id]/page.tsx                NEW (RSC)
apps/web/src/app/match/[id]/page.module.css         NEW
apps/web/src/app/match/[id]/loading.tsx             NEW (skeleton)
apps/web/src/app/leaderboard/page.tsx               NEW (RSC)
apps/web/src/app/leaderboard/page.module.css        NEW
apps/web/src/app/leaderboard/loading.tsx            NEW (skeleton)
```

---

## Task 1: Add moveHistory to game server

**Files:**
- Modify: `apps/game-server/src/types.ts`
- Modify: `apps/game-server/src/game-session.ts`
- Test: `apps/game-server/src/game-session.test.ts`

### Step 1.1 — Add moveHistory field to RoomState

In `apps/game-server/src/types.ts`, add to `RoomState`:

```ts
export interface MoveRecord {
  boardIndex: number;
  cellIndex: number;
  player: 'X' | 'O';
}

export interface RoomState {
  // ... existing fields ...
  moveHistory: MoveRecord[];  // ADD — accumulates during the game
}
```

- [ ] Add `MoveRecord` interface and `moveHistory: MoveRecord[]` to `RoomState` in `apps/game-server/src/types.ts`.

### Step 1.2 — Initialise moveHistory in createRoom

In `apps/game-server/src/room-manager.ts`, the `createRoom` method builds the `RoomState` object. Add `moveHistory: []` to it:

```ts
const room: RoomState = {
  // ... existing fields ...
  moveHistory: [],
};
```

- [ ] Add `moveHistory: []` to the `RoomState` object literal in `room-manager.ts` `createRoom`.

### Step 1.3 — Accumulate moves in handleMove

In `apps/game-server/src/game-session.ts`, after `result.ok` check and before broadcasting, push the move:

```ts
// After: room.gameState = result.state;
room.moveHistory.push({
  boardIndex: payload.boardIndex,
  cellIndex: payload.cellIndex,
  player: playerSymbol,
});
```

- [ ] Add the push to `handleMove` in `game-session.ts` (after line `room.gameState = result.state;`).

### Step 1.4 — Send moveHistory in reportResult

In `reportResult` in `game-session.ts`, add `moveHistory: room.moveHistory` to the JSON body:

```ts
body: JSON.stringify({
  variantId: room.variantId,
  player1: { ... },
  player2: { ... },
  winner,
  reason,
  rated: room.rated,
  moveHistory: room.moveHistory,   // ADD
}),
```

- [ ] Add `moveHistory: room.moveHistory` to the `reportResult` POST body.

### Step 1.5 — Write unit tests for moveHistory accumulation

Add to `apps/game-server/src/game-session.test.ts`:

```ts
it('accumulates moveHistory during a game', async () => {
  // Set up a standard_3x3 room with two players using the existing test helpers
  // Play a move as X, check room.moveHistory has one entry
  // Play a move as O, check room.moveHistory has two entries
});
```

Look at the existing tests in `game-session.test.ts` for how rooms and sockets are set up — follow the same pattern.

- [ ] Write the failing test.
- [ ] Run: `pnpm --filter game-server test` — verify it fails.
- [ ] The implementation steps above should make it pass.
- [ ] Run: `pnpm --filter game-server test` — verify all tests pass.

### Step 1.6 — Commit

- [ ] `git add apps/game-server/src/` && `git commit -m "feat(game-server): accumulate and send moveHistory on game over"`

---

## Task 2: Add moveHistory to Match schema and ratings pipeline

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/src/lib/ratings.ts`
- Modify: `apps/web/src/app/api/ratings/update/route.ts`

### Step 2.1 — Add moveHistory to schema

In `apps/web/prisma/schema.prisma`, add to the `Match` model (after `ratingDelta2`):

```prisma
moveHistory   Json?    // Array<{boardIndex: number, cellIndex: number, player: 'X' | 'O'}>
```

- [ ] Add the field to `schema.prisma`.
- [ ] Run: `pnpm --filter web exec prisma db push` — expected output: `Your database is now in sync with your Prisma schema.`
- [ ] Run: `pnpm --filter web exec prisma generate` to regenerate the client.

### Step 2.2 — Add moveHistory to GameResultPayload and match.create

In `apps/web/src/lib/ratings.ts`:

```ts
export interface GameResultPayload {
  // ... existing fields ...
  moveHistory?: Array<{ boardIndex: number; cellIndex: number; player: 'X' | 'O' }>;
}
```

In `processGameResult`, add `moveHistory` to the `prisma.match.create` call:

```ts
await prisma.match.create({
  data: {
    // ... existing fields ...
    moveHistory: payload.moveHistory ?? null,
  },
});
```

- [ ] Add `moveHistory?` to `GameResultPayload` interface.
- [ ] Pass `moveHistory: payload.moveHistory ?? null` in `prisma.match.create`.

### Step 2.3 — Forward moveHistory in the API route

In `apps/web/src/app/api/ratings/update/route.ts`, the payload is already typed as `GameResultPayload` and passed directly to `processGameResult`. Since `moveHistory` is now part of `GameResultPayload`, no change is needed to the route itself — the JSON body will deserialise it automatically.

- [ ] Verify `route.ts` does `const payload: GameResultPayload = await request.json()` and calls `processGameResult(payload)` — no change needed.

### Step 2.4 — Commit

- [ ] `git add apps/web/prisma/ apps/web/src/lib/ratings.ts` && `git commit -m "feat(web): add moveHistory to Match schema and ratings pipeline"`

---

## Task 3: Auth — cache username in JWT

**Files:**
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/types/next-auth.d.ts`

### Step 3.1 — Extend type augmentation

Replace the contents of `apps/web/src/types/next-auth.d.ts` with:

```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      username?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    username?: string | null;
  }
}
```

- [ ] Replace `apps/web/src/types/next-auth.d.ts` with the above.

### Step 3.2 — Update auth callbacks

In `apps/web/src/lib/auth.ts`, make the `jwt` callback async and look up the username once at sign-in. Update the `session` callback to read from the token:

```ts
callbacks: {
  async jwt({ token, user }) {
    if (user?.id) {
      token.userId = user.id;
      // Look up username once at sign-in and cache in JWT
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { username: true },
      });
      token.username = profile?.username ?? null;
    }
    return token;
  },
  session({ session, token }) {
    if (token.userId && session.user) {
      session.user.id = token.userId as string;
      if (token.username) session.user.username = token.username;
    }
    return session;
  },
},
```

- [ ] Update `auth.ts` with the async `jwt` callback that fetches and caches username.

### Step 3.3 — Verify TypeScript compiles

- [ ] Run: `pnpm --filter web build 2>&1 | head -30` — look for no type errors related to `session.user.username` or `token.username`. (A full build pass is not required at this stage — just check there are no new type errors.)

### Step 3.4 — Commit

- [ ] `git add apps/web/src/lib/auth.ts apps/web/src/types/next-auth.d.ts` && `git commit -m "feat(web): cache username in JWT for sidebar profile link"`

---

## Task 4: Avatar component

**Files:**
- Create: `apps/web/src/components/Avatar.tsx`

### Step 4.1 — Create Avatar.tsx

```tsx
interface AvatarProps {
  username: string;
  size?: number;
}

function usernameHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

export default function Avatar({ username, size = 36 }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const hue = usernameHue(username);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 60%, 45%)`,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
```

- [ ] Create `apps/web/src/components/Avatar.tsx` with the above.
- [ ] No test needed for a pure render component — visually verify in Task 5.

### Step 4.2 — Commit

- [ ] `git add apps/web/src/components/Avatar.tsx` && `git commit -m "feat(web): add Avatar component with deterministic colour"`

---

## Task 5: Update Sidebar

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/Sidebar.module.css`

### Step 5.1 — Add Trophy nav item

In `Sidebar.tsx`, update the import:

```ts
import { Globe, Monitor, Grid3x3, BookOpen, Trophy } from 'lucide-react';
```

Add the Leaderboard nav item after Play Local and before Puzzles:

```tsx
<Link href="/leaderboard" className={`${styles.navItem} ${pathname === '/leaderboard' ? styles.active : ''}`}>
  <span className={styles.icon}><Trophy size={18} strokeWidth={1.75} /></span>
  <span className={styles.navLabel}>Leaderboard</span>
</Link>
```

- [ ] Add `Trophy` to the import and add the nav item at the correct position.

### Step 5.2 — Make user block clickable

Import `Avatar`:

```ts
import Avatar from './Avatar';
```

Replace the existing `{session?.user ? (...userInfo div...) : (...)}` block with:

```tsx
{session?.user ? (
  session.user.username ? (
    <Link href={`/profile/${session.user.username}`} className={styles.profileLink}>
      <Avatar username={session.user.username} size={28} />
      <div className={styles.userInfo}>
        <span className={styles.userName}>{session.user.name ?? 'Player'}</span>
        <span className={styles.userStatus}>View profile</span>
      </div>
    </Link>
  ) : (
    <div className={styles.userInfo}>
      <span className={styles.userName}>{session.user.name ?? 'Player'}</span>
      <span className={styles.userStatus}>Online</span>
    </div>
  )
) : (
  <div className={styles.actions}>
    <Link href="/login" style={{ width: '100%' }}>
      <Button variant="secondary" full>Sign In</Button>
    </Link>
    <Link href="/register" style={{ width: '100%' }}>
      <Button variant="primary" full>Sign Up</Button>
    </Link>
  </div>
)}
```

- [ ] Update the session user block in `Sidebar.tsx`.

### Step 5.3 — Add profileLink style

In `Sidebar.module.css`, add:

```css
.profileLink {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.profileLink:hover { background: var(--bg-hover); }
```

- [ ] Add `.profileLink` to `Sidebar.module.css`.

### Step 5.4 — Visual smoke test

- [ ] Run `pnpm --filter web dev` (or check if dev server already running). Navigate to `http://localhost:3000`. Verify:
  - "Leaderboard" appears in sidebar nav with a Trophy icon.
  - When signed out: Sign In / Sign Up buttons visible.
  - When signed in with a user who has a Profile: name shows with avatar, links to `/profile/[username]`.

### Step 5.5 — Commit

- [ ] `git add apps/web/src/components/Sidebar.tsx apps/web/src/components/Sidebar.module.css` && `git commit -m "feat(web): add Leaderboard nav item and clickable profile link to sidebar"`

---

## Task 6: Profile page and MatchCard component

**Files:**
- Create: `apps/web/src/components/MatchCard.tsx`
- Create: `apps/web/src/app/profile/[username]/page.tsx`
- Create: `apps/web/src/app/profile/[username]/page.module.css`
- Create: `apps/web/src/app/profile/[username]/loading.tsx`

### Step 6.1 — Create MatchCard component

```tsx
// apps/web/src/components/MatchCard.tsx
import Link from 'next/link';
import styles from './MatchCard.module.css';

export interface MatchCardData {
  id: string;
  variantId: string;
  createdAt: Date;
  winner: string | null;
  reason: string;
  player1Id: string | null;
  player1Name: string;
  player1Username: string | null;
  player2Id: string | null;
  player2Name: string;
  player2Username: string | null;
  ratingDelta1: number | null;
  ratingDelta2: number | null;
}

interface MatchCardProps {
  match: MatchCardData;
  perspectiveUserId: string;
}

function getResult(match: MatchCardData, perspectiveUserId: string): 'W' | 'L' | 'D' {
  const mySymbol = match.player1Id === perspectiveUserId ? 'X' : 'O';
  if (match.winner === null) return 'D';
  return match.winner === mySymbol ? 'W' : 'L';
}

function getDelta(match: MatchCardData, perspectiveUserId: string): number | null {
  if (match.player1Id === perspectiveUserId) return match.ratingDelta1;
  if (match.player2Id === perspectiveUserId) return match.ratingDelta2;
  return null;
}

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export default function MatchCard({ match, perspectiveUserId }: MatchCardProps) {
  const result = getResult(match, perspectiveUserId);
  const delta = getDelta(match, perspectiveUserId);
  const isP1 = match.player1Id === perspectiveUserId;
  const opponentName = isP1 ? match.player2Name : match.player1Name;
  const opponentUsername = isP1 ? match.player2Username : match.player1Username;
  const forfeit = match.reason === 'forfeit';

  return (
    <Link href={`/match/${match.id}`} className={styles.card}>
      <span className={`${styles.result} ${styles[result.toLowerCase()]}`}>
        {result}{forfeit ? '*' : ''}
      </span>
      <span className={styles.opponent}>
        {opponentName}
      </span>
      <span className={styles.variant}>{VARIANT_LABELS[match.variantId] ?? match.variantId}</span>
      <span className={styles.date}>{new Date(match.createdAt).toLocaleDateString()}</span>
      {delta !== null && (
        <span className={`${styles.delta} ${delta >= 0 ? styles.pos : styles.neg}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </Link>
  );
}
```

Also create `apps/web/src/components/MatchCard.module.css`:

```css
.card {
  display: grid;
  grid-template-columns: 2rem 1fr auto auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  font-size: var(--text-sm);
  transition: background 0.12s;
}
.card:hover { background: var(--bg-hover); }

.result {
  font-weight: 800;
  font-size: var(--text-base);
  text-align: center;
}
.result.w { color: var(--success); }
.result.l { color: var(--error); }
.result.d { color: var(--text-muted); }

.opponent { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variant  { color: var(--text-muted); white-space: nowrap; }
.date     { color: var(--text-faint); white-space: nowrap; }
.delta    { font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }
.delta.pos { color: var(--success); }
.delta.neg { color: var(--error); }
```

- [ ] Create `apps/web/src/components/MatchCard.tsx`.
- [ ] Create `apps/web/src/components/MatchCard.module.css`.

### Step 6.2 — Create profile page

```tsx
// apps/web/src/app/profile/[username]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import MatchCard, { type MatchCardData } from '@/components/MatchCard';
import styles from './page.module.css';

interface Props {
  params: { username: string };
}

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export default async function ProfilePage({ params }: Props) {
  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: { user: { include: { ratings: true } } },
  });
  if (!profile) notFound();

  const rawMatches = await prisma.match.findMany({
    where: { OR: [{ player1Id: profile.userId }, { player2Id: profile.userId }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      player1: { include: { profile: { select: { username: true } } } },
      player2: { include: { profile: { select: { username: true } } } },
    },
  });

  const matches: MatchCardData[] = rawMatches.map(m => ({
    id: m.id,
    variantId: m.variantId,
    createdAt: m.createdAt,
    winner: m.winner,
    reason: m.reason,
    player1Id: m.player1Id,
    player1Name: m.player1Name,
    player1Username: m.player1?.profile?.username ?? null,
    player2Id: m.player2Id,
    player2Name: m.player2Name,
    player2Username: m.player2?.profile?.username ?? null,
    ratingDelta1: m.ratingDelta1,
    ratingDelta2: m.ratingDelta2,
  }));

  const memberSince = profile.user.createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Avatar username={profile.username} size={56} />
        <div>
          <h1 className={styles.displayName}>{profile.displayName}</h1>
          <p className={styles.meta}>@{profile.username} · Member since {memberSince}</p>
        </div>
      </div>

      {profile.user.ratings.length === 0 ? (
        <p className={styles.empty}>No rated games yet.</p>
      ) : (
        <div className={styles.ratings}>
          {profile.user.ratings.map(r => (
            <div key={r.id} className={styles.ratingCard}>
              <p className={styles.ratingVariant}>{VARIANT_LABELS[r.variantId] ?? r.variantId}</p>
              <p className={styles.ratingValue}>{r.rd > 100 ? '~' : ''}{r.rating}</p>
              <p className={styles.ratingStats}>{r.wins}W · {r.losses}L · {r.draws}D</p>
            </div>
          ))}
        </div>
      )}

      <section className={styles.matchesSection}>
        <h2 className={styles.sectionTitle}>Recent Matches</h2>
        {matches.length === 0 ? (
          <p className={styles.empty}>No recent matches.</p>
        ) : (
          <div className={styles.matchesList}>
            {matches.map(m => (
              <MatchCard key={m.id} match={m} perspectiveUserId={profile.userId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/profile/[username]/page.tsx`.

### Step 6.3 — Create profile page CSS

```css
/* apps/web/src/app/profile/[username]/page.module.css */
.page { max-width: 720px; margin: 0 auto; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-8); }

.header { display: flex; align-items: center; gap: var(--space-5); }
.displayName { font-size: var(--text-2xl); font-weight: 800; }
.meta { font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-1); }

.ratings { display: flex; gap: var(--space-4); flex-wrap: wrap; }
.ratingCard {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  min-width: 160px;
}
.ratingVariant { font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.ratingValue { font-size: var(--text-3xl); font-weight: 800; color: var(--accent); margin-top: var(--space-1); }
.ratingStats { font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-1); }

.sectionTitle { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--space-4); }
.matchesList { background: var(--bg-raised); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
.matchesList > * + * { border-top: 1px solid var(--border); }
.empty { color: var(--text-muted); font-size: var(--text-sm); }
```

- [ ] Create `apps/web/src/app/profile/[username]/page.module.css`.

### Step 6.4 — Create profile loading skeleton

```tsx
// apps/web/src/app/profile/[username]/loading.tsx
import styles from './page.module.css';

export default function ProfileLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-subtle)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 180, height: 24, background: 'var(--bg-subtle)', borderRadius: 4 }} />
          <div style={{ width: 120, height: 16, background: 'var(--bg-subtle)', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ width: 200, height: 96, background: 'var(--bg-subtle)', borderRadius: 10 }} />
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/profile/[username]/loading.tsx`.

### Step 6.5 — Smoke test

- [ ] Navigate to `http://localhost:3000/profile/[a-username-that-exists]`. Verify profile renders with avatar, rating card, recent matches. Verify unknown username shows Next.js 404 page.

### Step 6.6 — Commit

- [ ] `git add apps/web/src/components/MatchCard.tsx apps/web/src/components/MatchCard.module.css apps/web/src/app/profile/` && `git commit -m "feat(web): add profile page and MatchCard component"`

---

## Task 7: Match detail page

**Files:**
- Create: `apps/web/src/app/match/[id]/page.tsx`
- Create: `apps/web/src/app/match/[id]/page.module.css`
- Create: `apps/web/src/app/match/[id]/loading.tsx`

### Step 7.1 — Create match page

```tsx
// apps/web/src/app/match/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import styles from './page.module.css';

interface Props {
  params: { id: string };
}

interface MoveRecord { boardIndex: number; cellIndex: number; player: 'X' | 'O' }

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

function resultLabel(winner: string | null, reason: string, p1Symbol: 'X' | 'O', p1Name: string, p2Name: string): string {
  if (reason === 'draw') return 'Draw';
  if (reason === 'forfeit') {
    const winnerName = winner === p1Symbol ? p1Name : p2Name;
    return `${winnerName} wins by forfeit`;
  }
  const winnerName = winner === p1Symbol ? p1Name : p2Name;
  return `${winnerName} wins`;
}

export default async function MatchPage({ params }: Props) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      player1: { include: { profile: { select: { username: true } } } },
      player2: { include: { profile: { select: { username: true } } } },
    },
  });
  if (!match) notFound();

  const p1Symbol: 'X' | 'O' = 'X';
  const p2Symbol: 'X' | 'O' = 'O';

  const p1Username = match.player1?.profile?.username ?? null;
  const p2Username = match.player2?.profile?.username ?? null;

  const result = resultLabel(match.winner, match.reason, p1Symbol, match.player1Name, match.player2Name);
  const moves = (match.moveHistory as MoveRecord[] | null) ?? null;

  // Build two-column move rows: [[x_move, o_move], ...]
  const moveRows: Array<{ num: number; x: string; o: string }> = [];
  if (moves) {
    const byTurn: MoveRecord[][] = [];
    for (let i = 0; i < moves.length; i += 2) {
      byTurn.push(moves.slice(i, i + 2));
    }
    byTurn.forEach((pair, idx) => {
      const fmt = (m: MoveRecord) => `b${m.boardIndex + 1}c${m.cellIndex + 1}`;
      moveRows.push({ num: idx + 1, x: pair[0] ? fmt(pair[0]) : '', o: pair[1] ? fmt(pair[1]) : '' });
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.variant}>{VARIANT_LABELS[match.variantId] ?? match.variantId}</p>
        <p className={styles.date}>{match.createdAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
      </div>

      <div className={styles.players}>
        <div className={`${styles.player} ${match.winner === 'X' ? styles.winner : ''}`}>
          <span className={styles.symbol} style={{ color: 'var(--mark-x)' }}>X</span>
          {p1Username
            ? <Link href={`/profile/${p1Username}`} className={styles.playerName}>{match.player1Name}</Link>
            : <span className={styles.playerName}>{match.player1Name}</span>
          }
          {match.ratingDelta1 !== null && (
            <span className={styles.delta} style={{ color: (match.ratingDelta1 ?? 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {(match.ratingDelta1 ?? 0) > 0 ? '+' : ''}{match.ratingDelta1}
            </span>
          )}
        </div>
        <span className={styles.vs}>vs</span>
        <div className={`${styles.player} ${match.winner === 'O' ? styles.winner : ''}`}>
          <span className={styles.symbol} style={{ color: 'var(--mark-o)' }}>O</span>
          {p2Username
            ? <Link href={`/profile/${p2Username}`} className={styles.playerName}>{match.player2Name}</Link>
            : <span className={styles.playerName}>{match.player2Name}</span>
          }
          {match.ratingDelta2 !== null && (
            <span className={styles.delta} style={{ color: (match.ratingDelta2 ?? 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {(match.ratingDelta2 ?? 0) > 0 ? '+' : ''}{match.ratingDelta2}
            </span>
          )}
        </div>
      </div>

      <p className={styles.result}>{result}</p>

      <section className={styles.movesSection}>
        <h2 className={styles.sectionTitle}>Move History</h2>
        {moves === null ? (
          <p className={styles.noHistory}>Move history not available for this match.</p>
        ) : moves.length === 0 ? (
          <p className={styles.noHistory}>No moves recorded.</p>
        ) : (
          <div className={styles.movesTable}>
            <div className={styles.movesHeader}>
              <span>#</span><span>X</span><span>O</span>
            </div>
            {moveRows.map(row => (
              <div key={row.num} className={styles.moveRow}>
                <span className={styles.moveNum}>{row.num}.</span>
                <span>{row.x}</span>
                <span className={styles.moveO}>{row.o}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/match/[id]/page.tsx`.

### Step 7.2 — Create match page CSS

```css
/* apps/web/src/app/match/[id]/page.module.css */
.page { max-width: 640px; margin: 0 auto; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); }
.header { display: flex; align-items: center; gap: var(--space-4); }
.variant { font-size: var(--text-sm); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.date { font-size: var(--text-sm); color: var(--text-faint); }

.players { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
.player { display: flex; align-items: center; gap: var(--space-3); flex: 1; }
.symbol { font-size: var(--text-2xl); font-weight: 900; }
.playerName { font-size: var(--text-lg); font-weight: 700; text-decoration: none; color: inherit; }
a.playerName:hover { color: var(--accent); }
.player.winner .playerName { color: var(--accent); }
.delta { font-size: var(--text-sm); font-weight: 600; }
.vs { color: var(--text-faint); font-size: var(--text-sm); }

.result { font-size: var(--text-xl); font-weight: 800; color: var(--text); }

.sectionTitle { font-size: var(--text-base); font-weight: 700; margin-bottom: var(--space-3); }
.noHistory { color: var(--text-muted); font-size: var(--text-sm); }

.movesTable { background: var(--bg-raised); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; font-size: var(--text-sm); font-family: var(--font-mono); }
.movesHeader { display: grid; grid-template-columns: 2rem 1fr 1fr; padding: var(--space-2) var(--space-4); background: var(--bg-subtle); color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); }
.moveRow { display: grid; grid-template-columns: 2rem 1fr 1fr; padding: var(--space-2) var(--space-4); }
.moveRow + .moveRow { border-top: 1px solid var(--border); }
.moveNum { color: var(--text-faint); }
.moveO { color: var(--text-muted); }
```

- [ ] Create `apps/web/src/app/match/[id]/page.module.css`.

### Step 7.3 — Create match loading skeleton

```tsx
// apps/web/src/app/match/[id]/loading.tsx
export default function MatchLoading() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[160, 240, 80, 200].map((w, i) => (
        <div key={i} style={{ width: w, height: 24, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      ))}
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/match/[id]/loading.tsx`.

### Step 7.4 — Smoke test

- [ ] Navigate to a match URL `/match/[id]` (grab an id from the database or from a recent match). Verify the page renders with both players, result, and move history (or the "not available" message for old matches). Verify unknown id shows 404.

### Step 7.5 — Commit

- [ ] `git add apps/web/src/app/match/` && `git commit -m "feat(web): add match detail page with move history"`

---

## Task 8: Leaderboard page

**Files:**
- Create: `apps/web/src/components/LeaderboardFilters.tsx`
- Create: `apps/web/src/app/leaderboard/page.tsx`
- Create: `apps/web/src/app/leaderboard/page.module.css`
- Create: `apps/web/src/app/leaderboard/loading.tsx`

### Step 8.1 — Create LeaderboardFilters client component

```tsx
// apps/web/src/components/LeaderboardFilters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from './LeaderboardFilters.module.css';

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
];

const VARIANTS = [
  { value: 'ultimate_ttt', label: 'Ultimate TTT' },
  { value: 'standard_3x3', label: 'Standard 3×3' },
];

interface Props {
  period: string;
  variant: string;
}

export default function LeaderboardFilters({ period, variant }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace('/leaderboard?' + params.toString(), { scroll: false });
  }

  return (
    <div className={styles.filters}>
      <div className={styles.group}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            className={`${styles.pill} ${period === p.value ? styles.active : ''}`}
            onClick={() => update('period', p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.group}>
        {VARIANTS.map(v => (
          <button
            key={v.value}
            className={`${styles.pill} ${variant === v.value ? styles.active : ''}`}
            onClick={() => update('variant', v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Also create `apps/web/src/components/LeaderboardFilters.module.css`:

```css
.filters { display: flex; flex-direction: column; gap: var(--space-3); }
.group { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.pill {
  padding: var(--space-2) var(--space-4);
  border-radius: 9999px;
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--bg-subtle);
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.12s;
}
.pill:hover { background: var(--bg-hover); color: var(--text); }
.pill.active { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
```

- [ ] Create `apps/web/src/components/LeaderboardFilters.tsx`.
- [ ] Create `apps/web/src/components/LeaderboardFilters.module.css`.

### Step 8.2 — Create leaderboard page

```tsx
// apps/web/src/app/leaderboard/page.tsx
import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import LeaderboardFilters from '@/components/LeaderboardFilters';
import styles from './page.module.css';

interface Props {
  searchParams: { period?: string; variant?: string };
}

const VALID_VARIANTS = ['ultimate_ttt', 'standard_3x3'];
const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

async function getLeaderboardRows(variantId: string, period: string) {
  if (period === 'all') {
    const ratings = await prisma.rating.findMany({
      where: { variantId },
      orderBy: { rating: 'desc' },
      take: 50,
      include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
    });
    return ratings.filter(r => r.user.profile !== null);
  }

  const cutoff = new Date(Date.now() - (period === 'week' ? 7 : 30) * 86_400_000);

  const [p1Rows, p2Rows] = await Promise.all([
    prisma.match.findMany({
      where: { variantId, rated: true, createdAt: { gte: cutoff }, player1Id: { not: null } },
      select: { player1Id: true },
      distinct: ['player1Id'],
    }),
    prisma.match.findMany({
      where: { variantId, rated: true, createdAt: { gte: cutoff }, player2Id: { not: null } },
      select: { player2Id: true },
      distinct: ['player2Id'],
    }),
  ]);

  const activeUserIds = [...new Set([
    ...p1Rows.map(r => r.player1Id!),
    ...p2Rows.map(r => r.player2Id!),
  ])];

  if (activeUserIds.length === 0) return [];

  const ratings = await prisma.rating.findMany({
    where: { variantId, userId: { in: activeUserIds } },
    orderBy: { rating: 'desc' },
    take: 50,
    include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
  });
  return ratings.filter(r => r.user.profile !== null);
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const period = ['all', 'month', 'week'].includes(searchParams.period ?? '') ? (searchParams.period ?? 'all') : 'all';
  const variantId = VALID_VARIANTS.includes(searchParams.variant ?? '') ? (searchParams.variant ?? 'ultimate_ttt') : 'ultimate_ttt';

  const rows = await getLeaderboardRows(variantId, period);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.subtitle}>{VARIANT_LABELS[variantId]} · Top players</p>
      </div>

      <Suspense>
        <LeaderboardFilters period={period} variant={variantId} />
      </Suspense>

      {rows.length === 0 ? (
        <p className={styles.empty}>No players found for this period.</p>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>#</span>
            <span>Player</span>
            <span>Rating</span>
            <span>W</span>
            <span>L</span>
            <span>D</span>
          </div>
          {rows.map((r, i) => {
            const profile = r.user.profile!;
            return (
              <Link key={r.id} href={`/profile/${profile.username}`} className={styles.row}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.player}>
                  <Avatar username={profile.username} size={28} />
                  <span>{profile.displayName}</span>
                </span>
                <span className={styles.rating}>
                  {r.rd > 100 ? '~' : ''}{r.rating}
                </span>
                <span className={styles.stat}>{r.wins}</span>
                <span className={styles.stat}>{r.losses}</span>
                <span className={styles.stat}>{r.draws}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/leaderboard/page.tsx`.

### Step 8.3 — Create leaderboard CSS

```css
/* apps/web/src/app/leaderboard/page.module.css */
.page { max-width: 720px; margin: 0 auto; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); }
.header { display: flex; flex-direction: column; gap: var(--space-1); }
.title { font-size: var(--text-3xl); font-weight: 800; }
.subtitle { font-size: var(--text-sm); color: var(--text-muted); }

.empty { color: var(--text-muted); font-size: var(--text-sm); }

.table { background: var(--bg-raised); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
.tableHeader {
  display: grid;
  grid-template-columns: 2.5rem 1fr 5rem 2.5rem 2.5rem 2.5rem;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-subtle);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.row {
  display: grid;
  grid-template-columns: 2.5rem 1fr 5rem 2.5rem 2.5rem 2.5rem;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  text-decoration: none;
  color: inherit;
  font-size: var(--text-sm);
  transition: background 0.12s;
}
.row + .row { border-top: 1px solid var(--border); }
.row:hover { background: var(--bg-hover); }

.rank { color: var(--text-faint); font-weight: 600; }
.player { display: flex; align-items: center; gap: var(--space-3); font-weight: 600; min-width: 0; overflow: hidden; }
.rating { font-weight: 800; color: var(--accent); }
.stat { color: var(--text-muted); text-align: right; }
```

- [ ] Create `apps/web/src/app/leaderboard/page.module.css`.

### Step 8.4 — Create leaderboard loading skeleton

```tsx
// apps/web/src/app/leaderboard/loading.tsx
export default function LeaderboardLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ width: 200, height: 36, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      <div style={{ width: 160, height: 40, background: 'var(--bg-subtle)', borderRadius: 999 }} />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ height: 44, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      ))}
    </div>
  );
}
```

- [ ] Create `apps/web/src/app/leaderboard/loading.tsx`.

### Step 8.5 — Smoke test

- [ ] Navigate to `http://localhost:3000/leaderboard`. Verify:
  - Page renders with the filter controls.
  - Clicking period tabs updates URL and re-renders the table.
  - Clicking variant tabs does the same.
  - Player rows link to their profiles.
  - Empty state shows correctly if no data for filter.

### Step 8.6 — Commit

- [ ] `git add apps/web/src/components/LeaderboardFilters.tsx apps/web/src/components/LeaderboardFilters.module.css apps/web/src/app/leaderboard/` && `git commit -m "feat(web): add leaderboard page with period and variant filters"`

---

## Task 9: Push and final check

- [ ] Run `pnpm --filter game-server test` — all tests pass.
- [ ] Run `pnpm --filter web build` — build succeeds with no type errors.
- [ ] `git push`
- [ ] Confirm in the browser:
  - Sidebar shows Leaderboard nav item with trophy icon.
  - Logged-in user's name links to their profile.
  - `/profile/[username]` page renders.
  - `/match/[id]` page renders.
  - `/leaderboard` page renders with working filters.
