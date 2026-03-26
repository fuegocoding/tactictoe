# 3D Visualization Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3D variant visualization so pieces look like proper solid colored cubes, the axis indicator is a separate gizmo next to the cube, layer labels match the 3D view, and empty cells are transparent in both themes.

**Architecture:** All changes are isolated to two files — `ThreeDBoard.tsx` (component logic) and `globals.css` (CSS variables). No new files, no library changes.

**Tech Stack:** React, CSS 3D transforms (`preserve-3d`, `translate3d`, `rotateX/Y/Z`), CSS custom properties, Next.js.

---

## File Map

| File | What changes |
|------|-------------|
| `apps/web/src/app/globals.css` | Add `--cube-face-empty`, `--cube-face-border`, `--cube-layer-border` to `:root` and `[data-theme="dark"]` |
| `apps/web/src/components/board/ThreeDBoard.tsx` | Fix `Cubelet`, add `AxisGizmo`, remove old axis labels, add layer outline boxes, update `LAYER_LABELS`, update `ThreeDViz` layout |

---

## Task 1: Add CSS variables for cube face transparency

**Files:**
- Modify: `apps/web/src/app/globals.css`

These three variables drive every transparency/border decision in the 3D scene. Adding them here means the Cubelet component never hardcodes colors.

- [ ] **Step 1: Locate the `:root` and `[data-theme="dark"]` blocks in globals.css**

Open `apps/web/src/app/globals.css`. Find the `:root` block (light mode variables) and the `[data-theme="dark"]` block (dark mode overrides).

- [ ] **Step 2: Add variables to `:root` (light mode)**

In the `:root` block, add after the existing board cell variables:

```css
--cube-face-empty: rgba(255, 255, 255, 0.18);
--cube-face-border: rgba(0, 0, 0, 0.14);
--cube-layer-border: rgba(0, 0, 0, 0.10);
```

- [ ] **Step 3: Add variables to `[data-theme="dark"]` (dark mode)**

In the `[data-theme="dark"]` block, add the overrides:

```css
--cube-face-empty: rgba(0, 0, 0, 0.35);
--cube-face-border: rgba(255, 255, 255, 0.15);
--cube-layer-border: rgba(255, 255, 255, 0.12);
```

- [ ] **Step 4: Verify build passes**

```bash
cd apps/web && npm run typecheck
```

Expected: no errors (CSS-only change, TypeScript has nothing to check here).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: add CSS variables for 3D cube face transparency"
```

---

## Task 2: Fix Cubelet — solid colored faces with symbol on all sides

**Files:**
- Modify: `apps/web/src/components/board/ThreeDBoard.tsx` (lines 21–56, the `Cubelet` function)

Currently only the front face shows the symbol, and all faces use a hardcoded dark background. This task makes occupied cubelets fully colored on all 6 faces.

- [ ] **Step 1: Replace the `Cubelet` function entirely**

Replace everything from `function Cubelet(` through the closing `}` (lines 21–56) with:

```tsx
function Cubelet({ cell, isWin, symbolX, symbolO }: { cell: string | number | null; isWin: boolean; symbolX: string; symbolO: string }) {
  const isX = cell === 'X';
  const isO = cell === 'O';
  const isOccupied = isX || isO;
  const pieceColor = isX ? 'var(--mark-x)' : isO ? 'var(--mark-o)' : undefined;
  const symbol = isX ? symbolX : isO ? symbolO : null;

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width: CUBE,
    height: CUBE,
    background: isWin && isOccupied
      ? 'var(--accent)'
      : isWin
      ? 'var(--accent-subtle, rgba(59,130,246,0.15))'
      : isOccupied
      ? pieceColor
      : 'var(--cube-face-empty)',
    border: isWin ? '2px solid var(--accent, #3b82f6)' : '1px solid var(--cube-face-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'visible',
    boxSizing: 'border-box',
  };

  const faceContent = isOccupied && symbol ? (
    <PieceSymbol symbol={symbol} color="rgba(255,255,255,0.85)" size={CUBE * 0.6} />
  ) : null;

  return (
    <div style={{ position: 'relative', width: CUBE, height: CUBE, transformStyle: 'preserve-3d' }}>
      {/* Front */}
      <div style={{ ...faceStyle, transform: `translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Back */}
      <div style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Right */}
      <div style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Left */}
      <div style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Top */}
      <div style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
      {/* Bottom */}
      <div style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${HALF}px)` }}>{faceContent}</div>
    </div>
  );
}
```

Key changes vs. the old version:
- `faceStyle.background` is now conditional: solid piece color when occupied, CSS var when empty.
- `faceStyle.border` uses `--cube-face-border` instead of hardcoded `rgba(0,0,0,0.7)`.
- `faceContent` is rendered on all 6 faces (not just front).
- Symbol color is `rgba(255,255,255,0.85)` so it contrasts on the solid colored face.

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/board/ThreeDBoard.tsx
git commit -m "feat: render solid colored cubelets with symbol on all 6 faces"
```

