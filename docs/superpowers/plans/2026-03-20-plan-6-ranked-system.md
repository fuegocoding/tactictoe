# Plan 6: Ranked System (Glicko-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full competitive ranking system. Authenticated users can queue for rated Ultimate TTT matches. Glicko-2 ratings update after each rated game. A basic rating display appears on-screen after every rated game.

**Prerequisites:** Plans 4 and 5 must be complete (design system, matchmaking queue).

**Ranked scope for this plan:**
- **Ultimate TTT** — only ranked variant in this plan. Standard TTT is casual-only.
- **Glicko-2** — industry standard for rating systems with uncertainty tracking (Chess.com equivalent).
- **Account required** — guests can play casual games but cannot earn or affect ratings.
- **One Elo pool per variant** — Ultimate TTT has its own ladder.
- **No seasons yet** — season system is post-MVP (Plan 7+).

**Architecture:**
- Rating logic lives in the **web server** (Next.js API routes), not the game server. The game server is stateless and fires a webhook/HTTP call to the web server when a rated game finishes. The web server applies Glicko-2 and updates the database.
- Alternatively (simpler for now): game server calls a `POST /api/ratings/update` endpoint on the web server with the match result.
- Rated queue is separate from casual queue. Clients emit `queue:join:rated` instead of `queue:join`. The game server marks the room as `rated: true`.

---

## File Map

```
packages/
└── glicko2/                          ← NEW: shared Glicko-2 math package
    ├── src/
    │   └── index.ts                  ← Glicko-2 algorithm
    └── package.json

apps/game-server/src/
├── queue-manager.ts                  ← MODIFY: add rated queue support
├── types.ts                          ← MODIFY: add rated flag to RoomState
├── game-session.ts                   ← MODIFY: call web server on game over (rated games)
└── index.ts                          ← MODIFY: add queue:join:rated handler

apps/web/src/
├── app/
│   ├── api/
│   │   └── ratings/
│   │       └── update/route.ts       ← NEW: POST endpoint for game server to report results
│   └── page.tsx                      ← MODIFY: add Ranked tab to lobby
├── components/
│   └── RatingBadge.tsx               ← NEW: displays rating + uncertainty
└── prisma/
    └── schema.prisma                 ← MODIFY: add Rating, Match tables
```

---

## Task 1: Glicko-2 Package

**Files:**
- Create: `packages/glicko2/package.json`
- Create: `packages/glicko2/src/index.ts`
- Modify: `pnpm-workspace.yaml` (already includes `packages/*`)
- Modify: `apps/web/package.json` — add `"@tactictoe/glicko2": "workspace:*"` to dependencies

Glicko-2 uses a rating scale of 1500 (μ) and a ratings deviation (RD, φ) starting at 350 for new players. After each game period, both μ and φ are updated.

- [ ] **Step 1.1: Create `packages/glicko2/package.json`**

```json
{
  "name": "@tactictoe/glicko2",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 1.2: Create `packages/glicko2/src/index.ts`**

```typescript
// Glicko-2 Algorithm
// Reference: http://www.glicko.net/glicko/glicko2.pdf (Glickman 2012)

const GLICKO2_SCALE = 173.7178; // Convert Glicko-1 to Glicko-2 scale

export interface Rating {
  rating: number;       // μ in Glicko-1 scale (e.g. 1500)
  rd: number;           // φ in Glicko-1 scale (e.g. 350 for new player, 50 for established)
  volatility: number;   // σ (e.g. 0.06)
}

export interface MatchResult {
  opponent: Rating;
  score: 0 | 0.5 | 1;  // 0 = loss, 0.5 = draw, 1 = win
}

export const DEFAULT_RATING: Rating = {
  rating: 1500,
  rd: 350,
  volatility: 0.06,
};

// Constraint on volatility change (τ). Lower = more conservative.
const TAU = 0.5;

