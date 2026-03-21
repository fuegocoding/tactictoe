import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [totalUsers, totalMatches, activeGuests, totalRatings] = await Promise.all([
      prisma.user.count(),
      prisma.match.count(),
      prisma.guestSession.count({
        where: { expiresAt: { gt: new Date() } }
      }),
      prisma.rating.count()
    ]);

    return NextResponse.json({
      totalUsers,
      totalMatches,
      activeGuests,
      totalRatings
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
