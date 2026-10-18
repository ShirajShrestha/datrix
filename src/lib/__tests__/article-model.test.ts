import { describe, it, expect } from 'vitest';
import { Article } from '@/lib/models/Article';

const DAY = 86400000;
const valid = () => ({
  title: 't', url: 'https://x.test/a', source: 's', categories: ['ai'],
  publishedAt: new Date(), importanceScore: 1,
});

describe('Article schema', () => {
  const indexes = Article.schema.indexes() as [Record<string, number>, Record<string, unknown>][];
  it('has categories array and no legacy fields', () => {
    expect(Article.schema.path('categories')).toBeDefined();
    expect(Article.schema.path('category')).toBeUndefined();
    expect(Article.schema.path('isSaved')).toBeUndefined();
  });
  it('has TTL index on expireAt only', () => {
    expect(indexes).toContainEqual([{ expireAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]);
    for (const [k, o] of indexes) {
      if ('publishedAt' in k) expect(o.expireAfterSeconds).toBeUndefined();
    }
    expect(indexes.some(([k]) => JSON.stringify(k) === JSON.stringify({ publishedAt: 1 }))).toBe(false);
    expect(indexes.some(([k]) => JSON.stringify(k) === JSON.stringify({ publishedAt: -1 }))).toBe(true);
  });
  it('has compound categories/importanceScore index', () => {
    expect(indexes.some(([k]) => JSON.stringify(k) === JSON.stringify({ categories: 1, importanceScore: -1 }))).toBe(true);
  });
  it('default expireAt: old article gets >= now, fresh gets ~now+30d', () => {
    const old = new Article({ ...valid(), publishedAt: new Date(Date.now() - 60 * DAY) });
    expect(old.expireAt!.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    const fresh = new Article(valid());
    expect(Math.abs(fresh.expireAt!.getTime() - (Date.now() + 30 * DAY))).toBeLessThan(5000);
  });
  it('validates categories', () => {
    expect(new Article({ ...valid(), categories: [] }).validateSync()?.errors.categories).toBeDefined();
    expect(new Article({ ...valid(), categories: ['bogus'] }).validateSync()?.errors.categories).toBeDefined();
    const a = new Article(valid());
    expect(a.validateSync()).toBeUndefined();
    expect(a.sources).toHaveLength(0);
  });
  it('summary.provider is limited to groq|gemini|extractive', () => {
    const ok = new Article({ ...valid(), summary: { tldr: 't', bullets: [], provider: 'groq' } });
    expect(ok.validateSync()).toBeUndefined();
    const bad = new Article({ ...valid(), summary: { tldr: 't', bullets: [], provider: 'openai' } });
    expect(bad.validateSync()?.errors['summary.provider']).toBeDefined();
  });
});
