'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefs } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';
import { ALL_CATEGORY_SLUGS } from '@/lib/categoryPicker';
import type { CategorySlug } from '@/lib/categories';
import CategoryPicker from './CategoryPicker';
import { setSummaryMode, useReading, type SummaryMode } from '@/lib/reading';
import { Logo } from './Sidebar';

export default function Onboarding() {
  const hydrated = useHydrated();
  const [prefs, setPrefs] = usePrefs();
  if (!hydrated || prefs.onboarded) return null;
  return <Sheet initial={prefs.categories} setPrefs={setPrefs} />;
}

function Sheet({
  initial,
  setPrefs,
}: {
  initial: CategorySlug[];
  setPrefs: (p: { categories: CategorySlug[]; onboarded: boolean }) => void;
}) {
  const [selected, setSelected] = useState<CategorySlug[]>(initial);
  const dialogRef = useRef<HTMLDivElement>(null);
  const skip = () => setPrefs({ categories: [...ALL_CATEGORY_SLUGS], onboarded: true });

  // Lock body scroll, move focus into the dialog, restore on close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  // Document-level so Escape/Tab work even if focus has left the dialog.
  const onKeyDownRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKeyDownRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDownRef.current(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
      }}
      style={{ background: 'rgba(5,6,8,0.75)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-desc"
        tabIndex={-1}
        className="w-full sm:max-w-3xl flex flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-highlight)', maxHeight: '94dvh' }}
      >
        <div className="flex flex-col" style={{ padding: '24px 24px 8px', gap: 18 }}>
          <Logo />
          <div className="flex flex-col" style={{ gap: 8 }}>
            <h2 id="onboarding-title" style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              What should your brief cover?
            </h2>
            <p id="onboarding-desc" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-muted)' }}>
              Pick a few topics. Datrix reads everything and gives you only what matters. You can change this any time.
            </p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 flex flex-col" style={{ padding: '8px 24px 16px', gap: 28 }}>
          <CategoryPicker selected={selected} onChange={setSelected} />
          <SummaryStylePicker />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)' }}>
            Skip and we’ll start with top stories from every topic.
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => skip()}
              style={{ height: 48, padding: '0 20px', fontSize: 14, borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-highlight)', cursor: 'pointer' }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setPrefs({ categories: selected, onboarded: true })}
              style={{ height: 48, padding: '0 22px', fontSize: 14, fontWeight: 600, borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: 'pointer', flex: '1 1 auto' }}
            >
              Start my brief
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const STYLES: { mode: SummaryMode; title: string; body: string; lines: number[] }[] = [
  { mode: 'headlines', title: 'Headlines', body: 'The headline and one line. About 5 seconds a story.', lines: [85] },
  { mode: 'key', title: 'Key points', body: '2–3 bullet points. About 20 seconds a story.', lines: [85, 70, 60] },
  { mode: 'detailed', title: 'Detailed', body: 'Key points plus context. About a minute a story.', lines: [90, 95, 80, 50] },
];

export function SummaryStylePicker() {
  const { summaryMode } = useReading();
  return (
    <section aria-labelledby="style-h" className="flex flex-col" style={{ gap: 12 }}>
      <h3 id="style-h" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>How short should summaries be?</h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {STYLES.map((st) => {
          const on = st.mode === summaryMode;
          return (
            <button
              key={st.mode}
              type="button"
              aria-pressed={on}
              onClick={() => setSummaryMode(st.mode)}
              className="flex flex-col text-left"
              style={{
                gap: 8, padding: 16, borderRadius: 16, cursor: 'pointer', color: 'var(--text-primary)',
                border: on ? '2px solid var(--accent)' : '1px solid var(--border-highlight)', background: on ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{st.title}{st.mode === 'key' && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-ink)' }}>Recommended</span>}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>{st.body}</span>
              <span aria-hidden className="flex flex-col" style={{ gap: 5, paddingTop: 2 }}>
                {st.lines.map((w, i) => <span key={i} style={{ height: 6, width: `${w}%`, borderRadius: 3, background: on && i === 0 ? 'var(--accent)' : 'var(--border-highlight)', display: 'block' }} />)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
