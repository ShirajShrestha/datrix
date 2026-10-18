'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePrefs } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';
import CategoryPicker from '@/components/CategoryPicker';
import { ThemeToggle } from '@/components/ThemeToggle';

const SAVED_ARTICLES_KEY = 'newsintel_saved_articles';

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
};
const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  marginBottom: 4,
};
const hintStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' };
const btn: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 13,
  borderRadius: 8,
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-highlight)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

function ClearSaved() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  const clear = () => {
    try {
      localStorage.removeItem(SAVED_ARTICLES_KEY);
    } catch {
      /* storage blocked */
    }
    setStep('done');
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {step === 'idle' && (
        <button type="button" style={btn} onClick={() => setStep('confirm')}>
          Clear
        </button>
      )}
      {step === 'confirm' && (
        <>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Really clear?</span>
          <button type="button" style={{ ...btn, background: 'var(--accent-high)', color: '#fff', border: 'none' }} onClick={clear}>
            Yes
          </button>
          <button type="button" style={btn} onClick={() => setStep('idle')}>
            No
          </button>
        </>
      )}
      {step === 'done' && (
        <span role="status" style={hintStyle}>Saved articles cleared.</span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const [prefs, setPrefs] = usePrefs();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <Link href="/" style={{ fontSize: 14, color: 'var(--accent-brand)', fontFamily: 'var(--font-sans)' }}>
            Back to Home
          </Link>
        </div>

        <section style={sectionStyle} aria-labelledby="set-cats">
          <h2 id="set-cats" style={h2Style}>Categories</h2>
          <p style={{ ...hintStyle, marginBottom: 12 }}>
            Choose what appears in your feed. Nothing selected shows everything.
          </p>
          {hydrated ? (
            <CategoryPicker selected={prefs.categories} onChange={(categories) => setPrefs({ categories })} />
          ) : (
            <div style={{ height: 200 }} />
          )}
        </section>

        <section style={sectionStyle} aria-labelledby="set-notify">
          <h2 id="set-notify" style={h2Style}>Notifications</h2>
          <p style={{ ...hintStyle, marginBottom: 12 }}>Coming in a later update</p>
          <div className="flex items-center gap-6 flex-wrap" style={{ opacity: 0.6 }}>
            <label className="flex items-center gap-2" style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
              <input
                type="checkbox"
                disabled
                checked={prefs.notifyEnabled}
                onChange={(e) => setPrefs({ notifyEnabled: e.target.checked })}
              />
              Daily digest notification
            </label>
            <label className="flex items-center gap-2" style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
              Time
              <input
                type="time"
                disabled
                value={prefs.notifyTime}
                onChange={(e) => setPrefs({ notifyTime: e.target.value })}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-highlight)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="set-theme">
          <div className="flex items-center justify-between">
            <h2 id="set-theme" style={{ ...h2Style, marginBottom: 0 }}>Theme</h2>
            <ThemeToggle />
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="set-saved">
          <h2 id="set-saved" style={h2Style}>Saved articles</h2>
          <p style={{ ...hintStyle, marginBottom: 12 }}>Removes all bookmarked articles from this browser.</p>
          <ClearSaved />
        </section>
      </div>
    </div>
  );
}
