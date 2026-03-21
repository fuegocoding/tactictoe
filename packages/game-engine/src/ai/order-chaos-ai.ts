import { OrderChaos } from '../rules/order-chaos.js';
import type { OrderChaosState, OrderChaosMove } from '../rules/order-chaos.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new OrderChaos();

export interface OrderChaosAIMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export function getOrderChaosAIMove(
  state: OrderChaosState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): OrderChaosAIMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  if (difficulty === 'easy') {
    const m = legal[Math.floor(Math.random() * legal.length)]!.data as OrderChaosMove;
    return { cellIndex: m.cellIndex, symbol: m.symbol };
  }

  const best = getBestMove(state, aiPlayer);

  if (difficulty === 'medium') {
    if (Math.random() < 0.6) return best;
    const m = legal[Math.floor(Math.random() * legal.length)]!.data as OrderChaosMove;
    return { cellIndex: m.cellIndex, symbol: m.symbol };
  }

  return best;
}

const COLS = 6;

/** Check if placing `symbol` at `cellIndex` would create a 5-in-a-row */
function wouldWin(board: (string | number | null)[], cellIndex: number, symbol: 'X' | 'O'): boolean {
  const testBoard = [...board];
  testBoard[cellIndex] = symbol;
  const rows = 6;
  const cols = 6;
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const r = Math.floor(cellIndex / cols);
  const c = cellIndex % cols;
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr! * i;
      const nc = c + dc! * i;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
      if (testBoard[nr * cols + nc] === symbol) count++;
      else break;
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr! * i;
      const nc = c - dc! * i;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
      if (testBoard[nr * cols + nc] === symbol) count++;
      else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

function getBestMove(state: OrderChaosState, aiPlayer: Player): OrderChaosAIMove {
  const isOrder = aiPlayer === 'X';
  const legal = engine.getLegalMoves(state);

  if (isOrder) {
    // Order tries to create 5-in-a-row
    // Try to win
    for (const mv of legal) {
      const m = mv.data as OrderChaosMove;
      if (wouldWin(state.board, m.cellIndex, m.symbol)) {
        return { cellIndex: m.cellIndex, symbol: m.symbol };
      }
    }

    // Find the move that builds the longest line
    let bestScore = -1;
    let bestMove: OrderChaosAIMove = { cellIndex: 0, symbol: 'X' };
    const emptyCells = Array.from({ length: 36 }, (_, i) => i).filter(i => state.board[i] === null);

    for (const ci of emptyCells) {
      for (const sym of ['X', 'O'] as const) {
        const testBoard = [...state.board];
        testBoard[ci] = sym;
        let maxLine = 0;
        const rows = 6;
        const cols = 6;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        const r = Math.floor(ci / cols);
        const c = ci % cols;
        for (const [dr, dc] of directions) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const nr = r + dr! * i;
            const nc = c + dc! * i;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
            if (testBoard[nr * cols + nc] === sym) count++;
            else break;
          }
          for (let i = 1; i < 5; i++) {
            const nr = r - dr! * i;
            const nc = c - dc! * i;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
            if (testBoard[nr * cols + nc] === sym) count++;
            else break;
          }
          if (count > maxLine) maxLine = count;
        }
        if (maxLine > bestScore) {
          bestScore = maxLine;
          bestMove = { cellIndex: ci, symbol: sym };
        }
      }
    }
    return bestMove;
  } else {
    // Chaos tries to prevent 5-in-a-row
    // Block any imminent Order win (check both X and O symbols)
    const emptyCells = Array.from({ length: 36 }, (_, i) => i).filter(i => state.board[i] === null);

    for (const ci of emptyCells) {
      for (const sym of ['X', 'O'] as const) {
        if (wouldWin(state.board, ci, sym)) {
          // Chaos should not place here — or place the OTHER symbol
          const safeSymbol = sym === 'X' ? 'O' : 'X';
          if (!wouldWin(state.board, ci, safeSymbol)) {
            return { cellIndex: ci, symbol: safeSymbol };
          }
          // Both symbols win here — place anywhere else
          continue;
        }
      }
    }

    // Prefer cells that don't extend any line
    for (const ci of emptyCells) {
      const xWins = wouldWin(state.board, ci, 'X');
      const oWins = wouldWin(state.board, ci, 'O');
      if (!xWins && !oWins) {
        return { cellIndex: ci, symbol: Math.random() < 0.5 ? 'X' : 'O' };
      }
    }

    // Fallback: pick random
    const m = legal[Math.floor(Math.random() * legal.length)]!.data as OrderChaosMove;
    return { cellIndex: m.cellIndex, symbol: m.symbol };
  }
}
