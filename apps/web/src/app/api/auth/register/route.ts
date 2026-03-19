import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/register';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const { email, password, username } = body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string' || typeof username !== 'string') {
    return NextResponse.json(
      { error: 'email, password, and username are required strings' },
      { status: 400 }
    );
  }

  const result = await registerUser({ email, password, username });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ userId: result.userId }, { status: 201 });
}
