import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ rating: null });
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variant') ?? 'ultimate_ttt';
  const rating = await prisma.rating.findUnique({
    where: { userId_variantId: { userId: session.user.id, variantId } },
    select: { rating: true, rd: true, wins: true, losses: true, draws: true },
  });
  return NextResponse.json({ rating });
}
