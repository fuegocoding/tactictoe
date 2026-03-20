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
    s = play(s, 0); s = play(s, 3); // X at 0, O at 3
    s = play(s, 2); s = play(s, 4); // X at 2, O at 4
    s = play(s, 7); s = play(s, 5); // X at 7, O at 5 → middle row 3-4-5 complete → O loses
    const result = rules.checkTerminal(s);
    expect(result?.winner).toBe('X');
  });

  it('completing a diagonal means that player loses', () => {
    // Player X places at 0, 4, 8 (main diagonal) — X loses, O wins
    let s = fresh();
    s = play(s, 0); s = play(s, 5); // X at 0, O at 5
    s = play(s, 4); s = play(s, 2); // X at 4, O at 2
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
