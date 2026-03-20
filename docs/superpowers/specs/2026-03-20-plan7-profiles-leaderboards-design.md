# Design: Profiles, Match History & Leaderboards (Plan 7)

## Overview

Add public user profiles, individual match result pages, and a filterable leaderboard. Also update the sidebar to surface these features. All new pages use React Server Components with direct Prisma queries; the only client island is the leaderboard filter controls.

---

## Key schema facts (verified)

- `username` lives on `Profile`, not `User`. `User.profile` is an optional 1-to-1 relation (`Profile?`). In practice every registered user gets a `Profile` (the register flow creates both), but code must handle `profile === null` gracefully.
- `Profile` fields: `id`, `userId`, `username` (unique), `displayName`, `avatarUrl?`, `createdAt`, `updatedAt`.
- JWT strategy: the existing `jwt` callback stores the user's database id as `token.userId` (not `token.sub`). The `session` callback reads it back as `token.userId`.
- `Match.player1Name` and `Match.player2Name` are required strings (non-nullable) — they are always populated with a display name at match creation time.
- `Rating` has `@@unique([userId, variantId])` and `@@index([variantId, rating(sort: Desc)])`.

---

## Architecture

### Data fetching
- `/profile/[username]`, `/match/[id]`, `/leaderboard` — React Server Components, query Prisma at render time.
- Each route segment has a `loading.tsx` skeleton so users see instant feedback (streaming via Suspense).
- Leaderboard filters — single `'use client'` component (`LeaderboardFilters.tsx`) that updates URL search params via `router.replace`. The RSC re-renders with the new params.

### Session / username access
Cache `username` in the JWT at sign-in time (one DB query per login, not per request). Update both callbacks in `apps/web/src/lib/auth.ts`:

```ts
// jwt callback — runs at sign-in and token refresh
async jwt({ token, user }) {
  if (user?.id) {
    token.userId = user.id;
    // Look up username once at sign-in and store in the token
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { username: true },
    });
    token.username = profile?.username ?? null;
  }
  return token;
}

// session callback — reads from token, no DB query
async session({ session, token }) {
  if (token.userId && session.user) {
    session.user.id = token.userId as string;
    if (token.username) session.user.username = token.username as string;
  }
  return session;
}
```

Add both augmentations to `apps/web/src/types/next-auth.d.ts`:

```ts
// Session user — 'next-auth' module
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      username?: string;  // ADD THIS
    };
  }
}

// JWT — separate 'next-auth/jwt' module (required for token.username assignment)
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    username?: string | null;  // ADD THIS
  }
}
```

The `JWT` augmentation must be in `declare module 'next-auth/jwt'`, not `'next-auth'` — they are separate modules.

The Sidebar uses `session.user.username` for the profile link. If `username` is undefined (edge case: user has no Profile), the user block renders as non-clickable (no `<Link>` wrapping).

### Database changes
1. Add `moveHistory Json?` to `Match` in `schema.prisma`. Stores `Array<{boardIndex: number, cellIndex: number, player: 'X' | 'O'}>`.
2. Remove the previously proposed `@@index([variantId, updatedAt])` on `Rating` — it is not used by any query in this plan. The existing `@@unique([userId, variantId])` and `@@index([variantId, rating(sort: Desc)])` are sufficient.
3. Apply with `prisma db push`.

### moveHistory persistence
The game server calls `/api/ratings/update` on game over. Extend the flow:

- `apps/game-server/src/types.ts`: add `moveHistory: Array<{boardIndex: number, cellIndex: number, player: 'X' | 'O'}>` to `RoomState` and to the payload sent to the web server.
- `apps/game-server/src/game-session.ts`: accumulate moves in `room.moveHistory` on each `handleMove` call, send it in the `reportResult` POST body.
- `apps/web/src/lib/ratings.ts`: add `moveHistory?` to `GameResultPayload`, pass it to `prisma.match.create({ data: { ..., moveHistory } })`.
- `apps/web/src/app/api/ratings/update/route.ts`: extract `moveHistory` from the request body and forward it to `processGameResult`.

---

## Pages

### `/profile/[username]`
Server Component.

