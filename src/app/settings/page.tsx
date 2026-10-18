'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePrefs } from '@/lib/prefs';
import { currentTimeZone, disablePush, enablePush, getPushSupport, hasPushSubscription, sendTestPush, type PushStatus } from '@/lib/pushClient';
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


const STATUS_MESSAGES: Record<Exclude<PushStatus, 'ok'>, string> = {
  denied: 'Notifications are blocked in your browser settings',
  unsupported: "This browser or build doesn't support push notifications",
  'needs-install':
    'On iPhone/iPad, first tap Share → Add to Home Screen, then open Datrix from your home screen and enable notifications there',
  limit: 'Notification service is full right now, try again later',
  error: "Couldn't enable notifications, try again",
};
const TEST_MESSAGES = {
  sent: 'Test notification sent.',
  cooldown: 'Please wait 30 seconds before sending another test.',
  gone: 'Your subscription expired — please re-enable notifications.',
  error: "Couldn't send the test notification.",
} as const;

function NotificationsSection() {
  const hydrated = useHydrated();
  const [prefs, setPrefs] = usePrefs();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const labelStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' };

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    if (prefs.notifyEnabled) {
      hasPushSubscription().then((v) => {
        if (alive) setSubscribed(v);
      });
    }
    return () => {
      alive = false;
    };
  }, [hydrated, prefs.notifyEnabled]);

  const onToggle = async (checked: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    if (checked) {
      // Called directly from the click so the permission prompt keeps its user gesture.
      const status = await enablePush(prefs);
      if (status === 'ok') {
        setPrefs({ notifyEnabled: true });
        setSubscribed(true);
        setMessage('Notifications enabled.');
      } else {
        setPrefs({ notifyEnabled: false });
        setMessage(STATUS_MESSAGES[status]);
      }
    } else {
      await disablePush();
      setPrefs({ notifyEnabled: false });
      setSubscribed(false);
      setMessage('Notifications turned off.');
    }
    setBusy(false);
  };

  const onTest = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const r = await sendTestPush();
    if (r === 'gone') {
      setPrefs({ notifyEnabled: false });
      setSubscribed(false);
    }
    setMessage(TEST_MESSAGES[r]);
    setBusy(false);
  };

  const support = hydrated ? getPushSupport() : 'ok';
  const toggleDisabled = !hydrated || busy || (!prefs.notifyEnabled && support !== 'ok');

  return (
    <section style={sectionStyle} aria-labelledby="set-notify">
      <h2 id="set-notify" style={h2Style}>Notifications</h2>
      <p style={{ ...hintStyle, marginBottom: 12 }}>
        Get one notification a day at the time you choose, sent after the daily news refresh, with your selected categories.
      </p>
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2" style={labelStyle}>
          <input
            type="checkbox"
            disabled={toggleDisabled}
            checked={hydrated && prefs.notifyEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Daily digest notification
        </label>
        <label className="flex items-center gap-2" style={labelStyle}>
          Send time
          <input
            type="time"
            step={300}
            value={prefs.notifyTime}
            disabled={!hydrated || busy}
            onChange={(e) => {
              if (e.target.value) setPrefs({ notifyTime: e.target.value });
            }}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-highlight)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
          />
        </label>
        <button type="button" style={{ ...btn, opacity: prefs.notifyEnabled && subscribed && !busy ? 1 : 0.5 }} disabled={!hydrated || busy || !prefs.notifyEnabled || !subscribed} onClick={onTest}>
          Send test notification
        </button>
      </div>
      <p style={{ ...hintStyle, marginTop: 12 }}>Your time zone: {hydrated ? currentTimeZone() : '…'}</p>
      <p style={{ ...hintStyle, marginTop: 4 }}>
        On iPhone/iPad: tap Share → Add to Home Screen first, then open Datrix from your home screen to enable notifications.
      </p>
      <p role="status" aria-live="polite" style={{ ...hintStyle, marginTop: 8, color: 'var(--text-primary)', minHeight: 18 }}>
        {message}
      </p>
    </section>
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

        <NotificationsSection />

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
