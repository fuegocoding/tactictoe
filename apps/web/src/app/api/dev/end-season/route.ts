import { NextResponse } from 'next/server';
import { concludeSeason } from '@/lib/season';

export async function POST(req: Request) {
  // Verify Admin Secret
  const authHeader = req.headers.get('Authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await concludeSeason();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
