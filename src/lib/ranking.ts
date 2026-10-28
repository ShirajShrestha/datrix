export const HALF_LIFE_HOURS = 24;
const INVALID_DATE_AGE_HOURS = 168;
const HOUR_MS = 3600e3;

interface Rankable {
  importanceScore: number;
  publishedAt: Date | string;
}

const time = (d: Date | string) => new Date(d).getTime();

/** Importance decayed by age. Future dates count as age 0; invalid dates as 168 h old. */
export function rankScore(a: Rankable, now: number): number {
  const t = time(a.publishedAt);
  const ageHours = Number.isFinite(t) ? Math.max(0, (now - t) / HOUR_MS) : INVALID_DATE_AGE_HOURS;
  return a.importanceScore * 0.5 ** (ageHours / HALF_LIFE_HOURS);
}

/** New array, descending by rankScore, ties by newer publishedAt. */
export function rankArticles<T extends Rankable>(items: T[], now: number): T[] {
  const t = (a: T) => {
    const v = time(a.publishedAt);
    return Number.isFinite(v) ? v : -Infinity;
  };
  return [...items].sort((a, b) => rankScore(b, now) - rankScore(a, now) || t(b) - t(a));
}
