import Parser from 'rss-parser';
import { CATEGORIES, type CategorySlug, type FeedDef } from '@/lib/categories';
import { SourceError, MIN_BODY_CHARS, MAX_BODY_CHARS, type RawArticle } from './types';

interface MediaNode { $?: { url?: string; medium?: string; type?: string } }

export interface RssItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  description?: string;
  enclosure?: { url?: string; type?: string };
  'media:thumbnail'?: MediaNode | MediaNode[];
  'media:content'?: MediaNode | MediaNode[];
  'content:encoded'?: string;
  'media:group'?: Record<string, MediaNode | MediaNode[] | undefined>;
}

const FEED_TIMEOUT_MS = 8000;

const parser = new Parser<Record<string, never>, RssItem>({
  customFields: {
    item: ['media:thumbnail', 'media:content', 'media:group', 'content:encoded'] as never,
  },
});

const NAMED: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013',
  hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201D', ldquo: '\u201C',
};

function fromCode(n: number, orig: string): string {
  if (!Number.isInteger(n) || n < 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return orig;
  return String.fromCodePoint(n);
}

export function stripHtml(s: string): string {
  const text = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => fromCode(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => fromCode(parseInt(d, 10), m))
    .replace(/&(lt|gt|quot|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|rdquo|ldquo);/g, (_, n) => NAMED[n])
    .replace(/&amp;/g, '&');
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end--;
  return s.slice(0, end);
}

/** Plain-text body from HTML/text: undefined when shorter than MIN_BODY_CHARS; capped at MAX_BODY_CHARS on a word boundary. */
export function toBody(raw: string | undefined, isHtml = true): string | undefined {
  if (!raw) return undefined;
  const text = isHtml ? stripHtml(raw) : raw.replace(/\s+/g, ' ').trim();
  if (text.length < MIN_BODY_CHARS) return undefined;
  if (text.length <= MAX_BODY_CHARS) return text;
  const cut = truncate(text, MAX_BODY_CHARS);
  const sp = cut.lastIndexOf(' ');
  return sp > MAX_BODY_CHARS * 0.8 ? cut.slice(0, sp) : cut;
}

function nodes(n: MediaNode | MediaNode[] | undefined): MediaNode[] {
  return n ? (Array.isArray(n) ? n : [n]) : [];
}

function isHttp(u: string | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

// BBC thumbnails carry a width segment, e.g. /ace/standard/240/cpsprodpb/... or /news/240/...
function upgradeBbc(url: string): string {
  return url.replace(
    /^(https?:\/\/ichef\.bbci\.co\.uk\/(?:ace\/standard|news))\/\d{2,4}\//,
    '$1/800/',
  );
}

function extractImage(item: RssItem): string | undefined {
  const thumb = nodes(item['media:thumbnail']).map((n) => n.$?.url).find(isHttp);
  if (thumb) return upgradeBbc(thumb);

  const group = item['media:group'];
  const contents = [
    ...nodes(item['media:content']),
    ...(group ? [...nodes(group['media:content']), ...nodes(group['media:thumbnail'])] : []),
  ];
  const isImg = (n: MediaNode) =>
    n.$?.medium === 'image' || (n.$?.type ?? '').startsWith('image/') ||
    (!n.$?.medium && !n.$?.type && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(n.$?.url ?? ''));
  const content = contents.filter(isImg).map((n) => n.$?.url).find(isHttp);
  if (content) return upgradeBbc(content);

  const enc = item.enclosure;
  if (enc && isHttp(enc.url) && ((enc.type ?? '').startsWith('image/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(enc.url))) {
    return enc.url;
  }
  return extractHtmlImage(item);
}

function extractHtmlImage(item: RssItem): string | undefined {
  for (const html of [item.content, item['content:encoded'], item.description]) {
    if (!html) continue;
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = /\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.replace(/&amp;/g, '&');
      if (!isHttp(src)) continue;
      if (/\b(?:width|height)\s*=\s*["']?1["']?(?=[\s/>"'])/i.test(tag)) continue;
      if (/pixel|tracking|beacon/i.test(src)) continue;
      return src;
    }
  }
  return undefined;
}

export function parseRssItem(item: RssItem, feed: FeedDef, category: CategorySlug): RawArticle | null {
  const title = item.title?.trim();
  const url = item.link?.trim();
  const rawDate = item.isoDate ?? item.pubDate;
  if (!title || !url || !rawDate) return null;
  const publishedAt = new Date(rawDate);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const rawDesc = item.contentSnippet ?? item.description ?? item.content;
  const description = rawDesc ? truncate(stripHtml(rawDesc), 600) : undefined;

  return {
    title: stripHtml(title),
    url,
    source: feed.source,
    category,
    publishedAt,
    description: description || undefined,
    imageUrl: extractImage(item),
    body: toBody(item['content:encoded']),
  };
}

// Returns null when the feed request failed (so the adapter can tell failure from an empty feed).
async function fetchFeed(feed: FeedDef, category: CategorySlug): Promise<RawArticle[] | null> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Datrix/1.0 (+news reader)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await parser.parseString(await res.text());
    return parsed.items
      .map((it) => parseRssItem(it, feed, category))
      .filter((a): a is RawArticle => a !== null);
  } catch (err) {
    console.warn(`[rss] feed failed: ${feed.url} (${err instanceof Error ? err.message : 'error'})`);
    return null;
  }
}

const MAX_CONCURRENCY = 8;

export async function fetchRss(): Promise<RawArticle[]> {
  const jobs: Array<{ feed: FeedDef; category: CategorySlug }> = [];
  for (const cat of CATEGORIES) for (const feed of cat.feeds) jobs.push({ feed, category: cat.slug });

  // Duplicates across category feeds are intentionally returned; scoring.deduplicateArticles merges them.
  const results: Array<RawArticle[] | null> = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await fetchFeed(jobs[i].feed, jobs[i].category);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, jobs.length) }, worker));
  if (jobs.length > 0 && results.every((r) => r === null)) throw new SourceError('rss');
  return results.flatMap((r) => r ?? []);
}
