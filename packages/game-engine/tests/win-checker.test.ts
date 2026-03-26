import { describe, it, expect } from 'vitest';
import { checkBoardWinner } from '../src/rules/win-checker.js';
import { getWinCells3D } from '../src/rules/ttt-3d.js';
import { getWinCells4D } from '../src/rules/ttt-4d.js';
import { getWinCells6x6 } from '../src/rules/order-chaos.js';
import type { Board } from '../src/types.js';

const _ = null;

describe('checkBoardWinner', () => {
  it('returns null for an empty board', () => {
    const board: Board = [_, _, _, _, _, _, _, _, _];
    expect(checkBoardWinner(board)).toBeNull();
  });

  it('returns null for a partial board with no winner', () => {
    const board: Board = ['X', 'O', _, _, 'X', _, _, _, _];
    expect(checkBoardWinner(board)).toBeNull();
  });

  it('detects top-row win for X', () => {
    const board: Board = ['X', 'X', 'X', 'O', 'O', _, _, _, _];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects middle-row win for O', () => {
    const board: Board = ['X', _, 'X', 'O', 'O', 'O', _, _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects bottom-row win for X', () => {
    const board: Board = [_, 'O', 'O', _, _, _, 'X', 'X', 'X'];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects left-column win for O', () => {
    const board: Board = ['O', 'X', _, 'O', 'X', _, 'O', _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects center-column win for X', () => {
    const board: Board = ['O', 'X', _, 'O', 'X', _, _, 'X', _];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects right-column win for O', () => {
    const board: Board = [_, 'X', 'O', _, 'X', 'O', _, _, 'O'];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('detects main-diagonal win for X', () => {
    const board: Board = ['X', 'O', _, _, 'X', 'O', _, _, 'X'];
    expect(checkBoardWinner(board)).toBe('X');
  });

  it('detects anti-diagonal win for O', () => {
    const board: Board = [_, 'X', 'O', _, 'O', 'X', 'O', _, _];
    expect(checkBoardWinner(board)).toBe('O');
  });

  it('returns null when board is full but drawn', () => {
    const board: Board = ['X', 'O', 'X', 'O', 'O', 'X', 'X', 'X', 'O'];
    expect(checkBoardWinner(board)).toBeNull();
  });
});

describe('getWinCells3D', () => {
  it('returns the winning line for a 3D horizontal win on layer 0', () => {
    const board = new Array(27).fill(null) as Board;
    board[0] = 'X'; board[1] = 'X'; board[2] = 'X'; // row 0 of layer 0
    expect(getWinCells3D(board)).toEqual([0, 1, 2]);
  });

  it('returns a cross-layer diagonal win', () => {
    // Cells 0 (layer0,row0,col0), 13 (layer1,row1,col1), 26 (layer2,row2,col2)
    const board = new Array(27).fill(null) as Board;
    board[0] = 'O'; board[13] = 'O'; board[26] = 'O';
    expect(getWinCells3D(board)).toEqual([0, 13, 26]);
  });

  it('returns null when no win', () => {
    const board = new Array(27).fill(null) as Board;
    board[0] = 'X'; board[1] = 'O'; board[2] = 'X';
    expect(getWinCells3D(board)).toBeNull();
  });
});

describe('getWinCells4D', () => {
  it('returns the winning line for a 4D win along first axis', () => {
    // Line [0, 1, 2] — first row of first sub-board of first hyperboard
    const board = new Array(81).fill(null) as Board;
    board[0] = 'X'; board[1] = 'X'; board[2] = 'X';
    expect(getWinCells4D(board)).toEqual([0, 1, 2]);
  });

  it('returns null when no win', () => {
    const board = new Array(81).fill(null) as Board;
    expect(getWinCells4D(board)).toBeNull();
  });
});

describe('getWinCells6x6', () => {
  it('returns a 5-in-a-row horizontal win', () => {
    const board = new Array(36).fill(null) as Board;
    board[0] = 'X'; board[1] = 'X'; board[2] = 'X'; board[3] = 'X'; board[4] = 'X';
    const result = getWinCells6x6(board);
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns null when no win', () => {
    const board = new Array(36).fill(null) as Board;
    board[0] = 'X'; board[1] = 'X'; board[2] = 'X'; board[3] = 'X';
    expect(getWinCells6x6(board)).toBeNull();
  });
});
