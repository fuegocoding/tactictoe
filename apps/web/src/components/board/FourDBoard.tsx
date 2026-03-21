import React from 'react';
import type { Board } from '@tactictoe/game-engine';

interface FourDBoardProps {
  board: Board; // 81 cells
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  /** onMove receives the flat cellIndex (0-80) */
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

/**
 * 4D Tic-Tac-Toe board rendered as a 3×3 meta-grid of 3×3 mini-grids.
 *
 * Indexing: globalIndex = (metaRow*3 + metaCol) * 9 + (row*3 + col)
 *   i.e., boardIndex = metaRow*3 + metaCol  →  d0*3 + d1
 *        cellIndex within  = row*3 + col     →  d2*3 + d3
 *   flat index = boardIndex * 9 + cellIndex_within
 */
export function FourDBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: FourDBoardProps) {
  const metaLabels = [
    ['(1,1)', '(1,2)', '(1,3)'],
    ['(2,1)', '(2,2)', '(2,3)'],
    ['(3,1)', '(3,2)', '(3,3)'],
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-2)',
      width: '100%',
    }}>
      {/* Outer 3×3 meta-grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: '6px',
      }}>
        {[0, 1, 2].map(metaRow => (
          [0, 1, 2].map(metaCol => {
            const boardIndex = metaRow * 3 + metaCol;
            return (
              <div key={boardIndex} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '4px',
                border: '1px solid var(--board-cell-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
              }}>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  {metaLabels[metaRow]![metaCol]}
                </div>
                {/* Inner 3×3 mini-grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '2px',
                  width: '90px',
                }}>
                  {[0, 1, 2].map(row =>
                    [0, 1, 2].map(col => {
                      const cellInBoard = row * 3 + col;
                      const globalIndex = boardIndex * 9 + cellInBoard;
                      const cell = board[globalIndex];
                      const isWin = winCells.includes(globalIndex);
                      return (
                        <button
                          key={cellInBoard}
                          disabled={disabled || cell !== null}
                          onClick={() => {
                            if (!disabled && cell === null) onMove(boardIndex, cellInBoard);
                          }}
                          style={{
                            aspectRatio: '1',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: disabled || cell !== null ? 'default' : 'pointer',
                            background: isWin
                              ? 'var(--accent-subtle, rgba(59,130,246,0.2))'
                              : 'var(--board-cell-bg)',
                            border: isWin
                              ? '2px solid var(--accent, #3b82f6)'
                              : '1px solid var(--board-cell-border)',
                            borderRadius: '3px',
                            color: cell === 'X' ? 'var(--mark-x)' : cell === 'O' ? 'var(--mark-o)' : 'var(--text)',
                          }}
                        >
                          {cell ?? ''}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        ))}
      </div>

      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        maxWidth: 380,
        lineHeight: 1.5,
        marginTop: 'var(--space-2)',
      }}>
        4D board: each panel is a position in the outer 3×3 space. Win by aligning 3 cells in any 4D direction.
      </div>
    </div>
  );
}
