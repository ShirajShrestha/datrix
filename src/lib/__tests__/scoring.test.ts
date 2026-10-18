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
