export const SAVED_ARTICLES_KEY = 'newsintel_saved_articles';

/** Toggle membership by _id; saved copies carry isSaved: true (same shape the pages use). */
export function toggleSaved<T extends { _id: string }>(list: T[], article: T): T[] {
  return list.some((a) => a._id === article._id)
    ? list.filter((a) => a._id !== article._id)
    : [...list, { ...article, isSaved: true }];
}

export function readSaved<T extends { _id: string }>(): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_ARTICLES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isSavedId(id: string): boolean {
  return readSaved().some((a) => a._id === id);
}

/** Toggles in localStorage; returns the new saved state. */
export function toggleSavedStored<T extends { _id: string }>(article: T): boolean {
  const next = toggleSaved(readSaved<T>(), article);
  try {
    localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next.some((a) => a._id === article._id);
}
