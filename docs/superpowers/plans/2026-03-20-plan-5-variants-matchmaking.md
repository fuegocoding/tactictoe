# Plan 5: Variants + Public Matchmaking Queue

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Standard TTT to the online game server so it can be played in rooms. Add a variant selector to the lobby. Build a public matchmaking queue so players can click "Play Online" and be matched with a random opponent — no room code required.

**Prerequisites:** Plan 4 must be complete (design system exists, lobby is rebuilt).

**Architecture:**
- Game server gains a `QueueManager` class. Players join a per-variant queue; when 2 are waiting, a room is created automatically and both are redirected.
- Variant-specific room creation: `room:create` already accepts `variantId`. The game server needs to register the `standard_3x3` engine in `game-session.ts`.
- The lobby gets a second card: "Play Online (Quick Match)" that shows variant tabs + a queue button. The existing "Create Room" flow remains unchanged for private play.
- Queue uses socket events (not HTTP) to keep the matchmaking latency low.

---

## File Map

```
apps/game-server/src/
├── queue-manager.ts          ← NEW: per-variant queue, pair and create room
├── game-session.ts           ← MODIFY: register standard_3x3 engine
├── index.ts                  ← MODIFY: add queue:join / queue:leave socket handlers
└── types.ts                  ← MODIFY: add queue payload types

apps/web/src/
├── app/
│   ├── page.tsx              ← MODIFY: add variant tabs + quick match UI
│   └── page.module.css       ← MODIFY: add queue-related styles
└── hooks/
    └── useQueue.ts           ← NEW: queue join/leave/matched hook
```

---

## Task 1: Register Standard TTT in Game Server

**Files:**
- Modify: `apps/game-server/src/game-session.ts`

- [ ] **Step 1.1: Add `standard_3x3` engine to the engines map**

In `game-session.ts`, the `engines` map currently only has `ultimate_ttt`. Add `StandardTTT`:

```typescript
import { StandardTTT, UltimateTTT } from '@tactictoe/game-engine';

const engines: Record<string, GameRules> = {
  ultimate_ttt: new UltimateTTT(),
  standard_3x3: new StandardTTT(),
};
```

Verify: `startGame` and `handleMove` already use `engines[room.variantId]` generically — no other changes needed for game logic.

- [ ] **Step 1.2: Verify `StandardTTT.applyMove` uses `move.data.cellIndex`**

The `StandardBoard` component passes `cellIndex` only (no `boardIndex`). The Standard TTT engine's move type should use `{ cellIndex: number }`. Verify `packages/game-engine/src/rules/standard-ttt.ts` expects this. If the interface differs, align the board component's `onMove` signature with what the engine expects.

- [ ] **Step 1.3: Commit**

```bash
git add apps/game-server/src/game-session.ts
git commit -m "feat(game-server): register standard_3x3 engine for online play"
```

---

## Task 2: Queue Manager

**Files:**
- Create: `apps/game-server/src/queue-manager.ts`
- Modify: `apps/game-server/src/types.ts`

- [ ] **Step 2.1: Add queue payload types to `apps/game-server/src/types.ts`**

```typescript
export interface JoinQueuePayload {
  variantId: string;
  guestId: string;
  displayName: string;
}

export interface QueueMatchedPayload {
  roomCode: string;
  playerIndex: number;
}

export interface QueueStatusPayload {
  position: number;   // 1-based position in queue
  variantId: string;
}
```

- [ ] **Step 2.2: Create `apps/game-server/src/queue-manager.ts`**

```typescript
interface QueueEntry {
  socketId: string;
  guestId: string;
  displayName: string;
  joinedAt: number;
}

export class QueueManager {
  // variantId → ordered list of waiting players
  private queues = new Map<string, QueueEntry[]>();

  join(variantId: string, entry: QueueEntry): void {
    if (!this.queues.has(variantId)) this.queues.set(variantId, []);
    const queue = this.queues.get(variantId)!;

    // Prevent duplicate queuing (same guestId)
    if (queue.some(e => e.guestId === entry.guestId)) return;

    queue.push(entry);
  }

  leave(socketId: string): void {
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) { queue.splice(idx, 1); return; }
    }
  }

  // Try to pair two players for a variant.
  // Returns the pair if found, null otherwise.
  tryMatch(variantId: string): [QueueEntry, QueueEntry] | null {
    const queue = this.queues.get(variantId);
    if (!queue || queue.length < 2) return null;
    const [p1, p2] = queue.splice(0, 2);
    return [p1, p2];
  }

  // Find which queue a socket is in (for cleanup on disconnect)
  findSocket(socketId: string): string | null {
    for (const [variantId, queue] of this.queues) {
      if (queue.some(e => e.socketId === socketId)) return variantId;
    }
    return null;
  }

  getPosition(socketId: string): number {
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) return idx + 1;
    }
    return 0;
  }
}
```

