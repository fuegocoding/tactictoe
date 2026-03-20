'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import puzzlesData from '@/data/puzzles.json';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { Player } from '@tactictoe/game-engine';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

type PuzzleStatus = 'idle' | 'correct' | 'wrong';

const STORAGE_KEY = 'tactictoe:puzzle-solved';

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

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (status !== 'idle') return;

    const sol = puzzle.solution;
    const correct = sol.boardIndex === boardIndex && sol.cellIndex === cellIndex;

    if (correct) {
      markSolved(puzzle.id);
      setAlreadySolved(true);
      setStatus('correct');
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('idle'), 1200);
    }
  };

  const nextPuzzle = (puzzlesData as typeof puzzlesData)[
    (puzzlesData as typeof puzzlesData).findIndex(p => p.id === id) + 1
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/puzzles" className={styles.backLink}>← All puzzles</Link>
        <div className={styles.meta}>
          <span className={styles.variant}>
            {isUlt ? 'Ultimate TTT' : 'Standard 3×3'}
          </span>
          <span className={styles.dot}>·</span>
          <span className={styles.player}>
            {puzzle.player} to move
          </span>
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
          {nextPuzzle ? (
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
