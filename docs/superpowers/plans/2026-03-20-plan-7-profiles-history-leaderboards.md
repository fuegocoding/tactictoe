# Plan 7: Profiles, Match History, Leaderboards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build public user profiles, match history pages, and variant leaderboards. Give players a reason to care about their account beyond the game itself.

**Prerequisites:** Plan 6 must be complete (Rating + Match tables exist, Glicko-2 is running).

**Scope:**
- `/profile/[username]` — public profile: avatar, rating, win/loss/draw stats, recent matches
- `/match/[id]` — individual match result page (no replay in this plan — just result + moves list)
- `/leaderboard` — top players per variant, filterable
- Nav updates: add Profile link for logged-in users
- Avatar: initials-based avatar (no file uploads yet — Plan 9+)

---

## File Map

```
apps/web/src/
├── app/
│   ├── profile/
│   │   └── [username]/
│   │       ├── page.tsx              ← NEW: public profile page
│   │       └── page.module.css       ← NEW
│   ├── match/
│   │   └── [id]/
│   │       ├── page.tsx              ← NEW: match result page
│   │       └── page.module.css       ← NEW
│   ├── leaderboard/
│   │   ├── page.tsx                  ← NEW: leaderboard page
│   │   └── page.module.css           ← NEW
│   └── api/
│       ├── profile/
│       │   └── [username]/route.ts   ← NEW: public profile data
│       └── leaderboard/route.ts      ← NEW: top ratings per variant
├── components/
│   ├── Avatar.tsx                    ← NEW: initials avatar
│   ├── MatchCard.tsx                 ← NEW: compact match result row
│   └── Nav.tsx                       ← MODIFY: add Profile link
└── prisma/
    └── schema.prisma                 ← MODIFY: add moveHistory to Match
```

---

## Task 1: Add Move History to Match

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/game-server/src/game-session.ts`
- Modify: `apps/web/src/lib/ratings.ts`

- [ ] **Step 1.1: Add `moveHistory` field to `Match` in schema.prisma**

```prisma
model Match {
  // ... existing fields ...
  moveHistory   Json?    // serialized array of moves [{boardIndex, cellIndex, player}]
  duration      Int?     // seconds
}
```

- [ ] **Step 1.2: Track moves in game-session.ts**

Add a `moves` array to the room's active game session. Each time `handleMove` is called, append to the array. When `game:over` fires, include the moves array in the `reportResult` call.

In the `GameResultPayload` (in `lib/ratings.ts`), add:
```typescript
moveHistory?: Array<{ boardIndex: number; cellIndex: number; player: 'X' | 'O' }>;
duration?: number;  // seconds from game start to end
```

- [ ] **Step 1.3: Store move history in `processGameResult`**

In `ratings.ts`, add `moveHistory` and `duration` to the `prisma.match.create` call.

- [ ] **Step 1.4: Push schema**

```bash
cd apps/web && pnpm db:push
```

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/game-server/src/game-session.ts apps/web/src/lib/ratings.ts
git commit -m "feat(db): add moveHistory and duration to Match table"
```

---

## Task 2: Profile API Route

**Files:**
- Create: `apps/web/src/app/api/profile/[username]/route.ts`

