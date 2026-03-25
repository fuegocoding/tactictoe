import { VanishingTTT } from '../rules/vanishing-ttt.js';
import type { VanishingTTTState } from '../rules/vanishing-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new VanishingTTT();

export function getVanishingAIMove(state: VanishingTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return (move.data as { cellIndex: number }).cellIndex;
}
