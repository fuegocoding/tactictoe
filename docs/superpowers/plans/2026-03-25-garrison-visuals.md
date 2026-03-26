# Garrison Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Garrison's Unicode chess symbols with Lichess SVG pieces, add red-ring capture highlighting, and add chess piece sets + board themes to the shop as purchasable cosmetics.

**Architecture:** SVG assets download from the open-source Lichess lila repository into `public/pieces/{setname}/`. The equipped `chess_piece` cosmetic name is read via `CosmeticsContext` (`chessSet`). Board square colours are applied as CSS variables `--chess-light` / `--chess-dark` by `CosmeticsProvider`, the same way TTT board themes work. No game-engine changes.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Prisma, inline styles + CSS variables.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/public/pieces/{set}/` | Create — 50 SVG files (5 sets × 10 pieces) |
| `apps/web/public/pieces/LICENSES.md` | Create — CC BY-SA 3.0 attribution |
| `apps/web/src/components/board/GarrisonBoard.tsx` | Modify — capture ring, SVG pieces, CSS-var colours, context |
| `apps/web/src/components/CosmeticsContext.tsx` | Modify — add `chessSet` |
| `apps/web/src/components/CosmeticsProvider.tsx` | Modify — add `--chess-light/dark` to CSS_VAR_KEYS, extract `set` field |
| `apps/web/prisma/seed-cosmetics.ts` | Modify — add 10 new cosmetics |
| `apps/web/src/app/api/cosmetics/route.ts` | Modify — add 10 entries to DEFAULT_COSMETICS fallback |
| `apps/web/src/app/shop/page.tsx` | Modify — add Chess Pieces and Chess Board sections |

---

## Task 1: Download Chess Piece SVG Assets

**Files:**
- Create: `apps/web/public/pieces/cburnett/` (10 SVG files)
- Create: `apps/web/public/pieces/merida/` (10 SVG files)
- Create: `apps/web/public/pieces/alpha/` (10 SVG files)
- Create: `apps/web/public/pieces/staunty/` (10 SVG files)
- Create: `apps/web/public/pieces/tatiana/` (10 SVG files)
- Create: `apps/web/public/pieces/LICENSES.md`

- [ ] **Step 1: Create the public directories**

```bash
cd apps/web/public
mkdir -p pieces/cburnett pieces/merida pieces/alpha pieces/staunty pieces/tatiana
```

- [ ] **Step 2: Download all five piece sets**

Run this script from the repo root (it uses the Lichess lila open-source repo):

```bash
BASE="https://raw.githubusercontent.com/lichess-org/lila/master/public/piece"
PIECES="wK wQ wR wB wN bK bQ bR bB bN"
SETS="cburnett merida alpha staunty tatiana"

for SET in $SETS; do
  for P in $PIECES; do
    curl -sSf "$BASE/$SET/$P.svg" \
      -o "apps/web/public/pieces/$SET/$P.svg"
  done
  echo "Downloaded $SET"
done
```

Expected: 50 files total, each a non-empty SVG. If any `curl` exits non-zero, that set/piece doesn't exist at that path — check the Lichess lila repo (`github.com/lichess-org/lila`, directory `public/piece/`) for the correct filename.

- [ ] **Step 3: Verify the download**

```bash
find apps/web/public/pieces -name "*.svg" | wc -l
```

Expected output: `50`

- [ ] **Step 4: Create the attribution file**

Create `apps/web/public/pieces/LICENSES.md`:

```markdown
# Chess Piece Licenses

