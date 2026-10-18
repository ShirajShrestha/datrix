import { describe, it, expect } from 'vitest';
import { selectPool, computeExpireAt } from '../services/ingest';
import { CATEGORIES, type CategorySlug } from '../categories';
import type { ScoredArticle } from '../services/scoring';

const mk = (url: string, score: number, categories: CategorySlug[], publishedAt = new Date('2026-10-18T00:00:00Z')): ScoredArticle => ({
  title: `t ${url}`,
  url,
  source: 'BBC',
  category: categories[0],
  categories,
  publishedAt,
  sources: [{ name: 'BBC', url }],
  importanceScore: score,
});

describe('selectPool', () => {
  it('keeps top N per category', () => {
    const items = [mk('a', 0.9, ['ai']), mk('b', 0.8, ['ai']), mk('c', 0.7, ['ai']), mk('d', 0.5, ['world'])];
    const out = selectPool(items, 2).map((a) => a.url);
    expect(out).toEqual(['a', 'b', 'd']);
  });

  it('multi-category article kept if top N in any of them and appears once', () => {
    const items = [
      mk('a', 0.9, ['ai']),
      mk('b', 0.8, ['ai']),
      mk('m', 0.1, ['ai', 'world']), // out of top 2 in ai, but top in world
      mk('w', 0.05, ['world']),
    ];
    const out = selectPool(items, 2).map((a) => a.url);
    expect(out.filter((u) => u === 'm')).toHaveLength(1);
    expect(out).toContain('m');
    expect(out).toContain('w');
  });

  it('fewer than N available keeps all', () => {
    const items = [mk('a', 0.9, ['ai']), mk('b', 0.1, ['world'])];
    expect(selectPool(items, 25)).toHaveLength(2);
  });

  it('empty input -> []', () => {
    expect(selectPool([], 25)).toEqual([]);
  });

  it('deterministic order and no duplicates across 14 categories', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    const items: ScoredArticle[] = [];
    slugs.forEach((s, i) => items.push(mk(`u${i}`, 0.5 + i / 100, [s])));
    items.push(mk('multi', 0.99, [slugs[0], slugs[1], slugs[2]]));
    const out = selectPool(items, 1);
    const urls = out.map((a) => a.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.filter((u) => u === 'multi')).toHaveLength(1);
    expect(out[0].url).toBe('multi');
    expect(selectPool([...items].reverse(), 1).map((a) => a.url)).toEqual(urls);
  });
});

describe('computeExpireAt', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const DAY = 86400000;
  it('publishedAt + 30 days for recent article', () => {
    const p = new Date(now.getTime() - 2 * DAY);
    expect(computeExpireAt(p, now).getTime()).toBe(p.getTime() + 30 * DAY);
  });
  it('at least now + 1 day for old article', () => {
    const p = new Date(now.getTime() - 60 * DAY);
    expect(computeExpireAt(p, now).getTime()).toBe(now.getTime() + DAY);
  });
});
