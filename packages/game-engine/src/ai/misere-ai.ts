// packages/game-engine/src/ai/misere-ai.ts
import { MisereTTT } from '../rules/misere-ttt.js';
import type { MisereTTTState } from '../rules/misere-ttt.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';
import { createSimpleMinimax } from './simple-minimax.js';

const getBestMove = createSimpleMinimax(new MisereTTT());

export function getMisereAIMove(state: MisereTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  return getBestMove(state, aiPlayer, difficulty);
}
