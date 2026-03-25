import { TTT3D } from './src/rules/ttt-3d.js';
import { performance } from 'perf_hooks';

const engine = new TTT3D();
const state = engine.initialize({ id: 'ttt_3d', name: '3D Tic Tac Toe' });

// pre-warm
for (let i = 0; i < 10000; i++) {
  engine.getLegalMoves(state);
}

const start = performance.now();
const ITERATIONS = 1000000;
for (let i = 0; i < ITERATIONS; i++) {
  engine.getLegalMoves(state);
}
const end = performance.now();

console.log(`Baseline TTT3D getLegalMoves: ${(end - start).toFixed(2)} ms for ${ITERATIONS} iterations`);
