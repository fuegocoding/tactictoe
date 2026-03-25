import { describe, it, expect } from 'vitest';
import {
  getAttackSquares,
  isInCheck,
} from '../src/rules/garrison-check.js';
import type { GarrisonPiece } from '../src/rules/garrison-check.js';

function piece(id: string, type: GarrisonPiece['type'], player: 'X' | 'O', square: number): GarrisonPiece {
  return { id, type, player, square, captured: false };
}

describe('getAttackSquares', () => {
  it('knight on e4 (square 28) attacks 8 squares', () => {
    const n = piece('X_N1', 'N', 'X', 28); // row=3, col=4
    const squares = getAttackSquares(n, [n]);
    // L-shapes from (3,4): (1,3)=11, (1,5)=13, (2,2)=18, (2,6)=22, (4,2)=34, (4,6)=38, (5,3)=43, (5,5)=45
    expect(squares.sort((a,b)=>a-b)).toEqual([11,13,18,22,34,38,43,45]);
  });

  it('knight in corner (a1=0) attacks only 2 squares', () => {
    const n = piece('X_N1', 'N', 'X', 0);
    const squares = getAttackSquares(n, [n]);
    expect(squares.sort((a,b)=>a-b)).toEqual([10, 17]);
  });

  it('rook ray stops at first piece and includes it', () => {
    const r = piece('X_R1', 'R', 'X', 0);   // a1
    const blocker = piece('O_Q', 'Q', 'O', 3); // d1
    const squares = getAttackSquares(r, [r, blocker]);
    // Right ray: 1,2,3 (stops at blocker, includes it)
    expect(squares).toContain(1);
    expect(squares).toContain(2);
    expect(squares).toContain(3);
    expect(squares).not.toContain(4);
  });

  it('rook ray is blocked by own piece (includes own piece square)', () => {
    const r = piece('X_R1', 'R', 'X', 0);
    const own = piece('X_Q', 'Q', 'X', 3); // own piece at d1
    const squares = getAttackSquares(r, [r, own]);
    expect(squares).toContain(3);   // ray reaches d1
    expect(squares).not.toContain(4); // stops there
  });

  it('bishop attacks diagonals', () => {
    const b = piece('X_B1', 'B', 'X', 27); // d4 = row3,col3
    const squares = getAttackSquares(b, [b]);
    // up-left: 18,9,0 | up-right: 20,13,6 | down-left: 34,41,48 | down-right: 36,45,54,63
    expect(squares).toContain(18);
    expect(squares).toContain(36);
  });

  it('queen combines rook and bishop', () => {
    const q = piece('X_Q', 'Q', 'X', 27); // d4
    const squares = getAttackSquares(q, [q]);
    // Should have both orthogonal and diagonal squares
    expect(squares).toContain(3);  // left on row 3
    expect(squares).toContain(18); // diagonal
  });

  it('king attacks 8 adjacent squares from centre', () => {
    const k = piece('X_K', 'K', 'X', 27); // d4
    const squares = getAttackSquares(k, [k]);
    expect(squares.sort((a,b)=>a-b)).toEqual([18,19,20,26,28,34,35,36]);
  });

  it('piece in hand returns no attack squares', () => {
    const n = piece('X_N1', 'N', 'X', -1);
    expect(getAttackSquares(n, [n])).toEqual([]);
  });
});

describe('isInCheck', () => {
  it('returns false when king is not attacked', () => {
    const king = piece('X_K', 'K', 'X', 0);
    const oKing = piece('O_K', 'K', 'O', 63);
    expect(isInCheck('X', [king, oKing])).toBe(false);
  });

  it('returns true when rook attacks king on same rank', () => {
    const king = piece('X_K', 'K', 'X', 0);   // a1
    const rook = piece('O_R1', 'R', 'O', 7);  // h1, same row
    const oKing = piece('O_K', 'K', 'O', 63);
    expect(isInCheck('X', [king, rook, oKing])).toBe(true);
  });

  it('returns false when ray is blocked by intervening piece', () => {
    const king = piece('X_K', 'K', 'X', 0);   // a1
    const blocker = piece('X_N1', 'N', 'X', 3); // d1
    const rook = piece('O_R1', 'R', 'O', 7);   // h1
    const oKing = piece('O_K', 'K', 'O', 63);
    expect(isInCheck('X', [king, blocker, rook, oKing])).toBe(false);
  });

  it('returns false when king is in hand', () => {
    const king = piece('X_K', 'K', 'X', -1);
    const rook = piece('O_R1', 'R', 'O', 0);
    expect(isInCheck('X', [king, rook])).toBe(false);
  });
});
