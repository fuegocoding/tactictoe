# Plan 8: AI Opponents + Puzzles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add computer opponents at multiple difficulty levels for both Standard TTT and Ultimate TTT. Add a puzzle mode with pre-defined positions. All AI runs client-side — no server changes needed.

**Prerequisites:** Plan 4 (UI + local play) must be complete. Plans 5–7 are not required for AI.

**Architecture:**
- AI logic lives in `packages/game-engine/src/ai/` — same package as the rules engines.
- Standard TTT AI: perfect minimax (trivial — the game is solved). Difficulties differ by move delay and intentional blundering on Easy.
- Ultimate TTT AI: Monte Carlo Tree Search (MCTS). Perfect minimax is intractable (branching factor too high). MCTS with configurable simulations gives graduated difficulty.
- All AI is synchronous / runs in a Web Worker to avoid blocking the UI on MCTS thinking.
- Puzzle mode: a static JSON file of positions + expected best moves. No backend required initially.

---

## File Map

```
packages/game-engine/src/
├── ai/
│   ├── index.ts                  ← NEW: exports all AI
│   ├── standard-ai.ts            ← NEW: minimax for Standard TTT
│   ├── ultimate-ai.ts            ← NEW: MCTS for Ultimate TTT
│   ├── mcts.ts                   ← NEW: generic MCTS implementation
│   └── worker.ts                 ← NEW: Web Worker entry point
├── index.ts                      ← MODIFY: export AI types

apps/web/src/
├── app/
│   ├── vs-ai/
│   │   ├── page.tsx              ← NEW: vs AI game page
│   │   └── page.module.css       ← NEW
│   └── puzzles/
│       ├── page.tsx              ← NEW: puzzle browser
│       ├── [id]/
│       │   ├── page.tsx          ← NEW: puzzle solver page
│       │   └── page.module.css   ← NEW
│       └── page.module.css       ← NEW
├── hooks/
│   └── useAI.ts                  ← NEW: hook wrapping Web Worker AI
└── data/
    └── puzzles.json              ← NEW: static puzzle data
```

---

## Task 1: Standard TTT AI (Minimax)

**Files:**
- Create: `packages/game-engine/src/ai/standard-ai.ts`

Standard TTT is solved — perfect play always draws. The AI plays perfectly on Hard. On Easy it picks a random legal move. On Medium it plays perfectly 60% of the time and randomly 40%.

- [ ] **Step 1.1: Create `packages/game-engine/src/ai/standard-ai.ts`**

```typescript
import { StandardTTT } from '../rules/standard-ttt.js';
import type { StandardTTTState } from '../rules/standard-ttt.js';
import type { Player } from '../types.js';

const engine = new StandardTTT();

export type AIDifficulty = 'easy' | 'medium' | 'hard';

// Returns the cell index for the AI's move
export function getStandardAIMove(state: StandardTTTState, aiPlayer: Player, difficulty: AIDifficulty): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  if (legal.length === 0) throw new Error('No legal moves');

  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)];

  const bestMove = minimaxBestMove(state, aiPlayer);

  if (difficulty === 'medium') {
    // Play best move 60% of the time
    return Math.random() < 0.6 ? bestMove : legal[Math.floor(Math.random() * legal.length)];
  }

  return bestMove; // hard = always best
}

function minimaxBestMove(state: StandardTTTState, aiPlayer: Player): number {
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);
  let bestScore = -Infinity;
  let bestMove = legal[0];

  for (const cellIndex of legal) {
    const result = engine.applyMove(state, { data: { cellIndex } }, aiPlayer);
    if (!result.ok) continue;
    const score = minimax(result.state as StandardTTTState, 0, false, aiPlayer);
    if (score > bestScore) { bestScore = score; bestMove = cellIndex; }
  }

  return bestMove;
}

function minimax(state: StandardTTTState, depth: number, isMaximizing: boolean, aiPlayer: Player): number {
  const terminal = engine.checkTerminal(state);
  if (terminal) {
    if (terminal.winner === aiPlayer) return 10 - depth;
    if (terminal.winner !== null) return depth - 10;
    return 0; // draw
  }

  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const currentPlayer = isMaximizing ? aiPlayer : opponent;
  const legal = engine.getLegalMoves(state).map(m => (m.data as { cellIndex: number }).cellIndex);

  if (isMaximizing) {
    let best = -Infinity;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
      if (result.ok) best = Math.max(best, minimax(result.state as StandardTTTState, depth + 1, false, aiPlayer));
    }
    return best;
  } else {
    let best = Infinity;
    for (const cellIndex of legal) {
      const result = engine.applyMove(state, { data: { cellIndex } }, currentPlayer);
      if (result.ok) best = Math.min(best, minimax(result.state as StandardTTTState, depth + 1, true, aiPlayer));
    }
    return best;
  }
}
```

