import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

/**
 * Order and Chaos — a two-player game invented by Stephen Sniderman.
 *
 * Played on a 6×6 grid (36 cells).
 *
 * Player roles:
 *   - "Order" plays as X internally. Goal: create 5-in-a-row of the SAME symbol.
 *   - "Chaos" plays as O internally. Goal: fill the board WITHOUT any 5-in-a-row.
 *
 * On each turn the active player may place EITHER an X or an O on any empty cell.
 * Both players can place either symbol — the choice of symbol is part of the strategy.
 *
 * Move data: { cellIndex: number, symbol: 'X' | 'O' }
 */

export interface OrderChaosState extends GameState {
  variantId: 'order_chaos';
  /** 36-cell board. Each cell is 'X', 'O', or null. */
  board: Board;
  terminal: TerminalResult | null;
}

export interface OrderChaosMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

const COLS = 6;
const ROWS = 6;
const SIZE = 36;

function buildWinLines6x6(): readonly (readonly number[])[] {
  const lines: number[][] = [];

  // Rows
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 5; c++) {
      lines.push([0, 1, 2, 3, 4].map(i => r * COLS + c + i));
    }
  }

  // Columns
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 5; r++) {
      lines.push([0, 1, 2, 3, 4].map(i => (r + i) * COLS + c));
    }
  }

  // Diagonals (top-left to bottom-right)
  for (let r = 0; r <= ROWS - 5; r++) {
    for (let c = 0; c <= COLS - 5; c++) {
      lines.push([0, 1, 2, 3, 4].map(i => (r + i) * COLS + (c + i)));
    }
  }

  // Diagonals (top-right to bottom-left)
  for (let r = 0; r <= ROWS - 5; r++) {
    for (let c = 4; c < COLS; c++) {
      lines.push([0, 1, 2, 3, 4].map(i => (r + i) * COLS + (c - i)));
    }
  }

  return lines;
}

export const WIN_LINES_6X6 = buildWinLines6x6();

export function getWinCells6x6(board: Board): number[] | null {
  for (const line of WIN_LINES_6X6) {
    const cell = board[line[0]];
    if (cell !== null && line.every(i => board[i] === cell)) return [...line];
  }
  return null;
}

function checkOrderWin(board: Board): boolean {
  for (const line of WIN_LINES_6X6) {
    const first = board[line[0]!];
    if (first === null) continue;
    if (line.every(i => board[i] === first)) return true;
  }
  return false;
}

function computeTerminal(board: Board): TerminalResult | null {
  if (checkOrderWin(board)) {
    // Order wins — Order is player X internally
    return { winner: 'X', reason: 'win' };
  }
  if (board.every(c => c !== null)) {
    // Board full without 5-in-a-row — Chaos wins
    return { winner: 'O', reason: 'win' };
  }
  return null;
}

function castState(state: GameState): OrderChaosState {
  if (state.variantId !== 'order_chaos') {
    throw new Error(`OrderChaos received wrong variantId: ${state.variantId}`);
  }
  return state as OrderChaosState;
}

export class OrderChaos implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'order_chaos',
      currentPlayer: 'X',
      moveCount: 0,
      board: new Array(SIZE).fill(null) as Board,
      terminal: null,
    } as OrderChaosState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex, symbol } = move.data as OrderChaosMove;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex >= SIZE) {
      return { ok: false, error: `Cell index must be 0–${SIZE - 1}`, state };
    }
    if (symbol !== 'X' && symbol !== 'O') {
      return { ok: false, error: 'Symbol must be X or O', state };
    }
    if (s.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = symbol;

    const newState: OrderChaosState = {
      variantId: 'order_chaos',
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
    for (let i = 0; i < SIZE; i++) {
      if (s.board[i] === null) {
        moves.push({ data: { cellIndex: i, symbol: 'X' } });
        moves.push({ data: { cellIndex: i, symbol: 'O' } });
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
    return JSON.parse(s) as OrderChaosState;
  }
}
