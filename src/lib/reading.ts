import { useSyncExternalStore } from 'react';
import type { StorageLike } from '@/lib/prefs';

/**
 * On-device reading state: what was read and when, the daily goal, summary length and reactions.
 * Pure helpers are exported for tests; the store mirrors the prefs store (localStorage + memory fallback).
 */

export const READING_KEY = 'datrix_reading';
export const LOG_DAYS = 35;

export type SummaryMode = 'headlines' | 'key' | 'detailed';
export type Reaction = 'important' | 'surprising' | 'more';

export interface ReadEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  categories: string[];
}

export interface ReadingState {
  log: ReadEntry[];
  goal: number;
  summaryMode: SummaryMode;
  reactions: Record<string, Reaction>;
  bestStreak: number;
}

export const DEFAULT_READING: ReadingState = Object.freeze({
  log: [],
  goal: 5,
  summaryMode: 'key',
  reactions: {},
  bestStreak: 0,
}) as ReadingState;

const MODES: SummaryMode[] = ['headlines', 'key', 'detailed'];
const REACTIONS: Reaction[] = ['important', 'surprising', 'more'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LOG = 2000;
const MAX_REACTIONS = 500;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day for a timestamp. */
export function dayKey(t: number | Date): string {
  const d = t instanceof Date ? t : new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day key `n` days before `t` (local time, DST safe). */
export function dayKeyBefore(t: number | Date, n: number): string {
  const d = t instanceof Date ? new Date(t.getTime()) : new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

/** Never throws. */
export function sanitizeReading(raw: unknown): ReadingState {
  try {
    let v: unknown = raw;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        return DEFAULT_READING;
      }
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) return DEFAULT_READING;
    const o = v as Record<string, unknown>;

    const log: ReadEntry[] = [];
    const seen = new Set<string>();
    if (Array.isArray(o.log)) {
      for (const e of o.log.slice(-MAX_LOG)) {
        if (!e || typeof e !== 'object') continue;
        const r = e as Record<string, unknown>;
        if (typeof r.id !== 'string' || !r.id || r.id.length > 64) continue;
        if (typeof r.day !== 'string' || !DAY_RE.test(r.day)) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const cats = Array.isArray(r.categories)
          ? r.categories.filter((c): c is string => typeof c === 'string' && c.length <= 32).slice(0, 6)
          : [];
        log.push({ id: r.id, day: r.day, categories: cats });
      }
    }

    const reactions: Record<string, Reaction> = {};
    if (o.reactions && typeof o.reactions === 'object' && !Array.isArray(o.reactions)) {
      for (const [k, val] of Object.entries(o.reactions as Record<string, unknown>).slice(-MAX_REACTIONS)) {
        if (k.length <= 64 && REACTIONS.includes(val as Reaction)) reactions[k] = val as Reaction;
      }
    }

    const goal = typeof o.goal === 'number' && Number.isInteger(o.goal) && o.goal >= 1 && o.goal <= 20 ? o.goal : DEFAULT_READING.goal;
    const summaryMode = MODES.includes(o.summaryMode as SummaryMode) ? (o.summaryMode as SummaryMode) : DEFAULT_READING.summaryMode;
    const bestStreak = typeof o.bestStreak === 'number' && Number.isInteger(o.bestStreak) && o.bestStreak >= 0 ? o.bestStreak : 0;
    return { log, goal, summaryMode, reactions, bestStreak };
  } catch {
    return DEFAULT_READING;
  }
}

/** Drop log entries older than LOG_DAYS. */
export function pruneLog(log: ReadEntry[], now: number): ReadEntry[] {
  const cutoff = dayKeyBefore(now, LOG_DAYS);
  return log.filter((e) => e.day >= cutoff);
}

/** Days (newest first) on which at least one story was read. */
function readDays(log: ReadEntry[]): Set<string> {
  return new Set(log.map((e) => e.day));
}

/**
 * Consecutive days with at least one read, ending today. If nothing is read yet today the streak is
 * still alive and counts back from yesterday.
 */
export function currentStreak(log: ReadEntry[], now: number): number {
  const days = readDays(log);
  const start = days.has(dayKey(now)) ? 0 : 1;
  let n = 0;
  while (days.has(dayKeyBefore(now, start + n))) n++;
  return n;
}

export function readTodayCount(log: ReadEntry[], now: number): number {
  const today = dayKey(now);
  return log.filter((e) => e.day === today).length;
}

/** Last 7 days, oldest first: weekday initial and whether anything was read. */
export function weekStrip(log: ReadEntry[], now: number): { day: string; label: string; read: boolean; today: boolean }[] {
  const days = readDays(log);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayKeyBefore(now, i);
    const d = new Date(`${key}T12:00:00`);
    out.push({ day: key, label: 'SMTWTFS'[d.getDay()], read: days.has(key), today: i === 0 });
  }
  return out;
}