- [ ] **Step 1.2: Commit**

```bash
git add packages/game-engine/src/ai/standard-ai.ts
git commit -m "feat(game-engine): add Standard TTT minimax AI"
```

---

## Task 2: MCTS Core

**Files:**
- Create: `packages/game-engine/src/ai/mcts.ts`

Generic Monte Carlo Tree Search. Used by Ultimate TTT AI.

- [ ] **Step 2.1: Create `packages/game-engine/src/ai/mcts.ts`**

```typescript
import type { GameRules, GameState, Move, Player } from '../types.js';

interface MCTSNode {
  state: GameState;
  move: Move | null;       // move that led to this state
  player: Player;          // player who made the move
  parent: MCTSNode | null;
  children: MCTSNode[];
  wins: number;
  visits: number;
  untriedMoves: Move[];
}

const UCT_C = Math.SQRT2; // exploration constant

function uctScore(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) return Infinity;
  return node.wins / node.visits + UCT_C * Math.sqrt(Math.log(parentVisits) / node.visits);
}

function selectChild(node: MCTSNode): MCTSNode {
  return node.children.reduce((best, child) =>
    uctScore(child, node.visits) > uctScore(best, node.visits) ? child : best
  );
}

function expand(node: MCTSNode, rules: GameRules): MCTSNode {
  const moveIdx = Math.floor(Math.random() * node.untriedMoves.length);
  const move = node.untriedMoves.splice(moveIdx, 1)[0];
  const result = rules.applyMove(node.state, move, node.state.currentPlayer);
  const child: MCTSNode = {
    state: result.ok ? result.state : node.state,
    move,
    player: node.state.currentPlayer,
    parent: node,
    children: [],
    wins: 0,
    visits: 0,
    untriedMoves: result.ok ? rules.getLegalMoves(result.state) : [],
  };
  node.children.push(child);
  return child;
}

function simulate(state: GameState, rules: GameRules): Player | null {
  let current = state;
  let steps = 0;
  while (steps++ < 200) {
    const terminal = rules.checkTerminal(current);
    if (terminal) return terminal.winner;
    const moves = rules.getLegalMoves(current);
    if (moves.length === 0) return null;
    const move = moves[Math.floor(Math.random() * moves.length)];
    const result = rules.applyMove(current, move, current.currentPlayer);
    if (!result.ok) return null;
    current = result.state;
  }
  return null; // timeout = treat as draw
}

function backpropagate(node: MCTSNode, winner: Player | null, aiPlayer: Player): void {
  let n: MCTSNode | null = node;
  while (n) {
    n.visits++;
    if (winner === aiPlayer) n.wins++;
    else if (winner === null) n.wins += 0.5; // draw is half a win
    n = n.parent;
  }
}

/**
 * Run MCTS for `iterations` simulations and return the best move.
 * @param state Current game state
 * @param rules Rules engine
 * @param aiPlayer Which player the AI is playing as
 * @param iterations Higher = stronger. 200 = easy, 800 = medium, 3000 = hard
 */
export function mctsGetMove(state: GameState, rules: GameRules, aiPlayer: Player, iterations: number): Move {
  const root: MCTSNode = {
    state,
    move: null,
    player: aiPlayer,
    parent: null,
    children: [],
    wins: 0,
    visits: 0,
    untriedMoves: rules.getLegalMoves(state),
  };

  for (let i = 0; i < iterations; i++) {
    // Selection
    let node = root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
    }

    // Expansion
    if (node.untriedMoves.length > 0) {
      node = expand(node, rules);
    }

    // Simulation
    const winner = simulate(node.state, rules);

    // Backpropagation
    backpropagate(node, winner, aiPlayer);
  }

  // Pick most visited child
  if (root.children.length === 0) {
    return root.untriedMoves[0]; // fallback
  }

  const best = root.children.reduce((a, b) => b.visits > a.visits ? b : a);
  return best.move!;
}
```

