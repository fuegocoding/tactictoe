import { prisma } from './prisma';

export async function concludeSeason() {
  return await (prisma as any).$transaction(async (tx: any) => {
    // 1. Find the current active season
    let currentSeason = await tx.season.findFirst({
      where: { isActive: true },
      orderBy: { number: 'desc' }
    });

    if (!currentSeason) {
      // If no season exists, create Season 1 and return
      currentSeason = await tx.season.create({
        data: {
          number: 1,
          startDate: new Date(),
          isActive: true
        }
      });
      return { message: 'Initialized Season 1', season: currentSeason };
    }

    // 2. End the current season
    const endedSeason = await tx.season.update({
      where: { id: currentSeason.id },
      data: {
        isActive: false,
        endDate: new Date()
      }
    });

    // 3. Snapshot all ratings
    const ratings = await tx.rating.findMany();
    if (ratings.length > 0) {
      const snapshots = ratings.map((r: any) => ({
        seasonId: endedSeason.id,
        userId: r.userId,
        variantId: r.variantId,
        finalRating: r.rating
      }));

      await tx.leaderboardSnapshot.createMany({
        data: snapshots
      });

      // 4. Apply soft reset (bring everyone 25% closer to 1500)
      const updatePromises = ratings.map((r: any) => {
        const diff = 1500 - r.rating;
        const newRating = r.rating + (0.25 * diff);
        // Also resets RD and volatility slightly to encourage movement at season start
        return tx.rating.update({
          where: { id: r.id },
          data: {
            rating: newRating,
            rd: Math.min(350, r.rd + 50),
            wins: 0,
            losses: 0,
            draws: 0
          }
        });
      });
      await Promise.all(updatePromises);
    }

    // 5. Start new season
    const nextSeason = await tx.season.create({
      data: {
        number: endedSeason.number + 1,
        startDate: new Date(),
        isActive: true
      }
    });

    return { 
      message: `Concluded Season ${endedSeason.number}, Started Season ${nextSeason.number}`, 
      endedSeason, 
      nextSeason,
      snapshotsTaken: ratings.length
    };
  }, {
    timeout: 30000 // Increase timeout to 30 seconds for bulk operations
  });
}
