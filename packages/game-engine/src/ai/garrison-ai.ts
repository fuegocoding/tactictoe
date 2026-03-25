import { Garrison } from '../rules/garrison.js';
import type { GarrisonState, GarrisonMove } from '../rules/garrison.js';
import type { Player } from '../rules/interface.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new Garrison();

export function getGarrisonAIMove(
  state: GarrisonState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): GarrisonMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal garrison moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return move.data as GarrisonMove;
}
