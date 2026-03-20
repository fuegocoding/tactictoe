import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import styles from './page.module.css';

interface Props {
  params: { id: string };
}

interface MoveRecord { boardIndex: number; cellIndex: number; player: 'X' | 'O' }

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

function resultLabel(winner: string | null, reason: string, p1Symbol: 'X' | 'O', p1Name: string, p2Name: string): string {
  if (reason === 'draw') return 'Draw';
  if (reason === 'forfeit') {
    const winnerName = winner === p1Symbol ? p1Name : p2Name;
    return `${winnerName} wins by forfeit`;
  }
  const winnerName = winner === p1Symbol ? p1Name : p2Name;
  return `${winnerName} wins`;
}

export default async function MatchPage({ params }: Props) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      player1: { include: { profile: { select: { username: true } } } },
      player2: { include: { profile: { select: { username: true } } } },
    },
  });
  if (!match) notFound();

  const p1Symbol: 'X' | 'O' = 'X';
  const p1Username = match.player1?.profile?.username ?? null;
  const p2Username = match.player2?.profile?.username ?? null;

  const result = resultLabel(match.winner, match.reason, p1Symbol, match.player1Name, match.player2Name);
  const moves = (match.moveHistory as MoveRecord[] | null) ?? null;

  // Build two-column move rows: [[x_move, o_move], ...]
  const moveRows: Array<{ num: number; x: string; o: string }> = [];
  if (moves) {
    for (let i = 0; i < moves.length; i += 2) {
      const pair = moves.slice(i, i + 2);
      const fmt = (m: MoveRecord) => `b${m.boardIndex + 1}c${m.cellIndex + 1}`;
      moveRows.push({ num: Math.floor(i / 2) + 1, x: pair[0] ? fmt(pair[0]) : '', o: pair[1] ? fmt(pair[1]) : '' });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.variant}>{VARIANT_LABELS[match.variantId] ?? match.variantId}</p>
        <p className={styles.date}>{match.createdAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
      </div>

      <div className={styles.players}>
        <div className={`${styles.player} ${match.winner === 'X' ? styles.winner : ''}`}>
          <span className={styles.symbol} style={{ color: 'var(--mark-x)' }}>X</span>
          {p1Username
            ? <Link href={`/profile/${p1Username}`} className={styles.playerName}>{match.player1Name}</Link>
            : <span className={styles.playerName}>{match.player1Name}</span>
          }
          {match.ratingDelta1 !== null && (
            <span className={styles.delta} style={{ color: (match.ratingDelta1 ?? 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {(match.ratingDelta1 ?? 0) > 0 ? '+' : ''}{match.ratingDelta1}
            </span>
          )}
        </div>
        <span className={styles.vs}>vs</span>
        <div className={`${styles.player} ${match.winner === 'O' ? styles.winner : ''}`}>
          <span className={styles.symbol} style={{ color: 'var(--mark-o)' }}>O</span>
          {p2Username
            ? <Link href={`/profile/${p2Username}`} className={styles.playerName}>{match.player2Name}</Link>
            : <span className={styles.playerName}>{match.player2Name}</span>
          }
          {match.ratingDelta2 !== null && (
            <span className={styles.delta} style={{ color: (match.ratingDelta2 ?? 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {(match.ratingDelta2 ?? 0) > 0 ? '+' : ''}{match.ratingDelta2}
            </span>
          )}
        </div>
      </div>

      <p className={styles.result}>{result}</p>

      <section className={styles.movesSection}>
        <h2 className={styles.sectionTitle}>Move History</h2>
        {moves === null ? (
          <p className={styles.noHistory}>Move history not available for this match.</p>
        ) : moves.length === 0 ? (
          <p className={styles.noHistory}>No moves recorded.</p>
        ) : (
          <div className={styles.movesTable}>
            <div className={styles.movesHeader}>
              <span>#</span><span>X</span><span>O</span>
            </div>
            {moveRows.map(row => (
              <div key={row.num} className={styles.moveRow}>
                <span className={styles.moveNum}>{row.num}.</span>
                <span>{row.x}</span>
                <span className={styles.moveO}>{row.o}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
