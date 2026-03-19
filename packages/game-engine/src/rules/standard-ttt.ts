import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

interface StandardTTTState extends GameState {
  variantId: 'standard_3x3';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): StandardTTTState {
  if (state.variantId !== 'standard_3x3') {
    throw new Error(`StandardTTT received wrong variantId: ${state.variantId}`);
  }
  return state as StandardTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkBoardWinner(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class StandardTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: StandardTTTState = {
      variantId: 'standard_3x3',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
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

    const newState: StandardTTTState = {
      variantId: 'standard_3x3',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard),
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    return s.board
      .map((cell, i): Move | null => (cell === null ? { data: { cellIndex: i } } : null))
      .filter((m): m is Move => m !== null);
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as StandardTTTState;
  }
}
