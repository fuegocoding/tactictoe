import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { evaluateAchievements } from './achievements';
import { rateGame, DEFAULT_RATING, type Rating } from '@tactictoe/glicko2';

export async function getOrCreateRating(userId: string, variantId: string): Promise<Rating & { id: string }> {
  let row = await prisma.rating.findUnique({ where: { userId_variantId: { userId, variantId } } });
  if (!row) {
    row = await prisma.rating.create({
      data: { userId, variantId, ...DEFAULT_RATING },
    });
  }
  return row;
}

export interface GameResultPayload {
  variantId: string;
  player1: { userId?: string; guestId?: string; displayName: string; playerSymbol: 'X' | 'O' };
  player2: { userId?: string; guestId?: string; displayName: string; playerSymbol: 'X' | 'O' };
  winner: 'X' | 'O' | null; // null = draw
  reason: 'win' | 'draw' | 'forfeit';
  rated: boolean;
  moveHistory?: Array<{ boardIndex: number; cellIndex: number; player: 'X' | 'O' }>;
}

export async function processGameResult(payload: GameResultPayload) {
  const { variantId, player1, player2, winner, reason, rated, moveHistory } = payload;

  // Determine outcome from player1's perspective
  const outcome1 = winner === null ? 'draw' : winner === player1.playerSymbol ? 'win' : 'loss';
  const outcome2 = winner === null ? 'draw' : winner === player2.playerSymbol ? 'win' : 'loss';

  let delta1: number | null = null;
  let delta2: number | null = null;

  // Apply ratings if both players are authenticated and the game is rated
  if (rated && player1.userId && player2.userId) {
    const [r1, r2] = await Promise.all([
      getOrCreateRating(player1.userId, variantId),
      getOrCreateRating(player2.userId, variantId),
    ]);

    const newR1 = rateGame(r1, r2, outcome1);
    const newR2 = rateGame(r2, r1, outcome2);

    delta1 = newR1.rating - r1.rating;
    delta2 = newR2.rating - r2.rating;

    // Update ratings in DB
    await Promise.all([
      prisma.rating.update({
        where: { userId_variantId: { userId: player1.userId, variantId } },
        data: {
          rating: newR1.rating,
          rd: newR1.rd,
          volatility: newR1.volatility,
          wins: outcome1 === 'win' ? { increment: 1 } : undefined,
          losses: outcome1 === 'loss' ? { increment: 1 } : undefined,
          draws: outcome1 === 'draw' ? { increment: 1 } : undefined,
        },
      }),
      prisma.rating.update({
        where: { userId_variantId: { userId: player2.userId, variantId } },
        data: {
          rating: newR2.rating,
          rd: newR2.rd,
          volatility: newR2.volatility,
          wins: outcome2 === 'win' ? { increment: 1 } : undefined,
          losses: outcome2 === 'loss' ? { increment: 1 } : undefined,
          draws: outcome2 === 'draw' ? { increment: 1 } : undefined,
        },
      }),
    ]);
  }

  // Award credits to logged in users based on outcome
  const getCredits = (outcome: 'win' | 'loss' | 'draw') => {
    if (outcome === 'win') return 10;
    if (outcome === 'draw') return 5;
    return 2;
  };

  const updates = [];
  if (player1.userId) {
    updates.push(prisma.user.update({
      where: { id: player1.userId },
      data: { credits: { increment: getCredits(outcome1) } }
    }));
  }
  if (player2.userId) {
    updates.push(prisma.user.update({
      where: { id: player2.userId },
      data: { credits: { increment: getCredits(outcome2) } }
    }));
  }

  if (updates.length > 0) {
    await Promise.all(updates).catch(console.error);
  }

  // Always record the match
  const match = await prisma.match.create({
    data: {
      variantId,
      rated: rated && !!player1.userId && !!player2.userId,
      player1Id: player1.userId ?? null,
      player2Id: player2.userId ?? null,
      player1Guest: player1.guestId ?? null,
      player2Guest: player2.guestId ?? null,
      player1Name: player1.displayName,
      player2Name: player2.displayName,
      winner,
      reason,
      ratingDelta1: delta1,
      ratingDelta2: delta2,
      moveHistory: moveHistory ?? undefined,
    },
  });

  await evaluateAchievements(payload).catch(console.error);

  return { delta1, delta2, matchId: match.id };
}
