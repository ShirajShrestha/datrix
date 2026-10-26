'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { ExternalLink, Bookmark, Share2, X, ArrowRight, Sparkles } from 'lucide-react';
import { safeImageUrl } from '@/lib/freshness';
import { galleryImages, relativeTime, resolveSlugs } from '@/lib/storyView';
import { briefReducer, initialBriefState, interpretBriefResponse, shouldFetchBrief } from '@/lib/storyModalState';
import { SAVED_CHANGED_EVENT, isSavedId, toggleSavedStored } from '@/lib/savedArticles';
import { outletInitials } from '@/lib/feedLayout';
import { useReading } from '@/lib/reading';
import { shareArticle, sourceNames, summaryLines, type NewsArticle } from '@/components/NewsCard';
import { HighImpact, ReactionRow, SourceStack, SummaryToggle, isHighImpact, topicLabel } from '@/components/ui';

interface Props {
  article: NewsArticle;
  onClose: () => void;
  onNext?: () => void;
  nextTitle?: string;
  position?: { index: number; total: number };
}

const sectionLabel: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 };

export default function StoryModal({ article, onClose, onNext, nextTitle, position }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const reading = useReading();
  const mode = reading.summaryMode;

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

  // "J" steps to the next story while the reader is open (ignored while typing).
  useEffect(() => {
    if (!onNext) return;
    const dlg = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'j' || e.key === 'J') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNext();
      }
    };
    dlg?.addEventListener('keydown', onKey);
    return () => dlg?.removeEventListener('keydown', onKey);
  }, [onNext]);

  // Images
  const [failed, setFailed] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const images = galleryImages(article).filter((u) => !failed.includes(u));
  const hero = images[Math.min(sel, images.length - 1)] ?? null;

  // Brief (detailed, AI-written from all outlets). Fetched once when the reader opens, as before.
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

  const [saved, setSaved] = useState(() => isSavedId(article._id));
  useEffect(() => {
    const sync = () => setSaved(isSavedId(article._id));
    window.addEventListener(SAVED_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, sync);
  }, [article._id]);

  const slugs = resolveSlugs(article);
  const time = relativeTime(article.publishedAt);
  const readUrl = safeImageUrl(article.url);
  const names = sourceNames(article);
  const all = Array.isArray(article.sources) && article.sources.length ? article.sources : [{ name: article.source, url: article.url }];
  const coverage = names.map((n) => all.find((s) => s.name.trim().toLowerCase() === n.toLowerCase()) ?? { name: n, url: '' });

  const s = summaryLines(article, mode === 'detailed' ? 'key' : mode);
  const shortVersion = s.bullets.length ? s.bullets : s.lead ? [s.lead] : [];
  const why = brief.status === 'ready' ? brief.brief.whyItMatters ?? article.summary?.whyItMatters : article.summary?.whyItMatters;

  const btn: React.CSSProperties = {
    height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-highlight)', background: 'transparent',
    color: 'var(--text-primary)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  };

  return (
    <dialog
      ref={dialogRef}
      className="story-dialog"
      aria-labelledby="story-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        // StrictMode re-mount: cleanup's close() fires a late 'close' after re-showModal().
        if (!dialogRef.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="story-body" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        {/* Top bar */}
        <div
          className="flex items-center gap-2 sticky top-0 z-10"
          style={{ padding: '10px 12px 10px 20px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {position && position.total > 1 ? `Story ${position.index} of ${position.total}` : 'Story'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button" onClick={() => toggleSavedStored(article)} aria-label={saved ? 'Remove from saved' : 'Save story'} aria-pressed={saved}
              style={{ width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', cursor: 'pointer', color: saved ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bookmark className="w-[18px] h-[18px]" fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button" onClick={() => shareArticle(article)} aria-label="Share story"
              style={{ width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Share2 className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button" onClick={onClose} aria-label="Close story"
              style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border-highlight)', background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <article className="flex flex-col" style={{ padding: '24px 20px 28px', gap: 24 }}>
          <header className="flex flex-col" style={{ gap: 14 }}>
            <div className="kicker flex flex-wrap items-center" style={{ gap: 8, fontSize: 12 }}>
              {isHighImpact(article.importanceScore) && <HighImpact pulse />}
              <span>{topicLabel(slugs, 3) || article.source}</span>
              {time && (
                <>
                  <span aria-hidden style={{ opacity: 0.5 }}>/</span>
                  <span>{time}</span>
                </>
              )}
            </div>
            <h2 id="story-title" style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(28px, 4.4vw, 40px)', lineHeight: 1.12, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
              {article.title}
            </h2>
            <div className="flex flex-wrap items-center" style={{ gap: 10, fontSize: 14, color: 'var(--text-muted)' }}>
              <SourceStack names={names} size={28} />
              {names.length > 1 ? `Summarised from ${names.length} sources` : `From ${names[0]}`}
            </div>
          </header>

          <SummaryToggle mode={mode} full />

          {mode === 'headlines' ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 21, lineHeight: 1.5 }}>{s.lead ?? article.title}</p>
          ) : (
            <section aria-labelledby="short-h" className="flex flex-col" style={{ gap: 14, padding: 22, borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h3 id="short-h" className="flex items-center gap-2" style={{ ...sectionLabel, color: 'var(--accent)', fontWeight: 500 }}>
                <Sparkles className="w-4 h-4" aria-hidden /> The short version
              </h3>
              <ol className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 12 }}>
                {shortVersion.map((b, i) => (
                  <li key={i} className="grid" style={{ gridTemplateColumns: '28px minmax(0,1fr)', gap: 8, fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.5 }}>
                    <span className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--text-faint)', paddingTop: 6 }}>{String(i + 1).padStart(2, '0')}</span>
                    {b}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {mode !== 'headlines' && why && (
            <section className="grid" style={{ gridTemplateColumns: '4px minmax(0,1fr)', gap: 16 }}>
              <span aria-hidden style={{ borderRadius: 99, background: 'var(--border-highlight)' }} />
              <div className="flex flex-col" style={{ gap: 4 }}>
                <h3 style={sectionLabel}>Why it matters</h3>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{why}</p>
              </div>
            </section>
          )}

          {mode === 'detailed' && (
            <section className="flex flex-col" style={{ gap: 10 }} aria-live="polite">
              <h3 style={sectionLabel}>In detail</h3>
              {brief.status === 'loading' && (
                <div aria-busy="true" aria-label="Loading the detailed brief">
                  {[95, 88, 92, 60].map((w) => <div key={w} className="skeleton rounded mb-2" style={{ height: 14, width: `${w}%` }} />)}
                </div>
              )}
              {brief.status === 'ready' && (
                <>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>{brief.brief.whatHappened}</p>
                  {brief.brief.background && (
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                      <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Background: </strong>{brief.brief.background}
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>AI-written from the outlets&apos; own summaries</p>
                </>
              )}
              {brief.status === 'fallback' && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>{brief.text}</p>}
              {(brief.status === 'error' || brief.status === 'none') && (
                <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
                  {brief.status === 'error' ? 'Couldn’t load the detailed brief right now.' : 'No detailed brief for this story yet.'}
                </p>
              )}
            </section>
          )}

          {hero && (
            <figure style={{ margin: 0 }} className="flex flex-col gap-2">
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9', borderRadius: 16, background: 'var(--bg-elevated)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailed((f) => [...f, hero])} className="absolute inset-0 w-full h-full object-cover" />
              </div>
              {images.length >= 2 && (
                <div className="flex gap-2" role="group" aria-label="Story images">
                  {images.map((u, i) => (
                    <button
                      key={u} type="button" onClick={() => setSel(i)} aria-label={`Show image ${i + 1}`} aria-pressed={u === hero}
                      className="relative overflow-hidden shrink-0"
                      style={{ width: 64, height: 44, borderRadius: 8, border: `2px solid ${u === hero ? 'var(--accent)' : 'var(--border)'}`, padding: 0, cursor: 'pointer' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed((f) => [...f, u])} className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </figure>
          )}

          <section className="flex flex-col" style={{ gap: 10 }}>
            <h3 style={sectionLabel}>Was this useful?</h3>
            <ReactionRow id={article._id} current={reading.reactions[article._id]} />
          </section>

          <section aria-labelledby="cov-h" className="flex flex-col">
            <h3 id="cov-h" style={{ ...sectionLabel, paddingBottom: 8 }}>Coverage · {coverage.length} {coverage.length === 1 ? 'source' : 'sources'}</h3>
            {coverage.map((src) => {
              const href = safeImageUrl(src.url);
              const inner = (
                <>
                  <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {outletInitials(src.name)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{src.name}</span>
                  {href && <ExternalLink className="w-4 h-4 ml-auto" style={{ color: 'var(--text-faint)' }} aria-hidden />}
                </>
              );
              const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, minHeight: 54, borderTop: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none' };
              return href ? (
                <a key={src.name} href={href} target="_blank" rel="noopener noreferrer" style={rowStyle} aria-label={`Read at ${src.name} (opens in new tab)`}>{inner}</a>
              ) : (
                <div key={src.name} style={rowStyle}>{inner}</div>
              );
            })}
          </section>
        </article>

        {/* Bottom actions */}
        <div className="sticky bottom-0 flex gap-2.5" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
          {readUrl && (
            <a href={readUrl} target="_blank" rel="noopener noreferrer" style={{ ...btn, height: 48, flex: 1, justifyContent: 'center', borderRadius: 12, textDecoration: 'none', fontSize: 14 }}>
              Read at {article.source} <ExternalLink className="w-4 h-4" aria-hidden />
            </a>
          )}
          {onNext ? (
            <button
              type="button" onClick={onNext} title={nextTitle ? `Next: ${nextTitle}` : undefined}
              style={{ ...btn, height: 48, flex: 1, justifyContent: 'center', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600, fontSize: 14 }}
            >
              Next story <ArrowRight className="w-4 h-4" aria-hidden />
              <span className="hidden sm:inline font-mono" style={{ fontSize: 11, opacity: 0.7, border: '1px solid currentColor', borderRadius: 5, padding: '0 5px' }}>J</span>
            </button>
          ) : (
            <button type="button" onClick={onClose} style={{ ...btn, height: 48, flex: 1, justifyContent: 'center', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600, fontSize: 14 }}>
              Done
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
