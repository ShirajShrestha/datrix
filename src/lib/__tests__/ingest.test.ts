import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ connectToDatabase: vi.fn(async () => undefined) }));
vi.mock('@/lib/services/summarizer', async () => {
  const actual = await vi.importActual<typeof import('../services/summarizer')>('../services/summarizer');
  return { ...actual, summarizeBatch: vi.fn(actual.summarizeBatch) };
});
vi.mock('@/lib/sources', () => ({ fetchAllSources: vi.fn(async () => ({ articles: [], failures: [] })) }));

import { selectPool, computeExpireAt, attachBodies } from '../services/ingest';
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

import { planImageBudget, mergeByUrl, buildOps, selectNeedSummary, sanitizeArticleUrls, clampSnippet, planFetchDeadline, INGEST_BUDGET_MS } from '../services/ingest';
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

describe('budget constants and fetch deadline', () => {
  it('budget is 100 s; default image plan at start keeps max 60 and 12 s / 8 s rules', () => {
    expect(INGEST_BUDGET_MS).toBe(100_000);
    expect(planImageBudget(40_000)).toEqual({ run: true, max: 60, raceMs: 52_000 });
    expect(planImageBudget(88_001).run).toBe(false);
    expect(planImageBudget(88_000).run).toBe(true);
  });
  it('planFetchDeadline = min(35 s, remaining - 20 s), floored at 0', () => {
    expect(planFetchDeadline(0)).toBe(35_000);
    expect(planFetchDeadline(0, 40_000)).toBe(20_000);
    expect(planFetchDeadline(50_000, 60_000)).toBe(0);
  });
});

