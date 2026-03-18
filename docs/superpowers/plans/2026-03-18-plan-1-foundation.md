# Plan 1: Foundation — Game Engine + Game Server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo, implement a fully-tested Ultimate TTT rules engine, and build a minimal Socket.io game server where two browser clients can play a complete game end-to-end.

**Architecture:** pnpm workspace monorepo with two apps (`web` placeholder, `game-server`) and one shared package (`game-engine`). The `game-engine` package is pure TypeScript with zero runtime dependencies — it only knows rules. The `game-server` imports it and wraps it in Socket.io events. The frontend will import it later for move-preview feedback.

**Tech Stack:** pnpm workspaces, TypeScript 5, Vitest, Node.js 20, Socket.io 4, tsx (dev runner)

---

## File Map

```
tactictoe/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml                   # workspace package globs
├── .gitignore
├── packages/
│   └── game-engine/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts              # Explicit Vitest config (required for NodeNext + TS)
│       ├── src/
│       │   ├── types.ts                  # All shared types (Cell, Board, GameState, Move, etc.)
│       │   ├── rules/
│       │   │   ├── interface.ts          # GameRules interface
│       │   │   ├── win-checker.ts        # Pure function: check 3-in-a-row on a 9-cell array
│       │   │   ├── standard-ttt.ts       # StandardTTT implements GameRules
│       │   │   └── ultimate-ttt.ts       # UltimateTTT implements GameRules
│       │   └── index.ts                  # Public re-exports (final content shown in Task 7)
│       └── tests/
│           ├── win-checker.test.ts
│           ├── standard-ttt.test.ts
│           └── ultimate-ttt.test.ts
└── apps/
    └── game-server/
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts              # Explicit Vitest config
        └── src/
            ├── index.ts                  # Creates HTTP + Socket.io server, wires up handlers
            ├── room-manager.ts           # Creates/destroys rooms, maps roomCode -> RoomState
            ├── room-manager.test.ts      # Unit tests for RoomManager
            ├── game-session.ts           # Handles a single live game: moves, turn, disconnect timer
            ├── game-session.test.ts      # Unit tests for handleDisconnect (uses fake timers)
            ├── integration.test.ts       # Two clients play a complete game end-to-end
            └── types.ts                  # Server-only types (RoomState, ConnectedPlayer, etc.)
```

**Boundary contract:** `game-engine` exports pure functions and classes. It has no I/O, no timers, no randomness. The game server owns time, I/O, and persistence (placeholder in this plan). This boundary lets you test the engine in complete isolation.

---

## Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`

- [ ] **Step 1.1: Create workspace root `package.json`**

```json
{
  "name": "tactictoe",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev:server": "pnpm --filter game-server dev"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 1.2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 1.3: Create `.gitignore`** (append to existing if it exists)

```
node_modules/
dist/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 1.4: Install pnpm if not already available**

Run: `npm install -g pnpm@9.15.4`
Expected: pnpm installed globally

- [ ] **Step 1.5: Install root dependencies**

Run: `pnpm install`
Expected: lockfile created, node_modules at root

