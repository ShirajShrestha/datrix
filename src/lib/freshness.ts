/** True only when publishedAt is strictly after the previous visit timestamp. Never throws. */
export function isNewSince(publishedAt: string | Date, previousVisit: number | null): boolean {
  if (previousVisit === null || !Number.isFinite(previousVisit)) return false;
  const t = publishedAt instanceof Date ? publishedAt.getTime() : new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t > previousVisit;
}

const MAX_URL_LEN = 2000;

/** Returns a trimmed http(s) URL, or null if unsafe/invalid. */
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  if (!s || s.length > MAX_URL_LEN) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}
