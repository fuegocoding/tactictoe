import { SOSTTT } from '../rules/sos-ttt.js';
import type { SOSTTTState, SOSTTTMove } from '../rules/sos-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new SOSTTT();

export function getSOSAIMove(state: SOSTTTState, aiPlayer: Player, difficulty: AIDifficulty): SOSTTTMove {
  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;
  
  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return move.data as SOSTTTMove;
}
