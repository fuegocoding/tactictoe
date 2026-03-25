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
      { id: 'board_default', name: 'Classic', type: 'board', cssValue: '{}', requiredScore: 0, price: 0 },
      { id: 'board_midnight', name: 'Midnight Dark', type: 'board', cssValue: '{"--board-cell-bg":"#1a1a1a","--board-cell-border":"#2a2a2a","--board-active-border":"#f59e0b","--board-inactive-border":"#2a2a2a"}', requiredScore: 200, price: 100 },
      { id: 'board_neon', name: 'Neon Cyber', type: 'board', cssValue: '{"--board-cell-bg":"#0d0221","--board-cell-border":"#ff0055","--board-active-border":"#00ffff","--board-inactive-border":"#ff0055"}', requiredScore: 600, price: 500 },

      { id: 'piece_default', name: 'Classic', type: 'piece', cssValue: '{"--mark-x":"#1a1a1a","--mark-o":"#d97706"}', requiredScore: 0, price: 0 },
      { id: 'piece_donuts', name: 'Donuts', type: 'piece', cssValue: '{"--mark-x":"#c0392b","--mark-o":"#8e5c3a","symbolX":"🍩","symbolO":"🍫"}', requiredScore: 50, price: 50 },
      { id: 'piece_space', name: 'Space', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"Rocket","symbolO":"Globe"}', requiredScore: 100, price: 150 },
      { id: 'piece_cosmic', name: 'Cosmic', type: 'piece', cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#9b59b6","symbolX":"Star","symbolO":"Moon"}', requiredScore: 150, price: 250 },
      { id: 'piece_animals', name: 'Animals', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"Cat","symbolO":"Dog"}', requiredScore: 300, price: 400 },

      { id: 'winline_default', name: 'Classic Line', type: 'winline', cssValue: '{"--winline-color":"#3b82f6","--winline-width":"0.12","--winline-filter":"none"}', requiredScore: 0, price: 0 },
      { id: 'winline_neon', name: 'Neon Glow', type: 'winline', cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)"}', requiredScore: 150, price: 100 },
      { id: 'winline_fire', name: 'Fire Line', type: 'winline', cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)"}', requiredScore: 400, price: 300 },
      { id: 'winline_gold', name: 'Gold Strike', type: 'winline', cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)"}', requiredScore: 700, price: 800 },
    ];
    await (prisma as any).cosmetic.createMany({ data: DEFAULT_COSMETICS });
    cosmetics = await (prisma as any).cosmetic.findMany({ orderBy: { requiredScore: 'asc' } });
  }

  if (!session?.user?.id) {
    return NextResponse.json({
      credits: 0,
      cosmetics: cosmetics.map((c: any) => ({
        ...c,
        isUnlocked: c.requiredScore <= 0,
        isEquipped: false
      }))
    });
  }

  const userId = session.user.id;

  const [highestRating, userDbData, userCosmetics] = await Promise.all([
    prisma.rating.findFirst({
      where: { userId },
      orderBy: { rating: 'desc' },
    }),
    (prisma as any).user.findUnique({
      where: { id: userId },
      select: { credits: true }
    }),
    (prisma as any).userCosmetic.findMany({
      where: { userId }
    })
  ]);

  const maxScore = highestRating?.rating ?? 1500;
  const credits = userDbData?.credits ?? 0;

  const response = cosmetics.map((c: any) => {
    const uc = userCosmetics.find((u: any) => u.cosmeticId === c.id);
    const isUnlocked = c.requiredScore <= 0 || maxScore >= c.requiredScore || !!uc;
    return {
      ...c,
      isUnlocked,
      isEquipped: uc?.isEquipped ?? false
    };
  });

  return NextResponse.json({ cosmetics: response, credits });
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
