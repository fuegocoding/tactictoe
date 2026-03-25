import type { Player } from './interface.js';
import type { GarrisonPiece } from './garrison-check.js';

/** 4 canonical directions: right, down, down-right, down-left */
const DIRECTIONS: [number, number][] = [
  [0, 1],   // right
  [1, 0],   // down
  [1, 1],   // down-right
  [1, -1],  // down-left
];

function sqRow(sq: number): number { return Math.floor(sq / 8); }
function sqCol(sq: number): number { return sq % 8; }

/**
 * Returns the 5 winning square indices if `player` has exactly 5 in a row,
 * or null otherwise. A run of 6+ does NOT win.
 */
export function checkFiveInARow(player: Player, pieces: GarrisonPiece[]): number[] | null {
  const playerSquares = new Set(
    pieces.filter(p => p.player === player && !p.captured && p.square >= 0).map(p => p.square)
  );

  for (const sq of playerSquares) {
    const r = sqRow(sq);
    const c = sqCol(sq);

    for (const [dr, dc] of DIRECTIONS) {
      // Only start counting at the minimum-index end of a run
      const prevR = r - dr;
      const prevC = c - dc;
      if (prevR >= 0 && prevR < 8 && prevC >= 0 && prevC < 8) {
        if (playerSquares.has(prevR * 8 + prevC)) continue; // not the start
      }

      // Count run length
      const run: number[] = [sq];
      let cr = r + dr;
      let cc = c + dc;
      while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && playerSquares.has(cr * 8 + cc)) {
        run.push(cr * 8 + cc);
        cr += dr;
        cc += dc;
      }

      if (run.length === 5) return run;
    }
  }
  return null;
}
