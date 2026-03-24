# Garrison — Game Variant Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Garrison is a hybrid chess/Gomoku variant played on a standard 8×8 board. Each player starts with one king already placed at a random symmetrical position and six pieces in hand. On each turn a player either places a piece from their hand or moves a piece already on the board using standard chess movement rules. The game ends when a player achieves checkmate or places/moves pieces to form exactly five in a row.

---

## Rules

### Setup

- Board: 8×8 (standard chess grid), squares indexed 0–63 (row-major, row 0 = rank 1).
- Before the game starts, two kings are placed at random symmetrically opposite squares. Symmetry is point-symmetric around the board centre: if Player X's king is at `(r, c)`, Player O's king is at `(7-r, 7-c)`. On an 8×8 board this constraint is always satisfied (no square maps to itself). The random selection must be retried if the chosen placement puts either king in check (i.e. one king is immediately adjacent to or attacked by a position where the other king would attack it — in practice, kings must not start on adjacent squares).
- Each player has 6 pieces in hand (not yet placed): 1 Queen, 2 Rooks, 2 Bishops, 2 Knights. No Pawns.

### Turn Structure

On each turn the current player must make exactly one move, which is either:

1. **Place** — choose a piece from hand and place it on any empty square.
2. **Move** — choose a piece already on the board and move it to any legal destination following standard chess movement.

**If the current player's king is in check**, the move must resolve the check. Valid responses:
- Move the king to a square not under attack.
- Move an existing board piece to block the attack ray or capture the attacker.
- Place a piece from hand that blocks the attack ray (interpose between attacker and king). Placement cannot capture; it can only block.

A player cannot make any move that leaves their own king in check.

### Piece Movement

Standard chess movement rules, with the following clarifications:
- **No special moves**: castling, en passant, and pawn promotion do not exist in this game.
- **Captures**: moving to an opponent-occupied square removes that piece from the game.
- **Blocking**: own pieces block ray movement (rook, bishop, queen rays stop before an own piece).
- **King movement**: the king may not move to any square attacked by an opponent piece.

### Win Conditions

A player wins if either of the following is true after their move:

1. **Checkmate** — the opponent's king is in check and the opponent has no legal moves (no placement or movement resolves the check).
2. **Exactly five in a row** — five of the current player's pieces occupy five consecutive squares in a straight line (horizontal, vertical, or any diagonal). A run of six or more does **not** win; it must be exactly five (no piece of the same player immediately before or after the run).

**Draw**: stalemate — the current player has no legal moves and is not in check.

---

## Architecture

### Package: `game-engine`

#### State (`garrison.ts`)

```typescript
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N'

interface GarrisonPiece {
  id: string        // unique: "X_K", "X_Q", "O_R1", "O_R2", etc.
  type: PieceType
  player: Player    // 'X' | 'O'
  square: number    // 0–63 when on board; -1 when in hand
  captured: boolean
}

interface GarrisonState extends GameState {
  variantId: 'garrison'
  pieces: GarrisonPiece[]
  currentPlayer: Player
  moveCount: number       // required by GameState base
  terminal: TerminalResult | null
}
```

#### Move Types

`GarrisonMove` is the variant-specific payload, passed as the `data` field of the engine's generic `Move` envelope (consistent with all other variants):

```typescript
type GarrisonMove =
  | { type: 'place'; pieceId: string; to: number }
  | { type: 'move';  pieceId: string; from: number; to: number }
```

In `applyMove`, cast with `const m = move.data as GarrisonMove`.

#### Rules Class (`GarrisonRules implements GameRules`)

Key methods:

- **`initialize(config)`** — generates random symmetrical king positions (retrying if kings would be adjacent), creates full piece list with kings on board and remaining pieces in hand, sets `moveCount: 0`.
- **`getLegalMoves(state)`** — returns all `Move` envelopes (placements + movements) whose `GarrisonMove` payloads do not leave the current player's king in check.
- **`applyMove(state, move, player)`** — casts `move.data as GarrisonMove`, validates, applies (update square / set captured / increment moveCount), checks terminal.
- **`checkTerminal(state)`** — checks 5-in-a-row for last mover and checkmate/stalemate for current player.
- **`serialize` / `deserialize`** — standard JSON.

#### Check Detection (`garrison-check.ts`)

Isolated helper module:

```typescript
function getAttackSquares(piece: GarrisonPiece, allPieces: GarrisonPiece[]): number[]
function isInCheck(player: Player, pieces: GarrisonPiece[]): boolean
function hasLegalMoves(player: Player, pieces: GarrisonPiece[]): boolean
```

Attack square logic per type:
- **Knight**: 8 fixed offsets `(±1,±2), (±2,±1)`, clamped to board, no ray blocking.
- **Bishop**: 4 diagonal rays; stop at first occupied square (attack if opponent, block if own).
- **Rook**: 4 orthogonal rays; same blocking logic.
- **Queen**: 8 rays (bishop + rook combined).
- **King**: 8 adjacent squares (1-step, no ray blocking).

#### Five-in-a-Row Detection (`garrison-five.ts`)

