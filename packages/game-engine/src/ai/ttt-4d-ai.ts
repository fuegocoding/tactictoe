import { TTT4D, WIN_LINES_4D } from '../rules/ttt-4d.js';
import type { TTT4DState } from '../rules/ttt-4d.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new TTT4D();

export function getTTT4DAIMove(state: TTT4DState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  if (legal.length === 0) throw new Error('No legal moves');
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;

  const best = getBestMove(state, aiPlayer);
  if (difficulty === 'medium') {
    return Math.random() < 0.6 ? best : legal[Math.floor(Math.random() * legal.length)]!;
  }
  return best;
}

function scoreBoard(board: (string | number | null)[], aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;
  for (const [a, b, c] of WIN_LINES_4D) {
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter(x => x === aiPlayer).length;
    const oppCount = cells.filter(x => x === opponent).length;
    if (aiCount > 0 && oppCount === 0) score += aiCount * aiCount;
    if (oppCount > 0 && aiCount === 0) score -= oppCount * oppCount;
  }
  return score;
}

function getBestMove(state: TTT4DState, aiPlayer: Player): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';

  // Win immediately
  for (const ci of legal) {
    const result = engine.applyMove(state, { data: { cellIndex: ci } }, aiPlayer);
    if (result.ok && engine.checkTerminal(result.state)?.winner === aiPlayer) return ci;
  }

  // Block opponent
  for (const ci of legal) {
    const result = engine.applyMove(state, { data: { cellIndex: ci } }, opponent);
    if (result.ok && engine.checkTerminal(result.state)?.winner === opponent) return ci;
  }

  // Pick cell with best heuristic score
  let bestScore = -Infinity;
  let bestMove = legal[0]!;
  for (const ci of legal) {
    const result = engine.applyMove(state, { data: { cellIndex: ci } }, aiPlayer);
    if (!result.ok) continue;
    const s = scoreBoard((result.state as TTT4DState).board, aiPlayer);
    if (s > bestScore) { bestScore = s; bestMove = ci; }
  }
  return bestMove;
}
