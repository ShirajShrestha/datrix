'use client';

import { Flame, Check } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { outletInitials } from '@/lib/feedLayout';
import { setSummaryMode, react, type Reaction, type SummaryMode } from '@/lib/reading';

/** 1–5 bars from an importance score in [0, 1]. */
export function importanceLevel(score: number): number {
  if (!Number.isFinite(score)) return 1;
  return Math.max(1, Math.min(5, Math.round(score * 5)));
}

export const isHighImpact = (score: number) => score >= 0.75;

export function ImportanceBars({ score, vertical = true }: { score: number; vertical?: boolean }) {
  const level = importanceLevel(score);
  const hot = isHighImpact(score);
  return (
    <span
      role="img"
      aria-label={`Importance ${level} of 5`}
      className="inline-flex"
      style={{ flexDirection: vertical ? 'column-reverse' : 'row', gap: 3, alignItems: 'flex-end' }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            display: 'block',
            width: vertical ? 16 : 3,
            height: vertical ? 4 : 10,
            borderRadius: 2,
            background: i <= level ? (hot ? 'var(--hot)' : 'var(--accent)') : 'var(--border-highlight)',
          }}
        />
      ))}
    </span>
  );
}

export function HighImpact({ pulse = false }: { pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--hot)' }}>
      <span className={pulse ? 'dx-pulse' : ''} style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hot)', display: 'block' }} />
      High impact
    </span>
  );
}

export function topicLabel(slugs: string[], max = 2): string {
  return slugs
    .slice(0, max)
    .map((s) => getCategory(s)?.label.replace(' & Economy', '').replace(' & Culture', '').replace(' & Justice', '') ?? s)
    .join(' · ');
}

export function topicTone(slug: string | undefined): string {
  return (slug && getCategory(slug)?.color) || 'var(--tone-other)';
}

export function TopicDot({ slug, size = 8 }: { slug?: string; size?: number }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: 3, background: topicTone(slug), display: 'block', flexShrink: 0 }} />;
}

export function SourceStack({ names, size = 26, max = 4 }: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <span className="inline-flex" aria-hidden>
      {shown.map((n, i) => (
        <span
          key={`${n}-${i}`}
          title={n}
          style={{
            width: size, height: size, marginRight: i === shown.length - 1 ? 0 : -4, borderRadius: 99,
            background: 'var(--bg-raised)', border: '2px solid var(--bg-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size < 26 ? 7.5 : 8.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0, overflow: 'hidden',
          }}
        >
          {outletInitials(n)}
        </span>
      ))}
    </span>
  );
}

export function StreakChip({ streak, compact = false }: { streak: number; compact?: boolean }) {
  return (
    <span
      aria-label={`${streak}-day reading streak`}
      title={`${streak}-day reading streak`}
      className="inline-flex items-center gap-1.5 shrink-0"
      style={{
        height: 44, padding: compact ? '0 10px' : '0 14px', borderRadius: 12,
        border: '1px solid var(--amber-border)', background: 'var(--amber-soft)', color: 'var(--amber)',
        fontSize: 15, fontWeight: 600,
      }}
    >
      <Flame className="w-[18px] h-[18px]" fill="currentColor" strokeWidth={1.5} aria-hidden />
      <span className="tabular-nums">{streak}</span>
    </span>
  );
}

export function GoalRing({ value, goal, size = 30, label = true }: { value: number; goal: number; size?: number; label?: boolean }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const met = value >= goal;
  return (
    <span
      className="inline-flex items-center gap-2.5 shrink-0"
      aria-label={`Daily goal: ${Math.min(value, goal)} of ${goal} stories`}
      title={`Daily goal: ${Math.min(value, goal)} of ${goal}`}
      style={label ? { height: 44, padding: '0 14px 0 8px', borderRadius: 12, border: '1px solid var(--border-highlight)', background: 'var(--bg-surface)', fontSize: 13 } : undefined}
    >
      <svg aria-hidden width={size} height={size} viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border-highlight)" strokeWidth="4" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={met ? 'var(--good)' : 'var(--accent)'} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 18 18)" style={{ transition: 'stroke-dasharray 400ms ease' }}
        />
        {met && <path d="M12 18.5l4 4 8-9" fill="none" stroke="var(--good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {label && <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{Math.min(value, goal)} / {goal} today</span>}
    </span>
  );
}

const MODE_LABELS: [SummaryMode, string][] = [['headlines', 'Headlines'], ['key', 'Key points'], ['detailed', 'Detailed']];

export function SummaryToggle({ mode, full = false }: { mode: SummaryMode; full?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Summary length"
      className={full ? 'grid grid-cols-3' : 'inline-flex'}
      style={{ padding: 3, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)' }}
    >
      {MODE_LABELS.map(([m, l]) => {
        const on = m === mode;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            onClick={() => setSummaryMode(m)}
            style={{
              height: 36, padding: '0 12px', border: 0, borderRadius: 9, fontSize: 13, cursor: 'pointer',
              background: on ? 'var(--bg-raised)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: on ? 500 : 400,
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

const REACTION_LABELS: [Reaction, string][] = [['important', 'Important'], ['surprising', 'Surprising'], ['more', 'Tell me more']];

export function ReactionRow({ id, current, small = false }: { id: string; current?: Reaction; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="React to this story">
      {REACTION_LABELS.map(([r, l]) => {
        const on = current === r;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={(e) => {
              e.stopPropagation();
              react(id, r);
            }}
            className="inline-flex items-center gap-1"
            style={{
              height: small ? 36 : 34, padding: '0 12px', borderRadius: 99, fontSize: small ? 12 : 13, cursor: 'pointer',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-highlight)'}`,
              background: on ? 'var(--accent-soft)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {on && <Check className="w-3.5 h-3.5" aria-hidden />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600 }}>{title}</h2>
      {meta && <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{meta}</span>}
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
