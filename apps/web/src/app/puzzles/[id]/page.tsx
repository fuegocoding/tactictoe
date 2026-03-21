'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import puzzlesData from '@/data/puzzles.json';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { Player } from '@tactictoe/game-engine';
import Button from '@/components/ui/Button';
import styles from './page.module.css';
import { markDailySolved, getDailyPuzzleId } from '@/lib/puzzle-of-the-day';

type PuzzleStatus = 'idle' | 'correct' | 'wrong';

const STORAGE_KEY = 'tactictoe:puzzle-solved';

const VARIANT_LABEL: Record<string, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère',
  gomoku: 'Gomoku',
  sos_ttt: 'SOS',
  numerical_ttt: 'Numerical',
  wild_ttt: 'Wild',
  notakto: 'Notakto',
  vanishing_ttt: 'Vanishing',
  ttt_3d: '3D TTT',
  ttt_4d: '4D TTT',
  order_chaos: 'Order & Chaos',
  tactic_toe: 'Tactic Toe',
};

const GOMOKU_BOARD_SIZE = 225; // 15x15

function getSolvedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSolved(id: string) {
  try {
    const set = getSolvedSet();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage not available
  }
}

export default function PuzzleSolverPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === '1';

  const puzzle = (puzzlesData as typeof puzzlesData).find(p => p.id === id);

  const [status, setStatus] = useState<PuzzleStatus>('idle');
  const [alreadySolved, setAlreadySolved] = useState(false);

  useEffect(() => {
    setAlreadySolved(getSolvedSet().has(id));
  }, [id]);

  if (!puzzle) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Puzzle not found.</p>
        <Link href="/puzzles" className={styles.backLink}>← Back to puzzles</Link>
      </div>
    );
  }

  const isUlt = puzzle.variant === 'ultimate_ttt';
  const isGomoku = puzzle.variant === 'gomoku';

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (status !== 'idle') return;

    const sol = puzzle.solution;
    const correct = sol.boardIndex === boardIndex && sol.cellIndex === cellIndex;

    if (correct) {
      markSolved(puzzle.id);
      setAlreadySolved(true);
      // If this is today's daily puzzle, mark it in the daily record too
      if (isDaily || getDailyPuzzleId() === puzzle.id) {
        markDailySolved(puzzle.id);
      }
      setStatus('correct');
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('idle'), 1200);
    }
  };

  const nextPuzzle = (puzzlesData as typeof puzzlesData)[
    (puzzlesData as typeof puzzlesData).findIndex(p => p.id === id) + 1
  ];

  const variantLabel = VARIANT_LABEL[puzzle.variant] ?? puzzle.variant;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/puzzles" className={styles.backLink}>← All puzzles</Link>
        {isDaily && (
          <div style={{
            padding: 'var(--space-1) var(--space-3)',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            alignSelf: 'center',
          }}>
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

      {status === 'correct' && (
        <div className={styles.resultBanner} data-result="correct">
          Correct! Well played.
        </div>
      )}
      {status === 'wrong' && (
        <div className={styles.resultBanner} data-result="wrong">
          Not quite — try again.
        </div>
      )}

      <div className={styles.boardWrap}>
        {isUlt ? (
          <UltimateBoard
            boards={(puzzle.state as UltimateTTTState).boards}
            boardResults={(puzzle.state as UltimateTTTState).boardResults}
            nextBoardConstraint={(puzzle.state as UltimateTTTState).nextBoardConstraint ?? null}
            currentPlayer={puzzle.player as Player}
            disabled={status === 'correct'}
            onMove={handleMove}
          />
        ) : isGomoku ? (
          <GridBoard
            board={(puzzle.state as StandardTTTState & { board: any[] }).board}
            cols={15}
            rows={15}
            currentPlayer={puzzle.player as Player}
            disabled={status === 'correct'}
            onMove={(_, cellIndex) => handleMove(0, cellIndex)}
          />
        ) : (
          <StandardBoard
            board={(puzzle.state as StandardTTTState).board}
            currentPlayer={puzzle.player as Player}
            disabled={status === 'correct'}
            onMove={(_, cellIndex) => handleMove(0, cellIndex)}
          />
        )}
      </div>

      {status === 'correct' && (
        <div className={styles.actions}>
          {isDaily ? (
            <Link href="/puzzles">
              <Button>Back to puzzles</Button>
            </Link>
          ) : nextPuzzle ? (
            <Link href={`/puzzles/${nextPuzzle.id}`}>
              <Button>Next puzzle →</Button>
            </Link>
          ) : (
            <Link href="/puzzles">
              <Button>Back to puzzles</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
