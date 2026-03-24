import type { GomokuState } from '../rules/gomoku.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

type Board = (Player | null)[];

const WIN_SCORE = 1_000_000;
const SIZE = 15;
const CENTER = 112; // idx(7, 7)

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function cellIdx(x: number, y: number): number {
  return y * SIZE + x;
}

function isWinningMove(board: Board, idx: number, player: Player): boolean {
  const x = idx % SIZE;
  const y = Math.floor(idx / SIZE);
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    let cx = x + dx, cy = y + dy;
    while (inBounds(cx, cy) && board[cellIdx(cx, cy)] === player) { count++; cx += dx; cy += dy; }
    cx = x - dx; cy = y - dy;
    while (inBounds(cx, cy) && board[cellIdx(cx, cy)] === player) { count++; cx -= dx; cy -= dy; }
    if (count >= 5) return true;
  }
  return false;
}

function getCandidateMoves(board: Board): number[] {
  const seen = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) continue;
    const x = i % SIZE, y = Math.floor(i / SIZE);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && board[cellIdx(nx, ny)] === null) seen.add(cellIdx(nx, ny));
      }
    }
  }
  return seen.size > 0 ? Array.from(seen) : [CENTER];
}

function scoreSequence(length: number, openEnds: number): number {
  if (length >= 5) return WIN_SCORE;
  if (openEnds === 0) return 0;
  if (length === 4) return openEnds === 2 ? 100_000 : 10_000;
  if (length === 3) return openEnds === 2 ? 5_000 : 500;
  if (length === 2) return openEnds === 2 ? 100 : 10;
  return openEnds === 2 ? 5 : 1;
}

function scoreForPlayer(board: Board, player: Player): number {
  let total = 0;
  for (const [dx, dy] of DIRECTIONS) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[cellIdx(x, y)] !== player) continue;
        // Only start counting from the beginning of a sequence
        if (inBounds(x - dx, y - dy) && board[cellIdx(x - dx, y - dy)] === player) continue;

        let len = 0;
        let cx = x, cy = y;
        while (inBounds(cx, cy) && board[cellIdx(cx, cy)] === player) { len++; cx += dx; cy += dy; }

        const beforeOpen = inBounds(x - dx, y - dy) && board[cellIdx(x - dx, y - dy)] === null;
        const afterOpen = inBounds(cx, cy) && board[cellIdx(cx, cy)] === null;
        total += scoreSequence(len, (beforeOpen ? 1 : 0) + (afterOpen ? 1 : 0));
      }
    }
  }
  return total;
}

function evaluate(board: Board, currentPlayer: Player): number {
  const opponent: Player = currentPlayer === 'X' ? 'O' : 'X';
  return scoreForPlayer(board, currentPlayer) - scoreForPlayer(board, opponent) * 1.1;
}

function negamax(board: Board, depth: number, alpha: number, beta: number, currentPlayer: Player): number {
  if (depth === 0) return evaluate(board, currentPlayer);

  const candidates = getCandidateMoves(board);
  const opponent: Player = currentPlayer === 'X' ? 'O' : 'X';
  let best = -Infinity;

  for (const idx of candidates) {
    board[idx] = currentPlayer;
    const score = isWinningMove(board, idx, currentPlayer)
      ? WIN_SCORE
      : -negamax(board, depth - 1, -beta, -alpha, opponent);
    board[idx] = null;

    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return best === -Infinity ? 0 : best;
}

function getBestMove(board: Board, depth: number, currentPlayer: Player): number {
  const candidates = getCandidateMoves(board);
  const opponent: Player = currentPlayer === 'X' ? 'O' : 'X';
  let bestScore = -Infinity;
  let bestMove = candidates[0]!;

  for (const idx of candidates) {
    board[idx] = currentPlayer;
    if (isWinningMove(board, idx, currentPlayer)) {
      board[idx] = null;
      return idx;
    }
    const score = -negamax(board, depth - 1, -Infinity, Infinity, opponent);
    board[idx] = null;
    if (score > bestScore) { bestScore = score; bestMove = idx; }
  }

  return bestMove;
}

/** Force-check immediate wins and blocks before any deeper search */
function immediateMove(board: Board, currentPlayer: Player, candidates: number[]): number | null {
  const opponent: Player = currentPlayer === 'X' ? 'O' : 'X';
  for (const idx of candidates) {
    board[idx] = currentPlayer;
    const wins = isWinningMove(board, idx, currentPlayer);
    board[idx] = null;
    if (wins) return idx;
  }
  for (const idx of candidates) {
    board[idx] = opponent;
    const blocks = isWinningMove(board, idx, opponent);
    board[idx] = null;
    if (blocks) return idx;
  }
  return null;
}

export function getGomokuAIMove(state: GomokuState, _aiPlayer: Player, difficulty: AIDifficulty): number {
  const board = [...state.board] as Board;
  const currentPlayer = state.currentPlayer;
  const candidates = getCandidateMoves(board);

  // All difficulties always take an immediate win or block an immediate loss
  const forced = immediateMove(board, currentPlayer, candidates);
  if (forced !== null) return forced;

  if (difficulty === 'easy') {
    if (Math.random() < 0.6) return candidates[Math.floor(Math.random() * candidates.length)]!;
    return getBestMove(board, 1, currentPlayer);
  }

  if (difficulty === 'medium') {
    if (Math.random() < 0.3) return candidates[Math.floor(Math.random() * candidates.length)]!;
    return getBestMove(board, 3, currentPlayer);
  }

  // Hard: depth 4 (strong without being slow)
  return getBestMove(board, 4, currentPlayer);
}
