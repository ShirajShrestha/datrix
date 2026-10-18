import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../sources/rss', async (orig) => ({
  ...(await orig<typeof import('../sources/rss')>()),
  fetchRss: vi.fn(),
}));
vi.mock('../sources/guardian', async (orig) => ({
  ...(await orig<typeof import('../sources/guardian')>()),
  fetchGuardian: vi.fn(),
}));
vi.mock('../sources/gnews', async (orig) => ({
  ...(await orig<typeof import('../sources/gnews')>()),
  fetchGNews: vi.fn(),
}));
vi.mock('../sources/mediastack', async (orig) => ({
  ...(await orig<typeof import('../sources/mediastack')>()),
  fetchMediaStack: vi.fn(),
}));

import { mapGuardianResult, fetchGuardian } from '../sources/guardian';
import { mapGNewsArticle, fetchGNews } from '../sources/gnews';
import { mapMediaStackArticle, isLowQualityTitle, fetchMediaStack } from '../sources/mediastack';
import { fetchRss } from '../sources/rss';
import { fetchAllSources } from '../sources';

afterEach(() => vi.restoreAllMocks());

describe('sources', () => {
  it('mapGuardianResult maps thumbnail and trailText', () => {
    const a = mapGuardianResult({
      webTitle: 'Hello', webUrl: 'https://g.com/a', webPublicationDate: '2026-01-01T00:00:00Z',
      fields: { thumbnail: 'https://i.g.com/t.jpg', trailText: '<p>Trail &amp; text</p>' },
    }, 'law');
    expect(a).toMatchObject({ source: 'The Guardian', imageUrl: 'https://i.g.com/t.jpg', description: 'Trail & text', category: 'law' });
    expect(mapGuardianResult({ webTitle: 'x' }, 'law')).toBeNull();
  });

  it('gnews/mediastack mappers keep image', () => {
    const g = mapGNewsArticle({ title: 'T', url: 'https://x.com/1', publishedAt: '2026-01-01T00:00:00Z', image: 'https://x.com/i.jpg', source: { name: 'X' } }, 'science');
    expect(g?.imageUrl).toBe('https://x.com/i.jpg');
    const m = mapMediaStackArticle({ title: 'T', url: 'https://x.com/2', published_at: '2026-01-01T00:00:00Z', image: 'https://x.com/m.jpg', source: 'Y' }, 'world');
    expect(m?.imageUrl).toBe('https://x.com/m.jpg');
  });

  it('isLowQualityTitle filters tickers and earnings transcripts', () => {
    expect(isLowQualityTitle('ACME (NASDAQ) Sets New 52-Year High')).toBe(false); // pattern needs word-boundary match
    expect(isLowQualityTitle('ACME NASDAQ Time to Buy')).toBe(true);
    expect(isLowQualityTitle('ACME Q3 2025 Earnings Call Transcript')).toBe(true);
    expect(isLowQualityTitle('Parliament passes new law')).toBe(false);
  });

  it('fetchAllSources survives one adapter rejecting', async () => {
    const art = { title: 't', url: 'https://x.com', source: 's', category: 'world' as const, publishedAt: new Date() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetchRss).mockRejectedValue(new Error('boom'));
    vi.mocked(fetchGuardian).mockResolvedValue([art]);
    vi.mocked(fetchGNews).mockResolvedValue([]);
    vi.mocked(fetchMediaStack).mockResolvedValue([]);
    const r = await fetchAllSources();
    expect(r.articles).toHaveLength(1);
    expect(r.failures).toEqual(['rss']);
  });
});

describe('fetchGuardian real impl', () => {
  it('returns [] when key missing', async () => {
    const real = await vi.importActual<typeof import('../sources/guardian')>('../sources/guardian');
    vi.stubEnv('GUARDIAN_API_KEY', '');
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await real.fetchGuardian()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('returns [] on non-2xx without leaking the key', async () => {
    const real = await vi.importActual<typeof import('../sources/guardian')>('../sources/guardian');
    vi.stubEnv('GUARDIAN_API_KEY', 'SECRETKEY');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 500 }));
    expect(await real.fetchGuardian()).toEqual([]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRETKEY');
    vi.unstubAllEnvs();
  });
});
