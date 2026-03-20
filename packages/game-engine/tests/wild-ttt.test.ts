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
    // Fresh game: X goes first
    let s = fresh();
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
    s = play(s, 6, 'X'); // X places X at 6
    s = play(s, 3, 'O'); // O places O at 3
    s = play(s, 0, 'X'); // X places X at 0
    s = play(s, 4, 'O'); // O places O at 4
    s = play(s, 1, 'X'); // X places X at 1
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
    // Known draw sequence via Wild TTT moves without hitting a line midway.
    // Result board: X O X / X O O / O X X → no row/col/diag 3-of-same
    let s = fresh();
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
