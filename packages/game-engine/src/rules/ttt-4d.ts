import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

/**
 * 4D Tic-Tac-Toe on a 3×3×3×3 grid (81 cells).
 *
 * Cell indexing: cellIndex = d0*27 + d1*9 + d2*3 + d3
 *   d0, d1, d2, d3 ∈ {0,1,2}
 *
 * Win condition: first to get 3-in-a-row along any of the 4D axes/diagonals.
 *
 * A "line" is any 3-cell set where each of the 4 coordinates either
 * stays constant OR increases by 1 uniformly (can't decrease).
 * Total lines: sum of 3^(4-k) * C(4,k) * 2^(k-1) for k=1..4
 *   = 3*4 + 6*2 + 4*... = complicated, let's just enumerate them.
 *
 * Display: 9 mini-boards arranged in a 3×3 meta-grid.
 *   The meta-grid position (metaRow, metaCol) corresponds to (d0, d1).
 *   Within each mini-board, position (row, col) corresponds to (d2, d3).
 *   So boardIndex = d0*3 + d1, cellIndex_within = d2*3 + d3.
 */

export interface TTT4DState extends GameState {
  variantId: 'ttt_4d';
  board: Board; // 81 cells
  terminal: TerminalResult | null;
}

function idx4(d0: number, d1: number, d2: number, d3: number): number {
  return d0 * 27 + d1 * 9 + d2 * 3 + d3;
}

function buildWinLines4D(): readonly (readonly [number, number, number])[] {
  const lines: [number, number, number][] = [];

  // A line is defined by a starting point (d0,d1,d2,d3) and a direction (delta for each dim: -1, 0, +1)
  // where the 3-in-a-row goes in the "positive" direction (to avoid duplicates,
  // we only take deltas where the first non-zero delta is +1).
  // For 4 dimensions, each can have delta in {-1, 0, +1}, giving 3^4 = 81 direction vectors,
  // but half are reversed duplicates → ~40 unique non-zero directions.

  const deltas: number[][] = [];
  for (let d0 = -1; d0 <= 1; d0++) {
    for (let d1 = -1; d1 <= 1; d1++) {
      for (let d2 = -1; d2 <= 1; d2++) {
        for (let d3 = -1; d3 <= 1; d3++) {
          if (d0 === 0 && d1 === 0 && d2 === 0 && d3 === 0) continue;
          // Only keep directions where the first non-zero delta is +1
          const arr = [d0, d1, d2, d3];
          const first = arr.find(x => x !== 0)!;
          if (first === 1) {
            deltas.push(arr);
          }
        }
      }
    }
  }

  for (const delta of deltas) {
    const [dd0, dd1, dd2, dd3] = delta as [number, number, number, number];
    // Enumerate all starting points that keep the line in bounds
    for (let s0 = 0; s0 < 3; s0++) {
      for (let s1 = 0; s1 < 3; s1++) {
        for (let s2 = 0; s2 < 3; s2++) {
          for (let s3 = 0; s3 < 3; s3++) {
            // Check all 3 steps stay in bounds
            const cells: number[] = [];
            let valid = true;
            for (let step = 0; step < 3; step++) {
              const c0 = s0 + step * dd0;
              const c1 = s1 + step * dd1;
              const c2 = s2 + step * dd2;
              const c3 = s3 + step * dd3;
              if (c0 < 0 || c0 > 2 || c1 < 0 || c1 > 2 || c2 < 0 || c2 > 2 || c3 < 0 || c3 > 2) {
                valid = false;
                break;
              }
              cells.push(idx4(c0, c1, c2, c3));
            }
            if (valid && cells.length === 3) {
              lines.push(cells as [number, number, number]);
            }
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = [...line].sort((a, b) => a - b).join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const WIN_LINES_4D = buildWinLines4D();

function checkWinner4D(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES_4D) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell as Player;
    }
  }
  return null;
}

function computeTerminal(board: Board): TerminalResult | null {
  const winner = checkWinner4D(board);
  if (winner !== null) return { winner, reason: 'win' };
  if (board.every(c => c !== null)) return { winner: null, reason: 'draw' };
  return null;
}

function castState(state: GameState): TTT4DState {
  if (state.variantId !== 'ttt_4d') {
    throw new Error(`TTT4D received wrong variantId: ${state.variantId}`);
  }
  return state as TTT4DState;
}

export class TTT4D implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'ttt_4d',
      currentPlayer: 'X',
      moveCount: 0,
      board: new Array(81).fill(null) as Board,
      terminal: null,
    } as TTT4DState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);

    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex } = move.data as { cellIndex: number };
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 80) {
      return { ok: false, error: 'Cell index must be 0–80', state };
    }
    if (s.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is occupied', state };
    }

    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = s.currentPlayer;

    const newState: TTT4DState = {
      variantId: 'ttt_4d',
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
    for (let i = 0; i < 81; i++) {
      if (s.board[i] === null) {
        moves.push({ data: { cellIndex: i } });
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
    return JSON.parse(s) as TTT4DState;
  }
}
