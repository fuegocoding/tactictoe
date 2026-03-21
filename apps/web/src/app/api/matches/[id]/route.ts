import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        variantId: true,
        rated: true,
        player1Name: true,
        player2Name: true,
        winner: true,
        reason: true,
        ratingDelta1: true,
        ratingDelta2: true,
        moveHistory: true,
        createdAt: true,
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (err) {
    console.error('Failed to fetch match:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
