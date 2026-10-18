import type { CategorySlug } from '@/lib/categories';
import { localParts } from '@/lib/services/push';

/** Cache key for a category set: sorted and joined; empty = all categories. */
export function categoriesKey(categories: readonly CategorySlug[] | readonly string[]): string {
  if (!categories || categories.length === 0) return 'all';
  return [...new Set(categories)].sort().join(',');
}

/** The subscription's local calendar date (YYYY-MM-DD) at `now`, or null if the zone is invalid. */
export function localDateFor(sub: { timeZone: string }, now: Date): string | null {
  return localParts(now, sub.timeZone)?.date ?? null;
}

/**
 * Run `worker` over `items` with at most `limit` in flight. No new item is started once
 * `deadline` (epoch ms) has passed; the unstarted items are returned in `deferred`.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  deadline: number = Infinity,
  clock: () => number = Date.now,
): Promise<{ deferred: T[] }> {
  let next = 0;
  const lanes = Math.max(1, Math.floor(limit) || 1);
  const run = async () => {
    while (next < items.length && clock() < deadline) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, run));
  return { deferred: items.slice(next) };
}
