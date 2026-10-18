import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import { SourceError, type RawArticle } from './types';
import { stripHtml } from './rss';

export interface GuardianResult {
  webTitle?: string;
  webUrl?: string;
  webPublicationDate?: string;
  fields?: { thumbnail?: string; trailText?: string };
}

const TIMEOUT_MS = 8000;

export function mapGuardianResult(r: GuardianResult, category: CategorySlug): RawArticle | null {
  const title = r.webTitle?.trim();
  const url = r.webUrl?.trim();
  if (!title || !url || !r.webPublicationDate) return null;
  const publishedAt = new Date(r.webPublicationDate);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const description = r.fields?.trailText ? stripHtml(r.fields.trailText) : undefined;
  return {
    title: stripHtml(title),
    url,
    source: 'The Guardian',
    category,
    publishedAt,
    description: description || undefined,
    imageUrl: r.fields?.thumbnail || undefined,
  };
}

async function fetchSection(section: string, key: string): Promise<GuardianResult[] | null> {
  try {
    const qs = new URLSearchParams({
      section,
      'show-fields': 'thumbnail,trailText',
      'order-by': 'newest',
      'page-size': '15',
      'api-key': key,
    });
    const res = await fetch(`https://content.guardianapis.com/search?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[guardian] section ${section} failed: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return Array.isArray(json?.response?.results) ? json.response.results : [];
  } catch {
    console.warn(`[guardian] section ${section} failed`);
    return null;
  }
}

export async function fetchGuardian(): Promise<RawArticle[]> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return [];

  // One call per unique section; reuse the result for every category listing it.
  const sections = [...new Set(CATEGORIES.flatMap((c) => c.guardianSections))];
  const bySection = new Map<string, GuardianResult[] | null>();
  await Promise.all(sections.map(async (s) => { bySection.set(s, await fetchSection(s, key)); }));
  // Every attempted request failed: surface it so fetchAllSources can report the adapter.
  if (sections.length > 0 && [...bySection.values()].every((v) => v === null)) throw new SourceError('guardian');

  const out: RawArticle[] = [];
  for (const cat of CATEGORIES) {
    for (const s of cat.guardianSections) {
      for (const r of bySection.get(s) ?? []) {
        const a = mapGuardianResult(r, cat.slug);
        if (a) out.push(a);
      }
    }
  }
  return out;
}
