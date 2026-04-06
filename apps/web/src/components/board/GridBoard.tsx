import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { WinLine } from './WinLine';
import { PieceSymbol } from './PieceSymbol';

interface GridBoardProps {
  board: Board;
  cols: number;
  rows: number;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

export function GridBoard({ board, cols, rows, currentPlayer, disabled, onMove, winCells = [] }: GridBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  const colLabels = Array.from({ length: cols }, (_, i) => String.fromCharCode(97 + i));
  const maxWidth = cols >= 15 ? '600px' : '400px';
  const gap = cols > 10 ? '2px' : '4px';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gridTemplateRows: '20px 1fr',
        gap,
        width: '100%',
        maxWidth,
        margin: '0 auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Corner */}
      <div />
      {/* Col labels */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
        {colLabels.map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {c}
          </div>
        ))}
      </div>

      {/* Row labels */}
      <div style={{ display: 'grid', gridTemplateRows: `repeat(${rows}, 1fr)`, gap }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* Cells with WinLine */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const index = row * cols + col;
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
                  fontSize: cols > 5 ? 'clamp(14px, 2.5vw, 18px)' : 'clamp(20px, 5vw, 32px)',
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
                  <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={cols > 5 ? 22 : 34} />
                ) : cell === 'O' ? (
                  <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={cols > 5 ? 22 : 34} />
                ) : null}
              </button>
            );
          })
        )}
        {winCells.length > 0 && <WinLine winCells={winCells} cols={cols} rows={rows} />}
      </div>
    </div>
  );
}
