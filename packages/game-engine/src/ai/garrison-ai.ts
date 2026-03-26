import { Garrison } from '../rules/garrison.js';
import type { GarrisonState, GarrisonMove } from '../rules/garrison.js';
import type { GarrisonPiece, PieceType } from '../rules/garrison-check.js';
import { isInCheck, getAttackSquares } from '../rules/garrison-check.js';
import type { Player } from '../rules/interface.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new Garrison();

// ─── Chess model ──────────────────────────────────────────────────────────────

const PIECE_VALUE: Record<PieceType, number> = { K: 0, Q: 9, R: 5, B: 3, N: 3 };

function chessEval(ns: GarrisonState, aiPlayer: Player): number {
  const opp: Player = aiPlayer === 'X' ? 'O' : 'X';
  const pieces = ns.pieces;
  let score = 0;

  for (const p of pieces) {
    if (p.captured || p.square < 0) continue;
    const val = PIECE_VALUE[p.type];
    // Material
    score += p.player === aiPlayer ? val : -val;
    // Mobility
    const mobility = getAttackSquares(p, pieces).length * 0.04;
    score += p.player === aiPlayer ? mobility : -mobility;
    // Central control: inner 4×4 (rows 2-5, cols 2-5)
    const r = Math.floor(p.square / 8);
    const c = p.square % 8;
    if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
      score += p.player === aiPlayer ? 0.15 : -0.15;
    }
  }

  // Check threats
  if (isInCheck(opp, pieces))      score += 1.5;
  if (isInCheck(aiPlayer, pieces)) score -= 2.5;

  return score;
}

// ─── Gomoku model ─────────────────────────────────────────────────────────────

const DIRS: [number, number][] = [[0,1],[1,0],[1,1],[1,-1]];

/** Score value of a run by length and number of open ends. */
function runScore(length: number, openEnds: number): number {
  if (openEnds === 0) return 0;              // completely blocked
  const base = [0, 0, 2, 10, 80, 10000][Math.min(length, 5)]!;
  return openEnds === 2 ? base * 1.5 : base; // open on both ends is much more dangerous
}

function gomokuEval(ns: GarrisonState, aiPlayer: Player): number {
  const opp: Player = aiPlayer === 'X' ? 'O' : 'X';
  const pieces = ns.pieces;

  function evalPlayer(player: Player): number {
    const sqs = new Set(
      pieces.filter(p => p.player === player && !p.captured && p.square >= 0).map(p => p.square)
    );
    const isOccupied = (sq: number) =>
      pieces.some(p => !p.captured && p.square >= 0 && p.square === sq);

    let total = 0;
    for (const sq of Array.from(sqs)) {
      const r = Math.floor(sq / 8);
      const c = sq % 8;
      for (const [dr, dc] of DIRS) {
        // Only start from the minimum end of a run
        const pr = r - dr, pc = c - dc;
        if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8 && sqs.has(pr * 8 + pc)) continue;

        let run = 1;
        let cr = r + dr, cc = c + dc;
        while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && sqs.has(cr * 8 + cc)) {
          run++; cr += dr; cc += dc;
        }
        if (run < 2) continue;

        // Open ends
        let openEnds = 0;
        const backR = r - dr, backC = c - dc;
        if (backR >= 0 && backR < 8 && backC >= 0 && backC < 8 && !isOccupied(backR * 8 + backC)) openEnds++;
        if (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && !isOccupied(cr * 8 + cc)) openEnds++;

        total += runScore(run, openEnds);
      }
    }
    return total;
  }

  // Blocking opponent is slightly more urgent than building own threats
  return evalPlayer(aiPlayer) - evalPlayer(opp) * 1.2;
}

// ─── Combined scorer ──────────────────────────────────────────────────────────

interface ScoredMove {
  move: GarrisonMove;
  chess: number;
  gomoku: number;
}

function scoreAll(
  state: GarrisonState,
  moves: GarrisonMove[],
  aiPlayer: Player,
): ScoredMove[] {
  return moves.map(move => {
    const result = engine.applyMove(state, { data: move }, aiPlayer);
    if (!result.ok) return { move, chess: -1e9, gomoku: -1e9 };
    const ns = result.state as GarrisonState;
    if (ns.terminal?.winner === aiPlayer) return { move, chess: 1e6, gomoku: 1e6 };
    if (ns.terminal)                      return { move, chess: -1e6, gomoku: -1e6 };
    return { move, chess: chessEval(ns, aiPlayer), gomoku: gomokuEval(ns, aiPlayer) };
  });
}

/** Normalise an array of numbers to [0, 1]. Returns 0.5 if all equal. */
function normalise(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map(v => (v - min) / range);
}

/**
 * Both models rank every legal move independently, normalise their scores to
 * [0, 1], then vote with the given weights.  The move with the highest
 * combined vote wins.
 */
function pickMove(
  scored: ScoredMove[],
  chessWeight: number,
  gomokuWeight: number,
  topN: number,         // pick randomly from top-N (adds variety at lower difficulties)
): GarrisonMove {
  const chessNorm  = normalise(scored.map(s => s.chess));
  const gomokuNorm = normalise(scored.map(s => s.gomoku));

  const combined = scored.map((s, i) => ({
    move: s.move,
    vote: chessWeight * chessNorm[i]! + gomokuWeight * gomokuNorm[i]!,
  }));
  combined.sort((a, b) => b.vote - a.vote);

  const cutoff = Math.min(topN, combined.length);
  return combined[Math.floor(Math.random() * cutoff)]!.move;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function getGarrisonAIMove(
  state: GarrisonState,
  aiPlayer: Player,
  difficulty: AIDifficulty,
): GarrisonMove {
  const legal = engine.getLegalMoves(state).map(m => m.data as GarrisonMove);
  if (legal.length === 0) throw new Error('No legal garrison moves');

  const scored = scoreAll(state, legal, aiPlayer);

  if (difficulty === 'easy') {
    // Mostly random; slight gomoku awareness only
    return pickMove(scored, 0.2, 0.8, Math.max(1, Math.floor(legal.length * 0.4)));
  }
  if (difficulty === 'medium') {
    // Both models contribute; some randomness among top-3
    return pickMove(scored, 1, 1.5, 3);
  }
  // Hard: full dual-model vote, always takes the top combined move
  return pickMove(scored, 1, 2, 1);
}
