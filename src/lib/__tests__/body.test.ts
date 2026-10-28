import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractReadableText, fetchBody, resolveBodies } from '@/lib/services/body';
import { MAX_BODY_CHARS } from '@/lib/sources/types';

const para = (n: number) =>
  `<p>${Array.from({ length: n }, (_, i) => `Sentence number ${i} about the council vote and the budget.`).join(' ')}</p>`;

const page = (inner: string) =>
  `<html><head><title>T</title></head><body><nav><a href="/">Home</a> <a href="/x">Sections</a></nav><article><h1>Headline</h1>${inner}</article><footer>Copyright footer junk</footer></body></html>`;

afterEach(() => vi.restoreAllMocks());

describe('extractReadableText', () => {
  it('returns article text and drops nav/footer', () => {
    const t = extractReadableText(page(para(12) + para(10)), 'https://example.com/a')!;
    expect(t).toContain('council vote');
    expect(t).not.toContain('Copyright footer junk');
    expect(t).not.toContain('Sections');
    expect(t).not.toMatch(/\s{2,}/);
  });
  it('returns null for a short page', () => {
    expect(extractReadableText(page('<p>' + 'x'.repeat(120) + '</p>'), 'https://example.com/a')).toBeNull();
  });
  it('returns null for a login wall and never throws', () => {
    const wall = `<html><body><div><h1>Sign in</h1><p>Please log in to continue reading. Subscribe for full access.</p><form><input name="u"></form></div></body></html>`;
    expect(extractReadableText(wall, 'https://example.com/a')).toBeNull();
    expect(extractReadableText('', 'https://example.com/a')).toBeNull();
    expect(extractReadableText('<<<not html', 'not a url')).toBeNull();
  });
  it('cuts long text at MAX_BODY_CHARS on a word boundary', () => {
    const t = extractReadableText(page(para(300)), 'https://example.com/a')!;
    expect(t.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(t.length).toBeGreaterThan(MAX_BODY_CHARS * 0.8);
    const words = new Set(['Sentence', 'number', 'about', 'the', 'council', 'vote', 'and', 'budget.']);
    const last = t.split(' ').pop()!;
    expect(words.has(last) || /^\d+$/.test(last)).toBe(true);
  });
});

describe('fetchBody', () => {
  it.each(['http://127.0.0.1/x', 'file:///etc/passwd', 'http://localhost/x', 'http://192.168.1.5/x', 'http://10.0.0.1/', 'http://172.20.0.1/', 'http://169.254.169.254/', 'http://[::1]/', 'http://0.0.0.0/', 'http://printer.local/'])(
    'refuses %s without a request',
    async (u) => {
      const spy = vi.spyOn(globalThis, 'fetch');
      expect(await fetchBody(u)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    },
  );
  it('returns extracted text for html and sends the UA', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(page(para(20)), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    );
    const t = await fetchBody('https://example.com/a');
    expect(t).toContain('council vote');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('Datrix/1.0 (+news reader)');
  });
  it('returns null for non-html, non-2xx, oversized, and errors', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    spy.mockResolvedValueOnce(new Response('{}', { headers: { 'content-type': 'application/json' } }));
    expect(await fetchBody('https://example.com/a')).toBeNull();
    spy.mockResolvedValueOnce(new Response('x', { status: 404, headers: { 'content-type': 'text/html' } }));
    expect(await fetchBody('https://example.com/a')).toBeNull();
    spy.mockResolvedValueOnce(new Response('x', { headers: { 'content-type': 'text/html', 'content-length': String(3_000_000) } }));
    expect(await fetchBody('https://example.com/a')).toBeNull();
    spy.mockResolvedValueOnce(new Response('x'.repeat(2_100_000), { headers: { 'content-type': 'text/html' } }));
    expect(await fetchBody('https://example.com/a')).toBeNull();
    spy.mockRejectedValueOnce(new Error('boom'));
    expect(await fetchBody('https://example.com/a')).toBeNull();
  });
});

describe('resolveBodies', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ url: `https://e.com/${i}` }));
  it('keeps existing bodies and fetches only the rest', async () => {
    const f = vi.fn(async (u: string) => `fetched ${u}`);
    const m = await resolveBodies([{ url: 'a', body: 'have' }, { url: 'b' }], { max: 5, deadlineAt: 1e9, now: () => 0, fetchBody: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(m.get('a')).toBe('have');
    expect(m.get('b')).toBe('fetched b');
  });
  it('respects max', async () => {
    const f = vi.fn(async () => 'ok');
    const m = await resolveBodies(items, { max: 2, deadlineAt: 1e9, now: () => 0, fetchBody: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect(m.size).toBe(2);
  });
  it('omits null results', async () => {
    const m = await resolveBodies(items, { max: 6, deadlineAt: 1e9, now: () => 0, fetchBody: async () => null });
    expect(m.size).toBe(0);
  });
  it('makes no calls after the deadline', async () => {
    const f = vi.fn(async () => 'ok');
    const m = await resolveBodies(items, { max: 6, deadlineAt: 100, now: () => 101, fetchBody: f });
    expect(f).not.toHaveBeenCalled();
    expect(m.size).toBe(0);
  });
  it('stops starting fetches mid-run once the deadline passes', async () => {
    let t = 0;
    const f = vi.fn(async () => { t += 60; return 'ok'; });
    await resolveBodies(items, { max: 6, concurrency: 1, deadlineAt: 100, now: () => t, fetchBody: f });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('treats a throwing fetchBody as null', async () => {
    const m = await resolveBodies(items, { max: 6, deadlineAt: 1e9, now: () => 0, fetchBody: async () => { throw new Error('x'); } });
    expect(m.size).toBe(0);
  });
});
