import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const CREDIT_MAP = { win: 10, draw: 5, loss: 2 } as const;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const outcome = body?.outcome as 'win' | 'draw' | 'loss' | undefined;
  if (!outcome || !(outcome in CREDIT_MAP)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }

  const earned = CREDIT_MAP[outcome];
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { credits: { increment: earned } },
    select: { credits: true },
  });

  return NextResponse.json({ credits: updated.credits, earned });
}
