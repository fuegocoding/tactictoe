import { describe, it, expect } from 'vitest';
import { UltimateTTT } from '../src/rules/ultimate-ttt.js';
import type { UltimateTTTState } from '../src/rules/ultimate-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new UltimateTTT();

function fresh(): UltimateTTTState {
  return rules.initialize({ variantId: 'ultimate_ttt' }) as UltimateTTTState;
}

function play(state: GameState, boardIndex: number, cellIndex: number): UltimateTTTState {
  const s = state as UltimateTTTState;
  const result = rules.applyMove(s, { data: { boardIndex, cellIndex } }, s.currentPlayer);
  if (!result.ok) throw new Error(`Move b${boardIndex}c${cellIndex} rejected: ${result.error}`);
  return result.state as UltimateTTTState;
}

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

  it('starts with no board constraint', () => {
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
    expect(fresh().boardResults.every((r) => r === null)).toBe(true);
  });
});

// ─── Board constraint ─────────────────────────────────────────────────────────

describe('board constraint', () => {
  it('first move can be in any board', () => {
    const s = fresh();
    expect(() => play(s, 7, 4)).not.toThrow();
    expect(() => play(s, 0, 0)).not.toThrow();
  });

  it('playing cell 4 sends opponent to board 4', () => {
    let s = fresh();
    s = play(s, 0, 4);
    expect(s.nextBoardConstraint).toBe(4);
  });

  it('playing cell 7 sends opponent to board 7', () => {
    let s = fresh();
    s = play(s, 2, 7);
    expect(s.nextBoardConstraint).toBe(7);
  });

  it('rejects move in wrong board when constrained', () => {
    let s = fresh();
    s = play(s, 0, 4); // sends O to board 4
    expectRejected(s, 2, 0, /wrong board/i);
  });

  it('after playing in constrained board, sets new constraint', () => {
    let s = fresh();
    s = play(s, 0, 4); // sends O to board 4
    s = play(s, 4, 2); // O plays board 4 cell 2, sends X to board 2
    expect(s.nextBoardConstraint).toBe(2);
  });

  it('switches player on each move', () => {
    let s = fresh();
    expect(s.currentPlayer).toBe('X');
    s = play(s, 4, 4);
    expect(s.currentPlayer).toBe('O');
    s = play(s, 4, 0);
    expect(s.currentPlayer).toBe('X');
  });
});

// ─── Free choice when target board is won ─────────────────────────────────────

describe('free board choice when target board is won or drawn', () => {
  it('getLegalMoves returns 81 moves when unconstrained (fresh board)', () => {
    const s = fresh();
    expect(rules.getLegalMoves(s)).toHaveLength(81);
  });

  it('getLegalMoves returns only moves in constrained board when valid', () => {
    let s = fresh();
    s = play(s, 3, 4); // sends O to board 4 (empty = 9 moves)
    const moves = rules.getLegalMoves(s);
    expect(moves).toHaveLength(9);
    const data = moves.map((m) => (m.data as { boardIndex: number; cellIndex: number }));
    expect(data.every((d) => d.boardIndex === 4)).toBe(true);
  });

  it('getLegalMoves returns moves in all open boards when constrained board is won', () => {
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
    // Board 0 is won → free choice among boards 1-8 (all empty = 8*9=72)
    const moves = rules.getLegalMoves(s);
    expect(moves).toHaveLength(72);
    const boardIndices = moves.map((m) => (m.data as { boardIndex: number }).boardIndex);
    expect(boardIndices.every((bi) => bi !== 0)).toBe(true);
  });

  it('applyMove accepts move outside constrained board when that board is won', () => {
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

    // O should be able to play in board 5 (free choice since board 0 is won)
    const result = rules.applyMove(s, { data: { boardIndex: 5, cellIndex: 3 } }, 'O');
    expect(result.ok).toBe(true);

    // But NOT in board 0 (already won)
    const rejected = rules.applyMove(s, { data: { boardIndex: 0, cellIndex: 5 } }, 'O');
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toMatch(/already finished/i);
  });
});

// ─── Mini-board win/draw detection ───────────────────────────────────────────

