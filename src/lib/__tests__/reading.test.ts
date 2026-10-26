import { describe, it, expect } from 'vitest';
import {
  DEFAULT_READING, createReadingStore, currentStreak, dayKey, dayKeyBefore, markReadIn, newsDiet,
  reactIn, readTodayCount, readingStats, sanitizeReading, weekStrip, type ReadEntry,
} from '@/lib/reading';

const NOW = new Date('2026-10-19T09:30:00').getTime();
const e = (id: string, daysAgo: number, cats = ['world']): ReadEntry => ({ id, day: dayKeyBefore(NOW, daysAgo), categories: cats });

describe('reading state', () => {
  it('dayKey / dayKeyBefore use local calendar days', () => {
    expect(dayKey(NOW)).toBe('2026-10-19');
    expect(dayKeyBefore(NOW, 1)).toBe('2026-10-18');
    expect(dayKeyBefore(NOW, 19)).toBe('2026-09-30');
  });

  it('sanitizes garbage to defaults and keeps valid fields', () => {
    expect(sanitizeReading('nope')).toBe(DEFAULT_READING);
    expect(sanitizeReading(null)).toBe(DEFAULT_READING);
    const s = sanitizeReading({
      log: [{ id: 'a', day: '2026-10-19', categories: ['world', 5] }, { id: 'a', day: '2026-10-19' }, { id: '', day: 'x' }],
      goal: 99, summaryMode: 'detailed', reactions: { a: 'important', b: 'weird' }, bestStreak: 3,
    });
    expect(s.log).toEqual([{ id: 'a', day: '2026-10-19', categories: ['world'] }]);
    expect(s.goal).toBe(5);
    expect(s.summaryMode).toBe('detailed');
    expect(s.reactions).toEqual({ a: 'important' });
    expect(s.bestStreak).toBe(3);
  });

  it('streak counts consecutive days and survives an unread today', () => {
    expect(currentStreak([], NOW)).toBe(0);
    expect(currentStreak([e('a', 0), e('b', 1), e('c', 2)], NOW)).toBe(3);
    expect(currentStreak([e('b', 1), e('c', 2)], NOW)).toBe(2);
    expect(currentStreak([e('a', 0), e('c', 2)], NOW)).toBe(1);
    expect(currentStreak([e('c', 2)], NOW)).toBe(0);
  });

  it('markReadIn is idempotent, logs today and tracks best streak', () => {
    const s1 = markReadIn({ ...DEFAULT_READING, log: [e('old', 1)] }, { _id: 'x', categories: ['sports'] }, NOW);
    expect(readTodayCount(s1.log, NOW)).toBe(1);
    expect(s1.bestStreak).toBe(2);
    expect(markReadIn(s1, { _id: 'x' }, NOW)).toBe(s1);
  });

  it('prunes entries older than the log window', () => {
    const s = markReadIn({ ...DEFAULT_READING, log: [e('ancient', 60)] }, { _id: 'new' }, NOW);
    expect(s.log.map((x) => x.id)).toEqual(['new']);
  });

  it('week strip and news diet', () => {
    const log = [e('a', 0, ['world']), e('b', 0, ['world']), e('c', 3, ['sports']), e('d', 10, ['politics'])];
    const week = weekStrip(log, NOW);
    expect(week).toHaveLength(7);
    expect(week[6]).toMatchObject({ today: true, read: true, label: 'M' });
    expect(week[3].read).toBe(true);
    const diet = newsDiet(log, NOW);
    expect(diet.map((d) => d.slug)).toEqual(['world', 'sports']);
    expect(diet[0].share).toBeCloseTo(2 / 3);
  });

  it('reactIn toggles', () => {
    const s = reactIn(DEFAULT_READING, 'a', 'surprising');
    expect(s.reactions.a).toBe('surprising');
    expect(reactIn(s, 'a', 'surprising').reactions.a).toBeUndefined();
    expect(reactIn(s, 'a', 'more').reactions.a).toBe('more');
  });

  it('readingStats derives goal progress', () => {
    const st = readingStats({ ...DEFAULT_READING, goal: 2, log: [e('a', 0), e('b', 0)] }, NOW);
    expect(st).toMatchObject({ today: 2, goal: 2, goalMet: true, streak: 1 });
    expect(st.readIds.has('a')).toBe(true);
  });

  it('store persists, falls back to memory, and skips no-op updates', () => {
    const mem = new Map<string, string>();
    let calls = 0;
    const store = createReadingStore(() => ({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { calls++; mem.set(k, v); } }));
    store.update((s) => markReadIn(s, { _id: 'a' }, NOW));
    expect(store.getSnapshot().log).toHaveLength(1);
    store.update((s) => markReadIn(s, { _id: 'a' }, NOW));
    expect(calls).toBe(1);

    const broken = createReadingStore(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }));
    broken.update((s) => ({ ...s, goal: 3 }));
    expect(broken.getSnapshot().goal).toBe(3);
  });
});
