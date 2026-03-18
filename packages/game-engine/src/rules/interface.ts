import type { GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';

export interface GameRules {
  /** Create a fresh initial game state from a config. */
  initialize(config: VariantConfig): GameState;

  /**
   * Apply a move. Returns the new state (or unchanged state with error) and ok flag.
   * Never mutates the input state.
   */
  applyMove(state: GameState, move: Move, playerId: Player): MoveResult;

  /**
   * Return all legal moves for the current player in the given state.
   * Used by the client for move-highlight UI and by tests for exhaustive checks.
   */
  getLegalMoves(state: GameState): Move[];

  /**
   * Return a TerminalResult if the game is over, null if still in play.
   */
  checkTerminal(state: GameState): TerminalResult | null;

  /** Serialize state to a JSON string for DB storage and WebSocket broadcast. */
  serialize(state: GameState): string;

  /** Deserialize a JSON string back to a GameState. Throws on invalid input. */
  deserialize(s: string): GameState;
}

// Re-export Player so consumers don't need to import from types separately
import type { Player } from '../types.js';
export type { Player };
