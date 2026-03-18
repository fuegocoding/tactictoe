import { describe, it, expect } from 'vitest';
import { checkBoardWinner } from '../src/rules/win-checker.js';
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