- [ ] **Step 2.1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { username: string } }
) {
  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: {
      user: {
        include: {
          ratings: true,
          matches1: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { player2: { include: { profile: true } } },
          },
          matches2: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { player1: { include: { profile: true } } },
          },
        },
      },
    },
  });

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Merge and sort recent matches
  const allMatches = [
    ...profile.user.matches1.map(m => ({ ...m, perspective: 'player1' as const })),
    ...profile.user.matches2.map(m => ({ ...m, perspective: 'player2' as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);

  return NextResponse.json({
    username: profile.username,
    displayName: profile.displayName,
    createdAt: profile.user.createdAt,
    ratings: profile.user.ratings,
    recentMatches: allMatches,
  });
}
```

- [ ] **Step 2.2: Commit**

```bash
git add apps/web/src/app/api/profile/
git commit -m "feat(web): add public profile API route"
```

---

## Task 3: Avatar Component

**Files:**
- Create: `apps/web/src/components/Avatar.tsx`

- [ ] **Step 3.1: Create `apps/web/src/components/Avatar.tsx`**

Generates a colored initial-letter avatar from the username. Color is deterministic (hash of username → one of 8 preset colors).

```tsx
const COLORS = [
  ['#1a1a1a', '#f3f4f6'],  // dark bg, light text
  ['#d97706', '#fff'],
  ['#16a34a', '#fff'],
  ['#2563eb', '#fff'],
  ['#9333ea', '#fff'],
  ['#dc2626', '#fff'],
  ['#0891b2', '#fff'],
  ['#ea580c', '#fff'],
];

function hashUsername(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % COLORS.length;
  return Math.abs(hash);
}

interface AvatarProps {
  username: string;
  size?: number;
}

export default function Avatar({ username, size = 36 }: AvatarProps) {
  const [bg, fg] = COLORS[hashUsername(username)];
  const initial = username[0]?.toUpperCase() ?? '?';

  return (
    <div
      aria-label={username}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initial}
    </div>
  );
}
```

- [ ] **Step 3.2: Commit**

```bash
git add apps/web/src/components/Avatar.tsx
git commit -m "feat(web): add deterministic initials Avatar component"
```

---

## Task 4: MatchCard Component

**Files:**
- Create: `apps/web/src/components/MatchCard.tsx`
- Create: `apps/web/src/components/MatchCard.module.css`

- [ ] **Step 4.1: Create `apps/web/src/components/MatchCard.module.css`**

```css
.card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  transition: background 0.12s;
}

.card:hover { background: var(--bg-hover); }

.result {
  width: 40px;
  text-align: center;
  font-weight: 700;
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  padding: 2px 0;
}

.win  { background: var(--success-subtle); color: var(--success); }
.loss { background: var(--error-subtle); color: var(--error); }
.draw { background: var(--bg-subtle); color: var(--text-muted); }

.players {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text);
  min-width: 0;
}

.vs { color: var(--text-faint); font-size: var(--text-xs); }

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.variant { font-size: var(--text-xs); color: var(--text-faint); }
.date    { font-size: var(--text-xs); color: var(--text-faint); }

.delta {
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: var(--font-mono);
}

.deltaPos { color: var(--success); }
.deltaNeg { color: var(--error); }
```

- [ ] **Step 4.2: Create `apps/web/src/components/MatchCard.tsx`**

```tsx
import Link from 'next/link';
import styles from './MatchCard.module.css';

