# Plan 3: Game UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete playable MVP frontend — auth forms, lobby with room create/join, real-time game board for Ultimate TTT, and Socket.io integration — making the platform playable end-to-end.

**Architecture:** All UI lives in `apps/web/src/`. Board components are **pure and presentational** — they receive game state as props and call callbacks on moves. The room page manages all socket state via `useReducer`. Socket.io client is a singleton (survives Next.js client-side navigation). The lobby stores `playerIndex` in sessionStorage after room creation so the room page knows the creator's symbol without re-joining.

**Server event reference** (authoritative — from `apps/game-server/src/`):
- Client → Server: `room:create { guestId, displayName, variantId }`, `room:join { roomCode, guestId, displayName }`, `game:move { roomCode, boardIndex, cellIndex }`
- Server → Client: `room:created { roomCode, playerIndex }`, `room:joined { roomCode, playerIndex, players }`, `game:started { gameState, players }`, `game:state { gameState, lastMove }`, `game:over { gameState, winner, reason, winnerDisplayName }`, `player:disconnected`, `player:reconnected`, `game:reconnect`

**Current server limitation:** Only `ultimate_ttt` is supported on the game server. The lobby exposes only Ultimate TTT for now.

**Tech Stack:** Next.js 14 App Router, React 18, socket.io-client ^4, TypeScript 5, Vitest + jsdom for component tests

---

## File Map

```
apps/web/src/
├── components/
│   ├── Providers.tsx              # SessionProvider + guest session init on mount
│   ├── board/
│   │   ├── StandardBoard.tsx      # Pure 3×3 board renderer (casual, server support coming later)
│   │   ├── StandardBoard.test.tsx
│   │   ├── UltimateBoard.tsx      # Pure 9-mini-board renderer with constraint highlight
│   │   └── UltimateBoard.test.tsx
│   └── ui/
│       └── CopyButton.tsx         # Copy-to-clipboard with "Copied!" feedback (1s)
├── hooks/
│   ├── useGuestSession.ts         # GET /api/guest-session on mount, POST if none
│   └── useSocket.ts               # socket.io-client connection + status tracking
├── lib/
│   └── socket-client.ts           # createSocket(url) factory — singleton Socket instance
└── app/
    ├── layout.tsx                 # ← update: wrap children with <Providers>
    ├── page.tsx                   # Lobby — room create + join by code
    ├── login/
    │   └── page.tsx               # Login form (email+password + Google sign-in)
    ├── register/
    │   └── page.tsx               # Register form (email, username, password)
    └── room/
        └── [code]/
            └── page.tsx           # Game room — socket events, board, status, game-over
```

**Key boundary:** `components/board/` components never import socket code. The room page passes `onMove` callbacks down. This keeps board components fast to test.

---

## Task 1: Client Dependencies + jsdom Test Environment

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1.1: Add socket.io-client and testing deps to `apps/web/package.json`**

In `package.json`, add to `"dependencies"`:
```json
"socket.io-client": "^4.7.0",
"@tactictoe/game-engine": "workspace:*"
```

Add to `"devDependencies"`:
```json
"@testing-library/react": "^15.0.0",
"@testing-library/jest-dom": "^6.4.0",
"@vitejs/plugin-react": "^4.3.0",
"jsdom": "^24.0.0"
```

Note: `@tactictoe/game-engine` is added here so board components can import `Board`, `BoardResult`, etc. from the shared package.

- [ ] **Step 1.2: Update `apps/web/vitest.config.ts`**

Replace the entire file:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [
      // Component tests (*.test.tsx) run in jsdom
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
  },
});
```

- [ ] **Step 1.3: Create `apps/web/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 1.4: Install all new deps**

Run from repo root: `pnpm install`
Expected: new packages installed, no errors

- [ ] **Step 1.5: Verify existing tests still pass**

