import { describe, it, expect } from 'vitest';
import { Article } from '@/lib/models/Article';

describe('Article schema', () => {
  const indexes = Article.schema.indexes();
  it('has categories array and no legacy fields', () => {
    expect(Article.schema.path('categories')).toBeDefined();
    expect(Article.schema.path('category')).toBeUndefined();
    expect(Article.schema.path('isSaved')).toBeUndefined();
  });
  it('has TTL index on publishedAt (30 days)', () => {
    expect(indexes).toContainEqual([{ publishedAt: 1 }, expect.objectContaining({ expireAfterSeconds: 2592000 })]);
  });
  it('has compound categories/importanceScore index', () => {
    expect(indexes.some(([k]) => JSON.stringify(k) === JSON.stringify({ categories: 1, importanceScore: -1 }))).toBe(true);
  });
});