interface MatchCardProps {
  matchId: string;
  outcome: 'win' | 'loss' | 'draw';
  opponentName: string;
  variantId: string;
  rated: boolean;
  ratingDelta?: number | null;
  createdAt: string;
}

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export default function MatchCard({
  matchId, outcome, opponentName, variantId, rated, ratingDelta, createdAt,
}: MatchCardProps) {
  const resultLabel = outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D';
  const date = new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Link href={`/match/${matchId}`} className={styles.card}>
      <span className={`${styles.result} ${styles[outcome]}`}>{resultLabel}</span>

      <div className={styles.players}>
        vs <strong>{opponentName}</strong>
      </div>

      <div className={styles.meta}>
        <span className={styles.variant}>{VARIANT_LABELS[variantId] ?? variantId}{rated ? ' · Rated' : ''}</span>
        <span className={styles.date}>{date}</span>
        {ratingDelta != null && ratingDelta !== 0 && (
          <span className={`${styles.delta} ${ratingDelta > 0 ? styles.deltaPos : styles.deltaNeg}`}>
            {ratingDelta > 0 ? '+' : ''}{ratingDelta}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/src/components/MatchCard.tsx apps/web/src/components/MatchCard.module.css
git commit -m "feat(web): add MatchCard component for match history display"
```

---

## Task 5: Profile Page

**Files:**
- Create: `apps/web/src/app/profile/[username]/page.tsx`
- Create: `apps/web/src/app/profile/[username]/page.module.css`

- [ ] **Step 5.1: Create `apps/web/src/app/profile/[username]/page.module.css`**

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-10) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.identity { flex: 1; }

.username {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.joined { font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-1); }

.ratingsRow {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.ratingCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  min-width: 160px;
}

.ratingVariant { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); font-weight: 600; }

.ratingValue {
  font-size: var(--text-3xl);
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
}

.ratingStats { font-size: var(--text-xs); color: var(--text-muted); }

.sectionTitle {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-3);
}

.matchList { display: flex; flex-direction: column; gap: var(--space-2); }

.empty {
  text-align: center;
  padding: var(--space-10);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.notFound {
  text-align: center;
  padding: var(--space-16) var(--space-4);
  color: var(--text-muted);
}
```

- [ ] **Step 5.2: Create `apps/web/src/app/profile/[username]/page.tsx`**

Server component — fetches data server-side for fast initial render.

```tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import MatchCard from '@/components/MatchCard';
import RatingBadge from '@/components/RatingBadge';
import styles from './page.module.css';

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `${params.username} — TacticToe` };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: {
      user: {
        select: {
          createdAt: true,
          ratings: { orderBy: { rating: 'desc' } },
          matches1: {
            take: 15,
            orderBy: { createdAt: 'desc' },
            include: { player2: { include: { profile: { select: { username: true, displayName: true } } } } },
          },
          matches2: {
            take: 15,
            orderBy: { createdAt: 'desc' },
            include: { player1: { include: { profile: { select: { username: true, displayName: true } } } } },
          },
        },
      },
    },
  });

  if (!profile) notFound();

  const { user } = profile;

  // Merge and sort matches
  const matches = [
    ...user.matches1.map(m => ({
      id: m.id,
      variantId: m.variantId,
      rated: m.rated,
      opponentName: m.player2?.profile?.displayName ?? m.player2Name ?? 'Guest',
      outcome: m.winner === null ? 'draw' : m.winner === 'X' ? 'win' : 'loss',
      ratingDelta: m.ratingDelta1,
      createdAt: m.createdAt.toISOString(),
    })),
    ...user.matches2.map(m => ({
      id: m.id,
      variantId: m.variantId,
      rated: m.rated,
      opponentName: m.player1?.profile?.displayName ?? m.player1Name ?? 'Guest',
      outcome: m.winner === null ? 'draw' : m.winner === 'O' ? 'win' : 'loss',
      ratingDelta: m.ratingDelta2,
      createdAt: m.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15) as Array<{
    id: string;
    variantId: string;
    rated: boolean;
    opponentName: string;
    outcome: 'win' | 'loss' | 'draw';
    ratingDelta: number | null;
    createdAt: string;
  }>;

  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Avatar username={profile.username} size={64} />
        <div className={styles.identity}>
          <h1 className={styles.username}>{profile.displayName ?? profile.username}</h1>
          {profile.displayName && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>@{profile.username}</p>
          )}
          <p className={styles.joined}>Member since {joinedDate}</p>
        </div>
      </div>

      {user.ratings.length > 0 && (
        <div>
          <h2 className={styles.sectionTitle}>Ratings</h2>
          <div className={styles.ratingsRow}>
            {user.ratings.map(r => (
              <div key={r.variantId} className={styles.ratingCard}>
                <span className={styles.ratingVariant}>{VARIANT_LABELS[r.variantId] ?? r.variantId}</span>
                <span className={styles.ratingValue}>{r.rating}</span>
                <span className={styles.ratingStats}>{r.wins}W / {r.losses}L / {r.draws}D</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className={styles.sectionTitle}>Recent matches</h2>
        {matches.length === 0 ? (
          <p className={styles.empty}>No matches yet.</p>
        ) : (
          <div className={styles.matchList}>
            {matches.map(m => (
              <MatchCard
                key={m.id}
                matchId={m.id}
                outcome={m.outcome}
                opponentName={m.opponentName}
                variantId={m.variantId}
                rated={m.rated}
                ratingDelta={m.ratingDelta}
                createdAt={m.createdAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "feat(web): add public profile page with ratings and match history"
```

---

## Task 6: Match Result Page

**Files:**
- Create: `apps/web/src/app/match/[id]/page.tsx`
- Create: `apps/web/src/app/match/[id]/page.module.css`

- [ ] **Step 6.1: Create `apps/web/src/app/match/[id]/page.tsx`**

Server component. Shows match result, players, variant, rating deltas. No move replay in this plan (added in a later plan).

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import styles from './page.module.css';

export default async function MatchPage({ params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      player1: { include: { profile: true } },
      player2: { include: { profile: true } },
    },
  });

  if (!match) notFound();

  const VARIANT_LABELS: Record<string, string> = {
    ultimate_ttt: 'Ultimate TTT',
    standard_3x3: 'Standard 3×3',
  };

  const date = new Date(match.createdAt).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });

  const resultText =
    match.reason === 'draw' ? "It's a draw"
    : match.reason === 'forfeit' ? `${match.winner === 'X' ? match.player1Name : match.player2Name} wins by forfeit`
    : `${match.winner === 'X' ? match.player1Name : match.player2Name} wins`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.variant}>{VARIANT_LABELS[match.variantId] ?? match.variantId}</p>
        {match.rated && <span className={styles.rated}>Rated</span>}
        <p className={styles.date}>{date}</p>
      </div>

      <h1 className={styles.result}>{resultText}</h1>

      <div className={styles.players}>
        <div className={styles.player}>
          <Avatar username={match.player1?.profile?.username ?? match.player1Name} size={48} />
          <div>
            <p className={styles.playerName}>
              {match.player1?.profile ? (
                <Link href={`/profile/${match.player1.profile.username}`}>{match.player1Name}</Link>
              ) : match.player1Name}
            </p>
            <p className={styles.playerSymbol}>X</p>
            {match.ratingDelta1 != null && (
              <p className={`${styles.delta} ${match.ratingDelta1 >= 0 ? styles.pos : styles.neg}`}>
                {match.ratingDelta1 >= 0 ? '+' : ''}{match.ratingDelta1}
              </p>
            )}
          </div>
        </div>

        <span className={styles.vs}>vs</span>

        <div className={styles.player}>
          <Avatar username={match.player2?.profile?.username ?? match.player2Name} size={48} />
          <div>
            <p className={styles.playerName}>
              {match.player2?.profile ? (
                <Link href={`/profile/${match.player2.profile.username}`}>{match.player2Name}</Link>
              ) : match.player2Name}
            </p>
            <p className={styles.playerSymbol}>O</p>
            {match.ratingDelta2 != null && (
              <p className={`${styles.delta} ${match.ratingDelta2 >= 0 ? styles.pos : styles.neg}`}>
                {match.ratingDelta2 >= 0 ? '+' : ''}{match.ratingDelta2}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2: Create `apps/web/src/app/match/[id]/page.module.css`**

```css
.page {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--space-10) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: center;
}

.header { display: flex; align-items: center; gap: var(--space-3); }
.variant { font-size: var(--text-sm); color: var(--text-muted); }
.rated { font-size: var(--text-xs); font-weight: 600; color: var(--accent); background: var(--accent-subtle); padding: 2px 8px; border-radius: var(--radius-sm); }
.date { font-size: var(--text-xs); color: var(--text-faint); }

.result { font-size: var(--text-3xl); font-weight: 700; text-align: center; }

.players { display: flex; align-items: center; gap: var(--space-8); }
.player { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center; }
.playerName { font-size: var(--text-base); font-weight: 600; }
.playerName a:hover { text-decoration: underline; }
.playerSymbol { font-size: var(--text-sm); color: var(--text-muted); }
.vs { font-size: var(--text-lg); color: var(--text-faint); font-weight: 600; }
.delta { font-size: var(--text-sm); font-weight: 700; font-family: var(--font-mono); }
.pos { color: var(--success); }
.neg { color: var(--error); }
```

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/app/match/
git commit -m "feat(web): add match result page"
```

---

## Task 7: Leaderboard

**Files:**
- Create: `apps/web/src/app/leaderboard/page.tsx`
- Create: `apps/web/src/app/leaderboard/page.module.css`
- Create: `apps/web/src/app/api/leaderboard/route.ts`

- [ ] **Step 7.1: Create `apps/web/src/app/api/leaderboard/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variant') ?? 'ultimate_ttt';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  const ratings = await prisma.rating.findMany({
    where: { variantId, rd: { lte: 200 } }, // Only "established" ratings (low RD)
    orderBy: { rating: 'desc' },
    take: limit,
    include: {
      user: {
        include: { profile: { select: { username: true, displayName: true } } },
      },
    },
  });

  const entries = ratings.map((r, i) => ({
    rank: i + 1,
    username: r.user.profile?.username ?? 'unknown',
    displayName: r.user.profile?.displayName ?? r.user.profile?.username ?? 'Unknown',
    rating: r.rating,
    rd: r.rd,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
  }));

  return NextResponse.json({ variantId, entries });
}
```

- [ ] **Step 7.2: Create `apps/web/src/app/leaderboard/page.module.css`**

```css
.page {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-10) var(--space-4);
}