Run from `apps/web`: `pnpm test`
Expected: 4 test files, 37 tests pass (same as before — `.tsx` tests don't exist yet)

- [ ] **Step 1.6: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/test-setup.ts
git commit -m "feat(web): add socket.io-client, game-engine dep, testing-library and jsdom"
```

---

## Task 2: Providers + useGuestSession Hook

**Files:**
- Create: `apps/web/src/components/Providers.tsx`
- Create: `apps/web/src/hooks/useGuestSession.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 2.1: Create `apps/web/src/components/Providers.tsx`**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

function GuestSessionInitializer() {
  useEffect(() => {
    // On mount, ensure a guest session exists (creates one if none/expired).
    // All users (including authenticated ones) maintain a guestId for socket identity.
    fetch('/api/guest-session', { method: 'POST' }).catch(() => {
      // Non-fatal — guest session is best-effort
    });
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GuestSessionInitializer />
      {children}
    </SessionProvider>
  );
}
```

- [ ] **Step 2.2: Create `apps/web/src/hooks/useGuestSession.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';

export interface GuestSession {
  guestId: string;
  displayName: string;
}

export function useGuestSession(): GuestSession | null {
  const [guest, setGuest] = useState<GuestSession | null>(null);

  useEffect(() => {
    // Use POST (not GET) to create-or-renew in one shot.
    // This eliminates the race between GuestSessionInitializer and this hook:
    // the POST returns the session whether it was just created or already existed.
    fetch('/api/guest-session', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { guest: GuestSession | null }) => {
        setGuest(data.guest);
      })
      .catch(() => {
        // Non-fatal
      });
  }, []);

  return guest;
}
```

- [ ] **Step 2.3: Update `apps/web/src/app/layout.tsx`**

```tsx
import Providers from '@/components/Providers';

export const metadata = {
  title: 'TacticToe',
  description: 'Competitive Tic-Tac-Toe and its deeper variants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2.4: Commit**

```bash
git add apps/web/src/components/Providers.tsx apps/web/src/hooks/useGuestSession.ts apps/web/src/app/layout.tsx
git commit -m "feat(web): add SessionProvider wrapper and guest session initializer"
```

---

## Task 3: Standard TTT Board Component (TDD)

**Files:**
- Create: `apps/web/src/components/board/StandardBoard.tsx`
- Create: `apps/web/src/components/board/StandardBoard.test.tsx`

Pure presentational component: receives `board` (9 cells), `currentPlayer`, `disabled`, and `onMove(cellIndex)`.

- [ ] **Step 3.1: Write failing tests**

Create `apps/web/src/components/board/StandardBoard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandardBoard } from './StandardBoard';
import type { Board } from '@tactictoe/game-engine';

const emptyBoard: Board = [null, null, null, null, null, null, null, null, null];

describe('StandardBoard', () => {
  it('renders 9 cells', () => {
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={false} onMove={vi.fn()} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('shows X and O in occupied cells', () => {
    const board: Board = ['X', 'O', null, null, null, null, null, null, null];
    render(
      <StandardBoard board={board} currentPlayer="O" disabled={false} onMove={vi.fn()} />
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
  });

  it('calls onMove with the cell index when an empty cell is clicked', () => {
    const onMove = vi.fn();
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={false} onMove={onMove} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]!);
    expect(onMove).toHaveBeenCalledWith(4);
  });

  it('does not call onMove when clicking an occupied cell', () => {
    const onMove = vi.fn();
    const board: Board = ['X', null, null, null, null, null, null, null, null];
    render(
      <StandardBoard board={board} currentPlayer="O" disabled={false} onMove={onMove} />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not call onMove when disabled prop is true', () => {
    const onMove = vi.fn();
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={true} onMove={onMove} />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={true} onMove={vi.fn()} />
    );
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
```

- [ ] **Step 3.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./StandardBoard` not found

- [ ] **Step 3.3: Create `apps/web/src/components/board/StandardBoard.tsx`**

```tsx
'use client';

import type { Board, Cell } from '@tactictoe/game-engine';

interface StandardBoardProps {
  board: Board;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (cellIndex: number) => void;
}

export function StandardBoard({ board, disabled, onMove }: StandardBoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '4px',
        width: '100%',
        maxWidth: '240px',
      }}
    >
      {board.map((cell: Cell, index: number) => (
        <button
          key={index}
          disabled={disabled || cell !== null}
          onClick={() => {
            if (!disabled && cell === null) onMove(index);
          }}
          style={{
            aspectRatio: '1',
            fontSize: 'clamp(20px, 5vw, 32px)',
            fontWeight: 'bold',
            cursor: disabled || cell !== null ? 'default' : 'pointer',
          }}
        >
          {cell ?? ''}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: all tests pass (4 prior + 1 new file with 6 tests)

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/components/board/StandardBoard.tsx apps/web/src/components/board/StandardBoard.test.tsx
git commit -m "feat(web): add StandardBoard component with responsive sizing and TDD"
```

---

## Task 4: Ultimate TTT Board Component (TDD)

**Files:**
- Create: `apps/web/src/components/board/UltimateBoard.tsx`
- Create: `apps/web/src/components/board/UltimateBoard.test.tsx`

Ultimate TTT has 9 mini-boards in a 3×3 meta-grid. Constraint highlighting is the key UX: the constrained mini-board gets a green border; others are non-interactive. Won/drawn mini-boards show their result.

Props:
- `boards`: 9 mini-boards, each `Board`
- `boardResults`: 9 `BoardResult` values (`null | 'X' | 'O' | 'draw'`)
- `nextBoardConstraint`: `number | null` — which mini-board current player MUST use (null = free)
- `currentPlayer`: `'X' | 'O'`
- `disabled`: entire board non-interactive (not your turn, or game over)
- `onMove(boardIndex, cellIndex)`: called when a legal cell is clicked

- [ ] **Step 4.1: Write failing tests**

Create `apps/web/src/components/board/UltimateBoard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UltimateBoard } from './UltimateBoard';
import type { Board, BoardResult } from '@tactictoe/game-engine';

const emptyBoard: Board = [null, null, null, null, null, null, null, null, null];
const emptyBoards = Array(9).fill(emptyBoard) as [Board, Board, Board, Board, Board, Board, Board, Board, Board];
const emptyResults = Array(9).fill(null) as [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];

describe('UltimateBoard', () => {
  it('renders 81 cells (9 mini-boards × 9 cells)', () => {
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={false}
        onMove={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(81);
  });

  it('calls onMove with correct boardIndex and cellIndex', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={false}
        onMove={onMove}
      />
    );
    // Mini-board 2 starts at button index 18 (9 buttons per mini-board)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[18]!);
    expect(onMove).toHaveBeenCalledWith(2, 0);
  });

  it('does not call onMove when clicking a non-constrained board', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={4} // must play in mini-board 4
        currentPlayer="X"
        disabled={false}
        onMove={onMove}
      />
    );
    // Click mini-board 0 (buttons 0–8) — not the constrained board
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('shows the result symbol in a won mini-board', () => {
    const results = [...emptyResults] as typeof emptyResults;
    results[0] = 'X';
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={results}
        nextBoardConstraint={null}
        currentPlayer="O"
        disabled={false}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByTestId('mini-board-result-0')).toHaveTextContent('X');
  });

  it('does not call onMove when disabled', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={true}
        onMove={onMove}
      />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run tests — expect failure**

Run from `apps/web`: `pnpm test`
Expected: FAIL — `./UltimateBoard` not found

- [ ] **Step 4.3: Create `apps/web/src/components/board/UltimateBoard.tsx`**

```tsx
'use client';

import type { Board, BoardResult } from '@tactictoe/game-engine';

interface UltimateBoardProps {
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  nextBoardConstraint: number | null;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
}

function isBoardPlayable(
  boardIndex: number,
  boardResult: BoardResult,
  nextBoardConstraint: number | null
): boolean {
  if (boardResult !== null) return false;
  if (nextBoardConstraint === null) return true;
  return boardIndex === nextBoardConstraint;
}

export function UltimateBoard({
  boards,
  boardResults,
  nextBoardConstraint,
  disabled,
  onMove,
}: UltimateBoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '8px',
        width: '100%',
        maxWidth: '600px',
      }}
    >
      {boards.map((board, boardIndex) => {
        const result = boardResults[boardIndex] ?? null;
        const playable = !disabled && isBoardPlayable(boardIndex, result, nextBoardConstraint);

        return (
          <div
            key={boardIndex}
            style={{
              padding: '4px',
              border: playable ? '2px solid #4ade80' : '2px solid #374151',
              borderRadius: '4px',
              position: 'relative',
            }}
          >
            {result !== null && (
              <div
                data-testid={`mini-board-result-${boardIndex}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(24px, 4vw, 48px)',
                  fontWeight: 'bold',
                  background: 'rgba(0,0,0,0.6)',
                  zIndex: 1,
                  borderRadius: '2px',
                }}
              >
                {result === 'draw' ? '=' : result}
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '2px',
              }}
            >
              {board.map((cell, cellIndex) => (
                <button
                  key={cellIndex}
                  disabled={!playable || cell !== null}
                  onClick={() => {
                    if (playable && cell === null) onMove(boardIndex, cellIndex);
                  }}
                  style={{
                    aspectRatio: '1',
                    fontSize: 'clamp(12px, 2vw, 20px)',
                    fontWeight: 'bold',
                    cursor: !playable || cell !== null ? 'default' : 'pointer',
                  }}
                >
                  {cell ?? ''}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4.4: Run tests — expect pass**

Run from `apps/web`: `pnpm test`
Expected: all tests pass

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/components/board/UltimateBoard.tsx apps/web/src/components/board/UltimateBoard.test.tsx
git commit -m "feat(web): add UltimateBoard with constraint highlighting and TDD"
```

---

## Task 5: Socket Client + useSocket Hook

**Files:**
- Create: `apps/web/src/lib/socket-client.ts`
- Create: `apps/web/src/hooks/useSocket.ts`

The socket is a **singleton** that survives Next.js client-side navigation. This means when the user navigates from the Lobby to the Room page, the socket stays connected and stays in any socket.io rooms it joined.

- [ ] **Step 5.1: Create `apps/web/src/lib/socket-client.ts`**

```typescript
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env['NEXT_PUBLIC_GAME_SERVER_URL'] ?? 'http://localhost:4000';
    socket = io(url, {
      autoConnect: false, // Explicit connect in useSocket
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}
```

- [ ] **Step 5.2: Create `apps/web/src/hooks/useSocket.ts`**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket-client';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

export interface UseSocketResult {
  socket: Socket;
  status: SocketStatus;
}

export function useSocket(): UseSocketResult {
  const socket = useRef<Socket>(getSocket());

  // Initialize status from the actual socket state to handle the already-connected case.
  // The socket is a singleton — if the user navigated from another page, it may already be connected.
  const [status, setStatus] = useState<SocketStatus>(
    () => (socket.current.connected ? 'connected' : 'disconnected')
  );

  useEffect(() => {
    const s = socket.current;

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('disconnected');

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    // Only connect if not already connected
    if (!s.connected) {
      setStatus('connecting');
      s.connect();
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      // Do NOT disconnect on unmount — the socket is a singleton.
    };
  }, []);

  return { socket: socket.current, status };
}
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/lib/socket-client.ts apps/web/src/hooks/useSocket.ts
git commit -m "feat(web): add socket.io-client singleton and useSocket hook"
```

---

## Task 6: Login + Register Pages

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/register/page.tsx`

No unit tests — these forms delegate entirely to `signIn()` (NextAuth) and `/api/auth/register` (tested in Plan 2).

- [ ] **Step 6.1: Create `apps/web/src/app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 0', fontSize: 16 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <hr style={{ margin: '24px 0' }} />
      <button onClick={() => signIn('google', { callbackUrl: '/' })} style={{ width: '100%', padding: '10px 0', fontSize: 16 }}>
        Continue with Google
      </button>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <a href="/register">Register</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 6.2: Create `apps/web/src/app/register/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setError(data.error ?? 'Registration failed');
      setLoading(false);
      return;
    }

    await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    router.push('/');
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Create account</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        <input type="text" placeholder="Username (3–20 chars, letters/numbers/_)" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} style={{ padding: 8, fontSize: 16 }} />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ padding: 8, fontSize: 16 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 0', fontSize: 16 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/app/login/ apps/web/src/app/register/
git commit -m "feat(web): add login and register pages"
```

---

## Task 7: Lobby / Home Page

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Flow:**
1. User arrives — guest session loads via `useGuestSession`
2. User clicks "Play Now" → socket emits `room:create` → server responds `room:created { roomCode, playerIndex }`
3. Lobby stores `playerIndex` in sessionStorage under key `room:${roomCode}:playerIndex`
4. Lobby redirects to `/room/[roomCode]`
5. Alternatively, user enters a 6-char code → redirects to `/room/[code]` (no sessionStorage write — joiner flow)

**Identity:** The game server only understands `guestId`. All users (including authenticated) send their `guestId` from `useGuestSession`. Authenticated users also have a guest session (created by `GuestSessionInitializer` on app mount).

**Variant:** Only Ultimate TTT is shown (Standard TTT server support is pending).

- [ ] **Step 7.1: Update `apps/web/src/app/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket-client';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useSession } from 'next-auth/react';

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guest = useGuestSession();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCreateRoom() {
    if (!guest) {
      setError('Session loading — please try again in a moment.');
      return;
    }

    setCreating(true);
    setError(null);

    const socket = getSocket();

    function onRoomCreated({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) {
      socket.off('room:created', onRoomCreated);
      // Store our playerIndex so the room page knows our symbol without re-joining
      sessionStorage.setItem(`room:${roomCode}:playerIndex`, String(playerIndex));
      router.push(`/room/${roomCode}`);
    }

    socket.on('room:created', onRoomCreated);

    if (!socket.connected) {
      socket.connect();
      socket.once('connect', () => {
        socket.emit('room:create', {
          guestId: guest.guestId,
          displayName: session?.user?.name ?? guest.displayName,
          variantId: 'ultimate_ttt',
        });
      });
    } else {
      socket.emit('room:create', {
        guestId: guest.guestId,
        displayName: session?.user?.name ?? guest.displayName,
        variantId: 'ultimate_ttt',
      });
    }
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>TacticToe</h1>
      <p style={{ color: '#9ca3af', marginBottom: 32 }}>
        Competitive Tic-Tac-Toe. Think before you play.
      </p>

      {/* Create room */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ marginBottom: 8, color: '#d1d5db' }}>
          Variant: <strong>Ultimate TTT</strong>
        </p>
        <button
          onClick={handleCreateRoom}
          disabled={creating || !guest}
          style={{ padding: '12px 28px', fontSize: 18, cursor: 'pointer', borderRadius: 8 }}
        >
          {creating ? 'Creating room…' : 'Play Now'}
        </button>
      </section>

      {/* Join by code */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Join with Room Code</h2>
        <form onSubmit={handleJoinRoom} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="6-char code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ padding: 8, fontSize: 16, width: 160, letterSpacing: 4, textTransform: 'uppercase' }}
          />
          <button type="submit" style={{ padding: '8px 16px', fontSize: 16 }}>
            Join
          </button>
        </form>
      </section>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Auth CTA for guests */}
      {!session?.user && (
        <section style={{ marginTop: 40, padding: 16, border: '1px solid #374151', borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            Playing as <strong>{guest?.displayName ?? '…'}</strong>.{' '}
            <a href="/register">Create an account</a> to track your rating.
          </p>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): add lobby with room creation and join-by-code flow"
```

---

## Task 8: Room Page — Full Game Flow

**Files:**
- Create: `apps/web/src/app/room/[code]/page.tsx`

**Key design decisions:**

1. **Creator identity:** On mount, check `sessionStorage.getItem('room:${code}:playerIndex')`. If found (value `'0'`), we created this room and are already in the socket.io room — skip emitting `room:join`. Read our playerIndex from storage.

2. **Joiner identity:** If not in sessionStorage, we're a new joiner. Emit `room:join` with guestId + displayName. Listen for `room:joined` to get our playerIndex.

3. **Move format** (must match `MakeMovePayload`): `game:move { roomCode, boardIndex, cellIndex }` — flat, no `move` wrapper.

4. **`game:started` payload**: `{ gameState: UltimateTTTState, players: [{ displayName, playerIndex }] }` — use `playerIndex` (0=X, 1=O) to determine symbol.

5. **`game:state` payload**: `{ gameState: UltimateTTTState, lastMove }` — replace gameState.

6. **`game:over` payload**: `{ gameState, winner: 'X'|'O'|null, reason, winnerDisplayName }` — no rematch button (server doesn't support it yet).

- [ ] **Step 8.1: Patch `apps/game-server/src/game-session.ts` — add `myPlayerIndex` to `game:reconnect` payload**

The client needs to know its own player index after reconnecting. Open `apps/game-server/src/game-session.ts` and replace the `handleReconnect` emit body:

```typescript
// Find which player is reconnecting (their socketId was just updated to newSocketId)
const reconnectingPlayer = room.players.find((p) => p.socketId === newSocketId);

io.to(newSocketId).emit('game:reconnect', {
  gameState: room.gameState,
  myPlayerIndex: reconnectingPlayer?.playerIndex ?? 0, // ← ADD THIS
  players: room.players.map((p) => ({
    displayName: p.displayName,
    playerIndex: p.playerIndex,
  })),
});
```

Run game-server tests to verify no regressions: `pnpm --filter game-server test`
Expected: 27/27 pass

Commit:
```bash
git add apps/game-server/src/game-session.ts
git commit -m "fix(game-server): include myPlayerIndex in game:reconnect payload"
```

- [ ] **Step 8.2: Create `apps/web/src/app/room/[code]/page.tsx`**

```tsx
'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useSocket } from '@/hooks/useSocket';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import type { UltimateTTTState } from '@tactictoe/game-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  displayName: string;
  playerIndex: 0 | 1;
}

interface RoomState {
  phase: 'waiting' | 'playing' | 'over';
  myPlayerIndex: 0 | 1 | null; // 0=X, 1=O; null before confirmed
  players: PlayerInfo[];
  gameState: UltimateTTTState | null;
  winner: 'X' | 'O' | null;
  winnerDisplayName: string | null;
  reason: 'win' | 'draw' | 'forfeit' | null;
  error: string | null;
}

type RoomAction =
  | { type: 'SET_MY_INDEX'; playerIndex: 0 | 1; players?: PlayerInfo[] }
  | { type: 'GAME_STARTED'; gameState: UltimateTTTState; players: PlayerInfo[] }
  | { type: 'STATE_UPDATE'; gameState: UltimateTTTState }
  | { type: 'GAME_OVER'; winner: 'X' | 'O' | null; reason: 'win' | 'draw' | 'forfeit'; winnerDisplayName: string | null }
  | { type: 'ERROR'; message: string };

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SET_MY_INDEX':
      return {
        ...state,
        myPlayerIndex: action.playerIndex,
        players: action.players ?? state.players,
      };
    case 'GAME_STARTED':
      return { ...state, phase: 'playing', gameState: action.gameState, players: action.players };
    case 'STATE_UPDATE':
      return { ...state, gameState: action.gameState };
    case 'GAME_OVER':
      return {
        ...state,
        phase: 'over',
        winner: action.winner,
        reason: action.reason,
        winnerDisplayName: action.winnerDisplayName,
      };
    case 'ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}

const initialState: RoomState = {
  phase: 'waiting',
  myPlayerIndex: null,
  players: [],
  gameState: null,
  winner: null,
  winnerDisplayName: null,
  reason: null,
  error: null,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params['code'] as string).toUpperCase();
  const { data: session } = useSession();
  const guest = useGuestSession();
  const { socket, status } = useSocket();
  const [roomState, dispatch] = useReducer(roomReducer, initialState);

  // Prevent double-join on StrictMode double-mount
  const joined = useRef(false);

  // Determine my playerIndex:
  // - Creator: sessionStorage has 'room:${code}:playerIndex' → no need to re-join
  // - Joiner: emit room:join, wait for room:joined
  const mySymbol: 'X' | 'O' | null =
    roomState.myPlayerIndex !== null
      ? roomState.myPlayerIndex === 0
        ? 'X'
        : 'O'
      : null;

  // Also gate on `status === 'connected'` — if socket disconnects mid-game,
  // the board should go non-interactive rather than accepting lost moves.
  const isMyTurn =
    status === 'connected' &&
    roomState.gameState !== null &&
    roomState.phase === 'playing' &&
    mySymbol !== null &&
    roomState.gameState.currentPlayer === mySymbol;

  // ── Join logic ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected' || !guest || joined.current) return;
    joined.current = true;

    const savedIndex = sessionStorage.getItem(`room:${code}:playerIndex`);

    if (savedIndex !== null) {
      // We created this room — already in the socket.io room. Just record our index.
      const idx = parseInt(savedIndex, 10) as 0 | 1;
      dispatch({ type: 'SET_MY_INDEX', playerIndex: idx });
      // Clean up sessionStorage entry
      sessionStorage.removeItem(`room:${code}:playerIndex`);
    } else {
      // Joiner or returning visitor — emit room:join
      socket.emit('room:join', {
        roomCode: code,
        guestId: guest.guestId,
        displayName: session?.user?.name ?? guest.displayName,
      });
    }
  }, [status, guest, session, socket, code]);

  // ── Socket event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function onRoomJoined(data: { roomCode: string; playerIndex: 0 | 1; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.playerIndex, players: data.players });
    }

    function onGameStarted(data: { gameState: UltimateTTTState; players: PlayerInfo[] }) {
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }

    function onGameState(data: { gameState: UltimateTTTState }) {
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
    }

    function onGameOver(data: {
      gameState: UltimateTTTState;
      winner: 'X' | 'O' | null;
      reason: 'win' | 'draw' | 'forfeit';
      winnerDisplayName: string | null;
    }) {
      // Update gameState too (final position) then transition to over
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
      dispatch({ type: 'GAME_OVER', winner: data.winner, reason: data.reason, winnerDisplayName: data.winnerDisplayName });
    }

    function onGameReconnect(data: { gameState: UltimateTTTState; myPlayerIndex: 0 | 1; players: PlayerInfo[] }) {
      // Restore myPlayerIndex from the server payload (it was lost on page refresh)
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.myPlayerIndex, players: data.players });
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }

    function onError(data: { message: string }) {
      dispatch({ type: 'ERROR', message: data.message });
    }

    function onSpectating() {
      // Room was full — joined as spectator. Show a clear message.
      dispatch({ type: 'ERROR', message: 'This room is full. Watching as spectator.' });
    }

    socket.on('room:joined', onRoomJoined);
    socket.on('game:started', onGameStarted);
    socket.on('game:state', onGameState);
    socket.on('game:over', onGameOver);
    socket.on('game:reconnect', onGameReconnect);
    socket.on('error', onError);
    socket.on('room:spectating', onSpectating);

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('game:started', onGameStarted);
      socket.off('game:state', onGameState);
      socket.off('game:over', onGameOver);
      socket.off('game:reconnect', onGameReconnect);
      socket.off('error', onError);
      socket.off('room:spectating', onSpectating);
    };
  }, [socket]);

  // ── Move handler ─────────────────────────────────────────────────────────────
  const handleMove = useCallback(
    (boardIndex: number, cellIndex: number) => {
      // MakeMovePayload: { roomCode, boardIndex, cellIndex }
      socket.emit('game:move', { roomCode: code, boardIndex, cellIndex });
    },
    [socket, code]
  );

  // ── Share URL ─────────────────────────────────────────────────────────────────
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 700, margin: '32px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>
            Room: <code style={{ letterSpacing: 4, fontSize: 20 }}>{code}</code>
          </h1>
          {mySymbol && (
            <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
              You are playing as <strong>{mySymbol}</strong>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
            }}
            style={{ padding: '6px 12px', fontSize: 14 }}
          >
            Copy Link
          </button>
          <button onClick={() => router.push('/')} style={{ padding: '6px 12px', fontSize: 14 }}>
            Leave
          </button>
        </div>
      </div>

      {/* Connection status */}
      {status !== 'connected' && (
        <p style={{ color: '#f59e0b' }}>Connecting…</p>
      )}

      {/* Waiting for opponent */}
      {roomState.phase === 'waiting' && status === 'connected' && (
        <div style={{ marginBottom: 20 }}>
          <p>Waiting for opponent…</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>
            Share the link or code <strong>{code}</strong>
          </p>
        </div>
      )}

      {/* Players list */}
      {roomState.players.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {roomState.players.map((p) => {
            const sym = p.playerIndex === 0 ? 'X' : 'O';
            const isMe = p.playerIndex === roomState.myPlayerIndex;
            return (
              <div key={p.playerIndex} style={{ fontWeight: isMe ? 'bold' : 'normal' }}>
                {sym} — {p.displayName} {isMe ? '(you)' : ''}
              </div>
            );
          })}
        </div>
      )}

      {/* Turn indicator */}
      {roomState.phase === 'playing' && roomState.gameState && (
        <p style={{ marginBottom: 12, color: isMyTurn ? '#4ade80' : '#9ca3af' }}>
          {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </p>
      )}

      {/* Game board */}
      {roomState.gameState && roomState.phase !== 'waiting' && (
        <UltimateBoard
          boards={roomState.gameState.boards}
          boardResults={roomState.gameState.boardResults}
          nextBoardConstraint={roomState.gameState.nextBoardConstraint}
          currentPlayer={roomState.gameState.currentPlayer}
          disabled={!isMyTurn}
          onMove={handleMove}
        />
      )}

      {/* Game over */}
      {roomState.phase === 'over' && (
        <div style={{ marginTop: 24, padding: 16, border: '2px solid #4ade80', borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>
            {roomState.winner === mySymbol
              ? 'You win!'
              : roomState.winner === null
              ? "It's a draw!"
              : 'You lose.'}
          </h2>
          {roomState.reason === 'forfeit' && (
            <p style={{ color: '#f59e0b', fontSize: 14 }}>
              {roomState.winner === mySymbol ? 'Opponent disconnected.' : 'You were disconnected.'}
            </p>
          )}
          <button onClick={() => router.push('/')} style={{ padding: '10px 20px', fontSize: 16 }}>
            Back to Lobby
          </button>
        </div>
      )}

      {/* Error */}
      {roomState.error && (
        <p style={{ color: 'red', marginTop: 16 }}>{roomState.error}</p>
      )}
    </main>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
git add apps/web/src/app/room/
git commit -m "feat(web): add room page with socket integration, game reducer, and Ultimate TTT board"
```

---

## Task 9: Final Verification

- [ ] **Step 9.1: Run all tests across the monorepo**

Run from repo root: `pnpm test`
Expected: all tests pass (game-engine: 55, game-server: 27, web: 37+)

- [ ] **Step 9.2: Typecheck the web app**

Run from `apps/web`: `pnpm typecheck`
Expected: no errors. If `Cannot find module '@tactictoe/game-engine'` appears, check that `package.json` has `"@tactictoe/game-engine": "workspace:*"` in dependencies and run `pnpm install`.

- [ ] **Step 9.3: Start both servers and smoke test**

Terminal 1 (game server):
```bash
pnpm --filter game-server dev
```

Terminal 2 (web):
```bash
pnpm --filter web dev
```

Manual test:
1. Open `http://localhost:3000` — lobby loads, shows "Guest#XXXX"
2. Click "Play Now" → creates room, redirects to `/room/[code]`
3. Copy the room URL, open in a second browser tab
4. Second tab joins → "Waiting for opponent" goes away, game starts
5. Make moves alternating between tabs → board updates in both
6. Complete a game → game-over screen with correct winner

- [ ] **Step 9.4: Final commit**

```bash
git commit --allow-empty -m "chore: plan-3 game-ui complete — lobby, auth pages, Ultimate TTT board, room page"
```
