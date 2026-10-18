'use client';

import { useId, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CATEGORIES, getCategory, normalizeSlug } from '@/lib/categories';
import { usePreviousVisit } from '@/lib/prefs';
import { isNewSince, safeImageUrl } from '@/lib/freshness';
import { ChevronDown, Bookmark, ExternalLink, Sparkles, Share2 } from 'lucide-react';

export interface NewsArticle {
  _id: string;
  title: string;
  url: string;
  source: string;
  categories: string[];
  /** Legacy single category; only present on old saved snapshots. */
  category?: string;
  imageUrl?: string;
  sources?: { name: string; url: string }[];
  publishedAt: string | Date;
  importanceScore: number;
  topics?: string[];
  summary?: {
    tldr: string;
    bullets: string[];
    whyItMatters?: string;
    provider?: string;
  };
  isSaved?: boolean;
}

interface NewsCardProps {
  article: NewsArticle;
  onSave?: (article: NewsArticle) => void;
}

type CatStyle = { border: string; text: string; bg: string; dot: string; tint: string };

// Map keyed by registry slug: prototype-safe (no 'constructor' / '__proto__' hits).
const categoryColors = new Map<string, CatStyle>();
for (const c of CATEGORIES) {
  categoryColors.set(c.slug, {
    border: c.color,
    text: c.color,
    bg: `color-mix(in srgb, ${c.color} 8%, transparent)`,
    dot: c.color,
    tint: `color-mix(in srgb, ${c.color} 6%, transparent)`,
  });
}

const defaultCategory: CatStyle = { border: 'var(--border-highlight)', text: 'var(--text-muted)', bg: 'transparent', dot: 'var(--text-muted)', tint: 'transparent' };

/** Registry slugs for an article, tolerant of legacy/malformed data. */
function resolveSlugs(article: NewsArticle): string[] {
  const raw: unknown[] = [
    ...(Array.isArray(article.categories) ? article.categories : []),
    article.category,
  ];
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== 'string') continue;
    const slug = normalizeSlug(r);
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

