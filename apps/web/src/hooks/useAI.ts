'use client';

import { useCallback } from 'react';
import type { AIDifficulty, Player, GameState } from '@tactictoe/game-engine';

export interface AIMove {
  boardIndex: number;
  cellIndex: number;
  symbol?: 'X' | 'O'; // Wild TTT only
}

export type AIVariant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'notakto' | 'wild_ttt';

/**
 * Hook that returns a `getMove` function for AI opponents.
 * Runs synchronously but defers via setTimeout so React can paint
 * the "thinking" state before the AI computation blocks the thread.
 */
export function useAI(variant: AIVariant, difficulty: AIDifficulty) {
  const getMove = useCallback((state: GameState, aiPlayer: Player): Promise<AIMove> => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const {
            getStandardAIMove,
            getUltimateAIMove,
            getMisereAIMove,
            getNotaktoAIMove,
            getWildAIMove,
          } = await import('@tactictoe/game-engine');

          if (variant === 'standard_3x3') {
            const cellIndex = getStandardAIMove(state as Parameters<typeof getStandardAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'ultimate_ttt') {
            const move = getUltimateAIMove(state as Parameters<typeof getUltimateAIMove>[0], aiPlayer, difficulty);
            resolve(move as AIMove);
          } else if (variant === 'misere_ttt') {
            const cellIndex = getMisereAIMove(state as Parameters<typeof getMisereAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'notakto') {
            const cellIndex = getNotaktoAIMove(state as Parameters<typeof getNotaktoAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'wild_ttt') {
            const move = getWildAIMove(state as Parameters<typeof getWildAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: move.cellIndex, symbol: move.symbol });
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, 50);
    });
  }, [variant, difficulty]);

  return { getMove };
}
