// packages/game-engine/src/ai/notakto-ai.ts
import { NotaktoTTT } from '../rules/notakto-ttt.js';
import type { NotaktoTTTState } from '../rules/notakto-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { createSimpleMinimax } from './simple-minimax.js';

const getBestMove = createSimpleMinimax(new NotaktoTTT());

export function getNotaktoAIMove(state: NotaktoTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  return getBestMove(state, aiPlayer, difficulty);
}
