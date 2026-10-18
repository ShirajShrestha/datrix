import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  parseSummaries, extractiveSummary, summarizeBatch, MissingKeyError, ProviderHttpError,
  type SummaryInput, type SummaryProvider,
} from '../services/summarizer';
import { groqProvider } from '../services/summarizer/groq';
import { geminiProvider } from '../services/summarizer/gemini';

const mkItems = (n: number): SummaryInput[] =>
  Array.from({ length: n }, (_, i) => ({ url: `https://x.test/${i}`, title: `Title ${i}`, description: `Description number ${i} is long enough to be a sentence.` }));
const sum = (t: string) => ({ tldr: t, bullets: ['b'] });
const batch3 = mkItems(3);

describe('parseSummaries', () => {
  it('accepts fenced JSON with surrounding prose', () => {
    const raw = 'Sure!\n```json\n{"items":[{"id":0,"tldr":"A","bullets":["x","y"],"whyItMatters":"W"}]}\n```\nDone';
    const m = parseSummaries(raw, batch3);
    expect(m.get(batch3[0].url)).toEqual({ tldr: 'A', bullets: ['x', 'y'], whyItMatters: 'W' });
  });
  it('accepts unfenced JSON with leading/trailing prose', () => {
    expect(parseSummaries('here {"items":[{"id":1,"tldr":"B","bullets":[]}]} bye', batch3).size).toBe(1);
  });
  it('drops item missing tldr, or with bad bullets', () => {
    const raw = JSON.stringify({ items: [{ id: 0, bullets: [] }, { id: 1, tldr: '  ', bullets: [] }, { id: 2, tldr: 'ok', bullets: 'no' }, { id: 0, tldr: 'ok', bullets: [1] }] });
    expect(parseSummaries(raw, batch3).size).toBe(0);
  });
  it('ignores unknown ids', () => {
    const raw = JSON.stringify({ items: [{ id: 9, tldr: 'a', bullets: [] }, { id: -1, tldr: 'a', bullets: [] }, { id: 'https://x.test/0', tldr: 'a', bullets: [] }, { id: 2, tldr: 'ok', bullets: [] }] });
    expect([...parseSummaries(raw, batch3).keys()]).toEqual([batch3[2].url]);
  });
  it('non-JSON text gives empty map', () => {
    expect(parseSummaries('I cannot help with that', batch3).size).toBe(0);
    expect(parseSummaries('', batch3).size).toBe(0);
  });
  it('strips HTML and clamps lengths', () => {
    const raw = JSON.stringify({ items: [{ id: 0, tldr: '<b>Hi</b> <script>alert(1)</script>there', bullets: ['<i>a</i>', 'b', 'c', 'd', 'e', 'z'.repeat(500)], whyItMatters: '<p>w</p>' }] });
    const s = parseSummaries(raw, batch3).get(batch3[0].url)!;
    expect(s.tldr).not.toMatch(/[<>]/);
    expect(s.bullets).toHaveLength(4);
    expect(s.bullets[0]).toBe('a');
    expect(s.whyItMatters).toBe('w');
    const long = parseSummaries(JSON.stringify({ items: [{ id: 0, tldr: 'w '.repeat(400), bullets: ['y'.repeat(500)] }] }), batch3).get(batch3[0].url)!;
    expect(long.tldr.length).toBeLessThanOrEqual(300);
    expect(long.bullets[0].length).toBeLessThanOrEqual(200);
  });
});

describe('extractiveSummary', () => {
  it('has no whyItMatters, never throws, tolerates missing description', () => {
    const a = extractiveSummary({ url: 'u', title: 'Only a title' });
    expect(a.tldr).toBe('Only a title');
    expect('whyItMatters' in a).toBe(false);
    expect(() => extractiveSummary({ url: 'u' } as unknown as SummaryInput)).not.toThrow();
    expect(() => extractiveSummary(null as unknown as SummaryInput)).not.toThrow();
    expect(a.provider).toBe('extractive');
  });
});

