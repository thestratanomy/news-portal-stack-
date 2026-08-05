import { timingSafeEqual } from 'crypto';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '../../../lib/logger';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

let requestLog: Map<string, number[]> = new Map();

export function _resetRateLimitForTests(): void {
  requestLog = new Map();
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return true;
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

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
