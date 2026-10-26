'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Share2, Check, ArrowRight } from 'lucide-react';
import { safeImageUrl } from '@/lib/freshness';
import { pickDescription, relativeTime, resolveSlugs, uniqueSourceNames } from '@/lib/storyView';
import { SAVED_CHANGED_EVENT, isSavedId, toggleSavedStored } from '@/lib/savedArticles';
import { useReading, type SummaryMode } from '@/lib/reading';
import { cleanQuote } from '@/lib/highlights';
import type { CardVariant } from '@/lib/feedLayout';
import { useStoryModal } from '@/components/StoryModalProvider';
import { HighImpact, ImportanceBars, SourceStack, isHighImpact, topicLabel, topicTone } from '@/components/ui';

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
  variant?: CardVariant | 'compact';
  figure?: string;
  quote?: string;
  rank?: number;
  /** Stories to step through with "Next story" in the reader. */
  queue?: NewsArticle[];
}

/** Bullets for the current summary length; always returns something readable. */
export function summaryLines(a: NewsArticle, mode: SummaryMode): { lead?: string; bullets: string[]; why?: string } {
  const tldr = a.summary?.tldr?.trim();
  const bullets = Array.isArray(a.summary?.bullets) ? a.summary!.bullets.filter((b) => typeof b === 'string' && b.trim()).slice(0, 3) : [];
  const fallback = tldr || pickDescription(a);
  if (mode === 'headlines') return { lead: fallback || undefined, bullets: [] };
  if (mode === 'key') return bullets.length ? { bullets } : { lead: fallback || undefined, bullets: [] };
  return { lead: fallback || undefined, bullets, why: a.summary?.whyItMatters || a.brief?.whyItMatters };
}

export function sourceNames(a: NewsArticle): string[] {
  const all = Array.isArray(a.sources) && a.sources.length ? a.sources : [{ name: a.source, url: a.url }];
  return uniqueSourceNames(all, a.source);
}

function useSaved(id: string, initial?: boolean) {
  const [saved, setSaved] = useState(initial ?? false);
  useEffect(() => {
    const sync = () => setSaved(isSavedId(id));
    sync();
    window.addEventListener(SAVED_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, sync);
  }, [id]);
  return saved;
}

export function shareArticle(a: NewsArticle) {
  const url = safeImageUrl(a.url) ?? window.location.href;
  if (navigator.share) navigator.share({ title: a.title, url }).catch(() => {});
  else navigator.clipboard?.writeText(url).catch(() => {});
}

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export function CardActions({ article, onSave }: { article: NewsArticle; onSave?: (a: NewsArticle) => void }) {
  const saved = useSaved(article._id, article.isSaved);
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label={saved ? 'Remove from saved' : 'Save story'}
        aria-pressed={saved}
        onClick={(e) => {
          e.stopPropagation();
          if (onSave) onSave(article);
          else toggleSavedStored(article);
        }}
        style={{ ...iconBtn, color: saved ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        <Bookmark className="w-[18px] h-[18px]" fill={saved ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        aria-label="Share story"
        onClick={(e) => {
          e.stopPropagation();
          shareArticle(article);
        }}
        style={{ ...iconBtn, color: 'var(--text-muted)' }}
      >
        <Share2 className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}

function ReadBadge() {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: 'var(--good)' }}>
      <Check className="w-3.5 h-3.5" strokeWidth={2.6} aria-hidden />
      Read
    </span>
  );
}