function toGlicko2(r: number): number { return (r - 1500) / GLICKO2_SCALE; }
function toGlicko1(r: number): number { return r * GLICKO2_SCALE + 1500; }
function toGlicko2Rd(rd: number): number { return rd / GLICKO2_SCALE; }
function toGlicko1Rd(rd: number): number { return rd * GLICKO2_SCALE; }

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Update a player's rating after a set of results in one rating period.
 * For single-game updates, pass a single result in the array.
 */
export function updateRating(player: Rating, results: MatchResult[]): Rating {
  const mu = toGlicko2(player.rating);
  const phi = toGlicko2Rd(player.rd);
  const sigma = player.volatility;

  if (results.length === 0) {
    // No games played — increase uncertainty only
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { ...player, rd: Math.min(toGlicko1Rd(phiStar), 350) };
  }

  // Step 3: compute v (estimated variance)
  let v = 0;
  for (const { opponent, score: _ } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    const eVal = E(mu, muJ, phiJ);
    const gVal = g(phiJ);
    v += gVal * gVal * eVal * (1 - eVal);
  }
  v = 1 / v;

  // Step 4: compute delta (estimated improvement)
  let delta = 0;
  for (const { opponent, score } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    delta += g(phiJ) * (score - E(mu, muJ, phiJ));
  }
  delta *= v;

  // Step 5: update volatility σ' (Illinois algorithm)
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const eX = Math.exp(x);
    const phiSq = phi * phi;
    const dSq = delta * delta;
    const num1 = eX * (dSq - phiSq - v - eX);
    const den1 = 2 * Math.pow(phiSq + v + eX, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  const EPSILON = 1e-6;
  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; }
    else { fA /= 2; }
    B = C;
    fB = fC;
  }

  const sigmaNew = Math.exp(A / 2);

  // Step 6: update RD
  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);

  // Step 7: update rating
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  let muNew = mu;
  for (const { opponent, score } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    muNew += phiNew * phiNew * g(phiJ) * (score - E(mu, muJ, phiJ));
  }

  return {
    rating: Math.round(toGlicko1(muNew)),
    rd: Math.round(toGlicko1Rd(phiNew)),
    volatility: sigmaNew,
  };
}

/** Convenience: compute rating change for a single game result. */
export function rateGame(
  player: Rating,
  opponent: Rating,
  outcome: 'win' | 'draw' | 'loss'
): Rating {
  const scoreMap = { win: 1, draw: 0.5, loss: 0 } as const;
  return updateRating(player, [{ opponent, score: scoreMap[outcome] }]);
}
```

- [ ] **Step 1.3: Add to `apps/web/package.json` dependencies**

```json
"@tactictoe/glicko2": "workspace:*"
```

Also add to `apps/game-server/package.json` if the game server calls it directly. For now, only the web server needs it.

- [ ] **Step 1.4: Install and verify**

```bash
pnpm install
```

- [ ] **Step 1.5: Commit**

```bash
git add packages/glicko2/ apps/web/package.json
git commit -m "feat(glicko2): add Glicko-2 rating algorithm package"
```

---

## Task 2: Database Schema — Rating + Match Tables

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 2.1: Add `Rating` and `Match` models**

```prisma
model Rating {
  id         String   @id @default(cuid())
  userId     String
  variantId  String   // 'ultimate_ttt'
  rating     Int      @default(1500)
  rd         Int      @default(350)  // ratings deviation
  volatility Float    @default(0.06)
  wins       Int      @default(0)
  losses     Int      @default(0)
  draws      Int      @default(0)
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, variantId])
  @@index([variantId, rating(sort: Desc)])
}

