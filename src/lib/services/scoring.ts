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

function calculateFreshnessScore(publishedAt: Date): number {
  const now = new Date();
  const hoursDiff = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff <= 1) return 1.0;
  if (hoursDiff <= 6) return 0.9;
  if (hoursDiff <= 12) return 0.8;
  if (hoursDiff <= 24) return 0.7;
  if (hoursDiff <= 48) return 0.5;
  return 0.3;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateFrequencyScore(article: ScoredArticle, allArticles: ScoredArticle[]): number {
  const normalized = normalizeTitle(article.title);
  const words = normalized.split(' ').filter(w => w.length > 3);
  
  let matchCount = 0;
  for (const other of allArticles) {
    if (other.url === article.url) continue;
    
    const otherNormalized = normalizeTitle(other.title);
    const commonWords = words.filter(w => otherNormalized.includes(w));
    
    if (commonWords.length >= 3) {
      matchCount++;
    }
  }
  
  return Math.min(matchCount / 5, 1);
}

function wordSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Same story = same 50-char normalized title prefix (cheap bucket) AND, as a guard against
// distinct stories sharing a prefix (e.g. "Live: ..."), full-title word Jaccard >= 0.8.
function isSameStory(a: ScoredArticle, b: ScoredArticle): boolean {
  if (normalizeTitle(a.title).substring(0, 50) !== normalizeTitle(b.title).substring(0, 50)) return false;
  return jaccard(wordSet(a.title), wordSet(b.title)) >= 0.8;
}

export function deduplicateArticles(articles: ScoredArticle[]): ScoredArticle[] {
  const groups: number[][] = [];
  for (let i = 0; i < articles.length; i++) {
    const g = groups.find((idxs) => isSameStory(articles[idxs[0]], articles[i]));
    if (g) g.push(i);
    else groups.push([i]);
  }

  return groups.map((idxs) => {
    // Highest score wins; ties go to the earliest in input.
    let best = idxs[0];
    for (const i of idxs) {
      if ((articles[i].importanceScore || 0) > (articles[best].importanceScore || 0)) best = i;
    }
    const canonical = articles[best];
    if (idxs.length === 1) {
      return { ...canonical, categories: [...canonical.categories], sources: [...canonical.sources] };
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
    return { ...canonical, categories, sources, imageUrl };
  });
}

export function scoreArticles(articles: ScoredArticle[]): ScoredArticle[] {
  return articles.map((article) => {
    const sourceCred = SOURCE_CREDIBILITY[article.source] || 0.55;
    const freshness = calculateFreshnessScore(article.publishedAt);
    const frequency = calculateFrequencyScore(article, articles);
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