- [ ] **Step 2.3: Commit**

```bash
git add apps/game-server/src/queue-manager.ts apps/game-server/src/types.ts
git commit -m "feat(game-server): add QueueManager for per-variant matchmaking"
```

---

## Task 3: Queue Socket Handlers

**Files:**
- Modify: `apps/game-server/src/index.ts`

- [ ] **Step 3.1: Instantiate QueueManager and add `queue:join` / `queue:leave` handlers**

In `index.ts`, after `const rm = new RoomManager()`:
```typescript
import { QueueManager } from './queue-manager.js';
const qm = new QueueManager();
```

Inside `io.on('connection', (socket) => { ... })`, add:

```typescript
socket.on('queue:join', (payload: JoinQueuePayload) => {
  const { variantId, guestId, displayName } = payload;

  // Validate variant
  if (!['ultimate_ttt', 'standard_3x3'].includes(variantId)) {
    socket.emit('error', { message: 'Unknown variant' });
    return;
  }

  qm.join(variantId, { socketId: socket.id, guestId, displayName, joinedAt: Date.now() });

  // Try to match immediately
  const pair = qm.tryMatch(variantId);
  if (pair) {
    const [p1, p2] = pair;
    // Create a room
    const code = rm.generateCode();
    const host = { socketId: p1.socketId, guestId: p1.guestId, displayName: p1.displayName, playerIndex: 0 as const };
    rm.createRoom(code, host, variantId);
    const room = rm.getRoom(code)!;
    const guest = { socketId: p2.socketId, guestId: p2.guestId, displayName: p2.displayName, playerIndex: 1 as const };
    rm.addPlayer(room, guest);

    // Notify both players
    const p1Socket = io.sockets.sockets.get(p1.socketId);
    const p2Socket = io.sockets.sockets.get(p2.socketId);

    p1Socket?.join(code);
    p2Socket?.join(code);

    const matchPayloadP1: QueueMatchedPayload = { roomCode: code, playerIndex: 0 };
    const matchPayloadP2: QueueMatchedPayload = { roomCode: code, playerIndex: 1 };

    p1Socket?.emit('queue:matched', matchPayloadP1);
    p2Socket?.emit('queue:matched', matchPayloadP2);

    // Start the game
    startGame(io, room);
  } else {
    // Tell the player their position
    const position = qm.getPosition(socket.id);
    socket.emit('queue:status', { position, variantId } satisfies QueueStatusPayload);
  }
});

socket.on('queue:leave', () => {
  qm.leave(socket.id);
  socket.emit('queue:left', {});
});
```

- [ ] **Step 3.2: Clean up queue on disconnect**

In the existing `socket.on('disconnect', ...)` handler, add:
```typescript
qm.leave(socket.id);
```

- [ ] **Step 3.3: Rebuild game server**

