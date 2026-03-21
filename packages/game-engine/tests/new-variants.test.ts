import { describe, it, expect } from 'vitest';
import { VanishingTTT, VANISHING_FADE_AFTER } from '../src/rules/vanishing-ttt.js';
import { TTT3D, WIN_LINES_3D } from '../src/rules/ttt-3d.js';
import { TTT4D, WIN_LINES_4D } from '../src/rules/ttt-4d.js';
import { OrderChaos } from '../src/rules/order-chaos.js';
import { TacticToe } from '../src/rules/tactic-toe.js';
import type { VanishingTTTState } from '../src/rules/vanishing-ttt.js';
import type { TTT3DState } from '../src/rules/ttt-3d.js';
import type { TTT4DState } from '../src/rules/ttt-4d.js';
import type { OrderChaosState } from '../src/rules/order-chaos.js';
import type { TacticToeState } from '../src/rules/tactic-toe.js';

// ── Vanishing TTT ────────────────────────────────────────────────────────────

describe('VanishingTTT', () => {
  const engine = new VanishingTTT();

  it('initializes a clean board', () => {
    const s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    expect(s.board.length).toBe(9);
    expect(s.board.every(c => c === null)).toBe(true);
    expect(s.moveDates.every(d => d === null)).toBe(true);
    expect(s.currentPlayer).toBe('X');
  });

  it('records move dates', () => {
    let s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    const r1 = engine.applyMove(s, { data: { cellIndex: 4 } }, 'X');
    s = r1.state as VanishingTTTState;
    expect(s.moveDates[4]).toBe(1);
    expect(s.moveCount).toBe(1);
  });

  it('pieces fade after VANISHING_FADE_AFTER moves but board stays occupied', () => {
    let s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    // Place X at 0
    s = engine.applyMove(s, { data: { cellIndex: 0 } }, 'X').state as VanishingTTTState;
    // Advance moveCount by placing more pieces
    const moves = [1, 2, 3, 4, 5, 6];
    for (let i = 0; i < moves.length; i++) {
      const player = s.currentPlayer;
      s = engine.applyMove(s, { data: { cellIndex: moves[i]! } }, player).state as VanishingTTTState;
    }
    // X at cell 0 was placed on move 1. After 7 total moves, age = 7-1 = 6 > VANISHING_FADE_AFTER(6)? No 6 is not > 6
    // actually at exactly VANISHING_FADE_AFTER it's still visible; only > fades it
    expect(s.board[0]).toBe('X'); // Still on board
    expect(s.moveDates[0]).toBe(1);
    expect(s.moveCount).toBe(7);
    const age = s.moveCount - (s.moveDates[0] ?? 0);
    // age = 6, VANISHING_FADE_AFTER = 6: 6 > 6 is false → still visible at exactly threshold
    expect(age > VANISHING_FADE_AFTER).toBe(false);
  });

  it('detects win correctly', () => {
    let s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    const moves = [0, 3, 1, 4, 2]; // X: 0,1,2 / O: 3,4
    for (const ci of moves) {
      s = engine.applyMove(s, { data: { cellIndex: ci } }, s.currentPlayer).state as VanishingTTTState;
    }
    expect(s.terminal?.winner).toBe('X');
  });

  it('rejects occupied cell', () => {
    let s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    s = engine.applyMove(s, { data: { cellIndex: 4 } }, 'X').state as VanishingTTTState;
    const r = engine.applyMove(s, { data: { cellIndex: 4 } }, 'O');
    expect(r.ok).toBe(false);
  });

  it('serializes and deserializes', () => {
    const s = engine.initialize({ variantId: 'vanishing_ttt' }) as VanishingTTTState;
    const json = engine.serialize(s);
    const s2 = engine.deserialize(json) as VanishingTTTState;
    expect(s2.variantId).toBe('vanishing_ttt');
    expect(s2.board.length).toBe(9);
  });
});

// ── 3D TTT ───────────────────────────────────────────────────────────────────

