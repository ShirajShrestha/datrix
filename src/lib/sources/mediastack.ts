import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import type { RawArticle } from './types';
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

const stockTickerPattern = /\b(OTCMKTS|NYSE|TSE|AMEX|NASDAQ)\b/i;
const lowQualityPattern = /\b( Sets New \d+-Year High| Reaches New \d+-Week High| Hits New \d+-Year High| Sets New \d+-Month High| Time to Buy| What's Next| Here's What Happened)\b/i;
const earningsPattern = /\b(Q[1-4]\s*\d{4}\s*Earnings Call Transcript)\b/i;

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

async function fetchCategory(msCategory: string, slug: CategorySlug, key: string): Promise<RawArticle[]> {
  try {
    const qs = new URLSearchParams({
      access_key: key,
      categories: msCategory,
      languages: 'en',
      limit: '20',
      sort: 'published_desc',
    });
    // Free plan is HTTP only.
    const res = await fetch(`http://api.mediastack.com/v1/news?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[mediastack] ${msCategory} failed: HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const list: MediaStackArticle[] = Array.isArray(json?.data) ? json.data : [];
    return list.map((a) => mapMediaStackArticle(a, slug)).filter((a): a is RawArticle => a !== null);
  } catch {
    console.warn(`[mediastack] ${msCategory} failed`);
    return [];
  }
}

export async function fetchMediaStack(): Promise<RawArticle[]> {
  const key = process.env.MEDIASTACK_API_KEY;
  if (!key) return [];
  // One call per distinct MediaStack category (only 'world' maps to 'general').
  const seen = new Set<string>();
  const jobs = CATEGORIES.filter((c) => {
    if (!c.mediastackCategory || seen.has(c.mediastackCategory)) return false;
    seen.add(c.mediastackCategory);
    return true;
  });
  const results = await Promise.all(jobs.map((c) => fetchCategory(c.mediastackCategory!, c.slug, key)));
  return results.flat();
}
