# Garrison Visuals — Design Spec
_2026-03-25_

## Summary

Four improvements to the Garrison game mode:
1. **Capture highlighting** — red ring on capturable enemy pieces when a piece is selected
2. **Lichess cburnett SVGs** — replace Unicode chess symbols with proper SVG pieces (default)
3. **Shop: Chess piece sets** — Lichess piece sets purchasable with credits (`chess_piece` cosmetic type)
4. **Shop: Chess board themes** — Board color themes purchasable with credits (`chess_board` cosmetic type)

The Garrison game engine is **not changed**. Visual assets only.

---

## 1. Capture Highlighting

**Problem:** When a piece is selected, `legalDestinations` includes squares with capturable enemy pieces, but those squares show no visual indicator (no dot, no border). Players can't tell whether an enemy piece is capturable or just blocking.

**Fix:** In `GarrisonBoard.tsx`, when a square has a piece AND that square is in `legalDestinations` AND the piece belongs to the opponent (`piece.player !== currentPlayer`), render a red capture ring overlay.

```tsx
// New: capture ring for enemy pieces in legal destinations
{isLegal && p && p.player !== currentPlayer && (
  <div style={{
    position: 'absolute', width: 38, height: 38, borderRadius: '50%',
    border: '3px solid rgba(220,38,38,0.85)', pointerEvents: 'none',
  }} />
)}
```

---

## 2. Lichess cburnett SVG Pieces

**Assets:** Download 10 SVG files per set from the Lichess open-source repo (CC BY-SA 3.0).
**Location:** `apps/web/public/pieces/{setname}/` — files: `wK wQ wR wB wN bK bQ bR bB bN`.
**Default set:** `cburnett` (bundled, free).
**Attribution:** `apps/web/public/pieces/LICENSES.md`

**GarrisonBoard rendering:**
```tsx
<img
  src={`/pieces/${chessSet}/${piece.player === 'X' ? 'b' : 'w'}${piece.type}.svg`}
  width={40} height={40}
  alt={`${piece.player} ${piece.type}`}
  draggable={false}
/>
```

`chessSet` comes from the cosmetics context (default: `"cburnett"`).

---

## 3. Data Model

No schema changes. Re-uses existing `Cosmetic`, `UserCosmetic`, purchase API, and equip API.

**New cosmetic types:**

| type | cssValue JSON | Meaning |
|------|--------------|---------|
| `chess_piece` | `{ "set": "cburnett" }` | Which SVG set to use |
| `chess_board` | `{ "light": "#f0d9b5", "dark": "#b58863" }` | Square colors |

**Initial inventory:**

Chess piece sets:
- cburnett — 0 credits (default)
- merida — 200 credits
- alpha — 400 credits
- staunty — 600 credits
- tatiana — 800 credits

Chess board themes:
- Brown — 0 credits (default, `#f0d9b5` / `#b58863`)
- Blue — 150 credits (`#dee3e6` / `#8ca2ad`)
- Green — 300 credits (`#ffffdd` / `#86a666`)
- Purple — 500 credits (`#e8d9eb` / `#9f72b5`)
- Marble — 750 credits (`#f0ece4` / `#7a9e7e`)

---

## 4. Cosmetics Context + Provider

**CosmeticsContext** gains two new fields:
- `chessSet: string` (default `"cburnett"`)
- `chessBoardColors: { light: string; dark: string }` (default brown)

**CosmeticsProvider** extracts these when it finds equipped `chess_piece` / `chess_board` cosmetics, same pattern as existing TTT cosmetics.

**GarrisonBoard** reads from context instead of hardcoded `LIGHT_SQ`/`DARK_SQ` constants.

---

## 5. Shop UI

Two new sections added to `apps/web/src/app/shop/page.tsx`:

**Chess Pieces section:** Preview shows a 2×2 mini grid of SVG piece images (wK, bQ, wR, bN).

**Chess Board section:** Preview shows a 2×2 mini board using the theme's light/dark colors.

Both sections follow the existing card grid layout. Free items auto-unlocked; paid items use the existing buy flow.

---

## Out of Scope

- No engine changes
- No pawn pieces (Garrison has no pawns)
- No other game modes affected
- No CDN dependency — all assets bundled locally
