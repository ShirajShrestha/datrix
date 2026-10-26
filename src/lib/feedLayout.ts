import { extractFigure, extractQuote, type HighlightSource } from '@/lib/highlights';

export type CardVariant = 'standard' | 'figure' | 'quote';

export interface FeedItem<T> {
  article: T;
  variant: CardVariant;
  figure?: string;
  quote?: string;
  /** Full row width. Visual cards sit two to a row; an unpaired last one goes full width. */
  wide: boolean;
}

export interface FeedLayout<T> {
  lead: T | null;
  keepUp: FeedItem<T>[];
  quickHits: T[];
  more: T[];
}

export const KEEP_UP = 8;
export const QUICK_HITS = 6;
const MAX_FIGURE = 2;
const MAX_QUOTE = 2;

/**
 * Split an importance-sorted list into the Today layout: one lead story, a "keep up" set with a few
 * visual variants mixed in (never two of the same variant in a row), quick hits, then everything else.
 */
export function buildFeedLayout<T extends HighlightSource>(articles: T[]): FeedLayout<T> {
  const list = Array.isArray(articles) ? articles : [];
  const [lead = null, ...rest] = list;
  const keepUpRaw = rest.slice(0, KEEP_UP);
  let figures = 0;
  let quotes = 0;
  let prev: CardVariant = 'standard';
  const keepUp = keepUpRaw.map((article): FeedItem<T> => {
    const figure = figures < MAX_FIGURE && prev !== 'figure' ? extractFigure(article) : null;
    if (figure) {
      figures++;
      prev = 'figure';
      return { article, variant: 'figure', figure, wide: false };
    }
    const quote = quotes < MAX_QUOTE && prev !== 'quote' ? extractQuote(article) : null;
    if (quote) {
      quotes++;
      prev = 'quote';
      return { article, variant: 'quote', quote, wide: false };
    }
    prev = 'standard';
    return { article, variant: 'standard', wide: true };
  });
  const visual = keepUp.filter((i) => !i.wide);
  if (visual.length % 2 === 1) visual[visual.length - 1].wide = true;
  return {
    lead,
    keepUp,
    quickHits: rest.slice(KEEP_UP, KEEP_UP + QUICK_HITS),
    more: rest.slice(KEEP_UP + QUICK_HITS),
  };
}

/** Short spoken script for the "Today in 60 seconds" audio: headline plus one-line summary of the top stories. */
export function sixtySecondScript(articles: { title: string; summary?: { tldr?: string } }[], n = 5): string {
  return articles
    .slice(0, n)
    .map((a, i) => {
      const tldr = a.summary?.tldr?.trim();
      const title = a.title.trim();
      return `${i + 1}. ${/[.!?]$/.test(title) ? title : `${title}.`}${tldr ? ` ${tldr}` : ''}`;
    })
    .join(' ');
}

/** Initials for an outlet badge: "The Guardian" -> "GDN" style short names for known outlets, else up to 3 letters. */
const KNOWN: Record<string, string> = {
  'the guardian': 'GDN', guardian: 'GDN', nyt: 'NYT', 'new york times': 'NYT', 'the new york times': 'NYT',
  bbc: 'BBC', 'bbc news': 'BBC', npr: 'NPR', cnbc: 'CNBC', 'foreign policy': 'FP', 'al jazeera': 'AJ',
  'the verge': 'VRG', 'ars technica': 'ARS', reuters: 'RTR', 'associated press': 'AP', ap: 'AP',
};
export function outletInitials(name: string): string {
  const k = (name ?? '').trim().toLowerCase();
  if (KNOWN[k]) return KNOWN[k];
  const words = k.replace(/^the\s+/, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  return (words[0] ?? '?').slice(0, 3).toUpperCase();
}
