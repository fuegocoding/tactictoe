import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

export interface VanishingTTTState extends GameState {
  variantId: 'vanishing_ttt';
  board: Board;
  /** Move number when each cell was last filled. null = empty cell. */
  moveDates: (number | null)[];
  terminal: TerminalResult | null;
}

/**
 * Vanishing Tic-Tac-Toe:
 * Standard 3x3 rules, but pieces placed more than FADE_AFTER total moves ago
 * become visually invisible (yet still occupy the cell and count for win detection).
 * Players must remember where their hidden pieces are!
 */
export const VANISHING_FADE_AFTER = 6; // pieces fade after this many moves have passed

function castState(state: GameState): VanishingTTTState {
  if (state.variantId !== 'vanishing_ttt') {
    throw new Error(`VanishingTTT received wrong variantId: ${state.variantId}`);
  }
  return state as VanishingTTTState;
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkBoardWinner(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class VanishingTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: VanishingTTTState = {
      variantId: 'vanishing_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: [null, null, null, null, null, null, null, null, null],
      moveDates: [null, null, null, null, null, null, null, null, null],
      terminal: null,
    };
    return state;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) {
      return { ok: false, error: 'Game is over', state };
    }
    if (playerId !== s.currentPlayer) {
      return { ok: false, error: 'Not your turn', state };
    }

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newMoveDates = [...s.moveDates] as (number | null)[];
    newMoveDates[cellIndex] = s.moveCount + 1;

    const newMoveCount = s.moveCount + 1;

    const newState: VanishingTTTState = {
      variantId: 'vanishing_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: newMoveCount,
      board: newBoard,
      moveDates: newMoveDates,
      terminal: computeTerminal(newBoard),
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    for (let i = 0; i < s.board.length; i++) {
      if (s.board[i] === null) {
        moves.push({ data: { cellIndex: i } });
      }
    }
    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as VanishingTTTState;
  }
}
