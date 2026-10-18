import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSavedSnapshot, SAVED_ARTICLES_KEY } from '@/lib/savedArticles';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('getSavedSnapshot', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the same reference until the stored data changes (useSyncExternalStore contract)', () => {
    localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify([{ _id: 'a' }]));
    const first = getSavedSnapshot();
    expect(getSavedSnapshot()).toBe(first);
    localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify([{ _id: 'a' }, { _id: 'b' }]));
    const second = getSavedSnapshot();
    expect(second).not.toBe(first);
    expect(second).toHaveLength(2);
    expect(getSavedSnapshot()).toBe(second);
  });

  it('returns a stable empty list for missing or corrupt data', () => {
    expect(getSavedSnapshot()).toBe(getSavedSnapshot());
    localStorage.setItem(SAVED_ARTICLES_KEY, '{not json');
    expect(getSavedSnapshot()).toEqual([]);
    expect(getSavedSnapshot()).toBe(getSavedSnapshot());
  });
});
