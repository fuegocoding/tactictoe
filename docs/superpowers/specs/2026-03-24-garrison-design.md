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
- Before the game starts, two kings are placed at random symmetrically opposite squares. Symmetry is point-symmetric around the board centre: if Player X's king is at `(r, c)`, Player O's king is at `(7-r, 7-c)`. The pair is chosen such that the two squares are distinct.
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
  terminal: TerminalResult | null
}
```

#### Move Types

```typescript
type GarrisonMove =
  | { type: 'place'; pieceId: string; to: number }
  | { type: 'move';  pieceId: string; from: number; to: number }
```

#### Rules Class (`GarrisonRules implements GameRules`)

Key methods:

- **`initialize(config)`** — generates random symmetrical king positions, creates full piece list with kings on board and remaining pieces in hand.
- **`getLegalMoves(state)`** — returns all moves (placements + movements) that do not leave the current player's king in check.
- **`applyMove(state, move, player)`** — validates move, applies it (update square / set captured), checks terminal.
- **`checkTerminal(state)`** — checks 5-in-a-row for last mover and checkmate for current player.
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

Scans all 8 directions for each occupied square. A run of exactly 5 wins: requires `board[runStart-1] !== player` and `board[runEnd+1] !== player`.

#### AI (`garrison-ai.ts`)

Heuristic (no minimax):
1. If in check, pick any legal move that resolves it.
2. Among legal moves, score by:
   - +10 if it extends own run to length 4 or creates own run of 5 (win immediately)
   - +8 if it blocks opponent run of 4
   - +5 if it gives check
   - +3 if it extends own run to length 3
   - +1 if it blocks opponent run of 3
3. Pick highest-scoring move; break ties randomly.

Exported as `getGarrisonAIMove(state: GameState, player: Player, difficulty?: string): Move`.

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

#### Variant Registration

In `apps/web/src/app/local/page.tsx`:
```typescript
garrison: {
  label: 'Garrison',
  description: 'Place and move chess pieces. Win by checkmate or 5 in a row.',
  Icon: Swords,  // Lucide icon
}
```

Same registration pattern in the vs-AI page and any game server variant registry.

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
| `packages/game-engine/src/rules/index.ts` | Export GarrisonRules + types |
| `packages/game-engine/src/ai/index.ts` | Export getGarrisonAIMove |
| `apps/web/src/components/board/index.ts` | Export GarrisonBoard |
| `apps/web/src/app/local/page.tsx` | Register garrison variant + board component |
| `apps/web/src/app/vs-ai/page.tsx` | Register garrison for AI play |

---

## Out of Scope (V2)

- Full minimax/MCTS AI
- Online multiplayer server support
- Castling, en passant, promotion (impossible given setup)