- [ ] **Step 1.6: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo workspace"
```

---

## Task 2: Create game-engine Package

**Files:**
- Create: `packages/game-engine/package.json`
- Create: `packages/game-engine/tsconfig.json`
- Create: `packages/game-engine/src/types.ts`
- Create: `packages/game-engine/src/rules/interface.ts`
- Create: `packages/game-engine/src/index.ts`

- [ ] **Step 2.1: Create `packages/game-engine/package.json`**

```json
{
  "name": "@tactictoe/game-engine",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

> **Note:** We export `src/index.ts` directly (no build step needed for monorepo-internal usage). tsx and vitest can both consume TypeScript directly.

- [ ] **Step 2.2: Create `packages/game-engine/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2.3: Create `packages/game-engine/src/types.ts`**

```typescript
// The 9 cells of a single board, indexed 0-8:
// 0 | 1 | 2
// ---------
// 3 | 4 | 5
// ---------
// 6 | 7 | 8
export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

// Result of a single board (mini-board or meta-board)
export type BoardResult = Player | 'draw' | null; // null = still in play

export interface Move {
  // Variant-specific move data. Each rules implementation defines what it expects.
  // Stored as unknown here; the rules class casts and validates internally.
  data: unknown;
}

export interface MoveResult {
  ok: boolean;
  error?: string;       // Human-readable reason if ok === false
  state: GameState;     // New state (same as input state if ok === false)
}

export interface TerminalResult {
  winner: Player | null; // null = draw
  reason: 'win' | 'draw';
}

// Opaque game state — each rules implementation defines the shape internally.
// Externally it is treated as an opaque serializable blob.
export interface GameState {
  readonly variantId: string;
  readonly currentPlayer: Player;
  readonly moveCount: number;
  // Additional fields are variant-specific and live on concrete state subtypes.
}

export interface VariantConfig {
  variantId: string;
  // Additional config is variant-specific.
  [key: string]: unknown;
}
```

- [ ] **Step 2.4: Create `packages/game-engine/src/rules/interface.ts`**

```typescript
import type { GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

export interface GameRules {
  /** Create a fresh initial game state from a config. */
  initialize(config: VariantConfig): GameState;

  /**
   * Apply a move. Returns the new state (or unchanged state with error) and ok flag.
   * Never mutates the input state.
   */
  applyMove(state: GameState, move: Move, playerId: Player): MoveResult;

  /**
   * Return all legal moves for the current player in the given state.
   * Used by the client for move-highlight UI and by tests for exhaustive checks.
   */
  getLegalMoves(state: GameState): Move[];

  /**
   * Return a TerminalResult if the game is over, null if still in play.
   */
  checkTerminal(state: GameState): TerminalResult | null;

  /** Serialize state to a JSON string for DB storage and WebSocket broadcast. */
  serialize(state: GameState): string;

  /** Deserialize a JSON string back to a GameState. Throws on invalid input. */
  deserialize(s: string): GameState;
}

// Re-export Player so consumers don't need to import from types separately
import type { Player } from '../types.js';
export type { Player };
```

- [ ] **Step 2.5: Create `packages/game-engine/src/index.ts`**

```typescript
export type {
  Player,
  Cell,
  Board,
  BoardResult,
  Move,
  MoveResult,
  TerminalResult,
  GameState,
  VariantConfig,
} from './types.js';

export type { GameRules } from './rules/interface.js';
```

- [ ] **Step 2.6: Install game-engine dependencies**

Run: `pnpm install` (from repo root)
Expected: workspace packages linked

- [ ] **Step 2.7: Create `packages/game-engine/vitest.config.ts`**

Without an explicit config, Vitest may conflict with `"moduleResolution": "NodeNext"` and `.js` extension imports. This config anchors the test root and confirms the setup.

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2.8: Verify types compile**

Run (from `packages/game-engine`): `pnpm typecheck`
Expected: no errors

- [ ] **Step 2.9: Commit**

```bash
git add packages/game-engine/
git commit -m "feat(game-engine): add package scaffold with types and GameRules interface"
```

---

## Task 3: Win Checker Utility

**Files:**
- Create: `packages/game-engine/src/rules/win-checker.ts`
- Create: `packages/game-engine/tests/win-checker.test.ts`

The win checker is the most primitive piece. It takes a 9-element array and checks whether any player has three in a row. Used by both StandardTTT and UltimateTTT.

- [ ] **Step 3.1: Write failing tests for `checkBoardWinner`**

Create `packages/game-engine/tests/win-checker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkBoardWinner } from '../src/rules/win-checker.js';
import type { Board } from '../src/types.js';

const _ = null;

describe('checkBoardWinner', () => {
  it('returns null for an empty board', () => {
    const board: Board = [_, _, _, _, _, _, _, _, _];
    expect(checkBoardWinner(board)).toBeNull();
  });

  it('returns null for a partial board with no winner', () => {
    const board: Board = ['X', 'O', _, _, 'X', _, _, _, _];
    expect(checkBoardWinner(board)).toBeNull();
  });

  it('detects top-row win for X', () => {
    const board: Board = ['X', 'X', 'X', 'O', 'O', _, _, _, _];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects middle-row win for O', () => {
    const board: Board = ['X', _, 'X', 'O', 'O', 'O', _, _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects bottom-row win for X', () => {
    const board: Board = [_, 'O', 'O', _, _, _, 'X', 'X', 'X'];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects left-column win for O', () => {
    const board: Board = ['O', 'X', _, 'O', 'X', _, 'O', _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects center-column win for X', () => {
    const board: Board = ['O', 'X', _, 'O', 'X', _, _, 'X', _];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects right-column win for O', () => {
    const board: Board = [_, 'X', 'O', _, 'X', 'O', _, _, 'O'];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects main-diagonal win for X', () => {
    const board: Board = ['X', 'O', _, _, 'X', 'O', _, _, 'X'];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects anti-diagonal win for O', () => {
    const board: Board = [_, 'X', 'O', _, 'O', 'X', 'O', _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('returns null when board is full but drawn', () => {
    // X O X / O O X / X X O — no three in a row for either player
    const board: Board = ['X', 'O', 'X', 'O', 'O', 'X', 'X', 'X', 'O'];
    expect(checkBoardWinner(board)).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run tests — expect failure**

Run (from `packages/game-engine`): `pnpm test`
Expected: FAIL — `win-checker.js` module not found

- [ ] **Step 3.3: Implement `win-checker.ts`**

Create `packages/game-engine/src/rules/win-checker.ts`:

```typescript
import type { Board, Player } from '../types.js';

const WIN_LINES = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // center column
  [2, 5, 8], // right column
  [0, 4, 8], // main diagonal
  [2, 4, 6], // anti-diagonal
] as const;

/**
 * Check if a player has won on a 9-cell board.
 * Returns the winning Player, or null if no winner yet.
 */
export function checkBoardWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell;
    }
  }
  return null;
}

/**
 * Check if all 9 cells are filled (used to detect draws).
 */
export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}
```

- [ ] **Step 3.4: Export from index**

Add to `packages/game-engine/src/index.ts`:
```typescript
export { checkBoardWinner, isBoardFull } from './rules/win-checker.js';
```

- [ ] **Step 3.5: Run tests — expect pass**

Run: `pnpm test`
Expected: 11 tests pass

- [ ] **Step 3.6: Commit**

```bash
git add packages/game-engine/src/rules/win-checker.ts packages/game-engine/tests/win-checker.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): implement checkBoardWinner and isBoardFull with full test coverage"
```

---

## Task 4: Standard TTT Rules Engine

**Files:**
- Create: `packages/game-engine/src/rules/standard-ttt.ts`
- Create: `packages/game-engine/tests/standard-ttt.test.ts`

Standard TTT is the simpler variant. Implementing it first validates the `GameRules` interface shape before tackling Ultimate TTT.

- [ ] **Step 4.1: Write failing tests**

Create `packages/game-engine/tests/standard-ttt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { StandardTTT } from '../src/rules/standard-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new StandardTTT();

function fresh(): GameState {
  return rules.initialize({ variantId: 'standard_3x3' });
}

function play(state: GameState, cellIndex: number): GameState {
  const result = rules.applyMove(state, { data: { cellIndex } }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move rejected: ${result.error}`);
  return result.state;
}

describe('StandardTTT', () => {
  describe('initialize', () => {
    it('starts with X as current player', () => {
      expect(fresh().currentPlayer).toBe('X');
    });

    it('starts with moveCount 0', () => {
      expect(fresh().moveCount).toBe(0);
    });

    it('starts with no terminal result', () => {
      expect(rules.checkTerminal(fresh())).toBeNull();
    });
  });

  describe('applyMove', () => {
    it('places a mark and switches player', () => {
      let s = fresh();
      s = play(s, 4);
      expect(s.currentPlayer).toBe('O');
      expect(s.moveCount).toBe(1);
    });

    it('rejects a move on an occupied cell', () => {
      let s = fresh();
      s = play(s, 4);
      const result = rules.applyMove(s, { data: { cellIndex: 4 } }, s.currentPlayer);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/occupied/i);
    });

    it('rejects a move from the wrong player', () => {
      const s = fresh(); // X's turn
      const result = rules.applyMove(s, { data: { cellIndex: 0 } }, 'O');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not your turn/i);
    });

    it('rejects an out-of-bounds cell index', () => {
      const s = fresh();
      const result = rules.applyMove(s, { data: { cellIndex: 9 } }, 'X');
      expect(result.ok).toBe(false);
    });

    it('rejects a move in a finished game', () => {
      let s = fresh();
      // X wins: 0,1,2
      s = play(s, 0); // X
      s = play(s, 3); // O
      s = play(s, 1); // X
      s = play(s, 4); // O
      s = play(s, 2); // X wins
      const result = rules.applyMove(s, { data: { cellIndex: 5 } }, 'O');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/game.*over/i);
    });
  });

  describe('getLegalMoves', () => {
    it('returns 9 moves on an empty board', () => {
      expect(rules.getLegalMoves(fresh())).toHaveLength(9);
    });

    it('returns 0 moves in a terminal state', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 2); // X wins
      expect(rules.getLegalMoves(s)).toHaveLength(0);
    });
  });

  describe('checkTerminal', () => {
    it('detects an X win', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 2); // X wins top row
      const result = rules.checkTerminal(s);
      expect(result).not.toBeNull();
      expect(result?.winner).toBe('X');
      expect(result?.reason).toBe('win');
    });

    it('detects an O win', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 8); s = play(s, 5); // O wins left column
      const result = rules.checkTerminal(s);
      expect(result?.winner).toBe('O');
    });

    it('detects a draw', () => {
      // X O X / O O X / X X O — drawn
      let s = fresh();
      const moves = [0, 1, 2, 3, 5, 4, 7, 8, 6];
      //              X  O  X  O  X  O  X  O  X
      for (const cell of moves) {
        s = play(s, cell);
      }
      const result = rules.checkTerminal(s);
      expect(result?.winner).toBeNull();
      expect(result?.reason).toBe('draw');
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips a mid-game state', () => {
      let s = fresh();
      s = play(s, 4);
      s = play(s, 0);
      const json = rules.serialize(s);
      const restored = rules.deserialize(json);
      expect(restored.currentPlayer).toBe(s.currentPlayer);
      expect(restored.moveCount).toBe(s.moveCount);
    });
  });
});
```

- [ ] **Step 4.2: Run tests — expect failure**

Run: `pnpm test`
Expected: FAIL — `standard-ttt.js` not found

- [ ] **Step 4.3: Implement `standard-ttt.ts`**

Create `packages/game-engine/src/rules/standard-ttt.ts`:

```typescript
import type { GameRules, Player } from './interface.js';
import type { Board, Cell, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

interface StandardTTTState extends GameState {
  variantId: 'standard_3x3';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): StandardTTTState {
  if (state.variantId !== 'standard_3x3') {
    throw new Error(`StandardTTT received wrong variantId: ${state.variantId}`);
  }
  return state as StandardTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkBoardWinner(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class StandardTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: StandardTTTState = {
      variantId: 'standard_3x3',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    };
    return state;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) {
      return { ok: false, error: 'Game is over', state };
    }
    if (playerId !== s.currentPlayer) {
      return { ok: false, error: 'Not your turn', state };
    }

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newState: StandardTTTState = {
      variantId: 'standard_3x3',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard),
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    return s.board
      .map((cell, i) => (cell === null ? { data: { cellIndex: i } } : null))
      .filter((m): m is Move => m !== null);
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as StandardTTTState;
  }
}
```

- [ ] **Step 4.4: Export from index**

Add to `packages/game-engine/src/index.ts`:
```typescript
export { StandardTTT } from './rules/standard-ttt.js';
```

- [ ] **Step 4.5: Run tests — expect pass**

Run: `pnpm test`
Expected: all tests pass (win-checker + standard-ttt)

- [ ] **Step 4.6: Commit**

```bash
git add packages/game-engine/src/rules/standard-ttt.ts packages/game-engine/tests/standard-ttt.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): implement StandardTTT rules engine with full test coverage"
```

---

## Task 5: Ultimate TTT Rules Engine — Types and State

**Files:**
- Create: `packages/game-engine/src/rules/ultimate-ttt.ts` (partial — types only first)

Before writing the tests, define the concrete state shape for Ultimate TTT so the test file can use it.

- [ ] **Step 5.1: Create the state type stub in `ultimate-ttt.ts`**

Create `packages/game-engine/src/rules/ultimate-ttt.ts`:

```typescript
import type { GameRules, Player } from './interface.js';
import type { Board, BoardResult, Cell, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UltimateTTTMove {
  boardIndex: number; // 0-8: which mini-board to play in
  cellIndex: number;  // 0-8: which cell within that mini-board
}

export interface UltimateTTTState extends GameState {
  variantId: 'ultimate_ttt';
  // 9 mini-boards, each a 9-cell Board
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  // Result of each mini-board: Player (won), 'draw', or null (still in play)
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  // null = current player may play in any non-terminal board
  // number = current player MUST play in this board index
  nextBoardConstraint: number | null;
  terminal: TerminalResult | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

function emptyBoards(): UltimateTTTState['boards'] {
  return [
    emptyBoard(), emptyBoard(), emptyBoard(),
    emptyBoard(), emptyBoard(), emptyBoard(),
    emptyBoard(), emptyBoard(), emptyBoard(),
  ];
}

function emptyBoardResults(): UltimateTTTState['boardResults'] {
  return [null, null, null, null, null, null, null, null, null];
}

function castState(state: GameState): UltimateTTTState {
  if (state.variantId !== 'ultimate_ttt') {
    throw new Error(`UltimateTTT received wrong variantId: ${state.variantId}`);
  }
  return state as UltimateTTTState;
}

/**
 * Check whether a set of 9 BoardResults represents a win or draw
 * for the meta-board (same logic as a standard board, but on BoardResults).
 */
function computeMetaTerminal(boardResults: UltimateTTTState['boardResults']): TerminalResult | null {
  // Treat boardResults as a "board" where 'X'/'O' = won, 'draw'/null = empty
  const metaCells: (Player | null)[] = boardResults.map((r) =>
    r === 'X' || r === 'O' ? r : null
  );
  const winner = checkBoardWinner(metaCells as Board);
  if (winner !== null) return { winner, reason: 'win' };
  // Draw: all boards are settled (no null results) but no meta-winner
  if (boardResults.every((r) => r !== null)) return { winner: null, reason: 'draw' };
  return null;
}

// ─── UltimateTTT class (stub) ─────────────────────────────────────────────────

export class UltimateTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      boards: emptyBoards(),
      boardResults: emptyBoardResults(),
      nextBoardConstraint: null, // first move: any board
      terminal: null,
    };
    return state;
  }

  applyMove(_state: GameState, _move: Move, _playerId: Player): MoveResult {
    throw new Error('Not implemented');
  }

  getLegalMoves(_state: GameState): Move[] {
    throw new Error('Not implemented');
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as UltimateTTTState;
  }
}
```

- [ ] **Step 5.2: Export from index**

Add to `packages/game-engine/src/index.ts`:
```typescript
export { UltimateTTT } from './rules/ultimate-ttt.js';
export type { UltimateTTTState, UltimateTTTMove } from './rules/ultimate-ttt.js';
```

- [ ] **Step 5.3: Verify it compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 5.4: Commit the stub**

```bash
git add packages/game-engine/src/rules/ultimate-ttt.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add UltimateTTT state type and class stub"
```

---

## Task 6: Ultimate TTT Rules Engine — Tests (Write First)

**Files:**
- Create: `packages/game-engine/tests/ultimate-ttt.test.ts`

Write all the tests before implementing. These tests define every behavior the engine must have.

- [ ] **Step 6.1: Write the complete Ultimate TTT test suite**

Create `packages/game-engine/tests/ultimate-ttt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UltimateTTT } from '../src/rules/ultimate-ttt.js';
import type { UltimateTTTState } from '../src/rules/ultimate-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new UltimateTTT();

