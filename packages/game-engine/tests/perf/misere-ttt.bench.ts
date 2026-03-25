import { bench, describe } from 'vitest';
import { MisereTTT } from '../../src/rules/misere-ttt.js';
import type { GameState } from '../../src/types.js';

const rules = new MisereTTT();
const state = rules.initialize({ variantId: 'misere_ttt' });

describe('MisereTTT getLegalMoves performance', () => {
  bench('getLegalMoves', () => {
    rules.getLegalMoves(state);
  });
});