model Match {
  id            String   @id @default(cuid())
  variantId     String
  rated         Boolean  @default(false)
  player1Id     String?  // null for guests
  player2Id     String?  // null for guests
  player1Guest  String?  // guestId if no account
  player2Guest  String?  // guestId if no account
  player1Name   String
  player2Name   String
  winner        String?  // 'X', 'O', or null for draw
  reason        String   // 'win', 'draw', 'forfeit'
  ratingDelta1  Int?     // rating change for player1 (null if unrated)
  ratingDelta2  Int?
  createdAt     DateTime @default(now())

  player1 User? @relation("MatchPlayer1", fields: [player1Id], references: [id])
  player2 User? @relation("MatchPlayer2", fields: [player2Id], references: [id])

  @@index([player1Id, createdAt(sort: Desc)])
  @@index([player2Id, createdAt(sort: Desc)])
  @@index([variantId, createdAt(sort: Desc)])
}
```

Also add reverse relations to the `User` model:
```prisma
model User {
  // ... existing fields ...
  ratings   Rating[]
  matches1  Match[] @relation("MatchPlayer1")
  matches2  Match[] @relation("MatchPlayer2")
}
```

- [ ] **Step 2.2: Push schema**

```bash
cd apps/web && pnpm db:push
```

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat(db): add Rating and Match tables for ranked system"
```

---

## Task 3: Ratings Update API Endpoint

**Files:**
- Create: `apps/web/src/app/api/ratings/update/route.ts`
- Create: `apps/web/src/lib/ratings.ts`

This endpoint is called by the game server (via HTTP POST) when a rated game finishes. It applies Glicko-2 and stores the match record.

- [ ] **Step 3.1: Create `apps/web/src/lib/ratings.ts`**

```typescript
import { prisma } from './prisma';
import { rateGame, DEFAULT_RATING, type Rating } from '@tactictoe/glicko2';

export async function getOrCreateRating(userId: string, variantId: string): Promise<Rating & { id: string }> {
  let row = await prisma.rating.findUnique({ where: { userId_variantId: { userId, variantId } } });
  if (!row) {
    row = await prisma.rating.create({
      data: { userId, variantId, ...DEFAULT_RATING },
    });
  }
  return row;
}

export interface GameResultPayload {
  variantId: string;
  player1: { userId?: string; guestId?: string; displayName: string; playerSymbol: 'X' | 'O' };
  player2: { userId?: string; guestId?: string; displayName: string; playerSymbol: 'X' | 'O' };
  winner: 'X' | 'O' | null; // null = draw
  reason: 'win' | 'draw' | 'forfeit';
  rated: boolean;
}

export async function processGameResult(payload: GameResultPayload) {
  const { variantId, player1, player2, winner, reason, rated } = payload;

  // Determine outcome from player1's perspective
  const outcome1 = winner === null ? 'draw' : winner === player1.playerSymbol ? 'win' : 'loss';
  const outcome2 = winner === null ? 'draw' : winner === player2.playerSymbol ? 'win' : 'loss';

  let delta1: number | null = null;
  let delta2: number | null = null;

  // Apply ratings if both players are authenticated and the game is rated
  if (rated && player1.userId && player2.userId) {
    const [r1, r2] = await Promise.all([
      getOrCreateRating(player1.userId, variantId),
      getOrCreateRating(player2.userId, variantId),
    ]);

    const newR1 = rateGame(r1, r2, outcome1);
    const newR2 = rateGame(r2, r1, outcome2);

    delta1 = newR1.rating - r1.rating;
    delta2 = newR2.rating - r2.rating;

    // Update ratings in DB
    await Promise.all([
      prisma.rating.update({
        where: { userId_variantId: { userId: player1.userId, variantId } },
        data: {
          rating: newR1.rating,
          rd: newR1.rd,
          volatility: newR1.volatility,
          wins: outcome1 === 'win' ? { increment: 1 } : undefined,
          losses: outcome1 === 'loss' ? { increment: 1 } : undefined,
          draws: outcome1 === 'draw' ? { increment: 1 } : undefined,
        },
      }),
      prisma.rating.update({
        where: { userId_variantId: { userId: player2.userId, variantId } },
        data: {
          rating: newR2.rating,
          rd: newR2.rd,
          volatility: newR2.volatility,
          wins: outcome2 === 'win' ? { increment: 1 } : undefined,
          losses: outcome2 === 'loss' ? { increment: 1 } : undefined,
          draws: outcome2 === 'draw' ? { increment: 1 } : undefined,
        },
      }),
    ]);
  }

  // Always record the match
  await prisma.match.create({
    data: {
      variantId,
      rated: rated && !!player1.userId && !!player2.userId,
      player1Id: player1.userId ?? null,
      player2Id: player2.userId ?? null,
      player1Guest: player1.guestId ?? null,
      player2Guest: player2.guestId ?? null,
      player1Name: player1.displayName,
      player2Name: player2.displayName,
      winner,
      reason,
      ratingDelta1: delta1,
      ratingDelta2: delta2,
    },
  });

  return { delta1, delta2 };
}
```

