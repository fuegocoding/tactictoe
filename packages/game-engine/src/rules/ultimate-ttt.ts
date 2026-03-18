import type { GameRules, Player } from './interface.js';
import type { Board, BoardResult, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { checkBoardWinner, isBoardFull } from './win-checker.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UltimateTTTMove {
  boardIndex: number;
  cellIndex: number;
}

export interface UltimateTTTState extends GameState {
  variantId: 'ultimate_ttt';
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
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
 * Design note: `terminal` is also cached in UltimateTTTState for clients,
 * but checkTerminal always recomputes so deserialized states with terminal=null
 * are handled correctly. Both derive from boardResults so they always agree.
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

// ─── UltimateTTT ─────────────────────────────────────────────────────────────

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

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    // Guard: game already over
    if (s.terminal !== null) {
      return { ok: false, error: 'Game is over', state };
    }

    // Guard: wrong player
    if (playerId !== s.currentPlayer) {
      return { ok: false, error: 'Not your turn', state };
    }

    const { boardIndex, cellIndex } = move.data as UltimateTTTMove;

    // Guard: out-of-bounds
    if (typeof boardIndex !== 'number' || boardIndex < 0 || boardIndex > 8) {
      return { ok: false, error: 'boardIndex must be 0–8', state };
    }
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'cellIndex must be 0–8', state };
    }

    // Guard: board constraint
    // If constrained AND the constrained board is still open, must play there.
    const constraint = s.nextBoardConstraint;
    if (constraint !== null && isBoardOpen(s.boardResults, constraint)) {
      if (boardIndex !== constraint) {
        return { ok: false, error: `Wrong board: must play in board ${constraint}`, state };
      }
    }

    // Guard: target board already settled
    if (!isBoardOpen(s.boardResults, boardIndex)) {
      return { ok: false, error: 'That mini-board is already finished', state };
    }

    // Guard: cell occupied
    const targetBoard = s.boards[boardIndex]!;
    if (targetBoard[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    // ── Apply the move ──

    // Deep-copy only the modified board
    const newBoards = s.boards.map((b, i) =>
      i === boardIndex ? ([...b] as Board) : b
    ) as UltimateTTTState['boards'];
    newBoards[boardIndex]![cellIndex] = s.currentPlayer;

    // Recompute boardResults for the affected board only
    const newBoardResults = s.boardResults.map((r, i) =>
      i === boardIndex ? computeBoardResult(newBoards[boardIndex]!) : r
    ) as UltimateTTTState['boardResults'];

    // Determine next board constraint: cellIndex of this move → board index for next player
    // If that board is closed, next player gets free choice (null)
    const nextConstraint = isBoardOpen(newBoardResults, cellIndex) ? cellIndex : null;

    // Check meta-terminal
    const terminal = computeMetaTerminal(newBoardResults);

    const newState: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      boards: newBoards,
      boardResults: newBoardResults,
      nextBoardConstraint: terminal !== null ? null : nextConstraint,
      terminal,
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];

    const constraint = s.nextBoardConstraint;
    const moves: Move[] = [];

    // Determine which boards are valid targets
    const validBoards =
      constraint !== null && isBoardOpen(s.boardResults, constraint)
        ? [constraint]
        : s.boardResults
            .map((r, i) => (r === null ? i : -1))
            .filter((i) => i !== -1);

    for (const bi of validBoards) {
      const board = s.boards[bi]!;
      for (let ci = 0; ci < 9; ci++) {
        if (board[ci] === null) {
          moves.push({ data: { boardIndex: bi, cellIndex: ci } });
        }
      }
    }

    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    const s = castState(state);
    return computeMetaTerminal(s.boardResults);
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(s: string): GameState {
    return JSON.parse(s) as UltimateTTTState;
  }
}
