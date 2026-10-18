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
