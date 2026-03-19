'use client';

import type { Board, Cell } from '@tactictoe/game-engine';

interface StandardBoardProps {
  board: Board;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (cellIndex: number) => void;
}

export function StandardBoard({ board, disabled, onMove }: StandardBoardProps) {
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
            if (!disabled && cell === null) onMove(index);
          }}
          style={{
            aspectRatio: '1',
            fontSize: 'clamp(20px, 5vw, 32px)',
            fontWeight: 'bold',
            cursor: disabled || cell !== null ? 'default' : 'pointer',
          }}
        >
          {cell ?? ''}
        </button>
      ))}
    </div>
  );
}
