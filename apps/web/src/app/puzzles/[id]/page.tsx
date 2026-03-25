'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import puzzlesData from '@/data/puzzles.json';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import { ThreeDBoard } from '@/components/board/ThreeDBoard';
import { FourDBoard } from '@/components/board/FourDBoard';
import { TacticToeBoard } from '@/components/board/TacticToeBoard';
import { Ultimate3DBoard } from '@/components/board/Ultimate3DBoard';
import {
  StandardTTT, MisereTTT, Gomoku, VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, UltimateTTT, Ultimate3D,
} from '@tactictoe/game-engine';
import type {
  StandardTTTState, UltimateTTTState, GomokuState, VanishingTTTState,
  TTT3DState, TTT4DState, OrderChaosState, TacticToeState, Ultimate3DState,
  Player, GameState, GameRules,
} from '@tactictoe/game-engine';
import Button from '@/components/ui/Button';
import styles from './page.module.css';
import { markDailySolved, getDailyPuzzleId } from '@/lib/puzzle-of-the-day';

// ---------- types ----------

type Feedback = 'correct' | 'wrong' | 'solved' | null;

type SolutionStep = {
  moves: Record<string, unknown>[];
  response?: Record<string, unknown>;
};

type Puzzle = {
  id: string;
  title: string;
  description: string;
  variant: string;
  difficulty: string;
  player: string;
  state: Record<string, unknown>;
  solution: SolutionStep[];
};

// ---------- constants ----------

const STORAGE_KEY = 'tactictoe:puzzle-solved';

const VARIANT_LABEL: Record<string, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère',
  gomoku: 'Gomoku',
  vanishing_ttt: 'Vanishing',
  ttt_3d: '3D TTT',
  ttt_4d: '4D TTT',
  order_chaos: 'Order & Chaos',
  tactic_toe: 'Tactic Toe',
  ultimate_3d: 'Ultimate 3D',
};

