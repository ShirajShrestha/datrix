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

function generateWhyItMatters(article: ScoredArticle): string {
  const impacts: Record<string, string[]> = {
    ai: [
      'This development could significantly impact AI industry growth and adoption rates across multiple sectors, potentially changing how businesses and consumers interact with artificial intelligence technologies in their daily operations and strategic planning.',
      'May influence regulatory discussions and shape future AI policy frameworks globally, affecting everything from research funding to commercial applications and ensuring that technological advancement aligns with societal values and safety concerns.',
      'Could reshape competitive dynamics among major technology companies and startups alike, creating new market leaders while potentially displacing established players who fail to adapt to rapidly evolving artificial intelligence capabilities.',
      'Potential to accelerate or hinder specific AI application deployment in enterprise environments, influencing billions of dollars in investment decisions and affecting employment across numerous industries worldwide.',
    ],
    tech: [
      'This news could affect technology adoption curves and product release timelines significantly, potentially reshaping consumer expectations and competitive positioning within the rapidly evolving technology landscape.',
      'May impact competitive positioning within the technology sector dramatically, influencing market share, pricing strategies, and innovation pipelines across multiple device and software categories.',
      'Could influence investor sentiment and market valuations for related companies, affecting stock prices, merger and acquisition activity, and the overall health of the technology ecosystem.',
      'Potential implications for supply chains and partner ecosystems worldwide, from component manufacturers to software developers and retail partners who depend on successful product launches.',
    ],
    economy: [
      'This development may influence market conditions and investor sentiment significantly, potentially affecting stock markets, bond yields, and currency valuations across multiple asset classes and geographic regions.',
      'Could affect monetary policy decisions and interest rate trajectories ahead, influencing borrowing costs for consumers and businesses alike while shaping central bank strategies for years to come.',
      'May have direct implications for employment rates and wage growth patterns, affecting workers across industries from manufacturing to services and influencing labor market dynamics.',
      'Potential impact on inflation trends and consumer purchasing power ahead, shaping household budgets and spending decisions while influencing broader economic growth projections.',
    ],
    world: [
      'This event could have broader implications for international relations and diplomacy, potentially affecting alliances, trade negotiations, and geopolitical stability across multiple regions.',
      'May influence global trade agreements and diplomatic negotiations ongoing, shaping economic relationships between nations and affecting billions of dollars in cross-border commerce.',
      'Could affect regional stability and security arrangements significantly, with potential ripple effects on military alliances, peacekeeping operations, and defense spending priorities.',
      'Potential to shape policy decisions across multiple nations simultaneously, from environmental agreements to human rights frameworks and technological cooperation treaties.',
    ],
  };
  
  const category = article.category || 'world';
  const categoryImpacts = impacts[category] || impacts.world;
  const titleWordCount = article.title.split(' ').length;
  const baseImpact = categoryImpacts[titleWordCount % categoryImpacts.length];
  
  if (article.description && article.description.length > 50) {
    return `${baseImpact} This story centers on: ${article.title}, which represents a significant development in ${category} that stakeholders worldwide will be watching closely for its potential cascade effects.`;
  }
  
  return `${baseImpact} The implications of this story extend beyond immediate headlines, potentially affecting policy discussions, market behavior, and public awareness around ${category}-related issues.`;
}

export function summarizeArticle(article: ScoredArticle): ArticleSummary {
  const content = article.description || article.title;
  const sentences = splitIntoSentences(content);
  const keywords = extractKeywords(content);
  
  const scoredSentences = sentences
    .map(s => ({ text: s, score: scoreSentence(s, keywords) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  
  let importantSentences = scoredSentences.map(s => s.text);
  const firstSentence = importantSentences[0] || '';
  
  const category = article.category || 'world';
  const keywordsList = Array.from(keywords).slice(0, 5).join(', ');
  
  const tldrContent = firstSentence || article.title;
  const tldr = tldrContent.length > 200 
    ? tldrContent.substring(0, 200).replace(/\s+\S*$/, '') + '...'
    : tldrContent + ` This development in ${category} relates to ${keywordsList || 'current events'}.`;
  
  if (importantSentences.length < 5) {
    const generatedBullets = [
      `This story highlights key developments in ${category} that are shaping current events and public discourse worldwide.`,
      `The implications extend beyond the immediate headline, potentially affecting related industries and stakeholders.`,
      `Industry experts are closely monitoring this situation as it could set precedents for future developments.`,
      `This news comes amid ongoing changes in ${category} that have been attracting significant attention.`,
      `The broader context includes related trends and events that are influencing the current landscape.`,
    ];
    importantSentences = [...importantSentences, ...generatedBullets].slice(0, 10);
  }

  return {
    tldr: tldr,
    bullets: importantSentences.slice(0, 10).map(s => 
      s.length > 200 ? s.substring(0, 200).replace(/\s+\S*$/, '') + '...' : s
    ),
    whyItMatters: generateWhyItMatters(article),
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