```ts
const profile = await prisma.profile.findUnique({
  where: { username: params.username },
  include: { user: { include: { ratings: true } } },
});
if (!profile) notFound();

const matches = await prisma.match.findMany({
  where: { OR: [{ player1Id: profile.userId }, { player2Id: profile.userId }] },
  orderBy: { createdAt: 'desc' },
  take: 20,
  include: {
    player1: { include: { profile: { select: { username: true } } } },
    player2: { include: { profile: { select: { username: true } } } },
  },
});
```

Displays:
- `<Avatar username={profile.username} size={40} />` + `profile.displayName` + "Member since" (`profile.user.createdAt` formatted as "Month Year").
- Rating cards for each `Rating` row: variant label, rating value (prefixed `~` if `rd > 100`), wins / losses / draws. If no ratings: "No rated games yet."
- Recent matches list: 20 matches rendered as `<MatchCard>` rows. Opponent name comes from the included `player1/player2.profile.username` (if registered) or `player1Name/player2Name` (always populated).

Access: fully public.

### `/match/[id]`
Server Component.

```ts
const match = await prisma.match.findUnique({
  where: { id: params.id },
  include: {
    player1: { include: { profile: { select: { username: true } } } },
    player2: { include: { profile: { select: { username: true } } } },
  },
});
if (!match) notFound();
```

Displays:
- Header: `player1Name` (X) vs `player2Name` (O). If player has a Profile, their name links to `/profile/[username]`.
- Result: Win / Draw / Forfeit (map `reason`: `'win'` → result determined by `winner` field; `'draw'` → "Draw"; `'forfeit'` → "Forfeit — [winner] wins").
- Variant label, date.
- Move history: render `moveHistory` JSON as a numbered two-column table (X moves | O moves), same format as the in-game panel. If `moveHistory` is null: "Move history not available for this match."

Access: fully public.

### `/leaderboard`
Server Component accepts `searchParams: { period?: string, variant?: string }`.

Defaults: `period = 'all'`, `variant = 'ultimate_ttt'`.

Variant selector shows all known variants (`['ultimate_ttt', 'standard_3x3']`) — always rendered. If no Rating data exists for the selected variant, the table body shows "No ranked games played yet for this variant."

**Period filter — `period = 'all'`:**
```ts
const ratings = await prisma.rating.findMany({
  where: { variantId },
  orderBy: { rating: 'desc' },
  take: 50,
  include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
});
// Filter out ratings where user.profile is null (edge case)
const rows = ratings.filter(r => r.user.profile !== null);
```

**Period filter — `period = 'week'` or `'month'`:**
```ts
const cutoff = new Date(Date.now() - (period === 'week' ? 7 : 30) * 86400_000);

// Two separate distinct queries to avoid cross-column distinct issues:
const p1Rows = await prisma.match.findMany({
  where: { variantId, rated: true, createdAt: { gte: cutoff }, player1Id: { not: null } },
  select: { player1Id: true },
  distinct: ['player1Id'],
});
const p2Rows = await prisma.match.findMany({
  where: { variantId, rated: true, createdAt: { gte: cutoff }, player2Id: { not: null } },
  select: { player2Id: true },
  distinct: ['player2Id'],
});
const activeUserIds = [...new Set([
  ...p1Rows.map(r => r.player1Id!),
  ...p2Rows.map(r => r.player2Id!),
])];

const ratings = await prisma.rating.findMany({
  where: { variantId, userId: { in: activeUserIds } },
  orderBy: { rating: 'desc' },
  take: 50,
  include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
});
const rows = ratings.filter(r => r.user.profile !== null);
```

