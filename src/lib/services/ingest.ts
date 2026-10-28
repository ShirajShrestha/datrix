import { normalizeSlug, tagCategories, type CategorySlug } from '@/lib/categories';
import { fetchAllSources } from '@/lib/sources';
import { scoreArticles, deduplicateArticles, unionImages, MAX_SOURCES, type ScoredArticle } from '@/lib/services/scoring';
import { resolveImages } from '@/lib/services/images';
import { connectToDatabase } from '@/lib/db';
import { summarizeBatch, extractiveSummary, type SummaryInput } from '@/lib/services/summarizer';
import { resolveBodies } from '@/lib/services/body';
import { Article } from '@/lib/models/Article';

const DAY_MS = 24 * 60 * 60 * 1000;
export const POOL_PER_CATEGORY = 25;
// Route maxDuration is 120 s; stop starting new work after 100 s.
export const INGEST_BUDGET_MS = 100_000;
export const SOURCE_FETCH_DEADLINE_MS = 35_000;
const SOURCE_FETCH_RESERVE_MS = 20_000;

/** Fetch-phase deadline: min(35 s, remaining budget - 20 s), never negative. */
export function planFetchDeadline(elapsedMs: number, budgetMs: number = INGEST_BUDGET_MS): number {
  return Math.max(0, Math.min(SOURCE_FETCH_DEADLINE_MS, budgetMs - elapsedMs - SOURCE_FETCH_RESERVE_MS));
}

function isHttpUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const p = new URL(u).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

/**
 * Drops articles whose own url is not http(s), and `sources[]` entries with non-http(s) urls.
 * An article left with no valid source gets one built from its own name/url.
 */
export function sanitizeArticleUrls<T extends { url: string; source: string; sources: { name: string; url: string; snippet?: string }[] }>(a: T): T | null {
  if (!isHttpUrl(a.url)) return null;
  const sources = (Array.isArray(a.sources) ? a.sources : []).filter((s) => s && isHttpUrl(s.url));
  return { ...a, sources: sources.length ? sources : [{ name: a.source, url: a.url, ...(a.sources?.[0]?.snippet ? { snippet: a.sources[0].snippet } : {}) }] };
}
const SNIPPET_MAX = 600;

/** Trim, collapse whitespace, cap at 600 chars on a word boundary; undefined when empty. */
export function clampSnippet(s?: string): string | undefined {
  const t = typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!t) return undefined;
  if (t.length <= SNIPPET_MAX) return t;
  const cut = t.slice(0, SNIPPET_MAX);
  const sp = cut.lastIndexOf(' ');
  return sp > 0 ? cut.slice(0, sp) : cut;
}

const IMAGE_MIN_REMAINING_MS = 12_000;
const WRITE_RESERVE_MS = 8_000;
const SUMMARY_WRITE_RESERVE_MS = 6_000;

export function planImageBudget(
  elapsedMs: number,
  budgetMs: number = INGEST_BUDGET_MS,
): { run: boolean; max: number; raceMs: number } {
  const remaining = budgetMs - elapsedMs;
  if (remaining < IMAGE_MIN_REMAINING_MS) return { run: false, max: 0, raceMs: 0 };
  return { run: true, max: Math.min(60, Math.floor(remaining / 1000)), raceMs: remaining - WRITE_RESERVE_MS };
}

/** Merge items sharing a url: keep highest importanceScore, union categories/sources, first non-empty imageUrl, unioned images. */
export function mergeByUrl<T extends ScoredArticle>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const it of items) {
    const cur = map.get(it.url);
    if (!cur) {
      map.set(it.url, { ...it, categories: [...it.categories], sources: [...it.sources] });
      continue;
    }
    const best = (it.importanceScore ?? 0) > (cur.importanceScore ?? 0) ? it : cur;
    const other = best === it ? cur : it;
    const sources = [...best.sources];
    for (const r of other.sources) if (!sources.some((x) => x.name === r.name && x.url === r.url)) sources.push(r);
    map.set(it.url, {
      ...best,
      categories: [...new Set([...best.categories, ...other.categories])],
      sources: sources.slice(0, MAX_SOURCES),
      imageUrl: best.imageUrl || other.imageUrl,
      body: best.body || other.body,
      images: unionImages(best.images, other.images),
    });
  }
  return [...map.values()];
}

