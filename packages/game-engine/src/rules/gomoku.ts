import type { GameRules, Player } from './interface.js';
import type { Board, Cell, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

export interface GomokuState extends GameState {
  variantId: 'gomoku';
  board: Board;
  terminal: TerminalResult | null;
}

function castState(state: GameState): GomokuState {
  if (state.variantId !== 'gomoku') throw new Error(`Gomoku received wrong variantId: ${state.variantId}`);
  return state as GomokuState;
}

function emptyBoard(): Board {
  return Array(225).fill(null);
}

function getCell(board: Board, x: number, y: number): Cell | undefined {
  if (x < 0 || x >= 15 || y < 0 || y >= 15) return undefined;
  return board[y * 15 + x];
}

// Check for 5 in a row
function computeTerminal(board: Board, lastMoveIdx: number, lastPlayer: string): TerminalResult | null {
  const x = lastMoveIdx % 15;
  const y = Math.floor(lastMoveIdx / 15);
  
  const directions = [
    [1, 0], // horizontal
    [0, 1], // vertical
    [1, 1], // diagonal right-down
    [1, -1] // diagonal right-up
  ] as const;

  for (const [dx, dy] of directions) {
    let count = 1;

    // Check forward
    let cx = x + dx;
    let cy = y + dy;
    while (getCell(board, cx, cy) === lastPlayer) {
      count++;
      cx += dx;
      cy += dy;
    }

    // Check backward
    cx = x - dx;
    cy = y - dy;
    while (getCell(board, cx, cy) === lastPlayer) {
      count++;
      cx -= dx;
      cy -= dy;
    }

    if (count >= 5) {
      return { winner: lastPlayer as Player, reason: 'win' };
    }
  }
  
  if (board.every(cell => cell !== null)) {
    return { winner: null, reason: 'draw' };
  }

  return null;
}

/**
 * Exported helper: given the 15x15 Gomoku board, returns the 5 winning cell
 * indices or null if no winner exists.
 */
export function getGomokuWinCells(board: Board): number[] | null {
  const COLS = 15;
  const WIN = 5;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

  for (let y = 0; y < COLS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y * COLS + x];
      if (!cell) continue;
      for (const [dx, dy] of directions) {
        const cells: number[] = [];
        for (let k = 0; k < WIN; k++) {
          const nx = x + dx * k;
          const ny = y + dy * k;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= COLS) break;
          if (board[ny * COLS + nx] !== cell) break;
          cells.push(ny * COLS + nx);
        }
        if (cells.length === WIN) return cells;
      }
    }
  }
  return null;
}

export class Gomoku implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'gomoku',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      terminal: null,
    } as GomokuState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex >= 225) {
      return { ok: false, error: 'Cell index must be 0–224', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const newBoard = [...s.board];
    newBoard[cellIndex] = playerId;

    const newState: GomokuState = {
      variantId: 'gomoku',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      terminal: computeTerminal(newBoard, cellIndex, playerId),
    };
    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    for (let i = 0; i < 225; i++) {
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
  deserialize(s: string): GameState { return JSON.parse(s) as GomokuState; }
}
