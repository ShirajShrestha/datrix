import { normalizeSlug } from '@/lib/categories';

export interface ArticleQuery {
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  limit: number;
  freshHours?: number;
}

export const FRESH_MIN_RESULTS = 12;
export const FRESH_WIDEN_HOURS = 168;
const MAX_FRESH_HOURS = 720;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_Q_LENGTH = 100;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildArticleQuery(params: URLSearchParams, now: number = Date.now()): ArticleQuery {
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

  let freshHours: number | undefined;
  const rawFresh = Number(params.get('fresh'));
  if (!q && params.get('fresh') && Number.isFinite(rawFresh) && rawFresh > 0) {
    freshHours = Math.min(Math.max(rawFresh, 1), MAX_FRESH_HOURS);
    filter.publishedAt = { $gte: new Date(now - freshHours * 3600e3) };
  }

  const importance = params.get('importance');
  if (importance === 'high') filter.importanceScore = { $gte: 0.75 };
  else if (importance === 'medium') filter.importanceScore = { $gte: 0.5, $lt: 0.75 };

  const rawLimit = Number(params.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;

  const query: ArticleQuery = { filter, sort: { importanceScore: -1, publishedAt: -1 }, limit: limit >= 1 ? limit : DEFAULT_LIMIT };
  if (freshHours !== undefined) query.freshHours = freshHours;
  return query;
}
