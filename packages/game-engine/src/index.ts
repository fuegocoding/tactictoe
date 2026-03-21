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

export { getStandardAIMove, getUltimateAIMove } from './ai/index.js';
export type { AIDifficulty } from './ai/index.js';

export { MisereTTT } from './rules/misere-ttt.js';
export type { MisereTTTState } from './rules/misere-ttt.js';

export { NotaktoTTT } from './rules/notakto-ttt.js';
export type { NotaktoTTTState } from './rules/notakto-ttt.js';

export { WildTTT } from './rules/wild-ttt.js';
export type { WildTTTState, WildTTTMove } from './rules/wild-ttt.js';

export { getMisereAIMove, getNotaktoAIMove, getWildAIMove } from './ai/index.js';
export type { WildAIMove } from './ai/index.js';

export { Gomoku } from './rules/gomoku.js';
export type { GomokuState } from './rules/gomoku.js';

export { SOSTTT } from './rules/sos-ttt.js';
export type { SOSTTTState, SOSTTTMove } from './rules/sos-ttt.js';

export { NumericalTTT } from './rules/numerical-ttt.js';
export type { NumericalTTTState, NumericalTTTMove } from './rules/numerical-ttt.js';

export { getGomokuAIMove, getSOSAIMove, getNumericalAIMove } from './ai/index.js';

