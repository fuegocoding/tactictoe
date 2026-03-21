import { prisma } from './prisma';
import type { GameResultPayload } from './ratings';

export async function evaluateAchievements(payload: GameResultPayload) {
  // Only evaluate for authenticated users
  const checks = [];
  if (payload.player1.userId) {
    checks.push(checkPlayer(payload.player1.userId, payload, payload.player1.playerSymbol));
  }
  if (payload.player2.userId) {
    checks.push(checkPlayer(payload.player2.userId, payload, payload.player2.playerSymbol));
  }
  
  await Promise.allSettled(checks);
}

async function checkPlayer(userId: string, payload: GameResultPayload, symbol: 'X' | 'O') {
  const { variantId, winner } = payload;
  const isWin = winner === symbol;
  const isDraw = winner === null;

  // Fetch current user stats
  const ratings = await (prisma as any).rating.findMany({ where: { userId } });
  const totalWins = ratings.reduce((acc: number, r: any) => acc + r.wins, 0);

  // Fetch all achievements
  const allAchievements = await (prisma as any).achievement.findMany();
  if (!allAchievements.length) return;

  // Fetch user's unlocked achievements
  const userUnlocked = await (prisma as any).userAchievement.findMany({ where: { userId } });
  const unlockedCodes = new Set(
    userUnlocked.map((ua: any) => allAchievements.find((a: any) => a.id === ua.achievementId)?.conditionCode)
  );

  const newlyUnlocked: string[] = [];

  // Evaluate conditions
  // first_game
  if (!unlockedCodes.has('first_game')) newlyUnlocked.push('first_game');
  
  // draw_game
  if (isDraw && !unlockedCodes.has('draw_game')) newlyUnlocked.push('draw_game');

  if (isWin) {
    if (!unlockedCodes.has('first_win')) newlyUnlocked.push('first_win');
    
    // We add 1 to totalWins because the ratings table might not have committed the latest win yet depending on race condition,
    // or if it did, we are safely above the threshold. We'll use totalWins + 1 just in case, or safely rely on totalWins if transactions are serial.
    // For simplicity, totalWins + 1 (optimistic).
    const effectiveWins = totalWins + 1;
    
    if (effectiveWins >= 10 && !unlockedCodes.has('win_10')) newlyUnlocked.push('win_10');
    if (effectiveWins >= 50 && !unlockedCodes.has('win_50')) newlyUnlocked.push('win_50');

    if (variantId === 'ultimate_ttt' && !unlockedCodes.has('ultimate_win')) newlyUnlocked.push('ultimate_win');
    if (variantId === 'gomoku' && !unlockedCodes.has('gomoku_win')) newlyUnlocked.push('gomoku_win');
  }

  // Insert newly unlocked
  if (newlyUnlocked.length > 0) {
    const toInsert = allAchievements.filter((a: any) => newlyUnlocked.includes(a.conditionCode));
    
    await (prisma as any).userAchievement.createMany({
      data: toInsert.map((a: any) => ({
        userId,
        achievementId: a.id
      })),
      skipDuplicates: true
    });
  }
}