- [ ] **Step 2.2: Commit**

```bash
git add packages/game-engine/src/ai/mcts.ts
git commit -m "feat(game-engine): add generic MCTS implementation"
```

---

## Task 3: Ultimate TTT AI

**Files:**
- Create: `packages/game-engine/src/ai/ultimate-ai.ts`

- [ ] **Step 3.1: Create `packages/game-engine/src/ai/ultimate-ai.ts`**

```typescript
import { UltimateTTT } from '../rules/ultimate-ttt.js';
import type { UltimateTTTState, UltimateTTTMove } from '../rules/ultimate-ttt.js';
import type { Player } from '../types.js';
import { mctsGetMove } from './mcts.js';
import type { AIDifficulty } from './standard-ai.js';

const engine = new UltimateTTT();

const ITERATIONS: Record<AIDifficulty, number> = {
  easy: 100,
  medium: 500,
  hard: 2000,
};

export function getUltimateAIMove(
  state: UltimateTTTState,
  aiPlayer: Player,
  difficulty: AIDifficulty
): UltimateTTTMove {
  const iterations = ITERATIONS[difficulty];

  // Easy: 40% chance to play randomly (more human-like blunders)
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const legal = engine.getLegalMoves(state);
    const move = legal[Math.floor(Math.random() * legal.length)];
    return move.data as UltimateTTTMove;
  }

  const move = mctsGetMove(state, engine, aiPlayer, iterations);
  return move.data as UltimateTTTMove;
}
```

- [ ] **Step 3.2: Export from `packages/game-engine/src/ai/index.ts`**

```typescript
export { getStandardAIMove } from './standard-ai.js';
export { getUltimateAIMove } from './ultimate-ai.js';
export type { AIDifficulty } from './standard-ai.js';
```

- [ ] **Step 3.3: Update `packages/game-engine/src/index.ts`**

Add:
```typescript
export { getStandardAIMove, getUltimateAIMove } from './ai/index.js';
export type { AIDifficulty } from './ai/index.js';
```

- [ ] **Step 3.4: Commit**

```bash
git add packages/game-engine/src/ai/ packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add Ultimate TTT MCTS AI, export AI functions"
```

---

## Task 4: Web Worker Wrapper

MCTS at hard difficulty (2000 iterations) on Ultimate TTT takes ~200-500ms. This would block the main thread noticeably. We run it in a Web Worker.

**Files:**
- Create: `packages/game-engine/src/ai/worker.ts`
- Create: `apps/web/src/hooks/useAI.ts`

- [ ] **Step 4.1: Create `packages/game-engine/src/ai/worker.ts`**

```typescript
import { getStandardAIMove } from './standard-ai.js';
import { getUltimateAIMove } from './ultimate-ai.js';
import type { AIDifficulty } from './standard-ai.js';
import type { Player } from '../types.js';

interface WorkerRequest {
  id: string;
  variant: 'standard_3x3' | 'ultimate_ttt';
  state: unknown;
  aiPlayer: Player;
  difficulty: AIDifficulty;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, variant, state, aiPlayer, difficulty } = e.data;
  try {
    let move: unknown;
    if (variant === 'standard_3x3') {
      move = { cellIndex: getStandardAIMove(state as any, aiPlayer, difficulty) };
    } else {
      move = getUltimateAIMove(state as any, aiPlayer, difficulty);
    }
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
```

- [ ] **Step 4.2: Create `apps/web/src/hooks/useAI.ts`**

