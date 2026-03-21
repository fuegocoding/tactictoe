import type { GameRules, Player } from './interface.js';
import type { Board, GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';



export interface SOSTTTMove {
  cellIndex: number;
  symbol: 'S' | 'O';
}

export interface SOSTTTState extends GameState {
  variantId: 'sos_ttt';
  board: Board;
  scores: { X: number; O: number };
  terminal: TerminalResult | null;
}

function castState(state: GameState): SOSTTTState {
  if (state.variantId !== 'sos_ttt') throw new Error(`SOSTTT received wrong variantId: ${state.variantId}`);
  return state as SOSTTTState;
}

function emptyBoard(): Board {
  return Array(64).fill(null);
}

function countSOS(board: Board): number {
  let count = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (board[y * 8 + x] === 'O') {
        if (x > 0 && x < 7 && board[y * 8 + x - 1] === 'S' && board[y * 8 + x + 1] === 'S') count++;
        if (y > 0 && y < 7 && board[(y - 1) * 8 + x] === 'S' && board[(y + 1) * 8 + x] === 'S') count++;
        if (x > 0 && x < 7 && y > 0 && y < 7 && board[(y - 1) * 8 + x - 1] === 'S' && board[(y + 1) * 8 + x + 1] === 'S') count++;
        if (x > 0 && x < 7 && y > 0 && y < 7 && board[(y - 1) * 8 + x + 1] === 'S' && board[(y + 1) * 8 + x - 1] === 'S') count++;
      }
    }
  }
  return count;
}

function computeTerminal(board: Board, scores: { X: number; O: number }): TerminalResult | null {
  if (board.every(cell => cell !== null)) {
    if (scores.X > scores.O) return { winner: 'X', reason: 'win' };
    if (scores.O > scores.X) return { winner: 'O', reason: 'win' };
    return { winner: null, reason: 'draw' };
  }
  return null;
}

export class SOSTTT implements GameRules {
  initialize(_config: VariantConfig): GameState {
    return {
      variantId: 'sos_ttt',
      currentPlayer: 'X',
      moveCount: 0,
      board: emptyBoard(),
      scores: { X: 0, O: 0 },
      terminal: null,
    } as SOSTTTState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const { cellIndex, symbol } = move.data as SOSTTTMove;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 63) {
      return { ok: false, error: 'Cell index must be 0–63', state };
    }
    if (symbol !== 'S' && symbol !== 'O') {
      return { ok: false, error: 'Symbol must be S or O', state };
    }
    if (s.board[cellIndex] !== null) return { ok: false, error: 'Cell is occupied', state };

    const beforeSOS = countSOS(s.board);
    const newBoard = [...s.board] as Board;
    newBoard[cellIndex] = symbol;
    const afterSOS = countSOS(newBoard);
    
    const pointsScored = afterSOS - beforeSOS;
    const newScores = { ...s.scores, [playerId]: s.scores[playerId] + pointsScored };

    // Player gets another turn if they scored at least 1 point
    const nextPlayer = pointsScored > 0 ? s.currentPlayer : (s.currentPlayer === 'X' ? 'O' : 'X');

    const newState: SOSTTTState = {
      variantId: 'sos_ttt',
      currentPlayer: nextPlayer,
      moveCount: s.moveCount + 1,
      board: newBoard,
      scores: newScores,
      terminal: computeTerminal(newBoard, newScores),
    };
    return { ok: true, state: newState };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    const moves: Move[] = [];
    s.board.forEach((cell, i) => {
      if (cell === null) {
        moves.push({ data: { cellIndex: i, symbol: 'S' } });
        moves.push({ data: { cellIndex: i, symbol: 'O' } });
      }
    });
    return moves;
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as SOSTTTState; }
}