---

## Task 3: Add AxisGizmo component

**Files:**
- Modify: `apps/web/src/components/board/ThreeDBoard.tsx` (insert new component before `ThreeDViz`)

A small standalone CSS 3D element with three colored arrows (X=red, Y=green, Z=blue) that shares the cube's rotation state.

- [ ] **Step 1: Add the `GIZMO_ARM` constant after the existing constants**

After line 19 (`const HALF = CUBE / 2;`), add:

```tsx
const GIZMO_ARM = 28;
```

- [ ] **Step 2: Insert the `AxisGizmo` component before `ThreeDViz`**

Insert this entire block immediately before the `export function ThreeDViz(` line:

```tsx
function AxisGizmo({ rotation }: { rotation: { x: number; z: number } }) {
  const billboard = `rotateZ(${-rotation.z}deg) rotateX(${-rotation.x}deg)`;

  return (
    <div
      style={{
        perspective: '300px',
        width: 64,
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
        }}
      >
        {/* X axis — red, points right (+X) */}
        <div style={{ position: 'absolute', width: GIZMO_ARM, height: 2, background: '#ef4444', top: -1, left: 0 }} />
        <div style={{
          position: 'absolute',
          left: GIZMO_ARM, top: -4,
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '7px solid #ef4444',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(${GIZMO_ARM + 10}px, -50%, 0) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap',
        }}>X</div>

        {/* Y axis — green, points down (+Y in CSS) */}
        <div style={{ position: 'absolute', width: 2, height: GIZMO_ARM, background: '#22c55e', top: 0, left: -1 }} />
        <div style={{
          position: 'absolute',
          top: GIZMO_ARM, left: -4,
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '7px solid #22c55e',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-50%, ${GIZMO_ARM + 10}px, 0) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap',
        }}>Y</div>

        {/* Z axis — blue, points toward viewer (+Z in CSS 3D) */}
        <div style={{
          position: 'absolute',
          width: 2, height: GIZMO_ARM,
          background: '#3b82f6',
          top: 0, left: -1,
          transform: 'rotateX(-90deg)',
          transformOrigin: 'center top',
        }} />
        <div style={{
          position: 'absolute',
          transform: `translate3d(-50%, 0, ${GIZMO_ARM + 6}px) ${billboard}`,
          fontSize: 9, fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap',
        }}>Z</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/board/ThreeDBoard.tsx
git commit -m "feat: add AxisGizmo component with X/Y/Z arrows"
```

---

## Task 4: Update ThreeDViz — remove old labels, add gizmo, add layer outline boxes

**Files:**
- Modify: `apps/web/src/components/board/ThreeDBoard.tsx` — the `ThreeDViz` function body

This task wires together all the pieces: removes the old A/B/C labels, adds `<AxisGizmo>`, and adds a flat frame per layer so the user can see each z-slice clearly.

- [ ] **Step 1: Remove the three old axis label sections from the 3D scene**

Inside `ThreeDViz`, locate and **delete** these three comment-delimited blocks entirely:

```tsx
{/* X Axis (Columns: A, B, C) - Front edge of the bottom floor (Layer 3) */}
{['A', 'B', 'C'].map((label, col) => { ... })}

{/* Y Axis (Rows: 1, 2, 3) - Left edge of the top floor (Layer 1) */}
{['1', '2', '3'].map((label, row) => { ... })}

{/* Z Axis (Layers: L1, L2, L3) - Right-back edge of the vertical stack */}
{['L1', 'L2', 'L3'].map((label, layer) => { ... })}
```

These are lines 134–203 in the original file.

- [ ] **Step 2: Add layer outline boxes in the 3D scene**

In the same `<div style={{ transformStyle: 'preserve-3d', transform: ... }}>` container (where the cubelets are rendered), add the layer frames **before** the cubelet flatMap. The frame size `2 * SPACING + CUBE` = `2*50 + 40` = `140px` spans all three columns/rows including the cubelets' half-sizes.

```tsx
{/* Layer outline frames — one flat border per z-slice */}
{[0, 1, 2].map(layer => {
  const z = (layer - 1) * SPACING;
  const frameSize = 2 * SPACING + CUBE; // 140px
  return (
    <div
      key={`layer-frame-${layer}`}
      style={{
        position: 'absolute',
        width: frameSize,
        height: frameSize,
        border: '1px solid var(--cube-layer-border)',
        background: 'transparent',
        transform: `translate3d(${-frameSize / 2}px, ${-frameSize / 2}px, ${z}px)`,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
})}
```