```typescript
'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { AIDifficulty } from '@tactictoe/game-engine';
import type { Player, GameState } from '@tactictoe/game-engine';

interface AIMove {
  boardIndex: number;
  cellIndex: number;
}

interface UseAIResult {
  getMove: (state: GameState, aiPlayer: Player) => Promise<AIMove>;
  terminate: () => void;
}

export function useAI(
  variant: 'standard_3x3' | 'ultimate_ttt',
  difficulty: AIDifficulty
): UseAIResult {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (m: AIMove) => void; reject: (e: Error) => void }>>(new Map());

  useEffect(() => {
    // Create worker inline via blob URL to avoid bundler issues
    // The worker code is inlined since Next.js worker bundling requires extra config
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const getMove = useCallback((state: GameState, aiPlayer: Player): Promise<AIMove> => {
    return new Promise((resolve, reject) => {
      // Lazy-create worker on first use
      if (!workerRef.current) {
        // For Next.js App Router, use dynamic import of worker
        // The worker file must be in /public or use next-worker-loader
        // Fallback: run synchronously if worker unavailable
        try {
          workerRef.current = new Worker(
            new URL('../../../packages/game-engine/src/ai/worker.ts', import.meta.url),
            { type: 'module' }
          );
          workerRef.current.onmessage = (e) => {
            const { id, move, error } = e.data;
            const pending = pendingRef.current.get(id);
            if (!pending) return;
            pendingRef.current.delete(id);
            if (error) reject(new Error(error));
            else resolve(move);
          };
        } catch {
          // Worker unavailable — run synchronously (will block briefly on hard mode)
          import('@tactictoe/game-engine').then(({ getStandardAIMove, getUltimateAIMove }) => {
            try {
              let move: AIMove;
              if (variant === 'standard_3x3') {
                const cellIndex = getStandardAIMove(state as any, aiPlayer, difficulty);
                move = { boardIndex: 0, cellIndex };
              } else {
                move = getUltimateAIMove(state as any, aiPlayer, difficulty) as AIMove;
              }
              resolve(move);
            } catch (err) { reject(err as Error); }
          });
          return;
        }
      }

      const id = Math.random().toString(36).slice(2);
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({ id, variant, state, aiPlayer, difficulty });
    });
  }, [variant, difficulty]);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return { getMove, terminate };
}
```

Note: Web Worker bundling with Next.js App Router requires `next.config.mjs` to have `experimental.workerThreads` or use a `?worker` import suffix depending on the version. If worker import fails at runtime, the hook gracefully falls back to synchronous execution. Test on Easy/Medium first where MCTS is fast enough to run synchronously without noticeable lag.

- [ ] **Step 4.3: Commit**

```bash
git add packages/game-engine/src/ai/worker.ts apps/web/src/hooks/useAI.ts
git commit -m "feat(web): add Web Worker AI hook with synchronous fallback"
```

---

## Task 5: Vs AI Page

**Files:**
- Create: `apps/web/src/app/vs-ai/page.tsx`
- Create: `apps/web/src/app/vs-ai/page.module.css`

The Vs AI page is structurally identical to the Local Play page (Plan 4, Task 9) except one player is replaced by the AI. The AI moves automatically after a short delay.

- [ ] **Step 5.1: Create `apps/web/src/app/vs-ai/page.module.css`**

Reuse `apps/web/src/app/local/page.module.css` by importing it directly, or copy+adjust. The only new styles needed are for the difficulty selector and the "AI is thinking" indicator.

```css
/* Import local page styles and add AI-specific additions */

.thinking {
  font-size: var(--text-sm);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 20px;
}

.thinkingDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.7); }
}

.diffRow { display: flex; gap: var(--space-2); }

.diffBtn {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  background: var(--bg-raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s;
  text-align: center;
}

.diffBtn:hover { background: var(--bg-hover); color: var(--text); }
.diffBtn.selected { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); font-weight: 600; }

.sideRow {
  display: flex;
  gap: var(--space-2);
}

.sideBtn {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  background: var(--bg-raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s;
  text-align: center;
}

.sideBtn:hover { background: var(--bg-hover); color: var(--text); }
.sideBtn.selected { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); font-weight: 600; }
```

