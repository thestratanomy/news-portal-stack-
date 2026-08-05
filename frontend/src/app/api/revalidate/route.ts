import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '../../../lib/logger';
import { checkRateLimit, safeCompare } from '../../../lib/revalidate-utils';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip)) {
    logError('Revalidate rate limit exceeded', { ip });
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.REVALIDATION_SECRET || '';

  if (!secret || !safeCompare(secret, expectedSecret)) {
    logError('Revalidate invalid secret', { ip });
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    revalidateTag('ghost-posts');
    logInfo('Revalidated ghost-posts tag', { ip });
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    logError('Error revalidating', { error: String(err) });
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
