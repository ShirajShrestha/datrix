import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import type { SourceRef } from '@/lib/sources/types';

export interface ScoredArticle {
  title: string;
  url: string;
  source: string;
  /** Primary category (kept for compatibility). */
  category: CategorySlug;
  categories: CategorySlug[];
  publishedAt: Date;
  description?: string;
  imageUrl?: string;
  /** Gallery images: canonical's first, deduped, http(s) only, max MAX_IMAGES. */
  images?: string[];
  sources: SourceRef[];
  importanceScore?: number;
}

const SOURCE_CREDIBILITY: Record<string, number> = {
  'NYT': 0.9,
  'BBC': 0.85,
  'Reuters': 0.9,
  'Bloomberg': 0.85,
  'Financial Times': 0.85,
  'Wall Street Journal': 0.85,
  'TechCrunch': 0.75,
  'The Verge': 0.7,
  'Nature': 0.9,
  'Wired': 0.75,
  'Ars Technica': 0.75,
  'NPR': 0.8,
  'Al Jazeera': 0.75,
  'Foreign Policy': 0.8,
  'Chicago Tribune': 0.7,
  'Washington Post': 0.85,
  'Los Angeles Times': 0.75,
  'The Guardian': 0.8,
  'CNN': 0.7,
  'Fox News': 0.65,
  'NBC News': 0.75,
  'CBS News': 0.75,
  'ABC News': 0.75,
  'AP': 0.8,
  'Associated Press': 0.8,
  'CNBC': 0.75,
  'Forbes': 0.7,
  'Business Insider': 0.7,
  'The Atlantic': 0.8,
  'Politico': 0.7,
  'Axios': 0.7,
  'Yahoo News': 0.6,
  'Yahoo Sports': 0.6,
  'ESPN': 0.7,
  'Sports Illustrated': 0.65,
};

// Registry weights are ~0.9-1.2; scale so the top weight (1.2) maps to 0.15, as the old table did.
const TOPIC_SCALE = 0.125;
const DEFAULT_TOPIC_WEIGHT = 0.05;

function topicWeight(categories: CategorySlug[]): number {
  let max = 0;
  for (const slug of categories) {
    const w = CATEGORIES.find((c) => c.slug === slug)?.weight;
    if (w !== undefined && w > max) max = w;
  }
  return max > 0 ? max * TOPIC_SCALE : DEFAULT_TOPIC_WEIGHT;
}

function timeOf(d: unknown): number {
  if (d === undefined || d === null) return NaN;
  return d instanceof Date ? d.getTime() : new Date(d as string).getTime();
}

function calculateFreshnessScore(publishedAt: Date): number {
  const t = timeOf(publishedAt);
  if (Number.isNaN(t)) return 0.3; // invalid/missing date is treated as old
  const hoursDiff = (Date.now() - t) / (1000 * 60 * 60);

  if (hoursDiff <= 1) return 1.0;
  if (hoursDiff <= 6) return 0.9;
  if (hoursDiff <= 12) return 0.8;
  if (hoursDiff <= 24) return 0.7;
  if (hoursDiff <= 48) return 0.5;
  return 0.3;
}

function normalizeTitle(title: string): string {
  return (title || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Story similarity -------------------------------------------------------------------
// Limitation: matching is purely lexical (light stemming, no synonym/alias table), so
// "Fed holds rates steady" and "Federal Reserve leaves rates unchanged" do NOT match.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'had',
  'will', 'its', 'but', 'not', 'you', 'your', 'who', 'what', 'when', 'where', 'why', 'how', 'into',
  'over', 'after', 'amid', 'about', 'than', 'then', 'they', 'their', 'his', 'her', 'can', 'could',
  'would', 'should', 'may', 'says', 'said', 'new', 'more', 'out', 'off', 'all', 'one', 'two',
]);

const SUFFIX_SEP = /\s+[-|\u2013\u2014]\s+/;
const WINDOW_MS = 48 * 60 * 60 * 1000;