describe('sanitizeArticleUrls', () => {
  const base = { title: 't', source: 'BBC' };
  it('drops articles with non-http(s) or invalid urls', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com/a', 'not a url', '']) {
      expect(sanitizeArticleUrls({ ...base, url, sources: [{ name: 'BBC', url: 'https://x.com' }] })).toBeNull();
    }
  });
  it('filters bad sources entries and keeps good ones', () => {
    const out = sanitizeArticleUrls({ ...base, url: 'https://x.com/a', sources: [{ name: 'A', url: 'javascript:1' }, { name: 'B', url: 'http://b.com/x' }] });
    expect(out?.sources).toEqual([{ name: 'B', url: 'http://b.com/x' }]);
  });
  it('falls back to own url when no source is valid', () => {
    const out = sanitizeArticleUrls({ ...base, url: 'https://x.com/a', sources: [{ name: 'A', url: 'data:x' }] });
    expect(out?.sources).toEqual([{ name: 'BBC', url: 'https://x.com/a' }]);
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
  it('keeps a body from any member of the merged group', () => {
    const a = { ...mk('u', 0.5, ['ai']), body: 'body from a' };
    const b = { ...mk('u', 0.9, ['world']) };
    expect(mergeByUrl([a, b])[0].body).toBe('body from a');
    expect(mergeByUrl([{ ...a, importanceScore: 0.9 }, { ...b, body: 'body from b', importanceScore: 0.1 }])[0].body).toBe('body from a');
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
    expect(u.update.$set.updatedAt).toEqual(now);
    expect('imageUrl' in u.update.$set).toBe(false);
  });
  it('never writes body to $set or $setOnInsert', () => {
    const a = { ...mk('u1', 0.5, ['ai']), body: 'SECRET BODY' };
    const [op] = buildOps([a], new Map([['u1', sum]]), new Set(), now);
    expect(JSON.stringify(op.updateOne.update)).not.toContain('SECRET BODY');
    expect('body' in op.updateOne.update.$set).toBe(false);
    expect('body' in op.updateOne.update.$setOnInsert).toBe(false);
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

describe('summary upgrade rules', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const ext = { tldr: 'e', bullets: [] as string[], provider: 'extractive' as const };
  it('selectNeedSummary: missing, legacy and extractive need work; groq/gemini do not; sorted by importance', () => {
    const v = [mk('lo', 0.1, ['ai']), mk('hi', 0.9, ['ai']), mk('llm', 0.5, ['ai']), mk('gem', 0.5, ['ai']), mk('ex', 0.3, ['ai']), mk('old', 0.2, ['ai'])];
    const { needSummary, llmSummaryUrls } = selectNeedSummary(v, [
      { url: 'llm', summary: { tldr: 'x', provider: 'groq' } },
      { url: 'gem', summary: { tldr: 'x', provider: 'gemini' } },
      { url: 'ex', summary: { tldr: 'x', provider: 'extractive' } },
      { url: 'old', summary: { tldr: 'x' } },
    ]);
    expect(needSummary.map((a) => a.url)).toEqual(['hi', 'ex', 'old', 'lo']);
    expect([...llmSummaryUrls].sort()).toEqual(['gem', 'llm']);
  });
  it('buildOps overwrites extractive but never an LLM summary', () => {
    const a = mk('u1', 0.5, ['ai']);
    const [o1] = buildOps([a], new Map([['u1', { ...ext, tldr: 'new', provider: 'groq' as const }]]), new Set(), now);
    expect((o1.updateOne.update.$set.summary as { tldr: string }).tldr).toBe('new');
    const [o2] = buildOps([a], new Map([['u1', ext]]), new Set(['u1']), now);
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

describe('snippets and images', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('buildOps sets description/images/sources with snippets and never brief', () => {
    const a = { ...mk('u1', 0.8, ['ai']), description: 'desc', images: ['https://i/1.jpg'], sources: [{ name: 'A', url: 'https://a/x', snippet: 'snip' }] };
    const [op] = buildOps([a], new Map(), new Set(), now);
    const set = op.updateOne.update.$set as Record<string, unknown>;
    expect(set.description).toBe('desc');
    expect(set.images).toEqual(['https://i/1.jpg']);
    expect(set.sources).toEqual([{ name: 'A', url: 'https://a/x', snippet: 'snip' }]);
    expect(set).not.toHaveProperty('brief');
    expect(set).not.toHaveProperty('briefTriedAt');
  });
  it('buildOps skips empty images and empty description', () => {
    const a = { ...mk('u1', 0.8, ['ai']), description: '', images: [] };
    const [op] = buildOps([a], new Map(), new Set(), now);
    const set = op.updateOne.update.$set as Record<string, unknown>;
    expect(set).not.toHaveProperty('images');
    expect(set).not.toHaveProperty('description');
  });
  it('mergeByUrl unions images (deduped, max 5) and keeps snippets', () => {
    const a = { ...mk('u', 0.9, ['ai']), images: ['https://i/1', 'https://i/2', 'https://i/3'], sources: [{ name: 'A', url: 'u', snippet: 'sa' }] };
    const b = { ...mk('u', 0.5, ['ai']), images: ['https://i/2', 'https://i/4', 'https://i/5', 'https://i/6'], sources: [{ name: 'B', url: 'u', snippet: 'sb' }] };
    const out = mergeByUrl([a, b]);
    expect(out[0].images).toEqual(['https://i/1', 'https://i/2', 'https://i/3', 'https://i/4', 'https://i/5']);
    expect(out[0].sources.map((s) => s.snippet)).toEqual(['sa', 'sb']);
  });
  it('sanitizeArticleUrls keeps snippet on retained sources', () => {
    const out = sanitizeArticleUrls({ title: 't', source: 'BBC', url: 'https://x.com/a', sources: [{ name: 'B', url: 'http://b.com/x', snippet: 'keep' }] });
    expect(out?.sources).toEqual([{ name: 'B', url: 'http://b.com/x', snippet: 'keep' }]);
  });
  it('buildOps caps description at 600 chars', () => {
    const a = { ...mk('u1', 0.8, ['ai']), description: 'word '.repeat(300) };
    const [op] = buildOps([a], new Map(), new Set(), now);
    expect((op.updateOne.update.$set as { description: string }).description.length).toBeLessThanOrEqual(600);
  });
  it('clampSnippet strips tags only', () => {
    expect(clampSnippet('<p>Hi <b>there</b></p> &amp; you')).toBe('Hi there &amp; you');
    expect(clampSnippet('<br/>')).toBeUndefined();
  });
  it('clampSnippet trims, collapses whitespace, caps at 600 on a word boundary', () => {
    expect(clampSnippet(undefined)).toBeUndefined();
    expect(clampSnippet('  \n ')).toBeUndefined();
    expect(clampSnippet('  a   b\n c ')).toBe('a b c');
    const long = clampSnippet('word '.repeat(300))!;
    expect(long.length).toBeLessThanOrEqual(600);
    expect(long.endsWith('word')).toBe(true);
    expect(clampSnippet('x'.repeat(700))!.length).toBe(600);
  });
});


describe('ingest options', () => {
  it('scales with a larger budget', () => {
    expect(planImageBudget(0, 600_000).max).toBe(60);
    expect(planFetchDeadline(0, 600_000)).toBe(35_000);
  });
  it('runIngest accepts budgetMs and poolPerCategory and resolves with fetched 0', async () => {
    const { runIngest } = await import('../services/ingest');
    const { fetchAllSources } = await import('@/lib/sources');
    const report = await runIngest({ budgetMs: 1, poolPerCategory: 5 });
    expect(report.fetched).toBe(0);
    expect(vi.mocked(fetchAllSources)).toHaveBeenCalledWith({ deadlineMs: 0 });
  });
});

describe('attachBodies', () => {
  it('sets body only for urls in the map and preserves order', () => {
    const items = [mk('a', 0.9, ['ai']), mk('b', 0.8, ['ai']), mk('c', 0.7, ['ai'])];
    items[0].description = 'da';
    const out = attachBodies(items, new Map([['c', 'body c'], ['a', 'body a']]));
    expect(out.map((o) => o.url)).toEqual(['a', 'b', 'c']);
    expect(out[0]).toEqual({ url: 'a', title: 't a', description: 'da', body: 'body a' });
    expect('body' in out[1]).toBe(false);
    expect(out[2].body).toBe('body c');
  });
});

describe('selectNeedSummary with extractive summaries', () => {
  it('still needs an LLM summary when the stored one is extractive', () => {
    const valid = [mk('a', 0.9, ['ai']), mk('b', 0.8, ['ai'])];
    const { needSummary, llmSummaryUrls } = selectNeedSummary(valid, [
      { url: 'a', summary: { tldr: 'x', provider: 'extractive' } },
      { url: 'b', summary: { tldr: 'y', provider: 'groq' } },
    ]);
    expect(needSummary.map((a) => a.url)).toEqual(['a']);
    expect([...llmSummaryUrls]).toEqual(['b']);
  });
});

describe('buildOps never persists body', () => {
  it('emits no body key anywhere, even when articles carry bodies', () => {
    const a = { ...mk('a', 0.9, ['ai']), body: 'SECRET BODY TEXT' };
    const ops = buildOps([a], new Map([['a', { tldr: 't', bullets: [], provider: 'groq' as const }]]), new Set(), new Date('2026-10-28T00:00:00Z'));
    const json = JSON.stringify(ops);
    expect(json).not.toContain('SECRET BODY TEXT');
    expect(json).not.toMatch(/"body"/);
  });
});

describe('isLlmEligible / orderForSummary', () => {
  it('requires a body or a description of at least 200 chars', async () => {
    const { isLlmEligible } = await import('../services/ingest');
    expect(isLlmEligible({ description: 'x'.repeat(150) })).toBe(false);
    expect(isLlmEligible({})).toBe(false);
    expect(isLlmEligible({ description: 'x'.repeat(200) })).toBe(true);
    expect(isLlmEligible({ body: 'b' })).toBe(true);
  });
  it('moves bodied items first, keeping relative order', async () => {
    const { orderForSummary } = await import('../services/ingest');
    const items = [mk('a', 0.9, ['ai']), { ...mk('b', 0.8, ['ai']), body: 'B' }, mk('c', 0.7, ['ai']), { ...mk('d', 0.6, ['ai']), body: 'D' }];
    expect(orderForSummary(items).map((i) => i.url)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('summarizeNew eligibility', () => {
  it('gives ineligible items an extractive summary and never sends them to summarizeBatch', async () => {
    const { summarizeNew } = await import('../services/ingest');
    const { summarizeBatch } = await import('../services/summarizer');
    const spy = vi.mocked(summarizeBatch);
    spy.mockClear();
    spy.mockImplementation(async (items) => ({
      summaries: new Map(items.map((i) => [i.url, { tldr: 't', bullets: [], provider: 'groq' as const }])),
      llmCalls: 1,
      failures: [],
    }));
    const short = { ...mk('short', 0.9, ['ai']), description: 'x'.repeat(150) };
    const long = { ...mk('long', 0.5, ['ai']), description: 'y'.repeat(200) };
    const bodied = { ...mk('bodied', 0.1, ['ai']), body: 'some body' };
    const r = await summarizeNew([short, long, bodied], Date.now() + 60_000, Date.now, 0, 0, 1, 0);
    const sent = spy.mock.calls[0][0].map((i) => i.url);
    expect(sent).toEqual(['bodied', 'long']);
    expect(r.summaries.get('short')!.provider).toBe('extractive');
    expect(r.summaries.get('long')!.provider).toBe('groq');
    expect(spy.mock.calls[0][2]).toMatchObject({ concurrency: 1, minGapMs: 0 });
  });
});