describe('mini-board result detection', () => {
  it('marks a mini-board as won when a player gets 3-in-a-row', () => {
    // X wins board 4 by getting cells 0,1,2 (top row)
    // Navigate: play board 4 cell 0 → O to board 0
    //           O plays board 0 cell 1 → X to board 1
    //           X plays board 1 cell 1 → O to board 1... this gets complex.
    // Use deserialization + one-move approach instead.
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 4,
      boards: [
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        ['X', 'X', null, 'O', 'O', null, null, null, null], // board 4: X needs cell 2
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: [null, null, null, null, null, null, null, null, null],
      nextBoardConstraint: 4,
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;
    const result = rules.applyMove(s, { data: { boardIndex: 4, cellIndex: 2 } }, 'X');
    expect(result.ok).toBe(true);
    expect((result.state as UltimateTTTState).boardResults[4]).toBe('X');
  });

  it('marks a mini-board as draw when it is full with no winner', () => {
    // Board 2: X has 0,2,5,6,7; O has 1,3,4; cell 8 empty → no winner
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 8,
      boards: [
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null], // board 2: cell 8 empty; X at 0,2,3,7 — no 3-in-a-row when X plays 8
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: [null, null, null, null, null, null, null, null, null],
      nextBoardConstraint: 2,
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;
    // X plays board 2 cell 8 — fills the board with no winner
    const result = rules.applyMove(s, { data: { boardIndex: 2, cellIndex: 8 } }, 'X');
    expect(result.ok).toBe(true);
    const newState = result.state as UltimateTTTState;
    expect(newState.boardResults[2]).toBe('draw');
    // After a draw in board 2 (cell 8), nextConstraint = 8 (board 8 is open)
    expect(newState.nextBoardConstraint).toBe(8);
  });
});

// ─── Meta-board win detection ─────────────────────────────────────────────────

describe('meta-board win detection', () => {
  it('detects X winning the meta-board top row (boards 0,1,2)', () => {
    // Inject state where boards 0 and 1 are won by X, board 2 has X at cells 0,1; cell 2 empty
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 30,
      boards: [
        ['X', 'X', 'X', 'O', 'O', null, null, null, null], // board 0: X wins top row
        ['X', 'X', 'X', 'O', 'O', null, null, null, null], // board 1: X wins top row
        ['X', 'X', null, 'O', 'O', null, null, null, null], // board 2: X needs cell 2
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      boardResults: ['X', 'X', null, null, null, null, null, null, null],
      nextBoardConstraint: 2,
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;
    const result = rules.applyMove(s, { data: { boardIndex: 2, cellIndex: 2 } }, 'X');
    expect(result.ok).toBe(true);
    const terminal = rules.checkTerminal(result.state);
    expect(terminal).not.toBeNull();
    expect(terminal?.winner).toBe('X');
    expect(terminal?.reason).toBe('win');
    expect((result.state as UltimateTTTState).status ?? result.state).toBeTruthy();
  });

  it('checkTerminal correctly reads boardResults on deserialized state', () => {
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 30,
      boards: Array(9).fill([null, null, null, null, null, null, null, null, null]),
      boardResults: ['X', 'X', 'X', null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: null, // deliberately null even though X has won top row
    });
    const s = rules.deserialize(stateJson);
    const terminal = rules.checkTerminal(s);
    expect(terminal?.winner).toBe('X');
    expect(terminal?.reason).toBe('win');
  });
});

// ─── Illegal move rejection ────────────────────────────────────────────────────

describe('illegal move rejection', () => {
  it('rejects move from wrong player', () => {
    const s = fresh();
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

  it('rejects move on occupied cell', () => {
    let s = fresh();
    s = play(s, 0, 0); // X plays b0c0 → O must play board 0
    expectRejected(s, 0, 0, /occupied/i);
  });

  it('rejects move in a completed (won) board', () => {
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 5,
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
      nextBoardConstraint: 3, // constrained to board 3 (open), not board 0
      terminal: null,
    });
    const s = rules.deserialize(stateJson) as UltimateTTTState;
    // X tries to play in board 0 (won) — should be rejected
    const result = rules.applyMove(s, { data: { boardIndex: 0, cellIndex: 5 } }, 'X');
    expect(result.ok).toBe(false);
  });

  it('rejects any move in a terminal game', () => {
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 30,
      boards: Array(9).fill([null, null, null, null, null, null, null, null, null]),
      boardResults: ['X', 'X', 'X', null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: { winner: 'X', reason: 'win' },
    });
    const s = rules.deserialize(stateJson);
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
    expect(s.boards[4]![4]).toBeNull();
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
    s = play(s, 2, 7); // X plays b2c7 → O must play board 7
    s = play(s, 7, 3); // O plays b7c3 → X must play board 3
    const json = rules.serialize(s);
    const restored = rules.deserialize(json) as UltimateTTTState;
    expect(restored.nextBoardConstraint).toBe(3);
    expect(restored.currentPlayer).toBe('X');
    expect(restored.moveCount).toBe(2);
  });
});

// ─── getLegalMoves ────────────────────────────────────────────────────────────

describe('getLegalMoves', () => {
  it('returns 0 moves in a terminal state', () => {
    const stateJson = JSON.stringify({
      variantId: 'ultimate_ttt',
      currentPlayer: 'O',
      moveCount: 30,
      boards: Array(9).fill([null, null, null, null, null, null, null, null, null]),
      boardResults: ['X', 'X', 'X', null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: { winner: 'X', reason: 'win' },
    });
    const s = rules.deserialize(stateJson);
    expect(rules.getLegalMoves(s)).toHaveLength(0);
  });
});
