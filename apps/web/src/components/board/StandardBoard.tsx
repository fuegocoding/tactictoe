'use client';

import type { Board, Cell } from '@tactictoe/game-engine';

interface StandardBoardProps {
  board: Board;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
}

export function StandardBoard({ board, currentPlayer, disabled, onMove }: StandardBoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '4px',
        width: '100%',
        maxWidth: '240px',
      }}
    >
      {board.map((cell: Cell, index: number) => (
        <button
          key={index}
          disabled={disabled || cell !== null}
          onClick={() => {
            if (!disabled && cell === null) onMove(0, index);
          }}
          style={{
            aspectRatio: '1',
            fontSize: 'clamp(20px, 5vw, 32px)',
            fontWeight: 'bold',
            cursor: disabled || cell !== null ? 'default' : 'pointer',
            background: 'var(--board-cell-bg)',
            border: '1px solid var(--board-cell-border)',
            borderRadius: 'var(--radius-sm)',
            color: cell === 'X' ? 'var(--mark-x)' : cell === 'O' ? 'var(--mark-o)' : 'var(--text)',
          }}
        >
          {cell ?? ''}
        </button>
      ))}
    </div>
  );
}
