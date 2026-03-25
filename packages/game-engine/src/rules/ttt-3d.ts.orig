import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

/**
 * 3D Tic-Tac-Toe on a 3×3×3 grid.
 *
 * Cell indexing: cellIndex = layer * 9 + row * 3 + col
 *   layer ∈ {0,1,2}, row ∈ {0,1,2}, col ∈ {0,1,2}
 *
 * The board is displayed as 3 separate 2D grids (one per layer).
 * Win condition: first to get 3 in a row in any of the 49 possible lines.
 */

export interface TTT3DState extends GameState {
  variantId: 'ttt_3d';
  board: Board; // 27 cells
  terminal: TerminalResult | null;
}

// Build all 49 win lines for a 3x3x3 cube.
function buildWinLines3D(): readonly (readonly [number, number, number])[] {
  const lines: [number, number, number][] = [];

  function idx(l: number, r: number, c: number): number {
    return l * 9 + r * 3 + c;
  }

  // Lines parallel to x-axis (vary col, fix layer & row)
  for (let l = 0; l < 3; l++) {
    for (let r = 0; r < 3; r++) {
      lines.push([idx(l, r, 0), idx(l, r, 1), idx(l, r, 2)]);
    }
  }

  // Lines parallel to y-axis (vary row, fix layer & col)
  for (let l = 0; l < 3; l++) {
    for (let c = 0; c < 3; c++) {
      lines.push([idx(l, 0, c), idx(l, 1, c), idx(l, 2, c)]);
    }
  }

  // Diagonals in each layer (xy-plane, vary row & col, fix layer)
  for (let l = 0; l < 3; l++) {
    lines.push([idx(l, 0, 0), idx(l, 1, 1), idx(l, 2, 2)]);
    lines.push([idx(l, 0, 2), idx(l, 1, 1), idx(l, 2, 0)]);
  }

  // Lines parallel to z-axis (vary layer, fix row & col)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      lines.push([idx(0, r, c), idx(1, r, c), idx(2, r, c)]);
    }
  }

  // Diagonals in xz-plane (vary col & layer, fix row)
  for (let r = 0; r < 3; r++) {
    lines.push([idx(0, r, 0), idx(1, r, 1), idx(2, r, 2)]);
    lines.push([idx(0, r, 2), idx(1, r, 1), idx(2, r, 0)]);
  }

  // Diagonals in yz-plane (vary row & layer, fix col)
  for (let c = 0; c < 3; c++) {
    lines.push([idx(0, 0, c), idx(1, 1, c), idx(2, 2, c)]);
    lines.push([idx(0, 2, c), idx(1, 1, c), idx(2, 0, c)]);
  }

  // Space diagonals (vary all 3 dimensions)
  lines.push([idx(0, 0, 0), idx(1, 1, 1), idx(2, 2, 2)]);
  lines.push([idx(0, 0, 2), idx(1, 1, 1), idx(2, 2, 0)]);
  lines.push([idx(0, 2, 0), idx(1, 1, 1), idx(2, 0, 2)]);
  lines.push([idx(0, 2, 2), idx(1, 1, 1), idx(2, 0, 0)]);

  return lines;
}

export const WIN_LINES_3D = buildWinLines3D();

function checkWinner3D(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES_3D) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell as Player;
    }
  }
  return null;
}

function isBoardFull3D(board: Board): boolean {
  return board.every(c => c !== null);
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkWinner3D(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (isBoardFull3D(board)) return { winner: null, reason: 'draw' };
  return null;
}

function castState(state: GameState): TTT3DState {
  if (state.variantId !== 'ttt_3d') {
    throw new Error(`TTT3D received wrong variantId: ${state.variantId}`);
  }
  return state as TTT3DState;
}

export class TTT3D implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'ttt_3d',
      currentPlayer: 'X',
      moveCount: 0,
      board: new Array(27).fill(null) as Board,
      terminal: null,
    } as TTT3DState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 26) {
      return { ok: false, error: 'Cell index must be 0–26', state };
    }
    if (s.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newState: TTT3DState = {
      variantId: 'ttt_3d',
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
    return JSON.parse(s) as TTT3DState;
  }
}
