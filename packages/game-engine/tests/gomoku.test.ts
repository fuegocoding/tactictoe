import { describe, it, expect } from 'vitest';
import { Gomoku } from '../src/rules/gomoku.js';
import type { GomokuState } from '../src/rules/gomoku.js';

describe('Gomoku logic', () => {
  const engine = new Gomoku();

  it('initializes a 15x15 board', () => {
    const state = engine.initialize({ variantId: 'gomoku' }) as GomokuState;
    expect(state.board.length).toBe(225);
    expect(state.terminal).toBe(null);
  });

  it('allows players to place stones and detects win', () => {
    let state = engine.initialize({ variantId: 'gomoku' }) as GomokuState;
    
    // X gets 5 in a row horizontally
    const xMoves = [0, 1, 2, 3, 4];
    const oMoves = [15, 16, 17, 18];
    
    for (let i = 0; i < 4; i++) {
        const r1 = engine.applyMove(state, { data: { cellIndex: xMoves[i] } }, 'X');
        state = r1.state as GomokuState;
        expect(state.terminal).toBe(null);
        
        const r2 = engine.applyMove(state, { data: { cellIndex: oMoves[i] } }, 'O');
        state = r2.state as GomokuState;
        expect(state.terminal).toBe(null);
    }
    
    // Winning move
    const rFinal = engine.applyMove(state, { data: { cellIndex: xMoves[4] } }, 'X');
    state = rFinal.state as GomokuState;
    expect(state.terminal).toEqual({ winner: 'X', reason: 'win' });
  });
});