The SVG chess piece sets in this directory are sourced from the
[Lichess lila repository](https://github.com/lichess-org/lila)
and used under their respective licenses.

## cburnett
Designed by Colin M.L. Burnett.
License: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
Source: https://en.wikipedia.org/wiki/User:Cburnett/GFDL_images/Chess

## merida, alpha, staunty, tatiana
Various authors. Distributed by Lichess under compatible open licenses.
Source: https://github.com/lichess-org/lila/tree/master/public/piece
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/pieces/
git commit -m "feat: add Lichess SVG chess piece sets (cburnett, merida, alpha, staunty, tatiana)"
```

---

## Task 2: Add Capture-Ring Highlighting to GarrisonBoard

**Files:**
- Modify: `apps/web/src/components/board/GarrisonBoard.tsx`

The current code shows a blue dot on empty legal squares but gives no visual indicator when a legal square holds a capturable enemy piece. Fix: overlay a red ring on any square that is legal AND holds an enemy piece.

- [ ] **Step 1: Add `position: 'relative'` to the square div and the capture ring**

In `GarrisonBoard.tsx`, find the square `<div>` at line ~135. Change its style to add `position: 'relative'`, and add the capture ring element after the existing dot indicator:

```tsx
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
      position: 'relative',          // ← add this
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
```

- [ ] **Step 2: Verify manually**

Start the dev server (`pnpm dev` from repo root) and start a Garrison game. Click a queen — confirm empty squares show blue dots, and that clicking near an enemy piece reveals the red ring around it. Confirm your own pieces show neither dot nor ring.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/board/GarrisonBoard.tsx
git commit -m "feat: add capture-ring highlight for enemy pieces in Garrison"
```

---

## Task 3: Replace Unicode Symbols with SVG Piece Images in GarrisonBoard

**Files:**
- Modify: `apps/web/src/components/board/GarrisonBoard.tsx`

- [ ] **Step 1: Replace the board piece span with an img tag**

In `GarrisonBoard.tsx`, replace the `{p && ( <span ...> {PIECE_SYMBOL[p.type][p.player]} </span> )}` block (lines ~153–163) with:

```tsx
{p && (
  <img
    src={`/pieces/cburnett/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
    width={38}
    height={38}
    alt={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
    draggable={false}
    style={{ display: 'block', userSelect: 'none' }}
  />
)}
```

- [ ] **Step 2: Replace the hand-piece Unicode symbol with an img tag**

In `renderHandPiece`, replace the `{sym}` text content:

```tsx
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
        src={`/pieces/cburnett/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
        width={30}
        height={30}
        alt={`${p.player === 'X' ? 'Black' : 'White'} ${p.type}`}
        draggable={false}
        style={{ display: 'block', userSelect: 'none' }}
      />
    </button>
  );
}
```

- [ ] **Step 3: Remove the now-unused PIECE_SYMBOL constant**

Delete lines 7–13:

```tsx
// DELETE this block entirely:
const PIECE_SYMBOL: Record<PieceType, { X: string; O: string }> = {
  K: { X: '♚', O: '♔' },
  Q: { X: '♛', O: '♕' },
  R: { X: '♜', O: '♖' },
  B: { X: '♝', O: '♗' },
  N: { X: '♞', O: '♘' },
};
```

Also remove the `PieceType` import if it is no longer used elsewhere in the file (check the import line at the top).

- [ ] **Step 4: Verify manually**

Open a Garrison game. Confirm all pieces on the board and in hand render as crisp SVG images instead of Unicode glyphs. Confirm kings, queens, rooks, bishops, and knights all display correctly for both players.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/board/GarrisonBoard.tsx
git commit -m "feat: replace Unicode chess glyphs with Lichess cburnett SVG images in Garrison"
```

---

## Task 4: Extend CosmeticsContext and CosmeticsProvider for Chess Cosmetics

**Files:**
- Modify: `apps/web/src/components/CosmeticsContext.tsx`
- Modify: `apps/web/src/components/CosmeticsProvider.tsx`

- [ ] **Step 1: Add `chessSet` to CosmeticsContext**

Replace the entire contents of `CosmeticsContext.tsx`:

```tsx
'use client';

import { createContext, useContext } from 'react';

export interface CosmeticsContextValue {
  symbolX: string;   // default 'X'
  symbolO: string;   // default 'O'
  chessSet: string;  // default 'cburnett'
}

export const CosmeticsContext = createContext<CosmeticsContextValue>({
  symbolX: 'X',
  symbolO: 'O',
  chessSet: 'cburnett',
});

export function useCosmetics() {
  return useContext(CosmeticsContext);
}
```

- [ ] **Step 2: Update CosmeticsProvider to handle chess cosmetics**

Replace the entire contents of `CosmeticsProvider.tsx`:

```tsx
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
  '--chess-light',
  '--chess-dark',
];

