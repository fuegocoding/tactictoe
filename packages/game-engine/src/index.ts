export type {
  Player,
  Cell,
  Board,
  BoardResult,
  Move,
  MoveResult,
  TerminalResult,
  GameState,
  VariantConfig,
} from './types.js';

export type { GameRules } from './rules/interface.js';

export { checkBoardWinner, isBoardFull } from './rules/win-checker.js';

export { StandardTTT } from './rules/standard-ttt.js';
export type { StandardTTTState } from './rules/standard-ttt.js';

export { UltimateTTT } from './rules/ultimate-ttt.js';
export type { UltimateTTTState, UltimateTTTMove } from './rules/ultimate-ttt.js';
