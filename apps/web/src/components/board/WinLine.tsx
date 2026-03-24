import React from 'react';

interface WinLineProps {
  winCells: number[];
  cols: number;
  rows: number;
}

export function WinLine({ winCells, cols, rows }: WinLineProps) {
  if (winCells.length < 2) return null;

  const first = winCells[0]!;
  const last = winCells[winCells.length - 1]!;

  const x1 = (first % cols) + 0.5;
  const y1 = Math.floor(first / cols) + 0.5;
  const x2 = (last % cols) + 0.5;
  const y2 = Math.floor(last / cols) + 0.5;

  // Extend slightly past the first and last cells
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ext = 0.4;
  const ux = (dx / len) * ext;
  const uy = (dy / len) * ext;

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <line
        x1={x1 - ux}
        y1={y1 - uy}
        x2={x2 + ux}
        y2={y2 + uy}
        stroke="var(--winline-color, #3b82f6)"
        strokeWidth="var(--winline-width, 0.12)"
        strokeLinecap="round"
        style={{ filter: 'var(--winline-filter, none)' }}
      />
    </svg>
  );
}
