/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const ID = 'a'.repeat(24);
let store: Record<string, any>;
const generateBrief = vi.fn();

vi.mock('@/lib/db', () => ({ connectToDatabase: async () => {}, default: async () => {} }));
vi.mock('@/lib/services/brief', () => ({ generateBrief: (...a: unknown[]) => generateBrief(...a) }));
vi.mock('@/lib/models/Article', () => ({
  Article: {
    findById: (id: string) => ({ lean: async () => (store[id] ? structuredClone(store[id]) : null) }),
    // Emulates the atomic claim from the route's filter (synchronous check-and-set, like Mongo's doc-level atomicity).
    findOneAndUpdate: (filter: any, update: any) => ({
      lean: async () => {
        const d = store[filter._id];
        if (!d || d.brief?.whatHappened) return null;
        expect(filter['brief.whatHappened']).toEqual({ $exists: false });
        const t = d.briefTriedAt as Date | undefined;
        const limit = filter.$or[1].briefTriedAt.$lt as Date;
        if (t && !(t < limit)) return null;
        const prev = structuredClone(d);
        d.briefTriedAt = update.$set.briefTriedAt;
        return prev;
      },
    }),
    updateOne: async (filter: any, update: any) => {
      Object.assign(store[filter._id], update.$set);
      return {};
    },
  },
}));

import { POST } from '../../app/api/articles/[id]/brief/route';
import { GET } from '../../app/api/articles/[id]/route';

const req = (origin: string | null = 'http://localhost:3000') =>
  new NextRequest(`http://localhost:3000/api/articles/${ID}/brief`, {
    method: 'POST',
    headers: { host: 'localhost:3000', ...(origin ? { origin } : {}) },
  });
const call = (id = ID, origin: string | null = 'http://localhost:3000') => POST(req(origin), { params: Promise.resolve({ id }) });

const doc = (extra: object = {}) => ({
  _id: ID, title: 'T', url: 'https://x', source: 'Src', categories: ['tech'], publishedAt: new Date(), importanceScore: 1,
  description: 'desc text', sources: [{ name: 'A', url: 'https://a', snippet: 'snip a' }, { name: 'B', url: 'https://b' }], ...extra,
});

beforeEach(() => {
  store = { [ID]: doc() };
  generateBrief.mockReset();
});

describe('brief route', () => {
  it('400 for bad id', async () => {
    expect((await call('zzz')).status).toBe(400);
  });
  it('404 for unknown id', async () => {
    store = {};
    expect((await call()).status).toBe(404);
  });
  it('403 for foreign and missing origin', async () => {
    expect((await call(ID, 'http://evil.com')).status).toBe(403);
    expect((await call(ID, null)).status).toBe(403);
    expect(generateBrief).not.toHaveBeenCalled();
  });
  it('returns cached brief without generating', async () => {
    store[ID].brief = { whatHappened: 'w', provider: 'groq', generatedAt: new Date() };
    const res = await call();
    const j = await res.json();
    expect(j).toMatchObject({ success: true, cached: true, brief: { whatHappened: 'w', provider: 'groq' } });
    expect(generateBrief).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBeNull();
  });
  it('concurrent POSTs generate once', async () => {
    generateBrief.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { whatHappened: 'w', provider: 'gemini' };
    });
    const [a, b] = await Promise.all([call(), call()]);
    expect(generateBrief).toHaveBeenCalledTimes(1);
    const ja = await a.json();
    const jb = await b.json();
    expect([ja, jb].some((j) => j.brief?.whatHappened === 'w')).toBe(true);
    for (const j of [ja, jb]) expect(JSON.stringify(j)).not.toContain('snip a');
  });
  it('stores brief with provider and generatedAt', async () => {
    generateBrief.mockResolvedValue({ whatHappened: 'w', whyItMatters: 'y', provider: 'groq' });
    const j = await (await call()).json();
    expect(j).toMatchObject({ success: true, cached: false, brief: { whatHappened: 'w', provider: 'groq' } });
    expect(store[ID].brief.provider).toBe('groq');
    expect(store[ID].brief.generatedAt).toBeInstanceOf(Date);
    expect(generateBrief.mock.calls[0][2]).toEqual({ timeoutMs: 10000 });
  });
  it('null generation stores only briefTriedAt and falls back', async () => {
    generateBrief.mockResolvedValue(null);
    const j = await (await call()).json();
    expect(j).toEqual({ success: true, brief: null, fallback: true, text: 'desc text' });
    expect(store[ID].brief).toBeUndefined();
    expect(store[ID].briefTriedAt).toBeInstanceOf(Date);
  });
  it('builds input from snippets', async () => {
    generateBrief.mockResolvedValue(null);
    await call();
    expect(generateBrief.mock.calls[0][0]).toEqual({ title: 'T', snippets: [{ outlet: 'A', text: 'snip a' }] });
  });
  it('falls back to description as one outlet-named snippet', async () => {
    store[ID].sources = [{ name: 'A', url: 'https://a' }];
    generateBrief.mockResolvedValue(null);
    await call();
    expect(generateBrief.mock.calls[0][0]).toEqual({ title: 'T', snippets: [{ outlet: 'Src', text: 'desc text' }] });
  });
});

describe('single get route', () => {
  it('400 / 404 / strips snippets', async () => {
    const g = (id: string) => GET(new NextRequest(`http://localhost:3000/api/articles/${id}`), { params: Promise.resolve({ id }) });
    expect((await g('nope')).status).toBe(400);
    expect((await g('b'.repeat(24))).status).toBe(404);
    const j = await (await g(ID)).json();
    expect(j.success).toBe(true);
    expect(JSON.stringify(j)).not.toContain('snip a');
  });
});
