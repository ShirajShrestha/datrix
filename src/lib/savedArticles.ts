export const SAVED_ARTICLES_KEY = 'newsintel_saved_articles';
export const SAVED_CHANGED_EVENT = 'newsintel:saved-changed';

export function notifySavedChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVED_CHANGED_EVENT));
}

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
    return Array.isArray(parsed) ? parsed.filter((a) => a && typeof a === 'object') : [];
  } catch {
    return [];
  }
}

export function isSavedId(id: string): boolean {
  return readSaved().some((a) => a._id === id);
}

/** Toggles in localStorage; returns the real saved state afterwards. */
export function toggleSavedStored<T extends { _id: string }>(article: T): boolean {
  const before = readSaved<T>();
  const next = toggleSaved(before, article);
  try {
    localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(next));
  } catch {
    return before.some((a) => a._id === article._id);
  }
  notifySavedChanged();
  return next.some((a) => a._id === article._id);
}
