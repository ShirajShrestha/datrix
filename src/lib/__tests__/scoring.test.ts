import { describe, it, expect } from 'vitest';
import { deduplicateArticles, scoreArticles, type ScoredArticle } from '../services/scoring';

const mk = (o: Partial<ScoredArticle> = {}): ScoredArticle => ({
  title: 'Central bank raises interest rates amid inflation fears',
  url: 'https://x.com/a',
  source: 'BBC',
  category: 'business',
  categories: ['business'],
  publishedAt: new Date(),
  sources: [{ name: o.source ?? 'BBC', url: o.url ?? 'https://x.com/a' }],
  ...o,
});

describe('deduplicateArticles', () => {
  it('dedupe merges two same-story articles into one with 2 sources', () => {
    const out = deduplicateArticles([
      mk({ source: 'BBC', url: 'https://bbc.com/1', sources: [{ name: 'BBC', url: 'https://bbc.com/1' }] }),
      mk({ source: 'NYT', url: 'https://nyt.com/1', sources: [{ name: 'NYT', url: 'https://nyt.com/1' }] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual([
      { name: 'BBC', url: 'https://bbc.com/1' },
      { name: 'NYT', url: 'https://nyt.com/1' },
    ]);
  });

  it('merged article unions categories and keeps best image', () => {
    const out = deduplicateArticles([
      mk({ url: 'u1', categories: ['business'], importanceScore: 0.9 }),
      mk({ source: 'NYT', url: 'u2', categories: ['world', 'business'], imageUrl: 'https://img/2.jpg', sources: [{ name: 'NYT', url: 'u2' }], importanceScore: 0.5 }),
      mk({ source: 'CNN', url: 'u3', categories: ['politics'], imageUrl: 'https://img/3.jpg', sources: [{ name: 'CNN', url: 'u3' }], importanceScore: 0.4 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].categories).toEqual(['business', 'world', 'politics']);
    expect(out[0].imageUrl).toBe('https://img/2.jpg');
  });

  it('keeps canonical image when present', () => {
    const out = deduplicateArticles([
      mk({ url: 'u1', imageUrl: 'https://img/1.jpg', importanceScore: 0.9 }),
      mk({ source: 'NYT', url: 'u2', imageUrl: 'https://img/2.jpg', sources: [{ name: 'NYT', url: 'u2' }], importanceScore: 0.5 }),
    ]);
    expect(out[0].imageUrl).toBe('https://img/1.jpg');
  });

  it('canonical is the higher-scored one', () => {
    const out = deduplicateArticles([
      mk({ source: 'Yahoo News', url: 'low', importanceScore: 0.4, sources: [{ name: 'Yahoo News', url: 'low' }] }),
      mk({ source: 'Reuters', url: 'high', importanceScore: 0.8, sources: [{ name: 'Reuters', url: 'high' }] }),
    ]);
    expect(out[0].url).toBe('high');
    expect(out[0].importanceScore).toBe(0.8);
  });

  it('ties go to the earliest in input', () => {
    const out = deduplicateArticles([
      mk({ url: 'first', importanceScore: 0.5 }),
      mk({ source: 'NYT', url: 'second', importanceScore: 0.5, sources: [{ name: 'NYT', url: 'second' }] }),
    ]);
    expect(out[0].url).toBe('first');
  });

  it('same source twice yields 1 source ref', () => {
    const out = deduplicateArticles([mk({ url: 'u1' }), mk({ url: 'u2' })]);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toHaveLength(1);
  });

  it('same url in two category feeds merges into one with unioned categories and one source ref', () => {
    const out = deduplicateArticles([
      mk({ category: 'business', categories: ['business'] }),
      mk({ category: 'world', categories: ['world'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].categories).toEqual(['business', 'world']);
    expect(out[0].sources).toHaveLength(1);
  });

  it('does not merge distinct stories sharing a 50-char prefix', () => {
    const prefix = 'Live: Israel and Hamas ceasefire talks continue as';
    const out = deduplicateArticles([
      mk({ title: `${prefix} deadline nears for hostage exchange deal`, url: 'a' }),
      mk({ title: `${prefix} protesters gather outside parliament building`, url: 'b' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('scoreArticles', () => {
  it('fresh credible article scores above stale unknown-source one', () => {
    const [fresh, stale] = scoreArticles([
      mk({ title: 'Alpha story about something', source: 'Reuters', url: 'f', publishedAt: new Date() }),
      mk({ title: 'Omega tale regarding another', source: 'Unknown Blog', url: 's', publishedAt: new Date(Date.now() - 5 * 86400000) }),
    ]);
    expect(fresh.importanceScore!).toBeGreaterThan(stale.importanceScore!);
  });

  it('score uses highest category weight', () => {
    const [low, high] = scoreArticles([
      mk({ title: 'Distinct one thing here', url: 'l', categories: ['law'] }),
      mk({ title: 'Distinct one thing here', url: 'h', categories: ['law', 'ai'] }),
    ]);
    // identical titles but different urls corroborate each other equally; only topic weight differs
    expect(high.importanceScore!).toBeGreaterThanOrEqual(low.importanceScore!);
    const [a, b] = scoreArticles([
      mk({ title: 'Qwerty zxcv asdf', url: 'l2', categories: ['law'] }),
      mk({ title: 'Plmokn ijbuhv ygctf', url: 'h2', categories: ['law', 'ai'] }),
    ]);
    expect(b.importanceScore!).toBeGreaterThan(a.importanceScore!);
    expect(b.importanceScore!).toBeLessThanOrEqual(1);
  });

  it('same url in two feeds does not corroborate', () => {
    const [a, b] = scoreArticles([mk({ url: 'same', categories: ['business'] }), mk({ url: 'same', categories: ['business'] })]);
    const [solo] = scoreArticles([mk({ url: 'same' })]);
    expect(a.importanceScore).toBe(solo.importanceScore);
    expect(b.importanceScore).toBe(solo.importanceScore);
  });
});

describe('similarity-based dedupe', () => {
  const at = (title: string, source: string, o: Partial<ScoredArticle> = {}) =>
    mk({ title, source, url: `https://${source}.com/${encodeURIComponent(title)}`, sources: [{ name: source, url: `https://${source}.com/${encodeURIComponent(title)}` }], ...o });
  const merges = (a: ScoredArticle, b: ScoredArticle) => deduplicateArticles([a, b]).length === 1;

  it('merges headline variants across outlets', () => {
    expect(merges(at('Trump announces new tariffs on Chinese imports', 'BBC'), at('Trump announces new tariffs on Chinese imports, markets fall', 'NYT'))).toBe(true);
    expect(merges(at('Apple unveils iPhone 17 with new AI features', 'BBC'), at('Apple unveils iPhone 17 with new AI features - The Verge', 'The Verge'))).toBe(true);
  });

  it('does not merge the Fed pair (no alias table; documented limitation)', () => {
    expect(merges(at('Fed holds interest rates steady as inflation cools', 'BBC'), at('Federal Reserve Leaves Rates Unchanged, Citing Cooling Inflation', 'NYT'))).toBe(false);
  });

  it('does not merge distinct Live: stories', () => {
    expect(merges(at('Live: Trump trial day 3', 'BBC'), at('Live: Premier League matchday 10', 'NYT'))).toBe(false);
  });

  it('numeric guard blocks differing numbers', () => {
    expect(merges(at('Man wins 5 million lottery', 'BBC'), at('Man wins 7 million lottery', 'NYT'))).toBe(false);
  });

  it('does not merge same wording 5 days apart', () => {
    const old = new Date(Date.now() - 5 * 86400000);
    expect(merges(at('Trump announces new tariffs on Chinese imports', 'BBC'), at('Trump announces new tariffs on Chinese imports', 'NYT', { publishedAt: old }))).toBe(false);
  });

  it('is order independent', () => {
    const arts = [
      at('Trump announces new tariffs on Chinese imports', 'BBC'),
      at('Apple unveils iPhone 17 with new AI features', 'NYT'),
      at('Trump announces new tariffs on Chinese imports, markets fall', 'CNN'),
      at('Apple unveils iPhone 17 with new AI features - The Verge', 'The Verge'),
      at('Live: Premier League matchday 10', 'ESPN'),
    ];
    const sig = (xs: ScoredArticle[]) => deduplicateArticles(xs).map((a) => a.sources.map((s) => s.name).sort().join('+')).sort();
    expect(sig([...arts].reverse())).toEqual(sig(arts));
    expect(sig([arts[3], arts[0], arts[4], arts[1], arts[2]])).toEqual(sig(arts));
    expect(sig(arts)).toHaveLength(3);
  });

  it('transitive chain ends in one group', () => {
    const out = deduplicateArticles([
      at('alpha bravo charlie delta echo', 'BBC'),
      at('bravo charlie delta echo foxtrot', 'NYT'),
      at('charlie delta echo foxtrot golf', 'CNN'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toHaveLength(3);
  });

  it('frequency counts distinct other sources, not duplicates', () => {
    const t = 'Trump announces new tariffs on Chinese imports';
    const base = scoreArticles([at(t, 'BBC')])[0].importanceScore!;
    const dupSameSource = scoreArticles([at(t, 'BBC'), at(t, 'BBC', { url: 'https://other.com/x' })])[0].importanceScore!;
    const twoSources = scoreArticles([at(t, 'BBC'), at(t, 'NYT'), at(t, 'CNN')])[0].importanceScore!;
    expect(dupSameSource).toBe(base);
    expect(twoSources).toBeGreaterThan(base);
  });

  it('invalid publishedAt does not throw', () => {
    const bad = at('Some story about nothing special', 'BBC', { publishedAt: new Date('nope') });
    expect(() => scoreArticles([bad, { ...bad, source: 'NYT', url: 'z' }])).not.toThrow();
    expect(() => deduplicateArticles([bad, { ...bad, url: 'z' }])).not.toThrow();
  });

  it('unknown source named like a prototype key gets default credibility', () => {
    const [a] = scoreArticles([at('Constructor story here today', 'constructor')]);
    expect(Number.isFinite(a.importanceScore)).toBe(true);
  });

  it('800 synthetic articles dedupe quickly', () => {
    const arts: ScoredArticle[] = [];
    for (let i = 0; i < 800; i++) {
      arts.push(at(`Story${i} word${i % 37} thing${i % 11} topic${i % 7} extra${i}`, `S${i % 9}`, { url: `https://x.com/${i}` }));
    }
    const t0 = performance.now();
    const out = deduplicateArticles(scoreArticles(arts));
    expect(performance.now() - t0).toBeLessThan(500);
    expect(out.length).toBe(800);
  });
});

describe('deduplicateArticles snippets and images', () => {
  const ref = (name: string, snippet: string) => ({ name, url: `https://${name}/x`, snippet });
  it('unions images canonical-first and keeps per-outlet snippets and canonical description', () => {
    const out = deduplicateArticles([
      mk({ source: 'A', url: 'https://a/x', imageUrl: 'https://a/1.jpg', images: ['https://a/1.jpg'], description: 'desc A', sources: [ref('a', 'snippet A')], importanceScore: 0.9 }),
      mk({ source: 'B', url: 'https://b/x', imageUrl: 'https://b/2.jpg', images: ['https://b/2.jpg', 'https://a/1.jpg', 'ftp://bad/3.jpg'], description: 'desc B', sources: [ref('b', 'snippet B')], importanceScore: 0.5 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].images).toEqual(['https://a/1.jpg', 'https://b/2.jpg']);
    expect(out[0].sources.map((s) => s.snippet)).toEqual(['snippet A', 'snippet B']);
    expect(out[0].description).toBe('desc A');
  });
  it('caps images at 5 and sources at 8', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      mk({ source: `S${i}`, url: `https://s${i}/x`, images: [`https://s${i}/1.jpg`, `https://s${i}/2.jpg`], sources: [ref(`s${i}`, `n${i}`), ref(`t${i}`, `m${i}`)], importanceScore: 1 - i / 100 }));
    const out = deduplicateArticles(items);
    expect(out).toHaveLength(1);
    expect(out[0].images).toHaveLength(5);
    expect(out[0].sources).toHaveLength(8);
    expect(out[0].sources[0].name).toBe('s0');
  });
});

