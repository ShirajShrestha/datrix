'use client';

import { useMemo } from 'react';
import { readingStats, useReading } from '@/lib/reading';
import { useHydrated } from '@/lib/useHydrated';
import { useNow } from '@/lib/useClient';

/** Reading numbers for the UI. Before hydration it reports the empty state so SSR and client agree. */
export function useReadingStats() {
  const reading = useReading();
  const hydrated = useHydrated();
  const now = useNow();
  return useMemo(() => ({ ...readingStats(reading, now), reading, hydrated, now }), [reading, hydrated, now]);
}
