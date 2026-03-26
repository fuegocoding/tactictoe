import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { GAME_VARIANTS } from '@tactictoe/game-engine';
import Avatar from '@/components/Avatar';
import LeaderboardFilters from '@/components/LeaderboardFilters';
import styles from './page.module.css';

interface Props {
  searchParams: { period?: string; variant?: string; season?: string };
}

const VALID_VARIANTS = GAME_VARIANTS.map(v => v.id);
const VARIANT_LABELS: Record<string, string> = Object.fromEntries(GAME_VARIANTS.map(v => [v.id, v.name]));

async function getLeaderboardRows(variantId: string, period: string, seasonId?: string) {
  if (seasonId) {
    const season = await (prisma as any).season.findUnique({ where: { id: seasonId } });
    if (season && !season.isActive) {
      const snapshots = await (prisma as any).leaderboardSnapshot.findMany({
        where: { seasonId, variantId },
        orderBy: { finalRating: 'desc' },
        take: 50,
        include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
      });
      return snapshots.map((s: any) => ({
        id: s.id,
        userId: s.userId,
        variantId: s.variantId,
        rating: s.finalRating,
        rd: 0,
        wins: '-',
        losses: '-',
        draws: '-',
        user: s.user
      })).filter((r: any) => r.user.profile !== null);
    }
  }

  if (period === 'all') {
    const ratings = await prisma.rating.findMany({
      where: { variantId },
      orderBy: { rating: 'desc' },
      take: 50,
      include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
    });
    return ratings.filter((r: any) => r.user.profile !== null);
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

  const activeUserIds = Array.from(new Set([
    ...p1Rows.map((r: any) => r.player1Id!),
    ...p2Rows.map((r: any) => r.player2Id!),
  ]));

  if (activeUserIds.length === 0) return [];

  const ratings = await prisma.rating.findMany({
    where: { variantId, userId: { in: activeUserIds } },
    orderBy: { rating: 'desc' },
    take: 50,
    include: { user: { include: { profile: { select: { username: true, displayName: true } } } } },
  });
  return ratings.filter((r: any) => r.user.profile !== null);
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const period = ['all', 'month', 'week'].includes(searchParams.period ?? '') ? (searchParams.period ?? 'all') : 'all';
  const variantId = VALID_VARIANTS.includes(searchParams.variant ?? '') ? (searchParams.variant ?? 'ultimate_ttt') : 'ultimate_ttt';
  const seasonId = searchParams.season ?? undefined;

  const rows = await Promise.all([
    getLeaderboardRows(variantId, period, seasonId),
    (prisma as any).season.findMany({ orderBy: { number: 'desc' } })
  ]).then(([r, s]) => {
    return { rows: r, seasons: s };
  });
  
  const activeSeason = rows.seasons.find((s: any) => s.isActive);
  const currentSeasonId = seasonId || activeSeason?.id;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.subtitle}>{VARIANT_LABELS[variantId]} · Top players</p>
      </div>

      <Suspense>
        <LeaderboardFilters period={period} variant={variantId} currentSeasonId={currentSeasonId} seasons={rows.seasons} />
      </Suspense>

      {rows.rows.length === 0 ? (
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
          {rows.rows.map((r: any, i: number) => {
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
