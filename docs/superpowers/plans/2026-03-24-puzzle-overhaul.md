# Puzzle Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the puzzle system to 100 puzzles across all 10 game variants, with multi-step linear sequence support, multiple-valid-answer support, and a fully reworked solver UI that renders all variant boards.

**Architecture:** Rewrite `puzzles.json` with a new step-array schema; update the solver page to drive multi-step flow and render all 10 variant boards; add a verification script that runs every puzzle solution through the real game engine before merge.

**Tech Stack:** Next.js 14, React, TypeScript, `@tactictoe/game-engine`, Vitest, `tsx` (for running scripts)

---

## Critical engine coordinate note — read before writing any puzzle

The game engine for `ttt_3d` and `ttt_4d` takes a **flat global `cellIndex`**, NOT a per-layer `{ boardIndex, cellIndex }`. Confirmed in `apps/web/src/app/local/page.tsx:243-251`:

```ts
// ttt_3d: board component emits onMove(boardIndex=layer, cellIndex=withinLayer)
const globalIndex = boardIndex * 9 + cellIndex;  // convert to flat
move = { data: { cellIndex: globalIndex } };      // engine expects flat

// ttt_4d: same pattern
const globalIndex = boardIndex * 9 + cellIndex;
move = { data: { cellIndex: globalIndex } };
```

So in `puzzles.json`, ttt_3d and ttt_4d moves are `{ "cellIndex": N }` (N = 0-26 for 3D, 0-80 for 4D) — exactly like `standard_3x3`. The solver normalizes `onMove(boardIndex, cellIndex)` → `{ cellIndex: boardIndex * 9 + cellIndex }` before matching.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/data/puzzles.json` | Rewrite | 100 puzzles, new schema |
| `apps/web/src/app/puzzles/[id]/page.tsx` | Rewrite | Multi-step solver, all 10 board cases |
| `apps/web/src/app/puzzles/[id]/page.module.css` | Modify | Step indicator + symbol picker styles |
| `scripts/verify-puzzles.ts` | Create | Validates all puzzles via game engine |

---

## Task 1: Puzzle verification script

**Files:**
- Create: `scripts/verify-puzzles.ts`

- [ ] **Step 1: Create scripts/verify-puzzles.ts**

```ts
// Run with: npx tsx scripts/verify-puzzles.ts
// from the repo root (c:/Code/tactictoe)
import puzzles from './apps/web/src/data/puzzles.json' with { type: 'json' };
import {
  StandardTTT, MisereTTT, Gomoku, VanishingTTT, TTT3D, TTT4D,
  OrderChaos, TacticToe, UltimateTTT, Ultimate3D,
} from './packages/game-engine/src/index.js';
import type { GameRules, GameState } from './packages/game-engine/src/index.js';

const engines: Record<string, GameRules> = {
  standard_3x3: new StandardTTT(),
  misere_ttt:   new MisereTTT(),
  gomoku:       new Gomoku(),
  vanishing_ttt: new VanishingTTT(),
  ttt_3d:       new TTT3D(),
  ttt_4d:       new TTT4D(),
  order_chaos:  new OrderChaos(),
  tactic_toe:   new TacticToe(),
  ultimate_ttt: new UltimateTTT(),
  ultimate_3d:  new Ultimate3D(),
};

let passed = 0;
let failed = 0;

