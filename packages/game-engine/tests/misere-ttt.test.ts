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
    s = play(s, 0); s = play(s, 1);
    s = play(s, 2); s = play(s, 4);
    s = play(s, 3); s = play(s, 7); // O completes column → O loses → X wins
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
