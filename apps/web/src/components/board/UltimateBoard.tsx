'use client';

import type { Board, BoardResult } from '@tactictoe/game-engine';

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
  disabled,
  onMove,
}: UltimateBoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '8px',
        width: '100%',
        maxWidth: '600px',
      }}
    >
      {boards.map((board, boardIndex) => {
        const result = boardResults[boardIndex] ?? null;
        const playable = !disabled && isBoardPlayable(boardIndex, result, nextBoardConstraint);

        return (
          <div
            key={boardIndex}
            style={{
              padding: '4px',
              border: playable ? '2px solid #4ade80' : '2px solid #374151',
              borderRadius: '4px',
              position: 'relative',
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
                  background: 'rgba(0,0,0,0.6)',
                  zIndex: 1,
                  borderRadius: '2px',
                }}
              >
                {result === 'draw' ? '=' : result}
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '2px',
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
                  }}
                >
                  {cell ?? ''}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
