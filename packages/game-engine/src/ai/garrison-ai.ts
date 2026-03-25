import { Garrison } from '../rules/garrison.js';
import type { GarrisonState, GarrisonMove } from '../rules/garrison.js';
import { isInCheck } from '../rules/garrison-check.js';
import type { Player } from '../rules/interface.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new Garrison();

function longestRun(player: Player, pieces: GarrisonState['pieces']): number {
  const playerSqs = new Set(
    pieces.filter(p => p.player === player && !p.captured && p.square >= 0).map(p => p.square)
  );
  const DIRS: [number, number][] = [[0,1],[1,0],[1,1],[1,-1]];
  let max = 0;
  for (const sq of playerSqs) {
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    for (const [dr, dc] of DIRS) {
      const pr = r - dr; const pc = c - dc;
      if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8 && playerSqs.has(pr * 8 + pc)) continue;
      let len = 1, cr = r + dr, cc = c + dc;
      while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && playerSqs.has(cr * 8 + cc)) { len++; cr += dr; cc += dc; }
      if (len > max) max = len;
    }
  }
  return max;
}

function scoreMove(state: GarrisonState, move: GarrisonMove, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const result = engine.applyMove(state, { data: move }, aiPlayer);
  if (!result.ok) return -Infinity;
  const ns = result.state as GarrisonState;
  if (ns.terminal?.winner === aiPlayer) return 1000;
  let score = 0;
  score += longestRun(aiPlayer, ns.pieces) * 3;
  score -= longestRun(opponent, ns.pieces) * 4;
  if (isInCheck(opponent, ns.pieces)) score += 5;
  return score;
}

export function getGarrisonAIMove(
  state: GarrisonState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): GarrisonMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as GarrisonMove);
  if (legal.length === 0) throw new Error('No legal garrison moves');

  if (difficulty === 'easy') {
    return legal[Math.floor(Math.random() * legal.length)]!;
  }

  const scored = legal.map(m => ({ move: m, score: scoreMove(state, m, aiPlayer) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  if (difficulty === 'medium') {
    return Math.random() < 0.65 ? best.move : legal[Math.floor(Math.random() * legal.length)]!;
  }

  return best.move;
}
