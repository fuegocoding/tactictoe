'use client';

import { useCallback } from 'react';
import type { AIDifficulty, Player, GameState } from '@tactictoe/game-engine';

export interface AIMove {
  boardIndex: number;
  cellIndex: number;
}

/**
 * Hook that returns a `getMove` function for AI opponents.
 * Runs synchronously but defers via setTimeout so React can paint
 * the "thinking" state before the AI computation blocks the thread.
 */
export function useAI(variant: 'standard_3x3' | 'ultimate_ttt', difficulty: AIDifficulty) {
  const getMove = useCallback((state: GameState, aiPlayer: Player): Promise<AIMove> => {
    return new Promise((resolve, reject) => {
      // Let React render the thinking indicator before computing
      setTimeout(async () => {
        try {
          const { getStandardAIMove, getUltimateAIMove } = await import('@tactictoe/game-engine');
          if (variant === 'standard_3x3') {
            const cellIndex = getStandardAIMove(state as Parameters<typeof getStandardAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else {
            const move = getUltimateAIMove(state as Parameters<typeof getUltimateAIMove>[0], aiPlayer, difficulty);
            resolve(move as AIMove);
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, 50);
    });
  }, [variant, difficulty]);

  return { getMove };
}
