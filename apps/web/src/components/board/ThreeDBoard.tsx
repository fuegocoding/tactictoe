import React from 'react';
import type { Board } from '@tactictoe/game-engine';

interface ThreeDBoardProps {
  board: Board; // 27 cells
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  /** Highlight winning cells */
  winCells?: number[];
}

const LAYER_LABELS = ['Layer 1 (Bottom)', 'Layer 2 (Middle)', 'Layer 3 (Top)'];

/**
 * Renders a 3×3×3 board as three separate 3×3 grids stacked side-by-side.
 * cellIndex = layer * 9 + row * 3 + col
 *
 * onMove(boardIndex, cellIndex): boardIndex = layer (0-2), cellIndex = row*3+col (0-8)
 */
export function ThreeDBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: ThreeDBoardProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      alignItems: 'center',
      width: '100%',
    }}>
      <div style={{
        display: 'flex',
        gap: 'var(--space-5)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {[0, 1, 2].map(layer => (
          <div key={layer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}>
              {LAYER_LABELS[layer]}
            </div>

            {/* Mini 3x3 grid with row/col labels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '18px repeat(3, minmax(0, 1fr))',
              gridTemplateRows: '18px repeat(3, minmax(0, 1fr))',
              gap: '3px',
              width: '180px',
            }}>
              {/* Top-left corner */}
              <div />
              {/* Col labels */}
              {['a', 'b', 'c'].map(col => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {col}
                </div>
              ))}
              {/* Rows */}
              {[0, 1, 2].map(row => (
                <React.Fragment key={row}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    {row + 1}
                  </div>
                  {[0, 1, 2].map(col => {
                    const globalIndex = layer * 9 + row * 3 + col;
                    const cell = board[globalIndex];
                    const isWin = winCells.includes(globalIndex);
                    return (
                      <button
                        key={col}
                        disabled={disabled || cell !== null}
                        onClick={() => {
                          if (!disabled && cell === null) onMove(layer, row * 3 + col);
                        }}
                        style={{
                          aspectRatio: '1',
                          fontSize: 'clamp(16px, 4vw, 26px)',
                          fontWeight: 'bold',
                          cursor: disabled || cell !== null ? 'default' : 'pointer',
                          background: isWin
                            ? 'var(--accent-subtle, rgba(59,130,246,0.2))'
                            : 'var(--board-cell-bg)',
                          border: isWin
                            ? '2px solid var(--accent, #3b82f6)'
                            : '1px solid var(--board-cell-border)',
                          borderRadius: 'var(--radius-sm)',
                          color: cell === 'X' ? 'var(--mark-x)' : cell === 'O' ? 'var(--mark-o)' : 'var(--text)',
                          transition: 'background 0.15s',
                        }}
                      >
                        {cell !== null ? String(cell) : ''}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 3D perspective legend */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        maxWidth: 400,
        lineHeight: 1.5,
      }}>
        Win by getting 3-in-a-row across any layer, column, row, or diagonal through all three layers.
      </div>
    </div>
  );
}
