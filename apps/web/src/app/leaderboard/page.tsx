import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import LeaderboardFilters from '@/components/LeaderboardFilters';
import styles from './page.module.css';

interface Props {
  searchParams: { period?: string; variant?: string };
}

const VALID_VARIANTS = ['ultimate_ttt', 'standard_3x3'];
const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

async function getLeaderboardRows(variantId: string, period: string) {
  if (period === 'all') {
    const ratings = await prisma.rating.findMany({
      where: { variantId },
      orderBy: { rating: 'desc' },
      take: 50,
      include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
    });
    return ratings.filter(r => r.user.profile !== null);
  }

  const cutoff = new Date(Date.now() - (period === 'week' ? 7 : 30) * 86_400_000);

  const [p1Rows, p2Rows] = await Promise.all([
    prisma.match.findMany({
      where: { variantId, rated: true, createdAt: { gte: cutoff }, player1Id: { not: null } },
      select: { player1Id: true },
      distinct: ['player1Id'],
    }),
    prisma.match.findMany({
      where: { variantId, rated: true, createdAt: { gte: cutoff }, player2Id: { not: null } },
      select: { player2Id: true },
      distinct: ['player2Id'],
    }),
  ]);

  const activeUserIds = [...new Set([
    ...p1Rows.map(r => r.player1Id!),
    ...p2Rows.map(r => r.player2Id!),
  ])];

  if (activeUserIds.length === 0) return [];

  const ratings = await prisma.rating.findMany({
    where: { variantId, userId: { in: activeUserIds } },
    orderBy: { rating: 'desc' },
    take: 50,
    include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
  });
  return ratings.filter(r => r.user.profile !== null);
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const period = ['all', 'month', 'week'].includes(searchParams.period ?? '') ? (searchParams.period ?? 'all') : 'all';
  const variantId = VALID_VARIANTS.includes(searchParams.variant ?? '') ? (searchParams.variant ?? 'ultimate_ttt') : 'ultimate_ttt';

  const rows = await getLeaderboardRows(variantId, period);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.subtitle}>{VARIANT_LABELS[variantId]} · Top players</p>
      </div>

      <Suspense>
        <LeaderboardFilters period={period} variant={variantId} />
      </Suspense>

      {rows.length === 0 ? (
        <p className={styles.empty}>No players found for this period.</p>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>#</span>
            <span>Player</span>
            <span>Rating</span>
            <span>W</span>
            <span>L</span>
            <span>D</span>
          </div>
          {rows.map((r, i) => {
            const profile = r.user.profile!;
            return (
              <Link key={r.id} href={`/profile/${profile.username}`} className={styles.row}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.player}>
                  <Avatar username={profile.username} size={28} />
                  <span>{profile.displayName}</span>
                </span>
                <span className={styles.rating}>
                  {r.rd > 100 ? '~' : ''}{r.rating}
                </span>
                <span className={styles.stat}>{r.wins}</span>
                <span className={styles.stat}>{r.losses}</span>
                <span className={styles.stat}>{r.draws}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
