// packages/game-engine/src/rules/notakto-ttt.ts
import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner } from './win-checker.js';

export interface NotaktoTTTState extends GameState {
  variantId: 'notakto';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): NotaktoTTTState {
  if (state.variantId !== 'notakto') throw new Error(`NotaktoTTT received wrong variantId: ${state.variantId}`);
  return state as NotaktoTTTState;
}

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * Both players place X. Completing 3 X's in a row means you LOSE.
 * lastPlayer is the player who just placed the completing X.
 * Note: a full board of all-X cells always has at least one winning line,
 * so a draw is physically unreachable in single-board Notakto.
 */
function computeTerminal(board: Board, lastPlayer: Player): TerminalResult | null {
  const hasLine = checkBoardWinner(board) !== null; // only X's exist
  if (hasLine) {
    const winner: Player = lastPlayer === 'X' ? 'O' : 'X';
    return { winner, reason: 'win' };
  }
  return null;
}

export class NotaktoTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'notakto',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as NotaktoTTTState;
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
    newBoard[cellIndex] = 'X'; // Always X — both players use the same symbol

    const newState: NotaktoTTTState = {
      variantId: 'notakto',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard, s.currentPlayer),
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
  deserialize(s: string): GameState { return JSON.parse(s) as NotaktoTTTState; }
}