```bash
cd apps/game-server && pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 3.4: Commit**

```bash
git add apps/game-server/src/index.ts
git commit -m "feat(game-server): add queue:join, queue:leave, queue:matched socket events"
```

---

## Task 4: useQueue Hook

**Files:**
- Create: `apps/web/src/hooks/useQueue.ts`

- [ ] **Step 4.1: Create `apps/web/src/hooks/useQueue.ts`**

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';

type QueueState = 'idle' | 'waiting' | 'matched';

interface UseQueueResult {
  queueState: QueueState;
  position: number;
  join: (variantId: string, guestId: string, displayName: string) => void;
  leave: () => void;
  matchedRoomCode: string | null;
  matchedPlayerIndex: number | null;
}

export function useQueue(): UseQueueResult {
  const [queueState, setQueueState] = useState<QueueState>('idle');
  const [position, setPosition] = useState(0);
  const [matchedRoomCode, setMatchedRoomCode] = useState<string | null>(null);
  const [matchedPlayerIndex, setMatchedPlayerIndex] = useState<number | null>(null);
  const listenersAttached = useRef(false);

  useEffect(() => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    const socket = getSocket();

    socket.on('queue:status', ({ position }: { position: number }) => {
      setPosition(position);
      setQueueState('waiting');
    });

    socket.on('queue:matched', ({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) => {
      setQueueState('matched');
      setMatchedRoomCode(roomCode);
      setMatchedPlayerIndex(playerIndex);
    });

    socket.on('queue:left', () => {
      setQueueState('idle');
      setPosition(0);
    });

    return () => {
      socket.off('queue:status');
      socket.off('queue:matched');
      socket.off('queue:left');
      listenersAttached.current = false;
    };
  }, []);

  const join = useCallback((variantId: string, guestId: string, displayName: string) => {
    const socket = getSocket();
    setQueueState('waiting');
    socket.emit('queue:join', { variantId, guestId, displayName });
  }, []);

  const leave = useCallback(() => {
    const socket = getSocket();
    socket.emit('queue:leave');
  }, []);

  return { queueState, position, join, leave, matchedRoomCode, matchedPlayerIndex };
}
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/web/src/hooks/useQueue.ts
git commit -m "feat(web): add useQueue hook for public matchmaking"
```

---

## Task 5: Update Lobby with Variant Tabs + Quick Match

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.module.css`

- [ ] **Step 5.1: Add queue styles to `apps/web/src/app/page.module.css`**

Add these classes to the existing file:

```css
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-5);
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
.tab.activeTab { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

.variantTag {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin-top: var(--space-1);
}

.queueStatus {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  color: var(--accent);
  font-weight: 500;
}

.queueDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

- [ ] **Step 5.2: Update `apps/web/src/app/page.tsx`**

Add a "Quick Match" tab alongside "Private Room". When matched, store the `playerIndex` in sessionStorage (same pattern as room:create) and redirect to the room.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useQueue } from '@/hooks/useQueue';
import { getSocket } from '@/lib/socket-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import styles from './page.module.css';

type TabId = 'quick' | 'private';
type VariantId = 'ultimate_ttt' | 'standard_3x3';

