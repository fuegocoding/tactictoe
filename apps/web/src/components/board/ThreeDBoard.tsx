'use client';
import React, { useState, useRef } from 'react';
import { PieceSymbol } from './PieceSymbol';
import { useCosmetics } from '@/components/CosmeticsContext';
import { getWinCells } from '@tactictoe/game-engine';
import type { Board } from '@tactictoe/game-engine';

export interface ThreeDBoardProps {
  board: Board;
  currentPlayer: string;
  disabled: boolean;
  onMove: (layer: number, index: number) => void;
  winCells?: number[];
}

const LAYER_LABELS = ['Layer 1 (Top)', 'Layer 2 (Middle)', 'Layer 3 (Bottom)'];
const CUBE = 40;
const SPACING = CUBE + 10;
const HALF = CUBE / 2;
const GIZMO_ARM = 28;

function Cubelet({ cell, isWin, symbolX, symbolO }: { cell: string | number | null; isWin: boolean; symbolX: string; symbolO: string }) {
  const isX = cell === 'X';
  const isO = cell === 'O';
  const isOccupied = isX || isO;
  const pieceColor = isOccupied ? (isX ? 'var(--mark-x)' : 'var(--mark-o)') : undefined;
  const symbol = isX ? symbolX : isO ? symbolO : null;

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width: CUBE,
    height: CUBE,
    background: isWin && isOccupied
      ? 'var(--accent)'
      : isWin
      ? 'var(--accent-subtle, rgba(59,130,246,0.15))'
      : isOccupied
      ? pieceColor
      : 'var(--cube-face-empty)',
    border: isWin ? '2px solid var(--accent, #3b82f6)' : '1px solid var(--cube-face-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'visible',
    boxSizing: 'border-box',
  };

  const faceContent = isOccupied && symbol ? (
    <PieceSymbol symbol={symbol} color="rgba(255,255,255,0.85)" size={CUBE * 0.6} />
  ) : null;

  return (
    <div style={{ position: 'relative', width: CUBE, height: CUBE, transformStyle: 'preserve-3d' }}>
      {/* Front */}
      <div style={{ ...faceStyle, transform: `translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Back */}
      <div style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Right */}
      <div style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Left */}
      <div style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Top */}
      <div style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Bottom */}
      <div style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
    </div>
  );
}

function AxisGizmo({ rotation }: { rotation: { x: number; z: number } }) {
  const billboard = `rotateZ(${-rotation.z}deg) rotateX(${-rotation.x}deg)`;

  return (
    <div
      style={{
        perspective: '300px',
        width: 64,
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
        }}
      >
        {/* X axis — red, points right (+X) */}
        <div style={{ position: 'absolute', width: GIZMO_ARM, height: 2, background: '#ef4444', top: -1, left: 0 }} />
        <div style={{
          position: 'absolute',
          left: GIZMO_ARM, top: -4,
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '7px solid #ef4444',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(${GIZMO_ARM + 10}px, -50%, 0) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap',
        }}>X</div>

        {/* Y axis — green, points down (+Y in CSS) */}
        <div style={{ position: 'absolute', width: 2, height: GIZMO_ARM, background: '#22c55e', top: 0, left: -1 }} />
        <div style={{
          position: 'absolute',
          top: GIZMO_ARM, left: -4,
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '7px solid #22c55e',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-50%, ${GIZMO_ARM + 10}px, 0) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap',
        }}>Y</div>

        {/* Z axis — blue, points toward viewer (+Z in CSS 3D) */}
        <div style={{
          position: 'absolute',
          width: 2, height: GIZMO_ARM,
          background: '#3b82f6',
          top: 0, left: -1,
          transform: 'rotateX(-90deg)',
          transformOrigin: 'center top',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-50%, 0, ${GIZMO_ARM + 6}px) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap',
        }}>Z</div>
      </div>
    </div>
  );
}

export function ThreeDViz({ board, winCells = [], symbolX, symbolO }: { board: Board; winCells?: number[]; symbolX: string; symbolO: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Use rotateX to tilt floors to be horizontal, rotateZ to spin the board.
  // x: 60 gives a good isometric tilt. z: -45 gives a corner-forward perspective.
  const [rotation, setRotation] = useState({ x: 60, z: -45 });

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
      x: Math.max(0, Math.min(90, prev.x - dy * 0.5)), // Tilt bounds: 0 (face-on) to 90 (top-down)
      z: prev.z + dx * 0.5,
    }));
  };

  const onDragEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Billboard transform to make text always face the camera
  const billboardTransform = `rotateZ(${-rotation.z}deg) rotateX(${-rotation.x}deg)`;

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
          perspective: '800px',
          perspectiveOrigin: '50% 50%',
          width: 280,
          height: 280,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
            transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
            width: 0,
            height: 0,
            position: 'relative',
          }}
        >
          {/* Axis Labels */}

          {/* X Axis (Columns: A, B, C) - Front edge of the bottom floor (Layer 3) */}
          {['A', 'B', 'C'].map((label, col) => {
            const x = (col - 1) * SPACING;
            const y = 1.6 * SPACING;
            const z = SPACING; // Layer 3 (Bottom)
            return (
              <div
                key={`x-${col}`}
                style={{
                  position: 'absolute',
                  transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px) ${billboardTransform}`,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-muted, rgba(255,255,255,0.7))',
                  pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                {label}
              </div>
            );
          })}

          {/* Y Axis (Rows: 1, 2, 3) - Left edge of the top floor (Layer 1) */}
          {['1', '2', '3'].map((label, row) => {
            const x = -1.6 * SPACING;
            const y = (row - 1) * SPACING;
            const z = -SPACING; // Layer 1 (Top)
            return (
              <div
                key={`y-${row}`}
                style={{
                  position: 'absolute',
                  transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px) ${billboardTransform}`,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-muted, rgba(255,255,255,0.7))',
                  pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                {label}
              </div>
            );
          })}

          {/* Z Axis (Layers: L1, L2, L3) - Right-back edge of the vertical stack */}
          {['L1', 'L2', 'L3'].map((label, layer) => {
            const x = 1.6 * SPACING;  // Right
            const y = -1.6 * SPACING; // Back
            const z = (layer - 1) * SPACING;
            return (
              <div
                key={`z-${layer}`}
                style={{
                  position: 'absolute',
                  transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px) ${billboardTransform}`,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-muted, rgba(255,255,255,0.7))',
                  pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                {label}
              </div>
            );
          })}

          {[0, 1, 2].flatMap(layer =>
            [0, 1, 2].flatMap(row =>
              [0, 1, 2].map(col => {
                const globalIndex = layer * 9 + row * 3 + col;
                const cell = board[globalIndex] ?? null;
                const isWin = winCells?.includes(globalIndex) ?? false;
                const x = (col - 1) * SPACING;
                const y = (row - 1) * SPACING;
                const z = (layer - 1) * SPACING;
                return (
                  <div
                    key={globalIndex}
                    style={{
                      position: 'absolute',
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

export function ThreeDBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: ThreeDBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  const effectiveWinCells = winCells.length > 0 ? winCells : (getWinCells(board) || []);

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
