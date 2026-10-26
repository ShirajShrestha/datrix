import { resolveSlugs } from '@/lib/storyView';
import { getCategory } from '@/lib/categories';

export const DIGEST_SIZE = 10;

/** Digest sections: top stories by importance, grouped by primary topic, groups ordered by their best story. */
export function groupDigest<T extends { _id: string; importanceScore: number; categories?: string[]; category?: string }>(
  articles: T[],
  size = DIGEST_SIZE,
): { slug: string; label: string; items: { n: number; article: T }[] }[] {
  const top = [...articles].sort((a, b) => b.importanceScore - a.importanceScore).slice(0, size);
  const groups = new Map<string, T[]>();
  for (const a of top) {
    const slug = resolveSlugs(a)[0] ?? 'other';
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug)!.push(a);
  }
  let n = 0;
  return [...groups.entries()].map(([slug, items]) => ({
    slug,
    label: getCategory(slug)?.label ?? 'Other',
    items: items.map((article) => ({ n: ++n, article })),
  }));
}