- [ ] **Step 3.2: Create `apps/web/src/app/api/ratings/update/route.ts`**

This endpoint uses a shared secret to verify the caller is the game server (not a random POST).

```typescript
import { NextResponse } from 'next/server';
import { processGameResult, type GameResultPayload } from '@/lib/ratings';

const GAME_SERVER_SECRET = process.env['GAME_SERVER_SECRET'];

export async function POST(request: Request) {
  // Verify shared secret
  const auth = request.headers.get('x-game-server-secret');
  if (!GAME_SERVER_SECRET || auth !== GAME_SERVER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload: GameResultPayload = await request.json();

  try {
    const result = await processGameResult(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('ratings update error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3.3: Add env vars**

In Railway (web service), add:
```
GAME_SERVER_SECRET=<random 32-char string>
```

In Railway (game-server service), add:
```
WEB_SERVER_URL=https://web-production-79ca.up.railway.app
GAME_SERVER_SECRET=<same value>
```

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/src/lib/ratings.ts apps/web/src/app/api/ratings/update/
git commit -m "feat(web): add ratings update API endpoint with Glicko-2 processing"
```

---

## Task 4: Game Server — Rated Rooms + Result Reporting

**Files:**
- Modify: `apps/game-server/src/types.ts`
- Modify: `apps/game-server/src/queue-manager.ts`
- Modify: `apps/game-server/src/game-session.ts`
- Modify: `apps/game-server/src/index.ts`

- [ ] **Step 4.1: Add `rated` flag and `userId` to types**

In `types.ts`:
```typescript
// Add userId to ConnectedPlayer
export interface ConnectedPlayer {
  socketId: string;
  guestId: string;
  userId?: string;        // ← add: set if authenticated
  displayName: string;
  playerIndex: 0 | 1;
}

// Add rated flag to RoomState
export interface RoomState {
  // ... existing fields ...
  rated: boolean;         // ← add
}

// Rated queue payload
export interface JoinRatedQueuePayload {
  variantId: string;
  guestId: string;
  userId: string;         // required for rated — authenticated players only
  displayName: string;
}
```

- [ ] **Step 4.2: Add rated queue to QueueManager**

In `queue-manager.ts`, update `QueueEntry` to include `userId?` and add a `joinRated` method:

```typescript
interface QueueEntry {
  socketId: string;
  guestId: string;
  userId?: string;
  displayName: string;
  joinedAt: number;
}

// Add a separate rated queue
private ratedQueues = new Map<string, QueueEntry[]>();

joinRated(variantId: string, entry: QueueEntry): void {
  // Same as join() but uses ratedQueues
  if (!this.ratedQueues.has(variantId)) this.ratedQueues.set(variantId, []);
  const queue = this.ratedQueues.get(variantId)!;
  if (queue.some(e => e.guestId === entry.guestId)) return;
  queue.push(entry);
}

tryMatchRated(variantId: string): [QueueEntry, QueueEntry] | null {
  const queue = this.ratedQueues.get(variantId);
  if (!queue || queue.length < 2) return null;
  const [p1, p2] = queue.splice(0, 2);
  return [p1, p2];
}

leaveAll(socketId: string): void {
  this.leave(socketId); // casual
  // Also remove from rated queues
  for (const [, queue] of this.ratedQueues) {
    const idx = queue.findIndex(e => e.socketId === socketId);
    if (idx !== -1) { queue.splice(idx, 1); return; }
  }
}
```

- [ ] **Step 4.3: Report game result to web server on game over**

