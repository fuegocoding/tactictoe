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

const LAYER_LABELS = ['Top', 'Middle', 'Bottom'];
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
      ? 'var(--win-bg, rgba(34,197,94,0.85))'
      : isWin
      ? 'var(--win-bg-subtle, rgba(34,197,94,0.15))'
      : isOccupied
      ? pieceColor
      : 'var(--cube-face-empty)',
    border: isWin ? '2px solid var(--win-border, #22c55e)' : '1px solid var(--cube-face-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'visible',
    boxSizing: 'border-box',
  };

  const faceContent = isOccupied && symbol ? (
    <div style={{ color: 'var(--cube-symbol)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PieceSymbol symbol={symbol} color="currentColor" size={CUBE * 0.6} />
    </div>
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
          transform: `translate3d(${GIZMO_ARM + 10}px, -6px, 0) ${billboard}`,
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
          transform: `translate3d(-4px, ${GIZMO_ARM + 10}px, 0) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap',
        }}>Y</div>

        {/* Z axis — blue, points toward viewer (+Z in CSS 3D) */}
        <div style={{
          position: 'absolute',
          width: 2, height: GIZMO_ARM,
          background: '#3b82f6',
          top: 0, left: -1,
          transform: 'rotateX(90deg)',
          transformOrigin: 'center top',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-50%, -50%, ${GIZMO_ARM + 2}px) ${billboard}`,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#3b82f6',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-3px, 0, ${GIZMO_ARM + 6}px) ${billboard}`,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
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
            {/* Layer outline frames — one flat border per z-slice */}
            {[0, 1, 2].map(layer => {
              const z = (1 - layer) * SPACING;
              const frameSize = 2 * SPACING + CUBE + 8;
              return (
                <div
                  key={`layer-frame-${layer}`}
                  style={{
                    position: 'absolute',
                    width: frameSize,
                    height: frameSize,
                    border: '1px solid var(--cube-layer-border)',
                    background: 'transparent',
                    transform: `translate3d(${-frameSize / 2}px, ${-frameSize / 2}px, ${z}px)`,
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })}

            {/* Cubelets */}
            {[0, 1, 2].flatMap(layer =>
              [0, 1, 2].flatMap(row =>
                [0, 1, 2].map(col => {
                  const globalIndex = layer * 9 + row * 3 + col;
                  const cell = board[globalIndex] ?? null;
                  const isWin = winCells?.includes(globalIndex) ?? false;
                  const x = (col - 1) * SPACING;
                  const y = (row - 1) * SPACING;
                  const z = (1 - layer) * SPACING;
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

        <AxisGizmo rotation={rotation} />
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
                            background: isWin ? 'var(--win-bg-subtle, rgba(34,197,94,0.15))' : 'var(--board-cell-bg)',
                            border: isWin ? '2px solid var(--win-border, #22c55e)' : '1px solid var(--board-cell-border)',
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
