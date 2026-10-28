'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import NewsCard, { type NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import { CaughtUp, DesktopTopBar, LeadStory, SixtySeconds, ScopeToggle, TopicChips, greeting } from '@/components/today';
import { DietCard, StreakCard } from '@/components/ReadingRail';
import { SectionHeader, SummaryToggle } from '@/components/ui';
import { usePrefs, effectiveCategories, usePreviousVisit } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';
import { useReadingStats } from '@/lib/useReadingStats';
import { buildFeedLayout } from '@/lib/feedLayout';
import { isNewSince } from '@/lib/freshness';
import { resolveSlugs } from '@/lib/storyView';
import { parseScope, scopeCategories, type Scope } from '@/lib/scope';

const SCOPE_KEY = 'datrix_scope';

export default function Today() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState('all');
  const [showMore, setShowMore] = useState(false);

  const [scope, setScope] = useState<Scope>('global');
  const [scopeReady, setScopeReady] = useState(false);

  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const chosenKey = scopeCategories(scope, effectiveCategories(prefs)).join(',');
  const stats = useReadingStats();
  const previousVisit = usePreviousVisit();

  // Read the saved scope once, right after hydration (adjusting state during render).
  if (hydrated && !scopeReady) {
    let saved: Scope = 'global';
    try {
      saved = parseScope(localStorage.getItem(SCOPE_KEY));
    } catch {
      /* storage unavailable: stay global */
    }
    setScope(saved);
    setScopeReady(true);
  }

  const changeScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    setTopic('all');
    setShowMore(false);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* storage unavailable: choice just won't persist */
    }
  };

  useEffect(() => {
    if (!hydrated || !scopeReady) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/articles?limit=80&fresh=48&categories=${encodeURIComponent(chosenKey)}`, { signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (data.success) setArticles(data.articles);
        else setFailed(true);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setFailed(true);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [hydrated, scopeReady, chosenKey]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) {
      const s = resolveSlugs(a)[0];
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()].map(([slug, n]) => ({ slug, n })).sort((a, b) => b.n - a.n);
  }, [articles]);

  const activeTopic = topic === 'all' || counts.some((c) => c.slug === topic) ? topic : 'all';
  const visible = useMemo(
    () => (activeTopic === 'all' ? articles : articles.filter((a) => resolveSlugs(a).includes(activeTopic))),
    [articles, activeTopic],
  );
  const layout = useMemo(() => buildFeedLayout(visible), [visible]);
  const queue = visible;
  const newCount = hydrated ? articles.filter((a) => isNewSince(a.publishedAt, previousVisit)).length : 0;
  const remaining = Math.max(0, stats.goal - stats.today);
  const now = stats.now ? new Date(stats.now) : null;

  return (
    <div style={{ padding: '0 clamp(16px, 3vw, 40px) 64px' }}>
      <DesktopTopBar streak={stats.streak} today={stats.today} goal={stats.goal} mode={stats.reading.summaryMode} />

      <div className="flex flex-wrap" style={{ gap: 40, paddingTop: 28 }}>
        <div className="flex flex-col min-w-0" style={{ flex: '999 1 560px', gap: 24 }}>
          <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
            <div className="flex flex-col" style={{ gap: 6 }}>
              <span className="kicker" style={{ fontSize: 12 }}>{now ? format(now, 'EEEE, MMMM d') : ' '}</span>
              <h1 style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(32px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {now ? greeting(now.getHours()) : 'Today'}
              </h1>
            </div>
            <span className="ml-auto" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {!hydrated ? '' : stats.goalMet ? 'Daily goal reached' : `${remaining} more ${remaining === 1 ? 'story' : 'stories'} to hit today’s goal`}
              {newCount > 0 && <span style={{ marginLeft: 10, color: 'var(--accent)' }}>· {newCount} new since your last visit</span>}
            </span>
          </div>

          <ScopeToggle scope={scope} onChange={changeScope} />

          <div className="lg:hidden">
            <SummaryToggle mode={stats.reading.summaryMode} full />
          </div>

          {loading ? (
            <NewsGridSkeleton count={4} />
          ) : failed ? (
            <div className="text-center" style={{ padding: '48px 0', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0 }}>Couldn’t load today’s stories.</p>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>Check your connection and refresh.</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center" style={{ padding: '48px 0', color: 'var(--text-muted)' }}>{scope === 'local' ? 'No Nepal stories yet. The next refresh will bring some in.' : 'No stories yet. The next refresh will bring some in.'}</div>
          ) : (
            <>
              {layout.lead && <LeadStory article={layout.lead} queue={queue} reading={stats.reading} />}
              {activeTopic === 'all' && <SixtySeconds articles={articles} />}
              <TopicChips counts={counts} selected={activeTopic} onSelect={(s) => { setTopic(s); setShowMore(false); }} />

              {layout.keepUp.length > 0 && (
                <>
                  <SectionHeader title="Keep up" meta={`${layout.keepUp.length} stories`} />
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gridAutoFlow: 'row dense', gap: 14 }}>
                    {layout.keepUp.map((it, i) => (
                      <div key={it.article._id} style={{ gridColumn: it.wide ? '1 / -1' : undefined }}>
                        <NewsCard article={it.article} variant={it.variant} figure={it.figure} quote={it.quote} rank={i + 2} queue={queue} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {hydrated && <CaughtUp today={stats.today} goal={stats.goal} streak={stats.streak} remaining={remaining} />}

              {layout.quickHits.length > 0 && (
                <>
                  <SectionHeader title="Quick hits" meta="One line each" />
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                    {layout.quickHits.map((a) => <NewsCard key={a._id} article={a} variant="compact" queue={queue} />)}
                  </div>
                </>
              )}

              {layout.more.length > 0 && (
                showMore ? (
                  <div className="flex flex-col" style={{ gap: 12 }}>
                    <SectionHeader title="Everything else" meta={`${layout.more.length} stories`} />
                    {layout.more.map((a) => <NewsCard key={a._id} article={a} queue={queue} />)}
                  </div>
                ) : (
                  <button
                    type="button" onClick={() => setShowMore(true)}
                    style={{ height: 48, borderRadius: 14, border: '1px dashed var(--border-highlight)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}
                  >
                    Show {layout.more.length} more stories
                  </button>
                )
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col" style={{ flex: '1 1 280px', maxWidth: 360, gap: 18 }} aria-label="Your reading">
          {hydrated && <StreakCard stats={stats} />}
          {hydrated && <DietCard stats={stats} />}
        </aside>
      </div>
    </div>
  );
}
