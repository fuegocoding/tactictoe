import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  let cosmetics = await (prisma as any).cosmetic.findMany({
    orderBy: { requiredScore: 'asc' }
  });

  if (cosmetics.length === 0) {
    const DEFAULT_COSMETICS = [
      { id: 'board_default', name: 'Starter Board', type: 'board', cssValue: '{}', requiredScore: 0 },
      { id: 'board_cherry', name: 'Cherry Wood', type: 'board', cssValue: '{"--board-cell-bg":"#4A2E2B","--board-cell-border":"#8B3A33"}', requiredScore: 1200 },
      { id: 'board_neon', name: 'Cyber Neon', type: 'board', cssValue: '{"--board-cell-bg":"#0A0A12","--board-cell-border":"#00FFCC","--board-active-border":"#FF00FF"}', requiredScore: 1400 },
      { id: 'board_gold', name: 'Aurum Prestige', type: 'board', cssValue: '{"--board-cell-bg":"#191919","--board-cell-border":"#FFD700","--board-active-border":"#FFF8DC"}', requiredScore: 1600 },
      
      { id: 'piece_default', name: 'Starter Marks', type: 'piece', cssValue: '{}', requiredScore: 0 },
      { id: 'piece_neon', name: 'Cyber Neon', type: 'piece', cssValue: '{"--mark-x":"#FF00FF","--mark-o":"#00FFCC"}', requiredScore: 1200 },
      { id: 'piece_pastel', name: 'Pastel Dream', type: 'piece', cssValue: '{"--mark-x":"#FFB3BA","--mark-o":"#BAE1FF"}', requiredScore: 1400 },
      { id: 'piece_ruby', name: 'Ruby & Pearl', type: 'piece', cssValue: '{"--mark-x":"#E0115F","--mark-o":"#F0EAD6"}', requiredScore: 1600 },
    ];
    await (prisma as any).cosmetic.createMany({ data: DEFAULT_COSMETICS });
    cosmetics = await (prisma as any).cosmetic.findMany({ orderBy: { requiredScore: 'asc' } });
  }

  if (!session?.user?.id) {
    return NextResponse.json({
      cosmetics: cosmetics.map((c: any) => ({
        ...c,
        isUnlocked: c.requiredScore <= 0,
        isEquipped: false
      }))
    });
  }

  const userId = session.user.id;
  const highestRating = await prisma.rating.findFirst({
    where: { userId },
    orderBy: { rating: 'desc' },
  });
  const maxScore = highestRating?.rating ?? 1500;

  const userCosmetics = await (prisma as any).userCosmetic.findMany({
    where: { userId }
  });

  const response = cosmetics.map((c: any) => {
    const uc = userCosmetics.find((u: any) => u.cosmeticId === c.id);
    const isUnlocked = c.requiredScore <= 0 || maxScore >= c.requiredScore;
    return {
      ...c,
      isUnlocked,
      isEquipped: uc?.isEquipped ?? false
    };
  });

  return NextResponse.json({ cosmetics: response });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = session.user.id;
  const { cosmeticId, equip } = await req.json();

  if (!cosmeticId || typeof equip !== 'boolean') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const cosmetic = await (prisma as any).cosmetic.findUnique({ where: { id: cosmeticId } });
  if (!cosmetic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const highestRating = await prisma.rating.findFirst({
    where: { userId },
    orderBy: { rating: 'desc' },
  });
  const maxScore = highestRating?.rating ?? 1500;

  if (cosmetic.requiredScore > 0 && maxScore < cosmetic.requiredScore) {
    return NextResponse.json({ error: 'Cosmetic remains locked. Increase your rating!' }, { status: 403 });
  }

  if (equip) {
    // Only one theme of a given type can be equipped
    const allOfType = await (prisma as any).cosmetic.findMany({ where: { type: cosmetic.type } });
    const localIds = allOfType.map((c: any) => c.id);
    await (prisma as any).userCosmetic.updateMany({
      where: { userId, cosmeticId: { in: localIds } },
      data: { isEquipped: false }
    });
  }

  const updated = await (prisma as any).userCosmetic.upsert({
    where: {
      userId_cosmeticId: { userId, cosmeticId }
    },
    update: { isEquipped: equip },
    create: { userId, cosmeticId, isEquipped: equip }
  });

  return NextResponse.json({ success: true, userCosmetic: updated });
}
