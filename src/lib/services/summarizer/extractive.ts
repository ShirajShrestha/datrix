import type { ArticleSummary, SummaryInput } from './parse';

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those',
  'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'nor', 'not', 'only', 'own',
  'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once', 'because',
  'until', 'while', 'about', 'against', 'between', 'into', 'through', 'said', 'says', 'reported',
  'announced', 'stated', 'according', 'going', 'being', 'make', 'made',
]);

function splitIntoSentences(text: string): string[] {
  return text.replace(/([.!?])\s*(?=[A-Z])/g, '$1|').split('|').map((s) => s.trim()).filter((s) => s.length > 20);
}

function extractKeywords(text: string): Set<string> {
  const freq: Record<string, number> = {};
  for (const w of text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)) {
    if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return new Set(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w]) => w));
}

function scoreSentence(s: string, keywords: Set<string>): number {
  let score = 0;
  for (const w of s.toLowerCase().split(/\s+/)) if (keywords.has(w)) score += 1;
  if (s.length > 50 && s.length < 200) score += 2;
  if (s.length > 80) score += 1;
  if (s.length < 30) score -= 2;
  if (s.length > 300) score -= 1;
  return score;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '...' : s;
}

/** Deterministic fallback. Never throws; no whyItMatters; tolerates a missing description. */
export function extractiveSummary(a: SummaryInput): ArticleSummary {
  const title = typeof a?.title === 'string' ? a.title : '';
  try {
    const desc = typeof a?.description === 'string' ? a.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const content = desc || title;
    const keywords = extractKeywords(content);
    const ranked = splitIntoSentences(content)
      .map((s) => ({ s, score: scoreSentence(s, keywords) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .map((x) => x.s);
    const tldr = trunc(ranked[0] || title || content || 'No summary available.', 300);
    const bullets = ranked.slice(0, 3).map((s) => trunc(s, 200));
    return { tldr, bullets, provider: 'extractive' };
  } catch {
    return { tldr: trunc(title || 'No summary available.', 300), bullets: [], provider: 'extractive' };
  }
}
