'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { topicTone } from '@/components/ui';
import type { useReadingStats } from '@/lib/useReadingStats';

type Stats = ReturnType<typeof useReadingStats>;

export function StreakCard({ stats }: { stats: Stats }) {
  return (
    <section aria-labelledby="streak-h" className="flex flex-col" style={{ gap: 14, padding: 20, borderRadius: 20, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)' }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <Flame className="w-[34px] h-[34px]" fill="var(--amber)" stroke="var(--amber)" strokeWidth={1.2} aria-hidden />
        <div className="flex flex-col">
          <h2 id="streak-h" className="tabular-nums" style={{ margin: 0, fontWeight: 500, fontSize: 30, lineHeight: 1 }}>
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reading streak{stats.bestStreak > stats.streak ? ` · best ${stats.bestStreak}` : ''}</span>
        </div>
      </div>
      <ol className="grid grid-cols-7" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }} aria-label="Last 7 days">
        {stats.week.map((d) => (
          <li key={d.day} className="flex flex-col items-center" style={{ gap: 6, fontSize: 11, color: 'var(--text-muted)' }} aria-label={`${d.day}: ${d.read ? 'read' : 'not read'}`}>
            <span
              style={{
                width: 28, height: 28, borderRadius: 99, display: 'block',
                background: d.read ? 'var(--amber)' : 'transparent',
                border: d.read ? 0 : `2px ${d.today ? 'dashed' : 'solid'} ${d.today ? 'var(--amber)' : 'var(--amber-border)'}`,
              }}
            />
            {d.label}
          </li>
        ))}
      </ol>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {stats.today > 0 ? 'Today counts. See you tomorrow.' : 'Read one story today to keep it going.'}
      </span>
    </section>
  );
}

export function DietCard({ stats }: { stats: Stats }) {
  const diet = stats.diet;
  const top = diet.slice(0, 5);
  const readSlugs = new Set(diet.map((d) => d.slug));
  const missing = CATEGORIES.find((c) => !readSlugs.has(c.slug) && ['science', 'health', 'environment', 'technology', 'business'].includes(c.slug));
  return (
    <section aria-labelledby="diet-h" className="flex flex-col" style={{ gap: 14, padding: 20, borderRadius: 20, border: '1px solid var(--border)' }}>
      <h2 id="diet-h" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>Your news diet · 7 days</h2>
      {top.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Open a few stories and you’ll see what you’ve been reading about here.</p>
      ) : (
        <>
          <div className="flex overflow-hidden" style={{ height: 10, borderRadius: 99, gap: 2 }} role="img" aria-label={top.map((d) => `${getCategory(d.slug)?.label ?? d.slug} ${Math.round(d.share * 100)}%`).join(', ')}>
            {top.map((d) => <span key={d.slug} style={{ width: `${d.share * 100}%`, background: topicTone(d.slug), display: 'block' }} />)}
          </div>
          <div className="grid grid-cols-2" style={{ gap: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {top.map((d) => (
              <span key={d.slug} className="flex items-center gap-1.5">
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: topicTone(d.slug), display: 'block' }} />
                {getCategory(d.slug)?.label.split(' &')[0] ?? d.slug} {Math.round(d.share * 100)}%
              </span>
            ))}
          </div>
          {missing && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
              No <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{missing.label}</strong> this week.{' '}
              <Link href={`/category/${missing.slug}`} style={{ color: 'var(--accent)' }}>Try one story →</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
