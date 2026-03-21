import { describe, it, expect } from 'vitest';
import { NumericalTTT } from '../src/rules/numerical-ttt.js';
import type { NumericalTTTState } from '../src/rules/numerical-ttt.js';

describe('Numerical TTT logic', () => {
  const engine = new NumericalTTT();

  it('detects win when line sums to 15', () => {
    let state = engine.initialize({ variantId: 'numerical_ttt' }) as NumericalTTTState;
    
    // X places 5
    let r = engine.applyMove(state, { data: { cellIndex: 0, numberPlaced: 5 } }, 'X');
    state = r.state as NumericalTTTState;
    expect(state.availableOdds).not.toContain(5);
    
    // O places 2
    r = engine.applyMove(state, { data: { cellIndex: 1, numberPlaced: 2 } }, 'O');
    state = r.state as NumericalTTTState;
    
    // X places 8 -> ERROR: X must play odd numbers!
    r = engine.applyMove(state, { data: { cellIndex: 2, numberPlaced: 8 } }, 'X');
    expect(r.ok).toBe(false);
    
    // X places 9
    r = engine.applyMove(state, { data: { cellIndex: 3, numberPlaced: 9 } }, 'X');
    state = r.state as NumericalTTTState;
    
    // O places 8 to block? wait, 5 + 2 + 8 = 15! 
    // If O places 8 at cellIndex=2: Line [0,1,2] -> 5 + 2 + 8 = 15
    r = engine.applyMove(state, { data: { cellIndex: 2, numberPlaced: 8 } }, 'O');
    state = r.state as NumericalTTTState;
    
    // Player O completes the line summing to 15, Player O wins!
    expect(state.terminal).toEqual({ winner: 'O', reason: 'win' });
  });
});
