import { describe, it, expect, vi } from 'vitest';
import { extractOgImage, resolveImages } from '@/lib/services/images';

type FetchImpl = NonNullable<NonNullable<Parameters<typeof resolveImages>[1]>['fetchImpl']>;
type Item = { url: string; imageUrl?: string };

const base = 'https://example.com/news/a';

describe('extractOgImage', () => {
  it('finds og:image', () => {
    const html = '<head><meta property="og:image" content="https://img.example.com/a.jpg"></head>';
    expect(extractOgImage(html, base)).toBe('https://img.example.com/a.jpg');
  });
  it('handles reversed attribute order, single quotes and &amp;', () => {
    const html = "<meta content='https://img.example.com/a.jpg?x=1&amp;y=2' property='og:image'>";
    expect(extractOgImage(html, base)).toBe('https://img.example.com/a.jpg?x=1&y=2');
  });
  it('prefers og:image:secure_url variants and falls back to twitter:image', () => {
    expect(extractOgImage('<meta property="og:image:secure_url" content="https://i.example.com/s.jpg">', base)).toBe('https://i.example.com/s.jpg');
    expect(extractOgImage('<meta name="twitter:image" content="https://i.example.com/t.jpg">', base)).toBe('https://i.example.com/t.jpg');
    expect(extractOgImage('<meta name="twitter:image:src" content="https://i.example.com/u.jpg" />', base)).toBe('https://i.example.com/u.jpg');
  });
  it('resolves relative path against baseUrl', () => {
    expect(extractOgImage('<meta property="og:image" content="/img/a.jpg">', base)).toBe('https://example.com/img/a.jpg');
    expect(extractOgImage('<meta property="og:image" content="//cdn.example.com/a.jpg">', base)).toBe('https://cdn.example.com/a.jpg');
  });
  it('rejects javascript: and data: URLs', () => {
    expect(extractOgImage('<meta property="og:image" content="javascript:alert(1)">', base)).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="data:image/png;base64,AAAA">', base)).toBeNull();
  });
  it('returns null when absent', () => {
    expect(extractOgImage('<html></html>', base)).toBeNull();
  });
});

const page = (img: string) =>
  new Response(`<meta property="og:image" content="${img}">`, { status: 200 });

describe('resolveImages', () => {
  it('fetches only first max items lacking images, preserves order and skips existing', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (u: string) => { calls.push(String(u)); return page('https://i.example.com/' + calls.length + '.jpg'); });
    const items: Item[] = [
      { url: 'https://e.com/1' },
      { url: 'https://e.com/2', imageUrl: 'https://keep/2.jpg' },
      { url: 'https://e.com/3' },
      { url: 'https://e.com/4' },
    ];
    const out = await resolveImages(items, { max: 2, concurrency: 1, fetchImpl: fetchImpl as FetchImpl });
    expect(calls).toEqual(['https://e.com/1', 'https://e.com/3']);
    expect(out.map((i) => i.url)).toEqual(items.map((i) => i.url));
    expect(out[0].imageUrl).toBeDefined();
    expect(out[1].imageUrl).toBe('https://keep/2.jpg');
    expect(out[2].imageUrl).toBeDefined();
    expect(out[3].imageUrl).toBeUndefined();
  });
  it('never exceeds concurrency', async () => {
    let active = 0, peak = 0;
    const fetchImpl = async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 10)); active--; return page('https://i.example.com/a.jpg'); };
    await resolveImages(Array.from({ length: 10 }, (_, i) => ({ url: 'https://e.com/' + i })), { concurrency: 3, fetchImpl: fetchImpl as FetchImpl });
    expect(peak).toBeLessThanOrEqual(3);
  });
  it('never throws on a rejecting or hanging fetch', async () => {
    const items = [{ url: 'https://e.com/a' }, { url: 'https://e.com/b' }];
    const rejecting = await resolveImages(items, { timeoutMs: 50, fetchImpl: (async () => { throw new Error('boom'); }) as FetchImpl });
    expect(rejecting).toEqual(items);
    const hanging = await resolveImages(items, {
      timeoutMs: 50,
      fetchImpl: ((_u: string, init?: RequestInit) => new Promise<Response>(() => { /* ignores abort: never settles */ void init; })) as FetchImpl,
    });
    expect(hanging).toEqual(items);
  });
  it('ignores non-ok responses', async () => {
    const out = await resolveImages<Item>([{ url: 'https://e.com/a' }], { fetchImpl: (async () => new Response('x', { status: 403 })) as FetchImpl });
    expect(out[0].imageUrl).toBeUndefined();
  });
});