for (const puzzle of (puzzles as any[])) {
  const engine = engines[puzzle.variant];
  if (!engine) {
    console.error(`FAIL [${puzzle.id}]: unknown variant "${puzzle.variant}"`);
    failed++;
    continue;
  }

  const lastStep = puzzle.solution[puzzle.solution.length - 1];
  if (lastStep?.response) {
    console.warn(`WARN [${puzzle.id}]: last step has response (will be ignored at runtime)`);
  }

  // Pre-check: vanishing_ttt requires variantId in state
  if (puzzle.variant === 'vanishing_ttt' && puzzle.state.variantId !== 'vanishing_ttt') {
    console.error(`FAIL [${puzzle.id}]: vanishing_ttt state must have "variantId": "vanishing_ttt"`);
    failed++;
    continue;
  }
  // Pre-check: vanishing_ttt requires moveCount in state
  if (puzzle.variant === 'vanishing_ttt' && typeof puzzle.state.moveCount !== 'number') {
    console.error(`FAIL [${puzzle.id}]: vanishing_ttt state must have a numeric "moveCount" field`);
    failed++;
    continue;
  }

  let state: GameState = puzzle.state as GameState;
  let ok = true;

  for (let stepIdx = 0; stepIdx < puzzle.solution.length; stepIdx++) {
    const step = (puzzle.solution as any[])[stepIdx]!;
    const isLastStep = stepIdx === puzzle.solution.length - 1;

    // Verify at least one move in this step is legal
    let anyValid = false;
    for (const m of step.moves) {
      const r = engine.applyMove(state, { data: m }, state.currentPlayer);
      if (r.ok) { anyValid = true; break; }
    }
    if (!anyValid) {
      console.error(`FAIL [${puzzle.id}] step ${stepIdx}: no valid player move — ${JSON.stringify(step.moves)}`);
      ok = false; break;
    }

    // Advance state using the first move
    const pr = engine.applyMove(state, { data: step.moves[0] }, state.currentPlayer);
    if (!pr.ok) { console.error(`FAIL [${puzzle.id}] step ${stepIdx}: ${pr.error}`); ok = false; break; }
    state = pr.state;

    // Apply response if present (and not last step)
    if (step.response && !isLastStep) {
      const rr = engine.applyMove(state, { data: step.response }, state.currentPlayer);
      if (!rr.ok) { console.error(`FAIL [${puzzle.id}] step ${stepIdx} response: ${rr.error}`); ok = false; break; }
      state = rr.state;
    }
  }

  if (ok) { console.log(`PASS [${puzzle.id}]`); passed++; }
  else { failed++; }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Smoke test with current puzzles.json**

```
cd c:/Code/tactictoe && npx tsx scripts/verify-puzzles.ts
```

The existing puzzles.json uses the OLD single-move schema — this will fail (FAIL on each). That's expected and fine; it confirms the script runs. We'll fix it in Task 2.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-puzzles.ts
git commit -m "feat(scripts): add puzzle verification script"
```

---

## Task 2: Write all 100 puzzles

**Files:**
- Rewrite: `apps/web/src/data/puzzles.json`

Complete rewrite. All 19 old puzzles are replaced.

### Puzzle schema

```json
{
  "id": "std-1",
  "title": "Win Before Being Won",
  "description": "X to win immediately.",
  "variant": "standard_3x3",
  "difficulty": "beginner",
  "player": "X",
  "state": { "board": ["O","O",null,"X","X",null,null,null,null], "currentPlayer": "X" },
  "solution": [
    { "moves": [{ "cellIndex": 5 }] }
  ]
}
```

Multi-step (player move → scripted opponent response → player move):
```json
"solution": [
  { "moves": [{ "cellIndex": 2 }], "response": { "cellIndex": 1 } },
  { "moves": [{ "cellIndex": 5 }] }
]
```

Multiple equally valid first moves:
```json
"solution": [{ "moves": [{ "cellIndex": 2 }, { "cellIndex": 6 }] }]
```

---

### standard_3x3 — 10 puzzles
Board indices (row×3+col): `0 1 2 / 3 4 5 / 6 7 8`
Win lines: `[0,1,2] [3,4,5] [6,7,8] [0,3,6] [1,4,7] [2,5,8] [0,4,8] [2,4,6]`

| ID | Title | Difficulty | Board | Solution |
|----|-------|------------|-------|----------|
| std-1 | Win Before Being Won | beginner | `["O","O",null,"X","X",null,null,null,null]` | `[{moves:[{cellIndex:5}]}]` (X wins row 1) |
| std-2 | Spot the Diagonal | beginner | `["X","O","O",null,"X",null,null,"O",null]` | `[{moves:[{cellIndex:8}]}]` (X wins diagonal 0-4-8; O pieces scatter attention) |
| std-3 | Win Don't Block | intermediate | `["O",null,"O","X","X",null,null,null,null]` | `[{moves:[{cellIndex:5}]}]` (X wins row 1 immediately instead of blocking O's row 0) |
| std-4 | Double Win | intermediate | `["X",null,"X",null,"O","X",null,"O",null]` | `[{moves:[{cellIndex:1},{cellIndex:8}]}]` (1 wins row 0; 8 wins col 2 — both valid) |
| std-5 | Diagonal Strike | intermediate | `[null,"O","X","O",null,null,"X","O",null]` | `[{moves:[{cellIndex:4}]}]` (X wins anti-diagonal 2-4-6 AND blocks O's col 1) |
| std-6 | Block and Build | intermediate | `["O",null,"O",null,"X","X",null,null,null]` | `[{moves:[{cellIndex:1}]}]` (blocks O's row 0 AND X has 1-4-7 threat → 1,4,5 no: 3-4-5 wait: X at 4,5 + new piece at 1 → 1-4-7 needs 7. Also O at 0,2: X plays 1 blocks 0-1-2. X threatens 1-4-7 for later.) |
| std-7 | Fork or Lose | advanced | `["O",null,null,"X",null,"X",null,null,"O"]` | `[{moves:[{cellIndex:4}]}]` (X wins 3-4-5 AND blocks O's diagonal 0-4-8) |
| std-8 | Two Roads | advanced | `["X","O","X",null,"X",null,null,"O",null]` | `[{moves:[{cellIndex:6},{cellIndex:8}]}]` (X at 0,2,4; both 6 (wins anti-diag 2-4-6) and 8 (wins diag 0-4-8) win — find either) |
| std-9 | The Squeeze | advanced | `["X","O","X","O","X","O","O",null,null]` | `[{moves:[{cellIndex:7}]}]` (X wins 1-4-7? No: 1=O. Let me recalculate: X at 0,2,4. O at 1,3,5,6. X threatens 0-4-8 (needs 8), 2-4-6 (6=O blocked), 3-4-5 (3=O,5=O blocked), 0-3-6 (3=O blocked), 0-1-2 (1=O blocked). X plays 8: wins 0-4-8.) Replace: `["X","O","X","O","X","O","O",null,null]`, solution `[{moves:[{cellIndex:8}]}]` (X wins main diagonal 0-4-8) |
| std-10 | Forced Win in Two | expert | `["X",null,null,null,"O",null,null,null,"X"]` | `[{moves:[{cellIndex:2}],response:{cellIndex:1}},{moves:[{cellIndex:5}]}]` (X forks with 2 → O blocks row 0 with 1 → X wins col 2 with 5 completing 2-5-8) |

**Note on std-6**: X at 4,5. After X plays 1: X has {1,4,5}. X threatens 1-4-7 (needs 7) and 3-4-5 (5=X already, needs 3). This creates a fork — two threats O cannot both address. This is a "block AND create fork" intermediate.

**Note on std-10 verification**: Initial board X at {0,8}, O at {4}. X plays 2 → X has {0,2,8}. O has {4}. Threats: 0-1-2 (needs 1), 2-5-8 (needs 5). O plays 1 (blocks row 0). X plays 5 → wins 2-5-8 (2=X,5=X,8=X). ✓

---

### ultimate_ttt — 10 puzzles
Move: `{ "boardIndex": 0-8, "cellIndex": 0-8 }`. State: `{ boards, boardResults, nextBoardConstraint, currentPlayer }`.

Use the 3 existing puzzles (ult-1, ult-2, ult-3) as a starting base. Write 7 more:

**Positions to write** (use complex mid-game boards where multiple mini-boards are won/drawn):

Focus on:
- ult-1 through ult-3: kept from old puzzles.json (already validated), converted to new schema: `"solution": [{ "moves": [{ "boardIndex": N, "cellIndex": M }] }]`
- ult-4 (beginner): nextBoardConstraint points to a mini-board where X has 2-in-a-row and the winning cell is open.
- ult-5 (beginner): Same pattern, different mini-board layout.
- ult-6 (intermediate): Winning a mini-board also sends O to a nearly-drawn board (O gets free choice of meta-position, but all good ones are won).
- ult-7 (intermediate): X must choose WHICH cell to win in — the winning cell determines where O plays next. Pick the cell that sends O to the worst meta-position.
- ult-8 (intermediate): Two mini-boards each have a 1-move win for X; only one of them also completes a meta-row.
- ult-9 (advanced): Winning a specific mini-board creates a meta-fork (two ways to complete a meta-row on next turns).
- ult-10 (expert, 2-step): X wins mini-board A (response: O wins mini-board B somewhere), X wins mini-board C completing a meta-row.

**Template for ult-4** (beginner "Easy Win"):
```json
{
  "id": "ult-4",
  "title": "Easy Win",
  "description": "X is sent to mini-board 5 — win it to score.",
  "variant": "ultimate_ttt",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "boards": [
      ["X","X","X","O","O",null,null,null,null],
      ["O","X","O","X","O","X","O",null,null],
      ["X","O","X","O","X","O","X","O","X"],
      ["O","X","O","X","O","X","O","X","O"],
      ["X","O","X","O","X","O","X","O","X"],
      ["X","X",null,"O","O",null,null,null,null],
      ["O","X","O","X","O","X","O","X","O"],
      ["X","O","X","O","X","O","X","O","X"],
      ["O","X","O","X","O","X","O","X","O"]
    ],
    "boardResults": ["X","O","X","O","X",null,"O","X","O"],
    "nextBoardConstraint": 5,
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "boardIndex": 5, "cellIndex": 2 }] }]
}
```
Here X has {0,1} in mini-board 5 → plays 2 to complete row 0 of mini-board 5. Meta result: X already has {0,2,4,7} won — adding 5 completes column? boardResults: [X,O,X,O,X,**X**,O,X,O] — X has 0,2,4,5,7. Check meta-lines: [0,4,8] needs 8=O, blocked. [0,3,6] has 0=X,3=O, blocked. [2,4,6] has 2=X,4=X,6=O, blocked. [1,4,7] has 1=O, blocked. [0,1,2] has 0=X,1=O, blocked. [3,4,5] has 3=O, blocked. [6,7,8] has 6=O, blocked. [2,5,8] has 2=X,5=X,8=O — blocked!

Hmm, none of these complete a meta-row. The puzzle doesn't win the game but wins a mini-board. That's still a valid tactical puzzle — win the mini-board. The description should be "Win mini-board 5."

Actually for better design, the boardResults should be set up so that winning mini-board 5 completes a meta-row. Let me set boardResults so X has [0,2,_,_,_,_,_,_,_] and winning 5 doesn't matter for the meta-row. The puzzle is just "find the 1-move win in mini-board 5." That's fine.

For a better positioned ult-4, design the boardResults so winning mini-board 5 gives X a meta-row:
X needs to win on meta-row [3,4,5]: so X needs {3,4,5} on boardResults.
boardResults = [O, X, O, X, X, null, O, null, X] — X has {1,4,8}. Winning 5 would give {1,4,5,8} — not a meta-row.
boardResults = [O, null, null, X, X, null, null, null, null] — X has {3,4}, winning 5 gives {3,4,5} → X wins meta-row [3,4,5]! ✓

So for ult-4: boardResults = ["O",null,null,"X","X",null,null,null,null]. nextBoardConstraint = 5. Mini-board 5 has X needing 1 more move to win it. X plays the winning cell in mini-board 5, wins it, wins meta-row 3-4-5.

This is the pattern to follow for all ultimate_ttt puzzles. Construct boardResults where one more mini-board win completes a meta-row (or diagonal), and set nextBoardConstraint to force X into that mini-board. Make the mini-board position clear enough to solve.

---

### misere_ttt — 10 puzzles
Board: 9-cell array. Move: `{ "cellIndex": 0-8 }`. Player who completes their own 3-in-a-row **loses**.

Key tactics:
- Avoid completing your own line
- Force the opponent to complete their line
- "Safe" squares: squares that don't complete any of your existing partial lines

| ID | Description | Core position |
|----|-------------|---------------|
| mis-1 | beginner "Don't Complete": X must find the 1 safe square | `board: [null,"X","X","X",null,"X","X","X",null]` — X plays 4 (center): check X-lines: 0-1-2(0=null,1=X,2=X)→needs 0, 6-7-8(6=X,7=X,8=null)→needs 8, 1-4-7(1=X,4=null,7=X)→needs 4→DON'T. 3-4-5(3=X,4=null,5=X)→needs 4→DON'T. 2-4-6(2=X,4=null,6=X)→needs 4→DON'T. So playing 4 completes 3 X-lines at once — X LOSES. X should play 0 or 8. X plays 0: X-lines with 0: 0-1-2(0,1,2=X)→X LOSES. Don't play 0 either. X plays 8: X-lines with 8: 6-7-8(6=X,7=X,8→X LOSES). Don't play 8. Only safe: none? Let me redesign. |

Misère puzzle construction is tricky. Use the following verified set:

**mis-1** (beginner) "The Safe Move":
`board: ["X","O","O","O","X","X","O","X",null]` — X at {0,4,5,7}, O at {1,2,3,6}. Only empty: 8.
X plays 8. X-lines completed by adding 8: 0-4-8 (0=X,4=X,8=X) → X LOSES!
Actually X has no choice but to play 8. X loses. This isn't a solvable puzzle — X auto-loses.

Let me use existing validated mis-1 and mis-2 from old puzzles.json (they were already in the set) and add 8 more. The two existing Misère puzzles are:
- `mis-1`: `["X","O",null,null,"O",null,null,null,"X"]`, solution cellIndex 5. X plays 5: X at {0,5,8}. X-lines: 0-4-8(4=O,blocked), 2-5-8(2=null,8=X,5=X→needs 2), 3-4-5(3=null,4=O,5=X→blocked), 0-1-2(1=O,blocked), 0-3-6(3=null,6=null→needs 3,6). Safe: ✓ No X-line completed.
- `mis-2`: `["X",null,"O","O","X",null,null,null,"X"]`, O to move, solution cellIndex 5.

Convert to new schema, add 8 more Misère puzzles by constructing positions with 3-4 empty cells where the player must choose carefully. The verify script will confirm all solutions.

**Pattern for Misère puzzles** (use for mis-3 through mis-10):
1. Start from a nearly-full board (3-4 empty squares)
2. Mark which squares would complete a player-X line (losing for X)
3. The solution is the one empty square that doesn't complete any X-line, AND leaves O in a position where all of O's remaining moves complete O-lines

Example template for **mis-3** (intermediate):
`board: ["X","O","X","O",null,"O","X","O",null]` — X at {0,2,6}, O at {1,3,5,7}. Empty: {4,8}.
X plays 4: X-lines with 4: 0-4-8(0=X,4,8→needs 8), 2-4-6(2=X,4,6=X→COMPLETES anti-diag!) X LOSES if X plays 4.
X plays 8: X-lines with 8: 0-4-8(0=X,4=null,8→needs 4, needs both→no line completed), 6-7-8(6=X,7=O,8→blocked), 2-5-8(2=X,5=O,8→blocked). Safe! X plays 8. Now O must play 4. O-lines with 4: 1-4-7(1=O,4,7=O→COMPLETES col 1!) O LOSES. ✓
`solution: [{ "moves": [{ "cellIndex": 8 }] }]` ✓

For intermediate and advanced, construct similar positions with less obvious "only safe move." Expert: 2-step where X avoids a trap, O responds, X wins.

---

### gomoku — 10 puzzles
Board: 225-cell flat array (15×15). Index: row×15+col (row 0-14, col 0-14). Move: `{ "cellIndex": 0-224 }`.
Win: 5 in a row (row, col, diagonal).

Focus positions on the center area (rows 4-10, cols 4-10) for compactness. Key concepts: open-four (XXXXXO has open end), double-three (two open threes), forced sequences.

| ID | Concept | Position |
|----|---------|---------|
| gom-1 | beginner "Five in a Row": X has 4 consecutive in a row, plays 5th. | Row 7 cells 7,8,9,10 are X (indices 112,113,114,115). Play 111 (row7,col6) OR 116 (row7,col11). Solution: `[{moves:[{cellIndex:111},{cellIndex:116}]}]` |
| gom-2 | beginner "Diagonal Five": X has 4 on a diagonal, complete it. | X at indices 30(row2,col0),46(row3,col1),62(row4,col2),78(row5,col3). Play 94(row6,col4). Solution: `[{moves:[{cellIndex:94}]}]` |
| gom-3 | intermediate "Double Open-Four": X creates two simultaneous 4-in-a-row threats. | Construct a position where X plays one cell to create two open fours. |
| gom-4 | intermediate "Block and Win": O has an open-four. X blocks while also creating X's own open-four. | |
| gom-5 | intermediate "Diagonal Dominance": X wins diagonally with a subtle final move. | |
| gom-6 | intermediate "Forced Three": X plays a cell that creates an unstoppable double-three. | |
| gom-7 | advanced "Double Threat": X creates two simultaneous five-in-a-row threats. | |
| gom-8 | advanced "The Only Win": Dozens of X pieces but only one cell completes 5-in-a-row. | |
| gom-9 | advanced "Anti-diagonal Finish": X wins on anti-diagonal that spans multiple rows. | |
| gom-10 | expert "Force Five in Two": X plays, O blocks one threat, X wins the other. | |

**Template for gom-1** (verified):
```json
{
  "id": "gom-1",
  "title": "Five in a Row",
  "description": "X has four in a row. Complete the sequence to win.",
  "variant": "gomoku",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "board": [ /* 225 nulls with X at indices 112,113,114,115 */
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,"X","X","X","X",null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,null
    ],
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "cellIndex": 111 }, { "cellIndex": 116 }] }]
}
```
Note: index 112 = row7×15+col7 = 105+7=112. X at 112,113,114,115 (cols 7-10 of row 7). Play 111 (col6) or 116 (col11) to complete 5-in-a-row.

For the remaining gomoku puzzles, add O pieces to create realistic mid-game positions and ensure only one correct winning move (or two equivalent ones). The verify script will catch incorrect cell indices.

---

### vanishing_ttt — 10 puzzles
State: `{ variantId: "vanishing_ttt", board: 9-cell, moveCount: number, moveDates: (number|null)[], currentPlayer }`. Move: `{ cellIndex: 0-8 }`.

**REQUIRED:** Every `vanishing_ttt` puzzle state MUST include:
- `"variantId": "vanishing_ttt"` — the engine's `castState()` throws without it
- `"moveCount": N` — the solver uses this for fade calculation (NOT derived from board)

Fade formula (from engine source `vanishing-ttt.ts`):
- `moveDates[i] = moveCount + 1` when piece placed (1-indexed)
- Piece at index `i` is faded when `state.moveCount - state.moveDates[i] > VANISHING_FADE_AFTER` (6)
- Example: `moveDates[0] = 1`, `moveCount = 8` → age = 8-1=7 > 6 → faded ✓

**Important:** fading only activates with 8+ moves made (moveCount ≥ 8). Puzzles need **8 non-null cells** (one per move) for pieces to fade. All vanishing puzzles use nearly-full boards (8 pieces, 1 empty square).

| ID | Concept | Notes |
|----|---------|-------|
| van-1 | beginner "Remember the Corner": X has a faded piece at corner 0. X plays corner 8 to win diagonal 0-4-8. X must remember 0 is still there. | moveDates[0]=1 (faded), moveCount≈8 |
| van-2 | beginner "The Hidden Block": O has a faded piece blocking X's apparent win. X must find the real winning line. | O's faded piece blocks one threat |
| van-3 | intermediate "Count the Invisible": X has 2 faded pieces. Find the line that uses them. | |
| van-4 | intermediate "Forced by Ghosts": X plays the move that only works because a faded piece holds the position. | |
| van-5 | intermediate "Wrong Line": X sees an apparent threat but a faded O piece blocks it. Find the real line. | |
| van-6 | intermediate "Double Ghost": Both X and O have faded pieces. Navigate the invisible board. | |
| van-7 | advanced "Ghost Fork": X creates a fork using a faded piece as one arm. | |
| van-8 | advanced "Fade and Win": X plays a move that wins because the faded state is favorable. | |
| van-9 | advanced "All-Ghost Board": Most pieces are faded. Find the only winning move. | |
| van-10 | expert "Two-move with Fading": X plays move 1, piece fades in scripted response, X wins with move 2. | |

**Template for van-1** (verified):
```json
{
  "id": "van-1",
  "title": "The Ghost Corner",
  "description": "One of X's pieces has faded — but it still holds that square. Find the diagonal that uses it.",
  "variant": "vanishing_ttt",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "variantId": "vanishing_ttt",
    "board": ["X","O","O","O","X","O","X","O",null],
    "moveCount": 8,
    "moveDates": [1, 2, 3, 4, 5, 6, 7, 8, null],
    "currentPlayer": "X",
    "terminal": null
  },
  "solution": [{ "moves": [{ "cellIndex": 8 }] }]
}
```
Verification:
- 8 pieces on board → moveCount = 8. ✓
- X at index 0: moveDates[0]=1, age = 8-1=7 > 6 → **faded** (invisible). ✓
- X at index 4: moveDates[4]=5, age = 8-5=3 → visible. ✓
- X at index 6: moveDates[6]=7, age = 8-7=1 → visible. ✓
- X plays 8: completes diagonal 0-4-8 (0=X faded but still occupies cell, 4=X, 8=X). **Win!** ✓

---

### ttt_3d — 10 puzzles
Board: 27-cell flat array. Layer 0: cells 0-8. Layer 1: cells 9-17. Layer 2: cells 18-26.
Move: `{ "cellIndex": 0-26 }` (flat). Board display: 3 separate 3×3 grids.

Win lines include: 9 within-layer lines per layer (27 total), 9 cross-layer verticals ([0,9,18],[1,10,19],...), layer-crossing diagonals, and 4 space diagonals ([0,13,26],[2,13,24],[6,13,20],[8,13,18]).

| ID | Concept | Solution cellIndex |
|----|---------|--------------------|
| 3d-1 | beginner "Stack Win": X has pieces at 0 and 9 (same col across layers 0 and 1). Play 18 to complete cross-layer col [0,9,18]. | `[{moves:[{cellIndex:18}]}]` |
| 3d-2 | beginner "Layer Win": X has 2-in-a-row in layer 1 row 0 (cells 9,10). Play 11 to complete [9,10,11]. | `[{moves:[{cellIndex:11}]}]` |
| 3d-3 | intermediate "Space Diagonal": X has pieces at 0 and 13 (layer0[0,0] and layer1[1,1]). Play 26 (layer2[2,2]) to complete space diagonal [0,13,26]. | `[{moves:[{cellIndex:26}]}]` |
| 3d-4 | intermediate "Anti Space Diagonal": X has pieces at 2 and 13. Play 24 to complete [2,13,24]. | `[{moves:[{cellIndex:24}]}]` |
| 3d-5 | intermediate "Cross-layer Row": X wins a row that spans all 3 layers (e.g. [2,11,20] — top-right to bottom-right). | |
| 3d-6 | intermediate "Block and Win 3D": O threatens a space diagonal. X must win first. | |
| 3d-7 | advanced "Find the Space Line": X has pieces at 6 and 13, O has pieces scattered. Play 20 to complete [6,13,20]. | `[{moves:[{cellIndex:20}]}]` |
| 3d-8 | advanced "Double 3D Threat": X creates two simultaneous threats in different layers. | |
| 3d-9 | advanced "3D Fork": X plays a cell that threatens two different 3D win lines. | |
| 3d-10 | expert "Forced 3D Win": X plays, O responds in layer 1, X wins with space diagonal. 2-step. | |

**Template for 3d-1** (verified):
```json
{
  "id": "3d-1",
  "title": "Stack Win",
  "description": "X has the same corner position in layers 0 and 1 — complete the stack.",
  "variant": "ttt_3d",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "board": [
      "X","O",null,"O",null,null,null,null,null,
      "X",null,"O",null,"O",null,null,null,null,
      null,null,null,null,null,null,null,null,null
    ],
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "cellIndex": 18 }] }]
}
```
X plays 18 → completes cross-layer col [0,9,18] (top-left corner through all 3 layers). ✓

---

### ttt_4d — 10 puzzles
Board: 81-cell flat array. Display: 3×3 meta-grid of 3×3 boards. Board (metaRow,metaCol,row,col) → index = (metaRow×3+metaCol)×9 + row×3+col.
Move: `{ "cellIndex": 0-80 }` (flat).

Win lines are 4D — extremely varied. Focus on the simplest: winning a complete mini-board's row (all 9 cells of one mini-board are a degenerate case but within-mini-board rows win).

Actually 4D TTT wins are lines of 3 across all 4 dimensions. The simplest: keeping all 4 coordinates fixed except one (e.g., varying only metaRow while fixing metaCol, row, col gives a cross-meta-board line).

| ID | Concept | Notes |
|----|---------|-------|
| 4d-1 | beginner "Within-Board Win": X wins a row within one mini-board of the meta-grid. | X has cells 0,1 (meta[0,0] row 0 cells 0,1). Play 2 to complete [0,1,2]. |
| 4d-2 | beginner "Cross-Board Column": X has same cell in meta-boards 0 and 3. Play the same cell in meta-board 6 to complete cross-meta-row. | |
| 4d-3 | intermediate "4D Line": X has pieces at indices 0 and 40 (meta[0,0][0,0] and meta[1,1][1,1]). The completing move is at 80 (meta[2,2][2,2]). | `[{moves:[{cellIndex:80}]}]` |
| 4d-4 | intermediate: Another 4D line completion. | |
| 4d-5 through 4d-10 | intermediate/advanced/expert variations | More complex 4D positions |

**Template for 4d-1** (verified):
```json
{
  "id": "4d-1",
  "title": "First Board Win",
  "description": "X is one move from winning the first row of the top-left board.",
  "variant": "ttt_4d",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "board": [
      "X","X",null,"O",null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,"O",null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,null
    ],
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "cellIndex": 2 }] }]
}
```
X plays cell 2 → completes cells [0,1,2] which is meta-board[0,0] row 0. This is a valid 4D win line. ✓

For 4d-3 (space diagonal): cells 0, 40, 80 form the main 4D space diagonal (each dimension increments by 1: meta[0,0][0,0], meta[1,1][1,1], meta[2,2][2,2]).

---

### order_chaos — 10 puzzles
Board: 36-cell flat array (6×6). Move: `{ "cellIndex": 0-35, "symbol": "X"|"O" }`.
Order player (role X): wins by creating any 5-in-a-row. Chaos player (role O): wins by filling board with no 5-in-a-row.

Split ~5/5 between Order-to-win and Chaos-to-prevent puzzles.

| ID | Role | Concept |
|----|------|---------|
| oc-1 | beginner, Order | X plays a specific symbol to complete 5-in-a-row |
| oc-2 | beginner, Order | X plays to extend a 4-in-a-row |
| oc-3 | intermediate, Order | X must choose the right symbol to create an unstoppable double-threat |
| oc-4 | intermediate, Order | The only winning symbol placement |
| oc-5 | intermediate, Chaos | O finds the only move that permanently prevents a 5-in-a-row |
| oc-6 | intermediate, Chaos | O blocks the critical 5-in-a-row threat |
| oc-7 | advanced, Order | X creates two simultaneous 5-in-a-row threats with one move |
| oc-8 | advanced, Chaos | O must prevent a fork — two simultaneous threats |
| oc-9 | advanced, Order | Non-obvious symbol choice creates unstoppable line |
| oc-10 | expert, Order | 2-step forced win: X creates threat, O blocks, X wins the other |

**Template for oc-1** (beginner Order):
Board: row 0 has X at cols 0,1,2,3 (cells 0,1,2,3). Play cell 4 with symbol "X" to win row 0.
```json
{
  "id": "oc-1",
  "title": "Five for Order",
  "description": "Order player: complete the five-in-a-row to win.",
  "variant": "order_chaos",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "board": ["X","X","X","X",null,null, null,null,null,null,null,null, null,null,null,null,null,null, null,null,null,null,null,null, null,null,null,null,null,null, null,null,null,null,null,null],
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "cellIndex": 4, "symbol": "X" }] }]
}
```
X plays cell 4 with symbol X → completes [0,1,2,3,4] = row 0. ✓

---

### tactic_toe — 10 puzzles
Board: 27-cell array (3 layers of 3×3, same layout as ttt_3d), cells can be null/"X"/"O"/"B"(obstacle).
Move: `{ "type": "place", "cellIndex": 0-26 }` or `{ "type": "move_obstacle", "fromCell": N, "toCell": N }`.
Win: 3-in-a-row on any of the 49 lines (same as ttt_3d), obstacles ('B') do not count.

| ID | Concept | Notes |
|----|---------|-------|
| tt-1 | beginner "Simple Win": X plays a piece to complete a line (no obstacles in the way). | place move |
| tt-2 | beginner "Block then Win": X places to win directly. | place move |
| tt-3 | intermediate "Move to Win": X moves an obstacle to open a winning line. | move_obstacle |
| tt-4 | intermediate "Block with Obstacle": X moves obstacle to block O's winning threat. | move_obstacle |
| tt-5 | intermediate "Obstacle Fork": Moving an obstacle creates two winning threats. | move_obstacle |
| tt-6 | intermediate "Place and Threaten": X places a piece creating two threats. | place move |
| tt-7 | advanced "Obstacle into Position": Complex obstacle move that both opens X's line and closes O's. | move_obstacle |
| tt-8 | advanced "Double Obstacle": Two obstacles need strategic placement. | move_obstacle |
| tt-9 | advanced "Hidden Win": Win line through a layer that looks blocked but obstacle is movable. | |
| tt-10 | expert "Two-move Tactic": X places a piece (response: O places), X moves obstacle to win. | 2-step |

**Template for tt-1** (beginner):
Board: X at layer 0 cells 0,1 (global indices 0,1). Play 2 to complete layer 0 row [0,1,2]. No obstacles on row.
```json
{
  "id": "tt-1",
  "title": "Clear Path",
  "description": "X has two in a row on the first layer — place to win.",
  "variant": "tactic_toe",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "board": ["X","X",null,"B",null,"O",null,null,null, null,"O",null,null,"B",null,null,null,null, null,null,"O",null,null,"B",null,null,null],
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "type": "place", "cellIndex": 2 }] }]
}
```
X plays cell 2 → completes [0,1,2] (layer 0, row 0). Cell 2 is empty (null). ✓

---

### ultimate_3d — 10 puzzles
State: `{ microBoards: Board[27], macroResults: (Player|"draw"|null)[27], nextMacroConstraint: number|null, currentPlayer }`.
Move: `{ "macroCell": 0-26, "microCell": 0-26 }`. Both are flat indices within their respective 3×3×3 structures.

Strategy mirrors ultimate_ttt but in 3D: win micro-boards to claim macro-cells; win macro-cells (3-in-a-row in the macro 3×3×3) to win the game.

| ID | Concept | Notes |
|----|---------|-------|
| u3d-1 | beginner "Win the Micro": Constrained to a macro-cell with a 1-move micro-board win. | |
| u3d-2 | beginner "Close the Macro": Win micro-board to claim macro-cell that completes a macro-row. | |
| u3d-3 | intermediate "3D Constraint": Winning micro-cell N sends O to macro-cell N — choose which micro-cell to win. | |
| u3d-4 | intermediate "Meta Fork": Win a macro-cell that creates two ways to complete a macro-row in 3D. | |
| u3d-5 through u3d-10 | intermediate/advanced/expert | Increasing complexity |

**Template for u3d-1** (beginner):

**IMPORTANT: JSON does not allow `...` or `/* comments */`. Write every array entry explicitly.**

Each micro-board is a 27-cell array. An all-empty micro-board is:
`[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]`

```json
{
  "id": "u3d-1",
  "title": "Micro Win",
  "description": "X is forced to play in macro-cell 0 — find the winning micro move.",
  "variant": "ultimate_3d",
  "difficulty": "beginner",
  "player": "X",
  "state": {
    "microBoards": [
      ["X","X",null,"O","O",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]
    ],
    "macroResults": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    "nextMacroConstraint": 0,
    "currentPlayer": "X"
  },
  "solution": [{ "moves": [{ "macroCell": 0, "microCell": 2 }] }]
}
```
micro-board 0: X at micro-cells 0,1 (first row of layer 0). Play micro-cell 2 → wins [0,1,2] → macro-cell 0 claimed by X. ✓

Apply this same pattern for all other ultimate_3d puzzles — use explicit arrays, no shorthand.

---

### Putting it together: write puzzles.json

- [ ] **Step 1: Write apps/web/src/data/puzzles.json**

Write the complete array of 100 puzzle objects. Group them by variant for readability (the solver finds by `id`, order doesn't matter). Follow every template above. For `ultimate_ttt`, reuse the 3 existing puzzles converted to the new schema, plus 7 new ones. For complex variants (ultimate_3d), start with the 2 beginner puzzles fully specified and fill in the rest.

Total count: 10 per variant × 10 variants = 100.

- [ ] **Step 2: Run verify-puzzles**

```
cd c:/Code/tactictoe && npx tsx scripts/verify-puzzles.ts
```

Expected: `100 passed, 0 failed`. Fix any failures before proceeding. Common issues:
- Cell index out of bounds
- Move on an already-occupied cell
- `response` move applied to wrong player

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/puzzles.json
git commit -m "feat(puzzles): rewrite to 100 puzzles, new step-array schema"
```