function fresh(): UltimateTTTState {
  return rules.initialize({ variantId: 'ultimate_ttt' }) as UltimateTTTState;
}

/** Helper: play a move and return the new state, throwing on rejection */
function play(state: GameState, boardIndex: number, cellIndex: number): UltimateTTTState {
  const s = state as UltimateTTTState;
  const result = rules.applyMove(s, { data: { boardIndex, cellIndex } }, s.currentPlayer);
  if (!result.ok) throw new Error(`Move b${boardIndex}c${cellIndex} rejected: ${result.error}`);
  return result.state as UltimateTTTState;
}

/** Helper: attempt a move and expect it to fail */
function expectRejected(state: GameState, boardIndex: number, cellIndex: number, pattern?: RegExp): void {
  const s = state as UltimateTTTState;
  const result = rules.applyMove(s, { data: { boardIndex, cellIndex } }, s.currentPlayer);
  expect(result.ok).toBe(false);
  if (pattern) expect(result.error).toMatch(pattern);
}

// ─── Initialization ───────────────────────────────────────────────────────────

describe('initialize', () => {
  it('starts with X as current player', () => {
    expect(fresh().currentPlayer).toBe('X');
  });

  it('starts with moveCount 0', () => {
    expect(fresh().moveCount).toBe(0);
  });

  it('starts with no board constraint (any board is valid)', () => {
    expect(fresh().nextBoardConstraint).toBeNull();
  });

  it('starts with no terminal result', () => {
    expect(rules.checkTerminal(fresh())).toBeNull();
  });

  it('starts with all mini-boards empty', () => {
    const s = fresh();
    for (const board of s.boards) {
      expect(board.every((c) => c === null)).toBe(true);
    }
  });

  it('starts with all boardResults null', () => {
    const s = fresh();
    expect(s.boardResults.every((r) => r === null)).toBe(true);
  });
});

// ─── Board constraint ─────────────────────────────────────────────────────────

describe('board constraint', () => {
  it('first move can be in any board', () => {
    const s = fresh();
    // Playing in board 7 should succeed
    expect(() => play(s, 7, 4)).not.toThrow();
    // Playing in board 0 should also succeed
    expect(() => play(s, 0, 0)).not.toThrow();
  });

  it('playing cell 4 in any board sends opponent to board 4', () => {
    let s = fresh();
    s = play(s, 0, 4); // X plays in board 0, cell 4
    expect(s.nextBoardConstraint).toBe(4);
  });

  it('playing cell 7 in any board sends opponent to board 7', () => {
    let s = fresh();
    s = play(s, 2, 7); // X plays in board 2, cell 7
    expect(s.nextBoardConstraint).toBe(7);
  });

  it('rejects a move in the wrong board when constrained', () => {
    let s = fresh();
    s = play(s, 0, 4); // sends O to board 4
    expectRejected(s, 2, 0, /wrong board/i); // O tries to play in board 2 — illegal
  });

  it('after playing in the correct constrained board, sets new constraint', () => {
    let s = fresh();
    s = play(s, 0, 4); // sends O to board 4
    s = play(s, 4, 2); // O plays board 4 cell 2, sends X to board 2
    expect(s.nextBoardConstraint).toBe(2);
  });
});

// ─── Free choice when target board is won ─────────────────────────────────────

describe('free board choice when target board is won or drawn', () => {
  /**
   * Helper: win board 4 for X by playing cells 0,1,2 of board 4
   * (X plays board 4 cells 0,1,2; O plays in other boards to not interfere)
   * Returns state after board 4 is won by X, with nextBoardConstraint = 4.
   */
  function winBoard4ForX(): UltimateTTTState {
    let s = fresh();
    // X plays board 3, cell 4 → sends O to board 4
    s = play(s, 3, 4);
    // O plays board 4, cell 8 → sends X to board 8
    s = play(s, 4, 8);
    // X plays board 8, cell 4 → sends O to board 4
    s = play(s, 8, 4);
    // O plays board 4, cell 5 → sends X to board 5
    s = play(s, 4, 5);
    // X plays board 5, cell 4 → sends O to board 4
    s = play(s, 5, 4);
    // O plays board 4, cell 0 → sends X to board 0
    s = play(s, 4, 0);
    // X plays board 0, cell 4 → sends O to board 4
    s = play(s, 0, 4);
    // O plays board 4, cell 1 → sends X to board 1
    s = play(s, 4, 1);
    // X plays board 1, cell 4 → sends O to board 4
    s = play(s, 1, 4);
    // O plays board 4, cell 2 → O wins board 4! sends X to board 2
    // Wait, we want X to win board 4. Let's use a simpler sequence.
    // Re-approach: have X play board 4 cells 0, 1, 2 directly.
    return s;
  }

  it('when constrained to a won board, player may play in any open board (getLegalMoves)', () => {
    // Construct a state where board 0 is won by X and nextBoardConstraint = 0.
    // Use deserialization to avoid navigating the full constraint system.
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 10,
      boards: [
        ['X', 'X', 'X', 'O', 'O', null, null, null, null], // board 0: X wins top row
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: ['X', null, null, null, null, null, null, null, null],
      nextBoardConstraint: 0, // forced to board 0, which is won
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;

    // Board 0 is won (result = 'X'), so free choice applies.
    // Boards 1-8 are all empty = 8 boards × 9 cells = 72 legal moves.
    const moves = rules.getLegalMoves(s);
    expect(moves).toHaveLength(72);
    const boardIndices = moves.map((m) => (m.data as { boardIndex: number }).boardIndex);
    expect(boardIndices.every((bi) => bi !== 0)).toBe(true); // board 0 excluded
  });

  it('when constrained to a won board, applyMove accepts a move in any open board', () => {
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 10,
      boards: [
        ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: ['X', null, null, null, null, null, null, null, null],
      nextBoardConstraint: 0,
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;

    // O should be able to play in board 5 (not board 0)
    const result = rules.applyMove(s, { data: { boardIndex: 5, cellIndex: 3 } }, 'O');
    expect(result.ok).toBe(true);

    // And should NOT be able to play in board 0 (already won)
    const rejectedWon = rules.applyMove(s, { data: { boardIndex: 0, cellIndex: 5 } }, 'O');
    expect(rejectedWon.ok).toBe(false);
    expect(rejectedWon.error).toMatch(/already finished/i);
  });

  it('getLegalMoves returns moves in all open boards when constraint is null', () => {
    const s = fresh(); // nextBoardConstraint = null
    const moves = rules.getLegalMoves(s);
    // All 9 boards × 9 cells = 81 moves
    expect(moves).toHaveLength(81);
  });

  it('getLegalMoves returns only moves in the constrained board when valid', () => {
    let s = fresh();
    s = play(s, 3, 4); // sends O to board 4, which is empty (9 legal moves)
    const moves = rules.getLegalMoves(s);
    expect(moves).toHaveLength(9);
    const data = moves.map((m) => (m.data as { boardIndex: number; cellIndex: number }));
    expect(data.every((d) => d.boardIndex === 4)).toBe(true);
  });
});

// ─── Mini-board win detection ─────────────────────────────────────────────────

describe('mini-board win detection', () => {
  it('marks a mini-board as won when a player gets 3-in-a-row', () => {
    let s = fresh();
    // X will win board 0 by getting cells 0,1,2 of board 0
    // X: b0c0 → O must play b0
    s = play(s, 0, 0);
    // O: b0c4 → X must play b4
    s = play(s, 0, 4);
    // X: b4c1 → O must play b1
    s = play(s, 4, 1);
    // O: b1c4 → X must play b4
    s = play(s, 1, 4);
    // X: b4c2 → O must play b2  (X has b4c1 and b4c2, needs b4c0 for board 4 win)
    s = play(s, 4, 2);
    // O: b2c4 → X must play b4
    s = play(s, 2, 4);
    // X: b4c0 → X wins board 4! O must play b0
    s = play(s, 4, 0);
    expect(s.boardResults[4]).toBe('X');
  });

  it('marks a mini-board as draw when it is full with no winner', () => {
    // Build a state where board 2 has 8 cells filled (no winner yet) and
    // nextBoardConstraint = 2, then play the 9th cell and verify boardResults[2] === 'draw'.
    //
    // Board 2 drawn config: X O X / O O X / X X _  (cell 8 is empty)
    // X:0,2,5,6,7  O:1,3,4  → no winner (X has 0,2 but not 1 in top row; etc.)
    // Wait: check win lines for X: [0,1,2]=X,O,X no; [0,3,6]=X,O,X no; [0,4,8]=X,O,_ no
    //   [2,5,8]=X,X,_ no; [6,7,8]=X,X,_ no; [3,4,5]=O,O,X no. Safe — no winner after 8 cells.
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 8,
      boards: [
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        ['X', 'O', 'X', 'O', 'O', 'X', 'X', 'X', null], // board 2: cell 8 empty
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: [null, null, null, null, null, null, null, null, null],
      nextBoardConstraint: 2, // forced to board 2
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;

    // X plays board 2, cell 8 — fills the board with no winner
    const result = rules.applyMove(s, { data: { boardIndex: 2, cellIndex: 8 } }, 'X');
    expect(result.ok).toBe(true);
    const newState = result.state as UltimateTTTState;
    expect(newState.boardResults[2]).toBe('draw');
    // After a draw in board 2, next constraint = cell 8 = board 8.
    // Board 8 is open, so constraint is 8.
    expect(newState.nextBoardConstraint).toBe(8);
  });
});

// ─── Meta-board win detection ─────────────────────────────────────────────────

describe('meta-board win detection (game terminal)', () => {
  /**
   * Win three boards in the top row (boards 0, 1, 2) for X to win the game.
   * This is a complex sequence but tests the full win condition.
   *
   * Strategy:
   * - X wins board 0 by getting cells 0,3,6 (left column)
   * - X wins board 1 by getting cells 0,3,6 (left column)
   * - X wins board 2 by getting cells 0,3,6 (left column)
   * We use O moves to navigate back to the right boards via the constraint system.
   */
  it('detects X winning the meta-board (top row of mini-board wins)', () => {
    // We'll build this state by serializing a known terminal state directly
    // to avoid the complexity of navigating 40+ moves through constraint routing.
    // This tests serialize/deserialize + checkTerminal together.
    const s = fresh();

    // Create a state where X has won boards 0,1,2 by directly constructing it
    const xWinBoard = (): [typeof s.boards[0], typeof s.boardResults[0]] => {
      const board: typeof s.boards[0] = ['X', 'O', 'X', 'X', 'O', 'O', 'X', 'X', 'O'];
      // X wins left column: 0,3,6
      return [board, 'X'];
    };

    const neutralBoard = (): [typeof s.boards[0], typeof s.boardResults[0]] => {
      const board: typeof s.boards[0] = [null, null, null, null, null, null, null, null, null];
      return [board, null];
    };

    const [b0, r0] = xWinBoard();
    const [b1, r1] = xWinBoard();
    const [b2, r2] = xWinBoard();
    const [b3, r3] = neutralBoard();
    const [b4, r4] = neutralBoard();
    const [b5, r5] = neutralBoard();
    const [b6, r6] = neutralBoard();
    const [b7, r7] = neutralBoard();
    const [b8, r8] = neutralBoard();

    // Build a terminal state by deserializing a constructed JSON
    const terminalStateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 30,
      boards: [b0, b1, b2, b3, b4, b5, b6, b7, b8],
      boardResults: [r0, r1, r2, r3, r4, r5, r6, r7, r8],
      nextBoardConstraint: null,
      terminal: null, // intentionally null — checkTerminal should compute this
    });

    // The engine should detect the terminal state from boardResults
    // NOTE: This requires checkTerminal to read boardResults, not a cached terminal field.
    // We'll compute terminal on-the-fly in checkTerminal for correctness.
    const restored = rules.deserialize(terminalStateJson);
    const terminal = rules.checkTerminal(restored);
    expect(terminal).not.toBeNull();
    expect(terminal?.winner).toBe('X');
    expect(terminal?.reason).toBe('win');
  });
});

// ─── Illegal moves ─────────────────────────────────────────────────────────────

describe('illegal move rejection', () => {
  it('rejects move from wrong player', () => {
    const s = fresh(); // X's turn
    const result = rules.applyMove(s, { data: { boardIndex: 0, cellIndex: 0 } }, 'O');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
  });

  it('rejects out-of-bounds boardIndex', () => {
    const s = fresh();
    const result = rules.applyMove(s, { data: { boardIndex: 9, cellIndex: 0 } }, 'X');
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-bounds cellIndex', () => {
    const s = fresh();
    const result = rules.applyMove(s, { data: { boardIndex: 0, cellIndex: 9 } }, 'X');
    expect(result.ok).toBe(false);
  });

  it('rejects move on an occupied cell', () => {
    let s = fresh();
    s = play(s, 0, 0); // X plays board 0, cell 0 → O must play board 0
    expectRejected(s, 0, 0, /occupied/i);
  });

  it('rejects move in a completed (won) mini-board', () => {
    // Create a state where board 0 is already won
    const wonBoardJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 5,
      boards: [
        ['X', 'X', 'X', 'O', 'O', null, null, null, null], // board 0: X wins top row
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: ['X', null, null, null, null, null, null, null, null],
      nextBoardConstraint: 0, // forced to board 0, which is won
      terminal: null,
    });
    const s = rules.deserialize(wonBoardJson);
    // X is constrained to board 0 which is won → should be allowed to play anywhere
    const moves = rules.getLegalMoves(s);
    // Board 0 is won, so X can play in any other open board (boards 1-8, all empty = 8*9=72 moves)
    expect(moves.length).toBe(72);
  });

  it('rejects any move in a terminal game', () => {
    const terminalJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 30,
      boards: Array(9).fill([null, null, null, null, null, null, null, null, null]),
      boardResults: ['X', 'X', 'X', null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: { winner: 'X', reason: 'win' },
    });
    const s = rules.deserialize(terminalJson);
    const result = rules.applyMove(s, { data: { boardIndex: 3, cellIndex: 0 } }, 'O');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/game.*over/i);
  });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('applyMove does not mutate the original state', () => {
    const s = fresh();
    const originalPlayer = s.currentPlayer;
    const originalCount = s.moveCount;
    play(s, 4, 4);
    expect(s.currentPlayer).toBe(originalPlayer);
    expect(s.moveCount).toBe(originalCount);
  });
});

