// Run with: npx tsx scripts/verify-puzzles.ts
// from the repo root (c:/Code/tactictoe)
import puzzles from '../apps/web/src/data/puzzles.json' with { type: 'json' };
import {
  StandardTTT, MisereTTT, Gomoku, VanishingTTT, TTT3D, TTT4D,
  OrderChaos, TacticToe, UltimateTTT, Ultimate3D,
} from '../packages/game-engine/src/index.js';
import type { GameRules, GameState } from '../packages/game-engine/src/index.js';

const engines: Record<string, GameRules> = {
  standard_3x3: new StandardTTT(),
  misere_ttt:   new MisereTTT(),
  gomoku:       new Gomoku(),
  vanishing_ttt: new VanishingTTT(),
  ttt_3d:       new TTT3D(),
  ttt_4d:       new TTT4D(),
  order_chaos:  new OrderChaos(),
  tactic_toe:   new TacticToe(),
  ultimate_ttt: new UltimateTTT(),
  ultimate_3d:  new Ultimate3D(),
};

let passed = 0;
let failed = 0;

for (const puzzle of (puzzles as any[])) {
  const engine = engines[puzzle.variant];
  if (!engine) {
    console.error(`FAIL [${puzzle.id}]: unknown variant "${puzzle.variant}"`);
    failed++;
    continue;
  }

  const lastStep = puzzle.solution[puzzle.solution.length - 1];
  if (lastStep?.response) {
    console.warn(`WARN [${puzzle.id}]: last step has response (will be ignored at runtime)`);
  }

  // Pre-check: vanishing_ttt requires variantId in state
  if (puzzle.variant === 'vanishing_ttt' && puzzle.state.variantId !== 'vanishing_ttt') {
    console.error(`FAIL [${puzzle.id}]: vanishing_ttt state must have "variantId": "vanishing_ttt"`);
    failed++;
    continue;
  }
  // Pre-check: vanishing_ttt requires moveCount in state
  if (puzzle.variant === 'vanishing_ttt' && typeof puzzle.state.moveCount !== 'number') {
    console.error(`FAIL [${puzzle.id}]: vanishing_ttt state must have a numeric "moveCount" field`);
    failed++;
    continue;
  }

  let state: GameState = puzzle.state as GameState;
  let ok = true;

  for (let stepIdx = 0; stepIdx < puzzle.solution.length; stepIdx++) {
    const step = (puzzle.solution as any[])[stepIdx]!;
    const isLastStep = stepIdx === puzzle.solution.length - 1;

    // Verify at least one move in this step is legal
    let anyValid = false;
    for (const m of step.moves) {
      const r = engine.applyMove(state, { data: m }, state.currentPlayer);
      if (r.ok) { anyValid = true; break; }
    }
    if (!anyValid) {
      console.error(`FAIL [${puzzle.id}] step ${stepIdx}: no valid player move — ${JSON.stringify(step.moves)}`);
      ok = false; break;
    }

    // Advance state using the first move
    const pr = engine.applyMove(state, { data: step.moves[0] }, state.currentPlayer);
    if (!pr.ok) { console.error(`FAIL [${puzzle.id}] step ${stepIdx}: ${pr.error}`); ok = false; break; }
    state = pr.state;

    // Apply response if present (and not last step)
    if (step.response && !isLastStep) {
      const rr = engine.applyMove(state, { data: step.response }, state.currentPlayer);
      if (!rr.ok) { console.error(`FAIL [${puzzle.id}] step ${stepIdx} response: ${rr.error}`); ok = false; break; }
      state = rr.state;
    }
  }

  if (ok) { console.log(`PASS [${puzzle.id}]`); passed++; }
  else { failed++; }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
