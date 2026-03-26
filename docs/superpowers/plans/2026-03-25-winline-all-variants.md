# Win Line + Unified Skins for All Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the win line (SVG slash or 3D cell highlight) in every variant that supports it, and make all four winline cosmetic skins control both the SVG line colour and the 3D cell highlight colour.

**Architecture:** Fix missing `winCells`/`winSquares` prop-passing in local/vs-ai pages; add a `winCells` prop + `WinLine` overlay to `UltimateBoard`; wire `--win-bg`/`--win-bg-subtle`/`--win-border` into the cosmetics system so one equipped skin drives everything.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest + Testing Library, CSS custom properties

---

## Files Modified

| File | Change |
|---|---|
| `apps/web/src/components/board/UltimateBoard.tsx` | Add `winCells` prop, restructure macro layout, render `<WinLine>` |
| `apps/web/src/components/board/UltimateBoard.test.tsx` | Add test for WinLine rendering |
| `apps/web/src/app/local/page.tsx` | Pass `winCells` for 3D/4D/TacticToe/Ultimate3D/OrderChaos; pass `winCells` to UltimateBoard |
| `apps/web/src/app/vs-ai/page.tsx` | Same as local; add `checkFiveInARow` import; add `winSquares` to Garrison |
| `apps/web/src/app/room/[code]/page.tsx` | Add `winCells` to UltimateBoard; add `winSquares` + `checkFiveInARow` to Garrison |
| `apps/web/src/components/CosmeticsProvider.tsx` | Add `--win-bg`, `--win-bg-subtle`, `--win-border` to `CSS_VAR_KEYS` |
| `apps/web/src/app/globals.css` | Change `--winline-color` default from `#3b82f6` → `#22c55e` |
| `apps/web/src/app/api/cosmetics/route.ts` | Expand each winline skin `cssValue` with win-bg vars |

---

## Task 1: UltimateBoard — winCells prop + WinLine overlay

**Files:**
- Modify: `apps/web/src/components/board/UltimateBoard.test.tsx`
- Modify: `apps/web/src/components/board/UltimateBoard.tsx`

- [ ] **Step 1.1: Add failing test for WinLine rendering**

Open `apps/web/src/components/board/UltimateBoard.test.tsx` and add this test inside the existing `describe('UltimateBoard', ...)` block:

```tsx
it('renders an SVG win line when winCells is provided', () => {
  const results = [...emptyResults] as typeof emptyResults;
  results[0] = 'X';
  results[4] = 'X';
  results[8] = 'X';
  const { container } = render(
    <UltimateBoard
      boards={emptyBoards}
      boardResults={results}
      nextBoardConstraint={null}
      currentPlayer="O"
      disabled={true}
      onMove={vi.fn()}
      winCells={[0, 4, 8]}
    />
  );
  expect(container.querySelector('svg')).toBeInTheDocument();
});

it('does not render an SVG win line when winCells is empty', () => {
  const { container } = render(
    <UltimateBoard
      boards={emptyBoards}
      boardResults={emptyResults}
      nextBoardConstraint={null}
      currentPlayer="X"
      disabled={false}
      onMove={vi.fn()}
    />
  );
  expect(container.querySelector('svg')).not.toBeInTheDocument();
});
```

- [ ] **Step 1.2: Run tests to confirm failure**

```bash
pnpm --filter web test
```

Expected: 2 new tests FAIL — `winCells` prop doesn't exist yet.

- [ ] **Step 1.3: Rewrite UltimateBoard.tsx**

Replace the entire contents of `apps/web/src/components/board/UltimateBoard.tsx` with:

```tsx
import React from 'react';
import type { Board, BoardResult } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { PieceSymbol } from './PieceSymbol';
import { WinLine } from './WinLine';

interface UltimateBoardProps {
  boards: [Board, Board, Board, Board, Board, Board, Board, Board, Board];
  boardResults: [BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult, BoardResult];
  nextBoardConstraint: number | null;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
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
  winCells = [],
}: UltimateBoardProps) {
  const { symbolX, symbolO } = useCosmetics();

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        width: '100%',
        maxWidth: '600px',
      }}
    >
      {/* Row labels column */}
      <div
        style={{
          width: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '20px',
        }}
      >
        {[0, 1, 2].map((bRow) => (
          <div
            key={bRow}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '4px 0',
            }}
          >
            {[1, 2, 3].map((cRow) => (
              <span
                key={cRow}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
              >
                {bRow * 3 + cRow}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Column labels + board area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Column labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0 8px',
          }}
        >
          {[0, 1, 2].map((bCol) => (
            <div
              key={bCol}
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                color: 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {[0, 1, 2].map((cCol) => (
                <span key={cCol}>{String.fromCharCode(97 + bCol * 3 + cCol)}</span>
              ))}
            </div>
          ))}
        </div>

        {/* 3×3 mini-boards grid + WinLine overlay */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '4px',
            position: 'relative',
          }}
        >
          {[0, 1, 2].map((bRow) =>
            [0, 1, 2].map((bCol) => {
              const boardIndex = bRow * 3 + bCol;
              const board = boards[boardIndex]!;
              const result = boardResults[boardIndex] ?? null;
              const playable = !disabled && isBoardPlayable(boardIndex, result, nextBoardConstraint);

              return (
                <div
                  key={boardIndex}
                  style={{
                    padding: '4px',
                    border: playable
                      ? '2px solid var(--board-active-border)'
                      : '2px solid var(--board-inactive-border)',
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
                        color:
                          result === 'X'
                            ? 'var(--mark-x)'
                            : result === 'O'
                            ? 'var(--mark-o)'
                            : 'var(--text-muted)',
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
            })
          )}
          {winCells.length > 0 && <WinLine winCells={winCells} cols={3} rows={3} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.4: Run all web tests**

```bash
pnpm --filter web test
```

Expected: all 55 tests pass (53 existing + 2 new).

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/src/components/board/UltimateBoard.tsx apps/web/src/components/board/UltimateBoard.test.tsx
git commit -m "feat: add winCells prop and WinLine overlay to UltimateBoard"
```

---

## Task 2: Fix local/page.tsx — missing winCells on all affected variants

**Files:**
- Modify: `apps/web/src/app/local/page.tsx`

No unit tests for this page — verification is visual + build typecheck.

- [ ] **Step 2.1: Add winCells to UltimateBoard in local/page.tsx**

Find the block (around line 594–602):
```tsx
) : variant === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(gameState as UltimateTTTState).boards}
    boardResults={(gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={gameState.currentPlayer}
    disabled={phase === 'over'}
    onMove={handleMove}
  />
```

Replace with:
```tsx
) : variant === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(gameState as UltimateTTTState).boards}
    boardResults={(gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={gameState.currentPlayer}
    disabled={phase === 'over'}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as UltimateTTTState;
      if (s.terminal?.reason !== 'win') return [];
      const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
      return getWinCells(metaBoard) ?? [];
    })()}
  />
```

- [ ] **Step 2.2: Fix Order & Chaos winCells in local/page.tsx**

Find (around line 624–632):
```tsx
) : variant === 'order_chaos' ? (
  <GridBoard
    board={(gameState as OrderChaosState).board}
    cols={6} rows={6}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={(_, cellIndex) => handleMove(0, cellIndex)}
    winCells={[]}
  />
```