// ─── Serialize / Deserialize ──────────────────────────────────────────────────

describe('serialize / deserialize', () => {
  it('round-trips initial state', () => {
    const s = fresh();
    const restored = rules.deserialize(rules.serialize(s)) as UltimateTTTState;
    expect(restored.currentPlayer).toBe(s.currentPlayer);
    expect(restored.moveCount).toBe(s.moveCount);
    expect(restored.nextBoardConstraint).toBe(s.nextBoardConstraint);
  });

  it('round-trips mid-game state with constraint', () => {
    let s = fresh();
    s = play(s, 2, 7); // X plays board 2 cell 7 → O must play board 7
    s = play(s, 7, 3); // O plays board 7 cell 3 → X must play board 3
    const json = rules.serialize(s);
    const restored = rules.deserialize(json) as UltimateTTTState;
    expect(restored.nextBoardConstraint).toBe(3);
    expect(restored.currentPlayer).toBe('X');
    expect(restored.moveCount).toBe(2);
  });
});
```

- [ ] **Step 6.2: Run tests — expect failures on UltimateTTT**

Run: `pnpm test`
Expected: FAIL — `applyMove`, `getLegalMoves` throw "Not implemented"

- [ ] **Step 6.3: Commit the tests**

```bash
git add packages/game-engine/tests/ultimate-ttt.test.ts
git commit -m "test(game-engine): add complete UltimateTTT test suite (red)"
```

---

## Task 7: Ultimate TTT Rules Engine — Full Implementation

**Files:**
- Modify: `packages/game-engine/src/rules/ultimate-ttt.ts`

- [ ] **Step 7.1: Implement `applyMove` and `getLegalMoves`**

Replace the stub `applyMove` and `getLegalMoves` methods in `ultimate-ttt.ts` with the full implementation. Replace the entire file content:

```typescript
import type { GameRules, Player } from './interface.js';
import type { Board, BoardResult, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UltimateTTTMove {
  boardIndex: number;
  cellIndex: number;
}

export interface UltimateTTTState extends GameState {
  variantId: 'ultimate_ttt';
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  nextBoardConstraint: number | null;
  terminal: TerminalResult | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

function castState(state: GameState): UltimateTTTState {
  if (state.variantId !== 'ultimate_ttt') {
    throw new Error(`UltimateTTT received wrong variantId: ${state.variantId}`);
  }
  return state as UltimateTTTState;
}

function computeBoardResult(board: Board): BoardResult {
  const winner = checkBoardWinner(board);
  if (winner !== null) return winner;
  if (isBoardFull(board)) return 'draw';
  return null;
}

/**
 * Check whether the meta-board (based on boardResults) has a winner or is fully drawn.
 * Computes on-the-fly — does not rely on a cached terminal field,
 * making deserialize + checkTerminal safe even if the stored terminal was null.
 */
function computeMetaTerminal(boardResults: UltimateTTTState['boardResults']): TerminalResult | null {
  const metaCells = boardResults.map((r) =>
    r === 'X' || r === 'O' ? r : null
  ) as Board;
  const winner = checkBoardWinner(metaCells);
  if (winner !== null) return { winner, reason: 'win' };
  if (boardResults.every((r) => r !== null)) return { winner: null, reason: 'draw' };
  return null;
}

/**
 * Returns true if a board index is a valid target for the current player.
 * A board is valid if its result is null (still in play).
 */
function isBoardOpen(boardResults: UltimateTTTState['boardResults'], boardIndex: number): boolean {
  return boardResults[boardIndex] === null;
}

// ─── UltimateTTT ─────────────────────────────────────────────────────────────

export class UltimateTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      boards: [
        emptyBoard(), emptyBoard(), emptyBoard(),
        emptyBoard(), emptyBoard(), emptyBoard(),
        emptyBoard(), emptyBoard(), emptyBoard(),
      ],
      boardResults: [null, null, null, null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: null,
    };
    return state;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    // Guard: game already over
    if (s.terminal !== null) {
      return { ok: false, error: 'Game is over', state };
    }

    // Guard: wrong player
    if (playerId !== s.currentPlayer) {
      return { ok: false, error: 'Not your turn', state };
    }

    const { boardIndex, cellIndex } = move.data as UltimateTTTMove;

    // Guard: out-of-bounds
    if (typeof boardIndex !== 'number' || boardIndex < 0 || boardIndex > 8) {
      return { ok: false, error: 'boardIndex must be 0–8', state };
    }
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'cellIndex must be 0–8', state };
    }

    // Guard: board constraint
    // If constrained AND the constrained board is still open, must play there.
    const constraint = s.nextBoardConstraint;
    if (constraint !== null && isBoardOpen(s.boardResults, constraint)) {
      if (boardIndex !== constraint) {
        return { ok: false, error: `Wrong board: must play in board ${constraint}`, state };
      }
    }
    // If constraint points to a closed board, any open board is valid.

    // Guard: target board already settled
    if (!isBoardOpen(s.boardResults, boardIndex)) {
      return { ok: false, error: 'That mini-board is already finished', state };
    }

    // Guard: cell occupied
    const targetBoard = s.boards[boardIndex]!;
    if (targetBoard[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    // ── Apply the move ──

    // Deep-copy boards array (only clone the modified board)
    const newBoards = s.boards.map((b, i) =>
      i === boardIndex ? ([...b] as Board) : b
    ) as UltimateTTTState['boards'];
    newBoards[boardIndex]![cellIndex] = s.currentPlayer;

    // Recompute boardResults
    const newBoardResults = s.boardResults.map((r, i) =>
      i === boardIndex ? computeBoardResult(newBoards[boardIndex]!) : r
    ) as UltimateTTTState['boardResults'];

    // Determine next board constraint
    // The next constraint is the cellIndex just played.
    // If that board is closed (won/draw), next player gets free choice (null).
    const nextConstraint = isBoardOpen(newBoardResults, cellIndex) ? cellIndex : null;

    // Check meta-terminal
    const terminal = computeMetaTerminal(newBoardResults);

    const newState: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      boards: newBoards,
      boardResults: newBoardResults,
      nextBoardConstraint: terminal !== null ? null : nextConstraint,
      terminal,
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];

    const constraint = s.nextBoardConstraint;
    const moves: Move[] = [];

    // Determine which boards are valid targets
    const validBoards =
      constraint !== null && isBoardOpen(s.boardResults, constraint)
        ? [constraint] // constrained and board is open
        : s.boardResults
            .map((r, i) => (r === null ? i : -1))
            .filter((i) => i !== -1); // any open board

    for (const bi of validBoards) {
      const board = s.boards[bi]!;
      for (let ci = 0; ci < 9; ci++) {
        if (board[ci] === null) {
          moves.push({ data: { boardIndex: bi, cellIndex: ci } });
        }
      }
    }

    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    const s = castState(state);
    // Design note: `terminal` is also cached in UltimateTTTState and stored in serialized state,
    // but we always recompute here from `boardResults` for two reasons:
    // 1. Safety: a deserialized state may have `terminal: null` injected (e.g., in tests) even
    //    if boardResults already show a winner — recomputing ensures correctness.
    // 2. The cached field is used by the game server to avoid calling checkTerminal in hot paths.
    //    The two must agree; they will always agree because both derive from boardResults.
    return computeMetaTerminal(s.boardResults);
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as UltimateTTTState;
  }
}
```

- [ ] **Step 7.2: Run all tests — expect pass**

Run (from repo root): `pnpm test`
Expected: all tests pass — win-checker, standard-ttt, ultimate-ttt

- [ ] **Step 7.3: Run typecheck**

Run (from `packages/game-engine`): `pnpm typecheck`
Expected: no errors

- [ ] **Step 7.4: Commit**

```bash
git add packages/game-engine/src/rules/ultimate-ttt.ts
git commit -m "feat(game-engine): implement UltimateTTT applyMove and getLegalMoves — all tests green"
```

---

## Task 8: Create game-server App

**Files:**
- Create: `apps/game-server/package.json`
- Create: `apps/game-server/tsconfig.json`
- Create: `apps/game-server/src/types.ts`

- [ ] **Step 8.1: Create `apps/game-server/package.json`**

```json
{
  "name": "game-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@tactictoe/game-engine": "workspace:*",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.19.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0",
    "socket.io-client": "^4.7.5"
  }
}
```

- [ ] **Step 8.2: Create `apps/game-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 8.3: Create `apps/game-server/src/types.ts`**

