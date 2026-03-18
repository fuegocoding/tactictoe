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