- [ ] **Step 3: Add `<AxisGizmo>` next to the cube viewport**

The `ThreeDViz` return currently wraps everything in:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
  <div>3D View — drag to rotate</div>
  <div style={{ perspective: '800px', ... width: 280, height: 280 }}>
    ...
  </div>
</div>
```

Wrap the perspective `<div>` and the new `<AxisGizmo>` together in a flex row. Replace the inner structure with:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
  <div style={{
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--text-faint)',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  }}>
    3D View — drag to rotate
  </div>

  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div
      style={{
        perspective: '800px',
        perspectiveOrigin: '50% 50%',
        width: 280,
        height: 280,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={e => onDragStart(e.clientX, e.clientY)}
      onMouseMove={e => onDragMove(e.clientX, e.clientY)}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      onTouchStart={e => { const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); }}
      onTouchMove={e => { const t = e.touches[0]; if (t) onDragMove(t.clientX, t.clientY); }}
      onTouchEnd={onDragEnd}
    >
      <div
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
          width: 0,
          height: 0,
          position: 'relative',
        }}
      >
        {/* Layer outline frames */}
        {[0, 1, 2].map(layer => {
          const z = (layer - 1) * SPACING;
          const frameSize = 2 * SPACING + CUBE;
          return (
            <div
              key={`layer-frame-${layer}`}
              style={{
                position: 'absolute',
                width: frameSize,
                height: frameSize,
                border: '1px solid var(--cube-layer-border)',
                background: 'transparent',
                transform: `translate3d(${-frameSize / 2}px, ${-frameSize / 2}px, ${z}px)`,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
          );
        })}

        {/* Cubelets */}
        {[0, 1, 2].flatMap(layer =>
          [0, 1, 2].flatMap(row =>
            [0, 1, 2].map(col => {
              const globalIndex = layer * 9 + row * 3 + col;
              const cell = board[globalIndex] ?? null;
              const isWin = winCells?.includes(globalIndex) ?? false;
              const x = (col - 1) * SPACING;
              const y = (row - 1) * SPACING;
              const z = (layer - 1) * SPACING;
              return (
                <div
                  key={globalIndex}
                  style={{
                    position: 'absolute',
                    transformStyle: 'preserve-3d',
                    transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px)`,
                    pointerEvents: 'none',
                  }}
                >
                  <Cubelet cell={cell} isWin={isWin} symbolX={symbolX} symbolO={symbolO} />
                </div>
              );
            })
          )
        )}
      </div>
    </div>

    <AxisGizmo rotation={rotation} />
  </div>
</div>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/board/ThreeDBoard.tsx
git commit -m "feat: replace axis labels with gizmo and add layer outline frames"
```

---

## Task 5: Rename layer labels in the 2D panels

**Files:**
- Modify: `apps/web/src/components/board/ThreeDBoard.tsx` — line 16

Short, clear names match what the user sees in the 3D viz.

- [ ] **Step 1: Update `LAYER_LABELS`**

Find line 16:
```tsx
const LAYER_LABELS = ['Layer 1 (Top)', 'Layer 2 (Middle)', 'Layer 3 (Bottom)'];
```

Replace with:
```tsx
const LAYER_LABELS = ['Top', 'Middle', 'Bottom'];
```

- [ ] **Step 2: Verify TypeScript and build**

```bash
cd apps/web && npm run typecheck && npm run build
```

Expected: no errors, successful build.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/board/ThreeDBoard.tsx
git commit -m "fix: simplify 3D layer panel labels to Top / Middle / Bottom"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that implements it |
|-----------------|------------------------|
| Full solid colored blocks (X=red, O=blue) on all 6 faces | Task 2 |
| Symbol on all 6 faces | Task 2 |
| Separate axis gizmo next to cube, syncs with rotation | Tasks 3 & 4 |
| No more axis labels inside the 3D scene | Task 4 |
| Layer outline frames to visually link 2D panels to 3D | Task 4 |
| Light mode empty faces = white transparent | Task 1 |
| Dark mode empty faces = dark transparent | Task 1 |
| Edges (borders) visible in both modes | Task 1 |
| Layer labels renamed Top / Middle / Bottom | Task 5 |

All requirements covered. No gaps.

**Placeholder scan:** No TBDs, all code is complete and concrete.

**Type consistency:** `AxisGizmo` takes `rotation: { x: number; z: number }` in Task 3, and `ThreeDViz` passes `rotation={rotation}` from its `useState({ x: 60, z: -45 })` state — types match. `symbol` in Task 2 is verified non-null via `isOccupied && symbol` guard before rendering.
