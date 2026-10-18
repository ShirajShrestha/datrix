import { normalizeSlug, tagCategories, type CategorySlug } from '@/lib/categories';
import { fetchAllSources } from '@/lib/sources';
import { scoreArticles, deduplicateArticles, type ScoredArticle } from '@/lib/services/scoring';
import { resolveImages } from '@/lib/services/images';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';

const DAY_MS = 24 * 60 * 60 * 1000;
const POOL_PER_CATEGORY = 25;

export interface IngestReport {
  fetched: number;
  kept: number;
  created: number;
  updated: number;
  summarized: number;
  failures: string[];
  llmCalls: number;
}

export interface StoredSummary { tldr: string; bullets: string[]; whyItMatters?: string }

export function computeExpireAt(publishedAt: Date, now: Date = new Date()): Date {
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

/** TEMPORARY extractive summaries; Task 10 replaces this body with summarizeBatch. */
async function summarizeNew(
  items: ScoredArticle[],
): Promise<{ summaries: Map<string, StoredSummary>; llmCalls: number }> {
  const summaries = new Map<string, StoredSummary>();
  for (const a of items) {
    summaries.set(a.url, { tldr: a.description || a.title, bullets: [] as string[] });
  }
  return { summaries, llmCalls: 0 };
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

export async function runIngest(): Promise<IngestReport> {
  const now = new Date();
  await connectToDatabase();

  const { articles: raw, failures: sourceFailures } = await fetchAllSources();
  const failures = [...sourceFailures];
  const report: IngestReport = {
    fetched: raw.length, kept: 0, created: 0, updated: 0, summarized: 0, failures, llmCalls: 0,
  };
  if (raw.length === 0) return report;

  // Legacy cleanup, only once sources produced data.
  await Article.deleteMany({ categories: { $exists: false } });

  const built: ScoredArticle[] = raw.map((r) => ({
    ...r,
    categories: tagCategories(r.category, r.title, r.description),
    sources: [{ name: r.source, url: r.url }],
  }));
  const deduped = deduplicateArticles(scoreArticles(built));
  const pool = selectPool(deduped, POOL_PER_CATEGORY);
  report.kept = pool.length;

  const withImages = await resolveImages(pool);

  // Normalize categories and validate before touching the DB.
  const valid: ScoredArticle[] = [];
  for (const a of withImages) {
    const categories = cleanCategories(a.categories);
    if (categories.length === 0) continue;
    const candidate = { ...a, categories };
    const err = new Article({
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      categories,
      sources: candidate.sources,
      publishedAt: candidate.publishedAt,
      importanceScore: candidate.importanceScore ?? 0,
      ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
    }).validateSync();
    if (err) {
      failures.push(`invalid:${hostOf(a.url)}`);
      continue;
    }
    valid.push(candidate);
  }
  if (valid.length === 0) return report;

  const existing: { url: string; summary?: { tldr?: string } }[] = await Article.find(
    { url: { $in: valid.map((a) => a.url) } },
    { url: 1, summary: 1 },
  ).lean();
  const existingUrls = new Set(existing.map((e) => e.url));
  const hasSummary = new Set(existing.filter((e) => e.summary?.tldr).map((e) => e.url));

  const needSummary = valid.filter((a) => !hasSummary.has(a.url));
  const { summaries, llmCalls } = await summarizeNew(needSummary);
  report.llmCalls = llmCalls;
  report.summarized = summaries.size;

  const ops = valid.map((a) => {
    const publishedAt = new Date(a.publishedAt);
    const $set: Record<string, unknown> = {
      importanceScore: a.importanceScore ?? 0,
      categories: a.categories,
      sources: a.sources,
      publishedAt,
      expireAt: computeExpireAt(publishedAt, now),
    };
    if (a.imageUrl) $set.imageUrl = a.imageUrl;
    const summary = summaries.get(a.url);
    if (summary) $set.summary = summary;
    return {
      updateOne: {
        filter: { url: a.url },
        update: { $set, $setOnInsert: { title: a.title, source: a.source, topics: [] as string[] } },
        upsert: true,
        setDefaultsOnInsert: false, // expireAt is set explicitly above
      },
    };
  });

  await Article.bulkWrite(ops, { ordered: false, throwOnValidationError: true });
  report.updated = valid.filter((a) => existingUrls.has(a.url)).length;
  report.created = valid.length - report.updated;
  return report;
}
