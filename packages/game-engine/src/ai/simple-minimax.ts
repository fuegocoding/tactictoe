// packages/game-engine/src/ai/simple-minimax.ts
import type { GameRules } from '../rules/interface.js';
import type { GameState, Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

/**
 * Generic minimax for any GameRules variant whose moves carry { cellIndex: number }.
 * Returns a function that picks the best cell index for the AI.
 */
export function createSimpleMinimax(engine: GameRules) {
  function score(state: GameState, depth: number, isMaximizing: boolean, aiPlayer: Player): number {
    const terminal = engine.checkTerminal(state);
    if (terminal) {
      if (terminal.winner === aiPlayer) return 10 - depth;
      if (terminal.winner !== null) return depth - 10;
      return 0;
    }
    const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
    const currentPlayer = isMaximizing ? aiPlayer : opponent;
    const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
    if (isMaximizing) {
      let best = -Infinity;
      for (const cellIndex of legal) {
        const r = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
        if (r.ok) best = Math.max(best, score(r.state, depth + 1, false, aiPlayer));
      }
      return best;
    } else {
      let best = Infinity;
      for (const cellIndex of legal) {
        const r = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
        if (r.ok) best = Math.min(best, score(r.state, depth + 1, true, aiPlayer));
      }
      return best;
    }
  }

  return function getBestMove(state: GameState, aiPlayer: Player, difficulty: AIDifficulty): number {
    const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
    if (legal.length === 0) throw new Error('No legal moves');
    if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;

    let bestScore = -Infinity;
    let bestMove = legal[0]!;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, aiPlayer);
      if (!result.ok) continue;
      const s = score(result.state, 0, false, aiPlayer);
      if (s > bestScore) { bestScore = s; bestMove = cellIndex; }
    }

    if (difficulty === 'medium') {
      return Math.random() < 0.6 ? bestMove : legal[Math.floor(Math.random() * legal.length)]!;
    }
    return bestMove;
  };
}
