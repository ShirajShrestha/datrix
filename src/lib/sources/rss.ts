import Parser from 'rss-parser';
import { CATEGORIES, type CategorySlug, type FeedDef } from '@/lib/categories';
import type { RawArticle } from './types';

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
  'media:group'?: Record<string, MediaNode | MediaNode[] | undefined>;
}

const FEED_TIMEOUT_MS = 8000;

const parser = new Parser<Record<string, never>, RssItem>({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'Datrix/2.0 (+news aggregator)' },
  customFields: {
    item: ['media:thumbnail', 'media:content', 'media:group'] as never,
  },
});

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  const description = rawDesc ? stripHtml(rawDesc).slice(0, 600) : undefined;

  return {
    title: stripHtml(title),
    url,
    source: feed.source,
    category,
    publishedAt,
    description: description || undefined,
    imageUrl: extractImage(item),
  };
}

export async function fetchRss(): Promise<RawArticle[]> {
  const jobs: Array<{ feed: FeedDef; category: CategorySlug }> = [];
  for (const cat of CATEGORIES) for (const feed of cat.feeds) jobs.push({ feed, category: cat.slug });

  const results = await Promise.all(
    jobs.map(async ({ feed, category }): Promise<RawArticle[]> => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items
          .map((it) => parseRssItem(it, feed, category))
          .filter((a): a is RawArticle => a !== null);
      } catch (err) {
        console.warn(`[rss] feed failed: ${feed.url} (${err instanceof Error ? err.message : 'error'})`);
        return [];
      }
    }),
  );
  return results.flat();
}
