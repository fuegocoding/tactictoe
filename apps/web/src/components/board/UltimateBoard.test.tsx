import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UltimateBoard } from './UltimateBoard';
import type { Board, BoardResult } from '@tactictoe/game-engine';

const emptyBoard: Board = [null, null, null, null, null, null, null, null, null];
const emptyBoards = Array(9).fill(emptyBoard) as [Board, Board, Board, Board, Board, Board, Board, Board, Board];
const emptyResults = Array(9).fill(null) as [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];

describe('UltimateBoard', () => {
  it('renders 81 cells (9 mini-boards × 9 cells)', () => {
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={false}
        onMove={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(81);
  });

  it('calls onMove with correct boardIndex and cellIndex', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={false}
        onMove={onMove}
      />
    );
    // Mini-board 2 starts at button index 18 (9 buttons per mini-board)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[18]!);
    expect(onMove).toHaveBeenCalledWith(2, 0);
  });

  it('does not call onMove when clicking a non-constrained board', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={4}
        currentPlayer="X"
        disabled={false}
        onMove={onMove}
      />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('shows the result symbol in a won mini-board', () => {
    const results = [...emptyResults] as typeof emptyResults;
    results[0] = 'X';
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={results}
        nextBoardConstraint={null}
        currentPlayer="O"
        disabled={false}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByTestId('mini-board-result-0')).toHaveTextContent('X');
  });

  it('does not call onMove when disabled', () => {
    const onMove = vi.fn();
    render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={true}
        onMove={onMove}
      />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('renders an SVG win line when winCells is provided', () => {
    const results = [...emptyResults] as typeof emptyResults;
    results[0] = 'X';
    results[4] = 'X';
    results[8] = 'X';
    const { container } = render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={results}
        nextBoardConstraint={null}
        currentPlayer="O"
        disabled={true}
        onMove={vi.fn()}
        winCells={[0, 4, 8]}
      />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render an SVG win line when winCells is empty', () => {
    const { container } = render(
      <UltimateBoard
        boards={emptyBoards}
        boardResults={emptyResults}
        nextBoardConstraint={null}
        currentPlayer="X"
        disabled={false}
        onMove={vi.fn()}
      />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
