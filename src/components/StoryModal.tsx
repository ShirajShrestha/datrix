'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { ExternalLink, Bookmark, Share2, X } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { safeImageUrl } from '@/lib/freshness';
import { galleryImages, pickDescription, relativeTime, resolveSlugs, sourceLine, uniqueSourceNames } from '@/lib/storyView';
import {
  briefReducer, initialBriefState, interpretBriefResponse, shouldFetchBrief,
} from '@/lib/storyModalState';
import { SAVED_CHANGED_EVENT, isSavedId, toggleSavedStored } from '@/lib/savedArticles';
import type { NewsArticle } from '@/components/NewsCard';

interface Props {
  article: NewsArticle;
  onClose: () => void;
}

const label = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', fontWeight: 600 };

export default function StoryModal({ article, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevFocus = useRef<Element | null>(null);

  // Open as a true modal; restore focus and unlock scroll on unmount.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!prevFocus.current) prevFocus.current = document.activeElement;
    if (!dlg.open) dlg.showModal();
    document.body.classList.add('story-open');
    return () => {
      document.body.classList.remove('story-open');
      if (dlg.open) dlg.close();
      const el = prevFocus.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus();
    };
  }, []);

  // Images
  const [failed, setFailed] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const images = galleryImages(article).filter((u) => !failed.includes(u));
  const hero = images[Math.min(sel, images.length - 1)] ?? null;

  // Brief
  const [brief, dispatch] = useReducer(briefReducer, article, initialBriefState);
  const fetched = useRef(false);
  useEffect(() => {
    if (!shouldFetchBrief(brief) || fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/articles/${article._id}/brief`, { method: 'POST' });
        const json = await res.json().catch(() => null);
        dispatch(interpretBriefResponse(res.ok, json));
      } catch {
        dispatch({ type: 'error' });
      }
    })();
  }, [brief, article._id]);

  // Save / share
  const [saved, setSaved] = useState(() => isSavedId(article._id));
  useEffect(() => {
    const sync = () => setSaved(isSavedId(article._id));
    window.addEventListener(SAVED_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, sync);
  }, [article._id]);
  const share = () => {
    const url = safeImageUrl(article.url) ?? window.location.href;
    if (navigator.share) navigator.share({ title: article.title, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).catch(() => {});
  };

  const slugs = resolveSlugs(article);
  const primaryCat = slugs.length ? getCategory(slugs[0]) : undefined;
  const time = relativeTime(article.publishedAt);
  const description = pickDescription(article);
  const readUrl = safeImageUrl(article.url);

  const all = Array.isArray(article.sources) && article.sources.length
    ? article.sources
    : [{ name: article.source, url: article.url }];
  const { shown, extra } = sourceLine(all, article.source);
  const fullList = uniqueSourceNames(all, article.source).join(', ');

  const iconBtn = 'p-2 rounded-md transition-all text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]';

  return (
    <dialog
      ref={dialogRef}
      className="story-dialog"
      aria-labelledby="story-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="story-body" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
        <div className="relative w-full" style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--bg-elevated)' }}>
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onError={() => setFailed((f) => [...f, hero])}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl" aria-hidden="true">
              {primaryCat?.emoji ?? '📰'}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story"
            className="absolute top-3 right-3 p-2 rounded-full"
            style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <h2 id="story-title" className="font-serif break-words" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>
            {article.title}
          </h2>

          <div className="flex items-center flex-wrap mb-4" style={{ gap: 6 }}>
            {slugs.slice(0, 3).map((slug) => {
              const def = getCategory(slug);
              return (
                <span
                  key={slug}
                  style={{ borderColor: def?.color, color: def?.color }}
                  className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded border"
                >
                  <span aria-hidden="true">{def?.emoji}</span> {def?.label ?? slug}
                </span>
              );
            })}
            {time && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{time}</span>}
          </div>

          {images.length >= 2 && (
            <div className="flex gap-2 mb-4" role="group" aria-label="Story images">
              {images.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setSel(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={u === hero}
                  className="relative overflow-hidden rounded-md shrink-0"
                  style={{
                    width: 64, height: 40,
                    border: `2px solid ${u === hero ? 'var(--accent-brand)' : 'var(--border)'}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() => setFailed((f) => [...f, u])}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mb-4" style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }} aria-live="polite">
            {brief.status === 'loading' && (
              <div aria-busy="true" aria-label="Loading brief">
                <div className="skeleton rounded mb-2" style={{ height: 14, width: '95%' }} />
                <div className="skeleton rounded mb-2" style={{ height: 14, width: '88%' }} />
                <div className="skeleton rounded mb-2" style={{ height: 14, width: '92%' }} />
                <div className="skeleton rounded" style={{ height: 14, width: '60%' }} />
              </div>
            )}
            {brief.status === 'ready' && (
              <>
                <p style={{ color: 'var(--text-primary)', marginBottom: 12 }}>{brief.brief.whatHappened}</p>
                {brief.brief.whyItMatters && (
                  <div className="mb-3">
                    <div style={label}>Why it matters</div>
                    <p>{brief.brief.whyItMatters}</p>
                  </div>
                )}
                {brief.brief.background && (
                  <div className="mb-3">
                    <div style={label}>Background</div>
                    <p>{brief.brief.background}</p>
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI-written from the outlets&apos; own summaries</p>
              </>
            )}
            {brief.status === 'fallback' && <p>{brief.text}</p>}
            {(brief.status === 'error' || brief.status === 'none') && (
              <>
                {(description || article.summary?.tldr) && <p>{description || article.summary?.tldr}</p>}
                {brief.status === 'error' && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Couldn&apos;t load the brief</p>
                )}
              </>
            )}
          </div>

          <p
            title={fullList}
            style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 16 }}
          >
            {shown.length <= 1 && extra === 0 ? 'Source: ' : 'Also covered by '}
            {shown.map((s, i) => {
              const href = safeImageUrl(s.url);
              return (
                <span key={s.name}>
                  {i > 0 && ' · '}
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </span>
              );
            })}
            {extra > 0 && ` +${extra}`}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {readUrl && (
              <a
                href={readUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
                style={{ backgroundColor: 'var(--accent-brand)', color: 'var(--bg-surface)' }}
              >
                Read original at {article.source}
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => toggleSavedStored(article)}
              aria-label={saved ? 'Remove bookmark' : 'Bookmark article'}
              aria-pressed={saved}
              className={`${iconBtn} ${saved ? '!text-[var(--accent-brand)]' : ''}`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            </button>
            <button type="button" onClick={share} aria-label="Share article" className={iconBtn}>
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
