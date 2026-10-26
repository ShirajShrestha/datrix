'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Layers, Search, Bookmark, SlidersHorizontal, Zap } from 'lucide-react';
import { usePrefs, effectiveCategories } from '@/lib/prefs';
import { orderedCategories } from '@/lib/categoryPicker';
import { useHydrated } from '@/lib/useHydrated';
import { useSavedArticles } from '@/lib/savedArticles';
import { TopicDot } from '@/components/ui';

export const NAV = [
  { href: '/', label: 'Today', short: 'Today', icon: Sun },
  { href: '/digest', label: 'Daily digest', short: 'Digest', icon: Layers },
  { href: '/search', label: 'Search', short: 'Search', icon: Search },
  { href: '/saved', label: 'Saved', short: 'Saved', icon: Bookmark },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap className="w-4 h-4" fill="var(--accent-ink)" stroke="var(--accent-ink)" aria-hidden />
      </span>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Datrix</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const saved = useSavedArticles();
  const topics = hydrated ? orderedCategories(effectiveCategories(prefs)) : [];

  const item = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 12px', borderRadius: 10, textDecoration: 'none',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14, fontWeight: active ? 500 : 400,
  });

  return (
    <aside
      className="hidden lg:flex flex-col sticky top-0 h-screen shrink-0"
      style={{ width: 248, padding: '24px 16px', gap: 28, borderRight: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}
      aria-label="Main"
    >
      <div style={{ padding: '0 8px' }}>
        <Logo />
      </div>
      <nav className="flex flex-col" style={{ gap: 2 }}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} style={item(active)} aria-current={active ? 'page' : undefined}>
              <Icon className="w-[18px] h-[18px]" style={{ color: active ? 'var(--accent)' : undefined }} aria-hidden />
              {n.label}
              {n.href === '/saved' && hydrated && saved.length > 0 && (
                <span className="ml-auto tabular-nums" style={{ fontSize: 12, color: 'var(--text-faint)' }}>{saved.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col min-h-0" style={{ gap: 2 }}>
        <div className="flex items-center justify-between" style={{ padding: '0 12px 8px' }}>
          <span className="kicker">Topics</span>
          <Link href="/settings" style={{ fontSize: 12, color: 'var(--accent)' }}>Edit</Link>
        </div>
        <div className="flex flex-col overflow-y-auto no-scrollbar" style={{ gap: 2 }}>
          {topics.map((c) => {
            const href = `/category/${c.slug}`;
            const active = pathname === href;
            return (
              <Link key={c.slug} href={href} style={{ ...item(active), height: 36, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }} aria-current={active ? 'page' : undefined}>
                <TopicDot slug={c.slug} />
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col" style={{ gap: 6, padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Daily digest</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {hydrated && prefs.notifyEnabled ? `Every day · ${prefs.notifyTime}` : 'Notifications off'}
        </span>
        <Link href="/settings" className="flex items-center gap-2" style={{ ...item(pathname === '/settings'), height: 36, padding: 0, background: 'transparent', fontSize: 13 }}>
          <SlidersHorizontal className="w-4 h-4" aria-hidden /> Settings
        </Link>
      </div>
    </aside>
  );
}