```typescript
import type { UltimateTTTState } from '@tactictoe/game-engine';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface ConnectedPlayer {
  socketId: string;
  guestId: string;       // UUID: stable within a session, used for reconnection
  displayName: string;   // e.g. "Guest#4271"
  playerIndex: 0 | 1;   // 0 = X, 1 = O
}

export interface RoomState {
  roomCode: string;
  status: RoomStatus;
  players: ConnectedPlayer[];        // max 2
  spectators: string[];              // socket IDs
  gameState: UltimateTTTState | null;
  variantId: string;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;                 // Date.now()
}

// ─── Socket.io event payloads (client → server) ───────────────────────────────

export interface CreateRoomPayload {
  guestId: string;
  displayName: string;
  variantId: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  guestId: string;
  displayName: string;
}

export interface MakeMovePayload {
  roomCode: string;
  boardIndex: number;
  cellIndex: number;
}

// ─── Socket.io event payloads (server → client) ───────────────────────────────

export interface RoomCreatedPayload {
  roomCode: string;
  playerIndex: 0 | 1;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerIndex: 0 | 1;
  players: { displayName: string; playerIndex: 0 | 1 }[];
}

export interface GameStartedPayload {
  gameState: UltimateTTTState;
  players: { displayName: string; playerIndex: 0 | 1 }[];
}

export interface GameStateUpdatePayload {
  gameState: UltimateTTTState;
  lastMove: { boardIndex: number; cellIndex: number };
}

export interface GameOverPayload {
  gameState: UltimateTTTState;
  winner: 'X' | 'O' | null;
  reason: 'win' | 'draw' | 'forfeit';
  winnerDisplayName: string | null;
}

export interface ErrorPayload {
  message: string;
}
```

- [ ] **Step 8.4: Create `apps/game-server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 8.5: Install dependencies**

Run (from repo root): `pnpm install`
Expected: game-server dependencies installed, workspace link to `@tactictoe/game-engine` created

- [ ] **Step 8.6: Commit**

```bash
git add apps/game-server/
git commit -m "feat(game-server): add app scaffold with types and vitest config"
```

---

## Task 9: Room Manager

**Files:**
- Create: `apps/game-server/src/room-manager.test.ts`
- Create: `apps/game-server/src/room-manager.ts`

The room manager is a pure in-memory store (no I/O). It creates rooms, assigns players, and cleans up expired rooms. The game server imports it as a singleton.

- [ ] **Step 9.1: Write failing tests for RoomManager**

Create `apps/game-server/src/room-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// We import a factory function (not the singleton) to get a fresh instance per test.
import { createRoomManager } from './room-manager.js';
import type { ConnectedPlayer } from './types.js';

function makePlayer(overrides: Partial<ConnectedPlayer> = {}): ConnectedPlayer {
  return {
    socketId: 'socket-1',
    guestId: 'guest-001',
    displayName: 'Alice',
    playerIndex: 0,
    ...overrides,
  };
}

describe('RoomManager', () => {
  let rm: ReturnType<typeof createRoomManager>;

  beforeEach(() => {
    rm = createRoomManager();
  });

  describe('generateCode', () => {
    it('generates a 6-character code', () => {
      expect(rm.generateCode()).toHaveLength(6);
    });

    it('generates unique codes on repeated calls', () => {
      const codes = new Set(Array.from({ length: 100 }, () => rm.generateCode()));
      expect(codes.size).toBe(100);
    });

    it('code characters are from the allowed set (no 0, O, I, 1, l)', () => {
      const code = rm.generateCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });
  });

  describe('createRoom', () => {
    it('creates a room with the given code and host', () => {
      const host = makePlayer();
      const code = rm.generateCode();
      const room = rm.createRoom(code, host, 'ultimate_ttt');
      expect(room.roomCode).toBe(code);
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toBe(host);
      expect(room.status).toBe('waiting');
      expect(room.variantId).toBe('ultimate_ttt');
    });

    it('stores the room and makes it retrievable by code', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      expect(rm.getRoom(code)).toBeDefined();
    });

    it('increments activeCount', () => {
      expect(rm.activeCount).toBe(0);
      rm.createRoom(rm.generateCode(), makePlayer(), 'ultimate_ttt');
      expect(rm.activeCount).toBe(1);
    });
  });

  describe('getRoom', () => {
    it('returns undefined for unknown code', () => {
      expect(rm.getRoom('XXXXXX')).toBeUndefined();
    });
  });

  describe('removeSocket', () => {
    it('marks a player as disconnected and returns roomCode + wasPlayer=true', () => {
      const code = rm.generateCode();
      const host = makePlayer({ socketId: 'socket-abc' });
      rm.createRoom(code, host, 'ultimate_ttt');

      const result = rm.removeSocket('socket-abc');
      expect(result).not.toBeNull();
      expect(result?.roomCode).toBe(code);
      expect(result?.wasPlayer).toBe(true);

      // socketId should be cleared
      const room = rm.getRoom(code)!;
      expect(room.players[0]!.socketId).toBe('');
    });

    it('returns null for an unknown socketId', () => {
      expect(rm.removeSocket('no-such-socket')).toBeNull();
    });

    it('removes a spectator and returns wasPlayer=false', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      const room = rm.getRoom(code)!;
      rm.addSpectator(room, 'spectator-socket');

      const result = rm.removeSocket('spectator-socket');
      expect(result?.wasPlayer).toBe(false);
      expect(room.spectators).not.toContain('spectator-socket');
    });
  });

  describe('reconnectPlayer', () => {
    it('updates socketId and returns the player', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer({ socketId: '', guestId: 'g-1' }), 'ultimate_ttt');
      const room = rm.getRoom(code)!;

      const player = rm.reconnectPlayer(room, 'g-1', 'new-socket-id');
      expect(player).not.toBeNull();
      expect(player!.socketId).toBe('new-socket-id');
    });

    it('returns null if guestId is not found', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      const room = rm.getRoom(code)!;
      expect(rm.reconnectPlayer(room, 'no-such-guest', 'sock')).toBeNull();
    });
  });

  describe('purgeExpired', () => {
    it('removes waiting rooms older than TTL and returns count', () => {
      const code = rm.generateCode();
      const room = rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      // Manually backdate the room
      (room as { createdAt: number }).createdAt = Date.now() - 31 * 60 * 1000;

      const purged = rm.purgeExpired();
      expect(purged).toBe(1);
      expect(rm.getRoom(code)).toBeUndefined();
    });

    it('does not purge active rooms regardless of age', () => {
      const code = rm.generateCode();
      const room = rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      room.status = 'active';
      (room as { createdAt: number }).createdAt = Date.now() - 31 * 60 * 1000;

      const purged = rm.purgeExpired();
      expect(purged).toBe(0);
      expect(rm.getRoom(code)).toBeDefined();
    });
  });
});
```

- [ ] **Step 9.2: Run tests — expect failure**

Run (from `apps/game-server`): `pnpm test`
Expected: FAIL — `createRoomManager` not exported

- [ ] **Step 9.3: Create `apps/game-server/src/room-manager.ts`**

```typescript
import type { RoomState, ConnectedPlayer } from './types.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1/l
const MAX_ROOMS = 10_000;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory room store.
 * Use `createRoomManager()` in tests (fresh instance per test).
 * Use the `roomManager` singleton in the game server.
 */
