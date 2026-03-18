import { describe, it, expect } from 'vitest';
import { StandardTTT } from '../src/rules/standard-ttt.js';
import type { GameState } from '../src/types.js';

const rules = new StandardTTT();

function fresh(): GameState {
  return rules.initialize({ variantId: 'standard_3x3' });
}

function play(state: GameState, cellIndex: number): GameState {
  const result = rules.applyMove(state, { data: { cellIndex } }, state.currentPlayer);
  if (!result.ok) throw new Error(`Move rejected: ${result.error}`);
  return result.state;
}

describe('StandardTTT', () => {
  describe('initialize', () => {
    it('starts with X as current player', () => {
      expect(fresh().currentPlayer).toBe('X');
    });

    it('starts with moveCount 0', () => {
      expect(fresh().moveCount).toBe(0);
    });

    it('starts with no terminal result', () => {
      expect(rules.checkTerminal(fresh())).toBeNull();
    });
  });

  describe('applyMove', () => {
    it('places a mark and switches player', () => {
      let s = fresh();
      s = play(s, 4);
      expect(s.currentPlayer).toBe('O');
      expect(s.moveCount).toBe(1);
    });

    it('rejects a move on an occupied cell', () => {
      let s = fresh();
      s = play(s, 4);
      const result = rules.applyMove(s, { data: { cellIndex: 4 } }, s.currentPlayer);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/occupied/i);
    });

    it('rejects a move from the wrong player', () => {
      const s = fresh();
      const result = rules.applyMove(s, { data: { cellIndex: 0 } }, 'O');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not your turn/i);
    });

    it('rejects an out-of-bounds cell index', () => {
      const s = fresh();
      const result = rules.applyMove(s, { data: { cellIndex: 9 } }, 'X');
      expect(result.ok).toBe(false);
    });

    it('rejects a move in a finished game', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 2); // X wins
      const result = rules.applyMove(s, { data: { cellIndex: 5 } }, 'O');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/game.*over/i);
    });
  });

  describe('getLegalMoves', () => {
    it('returns 9 moves on an empty board', () => {
      expect(rules.getLegalMoves(fresh())).toHaveLength(9);
    });

    it('returns 0 moves in a terminal state', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 2);
      expect(rules.getLegalMoves(s)).toHaveLength(0);
    });
  });

  describe('checkTerminal', () => {
    it('detects an X win', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 2);
      const result = rules.checkTerminal(s);
      expect(result).not.toBeNull();
      expect(result?.winner).toBe('X');
      expect(result?.reason).toBe('win');
    });

    it('detects an O win', () => {
      let s = fresh();
      s = play(s, 0); s = play(s, 3);
      s = play(s, 1); s = play(s, 4);
      s = play(s, 8); s = play(s, 5);
      const result = rules.checkTerminal(s);
      expect(result?.winner).toBe('O');
    });

    it('detects a draw', () => {
      let s = fresh();
      const moves = [0, 1, 2, 3, 5, 4, 7, 8, 6];
      for (const cell of moves) {
        s = play(s, cell);
      }
      const result = rules.checkTerminal(s);
      expect(result?.winner).toBeNull();
      expect(result?.reason).toBe('draw');
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips a mid-game state', () => {
      let s = fresh();
      s = play(s, 4);
      s = play(s, 0);
      const json = rules.serialize(s);
      const restored = rules.deserialize(json);
      expect(restored.currentPlayer).toBe(s.currentPlayer);
      expect(restored.moveCount).toBe(s.moveCount);
    });
  });
});
