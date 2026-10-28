/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let results: any[][];
let calls: { filter: any; sort: any; limit: number }[];

vi.mock('@/lib/db', () => ({ connectToDatabase: async () => {}, default: async () => {} }));
vi.mock('@/lib/models/Article', () => ({
  Article: {
    find: (filter: any) => ({
      sort: (sort: any) => ({
        limit: (limit: number) => ({
          lean: async () => {
            calls.push({ filter, sort, limit });
            return results[calls.length - 1] ?? [];
          },
        }),
      }),
    }),
  },
}));

import { GET } from '../../app/api/articles/route';

const H = 3600e3;
const mk = (id: string, hoursAgo: number, score = 0.5) => ({
  _id: id, title: id, url: `https://x/${id}`, source: 'S', categories: ['ai'],
  publishedAt: new Date(Date.now() - hoursAgo * H), importanceScore: score,
});
const get = async (qs: string) => (await GET(new NextRequest(`http://localhost:3000/api/articles?${qs}`))).json();

beforeEach(() => {
  results = [];
  calls = [];
});

describe('articles route with fresh', () => {
  it('widens to 168h when fewer than 12 qualify and returns the union ranked', async () => {
    const fresh = Array.from({ length: 5 }, (_, i) => mk(`f${i}`, 2 + i));
    const wide = [...fresh, ...Array.from({ length: 10 }, (_, i) => mk(`o${i}`, 100 + i, 0.9))];
    results = [fresh, wide];
    const j = await get('limit=20&fresh=48');
    expect(calls).toHaveLength(2);
    const gte = (c: any) => c.filter.publishedAt.$gte.getTime();
    expect(Date.now() - gte(calls[1])).toBeGreaterThan(167 * H);
    expect(Date.now() - gte(calls[1])).toBeLessThan(169 * H);
    expect(j.articles).toHaveLength(15);
    expect(j.articles.slice(0, 5).map((a: any) => a._id)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
  });
  it('never returns empty when only older stories exist', async () => {
    results = [[], [mk('old', 120, 0.8)]];
    const j = await get('fresh=48');
    expect(j.articles.map((a: any) => a._id)).toEqual(['old']);
  });
  it('queries once when the window is full; candidate limit is 2x, response cut to limit', async () => {
    results = [Array.from({ length: 40 }, (_, i) => mk(`a${i}`, i + 1))];
    const j = await get('limit=20&fresh=48');
    expect(calls).toHaveLength(1);
    expect(calls[0].limit).toBe(40);
    expect(j.articles).toHaveLength(20);
    expect(j.articles[0]._id).toBe('a0');
  });
  it('without fresh behaves as before', async () => {
    results = [[mk('a', 1), mk('b', 2)]];
    const j = await get('limit=20');
    expect(calls).toHaveLength(1);
    expect(calls[0].limit).toBe(20);
    expect(j.articles).toHaveLength(2);
  });
});
