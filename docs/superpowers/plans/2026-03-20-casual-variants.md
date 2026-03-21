# Casual Variants Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Misère TTT, Wild TTT, and Notakto as casual variants playable in Local Game and vs AI modes.

**Architecture:** Three new `GameRules` implementations in `packages/game-engine` (following the exact pattern of `StandardTTT`), three new minimax-based AI functions (using the same pattern as `getStandardAIMove`), then wire everything into the existing Local and vs-AI pages. No game-server changes — these are casual-only variants. Gomoku (needs 15×15 board) and SOS (needs different cell model) are deferred to separate plans.

**Tech Stack:** TypeScript, Vitest (game engine tests), React (Next.js web app), existing `StandardBoard` component reused for all three variants.

---

## Variant Rules Reference

| Variant | variantId | Who plays what | Win condition |
|---|---|---|---|
| Misère TTT | `misere_ttt` | X and O alternate | Completing 3-in-a-row **loses** for the player who did it |
| Wild TTT | `wild_ttt` | Alternate turns, choose X or O each move | First to complete any 3-in-a-row wins |
| Notakto | `notakto` | Both place X; alternate turns | Completing 3 X's in a row **loses** |

---

## File Map

**Create:**
- `packages/game-engine/src/rules/misere-ttt.ts` — MisereTTT rules class
- `packages/game-engine/src/rules/wild-ttt.ts` — WildTTT rules class
- `packages/game-engine/src/rules/notakto-ttt.ts` — NotaktoTTT rules class
- `packages/game-engine/src/ai/simple-minimax.ts` — shared minimax factory (Misère + Notakto reuse this)
- `packages/game-engine/src/ai/misere-ai.ts` — thin wrapper around simple-minimax
- `packages/game-engine/src/ai/notakto-ai.ts` — thin wrapper around simple-minimax
- `packages/game-engine/src/ai/wild-ai.ts` — minimax with alpha-beta pruning for Wild (different move type)
- `packages/game-engine/tests/misere-ttt.test.ts`
- `packages/game-engine/tests/wild-ttt.test.ts`
- `packages/game-engine/tests/notakto-ttt.test.ts`

**Modify:**
- `packages/game-engine/src/ai/index.ts` — export new AI functions
- `packages/game-engine/src/index.ts` — export new rules classes, states, AI functions
- `apps/web/src/hooks/useAI.ts` — add new variant branches + `symbol` to `AIMove`
- `apps/web/src/app/local/page.tsx` — add 3 variants to selector + Wild TTT symbol picker
- `apps/web/src/app/local/page.module.css` — make variantButtons wrap for 5 options
- `apps/web/src/app/vs-ai/page.tsx` — add 3 variants + Wild TTT symbol picker

---

## Task 1: MisereTTT Rules Engine

**Files:**
- Create: `packages/game-engine/src/rules/misere-ttt.ts`
- Test: `packages/game-engine/tests/misere-ttt.test.ts`

- [ ] **Step 1.1: Write the failing tests**

```typescript
// packages/game-engine/tests/misere-ttt.test.ts
import { describe, it, expect } from 'vitest';
import { MisereTTT } from '../src/rules/misere-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new MisereTTT();

function fresh(): GameState {
  return rules.initialize({ variantId: 'misere_ttt' });
}

function play(state: GameState, cellIndex: number): GameState {
  const result = rules.applyMove(state, { data: { cellIndex } }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move rejected: ${result.error}`);
  return result.state;
}