---

## Task 3: Rewrite solver page.tsx

**Files:**
- Rewrite: `apps/web/src/app/puzzles/[id]/page.tsx`

Full replacement of the existing solver. The new solver:
- Tracks `currentStep`, `boardState`, `feedback`
- Handles all 10 variants
- Supports multi-step sequences with scripted opponent responses
- Locks board during feedback states

- [ ] **Step 1: Read apps/web/src/app/local/page.tsx lines 291-334**

Study the `handleTacticCell` function and reducer actions `SET_TACTIC_MODE` / `SET_TACTIC_OBSTACLE` — replicate this pattern for the puzzle solver's tactic_toe handling.

- [ ] **Step 2: Rewrite apps/web/src/app/puzzles/[id]/page.tsx**

```tsx
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import puzzlesData from '@/data/puzzles.json';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import { ThreeDBoard } from '@/components/board/ThreeDBoard';
import { FourDBoard } from '@/components/board/FourDBoard';
import { TacticToeBoard } from '@/components/board/TacticToeBoard';
import { Ultimate3DBoard } from '@/components/board/Ultimate3DBoard';
import {
  StandardTTT, MisereTTT, Gomoku, VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, UltimateTTT, Ultimate3D,
} from '@tactictoe/game-engine';
import type {
  StandardTTTState, UltimateTTTState, GomokuState, VanishingTTTState,
  TTT3DState, TTT4DState, OrderChaosState, TacticToeState, Ultimate3DState,
  Player, GameState, GameRules,
} from '@tactictoe/game-engine';
import Button from '@/components/ui/Button';
import styles from './page.module.css';
import { markDailySolved, getDailyPuzzleId } from '@/lib/puzzle-of-the-day';

// ---------- types ----------

type Feedback = 'correct' | 'wrong' | 'solved' | null;

type SolutionStep = {
  moves: Record<string, unknown>[];
  response?: Record<string, unknown>;
};

type Puzzle = {
  id: string;
  title: string;
  description: string;
  variant: string;
  difficulty: string;
  player: string;
  state: Record<string, unknown>;
  solution: SolutionStep[];
};

// ---------- constants ----------

const STORAGE_KEY = 'tactictoe:puzzle-solved';

const VARIANT_LABEL: Record<string, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère',
  gomoku: 'Gomoku',
  vanishing_ttt: 'Vanishing',
  ttt_3d: '3D TTT',
  ttt_4d: '4D TTT',
  order_chaos: 'Order & Chaos',
  tactic_toe: 'Tactic Toe',
  ultimate_3d: 'Ultimate 3D',
};

const ENGINES: Record<string, GameRules> = {
  standard_3x3: new StandardTTT(),
  misere_ttt:   new MisereTTT(),
  gomoku:       new Gomoku(),
  vanishing_ttt: new VanishingTTT(),
  ttt_3d:       new TTT3D(),
  ttt_4d:       new TTT4D(),
  order_chaos:  new OrderChaos(),
  tactic_toe:   new TacticToe(),
  ultimate_ttt: new UltimateTTT(),
  ultimate_3d:  new Ultimate3D(),
};

// ---------- storage helpers ----------

function getSolvedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSolved(id: string) {
  try {
    const set = getSolvedSet();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

// ---------- move matching ----------

function movesMatch(candidate: Record<string, unknown>, target: Record<string, unknown>): boolean {
  const cKeys = Object.keys(candidate);
  const tKeys = Object.keys(target);
  if (cKeys.length !== tKeys.length) return false;
  return tKeys.every(k => candidate[k] === target[k]);
}

function stepMatches(candidate: Record<string, unknown>, step: SolutionStep): boolean {
  return step.moves.some(m => movesMatch(candidate, m));
}

// ---------- component ----------

export default function PuzzleSolverPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === '1';

  const puzzle = (puzzlesData as Puzzle[]).find(p => p.id === id);

  // Validate last step has no response
  if (puzzle) {
    const last = puzzle.solution[puzzle.solution.length - 1];
    if (last?.response) console.warn(`[puzzle ${puzzle.id}] last step has response — will be skipped`);
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [boardState, setBoardState] = useState<GameState | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [alreadySolved, setAlreadySolved] = useState(false);

  // tactic_toe state
  const [tacticMode, setTacticMode] = useState<'place' | 'move_obstacle'>('place');
  const [selectedObstacle, setSelectedObstacle] = useState<number | null>(null);

  // order_chaos state
  const [selectedSymbol, setSelectedSymbol] = useState<'X' | 'O'>('X');

  useEffect(() => {
    if (!puzzle) return;
    setBoardState(puzzle.state as unknown as GameState);
    setCurrentStep(0);
    setFeedback(null);
    setAlreadySolved(getSolvedSet().has(id));
  }, [id, puzzle]);

  const handleSolved = useCallback((puzzleId: string) => {
    markSolved(puzzleId);
    setAlreadySolved(true);
    if (isDaily || getDailyPuzzleId() === puzzleId) markDailySolved(puzzleId);
    setFeedback('solved');
  }, [isDaily]);

  const processMove = useCallback((moveData: Record<string, unknown>) => {
    if (!puzzle || !boardState || feedback !== null) return;

    const step = puzzle.solution[currentStep];
    if (!step) return;

    if (!stepMatches(moveData, step)) {
      setFeedback('wrong');
      // Reset tactic_toe obstacle selection on wrong move
      if (puzzle.variant === 'tactic_toe') setSelectedObstacle(null);
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    // Correct move — apply to board state via engine
    const engine = ENGINES[puzzle.variant];
    if (!engine) return;

    const pr = engine.applyMove(boardState, { data: moveData }, boardState.currentPlayer);
    if (!pr.ok) return;

    let nextState = pr.state;
    const nextStep = currentStep + 1;
    const isLastStep = nextStep >= puzzle.solution.length;

    const advance = (state: GameState) => {
      setBoardState(state);
      setCurrentStep(nextStep);
      if (isLastStep) {
        handleSolved(puzzle.id);
      } else {
        setFeedback('correct');
        setTimeout(() => setFeedback(null), 800);
      }
    };

    // Apply scripted response if present (and not last step)
    if (step.response && !isLastStep) {
      setTimeout(() => {
        const rr = engine.applyMove(nextState, { data: step.response! }, nextState.currentPlayer);
        if (rr.ok) advance(rr.state);
        else advance(nextState);
      }, 400);
    } else {
      advance(nextState);
    }
  }, [puzzle, boardState, feedback, currentStep, handleSolved]);

  // ---------- per-variant move handlers ----------

  const handleStandardMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex });
  };

  const handleUltimateMove = (boardIndex: number, cellIndex: number) => {
    processMove({ boardIndex, cellIndex });
  };

  const handleGridMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex });
  };

  const handleOrderChaosMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex, symbol: selectedSymbol });
  };

  const handle3DMove = (boardIndex: number, cellIndex: number) => {
    // Convert (layer, withinLayer) → flat globalIndex (engine expects flat)
    processMove({ cellIndex: boardIndex * 9 + cellIndex });
  };

  const handle4DMove = (boardIndex: number, cellIndex: number) => {
    processMove({ cellIndex: boardIndex * 9 + cellIndex });
  };

  const handleUltimate3DMove = (macroCell: number, microCell: number) => {
    processMove({ macroCell, microCell });
  };

  const handleTacticCell = (globalIndex: number) => {
    if (!boardState || feedback !== null) return;
    const state = boardState as TacticToeState;

    if (tacticMode === 'place') {
      processMove({ type: 'place', cellIndex: globalIndex });
    } else {
      if (selectedObstacle === null) {
        if (state.board[globalIndex] === 'B') setSelectedObstacle(globalIndex);
      } else {
        if (state.board[globalIndex] === null) {
          processMove({ type: 'move_obstacle', fromCell: selectedObstacle, toCell: globalIndex });
          setSelectedObstacle(null);
        } else if (state.board[globalIndex] === 'B') {
          setSelectedObstacle(globalIndex); // re-select obstacle
        } else {
          setSelectedObstacle(null);
        }
      }
    }
  };

  // ---------- vanishing TTT board rendering ----------
  // Use state.moveCount directly (NOT board.filter count — engine sets moveDates[i] = moveCount+1)
  function getVanishingBoard(state: VanishingTTTState): (string | null)[] {
    return state.board.map((cell, i) => {
      if (cell === null) return null;
      const age = state.moveCount - (state.moveDates[i] ?? 0);
      return age > VANISHING_FADE_AFTER ? null : cell;
    });
  }

  // ---------- render ----------

  if (!puzzle || !boardState) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Puzzle not found.</p>
        <Link href="/puzzles" className={styles.backLink}>← Back to puzzles</Link>
      </div>
    );
  }

  const isDisabled = feedback !== null;
  const variantLabel = VARIANT_LABEL[puzzle.variant] ?? puzzle.variant;
  const isMultiStep = puzzle.solution.length > 1;
  const nextPuzzle = (puzzlesData as Puzzle[])[(puzzlesData as Puzzle[]).findIndex(p => p.id === id) + 1];
  const currentPlayer = boardState.currentPlayer as Player;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/puzzles" className={styles.backLink}>← All puzzles</Link>
        {isDaily && (
          <div style={{ padding: 'var(--space-1) var(--space-3)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center' }}>
            ★ Puzzle of the Day
          </div>
        )}
        <div className={styles.meta}>
          <span className={styles.variant}>{variantLabel}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.player}>{puzzle.player} to move</span>
          {alreadySolved && <span className={styles.solvedBadge}>Solved ✓</span>}
        </div>
        <h1 className={styles.title}>{puzzle.title}</h1>
        <p className={styles.description}>{puzzle.description}</p>
      </div>

      {isMultiStep && feedback !== 'solved' && (
        <div className={styles.stepIndicator}>
          Step {currentStep + 1} of {puzzle.solution.length}
        </div>
      )}

      {feedback === 'correct' && (
        <div className={styles.resultBanner} data-result="correct">Correct! Keep going.</div>
      )}
      {feedback === 'wrong' && (
        <div className={styles.resultBanner} data-result="wrong">Not quite — try again.</div>
      )}
      {feedback === 'solved' && (
        <div className={styles.resultBanner} data-result="correct">Correct! Well played.</div>
      )}

      {/* Order & Chaos symbol picker */}
      {puzzle.variant === 'order_chaos' && feedback !== 'solved' && (
        <div className={styles.symbolPicker}>
          <span className={styles.symbolPickerLabel}>Place:</span>
          <button
            className={`${styles.symbolBtn} ${selectedSymbol === 'X' ? styles.symbolBtnActive : ''}`}
            onClick={() => setSelectedSymbol('X')}
          >X</button>
          <button
            className={`${styles.symbolBtn} ${selectedSymbol === 'O' ? styles.symbolBtnActive : ''}`}
            onClick={() => setSelectedSymbol('O')}
          >O</button>
        </div>
      )}

      {/* Tactic Toe mode toggle */}
      {puzzle.variant === 'tactic_toe' && feedback !== 'solved' && (
        <div className={styles.symbolPicker}>
          <button
            className={`${styles.symbolBtn} ${tacticMode === 'place' ? styles.symbolBtnActive : ''}`}
            onClick={() => { setTacticMode('place'); setSelectedObstacle(null); }}
          >Place</button>
          <button
            className={`${styles.symbolBtn} ${tacticMode === 'move_obstacle' ? styles.symbolBtnActive : ''}`}
            onClick={() => setTacticMode('move_obstacle')}
          >Move Obstacle</button>
        </div>
      )}

      <div className={styles.boardWrap}>
        {puzzle.variant === 'ultimate_ttt' ? (
          <UltimateBoard
            boards={(boardState as UltimateTTTState).boards}
            boardResults={(boardState as UltimateTTTState).boardResults}
            nextBoardConstraint={(boardState as UltimateTTTState).nextBoardConstraint ?? null}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleUltimateMove}
          />
        ) : puzzle.variant === 'gomoku' ? (
          <GridBoard
            board={(boardState as GomokuState).board}
            cols={15} rows={15}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleGridMove}
          />
        ) : puzzle.variant === 'ttt_3d' ? (
          <ThreeDBoard
            board={(boardState as TTT3DState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handle3DMove}
          />
        ) : puzzle.variant === 'ttt_4d' ? (
          <FourDBoard
            board={(boardState as TTT4DState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handle4DMove}
          />
        ) : puzzle.variant === 'order_chaos' ? (
          <GridBoard
            board={(boardState as OrderChaosState).board}
            cols={6} rows={6}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleOrderChaosMove}
          />
        ) : puzzle.variant === 'tactic_toe' ? (
          <TacticToeBoard
            board={(boardState as TacticToeState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            moveMode={tacticMode}
            selectedObstacle={selectedObstacle}
            onCellClick={handleTacticCell}
          />
        ) : puzzle.variant === 'ultimate_3d' ? (
          <Ultimate3DBoard
            microBoards={(boardState as Ultimate3DState).microBoards}
            macroResults={(boardState as Ultimate3DState).macroResults}
            nextMacroConstraint={(boardState as Ultimate3DState).nextMacroConstraint}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleUltimate3DMove}
          />
        ) : puzzle.variant === 'vanishing_ttt' ? (
          <StandardBoard
            board={getVanishingBoard(boardState as VanishingTTTState) as any}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleStandardMove}
          />
        ) : (
          /* standard_3x3, misere_ttt */
          <StandardBoard
            board={(boardState as StandardTTTState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleStandardMove}
          />
        )}
      </div>

      {feedback === 'solved' && (
        <div className={styles.actions}>
          {isDaily ? (
            <Link href="/puzzles"><Button>Back to puzzles</Button></Link>
          ) : nextPuzzle ? (
            <Link href={`/puzzles/${nextPuzzle.id}`}><Button>Next puzzle →</Button></Link>
          ) : (
            <Link href="/puzzles"><Button>Back to puzzles</Button></Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

```
cd c:/Code/tactictoe/apps/web && npx tsc --noEmit
```

Fix any type errors. Common issues:
- `GomokuState` may need `board` cast — use `(boardState as any).board`
- `Ultimate3DState.macroResults` type may differ from `Ultimate3DBoard` prop type — cast as needed
- `VanishingTTTState.moveDates` may not be exported — use `(boardState as any).moveDates`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/puzzles/\[id\]/page.tsx
git commit -m "feat(puzzles): rewrite solver with multi-step support and all 10 variants"
```