/** Share of reads per primary category over the last 7 days, largest first. */
export function newsDiet(log: ReadEntry[], now: number): { slug: string; count: number; share: number }[] {
  const cutoff = dayKeyBefore(now, 6);
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of log) {
    if (e.day < cutoff || !e.categories[0]) continue;
    counts.set(e.categories[0], (counts.get(e.categories[0]) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

/** Mark an article read (idempotent). Returns the same object when nothing changed. */
export function markReadIn(state: ReadingState, a: { _id: string; categories?: string[] }, now: number): ReadingState {
  if (!a || typeof a._id !== 'string' || !a._id || state.log.some((e) => e.id === a._id)) return state;
  const entry: ReadEntry = { id: a._id, day: dayKey(now), categories: (a.categories ?? []).slice(0, 6) };
  const log = pruneLog([...state.log, entry], now);
  const streak = currentStreak(log, now);
  return { ...state, log, bestStreak: Math.max(state.bestStreak, streak) };
}

/** Toggle a reaction: picking the current one clears it. */
export function reactIn(state: ReadingState, id: string, r: Reaction): ReadingState {
  const reactions = { ...state.reactions };
  if (reactions[id] === r) delete reactions[id];
  else reactions[id] = r;
  return { ...state, reactions };
}

// ---- store -----------------------------------------------------------------------------------

export interface ReadingStore {
  subscribe(l: () => void): () => void;
  getSnapshot(): ReadingState;
  getServerSnapshot(): ReadingState;
  update(fn: (s: ReadingState) => ReadingState): void;
  attach(win: Window | undefined): void;
}

export function createReadingStore(getStorage: () => StorageLike | null): ReadingStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: ReadingState = DEFAULT_READING;
  let memRaw: string | null = null;
  let persistFailed = false;
  let attached = false;

  function readRaw(): string | null {
    try {
      const s = getStorage();
      if (persistFailed) return memRaw;
      if (s) return s.getItem(READING_KEY);
    } catch {
      /* blocked storage */
    }
    return memRaw;
  }

  function getSnapshot(): ReadingState {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw === null ? DEFAULT_READING : sanitizeReading(raw);
    }
    return cached;
  }

  const notify = () => listeners.forEach((l) => l());

  function update(fn: (s: ReadingState) => ReadingState) {
    const prev = getSnapshot();
    const next = fn(prev);
    if (next === prev) return;
    const raw = JSON.stringify(next);
    memRaw = raw;
    try {
      const s = getStorage();
      if (s) {
        s.setItem(READING_KEY, raw);
        persistFailed = false;
      } else persistFailed = true;
    } catch {
      persistFailed = true;
    }
    cachedRaw = raw;
    cached = next;
    notify();
  }

  return {
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    getSnapshot,
    getServerSnapshot: () => DEFAULT_READING,
    update,
    attach(win) {
      if (attached || !win) return;
      attached = true;
      win.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === null || e.key === READING_KEY) {
          persistFailed = false;
          notify();
        }
      });
    },
  };
}

const browserStore = createReadingStore(() => (typeof window === 'undefined' ? null : window.localStorage));

export function useReading(): ReadingState {
  if (typeof window !== 'undefined') browserStore.attach(window);
  return useSyncExternalStore(browserStore.subscribe, browserStore.getSnapshot, browserStore.getServerSnapshot);
}

export function markRead(a: { _id: string; categories?: string[] }): void {
  browserStore.update((s) => markReadIn(s, a, Date.now()));
}

export function setSummaryMode(mode: SummaryMode): void {
  browserStore.update((s) => (s.summaryMode === mode ? s : { ...s, summaryMode: mode }));
}

export function setGoal(goal: number): void {
  const g = Math.max(1, Math.min(20, Math.round(goal)));
  browserStore.update((s) => (s.goal === g ? s : { ...s, goal: g }));
}

export function react(id: string, r: Reaction): void {
  browserStore.update((s) => reactIn(s, id, r));
}

export function clearReading(): void {
  browserStore.update(() => ({ ...DEFAULT_READING, log: [], reactions: {} }));
}

/** Derived numbers for headers and rails. `now` is passed in so render stays pure per call site. */
export function readingStats(s: ReadingState, now: number) {
  const today = readTodayCount(s.log, now);
  const streak = currentStreak(s.log, now);
  return {
    today,
    goal: s.goal,
    goalMet: today >= s.goal,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    week: weekStrip(s.log, now),
    diet: newsDiet(s.log, now),
    readIds: new Set(s.log.map((e) => e.id)),
  };
}
