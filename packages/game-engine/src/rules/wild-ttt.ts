// packages/game-engine/src/rules/wild-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

export interface WildTTTMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export interface WildTTTState extends GameState {
  variantId: 'wild_ttt';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): WildTTTState {
  if (state.variantId !== 'wild_ttt') throw new Error(`WildTTT received wrong variantId: ${state.variantId}`);
  return state as WildTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * In Wild TTT, the player who completes 3-in-a-row wins.
 * lastPlayer is the player who just placed the completing symbol.
 */
function computeTerminal(board: Board, lastPlayer: Player): TerminalResult | null {
  const lineExists = checkBoardWinner(board) !== null;
  if (lineExists) return { winner: lastPlayer, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

export class WildTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'wild_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as WildTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex, symbol } = move.data as WildTTTMove;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (symbol !== 'X' && symbol !== 'O') {
      return { ok: false, error: 'Symbol must be X or O', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = symbol;

    const newState: WildTTTState = {
      variantId: 'wild_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard, s.currentPlayer),
    };
    return { ok: true, state: newState };
  }

  /** Each empty cell has 2 possible moves (place X or place O). */
  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    s.board.forEach((cell, i) => {
      if (cell === null) {
        moves.push({ data: { cellIndex: i, symbol: 'X' } });
        moves.push({ data: { cellIndex: i, symbol: 'O' } });
      }
    });
    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as WildTTTState; }
}
