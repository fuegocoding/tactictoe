'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import puzzles from '@/data/puzzles.json';
import { getDailyPuzzleId, isTodayDailySolved, getTodayString, msUntilNextDay } from '@/lib/puzzle-of-the-day';
import styles from './page.module.css';

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'var(--success)',
  intermediate: 'var(--accent)',
  advanced: 'var(--error)',
};

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

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PuzzlesPage() {
  const [dailyPuzzleId, setDailyPuzzleId] = useState<string | null>(null);
  const [dailySolved, setDailySolved] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = getDailyPuzzleId();
    setDailyPuzzleId(id);
    setDailySolved(isTodayDailySolved());

    // Load solved puzzles from localStorage
    try {
      const raw = localStorage.getItem('tactictoe:puzzle-solved');
      setSolvedSet(new Set(raw ? JSON.parse(raw) : []));
    } catch { /* ignore */ }

    // Countdown timer
    const tick = () => setCountdown(formatCountdown(msUntilNextDay()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const dailyPuzzle = dailyPuzzleId ? (puzzles as typeof puzzles).find(p => p.id === dailyPuzzleId) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Puzzles</h1>
        <p className={styles.subtitle}>Sharpen your tactics with these bite-sized challenges.</p>
      </div>

      {/* Puzzle of the Day */}
      {dailyPuzzle && (
        <div style={{
          background: dailySolved
            ? 'color-mix(in srgb, var(--success) 10%, var(--bg-raised))'
            : 'color-mix(in srgb, var(--accent) 10%, var(--bg-raised))',
          border: `1px solid ${dailySolved ? 'var(--success)' : 'var(--accent)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: dailySolved ? 'var(--success)' : 'var(--accent)',
                }}>
                  {dailySolved ? '✓ Puzzle of the Day — Solved!' : '★ Puzzle of the Day'}
                </span>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>{dailyPuzzle.title}</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 4 }}>{dailyPuzzle.description}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Next puzzle in</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text)' }}>
                {countdown}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {VARIANT_LABEL[dailyPuzzle.variant] ?? dailyPuzzle.variant}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: DIFFICULTY_COLOR[dailyPuzzle.difficulty] ?? 'var(--text-muted)',
            }}>
              {dailyPuzzle.difficulty}
            </span>
            <Link href={`/puzzles/${dailyPuzzle.id}?daily=1`} style={{
              padding: 'var(--space-2) var(--space-4)',
              background: dailySolved ? 'var(--success)' : 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
            }}>
              {dailySolved ? 'Play Again →' : 'Solve Now →'}
            </Link>
          </div>
        </div>
      )}

      {/* All puzzles grid */}
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>All Puzzles</h2>
        <div className={styles.grid}>
          {(puzzles as typeof puzzles).map(puzzle => {
            const solved = solvedSet.has(puzzle.id);
            return (
              <Link key={puzzle.id} href={`/puzzles/${puzzle.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.variant}>{VARIANT_LABEL[puzzle.variant] ?? puzzle.variant}</span>
                  <span className={styles.difficulty} style={{ color: DIFFICULTY_COLOR[puzzle.difficulty] ?? 'var(--text-muted)' }}>
                    {solved ? '✓ ' : ''}{puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
                  </span>
                </div>
                <h2 className={styles.puzzleTitle}>{puzzle.title}</h2>
                <p className={styles.description}>{puzzle.description}</p>
                <span className={styles.cta}>{solved ? 'Replay →' : 'Solve →'}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