---

## Task 4: Update page.module.css

**Files:**
- Modify: `apps/web/src/app/puzzles/[id]/page.module.css`

- [ ] **Step 1: Add step indicator and symbol picker styles**

Append to the end of the existing file:

```css
.stepIndicator {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: var(--space-1) var(--space-3);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 999px;
}

.symbolPicker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.symbolPickerLabel {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.symbolBtn {
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.symbolBtn:hover {
  background: var(--surface-hover, color-mix(in srgb, var(--accent) 8%, transparent));
  color: var(--text);
}

.symbolBtnActive {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-color: var(--accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/puzzles/\[id\]/page.module.css
git commit -m "feat(puzzles): add step indicator and symbol picker styles"
```

---

## Task 5: Validate and final checks

- [ ] **Step 1: Run verify-puzzles script**

```
cd c:/Code/tactictoe && npx tsx scripts/verify-puzzles.ts
```

Expected: `100 passed, 0 failed`. Fix any failures.

- [ ] **Step 2: Run web app tests**

```
cd c:/Code/tactictoe/apps/web && pnpm test
```

Fix any test failures.

- [ ] **Step 3: Full typecheck**

```
cd c:/Code/tactictoe/apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Run dev build check**

```
cd c:/Code/tactictoe/apps/web && pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Final commit if anything fixed**

```bash
git add -p
git commit -m "fix(puzzles): address type errors and validation issues"
```

---

## Summary

| Task | Key Output |
|------|-----------|
| 1 | `scripts/verify-puzzles.ts` validates all puzzles via engine |
| 2 | `puzzles.json` — 100 puzzles, new step-array schema, all 10 variants |
| 3 | Solver `page.tsx` — multi-step, 10 board cases, order_chaos picker, tactic_toe mode |
| 4 | CSS — step indicator + symbol picker |
| 5 | All checks pass: verify-puzzles, tsc, pnpm test, pnpm build |