export default function CosmeticsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [symbolX, setSymbolX] = useState('X');
  const [symbolO, setSymbolO] = useState('O');
  const [chessSet, setChessSet] = useState('cburnett');

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
            } catch (e) {
              console.warn('Failed to parse guest cosmetics from localStorage:', e);
            }
          }
        }

        // Reset all CSS vars to defaults
        const overrides: Record<string, string> = Object.fromEntries(
          CSS_VAR_KEYS.map((k) => [k, ''])
        );

        let nextSymbolX = 'X';
        let nextSymbolO = 'O';
        let nextChessSet = 'cburnett';

        for (const c of equipped) {
          try {
            const parsed = JSON.parse(c.cssValue);
            if (parsed.symbolX) nextSymbolX = parsed.symbolX;
            if (parsed.symbolO) nextSymbolO = parsed.symbolO;
            if (parsed.set)     nextChessSet = parsed.set;
            for (const key of CSS_VAR_KEYS) {
              if (parsed[key] !== undefined) overrides[key] = parsed[key];
            }
          } catch (e) {
            console.error(`Failed to parse cosmetic cssValue for cosmetic ${c.id}:`, e);
          }
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
        setChessSet(nextChessSet);
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
    <CosmeticsContext.Provider value={{ symbolX, symbolO, chessSet }}>
      {children}
    </CosmeticsContext.Provider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/CosmeticsContext.tsx apps/web/src/components/CosmeticsProvider.tsx
git commit -m "feat: extend CosmeticsContext with chessSet and add --chess-light/dark CSS vars"
```

---

## Task 5: Wire GarrisonBoard to Use chessSet and CSS-Variable Board Colours

**Files:**
- Modify: `apps/web/src/components/board/GarrisonBoard.tsx`

- [ ] **Step 1: Import useCosmetics and use chessSet**

At the top of `GarrisonBoard.tsx`, add the import:

```tsx
import { useCosmetics } from '../CosmeticsContext';
```

- [ ] **Step 2: Remove the hardcoded LIGHT_SQ / DARK_SQ constants**

Delete these two lines (near the top of the file, after imports):

```tsx
// DELETE:
const LIGHT_SQ = '#f0d9b5';
const DARK_SQ  = '#b58863';
```

- [ ] **Step 3: Read chessSet from context and use CSS vars for square colours**

Inside the `GarrisonBoard` component function, add `chessSet` from the hook and define the colour strings using CSS variables with fallback to the original brown values:

```tsx
export function GarrisonBoard({ ... }: GarrisonBoardProps) {
  const { chessSet } = useCosmetics();
  const LIGHT_SQ = 'var(--chess-light, #f0d9b5)';
  const DARK_SQ  = 'var(--chess-dark, #b58863)';

  // ... rest of component unchanged
```

- [ ] **Step 4: Replace the hardcoded `/pieces/cburnett/` path with the dynamic chessSet**

In the board-piece `<img>` tag (from Task 3):

```tsx
src={`/pieces/${chessSet}/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
```

And in the hand-piece `<img>` tag:

```tsx
src={`/pieces/${chessSet}/${p.player === 'X' ? 'b' : 'w'}${p.type}.svg`}
```

- [ ] **Step 5: Verify manually**

Load a Garrison game. Pieces and board colours should look identical to Task 3 (cburnett on brown). No visual regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/board/GarrisonBoard.tsx
git commit -m "feat: wire GarrisonBoard to cosmetics context for piece set and board colours"
```

---

## Task 6: Add Chess Cosmetics to Seed Data and Default-Cosmetics Fallback

**Files:**
- Modify: `apps/web/prisma/seed-cosmetics.ts`
- Modify: `apps/web/src/app/api/cosmetics/route.ts`

- [ ] **Step 1: Add chess cosmetics to seed-cosmetics.ts**

In `seed-cosmetics.ts`, append to the `cosmetics` array after the Win Line Skins block:

```typescript
// ── Chess Piece Sets ──────────────────────────────────
{ name: 'cburnett',  type: 'chess_piece', cssValue: '{"set":"cburnett"}',  requiredScore: 0, price: 0 },
{ name: 'Merida',    type: 'chess_piece', cssValue: '{"set":"merida"}',    requiredScore: 0, price: 200 },
{ name: 'Alpha',     type: 'chess_piece', cssValue: '{"set":"alpha"}',     requiredScore: 0, price: 400 },
{ name: 'Staunty',   type: 'chess_piece', cssValue: '{"set":"staunty"}',   requiredScore: 0, price: 600 },
{ name: 'Tatiana',   type: 'chess_piece', cssValue: '{"set":"tatiana"}',   requiredScore: 0, price: 800 },

// ── Chess Board Themes ────────────────────────────────
{ name: 'Brown',     type: 'chess_board', cssValue: '{"--chess-light":"#f0d9b5","--chess-dark":"#b58863"}', requiredScore: 0, price: 0 },
{ name: 'Blue',      type: 'chess_board', cssValue: '{"--chess-light":"#dee3e6","--chess-dark":"#8ca2ad"}', requiredScore: 0, price: 150 },
{ name: 'Green',     type: 'chess_board', cssValue: '{"--chess-light":"#ffffdd","--chess-dark":"#86a666"}', requiredScore: 0, price: 300 },
{ name: 'Purple',    type: 'chess_board', cssValue: '{"--chess-light":"#e8d9eb","--chess-dark":"#9f72b5"}', requiredScore: 0, price: 500 },
{ name: 'Marble',    type: 'chess_board', cssValue: '{"--chess-light":"#f0ece4","--chess-dark":"#7a9e7e"}', requiredScore: 0, price: 750 },
```

- [ ] **Step 2: Add the same entries to the DEFAULT_COSMETICS fallback in the cosmetics API**

In `apps/web/src/app/api/cosmetics/route.ts`, inside the `if (cosmetics.length === 0)` block, add to `DEFAULT_COSMETICS`:

```typescript
{ id: 'chess_piece_cburnett', name: 'cburnett',  type: 'chess_piece', cssValue: '{"set":"cburnett"}',  requiredScore: 0, price: 0 },
{ id: 'chess_piece_merida',   name: 'Merida',    type: 'chess_piece', cssValue: '{"set":"merida"}',    requiredScore: 0, price: 200 },
{ id: 'chess_piece_alpha',    name: 'Alpha',     type: 'chess_piece', cssValue: '{"set":"alpha"}',     requiredScore: 0, price: 400 },
{ id: 'chess_piece_staunty',  name: 'Staunty',   type: 'chess_piece', cssValue: '{"set":"staunty"}',   requiredScore: 0, price: 600 },
{ id: 'chess_piece_tatiana',  name: 'Tatiana',   type: 'chess_piece', cssValue: '{"set":"tatiana"}',   requiredScore: 0, price: 800 },
{ id: 'chess_board_brown',    name: 'Brown',     type: 'chess_board', cssValue: '{"--chess-light":"#f0d9b5","--chess-dark":"#b58863"}', requiredScore: 0, price: 0 },
{ id: 'chess_board_blue',     name: 'Blue',      type: 'chess_board', cssValue: '{"--chess-light":"#dee3e6","--chess-dark":"#8ca2ad"}', requiredScore: 0, price: 150 },
{ id: 'chess_board_green',    name: 'Green',     type: 'chess_board', cssValue: '{"--chess-light":"#ffffdd","--chess-dark":"#86a666"}', requiredScore: 0, price: 300 },
{ id: 'chess_board_purple',   name: 'Purple',    type: 'chess_board', cssValue: '{"--chess-light":"#e8d9eb","--chess-dark":"#9f72b5"}', requiredScore: 0, price: 500 },
{ id: 'chess_board_marble',   name: 'Marble',    type: 'chess_board', cssValue: '{"--chess-light":"#f0ece4","--chess-dark":"#7a9e7e"}', requiredScore: 0, price: 750 },
```

- [ ] **Step 3: Run the seed (dev environment only)**

```bash
cd apps/web
pnpm prisma db seed
```

Expected output: `Seeded 31 cosmetics` (21 existing + 10 new)

- [ ] **Step 4: Commit**

```bash
git add apps/web/prisma/seed-cosmetics.ts apps/web/src/app/api/cosmetics/route.ts
git commit -m "feat: seed chess_piece and chess_board cosmetics (5 piece sets, 5 board themes)"
```

---

## Task 7: Add Chess Cosmetics Sections to the Shop Page

**Files:**
- Modify: `apps/web/src/app/shop/page.tsx`

- [ ] **Step 1: Extend the Cosmetic interface type**

In `shop/page.tsx`, update the `type` field of the `Cosmetic` interface:

```typescript
interface Cosmetic {
  id: string;
  name: string;
  type: 'board' | 'piece' | 'winline' | 'chess_piece' | 'chess_board';
  cssValue: string;
  requiredScore: number;
  price: number;
  isUnlocked: boolean;
  isEquipped: boolean;
}
```

- [ ] **Step 2: Add filtering for the two new categories**

In the component body, after the existing `const winlines = ...` line:

```typescript
const chessBoards = buyableCosmetics.filter(c => c.type === 'chess_board');
const chessPieces = buyableCosmetics.filter(c => c.type === 'chess_piece');
```

- [ ] **Step 3: Add the Chess Board Themes section**

After the closing `}` of the existing `{winlines.length > 0 && ( ... )}` block, add:

```tsx
{chessBoards.length > 0 && (
  <div className={styles.section}>
    <h2 className={styles.sectionTitle}>Chess Board Themes</h2>
    <div className={styles.grid}>
      {chessBoards.map(c => {
        const cv = JSON.parse(c.cssValue) as Record<string, string>;
        const light = cv['--chess-light'] ?? '#f0d9b5';
        const dark  = cv['--chess-dark']  ?? '#b58863';
        return (
          <Card key={c.id} className={styles.card}>
            <div className={styles.preview}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 28px)', gridTemplateRows: 'repeat(4, 28px)' }}>
                {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const isLight = (row + col) % 2 === 0;
                  return (
                    <div key={i} style={{ width: 28, height: 28, background: isLight ? light : dark }} />
                  );
                })}
              </div>
            </div>
            <div className={styles.info}>
              <h3>{c.name}</h3>
              <p className={styles.requirement}>Price: {c.price} credits</p>
              <Button
                variant="primary"
                onClick={() => handleBuy(c)}
                disabled={purchasing === c.id || (!!session?.user && credits < c.price)}
              >
                {purchasing === c.id ? 'Buying...' : 'Buy'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: Add the Chess Piece Sets section**

After the Chess Board Themes section:

```tsx
{chessPieces.length > 0 && (
  <div className={styles.section}>
    <h2 className={styles.sectionTitle}>Chess Piece Sets</h2>
    <div className={styles.grid}>
      {chessPieces.map(c => {
        const cv = JSON.parse(c.cssValue) as { set: string };
        return (
          <Card key={c.id} className={styles.card}>
            <div className={styles.preview}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 44px)', gap: 6 }}>
                {(['wK', 'bQ', 'wR', 'bN'] as const).map(p => (
                  <img
                    key={p}
                    src={`/pieces/${cv.set}/${p}.svg`}
                    width={44}
                    height={44}
                    alt={p}
                    style={{ display: 'block' }}
                  />
                ))}
              </div>
            </div>
            <div className={styles.info}>
              <h3>{c.name}</h3>
              <p className={styles.requirement}>Price: {c.price} credits</p>
              <Button
                variant="primary"
                onClick={() => handleBuy(c)}
                disabled={purchasing === c.id || (!!session?.user && credits < c.price)}
              >
                {purchasing === c.id ? 'Buying...' : 'Buy'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify manually**

Open `/shop` in the browser. Confirm two new sections appear: "Chess Board Themes" with colour-grid previews, and "Chess Piece Sets" with 2×2 SVG previews (wK, bQ, wR, bN). Confirm the buy flow works end-to-end: purchase a chess piece set, equip it, refresh the Garrison board — pieces should switch to the new set.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/shop/page.tsx
git commit -m "feat: add Chess Piece Sets and Chess Board Themes sections to shop"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Capture ring on capturable enemy pieces | Task 2 |
| Lichess cburnett SVGs as default pieces | Tasks 1, 3 |
| chessSet read from context | Tasks 4, 5 |
| Board colours via CSS variables | Tasks 4, 5 |
| 5 piece sets in shop (chess_piece) | Tasks 1, 6, 7 |
| 5 board themes in shop (chess_board) | Tasks 6, 7 |
| Attribution / LICENSES.md | Task 1 |
| No engine changes | ✓ (not touched) |

**Placeholder scan:** None found — all steps contain exact code.

**Type consistency check:**
- `chessSet` defined in Task 4, used in Task 5 ✓
- `LIGHT_SQ` / `DARK_SQ` removed in Task 5, not referenced after Task 3 ✓
- `chess_piece` / `chess_board` type strings consistent across Tasks 6 and 7 ✓
- `cv.set` in shop preview matches `cssValue: '{"set":"cburnett"}'` format in Task 6 ✓
- `--chess-light` / `--chess-dark` key strings consistent between CosmeticsProvider (Task 4) and seed data (Task 6) ✓
