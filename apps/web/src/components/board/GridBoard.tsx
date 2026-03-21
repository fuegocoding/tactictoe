import React from 'react';
import type { Board } from '@tactictoe/game-engine';

interface GridBoardProps {
  board: Board;
  cols: number;
  rows: number;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
}

export function GridBoard({ board, cols, rows, currentPlayer, disabled, onMove }: GridBoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `20px repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `20px repeat(${rows}, minmax(0, 1fr))`,
        gap: cols > 10 ? '2px' : '4px',
        width: '100%',
        maxWidth: cols >= 15 ? '600px' : '400px',
        margin: '0 auto',
      }}
    >
      {/* Top Left Empty */}
      <div />
      {/* Col Labels */}
      {Array.from({ length: cols }).map((_, col) => (
        <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
          {String.fromCharCode(97 + col)}
        </div>
      ))}
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <React.Fragment key={row}>
          {/* Row Label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {row + 1}
          </div>
          
          {/* Cells */}
          {Array.from({ length: cols }).map((_, col) => {
            const index = row * cols + col;
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
                  fontSize: cols > 5 ? 'clamp(14px, 2.5vw, 18px)' : 'clamp(20px, 5vw, 32px)',
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
