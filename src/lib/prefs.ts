import { useSyncExternalStore } from 'react';
import { CATEGORIES, normalizeSlug, type CategorySlug } from '@/lib/categories';

export const PREFS_KEY = 'datrix_prefs';

export interface Prefs {
  categories: CategorySlug[];
  onboarded: boolean;
  notifyEnabled: boolean;
  /** 'HH:MM', 24h */
  notifyTime: string;
  lastVisit: number | null;
}

const ALL_SLUGS: CategorySlug[] = CATEGORIES.map((c) => c.slug);

export const DEFAULT_PREFS: Prefs = Object.freeze({
  categories: Object.freeze([...ALL_SLUGS]) as unknown as CategorySlug[],
  onboarded: false,
  notifyEnabled: false,
  notifyTime: '08:00',
  lastVisit: null,
}) as Prefs;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Never throws. Accepts a raw JSON string or an already-parsed value. */
export function sanitizePrefs(raw: unknown): Prefs {
  try {
    let v: unknown = raw;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        return DEFAULT_PREFS;
      }
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) return DEFAULT_PREFS;
    const o = v as Record<string, unknown>;

    let categories: CategorySlug[] = [...ALL_SLUGS];
    if (Array.isArray(o.categories)) {
      const seen = new Set<CategorySlug>();
      for (const item of o.categories) {
        if (typeof item !== 'string') continue;
        const slug = normalizeSlug(item);
        if (slug) seen.add(slug);
      }
      categories = [...seen];
    }

    const lv = o.lastVisit;
    return {
      categories,
      onboarded: typeof o.onboarded === 'boolean' ? o.onboarded : DEFAULT_PREFS.onboarded,
      notifyEnabled: typeof o.notifyEnabled === 'boolean' ? o.notifyEnabled : DEFAULT_PREFS.notifyEnabled,
      notifyTime: typeof o.notifyTime === 'string' && TIME_RE.test(o.notifyTime) ? o.notifyTime : DEFAULT_PREFS.notifyTime,
      lastVisit: typeof lv === 'number' && Number.isFinite(lv) && lv >= 0 ? lv : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Empty selection means "everything". */
export function effectiveCategories(p: Prefs): CategorySlug[] {
  return p.categories.length ? p.categories : [...ALL_SLUGS];
}

/** The lastVisit value to treat as "previous visit" for this page load. */
export function capturePreviousVisit(prefs: Prefs): number | null {
  return prefs.lastVisit;
}

/** Minimal Storage surface used by the store (injectable for tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PrefsStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Prefs;
  getServerSnapshot(): Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  getPreviousVisit(): number | null;
  touchLastVisit(now: number): void;
  /** Idempotently register storage/pagehide/visibilitychange listeners. */
  attach(win: Window | undefined): void;
}

export function createPrefsStore(getStorage: () => StorageLike | null): PrefsStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined; // undefined = never read
  let cached: Prefs = DEFAULT_PREFS;
  let memRaw: string | null = null; // in-memory fallback copy of last written value
  let persistFailed = false;
  let captured = false;
  let previousVisit: number | null = null;
  let attached = false;

  function readRaw(): string | null {
    try {
      const s = getStorage();
      if (s) {
        const v = s.getItem(PREFS_KEY);
        if (v === null && persistFailed) return memRaw;
        return v;
      }
    } catch {
      /* blocked storage: fall through */
    }
    return memRaw;
  }

  function getSnapshot(): Prefs {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw === null ? DEFAULT_PREFS : sanitizePrefs(raw);
    }
    return cached;
  }

  function notify() {
    listeners.forEach((l) => l());
  }

  function setPrefs(patch: Partial<Prefs>) {
    const next = sanitizePrefs({ ...getSnapshot(), ...patch });
    const raw = JSON.stringify(next);
    memRaw = raw;
    try {
      const s = getStorage();
      if (s) {
        s.setItem(PREFS_KEY, raw);
        persistFailed = false;
      } else persistFailed = true;
    } catch {
      persistFailed = true;
    }
    cachedRaw = raw;
    cached = next;
    notify();
  }

  function getPreviousVisit(): number | null {
    if (!captured) {
      previousVisit = capturePreviousVisit(getSnapshot());
      captured = true;
    }
    return previousVisit;
  }

  function touchLastVisit(now: number) {
    getPreviousVisit(); // make sure it is captured before lastVisit moves
    setPrefs({ lastVisit: now });
  }

  function attach(win: Window | undefined) {
    if (attached || !win) return;
    attached = true;
    getPreviousVisit();
    win.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === null || e.key === PREFS_KEY) notify();
    });
    win.addEventListener('pagehide', () => touchLastVisit(Date.now()));
    win.document?.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'hidden') touchLastVisit(Date.now());
    });
  }

  return {
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    getSnapshot,
    getServerSnapshot: () => DEFAULT_PREFS,
    setPrefs,
    getPreviousVisit,
    touchLastVisit,
    attach,
  };
}

const browserStore = createPrefsStore(() => (typeof window === 'undefined' ? null : window.localStorage));

function clientStore(): PrefsStore {
  if (typeof window !== 'undefined') browserStore.attach(window);
  return browserStore;
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const s = clientStore();
  const prefs = useSyncExternalStore(s.subscribe, s.getSnapshot, s.getServerSnapshot);
  return [prefs, s.setPrefs];
}

/** lastVisit as of first read in this page load; stable for the session. null on server / first visit. */
export function usePreviousVisit(): number | null {
  const s = clientStore();
  return useSyncExternalStore(s.subscribe, s.getPreviousVisit, () => null);
}
