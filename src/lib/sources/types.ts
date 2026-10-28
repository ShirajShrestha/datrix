import type { CategorySlug } from '@/lib/categories';

export interface SourceRef { name: string; url: string; snippet?: string }

/** Article bodies shorter than this are treated as teasers and dropped. */
export const MIN_BODY_CHARS = 400;
/** Bodies are capped here. In-memory only: never persisted or returned by the API. */
export const MAX_BODY_CHARS = 6000;

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  category: CategorySlug;
  publishedAt: Date;
  description?: string;
  imageUrl?: string;
  /** Plain-text article body for summarizing. In-memory only; never stored or sent to clients. */
  body?: string;
}

/** Thrown by an adapter when every attempted request failed. Message never carries URLs, keys or causes. */
export class SourceError extends Error {
  constructor(public readonly adapter: string) {
    super(`${adapter} all requests failed`);
    this.name = 'SourceError';
  }
}
