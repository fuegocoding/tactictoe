import { OrderChaos } from '../rules/order-chaos.js';
import type { OrderChaosState, OrderChaosMove } from '../rules/order-chaos.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { mctsGetMove } from './mcts.js';

const engine = new OrderChaos();

export interface OrderChaosAIMove {
  cellIndex: number;
  symbol: 'X' | 'O';
}

export function getOrderChaosAIMove(
  state: OrderChaosState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): OrderChaosAIMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  let iterations = 200;
  if (difficulty === 'medium') iterations = 800;
  if (difficulty === 'hard') iterations = 2000;

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  const m = move.data as OrderChaosMove;
  return { cellIndex: m.cellIndex, symbol: m.symbol };
}