- [ ] **Step 5.2: Create `apps/web/src/app/vs-ai/page.tsx`**

```tsx
'use client';

import { useState, useReducer, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StandardTTT, UltimateTTT } from '@tactictoe/game-engine';
import type { GameState } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { AIDifficulty, Player } from '@tactictoe/game-engine';
import StandardBoard from '@/components/board/StandardBoard';
import UltimateBoard from '@/components/board/UltimateBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAI } from '@/hooks/useAI';
import styles from './page.module.css';
import localStyles from '../local/page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt';

const engines = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
};

interface AIGameState {
  phase: 'setup' | 'playing' | 'over';
  variant: Variant;
  playerName: string;
  humanPlayer: Player;           // 'X' or 'O'
  difficulty: AIDifficulty;
  gameState: GameState | null;
  aiThinking: boolean;
  scores: { human: number; ai: number; draws: number };
}

// Reducer similar to local page but handles AI turns
// ... (implement analogously to Plan 4 Task 9's reducer)

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export default function VsAIPage() {
  const [variant, setVariant] = useState<Variant>('ultimate_ttt');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [humanPlayer, setHumanPlayer] = useState<Player>('X');
  const [playerName, setPlayerName] = useState('You');
  const [phase, setPhase] = useState<'setup' | 'playing' | 'over'>('setup');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [scores, setScores] = useState({ human: 0, ai: 0, draws: 0 });
  const [terminal, setTerminal] = useState<{ winner: Player | null; reason: string } | null>(null);

  const ai = useAI(variant, difficulty);
  const aiPlayer: Player = humanPlayer === 'X' ? 'O' : 'X';

  const startGame = () => {
    const engine = engines[variant];
    const state = engine.initialize({ variantId: variant });
    setGameState(state);
    setPhase('playing');
    setTerminal(null);
    setAiThinking(false);
  };

  // Trigger AI move when it's the AI's turn
  useEffect(() => {
    if (phase !== 'playing' || !gameState || aiThinking) return;
    if (gameState.currentPlayer !== aiPlayer) return;

    setAiThinking(true);

    // Small delay so the UI renders before AI blocks thread
    const timeout = setTimeout(async () => {
      try {
        const move = await ai.getMove(gameState, aiPlayer);
        const engine = engines[variant];
        const boardIndex = variant === 'ultimate_ttt' ? move.boardIndex : 0;
        const result = engine.applyMove(gameState, { data: { boardIndex, cellIndex: move.cellIndex } }, aiPlayer);
        if (result.ok) {
          const term = engine.checkTerminal(result.state);
          if (term) {
            setGameState({ ...result.state, terminal: term });
            setPhase('over');
            setTerminal({ winner: term.winner, reason: term.winner ? 'win' : 'draw' });
            const newScores = { ...scores };
            if (term.winner === humanPlayer) newScores.human++;
            else if (term.winner === aiPlayer) newScores.ai++;
            else newScores.draws++;
            setScores(newScores);
          } else {
            setGameState(result.state);
          }
        }
      } finally {
        setAiThinking(false);
      }
    }, difficulty === 'easy' ? 300 : difficulty === 'medium' ? 500 : 800);

    return () => clearTimeout(timeout);
  }, [gameState, phase, aiThinking, aiPlayer, difficulty, variant]);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    const engine = engines[variant];
    const result = engine.applyMove(gameState, { data: { boardIndex, cellIndex } }, humanPlayer);
    if (!result.ok) return;
    const term = engine.checkTerminal(result.state);
    if (term) {
      setGameState({ ...result.state, terminal: term });
      setPhase('over');
      setTerminal({ winner: term.winner, reason: term.winner ? 'win' : 'draw' });
      const newScores = { ...scores };
      if (term.winner === humanPlayer) newScores.human++;
      else if (term.winner === aiPlayer) newScores.ai++;
      else newScores.draws++;
      setScores(newScores);
    } else {
      setGameState(result.state);
    }
  };

  const isMyTurn = phase === 'playing' && gameState?.currentPlayer === humanPlayer && !aiThinking;

  return (
    <div className={localStyles.page}>
      <div className={localStyles.header}>
        <h1 className={localStyles.title}>Play vs AI</h1>
        <p className={localStyles.subtitle}>Test your skills against the computer.</p>
      </div>

      {phase === 'setup' && (
        <Card style={{ width: '100%', maxWidth: 440 }}>
          <div className={localStyles.setup}>
            <div className={localStyles.variantRow}>
              <p className={localStyles.variantLabel}>Game mode</p>
              <div className={localStyles.variantButtons}>
                {(['ultimate_ttt', 'standard_3x3'] as Variant[]).map(v => (
                  <button
                    key={v}
                    className={`${localStyles.variantBtn} ${variant === v ? localStyles.selected : ''}`}
                    onClick={() => setVariant(v)}
                  >
                    {v === 'ultimate_ttt' ? 'Ultimate TTT' : 'Standard 3×3'}
                  </button>
                ))}
              </div>
            </div>

            <div className={localStyles.variantRow}>
              <p className={localStyles.variantLabel}>Difficulty</p>
              <div className={styles.diffRow}>
                {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                  <button
                    key={d}
                    className={`${styles.diffBtn} ${difficulty === d ? styles.selected : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className={localStyles.variantRow}>
              <p className={localStyles.variantLabel}>Play as</p>
              <div className={styles.sideRow}>
                {(['X', 'O'] as Player[]).map(p => (
                  <button
                    key={p}
                    className={`${styles.sideBtn} ${humanPlayer === p ? styles.selected : ''}`}
                    onClick={() => setHumanPlayer(p)}
                  >
                    {p} {p === 'X' ? '(First)' : '(Second)'}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="You"
            />

            <Button onClick={startGame} full>Start Game</Button>
          </div>
        </Card>
      )}

      {(phase === 'playing' || phase === 'over') && gameState && (
        <div className={localStyles.game}>
          <div className={localStyles.scoreboard}>
            <div className={localStyles.scoreCard}>
              <span className={localStyles.scoreName}>{playerName} ({humanPlayer})</span>
              <span className={`${localStyles.scoreValue} ${humanPlayer === 'X' ? localStyles.x : localStyles.o}`}>{scores.human}</span>
            </div>
            <div className={localStyles.scoreCard}>
              <span className={localStyles.scoreName}>Draws</span>
              <span className={localStyles.scoreValue}>{scores.draws}</span>
            </div>
            <div className={localStyles.scoreCard}>
              <span className={localStyles.scoreName}>AI ({aiPlayer}) · {DIFFICULTY_LABELS[difficulty]}</span>
              <span className={`${localStyles.scoreValue} ${aiPlayer === 'X' ? localStyles.x : localStyles.o}`}>{scores.ai}</span>
            </div>
          </div>

          {phase === 'playing' && (
            <div className={styles.thinking}>
              {aiThinking ? (
                <>
                  <div className={styles.thinkingDot} />
                  AI is thinking…
                </>
              ) : (
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Your turn ({humanPlayer})</span>
              )}
            </div>
          )}

          {phase === 'over' && terminal && (
            <div className={localStyles.gameOver}>
              <p className={`${localStyles.gameOverTitle} ${!terminal.winner ? localStyles.draw : ''}`}>
                {terminal.winner === humanPlayer ? 'You win!'
                  : terminal.winner === aiPlayer ? 'AI wins.'
                  : "It's a draw!"}
              </p>
              <div className={localStyles.gameActions}>
                <Button onClick={startGame}>Play again</Button>
                <Button variant="secondary" onClick={() => setPhase('setup')}>Change settings</Button>
              </div>
            </div>
          )}

          <div className={localStyles.boardWrap}>
            {variant === 'ultimate_ttt' ? (
              <UltimateBoard
                boards={(gameState as UltimateTTTState).boards}
                boardResults={(gameState as UltimateTTTState).boardResults}
                nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
                currentPlayer={gameState.currentPlayer}
                disabled={!isMyTurn}
                onMove={handleMove}
              />
            ) : (
              <StandardBoard
                board={(gameState as StandardTTTState).board}
                currentPlayer={gameState.currentPlayer}
                disabled={!isMyTurn}
                onMove={(_, cellIndex) => handleMove(0, cellIndex)}
              />
            )}
          </div>
        </div>
      )}

      <Link href="/" className={localStyles.backLink}>← Back to lobby</Link>
    </div>
  );
}
```

- [ ] **Step 5.3: Add "Play vs AI" link to lobby**

In `apps/web/src/app/page.tsx`, below the "Play locally" link:
```tsx
<p className={styles.localLink}>
  Want to practice? <Link href="/vs-ai">Play vs AI →</Link>