Replace with:
```tsx
) : variant === 'order_chaos' ? (
  <GridBoard
    board={(gameState as OrderChaosState).board}
    cols={6} rows={6}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={(_, cellIndex) => handleMove(0, cellIndex)}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 2.3: Add winCells to ttt_3d in local/page.tsx**

Find (around line 644–650):
```tsx
) : variant === 'ttt_3d' ? (
  <ThreeDBoard
    board={(gameState as TTT3DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleMove}
  />
```

Replace with:
```tsx
) : variant === 'ttt_3d' ? (
  <ThreeDBoard
    board={(gameState as TTT3DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 2.4: Add winCells to ttt_4d in local/page.tsx**

Find (around line 651–657):
```tsx
) : variant === 'ttt_4d' ? (
  <FourDBoard
    board={(gameState as TTT4DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleMove}
  />
```

Replace with:
```tsx
) : variant === 'ttt_4d' ? (
  <FourDBoard
    board={(gameState as TTT4DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 2.5: Add winCells to tactic_toe in local/page.tsx**

Find (around line 658–666):
```tsx
) : variant === 'tactic_toe' ? (
  <TacticToeBoard
    board={(gameState as TacticToeState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    moveMode={state.tacticMoveMode}
    selectedObstacle={state.tacticSelectedObstacle}
    onCellClick={handleTacticCell}
  />
```

Replace with:
```tsx
) : variant === 'tactic_toe' ? (
  <TacticToeBoard
    board={(gameState as TacticToeState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    moveMode={state.tacticMoveMode}
    selectedObstacle={state.tacticSelectedObstacle}
    onCellClick={handleTacticCell}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 2.6: Add winCells to ultimate_3d in local/page.tsx**

Find (around line 667–675):
```tsx
) : variant === 'ultimate_3d' ? (
  <Ultimate3DBoard
    microBoards={(gameState as Ultimate3DState).microBoards}
    macroResults={(gameState as Ultimate3DState).macroResults}
    nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleUltimate3DMove}
  />
```

Replace with:
```tsx
) : variant === 'ultimate_3d' ? (
  <Ultimate3DBoard
    microBoards={(gameState as Ultimate3DState).microBoards}
    macroResults={(gameState as Ultimate3DState).macroResults}
    nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={phase === 'over'}
    onMove={handleUltimate3DMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 2.7: Run typecheck + tests**

```bash
pnpm --filter web test
```

Expected: 55 tests pass. Then:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to our changes.

- [ ] **Step 2.8: Commit**

```bash
git add apps/web/src/app/local/page.tsx
git commit -m "fix: pass winCells to all variants in local page"
```

---

## Task 3: Fix vs-ai/page.tsx — missing winCells + winSquares

**Files:**
- Modify: `apps/web/src/app/vs-ai/page.tsx`

- [ ] **Step 3.1: Add checkFiveInARow to the game-engine import**

Find (around line 6–11):
```tsx
import {
  StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT,
  VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, Ultimate3D, Garrison,
  getWinCells, getGomokuWinCells,
} from '@tactictoe/game-engine';
```

Replace with:
```tsx
import {
  StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT,
  VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, Ultimate3D, Garrison, checkFiveInARow,
  getWinCells, getGomokuWinCells,
} from '@tactictoe/game-engine';
```

- [ ] **Step 3.2: Add winCells to UltimateBoard in vs-ai/page.tsx**

Find (around line 661–669):
```tsx
{variant === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(gameState as UltimateTTTState).boards}
    boardResults={(gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={gameState.currentPlayer}
    disabled={!isMyTurn}
    onMove={handleMove}
  />
```

Replace with:
```tsx
{variant === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(gameState as UltimateTTTState).boards}
    boardResults={(gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={gameState.currentPlayer}
    disabled={!isMyTurn}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as UltimateTTTState;
      if (s.terminal?.reason !== 'win') return [];
      const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
      return getWinCells(metaBoard) ?? [];
    })()}
  />
```

- [ ] **Step 3.3: Fix Order & Chaos winCells in vs-ai/page.tsx**

Find (around line 683–688):
```tsx
) : variant === 'order_chaos' ? (
  <GridBoard board={(gameState as OrderChaosState).board} cols={6} rows={6}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={(_, ci) => handleMove(0, ci)}
    winCells={[]} />
```

Replace with:
```tsx
) : variant === 'order_chaos' ? (
  <GridBoard board={(gameState as OrderChaosState).board} cols={6} rows={6}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={(_, ci) => handleMove(0, ci)}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()} />
```

- [ ] **Step 3.4: Add winCells to ttt_3d in vs-ai/page.tsx**

Find (around line 697–701):
```tsx
) : variant === 'ttt_3d' ? (
  <ThreeDBoard board={(gameState as TTT3DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={handleMove} />
```

Replace with:
```tsx
) : variant === 'ttt_3d' ? (
  <ThreeDBoard board={(gameState as TTT3DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()} />
```

- [ ] **Step 3.5: Add winCells to ttt_4d in vs-ai/page.tsx**

Find (around line 701–705):
```tsx
) : variant === 'ttt_4d' ? (
  <FourDBoard board={(gameState as TTT4DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={handleMove} />
```

Replace with:
```tsx
) : variant === 'ttt_4d' ? (
  <FourDBoard board={(gameState as TTT4DState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
    onMove={handleMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()} />
```

- [ ] **Step 3.6: Add winCells to tactic_toe in vs-ai/page.tsx**

Find (around line 705–712):
```tsx
) : variant === 'tactic_toe' ? (
  <TacticToeBoard board={(gameState as TacticToeState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={!isMyTurn}
    moveMode={isMyTurn ? tacticMoveMode : 'place'}
    selectedObstacle={isMyTurn ? tacticSelectedObstacle : null}
    onCellClick={handleTacticCell} />
```

Replace with:
```tsx
) : variant === 'tactic_toe' ? (
  <TacticToeBoard board={(gameState as TacticToeState).board}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={!isMyTurn}
    moveMode={isMyTurn ? tacticMoveMode : 'place'}
    selectedObstacle={isMyTurn ? tacticSelectedObstacle : null}
    onCellClick={handleTacticCell}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()} />
```

- [ ] **Step 3.7: Add winCells to ultimate_3d in vs-ai/page.tsx**

Find (around line 712–720):
```tsx
) : variant === 'ultimate_3d' ? (
  <Ultimate3DBoard
    microBoards={(gameState as Ultimate3DState).microBoards}
    macroResults={(gameState as Ultimate3DState).macroResults}
    nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={!isMyTurn}
    onMove={handleUltimate3DMove}
  />
```

Replace with:
```tsx
) : variant === 'ultimate_3d' ? (
  <Ultimate3DBoard
    microBoards={(gameState as Ultimate3DState).microBoards}
    macroResults={(gameState as Ultimate3DState).macroResults}
    nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
    currentPlayer={gameState.currentPlayer as 'X' | 'O'}
    disabled={!isMyTurn}
    onMove={handleUltimate3DMove}
    winCells={(() => {
      const s = gameState as any;
      return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
    })()}
  />
```

- [ ] **Step 3.8: Add winSquares to GarrisonBoard in vs-ai/page.tsx**

Find (around line 721–729):
```tsx
) : variant === 'garrison' ? (
  <GarrisonBoard
    state={gameState as GarrisonState}
    disabled={!isMyTurn}
    selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
    legalDestinations={isMyTurn ? garrisonLegalDests : []}
    onHandPieceClick={handleGarrisonHandClick}
    onBoardSquareClick={handleGarrisonSquareClick}
  />
```

Replace with:
```tsx
) : variant === 'garrison' ? (
  <GarrisonBoard
    state={gameState as GarrisonState}
    disabled={!isMyTurn}
    selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
    legalDestinations={isMyTurn ? garrisonLegalDests : []}
    onHandPieceClick={handleGarrisonHandClick}
    onBoardSquareClick={handleGarrisonSquareClick}
    winSquares={
      gameState.terminal?.winner
        ? (checkFiveInARow(gameState.terminal.winner, (gameState as GarrisonState).pieces) ?? [])
        : []
    }
  />
```

- [ ] **Step 3.9: Run tests**

```bash
pnpm --filter web test
```

Expected: 55 tests pass.

- [ ] **Step 3.10: Commit**

```bash
git add apps/web/src/app/vs-ai/page.tsx
git commit -m "fix: pass winCells/winSquares to all variants in vs-ai page"
```

---

## Task 4: Fix room/[code]/page.tsx — UltimateBoard winCells + Garrison winSquares

**Files:**
- Modify: `apps/web/src/app/room/[code]/page.tsx`

- [ ] **Step 4.1: Add checkFiveInARow to the game-engine import in room page**

Find (line 18):
```tsx
import { getWinCells, getGomokuWinCells, Garrison } from '@tactictoe/game-engine';
```

Replace with:
```tsx
import { getWinCells, getGomokuWinCells, Garrison, checkFiveInARow } from '@tactictoe/game-engine';
```

- [ ] **Step 4.2: Add winCells to UltimateBoard in room/[code]/page.tsx**

Find (around line 534–541):
```tsx
{roomState.gameState!.variantId === 'ultimate_ttt' ? (
  <UltimateBoard
    boards={(roomState.gameState as UltimateTTTState).boards}
    boardResults={(roomState.gameState as UltimateTTTState).boardResults}
    nextBoardConstraint={(roomState.gameState as UltimateTTTState).nextBoardConstraint}
    currentPlayer={roomState.gameState!.currentPlayer}
    disabled={!isMyTurn}
    onMove={(boardIndex, cellIndex) => handleMove(0, boardIndex * 9 + cellIndex)}
```

This block continues; add `winCells` prop before the closing `/>`:

After the `onMove` prop line, add:
```tsx
    winCells={(() => {
      const s = roomState.gameState as UltimateTTTState;
      if (s.terminal?.reason !== 'win') return [];
      const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
      return getWinCells(metaBoard) ?? [];
    })()}
```

- [ ] **Step 4.3: Add winSquares to GarrisonBoard in room/[code]/page.tsx**

Find (around line 600–608):
```tsx
) : roomState.gameState!.variantId === 'garrison' ? (
  <GarrisonBoard
    state={roomState.gameState as GarrisonState}
    disabled={!isMyTurn}
    selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
    legalDestinations={isMyTurn ? garrisonLegalDests : []}
    onHandPieceClick={handleGarrisonHandClick}
    onBoardSquareClick={handleGarrisonSquareClick}
  />
```

Replace with:
```tsx
) : roomState.gameState!.variantId === 'garrison' ? (
  <GarrisonBoard
    state={roomState.gameState as GarrisonState}
    disabled={!isMyTurn}
    selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
    legalDestinations={isMyTurn ? garrisonLegalDests : []}
    onHandPieceClick={handleGarrisonHandClick}
    onBoardSquareClick={handleGarrisonSquareClick}
    winSquares={
      roomState.gameState!.terminal?.winner
        ? (checkFiveInARow(roomState.gameState!.terminal.winner, (roomState.gameState as GarrisonState).pieces) ?? [])
        : []
    }
  />
```

- [ ] **Step 4.4: Run tests**

```bash
pnpm --filter web test
```

Expected: 55 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add "apps/web/src/app/room/[code]/page.tsx"
git commit -m "fix: add winCells to UltimateBoard and winSquares to Garrison in room page"
```

---

## Task 5: Unified cosmetics — globals.css, CosmeticsProvider, cosmetics route

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/CosmeticsProvider.tsx`
- Modify: `apps/web/src/app/api/cosmetics/route.ts`

- [ ] **Step 5.1: Change default --winline-color to green in globals.css**

In `apps/web/src/app/globals.css`, find both occurrences of `--winline-color` (one in light mode ~line 49, one in dark mode ~line 135) and change them:

Light mode — find:
```css
  --winline-color:  #3b82f6;
```
Replace with:
```css
  --winline-color:  #22c55e;
```

Dark mode — find:
```css
  --winline-color: #60a5fa;
```
Replace with:
```css
  --winline-color: #22c55e;
```

- [ ] **Step 5.2: Add win-bg vars to CSS_VAR_KEYS in CosmeticsProvider.tsx**

Find:
```ts
const CSS_VAR_KEYS = [
  '--board-cell-bg',
  '--board-cell-border',
  '--board-active-border',
  '--board-inactive-border',
  '--mark-x',
  '--mark-o',
  '--winline-color',
  '--winline-width',
  '--winline-filter',
];
```

Replace with:
```ts
const CSS_VAR_KEYS = [
  '--board-cell-bg',
  '--board-cell-border',
  '--board-active-border',
  '--board-inactive-border',
  '--mark-x',
  '--mark-o',
  '--winline-color',
  '--winline-width',
  '--winline-filter',
  '--win-bg',
  '--win-bg-subtle',
  '--win-border',
];
```

- [ ] **Step 5.3: Expand winline cosmetic cssValues in cosmetics/route.ts**

In `apps/web/src/app/api/cosmetics/route.ts`, find the four winline rows and replace them:

Find:
```ts
      { id: 'winline_default', name: 'Classic Line', type: 'winline', cssValue: '{"--winline-color":"#3b82f6","--winline-width":"0.12","--winline-filter":"none"}', requiredScore: 0, price: 0 },
      { id: 'winline_neon', name: 'Neon Glow', type: 'winline', cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)"}', requiredScore: 150, price: 100 },
      { id: 'winline_fire', name: 'Fire Line', type: 'winline', cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)"}', requiredScore: 400, price: 300 },
      { id: 'winline_gold', name: 'Gold Strike', type: 'winline', cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)"}', requiredScore: 700, price: 800 },
```

Replace with:
```ts
      { id: 'winline_default', name: 'Classic Line', type: 'winline', cssValue: '{"--winline-color":"#22c55e","--winline-width":"0.12","--winline-filter":"none","--win-bg":"rgba(34,197,94,0.85)","--win-bg-subtle":"rgba(34,197,94,0.15)","--win-border":"#22c55e"}', requiredScore: 0, price: 0 },
      { id: 'winline_neon', name: 'Neon Glow', type: 'winline', cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)","--win-bg":"rgba(0,255,204,0.85)","--win-bg-subtle":"rgba(0,255,204,0.15)","--win-border":"#00ffcc"}', requiredScore: 150, price: 100 },
      { id: 'winline_fire', name: 'Fire Line', type: 'winline', cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)","--win-bg":"rgba(255,69,0,0.85)","--win-bg-subtle":"rgba(255,69,0,0.15)","--win-border":"#ff6b35"}', requiredScore: 400, price: 300 },
      { id: 'winline_gold', name: 'Gold Strike', type: 'winline', cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)","--win-bg":"rgba(255,215,0,0.85)","--win-bg-subtle":"rgba(255,215,0,0.15)","--win-border":"#ffd700"}', requiredScore: 700, price: 800 },
```

- [ ] **Step 5.4: Run tests**

```bash
pnpm --filter web test
```

Expected: 55 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/CosmeticsProvider.tsx apps/web/src/app/api/cosmetics/route.ts
git commit -m "feat: unify winline skins to also control 3D cell highlight colours; default winline to green"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Order & Chaos winCells bug fixed in local + vs-ai (Tasks 2, 3)
  - ✅ 3D TTT / 4D TTT / TacticToe / Ultimate3D winCells added to local + vs-ai (Tasks 2, 3)
  - ✅ Garrison winSquares added to vs-ai + room (Tasks 3, 4)
  - ✅ UltimateBoard meta WinLine added (Task 1)
  - ✅ UltimateBoard winCells passed from all 3 pages (Tasks 2, 3, 4)
  - ✅ CosmeticsProvider CSS_VAR_KEYS updated (Task 5)
  - ✅ globals.css default winline colour changed to green (Task 5)
  - ✅ cosmetics route.ts cssValues expanded (Task 5)

- **No placeholders:** All steps show exact code.

- **Type consistency:** `winCells?: number[]` defined in Task 1 and used as `number[]` across all page tasks. `checkFiveInARow` returns `number[] | null` — `?? []` handles null in all usages.
