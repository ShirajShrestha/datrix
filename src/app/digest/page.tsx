'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Check, ChevronRight, Flame, Play, Square } from 'lucide-react';
import type { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import { useStoryModal } from '@/components/StoryModalProvider';
import { sourceNames } from '@/components/NewsCard';
import { usePrefs, effectiveCategories } from '@/lib/prefs';
import { scopeCategories } from '@/lib/scope';
import { useHydrated } from '@/lib/useHydrated';
import { useReadingStats } from '@/lib/useReadingStats';
import { groupDigest, DIGEST_SIZE } from '@/lib/digest';
import { sixtySecondScript } from '@/lib/feedLayout';
import { relativeTime } from '@/lib/storyView';
import { pickDescription } from '@/lib/storyView';
import { useCanSpeak } from '@/lib/useClient';

export default function DigestPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const chosenKey = scopeCategories('global', effectiveCategories(prefs)).join(',');
  const stats = useReadingStats();
  const { openStory } = useStoryModal();

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/articles?limit=50&fresh=48&categories=${encodeURIComponent(chosenKey)}`, { signal: controller.signal });
        const data = await res.json();
        if (!controller.signal.aborted && data.success) setArticles(data.articles);
      } catch {
        /* aborted or offline: empty state below */
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [hydrated, chosenKey]);

  const sections = useMemo(() => groupDigest(articles), [articles]);
  const ordered = useMemo(() => sections.flatMap((s) => s.items.map((i) => i.article)), [sections]);
  const done = ordered.filter((a) => stats.readIds.has(a._id)).length;
  const total = ordered.length;
  const allDone = total > 0 && done === total;
  const next = ordered.find((a) => !stats.readIds.has(a._id));

  // Audio
  const [playing, setPlaying] = useState(false);
  const canSpeak = useCanSpeak();
  const utter = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);
  const toggleAudio = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(`Your daily digest. ${sixtySecondScript(ordered, DIGEST_SIZE)}`);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utter.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  return (
    <div>
      <div className="sticky top-[60px] lg:top-0 z-30" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center mx-auto" style={{ maxWidth: 1040, padding: '12px clamp(16px, 3vw, 24px)', gap: 14 }}>
          <Link href="/" className="hidden lg:inline-flex items-center gap-2" style={{ height: 40, color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>
            <ArrowLeft className="w-[18px] h-[18px]" aria-hidden /> Today
          </Link>
          <div className="flex items-center flex-1" style={{ gap: 12, minWidth: 180 }}>
            <div
              role="progressbar" aria-label="Digest progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total || DIGEST_SIZE}
              className="grid flex-1" style={{ gridTemplateColumns: `repeat(${total || DIGEST_SIZE}, minmax(0,1fr))`, gap: 4 }}
            >
              {(total ? ordered : Array.from({ length: DIGEST_SIZE })).map((a, i) => (
                <span key={i} style={{ height: 4, borderRadius: 2, display: 'block', background: a && stats.readIds.has((a as NewsArticle)._id) ? 'var(--accent)' : 'var(--border-highlight)', transition: 'background 300ms ease' }} />
              ))}
            </div>
            <span className="tabular-nums" style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{done} / {total || DIGEST_SIZE}</span>
          </div>
          {canSpeak && total > 0 && (
            <button
              type="button" onClick={toggleAudio} aria-pressed={playing}
              className="inline-flex items-center gap-2"
              style={{ height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-highlight)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              {playing ? <Square className="w-4 h-4" fill="currentColor" aria-hidden /> : <Play className="w-4 h-4" fill="currentColor" aria-hidden />}
              {playing ? 'Stop' : 'Listen'}
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto flex flex-col" style={{ maxWidth: 760, padding: '44px clamp(16px, 3vw, 24px) 96px', gap: 44 }}>
        <div className="flex flex-col" style={{ gap: 12 }}>
          <span className="kicker" style={{ fontSize: 12 }}>Daily digest · {stats.now ? format(stats.now, 'EEEE, MMMM d, yyyy') : ''}</span>
          <h1 style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            The {total || 'ten'} stories that matter today.
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
            About {Math.max(1, Math.round((total || DIGEST_SIZE) * 0.4))} minutes · ranked by importance · grouped by topic
          </p>
          {next && !allDone && (
            <button
              type="button" onClick={() => openStory(next, ordered)}
              className="inline-flex items-center gap-2 self-start"
              style={{ height: 48, marginTop: 8, padding: '0 20px', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {done === 0 ? 'Start reading' : 'Continue where you left off'} <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>

        {loading ? (
          <NewsGridSkeleton count={5} />
        ) : total === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No stories available yet.</p>
        ) : (
          sections.map((sec) => (
            <section key={sec.slug} aria-labelledby={`sec-${sec.slug}`} className="flex flex-col">
              <div className="flex items-center" style={{ gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--text-primary)' }}>
                <h2 id={`sec-${sec.slug}`} className="kicker" style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>{sec.label}</h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sec.items.length} {sec.items.length === 1 ? 'story' : 'stories'}</span>
              </div>
              {sec.items.map(({ n, article }) => {
                const read = stats.readIds.has(article._id);
                const names = sourceNames(article);
                const time = relativeTime(article.publishedAt);
                const line = article.summary?.tldr?.trim() || pickDescription(article);
                return (
                  <button
                    key={article._id} type="button" onClick={() => openStory(article, ordered)} aria-haspopup="dialog"
                    className="grid text-left"
                    style={{
                      gridTemplateColumns: '48px minmax(0,1fr) 24px', gap: 16, padding: '22px 0', border: 0, borderBottom: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', opacity: read ? 0.55 : 1, font: 'inherit',
                    }}
                  >
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-serif)', fontSize: 30, lineHeight: 1, color: read ? 'var(--text-faint)' : 'var(--accent)' }}>{n}</span>
                    <span className="flex flex-col min-w-0" style={{ gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{article.title}</span>
                      {line && <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{line}</span>}
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3}` : ''}{time ? ` · ${time.replace('about ', '')}` : ''}
                      </span>
                    </span>
                    <span style={{ paddingTop: 4, color: read ? 'var(--good)' : 'var(--text-faint)' }}>
                      {read ? <Check className="w-5 h-5" strokeWidth={2.4} aria-label="Read" /> : <ChevronRight className="w-5 h-5" aria-hidden />}
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}

        {total > 0 && (
          <section
            aria-live="polite"
            className={`flex flex-wrap items-center ${allDone ? 'dx-pop' : ''}`}
            style={{
              gap: 20, padding: 28, borderRadius: 20,
              background: allDone ? 'var(--amber-soft)' : 'var(--bg-surface)', border: `1px solid ${allDone ? 'var(--amber-border)' : 'var(--border)'}`,
            }}
          >
            <span style={{ width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: allDone ? 'var(--amber)' : 'var(--bg-elevated)', color: allDone ? 'var(--bg-base)' : 'var(--text-muted)' }}>
              {allDone ? <Flame className="w-7 h-7" fill="currentColor" aria-hidden /> : <Check className="w-6 h-6" aria-hidden />}
            </span>
            <div className="flex flex-col" style={{ flex: '1 1 240px', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24 }}>
                {allDone ? 'You’re all caught up.' : `${total - done} to go.`}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {allDone
                  ? `${stats.streak}-day streak${stats.bestStreak > stats.streak ? ` (best ${stats.bestStreak})` : ''}. ${prefs.notifyEnabled ? `Next digest at ${prefs.notifyTime}.` : 'Come back tomorrow for the next one.'}`
                  : 'Tap a story for its key points. Every one you open counts toward your daily goal.'}
              </span>
            </div>
            <Link href="/" style={{ height: 44, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border-highlight)', color: 'var(--text-primary)', fontSize: 14, textDecoration: 'none' }}>
              Browse all stories
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
