import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import { SourceError, type RawArticle } from './types';
import { stripHtml } from './rss';

export interface GNewsArticle {
  title?: string;
  description?: string;
  url?: string;
  image?: string | null;
  publishedAt?: string;
  source?: { name?: string };
}

const TIMEOUT_MS = 8000;

export function mapGNewsArticle(a: GNewsArticle, category: CategorySlug): RawArticle | null {
  const title = a.title?.trim();
  const url = a.url?.trim();
  if (!title || !url || !a.publishedAt) return null;
  const publishedAt = new Date(a.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const description = a.description ? stripHtml(a.description) : undefined;
  return {
    title: stripHtml(title),
    url,
    source: a.source?.name || 'GNews',
    category,
    publishedAt,
    description: description || undefined,
    imageUrl: a.image || undefined,
  };
}

async function fetchTopic(topic: string, slug: CategorySlug, key: string): Promise<RawArticle[] | null> {
  try {
    const qs = new URLSearchParams({ category: topic, lang: 'en', max: '10', apikey: key });
    const res = await fetch(`https://gnews.io/api/v4/top-headlines?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[gnews] ${topic} failed: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const list: GNewsArticle[] = Array.isArray(json?.articles) ? json.articles : [];
    return list.map((a) => mapGNewsArticle(a, slug)).filter((a): a is RawArticle => a !== null);
  } catch {
    console.warn(`[gnews] ${topic} failed`);
    return null;
  }
}

export async function fetchGNews(): Promise<RawArticle[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const jobs = CATEGORIES.filter((c) => c.gnewsTopic);
  const results = await Promise.all(jobs.map((c) => fetchTopic(c.gnewsTopic!, c.slug, key)));
  if (results.length > 0 && results.every((r) => r === null)) throw new SourceError('gnews');
  return results.flatMap((r) => r ?? []);
}
