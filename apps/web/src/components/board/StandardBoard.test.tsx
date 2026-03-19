import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandardBoard } from './StandardBoard';
import type { Board } from '@tactictoe/game-engine';

const emptyBoard: Board = [null, null, null, null, null, null, null, null, null];

describe('StandardBoard', () => {
  it('renders 9 cells', () => {
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={false} onMove={vi.fn()} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('shows X and O in occupied cells', () => {
    const board: Board = ['X', 'O', null, null, null, null, null, null, null];
    render(
      <StandardBoard board={board} currentPlayer="O" disabled={false} onMove={vi.fn()} />
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
  });

  it('calls onMove with the cell index when an empty cell is clicked', () => {
    const onMove = vi.fn();
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={false} onMove={onMove} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]!);
    expect(onMove).toHaveBeenCalledWith(4);
  });

  it('does not call onMove when clicking an occupied cell', () => {
    const onMove = vi.fn();
    const board: Board = ['X', null, null, null, null, null, null, null, null];
    render(
      <StandardBoard board={board} currentPlayer="O" disabled={false} onMove={onMove} />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not call onMove when disabled prop is true', () => {
    const onMove = vi.fn();
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={true} onMove={onMove} />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <StandardBoard board={emptyBoard} currentPlayer="X" disabled={true} onMove={vi.fn()} />
    );
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