```typescript
function checkFiveInARow(player: Player, pieces: GarrisonPiece[]): number[] | null
// Returns the 5 winning square indices, or null if no win.
```

Scans 4 canonical directions only (right, down, down-right, down-left) starting from each occupied square, treating each square as the minimum-index end of a potential run. This avoids double-counting. A run of exactly 5 wins: the square immediately before the run start and immediately after the run end must not contain a piece of the same player.

#### AI (`garrison-ai.ts`)

Heuristic (no minimax). Signature matches existing AI conventions:

```typescript
export function getGarrisonAIMove(
  state: GarrisonState,
  player: Player,
  difficulty: AIDifficulty
): GarrisonMove
```

Logic:
1. If in check, pick any legal move that resolves it.
2. Among legal moves, score by:
   - +10 if it creates own run of 5 (win immediately)
   - +8 if it blocks opponent run of 4
   - +5 if it gives check
   - +3 if it extends own run to length 3 or 4
   - +1 if it blocks opponent run of 3
3. Pick highest-scoring move; break ties randomly.

---

### App: `web`

#### Board Component (`GarrisonBoard.tsx`)

Props:
```typescript
interface GarrisonBoardProps {
  state: GarrisonState
  currentPlayer: Player
  onMove: (move: GarrisonMove) => void
  disabled?: boolean
}
```

Interaction model:
1. Click a hand piece → enters placement mode; valid squares highlighted with dots.
2. Click a board piece (own) → enters movement mode; legal destinations highlighted.
3. Click a highlighted square → fires `onMove`.
4. Click elsewhere → deselects.

Visual details:
- 8×8 CSS grid, alternating `#f0d9b5` / `#b58863` squares.
- Coordinate labels a–h (columns) and 1–8 (rows).
- Player X pieces: filled unicode symbols (♚ ♛ ♜ ♝ ♞), black fill with white outline.
- Player O pieces: hollow unicode symbols (♔ ♕ ♖ ♗ ♘), white fill with black outline.
- King in check: square background pulses red.
- Winning 5-in-a-row: squares highlighted with accent colour (consistent with other variants).
- Hand panels above/below board: pieces dim when placed, disappear when captured.
- Board component is imported directly by path in page files (no barrel index needed).

#### Variant Registration

In `apps/web/src/app/local/page.tsx` and `apps/web/src/app/vs-ai/page.tsx`, the `Variant` string literal union type must be extended to include `'garrison'`. Then add to `VARIANT_INFO`:
```typescript
garrison: {
  label: 'Garrison',
  description: 'Place and move chess pieces. Win by checkmate or 5 in a row.',
  Icon: Swords,  // Lucide icon
}
```

In `useAI.ts`:
1. Add `GarrisonMove` to the static import at the top of the file: `import type { AIDifficulty, Player, GameState, GarrisonMove } from '@tactictoe/game-engine'` — required because `AIMove` is a top-level interface and its `garrisonMove` field must resolve at compile time, not inside the async dynamic import.
2. Add `'garrison'` to the `AIVariant` union.
3. Extend the `AIMove` interface with `garrisonMove?: GarrisonMove` — this carries the full typed payload so the page can pass it directly to `applyMove` without loss of `pieceId`.
4. Add a dispatch branch:
```typescript
} else if (variant === 'garrison') {
  const move = getGarrisonAIMove(state as GarrisonState, aiPlayer, difficulty);
  resolve({ boardIndex: 0, cellIndex: move.to, garrisonMove: move });
}
```
4. In the vs-ai page's `handleAIMove`, for garrison wrap the payload and call `engine.applyMove(state, { data: aiMove.garrisonMove }, aiPlayer)`.

---

## Files To Create

| File | Purpose |
|------|---------|
| `packages/game-engine/src/rules/garrison.ts` | State types + GarrisonRules class |
| `packages/game-engine/src/rules/garrison-check.ts` | Attack square + check/checkmate helpers |
| `packages/game-engine/src/rules/garrison-five.ts` | 5-in-a-row detection |
| `packages/game-engine/src/ai/garrison-ai.ts` | Heuristic AI |
| `apps/web/src/components/board/GarrisonBoard.tsx` | Board rendering + interaction |

## Files To Modify

| File | Change |
|------|--------|
| `packages/game-engine/src/index.ts` | Export GarrisonRules, GarrisonState, GarrisonMove, getGarrisonAIMove |
| `packages/game-engine/src/ai/index.ts` | Export `getGarrisonAIMove` and re-export `GarrisonMove` type from `garrison-ai.ts` (maintains barrel chain for `useAI.ts` consumers) |
| `apps/web/src/app/local/page.tsx` | Add `'garrison'` to Variant union; register in VARIANT_INFO and engines map; import GarrisonBoard |
| `apps/web/src/app/vs-ai/page.tsx` | Add `'garrison'` to Variant union; register garrison for AI play; import GarrisonBoard |
| `apps/web/src/hooks/useAI.ts` | Add `'garrison'` to AIVariant union; add garrison dispatch branch calling getGarrisonAIMove |

---

## Out of Scope (V2)

- Full minimax/MCTS AI
- Online multiplayer server support
- Castling, en passant, promotion (impossible given setup)
