// packages/game-engine/src/ai/wild-ai.ts
import { WildTTT } from '../rules/wild-ttt.js';
import type { WildTTTState, WildTTTMove } from '../rules/wild-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new WildTTT();

export interface WildAIMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export function getWildAIMove(state: WildTTTState, aiPlayer: Player, difficulty: AIDifficulty): WildAIMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  if (legal.length === 0) throw new Error('No legal moves');
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;
  const best = minimaxBest(state, aiPlayer);
  if (difficulty === 'medium') return Math.random() < 0.6 ? best : legal[Math.floor(Math.random() * legal.length)]!;
  return best;
}

function minimaxBest(state: WildTTTState, aiPlayer: Player): WildAIMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  let bestScore = -Infinity;
  let bestMove = legal[0]!;
  for (const move of legal) {
    const result = engine.applyMove(state, { data: move }, aiPlayer);
    if (!result.ok) continue;
    const score = minimax(result.state as WildTTTState, 0, false, aiPlayer, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}

function minimax(
  state: WildTTTState,
  depth: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  alpha: number,
  beta: number,
): number {
  const terminal = engine.checkTerminal(state);
  if (terminal) {
    if (terminal.winner === aiPlayer) return 10 - depth;
    if (terminal.winner !== null) return depth - 10;
    return 0;
  }
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const currentPlayer = isMaximizing ? aiPlayer : opponent;
  const legal = engine.getLegalMoves(state).map(m => m.data as WildTTTMove);
  if (isMaximizing) {
    let best = -Infinity;
    for (const move of legal) {
      const r = engine.applyMove(state, { data: move }, currentPlayer);
      if (!r.ok) continue;
      best = Math.max(best, minimax(r.state as WildTTTState, depth + 1, false, aiPlayer, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of legal) {
      const r = engine.applyMove(state, { data: move }, currentPlayer);
      if (!r.ok) continue;
      best = Math.min(best, minimax(r.state as WildTTTState, depth + 1, true, aiPlayer, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}
