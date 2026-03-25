'use client';

import { useCallback, useMemo } from 'react';
import type { AIDifficulty, Player, GameState, GarrisonMove } from '@tactictoe/game-engine';

export interface AIMove {
  boardIndex: number;
  cellIndex: number;
  symbol?: 'X' | 'O' | 'S';
  numberPlaced?: number;
  // For tactic_toe
  tacticType?: 'place' | 'move_obstacle';
  fromCell?: number;
  toCell?: number;
  // For garrison
  garrisonMove?: GarrisonMove;
}

export type AIVariant =
  | 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'notakto' | 'wild_ttt'
  | 'gomoku' | 'sos_ttt' | 'numerical_ttt'
  | 'vanishing_ttt' | 'ttt_3d' | 'ttt_4d' | 'order_chaos' | 'tactic_toe' | 'ultimate_3d'
  | 'garrison';

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
            getGomokuAIMove,
            getSOSAIMove,
            getNumericalAIMove,
            getVanishingAIMove,
            getTTT3DAIMove,
            getTTT4DAIMove,
            getOrderChaosAIMove,
            getTacticToeAIMove,
            getUltimate3DAIMove,
            getGarrisonAIMove,
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
          } else if (variant === 'gomoku') {
            const cellIndex = getGomokuAIMove(state as Parameters<typeof getGomokuAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'sos_ttt') {
            const move = getSOSAIMove(state as Parameters<typeof getSOSAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: move.cellIndex, symbol: move.symbol });
          } else if (variant === 'numerical_ttt') {
            const move = getNumericalAIMove(state as Parameters<typeof getNumericalAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: move.cellIndex, numberPlaced: move.numberPlaced });
          } else if (variant === 'vanishing_ttt') {
            const cellIndex = getVanishingAIMove(state as Parameters<typeof getVanishingAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex });
          } else if (variant === 'ttt_3d') {
            const cellIndex = getTTT3DAIMove(state as Parameters<typeof getTTT3DAIMove>[0], aiPlayer, difficulty);
            // cellIndex is 0-26 (global). boardIndex = layer = Math.floor(cellIndex / 9)
            resolve({ boardIndex: Math.floor(cellIndex / 9), cellIndex: cellIndex % 9 });
          } else if (variant === 'ttt_4d') {
            const cellIndex = getTTT4DAIMove(state as Parameters<typeof getTTT4DAIMove>[0], aiPlayer, difficulty);
            // boardIndex = Math.floor(cellIndex / 9), cellIndex_within = cellIndex % 9
            resolve({ boardIndex: Math.floor(cellIndex / 9), cellIndex: cellIndex % 9 });
          } else if (variant === 'order_chaos') {
            const move = getOrderChaosAIMove(state as Parameters<typeof getOrderChaosAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: move.cellIndex, symbol: move.symbol });
          } else if (variant === 'tactic_toe') {
            const move = getTacticToeAIMove(state as Parameters<typeof getTacticToeAIMove>[0], aiPlayer, difficulty);
            if (move.type === 'place') {
              resolve({ boardIndex: 0, cellIndex: move.cellIndex!, tacticType: 'place' });
            } else {
              resolve({ boardIndex: 0, cellIndex: move.toCell!, tacticType: 'move_obstacle', fromCell: move.fromCell, toCell: move.toCell });
            }
          } else if (variant === 'ultimate_3d') {
            const move = getUltimate3DAIMove(state as Parameters<typeof getUltimate3DAIMove>[0], aiPlayer, difficulty);
            // boardIndex = macroCell, cellIndex = microCell
            resolve({ boardIndex: move.macroCell, cellIndex: move.microCell });
          } else if (variant === 'garrison') {
            const move = getGarrisonAIMove(state as Parameters<typeof getGarrisonAIMove>[0], aiPlayer, difficulty);
            resolve({ boardIndex: 0, cellIndex: 0, garrisonMove: move });
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, 50);
    });
  }, [variant, difficulty]);

  return useMemo(() => ({ getMove }), [getMove]);
}
