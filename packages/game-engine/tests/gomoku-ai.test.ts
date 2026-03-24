import { describe, it, expect } from 'vitest';
import { getGomokuAIMove } from '../src/ai/gomoku-ai.js';
import type { GomokuState } from '../src/rules/gomoku.js';
import type { Player } from '../src/types.js';

function makeState(pieces: { idx: number; player: Player }[], currentPlayer: Player): GomokuState {
  const board = Array(225).fill(null);
  for (const { idx, player } of pieces) {
    board[idx] = player;
  }
  return {
    variantId: 'gomoku',
    currentPlayer,
    moveCount: pieces.length,
    board,
    terminal: null,
  } as GomokuState;
}

// Cells 0-4 are the top row (y=0, x=0..4)
// Cell index = y*15 + x

describe('Gomoku AI', () => {
  describe('hard difficulty', () => {
    it('takes an immediate winning move (5th in a row)', () => {
      // X has 4 in a row at cells 0,1,2,3 — playing 4 wins
      const state = makeState(
        [
          { idx: 0, player: 'X' },
          { idx: 1, player: 'X' },
          { idx: 2, player: 'X' },
          { idx: 3, player: 'X' },
          { idx: 30, player: 'O' },
          { idx: 31, player: 'O' },
          { idx: 32, player: 'O' },
          { idx: 33, player: 'O' },
        ],
        'X'
      );
      const move = getGomokuAIMove(state, 'X', 'hard');
      expect(move).toBe(4);
    });

    it('blocks opponent from winning (opponent has 4 in a row)', () => {
      // O has 4 in a row at cells 0,1,2,3 — X must play 4 to block
      const state = makeState(
        [
          { idx: 0, player: 'O' },
          { idx: 1, player: 'O' },
          { idx: 2, player: 'O' },
          { idx: 3, player: 'O' },
          { idx: 30, player: 'X' },
          { idx: 31, player: 'X' },
          { idx: 32, player: 'X' },
        ],
        'X'
      );
      const move = getGomokuAIMove(state, 'X', 'hard');
      expect(move).toBe(4);
    });

    it('prefers winning over blocking when both are available', () => {
      // X has 4 in a row at cells 0,1,2,3 (win at 4)
      // O has 4 in a row at cells 15,16,17,18 (block at 19)
      // AI should take the win
      const state = makeState(
        [
          { idx: 0, player: 'X' },
          { idx: 1, player: 'X' },
          { idx: 2, player: 'X' },
          { idx: 3, player: 'X' },
          { idx: 15, player: 'O' },
          { idx: 16, player: 'O' },
          { idx: 17, player: 'O' },
          { idx: 18, player: 'O' },
        ],
        'X'
      );
      const move = getGomokuAIMove(state, 'X', 'hard');
      expect(move).toBe(4);
    });

    it('plays center on an empty board', () => {
      const state = makeState([], 'X');
      const move = getGomokuAIMove(state, 'X', 'hard');
      expect(move).toBe(112); // center of 15x15 grid
    });
  });

  describe('easy difficulty', () => {
    it('returns a valid cell index', () => {
      const state = makeState(
        [{ idx: 112, player: 'X' }],
        'O'
      );
      const move = getGomokuAIMove(state, 'O', 'easy');
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThan(225);
      expect(state.board[move]).toBeNull();
    });

    it('still blocks an immediate loss (never misses forced block)', () => {
      // O has 4 in a row — even Easy should block
      const state = makeState(
        [
          { idx: 0, player: 'O' },
          { idx: 1, player: 'O' },
          { idx: 2, player: 'O' },
          { idx: 3, player: 'O' },
          { idx: 30, player: 'X' },
          { idx: 31, player: 'X' },
          { idx: 32, player: 'X' },
        ],
        'X'
      );
      const move = getGomokuAIMove(state, 'X', 'easy');
      expect(move).toBe(4);
    });
  });

  describe('medium difficulty', () => {
    it('returns a valid cell index', () => {
      const state = makeState(
        [{ idx: 112, player: 'X' }],
        'O'
      );
      const move = getGomokuAIMove(state, 'O', 'medium');
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThan(225);
      expect(state.board[move]).toBeNull();
    });

    it('still blocks an immediate loss (never misses forced block)', () => {
      const state = makeState(
        [
          { idx: 0, player: 'O' },
          { idx: 1, player: 'O' },
          { idx: 2, player: 'O' },
          { idx: 3, player: 'O' },
          { idx: 30, player: 'X' },
          { idx: 31, player: 'X' },
          { idx: 32, player: 'X' },
        ],
        'X'
      );
      const move = getGomokuAIMove(state, 'X', 'medium');
      expect(move).toBe(4);
    });
  });
});
