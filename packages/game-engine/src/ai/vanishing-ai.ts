import { VanishingTTT } from '../rules/vanishing-ttt.js';
import type { VanishingTTTState } from '../rules/vanishing-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { checkBoardWinner } from '../rules/win-checker.js';

const engine = new VanishingTTT();

export function getVanishingAIMove(state: VanishingTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  if (legal.length === 0) throw new Error('No legal moves');
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;

  const best = getBestMove(state, aiPlayer);
  if (difficulty === 'medium') {
    return Math.random() < 0.6 ? best : legal[Math.floor(Math.random() * legal.length)]!;
  }
  return best;
}

function getBestMove(state: VanishingTTTState, aiPlayer: Player): number {
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

  // Prefer center, then corners, then edges
  const priority = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const ci of priority) {
    if (legal.includes(ci)) return ci;
  }

  return legal[0]!;
}
