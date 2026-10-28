'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Play, Square, ArrowRight, Check, Sparkles } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import type { Scope } from '@/lib/scope';
import { safeImageUrl } from '@/lib/freshness';
import { relativeTime, resolveSlugs } from '@/lib/storyView';
import { sixtySecondScript } from '@/lib/feedLayout';
import { useStoryModal } from '@/components/StoryModalProvider';
import NewsCard, { CardActions, SummaryBlock, sourceNames, type NewsArticle } from '@/components/NewsCard';
import {
  GoalRing, HighImpact, ReactionRow, SourceStack, StreakChip, SummaryToggle, TopicDot, isHighImpact, topicLabel, topicTone,
} from '@/components/ui';
import type { ReadingState } from '@/lib/reading';
import { useCanSpeak } from '@/lib/useClient';

export function greeting(hour: number): string {
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export function DesktopTopBar({ streak, today, goal, mode }: { streak: number; today: number; goal: number; mode: ReadingState['summaryMode'] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <header className="hidden lg:flex flex-wrap items-center" style={{ gap: 12, padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="flex items-center"
        style={{ flex: '1 1 260px', maxWidth: 460, gap: 10, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', color: 'var(--text-faint)' }}
      >
        <Search className="w-[18px] h-[18px]" aria-hidden />
        <label htmlFor="top-search" className="sr-only">Search news</label>
        <input
          id="top-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories, people, places…"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: 14 }}
        />
      </form>
      <div className="ml-auto flex items-center" style={{ gap: 10 }}>
        <StreakChip streak={streak} />
        <GoalRing value={today} goal={goal} />
        <SummaryToggle mode={mode} />
      </div>
    </header>
  );
}

/** A quiet topic graphic used when a lead story has no usable image. */
function TopicArt({ slug }: { slug?: string }) {
  const tone = topicTone(slug);
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ background: `color-mix(in srgb, ${tone} 7%, var(--bg-surface))` }}>
      {[420, 300, 190].map((d, i) => (
        <span
          key={d}
          style={{
            position: 'absolute', right: -d / 3, top: '50%', width: d, height: d, marginTop: -d / 2, borderRadius: 999,
            border: i < 2 ? `1px solid color-mix(in srgb, ${tone} ${22 + i * 10}%, transparent)` : 0,
            background: i === 2 ? `color-mix(in srgb, ${tone} 16%, transparent)` : 'transparent',
          }}
        />
      ))}
      <span className="dx-pulse" style={{ position: 'absolute', right: 60, top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 99, background: tone, opacity: 0.85 }} />
      <span className="kicker" style={{ position: 'absolute', left: 20, bottom: 16, color: tone }}>{getCategory(slug ?? '')?.label ?? 'Top story'}</span>
    </div>
  );
}

