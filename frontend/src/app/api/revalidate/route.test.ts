import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json(body: any, init?: any) {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      },
    },
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { POST, safeCompare, checkRateLimit, _resetRateLimitForTests } from './route';

function makeRequest(secret: string | null, ip = '1.2.3.4') {
  const url = secret === null
    ? 'https://example.com/api/revalidate'
    : `https://example.com/api/revalidate?secret=${encodeURIComponent(secret)}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('safeCompare', () => {
  it('returns true for equal strings', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different-length strings', () => {
    expect(safeCompare('abc', 'abcdef')).toBe(false);
  });

  it('returns false for same-length different strings', () => {
    expect(safeCompare('abc123', 'xyz789')).toBe(false);
  });
});

describe('POST /api/revalidate', () => {
  const originalSecret = process.env.REVALIDATION_SECRET;

  beforeEach(() => {
    process.env.REVALIDATION_SECRET = 'test-secret';
    _resetRateLimitForTests();
  });

  afterEach(() => {
    process.env.REVALIDATION_SECRET = originalSecret;
  });

  it('returns 401 for an invalid secret', async () => {
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 and revalidates for a valid secret', async () => {
    const res = await POST(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revalidated).toBe(true);
  });

  it('rate-limits after the threshold for the same IP', async () => {
    const ip = '9.9.9.9';
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest('test-secret', ip));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(makeRequest('test-secret', ip));
    expect(blocked.status).toBe(429);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it('allows up to 10 requests per IP per minute', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('5.5.5.5')).toBe(true);
    }
    expect(checkRateLimit('5.5.5.5')).toBe(false);
  });
});
