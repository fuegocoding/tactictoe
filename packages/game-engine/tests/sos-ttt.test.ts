import { describe, it, expect } from 'vitest';
import { SOSTTT } from '../src/rules/sos-ttt.js';
import type { SOSTTTState } from '../src/rules/sos-ttt.js';

describe('SOS TTT logic', () => {
  const engine = new SOSTTT();

  it('detects SOS, gives points, and grants extra turn', () => {
    let state = engine.initialize({ variantId: 'sos_ttt' }) as SOSTTTState;
    
    // X places S at 0
    let r = engine.applyMove(state, { data: { cellIndex: 0, symbol: 'S' } }, 'X');
    state = r.state as SOSTTTState;
    expect(state.currentPlayer).toBe('O');
    
    // O places O at 1
    r = engine.applyMove(state, { data: { cellIndex: 1, symbol: 'O' } }, 'O');
    state = r.state as SOSTTTState;
    expect(state.currentPlayer).toBe('X');
    
    // X places S at 2 -> Forms S-O-S!
    r = engine.applyMove(state, { data: { cellIndex: 2, symbol: 'S' } }, 'X');
    state = r.state as SOSTTTState;
    
    // X should have 1 point and SHOULD KEEP THEIR TURN
    expect(state.scores.X).toBe(1);
    expect(state.currentPlayer).toBe('X');
    
    // Game should not be over
    expect(state.terminal).toBe(null);
  });
});
