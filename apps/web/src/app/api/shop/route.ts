import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { cosmeticId } = await req.json();

  if (!cosmeticId) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const cosmetic = await prisma.cosmetic.findUnique({ where: { id: cosmeticId } });
  if (!cosmetic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (cosmetic.price <= 0) {
    return NextResponse.json({ error: 'Cosmetic is free, no need to buy' }, { status: 400 });
  }

  // Check if user already owns it
  const existing = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId, cosmeticId } }
  });
  if (existing) {
    return NextResponse.json({ error: 'Already unlocked' }, { status: 400 });
  }

  // Find user and check credits
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.credits < cosmetic.price) {
    return NextResponse.json({ error: 'Not enough credits' }, { status: 403 });
  }

  // Deduct credits and unlock cosmetic in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: cosmetic.price } }
    }),
    prisma.userCosmetic.create({
      data: { userId, cosmeticId, isEquipped: false }
    })
  ]);

  return NextResponse.json({ success: true, credits: user.credits - cosmetic.price });
}