function Bullets({ items, size = 15 }: { items: string[]; size?: number }) {
  return (
    <ul className="flex flex-col" style={{ gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((b, i) => (
        <li key={i} className="grid" style={{ gridTemplateColumns: '14px minmax(0,1fr)', gap: 6, fontSize: size, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)', marginTop: size * 0.6, display: 'block' }} />
          {b}
        </li>
      ))}
    </ul>
  );
}

export function SummaryBlock({ article, mode, size = 15 }: { article: NewsArticle; mode: SummaryMode; size?: number }) {
  const s = summaryLines(article, mode);
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {s.lead && (
        <p className={mode === 'headlines' ? 'line-clamp-2' : ''} style={{ margin: 0, fontSize: size, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {s.lead}
        </p>
      )}
      {s.bullets.length > 0 && <Bullets items={s.bullets} size={size} />}
      {s.why && (
        <p style={{ margin: 0, fontSize: size - 1, lineHeight: 1.55, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Why it matters: </strong>
          {s.why}
        </p>
      )}
    </div>
  );
}

export default function NewsCard({ article, onSave, variant = 'standard', figure, quote, rank, queue }: NewsCardProps) {
  const { openStory } = useStoryModal();
  const reading = useReading();
  const read = reading.log.some((e) => e.id === article._id);
  const slugs = resolveSlugs(article);
  const time = relativeTime(article.publishedAt);
  const names = sourceNames(article);
  const open = () => openStory(article, queue);
  const high = isHighImpact(article.importanceScore);
  const tone = topicTone(slugs[0]);

  const titleBtn = (size: number, extra?: React.CSSProperties) => (
    <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: size, lineHeight: 1.25, letterSpacing: '-0.01em', ...extra }}>
      <button type="button" onClick={open} aria-haspopup="dialog" className="text-left cursor-pointer" style={{ background: 'none', border: 0, padding: 0, margin: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', overflowWrap: 'anywhere' }}>
        {article.title}
      </button>
    </h3>
  );

  const kicker = (prefix?: string) => (
    <div className="kicker flex flex-wrap items-center" style={{ gap: 8 }}>
      {high && variant !== 'compact' && <HighImpact />}
      <span style={{ color: prefix ? tone : undefined }}>{prefix ? `${prefix} · ` : ''}{topicLabel(slugs) || article.source}</span>
      {time && (
        <>
          <span aria-hidden style={{ opacity: 0.5 }}>/</span>
          <span>{time.replace('about ', '')}</span>
        </>
      )}
      {variant === 'standard' && (
        <span className="sm:hidden" style={{ marginLeft: read ? undefined : 'auto' }}>
          <ImportanceBars score={article.importanceScore} vertical={false} />
        </span>
      )}
      {read && (
        <span style={{ marginLeft: 'auto' }}>
          <ReadBadge />
        </span>
      )}
    </div>
  );

  const shell: React.CSSProperties = {
    borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 12,
    opacity: read ? 0.62 : 1, transition: 'opacity 200ms ease', height: '100%', boxSizing: 'border-box',
  };
  const tinted = (c: string): React.CSSProperties => ({
    background: `color-mix(in srgb, ${c} 9%, var(--bg-surface))`,
    border: `1px solid color-mix(in srgb, ${c} 26%, var(--bg-surface))`,
  });

  if (variant === 'figure' && figure) {
    return (
      <article className="dx-rise" style={{ ...shell, ...tinted('var(--tone-business)') }}>
        {kicker('By the numbers')}
        <span aria-hidden style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(56px, 8vw, 84px)', lineHeight: 0.95, letterSpacing: '-0.04em', color: 'var(--tone-business)' }}>
          {figure}
        </span>
        {titleBtn(20)}
        {article.summary?.tldr && <p className="line-clamp-3" style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{article.summary.tldr}</p>}
        <div className="flex items-center gap-2 mt-auto" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}
          <span className="ml-auto"><CardActions article={article} onSave={onSave} /></span>
        </div>
      </article>
    );
  }

  if (variant === 'quote' && quote) {
    return (
      <article className="dx-rise" style={{ ...shell, ...tinted('var(--tone-politics)') }}>
        {kicker('The quote')}
        <blockquote style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(22px, 2.4vw, 27px)', lineHeight: 1.25 }}>
          <span aria-hidden style={{ color: 'var(--tone-politics)' }}>“</span>
          {cleanQuote(quote)}
          <span aria-hidden style={{ color: 'var(--tone-politics)' }}>”</span>
        </blockquote>
        {titleBtn(17, { color: 'var(--text-secondary)' })}
        <div className="flex items-center gap-2 mt-auto" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}
          <span className="ml-auto"><CardActions article={article} onSave={onSave} /></span>
        </div>
      </article>
    );
  }

  if (variant === 'compact') {
    return (
      <article className="dx-rise" style={{ ...shell, ...tinted(tone), padding: 18, gap: 8 }}>
        {kicker()}
        {titleBtn(17)}
        {article.summary?.tldr && <p className="line-clamp-2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{article.summary.tldr}</p>}
      </article>
    );
  }

  const img = safeImageUrl(article.imageUrl);
  return (
    <article
      className="dx-rise story-grid"
      style={{
        ...shell, display: 'grid', gap: 16,
        background: 'var(--bg-surface)', border: `1px solid ${high ? 'var(--hot-border)' : 'var(--border)'}`,
      }}
    >
      <div className="story-rank flex-col items-center" style={{ gap: 10, paddingTop: 2 }}>
        {rank !== undefined && (
          <span className="tabular-nums" style={{ fontFamily: 'var(--font-serif)', fontSize: 26, lineHeight: 1, color: 'var(--text-faint)' }}>
            {String(rank).padStart(2, '0')}
          </span>
        )}
        <ImportanceBars score={article.importanceScore} />
      </div>
      <div className="flex flex-col min-w-0" style={{ gap: 12 }}>
        {kicker()}
        <div className="flex gap-4">
          <div className="flex flex-col min-w-0 flex-1" style={{ gap: 12 }}>
            {titleBtn(23)}
            <SummaryBlock article={article} mode={reading.summaryMode} />
          </div>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img} alt="" width={132} height={99} loading="lazy" decoding="async" referrerPolicy="no-referrer"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              className="hidden sm:block shrink-0 object-cover"
              style={{ width: 132, height: 99, borderRadius: 12, background: 'var(--bg-elevated)' }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 10, paddingTop: 2 }}>
          <SourceStack names={names} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{names.length === 1 ? names[0] : `${names.length} sources`}</span>
          <div className="ml-auto flex items-center">
            <CardActions article={article} onSave={onSave} />
            <button
              type="button" onClick={open} aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5"
              style={{ height: 40, padding: '0 10px', borderRadius: 10, border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Full story <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
