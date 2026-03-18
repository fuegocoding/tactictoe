import type { GameRules, Player } from './interface.js';
import type { Board, BoardResult, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UltimateTTTMove {
  boardIndex: number; // 0-8: which mini-board to play in
  cellIndex: number;  // 0-8: which cell within that mini-board
}

export interface UltimateTTTState extends GameState {
  variantId: 'ultimate_ttt';
  // 9 mini-boards, each a 9-cell Board
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  // Result of each mini-board: Player (won), 'draw', or null (still in play)
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  // null = current player may play in any non-terminal board
  // number = current player MUST play in this board index (unless that board is closed)
  nextBoardConstraint: number | null;
  terminal: TerminalResult | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

function castState(state: GameState): UltimateTTTState {
  if (state.variantId !== 'ultimate_ttt') {
    throw new Error(`UltimateTTT received wrong variantId: ${state.variantId}`);
  }
  return state as UltimateTTTState;
}

function computeBoardResult(board: Board): BoardResult {
  const winner = checkBoardWinner(board);
  if (winner !== null) return winner;
  if (isBoardFull(board)) return 'draw';
  return null;
}

/**
 * Check whether the meta-board has a winner or is fully drawn.
 * Always recomputes from boardResults (safe after deserialization).
 */
function computeMetaTerminal(boardResults: UltimateTTTState['boardResults']): TerminalResult | null {
  const metaCells = boardResults.map((r) =>
    r === 'X' || r === 'O' ? r : null
  ) as Board;
  const winner = checkBoardWinner(metaCells);
  if (winner !== null) return { winner, reason: 'win' };
  if (boardResults.every((r) => r !== null)) return { winner: null, reason: 'draw' };
  return null;
}

function isBoardOpen(boardResults: UltimateTTTState['boardResults'], boardIndex: number): boolean {
  return boardResults[boardIndex] === null;
}

// ─── UltimateTTT class ───────────────────────────────────────────────────────

export class UltimateTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    const state: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      boards: [
        emptyBoard(), emptyBoard(), emptyBoard(),
        emptyBoard(), emptyBoard(), emptyBoard(),
        emptyBoard(), emptyBoard(), emptyBoard(),
      ],
      boardResults: [null, null, null, null, null, null, null, null, null],
      nextBoardConstraint: null,
      terminal: null,
    };
    return state;
  }

  applyMove(_state: GameState, _move: Move, _playerId: Player): MoveResult {
    throw new Error('Not implemented');
  }

  getLegalMoves(_state: GameState): Move[] {
    throw new Error('Not implemented');
  }

  checkTerminal(state: GameState): TerminalResult | null {
    const s = castState(state);
    // Design note: `terminal` is cached in state and sent to clients, but we always
    // recompute here from boardResults so deserialized states (where terminal may be null)
    // are handled correctly. Both must agree since both derive from boardResults.
    return computeMetaTerminal(s.boardResults);
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as UltimateTTTState;
  }
}
