# 3D Visualization Improvements Design

**Date:** 2026-03-25
**Scope:** `apps/web/src/components/board/ThreeDBoard.tsx` + `apps/web/src/app/globals.css`
**Approach:** Minimal targeted fixes (Approach A — no library changes, pure CSS 3D)

---

## Problem Summary

The 3D variant visualization has four distinct aesthetic/functional issues:

1. Placed pieces look like 2D icons on a dark semi-transparent box instead of full colored 3D cubes.
2. The axis labels (A/B/C, 1/2/3, L1/L2/L3) are embedded inside the rotating 3D scene — they clutter the cube and move with it in a confusing way.
3. There is no clear visual link between the "Top / Middle / Bottom" 2D panel labels and the corresponding slices in the 3D visualization.
4. In light mode, empty cells are `rgba(20,20,20,0.45)` — a dark opaque blob — instead of being nearly invisible and letting the cube structure show through.

---

## Section 1: Colored Solid Blocks

**File:** `ThreeDBoard.tsx` — `Cubelet` component

### Changes

- When a cell is **occupied**, all 6 faces get the piece color as a **solid fill** (full opacity): `var(--mark-x)` for X, `var(--mark-o)` for O.
- The `PieceSymbol` is rendered on **all 6 faces** (not just the front), so the cube reads as a branded block from any viewing angle.
- Win-highlighted occupied cells use `var(--accent)` fill on all faces (existing accent treatment, extended to all faces).
- Win-highlighted **empty** cells keep the subtle `var(--accent-subtle)` face treatment.
- The `color` prop passed to `PieceSymbol` for occupied faces should contrast against the solid background — use `rgba(255,255,255,0.85)` for both X and O so the symbol is legible on the colored face.

---

## Section 2: Axis Gizmo (Separate Component)

**File:** `ThreeDBoard.tsx` — new `AxisGizmo` component

### What it is

A small standalone CSS 3D element rendered **next to** the cube (sibling flex item in `ThreeDViz`), not overlaid. It shares the same `rotation` state (passed as a prop) so it rotates synchronously with the cube when dragged.

### Visual design

- Three colored arrow stubs, each ~32px long:
  - **X axis → red** (`#ef4444`)
  - **Y axis → green** (`#22c55e`)
  - **Z axis → blue** (`#3b82f6`)
- Each arrow: a thin colored line (CSS `border` or `div`) with an arrowhead (CSS border triangle) at the tip.
- Label at the tip: single letter `X`, `Y`, or `Z` in the axis color. No origin dot, no zero.
- The gizmo container is ~80×80px, centered on the origin, with `preserve-3d` and `rotateX / rotateZ` matching the cube.

### Replacing the old labels

Remove the existing `A/B/C`, `1/2/3`, `L1/L2/L3` text elements from inside the `ThreeDViz` 3D scene entirely. The gizmo replaces their orientation-guidance role.

### Layout

`ThreeDViz` renders as a flex row: `[cube viewport] [gizmo]`, aligned center. The gizmo sits to the right of the cube.

---

## Section 3: Layer Label Sync

**File:** `ThreeDBoard.tsx` — `ThreeDViz` scene, `ThreeDBoard` 2D panels

### 2D panel labels

Rename from verbose form to short form:
- `Layer 1 (Top)` → `Top`
- `Layer 2 (Middle)` → `Middle`
- `Layer 3 (Bottom)` → `Bottom`

### 3D viz layer indicators

Add a faint outline box (a single `div` per layer with `transformStyle: preserve-3d`, no fill, just a visible border) that wraps each 3×3 layer slice in the 3D scene. This makes it visually clear where each layer boundary is and which slice corresponds to which 2D panel.

- Border color: `rgba(255,255,255,0.12)` dark mode / `rgba(0,0,0,0.10)` light mode.
- Size: `3*SPACING × 3*SPACING` (covers all 3×3 cells of the layer), centered at each layer's Z position.
- No fill. Purely an outline to frame the layer.

### Coordinate verification

Current mapping (confirmed correct in code):
- Layer index 0 → `z = -SPACING` → visually top of isometric stack ✓
- Layer index 1 → `z = 0` → middle ✓
- Layer index 2 → `z = +SPACING` → visually bottom ✓

No coordinate changes needed. The outline boxes will make this correspondence self-evident to the user.

---

## Section 4: Theme-Aware Cell Transparency

**Files:** `globals.css` + `ThreeDBoard.tsx`

### New CSS variables (in `globals.css`)

```css
/* Light mode (:root) */
--cube-face-empty: rgba(255, 255, 255, 0.18);
--cube-face-border: rgba(0, 0, 0, 0.14);

/* Dark mode ([data-theme="dark"]) */
--cube-face-empty: rgba(0, 0, 0, 0.35);
--cube-face-border: rgba(255, 255, 255, 0.15);
```

### Usage in `Cubelet`

- Empty faces: `background: var(--cube-face-empty)`, `border: 1px solid var(--cube-face-border)`.
- Occupied faces: solid piece color (see Section 1), `border: 1px solid var(--cube-face-border)`.
- Win empty faces: `background: var(--accent-subtle)`, `border: 2px solid var(--accent)`.
- Win occupied faces: `background: var(--accent)`, `border: 2px solid var(--accent)`.

**Key requirement:** Empty cells must be transparent enough that the middle layer is fully visible through the surrounding top and bottom layers. The values above achieve this — at 0.18 opacity the face is nearly invisible but still gives the cube its wireframe structure.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/board/ThreeDBoard.tsx` | Fix `Cubelet` faces, add `AxisGizmo`, remove old axis labels, add layer outline boxes, rename panel labels |
| `apps/web/src/app/globals.css` | Add `--cube-face-empty` and `--cube-face-border` CSS variables for light and dark mode |

---

## Out of Scope

- No changes to game logic, win detection, or move handling.
- No changes to `Ultimate3DBoard.tsx`, `FourDBoard.tsx`, or `TacticToeBoard.tsx` (separate variants with different rendering).
- No library additions (THREE.js etc.).
- No mobile layout changes.
