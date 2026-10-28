import { describe, it, expect } from 'vitest';
import { rankScore, rankArticles, HALF_LIFE_HOURS } from '../ranking';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const H = 3600e3;
const ago = (h: number) => new Date(NOW - h * H);

describe('ranking', () => {
  it('half life is 24h', () => expect(HALF_LIFE_HOURS).toBe(24));
  it('fresh 0.6 outranks 72h-old 0.9', () => {
    const a = { id: 'old', importanceScore: 0.9, publishedAt: ago(72) };
    const b = { id: 'new', importanceScore: 0.6, publishedAt: ago(1) };
    expect(rankArticles([a, b], NOW).map((x) => x.id)).toEqual(['new', 'old']);
  });
  it('24h old scores about half its importance', () => {
    expect(rankScore({ importanceScore: 0.8, publishedAt: ago(24) }, NOW)).toBeCloseTo(0.4, 2);
  });
  it('future-dated scores exactly its importance', () => {
    expect(rankScore({ importanceScore: 0.7, publishedAt: new Date(NOW + 3 * H) }, NOW)).toBe(0.7);
  });
  it('invalid date ranks as 168h old', () => {
    const expected = 0.9 * 0.5 ** (168 / 24);
    expect(rankScore({ importanceScore: 0.9, publishedAt: 'not a date' }, NOW)).toBeCloseTo(expected, 10);
  });
  it('equal scores order by newer date; returns a new array', () => {
    const items = [
      { id: 'a', importanceScore: 0.5, publishedAt: ago(5) },
      { id: 'b', importanceScore: 0.5, publishedAt: ago(5) },
    ];
    const out = rankArticles(items, NOW);
    expect(out).not.toBe(items);
    const same = [
      { id: 'x', importanceScore: 0.5, publishedAt: new Date(NOW + 2 * H) },
      { id: 'y', importanceScore: 0.5, publishedAt: new Date(NOW + 5 * H) },
    ];
    expect(rankArticles(same, NOW).map((i) => i.id)).toEqual(['y', 'x']);
  });
});