class RoomManager {
  private rooms = new Map<string, RoomState>();

  generateCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Failed to generate unique room code after 50 attempts');
  }

  createRoom(code: string, host: ConnectedPlayer, variantId: string): RoomState {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new Error('Room capacity reached');
    }
    const room: RoomState = {
      roomCode: code,
      status: 'waiting',
      players: [host],
      spectators: [],
      gameState: null,
      variantId,
      disconnectTimer: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  addPlayer(room: RoomState, player: ConnectedPlayer): void {
    room.players.push(player);
  }

  addSpectator(room: RoomState, socketId: string): void {
    room.spectators.push(socketId);
  }

  removeSocket(socketId: string): { roomCode: string; wasPlayer: boolean } | null {
    for (const [code, room] of this.rooms) {
      const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
      if (playerIdx !== -1) {
        room.players[playerIdx]!.socketId = ''; // mark as disconnected
        return { roomCode: code, wasPlayer: true };
      }
      const spectatorIdx = room.spectators.indexOf(socketId);
      if (spectatorIdx !== -1) {
        room.spectators.splice(spectatorIdx, 1);
        return { roomCode: code, wasPlayer: false };
      }
    }
    return null;
  }

  reconnectPlayer(room: RoomState, guestId: string, newSocketId: string): ConnectedPlayer | null {
    const player = room.players.find((p) => p.guestId === guestId);
    if (!player) return null;
    player.socketId = newSocketId;
    return player;
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room?.disconnectTimer) clearTimeout(room.disconnectTimer);
    this.rooms.delete(code);
  }

  /** Purge rooms idle for longer than ROOM_IDLE_TTL_MS. Call on an interval. */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [code, room] of this.rooms) {
      if (room.status !== 'active' && now - room.createdAt > ROOM_IDLE_TTL_MS) {
        this.deleteRoom(code);
        count++;
      }
    }
    return count;
  }

  get activeCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();

/** Factory for tests — returns a fresh, isolated RoomManager instance */
export function createRoomManager(): RoomManager {
  return new RoomManager();
}
```

- [ ] **Step 9.4: Run tests — expect pass**

Run (from `apps/game-server`): `pnpm test`
Expected: all RoomManager tests pass

- [ ] **Step 9.5: Commit**

```bash
git add apps/game-server/src/room-manager.ts apps/game-server/src/room-manager.test.ts
git commit -m "feat(game-server): implement in-memory RoomManager with unit tests"
```

---

## Task 10: Game Session Handler

**Files:**
- Create: `apps/game-server/src/game-session.test.ts`
- Create: `apps/game-server/src/game-session.ts`

This module handles the lifecycle of a single game: starting, processing moves, detecting game-over, and handling disconnects.

- [ ] **Step 10.1: Write failing tests for handleDisconnect using fake timers**

Create `apps/game-server/src/game-session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { createRoomManager } from './room-manager.js';
import { handleDisconnect, handleReconnect } from './game-session.js';
import type { RoomState } from './types.js';

// Minimal mock Server and Socket that emit events into a recorder
function createMockIo() {
  const emissions: { room: string; event: string; data: unknown }[] = [];
  const socketEmissions: { socketId: string; event: string; data: unknown }[] = [];

  const io = {
    to(room: string) {
      return {
        emit(event: string, data: unknown) {
          emissions.push({ room, event, data });
        },
      };
    },
    // For direct socket emissions
    sockets: {
      to(socketId: string) {
        return {
          emit(event: string, data: unknown) {
            socketEmissions.push({ socketId, event, data });
          },
        };
      },
    },
  } as unknown as import('socket.io').Server;

  return { io, emissions, socketEmissions };
}

describe('handleDisconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeActiveRoom(rm: ReturnType<typeof createRoomManager>): RoomState {
    const code = rm.generateCode();
    const room = rm.createRoom(code, {
      socketId: 'socket-x',
      guestId: 'guest-x',
      displayName: 'PlayerX',
      playerIndex: 0,
    }, 'ultimate_ttt');
    rm.addPlayer(room, {
      socketId: 'socket-o',
      guestId: 'guest-o',
      displayName: 'PlayerO',
      playerIndex: 1,
    });
    room.status = 'active';
    // Set a minimal game state (non-null so forfeit payload works)
    room.gameState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 5,
      boards: Array(9).fill(Array(9).fill(null)),
      boardResults: Array(9).fill(null),
      nextBoardConstraint: null,
      terminal: null,
    } as unknown as import('@tactictoe/game-engine').UltimateTTTState;
    return room;
  }

  it('emits player:disconnected immediately on disconnect', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    // Mark player X as disconnected
    rm.removeSocket('socket-x');

    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    expect(emissions.some((e) => e.event === 'player:disconnected')).toBe(true);
  });

  it('emits game:over with reason forfeit after 60s grace period expires', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x'); // mark X as disconnected (socketId = '')
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Before 60s: no game:over yet
    vi.advanceTimersByTime(59_000);
    expect(emissions.some((e) => e.event === 'game:over')).toBe(false);

    // After 60s: forfeit fires
    vi.advanceTimersByTime(1_001);
    const gameOver = emissions.find((e) => e.event === 'game:over');
    expect(gameOver).toBeDefined();
    expect((gameOver!.data as { reason: string }).reason).toBe('forfeit');
    expect((gameOver!.data as { winner: string }).winner).toBe('O'); // O wins because X forfeited
    expect(room.status).toBe('finished');
  });

  it('cancels the forfeit timer when the player reconnects before 60s', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Player reconnects at 30s
    vi.advanceTimersByTime(30_000);
    rm.reconnectPlayer(room, 'guest-x', 'new-socket-x');
    handleReconnect(io, room, 'new-socket-x');

    // Timer should be cancelled — no game:over after full 60s
    vi.advanceTimersByTime(31_000);
    expect(emissions.some((e) => e.event === 'game:over')).toBe(false);
    expect(room.status).toBe('active');
  });

  it('does not fire forfeit if game was finished before timer expires', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Game ends by other means before timer fires
    room.status = 'finished';

    vi.advanceTimersByTime(61_000);
    // game:over should NOT be emitted by the disconnect timer
    const forfeitEvents = emissions.filter(
      (e) => e.event === 'game:over' && (e.data as { reason: string }).reason === 'forfeit'
    );
    expect(forfeitEvents).toHaveLength(0);
  });
});
```

> **Note:** The `handleDisconnect` signature will need to accept `rm` (the room manager) as a parameter to allow injection in tests. Update `game-session.ts` accordingly — see Step 10.2.

- [ ] **Step 10.2: Run tests — expect failure**

Run (from `apps/game-server`): `pnpm test`
Expected: FAIL — `handleDisconnect` / `handleReconnect` not exported yet

- [ ] **Step 10.3: Create `apps/game-server/src/game-session.ts`**

```typescript
import type { Server, Socket } from 'socket.io';
import { UltimateTTT, type UltimateTTTState } from '@tactictoe/game-engine';
import { roomManager as defaultRoomManager, type createRoomManager } from './room-manager.js';

// Allow injecting a room manager for tests
type RoomManagerInstance = ReturnType<typeof createRoomManager>;
import type {
  RoomState,
  MakeMovePayload,
  GameStartedPayload,
  GameStateUpdatePayload,
  GameOverPayload,
} from './types.js';

const DISCONNECT_GRACE_MS = 60_000; // 60 seconds

const engines: Record<string, UltimateTTT> = {
  ultimate_ttt: new UltimateTTT(),
};

function getEngine(variantId: string): UltimateTTT {
  const engine = engines[variantId];
  if (!engine) throw new Error(`Unknown variant: ${variantId}`);
  return engine;
}

/** Called when two players are in the room and the game should begin. */
export function startGame(io: Server, room: RoomState): void {
  const engine = getEngine(room.variantId);
  room.gameState = engine.initialize({ variantId: room.variantId }) as UltimateTTTState;
  room.status = 'active';

  const payload: GameStartedPayload = {
    gameState: room.gameState,
    players: room.players.map((p) => ({
      displayName: p.displayName,
      playerIndex: p.playerIndex,
    })),
  };

  io.to(room.roomCode).emit('game:started', payload);
}

/** Called when a player sends a move. Validates, applies, and broadcasts.
 *  Pass `rm` to override the room manager (for tests). */
