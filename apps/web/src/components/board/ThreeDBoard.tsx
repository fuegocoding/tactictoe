'use client';

import React, { useState, useRef } from 'react';
import type { Board } from '@tactictoe/game-engine';
import { WIN_LINES_3D } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { PieceSymbol } from './PieceSymbol';

interface ThreeDBoardProps {
  board: Board; // 27 cells
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

const LAYER_LABELS = ['Layer 1 (Bottom)', 'Layer 2 (Middle)', 'Layer 3 (Top)'];

// ── 3D visualization constants ───────────────────────────────────────────────
const CUBE     = 32;        // cubelet side length in px
const HALF     = CUBE / 2;  // 16px — used for face translateZ
const SPACING  = 40;        // center-to-center spacing (gap = SPACING - CUBE = 8px)

// Six face transforms for a CUBE×CUBE×CUBE CSS box
const FACES = [
  `translateZ(${HALF}px)`,                 // front
  `rotateY(180deg) translateZ(${HALF}px)`, // back
  `rotateY(90deg)  translateZ(${HALF}px)`, // right
  `rotateY(-90deg) translateZ(${HALF}px)`, // left
  `rotateX(-90deg) translateZ(${HALF}px)`, // top
  `rotateX(90deg)  translateZ(${HALF}px)`, // bottom
];

function getWinCells(board: Board): number[] {
  for (const line of WIN_LINES_3D) {
    const [a, b, c] = line;
    if (board[a] != null && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return [];
}

/** One small 3D cube — rendered with all 6 CSS faces + a sticker on each */
function Cubelet({ cell, isWin, symbolX, symbolO }: { cell: string | number | null | undefined; isWin: boolean; symbolX: string; symbolO: string }) {
  const displaySymbol = cell === 'X' ? symbolX : cell === 'O' ? symbolO : null;

  const stickerBg = isWin
    ? '#f59e0b'                       // amber win highlight
    : cell === 'X' ? '#dc2626'        // red  X
    : cell === 'O' ? '#2563eb'        // blue O
    : 'rgba(255,255,255,0.07)';       // almost invisible when empty

  return (
    <div style={{ position: 'relative', width: CUBE, height: CUBE, transformStyle: 'preserve-3d' }}>
      {FACES.map((transform, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            transform,
            background: 'rgba(20, 20, 20, 0.45)', // semi-transparent so inner cubes show through
            border: '1px solid rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backfaceVisibility: 'visible',
          }}
        >
          {/* Colored sticker */}
          <div style={{
            width: CUBE - 6,
            height: CUBE - 6,
            background: stickerBg,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.01em',
          }}>
            {displaySymbol ? <PieceSymbol symbol={displaySymbol} color="#fff" size={15} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Draggable 3D cube — view only, not for playing */
function ThreeDViz({ board, winCells, symbolX, symbolO }: { board: Board; winCells: number[]; symbolX: string; symbolO: string }) {
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // sync ref so onDragMove reads latest value instantly
  const lastPos = useRef({ x: 0, y: 0 });

  const onDragStart = (x: number, y: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPos.current = { x, y };
  };

  const onDragMove = (x: number, y: number) => {
    if (!isDraggingRef.current) return;
    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    lastPos.current = { x, y };
    setRotation(prev => ({
      x: Math.max(-80, Math.min(80, prev.x - dy * 0.5)),
      y: prev.y + dx * 0.5,
    }));
  };

  const onDragEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--text-faint)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>
        3D View — drag to rotate
      </div>

      <div
        style={{
          perspective: '600px',
          perspectiveOrigin: '50% 50%',
          width: 220,
          height: 220,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onMouseDown={e => onDragStart(e.clientX, e.clientY)}
        onMouseMove={e => onDragMove(e.clientX, e.clientY)}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={e => { const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); }}
        onTouchMove={e => { const t = e.touches[0]; if (t) onDragMove(t.clientX, t.clientY); }}
        onTouchEnd={onDragEnd}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {[0, 1, 2].flatMap(layer =>
            [0, 1, 2].flatMap(row =>
              [0, 1, 2].map(col => {
                const globalIndex = layer * 9 + row * 3 + col;
                const cell = board[globalIndex];
                const isWin = winCells.includes(globalIndex);
                const x = (col - 1) * SPACING;
                const y = (row - 1) * SPACING;
                const z = (layer - 1) * SPACING;
                return (
                  <div
                    key={globalIndex}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transformStyle: 'preserve-3d',
                      transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px)`,
                      pointerEvents: 'none',
                    }}
                  >
                    <Cubelet cell={cell} isWin={isWin} symbolX={symbolX} symbolO={symbolO} />
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a 3×3×3 board as three labeled flat grids for gameplay (left)
 * and a draggable CSS 3D Rubik's-cube-style visualization (right).
 *
 * onMove(boardIndex, cellIndex): boardIndex = layer (0–2), cellIndex = row*3+col (0–8)
 */
export function ThreeDBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: ThreeDBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  const effectiveWinCells = winCells.length > 0 ? winCells : getWinCells(board);

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-8)',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      justifyContent: 'center',
      width: '100%',
    }}>

      {/* ── Playing grids ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[0, 1, 2].map(layer => (
            <div key={layer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {LAYER_LABELS[layer]}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '18px repeat(3, minmax(0, 1fr))',
                gridTemplateRows: '18px repeat(3, minmax(0, 1fr))',
                gap: '3px',
                width: '180px',
              }}>
                <div />
                {['a', 'b', 'c'].map(col => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    {col}
                  </div>
                ))}
                {[0, 1, 2].map(row => (
                  <React.Fragment key={row}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      {row + 1}
                    </div>
                    {[0, 1, 2].map(col => {
                      const globalIndex = layer * 9 + row * 3 + col;
                      const cell = board[globalIndex];
                      const isWin = effectiveWinCells.includes(globalIndex);
                      return (
                        <button
                          key={col}
                          disabled={disabled || cell !== null}
                          onClick={() => { if (!disabled && cell === null) onMove(layer, row * 3 + col); }}
                          style={{
                            aspectRatio: '1',
                            fontSize: 'clamp(16px, 4vw, 26px)',
                            fontWeight: 'bold',
                            cursor: disabled || cell !== null ? 'default' : 'pointer',
                            background: isWin ? 'var(--accent-subtle, rgba(59,130,246,0.2))' : 'var(--board-cell-bg)',
                            border: isWin ? '2px solid var(--accent, #3b82f6)' : '1px solid var(--board-cell-border)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.15s',
                          }}
                        >
                          {cell === 'X' ? (
                            <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={22} />
                          ) : cell === 'O' ? (
                            <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={22} />
                          ) : null}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          Win by getting 3-in-a-row across any layer, column, row, or diagonal through all three layers.
        </div>
      </div>

      {/* ── 3D Visualization ──────────────────────────────────── */}
      <ThreeDViz board={board} winCells={effectiveWinCells} symbolX={symbolX} symbolO={symbolO} />
    </div>
  );
}