In `game-session.ts`, add a `reportResult` function:

```typescript
const WEB_SERVER_URL = process.env['WEB_SERVER_URL'];
const GAME_SERVER_SECRET = process.env['GAME_SERVER_SECRET'];

async function reportResult(room: RoomState, winner: 'X' | 'O' | null, reason: string) {
  if (!room.rated || !WEB_SERVER_URL) return;
  const [p1, p2] = room.players;
  if (!p1 || !p2) return;

  try {
    await fetch(`${WEB_SERVER_URL}/api/ratings/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-game-server-secret': GAME_SERVER_SECRET ?? '',
      },
      body: JSON.stringify({
        variantId: room.variantId,
        player1: { userId: p1.userId, guestId: p1.guestId, displayName: p1.displayName, playerSymbol: 'X' },
        player2: { userId: p2.userId, guestId: p2.guestId, displayName: p2.displayName, playerSymbol: 'O' },
        winner,
        reason,
        rated: room.rated,
      }),
    });
  } catch (err) {
    console.error('Failed to report game result:', err);
    // Non-fatal — game continues even if rating update fails
  }
}
```

Call `reportResult(room, winner, reason)` inside `handleMove` when `game:over` is emitted, and inside `handleDisconnect` when forfeit fires.

- [ ] **Step 4.4: Add `queue:join:rated` handler to `index.ts`**

```typescript
socket.on('queue:join:rated', (payload: JoinRatedQueuePayload) => {
  const { variantId, guestId, userId, displayName } = payload;

  if (!['ultimate_ttt'].includes(variantId)) {
    socket.emit('error', { message: 'This variant is not available for rated play' });
    return;
  }

  qm.joinRated(variantId, { socketId: socket.id, guestId, userId, displayName, joinedAt: Date.now() });

  const pair = qm.tryMatchRated(variantId);
  if (pair) {
    const [p1, p2] = pair;
    const code = rm.generateCode();
    const host = { socketId: p1.socketId, guestId: p1.guestId, userId: p1.userId, displayName: p1.displayName, playerIndex: 0 as const };
    rm.createRoom(code, host, variantId, /* rated */ true);
    const room = rm.getRoom(code)!;
    rm.addPlayer(room, { socketId: p2.socketId, guestId: p2.guestId, userId: p2.userId, displayName: p2.displayName, playerIndex: 1 as const });

    const p1Socket = io.sockets.sockets.get(p1.socketId);
    const p2Socket = io.sockets.sockets.get(p2.socketId);
    p1Socket?.join(code);
    p2Socket?.join(code);
    p1Socket?.emit('queue:matched', { roomCode: code, playerIndex: 0, rated: true });
    p2Socket?.emit('queue:matched', { roomCode: code, playerIndex: 1, rated: true });
    startGame(io, room);
  } else {
    socket.emit('queue:status', { position: qm.getPosition(socket.id), variantId, rated: true });
  }
});
```

Update `createRoom` in `RoomManager` to accept a `rated` parameter.

- [ ] **Step 4.5: Commit**

```bash
git add apps/game-server/src/
git commit -m "feat(game-server): add rated queue, rated room flag, result reporting to web server"
```

---

## Task 5: Ranked Lobby Tab

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 5.1: Add "Ranked" tab to lobby tabs**

Extend the existing `TabId` type:
```typescript
type TabId = 'quick' | 'private' | 'ranked';
```

Add a Ranked tab that:
- Only shows "Find Ranked Match" button if the user is authenticated
- Shows "Sign in to play ranked" if guest
- Emits `queue:join:rated` via the socket
- Only available for Ultimate TTT (the only ranked variant)

```tsx
{tab === 'ranked' && (
  <div className={styles.section}>
    {!session ? (
      <>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          Rated games require an account. Your rating is permanent and tracked across sessions.
        </p>
        <Button as="a" href="/login" variant="secondary" full>Sign in to play ranked</Button>
      </>
    ) : queue.queueState === 'waiting' ? (
      <>
        <div className={styles.queueStatus}>
          <div className={styles.queueDot} />
          Finding rated opponent…
        </div>
        <Button variant="secondary" onClick={handleCancelQueue} full>Cancel</Button>
      </>
    ) : (
      <>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          Ultimate TTT · Rated · All time controls standard
        </p>
        <Button onClick={handleRankedMatch} full>Find Ranked Match</Button>
      </>
    )}
  </div>
)}
```

Add `handleRankedMatch`:
```typescript
const handleRankedMatch = () => {
  if (!guestSession || !session?.user?.id) return;
  const socket = getSocket();
  socket.emit('queue:join:rated', {
    variantId: 'ultimate_ttt',
    guestId: guestSession.guestId,
    userId: session.user.id,
    displayName: session.user.name ?? guestSession.displayName,
  });
};
```

- [ ] **Step 5.2: Show rating on lobby if authenticated**

Add a small component below the hero that shows the user's current Ultimate TTT rating. Fetch from a new API route.

Create `apps/web/src/app/api/ratings/me/route.ts`:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ rating: null });
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variant') ?? 'ultimate_ttt';
  const rating = await prisma.rating.findUnique({
    where: { userId_variantId: { userId: session.user.id, variantId } },
    select: { rating: true, rd: true, wins: true, losses: true, draws: true },
  });
  return NextResponse.json({ rating });
}
```

