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
import { mapMediaStackArticle, isLowQualityTitle, fetchMediaStack, pickMediastackCategories, mediastackCap } from '../sources/mediastack';
import { fetchRss } from '../sources/rss';
import { fetchAllSources } from '../sources';
import { SourceError } from '../sources/types';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('sources', () => {
  it('mapGuardianResult sets body from bodyText only when long enough', () => {
    const r = { webTitle: 'T', webUrl: 'https://g.com/a', webPublicationDate: '2026-10-18T08:00:00Z' };
    expect(mapGuardianResult({ ...r, fields: { bodyText: 'a'.repeat(1000) } }, 'world')?.body).toBe('a'.repeat(1000));
    expect(mapGuardianResult({ ...r, fields: { bodyText: 'a'.repeat(10) } }, 'world')?.body).toBeUndefined();
    expect(mapGuardianResult(r, 'world')?.body).toBeUndefined();
    expect(mapGuardianResult({ ...r, fields: { bodyText: 'a'.repeat(9000) } }, 'world')?.body).toHaveLength(6000);
  });
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

describe('fetchAllSources deadline', () => {
  const art = (u: string) => ({ title: 't', url: `https://x.com/${u}`, source: 's', category: 'world' as const, publishedAt: new Date() });
  const never = () => new Promise<never>(() => {});

  it('slow adapter times out; others keep their articles', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = fetchAllSources({
      deadlineMs: 1000,
      adapters: [['fast', async () => [art('a')]], ['slow', never], ['fast2', async () => [art('b')]]],
    });
    await vi.advanceTimersByTimeAsync(1000);
    const r = await p;
    expect(r.articles).toHaveLength(2);
    expect(r.failures).toEqual(['timeout:slow']);
  });

  it('all fast: unchanged and does not wait for the deadline', async () => {
    const r = await fetchAllSources({ deadlineMs: 60_000, adapters: [['a', async () => [art('a')]], ['b', async () => []]] });
    expect(r.articles).toHaveLength(1);
    expect(r.failures).toEqual([]);
  });

  it('rejecting adapter still reports its bare name', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await fetchAllSources({
      deadlineMs: 60_000,
      adapters: [['bad', async () => { throw new Error('x'); }], ['sync', () => { throw new Error('y'); }], ['ok', async () => [art('a')]]],
    });
    expect(r.failures).toEqual(['bad', 'sync']);
    expect(r.articles).toHaveLength(1);
  });

  it('late rejection after the deadline causes no unhandled rejection', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const p = fetchAllSources({
      deadlineMs: 100,
      adapters: [['late', () => new Promise<never>((_, rej) => setTimeout(() => rej(new Error('late')), 500))]],
    });
    await vi.advanceTimersByTimeAsync(100);
    expect((await p).failures).toEqual(['timeout:late']);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await new Promise((r) => setImmediate(r));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('mediastack rotation and cap', () => {
  const cats = ['general', 'technology', 'business', 'science', 'health', 'sports', 'entertainment'];
  const day = (n: number) => new Date(Date.UTC(2026, 0, n)); // Jan n => dayOfYear n

  it('returns cap consecutive sorted categories, wrapping', () => {
    const sorted = [...cats].sort();
    const out = pickMediastackCategories(cats, 3, day(1)); // start = 3
    expect(out).toEqual([sorted[3], sorted[4], sorted[5]]);
    const wrap = pickMediastackCategories(cats, 3, day(2)); // start = 6
    expect(wrap).toEqual([sorted[6], sorted[0], sorted[1]]);
  });
  it('covers every category over successive days', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 7; d++) pickMediastackCategories(cats, 3, day(d)).forEach((c) => seen.add(c));
    expect(seen.size).toBe(cats.length);
  });
  it('deterministic and order-independent; dedupes', () => {
    expect(pickMediastackCategories([...cats].reverse().concat(cats), 3, day(5))).toEqual(pickMediastackCategories(cats, 3, day(5)));
  });
  it('empty list, cap 0, cap above n', () => {
    expect(pickMediastackCategories([], 3, day(1))).toEqual([]);
    expect(pickMediastackCategories(cats, 0, day(1))).toEqual([]);
    expect(pickMediastackCategories(['a', 'b'], 5, day(1))).toHaveLength(2);
  });
  it('mediastackCap clamps 0-7, defaults to 3', () => {
    expect(mediastackCap(undefined)).toBe(3);
    expect(mediastackCap('')).toBe(3);
    expect(mediastackCap('abc')).toBe(3);
    expect(mediastackCap('0')).toBe(0);
    expect(mediastackCap('-4')).toBe(0);
    expect(mediastackCap('5')).toBe(5);
    expect(mediastackCap('99')).toBe(7);
  });
  it('real fetchMediaStack makes at most cap calls, none when cap is 0', async () => {
    const real = await vi.importActual<typeof import('../sources/mediastack')>('../sources/mediastack');
    vi.stubEnv('MEDIASTACK_API_KEY', 'K');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    vi.stubEnv('MEDIASTACK_MAX_CALLS_PER_RUN', '2');
    await real.fetchMediaStack();
    expect(f).toHaveBeenCalledTimes(2);
    f.mockClear();
    vi.stubEnv('MEDIASTACK_MAX_CALLS_PER_RUN', '0');
    expect(await real.fetchMediaStack()).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
  it('fetchAllSources leaves skipped adapters out entirely', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fa = vi.fn(async () => []);
    const fb = vi.fn(async () => []);
    const r = await fetchAllSources({ adapters: [['a', fa], ['b', fb]], skip: ['b'] });
    expect(fa).toHaveBeenCalled();
    expect(fb).not.toHaveBeenCalled();
    expect(r.failures).toEqual([]);
    const r2 = await fetchAllSources({ adapters: [['a', fa], ['b', fb]] });
    expect(fb).toHaveBeenCalledTimes(1);
    expect(r2.failures).toEqual([]);
  });
});
