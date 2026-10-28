/**
 * Which quota-limited sources run in this ingest. Ingest runs every 2 hours (UTC hours 0,2,...,22).
 * MediaStack (100 calls/month) runs once a day at 00 UTC; GNews (100 calls/day, 7 per run) every
 * 4 hours (6 runs x 7 = 42/day). INGEST_ALL_SOURCES=1 forces both for a manual run.
 */
export function quotaSourcesFor(
  now: Date,
  env: Record<string, string | undefined> = {},
): { gnews: boolean; mediastack: boolean } {
  if (env.INGEST_ALL_SOURCES === '1') return { gnews: true, mediastack: true };
  const hour = now.getUTCHours();
  return { gnews: hour % 4 === 0, mediastack: hour === 0 };
}
