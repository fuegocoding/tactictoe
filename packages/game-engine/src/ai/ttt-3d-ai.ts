import { TTT3D } from '../rules/ttt-3d.js';
import type { TTT3DState } from '../rules/ttt-3d.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new TTT3D();

export function getTTT3DAIMove(state: TTT3DState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return (move.data as { cellIndex: number }).cellIndex;
}