function relativeTime(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default function NewsCard({ article, onSave }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(article.isSaved || false);
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const previousVisit = usePreviousVisit();
  const panelId = useId();

  const isHigh = article.importanceScore >= 0.75;
  const isMedium = article.importanceScore >= 0.5;

  const slugs = resolveSlugs(article);
  const primary = slugs.length ? getCategory(slugs[0]) : undefined;
  const categoryStyle = (primary && categoryColors.get(primary.slug)) || defaultCategory;
  const extraCount = Math.max(0, slugs.length - 2);

  const imageSrc = safeImageUrl(article.imageUrl);
  const showImage = imageSrc !== null && !imgFailed;
  const time = relativeTime(article.publishedAt);
  const isNew = isNewSince(article.publishedAt, previousVisit);

  const sourceLinks = (Array.isArray(article.sources) ? article.sources : [])
    .filter((s) => s && typeof s.url === 'string' && safeImageUrl(s.url) !== null)
    .map((s) => ({ name: text(s.name) || text(article.source) || 'Source', url: s.url }));
  const links = sourceLinks.length ? sourceLinks : [{ name: text(article.source) || 'Source', url: article.url }];
  const sourceCount = Array.isArray(article.sources) ? article.sources.length : 0;

  const summary = article.summary;
  const tldr = text(summary?.tldr);
  const bullets = Array.isArray(summary?.bullets) ? summary!.bullets.filter((b) => typeof b === 'string') : [];
  const why = text(summary?.whyItMatters).trim();
  const hasDetails = bullets.length > 0 || why.length > 0 || links.length > 0;

  const handleSave = () => {
    setIsSaved(!isSaved);
    setBookmarkAnimating(true);
    setTimeout(() => setBookmarkAnimating(false), 300);
    onSave?.(article);
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: article.title, url: article.url }).catch(() => {});
    }
  };

  const toggle = () => setIsExpanded((v) => !v);
  const iconBtn = 'p-1.5 rounded-md transition-all';

  return (
    <article
      className="group relative border-b border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-elevated)]"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: isHigh ? 'var(--accent-high)' : isMedium ? 'var(--accent-medium)' : categoryStyle.border,
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div
            className="relative w-full sm:w-44 shrink-0 overflow-hidden rounded-lg"
            style={{ aspectRatio: '16 / 9', backgroundColor: categoryStyle.tint }}
            data-testid="card-thumb"
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt=""
                width={320}
                height={180}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-3xl"
                style={{ backgroundColor: categoryStyle.bg, border: `1px solid ${categoryStyle.border}`, borderRadius: 8 }}
                data-testid="card-placeholder"
                aria-hidden="true"
              >
                {primary?.emoji ?? '📰'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap mb-2" style={{ gap: 6 }}>
              {isHigh && (
                <span
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-high)' }}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded"
                >
                  HIGH
                </span>
              )}
              {isMedium && !isHigh && (
                <span
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: 'var(--accent-medium)' }}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded"
                >
                  MEDIUM
                </span>
              )}
              {isNew && (
                <span
                  style={{ backgroundColor: 'var(--accent-brand)', color: 'var(--bg-surface)' }}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded"
                >
                  New
                </span>
              )}
              {slugs.slice(0, 2).map((slug) => {
                const def = getCategory(slug);
                const st = categoryColors.get(slug) ?? defaultCategory;
                return (
                  <span
                    key={slug}
                    style={{ borderColor: st.border, color: st.text, backgroundColor: st.bg }}
                    className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded border"
                  >
                    <span aria-hidden="true">{def?.emoji}</span> {def?.label ?? slug}
                  </span>
                );
              })}
              {extraCount > 0 && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  +{extraCount}
                </span>
              )}
              {sourceCount > 1 && (
                <span
                  className="px-2 py-0.5 text-[10px] font-medium rounded"
                  style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  {sourceCount} sources
                </span>
              )}
            </div>

            <h3
              className="font-serif"
              style={{
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.4,
                color: isHigh ? 'var(--accent-high)' : 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="text-left cursor-pointer"
                style={{ color: 'inherit', font: 'inherit' }}
              >
                {article.title}
              </button>
            </h3>

            {tldr && (
              <p className="line-clamp-2 mb-3" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {tldr}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0" style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                <span className="font-medium truncate">{article.source}</span>
                {time && <span className="shrink-0">{' · '}{time}</span>}
              </div>

              <div className="flex items-center gap-1 card-actions shrink-0">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share article"
                  className={`${iconBtn} text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]`}
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  aria-label={isSaved ? 'Remove bookmark' : 'Bookmark article'}
                  aria-pressed={isSaved}
                  className={`${iconBtn} ${
                    isSaved
                      ? 'text-[var(--accent-brand)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''} ${bookmarkAnimating ? 'animate-pulse-bookmark' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border)] cursor-pointer"
                  style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                >
                  <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id={panelId}>
          {isExpanded && hasDetails && (
            <div className="mt-4 pt-4 border-t border-[var(--border)] animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-4">
                {bullets.length > 0 && (
                  <div>
                    <h4
                      className="text-[11px] font-semibold mb-3 flex items-center gap-2 uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}
                    >
                      <Sparkles className="w-3.5 h-3.5" style={{ color: categoryStyle.text }} />
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {bullets.map((bullet, idx) => (
                        <li key={idx} className="text-[13px] flex items-start gap-2.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          <span className="w-1.5 h-1.5 rounded-sm mt-1.5 shrink-0" style={{ backgroundColor: categoryStyle.dot }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {why && (
                  <div
                    className="p-4 rounded-lg"
                    style={{ borderLeftColor: categoryStyle.dot, backgroundColor: categoryStyle.tint, borderLeftWidth: '3px' }}
                  >
                    <h4 className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                      Why It Matters
                    </h4>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {why}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    {links.length > 1 ? 'Sources' : 'Source'}
                  </h4>
                  <ul className="space-y-1">
                    {links.map((l, idx) => (
                      <li key={`${l.url}-${idx}`}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] hover:opacity-80 transition-opacity underline-offset-2 hover:underline"
                          style={{ color: categoryStyle.text }}
                        >
                          {l.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] hover:opacity-80 transition-opacity"
                  style={{ color: categoryStyle.text }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Read full article
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
