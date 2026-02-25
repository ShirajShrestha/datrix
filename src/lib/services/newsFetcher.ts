import Parser from 'rss-parser';

const parser = new Parser();

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: Date;
  content?: string;
  description?: string;
}

const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech', source: 'BBC' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world', source: 'BBC' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'economy', source: 'BBC' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'tech', source: 'NYT' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'world', source: 'NYT' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', category: 'economy', source: 'NYT' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/ArtificialIntelligence.xml', category: 'ai', source: 'NYT' },
];

const DEMO_ARTICLES: RawArticle[] = [
  {
    title: 'OpenAI Announces GPT-5 with Breakthrough Reasoning Capabilities',
    url: 'https://example.com/openai-gpt5',
    source: 'TechCrunch',
    category: 'ai',
    publishedAt: new Date(),
    description: 'OpenAI reveals GPT-5, featuring advanced reasoning and multimodal capabilities that set new benchmarks in AI performance.',
  },
  {
    title: 'Federal Reserve Signals Interest Rate Pause Amid Economic Uncertainty',
    url: 'https://example.com/fed-rate-pause',
    source: 'Reuters',
    category: 'economy',
    publishedAt: new Date(Date.now() - 3600000),
    description: 'The Federal Reserve announces a pause in interest rate hikes as economic indicators show mixed signals.',
  },
  {
    title: 'Apple Unveils Revolutionary M4 Chip with Neural Processing Unit',
    url: 'https://example.com/apple-m4',
    source: 'The Verge',
    category: 'tech',
    publishedAt: new Date(Date.now() - 7200000),
    description: 'Apple announces its most powerful chip yet, featuring dedicated neural processing for on-device AI tasks.',
  },
  {
    title: 'EU Passes Comprehensive AI Regulation Framework',
    url: 'https://example.com/eu-ai-regulation',
    source: 'Financial Times',
    category: 'ai',
    publishedAt: new Date(Date.now() - 10800000),
    description: 'European Union finalizes landmark AI legislation setting global standards for artificial intelligence development.',
  },
  {
    title: 'Global Climate Summit Reaches Historic Agreement on Emissions',
    url: 'https://example.com/climate-summit',
    source: 'BBC News',
    category: 'world',
    publishedAt: new Date(Date.now() - 14400000),
    description: 'World leaders commit to binding emissions targets in landmark climate agreement.',
  },
  {
    title: 'Microsoft Acquires Leading AI Startup for $2 Billion',
    url: 'https://example.com/microsoft-acquisition',
    source: 'Bloomberg',
    category: 'tech',
    publishedAt: new Date(Date.now() - 18000000),
    description: 'Microsoft expands AI portfolio with strategic acquisition of specialized machine learning startup.',
  },
  {
    title: 'Stock Markets Rally on Strong Employment Data',
    url: 'https://example.com/stock-rally',
    source: 'Wall Street Journal',
    category: 'economy',
    publishedAt: new Date(Date.now() - 21600000),
    description: 'Major indices surge as employment reports exceed analyst expectations.',
  },
  {
    title: 'NASA Confirms Discovery of Water on Distant Exoplanet',
    url: 'https://example.com/nasa-discovery',
    source: 'Nature',
    category: 'world',
    publishedAt: new Date(Date.now() - 25200000),
    description: 'Space telescope detects signatures of water vapor in atmosphere of potentially habitable exoplanet.',
  },
];

interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

interface MediaStackArticle {
  author: string | null;
  title: string;
  description: string;
  url: string;
  source: string;
  image: string | null;
  category: string;
  language: string;
  country: string;
  published_at: string;
}

interface MediaStackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: MediaStackArticle[];
}