</p>
```

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/src/app/vs-ai/
git commit -m "feat(web): add vs AI game page with difficulty selection"
```

---

## Task 6: Puzzle Data + Puzzle Browser

Puzzles are pre-computed positions where the correct move is known. They are stored in a static JSON file — no backend needed for MVP puzzle mode.

**Files:**
- Create: `apps/web/src/data/puzzles.json`
- Create: `apps/web/src/app/puzzles/page.tsx`
- Create: `apps/web/src/app/puzzles/[id]/page.tsx`

- [ ] **Step 6.1: Create `apps/web/src/data/puzzles.json`**

Start with 10 hand-crafted Ultimate TTT positions. Each puzzle has:
- A starting game state (serialized)
- The player to move
- The correct move(s) (can be multiple if equally good)
- A difficulty rating
- A description

```json
[
  {
    "id": "uttt-001",
    "title": "Force the Center",
    "description": "You're X. One move wins the top-right mini-board and sends your opponent to the center.",
    "variant": "ultimate_ttt",
    "difficulty": 1,
    "player": "X",
    "stateJson": "...",
    "correctMoves": [{"boardIndex": 2, "cellIndex": 4}],
    "hint": "Winning the top-right board forces your opponent to the center board."
  }
]
```

For the MVP, create 5–10 puzzles. Populate `stateJson` by running games in the local play page and serializing states using `engine.serialize(state)`.

