import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { sameOrigin, readJsonBody, MAX_BODY_BYTES } from '@/lib/pushRequest';

const req = (headers: Record<string, string>, body = '{}') =>
  new Request('http://app.test/api/push/subscribe', { method: 'POST', headers, body }) as unknown as NextRequest;

describe('sameOrigin', () => {
  it('matches host', () => expect(sameOrigin(req({ origin: 'https://app.test', host: 'app.test' }))).toBe(true));
  it('mismatch', () => expect(sameOrigin(req({ origin: 'https://evil.test', host: 'app.test' }))).toBe(false));
  it('no Origin allowed', () => expect(sameOrigin(req({ host: 'app.test' }))).toBe(true));
  it('Origin: null rejected', () => expect(sameOrigin(req({ origin: 'null', host: 'app.test' }))).toBe(false));
  it('x-forwarded-host takes precedence', () => {
    expect(sameOrigin(req({ origin: 'https://public.test', host: 'internal', 'x-forwarded-host': 'public.test' }))).toBe(true);
    expect(sameOrigin(req({ origin: 'https://internal', host: 'internal', 'x-forwarded-host': 'public.test' }))).toBe(false);
  });
});

describe('readJsonBody', () => {
  it('valid', async () => {
    const r = await readJsonBody(req({}, '{"a":1}'));
    expect(r.ok && r.body).toEqual({ a: 1 });
  });
  it('bad JSON -> 400', async () => {
    const r = await readJsonBody(req({}, '{nope'));
    expect(!r.ok && r.response.status).toBe(400);
  });
  it('oversize -> 413', async () => {
    const r = await readJsonBody(req({}, 'x'.repeat(MAX_BODY_BYTES + 1)));
    expect(!r.ok && r.response.status).toBe(413);
  });
  it('cross-origin -> 403', async () => {
    const r = await readJsonBody(req({ origin: 'https://evil.test', host: 'app.test' }));
    expect(!r.ok && r.response.status).toBe(403);
  });
});
