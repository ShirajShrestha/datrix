import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFS, PREFS_KEY, sanitizePrefs, effectiveCategories, createPrefsStore,
  capturePreviousVisit, type StorageLike,
} from '@/lib/prefs';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('sanitizePrefs', () => {
  it('corrupted JSON string -> DEFAULT_PREFS', () => {
    expect(sanitizePrefs('{not json')).toEqual(DEFAULT_PREFS);
  });
  it('non-object -> defaults', () => {
    for (const v of [null, undefined, 5, true, [], 'null', '"x"']) expect(sanitizePrefs(v)).toEqual(DEFAULT_PREFS);
  });
  it('accepts JSON string and parsed value', () => {
    expect(sanitizePrefs('{"onboarded":true}').onboarded).toBe(true);
    expect(sanitizePrefs({ onboarded: true }).onboarded).toBe(true);
  });
  it('maps legacy slugs', () => {
    expect(sanitizePrefs({ categories: ['tech', 'economy'] }).categories).toEqual(['technology', 'business']);
  });
  it('drops unknown slugs and non-strings', () => {
    expect(sanitizePrefs({ categories: ['ai', 'nope', 3, null] }).categories).toEqual(['ai']);
  });
  it('removes duplicates', () => {
    expect(sanitizePrefs({ categories: ['ai', 'ai', 'tech', 'technology'] }).categories).toEqual(['ai', 'technology']);
  });
  it('validates notifyTime', () => {
    expect(sanitizePrefs({ notifyTime: '25:99' }).notifyTime).toBe('08:00');
    expect(sanitizePrefs({ notifyTime: '7:5' }).notifyTime).toBe('08:00');
    expect(sanitizePrefs({ notifyTime: '24:00' }).notifyTime).toBe('08:00');
    expect(sanitizePrefs({ notifyTime: 730 }).notifyTime).toBe('08:00');
    expect(sanitizePrefs({ notifyTime: '23:59' }).notifyTime).toBe('23:59');
  });
  it('non-boolean flags -> defaults; lastVisit validation', () => {
    const p = sanitizePrefs({ onboarded: 'yes', notifyEnabled: 1, lastVisit: -1 });
    expect(p.onboarded).toBe(false);
    expect(p.notifyEnabled).toBe(false);
    expect(p.lastVisit).toBeNull();
    expect(sanitizePrefs({ lastVisit: NaN }).lastVisit).toBeNull();
    expect(sanitizePrefs({ lastVisit: '5' }).lastVisit).toBeNull();
    expect(sanitizePrefs({ lastVisit: 123 }).lastVisit).toBe(123);
  });
});

describe('effectiveCategories', () => {
  it('[] returns all 14', () => {
    expect(effectiveCategories({ ...DEFAULT_PREFS, categories: [] })).toHaveLength(14);
  });
  it('returns selection otherwise', () => {
    expect(effectiveCategories({ ...DEFAULT_PREFS, categories: ['ai'] })).toEqual(['ai']);
  });
});

describe('prefs store', () => {
  it('defaults when empty, server snapshot is DEFAULT_PREFS', () => {
    const s = createPrefsStore(() => fakeStorage());
    expect(s.getSnapshot()).toEqual(DEFAULT_PREFS);
    expect(s.getServerSnapshot()).toBe(DEFAULT_PREFS);
  });
  it('setPrefs merges, sanitizes, persists, notifies', () => {
    const st = fakeStorage();
    const s = createPrefsStore(() => st);
    let n = 0;
    const un = s.subscribe(() => n++);
    s.setPrefs({ onboarded: true });
    s.setPrefs({ categories: ['tech' as never], notifyTime: '99:99' });
    expect(n).toBe(2);
    const saved = JSON.parse(st.data.get(PREFS_KEY)!);
    expect(saved).toMatchObject({ onboarded: true, categories: ['technology'], notifyTime: '08:00' });
    expect(s.getSnapshot().onboarded).toBe(true);
    un();
    s.setPrefs({ onboarded: false });
    expect(n).toBe(2);
  });
  it('getSnapshot is referentially stable until storage changes', () => {
    const st = fakeStorage();
    const s = createPrefsStore(() => st);
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a);
    s.setPrefs({ onboarded: true });
    const b = s.getSnapshot();
    expect(b).not.toBe(a);
    expect(s.getSnapshot()).toBe(b);
    // external (other tab) write
    st.data.set(PREFS_KEY, JSON.stringify({ onboarded: false }));
    const c = s.getSnapshot();
    expect(c.onboarded).toBe(false);
    expect(s.getSnapshot()).toBe(c);
  });
  it('survives throwing storage with in-memory fallback', () => {
    const bad: StorageLike = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    };
    const s = createPrefsStore(() => bad);
    expect(s.getSnapshot()).toEqual(DEFAULT_PREFS);
    s.setPrefs({ onboarded: true, notifyTime: '21:30' });
    expect(s.getSnapshot()).toMatchObject({ onboarded: true, notifyTime: '21:30' });
    expect(s.getSnapshot()).toBe(s.getSnapshot());
  });
  it('falls back to memory when setItem throws but getItem works', () => {
    const st = fakeStorage();
    const s = createPrefsStore(() => ({ getItem: st.getItem, setItem() { throw new Error('quota'); } }));
    s.setPrefs({ onboarded: true });
    expect(s.getSnapshot().onboarded).toBe(true);
  });
  it('works when storage is unavailable (null)', () => {
    const s = createPrefsStore(() => null);
    s.setPrefs({ notifyEnabled: true });
    expect(s.getSnapshot().notifyEnabled).toBe(true);
  });
});

describe('previous visit', () => {
  it('capturePreviousVisit returns lastVisit', () => {
    expect(capturePreviousVisit({ ...DEFAULT_PREFS, lastVisit: 42 })).toBe(42);
    expect(capturePreviousVisit(DEFAULT_PREFS)).toBeNull();
  });
  it('is captured once and stable after lastVisit updates', () => {
    const st = fakeStorage();
    st.data.set(PREFS_KEY, JSON.stringify({ lastVisit: 1000 }));
    const s = createPrefsStore(() => st);
    expect(s.getPreviousVisit()).toBe(1000);
    s.touchLastVisit(5000);
    expect(s.getSnapshot().lastVisit).toBe(5000);
    expect(s.getPreviousVisit()).toBe(1000);
    expect(JSON.parse(st.data.get(PREFS_KEY)!).lastVisit).toBe(5000);
  });
  it('touch before any read still captures the old value', () => {
    const st = fakeStorage();
    st.data.set(PREFS_KEY, JSON.stringify({ lastVisit: 7 }));
    const s = createPrefsStore(() => st);
    s.touchLastVisit(9);
    expect(s.getPreviousVisit()).toBe(7);
  });
  it('first visit -> null', () => {
    const s = createPrefsStore(() => fakeStorage());
    expect(s.getPreviousVisit()).toBeNull();
    s.touchLastVisit(10);
    expect(s.getPreviousVisit()).toBeNull();
  });
});
