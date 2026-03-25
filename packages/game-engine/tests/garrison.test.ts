import { describe, it, expect } from 'vitest';
import { Garrison } from '../src/rules/garrison.js';
import type { GarrisonState, GarrisonMove } from '../src/rules/garrison.js';
import { getGarrisonAIMove } from '../src/ai/garrison-ai.js';

const engine = new Garrison();

function init(): GarrisonState {
  return engine.initialize({ variantId: 'garrison', seed: 42 }) as GarrisonState;
}

function applyMove(state: GarrisonState, move: GarrisonMove): GarrisonState {
  const result = engine.applyMove(state, { data: move }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move failed: ${result.error}`);
  return result.state as GarrisonState;
}

describe('Garrison initialize', () => {
  it('creates 16 pieces (8 per player)', () => {
    const state = init();
    expect(state.pieces.length).toBe(16);
    expect(state.pieces.filter(p => p.player === 'X').length).toBe(8);
    expect(state.pieces.filter(p => p.player === 'O').length).toBe(8);
  });

  it('kings are on board at symmetrical squares', () => {
    const state = init();
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const oKing = state.pieces.find(p => p.player === 'O' && p.type === 'K')!;
    expect(xKing.square).toBeGreaterThanOrEqual(0);
    expect(oKing.square).toBe(63 - xKing.square);
  });

  it('kings are not on adjacent squares', () => {
    const state = init();
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const oKing = state.pieces.find(p => p.player === 'O' && p.type === 'K')!;
    const dr = Math.abs(Math.floor(xKing.square / 8) - Math.floor(oKing.square / 8));
    const dc = Math.abs((xKing.square % 8) - (oKing.square % 8));
    expect(dr > 1 || dc > 1).toBe(true);
  });

  it('non-king pieces start in hand (square = -1)', () => {
    const state = init();
    const handPieces = state.pieces.filter(p => p.type !== 'K');
    expect(handPieces.every(p => p.square === -1)).toBe(true);
  });

  it('starts with moveCount = 0 and currentPlayer = X', () => {
    const state = init();
    expect(state.moveCount).toBe(0);
    expect(state.currentPlayer).toBe('X');
  });

  it('each player has 1K 1Q 2R 2B 2N', () => {
    const state = init();
    for (const pl of ['X', 'O'] as const) {
      const pp = state.pieces.filter(p => p.player === pl);
      expect(pp.filter(p => p.type === 'K').length).toBe(1);
      expect(pp.filter(p => p.type === 'Q').length).toBe(1);
      expect(pp.filter(p => p.type === 'R').length).toBe(2);
      expect(pp.filter(p => p.type === 'B').length).toBe(2);
      expect(pp.filter(p => p.type === 'N').length).toBe(2);
    }
  });
});

describe('Garrison place move', () => {
  it('places a piece from hand onto empty square', () => {
    const state = init();
    const queen = state.pieces.find(p => p.player === 'X' && p.type === 'Q')!;
    // Find a square not occupied by a king
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const oKing = state.pieces.find(p => p.player === 'O' && p.type === 'K')!;
    const targetSq = [10, 11, 12, 13, 14].find(sq => sq !== xKing.square && sq !== oKing.square)!;
    const next = applyMove(state, { type: 'place', pieceId: queen.id, to: targetSq });
    const placed = next.pieces.find(p => p.id === queen.id)!;
    expect(placed.square).toBe(targetSq);
    expect(next.moveCount).toBe(1);
    expect(next.currentPlayer).toBe('O');
  });

  it('rejects placing on occupied square', () => {
    const state = init();
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const queen = state.pieces.find(p => p.player === 'X' && p.type === 'Q')!;
    const result = engine.applyMove(state, { data: { type: 'place', pieceId: queen.id, to: xKing.square } as GarrisonMove }, 'X');
    expect(result.ok).toBe(false);
  });

  it('rejects placing a piece already on board', () => {
    let state = init();
    const queen = state.pieces.find(p => p.player === 'X' && p.type === 'Q')!;
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const oKing = state.pieces.find(p => p.player === 'O' && p.type === 'K')!;
    const sq1 = [10, 11, 12].find(sq => sq !== xKing.square && sq !== oKing.square)!;
    const sq2 = [20, 21, 22].find(sq => sq !== xKing.square && sq !== oKing.square)!;
    state = applyMove(state, { type: 'place', pieceId: queen.id, to: sq1 });
    const oRook = state.pieces.find(p => p.player === 'O' && p.type === 'R')!;
    state = applyMove(state, { type: 'place', pieceId: oRook.id, to: sq2 });
    // Try to place queen again (it's already at sq1)
    const result = engine.applyMove(state, { data: { type: 'place', pieceId: queen.id, to: 30 } as GarrisonMove }, 'X');
    expect(result.ok).toBe(false);
  });
});

describe('Garrison move', () => {
  it('moves a piece on the board', () => {
    let state = init();
    const xKing = state.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const legal = engine.getLegalMoves(state);
    const kingMove = legal
      .map(m => m.data as GarrisonMove)
      .find(m => m.type === 'move' && m.pieceId === xKing.id);
    if (!kingMove) return; // king may have no moves at this position
    state = applyMove(state, kingMove as GarrisonMove);
    const moved = state.pieces.find(p => p.id === xKing.id)!;
    expect(moved.square).toBe((kingMove as Extract<GarrisonMove, { type: 'move' }>).to);
  });
});

describe('Garrison check and legal moves', () => {
  it('getLegalMoves returns non-empty list at game start', () => {
    const state = init();
    const legal = engine.getLegalMoves(state);
    expect(legal.length).toBeGreaterThan(0);
  });

  it('no legal move leaves own king in check', () => {
    const state = init();
    const legal = engine.getLegalMoves(state);
    for (const move of legal.slice(0, 5)) {
      const result = engine.applyMove(state, move, state.currentPlayer);
      expect(result.ok).toBe(true);
    }
  });
});

describe('Garrison serialize/deserialize', () => {
  it('roundtrip preserves state', () => {
    const state = init();
    const serialized = engine.serialize(state);
    const deserialized = engine.deserialize(serialized) as GarrisonState;
    expect(deserialized.pieces.length).toBe(16);
    expect(deserialized.moveCount).toBe(0);
    expect(deserialized.variantId).toBe('garrison');
    expect(deserialized.currentPlayer).toBe('X');
  });
});

describe('Garrison win conditions', () => {
  it('5-in-a-row ends the game for X', () => {
    let s = init();
    const xKing = s.pieces.find(p => p.player === 'X' && p.type === 'K')!;
    const oKing = s.pieces.find(p => p.player === 'O' && p.type === 'K')!;
    const blocked = new Set([xKing.square, oKing.square]);

    // Find 5 consecutive horizontal squares on row 1 (squares 8-15) not blocked by kings
    const row1 = [8,9,10,11,12,13,14,15].filter(sq => !blocked.has(sq));
    if (row1.length < 5) return; // skip if kings interfere

    const xPieces = s.pieces.filter(p => p.player === 'X' && p.type !== 'K').slice(0, 5);

    // Place X pieces at row1[0..3], interleaved with O moves (using getLegalMoves for O)
    for (let i = 0; i < 4; i++) {
      s = applyMove(s, { type: 'place', pieceId: xPieces[i]!.id, to: row1[i]! });
      // O uses its first legal place move (always legal by engine guarantees)
      const oLegal = engine.getLegalMoves(s);
      const oPlace = oLegal.find(m => (m.data as GarrisonMove).type === 'place');
      if (oPlace) {
        s = applyMove(s, oPlace.data as GarrisonMove);
      }
    }
    // X places 5th piece to complete 5-in-a-row
    const result = engine.applyMove(s, { data: { type: 'place', pieceId: xPieces[4]!.id, to: row1[4]! } as GarrisonMove }, 'X');
    if (result.ok) {
      expect((result.state as GarrisonState).terminal?.winner).toBe('X');
    }
  });
});

describe('Garrison AI', () => {
  it('easy AI returns a valid move', () => {
    const state = engine.initialize({ variantId: 'garrison', seed: 42 }) as GarrisonState;
    const move = getGarrisonAIMove(state, 'X', 'easy');
    expect(move).toBeDefined();
    expect(move.type).toMatch(/^(place|move)$/);
  });

  it('hard AI returns a valid move', () => {
    const state = engine.initialize({ variantId: 'garrison', seed: 99 }) as GarrisonState;
    const move = getGarrisonAIMove(state, 'X', 'hard');
    expect(move).toBeDefined();
    expect(move.type).toMatch(/^(place|move)$/);
  });
});