describe('summarizeBatch', () => {
  it('falls through: A returns 2 of 3, B returns the third, extractive unused', async () => {
    const A: SummaryProvider = vi.fn(async (b: SummaryInput[]) => new Map(b.slice(0, 2).map((x) => [x.url, sum('A')] as const)));
    const B: SummaryProvider = vi.fn(async (b: SummaryInput[]) => { expect(b).toHaveLength(1); return new Map(b.map((x) => [x.url, sum('B')] as const)); });
    const { summaries, llmCalls } = await summarizeBatch(batch3, [A, B]);
    expect(batch3.map((b) => summaries.get(b.url)!.tldr)).toEqual(['A', 'A', 'B']);
    expect(summaries.get(batch3[0].url)!.provider).toBe('groq');
    expect(summaries.get(batch3[2].url)!.provider).toBe('gemini');
    expect(llmCalls).toBe(2);
  });
  it('all providers throw: every item gets extractive, none lost', async () => {
    const boom: SummaryProvider = async () => { throw new Error('x'); };
    const items = mkItems(20);
    const { summaries, llmCalls } = await summarizeBatch(items, [boom, boom]);
    expect(summaries.size).toBe(20);
    for (const i of items) {
      expect(summaries.get(i.url)!.provider).toBe('extractive');
      expect('whyItMatters' in summaries.get(i.url)!).toBe(false);
    }
    expect(llmCalls).toBe(6); // 3 groups x 2 providers
  });
  it('splits into groups of 8 and preserves item order', async () => {
    const sizes: string[][] = [];
    const P: SummaryProvider = async (b) => { sizes.push(b.map((x) => x.url)); return new Map(b.map((x) => [x.url, sum('p')])); };
    const items = mkItems(19);
    const { summaries } = await summarizeBatch(items, [P], { concurrency: 1 });
    expect(sizes.map((s) => s.length)).toEqual([8, 8, 3]);
    expect(sizes.flat()).toEqual(items.map((i) => i.url));
    expect([...summaries.keys()]).toEqual(items.map((i) => i.url));
  });
  it('429 marks provider exhausted for the rest of the run', async () => {
    const A = vi.fn<SummaryProvider>(async () => { throw new ProviderHttpError('groq', 429); });
    const B: SummaryProvider = async (b) => new Map(b.map((x) => [x.url, sum('B')]));
    const { summaries, llmCalls } = await summarizeBatch(mkItems(24), [A, B], { concurrency: 1 });
    expect(A).toHaveBeenCalledTimes(1);
    expect(llmCalls).toBe(1 + 3);
    expect(summaries.size).toBe(24);
  });
  it('non-429 errors do not exhaust the provider', async () => {
    const A = vi.fn<SummaryProvider>(async () => { throw new ProviderHttpError('groq', 500); });
    await summarizeBatch(mkItems(16), [A], { concurrency: 1 });
    expect(A).toHaveBeenCalledTimes(2);
  });
  it('deadline reached: remaining items extractive with no further provider calls', async () => {
    let t = 0;
    const P = vi.fn<SummaryProvider>(async (b) => { t += 100; return new Map(b.map((x) => [x.url, sum('P')])); });
    const { summaries, llmCalls } = await summarizeBatch(mkItems(24), [P], { concurrency: 1, deadlineAt: 150, now: () => t });
    expect(llmCalls).toBe(2);
    const provs = [...summaries.values()].map((s) => s.provider);
    expect(provs.filter((p) => p === 'extractive')).toHaveLength(8);
    expect(summaries.size).toBe(24);
  });
  it('passes remaining time as timeout (capped at 12s)', async () => {
    const seen: (number | undefined)[] = [];
    const P: SummaryProvider = async (_b, o) => { seen.push(o?.timeoutMs); return new Map(); };
    await summarizeBatch(mkItems(1), [P], { deadlineAt: 5000, now: () => 0 });
    await summarizeBatch(mkItems(1), [P], { deadlineAt: 50_000, now: () => 0 });
    expect(seen).toEqual([5000, 12000]);
  });
  it('missing key skips provider with 0 calls', async () => {
    const A = vi.fn<SummaryProvider>(async () => { throw new MissingKeyError('groq'); });
    const B: SummaryProvider = async (b) => new Map(b.map((x) => [x.url, sum('B')]));
    const { llmCalls, summaries } = await summarizeBatch(mkItems(16), [A, B], { concurrency: 1 });
    expect(A).toHaveBeenCalledTimes(1);
    expect(llmCalls).toBe(2);
    expect([...summaries.values()].every((s) => s.provider === 'gemini')).toBe(true);
  });
  it('concurrency never exceeds the limit', async () => {
    let cur = 0, max = 0;
    const P: SummaryProvider = async (b) => {
      cur++; max = Math.max(max, cur);
      await new Promise((r) => setTimeout(r, 5));
      cur--;
      return new Map(b.map((x) => [x.url, sum('p')]));
    };
    await summarizeBatch(mkItems(80), [P], { concurrency: 3 });
    expect(max).toBe(3);
  });
  it('empty input and no providers are safe', async () => {
    expect((await summarizeBatch([], [])).summaries.size).toBe(0);
    expect((await summarizeBatch(mkItems(2), [])).summaries.size).toBe(2);
  });
  it('llmCalls counts provider invocations', async () => {
    const P: SummaryProvider = async () => new Map();
    expect((await summarizeBatch(mkItems(9), [P, P])).llmCalls).toBe(4);
  });
});

describe('providers (stubbed fetch)', () => {
  const KEY = 'sk-secret-123';
  const env = { ...process.env };
  beforeEach(() => { process.env.GROQ_API_KEY = KEY; process.env.GEMINI_API_KEY = KEY; process.env.GROQ_MODEL = 'm-groq'; process.env.GEMINI_MODEL = 'm-gem'; });
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });
  const content = JSON.stringify({ items: [{ id: 0, tldr: 'T', bullets: ['b'] }] });

  it('groq: request shape and parsing', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const m = await groqProvider(batch3);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('m-groq');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBeLessThanOrEqual(0.2);
    expect(JSON.stringify(body.messages)).toContain('Title 0');
    expect(JSON.stringify(body.messages)).not.toContain('https://x.test/0');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(m.get(batch3[0].url)!.tldr).toBe('T');
  });
  it('gemini: request shape and parsing', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const m = await geminiProvider(batch3);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m-gem:generateContent');
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.temperature).toBeLessThanOrEqual(0.2);
    expect(m.get(batch3[0].url)!.tldr).toBe('T');
  });
  it('missing key throws MissingKeyError without calling fetch', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY;
    await expect(groqProvider(batch3)).rejects.toBeInstanceOf(MissingKeyError);
    await expect(geminiProvider(batch3)).rejects.toBeInstanceOf(MissingKeyError);
    expect(f).not.toHaveBeenCalled();
  });
  it('HTTP errors carry status only, never the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`bad key ${KEY}`, { status: 429 })));
    for (const p of [groqProvider, geminiProvider]) {
      const e = await p(batch3).catch((x) => x);
      expect(e).toBeInstanceOf(ProviderHttpError);
      expect(e.status).toBe(429);
      expect(e.message).not.toContain(KEY);
    }
  });
});