- [ ] **Step 6.2: Create `apps/web/src/app/puzzles/page.tsx`**

Grid of puzzle cards. Each card shows: title, variant, difficulty (1–5 stars), completion status (localStorage).

```tsx
'use client';

import Link from 'next/link';
import puzzles from '@/data/puzzles.json';
import styles from './page.module.css';

export default function PuzzlesPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Puzzles</h1>
      <p className={styles.subtitle}>Find the best move. Train your pattern recognition.</p>

      <div className={styles.grid}>
        {puzzles.map(p => (
          <Link key={p.id} href={`/puzzles/${p.id}`} className={styles.puzzleCard}>
            <span className={styles.puzzleTitle}>{p.title}</span>
            <span className={styles.puzzleMeta}>{p.variant === 'ultimate_ttt' ? 'Ultimate TTT' : 'Standard 3×3'}</span>
            <span className={styles.stars}>{'★'.repeat(p.difficulty)}{'☆'.repeat(5 - p.difficulty)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: Create `apps/web/src/app/puzzles/[id]/page.tsx`**

Loads the puzzle state, renders the board as interactive. When the human makes a move:
- If it matches `correctMoves` → show "Correct!" and mark complete in localStorage
- If not → show "Wrong move, try again" and reset to the puzzle position

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { UltimateTTT, StandardTTT } from '@tactictoe/game-engine';
import UltimateBoard from '@/components/board/UltimateBoard';
import StandardBoard from '@/components/board/StandardBoard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import puzzlesData from '@/data/puzzles.json';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import styles from './page.module.css';

const engines = {
  ultimate_ttt: new UltimateTTT(),
  standard_3x3: new StandardTTT(),
};

export default function PuzzlePage() {
  const { id } = useParams<{ id: string }>();
  const puzzle = puzzlesData.find(p => p.id === id);
  if (!puzzle) notFound();

  const engine = engines[puzzle.variant as keyof typeof engines];
  const initialState = engine.deserialize(puzzle.stateJson);

  const [state, setState] = useState(initialState);
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [showHint, setShowHint] = useState(false);

  const handleMove = useCallback((boardIndex: number, cellIndex: number) => {
    if (status !== 'playing') return;

    const isCorrect = puzzle.correctMoves.some(
      m => m.boardIndex === boardIndex && m.cellIndex === cellIndex
    );

    if (isCorrect) {
      setStatus('correct');
      // Mark complete in localStorage
      try {
        const key = `puzzle:${puzzle.id}:complete`;
        localStorage.setItem(key, '1');
      } catch {}
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('playing'), 1200);
    }
  }, [puzzle, status]);

  const reset = () => {
    setState(initialState);
    setStatus('playing');
    setShowHint(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/puzzles" className={styles.back}>← Puzzles</Link>
        <h1 className={styles.title}>{puzzle.title}</h1>
        <p className={styles.description}>{puzzle.description}</p>
        <p className={styles.toMove}>
          {puzzle.player} to move
        </p>
      </div>

      {status === 'correct' && (
        <div className={styles.correct}>Correct! ✓</div>
      )}
      {status === 'wrong' && (
        <div className={styles.wrong}>Wrong move — try again</div>
      )}

      <div className={styles.boardWrap}>
        {puzzle.variant === 'ultimate_ttt' ? (
          <UltimateBoard
            boards={(state as UltimateTTTState).boards}
            boardResults={(state as UltimateTTTState).boardResults}
            nextBoardConstraint={(state as UltimateTTTState).nextBoardConstraint}
            currentPlayer={state.currentPlayer}
            disabled={status === 'correct'}
            onMove={handleMove}
          />
        ) : (
          <StandardBoard
            board={(state as StandardTTTState).board}
            currentPlayer={state.currentPlayer}
            disabled={status === 'correct'}
            onMove={(_, cellIndex) => handleMove(0, cellIndex)}
          />
        )}
      </div>

      <div className={styles.actions}>
        {!showHint && status !== 'correct' && (
          <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>Show hint</Button>
        )}
        {showHint && (
          <p className={styles.hint}>{puzzle.hint}</p>
        )}
        <Button variant="secondary" size="sm" onClick={reset}>Reset</Button>
        {status === 'correct' && (
          <Button as="a" href="/puzzles">Next puzzle →</Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Create puzzle CSS files**

`apps/web/src/app/puzzles/page.module.css` and `apps/web/src/app/puzzles/[id]/page.module.css` with appropriate styles following the design system tokens.

- [ ] **Step 6.5: Add Puzzles link to Nav**

In `Nav.tsx`, add:
```tsx
<Link href="/puzzles">Puzzles</Link>
```

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/app/puzzles/ apps/web/src/data/puzzles.json apps/web/src/components/Nav.tsx
git commit -m "feat(web): add puzzle mode with hint system and localStorage completion tracking"
```

