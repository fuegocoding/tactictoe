import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const PRICES: Record<string, number> = {
  'Classic': 0,
  'Midnight Dark': 100,
  'Forest Slate': 200,
  'Neon Cyber': 350,
  'Cherry Wood': 500,
  'Aurum': 800,
  'Donuts': 50,
  'Space': 100,
  'Cosmic': 150,
  'Fruit': 200,
  'Animals': 300,
  'Plants': 400,
  'Royalty': 600,
  'Fire & Ice': 750,
  'Dark Arts': 1000,
  'Classic Line': 0,
  'Neon Glow': 100,
  'Fire Line': 300,
  'Gold Strike': 600,
  'Void': 900,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { name: string; price: number; updated: number }[] = [];

  for (const [name, price] of Object.entries(PRICES)) {
    const result = await (prisma as any).cosmetic.updateMany({
      where: { name },
      data: { price, requiredScore: 0 },
    });
    results.push({ name, price, updated: result.count });
  }

  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  return NextResponse.json({ ok: true, totalUpdated, results });
}
