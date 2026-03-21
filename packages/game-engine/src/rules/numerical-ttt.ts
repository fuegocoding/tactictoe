import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
] as const;

export interface NumericalTTTMove {
  cellIndex: number;
  numberPlaced: number;
}

export interface NumericalTTTState extends GameState {
  variantId: 'numerical_ttt';
  board: Board;
  availableOdds: number[];
  availableEvens: number[];
  terminal: TerminalResult | null;
}

function castState(state: GameState): NumericalTTTState {
  if (state.variantId !== 'numerical_ttt') throw new Error(`NumericalTTT received wrong variantId: ${state.variantId}`);
  return state as NumericalTTTState;
}

function computeTerminal(board: Board, lastPlayer: Player): TerminalResult | null {
  for (const [a, b, c] of WIN_LINES) {
    const valA = board[a];
    const valB = board[b];
    const valC = board[c];
    if (typeof valA === 'number' && typeof valB === 'number' && typeof valC === 'number') {
      if (valA + valB + valC === 15) {
        return { winner: lastPlayer, reason: 'win' };
      }
    }
  }
  
  if (board.every(cell => cell !== null)) {
    return { winner: null, reason: 'draw' };
  }
  return null;
}

export class NumericalTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'numerical_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: Array(9).fill(null),
      availableOdds: [1, 3, 5, 7, 9],
      availableEvens: [2, 4, 6, 8],
      terminal: null,
    } as NumericalTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex, numberPlaced } = move.data as NumericalTTTMove;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
      return { ok: false, error: 'Cell index must be 0–8', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const isOdd = numberPlaced % 2 !== 0;
    if (playerId === 'X' && !isOdd) return { ok: false, error: 'Player X must play odd numbers', state };
    if (playerId === 'O' && isOdd) return { ok: false, error: 'Player O must play even numbers', state };

    const availableList = isOdd ? s.availableOdds : s.availableEvens;
    if (!availableList.includes(numberPlaced)) {
      return { ok: false, error: `Number ${numberPlaced} has already been played or is invalid`, state };
    }

    const newBoard = [...s.board];
    newBoard[cellIndex] = numberPlaced;

    const newOdds = isOdd ? s.availableOdds.filter(n => n !== numberPlaced) : [...s.availableOdds];
    const newEvens = !isOdd ? s.availableEvens.filter(n => n !== numberPlaced) : [...s.availableEvens];

    const newState: NumericalTTTState = {
      variantId: 'numerical_ttt',
      currentPlayer: s.currentPlayer === 'X' ? 'O' : 'X',
      moveCount: s.moveCount + 1,
      board: newBoard,
      availableOdds: newOdds,
      availableEvens: newEvens,
      terminal: computeTerminal(newBoard, s.currentPlayer),
    };
    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    const available = s.currentPlayer === 'X' ? s.availableOdds : s.availableEvens;
    
    s.board.forEach((cell, i) => {
      if (cell === null) {
        for (const num of available) {
          moves.push({ data: { cellIndex: i, numberPlaced: num } });
        }
      }
    });
    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as NumericalTTTState; }
}