const ENGINES: Record<string, GameRules> = {
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

// ---------- storage helpers ----------

function getSolvedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSolved(id: string) {
  try {
    const set = getSolvedSet();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

// ---------- move matching ----------

function movesMatch(candidate: Record<string, unknown>, target: Record<string, unknown>): boolean {
  const cKeys = Object.keys(candidate);
  const tKeys = Object.keys(target);
  if (cKeys.length !== tKeys.length) return false;
  return tKeys.every(k => candidate[k] === target[k]);
}

function stepMatches(candidate: Record<string, unknown>, step: SolutionStep): boolean {
  return step.moves.some(m => movesMatch(candidate, m));
}

// ---------- component ----------

export default function PuzzleSolverPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === '1';

  const puzzle = (puzzlesData as Puzzle[]).find(p => p.id === id);

  // Validate last step has no response
  if (puzzle) {
    const last = puzzle.solution[puzzle.solution.length - 1];
    if (last?.response) console.warn(`[puzzle ${puzzle.id}] last step has response — will be skipped`);
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [boardState, setBoardState] = useState<GameState | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [alreadySolved, setAlreadySolved] = useState(false);

  // tactic_toe state
  const [tacticMode, setTacticMode] = useState<'place' | 'move_obstacle'>('place');
  const [selectedObstacle, setSelectedObstacle] = useState<number | null>(null);

  // order_chaos state
  const [selectedSymbol, setSelectedSymbol] = useState<'X' | 'O'>('X');

  useEffect(() => {
    if (!puzzle) return;
    setBoardState(puzzle.state as unknown as GameState);
    setCurrentStep(0);
    setFeedback(null);
    setAlreadySolved(getSolvedSet().has(id));
  }, [id, puzzle]);

  const handleSolved = useCallback((puzzleId: string) => {
    markSolved(puzzleId);
    setAlreadySolved(true);
    if (isDaily || getDailyPuzzleId() === puzzleId) markDailySolved(puzzleId);
    setFeedback('solved');
  }, [isDaily]);

  const processMove = useCallback((moveData: Record<string, unknown>) => {
    if (!puzzle || !boardState || feedback !== null) return;

    const step = puzzle.solution[currentStep];
    if (!step) return;

    if (!stepMatches(moveData, step)) {
      setFeedback('wrong');
      // Reset tactic_toe obstacle selection on wrong move
      if (puzzle.variant === 'tactic_toe') setSelectedObstacle(null);
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    // Correct move — apply to board state via engine
    const engine = ENGINES[puzzle.variant];
    if (!engine) return;

    const pr = engine.applyMove(boardState, { data: moveData }, boardState.currentPlayer);
    if (!pr.ok) return;

    let nextState = pr.state;
    const nextStep = currentStep + 1;
    const isLastStep = nextStep >= puzzle.solution.length;

    const advance = (state: GameState) => {
      setBoardState(state);
      setCurrentStep(nextStep);
      if (isLastStep) {
        handleSolved(puzzle.id);
      } else {
        setFeedback('correct');
        setTimeout(() => setFeedback(null), 800);
      }
    };

    // Apply scripted response if present (and not last step)
    if (step.response && !isLastStep) {
      setTimeout(() => {
        const rr = engine.applyMove(nextState, { data: step.response! }, nextState.currentPlayer);
        if (rr.ok) advance(rr.state);
        else advance(nextState);
      }, 400);
    } else {
      advance(nextState);
    }
  }, [puzzle, boardState, feedback, currentStep, handleSolved]);

  // ---------- per-variant move handlers ----------

  const handleStandardMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex });
  };

  const handleUltimateMove = (boardIndex: number, cellIndex: number) => {
    processMove({ boardIndex, cellIndex });
  };

  const handleGridMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex });
  };

  const handleOrderChaosMove = (_: number, cellIndex: number) => {
    processMove({ cellIndex, symbol: selectedSymbol });
  };

  const handle3DMove = (boardIndex: number, cellIndex: number) => {
    // Convert (layer, withinLayer) → flat globalIndex (engine expects flat)
    processMove({ cellIndex: boardIndex * 9 + cellIndex });
  };

  const handle4DMove = (boardIndex: number, cellIndex: number) => {
    processMove({ cellIndex: boardIndex * 9 + cellIndex });
  };

  const handleUltimate3DMove = (macroCell: number, microCell: number) => {
    processMove({ macroCell, microCell });
  };

  const handleTacticCell = (globalIndex: number) => {
    if (!boardState || feedback !== null) return;
    const state = boardState as TacticToeState;

    if (tacticMode === 'place') {
      processMove({ type: 'place', cellIndex: globalIndex });
    } else {
      if (selectedObstacle === null) {
        if ((state.board as unknown[])[globalIndex] === 'B') setSelectedObstacle(globalIndex);
      } else {
        if ((state.board as unknown[])[globalIndex] === null) {
          processMove({ type: 'move_obstacle', fromCell: selectedObstacle, toCell: globalIndex });
          setSelectedObstacle(null);
        } else if ((state.board as unknown[])[globalIndex] === 'B') {
          setSelectedObstacle(globalIndex); // re-select obstacle
        } else {
          setSelectedObstacle(null);
        }
      }
    }
  };

  // ---------- vanishing TTT board rendering ----------
  // Use state.moveCount directly (engine sets moveDates[i] = moveCount+1 when piece placed)
  function getVanishingBoard(state: VanishingTTTState): (string | null)[] {
    return (state.board as (string | null)[]).map((cell, i) => {
      if (cell === null) return null;
      const moveDates = (state as unknown as { moveDates: (number | null)[] }).moveDates;
      const age = state.moveCount - (moveDates[i] ?? 0);
      return age > VANISHING_FADE_AFTER ? null : cell;
    });
  }

  // ---------- render ----------

  if (!puzzle || !boardState) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Puzzle not found.</p>
        <Link href="/puzzles" className={styles.backLink}>← Back to puzzles</Link>
      </div>
    );
  }

  const isDisabled = feedback !== null;
  const variantLabel = VARIANT_LABEL[puzzle.variant] ?? puzzle.variant;
  const isMultiStep = puzzle.solution.length > 1;
  const nextPuzzle = (puzzlesData as Puzzle[])[(puzzlesData as Puzzle[]).findIndex(p => p.id === id) + 1];
  const currentPlayer = boardState.currentPlayer as Player;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/puzzles" className={styles.backLink}>← All puzzles</Link>
        {isDaily && (
          <div style={{ padding: 'var(--space-1) var(--space-3)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center' }}>
            ★ Puzzle of the Day
          </div>
        )}
        <div className={styles.meta}>
          <span className={styles.variant}>{variantLabel}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.player}>{puzzle.player} to move</span>
          {alreadySolved && <span className={styles.solvedBadge}>Solved ✓</span>}
        </div>
        <h1 className={styles.title}>{puzzle.title}</h1>
        <p className={styles.description}>{puzzle.description}</p>
      </div>

      {isMultiStep && feedback !== 'solved' && (
        <div className={styles.stepIndicator}>
          Step {currentStep + 1} of {puzzle.solution.length}
        </div>
      )}

      {feedback === 'correct' && (
        <div className={styles.resultBanner} data-result="correct">Correct! Keep going.</div>
      )}
      {feedback === 'wrong' && (
        <div className={styles.resultBanner} data-result="wrong">Not quite — try again.</div>
      )}
      {feedback === 'solved' && (
        <div className={styles.resultBanner} data-result="correct">Correct! Well played.</div>
      )}

      {/* Order & Chaos symbol picker */}
      {puzzle.variant === 'order_chaos' && feedback !== 'solved' && (
        <div className={styles.symbolPicker}>
          <span className={styles.symbolPickerLabel}>Place:</span>
          <button
            className={`${styles.symbolBtn} ${selectedSymbol === 'X' ? styles.symbolBtnActive : ''}`}
            onClick={() => setSelectedSymbol('X')}
          >X</button>
          <button
            className={`${styles.symbolBtn} ${selectedSymbol === 'O' ? styles.symbolBtnActive : ''}`}
            onClick={() => setSelectedSymbol('O')}
          >O</button>
        </div>
      )}

      {/* Tactic Toe mode toggle */}
      {puzzle.variant === 'tactic_toe' && feedback !== 'solved' && (
        <div className={styles.symbolPicker}>
          <button
            className={`${styles.symbolBtn} ${tacticMode === 'place' ? styles.symbolBtnActive : ''}`}
            onClick={() => { setTacticMode('place'); setSelectedObstacle(null); }}
          >Place</button>
          <button
            className={`${styles.symbolBtn} ${tacticMode === 'move_obstacle' ? styles.symbolBtnActive : ''}`}
            onClick={() => setTacticMode('move_obstacle')}
          >Move Obstacle</button>
        </div>
      )}

      <div className={styles.boardWrap}>
        {puzzle.variant === 'ultimate_ttt' ? (
          <UltimateBoard
            boards={(boardState as UltimateTTTState).boards}
            boardResults={(boardState as UltimateTTTState).boardResults}
            nextBoardConstraint={(boardState as UltimateTTTState).nextBoardConstraint ?? null}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleUltimateMove}
          />
        ) : puzzle.variant === 'gomoku' ? (
          <GridBoard
            board={(boardState as GomokuState).board}
            cols={15} rows={15}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleGridMove}
          />
        ) : puzzle.variant === 'ttt_3d' ? (
          <ThreeDBoard
            board={(boardState as TTT3DState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handle3DMove}
          />
        ) : puzzle.variant === 'ttt_4d' ? (
          <FourDBoard
            board={(boardState as TTT4DState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handle4DMove}
          />
        ) : puzzle.variant === 'order_chaos' ? (
          <GridBoard
            board={(boardState as OrderChaosState).board}
            cols={6} rows={6}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleOrderChaosMove}
          />
        ) : puzzle.variant === 'tactic_toe' ? (
          <TacticToeBoard
            board={(boardState as TacticToeState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            moveMode={tacticMode}
            selectedObstacle={selectedObstacle}
            onCellClick={handleTacticCell}
          />
        ) : puzzle.variant === 'ultimate_3d' ? (
          <Ultimate3DBoard
            microBoards={(boardState as Ultimate3DState).microBoards}
            macroResults={(boardState as Ultimate3DState).macroResults}
            nextMacroConstraint={(boardState as Ultimate3DState).nextMacroConstraint}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleUltimate3DMove}
          />
        ) : puzzle.variant === 'vanishing_ttt' ? (
          <StandardBoard
            board={getVanishingBoard(boardState as VanishingTTTState) as any}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleStandardMove}
          />
        ) : (
          /* standard_3x3, misere_ttt */
          <StandardBoard
            board={(boardState as StandardTTTState).board}
            currentPlayer={currentPlayer}
            disabled={isDisabled}
            onMove={handleStandardMove}
          />
        )}
      </div>

      {feedback === 'solved' && (
        <div className={styles.actions}>
          {isDaily ? (
            <Link href="/puzzles"><Button>Back to puzzles</Button></Link>
          ) : nextPuzzle ? (
            <Link href={`/puzzles/${nextPuzzle.id}`}><Button>Next puzzle →</Button></Link>
          ) : (
            <Link href="/puzzles"><Button>Back to puzzles</Button></Link>
          )}
        </div>
      )}
    </div>
  );
}