- [ ] **Step 5.3: Show post-game rating delta in room page**

After a rated game ends, the room page should display the rating change. The `queue:matched` payload includes `rated: true` — store this in room state. After `game:over`, fetch the updated rating and display `+12` or `-8` next to the result.

Add to `RoomState`:
```typescript
rated: boolean;
ratingDelta: number | null;
```

After game over, if `rated`, call `GET /api/ratings/me?variant=ultimate_ttt` and compare to cached pre-game rating.

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/api/ratings/
git commit -m "feat(web): add ranked tab to lobby, show post-game rating delta"
```

---

## Task 6: RatingBadge Component

**Files:**
- Create: `apps/web/src/components/RatingBadge.tsx`

- [ ] **Step 6.1: Create `apps/web/src/components/RatingBadge.tsx`**

Displays a player's rating with uncertainty indicator.

```tsx
import Badge from './ui/Badge';

interface RatingBadgeProps {
  rating: number;
  rd: number;   // ratings deviation — lower = more certain
  wins?: number;
  losses?: number;
}

export default function RatingBadge({ rating, rd, wins, losses }: RatingBadgeProps) {
  // RD > 100 = uncertain (provisional), < 75 = established
  const isProvisional = rd > 100;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
        {rating}
      </span>
      {isProvisional && (
        <Badge variant="default">?</Badge>
      )}
      {wins !== undefined && losses !== undefined && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {wins}W {losses}L
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/web/src/components/RatingBadge.tsx
git commit -m "feat(web): add RatingBadge component for rating display"
```

---

## Task 7: Deploy + Verify

- [ ] **Step 7.1: Set environment variables in Railway**

Web service: `GAME_SERVER_SECRET=<value>`
Game server service: `WEB_SERVER_URL=<web public url>`, `GAME_SERVER_SECRET=<same value>`

- [ ] **Step 7.2: Push and deploy**

```bash
git push origin main
```

- [ ] **Step 7.3: Manual test checklist**

- [ ] Guest creates casual room → game plays → no rating change
- [ ] Logged-in user goes to Ranked tab → finds ranked match → both players redirect to room
- [ ] Ranked game finishes → both players' ratings update → rating delta displayed
- [ ] Guest tries Ranked tab → sees "Sign in to play ranked" message
- [ ] `/api/ratings/me` returns correct rating for authenticated user

---

## Checklist

- [ ] Task 1: Glicko-2 package
- [ ] Task 2: Rating + Match DB tables
- [ ] Task 3: Ratings update API endpoint
- [ ] Task 4: Game server rated queues + result reporting
- [ ] Task 5: Ranked tab in lobby + rating display
- [ ] Task 6: RatingBadge component
- [ ] Task 7: Deploy + verify
