# Puzzle Overhaul Design

**Date:** 2026-03-23
**Status:** Approved

## Overview

Complete overhaul of the tactictoe puzzle system. Goals:
- Replace trivial 1-move puzzles with genuinely interesting, harder positions
- Support multi-step linear puzzle sequences (player move → scripted opponent response → player move → ...)
- Support multiple equally valid solutions per step
- Add puzzle coverage for all 10 game variants (currently 4 are covered)
- Reach 100 total puzzles

## 1. Data Schema

### New Puzzle Format

```typescript
type Move =
  | { cellIndex: number }                                        // standard, vanishing, misere, gomoku
  | { boardIndex: number; cellIndex: number }                    // 3d, 4d, ultimate_ttt
  | { macroCell: number; microCell: number }                     // ultimate_3d
  | { cellIndex: number; symbol: 'X' | 'O' }                    // order_chaos
  | { type: 'place'; cellIndex: number }                         // tactic_toe (place)
  | { type: 'move_obstacle'; fromCell: number; toCell: number }  // tactic_toe (obstacle)

type SolutionStep = {
  moves: Move[]       // one or more equally valid player moves for this step
  response?: Move     // scripted opponent reply; omitted on the final step
}

type Puzzle = {
  id: string
  title: string
  description: string
  variant: VariantKey
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  player: 'X' | 'O'
  state: VariantState   // variant-specific board state (unchanged)
  solution: SolutionStep[]
}
```

### Key Rules

- `solution` is always an array of steps (even for single-move puzzles — one step, one or more moves).
- When `moves` has multiple entries, the solver accepts any of them as correct for that step.
- `response` applies the same scripted opponent move regardless of which valid player move was chosen.
- Single-move puzzle example:
  ```json
  "solution": [{ "moves": [{ "cellIndex": 8 }] }]
  ```
- Multi-move with alternatives:
  ```json
  "solution": [
    { "moves": [{ "cellIndex": 2 }, { "cellIndex": 6 }], "response": { "cellIndex": 4 } },
    { "moves": [{ "cellIndex": 8 }] }
  ]
  ```

### Migration

All 19 existing puzzles are replaced by the new 100-puzzle set. The old format (`"solution": { "boardIndex": ..., "cellIndex": ... }`) is removed entirely.

## 2. Solver UI (`/puzzles/[id]/page.tsx`)

### State additions

```
currentStep: number        // which step of the solution we're on (0-indexed)
boardState: VariantState   // mutable working copy of the puzzle state
feedback: 'correct' | 'wrong' | 'solved' | null
```

### Move flow

1. Player makes a move on the board.
2. Normalize the move into the canonical Move object for the variant.
3. Compare against `solution[currentStep].moves` — if any entry matches, it's correct.
4. **If wrong:** set `feedback = 'wrong'`, do not update board state.
5. **If correct:**
   - Apply player move to `boardState`.
   - If `solution[currentStep].response` exists: wait 400ms, apply response move to `boardState`.
   - Advance `currentStep`.
   - If `currentStep >= solution.length`: set `feedback = 'solved'`, persist to localStorage.
   - Else: set `feedback = 'correct'` briefly, then clear.

### UI elements

- **Step indicator:** shown only when `solution.length > 1`. Text: `"Step N of M"`. Positioned above the board.
- **Feedback banner:** same as current ("Correct!", "Not quite — try again.", "Solved ✓").
- **Board disabled:** after `feedback === 'solved'` (same as now).
- **"Next puzzle →"** button: shown after solved (same as now).

### Order & Chaos symbol picker

Order & Chaos moves require a symbol choice. Before a cell click is registered as a move, the player must pick X or O via a two-button toggle shown below the board description. The selected symbol is included in the move. Default selection is X.

### Tactic Toe state

TacticToeBoard uses `onCellClick` with external mode state. The solver manages:
- `tacticMoveMode: 'place' | 'move_obstacle'` (toggle button)
- `selectedObstacle: number | null`

This mirrors the pattern in `/app/local/page.tsx`.

