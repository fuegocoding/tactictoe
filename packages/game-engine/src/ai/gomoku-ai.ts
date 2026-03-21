import { Gomoku } from '../rules/gomoku.js';
import type { GomokuState } from '../rules/gomoku.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new Gomoku();

export function getGomokuAIMove(state: GomokuState, aiPlayer: Player, difficulty: AIDifficulty): number {
  let iterations = 100;
  if (difficulty === 'medium') iterations = 300;
  if (difficulty === 'hard') iterations = 800;
  
  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return (move.data as { cellIndex: number }).cellIndex;
}
