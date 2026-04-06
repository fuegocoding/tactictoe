import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { getWinCells } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { PieceSymbol } from './PieceSymbol';
import { ThreeDViz } from './ThreeDBoard';

interface Ultimate3DBoardProps {
  microBoards: Board[];       // 27 boards, each 27 cells
  macroResults: (string | null)[];  // 27 macro-cell results
  nextMacroConstraint: number | null;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (macroCell: number, microCell: number) => void;
  winCells?: number[];
}

const LAYER_LABELS = ['Meta-Layer 1', 'Meta-Layer 2', 'Meta-Layer 3'];

/**
 * Ultimate 3D TTT board.
 * The meta-grid is a 3×3×3 cube of macro-cells, shown as 3 layers.
 * Each macro-cell contains a 3×3×3 micro-board, shown as 3 mini-layers.
 *
 * For rendering performance we show one meta-layer at a time.
 */
export function Ultimate3DBoard({
  microBoards,
  macroResults,
  nextMacroConstraint,
  currentPlayer,
  disabled,
  onMove,
  winCells: _winCells,
}: Ultimate3DBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  const [selectedMetaLayer, setSelectedMetaLayer] = React.useState(0);
  const [selectedMicroLayer, setSelectedMicroLayer] = React.useState(0);

  // Meta-layer contains 9 macro-cells: layer*9 + row*3 + col
  const macroCellsInLayer = Array.from({ length: 9 }, (_, i) => selectedMetaLayer * 9 + i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', width: '100%' }}>
      {/* Meta-layer picker */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Meta-Layer:
        </span>
        {[0, 1, 2].map(l => (
          <button
            key={l}
            onClick={() => setSelectedMetaLayer(l)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: selectedMetaLayer === l ? 'var(--accent)' : 'var(--bg-raised)',
              color: selectedMetaLayer === l ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            L{l + 1}
          </button>
        ))}
      </div>

      {/* Micro-layer picker */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Micro-Layer:
        </span>
        {[0, 1, 2].map(l => (
          <button
            key={l}
            onClick={() => setSelectedMicroLayer(l)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: selectedMicroLayer === l ? 'var(--accent-subtle)' : 'var(--bg-raised)',
              color: selectedMicroLayer === l ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${selectedMicroLayer === l ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            m{l + 1}
          </button>
        ))}
      </div>

      {/* 3×3 grid of macro-cells for the selected meta-layer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: '8px',
      }}>
        {macroCellsInLayer.map(macroCell => {
          const macroResult = macroResults[macroCell];
          const isConstrained = nextMacroConstraint === macroCell;
          const isActive = nextMacroConstraint === null || isConstrained;
          const board = microBoards[macroCell] ?? new Array(27).fill(null);

          return (
            <div key={macroCell} style={{
              padding: '4px',
              border: isConstrained
                ? '2px solid var(--accent)'
                : macroResult
                ? '1px solid var(--border-strong)'
                : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: macroResult
                ? (macroResult === 'X' ? 'color-mix(in srgb, var(--mark-x) 12%, transparent)'
                  : macroResult === 'O' ? 'color-mix(in srgb, var(--mark-o) 12%, transparent)'
                  : 'var(--surface-2, rgba(100,100,100,0.1))')
                : isConstrained
                ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
                : 'var(--bg-raised)',
              position: 'relative',
            }}>
              {/* Macro result overlay */}
              {macroResult && macroResult !== 'draw' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', fontWeight: 900, zIndex: 1,
                  opacity: 0.8,
                  pointerEvents: 'none',
                }}>
                  {macroResult === 'X' ? (
                    <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={28} />
                  ) : (
                    <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={28} />
                  )}
                </div>
              )}

              {/* Micro-board for the selected micro-layer (micro-layer = 9 cells) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2px',
                width: '108px',
                opacity: macroResult ? 0.4 : 1,
              }}>
                {[0, 1, 2].map(row =>
                  [0, 1, 2].map(col => {
                    const microCell = selectedMicroLayer * 9 + row * 3 + col;
                    const cell = board[microCell];
                    const clickable = !disabled && !macroResult && isActive && cell === null;
                    return (
                      <button
                        key={microCell}
                        disabled={!clickable}
                        onClick={() => { if (clickable) onMove(macroCell, microCell); }}
                        style={{
                          aspectRatio: '1',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: clickable ? 'pointer' : 'default',
                          background: 'var(--board-cell-bg)',
                          border: '1px solid var(--board-cell-border)',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {cell === 'X' ? (
                          <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={16} />
                        ) : cell === 'O' ? (
                          <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={16} />
                        ) : '·'}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Macro-cell label */}
              <div style={{ fontSize: '9px', color: 'var(--text-faint)', textAlign: 'center', marginTop: '2px' }}>
                M{macroCell}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 440, lineHeight: 1.5 }}>
        Switch meta-layers to see all 27 macro-cells. The highlighted macro-cell is where you must play.
        Win 3 macro-cells in a 3D line to claim the match.
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <ThreeDViz
          board={macroResults as Board}
          winCells={getWinCells(macroResults as Board) ?? undefined}
          symbolX={symbolX}
          symbolO={symbolO}
        />
      </div>
    </div>
  );
}
