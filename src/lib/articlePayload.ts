export interface ArticleDTO {
  _id: string;
  title: string;
  url: string;
  source: string;
  category?: string;
  categories: string[];
  imageUrl?: string;
  description?: string;
  images: string[];
  sources: { name: string; url: string }[];
  summary?: unknown;
  brief?: { whatHappened: string; whyItMatters?: string; background?: string; provider: string };
  publishedAt: Date;
  importanceScore: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Public article shape. Outlet snippets never leave the server: sources are reduced to {name,url}. */
export function toArticleDTO(a: any): ArticleDTO {
  return {
    _id: String(a._id),
    title: a.title,
    url: a.url,
    source: a.source,
    // Transitional: derived single category for the legacy UI (removed in Tasks 13/14).
    category: a.categories?.[0],
    categories: a.categories ?? [],
    imageUrl: a.imageUrl,
    description: a.description,
    images: a.images ?? [],
    sources: (a.sources ?? []).map((s: { name: string; url: string }) => ({ name: s.name, url: s.url })),
    summary: a.summary,
    brief: a.brief?.whatHappened
      ? { whatHappened: a.brief.whatHappened, whyItMatters: a.brief.whyItMatters, background: a.brief.background, provider: a.brief.provider }
      : undefined,
    publishedAt: a.publishedAt,
    importanceScore: a.importanceScore,
  };
}
