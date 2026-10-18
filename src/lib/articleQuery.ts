import { normalizeSlug } from '@/lib/categories';

export interface ArticleQuery {
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  limit: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_Q_LENGTH = 100;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildArticleQuery(params: URLSearchParams): ArticleQuery {
  const filter: Record<string, unknown> = {};

  const slugs = new Set<string>();
  for (const part of (params.get('categories') ?? '').split(',')) {
    const slug = normalizeSlug(part);
    if (slug) slugs.add(slug);
  }
  if (slugs.size > 0) filter.categories = { $in: [...slugs] };

  const q = (params.get('q') ?? '').trim().slice(0, MAX_Q_LENGTH);
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: re }, { 'summary.tldr': re }];
  }

  const importance = params.get('importance');
  if (importance === 'high') filter.importanceScore = { $gte: 0.75 };
  else if (importance === 'medium') filter.importanceScore = { $gte: 0.5, $lt: 0.75 };

  const rawLimit = Number(params.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;

  return { filter, sort: { importanceScore: -1, publishedAt: -1 }, limit: limit >= 1 ? limit : DEFAULT_LIMIT };
}