Columns: rank (#), avatar + displayName (links to `/profile/[username]`), rating (prefixed `~` if `rd > 100`), W / L / D.

---

## Components

### `Avatar.tsx`
Props: `username: string`, `size?: number` (default 36).

Always shows the first two characters of `username`, uppercased. (Usernames are slugs without spaces; "first two chars" is the universal rule — no space-splitting logic needed.)

Colour (deterministic, reproducible):
```ts
function usernameHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
// style: background hsl(hue, 60%, 45%), color white
```

### `MatchCard.tsx`
Props:
```ts
interface MatchCardProps {
  match: {
    id: string;
    variantId: string;
    createdAt: Date;
    winner: string | null;
    reason: string;
    player1Id: string | null;
    player1Name: string;
    player1Username: string | null;  // resolved from player1.profile.username, null if guest
    player2Id: string | null;
    player2Name: string;
    player2Username: string | null;
    ratingDelta1: number | null;
    ratingDelta2: number | null;
  };
  perspectiveUserId: string;
}
```

The profile page passes each match with `player1Username` and `player2Username` pre-resolved from the included relations.

Result from perspective:
- `perspectiveUserId` is always the **profile owner's** `userId` (`profile.userId`), never the viewer's id. Pass it from the profile page as `profile.userId`.
- Determine perspective player's symbol: if `player1Id === perspectiveUserId` → X, else → O.
- Compare to `winner`: X/O matches → "W", opposite → "L", null → "D". Reason `'forfeit'` appends "(forfeit)".

Displays: result badge (W/L/D), opponent display name (links to `/profile/[username]` if `opponentUsername` is set), variant label, date, optional rating delta (`+12` / `-8` in muted text).

### `LeaderboardFilters.tsx`
`'use client'`. Reads current values with `useSearchParams()`. Renders:
- Period tabs: "All time" / "This month" / "This week" — pill buttons, active = accent colour.
- Variant buttons: "Ultimate TTT" / "Standard 3×3".

On change: `router.replace('/leaderboard?' + new URLSearchParams({ period, variant }), { scroll: false })`.

---

## Sidebar updates

**New nav item** — after "Play Local", before "Puzzles". Add `Trophy` to the existing `lucide-react` import line:
```tsx
import { Globe, Monitor, Grid3x3, BookOpen, Trophy } from 'lucide-react';
```
```tsx
<Link href="/leaderboard" className={`${styles.navItem} ${pathname === '/leaderboard' ? styles.active : ''}`}>
  <span className={styles.icon}><Trophy size={18} strokeWidth={1.75} /></span>
  <span className={styles.navLabel}>Leaderboard</span>
</Link>
```

**Clickable user block** — replace the existing non-linked `userInfo` div:
```tsx
{session?.user?.username ? (
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
)}
```

Add to `Sidebar.module.css`:
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

---

## File map

```
apps/web/prisma/schema.prisma                              MODIFY — add moveHistory to Match
apps/game-server/src/types.ts                              MODIFY — add moveHistory to RoomState + GameOverPayload body
apps/game-server/src/game-session.ts                       MODIFY — accumulate moveHistory, send in reportResult
apps/web/src/app/api/ratings/update/route.ts               MODIFY — extract moveHistory from body
apps/web/src/lib/ratings.ts                                MODIFY — add moveHistory to GameResultPayload + prisma.match.create
apps/web/src/lib/auth.ts                                   MODIFY — session callback adds username from Profile
apps/web/src/types/next-auth.d.ts                          MODIFY — add username?: string to Session user type

apps/web/src/app/
  profile/[username]/page.tsx                              NEW — RSC
  profile/[username]/page.module.css                       NEW
  profile/[username]/loading.tsx                           NEW — skeleton
  match/[id]/page.tsx                                      NEW — RSC
  match/[id]/page.module.css                               NEW
  match/[id]/loading.tsx                                   NEW — skeleton
  leaderboard/page.tsx                                     NEW — RSC
  leaderboard/page.module.css                              NEW
  leaderboard/loading.tsx                                  NEW — skeleton

apps/web/src/components/
  Avatar.tsx                                               NEW
  MatchCard.tsx                                            NEW
  LeaderboardFilters.tsx                                   NEW — 'use client'
  Sidebar.tsx                                              MODIFY
  Sidebar.module.css                                       MODIFY — add .profileLink
```

---

## Error & empty states

- Unknown username or match ID → `notFound()` → Next.js 404
- User has no ratings → "No rated games yet" placeholder
- User has no matches → "No recent matches" placeholder
- Leaderboard empty for filter → "No players found for this period"
- `moveHistory` null (old matches) → "Move history not available for this match"
- User has no Profile (no username) → sidebar user block non-clickable; leaderboard filters out that user's rating row

---

## Out of scope

- File upload avatars (Plan 9+)
- Match replay / board visualisation (future plan)
- Pagination beyond top 50
- Rating history charts
