import { UltimateTTT } from '../rules/ultimate-ttt.js';
import type { UltimateTTTState, UltimateTTTMove } from '../rules/ultimate-ttt.js';
import type { Player } from '../types.js';
import { mctsGetMove } from './mcts.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new UltimateTTT();

const ITERATIONS: Record<AIDifficulty, number> = {
  easy: 100,
  medium: 500,
  hard: 2000,
};

export function getUltimateAIMove(
  state: UltimateTTTState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): UltimateTTTMove {
  // Easy: 40% chance to play randomly (more human-like mistakes)
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const legal = engine.getLegalMoves(state);
    const move = legal[Math.floor(Math.random() * legal.length)]!;
    return move.data as UltimateTTTMove;
  }

  const move = mctsGetMove(state, engine, aiPlayer, ITERATIONS[difficulty]);
  return move.data as UltimateTTTMove;
}
