import { TacticToe } from '../rules/tactic-toe.js';
import type { TacticToeState, TacticToeMove } from '../rules/tactic-toe.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new TacticToe();

export interface TacticToeAIMove {
  type: 'place' | 'move_obstacle';
  cellIndex?: number;
  fromCell?: number;
  toCell?: number;
}

export function getTacticToeAIMove(
  state: TacticToeState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): TacticToeAIMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  const mv = move.data as TacticToeMove;
  if (mv.type === 'place') return { type: 'place', cellIndex: mv.cellIndex };
  return { type: 'move_obstacle', fromCell: mv.fromCell, toCell: mv.toCell };
}
