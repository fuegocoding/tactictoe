import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { WIN_LINES_3D } from './ttt-3d.js';

/**
 * Ultimate 3D Tic-Tac-Toe
 *
 * Layout: A 3×3×3 meta-grid (27 macro-cells), each containing a 3×3×3 micro-grid (27 cells).
 * Total: 27 × 27 = 729 cells.
 *
 * Rules:
 * - Players alternate turns.
 * - Each move specifies a macro-cell (0–26) and a micro-cell (0–26) within it.
 * - Winning a macro-cell (getting 3-in-a-row in the micro-grid using 3D win lines)
 *   marks it as won in the meta-grid.
 * - CONSTRAINT: The micro-cell you play in determines which macro-cell your opponent
 *   must play in next (same as Ultimate TTT but in 3D).
 * - If the forced macro-cell is already won/drawn, the opponent may play anywhere.
 * - Win by getting 3-in-a-row of won macro-cells in the meta-grid (using 3D win lines).
 *
 * Move data: { macroCell: number, microCell: number }  (both 0–26)
 */

export interface Ultimate3DState extends GameState {
  variantId: 'ultimate_3d';
  /** 27 micro-boards, each with 27 cells. microBoards[macroCell][microCell] */
  microBoards: Board[];
  /** Win/draw result for each macro-cell (27 cells). null = still in play */
  macroResults: (Player | 'draw' | null)[];
  /** Which macro-cell the current player is constrained to, or null = free */
  nextMacroConstraint: number | null;
  terminal: TerminalResult | null;
}

export interface Ultimate3DMove {
  macroCell: number;
  microCell: number;
}

function checkBoard3D(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES_3D) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell as Player;
    }
  }
  return null;
}

function isBoard3DFull(board: Board): boolean {
  return board.every(c => c !== null);
}

function computeMacroResult(board: Board): Player | 'draw' | null {
  const winner = checkBoard3D(board);
  if (winner) return winner;
  if (isBoard3DFull(board)) return 'draw';
  return null;
}

function computeMetaTerminal(macroResults: (Player | 'draw' | null)[]): TerminalResult | null {
  const winner = checkBoard3D(macroResults as Board);
  if (winner) return { winner, reason: 'win' };
  if (macroResults.every(r => r !== null)) return { winner: null, reason: 'draw' };
  return null;
}

function castState(state: GameState): Ultimate3DState {
  if (state.variantId !== 'ultimate_3d') {
    throw new Error(`Ultimate3D received wrong variantId: ${state.variantId}`);
  }
  return state as Ultimate3DState;
}

export class Ultimate3D implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'ultimate_3d',
      currentPlayer: 'X',
      moveCount: 0,
      microBoards: Array.from({ length: 27 }, () => new Array(27).fill(null) as Board),
      macroResults: new Array(27).fill(null) as (Player | 'draw' | null)[],
      nextMacroConstraint: null,
      terminal: null,
    } as Ultimate3DState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { macroCell, microCell } = move.data as Ultimate3DMove;

    if (typeof macroCell !== 'number' || macroCell < 0 || macroCell > 26) {
      return { ok: false, error: 'macroCell must be 0–26', state };
    }
    if (typeof microCell !== 'number' || microCell < 0 || microCell > 26) {
      return { ok: false, error: 'microCell must be 0–26', state };
    }
    if (s.macroResults[macroCell] !== null) {
      return { ok: false, error: 'That macro-cell is already won or drawn', state };
    }
    if (s.nextMacroConstraint !== null && s.nextMacroConstraint !== macroCell) {
      return { ok: false, error: `Must play in macro-cell ${s.nextMacroConstraint}`, state };
    }
    if (s.microBoards[macroCell]![microCell] !== null) {
      return { ok: false, error: 'That micro-cell is already occupied', state };
    }

    // Apply move to the micro-board
    const newMicroBoards = s.microBoards.map((b, i) =>
      i === macroCell ? [...b] as Board : b
    );
    newMicroBoards[macroCell]![microCell] = s.currentPlayer;

    // Update macro result for this macro-cell
    const newMacroResults = [...s.macroResults] as (Player | 'draw' | null)[];
    const microResult = computeMacroResult(newMicroBoards[macroCell]!);
    newMacroResults[macroCell] = microResult;

    // Determine next constraint: microCell determines next macro-cell
    // If that macro-cell is already decided, the next player is free
    let nextConstraint: number | null = microCell;
    if (newMacroResults[microCell] !== null) {
      nextConstraint = null;
    }

    const terminal = computeMetaTerminal(newMacroResults);

    const newState: Ultimate3DState = {
      variantId: 'ultimate_3d',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      microBoards: newMicroBoards,
      macroResults: newMacroResults,
      nextMacroConstraint: terminal ? null : nextConstraint,
      terminal,
    };

    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];

    const moves: Move[] = [];
    const allowedMacro: number[] = s.nextMacroConstraint !== null
      ? [s.nextMacroConstraint]
      : Array.from({ length: 27 }, (_, i) => i).filter(i => s.macroResults[i] === null);

    for (const macroCell of allowedMacro) {
      if (s.macroResults[macroCell] !== null) continue;
      const board = s.microBoards[macroCell]!;
      for (let microCell = 0; microCell < 27; microCell++) {
        if (board[microCell] === null) {
          moves.push({ data: { macroCell, microCell } as Ultimate3DMove });
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
    return JSON.parse(s) as Ultimate3DState;
  }
}
