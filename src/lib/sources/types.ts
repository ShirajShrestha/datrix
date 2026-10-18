import type { CategorySlug } from '@/lib/categories';

export interface SourceRef { name: string; url: string }

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  category: CategorySlug;
  publishedAt: Date;
  description?: string;
  imageUrl?: string;
}

/** Thrown by an adapter when every attempted request failed. Message never carries URLs, keys or causes. */
export class SourceError extends Error {
  constructor(public readonly adapter: string) {
    super(`${adapter} all requests failed`);
    this.name = 'SourceError';
  }
}
