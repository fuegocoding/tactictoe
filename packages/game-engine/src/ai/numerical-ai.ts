import { NumericalTTT } from '../rules/numerical-ttt.js';
import type { NumericalTTTState, NumericalTTTMove } from '../rules/numerical-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new NumericalTTT();

export function getNumericalAIMove(state: NumericalTTTState, aiPlayer: Player, difficulty: AIDifficulty): NumericalTTTMove {
  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;
  
  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return move.data as NumericalTTTMove;
}
