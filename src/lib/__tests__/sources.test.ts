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
import { SourceError } from '../sources/types';

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
    expect(isLowQualityTitle('Acme Corp (NASDAQ:ACME) Sets New 52-Week High')).toBe(true);
    expect(isLowQualityTitle('Acme Corp (NYSE:ACM) Time to Buy?')).toBe(true);
    expect(isLowQualityTitle('Q3 2025 Earnings Call Transcript')).toBe(true);
    expect(isLowQualityTitle('Nasdaq closes higher as chip stocks rally')).toBe(false);
    expect(isLowQualityTitle('Scientists set new record for 52-week study')).toBe(false);
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

  it('throws SourceError on total non-2xx without leaking the key', async () => {
    const real = await vi.importActual<typeof import('../sources/guardian')>('../sources/guardian');
    vi.stubEnv('GUARDIAN_API_KEY', 'SECRETKEY');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 500 }));
    await expect(real.fetchGuardian()).rejects.toBeInstanceOf(SourceError);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRETKEY');
    vi.unstubAllEnvs();
  });
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const SECRET_RE = /api-key|apikey|access_key|https?:\/\//i;

describe('adapter failure signalling', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const cases = [
    ['guardian', 'GUARDIAN_API_KEY', async () => (await vi.importActual<typeof import('../sources/guardian')>('../sources/guardian')).fetchGuardian()],
    ['gnews', 'GNEWS_API_KEY', async () => (await vi.importActual<typeof import('../sources/gnews')>('../sources/gnews')).fetchGNews()],
    ['mediastack', 'MEDIASTACK_API_KEY', async () => (await vi.importActual<typeof import('../sources/mediastack')>('../sources/mediastack')).fetchMediaStack()],
  ] as const;

  for (const [name, env, run] of cases) {
    it(`${name} throws SourceError when every request fails, without leaking secrets`, async () => {
      vi.stubEnv(env, 'SECRETKEY');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
      const err = await run().then(() => null, (e) => e);
      expect(err).toBeInstanceOf(SourceError);
      expect(err.message).toBe(`${name} all requests failed`);
      expect(err.message).not.toMatch(SECRET_RE);
      expect(err.message).not.toContain('SECRETKEY');
    });

    it(`${name} returns [] when key missing`, async () => {
      vi.stubEnv(env, '');
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      expect(await run()).toEqual([]);
      expect(f).not.toHaveBeenCalled();
    });

    it(`${name} throws SourceError on bad JSON everywhere`, async () => {
      vi.stubEnv(env, 'SECRETKEY');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('<html>', { status: 200 })));
      await expect(run()).rejects.toBeInstanceOf(SourceError);
    });
  }

  it('guardian returns partial results when one section fails', async () => {
    vi.stubEnv('GUARDIAN_API_KEY', 'SECRETKEY');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
      n++ === 0
        ? ok({ response: { results: [{ webTitle: 'A', webUrl: 'https://g.com/a', webPublicationDate: '2026-01-01T00:00:00Z' }] } })
        : new Response('x', { status: 500 })));
    const real = await vi.importActual<typeof import('../sources/guardian')>('../sources/guardian');
    const r = await real.fetchGuardian();
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((a) => a.title === 'A')).toBe(true);
  });

  it('gnews returns partial results when one topic fails', async () => {
    vi.stubEnv('GNEWS_API_KEY', 'SECRETKEY');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
      n++ === 0
        ? ok({ articles: [{ title: 'G', url: 'https://x.com/g', publishedAt: '2026-01-01T00:00:00Z' }] })
        : new Response('x', { status: 429 })));
    const real = await vi.importActual<typeof import('../sources/gnews')>('../sources/gnews');
    expect(await real.fetchGNews()).toHaveLength(1);
  });

  it('fetchAllSources reports guardian in failures while others still return', async () => {
    const art = { title: 't', url: 'https://x.com', source: 's', category: 'world' as const, publishedAt: new Date() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetchRss).mockResolvedValue([art]);
    vi.mocked(fetchGuardian).mockRejectedValue(new SourceError('guardian'));
    vi.mocked(fetchGNews).mockResolvedValue([art]);
    vi.mocked(fetchMediaStack).mockResolvedValue([]);
    const r = await fetchAllSources();
    expect(r.failures).toEqual(['guardian']);
    expect(r.articles).toHaveLength(2);
  });
});

describe('fetchRss failure signalling', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const rssXml = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Hi</title><link>https://x.com/1</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item></channel></rss>';

  it('throws SourceError when every feed fails', async () => {
    const real = await vi.importActual<typeof import('../sources/rss')>('../sources/rss');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 503 })));
    const err = await real.fetchRss().then(() => null, (e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err.message).not.toMatch(/https?:\/\//);
  });

  it('returns the rest when one feed fails', async () => {
    const real = await vi.importActual<typeof import('../sources/rss')>('../sources/rss');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
      n++ === 0 ? new Response('x', { status: 503 }) : new Response(rssXml, { status: 200 })));
    const r = await real.fetchRss();
    expect(r.length).toBeGreaterThan(0);
  });
});
