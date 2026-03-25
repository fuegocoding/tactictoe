import { Ultimate3D } from '../rules/ultimate-3d.js';
import type { Ultimate3DState, Ultimate3DMove } from '../rules/ultimate-3d.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new Ultimate3D();

export interface Ultimate3DAIMove {
  macroCell: number;
  microCell: number;
}

export function getUltimate3DAIMove(
  state: Ultimate3DState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): Ultimate3DAIMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  const m = move.data as Ultimate3DMove;
  return { macroCell: m.macroCell, microCell: m.microCell };
}
