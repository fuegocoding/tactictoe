import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateGuestId,
  generateDisplayName,
  hashIp,
  getGuestSessionExpiry,
  isGuestSessionExpired,
} from '@/lib/guest-session';

const COOKIE_NAME = 'guestId';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 60,
  secure: process.env.NODE_ENV === 'production',
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
  );
}

/**
 * GET /api/guest-session
 * Returns the current guest session, or { guest: null } if none exists / expired.
 */
export async function GET(request: NextRequest) {
  const guestId = request.cookies.get(COOKIE_NAME)?.value;
  if (!guestId) {
    return NextResponse.json({ guest: null });
  }

  const session = await prisma.guestSession.findUnique({ where: { guestId } });
  if (!session || isGuestSessionExpired(session.expiresAt)) {
    return NextResponse.json({ guest: null });
  }

  return NextResponse.json({
    guest: { guestId: session.guestId, displayName: session.displayName },
  });
}

/**
 * POST /api/guest-session
 * Creates a new guest session, or renews an existing one.
 * Always sets/refreshes the HttpOnly cookie.
 */
export async function POST(request: NextRequest) {
  const existingGuestId = request.cookies.get(COOKIE_NAME)?.value;

  if (existingGuestId) {
    const existing = await prisma.guestSession.findUnique({
      where: { guestId: existingGuestId },
    });

    if (existing && !isGuestSessionExpired(existing.expiresAt)) {
      const newExpiry = getGuestSessionExpiry();
      await prisma.guestSession.update({
        where: { id: existing.id },
        data: { expiresAt: newExpiry },
      });

      const response = NextResponse.json({
        guest: { guestId: existing.guestId, displayName: existing.displayName },
      });
      response.cookies.set(COOKIE_NAME, existing.guestId, COOKIE_OPTIONS);
      return response;
    }
  }

  const guestId = generateGuestId();
  const displayName = generateDisplayName();
  const ipHash = hashIp(getClientIp(request));
  const expiresAt = getGuestSessionExpiry();

  await prisma.guestSession.create({
    data: { guestId, displayName, ipHash, expiresAt },
  });

  const response = NextResponse.json(
    { guest: { guestId, displayName } },
    { status: 201 }
  );
  response.cookies.set(COOKIE_NAME, guestId, COOKIE_OPTIONS);
  return response;
}