export function buildOps(
  valid: ScoredArticle[],
  summaries: Map<string, StoredSummary>,
  llmSummaryUrls: Set<string>,
  now: Date,
) {
  return valid.map((a) => {
    const publishedAt = new Date(a.publishedAt);
    const $set: Record<string, unknown> = {
      importanceScore: a.importanceScore ?? 0,
      categories: a.categories,
      sources: a.sources,
      publishedAt,
      expireAt: computeExpireAt(publishedAt, now),
      // Explicit so the push recency guard (updatedAt within 24 h) sees every daily re-upsert.
      updatedAt: now,
    };
    if (a.imageUrl) $set.imageUrl = a.imageUrl;
    const description = clampSnippet(a.description);
    if (description) $set.description = description;
    if (a.images?.length) $set.images = a.images;
    // brief/briefTriedAt are owned by the brief generator; never touched here.
    const summary = summaries.get(a.url);
    // Overwrite extractive/missing summaries, but never replace a stored LLM summary.
    if (summary && !llmSummaryUrls.has(a.url)) $set.summary = summary;
    return {
      updateOne: {
        filter: { url: a.url },
        update: { $set, $setOnInsert: { title: a.title, source: a.source, topics: [] as string[] } },
        upsert: true,
        setDefaultsOnInsert: false, // expireAt is set explicitly above
      },
    };
  });
}

export interface IngestReport {
  fetched: number;
  kept: number;
  created: number;
  updated: number;
  summarized: number;
  llmSummarized: number;
  failures: string[];
  llmCalls: number;
  /** Articles sent to the summarizer with an article body. */
  bodies: number;
}

export interface StoredSummary {
  tldr: string;
  bullets: string[];
  whyItMatters?: string;
  provider?: 'groq' | 'gemini' | 'extractive';
}

/** Articles needing a summary: none stored, or only an extractive/legacy one (provider not groq|gemini). */
export function selectNeedSummary(
  valid: ScoredArticle[],
  existing: { url: string; summary?: { tldr?: string; provider?: string } }[],
): { needSummary: ScoredArticle[]; llmSummaryUrls: Set<string> } {
  const llmSummaryUrls = new Set(
    existing
      .filter((e) => e.summary?.tldr && (e.summary.provider === 'groq' || e.summary.provider === 'gemini'))
      .map((e) => e.url),
  );
  const needSummary = valid
    .filter((a) => !llmSummaryUrls.has(a.url))
    .sort(compareArticles);
  return { needSummary, llmSummaryUrls };
}

/** Throws RangeError on an invalid publishedAt (callers validate documents first). */
export function computeExpireAt(publishedAt: Date, now: Date = new Date()): Date {
  if (Number.isNaN(publishedAt.getTime())) throw new RangeError('invalid publishedAt');
  return new Date(Math.max(publishedAt.getTime() + 30 * DAY_MS, now.getTime() + DAY_MS));
}