async function fetchFromGNews(): Promise<RawArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey || apiKey === 'demo_key') {
    console.log('GNews API key not configured, using demo articles');
    return [];
  }

  const categories = ['technology', 'science', 'business', 'world'];
  const allArticles: RawArticle[] = [];

  const categoryMap: Record<string, string> = {
    technology: 'tech',
    science: 'world',
    business: 'economy',
    world: 'world',
  };

  for (const category of categories) {
    try {
      const response = await fetch(
        `https://gnews.io/api/v4/topics/${category}?lang=en&max=10&apikey=${apiKey}`
      );

      if (!response.ok) {
        console.error(`GNews API error for ${category}:`, response.status);
        continue;
      }

      const data: GNewsResponse = await response.json();

      for (const article of data.articles) {
        allArticles.push({
          title: article.title,
          description: article.description || '',
          url: article.url,
          source: article.source.name,
          category: categoryMap[category] || 'world',
          publishedAt: new Date(article.publishedAt),
        });
      }
    } catch (error) {
      console.error(`Error fetching GNews for ${category}:`, error);
    }
  }

  return allArticles;
}

async function fetchFromMediaStack(): Promise<RawArticle[]> {
  const apiKey = process.env.MEDIASTACK_API_KEY;
  if (!apiKey) {
    console.log('MediaStack API key not configured');
    return [];
  }

  const categories = ['technology', 'business', 'science', 'general'];
  const allArticles: RawArticle[] = [];

  const categoryMap: Record<string, string> = {
    technology: 'tech',
    business: 'economy',
    science: 'world',
    general: 'world',
  };

  const stockTickerPattern = /\b(OTCMKTS|NYSE|TSE|AMEX|NASDAQ)\b/i;
  const lowQualityPattern = /\b( Sets New \d+-Year High| Reaches New \d+-Week High| Hits New \d+-Year High| Sets New \d+-Month High| Time to Buy| What's Next| Here's What Happened)\b/i;
  const earningsPattern = /\b(Q[1-4]\s*\d{4}\s*Earnings Call Transcript|Q[1-4]\s*\d{4}\s*Earnings Call Transcript)\b/i;

  for (const category of categories) {
    try {
      const response = await fetch(
        `http://api.mediastack.com/v1/news?access_key=${apiKey}&categories=${category}&countries=us,gb&limit=20&sort=published_desc`
      );

      if (!response.ok) {
        console.error(`MediaStack API error for ${category}:`, response.status);
        continue;
      }

      const data: MediaStackResponse = await response.json();

      for (const article of data.data) {
        if (!article.title || !article.url) continue;
        
        if (stockTickerPattern.test(article.title) && lowQualityPattern.test(article.title)) {
          continue;
        }
        
        if (earningsPattern.test(article.title)) {
          continue;
        }

        allArticles.push({
          title: article.title,
          description: article.description || '',
          url: article.url,
          source: article.source,
          category: categoryMap[category] || 'world',
          publishedAt: new Date(article.published_at),
        });
      }
    } catch (error) {
      console.error(`Error fetching MediaStack for ${category}:`, error);
    }
  }

  return allArticles;
}

export async function fetchFromRSS(): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items.slice(0, 5)) {
        if (item.title && item.link) {
          articles.push({
            title: item.title,
            url: item.link,
            source: feed.source,
            category: feed.category,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            description: item.contentSnippet || item.content || '',
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching RSS from ${feed.source}:`, error);
    }
  }

  return articles;
}

export async function fetchDemoArticles(): Promise<RawArticle[]> {
  return DEMO_ARTICLES;
}

export async function fetchAllNews(): Promise<RawArticle[]> {
  const [mediastackArticles, gnewsArticles, rssArticles, demoArticles] = await Promise.all([
    fetchFromMediaStack().catch(() => []),
    fetchFromGNews().catch(() => []),
    fetchFromRSS().catch(() => []),
    fetchDemoArticles(),
  ]);

  // Combine all sources - prioritize fresh news from multiple channels
  const allArticles = [
    ...mediastackArticles,
    ...gnewsArticles,
    ...rssArticles,
    ...demoArticles,
  ];

  return allArticles;
}

export function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning') || text.includes('gpt') || text.includes('neural')) {
    return 'ai';
  }
  if (text.includes('tech') || text.includes('apple') || text.includes('google') || text.includes('microsoft') || text.includes('software')) {
    return 'tech';
  }
  if (text.includes('economy') || text.includes('stock') || text.includes('market') || text.includes('fed') || text.includes('inflation') || text.includes('rate')) {
    return 'economy';
  }
  return 'world';
}
