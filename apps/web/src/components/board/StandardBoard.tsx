import React from 'react';
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
        gridTemplateColumns: '20px repeat(3, minmax(0, 1fr))',
        gridTemplateRows: '20px repeat(3, minmax(0, 1fr))',
        gap: '4px',
        width: '100%',
        maxWidth: '260px',
      }}
    >
      {/* Top Left Empty */}
      <div />
      {/* Col Labels */}
      {['a', 'b', 'c'].map((col) => (
        <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
          {col}
        </div>
      ))}
      
      {/* Rows */}
      {[0, 1, 2].map((row) => (
        <React.Fragment key={row}>
          {/* Row Label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {row + 1}
          </div>
          
          {/* Cells */}
          {[0, 1, 2].map((col) => {
            const index = row * 3 + col;
            const cell = board[index];
            return (
              <button
                key={col}
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
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
