import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import { SourceError, type RawArticle } from './types';
import { stripHtml } from './rss';

export interface MediaStackArticle {
  title?: string;
  description?: string;
  url?: string;
  image?: string | null;
  source?: string;
  published_at?: string;
}

const TIMEOUT_MS = 8000;

const stockTickerPattern = /\b(?:OTCMKTS|NYSE|TSE|AMEX|NASDAQ)\b/i;
const lowQualityPattern = /(?:Sets|Hits|Reaches) New \d+-(?:Year|Month|Week) High|Time to Buy|What's Next|Here's What Happened/i;
const earningsPattern = /Q[1-4]\s*\d{4}\s*Earnings Call Transcript/i;

export function isLowQualityTitle(title: string): boolean {
  return (stockTickerPattern.test(title) && lowQualityPattern.test(title)) || earningsPattern.test(title);
}

export function mapMediaStackArticle(a: MediaStackArticle, category: CategorySlug): RawArticle | null {
  const title = a.title?.trim();
  const url = a.url?.trim();
  if (!title || !url || !a.published_at) return null;
  if (isLowQualityTitle(title)) return null;
  const publishedAt = new Date(a.published_at);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const description = a.description ? stripHtml(a.description) : undefined;
  return {
    title: stripHtml(title),
    url,
    source: a.source || 'MediaStack',
    category,
    publishedAt,
    description: description || undefined,
    imageUrl: a.image || undefined,
  };
}

async function fetchCategory(msCategory: string, slug: CategorySlug, key: string): Promise<RawArticle[] | null> {
  try {
    const qs = new URLSearchParams({
      access_key: key,
      categories: msCategory,
      languages: 'en',
      limit: '20',
      sort: 'published_desc',
    });
    // Free plan serves HTTP only, so access_key travels in plaintext (see README).
    const res = await fetch(`http://api.mediastack.com/v1/news?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[mediastack] ${msCategory} failed: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const list: MediaStackArticle[] = Array.isArray(json?.data) ? json.data : [];
    return list.map((a) => mapMediaStackArticle(a, slug)).filter((a): a is RawArticle => a !== null);
  } catch {
    console.warn(`[mediastack] ${msCategory} failed`);
    return null;
  }
}

export const MEDIASTACK_DEFAULT_CALLS_PER_RUN = 3;
export const MEDIASTACK_MAX_CALLS_CLAMP = 7;

/** MEDIASTACK_MAX_CALLS_PER_RUN: integer clamped to 0-7 (0 disables); invalid/unset -> 3. */
export function mediastackCap(raw: string | undefined = process.env.MEDIASTACK_MAX_CALLS_PER_RUN): number {
  if (raw === undefined || raw.trim() === '') return MEDIASTACK_DEFAULT_CALLS_PER_RUN;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return MEDIASTACK_DEFAULT_CALLS_PER_RUN;
  return Math.min(MEDIASTACK_MAX_CALLS_CLAMP, Math.max(0, n));
}

function dayOfYearUtc(now: Date): number {
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000);
}

/**
 * The free plan allows 100 calls/MONTH, so each run only queries `cap` categories, rotating
 * deterministically: sort the distinct categories, start at (dayOfYear(UTC) * cap) mod n, take `cap`
 * consecutive (wrapping). Over successive days every category is visited.
 */
export function pickMediastackCategories(all: readonly string[], cap: number, now: Date = new Date()): string[] {
  const sorted = [...new Set(all)].sort();
  const n = sorted.length;
  const take = Math.min(n, Math.max(0, Math.floor(cap)));
  if (n === 0 || take === 0) return [];
  const start = (dayOfYearUtc(now) * Math.max(0, Math.floor(cap))) % n;
  return Array.from({ length: take }, (_, i) => sorted[(start + i) % n]);
}

export async function fetchMediaStack(): Promise<RawArticle[]> {
  const key = process.env.MEDIASTACK_API_KEY;
  if (!key) return [];
  // One call per distinct MediaStack category (only 'world' maps to 'general'), capped per run.
  const seen = new Map<string, CategorySlug>();
  for (const c of CATEGORIES) {
    if (c.mediastackCategory && !seen.has(c.mediastackCategory)) seen.set(c.mediastackCategory, c.slug);
  }
  const picked = pickMediastackCategories([...seen.keys()], mediastackCap());
  if (picked.length === 0) return [];
  const results = await Promise.all(picked.map((msCat) => fetchCategory(msCat, seen.get(msCat)!, key)));
  if (results.every((r) => r === null)) throw new SourceError('mediastack');
  return results.flatMap((r) => r ?? []);
}
