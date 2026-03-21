import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { WIN_LINES_3D } from './ttt-3d.js';

/**
 * Tactic Toe — 3D Tic-Tac-Toe with random obstacles.
 *
 * Played on a 3×3×3 grid (27 cells).
 * At the start of the game, 8 obstacle tokens are placed on random cells.
 *
 * On each turn, a player may either:
 *   1. Place their mark (X or O) on any empty non-obstacle cell, OR
 *   2. Move one obstacle from its current cell to any other empty non-obstacle cell.
 *
 * Win condition: first to get 3-in-a-row (obstacles don't count for wins).
 * Obstacles block placement but not win-line detection through empty space.
 *
 * Move data:
 *   { type: 'place', cellIndex: number }
 *   { type: 'move_obstacle', fromCell: number, toCell: number }
 */

export interface TacticToeState extends GameState {
  variantId: 'tactic_toe';
  /**
   * 27-cell board:
   *   null     = empty
   *   'X'      = X piece
   *   'O'      = O piece
   *   'B'      = obstacle (Block)
   */
  board: Board;
  terminal: TerminalResult | null;
}

export type TacticToeMove =
  | { type: 'place'; cellIndex: number }
  | { type: 'move_obstacle'; fromCell: number; toCell: number };

function checkWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES_3D) {
    const cell = board[a];
    // Obstacles ('B') never form a winning line
    if (cell !== null && cell !== 'B' && cell === board[b] && cell === board[c]) {
      return cell as Player;
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every(c => c !== null);
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkWinner(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (isBoardFull(board)) return { winner: null, reason: 'draw' };
  return null;
}

function castState(state: GameState): TacticToeState {
  if (state.variantId !== 'tactic_toe') {
    throw new Error(`TacticToe received wrong variantId: ${state.variantId}`);
  }
  return state as TacticToeState;
}

/** Place 8 obstacles on random non-overlapping cells. */
function placeObstacles(seed: number): number[] {
  // Deterministic seeded shuffle for reproducibility
  const cells = Array.from({ length: 27 }, (_, i) => i);
  let s = seed;
  for (let i = cells.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells.slice(0, 8);
}

export class TacticToe implements GameRules {
  initialize(config: VariantConfig): GameState {
    const seed = typeof config['seed'] === 'number' ? config['seed'] : Date.now();
    const board: Board = new Array(27).fill(null);
    for (const idx of placeObstacles(seed)) {
      board[idx] = 'B';
    }
    return {
      variantId: 'tactic_toe',
      currentPlayer: 'X',
      moveCount: 0,
      board,
      terminal: null,
    } as TacticToeState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const data = move.data as TacticToeMove;

    if (data.type === 'place') {
      const { cellIndex } = data;
      if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 26) {
        return { ok: false, error: 'Cell index must be 0–26', state };
      }
      if (s.board[cellIndex] !== null) {
        return { ok: false, error: s.board[cellIndex] === 'B' ? 'Cell is blocked by an obstacle' : 'Cell is occupied', state };
      }

      const newBoard = [...s.board] as Board;
      newBoard[cellIndex] = s.currentPlayer;

      const newState: TacticToeState = {
        variantId: 'tactic_toe',
        currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
        moveCount: s.moveCount + 1,
        board: newBoard,
        terminal: computeTerminal(newBoard),
      };
      return { ok: true, state: newState };
    }

    if (data.type === 'move_obstacle') {
      const { fromCell, toCell } = data;
      if (typeof fromCell !== 'number' || fromCell < 0 || fromCell > 26) {
        return { ok: false, error: 'fromCell must be 0–26', state };
      }
      if (typeof toCell !== 'number' || toCell < 0 || toCell > 26) {
        return { ok: false, error: 'toCell must be 0–26', state };
      }
      if (s.board[fromCell] !== 'B') {
        return { ok: false, error: 'No obstacle at fromCell', state };
      }
      if (s.board[toCell] !== null) {
        return { ok: false, error: 'Target cell is not empty', state };
      }
      if (fromCell === toCell) {
        return { ok: false, error: 'Must move obstacle to a different cell', state };
      }

      const newBoard = [...s.board] as Board;
      newBoard[fromCell] = null;
      newBoard[toCell] = 'B';

      const newState: TacticToeState = {
        variantId: 'tactic_toe',
        currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
        moveCount: s.moveCount + 1,
        board: newBoard,
        terminal: computeTerminal(newBoard),
      };
      return { ok: true, state: newState };
    }

    return { ok: false, error: 'Invalid move type', state };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];

    // Place moves
    for (let i = 0; i < 27; i++) {
      if (s.board[i] === null) {
        moves.push({ data: { type: 'place', cellIndex: i } as TacticToeMove });
      }
    }

    // Obstacle move moves
    for (let from = 0; from < 27; from++) {
      if (s.board[from] !== 'B') continue;
      for (let to = 0; to < 27; to++) {
        if (s.board[to] === null) {
          moves.push({ data: { type: 'move_obstacle', fromCell: from, toCell: to } as TacticToeMove });
        }
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
    return JSON.parse(s) as TacticToeState;
  }
}