.header { margin-bottom: var(--space-6); }

.title { font-size: var(--text-3xl); font-weight: 700; margin-bottom: var(--space-2); }
.subtitle { font-size: var(--text-sm); color: var(--text-muted); }

.variantTabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-6);
}

.tab {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  transition: color 0.12s;
}

.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

.table { width: 100%; border-collapse: collapse; }

.table th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.table td {
  padding: var(--space-3);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.table tbody tr:hover td { background: var(--bg-subtle); }

.rank { color: var(--text-faint); font-family: var(--font-mono); width: 40px; }
.rank.top { color: var(--accent); font-weight: 700; }

.playerCell { display: flex; align-items: center; gap: var(--space-3); }
.playerName { font-weight: 600; }
.playerName a:hover { text-decoration: underline; color: var(--accent); }

.rating { font-family: var(--font-mono); font-weight: 700; }

.provisional { color: var(--text-faint); font-size: var(--text-xs); }

.wld { color: var(--text-muted); font-size: var(--text-xs); }

.empty { text-align: center; padding: var(--space-16); color: var(--text-muted); }
```

- [ ] **Step 7.3: Create `apps/web/src/app/leaderboard/page.tsx`**

Client component (tab switching + data fetching):

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import styles from './page.module.css';

const VARIANTS = [
  { id: 'ultimate_ttt', label: 'Ultimate TTT' },
];

interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function LeaderboardPage() {
  const [variant, setVariant] = useState('ultimate_ttt');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?variant=${variant}`)
      .then(r => r.json())
      .then(data => { setEntries(data.entries ?? []); setLoading(false); });
  }, [variant]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.subtitle}>Top-rated players. Established ratings only (RD ≤ 200).</p>
      </div>

      <div className={styles.variantTabs}>
        {VARIANTS.map(v => (
          <button
            key={v.id}
            className={`${styles.tab} ${variant === v.id ? styles.active : ''}`}
            onClick={() => setVariant(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: 'var(--space-8)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>No established ratings yet. Play more ranked games!</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rating</th>
              <th>W/L/D</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.username}>
                <td><span className={`${styles.rank} ${e.rank <= 3 ? styles.top : ''}`}>{e.rank}</span></td>
                <td>
                  <div className={styles.playerCell}>
                    <Avatar username={e.username} size={28} />
                    <Link href={`/profile/${e.username}`} className={styles.playerName}>{e.displayName}</Link>
                  </div>
                </td>
                <td>
                  <span className={styles.rating}>{e.rating}</span>
                  {e.rd > 100 && <span className={styles.provisional}> ?</span>}
                </td>
                <td><span className={styles.wld}>{e.wins}/{e.losses}/{e.draws}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/app/leaderboard/ apps/web/src/app/api/leaderboard/
git commit -m "feat(web): add leaderboard page and API"
```

---

## Task 8: Nav Updates

**Files:**
- Modify: `apps/web/src/components/Nav.tsx`

- [ ] **Step 8.1: Add Leaderboard link + Profile link to Nav**

Add to the `Nav` server component:
- Always visible: "Leaderboard" link
- When logged in: Avatar + username linking to `/profile/[username]`

```tsx
// Inside Nav, in the actions div:
<Link href="/leaderboard" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>
  Leaderboard
</Link>

{session?.user && profile?.username && (
  <Link href={`/profile/${profile.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
    <Avatar username={profile.username} size={28} />
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>{profile.username}</span>
  </Link>
)}
```

This requires fetching the profile in the Nav server component:
```typescript
const profile = session?.user?.id
  ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { username: true } })
  : null;
```

- [ ] **Step 8.2: Commit**

```bash
git add apps/web/src/components/Nav.tsx
git commit -m "feat(web): add Leaderboard and Profile links to Nav"
```

---

## Task 9: Deploy + Verify

- [ ] **Step 9.1: Push**

```bash
git push origin main
```

- [ ] **Step 9.2: Manual test checklist**

- [ ] `/profile/[username]` loads correctly for a user with matches
- [ ] `/match/[id]` shows correct result and rating deltas
- [ ] `/leaderboard` loads and shows players with established ratings
- [ ] Nav shows Leaderboard link + Profile link when logged in
- [ ] Profile avatar is deterministic (same color every time for same username)

---

## Checklist

- [ ] Task 1: Move history in Match table
- [ ] Task 2: Profile API route
- [ ] Task 3: Avatar component
- [ ] Task 4: MatchCard component
- [ ] Task 5: Profile page
- [ ] Task 6: Match result page
- [ ] Task 7: Leaderboard
- [ ] Task 8: Nav updates
- [ ] Task 9: Deploy + verify
