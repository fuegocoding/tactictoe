import { TacticToe } from '../rules/tactic-toe.js';
import type { TacticToeState, TacticToeMove } from '../rules/tactic-toe.js';
import { WIN_LINES_3D } from '../rules/ttt-3d.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

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

  if (difficulty === 'easy') {
    const mv = legal[Math.floor(Math.random() * legal.length)]!.data as TacticToeMove;
    if (mv.type === 'place') return { type: 'place', cellIndex: mv.cellIndex };
    return { type: 'move_obstacle', fromCell: mv.fromCell, toCell: mv.toCell };
  }

  const best = getBestMove(state, aiPlayer);
  if (difficulty === 'medium') {
    if (Math.random() < 0.6) return best;
    const mv = legal[Math.floor(Math.random() * legal.length)]!.data as TacticToeMove;
    if (mv.type === 'place') return { type: 'place', cellIndex: mv.cellIndex };
    return { type: 'move_obstacle', fromCell: mv.fromCell, toCell: mv.toCell };
  }

  return best;
}

function scoreBoard(board: (string | number | null)[], aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;
  for (const [a, b, c] of WIN_LINES_3D) {
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter(x => x === aiPlayer).length;
    const oppCount = cells.filter(x => x === opponent).length;
    // Obstacles ('B') block lines
    const blocked = cells.some(x => x === 'B');
    if (!blocked) {
      if (aiCount > 0 && oppCount === 0) score += aiCount * aiCount * 2;
      if (oppCount > 0 && aiCount === 0) score -= oppCount * oppCount * 2;
    }
  }
  return score;
}

function getBestMove(state: TacticToeState, aiPlayer: Player): TacticToeAIMove {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const legal = engine.getLegalMoves(state);

  // Only evaluate place moves for immediate win/block (obstacle moves evaluated by score)
  const placeMoves = legal
    .map(m => m.data as TacticToeMove)
    .filter(m => m.type === 'place');

  // Win immediately
  for (const pm of placeMoves) {
    const result = engine.applyMove(state, { data: pm }, aiPlayer);
    if (result.ok && engine.checkTerminal(result.state)?.winner === aiPlayer) {
      return { type: 'place', cellIndex: pm.cellIndex };
    }
  }

  // Block opponent
  for (const pm of placeMoves) {
    const result = engine.applyMove(state, { data: pm }, opponent);
    if (result.ok && engine.checkTerminal(result.state)?.winner === opponent) {
      return { type: 'place', cellIndex: pm.cellIndex };
    }
  }

  // Score all legal moves
  let bestScore = -Infinity;
  let bestMove: TacticToeAIMove = { type: 'place', cellIndex: 13 }; // center layer 1

  for (const mv of legal) {
    const data = mv.data as TacticToeMove;
    const result = engine.applyMove(state, { data }, aiPlayer);
    if (!result.ok) continue;
    const s = scoreBoard((result.state as TacticToeState).board, aiPlayer);
    if (s > bestScore) {
      bestScore = s;
      if (data.type === 'place') {
        bestMove = { type: 'place', cellIndex: data.cellIndex };
      } else {
        bestMove = { type: 'move_obstacle', fromCell: data.fromCell, toCell: data.toCell };
      }
    }
  }

  return bestMove;
}