function compareArticles(a: ScoredArticle, b: ScoredArticle): number {
  const s = (b.importanceScore ?? 0) - (a.importanceScore ?? 0);
  if (s !== 0) return s;
  const t = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  if (t !== 0) return t;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

/** Keep an article if it is in the top N by importanceScore of ANY of its categories. */
export function selectPool(articles: ScoredArticle[], perCategory: number): ScoredArticle[] {
  const sorted = [...articles].sort(compareArticles);
  const counts = new Map<string, number>();
  const kept = new Set<string>();
  const out: ScoredArticle[] = [];
  for (const a of sorted) {
    let keep = false;
    for (const c of new Set(a.categories)) {
      const n = counts.get(c) ?? 0;
      if (n < perCategory) {
        counts.set(c, n + 1);
        keep = true;
      }
    }
    if (keep && !kept.has(a.url)) {
      kept.add(a.url);
      out.push(a);
    }
  }
  return out;
}

/** Builds summarizer inputs in order; `body` is set only for urls present in the map. */
export function attachBodies(needSummary: ScoredArticle[], bodies: Map<string, string>): SummaryInput[] {
  return needSummary.map((a) => {
    const input: SummaryInput = { url: a.url, title: a.title, description: a.description };
    const body = bodies.get(a.url);
    if (body) input.body = body;
    return input;
  });
}

const BODY_DEADLINE_MARGIN_MS = 30_000;
const MIN_LLM_DESCRIPTION_CHARS = 200;

/** Worth an LLM call: has article text, or a description long enough to summarize. */
export function isLlmEligible(a: { body?: string; description?: string }): boolean {
  return Boolean(a.body) || (a.description?.length ?? 0) >= MIN_LLM_DESCRIPTION_CHARS;
}

/** Items with a body first; relative order is otherwise preserved. */
export function orderForSummary<T extends ScoredArticle>(items: T[]): T[] {
  return [...items.filter((i) => i.body), ...items.filter((i) => !i.body)];
}

export async function summarizeNew(
  items: ScoredArticle[],
  deadlineAt: number,
  now: () => number,
  bodyMax: number,
  retry429Ms: number,
  concurrency = 3,
  minGapMs = 0,
): Promise<{ summaries: Map<string, StoredSummary>; llmCalls: number; failures: string[]; bodies: number }> {
  let bodies = new Map<string, string>();
  if (items.length > 0) {
    // The cap only limits NEW page fetches; feed-provided bodies are kept for every item.
    const fetched = bodyMax > 0
      ? await resolveBodies(items.slice(0, bodyMax), { max: bodyMax, deadlineAt: deadlineAt - BODY_DEADLINE_MARGIN_MS, now })
      : new Map<string, string>();
    bodies = fetched;
    for (const a of items) if (a.body && !bodies.has(a.url)) bodies.set(a.url, a.body);
  }
  // Order and eligibility use the resolved body (feed or fetched), not just the feed one.
  const withBody = items.map((i) => (bodies.has(i.url) ? { ...i, body: bodies.get(i.url) } : i));
  const ordered = orderForSummary(withBody);
  const eligible = ordered.filter(isLlmEligible);
  const inputs = attachBodies(eligible, bodies);
  const summaries = new Map<string, StoredSummary>();
  // Nothing worth sending to an LLM: store an extractive summary directly.
  for (const i of ordered) {
    if (!isLlmEligible(i)) summaries.set(i.url, extractiveSummary({ url: i.url, title: i.title, description: i.description }));
  }
  let llmCalls = 0;
  let failures: string[] = [];
  if (inputs.length > 0) {
    const r = await summarizeBatch(inputs, undefined, { deadlineAt, now, retry429Ms, concurrency, minGapMs });
    for (const [u, v] of r.summaries) summaries.set(u, v);
    llmCalls = r.llmCalls;
    failures = r.failures;
  }
  return { summaries, llmCalls, failures, bodies: inputs.filter((i) => i.body).length };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || 'unknown';
  } catch {
    return 'unknown';
  }
}

