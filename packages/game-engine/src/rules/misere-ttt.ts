// packages/game-engine/src/rules/misere-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

export interface MisereTTTState extends GameState {
  variantId: 'misere_ttt';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): MisereTTTState {
  if (state.variantId !== 'misere_ttt') {
    throw new Error(`MisereTTT received wrong variantId: ${state.variantId}`);
  }
  return state as MisereTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * In Misère, completing 3-in-a-row means you LOSE.
 * checkBoardWinner returns the symbol of the line — that player loses, the other wins.
 */
function computeTerminal(board: Board): TerminalResult | null {
  const loser = checkBoardWinner(board);
  if (loser !== null) {
    const winner: Player = loser === 'X' ? 'O' : 'X';
    return { winner, reason: 'win' };
  }
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class MisereTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'misere_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as MisereTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newState: MisereTTTState = {
      variantId: 'misere_ttt',
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

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as MisereTTTState; }
}
