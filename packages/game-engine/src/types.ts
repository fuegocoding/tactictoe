// The 9 cells of a single board, indexed 0-8:
// 0 | 1 | 2
// ---------
// 3 | 4 | 5
// ---------
// 6 | 7 | 8
export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

// Result of a single board (mini-board or meta-board)
export type BoardResult = Player | 'draw' | null; // null = still in play

export interface Move {
  // Variant-specific move data. Each rules implementation defines what it expects.
  // Stored as unknown here; the rules class casts and validates internally.
  data: unknown;
}

export interface MoveResult {
  ok: boolean;
  error?: string;       // Human-readable reason if ok === false
  state: GameState;     // New state (same as input state if ok === false)
}

export interface TerminalResult {
  winner: Player | null; // null = draw
  reason: 'win' | 'draw';
}

// Opaque game state — each rules implementation defines the shape internally.
// Externally it is treated as an opaque serializable blob.
export interface GameState {
  readonly variantId: string;
  readonly currentPlayer: Player;
  readonly moveCount: number;
  // Additional fields are variant-specific and live on concrete state subtypes.
}

export interface VariantConfig {
  variantId: string;
  // Additional config is variant-specific.
  [key: string]: unknown;
}
