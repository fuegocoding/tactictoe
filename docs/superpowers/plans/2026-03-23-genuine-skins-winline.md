# Genuine Skins + Win Line Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace boring color-swap skins with genuine themed symbol skins (e.g. donuts vs chocolate, rockets vs UFOs), and add win line / "slash" skins that draw a styled SVG line across winning cells when someone gets 3-in-a-row.

**Architecture:** Extend the existing CSS-variable + `cssValue` cosmetics system so `piece` skins can optionally embed `symbolX`/`symbolO` fields; expose these via a new `CosmeticsContext`; add a new `winline` cosmetic type with CSS vars driving an SVG `WinLine` component that overlays the board grid. All board components updated to consume the context and render the SVG overlay.

**Tech Stack:** Next.js 14 App Router, React context, SVG, Prisma (Postgres), TypeScript, CSS Modules.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `apps/web/src/components/CosmeticsContext.tsx` | React context + `useCosmetics` hook exposing `symbolX`, `symbolO` |
| `apps/web/src/components/board/WinLine.tsx` | SVG overlay component drawing a line through winning cells |
| `apps/web/src/components/board/PieceSymbol.tsx` | Renders a Lucide icon if `symbol` matches a known icon name, otherwise renders as text/emoji |

### Modified files
| Path | What changes |
|------|-------------|
| `packages/game-engine/src/rules/win-checker.ts` | Add `getWinCells(board)` helper |
| `packages/game-engine/src/rules/gomoku.ts` | Add `getGomokuWinCells(board, cols, winLength)` helper |
| `packages/game-engine/src/index.ts` | Export the two new helpers |
| `apps/web/src/app/globals.css` | Add `--winline-color`, `--winline-width`, `--winline-filter` CSS vars |
| `apps/web/src/components/CosmeticsProvider.tsx` | Parse symbols, apply winline CSS vars, wrap children in `CosmeticsContext.Provider` |
| `apps/web/src/components/board/StandardBoard.tsx` | Add `winCells` prop, use symbol context, add `WinLine` overlay |
| `apps/web/src/components/board/GridBoard.tsx` | Add `winCells` prop, use symbol context, add `WinLine` overlay |
| `apps/web/src/components/board/UltimateBoard.tsx` | Use symbol context for cell rendering |
| `apps/web/src/components/board/ThreeDBoard.tsx` | Use symbol context (keep existing cell highlight) |
| `apps/web/src/components/board/TacticToeBoard.tsx` | Use symbol context (keep existing cell highlight) |
| `apps/web/src/components/board/FourDBoard.tsx` | Use symbol context (keep existing cell highlight) |
| `apps/web/src/components/board/Ultimate3DBoard.tsx` | Use symbol context (keep existing cell highlight) |
| `apps/web/src/app/local/page.tsx` | Compute + pass `winCells` to StandardBoard and GridBoard |
| `apps/web/src/app/room/[code]/page.tsx` | Same |
| `apps/web/src/app/vs-ai/page.tsx` | Same |
| `apps/web/prisma/seed-cosmetics.ts` | Replace old boring skins with genuine themed skins + win line skins |
| `apps/web/src/app/api/cosmetics/route.ts` | Update DEFAULT_COSMETICS; handle `winline` type in equip enforcement |
| `apps/web/src/app/settings/page.tsx` | Symbol-aware piece preview; add Win Line Themes section |
| `apps/web/src/app/settings/page.module.css` | Win line preview styles |

---

## Task 1: Add `getWinCells` to game engine

**Files:**
- Modify: `packages/game-engine/src/rules/win-checker.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Add `getWinCells` to win-checker.ts**

Add after `checkBoardWinner`:

```typescript
/**
 * Returns the [a, b, c] indices of the first winning line found, or null.
 */
export function getWinCells(board: Board): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const cell = board[a];
    if (cell !== null && cell !== undefined && cell === board[b] && cell === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}
```

- [ ] **Step 2: Export from index.ts**

In `packages/game-engine/src/index.ts`, change line:
```typescript
export { checkBoardWinner, isBoardFull } from './rules/win-checker.js';
```
to:
```typescript
export { checkBoardWinner, isBoardFull, getWinCells } from './rules/win-checker.js';
```

- [ ] **Step 3: Add `getGomokuWinCells` to gomoku.ts**

Add after the internal `computeTerminal` function in `packages/game-engine/src/rules/gomoku.ts`:

```typescript
/**
 * Exported helper: given the 15x15 Gomoku board, returns the 5 winning cell
 * indices or null if no winner exists.
 */