function cleanCategories(cats: string[]): CategorySlug[] {
  const out: CategorySlug[] = [];
  for (const c of cats) {
    const n = normalizeSlug(c);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export async function runIngest(
  opts: { clock?: () => number; budgetMs?: number; poolPerCategory?: number; bodyMax?: number; retry429Ms?: number; summarizeConcurrency?: number; minCallGapMs?: number } = {},
): Promise<IngestReport> {
  const budgetMs = opts.budgetMs ?? INGEST_BUDGET_MS;
  const poolPerCategory = opts.poolPerCategory ?? POOL_PER_CATEGORY;
  const clock = opts.clock ?? Date.now;
  const startedAt = clock();
  const now = new Date();
  await connectToDatabase();

  const { articles: raw, failures: sourceFailures } = await fetchAllSources({ deadlineMs: planFetchDeadline(0, budgetMs) });
  const failures = [...sourceFailures];
  const report: IngestReport = {
    fetched: raw.length, kept: 0, created: 0, updated: 0, summarized: 0, llmSummarized: 0, failures, llmCalls: 0, bodies: 0,
  };
  if (raw.length === 0) return report;

  // Legacy cleanup, only once sources produced data.
  await Article.deleteMany({ categories: { $exists: false } });

  const built: ScoredArticle[] = raw.map((r) => ({
    ...r,
    categories: tagCategories(r.category, r.title, r.description),
    sources: [{ name: r.source, url: r.url, snippet: clampSnippet(r.description) }],
    images: r.imageUrl ? [r.imageUrl] : [],
  }));
  const deduped = deduplicateArticles(scoreArticles(built));
  const pool = selectPool(deduped, poolPerCategory);
  report.kept = pool.length;

  const plan = planImageBudget(clock() - startedAt, budgetMs);
  let withImages = pool;
  if (plan.run) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((res) => { timer = setTimeout(() => res(null), plan.raceMs); });
    const res = await Promise.race([resolveImages(pool, { max: plan.max }), timeout]);
    if (timer) clearTimeout(timer);
    if (res) withImages = res;
    else failures.push('images:timeout');
  }

  // Normalize categories and validate before touching the DB.
  const validated: ScoredArticle[] = [];
  for (const a0 of withImages) {
    const a = sanitizeArticleUrls(a0);
    if (!a) {
      failures.push('invalid:url');
      continue;
    }
    const categories = cleanCategories(a.categories);
    if (categories.length === 0) continue;
    // Resolved imageUrl (images.ts) leads the gallery.
    const candidate = { ...a, categories, images: unionImages([a.imageUrl ?? ''], a.images) };
    const err = new Article({
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      categories,
      sources: candidate.sources,
      publishedAt: candidate.publishedAt,
      importanceScore: candidate.importanceScore ?? 0,
      ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
      ...(candidate.description ? { description: candidate.description } : {}),
      images: candidate.images,
    }).validateSync();
    if (err) {
      failures.push(`invalid:${hostOf(a.url)}`);
      continue;
    }
    validated.push(candidate);
  }
  const valid = mergeByUrl(validated);
  if (valid.length === 0) return report;

  const existing: { url: string; summary?: { tldr?: string; provider?: string } }[] = await Article.find(
    { url: { $in: valid.map((a) => a.url) } },
    { url: 1, summary: 1 },
  ).lean();
  const { needSummary, llmSummaryUrls } = selectNeedSummary(valid, existing);
  const { summaries, llmCalls, failures: summarizerFailures, bodies } = await summarizeNew(
    needSummary, startedAt + budgetMs - SUMMARY_WRITE_RESERVE_MS, clock, opts.bodyMax ?? 0, opts.retry429Ms ?? 0,
    opts.summarizeConcurrency ?? 3, opts.minCallGapMs ?? 0,
  );
  report.llmCalls = llmCalls;
  report.bodies = bodies;
  for (const f of summarizerFailures) if (!failures.includes(f)) failures.push(f);
  report.summarized = summaries.size;
  report.llmSummarized = [...summaries.values()].filter((x) => x.provider === 'groq' || x.provider === 'gemini').length;

  const ops = buildOps(valid, summaries, llmSummaryUrls, now);
  try {
    const r = await Article.bulkWrite(ops, { ordered: false, throwOnValidationError: true });
    report.created = r.upsertedCount ?? 0;
    // matchedCount = existing docs touched (modifiedCount would hide unchanged ones).
    report.updated = r.matchedCount ?? 0;
  } catch (e) {
    const err = e as { name?: string; result?: Record<string, number>; writeErrors?: unknown[] };
    if (/MongoNetworkError|MongoServerSelectionError|MongoNotConnected/.test(err?.name ?? '')) throw e;
    const res = err?.result ?? {};
    report.created = res.upsertedCount ?? 0;
    report.updated = res.matchedCount ?? 0;
    const n = Array.isArray(err?.writeErrors) ? err.writeErrors.length : undefined;
    failures.push(n !== undefined ? `write-error:${n}` : 'write-error');
  }
  return report;
}
