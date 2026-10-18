import { useSyncExternalStore } from 'react';

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

// useSyncExternalStore needs getSnapshot to return the SAME reference until the data changes,
// so the parsed list is cached by the raw localStorage string.
const EMPTY: never[] = [];
let snapRaw: string | null | undefined;
let snapValue: unknown[] = EMPTY;

export function getSavedSnapshot<T extends { _id: string }>(): T[] {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVED_ARTICLES_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === snapRaw) return snapValue as T[];
  snapRaw = raw;
  snapValue = readSaved<T>();
  return snapValue as T[];
}

export function subscribeSaved(cb: () => void): () => void {
  window.addEventListener(SAVED_CHANGED_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(SAVED_CHANGED_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Live, cross-component view of the on-device saved list. */
export function useSavedArticles<T extends { _id: string }>(): T[] {
  return useSyncExternalStore(subscribeSaved, getSavedSnapshot<T>, () => EMPTY as T[]);
}
