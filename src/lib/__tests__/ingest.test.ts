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

import { planImageBudget, mergeByUrl, buildOps } from '../services/ingest';
import { Article } from '../models/Article';

describe('planImageBudget', () => {
  it('plenty of time -> max 60', () => {
    expect(planImageBudget(1000, 50000)).toEqual({ run: true, max: 49 > 60 ? 60 : 49, raceMs: 41000 });
    expect(planImageBudget(0, 80000).max).toBe(60);
  });
  it('tight -> smaller max', () => {
    const p = planImageBudget(36000, 50000);
    expect(p.run).toBe(true);
    expect(p.max).toBe(14);
    expect(p.raceMs).toBe(6000);
  });
  it('<12s remaining -> run false', () => {
    expect(planImageBudget(39000, 50000).run).toBe(false);
  });
});

describe('mergeByUrl', () => {
  it('merges same url keeping highest score, unions categories/sources, first imageUrl', () => {
    const a = { ...mk('u', 0.5, ['ai']), imageUrl: 'http://i/1' };
    const b = { ...mk('u', 0.9, ['world']), title: 'other', sources: [{ name: 'X', url: 'u' }] };
    const out = mergeByUrl([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('other');
    expect(out[0].categories.sort()).toEqual(['ai', 'world']);
    expect(out[0].sources).toHaveLength(2);
    expect(out[0].imageUrl).toBe('http://i/1');
  });
  it('leaves distinct urls alone', () => {
    expect(mergeByUrl([mk('a', 1, ['ai']), mk('b', 1, ['ai'])])).toHaveLength(2);
  });
});

describe('buildOps', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const sum = { tldr: 't', bullets: [] as string[] };
  it('shape: filter, upsert, disjoint paths, expireAt', () => {
    const a = mk('u1', 0.5, ['ai']);
    const [op] = buildOps([a], new Map([['u1', sum]]), new Set(), now);
    const u = op.updateOne;
    expect(u.filter).toEqual({ url: 'u1' });
    expect(u.upsert).toBe(true);
    const setKeys = Object.keys(u.update.$set);
    const insKeys = Object.keys(u.update.$setOnInsert);
    expect(setKeys.filter((k) => insKeys.includes(k))).toEqual([]);
    expect(u.update.$set.expireAt).toEqual(computeExpireAt(a.publishedAt, now));
    expect(u.update.$set.summary).toEqual(sum);
    expect('imageUrl' in u.update.$set).toBe(false);
  });
  it('no summary when none new or already stored; imageUrl only when present', () => {
    const a = { ...mk('u1', 0.5, ['ai']), imageUrl: 'http://i' };
    const [o1] = buildOps([a], new Map(), new Set(), now);
    expect('summary' in o1.updateOne.update.$set).toBe(false);
    expect(o1.updateOne.update.$set.imageUrl).toBe('http://i');
    const [o2] = buildOps([a], new Map([['u1', sum]]), new Set(['u1']), now);
    expect('summary' in o2.updateOne.update.$set).toBe(false);
  });
});

describe('more edge cases', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const DAY = 86400000;
  it('computeExpireAt boundaries', () => {
    const p29 = new Date(now.getTime() - 29 * DAY);
    expect(computeExpireAt(p29, now).getTime()).toBe(now.getTime() + DAY);
    const p31 = new Date(now.getTime() - 31 * DAY);
    expect(computeExpireAt(p31, now).getTime()).toBe(now.getTime() + DAY);
  });
  it('computeExpireAt throws on invalid date', () => {
    expect(() => computeExpireAt(new Date('nope'), now)).toThrow(RangeError);
  });
  it('selectPool tie-break: score, publishedAt desc, url asc', () => {
    const d1 = new Date('2026-10-17T00:00:00Z');
    const d2 = new Date('2026-10-18T00:00:00Z');
    const out = selectPool([mk('b', 0.5, ['ai'], d2), mk('a', 0.5, ['ai'], d2), mk('c', 0.5, ['ai'], d1)], 10);
    expect(out.map((x) => x.url)).toEqual(['a', 'b', 'c']);
  });
  it('Article expireAt default does not throw with null this', () => {
    const def = (Article.schema.path('expireAt') as unknown as { options: { default: (this: unknown) => Date } }).options.default;
    expect(() => def.call(null)).not.toThrow();
    expect(() => def.call(undefined)).not.toThrow();
    expect(def.call(null)).toBeInstanceOf(Date);
  });
});
