# Win Line + Unified Skins for All Variants

**Date:** 2026-03-25
**Status:** Approved

## Problem

The winning slash (WinLine SVG overlay) and 3D cell win-highlight are only reliably working in a subset of variants. Specifically:

- `local/page.tsx` and `vs-ai/page.tsx` are missing `winCells` props for 3D TTT, 4D TTT, TacticToe, Ultimate 3D, and Order & Chaos
- `vs-ai/page.tsx` and `room/page.tsx` are missing `winSquares` for Garrison
- `UltimateBoard` has no win indicator on the macro 3×3 grid at all
- The winline cosmetic skins (Neon, Fire, Gold) only affect the SVG line's color/glow — the 3D cell highlight is permanently hardcoded green

## Solution

Approach B: fix all prop bugs and unify cosmetics so one skin controls both the SVG slash and the 3D cell highlight colour/glow.

---

## 1. Prop Bug Fixes

### 1a. local/page.tsx and vs-ai/page.tsx — Missing winCells

For each of the following variants, both pages need `winCells` read from `gameState.terminal?.winCells ?? []` when `terminal.reason === 'win'`:

- `ttt_3d` → `ThreeDBoard`
- `ttt_4d` → `FourDBoard`
- `tactic_toe` → `TacticToeBoard`
- `ultimate_3d` → `Ultimate3DBoard`
- `order_chaos` → `GridBoard` (currently hardcoded to `[]`)

Pattern to use (same as room page):
```tsx
winCells={(() => {
  const s = gameState as any;
  return s.terminal?.reason === 'win' ? (s.terminal.winCells ?? []) : [];
})()}
```

### 1b. Garrison — Missing winSquares

`vs-ai/page.tsx` and `room/page.tsx` both render `<GarrisonBoard>` without `winSquares`.

Fix: add `winSquares` computed via `checkFiveInARow` on the terminal winner (same as local/page.tsx already does):
```tsx
winSquares={
  gameState.terminal?.winner
    ? (checkFiveInARow(gameState.terminal.winner, (gameState as GarrisonState).pieces) ?? [])
    : []
}
```

Note: `checkFiveInARow` must be imported from `@tactictoe/game-engine` on pages that don't already import it.

---

## 2. UltimateBoard — Meta Win Line

### Component changes (UltimateBoard.tsx)

1. Add `winCells?: number[]` to `UltimateBoardProps` (default `[]`)
2. Restructure the macro layout: instead of one flat CSS grid with a label column, use a flex row:
   - Left: a narrow labels column (row labels)
   - Right: a `position: relative` div containing:
     - A row of column labels at the top
     - A 3×3 CSS grid of mini-boards
     - `{winCells.length > 0 && <WinLine winCells={winCells} cols={3} rows={3} />}` overlaid on the mini-boards grid
3. Import `WinLine` from `./WinLine`

The `<WinLine>` must be placed inside the mini-boards grid container (which is `position: relative`) so the `position: absolute; inset: 0` overlay lands correctly across the 3 winning mini-boards.

### Page changes (all three pages)

In all three pages, compute `winCells` from `boardResults` and pass to `UltimateBoard`:

```tsx
import { getWinCells } from '@tactictoe/game-engine';
// ...
winCells={(() => {
  const s = gameState as UltimateTTTState; // or roomState.gameState
  if (s.terminal?.reason !== 'win') return [];
  const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
  return getWinCells(metaBoard) ?? [];
})()}
```

---

## 3. Cosmetics — Unified Win Colors

### CosmeticsProvider.tsx

Add three new vars to `CSS_VAR_KEYS`:
```ts
'--win-bg',
'--win-bg-subtle',
'--win-border',
```

These are now overridable by cosmetics, falling back to the hardcoded CSS defaults in `globals.css`.

### globals.css

Change the default `--winline-color` in both light and dark mode from `#3b82f6` / `#60a5fa` to `#22c55e` (green, matching the existing 3D highlight default).

The `--win-bg`, `--win-bg-subtle`, `--win-border` defaults stay the same (already green).

### cosmetics/route.ts

Expand each winline skin's `cssValue` to include the 3D highlight vars:

| Skin | `--winline-color` | `--win-bg` | `--win-bg-subtle` | `--win-border` |
|---|---|---|---|---|
| **winline_default** | `#22c55e` | `rgba(34,197,94,0.85)` | `rgba(34,197,94,0.15)` | `#22c55e` |
| **winline_neon** | `#00ffcc` | `rgba(0,255,204,0.85)` | `rgba(0,255,204,0.15)` | `#00ffcc` |
| **winline_fire** | `#ff4500` | `rgba(255,69,0,0.85)` | `rgba(255,69,0,0.15)` | `#ff6b35` |
| **winline_gold** | `#ffd700` | `rgba(255,215,0,0.85)` | `rgba(255,215,0,0.15)` | `#ffd700` |

`--winline-width` and `--winline-filter` values are unchanged.

---

## Variants Not Receiving Win Lines (intentional)

- **SOS** — no single "win line"; game ends by score, not by N-in-a-row. `winCells=[]` is correct.
- **Order & Chaos (Chaos win)** — Chaos wins by filling the board without Order getting 5-in-a-row. No win line exists for Chaos. The room page's `winner === 'X'` guard is intentional and correct.

---

## Files Affected

| File | Change |
|---|---|
| `apps/web/src/app/local/page.tsx` | Add winCells to ttt_3d, ttt_4d, tactic_toe, ultimate_3d, order_chaos; add winCells to UltimateBoard |
| `apps/web/src/app/vs-ai/page.tsx` | Same as local; also add winSquares to GarrisonBoard |
| `apps/web/src/app/room/[code]/page.tsx` | Add winCells to UltimateBoard; add winSquares to GarrisonBoard |
| `apps/web/src/components/board/UltimateBoard.tsx` | Add winCells prop, restructure macro layout, add WinLine |
| `apps/web/src/components/CosmeticsProvider.tsx` | Add --win-bg, --win-bg-subtle, --win-border to CSS_VAR_KEYS |
| `apps/web/src/app/globals.css` | Change --winline-color default to #22c55e |
| `apps/web/src/app/api/cosmetics/route.ts` | Expand winline skin cssValues with win-bg vars |
