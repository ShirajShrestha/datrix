'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { usePreviousVisit } from '@/lib/prefs';
import { isNewSince, safeImageUrl } from '@/lib/freshness';
import { pickDescription, relativeTime, resolveSlugs } from '@/lib/storyView';
import { SAVED_CHANGED_EVENT, isSavedId, notifySavedChanged, toggleSavedStored } from '@/lib/savedArticles';
import { useStoryModal } from '@/components/StoryModalProvider';
import { Bookmark, Share2 } from 'lucide-react';

export interface NewsArticle {
  _id: string;
  title: string;
  url: string;
  source: string;
  categories: string[];
  /** Legacy single category; only present on old saved snapshots. */
  category?: string;
  imageUrl?: string;
  description?: string;
  images?: string[];
  brief?: { whatHappened: string; whyItMatters?: string; background?: string; provider?: string };
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

export default function NewsCard({ article, onSave }: NewsCardProps) {
  const [isSaved, setIsSaved] = useState(article.isSaved || false);
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);
  // Track the URL that failed (not a boolean) so a changed imageUrl gets a fresh attempt.
  const [failedImg, setFailedImg] = useState<string | null>(null);
  const previousVisit = usePreviousVisit();
  const { openStory } = useStoryModal();

  const isHigh = article.importanceScore >= 0.75;
  const isMedium = article.importanceScore >= 0.5;

  const slugs = resolveSlugs(article);
  const primary = slugs.length ? getCategory(slugs[0]) : undefined;
  const categoryStyle = (primary && categoryColors.get(primary.slug)) || defaultCategory;
  const extraCount = Math.max(0, slugs.length - 2);

  const imageSrc = safeImageUrl(article.imageUrl);
  const showImage = imageSrc !== null && failedImg !== imageSrc;
  const time = relativeTime(article.publishedAt);
  const isNew = isNewSince(article.publishedAt, previousVisit);

  const sourceCount = Array.isArray(article.sources) ? article.sources.length : 0;

  const description = pickDescription(article);

  useEffect(() => {
    const sync = () => setIsSaved(isSavedId(article._id));
    sync();
    window.addEventListener(SAVED_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, sync);
  }, [article._id]);

  const handleSave = () => {
    setIsSaved(!isSaved);
    setBookmarkAnimating(true);
    setTimeout(() => setBookmarkAnimating(false), 300);
    if (onSave) onSave(article);
    else toggleSavedStored(article);
    notifySavedChanged();
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: article.title, url: article.url }).catch(() => {});
    }
  };

  const open = () => openStory(article);
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
                onError={() => setFailedImg(imageSrc)}
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
              className="font-serif break-words min-w-0"
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
                onClick={open}
                aria-haspopup="dialog"
                className="text-left cursor-pointer break-words min-w-0 max-w-full"
                style={{ color: 'inherit', font: 'inherit' }}
              >
                {article.title}
              </button>
            </h3>

            {description && (
              <p className="line-clamp-3 mb-3" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {description}
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
                  onClick={open}
                  aria-haspopup="dialog"
                  className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border)] cursor-pointer"
                  style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                >
                  <span>Read more</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