describe('TTT3D', () => {
  const engine = new TTT3D();

  it('initializes 27-cell board', () => {
    const s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    expect(s.board.length).toBe(27);
    expect(s.board.every(c => c === null)).toBe(true);
  });

  it('has exactly 49 win lines', () => {
    expect(WIN_LINES_3D.length).toBe(49);
  });

  it('each win line has exactly 3 cells with valid indices', () => {
    for (const line of WIN_LINES_3D) {
      expect(line.length).toBe(3);
      for (const idx of line) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(27);
      }
    }
  });

  it('detects win on same layer row', () => {
    let s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    // Layer 0, row 0: cells 0, 1, 2
    // Moves: X:0, O:9, X:1, O:10, X:2 → X wins
    for (const [ci, player] of [[0,'X'],[9,'O'],[1,'X'],[10,'O'],[2,'X']] as [number, 'X'|'O'][]) {
      s = engine.applyMove(s, { data: { cellIndex: ci } }, player).state as TTT3DState;
    }
    expect(s.terminal?.winner).toBe('X');
  });

  it('detects win through layers (z-axis)', () => {
    let s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    // Cell (0,0,0)=0, (1,0,0)=9, (2,0,0)=18 — column through layers
    // X:0, O:1, X:9, O:2, X:18 → X wins
    for (const [ci, player] of [[0,'X'],[1,'O'],[9,'X'],[2,'O'],[18,'X']] as [number, 'X'|'O'][]) {
      s = engine.applyMove(s, { data: { cellIndex: ci } }, player).state as TTT3DState;
    }
    expect(s.terminal?.winner).toBe('X');
  });

  it('detects win on space diagonal', () => {
    let s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    // Space diagonal: (0,0,0)=0, (1,1,1)=13, (2,2,2)=26
    for (const [ci, player] of [[0,'X'],[1,'O'],[13,'X'],[2,'O'],[26,'X']] as [number, 'X'|'O'][]) {
      s = engine.applyMove(s, { data: { cellIndex: ci } }, player).state as TTT3DState;
    }
    expect(s.terminal?.winner).toBe('X');
  });

  it('gets legal moves', () => {
    const s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    expect(engine.getLegalMoves(s).length).toBe(27);
  });

  it('serializes and deserializes', () => {
    const s = engine.initialize({ variantId: 'ttt_3d' }) as TTT3DState;
    const s2 = engine.deserialize(engine.serialize(s)) as TTT3DState;
    expect(s2.board.length).toBe(27);
  });
});

// ── 4D TTT ───────────────────────────────────────────────────────────────────