export function handleMove(
  io: Server,
  socket: Socket,
  payload: MakeMovePayload,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(payload.roomCode);
  if (!room || room.status !== 'active' || !room.gameState) {
    socket.emit('error', { message: 'No active game in this room' });
    return;
  }

  // Find which player this socket is
  const player = room.players.find((p) => p.socketId === socket.id);
  if (!player) {
    socket.emit('error', { message: 'You are not a player in this room' });
    return;
  }

  const gameState = room.gameState;
  const expectedSymbol = gameState.currentPlayer; // 'X' or 'O'
  const playerSymbol = player.playerIndex === 0 ? 'X' : 'O';

  if (playerSymbol !== expectedSymbol) {
    socket.emit('error', { message: 'Not your turn' });
    return;
  }

  const engine = getEngine(room.variantId);
  const result = engine.applyMove(
    gameState,
    { data: { boardIndex: payload.boardIndex, cellIndex: payload.cellIndex } },
    playerSymbol
  );

  if (!result.ok) {
    socket.emit('error', { message: result.error ?? 'Illegal move' });
    return;
  }

  room.gameState = result.state as UltimateTTTState;
  const terminal = engine.checkTerminal(room.gameState);

  if (terminal !== null) {
    room.status = 'finished';
    const winnerPlayer =
      terminal.winner !== null
        ? room.players.find((p) => (p.playerIndex === 0 ? 'X' : 'O') === terminal.winner)
        : null;

    const gameOverPayload: GameOverPayload = {
      gameState: room.gameState,
      winner: terminal.winner,
      reason: terminal.reason,
      winnerDisplayName: winnerPlayer?.displayName ?? null,
    };
    io.to(room.roomCode).emit('game:over', gameOverPayload);
  } else {
    const updatePayload: GameStateUpdatePayload = {
      gameState: room.gameState,
      lastMove: { boardIndex: payload.boardIndex, cellIndex: payload.cellIndex },
    };
    io.to(room.roomCode).emit('game:state', updatePayload);
  }
}

/** Called when a player's socket disconnects. Starts the grace-period timer.
 *  Pass `rm` to override the room manager (for tests). */
export function handleDisconnect(
  io: Server,
  roomCode: string,
  disconnectedGuestId: string,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room || room.status !== 'active') return;

  // Notify the room
  io.to(roomCode).emit('player:disconnected', { guestId: disconnectedGuestId });

  // Start the grace-period timer
  room.disconnectTimer = setTimeout(() => {
    // Check if the room still exists and the player is still disconnected
    const current = rm.getRoom(roomCode);
    if (!current || current.status !== 'active') return;

    const stillDisconnected = current.players.find(
      (p) => p.guestId === disconnectedGuestId && p.socketId === ''
    );

    if (stillDisconnected) {
      // Forfeit: the other player wins
      current.status = 'finished';
      const winner = current.players.find((p) => p.guestId !== disconnectedGuestId);
      const winnerSymbol: 'X' | 'O' | null = winner
        ? winner.playerIndex === 0
          ? 'X'
          : 'O'
        : null;

      const payload: GameOverPayload = {
        gameState: current.gameState!,
        winner: winnerSymbol,
        reason: 'forfeit',
        winnerDisplayName: winner?.displayName ?? null,
      };
      io.to(roomCode).emit('game:over', payload);
    }
  }, DISCONNECT_GRACE_MS);
}

/** Called when a disconnected player reconnects. Cancels the grace-period timer. */
export function handleReconnect(io: Server, room: RoomState, newSocketId: string): void {
  if (room.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
    room.disconnectTimer = null;
  }

  // Send them the current game state
  io.to(newSocketId).emit('game:reconnect', {
    gameState: room.gameState,
    players: room.players.map((p) => ({
      displayName: p.displayName,
      playerIndex: p.playerIndex,
    })),
  });

  io.to(room.roomCode).emit('player:reconnected', { socketId: newSocketId });
}
```

- [ ] **Step 10.2: Commit**

- [ ] **Step 10.4: Run tests — expect pass**

Run (from `apps/game-server`): `pnpm test`
Expected: all RoomManager + game-session tests pass

- [ ] **Step 10.5: Commit**

```bash
git add apps/game-server/src/game-session.ts apps/game-server/src/game-session.test.ts
git commit -m "feat(game-server): implement game session handler with move, disconnect, reconnect, and forfeit timer tests"
```

---

## Task 11: Main Server Entry Point

**Files:**
- Create: `apps/game-server/src/index.ts`

- [ ] **Step 11.1: Create `apps/game-server/src/index.ts`**

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { roomManager } from './room-manager.js';
import { startGame, handleMove, handleDisconnect, handleReconnect } from './game-session.js';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  MakeMovePayload,
  ConnectedPlayer,
} from './types.js';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:3000';

// ─── HTTP + Socket.io setup ───────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  // Basic health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: roomManager.activeCount }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateDisplayName(): string {
  return `Guest#${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─── Socket.io event handlers ─────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create room ──────────────────────────────────────────────────────────────
  socket.on('room:create', (payload: CreateRoomPayload) => {
    try {
      const code = roomManager.generateCode();
      const host: ConnectedPlayer = {
        socketId: socket.id,
        guestId: payload.guestId,
        displayName: payload.displayName || generateDisplayName(),
        playerIndex: 0, // host is always X
      };
      const room = roomManager.createRoom(code, host, payload.variantId ?? 'ultimate_ttt');
      socket.join(code);
      socket.emit('room:created', { roomCode: code, playerIndex: 0 });
      console.log(`[room:create] code=${code} host=${host.displayName}`);
    } catch (err) {
      socket.emit('error', { message: (err as Error).message });
    }
  });

  // ── Join room ────────────────────────────────────────────────────────────────
  socket.on('room:join', (payload: JoinRoomPayload) => {
    const room = roomManager.getRoom(payload.roomCode);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if this is a reconnection (guestId matches a disconnected player)
    const reconnectingPlayer = room.players.find(
      (p) => p.guestId === payload.guestId && p.socketId === ''
    );

    if (reconnectingPlayer) {
      roomManager.reconnectPlayer(room, payload.guestId, socket.id);
      socket.join(payload.roomCode);
      handleReconnect(io, room, socket.id);
      console.log(`[room:reconnect] code=${payload.roomCode} guest=${payload.guestId}`);
      return;
    }

    // New player joining
    if (room.players.length >= 2) {
      // Join as spectator
      roomManager.addSpectator(room, socket.id);
      socket.join(payload.roomCode);
      socket.emit('room:spectating', { roomCode: payload.roomCode });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    const joiner: ConnectedPlayer = {
      socketId: socket.id,
      guestId: payload.guestId,
      displayName: payload.displayName || generateDisplayName(),
      playerIndex: 1, // second player is O
    };

    roomManager.addPlayer(room, joiner);
    socket.join(payload.roomCode);

    const joinedPayload = {
      roomCode: payload.roomCode,
      playerIndex: 1,
      players: room.players.map((p) => ({ displayName: p.displayName, playerIndex: p.playerIndex })),
    };
    socket.emit('room:joined', joinedPayload);

    // Both players present — start the game
    if (room.players.length === 2) {
      startGame(io, room);
    }

    console.log(`[room:join] code=${payload.roomCode} joiner=${joiner.displayName}`);
  });

  // ── Make move ────────────────────────────────────────────────────────────────
  socket.on('game:move', (payload: MakeMovePayload) => {
    handleMove(io, socket, payload);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const result = roomManager.removeSocket(socket.id);
    if (result?.wasPlayer) {
      const room = roomManager.getRoom(result.roomCode);
      if (room) {
        const disconnectedPlayer = room.players.find((p) => p.socketId === '');
        if (disconnectedPlayer) {
          handleDisconnect(io, result.roomCode, disconnectedPlayer.guestId);
        }
      }
    }
  });
});

// ─── Cleanup expired rooms every 5 minutes ───────────────────────────────────

setInterval(() => {
  const purged = roomManager.purgeExpired();
  if (purged > 0) console.log(`[cleanup] purged ${purged} expired rooms`);
}, 5 * 60 * 1000);

