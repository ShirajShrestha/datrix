'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefs } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';
import { ALL_CATEGORY_SLUGS } from '@/lib/categoryPicker';
import type { CategorySlug } from '@/lib/categories';
import CategoryPicker from './CategoryPicker';

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

  const onKeyDown = (e: React.KeyboardEvent) => {
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
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-desc"
        onKeyDown={onKeyDown}
        className="w-full sm:max-w-2xl flex flex-col rounded-t-2xl sm:rounded-2xl"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-highlight)',
          maxHeight: '92dvh',
        }}
      >
        <div className="px-5 pt-5 pb-3">
          <h2
            id="onboarding-title"
            className="font-serif"
            style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}
          >
            Welcome to Datrix
          </h2>
          <p
            id="onboarding-desc"
            style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}
          >
            Pick the topics you care about. You can change this any time in Settings.
          </p>
        </div>
        <div className="px-5 pb-3 overflow-y-auto flex-1">
          <CategoryPicker selected={selected} onChange={setSelected} />
        </div>
        <div
          className="px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {selected.length === 0 ? 'Nothing selected shows everything' : `${selected.length} selected`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => skip()}
              style={{
                padding: '9px 16px',
                fontSize: 14,
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-highlight)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setPrefs({ categories: selected, onboarded: true })}
              style={{
                padding: '9px 20px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                background: 'var(--accent-brand)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
