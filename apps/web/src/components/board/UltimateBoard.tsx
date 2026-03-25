import React from 'react';
import type { Board, BoardResult } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { PieceSymbol } from './PieceSymbol';

interface UltimateBoardProps {
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  nextBoardConstraint: number | null;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
}

function isBoardPlayable(
  boardIndex: number,
  boardResult: BoardResult,
  nextBoardConstraint: number | null
): boolean {
  if (boardResult !== null) return false;
  if (nextBoardConstraint === null) return true;
  return boardIndex === nextBoardConstraint;
}

export function UltimateBoard({
  boards,
  boardResults,
  nextBoardConstraint,
  currentPlayer,
  disabled,
  onMove,
}: UltimateBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px repeat(3, minmax(0, 1fr))',
        gap: '4px 8px',
        width: '100%',
        maxWidth: '600px',
      }}
    >
      {/* Top Labels */}
      <div />
      {[0, 1, 2].map((bCol) => (
        <div key={bCol} style={{ display: 'flex', justifyContent: 'space-around', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>
          {[0, 1, 2].map((cCol) => (
            <span key={cCol}>{String.fromCharCode(97 + bCol * 3 + cCol)}</span>
          ))}
        </div>
      ))}

      {/* Rows of macro boards */}
      {[0, 1, 2].map((bRow) => (
        <React.Fragment key={bRow}>
          {/* Row Labels */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold', padding: '4px 0' }}>
            {[1, 2, 3].map((cRow) => (
              <span key={cRow} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                {bRow * 3 + cRow}
              </span>
            ))}
          </div>

          {/* Macro boards */}
          {[0, 1, 2].map((bCol) => {
            const boardIndex = bRow * 3 + bCol;
            const board = boards[boardIndex]!;
            const result = boardResults[boardIndex] ?? null;
            const playable = !disabled && isBoardPlayable(boardIndex, result, nextBoardConstraint);

            return (
              <div
                key={boardIndex}
                style={{
                  padding: '4px',
                  border: playable ? '2px solid var(--board-active-border)' : '2px solid var(--board-inactive-border)',
                  borderRadius: 'var(--radius-sm)',
                  position: 'relative',
                  background: 'var(--board-cell-bg)',
                }}
              >
                {result !== null && (
                  <div
                    data-testid={`mini-board-result-${boardIndex}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(24px, 4vw, 48px)',
                      fontWeight: 'bold',
                      background: 'var(--board-result-overlay)',
                      zIndex: 1,
                      borderRadius: '2px',
                      color: result === 'X' ? 'var(--mark-x)' : result === 'O' ? 'var(--mark-o)' : 'var(--text-muted)',
                    }}
                  >
                    {result === 'draw' ? '=' : result === 'X' ? (
                      <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={36} />
                    ) : (
                      <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={36} />
                    )}
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '2px',
                    height: '100%',
                  }}
                >
                  {board.map((cell, cellIndex) => (
                    <button
                      key={cellIndex}
                      disabled={!playable || cell !== null}
                      onClick={() => {
                        if (playable && cell === null) onMove(boardIndex, cellIndex);
                      }}
                      style={{
                        aspectRatio: '1',
                        fontSize: 'clamp(12px, 2vw, 20px)',
                        fontWeight: 'bold',
                        cursor: !playable || cell !== null ? 'default' : 'pointer',
                        background: 'var(--board-cell-bg)',
                        border: '1px solid var(--board-cell-border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {cell === 'X' ? (
                        <PieceSymbol symbol={symbolX} color="var(--mark-x)" size={14} />
                      ) : cell === 'O' ? (
                        <PieceSymbol symbol={symbolO} color="var(--mark-o)" size={14} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