describe('MisereTTT', () => {
  it('starts with X as current player', () => {
    expect(fresh().currentPlayer).toBe('X');
  });

  it('completing a row means that player LOSES — other player wins', () => {
    // X plays 0, 1, 2 (O plays 3, 4 in between)
    let s = fresh();
    s = play(s, 0); s = play(s, 3);
    s = play(s, 1); s = play(s, 4);
    s = play(s, 2); // X completes row → X loses → O wins
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('O');
    expect(result?.reason).toBe('win');
  });

  it('O completing a row means O loses — X wins', () => {
    let s = fresh();
    s = play(s, 8); s = play(s, 3);
    s = play(s, 7); s = play(s, 4);
    s = play(s, 6); s = play(s, 5); // O completes col → O loses → X wins
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('X');
  });

  it('board full with no 3-in-a-row is a draw', () => {
    // Sequence that fills the board without any 3-in-a-row
    // X: 0,2,5,7,6 | O: 1,3,4,8
    // Board: X O X / O O X / X X O — no three-in-a-row exists
    let s = fresh();
    for (const cell of [0, 1, 2, 3, 5, 4, 7, 8, 6]) s = play(s, cell);
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBeNull();
    expect(result?.reason).toBe('draw');
  });

  it('returns no legal moves after game ends', () => {
    let s = fresh();
    s = play(s, 0); s = play(s, 3);
    s = play(s, 1); s = play(s, 4);
    s = play(s, 2);
    expect(rules.getLegalMoves(s)).toHaveLength(0);
  });

  it('rejects a move on an occupied cell', () => {
    let s = fresh();
    s = play(s, 4);
    const result = rules.applyMove(s, { data: { cellIndex: 4 } }, 'O');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/occupied/i);
  });

  it('round-trips state through serialize/deserialize', () => {
    let s = fresh();
    s = play(s, 4);
    const restored = rules.deserialize(rules.serialize(s));
    expect(restored.currentPlayer).toBe(s.currentPlayer);
    expect(restored.moveCount).toBe(s.moveCount);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd packages/game-engine && npx vitest run tests/misere-ttt.test.ts
```
Expected: FAIL — `Cannot find module '../src/rules/misere-ttt.js'`

- [ ] **Step 1.3: Implement MisereTTT**

```typescript
// packages/game-engine/src/rules/misere-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

export interface MisereTTTState extends GameState {
  variantId: 'misere_ttt';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): MisereTTTState {
  if (state.variantId !== 'misere_ttt') {
    throw new Error(`MisereTTT received wrong variantId: ${state.variantId}`);
  }
  return state as MisereTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * In Misère, completing 3-in-a-row means you LOSE.
 * checkBoardWinner returns the symbol of the line — that player loses, the other wins.
 */
function computeTerminal(board: Board): TerminalResult | null {
  const loser = checkBoardWinner(board);
  if (loser !== null) {
    const winner: Player = loser === 'X' ? 'O' : 'X';
    return { winner, reason: 'win' };
  }
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class MisereTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'misere_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as MisereTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newState: MisereTTTState = {
      variantId: 'misere_ttt',
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
      .map((cell, i): Move | null => (cell === null ? { data: { cellIndex: i } } : null))
      .filter((m): m is Move => m !== null);
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as MisereTTTState; }
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd packages/game-engine && npx vitest run tests/misere-ttt.test.ts
```
Expected: PASS — all 7 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add packages/game-engine/src/rules/misere-ttt.ts packages/game-engine/tests/misere-ttt.test.ts
git commit -m "feat(game-engine): add MisereTTT rules (completing a row loses)"
```

---

## Task 2: NotaktoTTT Rules Engine

**Files:**
- Create: `packages/game-engine/src/rules/notakto-ttt.ts`
- Test: `packages/game-engine/tests/notakto-ttt.test.ts`

- [ ] **Step 2.1: Write the failing tests**

```typescript
// packages/game-engine/tests/notakto-ttt.test.ts
import { describe, it, expect } from 'vitest';
import { NotaktoTTT } from '../src/rules/notakto-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new NotaktoTTT();

function fresh(): GameState {
  return rules.initialize({ variantId: 'notakto' });
}

function play(state: GameState, cellIndex: number): GameState {
  const result = rules.applyMove(state, { data: { cellIndex } }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move rejected: ${result.error}`);
  return result.state;
}

describe('NotaktoTTT', () => {
  it('starts with X as current player', () => {
    expect(fresh().currentPlayer).toBe('X');
  });

  it('both players place X (board only contains X)', () => {
    let s = fresh();
    s = play(s, 0); // "player X" places X
    s = play(s, 1); // "player O" also places X
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const board = (s as any).board;
    expect(board[0]).toBe('X');
    expect(board[1]).toBe('X');
  });

  it('completing 3 X in a row — that player LOSES, other wins', () => {
    // Player X goes 0, Player O goes 3, Player X goes 1, Player O goes 4, Player X goes 2
    // Player X completes top row → Player X loses → Player O wins
    let s = fresh();
    s = play(s, 0); s = play(s, 3);
    s = play(s, 1); s = play(s, 4);
    s = play(s, 2);
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('O'); // X completed the line, so X loses, O wins
    expect(result?.reason).toBe('win');
  });

  it('player O completing a row means O loses — X wins', () => {
    let s = fresh();
    s = play(s, 8); s = play(s, 3); // O at 3
    s = play(s, 7); s = play(s, 4); // O at 4
    s = play(s, 6); s = play(s, 5); // O at 5 → O completes middle row → O loses
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('X');
  });

  it('completing a diagonal means that player loses', () => {
    // Player X places at 0, 4, 8 (main diagonal) — X loses, O wins
    let s = fresh();
    s = play(s, 0); s = play(s, 1);
    s = play(s, 4); s = play(s, 2);
    s = play(s, 8); // X completes 0-4-8 → X loses → O wins
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('O');
    expect(result?.reason).toBe('win');
  });

  it('getLegalMoves decreases by 1 after each move', () => {
    let s = fresh();
    expect(rules.getLegalMoves(s)).toHaveLength(9);
    s = play(s, 0);
    expect(rules.getLegalMoves(s)).toHaveLength(8);
    s = play(s, 1);
    expect(rules.getLegalMoves(s)).toHaveLength(7);
  });

  it('returns no legal moves after terminal', () => {
    let s = fresh();
    s = play(s, 0); s = play(s, 3);
    s = play(s, 1); s = play(s, 4);
    s = play(s, 2);
    expect(rules.getLegalMoves(s)).toHaveLength(0);
  });

  it('rejects wrong player', () => {
    const s = fresh(); // currentPlayer is X
    const result = rules.applyMove(s, { data: { cellIndex: 0 } }, 'O');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
  });
});
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd packages/game-engine && npx vitest run tests/notakto-ttt.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement NotaktoTTT**

```typescript
// packages/game-engine/src/rules/notakto-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner } from './win-checker.js';

export interface NotaktoTTTState extends GameState {
  variantId: 'notakto';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): NotaktoTTTState {
  if (state.variantId !== 'notakto') throw new Error(`NotaktoTTT received wrong variantId: ${state.variantId}`);
  return state as NotaktoTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * Both players place X. Completing 3 X's in a row means you LOSE.
 * lastPlayer is the player who just placed the completing X.
 * Note: a full board of all-X cells always has at least one winning line,
 * so a draw is physically unreachable in single-board Notakto.
 */
function computeTerminal(board: Board, lastPlayer: Player): TerminalResult | null {
  const hasLine = checkBoardWinner(board) !== null; // only X's exist
  if (hasLine) {
    const winner: Player = lastPlayer === 'X' ? 'O' : 'X';
    return { winner, reason: 'win' };
  }
  return null;
}

export class NotaktoTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'notakto',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as NotaktoTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = 'X'; // Always X — both players use the same symbol

    const newState: NotaktoTTTState = {
      variantId: 'notakto',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard, s.currentPlayer),
    };
    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    return s.board
      .map((cell, i): Move | null => (cell === null ? { data: { cellIndex: i } } : null))
      .filter((m): m is Move => m !== null);
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as NotaktoTTTState; }
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
cd packages/game-engine && npx vitest run tests/notakto-ttt.test.ts
```
Expected: PASS — all 7 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add packages/game-engine/src/rules/notakto-ttt.ts packages/game-engine/tests/notakto-ttt.test.ts
git commit -m "feat(game-engine): add NotaktoTTT rules (both play X, line-completer loses)"
```

---

## Task 3: WildTTT Rules Engine

**Files:**
- Create: `packages/game-engine/src/rules/wild-ttt.ts`
- Test: `packages/game-engine/tests/wild-ttt.test.ts`

- [ ] **Step 3.1: Write the failing tests**

```typescript
// packages/game-engine/tests/wild-ttt.test.ts
import { describe, it, expect } from 'vitest';
import { WildTTT } from '../src/rules/wild-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new WildTTT();

function fresh(): GameState {
  return rules.initialize({ variantId: 'wild_ttt' });
}

function play(state: GameState, cellIndex: number, symbol: 'X' | 'O'): GameState {
  const result = rules.applyMove(state, { data: { cellIndex, symbol } }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move rejected: ${result.error}`);
  return result.state;
}

describe('WildTTT', () => {
  it('starts with X as current player', () => {
    expect(fresh().currentPlayer).toBe('X');
  });

  it('player can place X or O on their turn', () => {
    let s = fresh();
    s = play(s, 0, 'O'); // X chooses to place O at 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((s as any).board[0]).toBe('O');
    expect(s.currentPlayer).toBe('O'); // turn switches
  });

  it('getLegalMoves returns 2 moves per empty cell', () => {
    expect(rules.getLegalMoves(fresh())).toHaveLength(18); // 9 cells × 2 symbols
  });

  it('completing any 3-in-a-row of same symbol wins for the mover', () => {
    // X places X's to complete top row — X wins
    let s = fresh();
    s = play(s, 3, 'O'); // O turn: place O at 3
    s = play(s, 0, 'X'); // ... wait, we need to track whose turn
    // Fresh game: X goes first
    s = fresh();
    s = play(s, 0, 'X'); // X places X at 0 (turn: O)
    s = play(s, 3, 'O'); // O places O at 3 (turn: X)
    s = play(s, 1, 'X'); // X places X at 1 (turn: O)
    s = play(s, 4, 'O'); // O places O at 4 (turn: X)
    s = play(s, 2, 'X'); // X places X at 2 — completes [X,X,X] row → X wins
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('X');
    expect(result?.reason).toBe('win');
  });

  it('O completing a line wins for O', () => {
    let s = fresh();
    s = play(s, 8, 'X'); // X
    s = play(s, 3, 'O'); // O places O at 3
    s = play(s, 7, 'X'); // X
    s = play(s, 4, 'O'); // O places O at 4
    s = play(s, 6, 'X'); // X
    s = play(s, 5, 'O'); // O completes [O,O,O] at 3,4,5 → O wins
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('O');
  });

  it('rejects an invalid symbol', () => {
    const s = fresh();
    const result = rules.applyMove(s, { data: { cellIndex: 0, symbol: 'Z' } }, 'X');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/symbol/i);
  });

  it('rejects an occupied cell', () => {
    let s = fresh();
    s = play(s, 4, 'X');
    const result = rules.applyMove(s, { data: { cellIndex: 4, symbol: 'O' } }, 'O');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/occupied/i);
  });

  it('board full with no line is a draw', () => {
    // Fill the board with alternating symbols to avoid any 3-in-a-row
    // X: 0(X),2(O),4(X),6(O),8(X) | O: 1(X),3(O),5(X),7(O)
    // Board after: X X O / O X X / O X O — let's check manually... no row/col/diag
    let s = fresh();
    s = play(s, 0, 'X'); s = play(s, 1, 'X');
    s = play(s, 2, 'O'); s = play(s, 3, 'O');
    s = play(s, 4, 'X'); s = play(s, 5, 'X');
    s = play(s, 6, 'O'); s = play(s, 7, 'O');
    // Need one more move and it must not create a line
    // Current board: X X O / O X X / O O _
    // Remaining: cell 8. If X places O: row 6,7,8 = O,O,O → that's a line! X wins.
    // If X places X: diagonal 2,4,6 = O,X,O → no line; col 8? just one. row 6,7,8 = O,O,X → no.
    // Check diag 0,4,8 = X,X,X → that IS a line. X wins.
    // So any placement at 8 results in a win for X (who makes the move).
    // This test needs a different fill sequence. Let me use a known no-line fill.
    // Known draw board: X O X / X O O / O X X (standard draw from win-checker tests)
    // But we need to construct it via Wild TTT moves without hitting a line midway.
    // Sequence that hits no line until board full:
    // cell 1(O), 2(X), 3(X), 4(O), 5(O), 0(X), 6(O), 7(X), 8(X)
    // Board: X O X / X O O / O X X → no row/col/diag 3-of-same
    // Let's verify: rows [X,O,X],[X,O,O],[O,X,X] ✓; cols [X,X,O],[O,O,X],[X,O,X] ✓; diags [X,O,X],[X,O,O] ✓
    s = fresh();
    // X goes: 1(O)
    s = play(s, 1, 'O');
    // O goes: 2(X)
    s = play(s, 2, 'X');
    // X goes: 3(X)
    s = play(s, 3, 'X');
    // O goes: 4(O)
    s = play(s, 4, 'O');
    // X goes: 5(O)
    s = play(s, 5, 'O');
    // O goes: 0(X)
    s = play(s, 0, 'X');
    // X goes: 6(O)
    s = play(s, 6, 'O');
    // O goes: 7(X)
    s = play(s, 7, 'X');
    // X goes: 8(X) → board full, check for line
    // Board: X O X / X O O / O X X — no 3-of-same line exists
    s = play(s, 8, 'X');
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBeNull();
    expect(result?.reason).toBe('draw');
  });
});
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd packages/game-engine && npx vitest run tests/wild-ttt.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement WildTTT**

```typescript
// packages/game-engine/src/rules/wild-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

export interface WildTTTMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export interface WildTTTState extends GameState {
  variantId: 'wild_ttt';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): WildTTTState {
  if (state.variantId !== 'wild_ttt') throw new Error(`WildTTT received wrong variantId: ${state.variantId}`);
  return state as WildTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * In Wild TTT, the player who completes 3-in-a-row wins.
 * lastPlayer is the player who just placed the completing symbol.
 */
function computeTerminal(board: Board, lastPlayer: Player): TerminalResult | null {
  const lineExists = checkBoardWinner(board) !== null;
  if (lineExists) return { winner: lastPlayer, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class WildTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'wild_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as WildTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex, symbol } = move.data as WildTTTMove;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (symbol !== 'X' && symbol !== 'O') {
      return { ok: false, error: 'Symbol must be X or O', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = symbol;

    const newState: WildTTTState = {
      variantId: 'wild_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard, s.currentPlayer),
    };
    return { ok: true, state: newState };
  }

  /** Each empty cell has 2 possible moves (place X or place O). */
  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    s.board.forEach((cell, i) => {
      if (cell === null) {
        moves.push({ data: { cellIndex: i, symbol: 'X' } });
        moves.push({ data: { cellIndex: i, symbol: 'O' } });
      }
    });
    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as WildTTTState; }
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
cd packages/game-engine && npx vitest run tests/wild-ttt.test.ts
```
Expected: PASS.

- [ ] **Step 3.5: Run all engine tests to confirm no regressions**

```bash
cd packages/game-engine && npx vitest run
```
Expected: PASS — all existing tests plus 3 new suites.

- [ ] **Step 3.6: Commit**

```bash
git add packages/game-engine/src/rules/wild-ttt.ts packages/game-engine/tests/wild-ttt.test.ts
git commit -m "feat(game-engine): add WildTTT rules (choose X or O each turn, line-completer wins)"
```

---

## Task 4: AI for New Variants + Engine Exports

**Files:**
- Create: `packages/game-engine/src/ai/simple-minimax.ts` — shared factory (Misère + Notakto reuse it)
- Create: `packages/game-engine/src/ai/misere-ai.ts`
- Create: `packages/game-engine/src/ai/notakto-ai.ts`
- Create: `packages/game-engine/src/ai/wild-ai.ts`
- Modify: `packages/game-engine/src/ai/index.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 4.1: Create simple-minimax.ts — shared factory**

Misère and Notakto both use the same minimax structure (`cellIndex` moves, no alpha-beta needed at 9 cells). Extract it into one factory so neither AI file duplicates the logic.

```typescript
// packages/game-engine/src/ai/simple-minimax.ts
import type { GameRules } from '../rules/interface.js';
import type { GameState, Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

/**
 * Generic minimax for any GameRules variant whose moves carry { cellIndex: number }.
 * Returns a function that picks the best cell index for the AI.
 */
export function createSimpleMinimax(engine: GameRules) {
  function score(state: GameState, depth: number, isMaximizing: boolean, aiPlayer: Player): number {
    const terminal = engine.checkTerminal(state);
    if (terminal) {
      if (terminal.winner === aiPlayer) return 10 - depth;
      if (terminal.winner !== null) return depth - 10;
      return 0;
    }
    const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
    const currentPlayer = isMaximizing ? aiPlayer : opponent;
    const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
    if (isMaximizing) {
      let best = -Infinity;
      for (const cellIndex of legal) {
        const r = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
        if (r.ok) best = Math.max(best, score(r.state, depth + 1, false, aiPlayer));
      }
      return best;
    } else {
      let best = Infinity;
      for (const cellIndex of legal) {
        const r = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
        if (r.ok) best = Math.min(best, score(r.state, depth + 1, true, aiPlayer));
      }
      return best;
    }
  }

  return function getBestMove(state: GameState, aiPlayer: Player, difficulty: AIDifficulty): number {
    const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
    if (legal.length === 0) throw new Error('No legal moves');
    if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;

    let bestScore = -Infinity;
    let bestMove = legal[0]!;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, aiPlayer);
      if (!result.ok) continue;
      const s = score(result.state, 0, false, aiPlayer);
      if (s > bestScore) { bestScore = s; bestMove = cellIndex; }
    }

    if (difficulty === 'medium') {
      return Math.random() < 0.6 ? bestMove : legal[Math.floor(Math.random() * legal.length)]!;
    }
    return bestMove;
  };
}
```

- [ ] **Step 4.2: Create misere-ai.ts and notakto-ai.ts**

Both use `createSimpleMinimax` — the rule inversion is already baked into their respective engines:

```typescript
// packages/game-engine/src/ai/misere-ai.ts
import { MisereTTT } from '../rules/misere-ttt.js';
import type { MisereTTTState } from '../rules/misere-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { createSimpleMinimax } from './simple-minimax.js';

const getBestMove = createSimpleMinimax(new MisereTTT());

export function getMisereAIMove(state: MisereTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  return getBestMove(state, aiPlayer, difficulty);
}
```

```typescript
// packages/game-engine/src/ai/notakto-ai.ts
import { NotaktoTTT } from '../rules/notakto-ttt.js';
import type { NotaktoTTTState } from '../rules/notakto-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { createSimpleMinimax } from './simple-minimax.js';

const getBestMove = createSimpleMinimax(new NotaktoTTT());

export function getNotaktoAIMove(state: NotaktoTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  return getBestMove(state, aiPlayer, difficulty);
}
```

- [ ] **Step 4.3: Create wild-ai.ts** (uses alpha-beta pruning because branching factor is up to 18)

```typescript
// packages/game-engine/src/ai/wild-ai.ts
import { WildTTT } from '../rules/wild-ttt.js';
import type { WildTTTState, WildTTTMove } from '../rules/wild-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new WildTTT();

export interface WildAIMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export function getWildAIMove(state: WildTTTState, aiPlayer: Player, difficulty: AIDifficulty): WildAIMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  if (legal.length === 0) throw new Error('No legal moves');
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;
  const best = minimaxBest(state, aiPlayer);
  if (difficulty === 'medium') return Math.random() < 0.6 ? best : legal[Math.floor(Math.random() * legal.length)]!;
  return best;
}

function minimaxBest(state: WildTTTState, aiPlayer: Player): WildAIMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  let bestScore = -Infinity;
  let bestMove = legal[0]!;
  for (const move of legal) {
    const result = engine.applyMove(state, { data: move }, aiPlayer);
    if (!result.ok) continue;
    const score = minimax(result.state as WildTTTState, 0, false, aiPlayer, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}

function minimax(
  state: WildTTTState,
  depth: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  alpha: number,
  beta: number,
): number {
  const terminal = engine.checkTerminal(state);
  if (terminal) {
    if (terminal.winner === aiPlayer) return 10 - depth;
    if (terminal.winner !== null) return depth - 10;
    return 0;
  }
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const currentPlayer = isMaximizing ? aiPlayer : opponent;
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  if (isMaximizing) {
    let best = -Infinity;
    for (const move of legal) {
      const r = engine.applyMove(state, { data: move }, currentPlayer);
      if (!r.ok) continue;
      best = Math.max(best, minimax(r.state as WildTTTState, depth + 1, false, aiPlayer, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of legal) {
      const r = engine.applyMove(state, { data: move }, currentPlayer);
      if (!r.ok) continue;
      best = Math.min(best, minimax(r.state as WildTTTState, depth + 1, true, aiPlayer, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}
```

- [ ] **Step 4.4: Update `packages/game-engine/src/ai/index.ts`**

```typescript
export { getStandardAIMove } from './standard-ai.js';
export { getUltimateAIMove } from './ultimate-ai.js';
export { getMisereAIMove } from './misere-ai.js';
export { getNotaktoAIMove } from './notakto-ai.js';
export { getWildAIMove } from './wild-ai.js';
export type { AIDifficulty } from './standard-ai.js';
export type { WildAIMove } from './wild-ai.js';
```

- [ ] **Step 4.5: Update `packages/game-engine/src/index.ts`**

Add the following exports to the existing file:

```typescript
export { MisereTTT } from './rules/misere-ttt.js';
export type { MisereTTTState } from './rules/misere-ttt.js';

export { NotaktoTTT } from './rules/notakto-ttt.js';
export type { NotaktoTTTState } from './rules/notakto-ttt.js';

export { WildTTT } from './rules/wild-ttt.js';
export type { WildTTTState, WildTTTMove } from './rules/wild-ttt.js';

export { getMisereAIMove, getNotaktoAIMove, getWildAIMove } from './ai/index.js';
export type { WildAIMove } from './ai/index.js';
```

- [ ] **Step 4.6: Typecheck the package**

```bash
cd packages/game-engine && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4.7: Run all engine tests**

```bash
cd packages/game-engine && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 4.8: Commit**

```bash
git add packages/game-engine/src/ai/ packages/game-engine/src/rules/ packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add AI for Misère, Notakto, Wild TTT variants"
```

---

## Task 5: Update useAI Hook + Wire Local Game Page

**Files:**
- Modify: `apps/web/src/hooks/useAI.ts`
- Modify: `apps/web/src/app/local/page.tsx`
- Modify: `apps/web/src/app/local/page.module.css`

- [ ] **Step 5.1: Update useAI hook**

The `AIMove` interface needs a `symbol` field for Wild TTT. The `variant` parameter type needs expanding.

Replace the full contents of `apps/web/src/hooks/useAI.ts`:

```typescript
'use client';

import { useCallback } from 'react';
import type { AIDifficulty, Player, GameState } from '@tactictoe/game-engine';

export interface AIMove {
  boardIndex: number;
  cellIndex: number;
  symbol?: 'X' | 'O'; // Wild TTT only
}

export type AIVariant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'notakto' | 'wild_ttt';

/**
 * Hook that returns a `getMove` function for AI opponents.
 * Runs synchronously but defers via setTimeout so React can paint
 * the "thinking" state before the AI computation blocks the thread.
 */
export function useAI(variant: AIVariant, difficulty: AIDifficulty) {
  const getMove = useCallback((state: GameState, aiPlayer: Player): Promise<AIMove> => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const {
            getStandardAIMove,
            getUltimateAIMove,
            getMisereAIMove,
            getNotaktoAIMove,
            getWildAIMove,
          } = await import('@tactictoe/game-engine');

          if (variant === 'standard_3x3') {
            const cellIndex = getStandardAIMove(state as Parameters<typeof getStandardAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'ultimate_ttt') {
            const move = getUltimateAIMove(state as Parameters<typeof getUltimateAIMove>[0], aiPlayer, difficulty);
            resolve(move as AIMove);
          } else if (variant === 'misere_ttt') {
            const cellIndex = getMisereAIMove(state as Parameters<typeof getMisereAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'notakto') {
            const cellIndex = getNotaktoAIMove(state as Parameters<typeof getNotaktoAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'wild_ttt') {
            const move = getWildAIMove(state as Parameters<typeof getWildAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: move.cellIndex, symbol: move.symbol });
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, 50);
    });
  }, [variant, difficulty]);

  return { getMove };
}
```

- [ ] **Step 5.2: Update local/page.module.css — make variant buttons wrap**

Find the `.variantButtons` rule and add `flex-wrap: wrap;`:

```css
.variantButtons { display: flex; gap: var(--space-2); flex-wrap: wrap; }
```

Also add a label style for the Wild TTT symbol picker (add at end of file):

```css
.wildPicker {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.wildPickerLabel {
  font-weight: 600;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.wildBtn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 700;
  background: var(--bg-raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.12s;
}

.wildBtn.x { color: var(--mark-x); }
.wildBtn.o { color: var(--mark-o); }
.wildBtn.active { border-color: var(--accent); background: var(--accent-subtle); }
```

- [ ] **Step 5.3: Update local/page.tsx**

Key changes:
1. Extend `Variant` type and `engines` object
2. Add `placingAs` to `LocalState` and reducer
3. Add new variant buttons in setup UI
4. Pass correct move data for each variant in `handleMove`
5. Show Wild TTT symbol picker above the board during gameplay

Replace the top of `apps/web/src/app/local/page.tsx` (imports + type definitions + engines):

```typescript
'use client';

import { useState, useReducer, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT } from '@tactictoe/game-engine';
import type { GameState, TerminalResult } from '@tactictoe/game-engine';
import type { GameRules } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';

type LocalGameState = GameState & { terminal?: TerminalResult | null };
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import styles from './page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'wild_ttt' | 'notakto';

const VARIANT_LABELS: Record<Variant, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère TTT',
  wild_ttt: 'Wild TTT',
  notakto: 'Notakto',
};

const engines: Record<Variant, GameRules> = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
  misere_ttt: new MisereTTT(),
  wild_ttt: new WildTTT(),
  notakto: new NotaktoTTT(),
};
```

Update `LocalState` to add `placingAs`:

```typescript
interface LocalState {
  phase: 'setup' | 'playing' | 'over';
  variant: Variant;
  player1Name: string;
  player2Name: string;
  gameState: LocalGameState | null;
  scores: { x: number; o: number; draws: number };
  moveHistory: string[];
  placingAs: 'X' | 'O'; // Wild TTT: which symbol to place (human choice)
}
```

Update `LocalAction` to include `SET_PLACING_AS`:

```typescript
type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: LocalGameState; coordinate: string }
  | { type: 'GAME_OVER'; gameState: LocalGameState; coordinate: string }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_NAME'; player: 1 | 2; name: string }
  | { type: 'SET_PLACING_AS'; symbol: 'X' | 'O' };
```

Update `reducer` — add `SET_PLACING_AS` case and set `placingAs: 'X'` in initial state:

```typescript
case 'SET_PLACING_AS': return { ...state, placingAs: action.symbol };
```

Update `initialState`:

```typescript
const initialState: LocalState = {
  phase: 'setup',
  variant: 'ultimate_ttt',
  player1Name: 'Player 1',
  player2Name: 'Player 2',
  gameState: null,
  scores: { x: 0, o: 0, draws: 0 },
  moveHistory: [],
  placingAs: 'X',
};
```

Update `handleMove` to build correct move data per variant:

```typescript
const handleMove = (boardIndex: number, cellIndex: number) => {
  if (!state.gameState) return;
  const engine = engines[state.variant];

  let coordinate = '';
  if (state.variant === 'ultimate_ttt') {
    const overallCol = (boardIndex % 3) * 3 + (cellIndex % 3);
    const overallRow = Math.floor(boardIndex / 3) * 3 + Math.floor(cellIndex / 3);
    coordinate = `${String.fromCharCode(97 + overallCol)}${overallRow + 1}`;
  } else {
    coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
  }

  const moveData =
    state.variant === 'ultimate_ttt' ? { boardIndex, cellIndex } :
    state.variant === 'wild_ttt' ? { cellIndex, symbol: state.placingAs } :
    { cellIndex };

  const result = engine.applyMove(state.gameState, { data: moveData }, state.gameState.currentPlayer);
  if (!result.ok) return;
  const terminal = engine.checkTerminal(result.state);
  if (terminal) {
    dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate });
  } else {
    dispatch({ type: 'MOVE', gameState: result.state, coordinate });
  }
};
```

Update the variant selector buttons in the setup JSX (replace the 2-button section):

```tsx
<div className={styles.variantRow}>
  <p className={styles.variantLabel}>Game mode</p>
  <div className={styles.variantButtons}>
    {(['ultimate_ttt', 'standard_3x3', 'misere_ttt', 'wild_ttt', 'notakto'] as Variant[]).map(v => (
      <button
        key={v}
        className={`${styles.variantBtn} ${variant === v ? styles.selected : ''}`}
        onClick={() => dispatch({ type: 'SET_VARIANT', variant: v })}
      >
        {VARIANT_LABELS[v]}
      </button>
    ))}
  </div>
</div>
```

Add Wild TTT symbol picker above the board (inside the `mainBoard` div, before the board render):

```tsx
{variant === 'wild_ttt' && phase === 'playing' && (
  <div className={styles.wildPicker}>
    <span className={styles.wildPickerLabel}>Place as:</span>
    <button
      className={`${styles.wildBtn} ${styles.x} ${state.placingAs === 'X' ? styles.active : ''}`}
      onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: 'X' })}
    >X</button>
    <button
      className={`${styles.wildBtn} ${styles.o} ${state.placingAs === 'O' ? styles.active : ''}`}
      onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: 'O' })}
    >O</button>
  </div>
)}
```

Also update Notakto turn banner: Notakto both play X, so the turn banner showing `gameState.currentPlayer` (X/O) might confuse players — show player names only. This already works since `currentName` is derived from `gameState.currentPlayer`, but the `(X)` / `(O)` suffix is misleading. Update the turn banner for Notakto:

```tsx
{phase === 'playing' && (
  <p className={styles.turnBanner}>
    {currentName}'s turn
    {variant !== 'notakto' && ` (${gameState.currentPlayer})`}
  </p>
)}
```

- [ ] **Step 5.4: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "test.ts"
```
Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/hooks/useAI.ts apps/web/src/app/local/
git commit -m "feat(web): add Misère, Wild, Notakto to local game page"
```

---

## Task 6: Update vs-AI Page

**Files:**
- Modify: `apps/web/src/app/vs-ai/page.tsx`

Key changes mirror the local page: extend `Variant`, add `engines`, add `placingAs` state for Wild TTT, update `handleMove`, update variant selector, add symbol picker UI.

- [ ] **Step 6.1: Update vs-ai/page.tsx**

Replace imports at the top:

```typescript
import { StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT } from '@tactictoe/game-engine';
import type { GameState, AIDifficulty, Player } from '@tactictoe/game-engine';
import type { GameRules } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
```

Replace `Variant` type and `engines`:

```typescript
type Variant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'wild_ttt' | 'notakto';

const VARIANT_LABELS: Record<Variant, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère TTT',
  wild_ttt: 'Wild TTT',
  notakto: 'Notakto',
};

const engines: Record<Variant, GameRules> = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
  misere_ttt: new MisereTTT(),
  wild_ttt: new WildTTT(),
  notakto: new NotaktoTTT(),
};
```

Update the `useAI` import type (it now accepts `AIVariant`):

```typescript
import { useAI } from '@/hooks/useAI';
import type { AIVariant } from '@/hooks/useAI';
// Change: const ai = useAI(variant, difficulty);
// variant is already Variant which matches AIVariant
```

Add `placingAs` state:

```typescript
const [placingAs, setPlacingAs] = useState<'X' | 'O'>('X');
```

Update `handleMove` to build correct move data:

```typescript
const handleMove = (boardIndex: number, cellIndex: number) => {
  if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
  const engine = engines[variant];
  const moveData =
    variant === 'ultimate_ttt' ? { boardIndex, cellIndex } :
    variant === 'wild_ttt' ? { cellIndex, symbol: placingAs } :
    { cellIndex };
  const result = engine.applyMove(gameState, { data: moveData }, humanPlayer);
  if (!result.ok) return;
  const term = engine.checkTerminal(result.state);
  if (term) {
    setGameState(result.state);
    setPhase('over');
    setWinner(term.winner);
    setScores(prev => {
      const next = { ...prev };
      if (term.winner === humanPlayer) next.human++;
      else if (term.winner === aiPlayer) next.ai++;
      else next.draws++;
      return next;
    });
  } else {
    setGameState(result.state);
  }
};
```

Update the AI effect's `applyMove` call to also handle move data correctly:

```typescript
// Inside the AI useEffect, after getting move:
const boardIndex = variant === 'ultimate_ttt' ? move.boardIndex : 0;
const moveData =
  variant === 'ultimate_ttt' ? { boardIndex, cellIndex: move.cellIndex } :
  variant === 'wild_ttt' ? { cellIndex: move.cellIndex, symbol: move.symbol } :
  { cellIndex: move.cellIndex };
const result = engine.applyMove(gameState, { data: moveData }, aiPlayer);
```

Update variant selector buttons (replace the existing 2-button loop):

```tsx
{(['ultimate_ttt', 'standard_3x3', 'misere_ttt', 'wild_ttt', 'notakto'] as Variant[]).map(v => (
  <button
    key={v}
    className={`${localStyles.variantBtn} ${variant === v ? localStyles.selected : ''}`}
    onClick={() => setVariant(v)}
  >
    {VARIANT_LABELS[v]}
  </button>
))}
```

Add Wild TTT symbol picker above the board (inside `mainBoard` div, before `UltimateBoard`/`StandardBoard`):

```tsx
{variant === 'wild_ttt' && phase === 'playing' && gameState?.currentPlayer === humanPlayer && (
  <div className={localStyles.wildPicker}>
    <span className={localStyles.wildPickerLabel}>Place as:</span>
    <button
      className={`${localStyles.wildBtn} ${localStyles.x} ${placingAs === 'X' ? localStyles.active : ''}`}
      onClick={() => setPlacingAs('X')}
    >X</button>
    <button
      className={`${localStyles.wildBtn} ${localStyles.o} ${placingAs === 'O' ? localStyles.active : ''}`}
      onClick={() => setPlacingAs('O')}
    >O</button>
  </div>
)}
```

Note: `localStyles` is the import from `../local/page.module.css`, which now has `wildPicker`, `wildPickerLabel`, `wildBtn`, etc. from Task 5.

Also update the Notakto AI thinking indicator — when it's Notakto and it's your turn, it shows `Your turn (X)` or `Your turn (O)` — but both players are X. Update the thinking section:

```tsx
<span style={{ color: 'var(--accent)', fontWeight: 600 }}>
  Your turn{variant !== 'notakto' && ` (${humanPlayer})`}
</span>
```

- [ ] **Step 6.2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "test.ts"
```
Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/app/vs-ai/page.tsx
git commit -m "feat(web): add Misère, Wild, Notakto to vs AI page with symbol picker"
```

---

## Task 7: Final Build Check + Push

- [ ] **Step 7.1: Run full engine tests**

```bash
cd packages/game-engine && npx vitest run
```
Expected: all tests pass (6 suites: win-checker, standard-ttt, ultimate-ttt, misere-ttt, notakto-ttt, wild-ttt).

- [ ] **Step 7.2: Typecheck web app**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "test.ts"
```
Expected: no errors.

- [ ] **Step 7.3: Next.js build**

```bash
cd apps/web && npx next build 2>&1 | grep -E "✓|Compiled|Generating|error TS"
```
Expected: `✓ Compiled successfully` and pages generated. Ignore Windows EPERM symlink warnings in standalone output — they're pre-existing and not code errors.

- [ ] **Step 7.4: Push**

```bash
git push
```

---

## Scope Note

This plan covers the **three simple 3×3 casual variants** from the V1 spec. Two V1 items are deferred:

- **Gomoku** — requires a new `GomokuBoard` component (15×15 grid) and a separate rules engine. Significant rendering work.
- **SOS** — requires a different cell model (S/O not X/O), different scoring (count completed SOS sequences, not 3-in-a-row), and a points display. Different enough to warrant its own plan.

Both should be their own plans after this one ships.