export function LeadStory({ article, queue, reading }: { article: NewsArticle; queue: NewsArticle[]; reading: ReadingState }) {
  const { openStory } = useStoryModal();
  const slugs = resolveSlugs(article);
  const names = sourceNames(article);
  const img = safeImageUrl(article.imageUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const time = relativeTime(article.publishedAt);
  const high = isHighImpact(article.importanceScore);
  const read = reading.log.some((e) => e.id === article._id);
  return (
    <article
      className="dx-rise flex flex-wrap overflow-hidden"
      style={{ borderRadius: 24, background: 'var(--bg-surface)', border: `1px solid ${high ? 'var(--hot-border)' : 'var(--border)'}` }}
    >
      <button
        type="button" onClick={() => openStory(article, queue)} aria-label={`Open lead story: ${article.title}`}
        className="relative"
        style={{ flex: '1 1 300px', minHeight: 'clamp(170px, 26vw, 320px)', padding: 0, border: 0, cursor: 'pointer', background: 'var(--bg-elevated)' }}
      >
        {img && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" referrerPolicy="no-referrer" decoding="async" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <TopicArt slug={slugs[0]} />
        )}
        <span className="kicker" style={{ position: 'absolute', top: 14, left: 14, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
          Lead story
        </span>
      </button>
      <div className="flex flex-col" style={{ flex: '999 1 360px', padding: 26, gap: 14, opacity: read ? 0.7 : 1 }}>
        <div className="kicker flex flex-wrap items-center" style={{ gap: 8 }}>
          {high && <HighImpact pulse />}
          <span>{topicLabel(slugs) || article.source}</span>
          {time && <><span aria-hidden style={{ opacity: 0.5 }}>/</span><span>{time.replace('about ', '')}</span></>}
          {read && <span className="inline-flex items-center gap-1 ml-auto" style={{ color: 'var(--good)' }}><Check className="w-3.5 h-3.5" aria-hidden />Read</span>}
        </div>
        <h2 style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(26px, 3vw, 34px)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
          <button type="button" onClick={() => openStory(article, queue)} aria-haspopup="dialog" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            {article.title}
          </button>
        </h2>
        <SummaryBlock article={article} mode={reading.summaryMode} />
        <div className="flex flex-wrap items-center mt-auto" style={{ gap: 10, paddingTop: 4 }}>
          <SourceStack names={names} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{names.length > 1 ? `${names.length} sources` : names[0]}</span>
          <span className="ml-auto"><CardActions article={article} /></span>
        </div>
        <ReactionRow id={article._id} current={reading.reactions[article._id]} />
      </div>
    </article>
  );
}

/** "Today in 60 seconds": the top headlines with one line each, readable or spoken by the browser. */
export function SixtySeconds({ articles }: { articles: NewsArticle[] }) {
  const [playing, setPlaying] = useState(false);
  const supported = useCanSpeak();
  const utter = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);
  const top = articles.slice(0, 3);
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (playing) {
      synth.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(`Today in sixty seconds. ${sixtySecondScript(articles)}`);
    u.rate = 1.05;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utter.current = u;
    synth.cancel();
    synth.speak(u);
    setPlaying(true);
  };
  if (!top.length) return null;
  return (
    <section aria-labelledby="sixty-h" className="flex flex-col" style={{ gap: 14, padding: 22, borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
        {supported && (
          <button
            type="button" onClick={toggle} aria-label={playing ? 'Stop audio brief' : 'Play audio brief'} aria-pressed={playing}
            style={{ width: 44, height: 44, borderRadius: 99, border: 0, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {playing ? <Square className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
        )}
        <div className="flex flex-col">
          <h2 id="sixty-h" className="flex items-center gap-2" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} aria-hidden /> Today in 60 seconds
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{playing ? 'Playing…' : supported ? 'Read it or listen' : 'The three biggest stories, one line each'}</span>
        </div>
        <Link
          href="/digest" className="ml-auto inline-flex items-center gap-2"
          style={{ height: 40, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-highlight)', color: 'var(--text-primary)', fontSize: 13, textDecoration: 'none' }}
        >
          Full digest <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
      <ol className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 10 }}>
        {top.map((a, i) => (
          <li key={a._id} className="grid" style={{ gridTemplateColumns: '24px minmax(0,1fr)', gap: 8 }}>
            <span className="font-mono tabular-nums" style={{ fontSize: 12, color: 'var(--accent)', paddingTop: 4 }}>{i + 1}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.45 }}>
              {a.summary?.tldr?.trim() || a.title}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TopicChips({
  counts, selected, onSelect,
}: { counts: { slug: string; n: number }[]; selected: string; onSelect: (s: string) => void }) {
  const chip = (on: boolean): React.CSSProperties => ({
    flex: 'none', height: 36, padding: '0 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${on ? 'var(--text-primary)' : 'var(--border-highlight)'}`,
    background: on ? 'var(--text-primary)' : 'transparent', color: on ? 'var(--bg-base)' : 'var(--text-secondary)',
    fontWeight: on ? 500 : 400, display: 'inline-flex', alignItems: 'center', gap: 6,
  });
  return (
    <div role="group" aria-label="Filter by topic" className="flex gap-2 overflow-x-auto no-scrollbar" style={{ margin: '0 -16px', padding: '0 16px' }}>
      <button type="button" aria-pressed={selected === 'all'} onClick={() => onSelect('all')} style={chip(selected === 'all')}>All stories</button>
      {counts.map(({ slug, n }) => (
        <button key={slug} type="button" aria-pressed={selected === slug} onClick={() => onSelect(slug)} style={chip(selected === slug)}>
          {selected !== slug && <TopicDot slug={slug} size={7} />}
          {getCategory(slug)?.label ?? slug}
          <span style={{ opacity: 0.65 }}>{n}</span>
        </button>
      ))}
    </div>
  );
}

export function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const seg = (on: boolean): React.CSSProperties => ({
    height: 32, padding: '0 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer', border: 'none',
    background: on ? 'var(--text-primary)' : 'transparent', color: on ? 'var(--bg-base)' : 'var(--text-secondary)',
    fontWeight: on ? 500 : 400,
  });
  return (
    <div role="group" aria-label="Story scope" style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 2, padding: 2, borderRadius: 99, border: '1px solid var(--border-highlight)' }}>
      <button type="button" aria-pressed={scope === 'global'} onClick={() => onChange('global')} style={seg(scope === 'global')}>Global</button>
      <button type="button" aria-pressed={scope === 'local'} onClick={() => onChange('local')} style={seg(scope === 'local')}>Local · Nepal</button>
    </div>
  );
}

export function CaughtUp({ today, goal, streak, remaining }: { today: number; goal: number; streak: number; remaining: number }) {
  const met = today >= goal;
  return (
    <div className="flex flex-wrap items-center" style={{ gap: 16, padding: '20px 22px', borderRadius: 20, border: '1px dashed var(--border-highlight)' }}>
      <span className={met ? 'dx-pop' : ''} style={{ width: 44, height: 44, borderRadius: 99, background: met ? 'var(--good-soft)' : 'var(--bg-elevated)', color: met ? 'var(--good)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check className="w-[22px] h-[22px]" strokeWidth={2.4} aria-hidden />
      </span>
      <div className="flex flex-col" style={{ flex: '1 1 240px', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{met ? 'Goal reached. You’re up to speed.' : 'That’s the essentials for today.'}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {met
            ? streak > 1 ? `${streak}-day streak. Anything below is optional.` : 'Come back tomorrow to start a streak.'
            : `Read ${remaining} more to hit today’s goal${streak > 0 ? ` and keep your ${streak}-day streak` : ''}. Or stop here.`}
        </span>
      </div>
    </div>
  );
}

export { NewsCard };
