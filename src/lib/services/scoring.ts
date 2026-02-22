export interface ScoredArticle {
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: Date;
  description?: string;
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
  'Ars Technica': 0.7,
};

const TOPIC_WEIGHTS: Record<string, number> = {
  'ai': 0.15,
  'tech': 0.1,
  'economy': 0.12,
  'world': 0.08,
};

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

function findDuplicates(articles: ScoredArticle[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  
  articles.forEach((article, index) => {
    const normalized = normalizeTitle(article.title);
    const words = normalized.split(' ').filter(w => w.length > 3);
    
    if (words.length >= 3) {
      const key = words.slice(0, 5).join(' ');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(index);
    }
  });

  const duplicates = new Map<string, number[]>();
  groups.forEach((indices, key) => {
    if (indices.length > 1) {
      duplicates.set(key, indices);
    }
  });
  
  return duplicates;
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

export function deduplicateArticles(articles: ScoredArticle[]): ScoredArticle[] {
  const seen = new Set<string>();
  const normalized = new Map<string, number>();
  
  for (let i = 0; i < articles.length; i++) {
    const key = normalizeTitle(articles[i].title).substring(0, 50);
    
    if (normalized.has(key)) {
      const existingIdx = normalized.get(key)!;
      if ((articles[i].importanceScore || 0) > (articles[existingIdx].importanceScore || 0)) {
        normalized.set(key, i);
      }
    } else {
      normalized.set(key, i);
    }
  }
  
  const uniqueArticles: ScoredArticle[] = [];
  const usedIndices = new Set<number>();
  
  normalized.forEach((idx) => {
    if (!usedIndices.has(idx)) {
      uniqueArticles.push(articles[idx]);
      usedIndices.add(idx);
    }
  });
  
  return uniqueArticles;
}

export function scoreArticles(articles: ScoredArticle[]): ScoredArticle[] {
  return articles.map((article) => {
    const sourceCred = SOURCE_CREDIBILITY[article.source] || 0.6;
    const freshness = calculateFreshnessScore(article.publishedAt);
    const frequency = calculateFrequencyScore(article, articles);
    const topicWeight = TOPIC_WEIGHTS[article.category] || 0.05;
    
    const score = (
      (sourceCred * 0.4) +
      (frequency * 0.3) +
      (freshness * 0.2) +
      (topicWeight * 0.1)
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
