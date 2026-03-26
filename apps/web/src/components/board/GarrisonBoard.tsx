'use client';

import React from 'react';
import type { GarrisonState, GarrisonPiece } from '@tactictoe/game-engine';
import { useCosmetics } from '../CosmeticsContext';

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
  const { chessSet } = useCosmetics();
  const LIGHT_SQ = 'var(--chess-light, #f0d9b5)';
  const DARK_SQ  = 'var(--chess-dark, #b58863)';

  const squarePiece = new Map<number, GarrisonPiece>();
  for (const p of pieces) {
    if (p.square >= 0 && !p.captured) squarePiece.set(p.square, p);
  }

  const legalSet = new Set(legalDestinations);
  const winSet   = new Set(winSquares);

  const xHand = pieces.filter(p => p.player === 'X' && p.square === -1 && !p.captured);
  const oHand = pieces.filter(p => p.player === 'O' && p.square === -1 && !p.captured);

  function renderHandPiece(p: GarrisonPiece) {
    const isSelected = selectedPieceId === p.id;
    const isOwn = p.player === currentPlayer;
    return (
      <button
        key={p.id}
        disabled={disabled || !isOwn}
        onClick={() => !disabled && isOwn && onHandPieceClick(p.id)}
        title={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
        style={{
          background: isSelected ? 'rgba(59,130,246,0.3)' : 'transparent',
          border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
          borderRadius: 4,
          cursor: isOwn && !disabled ? 'pointer' : 'default',
          padding: 2,
          lineHeight: 0,
        }}
      >
        <img
          src={`/pieces/${chessSet}/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
          width={30}
          height={30}
          alt={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
          draggable={false}
          style={{ display: 'block', userSelect: 'none' }}
        />
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
                    position: 'relative',
                  }}
                >
                  {isLegal && !p && (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'rgba(59,130,246,0.5)',
                    }} />
                  )}
                  {isLegal && p && p.player !== currentPlayer && (
                    <div style={{
                      position: 'absolute',
                      width: 42, height: 42, borderRadius: '50%',
                      border: '3px solid rgba(220,38,38,0.85)',
                      pointerEvents: 'none',
                    }} />
                  )}
                  {p && (
                    <img
                      src={`/pieces/${chessSet}/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
                      width={38}
                      height={38}
                      alt={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
                      draggable={false}
                      style={{ display: 'block', userSelect: 'none' }}
                    />
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
