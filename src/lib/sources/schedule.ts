/**
 * Which quota-limited sources run in this ingest. Ingest is scheduled every 2 hours, but GitHub
 * schedules slip 20-60+ min, so windows are 2 hours wide: exactly one 2-hourly run falls into each.
 * MediaStack (100 calls/month) runs when the UTC hour is 0-1 (once a day); GNews (100 calls/day,
 * 7 per run) when hour % 4 is 0-1 (6 runs x 7 = 42/day). INGEST_ALL_SOURCES=1 forces both.
 */
export function quotaSourcesFor(
  now: Date,
  env: Record<string, string | undefined> = {},
): { gnews: boolean; mediastack: boolean } {
  if (env.INGEST_ALL_SOURCES === '1') return { gnews: true, mediastack: true };
  const hour = now.getUTCHours();
  return { gnews: hour % 4 < 2, mediastack: hour < 2 };
}