### Vanishing TTT rendering

The `VanishingTTTState` includes `moveDates`. Before passing to `StandardBoard`, faded pieces (those placed more than 5 moves ago relative to total move count) are rendered as `null`, same as in `local/page.tsx`.

## 3. Board Renderer Integration

The solver's variant switch expands from 2 to 10 cases:

| Variant | Component | Notes |
|---|---|---|
| `standard_3x3` | `StandardBoard` | unchanged |
| `ultimate_ttt` | `UltimateBoard` | unchanged |
| `misere_ttt` | `StandardBoard` | same board shape |
| `gomoku` | `GomokuBoard` | existing component |
| `vanishing_ttt` | `StandardBoard` | faded pieces → null before render |
| `ttt_3d` | `ThreeDBoard` | `boardIndex` = layer |
| `ttt_4d` | `FourDBoard` | `boardIndex` = meta-grid pos |
| `order_chaos` | `GridBoard` (6×6) | + symbol picker UI |
| `tactic_toe` | `TacticToeBoard` | + mode/obstacle state |
| `ultimate_3d` | `Ultimate3DBoard` | `macroCell`/`microCell` move signature |

Move normalization per variant handles the different `onMove` signatures so the solver logic stays uniform.

## 4. Puzzle Content

### Distribution

10 puzzles per variant × 10 variants = 100 puzzles.

Difficulty per variant: **2 beginner, 4 intermediate, 3 advanced, 1 expert**.

Expert puzzles are multi-step (2–3 moves). Advanced puzzles may be single or multi-step. Beginner/intermediate are single-step.

### Content guidelines per variant

**standard_3x3**
Focus on forks, double threats, zugzwang-style positions. No more trivial "complete the row" puzzles. At least 3 puzzles should require finding a non-obvious winning move (e.g. a fork that doesn't immediately threaten a win).

**ultimate_ttt**
Emphasize constraint exploitation — sending the opponent to a won/drawn mini-board (giving them free choice) or forcing them into a losing mini-board. Multi-step puzzles should show 2-move meta-board wins.

**misere_ttt**
Positions where the instinctive "complete the line" move loses. Puzzles should test whether the player understands the reversed win condition. Include positions with 2-3 empty cells where every wrong move loses.

**gomoku (15×15)**
Focus on open-four threats (unblocked four in a row with open ends), double-threes, and 2-step forced wins. Positions should have enough opponent stones to make blocking decisions non-trivial.

**vanishing_ttt**
Positions where the correct move depends on knowing where invisible (faded) pieces are. The puzzle description hints at the hidden piece count. At least 4 puzzles should have an invisible piece as the deciding factor.

**3D TTT**
Tactics involving diagonal space lines (lines that traverse all 3 layers). Include positions where the winning line is non-obvious because it passes through 3 different layers.

**4D TTT**
Positions with multiple simultaneous 4D threats. Puzzles emphasize reading "hyperdiagonal" lines — lines that span all 4 dimensions simultaneously.

**order_chaos (6×6)**
Split between Order puzzles (build an unstoppable 5-in-a-row by choosing symbol strategically) and Chaos puzzles (identify the only move that permanently prevents any 5-in-a-row). Symbol choice is the key insight.

**tactic_toe**
Mix of place-to-win puzzles and obstacle-move puzzles. Obstacle-move puzzles: moving an obstacle to block an opponent's winning line or to open your own.

**ultimate_3d**
Focus on macro-board constraint exploitation (same meta-strategy as ultimate_ttt but in 3D space). Multi-step puzzles show 2-step macro-board captures.

## 5. Files Changed

| File | Change |
|---|---|
| `apps/web/src/data/puzzles.json` | Complete rewrite — 100 puzzles in new schema |
| `apps/web/src/app/puzzles/[id]/page.tsx` | Solver logic rewrite + 8 new board cases |
| `apps/web/src/app/puzzles/[id]/page.module.css` | Add step indicator styles + symbol picker styles |

No new files. No new board components (all exist). No schema type file needed — `puzzles.json` is consumed directly.
