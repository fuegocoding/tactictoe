import Link from 'next/link';
import styles from './MatchCard.module.css';

export interface MatchCardData {
  id: string;
  variantId: string;
  createdAt: Date;
  winner: string | null;
  reason: string;
  player1Id: string | null;
  player1Name: string;
  player1Username: string | null;
  player2Id: string | null;
  player2Name: string;
  player2Username: string | null;
  ratingDelta1: number | null;
  ratingDelta2: number | null;
}

interface MatchCardProps {
  match: MatchCardData;
  perspectiveUserId: string;
}

function getResult(match: MatchCardData, perspectiveUserId: string): 'W' | 'L' | 'D' {
  const mySymbol = match.player1Id === perspectiveUserId ? 'X' : 'O';
  if (match.winner === null) return 'D';
  return match.winner === mySymbol ? 'W' : 'L';
}

function getDelta(match: MatchCardData, perspectiveUserId: string): number | null {
  if (match.player1Id === perspectiveUserId) return match.ratingDelta1;
  if (match.player2Id === perspectiveUserId) return match.ratingDelta2;
  return null;
}

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export default function MatchCard({ match, perspectiveUserId }: MatchCardProps) {
  const result = getResult(match, perspectiveUserId);
  const delta = getDelta(match, perspectiveUserId);
  const isP1 = match.player1Id === perspectiveUserId;
  const opponentName = isP1 ? match.player2Name : match.player1Name;
  const forfeit = match.reason === 'forfeit';

  return (
    <Link href={`/match/${match.id}`} className={styles.card}>
      <span className={`${styles.result} ${styles[result.toLowerCase() as 'w' | 'l' | 'd']}`}>
        {result}{forfeit ? '*' : ''}
      </span>
      <span className={styles.opponent}>
        {opponentName}
      </span>
      <span className={styles.variant}>{VARIANT_LABELS[match.variantId] ?? match.variantId}</span>
      <span className={styles.date}>{new Date(match.createdAt).toLocaleDateString()}</span>
      {delta !== null && (
        <span className={`${styles.delta} ${delta >= 0 ? styles.pos : styles.neg}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </Link>
  );
}
