import { describe, it, expect } from 'vitest';
import { buildArticleQuery } from '../articleQuery';

const q = (s: string) => buildArticleQuery(new URLSearchParams(s));

describe('buildArticleQuery', () => {
  it('categories csv becomes $in filter', () => {
    expect(q('categories=ai,science').filter).toEqual({ categories: { $in: ['ai', 'science'] } });
  });
  it('legacy tech maps to technology', () => {
    expect(q('categories=tech,economy').filter).toEqual({ categories: { $in: ['technology', 'business'] } });
  });
  it('unknown slug dropped; all unknown → no category filter', () => {
    expect(q('categories=ai,nope').filter).toEqual({ categories: { $in: ['ai'] } });
    expect(q('categories=nope,zzz').filter).toEqual({});
    expect(q('categories=').filter).toEqual({});
  });
  it('q is regex-escaped', () => {
    const { filter } = q('q=' + encodeURIComponent('a.b('));
    const or = filter.$or as { title?: RegExp; 'summary.tldr'?: RegExp }[];
    const re = or[0].title as RegExp;
    expect(re.source).toBe('a\\.b\\(');
    expect(re.flags).toBe('i');
    expect(re.test('xA.B(y')).toBe(true);
    expect(re.test('aXb(')).toBe(false);
    expect(or[1]['summary.tldr']).toBeInstanceOf(RegExp);
  });
  it('q is capped at 100 chars', () => {
    const or = q('q=' + 'a'.repeat(500)).filter.$or as { title: RegExp }[];
    expect(or[0].title.source.length).toBe(100);
  });
  it('limit clamps to 200 and bad values give 100', () => {
    expect(q('limit=9999').limit).toBe(200);
    expect(q('limit=25').limit).toBe(25);
    for (const bad of ['limit=abc', 'limit=0', 'limit=-5', '']) expect(q(bad).limit).toBe(100);
  });
  it('importance=high sets ≥0.75', () => {
    expect(q('importance=high').filter).toEqual({ importanceScore: { $gte: 0.75 } });
  });
  it('importance=medium is 0.5 to <0.75; others ignored', () => {
    expect(q('importance=medium').filter).toEqual({ importanceScore: { $gte: 0.5, $lt: 0.75 } });
    expect(q('importance=all').filter).toEqual({});
  });
  it('sorts by importance then recency', () => {
    expect(Object.entries(q('').sort)).toEqual([['importanceScore', -1], ['publishedAt', -1]]);
  });
  it('empty params → empty filter', () => {
    expect(q('').filter).toEqual({});
  });
});

describe('buildArticleQuery fresh window', () => {
  const NOW = Date.parse('2026-10-28T12:00:00Z');
  const f = (s: string) => buildArticleQuery(new URLSearchParams(s), NOW);
  it('fresh=48 sets publishedAt $gte', () => {
    const r = f('fresh=48');
    expect(r.freshHours).toBe(48);
    expect(r.filter.publishedAt).toEqual({ $gte: new Date(NOW - 48 * 3600e3) });
  });
  it('clamps to 720', () => {
    expect(f('fresh=9999').freshHours).toBe(720);
  });
  it('ignored with q', () => {
    const r = f('fresh=48&q=climate');
    expect(r.filter.publishedAt).toBeUndefined();
    expect(r.freshHours).toBeUndefined();
  });
  it('absent fresh leaves behavior unchanged', () => {
    const r = f('categories=ai');
    expect(r.freshHours).toBeUndefined();
    expect(r.filter).toEqual({ categories: { $in: ['ai'] } });
  });
});