// ─── Start listening ──────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
  console.log(`CORS origin: ${CLIENT_URL}`);
});
```

- [ ] **Step 11.2: Commit**

```bash
git add apps/game-server/src/index.ts
git commit -m "feat(game-server): implement Socket.io event handlers for room creation, join, move, disconnect"
```

---

## Task 12: Integration Test — Two Clients Play a Complete Game

**Files:**
- Create: `apps/game-server/src/integration.test.ts`

This test starts the game server in-process and plays a complete game using two programmatic Socket.io clients.

- [ ] **Step 12.1: Write the integration test**

Create `apps/game-server/src/integration.test.ts`:

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRoomManager } from './room-manager.js';
import { startGame, handleMove, handleDisconnect } from './game-session.js';
import type { CreateRoomPayload, JoinRoomPayload, MakeMovePayload, RoomState } from './types.js';
import type { UltimateTTTState } from '@tactictoe/game-engine';

// ─── Test server factory ──────────────────────────────────────────────────────
// Uses a fresh room manager per test suite to avoid cross-test contamination.

let io: Server;
let port: number;
// Shared room manager for the test server — allows state injection between tests
const testRm = createRoomManager();

async function createTestServer(): Promise<number> {
  const httpServer = createServer();
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('room:create', (payload: CreateRoomPayload) => {
      const code = testRm.generateCode();
      const room = testRm.createRoom(code, {
        socketId: socket.id,
        guestId: payload.guestId,
        displayName: payload.displayName,
        playerIndex: 0,
      }, payload.variantId);
      socket.join(code);
      socket.emit('room:created', { roomCode: code, playerIndex: 0 });
    });

    socket.on('room:join', (payload: JoinRoomPayload) => {
      const room = testRm.getRoom(payload.roomCode);
      if (!room) { socket.emit('error', { message: 'Not found' }); return; }
      if (room.players.length >= 2) { socket.emit('error', { message: 'Full' }); return; }
      room.players.push({ socketId: socket.id, guestId: payload.guestId, displayName: payload.displayName, playerIndex: 1 });
      socket.join(payload.roomCode);
      socket.emit('room:joined', { roomCode: payload.roomCode, playerIndex: 1, players: room.players });
      if (room.players.length === 2) startGame(io, room);
    });

    socket.on('game:move', (payload: MakeMovePayload) => {
      handleMove(io, socket, payload, testRm);
    });

    socket.on('disconnect', () => {
      const result = testRm.removeSocket(socket.id);
      if (result?.wasPlayer) {
        const room = testRm.getRoom(result.roomCode);
        const p = room?.players.find((p) => p.socketId === '');
        if (room && p) handleDisconnect(io, result.roomCode, p.guestId, testRm);
      }
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      resolve((httpServer.address() as { port: number }).port);
    });
  });
}

function createClient(port: number): ClientSocket {
  return ioc(`http://localhost:${port}`, { autoConnect: false });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), 5000);
    socket.once(event, (data: T) => { clearTimeout(timeout); resolve(data); });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('game server integration', () => {
  let client1: ClientSocket;
  let client2: ClientSocket;

  beforeAll(async () => {
    port = await createTestServer();
  });

  afterAll(() => {
    io.close();
    client1?.disconnect();
    client2?.disconnect();
  });

  it('two clients create a room, join, and start a game', async () => {
    // Tests: room creation, join flow, game:started event, and basic move acceptance.
    client1 = createClient(port);
    client2 = createClient(port);
    client1.connect();
    client2.connect();

    // Client 1 creates a room
    const roomCreated = waitFor<{ roomCode: string }>(client1, 'room:created');
    client1.emit('room:create', { guestId: 'guest-001', displayName: 'Alice', variantId: 'ultimate_ttt' } satisfies CreateRoomPayload);
    const { roomCode } = await roomCreated;
    expect(roomCode).toHaveLength(6);

    // Client 2 joins — both should receive game:started
    const started1 = waitFor<{ gameState: UltimateTTTState }>(client1, 'game:started');
    const started2 = waitFor<{ gameState: UltimateTTTState }>(client2, 'game:started');
    client2.emit('room:join', { roomCode, guestId: 'guest-002', displayName: 'Bob' } satisfies JoinRoomPayload);
    const [s1] = await Promise.all([started1, started2]);
    expect(s1.gameState.currentPlayer).toBe('X');
    expect(s1.gameState.moveCount).toBe(0);

    // X makes one move — both should receive game:state
    const state1 = waitFor<{ lastMove: { boardIndex: number; cellIndex: number } }>(client1, 'game:state');
    const state2 = waitFor<{ lastMove: { boardIndex: number; cellIndex: number } }>(client2, 'game:state');
    client1.emit('game:move', { roomCode, boardIndex: 4, cellIndex: 4 } satisfies MakeMovePayload);
    const [ms1] = await Promise.all([state1, state2]);
    expect(ms1.lastMove).toEqual({ boardIndex: 4, cellIndex: 4 });

    client1.disconnect();
    client2.disconnect();
  });

  it('two clients play a complete game to a win using state injection', async () => {
    // State injection approach: inject a near-terminal game state into the room,
    // then play one final move to trigger game:over. Avoids navigating 40+ moves
    // through the constraint system in an integration test.
    //
    // Near-terminal state: X has won boards 0 and 1 (top-left and top-center).
    // X just needs to win board 2 (top-right) to win the meta-board top row.
    // Board 2 state: X has cells 0 and 1 (needs cell 2 for top-row win).
    // nextBoardConstraint = 2, currentPlayer = 'X', moveCount = 30.

    const c1 = createClient(port);
    const c2 = createClient(port);
    c1.connect();
    c2.connect();

    const { roomCode } = await new Promise<{ roomCode: string }>((resolve) => {
      c1.once('room:created', resolve);
      c1.emit('room:create', { guestId: 'g-win-1', displayName: 'Alice', variantId: 'ultimate_ttt' });
    });

    await new Promise<void>((resolve) => {
      Promise.all([waitFor(c1, 'game:started'), waitFor(c2, 'game:started')]).then(() => resolve());
      c2.emit('room:join', { roomCode, guestId: 'g-win-2', displayName: 'Bob' });
    });

    // Inject near-terminal state directly into the room
    const room = testRm.getRoom(roomCode)!;
    const nearTerminalState: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 30,
      boards: [
        // Board 0: won by X (top row: 0,1,2)
        ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        // Board 1: won by X (top row: 0,1,2)
        ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        // Board 2: X has cells 0 and 1, cell 2 is empty — X wins if they play cell 2
        ['X', 'X', null, 'O', 'O', null, null, null, null],
        // Boards 3-8: partially filled but no winners
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ] as UltimateTTTState['boards'],
      boardResults: ['X', 'X', null, null, null, null, null, null, null],
      nextBoardConstraint: 2, // X must play in board 2
      terminal: null,
    };
    room.gameState = nearTerminalState;

    // Listen for game:over on both clients
    const gameOver1 = waitFor<{ winner: string | null; reason: string; winnerDisplayName: string }>(c1, 'game:over');
    const gameOver2 = waitFor<{ winner: string | null; reason: string }>(c2, 'game:over');

    // X plays board 2, cell 2 — wins board 2, completing the top meta-row → game over
    c1.emit('game:move', { roomCode, boardIndex: 2, cellIndex: 2 } satisfies MakeMovePayload);

    const [result] = await Promise.all([gameOver1, gameOver2]);
    expect(result.winner).toBe('X');
    expect(result.reason).toBe('win');
    expect(result.winnerDisplayName).toBe('Alice');
    expect(testRm.getRoom(roomCode)!.status).toBe('finished');

    c1.disconnect();
    c2.disconnect();
  });

  it('rejects an illegal move', async () => {
    const c1 = createClient(port);
    const c2 = createClient(port);
    c1.connect();
    c2.connect();

    const { roomCode } = await new Promise<{ roomCode: string }>((resolve) => {
      c1.emit('room:create', { guestId: 'g-a', displayName: 'Alice', variantId: 'ultimate_ttt' });
      c1.once('room:created', resolve);
    });

    await new Promise<void>((resolve) => {
      const p1 = waitFor(c1, 'game:started');
      const p2 = waitFor(c2, 'game:started');
      c2.emit('room:join', { roomCode, guestId: 'g-b', displayName: 'Bob' });
      Promise.all([p1, p2]).then(() => resolve());
    });

    // X plays board 0 cell 0 → O must play board 0
    c1.emit('game:move', { roomCode, boardIndex: 0, cellIndex: 0 });
    await waitFor(c2, 'game:state');

    // O tries to play in board 3 (wrong board — must play board 0) → should get error
    const errorPromise = waitFor<{ message: string }>(c2, 'error');
    c2.emit('game:move', { roomCode, boardIndex: 3, cellIndex: 0 });
    const err = await errorPromise;
    expect(err.message).toMatch(/wrong board/i);

    c1.disconnect();
    c2.disconnect();
  });
});
```

- [ ] **Step 12.2: Run integration tests**

Run (from `apps/game-server`): `pnpm test`
Expected: 4 tests pass (room-manager + game-session unit tests + 3 integration tests)

- [ ] **Step 12.3: Run all tests from root**

Run (from repo root): `pnpm test`
Expected: all game-engine and game-server tests pass

- [ ] **Step 12.4: Commit**

```bash
git add apps/game-server/src/integration.test.ts
git commit -m "test(game-server): add integration test — two clients play a complete game"
```

---

## Task 13: Manual Smoke Test

Before calling this plan complete, run a manual smoke test to verify the server actually works in a browser.

- [ ] **Step 13.1: Start the game server in dev mode**

Run: `pnpm dev:server`
Expected output:
```
Game server listening on port 4000
CORS origin: http://localhost:3000
```

- [ ] **Step 13.2: Open browser console and test via Socket.io CDN**

Open any tab and paste this in the browser console:
```javascript
// Load socket.io client from CDN
const s = document.createElement('script');
s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
document.head.appendChild(s);

// Wait for it to load, then run:
const client1 = io('http://localhost:4000');
const client2 = io('http://localhost:4000');

client1.on('room:created', ({ roomCode }) => {
  console.log('Room created:', roomCode);
  client2.emit('room:join', { roomCode, guestId: 'g2', displayName: 'Bob' });
});

client1.on('game:started', (data) => console.log('Game started for P1:', data));
client2.on('game:started', (data) => {
  console.log('Game started for P2 — making first move');
  // X plays first
  client1.emit('game:move', { roomCode: /* paste code here */, boardIndex: 4, cellIndex: 4 });
});

client1.on('game:state', (data) => console.log('State update P1:', data.lastMove));
client2.on('game:state', (data) => console.log('State update P2:', data.lastMove));
client1.on('error', (e) => console.error('Error P1:', e));
client2.on('error', (e) => console.error('Error P2:', e));

client1.emit('room:create', { guestId: 'g1', displayName: 'Alice', variantId: 'ultimate_ttt' });
```

Expected: room created, game started for both clients, moves accepted and broadcast

- [ ] **Step 13.3: Commit final state**

```bash
git add .
git status  # verify no unexpected files
git commit -m "chore: plan 1 complete — game engine + game server foundation"
```

---

## Summary

At the end of this plan you have:
- A pnpm monorepo with isolated `game-engine` and `game-server` packages
- A fully-tested Ultimate TTT rules engine (win detection, constraint routing, illegal move rejection, immutability, serialize/deserialize)
- A Socket.io game server handling room creation, join, move broadcast, disconnect grace period, and forfeit
- Integration tests verifying two clients can play
- A manual smoke test confirming the server works in a real browser

**Next plan:** Plan 2 — Database + Auth (Railway PostgreSQL, Prisma schema, NextAuth.js, user model)
