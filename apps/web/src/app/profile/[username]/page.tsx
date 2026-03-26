import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Avatar from '@/components/Avatar';
import MatchCard, { type MatchCardData } from '@/components/MatchCard';
import styles from './page.module.css';

interface Props {
  params: { username: string };
}

const VARIANT_LABELS: Record<string, string> = {
  ultimate_ttt: 'Ultimate TTT',
  standard_3x3: 'Standard 3×3',
};

export default async function ProfilePage({ params }: Props) {
  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: { user: { include: { ratings: true } } },
  });
  if (!profile) notFound();

  const allAchievements = await (prisma as any).achievement.findMany({ orderBy: { id: 'asc' } });
  const userAchievements = await (prisma as any).userAchievement.findMany({ where: { userId: profile.userId } });
  const unlockedIds = new Set(userAchievements.map((ua: any) => ua.achievementId));

  const rawMatches = await prisma.match.findMany({
    where: { OR: [{ player1Id: profile.userId }, { player2Id: profile.userId }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      player1: { include: { profile: { select: { username: true } } } },
      player2: { include: { profile: { select: { username: true } } } },
    },
  });

  const matches: MatchCardData[] = rawMatches.map((m: any) => ({
    id: m.id,
    variantId: m.variantId,
    createdAt: m.createdAt,
    winner: m.winner,
    reason: m.reason,
    player1Id: m.player1Id,
    player1Name: m.player1Name,
    player1Username: m.player1?.profile?.username ?? null,
    player2Id: m.player2Id,
    player2Name: m.player2Name,
    player2Username: m.player2?.profile?.username ?? null,
    ratingDelta1: m.ratingDelta1,
    ratingDelta2: m.ratingDelta2,
  }));

  const memberSince = profile.user.createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Avatar username={profile.username} size={56} />
        <div>
          <h1 className={styles.displayName}>{profile.displayName}</h1>
          <p className={styles.meta}>@{profile.username} · Member since {memberSince}</p>
        </div>
      </div>

      {profile.user.ratings.length === 0 ? (
        <p className={styles.empty}>No rated games yet.</p>
      ) : (
        <div className={styles.ratings}>
          {profile.user.ratings.map((r: any) => (
            <div key={r.id} className={styles.ratingCard}>
               <p className={styles.ratingVariant}>{VARIANT_LABELS[r.variantId] ?? r.variantId}</p>
               <p className={styles.ratingValue}>{r.rd > 100 ? '~' : ''}{Math.round(r.rating)}</p>
               <p className={styles.ratingStats}>{r.wins}W · {r.losses}L · {r.draws}D</p>
            </div>
          ))}
        </div>
      )}

      <section className={styles.achievementsSection}>
        <h2 className={styles.sectionTitle}>Trophy Case</h2>
        <div className={styles.achievementsGrid}>
          {allAchievements.map((a: any) => {
            const isUnlocked = unlockedIds.has(a.id);
            return (
              <div key={a.id} className={`${styles.achievementBadge} ${!isUnlocked ? styles.locked : ''}`}>
                <div className={styles.achievementIcon}>{a.iconUrl}</div>
                <div className={styles.achievementInfo}>
                  <h4>{a.name}</h4>
                  <p>{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.matchesSection}>
        <h2 className={styles.sectionTitle}>Recent Matches</h2>
        {matches.length === 0 ? (
          <p className={styles.empty}>No recent matches.</p>
        ) : (
          <div className={styles.matchesList}>
            {matches.map(m => (
              <MatchCard key={m.id} match={m} perspectiveUserId={profile.userId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
