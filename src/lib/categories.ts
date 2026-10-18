export type CategorySlug =
  | 'ai' | 'technology' | 'business' | 'world' | 'geopolitics' | 'politics' | 'law'
  | 'science' | 'health' | 'environment' | 'sports' | 'entertainment' | 'education' | 'society';

export interface FeedDef { url: string; source: string }

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  emoji: string;
  description: string;
  color: string; // CSS var
  feeds: FeedDef[];
  guardianSections: string[];
  gnewsTopic?: string;
  mediastackCategory?: string;
  keywords: string[];
  weight: number;
}

const G = (path: string): FeedDef => ({ url: `https://www.theguardian.com/${path}/rss`, source: 'The Guardian' });
const NPR = (id: number): FeedDef => ({ url: `https://feeds.npr.org/${id}/rss.xml`, source: 'NPR' });
const NYT = (name: string): FeedDef => ({ url: `https://rss.nytimes.com/services/xml/rss/nyt/${name}.xml`, source: 'NYT' });
const BBC = (path: string): FeedDef => ({ url: `https://feeds.bbci.co.uk/${path}/rss.xml`, source: 'BBC' });

// All feed URLs were fetched once and confirmed to return valid RSS with items.
export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'ai', label: 'AI', emoji: '🤖',
    description: 'AI, LLMs, automation, robotics, AI research',
    color: 'var(--cat-ai)', weight: 1.2,
    feeds: [
      { url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss', source: 'The Guardian' },
      { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
    ],
    guardianSections: [],
    keywords: ['ai', 'artificial intelligence', 'chatgpt', 'openai', 'anthropic', 'llm', 'machine learning', 'neural network', 'chatbot', 'robot', 'generative', 'deepmind'],
  },
  {
    slug: 'technology', label: 'Technology', emoji: '💻',
    description: 'Software, hardware, cybersecurity, startups, consumer tech',
    color: 'var(--cat-technology)', weight: 1.0,
    feeds: [
      BBC('news/technology'), NYT('Technology'),
      { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', source: 'Ars Technica' },
      { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge' },
      NPR(1019),
    ],
    guardianSections: ['technology'], gnewsTopic: 'technology', mediastackCategory: 'technology',
    keywords: ['software', 'hardware', 'cybersecurity', 'hacker', 'data breach', 'ransomware', 'startup', 'smartphone', 'iphone', 'android', 'semiconductor', 'chip', 'app'],
  },
  {
    slug: 'business', label: 'Business & Economy', emoji: '💼',
    description: 'Companies, markets, finance, inflation, trade, cryptocurrency',
    color: 'var(--cat-business)', weight: 1.0,
    feeds: [
      BBC('news/business'), NYT('Economy'),
      { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', source: 'CNBC' },
      { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC' },
      NPR(1006), G('business'),
    ],
    guardianSections: ['business'], gnewsTopic: 'business', mediastackCategory: 'business',
    keywords: ['economy', 'economic', 'inflation', 'stock', 'market', 'oil', 'trade', 'tariff', 'export', 'import', 'bank', 'interest rate', 'earnings', 'crypto', 'bitcoin', 'recession', 'gdp'],
  },
  {
    slug: 'world', label: 'World', emoji: '🌍',
    description: 'Major international developments and global events',
    color: 'var(--cat-world)', weight: 1.0,
    feeds: [BBC('news/world'), NYT('World'), G('world')],
    guardianSections: ['world'], gnewsTopic: 'world', mediastackCategory: 'general',
    keywords: ['international', 'united nations', 'earthquake', 'refugee'],
  },
  {
    slug: 'geopolitics', label: 'Geopolitics', emoji: '🌐',
    description: 'International relations, diplomacy, conflicts, global security',
    color: 'var(--cat-geopolitics)', weight: 1.1,
    feeds: [
      { url: 'https://foreignpolicy.com/feed/', source: 'Foreign Policy' },
      { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
      NPR(1004),
    ],
    guardianSections: [],
    keywords: ['sanction', 'diplomacy', 'diplomat', 'nato', 'war', 'ceasefire', 'invasion', 'missile', 'treaty', 'summit', 'military', 'nuclear', 'foreign policy'],
  },
  {
    slug: 'politics', label: 'Politics', emoji: '🏛️',
    description: 'Governments, elections, public policy, legislation',
    color: 'var(--cat-politics)', weight: 1.0,
    feeds: [BBC('news/politics'), NYT('Politics'), NPR(1014), G('politics')],
    guardianSections: ['politics', 'us-news'],
    keywords: ['election', 'parliament', 'congress', 'senate', 'president', 'prime minister', 'legislation', 'lawmakers', 'vote', 'campaign'],
  },
  {
    slug: 'law', label: 'Law & Justice', emoji: '⚖️',
    description: 'Courts, legal decisions, human rights, legal reforms',
    color: 'var(--cat-law)', weight: 0.9,
    feeds: [G('law')],
    guardianSections: ['law'],
    keywords: ['court', 'judge', 'supreme court', 'ruling', 'lawsuit', 'verdict', 'trial', 'human rights', 'prosecutor', 'sentenced'],
  },
  {
    slug: 'science', label: 'Science', emoji: '🔬',
    description: 'Discoveries, research, space, physics, biology',
    color: 'var(--cat-science)', weight: 1.0,
    feeds: [
      BBC('news/science_and_environment'), NYT('Science'),
      { url: 'https://feeds.arstechnica.com/arstechnica/science', source: 'Ars Technica' },
      NPR(1007), G('science'),
    ],
    guardianSections: ['science'], gnewsTopic: 'science', mediastackCategory: 'science',
    keywords: ['scientist', 'study finds', 'nasa', 'space', 'astronomy', 'physics', 'biology', 'telescope', 'discovery', 'fossil'],
  },
  {
    slug: 'health', label: 'Health', emoji: '🏥',
    description: 'Medicine, healthcare, diseases, public health',
    color: 'var(--cat-health)', weight: 1.0,
    feeds: [BBC('news/health'), NYT('Health'), NPR(1128), G('society/health')],
    guardianSections: [], gnewsTopic: 'health', mediastackCategory: 'health',
    keywords: ['health', 'medicine', 'hospital', 'disease', 'vaccine', 'cancer', 'virus', 'outbreak', 'pandemic', 'patients', 'nhs', 'drug'],
  },
  {
    slug: 'environment', label: 'Environment', emoji: '🌱',
    description: 'Climate, sustainability, conservation, natural disasters',
    color: 'var(--cat-environment)', weight: 1.0,
    feeds: [NYT('Climate'), G('environment'), G('environment/climate-crisis')],
    guardianSections: ['environment'],
    keywords: ['climate', 'emissions', 'carbon', 'global warming', 'renewable', 'biodiversity', 'wildfire', 'flood', 'flooding', 'hurricane', 'drought', 'conservation', 'pollution'],
  },
  {
    slug: 'sports', label: 'Sports', emoji: '⚽',
    description: 'Competitions, athletes, tournaments, events',
    color: 'var(--cat-sports)', weight: 0.9,
    feeds: [BBC('sport'), G('sport')],
    guardianSections: ['sport', 'football'], gnewsTopic: 'sports', mediastackCategory: 'sports',
    keywords: ['football', 'soccer', 'cricket', 'tennis', 'olympic', 'world cup', 'championship', 'tournament', 'athlete', 'nba', 'premier league', 'formula 1'],
  },
  {
    slug: 'entertainment', label: 'Entertainment', emoji: '🎬',
    description: 'Movies, music, gaming, celebrities, streaming',
    color: 'var(--cat-entertainment)', weight: 0.9,
    feeds: [
      BBC('news/entertainment_and_arts'), NYT('Arts'),
      { url: 'https://www.theverge.com/rss/entertainment/index.xml', source: 'The Verge' },
      G('culture'),
    ],
    guardianSections: ['culture', 'film', 'music', 'games', 'tv-and-radio'], gnewsTopic: 'entertainment', mediastackCategory: 'entertainment',
    keywords: ['movie', 'film', 'box office', 'album', 'concert', 'streaming', 'netflix', 'celebrity', 'video game', 'oscar', 'grammy', 'television'],
  },
  {
    slug: 'education', label: 'Education', emoji: '🎓',
    description: 'Universities, learning, education policy, academic developments',
    color: 'var(--cat-education)', weight: 0.9,
    feeds: [BBC('news/education'), NYT('Education'), NPR(1013), G('education')],
    guardianSections: ['education'],
    keywords: ['university', 'students', 'teacher', 'tuition', 'curriculum', 'college', 'campus', 'exam', 'academic'],
  },
  {
    slug: 'society', label: 'Society & Culture', emoji: '👥',
    description: 'Social trends, communities, migration, cultural developments',
    color: 'var(--cat-society)', weight: 0.9,
    feeds: [G('society')],
    guardianSections: ['society', 'inequality', 'global-development'],
    keywords: ['migration', 'immigrant', 'immigration', 'inequality', 'poverty', 'homeless', 'gender', 'social media', 'protest', 'housing'],
  },
];

const LEGACY = new Map<string, CategorySlug>([['tech', 'technology'], ['economy', 'business']]);

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function normalizeSlug(raw: string): CategorySlug | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  const mapped = LEGACY.get(s) ?? s;
  return CATEGORIES.find((c) => c.slug === mapped)?.slug ?? null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATCHERS = CATEGORIES.map((c) => ({
  slug: c.slug,
  re: new RegExp(`\\b(?:${c.keywords.map(esc).join('|')})(?:s|es|ed)?\\b`, 'i'),
}));

export function tagCategories(primary: CategorySlug, title: string, description?: string): CategorySlug[] {
  const text = `${title} ${description ?? ''}`;
  const out: CategorySlug[] = [primary];
  for (const m of MATCHERS) {
    if (m.slug !== primary && m.re.test(text)) out.push(m.slug);
  }
  return out;
}