export function getGomokuWinCells(board: Board): number[] | null {
  const COLS = 15;
  const WIN = 5;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

  for (let y = 0; y < COLS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y * COLS + x];
      if (!cell) continue;
      for (const [dx, dy] of directions) {
        const cells: number[] = [];
        for (let k = 0; k < WIN; k++) {
          const nx = x + dx * k;
          const ny = y + dy * k;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= COLS) break;
          if (board[ny * COLS + nx] !== cell) break;
          cells.push(ny * COLS + nx);
        }
        if (cells.length === WIN) return cells;
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Export `getGomokuWinCells` from index.ts**

Add to `packages/game-engine/src/index.ts`:
```typescript
export { getGomokuWinCells } from './rules/gomoku.js';
```

- [ ] **Step 5: Commit**
```bash
git add packages/game-engine/src/rules/win-checker.ts packages/game-engine/src/rules/gomoku.ts packages/game-engine/src/index.ts
git commit -m "feat(engine): add getWinCells and getGomokuWinCells helpers"
```

---

## Task 2: Create CosmeticsContext

**Files:**
- Create: `apps/web/src/components/CosmeticsContext.tsx`

- [ ] **Step 1: Create context file**

```typescript
import { createContext, useContext } from 'react';

export interface CosmeticsContextValue {
  symbolX: string; // default 'X'
  symbolO: string; // default 'O'
}

export const CosmeticsContext = createContext<CosmeticsContextValue>({
  symbolX: 'X',
  symbolO: 'O',
});

export function useCosmetics() {
  return useContext(CosmeticsContext);
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/CosmeticsContext.tsx
git commit -m "feat: add CosmeticsContext for symbol skin support"
```

---

## Task 3: Update CosmeticsProvider

**Files:**
- Modify: `apps/web/src/components/CosmeticsProvider.tsx`

The provider now:
1. Extracts `symbolX`/`symbolO` from the equipped piece skin's `cssValue` JSON
2. Handles `--winline-color`, `--winline-width`, `--winline-filter` CSS vars
3. Wraps children in `CosmeticsContext.Provider`

- [ ] **Step 1: Rewrite CosmeticsProvider.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CosmeticsContext } from './CosmeticsContext';

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

