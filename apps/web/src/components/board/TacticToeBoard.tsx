import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { PieceSymbol } from './PieceSymbol';

type MoveMode = 'place' | 'move_obstacle';

interface TacticToeBoardProps {
  board: Board; // 27 cells: null | 'X' | 'O' | 'B'
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  moveMode: MoveMode;
  selectedObstacle: number | null;
  onCellClick: (globalIndex: number) => void;
  winCells?: number[];
}

const LAYER_LABELS = ['Layer 1', 'Layer 2', 'Layer 3'];

/**
 * Renders a 3×3×3 Tactic Toe board with obstacle support.
 * Obstacles are rendered with a distinct visual style.
 *
 * onCellClick passes the global 0-26 cell index.
 */
export function TacticToeBoard({
  board,
  currentPlayer,
  disabled,
  moveMode,
  selectedObstacle,
  onCellClick,
  winCells = [],
}: TacticToeBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
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

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '4px',
              width: '168px',
            }}>
              {[0, 1, 2].map(row =>
                [0, 1, 2].map(col => {
                  const globalIndex = layer * 9 + row * 3 + col;
                  const cell = board[globalIndex];
                  const isObstacle = cell === 'B';
                  const isWin = winCells.includes(globalIndex);
                  const isSelectedObstacle = selectedObstacle === globalIndex;
                  const isEmpty = cell === null;

                  // Determine if this cell is clickable
                  let clickable = !disabled;
                  if (moveMode === 'place') {
                    clickable = clickable && isEmpty;
                  } else {
                    // move_obstacle mode: click obstacle to select, or empty to move selected
                    clickable = clickable && (isObstacle || (isEmpty && selectedObstacle !== null));
                  }

                  return (
                    <button
                      key={col}
                      disabled={!clickable}
                      onClick={() => {
                        if (clickable) onCellClick(globalIndex);
                      }}
                      title={isObstacle ? 'Obstacle — can be moved' : undefined}
                      style={{
                        aspectRatio: '1',
                  minWidth: 0,
                  minHeight: 0,
                  padding: 0,
                        fontSize: 'clamp(14px, 3.5vw, 22px)',
                        fontWeight: 'bold',
                        cursor: clickable ? 'pointer' : 'default',
                        background: isSelectedObstacle
                          ? 'rgba(251,191,36,0.3)'
                          : isWin
                          ? 'var(--accent-subtle, rgba(59,130,246,0.2))'
                          : isObstacle
                          ? 'var(--surface-2, rgba(100,100,100,0.2))'
                          : 'var(--board-cell-bg)',
                        border: isSelectedObstacle
                          ? '2px solid #f59e0b'
                          : isWin
                          ? '2px solid var(--accent, #3b82f6)'
                          : isObstacle
                          ? '1px dashed var(--text-muted)'
                          : '1px solid var(--board-cell-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: isObstacle ? 'var(--text-muted)' : 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      {isObstacle ? '▪' : cell === 'X' ? (
                        <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={24} />
                      ) : cell === 'O' ? (
                        <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={24} />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        maxWidth: 400,
        lineHeight: 1.5,
      }}>
        {moveMode === 'place'
          ? 'Click any empty cell to place your mark.'
          : selectedObstacle !== null
          ? 'Now click an empty cell to move the obstacle there.'
          : 'Click an obstacle (▪) to select it, then choose where to move it.'}
      </div>
    </div>
  );
}
