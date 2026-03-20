import { StandardTTT } from '../rules/standard-ttt.js';
import type { StandardTTTState } from '../rules/standard-ttt.js';
import type { Player } from '../types.js';

const engine = new StandardTTT();

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/** Returns the cell index for the AI's move. */
export function getStandardAIMove(state: StandardTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  if (legal.length === 0) throw new Error('No legal moves');

  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)]!;

  const bestMove = minimaxBestMove(state, aiPlayer);

  if (difficulty === 'medium') {
    // Play best move 60% of the time, random otherwise
    return Math.random() < 0.6 ? bestMove : legal[Math.floor(Math.random() * legal.length)]!;
  }

  return bestMove; // hard = always optimal
}

function minimaxBestMove(state: StandardTTTState, aiPlayer: Player): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  let bestScore = -Infinity;
  let bestMove = legal[0]!;

  for (const cellIndex of legal) {
    const result = engine.applyMove(state, { data: { cellIndex } }, aiPlayer);
    if (!result.ok) continue;
    const score = minimax(result.state as StandardTTTState, 0, false, aiPlayer);
    if (score > bestScore) { bestScore = score; bestMove = cellIndex; }
  }

  return bestMove;
}

function minimax(state: StandardTTTState, depth: number, isMaximizing: boolean, aiPlayer: Player): number {
  const terminal = engine.checkTerminal(state);
  if (terminal) {
    if (terminal.winner === aiPlayer) return 10 - depth;
    if (terminal.winner !== null) return depth - 10;
    return 0; // draw
  }

  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const currentPlayer = isMaximizing ? aiPlayer : opponent;
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);

  if (isMaximizing) {
    let best = -Infinity;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
      if (result.ok) best = Math.max(best, minimax(result.state as StandardTTTState, depth + 1, false, aiPlayer));
    }
    return best;
  } else {
    let best = Infinity;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
      if (result.ok) best = Math.min(best, minimax(result.state as StandardTTTState, depth + 1, true, aiPlayer));
    }
    return best;
  }
}
