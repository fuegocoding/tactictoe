import Link from 'next/link';
import puzzles from '@/data/puzzles.json';
import styles from './page.module.css';

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'var(--success)',
  intermediate: 'var(--accent)',
  advanced: 'var(--error)',
};

export default function PuzzlesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Puzzles</h1>
        <p className={styles.subtitle}>Sharpen your tactics with these bite-sized challenges.</p>
      </div>

      <div className={styles.grid}>
        {(puzzles as typeof puzzles).map(puzzle => {
          const isUlt = puzzle.variant === 'ultimate_ttt';
          return (
            <Link key={puzzle.id} href={`/puzzles/${puzzle.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.variant}>{isUlt ? 'Ultimate TTT' : 'Standard 3×3'}</span>
                <span
                  className={styles.difficulty}
                  style={{ color: DIFFICULTY_COLOR[puzzle.difficulty] ?? 'var(--text-muted)' }}
                >
                  {puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
                </span>
              </div>
              <h2 className={styles.puzzleTitle}>{puzzle.title}</h2>
              <p className={styles.description}>{puzzle.description}</p>
              <span className={styles.cta}>Solve →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
