import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { WIN_LINES_3D } from '@tactictoe/game-engine';

interface ThreeDBoardProps {
  board: Board; // 27 cells
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  /** Highlight winning cells */
  winCells?: number[];
}

const CELL = 40;                  // cell size in px
const GAP = 4;                    // gap between cells in px
const GRID = CELL * 3 + GAP * 2; // 128px – total layer grid size
const Z_GAP = 135;                // Z distance between layers in px

const LAYER_LABELS = ['Bottom', 'Middle', 'Top'];

function getWinCells(board: Board): number[] {
  for (const line of WIN_LINES_3D) {
    const [a, b, c] = line;
    if (board[a] != null && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return [];
}

/**
 * Renders a 3×3×3 board as a CSS 3D perspective cube.
 * Three layers float at different Z positions, viewed from an elevated angle.
 *
 * onMove(boardIndex, cellIndex): boardIndex = layer (0–2), cellIndex = row*3+col (0–8)
 */
export function ThreeDBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: ThreeDBoardProps) {
  const effectiveWinCells = winCells.length > 0 ? winCells : getWinCells(board);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', width: '100%' }}>

      {/* 3D perspective wrapper */}
      <div style={{
        perspective: '700px',
        perspectiveOrigin: '50% -5%',
        overflow: 'visible',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '110px',
        paddingBottom: '55px',
      }}>
        {/* Rotating 3D cube */}
        <div style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(45deg) rotateY(-12deg)',
          position: 'relative',
          width: GRID,
          height: GRID,
        }}>
          {[0, 1, 2].map(layer => (
            <div
              key={layer}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateZ(${layer * Z_GAP}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(3, ${CELL}px)`,
                gridTemplateRows: `repeat(3, ${CELL}px)`,
                gap: GAP,
                pointerEvents: 'none',
              }}
            >
              {[0, 1, 2].flatMap(row =>
                [0, 1, 2].map(col => {
                  const globalIndex = layer * 9 + row * 3 + col;
                  const cell = board[globalIndex];
                  const isWin = effectiveWinCells.includes(globalIndex);
                  return (
                    <button
                      key={`${row}-${col}`}
                      disabled={disabled || cell !== null}
                      onClick={() => {
                        if (!disabled && cell === null) onMove(layer, row * 3 + col);
                      }}
                      style={{
                        width: CELL,
                        height: CELL,
                        fontSize: 18,
                        lineHeight: 1,
                        fontWeight: 'bold',
                        cursor: disabled || cell !== null ? 'default' : 'pointer',
                        background: isWin
                          ? 'var(--accent-subtle)'
                          : 'var(--board-cell-bg)',
                        border: isWin
                          ? '2px solid var(--accent)'
                          : '1px solid var(--board-cell-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: cell === 'X' ? 'var(--mark-x)' : 'var(--mark-o)',
                        transition: 'background 0.15s',
                        pointerEvents: 'auto',
                      }}
                    >
                      {cell != null ? String(cell) : ''}
                    </button>
                  );
                })
              )}

              {/* Layer label – floats to the right of each plane in 3D space */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: GRID + 10,
                  transform: 'translateY(-50%)',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {LAYER_LABELS[layer]}
              </div>
            </div>
          ))}
        </div>
      </div>

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