const VARIANTS: { id: VariantId; label: string; description: string }[] = [
  { id: 'ultimate_ttt', label: 'Ultimate TTT', description: '9 boards in one. The flagship.' },
  { id: 'standard_3x3', label: 'Standard 3×3', description: 'Classic. Quick casual games.' },
];

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const queue = useQueue();

  const [tab, setTab] = useState<TabId>('quick');
  const [variant, setVariant] = useState<VariantId>('ultimate_ttt');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When matched, store playerIndex and redirect
  useEffect(() => {
    if (queue.queueState === 'matched' && queue.matchedRoomCode !== null && queue.matchedPlayerIndex !== null) {
      sessionStorage.setItem(`room:${queue.matchedRoomCode}:playerIndex`, String(queue.matchedPlayerIndex));
      router.push(`/room/${queue.matchedRoomCode}`);
    }
  }, [queue.queueState, queue.matchedRoomCode, queue.matchedPlayerIndex, router]);

  const handleQuickMatch = () => {
    if (!guestSession) return;
    queue.join(variant, guestSession.guestId, session?.user?.name ?? guestSession.displayName);
  };

  const handleCancelQueue = () => {
    queue.leave();
  };

  const handleCreateRoom = () => {
    if (!guestSession) return;
    setCreating(true);
    setError(null);
    const socket = getSocket();
    socket.emit('room:create', {
      guestId: guestSession.guestId,
      displayName: session?.user?.name ?? guestSession.displayName,
      variantId: variant,
    });
    socket.once('room:created', ({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) => {
      sessionStorage.setItem(`room:${roomCode}:playerIndex`, String(playerIndex));
      router.push(`/room/${roomCode}`);
    });
    socket.once('error', ({ message }: { message: string }) => {
      setError(message);
      setCreating(false);
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    router.push(`/room/${code}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Tactic<span>Toe</span></h1>
        <p className={styles.subtitle}>Competitive Tic-Tac-Toe and its deeper variants.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <Card style={{ width: '100%' }}>
        {/* Variant selector */}
        <div className={styles.variantRow}>
          <p className={styles.variantLabel}>Game mode</p>
          <div className={styles.variantButtons}>
            {VARIANTS.map(v => (
              <button
                key={v.id}
                className={`${styles.variantBtn} ${variant === v.id ? styles.selected : ''}`}
                onClick={() => setVariant(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Play mode tabs */}
        <div className={styles.tabs} style={{ marginTop: 'var(--space-5)' }}>
          <button className={`${styles.tab} ${tab === 'quick' ? styles.activeTab : ''}`} onClick={() => setTab('quick')}>
            Quick Match
          </button>
          <button className={`${styles.tab} ${tab === 'private' ? styles.activeTab : ''}`} onClick={() => setTab('private')}>
            Private Room
          </button>
        </div>

        {tab === 'quick' && (
          <div className={styles.section}>
            {queue.queueState === 'waiting' ? (
              <>
                <div className={styles.queueStatus}>
                  <div className={styles.queueDot} />
                  Finding opponent…
                </div>
                <Button variant="secondary" onClick={handleCancelQueue} full>Cancel</Button>
              </>
            ) : (
              <Button onClick={handleQuickMatch} full>Find Opponent</Button>
            )}
          </div>
        )}

        {tab === 'private' && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button onClick={handleCreateRoom} loading={creating} full>Create Room</Button>

            <div className={styles.divider}>or join</div>

            <form onSubmit={handleJoinRoom}>
              <div className={styles.joinRow}>
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
                />
                <Button type="submit" variant="secondary">Join</Button>
              </div>
            </form>
          </div>
        )}
      </Card>

      <p className={styles.localLink}>
        Playing with someone next to you?{' '}
        <Link href="/local">Play locally on this screen →</Link>
      </p>

      {!session && (
        <p className={styles.guestCta}>
          Playing as guest.{' '}
          <Link href="/register">Create an account</Link>{' '}
          to track your rating and match history.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/page.module.css
git commit -m "feat(web): add variant selector, quick match queue, private room tabs to lobby"
```

---

## Task 6: Update Room Page for Standard TTT

The room page currently only renders `UltimateBoard`. It needs to render the correct board based on `gameState.variantId`.

**Files:**
- Modify: `apps/web/src/app/room/[code]/page.tsx`

- [ ] **Step 6.1: Import StandardBoard and add variant-aware board rendering**

In the room page JSX, replace the single `<UltimateBoard />` render with:

```tsx
{gameState.variantId === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(gameState as UltimateTTTState).boards}
    boardResults={(gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={gameState.currentPlayer}
    disabled={!isMyTurn}
    onMove={handleMove}
  />
) : (
  <StandardBoard
    board={(gameState as StandardTTTState).board}
    currentPlayer={gameState.currentPlayer}
    disabled={!isMyTurn}
    onMove={(_, cellIndex) => handleMove(0, cellIndex)}
  />
)}
```

Also update the `handleMove` to pass `boardIndex: 0` for standard games:
```typescript
const handleMove = (boardIndex: number, cellIndex: number) => {
  socket.emit('game:move', { roomCode: code, boardIndex, cellIndex });
};
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/web/src/app/room/
git commit -m "feat(web): render Standard or Ultimate board in room based on variantId"
```

---

## Task 7: Integration Test + Deploy

- [ ] **Step 7.1: Build everything**

```bash
pnpm build
```

- [ ] **Step 7.2: Manual test checklist**

- [ ] Quick match: open two browser tabs, click "Find Opponent" on both → they match and game starts
- [ ] Standard TTT room: create a Standard TTT private room, join from another tab → game plays correctly
- [ ] Ultimate TTT room: unchanged — still works
- [ ] Local play: unchanged — still works (Standard + Ultimate)

- [ ] **Step 7.3: Push**

```bash
git push origin main
```

---

## Checklist

- [ ] Task 1: Standard TTT registered on game server
- [ ] Task 2: QueueManager implemented
- [ ] Task 3: Queue socket handlers added
- [ ] Task 4: useQueue hook
- [ ] Task 5: Lobby updated with variant tabs + quick match
- [ ] Task 6: Room page renders correct board by variant
- [ ] Task 7: Integration test + deploy
