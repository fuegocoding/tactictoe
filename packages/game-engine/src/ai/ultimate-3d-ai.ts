import { Ultimate3D } from '../rules/ultimate-3d.js';
import type { Ultimate3DState, Ultimate3DMove } from '../rules/ultimate-3d.js';
import { WIN_LINES_3D } from '../rules/ttt-3d.js';
import type { Player } from '../types.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new Ultimate3D();

export interface Ultimate3DAIMove {
  macroCell: number;
  microCell: number;
}

export function getUltimate3DAIMove(
  state: Ultimate3DState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): Ultimate3DAIMove {
  const legal = engine.getLegalMoves(state);
  if (legal.length === 0) throw new Error('No legal moves');

  if (difficulty === 'easy') {
    const m = legal[Math.floor(Math.random() * legal.length)]!.data as Ultimate3DMove;
    return { macroCell: m.macroCell, microCell: m.microCell };
  }

  const best = getBestMove(state, aiPlayer);
  if (difficulty === 'medium') {
    if (Math.random() < 0.6) return best;
    const m = legal[Math.floor(Math.random() * legal.length)]!.data as Ultimate3DMove;
    return { macroCell: m.macroCell, microCell: m.microCell };
  }

  return best;
}

function scoreMetaBoard(macroResults: (string | number | null)[], aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;
  for (const [a, b, c] of WIN_LINES_3D) {
    const cells = [macroResults[a], macroResults[b], macroResults[c]];
    const aiCount = cells.filter(x => x === aiPlayer).length;
    const oppCount = cells.filter(x => x === opponent).length;
    if (aiCount > 0 && oppCount === 0) score += aiCount * 10;
    if (oppCount > 0 && aiCount === 0) score -= oppCount * 10;
  }
  return score;
}

function scoreMicroBoard(board: (string | number | null)[], aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;
  for (const [a, b, c] of WIN_LINES_3D) {
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter(x => x === aiPlayer).length;
    const oppCount = cells.filter(x => x === opponent).length;
    if (aiCount > 0 && oppCount === 0) score += aiCount;
    if (oppCount > 0 && aiCount === 0) score -= oppCount;
  }
  return score;
}

function getBestMove(state: Ultimate3DState, aiPlayer: Player): Ultimate3DAIMove {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const legal = engine.getLegalMoves(state);

  // Win meta immediately
  for (const mv of legal) {
    const m = mv.data as Ultimate3DMove;
    const result = engine.applyMove(state, { data: m }, aiPlayer);
    if (result.ok && engine.checkTerminal(result.state)?.winner === aiPlayer) {
      return { macroCell: m.macroCell, microCell: m.microCell };
    }
  }

  // Block opponent from winning meta
  for (const mv of legal) {
    const m = mv.data as Ultimate3DMove;
    const result = engine.applyMove(state, { data: m }, opponent);
    if (result.ok && engine.checkTerminal(result.state)?.winner === opponent) {
      return { macroCell: m.macroCell, microCell: m.microCell };
    }
  }

  // Score moves
  let bestScore = -Infinity;
  let bestMove: Ultimate3DAIMove = { macroCell: 0, microCell: 13 };

  for (const mv of legal) {
    const m = mv.data as Ultimate3DMove;
    const result = engine.applyMove(state, { data: m }, aiPlayer);
    if (!result.ok) continue;
    const ns = result.state as Ultimate3DState;
    const metaScore = scoreMetaBoard(ns.macroResults, aiPlayer);
    const microScore = scoreMicroBoard(ns.microBoards[m.macroCell]!, aiPlayer);
    const total = metaScore + microScore * 0.1;
    if (total > bestScore) {
      bestScore = total;
      bestMove = { macroCell: m.macroCell, microCell: m.microCell };
    }
  }

  return bestMove;
}
