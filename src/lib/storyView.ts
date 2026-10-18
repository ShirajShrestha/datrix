import { safeImageUrl } from '@/lib/freshness';

export interface StorySource {
  name: string;
  url: string;
}

/** Card description: the stored description when substantial, else the tldr. */
export function pickDescription(a: { description?: string; summary?: { tldr?: string } }): string {
  const d = typeof a?.description === 'string' ? a.description.trim() : '';
  if (d.length >= 40) return d;
  const t = a?.summary?.tldr;
  return typeof t === 'string' ? t : '';
}

/** Outlets for the "also reported by" line: deduped by name, primary first. */
export function sourceLine(
  sources: StorySource[],
  primary: string,
  max = 4,
): { shown: StorySource[]; extra: number } {
  const seen = new Set<string>();
  const unique: StorySource[] = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    if (!s || typeof s.name !== 'string' || seen.has(s.name)) continue;
    seen.add(s.name);
    unique.push(s);
  }
  const idx = unique.findIndex((s) => s.name === primary);
  if (idx > 0) unique.unshift(...unique.splice(idx, 1));
  return { shown: unique.slice(0, max), extra: Math.max(0, unique.length - max) };
}

/** Hero first, then other images; http(s) only, deduped, at most 5. */
export function galleryImages(a: { imageUrl?: string; images?: string[] }): string[] {
  const out: string[] = [];
  const candidates = [a?.imageUrl, ...(Array.isArray(a?.images) ? a.images : [])];
  for (const c of candidates) {
    const u = safeImageUrl(c);
    if (u && !out.includes(u)) out.push(u);
    if (out.length >= 5) break;
  }
  return out;
}