function stem(w: string): string {
  if (/^\d+$/.test(w)) return w;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ly')) return w.slice(0, -2);
  if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

interface TitleInfo {
  tokens: Set<string>;
  nums: Set<string>;
  time: number;
  url: string;
  norm: string;
  source: string;
}

function tokenize(title: string): { tokens: Set<string>; nums: Set<string> } {
  let t = title || '';
  const parts = t.split(SUFFIX_SEP);
  if (parts.length > 1 && parts[parts.length - 1].trim().split(/\s+/).length <= 4) {
    t = parts.slice(0, -1).join(' ');
  }
  const tokens = new Set<string>();
  const nums = new Set<string>();
  for (const raw of t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (!raw) continue;
    if (/^\d+$/.test(raw)) { tokens.add(raw); nums.add(raw); continue; }
    if (raw.length <= 2 || STOPWORDS.has(raw)) continue;
    const st = stem(raw);
    if (st.length > 2) tokens.add(st);
  }
  return { tokens, nums };
}

function buildInfo(a: ScoredArticle): TitleInfo {
  const { tokens, nums } = tokenize(a.title);
  return { tokens, nums, time: timeOf(a.publishedAt), url: a.url, norm: normalizeTitle(a.title), source: a.source };
}

function similar(a: TitleInfo, b: TitleInfo): boolean {
  if (a.url === b.url && a.norm === b.norm) return true;
  if (!(Math.abs(a.time - b.time) <= WINDOW_MS)) return false; // also false for NaN
  let shared = 0;
  a.tokens.forEach((w) => { if (b.tokens.has(w)) shared++; });
  if (shared < 3) return false;
  const jac = shared / (a.tokens.size + b.tokens.size - shared);
  const short = Math.min(a.tokens.size, b.tokens.size) < 5;
  if (jac < (short ? 0.7 : 0.5)) return false;
  if (a.nums.size > 0 && b.nums.size > 0) {
    let numShared = false;
    a.nums.forEach((n) => { if (b.nums.has(n)) numShared = true; });
    if (!numShared) return false;
  }
  return true;
}

/** Returns, for article i, the indices j != i that are the same story. Uses an inverted index. */
function buildMatcher(articles: ScoredArticle[]): (i: number) => number[] {
  const infos = articles.map(buildInfo);
  const limit = Math.max(5, Math.ceil(articles.length * 0.2));
  const index = new Map<string, number[]>();
  const byUrl = new Map<string, number[]>();
  infos.forEach((info, i) => {
    info.tokens.forEach((t) => {
      const l = index.get(t);
      if (l) l.push(i); else index.set(t, [i]);
    });
    const u = byUrl.get(info.url);
    if (u) u.push(i); else byUrl.set(info.url, [i]);
  });
  return (i) => {
    const seen = new Set<number>();
    const out: number[] = [];
    const consider = (j: number) => {
      if (j === i || seen.has(j)) return;
      seen.add(j);
      if (similar(infos[i], infos[j])) out.push(j);
    };
    infos[i].tokens.forEach((t) => {
      const l = index.get(t)!;
      if (l.length <= limit) l.forEach(consider);
    });
    (byUrl.get(infos[i].url) || []).forEach(consider);
    return out;
  };
}

function calculateFrequencyScore(i: number, articles: ScoredArticle[], matches: (i: number) => number[]): number {
  const me = articles[i];
  const otherSources = new Set<string>();
  for (const j of matches(i)) {
    const o = articles[j];
    if (o.url === me.url || o.source === me.source) continue; // duplicates are not corroboration
    otherSources.add(o.source);
  }
  return Math.min(otherSources.size / 5, 1);
}

export const MAX_IMAGES = 5;
export const MAX_SOURCES = 8;

/** Union image lists in order: dedupe by URL, http(s) only, capped at MAX_IMAGES. */
export function unionImages(...lists: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const u of list ?? []) {
      if (out.length >= MAX_IMAGES) return out;
      if (typeof u === 'string' && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
    }
  }
  return out;
}

export function deduplicateArticles(articles: ScoredArticle[]): ScoredArticle[] {
  const matches = buildMatcher(articles);
  const parent = articles.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  for (let i = 0; i < articles.length; i++) {
    for (const j of matches(i)) {
      const ri = find(i), rj = find(j);
      if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
    }
  }
  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < articles.length; i++) {
    const r = find(i);
    const g = groupMap.get(r);
    if (g) g.push(i); else groupMap.set(r, [i]);
  }
  const groups = Array.from(groupMap.values()); // Map keeps first-occurrence order

  return groups.map((idxs) => {
    // Highest score wins; ties go to the earliest in input.
    let best = idxs[0];
    for (const i of idxs) {
      if ((articles[i].importanceScore || 0) > (articles[best].importanceScore || 0)) best = i;
    }
    const canonical = articles[best];
    if (idxs.length === 1) {
      return {
        ...canonical,
        categories: [...canonical.categories],
        sources: [...canonical.sources],
        ...(canonical.images ? { images: unionImages(canonical.images) } : {}),
      };
    }
    const ordered = [best, ...idxs.filter((i) => i !== best)].map((i) => articles[i]);

    const categories: CategorySlug[] = [];
    const sources: SourceRef[] = [];
    const seenSources = new Set<string>();
    let imageUrl: string | undefined;
    for (const a of ordered) {
      for (const c of a.categories) if (!categories.includes(c)) categories.push(c);
      for (const s of a.sources) {
        if (!seenSources.has(s.name)) { seenSources.add(s.name); sources.push(s); }
      }
      if (!imageUrl && a.imageUrl) imageUrl = a.imageUrl;
    }
    return {
      ...canonical,
      categories,
      sources: sources.slice(0, MAX_SOURCES),
      imageUrl,
      images: unionImages(...ordered.map((a) => a.images)),
    };
  });
}

export function scoreArticles(articles: ScoredArticle[]): ScoredArticle[] {
  const matches = buildMatcher(articles);
  return articles.map((article, i) => {
    const sourceCred = Object.hasOwn(SOURCE_CREDIBILITY, article.source)
      ? SOURCE_CREDIBILITY[article.source]
      : 0.55;
    const freshness = calculateFreshnessScore(article.publishedAt);
    const frequency = calculateFrequencyScore(i, articles, matches);
    const topic = topicWeight(article.categories);

    const score = (
      (sourceCred * 0.4) +
      (frequency * 0.3) +
      (freshness * 0.2) +
      (topic * 0.1)
    );

    return {
      ...article,
      importanceScore: Math.round(score * 100) / 100,
    };
  });
}

export function getImportanceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

export function filterHighImportance(articles: ScoredArticle[]): ScoredArticle[] {
  return articles.filter(a => (a.importanceScore || 0) >= 0.5);
}
