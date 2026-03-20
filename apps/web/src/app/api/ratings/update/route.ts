import { NextResponse } from 'next/server';
import { processGameResult, type GameResultPayload } from '@/lib/ratings';

const GAME_SERVER_SECRET = process.env['GAME_SERVER_SECRET'];

export async function POST(request: Request) {
  // Verify shared secret
  const auth = request.headers.get('x-game-server-secret');
  if (!GAME_SERVER_SECRET || auth !== GAME_SERVER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload: GameResultPayload = await request.json();

  try {
    const result = await processGameResult(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('ratings update error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
