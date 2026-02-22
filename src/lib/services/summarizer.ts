import { ScoredArticle } from './scoring';

export interface ArticleSummary {
  tldr: string;
  bullets: string[];
  whyItMatters: string;
}

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'we', 'they', 'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once', 'if',
  'because', 'until', 'while', 'about', 'against', 'between', 'into', 'through',
  'said', 'says', 'reported', 'announced', 'stated', 'according', 'would',
  'could', 'should', 'might', 'must', 'going', 'being', 'make', 'made'
]);

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  return new Set(
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word)
  );
}

function scoreSentence(sentence: string, keywords: Set<string>): number {
  let score = 0;
  const words = sentence.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    if (keywords.has(word)) score += 1;
  }
  
  if (sentence.length > 50 && sentence.length < 200) score += 2;
  if (sentence.length > 80) score += 1;
  if (sentence.length < 30) score -= 2;
  if (sentence.length > 300) score -= 1;
  
  return score;
}

function generateWhyItMatters(category: string): string {
  const impacts: Record<string, string> = {
    ai: 'This development could significantly impact the AI industry and related technologies, potentially affecting how businesses and consumers interact with artificial intelligence.',
    tech: 'This news could affect technology adoption, product releases, or the competitive landscape in the tech sector.',
    economy: 'This development may influence market conditions, interest rates, employment, or economic policy decisions.',
    world: 'This event could have broader implications for international relations, global stability, or policy decisions worldwide.',
  };
  return impacts[category] || 'This story represents a significant development worth monitoring for potential impact on related industries and audiences.';
}

export function summarizeArticle(article: ScoredArticle): ArticleSummary {
  const content = article.description || article.title;
  const sentences = splitIntoSentences(content);
  const keywords = extractKeywords(content);
  
  const scoredSentences = sentences
    .map(s => ({ text: s, score: scoreSentence(s, keywords) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  
  const importantSentences = scoredSentences.map(s => s.text);
  const firstSentence = importantSentences[0] || '';

  return {
    tldr: firstSentence.length > 150 
      ? firstSentence.substring(0, 150).replace(/\s+\S*$/, '') + '...'
      : firstSentence || article.title,
    bullets: importantSentences.slice(0, 5).map(s => 
      s.length > 100 ? s.substring(0, 100).replace(/\s+\S*$/, '') + '...' : s
    ),
    whyItMatters: generateWhyItMatters(article.category),
  };
}

export async function summarizeWithCohere(text: string): Promise<string> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('Cohere API key not configured');
  }

  try {
    const response = await fetch('https://api.cohere.ai/v1/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        text: text,
        length: 'short',
        format: 'bullets'
      })
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
    }

    const data = await response.json();
    return data.summary || '';
  } catch (error) {
    console.error('Cohere summarization failed:', error);
    throw error;
  }
}

export function generateDailyDigest(articles: ScoredArticle[]): ScoredArticle[] {
  const sorted = [...articles].sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));
  return sorted.slice(0, 10);
}
