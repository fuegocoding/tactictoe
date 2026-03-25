import { describe, it, expect } from 'vitest';
import { checkFiveInARow } from '../src/rules/garrison-five.js';
import type { GarrisonPiece } from '../src/rules/garrison-check.js';

function xPiece(id: string, square: number): GarrisonPiece {
  return { id, type: 'N', player: 'X', square, captured: false };
}
function oPiece(id: string, square: number): GarrisonPiece {
  return { id, type: 'N', player: 'O', square, captured: false };
}

describe('checkFiveInARow', () => {
  it('returns null when no 5-in-a-row exists', () => {
    const pieces = [0,1,2,3].map((sq,i) => xPiece(`p${i}`, sq));
    expect(checkFiveInARow('X', pieces)).toBe(null);
  });

  it('detects horizontal 5-in-a-row', () => {
    const pieces = [0,1,2,3,4].map((sq,i) => xPiece(`p${i}`, sq));
    const result = checkFiveInARow('X', pieces);
    expect(result).not.toBe(null);
    expect(result!.sort((a,b)=>a-b)).toEqual([0,1,2,3,4]);
  });

  it('detects vertical 5-in-a-row (column a)', () => {
    // squares 0,8,16,24,32 = column a rows 1-5
    const pieces = [0,8,16,24,32].map((sq,i) => xPiece(`p${i}`, sq));
    const result = checkFiveInARow('X', pieces);
    expect(result).not.toBe(null);
    expect(result!.sort((a,b)=>a-b)).toEqual([0,8,16,24,32]);
  });

  it('detects down-right diagonal 5-in-a-row', () => {
    // squares 0,9,18,27,36 = main diagonal
    const pieces = [0,9,18,27,36].map((sq,i) => xPiece(`p${i}`, sq));
    const result = checkFiveInARow('X', pieces);
    expect(result).not.toBe(null);
    expect(result!.sort((a,b)=>a-b)).toEqual([0,9,18,27,36]);
  });

  it('detects down-left diagonal 5-in-a-row', () => {
    // squares 4,11,18,25,32 = anti-diagonal starting at e1
    const pieces = [4,11,18,25,32].map((sq,i) => xPiece(`p${i}`, sq));
    const result = checkFiveInARow('X', pieces);
    expect(result).not.toBe(null);
  });

  it('6-in-a-row does NOT win (exactly 5 required)', () => {
    const pieces = [0,1,2,3,4,5].map((sq,i) => xPiece(`p${i}`, sq));
    expect(checkFiveInARow('X', pieces)).toBe(null);
  });

  it('does not return opponent 5-in-a-row as win for player', () => {
    const pieces = [0,1,2,3,4].map((sq,i) => oPiece(`p${i}`, sq));
    expect(checkFiveInARow('X', pieces)).toBe(null);
    expect(checkFiveInARow('O', pieces)).not.toBe(null);
  });

  it('ignores captured pieces', () => {
    const pieces = [0,1,2,3,4].map((sq,i) => ({ ...xPiece(`p${i}`, sq), captured: true }));
    expect(checkFiveInARow('X', pieces)).toBe(null);
  });
});
