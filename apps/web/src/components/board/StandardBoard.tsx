import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { WinLine } from './WinLine';
import { PieceSymbol } from './PieceSymbol';

interface StandardBoardProps {
  board: Board;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

export function StandardBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: StandardBoardProps) {
  const { symbolX, symbolO } = useCosmetics();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gridTemplateRows: '20px 1fr',
        gap: '4px',
        width: '100%',
        maxWidth: '260px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Top-left corner */}
      <div />
      {/* Col labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {['a', 'b', 'c'].map((col) => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {col}
          </div>
        ))}
      </div>

      {/* Row labels */}
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: '4px' }}>
        {[1, 2, 3].map((row) => (
          <div key={row} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {row}
          </div>
        ))}
      </div>

      {/* Cells grid — position:relative hosts the WinLine overlay */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const index = row * 3 + col;
            const cell = board[index];
            return (
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {cell === 'X' ? (
                  <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={42} />
                ) : cell === 'O' ? (
                  <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={42} />
                ) : typeof cell === 'number' ? (
                  <span style={{color: cell%2!==0 ? 'var(--mark-x)' : 'var(--mark-o)', fontSize: '24px'}}>{cell}</span>
                ) : null}
              </button>
            );
          })
        )}
        {winCells.length > 0 && <WinLine winCells={winCells} cols={3} rows={3} />}
      </div>
    </div>
  );
}