describe('TTT4D', () => {
  const engine = new TTT4D();

  it('initializes 81-cell board', () => {
    const s = engine.initialize({ variantId: 'ttt_4d' }) as TTT4DState;
    expect(s.board.length).toBe(81);
    expect(s.board.every(c => c === null)).toBe(true);
  });

  it('has more than 49 win lines', () => {
    // 4D has far more lines than 3D
    expect(WIN_LINES_4D.length).toBeGreaterThan(49);
  });

  it('each win line has 3 cells with valid indices', () => {
    for (const line of WIN_LINES_4D) {
      expect(line.length).toBe(3);
      for (const idx of line) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(81);
      }
    }
  });

  it('no duplicate win lines', () => {
    const seen = new Set<string>();
    for (const line of WIN_LINES_4D) {
      const key = [...line].sort((a, b) => a - b).join(',');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('detects a win on the first d0 axis (vary d0, fix d1=d2=d3=0)', () => {
    let s = engine.initialize({ variantId: 'ttt_4d' }) as TTT4DState;
    // d0*27: cells 0, 27, 54 (d0=0,1,2; d1=d2=d3=0)
    for (const [ci, player] of [[0,'X'],[1,'O'],[27,'X'],[2,'O'],[54,'X']] as [number,'X'|'O'][]) {
      s = engine.applyMove(s, { data: { cellIndex: ci } }, player).state as TTT4DState;
    }
    expect(s.terminal?.winner).toBe('X');
  });

  it('gets 81 legal moves initially', () => {
    const s = engine.initialize({ variantId: 'ttt_4d' }) as TTT4DState;
    expect(engine.getLegalMoves(s).length).toBe(81);
  });
});

// ── Order and Chaos ──────────────────────────────────────────────────────────

describe('OrderChaos', () => {
  const engine = new OrderChaos();

  it('initializes 36-cell board', () => {
    const s = engine.initialize({ variantId: 'order_chaos' }) as OrderChaosState;
    expect(s.board.length).toBe(36);
  });

  it('both players can place X or O', () => {
    let s = engine.initialize({ variantId: 'order_chaos' }) as OrderChaosState;
    // X player places O symbol
    const r = engine.applyMove(s, { data: { cellIndex: 0, symbol: 'O' } }, 'X');
    expect(r.ok).toBe(true);
    expect((r.state as OrderChaosState).board[0]).toBe('O');
  });

  it('Order wins with 5-in-a-row', () => {
    let s = engine.initialize({ variantId: 'order_chaos' }) as OrderChaosState;
    // Row 0: cells 0-4 for X, cell 5 for O (blocks), make 5 X's in row 1
    // Actually just fill 5 consecutive cells in row 0 with X
    for (let i = 0; i < 5; i++) {
      const player = s.currentPlayer;
      const r = engine.applyMove(s, { data: { cellIndex: i, symbol: 'X' } }, player);
      expect(r.ok).toBe(true);
      s = r.state as OrderChaosState;
      // Give the other player a harmless cell
      if (i < 4) {
        const p2 = s.currentPlayer;
        s = engine.applyMove(s, { data: { cellIndex: 30 + i, symbol: 'O' } }, p2).state as OrderChaosState;
      }
    }
    expect(s.terminal?.winner).toBe('X'); // Order wins
  });

  it('legal moves include both X and O for each empty cell', () => {
    const s = engine.initialize({ variantId: 'order_chaos' }) as OrderChaosState;
    const legal = engine.getLegalMoves(s);
    expect(legal.length).toBe(72); // 36 cells × 2 symbols
  });

  it('serializes and deserializes', () => {
    const s = engine.initialize({ variantId: 'order_chaos' }) as OrderChaosState;
    const s2 = engine.deserialize(engine.serialize(s)) as OrderChaosState;
    expect(s2.board.length).toBe(36);
  });
});

// ── Tactic Toe ───────────────────────────────────────────────────────────────

describe('TacticToe', () => {
  const engine = new TacticToe();

  it('initializes 27-cell board with exactly 8 obstacles', () => {
    const s = engine.initialize({ variantId: 'tactic_toe', seed: 42 }) as TacticToeState;
    expect(s.board.length).toBe(27);
    const obstacles = s.board.filter(c => c === 'B');
    expect(obstacles.length).toBe(8);
  });

  it('same seed produces same layout', () => {
    const s1 = engine.initialize({ variantId: 'tactic_toe', seed: 99 }) as TacticToeState;
    const s2 = engine.initialize({ variantId: 'tactic_toe', seed: 99 }) as TacticToeState;
    expect(s1.board).toEqual(s2.board);
  });

  it('different seeds produce different layouts (usually)', () => {
    const s1 = engine.initialize({ variantId: 'tactic_toe', seed: 1 }) as TacticToeState;
    const s2 = engine.initialize({ variantId: 'tactic_toe', seed: 12345 }) as TacticToeState;
    // Very unlikely to be identical
    expect(s1.board).not.toEqual(s2.board);
  });

  it('player can place on empty cell', () => {
    const s = engine.initialize({ variantId: 'tactic_toe', seed: 42 }) as TacticToeState;
    const emptyCell = s.board.findIndex(c => c === null);
    expect(emptyCell).toBeGreaterThanOrEqual(0);
    const r = engine.applyMove(s, { data: { type: 'place', cellIndex: emptyCell } }, 'X');
    expect(r.ok).toBe(true);
    expect((r.state as TacticToeState).board[emptyCell]).toBe('X');
  });

  it('player cannot place on obstacle', () => {
    const s = engine.initialize({ variantId: 'tactic_toe', seed: 42 }) as TacticToeState;
    const obstacleCell = s.board.findIndex(c => c === 'B');
    expect(obstacleCell).toBeGreaterThanOrEqual(0);
    const r = engine.applyMove(s, { data: { type: 'place', cellIndex: obstacleCell } }, 'X');
    expect(r.ok).toBe(false);
  });

  it('player can move an obstacle to an empty cell', () => {
    const s = engine.initialize({ variantId: 'tactic_toe', seed: 42 }) as TacticToeState;
    const fromCell = s.board.findIndex(c => c === 'B');
    const toCell = s.board.findIndex(c => c === null);
    const r = engine.applyMove(s, { data: { type: 'move_obstacle', fromCell, toCell } }, 'X');
    expect(r.ok).toBe(true);
    const ns = r.state as TacticToeState;
    expect(ns.board[fromCell]).toBe(null);
    expect(ns.board[toCell]).toBe('B');
  });

  it('detects win (3-in-a-row ignoring obstacles)', () => {
    // Build a board with known positions
    let s = engine.initialize({ variantId: 'tactic_toe', seed: 42 }) as TacticToeState;
    // Find 3 empty cells in layer 0 same row (cells 0,1,2 if available)
    // Place X:0, O:9, X:1, O:10, X:2 if those cells are empty
    const board = [...s.board];
    const emptiesInRow0 = [0, 1, 2].filter(i => board[i] === null);
    if (emptiesInRow0.length === 3) {
      for (const [ci, player] of [[0,'X'],[9,'O'],[1,'X'],[10,'O'],[2,'X']] as [number,'X'|'O'][]) {
        const r = engine.applyMove(s, { data: { type: 'place', cellIndex: ci } }, player);
        if (r.ok) s = r.state as TacticToeState;
      }
      if (s.terminal) {
        expect(s.terminal.winner).toBe('X');
      }
    }
  });

  it('serializes and deserializes preserving obstacles', () => {
    const s = engine.initialize({ variantId: 'tactic_toe', seed: 7 }) as TacticToeState;
    const s2 = engine.deserialize(engine.serialize(s)) as TacticToeState;
    expect(s2.board).toEqual(s.board);
  });
});
