'use client';

import React from 'react';
import type { GarrisonState } from '@tactictoe/game-engine';
import type { GarrisonPiece, PieceType } from '@tactictoe/game-engine';

const PIECE_SYMBOL: Record<PieceType, { X: string; O: string }> = {
  K: { X: '♚', O: '♔' },
  Q: { X: '♛', O: '♕' },
  R: { X: '♜', O: '♖' },
  B: { X: '♝', O: '♗' },
  N: { X: '♞', O: '♘' },
};

const LIGHT_SQ = '#f0d9b5';
const DARK_SQ  = '#b58863';

interface GarrisonBoardProps {
  state: GarrisonState;
  disabled: boolean;
  selectedPieceId: string | null;
  legalDestinations: number[];
  onHandPieceClick: (pieceId: string) => void;
  onBoardSquareClick: (square: number, pieceId: string | null) => void;
  winSquares?: number[];
}

function colLabel(col: number): string { return String.fromCharCode(97 + col); }

export function GarrisonBoard({
  state,
  disabled,
  selectedPieceId,
  legalDestinations,
  onHandPieceClick,
  onBoardSquareClick,
  winSquares = [],
}: GarrisonBoardProps) {
  const { pieces, currentPlayer } = state;

  const squarePiece = new Map<number, GarrisonPiece>();
  for (const p of pieces) {
    if (p.square >= 0 && !p.captured) squarePiece.set(p.square, p);
  }

  const legalSet = new Set(legalDestinations);
  const winSet   = new Set(winSquares);

  const xHand = pieces.filter(p => p.player === 'X' && p.square === -1 && !p.captured);
  const oHand = pieces.filter(p => p.player === 'O' && p.square === -1 && !p.captured);

  function renderHandPiece(p: GarrisonPiece) {
    const sym = PIECE_SYMBOL[p.type][p.player];
    const isSelected = selectedPieceId === p.id;
    const isOwn = p.player === currentPlayer;
    return (
      <button
        key={p.id}
        disabled={disabled || !isOwn}
        onClick={() => !disabled && isOwn && onHandPieceClick(p.id)}
        title={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
        style={{
          fontSize: 24,
          lineHeight: 1,
          background: isSelected ? 'rgba(59,130,246,0.3)' : 'transparent',
          border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
          borderRadius: 4,
          cursor: isOwn && !disabled ? 'pointer' : 'default',
          padding: 2,
          color: p.player === 'X' ? '#111' : '#eee',
          textShadow: p.player === 'X'
            ? '0 0 1px #fff, 0 0 1px #fff'
            : '0 0 1px #000, 0 0 1px #000',
        }}
      >
        {sym}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* O hand (top) */}
      <div style={{ display: 'flex', gap: 4, minHeight: 36, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>O hand:</span>
        {oHand.map(renderHandPiece)}
        {oHand.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
      </div>

      {/* Board */}
      <div>
        {/* Column labels top */}
        <div style={{ display: 'grid', gridTemplateColumns: '20px repeat(8, 52px)', marginBottom: 2 }}>
          <div />
          {[0,1,2,3,4,5,6,7].map(c => (
            <div key={c} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
              {colLabel(c)}
            </div>
          ))}
        </div>

        {/* Rows 8→1 */}
        {[7,6,5,4,3,2,1,0].map(r => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: '20px repeat(8, 52px)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              {r + 1}
            </div>
            {[0,1,2,3,4,5,6,7].map(c => {
              const sq = r * 8 + c;
              const p  = squarePiece.get(sq);
              const isLight     = (r + c) % 2 !== 0;
              const isLegal     = legalSet.has(sq);
              const isWin       = winSet.has(sq);
              const isSelected  = !!(p && p.id === selectedPieceId);
              const isOwn       = !!(p && p.player === currentPlayer);
              const clickable   = !disabled && (isLegal || isOwn);

              const bg = isWin
                ? 'var(--accent-subtle, rgba(59,130,246,0.35))'
                : isSelected
                ? 'rgba(251,191,36,0.45)'
                : isLight ? LIGHT_SQ : DARK_SQ;

              const border = isWin
                ? '2px solid var(--accent, #3b82f6)'
                : isSelected
                ? '2px solid #f59e0b'
                : isLegal && !p
                ? '2px solid rgba(59,130,246,0.6)'
                : '1px solid transparent';

              return (
                <div
                  key={c}
                  onClick={() => clickable && onBoardSquareClick(sq, p?.id ?? null)}
                  style={{
                    width: 52, height: 52,
                    background: bg, border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: clickable ? 'pointer' : 'default',
                    boxSizing: 'border-box',
                  }}
                >
                  {isLegal && !p && (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'rgba(59,130,246,0.5)',
                    }} />
                  )}
                  {p && (
                    <span style={{
                      fontSize: 30, lineHeight: 1,
                      color: p.player === 'X' ? '#111' : '#fff',
                      textShadow: p.player === 'X'
                        ? '0 0 2px #fff, 0 0 2px #fff'
                        : '0 0 2px #000, 0 0 2px #000, 0 0 2px #000',
                    }}>
                      {PIECE_SYMBOL[p.type][p.player]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Column labels bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '20px repeat(8, 52px)', marginTop: 2 }}>
          <div />
          {[0,1,2,3,4,5,6,7].map(c => (
            <div key={c} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
              {colLabel(c)}
            </div>
          ))}
        </div>
      </div>

      {/* X hand (bottom) */}
      <div style={{ display: 'flex', gap: 4, minHeight: 36, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>X hand:</span>
        {xHand.map(renderHandPiece)}
        {xHand.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
      </div>
    </div>
  );
}
