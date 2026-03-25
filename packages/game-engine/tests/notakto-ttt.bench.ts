import { describe, bench } from 'vitest';
import { NotaktoTTT } from '../src/rules/notakto-ttt.js';

const rules = new NotaktoTTT();
const freshState = rules.initialize({ variantId: 'notakto' });

describe('NotaktoTTT getLegalMoves performance', () => {
  bench('getLegalMoves - empty board', () => {
    rules.getLegalMoves(freshState);
  });
});
