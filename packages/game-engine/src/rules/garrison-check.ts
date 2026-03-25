import type { Player } from './interface.js';

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N';

export interface GarrisonPiece {
  id: string;
  type: PieceType;
  player: Player;
  square: number;   // 0–63 on board; -1 in hand
  captured: boolean;
}

function sqRow(sq: number): number { return Math.floor(sq / 8); }
function sqCol(sq: number): number { return sq % 8; }

/** Walk a ray in direction (dr,dc) from piece, stopping at first occupied square (inclusive). */
function ray(piece: GarrisonPiece, dr: number, dc: number, allPieces: GarrisonPiece[]): number[] {
  const occupied = new Set(
    allPieces.filter(p => !p.captured && p.square >= 0).map(p => p.square)
  );
  const result: number[] = [];
  let r = sqRow(piece.square) + dr;
  let c = sqCol(piece.square) + dc;
  while (r >= 0 && r < 8 && c >= 0 && c < 8) {
    const sq = r * 8 + c;
    result.push(sq);
    if (occupied.has(sq)) break;
    r += dr;
    c += dc;
  }
  return result;
}

/** All squares this piece attacks/threatens (includes own-piece squares for ray blocking). */
export function getAttackSquares(piece: GarrisonPiece, allPieces: GarrisonPiece[]): number[] {
  if (piece.square < 0 || piece.captured) return [];
  const r = sqRow(piece.square);
  const c = sqCol(piece.square);

  switch (piece.type) {
    case 'N': {
      return ([ [-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1] ] as [number,number][])
        .map(([dr,dc]) => [(r+dr),(c+dc)] as [number,number])
        .filter(([nr,nc]) => nr>=0 && nr<8 && nc>=0 && nc<8)
        .map(([nr,nc]) => nr*8+nc);
    }
    case 'B': return [
      ...ray(piece,-1,-1,allPieces), ...ray(piece,-1,1,allPieces),
      ...ray(piece, 1,-1,allPieces), ...ray(piece, 1,1,allPieces),
    ];
    case 'R': return [
      ...ray(piece,-1,0,allPieces), ...ray(piece,1,0,allPieces),
      ...ray(piece,0,-1,allPieces), ...ray(piece,0,1,allPieces),
    ];
    case 'Q': return [
      ...ray(piece,-1,-1,allPieces), ...ray(piece,-1,1,allPieces),
      ...ray(piece, 1,-1,allPieces), ...ray(piece, 1,1,allPieces),
      ...ray(piece,-1, 0,allPieces), ...ray(piece, 1,0,allPieces),
      ...ray(piece, 0,-1,allPieces), ...ray(piece, 0,1,allPieces),
    ];
    case 'K': {
      return ([ [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1] ] as [number,number][])
        .map(([dr,dc]) => [(r+dr),(c+dc)] as [number,number])
        .filter(([nr,nc]) => nr>=0 && nr<8 && nc>=0 && nc<8)
        .map(([nr,nc]) => nr*8+nc);
    }
  }
}

/** Returns true if `player`'s king is currently attacked by any opponent piece. */
export function isInCheck(player: Player, pieces: GarrisonPiece[]): boolean {
  const king = pieces.find(p => p.player === player && p.type === 'K' && !p.captured);
  if (!king || king.square < 0) return false;
  const opponent: Player = player === 'X' ? 'O' : 'X';
  return pieces
    .filter(p => p.player === opponent && !p.captured && p.square >= 0)
    .some(p => getAttackSquares(p, pieces).includes(king.square));
}

/**
 * All squares piece can legally move to (excluding own-piece squares).
 * Does NOT filter for check — caller must simulate and check.
 */
export function getMoveDestinations(piece: GarrisonPiece, allPieces: GarrisonPiece[]): number[] {
  const ownSquares = new Set(
    allPieces
      .filter(p => p.player === piece.player && !p.captured && p.square >= 0 && p.id !== piece.id)
      .map(p => p.square)
  );
  return getAttackSquares(piece, allPieces).filter(sq => !ownSquares.has(sq));
}
