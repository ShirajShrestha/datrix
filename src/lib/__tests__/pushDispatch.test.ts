import { describe, it, expect } from 'vitest';
import { categoriesKey, localDateFor, runWithConcurrency } from '@/lib/services/pushDispatch';

describe('categoriesKey', () => {
  it('empty is all', () => expect(categoriesKey([])).toBe('all'));
  it('sorted and deduped', () => expect(categoriesKey(['world', 'ai', 'world'])).toBe('ai,world'));
  it('order independent', () => expect(categoriesKey(['b', 'a'])).toBe(categoriesKey(['a', 'b'])));
});

describe('localDateFor', () => {
  it('uses the sub zone', () => {
    const now = new Date('2026-10-18T20:00:00Z');
    expect(localDateFor({ timeZone: 'Asia/Kathmandu' }, now)).toBe('2026-10-19');
    expect(localDateFor({ timeZone: 'UTC' }, now)).toBe('2026-10-18');
  });
  it('null for bad zone', () => expect(localDateFor({ timeZone: 'Nope/Zone' }, new Date())).toBeNull());
});

describe('runWithConcurrency', () => {
  it('respects the limit and processes all', async () => {
    let active = 0, peak = 0, done = 0;
    const r = await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((res) => setTimeout(res, 5));
      active--; done++;
    });
    expect(done).toBe(7);
    expect(peak).toBe(3);
    expect(r.deferred).toEqual([]);
  });
  it('defers remaining items after the deadline', async () => {
    let t = 0;
    const seen: number[] = [];
    const r = await runWithConcurrency([1, 2, 3, 4, 5], 1, async (n) => { seen.push(n); t += 10; }, 25, () => t);
    expect(seen).toEqual([1, 2, 3]);
    expect(r.deferred).toEqual([4, 5]);
  });
  it('handles empty input', async () => {
    expect((await runWithConcurrency([], 5, async () => {})).deferred).toEqual([]);
  });
});