export default function CosmeticsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [symbolX, setSymbolX] = useState('X');
  const [symbolO, setSymbolO] = useState('O');

  useEffect(() => {
    const loadCosmetics = async () => {
      if (status === 'loading') return;
      try {
        const res = await fetch('/api/cosmetics');
        const data = await res.json();
        if (!data.cosmetics) return;

        let equipped = data.cosmetics.filter((c: any) => c.isEquipped);

        if (status === 'unauthenticated') {
          const guestSave = localStorage.getItem('guest_cosmetics');
          if (guestSave) {
            try {
              const savedIds = JSON.parse(guestSave) as string[];
              equipped = data.cosmetics.filter((c: any) => savedIds.includes(c.id));
            } catch {}
          }
        }

        // Reset all CSS vars to defaults
        const overrides: Record<string, string> = Object.fromEntries(
          CSS_VAR_KEYS.map((k) => [k, ''])
        );

        let nextSymbolX = 'X';
        let nextSymbolO = 'O';

        for (const c of equipped) {
          try {
            const parsed = JSON.parse(c.cssValue);
            // Extract non-CSS fields before merging
            if (parsed.symbolX) nextSymbolX = parsed.symbolX;
            if (parsed.symbolO) nextSymbolO = parsed.symbolO;
            // Merge only CSS var keys
            for (const key of CSS_VAR_KEYS) {
              if (parsed[key] !== undefined) overrides[key] = parsed[key];
            }
          } catch {}
        }

        for (const [key, value] of Object.entries(overrides)) {
          if (value === '') {
            document.documentElement.style.removeProperty(key);
          } else {
            document.documentElement.style.setProperty(key, value);
          }
        }

        setSymbolX(nextSymbolX);
        setSymbolO(nextSymbolO);
      } catch (e) {
        console.error('Failed to load cosmetics', e);
      }
    };

    loadCosmetics();

    const handleUpdate = () => loadCosmetics();
    window.addEventListener('cosmetics_updated', handleUpdate);
    return () => window.removeEventListener('cosmetics_updated', handleUpdate);
  }, [status]);

  return (
    <CosmeticsContext.Provider value={{ symbolX, symbolO }}>
      {children}
    </CosmeticsContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/CosmeticsProvider.tsx
git commit -m "feat: CosmeticsProvider now provides symbol context and handles winline CSS vars"
```

---

## Task 4: Add winline CSS vars to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add winline vars to the `:root` block** (after the `--mark-o` line, around line 48)

```css
  --winline-color:  #3b82f6;
  --winline-width:  0.12;
  --winline-filter: none;
```

- [ ] **Step 2: Add dark mode overrides** to `[data-theme="dark"]` block (after the dark `--mark-o` line):

```css
  --winline-color:  #60a5fa;
  --winline-width:  0.12;
  --winline-filter: none;
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/globals.css
git commit -m "feat: add winline CSS variables"
```

---

## Task 5: Create WinLine SVG component

**Files:**
- Create: `apps/web/src/components/board/WinLine.tsx`

The WinLine renders an SVG positioned absolutely over a cell grid. It takes:
- `winCells`: indices of winning cells in the flat board array
- `cols`: number of columns in the grid
- `rows`: number of rows in the grid

It computes the center of the first and last winning cells in SVG grid units, extends the line slightly past them, and renders it with CSS variable-driven stroke styles.

**Key math:**
- Cell at flat index `i`: `col = i % cols`, `row = Math.floor(i / cols)`
- Center of cell: `cx = col + 0.5`, `cy = row + 0.5`
- Extend the line by 0.5 grid units in both directions for visual impact
- SVG `viewBox="0 0 {cols} {rows}"` with `preserveAspectRatio="none"` to fill the container

- [ ] **Step 1: Create WinLine.tsx**

```typescript
import React from 'react';

interface WinLineProps {
  winCells: number[];
  cols: number;
  rows: number;
}

export function WinLine({ winCells, cols, rows }: WinLineProps) {
  if (winCells.length < 2) return null;

  const first = winCells[0];
  const last = winCells[winCells.length - 1];

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
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/board/WinLine.tsx
git commit -m "feat: add WinLine SVG overlay component"
```

---

## Task 6: Update StandardBoard

**Files:**
- Modify: `apps/web/src/components/board/StandardBoard.tsx`

Changes:
1. Add `winCells?: number[]` prop
2. Import and use `useCosmetics()` for `symbolX`/`symbolO`
3. Wrap cells in a `position: relative` container to host `WinLine`
4. Restructure layout so `WinLine` only covers the cells area (not the labels)

- [ ] **Step 1: Rewrite StandardBoard.tsx**

```typescript
import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { WinLine } from './WinLine';

interface StandardBoardProps {
  board: Board;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

export function StandardBoard({ board, currentPlayer, disabled, onMove, winCells = [] }: StandardBoardProps) {
  const { symbolX, symbolO } = useCosmetics();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gridTemplateRows: '20px 1fr',
        gap: '4px',
        width: '100%',
        maxWidth: '260px',
      }}
    >
      {/* Top-left corner */}
      <div />
      {/* Col labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {['a', 'b', 'c'].map((col) => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {col}
          </div>
        ))}
      </div>

      {/* Row labels */}
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: '4px' }}>
        {[1, 2, 3].map((row) => (
          <div key={row} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {row}
          </div>
        ))}
      </div>

      {/* Cells grid — position:relative hosts the WinLine overlay */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const index = row * 3 + col;
            const cell = board[index];
            return (
              <button
                key={index}
                disabled={disabled || cell !== null}
                onClick={() => {
                  if (!disabled && cell === null) onMove(0, index);
                }}
                style={{
                  aspectRatio: '1',
                  fontSize: 'clamp(20px, 5vw, 32px)',
                  fontWeight: 'bold',
                  cursor: disabled || cell !== null ? 'default' : 'pointer',
                  background: 'var(--board-cell-bg)',
                  border: '1px solid var(--board-cell-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: cell === 'X' ? 'var(--mark-x)' : cell === 'O' ? 'var(--mark-o)' : 'var(--text)',
                }}
              >
                {cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
              </button>
            );
          })
        )}
        {winCells.length > 0 && <WinLine winCells={winCells} cols={3} rows={3} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/board/StandardBoard.tsx
git commit -m "feat(board): StandardBoard uses symbol skins and WinLine overlay"
```

---

## Task 7: Update GridBoard

**Files:**
- Modify: `apps/web/src/components/board/GridBoard.tsx`

Same pattern as StandardBoard but with dynamic cols/rows.

- [ ] **Step 1: Rewrite GridBoard.tsx**

```typescript
import React from 'react';
import type { Board } from '@tactictoe/game-engine';
import { useCosmetics } from '@/components/CosmeticsContext';
import { WinLine } from './WinLine';

interface GridBoardProps {
  board: Board;
  cols: number;
  rows: number;
  currentPlayer: 'X' | 'O';
  disabled: boolean;
  onMove: (boardIndex: number, cellIndex: number) => void;
  winCells?: number[];
}

export function GridBoard({ board, cols, rows, currentPlayer, disabled, onMove, winCells = [] }: GridBoardProps) {
  const { symbolX, symbolO } = useCosmetics();
  const colLabels = Array.from({ length: cols }, (_, i) => String.fromCharCode(97 + i));
  const maxWidth = cols >= 15 ? '600px' : '400px';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gridTemplateRows: '20px 1fr',
        gap: cols > 10 ? '2px' : '4px',
        width: '100%',
        maxWidth,
        margin: '0 auto',
      }}
    >
      {/* Corner */}
      <div />
      {/* Col labels */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: cols > 10 ? '2px' : '4px' }}>
        {colLabels.map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {c}
          </div>
        ))}
      </div>

      {/* Row labels */}
      <div style={{ display: 'grid', gridTemplateRows: `repeat(${rows}, 1fr)`, gap: cols > 10 ? '2px' : '4px' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* Cells with WinLine */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: cols > 10 ? '2px' : '4px' }}>
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const index = row * cols + col;
            const cell = board[index];
            return (
              <button
                key={index}
                disabled={disabled || cell !== null}
                onClick={() => {
                  if (!disabled && cell === null) onMove(0, index);
                }}
                style={{
                  aspectRatio: '1',
                  fontSize: cols > 5 ? 'clamp(14px, 2.5vw, 18px)' : 'clamp(20px, 5vw, 32px)',
                  fontWeight: 'bold',
                  cursor: disabled || cell !== null ? 'default' : 'pointer',
                  background: 'var(--board-cell-bg)',
                  border: '1px solid var(--board-cell-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: cell === 'X' ? 'var(--mark-x)' : cell === 'O' ? 'var(--mark-o)' : 'var(--text)',
                }}
              >
                {cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
              </button>
            );
          })
        )}
        {winCells.length > 0 && <WinLine winCells={winCells} cols={cols} rows={rows} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/board/GridBoard.tsx
git commit -m "feat(board): GridBoard uses symbol skins and WinLine overlay"
```

---

## Task 8: Update remaining board components (symbols only)

**Files:**
- Modify: `apps/web/src/components/board/UltimateBoard.tsx`
- Modify: `apps/web/src/components/board/ThreeDBoard.tsx`
- Modify: `apps/web/src/components/board/TacticToeBoard.tsx`
- Modify: `apps/web/src/components/board/FourDBoard.tsx`
- Modify: `apps/web/src/components/board/Ultimate3DBoard.tsx`

For each, the change is:
1. Add `import { useCosmetics } from '@/components/CosmeticsContext';`
2. Call `const { symbolX, symbolO } = useCosmetics();` inside the component
3. Replace every `{cell ?? ''}` or `{String(cell)}` cell render with: `{cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}`
4. In UltimateBoard, also update the mini-board result overlay: `{result === 'draw' ? '=' : result === 'X' ? symbolX : symbolO}`

Note: These boards keep their existing win cell highlight (colored border). WinLine is not added to 3D/4D/layered boards because their winning lines span multiple disconnected 2D layers.

- [ ] **Step 1: Update UltimateBoard.tsx**

Add imports at top:
```typescript
import { useCosmetics } from '@/components/CosmeticsContext';
```

Inside `UltimateBoard` component body, add:
```typescript
const { symbolX, symbolO } = useCosmetics();
```

Replace `{result === 'draw' ? '=' : result}` (line ~98) with:
```typescript
{result === 'draw' ? '=' : result === 'X' ? symbolX : symbolO}
```

Replace `{cell ?? ''}` (line ~127) with:
```typescript
{cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
```

- [ ] **Step 2: Update ThreeDBoard.tsx**

Add import + hook call. Replace `{cell !== null ? String(cell) : ''}` with:
```typescript
{cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
```

- [ ] **Step 3: Update TacticToeBoard.tsx**

Add import + hook call. Replace `{isObstacle ? '▪' : (cell ?? '')}` with:
```typescript
{isObstacle ? '▪' : cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
```

- [ ] **Step 4: Update FourDBoard.tsx**

Add import + hook call. Target line 99: replace `{cell ?? ''}` with:
```typescript
{cell === 'X' ? symbolX : cell === 'O' ? symbolO : ''}
```

- [ ] **Step 5: Update Ultimate3DBoard.tsx**

Add import + hook call. Two render locations to update:

**Macro result overlay** (line 127 — shows winner on completed sub-boards):
Replace `{macroResult}` with:
```typescript
{macroResult === 'X' ? symbolX : macroResult === 'O' ? symbolO : macroResult}
```

**Micro cell render** (line 160):
Replace `{cell !== null ? String(cell) : '·'}` with:
```typescript
{cell === 'X' ? symbolX : cell === 'O' ? symbolO : '·'}
```

- [ ] **Step 6: Commit all**
```bash
git add apps/web/src/components/board/UltimateBoard.tsx apps/web/src/components/board/ThreeDBoard.tsx apps/web/src/components/board/TacticToeBoard.tsx apps/web/src/components/board/FourDBoard.tsx apps/web/src/components/board/Ultimate3DBoard.tsx
git commit -m "feat(board): all board components use symbol skins from context"
```

---

## Task 9: Thread winCells through play pages

**Files:**
- Modify: `apps/web/src/app/local/page.tsx`
- Modify: `apps/web/src/app/room/[code]/page.tsx`
- Modify: `apps/web/src/app/vs-ai/page.tsx`

For each file, the pattern is:
1. Import `getWinCells` and `getGomokuWinCells` from `@tactictoe/game-engine`
2. Compute `winCells` from the current game state when rendering `StandardBoard` or `GridBoard`

- [ ] **Step 1: Update local/page.tsx**

Add imports:
```typescript
import { getWinCells, getGomokuWinCells } from '@tactictoe/game-engine';
```

When rendering `StandardBoard` for `standard_3x3`, `misere_ttt`, `wild_ttt`, `notakto`, `vanishing_ttt`:
```typescript
winCells={(() => {
  const s = gameState as StandardTTTState;
  return s.terminal?.reason === 'win' ? (getWinCells(s.board) ?? []) : [];
})()}
```

When rendering `GridBoard` for `gomoku`:
```typescript
winCells={(() => {
  const s = gameState as GomokuState;
  return s.terminal?.reason === 'win' ? (getGomokuWinCells(s.board) ?? []) : [];
})()}
```

For `order_chaos` and `sos_ttt` (both use GridBoard but have non-standard win detection): always pass `winCells={[]}` — win line support for these variants is out of scope for this plan..

- [ ] **Step 2: Update room/[code]/page.tsx**

Same pattern. This page renders `StandardBoard` for standard_3x3. Add:
```typescript
import { getWinCells } from '@tactictoe/game-engine';
```
And pass:
```typescript
winCells={(() => {
  const s = roomState.gameState as StandardTTTState;
  return s.terminal?.reason === 'win' ? (getWinCells(s.board) ?? []) : [];
})()}
```

- [ ] **Step 3: Update vs-ai/page.tsx**

Read the file to understand the game state shape. Apply same pattern for `StandardBoard` usage.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/app/local/page.tsx apps/web/src/app/room/\[code\]/page.tsx apps/web/src/app/vs-ai/page.tsx
git commit -m "feat: thread winCells to StandardBoard and GridBoard in play pages"
```

---

## Task 10: New skin data

**Files:**
- Modify: `apps/web/prisma/seed-cosmetics.ts`

Replace the entire cosmetics array with genuine themed skins plus win line skins.

- [ ] **Step 1: Rewrite seed-cosmetics.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // WARNING: Destructive — clears ALL existing cosmetics and user equip history.
  // Safe for dev/fresh environments. Do NOT run against a populated production database.
  await (prisma as any).userCosmetic.deleteMany({});
  await (prisma as any).cosmetic.deleteMany({});

  const cosmetics = [
    // ── Board Themes ──────────────────────────────────────────
    {
      name: 'Classic',
      type: 'board',
      cssValue: '{}',
      requiredScore: 0,
    },
    {
      name: 'Midnight Dark',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#1a1a1a","--board-cell-border":"#2a2a2a","--board-active-border":"#f59e0b","--board-inactive-border":"#2a2a2a"}',
      requiredScore: 200,
    },
    {
      name: 'Neon Cyber',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#0d0221","--board-cell-border":"#ff0055","--board-active-border":"#00ffff","--board-inactive-border":"#ff0055"}',
      requiredScore: 600,
    },
    {
      name: 'Forest Slate',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#1f292e","--board-cell-border":"#4caf50","--board-active-border":"#81c784","--board-inactive-border":"#4caf50"}',
      requiredScore: 400,
    },
    {
      name: 'Cherry Wood',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#3b1a17","--board-cell-border":"#8b3a33","--board-active-border":"#e27c6e","--board-inactive-border":"#8b3a33"}',
      requiredScore: 800,
    },
    {
      name: 'Aurum',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#111111","--board-cell-border":"#7c5a00","--board-active-border":"#ffd700","--board-inactive-border":"#7c5a00"}',
      requiredScore: 1200,
    },

    // ── Piece Skins ───────────────────────────────────────────
    {
      name: 'Classic',
      type: 'piece',
      cssValue: '{"--mark-x":"#1a1a1a","--mark-o":"#d97706"}',
      requiredScore: 0,
    },
    {
      name: 'Donuts',
      type: 'piece',
      cssValue: '{"--mark-x":"#c0392b","--mark-o":"#8e5c3a","symbolX":"🍩","symbolO":"🍫"}',
      requiredScore: 50,
    },
    {
      name: 'Space',
      type: 'piece',
      cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"🚀","symbolO":"🛸"}',
      requiredScore: 100,
    },
    {
      name: 'Cosmic',
      type: 'piece',
      cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#9b59b6","symbolX":"⭐","symbolO":"🌙"}',
      requiredScore: 150,
    },
    {
      name: 'Fruit',
      type: 'piece',
      cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"🍎","symbolO":"🍊"}',
      requiredScore: 200,
    },
    {
      name: 'Animals',
      type: 'piece',
      cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"🐱","symbolO":"🐶"}',
      requiredScore: 300,
    },
    {
      name: 'Plants',
      type: 'piece',
      cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#27ae60","symbolX":"🌸","symbolO":"🌵"}',
      requiredScore: 400,
    },
    {
      name: 'Royalty',
      type: 'piece',
      cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#95a5a6","symbolX":"👑","symbolO":"⚔️"}',
      requiredScore: 600,
    },
    {
      name: 'Fire & Ice',
      type: 'piece',
      cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"🔥","symbolO":"🧊"}',
      requiredScore: 800,
    },
    {
      name: 'Dark Arts',
      type: 'piece',
      cssValue: '{"--mark-x":"#8e44ad","--mark-o":"#2c3e50","symbolX":"💀","symbolO":"⚰️"}',
      requiredScore: 1200,
    },

    // ── Win Line Skins ────────────────────────────────────────
    {
      name: 'Classic Line',
      type: 'winline',
      cssValue: '{"--winline-color":"#3b82f6","--winline-width":"0.12","--winline-filter":"none"}',
      requiredScore: 0,
    },
    {
      name: 'Neon Glow',
      type: 'winline',
      cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)"}',
      requiredScore: 150,
    },
    {
      name: 'Fire Line',
      type: 'winline',
      cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)"}',
      requiredScore: 400,
    },
    {
      name: 'Gold Strike',
      type: 'winline',
      cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)"}',
      requiredScore: 700,
    },
    {
      name: 'Void',
      type: 'winline',
      cssValue: '{"--winline-color":"#7c3aed","--winline-width":"0.16","--winline-filter":"drop-shadow(0 0 0.1px #a78bfa) drop-shadow(0 0 0.35px #4c1d95)"}',
      requiredScore: 1000,
    },
  ];

  for (const c of cosmetics) {
    await (prisma as any).cosmetic.create({ data: c });
  }

  console.log(`Seeded ${cosmetics.length} cosmetics`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/prisma/seed-cosmetics.ts
git commit -m "feat: replace cosmetics with genuine themed skins and win line skins"
```

---

## Task 11: Update API route for winline type

**Files:**
- Modify: `apps/web/src/app/api/cosmetics/route.ts`

Changes:
1. Update `DEFAULT_COSMETICS` fallback to match the new seed data (subset of the most important ones)
2. In the `POST` handler, extend the type union so `winline` cosmetics can be equipped/unequipped just like `board` and `piece` — the existing single-per-type enforcement already handles this

- [ ] **Step 1: Update DEFAULT_COSMETICS in route.ts**

Replace the `DEFAULT_COSMETICS` array (lines 13–23) with:

```typescript
const DEFAULT_COSMETICS = [
  { id: 'board_default', name: 'Classic', type: 'board', cssValue: '{}', requiredScore: 0 },
  { id: 'board_midnight', name: 'Midnight Dark', type: 'board', cssValue: '{"--board-cell-bg":"#1a1a1a","--board-cell-border":"#2a2a2a","--board-active-border":"#f59e0b","--board-inactive-border":"#2a2a2a"}', requiredScore: 200 },
  { id: 'board_neon', name: 'Neon Cyber', type: 'board', cssValue: '{"--board-cell-bg":"#0d0221","--board-cell-border":"#ff0055","--board-active-border":"#00ffff","--board-inactive-border":"#ff0055"}', requiredScore: 600 },

  { id: 'piece_default', name: 'Classic', type: 'piece', cssValue: '{"--mark-x":"#1a1a1a","--mark-o":"#d97706"}', requiredScore: 0 },
  { id: 'piece_donuts', name: 'Donuts', type: 'piece', cssValue: '{"--mark-x":"#c0392b","--mark-o":"#8e5c3a","symbolX":"🍩","symbolO":"🍫"}', requiredScore: 50 },
  { id: 'piece_space', name: 'Space', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"🚀","symbolO":"🛸"}', requiredScore: 100 },
  { id: 'piece_cosmic', name: 'Cosmic', type: 'piece', cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#9b59b6","symbolX":"⭐","symbolO":"🌙"}', requiredScore: 150 },
  { id: 'piece_animals', name: 'Animals', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"🐱","symbolO":"🐶"}', requiredScore: 300 },

  { id: 'winline_default', name: 'Classic Line', type: 'winline', cssValue: '{"--winline-color":"#3b82f6","--winline-width":"0.12","--winline-filter":"none"}', requiredScore: 0 },
  { id: 'winline_neon', name: 'Neon Glow', type: 'winline', cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)"}', requiredScore: 150 },
  { id: 'winline_fire', name: 'Fire Line', type: 'winline', cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)"}', requiredScore: 400 },
  { id: 'winline_gold', name: 'Gold Strike', type: 'winline', cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)"}', requiredScore: 700 },
];
```

- [ ] **Step 2: Update settings page Cosmetic interface to include winline type**

In `apps/web/src/app/settings/page.tsx`, the `Cosmetic` interface uses `type: 'board' | 'piece'`. Change to:
```typescript
type: 'board' | 'piece' | 'winline';
```

**Note:** This is a partial edit to `settings/page.tsx`. Task 12 will complete the UI changes for this file. Commit only the type change here.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/api/cosmetics/route.ts apps/web/src/app/settings/page.tsx
git commit -m "feat(api): support winline cosmetic type"
```

---

## Task 12: Update Settings page UI

**Files:**
- Modify: `apps/web/src/app/settings/page.tsx`
- Modify: `apps/web/src/app/settings/page.module.css`

Changes:
1. Piece skin preview renders actual `symbolX`/`symbolO` instead of hardcoded "X"/"O"
2. Add a "Win Line Skins" section with a mini board preview showing a line

- [ ] **Step 1: Update settings page**

In `SettingsPage`, update the filter and add `winlines`:
```typescript
const boards = cosmetics.filter(c => c.type === 'board');
const pieces = cosmetics.filter(c => c.type === 'piece');
const winlines = cosmetics.filter(c => c.type === 'winline');
```

Update piece preview to render symbols from cssValue:
```typescript
{pieces.map(c => {
  const parsed = JSON.parse(c.cssValue);
  const symX = parsed.symbolX ?? 'X';
  const symO = parsed.symbolO ?? 'O';
  return (
    <Card key={c.id} className={`${styles.card} ${c.isEquipped ? styles.equipped : ''} ${!c.isUnlocked ? styles.locked : ''}`}>
      <div className={styles.preview} style={parsed}>
        <div className={styles.previewPieces}>
          <span style={{ color: 'var(--mark-x)' }}>{symX}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>vs</span>
          <span style={{ color: 'var(--mark-o)' }}>{symO}</span>
        </div>
      </div>
      <div className={styles.info}>
        <h3>{c.name}</h3>
        <p className={styles.requirement}>{c.requiredScore > 0 ? `Unlocks at ${c.requiredScore} Rating` : 'Starter Edition'}</p>
        <Button variant={c.isEquipped ? 'secondary' : 'primary'} onClick={() => handleEquip(c)} disabled={!c.isUnlocked}>
          {c.isEquipped ? 'Unequip' : c.isUnlocked ? 'Equip' : 'Locked'}
        </Button>
      </div>
    </Card>
  );
})}
```

Add win line section after the piece section:
```tsx
<div className={styles.section}>
  <h2 className={styles.sectionTitle}>Win Line Skins</h2>
  <div className={styles.grid}>
    {winlines.map(c => {
      const parsed = JSON.parse(c.cssValue);
      return (
        <Card key={c.id} className={`${styles.card} ${c.isEquipped ? styles.equipped : ''} ${!c.isUnlocked ? styles.locked : ''}`}>
          <div className={styles.preview} style={parsed}>
            <div className={styles.previewWinLine}>
              <svg viewBox="0 0 3 3" className={styles.winLinePreviewSvg}>
                <line
                  x1="0.1" y1="0.5" x2="2.9" y2="0.5"
                  stroke="var(--winline-color, #3b82f6)"
                  strokeWidth="var(--winline-width, 0.12)"
                  strokeLinecap="round"
                  style={{ filter: 'var(--winline-filter, none)' }}
                />
              </svg>
            </div>
          </div>
          <div className={styles.info}>
            <h3>{c.name}</h3>
            <p className={styles.requirement}>{c.requiredScore > 0 ? `Unlocks at ${c.requiredScore} Rating` : 'Starter Edition'}</p>
            <Button variant={c.isEquipped ? 'secondary' : 'primary'} onClick={() => handleEquip(c)} disabled={!c.isUnlocked}>
              {c.isEquipped ? 'Unequip' : c.isUnlocked ? 'Equip' : 'Locked'}
            </Button>
          </div>
        </Card>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Add win line preview CSS to page.module.css**

```css
.previewWinLine {
  width: 120px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.winLinePreviewSvg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/settings/page.tsx apps/web/src/app/settings/page.module.css
git commit -m "feat(settings): symbol-aware piece preview and win line skins section"
```

---

## Task 13: Run seed and verify

- [ ] **Step 1: Run the seed script to populate new skins**
```bash
cd apps/web && npx ts-node --project tsconfig.json prisma/seed-cosmetics.ts
```
If that fails (ts-node not available), try:
```bash
cd apps/web && npx tsx prisma/seed-cosmetics.ts
```

- [ ] **Step 2: Start dev server and manually verify**
```bash
npm run dev
```

Open http://localhost:3000/settings and confirm:
- Piece skins show emoji symbols in previews (donuts, rockets, etc.)
- Win Line Skins section appears with styled lines
- Equipping a piece skin changes the symbols on the board
- Playing a game and winning shows the WinLine SVG on StandardBoard

- [ ] **Step 3: Check for TypeScript errors**
```bash
cd apps/web && npx tsc --noEmit
```
Fix any type errors before final commit.

- [ ] **Step 4: Final commit**
```bash
git add -A
git commit -m "feat: genuine symbol skins and win line overlay — complete"
```