---

## Task 7: Deploy + Verify

- [ ] **Step 7.1: Build everything**

```bash
pnpm build
```

Fix any TypeScript issues. Common ones:
- Worker import path resolution in Next.js
- Game engine type exports (ensure `AIDifficulty`, `StandardTTTState` etc. are exported)

- [ ] **Step 7.2: Push**

```bash
git push origin main
```

- [ ] **Step 7.3: Manual test checklist**

- [ ] Vs AI: Easy mode — AI makes reasonable but beatable moves with 300ms delay
- [ ] Vs AI: Hard mode — AI is challenging, thinking indicator shows during MCTS
- [ ] Vs AI: Playing as O — AI (X) moves first automatically
- [ ] Vs AI: Rematch works, scores persist across rematches
- [ ] Puzzles: Correct move shows success, wrong move shows error and allows retry
- [ ] Puzzles: Hint shows on request
- [ ] Puzzles: Completion saved to localStorage (puzzle card shows as complete on browse page)

---

## Checklist

- [ ] Task 1: Standard TTT minimax AI
- [ ] Task 2: MCTS core implementation
- [ ] Task 3: Ultimate TTT MCTS AI
- [ ] Task 4: Web Worker wrapper + useAI hook
- [ ] Task 5: Vs AI page
- [ ] Task 6: Puzzle data + puzzle browser + puzzle solver
- [ ] Task 7: Deploy + verify
